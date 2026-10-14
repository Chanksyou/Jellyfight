import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBeetle } from './beetle-anim.js';

// The rhinoceros beetle: the game's first loaded bug model (every other bug is
// procedural, in critters.js). The model (assets/beetle.glb, converted from
// Chandan's Blender file) starts loading at import; a spawn before it lands
// gets an empty body that fills in when the download finishes — in practice
// long before anyone can pick the beetle in 1 on 1. Posing is procedural
// (beetle-anim.js): a tripod-gait walk, and a horn charge whose glowing orb
// is the spit word's warning (the word fires the real shots; the animator's
// own energy balls are suppressed so damage never doubles up).
const BUILD_LEN = 2.55;   // how long the build is, in the radius units every bug is built in

let template = null, templateLen = 1;
const waiting = new Set();
new GLTFLoader().loadAsync('assets/beetle.glb').then((g) => {
  template = g.scene;
  const s = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  templateLen = Math.max(s.x, s.z);
  for (const fill of [...waiting]) { waiting.delete(fill); fill(); }
}).catch((err) => console.error('beetle model failed to load', err));

export function buildBeetle() {
  const outer = new THREE.Group();
  let A = null, wasAiming = false;
  const fill = () => {
    const model = template.clone();
    model.scale.setScalar(BUILD_LEN / templateLen);
    A = createBeetle(model, { balls: false });
    A.group.rotation.y = Math.PI;                       // the animator faces -Z; the bugs face +Z
    A.group.position.y -= new THREE.Box3().setFromObject(A.group).min.y;   // feet on the ground
    outer.add(A.group);
  };
  if (template) fill(); else waiting.add(fill);
  const anim = (dt, e) => {
    if (!A) return;
    A.setState(Math.hypot(e.vel.x, e.vel.z) > 0.01 ? 'walk' : 'idle');
    if (e.aimT > 0 && !wasAiming) A.attack();            // the spit word started its wind-up: charge the horns
    wasAiming = e.aimT > 0;
    A.update(dt);
  };
  return { body: outer, face: new THREE.Group(), anim };
}
