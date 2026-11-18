// The jelly's oral arms: frilly ribbons hanging from the middle of the bell. Each is a short chain
// (the same soft rope in water as a tentacle, chain.js, but heavier and draggier) in the water the
// bell carries along with it, so they barely trail while it cruises but keep going the old way
// through a turn, swing on after a stop and are pushed outward as the bell relaxes after each
// stroke (the stopping vortex rolling out under the rim). The arm's mesh never changes on the CPU: its
// vertex shader moves each vertex by the chain's offset at its depth down the arm (5 uniforms per
// arm; every arm's material is a clone sharing one program). At rest every offset is zero, so the
// arm is drawn exactly as built.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { stepChain } from './chain.js';

const PTS = 5;                    // chain points root to end (the shader's armBend[5])
const K_ROOT = 500, DAMP = 0.6, STEP = 1 / 60, KEEP = 0.15;
const _s = new THREE.Vector3(), _v = new THREE.Vector3(), _flow = new THREE.Vector3();

// The arm's vertex shader: a vertex `armDepth` of the way down the arm (0 root, 1 end: see
// `depth`; a pom-pom on the end is all 1, so it rides the end whole) moves by the chain's offset
// there, blended between the two nearest points. Every arm gets its own closure, but they read
// the same, so three.js builds one program for all.
function bendShader(bend) {
  return (sh) => {
    sh.uniforms.armBend = { value: bend };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 armBend[5];\nattribute float armDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat armF = armDepth * 4.0;\nfor (int k = 0; k < 5; k++) transformed += armBend[k] * max(0.0, 1.0 - abs(armF - float(k)));');
  };
}

// Mark how far down the arm each vertex of `geo` is (the shader's armDepth): by its height below
// the pivot, or `at` for every vertex (a pom-pom: 1). Returns geo.
export function depth(geo, len, at = null) {
  const p = geo.attributes.position, d = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) d[i] = at ?? Math.min(1, Math.max(0, -p.getY(i) / len));
  geo.setAttribute('armDepth', new THREE.BufferAttribute(d, 1));
  return geo;
}

export class ArmRig {
  // len: each arm's length (model units, hanging down -y from its pivot); unitNode: a group whose
  // world scale is one model unit (the body's squash and the bell's squeeze must not move the
  // chain); floorRoot: the character's root (its feet are the floor)
  constructor(len, unitNode, floorRoot) {
    this.len = len;
    this.unitNode = unitNode;
    this.floorRoot = floorRoot;
    this.weight = LOOK.num('jelly-motion-arm-weight', 1.5);
    this.alongDrag = LOOK.num('jelly-motion-drag-along', 0.5);
    this.flare = LOOK.num('jelly-motion-arm-flare', 0.5);
    this.carry = LOOK.num('jelly-motion-arm-carry', 0.8);
    this.flowMax = LOOK.num('jelly-motion-arm-carry-max', 6);
    this.compliance = LOOK.num('jelly-motion-bend-compliance', 0.0002);
    const kTip = LOOK.num('jelly-motion-arm-spring', 60), drag = LOOK.num('jelly-motion-arm-drag', 9);
    this.K = Array.from({ length: PTS }, (_, j) => K_ROOT + (kTip - K_ROOT) * (j / (PTS - 1)) ** 0.6);
    this.C = this.K.map((k) => Math.max(drag, 2 * DAMP * Math.sqrt(k)));
    this.list = [];
    this.work = 0;
    this.fresh = true;
    this.unit = 0;
    this.lastRoot = new THREE.Vector3();
    this.inv = new THREE.Matrix4();
  }

  // an arm hanging from `pivot`: returns its own copy of `material`, bent by its chain
  add(pivot, material) {
    const v3 = () => Array.from({ length: PTS }, () => new THREE.Vector3());
    const A = { pivot, bend: v3(), sim: v3(), vel: v3(), goal: v3(), mat: material.clone() };
    A.mat.onBeforeCompile = bendShader(A.bend);
    this.list.push(A);
    return A.mat;
  }

  // state: { contract (1 squeezed .. below 0 relaxed open), rest }
  update(dt, state) {
    this.work = 0;
    if (!this.list.length) return;
    if (state.rest) {   // the rest pose: drawn as built
      this.fresh = true;
      for (const A of this.list) for (const b of A.bend) b.set(0, 0, 0);
      return;
    }
    this.list[0].pivot.parent.updateWorldMatrix(true, false);
    this.unit ||= _s.setFromMatrixScale(this.unitNode.matrixWorld).x || 1;
    const unit = this.unit, L = this.len;
    // a jump cut (respawn, a menu, the first frame): start the chains on their pose
    _v.setFromMatrixPosition(this.floorRoot.matrixWorld).divideScalar(unit);
    if (this.fresh || dt <= 0 || dt > 0.25 || _v.distanceTo(this.lastRoot) > 3) this.fresh = true;
    // the water under the bell moves along with it (most of the way): what the arms are dragged through
    if (!this.fresh) _flow.copy(_v).sub(this.lastRoot).multiplyScalar(this.carry / dt).clampLength(0, this.flowMax);   // (a blink or a shove: no whipping)
    this.lastRoot.copy(_v);
    const floor = _v.y + 0.015;
    // pushed out (along the pivot's +z, away from the middle) while the bell relaxes open
    const push = this.flare * L * Math.max(0, -state.contract);
    const n = Math.min(6, Math.max(1, Math.round(dt / STEP))), h = dt / n;
    const slip = 1 - this.alongDrag, sink = this.weight * h, bend = 1 / (1 + this.compliance / (h * h));
    for (const A of this.list) {
      A.pivot.updateWorldMatrix(false, false);
      const M = A.pivot.matrixWorld;
      for (let j = 0; j < PTS; j++) { const s = j / (PTS - 1); A.goal[j].set(0, -L * s, push * s).applyMatrix4(M).divideScalar(unit); }
      if (this.fresh) for (let j = 0; j < PTS; j++) { A.sim[j].copy(A.goal[j]); A.vel[j].set(0, 0, 0); }
      else {
        this.work += n * (PTS - 1);
        for (let it = 0; it < n; it++) stepChain(A.sim, A.vel, A.goal, this.K, this.C, h, slip, sink, bend, KEEP, _flow);
        for (let j = 1; j < PTS; j++) if (A.sim[j].y < floor) { A.sim[j].y = floor; if (A.vel[j].y < 0) A.vel[j].y = 0; }
      }
      // each point's offset from where the arm was built, in the pivot's frame (the shader's armBend)
      this.inv.copy(M).invert();
      for (let j = 0; j < PTS; j++) A.bend[j].copy(A.sim[j]).multiplyScalar(unit).applyMatrix4(this.inv).y += L * j / (PTS - 1);
    }
    this.fresh = false;
  }

  reset() { this.fresh = true; }
}
