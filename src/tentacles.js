// The jelly's six tentacles: soft tubes that hang from under the bell, trail behind as it
// swims, stream upward as it falls, and whip out one at a time when the Lash strikes.
//
// Each tentacle is a chain of points simulated like a soft rope in water: every point is pulled
// toward a resting pose (hanging under the bell, flaring and pulling in with its pulse), firmly
// at the root and loosely at the tip, slowed by the water and kept at its length. So when the
// bell squeezes or the jelly turns, the motion travels down the tentacle as a wave, the tips
// trail behind and swing on after it stops, the way real ones do.
//
// The pose is in the character's model units (1 unit = the character's height, feet at y = 0,
// facing +z); the chain is simulated in world space (scaled to model units), so the jelly
// moving, turning and tilting is what drags the tentacles.
import * as THREE from 'three';

const SEG = 20;       // rings along a tentacle (and points in its chain)
const RAD = 8;        // vertices around a ring
// the chain: spring toward the pose (1/s², root -> tip), damping ratio, simulation step
const K_ROOT = 700, K_TIP = 45, DAMP = 0.55, STEP = 1 / 120;
// how much of the length rule's correction becomes speed: all of it makes the tips whip (the
// energy piles up at the end of the chain), none makes them stiff
const KEEP = 0.15;
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
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
  // opts: { count, radius (anchor ring), y (anchor height), length, thickness, material, angles? (each one's place around the ring) }
  constructor(parent, opts) {
    this.parent = parent;
    this.count = opts.count;
    this.length = opts.length;
    this.thick = opts.thickness;
    this.flare = opts.flare ?? 0.3;
    this.list = [];
    for (let i = 0; i < opts.count; i++) {
      const a = opts.angles?.[i] ?? (i / opts.count) * Math.PI * 2 + Math.PI / opts.count;   // none straight under the face (unless placed)
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
        sim: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),     // world, in model units
        vel: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        goal: Array.from({ length: SEG + 1 }, () => new THREE.Vector3()),
        aim: null, k: 0, golden: false,
      });
    }
    this.trail = new THREE.Vector3();   // smoothed local velocity (units/s)
    this.t = 0;
    this.fresh = true;                  // first frame (or a jump cut): start the chain on its pose
    this.lastRoot = new THREE.Vector3();
    this.inv = new THREE.Matrix4();
    // each point's spring and damping, root to tip
    this.K = Array.from({ length: SEG + 1 }, (_, j) => K_ROOT + (K_TIP - K_ROOT) * (j / SEG) ** 0.6);
    this.C = this.K.map((k) => 2 * DAMP * Math.sqrt(k));
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

  // state: { localVel (units/s, in the parent's frame), contract (1 = squeezed, 0 = rest, below 0 = relaxed open), vy (m/s) }
  update(dt, state) {
    this.t += dt;
    this.trail.lerp(state.localVel, 1 - Math.exp(-6 * dt));
    const L = this.length, contract = state.contract;
    const fall = THREE.MathUtils.clamp(-state.vy * 3, 0, 1);          // falling: stream upward
    const rise = THREE.MathUtils.clamp(state.vy * 3, 0, 1);           // jumping: trail straight down
    const moving = Math.min(1, this.trail.length() / 6);
    this.parent.updateWorldMatrix(true, false);
    const M = this.parent.matrixWorld;
    // world meters per model unit, fixed once (the body's squash and stretch must not move the chain)
    this.unit ||= _s.setFromMatrixScale(M).x || 1;
    const unit = this.unit;
    this.inv.copy(M).invert();
    // a jump cut (respawn, a menu, the first frame): no dragging the tentacles across the room
    _v.setFromMatrixPosition(M).divideScalar(unit);
    if (this.fresh || dt <= 0 || dt > 0.25 || _v.distanceTo(this.lastRoot) > 3) this.fresh = true;
    this.lastRoot.copy(_v);

    for (const T of this.list) {
      // --- the pose the chain is pulled toward: hang close under the bell (a lean jelly),
      // flaring a little as the bell relaxes and pulling in on the power stroke, with a slow
      // ripple; the chain's lag turns each squeeze into a wave running down to the tip
      const flare = this.flare - 0.09 * contract - 0.06 * rise;
      const side = _b.set(T.out.z, 0, -T.out.x);
      for (let j = 0; j <= SEG; j++) {
        const s = j / SEG, s15 = s ** 1.5;
        const wave = Math.sin(this.t * (1.6 + moving * 1.4) - s * 4.5 + T.phase) * (0.035 + 0.025 * moving) * s;
        const p = T.goal[j].copy(T.anchor);
        p.y -= L * s * (1 - 0.55 * fall);
        p.addScaledVector(T.out, flare * s + wave * 0.5);
        p.addScaledVector(side, wave);
        p.y += fall * 0.35 * s15;
        p.y = Math.max(p.y, 0.015 * (1 - fall));                       // don't reach into the floor
        p.applyMatrix4(M).divideScalar(unit);                           // to world, in model units
      }
      if (this.fresh) for (let j = 0; j <= SEG; j++) { T.sim[j].copy(T.goal[j]); T.vel[j].set(0, 0, 0); }

      // --- the chain: root pinned under the bell, each point sprung toward its pose and
      // damped by the water, then kept its length from the one above it (follow the leader)
      const n = Math.min(6, Math.max(1, Math.ceil(dt / STEP))), h = dt / n;
      if (!this.fresh) {
        for (let it = 0; it < n; it++) {
          T.sim[0].copy(T.goal[0]);
          for (let j = 1; j <= SEG; j++) {
            const p = T.sim[j], v = T.vel[j], g = T.goal[j];
            v.x += (this.K[j] * (g.x - p.x) - this.C[j] * v.x) * h;
            v.y += (this.K[j] * (g.y - p.y) - this.C[j] * v.y) * h;
            v.z += (this.K[j] * (g.z - p.z) - this.C[j] * v.z) * h;
            p.addScaledVector(v, h);
            // keep the segment its length: the tentacle bends, it doesn't stretch
            const seg = T.goal[j].distanceTo(T.goal[j - 1]);
            _d.copy(p).sub(T.sim[j - 1]);
            const len = _d.length();
            if (len > 1e-6) {
              _o.copy(p);
              p.copy(T.sim[j - 1]).addScaledVector(_d, seg / len);
              v.addScaledVector(_o.sub(p), -KEEP / h);                  // a little of the correction carries on
            }
          }
        }
      }
      // back to the parent's frame (drawn off the floor; the chain itself just swings back up)
      const floor = 0.015 * (1 - fall);
      for (let j = 0; j <= SEG; j++) {
        const p = T.pts[j].copy(T.sim[j]).multiplyScalar(unit).applyMatrix4(this.inv);
        if (p.y < floor) p.y = floor;
      }

      // --- striking: a whip arc from the root out to the target, blended over the chain (which
      // follows it, so the tentacle swings back on its own when the strike ends)
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
          T.sim[j].copy(T.pts[j]).applyMatrix4(M).divideScalar(unit);
        }
        T.mat.emissive.setHex(T.golden ? 0xffc23a : 0xfff6b0);
        T.mat.emissiveIntensity = 0.6 + T.k * 1.4;
      } else if (T.mat.emissiveIntensity !== T.baseGlow) {
        T.mat.emissive.copy(T.baseEmissive);
        T.mat.emissiveIntensity = T.baseGlow;
      }
      this.build(T);
    }
    this.fresh = false;
  }

  // start the chains on their pose next frame (after a teleport)
  reset() { this.fresh = true; }

  // Skin the tube around the points
  build(T) {
    const pos = T.mesh.geometry.attributes.position, nor = T.mesh.geometry.attributes.normal;
    const P = T.pts;
    for (let j = 0; j <= SEG; j++) {
      _t.copy(P[Math.min(SEG, j + 1)]).sub(P[Math.max(0, j - 1)]);
      if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0);
      _t.normalize();
      // the ring's frame carried down from the one above (no sudden twists as it bends)
      if (j === 0) _n.crossVectors(_t, Math.abs(_t.z) < 0.9 ? Z : X).normalize();
      else _n.addScaledVector(_t, -_n.dot(_t)).normalize();
      _b.crossVectors(_t, _n);
      const s = j / SEG, r = this.thick * (1 - 0.72 * s) * (1 + 0.12 * (1 - s) ** 3);
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
