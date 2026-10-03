// Getting around a world built for giants: floor vents that launch you onto furniture, and fabric you can climb.
// Also sets the apartment up for a stage (doors, see-through curtain, invisible walls).
import * as THREE from 'three';

// Apartment objects are named after what they are ("Shower curtain"); three.js's loader
// swaps spaces for underscores, so match the loaded form. Returns every mesh under them.
function meshesNamed(scene, name) {
  const want = THREE.PropertyBinding.sanitizeNodeName(name);
  const out = new Set();
  scene.traverse((o) => {
    if (o.name !== want) return;
    o.traverse((m) => { if (m.isMesh) out.add(m); });
  });
  return [...out];
}

// Call before building the collision world
export function prepareApartment(apt, stage) {
  for (const name of stage.hide || []) meshesNamed(apt.scene, name).forEach((m) => { m.visible = false; m.userData.noCollide = true; });   // replaced by something of the game's own
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

export function addStageWalls(world, stage) {
  for (const w of stage.walls || []) {
    const size = w.max.map((v, i) => v - w.min[i]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    m.position.set(...w.min.map((v, i) => v + size[i] / 2));
    world.addCollider(m);
  }
}

// A floor grille texture: dark metal with slots
function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#2b2a28';
  for (let i = 0; i < 9; i++) g.fillRect(10, 10 + i * 8.6, 108, 4.5);
  g.strokeStyle = '#a9a59c'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Traversal {
  constructor(scene, stage) {
    this.scene = scene;
    this.bossMode = false;
    this.group = new THREE.Group();
    this.group.name = 'Traversal';
    scene.add(this.group);

    const grille = grilleTexture();
    this.vents = stage.vents.map((v) => {
      const [x, y, z] = v.at;
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(v.radius * 2.2, 0.002, v.radius * 1.6),
        new THREE.MeshStandardMaterial({ map: grille, roughness: 0.5, metalness: 0.4 }),
      );
      plate.position.set(x, y + 0.001, z);
      plate.receiveShadow = true;
      this.group.add(plate);

      // shimmer column + rising specks so the vent reads from across the room
      const h = v.land[1] + 0.06 - y;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(v.radius * 0.9, v.radius, h, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      col.position.set(x, y + h / 2, z);
      this.group.add(col);
      const n = 40, pos = new Float32Array(n * 3), seeds = [];
      for (let i = 0; i < n; i++) seeds.push([Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * v.radius, Math.random()]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.003, transparent: true, opacity: 0.7, depthWrite: false }));
      pts.frustumCulled = false;
      this.group.add(pts);
      return { ...v, x, y, z, h, pts, seeds, plate, col };
    });

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
    v.plate.position.set(v.x, v.y + 0.001, v.z);
    v.col.geometry.dispose();
    v.col.geometry = new THREE.CylinderGeometry(v.radius * 0.9, v.radius, v.h, 24, 1, true);
    v.col.position.set(v.x, v.y + v.h / 2, v.z);
    v.plate.updateMatrixWorld(); v.col.updateMatrixWorld();
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

  update(dt) {
    for (const v of this.vents) {
      const a = v.pts.geometry.attributes.position;
      for (let i = 0; i < v.seeds.length; i++) {
        const s = v.seeds[i];
        s[2] = (s[2] + dt * 0.35) % 1;           // rise
        s[0] += dt * 0.8;                         // swirl
        a.setXYZ(i, v.x + Math.cos(s[0]) * s[1], v.y + s[2] * v.h, v.z + Math.sin(s[0]) * s[1]);
      }
      a.needsUpdate = true;
    }
  }
}
