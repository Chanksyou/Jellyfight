// The jelly's six tentacles: soft tubes that hang from under the bell, trail behind as it
// swims, stream upward as it falls, and whip out one at a time when the Lash strikes.
//
// Works in the character's model units (1 unit = the character's height, feet at y = 0,
// facing +z). The rig is rebuilt every frame from a few numbers, so nothing is simulated.
import * as THREE from 'three';

const SEG = 12;       // rings along a tentacle
const RAD = 6;        // vertices around a ring
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);

function tubeGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3));
  const idx = [];
  for (let j = 0; j < SEG; j++) {
    for (let k = 0; k < RAD; k++) {
      const a = j * RAD + k, b = j * RAD + (k + 1) % RAD, c = a + RAD, d = b + RAD;
      idx.push(a, b, c, b, d, c);
    }
  }
  g.setIndex(idx);
  return g;
}

export class TentacleRig {
  // parent: the group the tentacles hang from (moves and tilts with the bell).
  // opts: { count, radius (anchor ring), y (anchor height), length, thickness, material }
  constructor(parent, opts) {
    this.parent = parent;
    this.count = opts.count;
    this.length = opts.length;
    this.thick = opts.thickness;
    this.list = [];
    for (let i = 0; i < opts.count; i++) {
      const a = (i / opts.count) * Math.PI * 2 + Math.PI / opts.count;   // none straight under the face
      const mat = opts.material.clone();                                   // same shader, own glow
      const mesh = new THREE.Mesh(tubeGeometry(), mat);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat);
      tip.castShadow = true;
      parent.add(mesh, tip);
      this.list.push({
        mesh, tip, mat, baseEmissive: mat.emissive.clone(), baseGlow: mat.emissiveIntensity,
        angle: a, out: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
        anchor: new THREE.Vector3(Math.sin(a) * opts.radius, opts.y, Math.cos(a) * opts.radius),
        phase: i * 1.7, pts: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        aim: null, k: 0, golden: false,
      });
    }
    this.trail = new THREE.Vector3();   // smoothed local velocity (units/s)
    this.t = 0;
  }

  // Direction (world, horizontal) a tentacle's root points out from the body. Used to pick
  // the tentacle facing an enemy.
  worldDir(i, out) {
    this.parent.getWorldQuaternion(_q);
    return out.copy(this.list[i].out).applyQuaternion(_q).setY(0).normalize();
  }

  // Send tentacle i toward a world point. k: 0 = resting, 1 = fully out. null to release.
  aim(i, worldPoint, k = 0, golden = false) {
    const T = this.list[i];
    if (!T) return;
    if (!worldPoint || k <= 0) { T.aim = null; T.k = 0; return; }
    T.aim = (T.aim || new THREE.Vector3()).copy(worldPoint);
    T.k = k;
    T.golden = golden;
  }

  // state: { localVel (units/s, in the parent's frame), contract (0..1 bell squeeze), vy (m/s) }
  update(dt, state) {
    this.t += dt;
    this.trail.lerp(state.localVel, 1 - Math.exp(-6 * dt));
    const L = this.length, contract = state.contract;
    const fall = THREE.MathUtils.clamp(-state.vy * 3, 0, 1);          // falling: stream upward
    const rise = THREE.MathUtils.clamp(state.vy * 3, 0, 1);           // jumping: trail straight down
    const moving = Math.min(1, this.trail.length() / 6);
    this.parent.updateWorldMatrix(true, false);

    for (const T of this.list) {
      // --- resting shape: hang, sway, flare with the bell, trail behind the motion
      const flare = 0.3 + 0.12 * contract - 0.15 * rise;   // splay out past the bell so all six show from above
      const side = _b.set(T.out.z, 0, -T.out.x);
      for (let j = 0; j <= SEG; j++) {
        const s = j / SEG, s15 = s ** 1.5;
        const wave = Math.sin(this.t * (3 + moving * 4) - s * 5 + T.phase) * (0.05 + 0.05 * moving) * s;
        const p = T.pts[j].copy(T.anchor);
        p.y -= L * s * (1 - 0.55 * fall);
        p.addScaledVector(T.out, flare * s + wave * 0.5);
        p.addScaledVector(side, wave);
        p.addScaledVector(this.trail, -0.045 * s15);                   // drag behind
        p.y += fall * 0.35 * s15;
        p.y = Math.max(p.y, 0.015 * (1 - fall));                       // don't dig into the floor
      }

      // --- striking: a whip arc from the root out to the target, blended over the rest shape
      if (T.aim) {
        const target = this.parent.worldToLocal(_v.copy(T.aim));
        const end = _t.copy(T.anchor).lerp(target, T.k);
        const dist = end.distanceTo(T.anchor);
        const ctrl = _n.copy(T.anchor).add(end).multiplyScalar(0.5).addScaledVector(T.out, dist * 0.25);
        ctrl.y += dist * 0.25;
        const w = Math.min(1, T.k * 2);
        for (let j = 0; j <= SEG; j++) {
          const s = j / SEG, u = 1 - s;
          const bx = u * u * T.anchor.x + 2 * u * s * ctrl.x + s * s * end.x;
          const by = u * u * T.anchor.y + 2 * u * s * ctrl.y + s * s * end.y;
          const bz = u * u * T.anchor.z + 2 * u * s * ctrl.z + s * s * end.z;
          T.pts[j].lerp(_v.set(bx, by, bz), w);
        }
        T.mat.emissive.setHex(T.golden ? 0xffc23a : 0xff5fb0);
        T.mat.emissiveIntensity = 0.6 + T.k * 1.4;
      } else if (T.mat.emissiveIntensity !== T.baseGlow) {
        T.mat.emissive.copy(T.baseEmissive);
        T.mat.emissiveIntensity = T.baseGlow;
      }
      this.build(T);
    }
  }

  // Skin the tube around the points
  build(T) {
    const pos = T.mesh.geometry.attributes.position, nor = T.mesh.geometry.attributes.normal;
    const P = T.pts;
    for (let j = 0; j <= SEG; j++) {
      _t.copy(P[Math.min(SEG, j + 1)]).sub(P[Math.max(0, j - 1)]);
      if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0);
      _t.normalize();
      _n.crossVectors(_t, Math.abs(_t.z) < 0.9 ? Z : X).normalize();
      _b.crossVectors(_t, _n);
      const r = this.thick * (1 - 0.7 * (j / SEG));
      for (let k = 0; k < RAD; k++) {
        const th = (k / RAD) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        const nx = _n.x * c + _b.x * s, ny = _n.y * c + _b.y * s, nz = _n.z * c + _b.z * s;
        const i = j * RAD + k;
        pos.setXYZ(i, P[j].x + nx * r, P[j].y + ny * r, P[j].z + nz * r);
        nor.setXYZ(i, nx, ny, nz);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    T.tip.position.copy(P[SEG]);
    T.tip.scale.setScalar(this.thick * 0.45);
  }

  dispose() {
    for (const T of this.list) {
      T.mesh.geometry.dispose();
      T.tip.geometry.dispose();
      T.mat.dispose();
    }
  }
}
