// Getting around a world built for giants: floor vents that launch you onto furniture, and fabric you can climb.
// Also sets the apartment up for a stage (doors, see-through pieces, invisible walls).
import * as THREE from 'three';
import { addForceField } from './forcefield.js';
import { VentAir } from './vent-air.js';

// Apartment objects are named after what they are ("Shower curtain"); three.js's loader
// swaps spaces for underscores, so match the loaded form. Returns every mesh under them.
export function meshesNamed(scene, name) {
  const want = THREE.PropertyBinding.sanitizeNodeName(name);
  const out = new Set();
  scene.traverse((o) => {
    if (o.name !== want) return;
    o.traverse((m) => { if (m.isMesh) out.add(m); });
  });
  return [...out];
}

// Hide part of an instanced mesh: the instances standing inside the box [min, max] (world m)
// shrink to nothing; the rest stay (the model's instanced leaves are shared by plants all over)
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), NONE = new THREE.Matrix4().makeScale(0, 0, 0);
function hideWithin(m, [min, max]) {
  if (!m.isInstancedMesh) { m.visible = false; m.userData.noCollide = true; return; }
  m.updateWorldMatrix(true, false);
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, _m);
    _p.setFromMatrixPosition(_m).applyMatrix4(m.matrixWorld);
    if (_p.x >= min[0] && _p.x <= max[0] && _p.y >= min[1] && _p.y <= max[1] && _p.z >= min[2] && _p.z <= max[2]) m.setMatrixAt(i, NONE);
  }
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
}

// Call before building the collision world
export function prepareApartment(apt, stage) {
  // replaced by something of the game's own: a name, or { name, within: [min, max] } for only
  // the instances of an instanced mesh inside that box
  for (const h of stage.hide || []) {
    if (typeof h === 'string') meshesNamed(apt.scene, h).forEach((m) => { m.visible = false; m.userData.noCollide = true; });
    else meshesNamed(apt.scene, h.name).forEach((m) => hideWithin(m, h.within));
  }
  for (const name of stage.noCollide || []) meshesNamed(apt.scene, name).forEach((m) => { m.userData.noCollide = true; });
  for (const [name, opacity] of Object.entries(stage.fade || {})) {
    meshesNamed(apt.scene, name).forEach((m) => {
      m.material = m.material.clone();
      m.material.transparent = true;
      m.material.opacity = opacity;
      m.material.depthWrite = false;
    });
  }
  for (const [id, state] of Object.entries(stage.doors || {})) {
    const d = apt.doors[id];
    if (d) d.set(state === 'open' ? d.open : typeof state === 'number' ? d.open * state : 0);   // a number: that fraction open (ajar)
  }
}

export function addStageWalls(world, stage, scene) {
  for (const w of stage.walls || []) {
    if (scene) addForceField(scene, w);   // so you can see it's there (forcefield.js)
    const size = w.max.map((v, i) => v - w.min[i]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    m.position.set(...w.min.map((v, i) => v + size[i] / 2));
    world.addCollider(m);
  }
}

export class Traversal {
  constructor(scene, stage) {
    this.scene = scene;
    this.bossMode = false;
    this.group = new THREE.Group();
    this.group.name = 'Traversal';
    scene.add(this.group);

    this.vents = stage.vents.map((v) => {
      const [x, y, z] = v.at;
      return { ...v, x, y, z, h: v.land[1] + 0.06 - y };
    });
    this.air = new VentAir(this.group, this.vents);

    this.climbs = stage.climbs.map((c) => ({
      ...c,
      box: new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max)),
    }));
  }

  // Move vent i: its floor plate to `at`, and where it throws you to `land` (the layout editor)
  placeVent(i, at, land) {
    const v = this.vents[i];
    v.at = [...at]; v.land = [...land];
    [v.x, v.y, v.z] = at;
    v.h = Math.max(0.05, land[1] + 0.06 - v.y);
    this.air.build(this.vents);
  }

  // What's acting on a player standing at `p` (feet position)
  query(p) {
    let vent = null, climb = null;
    for (const v of this.vents) {
      if (this.bossMode) break;
      if (Math.hypot(p.x - v.x, p.z - v.z) < v.radius && p.y < v.y + 0.02 && p.y > v.y - 0.02) vent = v;
    }
    for (const c of this.climbs) {
      if (this.bossMode && c.boss === false) continue;
      if (c.box.containsPoint(p)) climb = c;
    }
    return { vent, climb };
  }

  update(dt, env) { this.air.update(dt, env); }
}
