// LOD-gated procedural arthropod locomotion: closed-form 2-bone leg IK, world-space planted
// footholds (tripod / tetrapod alternating gait) and flexible waist lag.
// Zero per-frame heap allocations; runs full IK only for close, visible bugs (!e.unseen),
// falling back to a cheap trig gait when far or off-screen.
const IK_OUT = { shoulder: 0, knee: 0 };

// Closed-form 2-bone IK in a leg's vertical (+X reach, +Y up) plane.
// Femur (L1) and tibia (L2) both lie along +X at rotation.z = 0; knee arches upward (+Y).
export function solveLeg2Bone(reach, dy, L1, L2, out = IK_OUT) {
  const minD = Math.abs(L1 - L2) + 1e-3;
  const maxD = L1 + L2 - 1e-3;
  const raw = Math.hypot(reach, dy);
  const d = raw < minD ? minD : raw > maxD ? maxD : raw;
  const base = Math.atan2(dy, reach);
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const cosB = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
  out.shoulder = base + Math.acos(cosA);
  out.knee = -(Math.PI - Math.acos(cosB));
  return out;
}

// Alternating-group world-space foot planting for 6-leg (tripod) or 8-leg (tetrapod) bugs.
// Each leg descriptor: { hip, swing, femur, knee, L1, L2, restX, restZ, group, pair, s }
export class GaitRig {
  constructor(legs, { stride = 0.42, stepH = 0.24, stepDur = 0.14 } = {}) {
    this.legs = legs;
    this.stride = stride;
    this.stepH = stepH;
    this.stepDur = stepDur;
    this.ready = false;
    this.lastX = 0;
    this.lastZ = 0;
    this.lastRy = 0;
    this.turnRate = 0;
    this.state = legs.map(() => ({ wx: 0, wz: 0, fx: 0, fz: 0, tx: 0, tz: 0, stepT: -1 }));
  }

  reset() {
    this.ready = false;
    this.turnRate = 0;
    for (let i = 0; i < this.state.length; i++) this.state[i].stepT = -1;
  }

