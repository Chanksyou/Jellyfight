// A boss fight can rearrange the room it's fought in (a stage's boss.set), out of sight under the
// fade into the fight, and the next run puts it back. Act 2's: the bathtub widened for the Clog,
// what stood in front of it moved out of its way.
//   stretch  [{ name, z: [from, by] }]: that piece `by` times as deep along z, out from the plane
//            z = `from`: a stretched copy, solid only while it's shown, stands in for the real one
//   move     { name: [dx, dy, dz] }: pieces moved by that much
//   hide     [name]: pieces hidden (not shown, not solid)
//   show     [name]: pieces shown only during the fight (built hidden: bathroom.js's widened dressing)
import * as THREE from 'three';
import { meshesNamed } from './traversal.js';

// the outermost objects with that name (a group and not also its children)
function named(scene, name) {
  const want = THREE.PropertyBinding.sanitizeNodeName(name), out = [];
  scene.traverse((o) => { if (o.name === want && !out.some((p) => isUnder(o, p))) out.push(o); });
  return out;
}
const isUnder = (o, p) => { for (o = o.parent; o; o = o.parent) if (o === p) return true; return false; };

export class BossSet {
  constructor(scene, world, set) {
    this.scene = scene;
    this.set = set || {};
    this.isOn = false;
    this.stretched = [];   // [real mesh, its stretched copy]
    scene.updateMatrixWorld(true);
    for (const { name, z: [from, by] } of this.set.stretch || []) {
      const s = new THREE.Matrix4().makeTranslation(0, 0, from).multiply(new THREE.Matrix4().makeScale(1, 1, by)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -from));
      for (const m of meshesNamed(scene, name)) {
        if (!m.visible) continue;   // already hidden by the stage (the blob in the tub)
        // stretched in the mesh's own space, so it holds whatever it hangs from (a copy: a model may share geometry)
        const local = m.matrixWorld.clone().invert().multiply(s).multiply(m.matrixWorld);
        const copy = new THREE.Mesh(m.geometry.clone().applyMatrix4(local), m.material);
        copy.name = m.name;
        copy.position.copy(m.position); copy.quaternion.copy(m.quaternion); copy.scale.copy(m.scale);
        copy.userData = { ...m.userData };
        copy.visible = false;
        m.parent.add(copy);
        if (!m.userData.noCollide) world.addCollider(copy, false);   // hidden pieces don't collide (collision.js)
        this.stretched.push([m, copy]);
      }
    }
  }

  // rearrange the room for the fight (on) or put it back (off)
  apply(on) {
    if (on === this.isOn) return;
    this.isOn = on;
    for (const [m, copy] of this.stretched) { m.visible = !on; copy.visible = on; }
    for (const [name, d] of Object.entries(this.set.move || {})) {
      for (const o of named(this.scene, name)) { o.position.x += on ? d[0] : -d[0]; o.position.y += on ? d[1] : -d[1]; o.position.z += on ? d[2] : -d[2]; o.updateMatrixWorld(true); }
    }
    for (const name of this.set.hide || []) for (const o of named(this.scene, name)) o.visible = !on;
    for (const name of this.set.show || []) for (const o of named(this.scene, name)) o.visible = on;
  }
}