  // Update leg joint rotations for this frame.
  // opts: { speed, bodyY = 0, crouch = 0, bend = 0, skidZ = 0, trigPhase = 0, trigAmp = 0,
  //         raiseFn(L, idx) -> 0..1 override (e.g. spider rearing front legs) }
  update(dt, e, opts = {}) {
    const r = e.r || 0.035;
    const pos = e.pos;
    const ry = e.root ? e.root.rotation.y : 0;
    const sinY = Math.sin(ry), cosY = Math.cos(ry);
    const bodyY = opts.bodyY || 0;

    // Track smoothed yaw turn rate for flexible waist/abdomen lag
    if (this.ready && dt > 1e-4) {
      let dRy = ry - this.lastRy;
      if (dRy > Math.PI) dRy -= Math.PI * 2;
      else if (dRy < -Math.PI) dRy += Math.PI * 2;
      const rate = Math.max(-8, Math.min(8, dRy / dt));
      this.turnRate += (rate - this.turnRate) * (1 - Math.exp(-10 * dt));
    }
    this.lastRy = ry;

    // Cheap trig fallback when far/off-screen (e.unseen) or no world position
    if (e.unseen || !pos) {
      this.ready = false;
      const t = opts.trigPhase || 0, amp = opts.trigAmp || 0;
      for (let i = 0; i < this.legs.length; i++) {
        const L = this.legs[i];
        const ph = t + (L.group ? Math.PI : 0);
        const lx = L.restX;
        const lz = L.restZ + Math.sin(ph) * this.stride * 0.65 * amp + (opts.skidZ || 0);
        const ly = Math.max(0, Math.cos(ph)) * this.stepH * amp;
        this._poseLeg(L, lx, ly - bodyY, lz, opts.raiseFn ? opts.raiseFn(L, i) : 0, opts.bend || 0, opts.spreadFn ? opts.spreadFn(L, i) : 0);
      }
      return;
    }

    // Snap planted feet on spawn, pool reuse, or large teleport
    const jumped = !this.ready || Math.hypot(pos.x - this.lastX, pos.z - this.lastZ) > r * 4.5;
    this.lastX = pos.x;
    this.lastZ = pos.z;
    if (jumped) {
      this.ready = true;
      for (let i = 0; i < this.legs.length; i++) {
        const L = this.legs[i], st = this.state[i];
        st.wx = pos.x + (L.restX * cosY + L.restZ * sinY) * r;
        st.wz = pos.z + (-L.restX * sinY + L.restZ * cosY) * r;
        st.stepT = -1;
      }
    }

    const vx = e.vel ? e.vel.x : 0, vz = e.vel ? e.vel.z : 0;
    const speed = Math.hypot(vx, vz);
    const strideWorld = this.stride * r;
    const dur = speed > 1e-4 ? Math.max(0.035, Math.min(this.stepDur, (strideWorld * 0.75) / speed)) : this.stepDur;
    const leadT = speed > 1e-4 ? Math.min(dur * 0.5, (strideWorld * 0.45) / speed) : 0;

    // Check which alternating gait group currently has any leg in the air
    let air0 = false, air1 = false;
    for (let i = 0; i < this.legs.length; i++) {
      if (this.state[i].stepT >= 0) { if (this.legs[i].group === 0) air0 = true; else air1 = true; }
    }

    const pitchLift = opts.pitchLift || 0;
    for (let i = 0; i < this.legs.length; i++) {
      const L = this.legs[i], st = this.state[i];
      const raise = (opts.raiseFn ? opts.raiseFn(L, i) : 0) + (L.pair === 0 ? pitchLift : 0);
      const desiredX = pos.x + (L.restX * cosY + L.restZ * sinY) * r + vx * leadT;
      const desiredZ = pos.z + (-L.restX * sinY + L.restZ * cosY) * r + vz * leadT;

      if (raise > 0.15) {
        // Leg is lifted for an attack (e.g. spider rearing): keep foothold parked under rest
        st.wx = desiredX; st.wz = desiredZ; st.stepT = -1;
      } else if (st.stepT < 0) {
        const err = Math.hypot(desiredX - st.wx, desiredZ - st.wz);
        const oppAir = L.group === 0 ? air1 : air0;
        if (err > strideWorld && (!oppAir || err > strideWorld * 2.4)) {
          st.fx = st.wx; st.fz = st.wz;
          st.tx = desiredX; st.tz = desiredZ;
          st.stepT = 0;
          if (L.group === 0) air0 = true; else air1 = true;
        }
      }

      let ly = 0;
      if (st.stepT >= 0) {
        st.stepT += dt / dur;
        // Track updated target gently so fast turns don't leave a foot behind
        st.tx += (desiredX - st.tx) * Math.min(1, dt * 12);
        st.tz += (desiredZ - st.tz) * Math.min(1, dt * 12);
        if (st.stepT >= 1) {
          st.wx = st.tx; st.wz = st.tz; st.stepT = -1;
        } else {
          const p = st.stepT;
          const s = p * p * (3 - 2 * p);
          st.wx = st.fx + (st.tx - st.fx) * s;
          st.wz = st.fz + (st.tz - st.fz) * s;
          ly = Math.sin(Math.PI * p) * this.stepH;
        }
      }

      // World foothold -> body-local radius units
      const dxW = (st.wx - pos.x) / r, dzW = (st.wz - pos.z) / r;
      const lx = dxW * cosY - dzW * sinY;
      const lz = dxW * sinY + dzW * cosY + (opts.skidZ || 0);
      this._poseLeg(L, lx, ly - bodyY, lz, raise, opts.bend || 0, opts.spreadFn ? opts.spreadFn(L, i) : 0);
    }
  }

  _poseLeg(L, lx, ly, lz, raise, bend, spread) {
    const dx = lx - (L.hx ?? L.hip.position.x);
    const dz = lz - (L.hz ?? L.hip.position.z);
    const dy = ly - (L.hy ?? L.hip.position.y);
    const reach = Math.hypot(dx, dz);
    solveLeg2Bone(Math.max(0.05, reach), dy, L.L1, L.L2, IK_OUT);
    L.swing.rotation.y = Math.atan2(-dz, dx) + spread;
    L.femur.rotation.z = IK_OUT.shoulder + raise * 0.95 - bend * 0.14;
    L.knee.rotation.z = IK_OUT.knee + raise * 0.55 + bend * 0.2;
    if (L.ankle) L.ankle.rotation.z = (L.ankleRest || 0) + raise * 0.35;
  }
}
