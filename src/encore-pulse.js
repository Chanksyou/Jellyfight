// The Encore's speaker pulses (act 4). From bar 16 of the fight (beat 64), one corner speaker at a
// time fires a sound wave, the four taking turns round the arena: the next fires the moment the last
// reaches its far corner. The wave is a packet of concentric arcs lying flat at jelly height, the
// widest at the front (`--encore-pulse-radius`, about 40 cm across), bulging the way it travels, like
// a drawn sound wave. It drops from its speaker and rolls across the floor to the opposite corner's
// speaker over `--encore-pulse-travel` beats. It does no damage: a jelly its front passes through is
// shoved `--encore-pulse-push` (12 cm) the way it's travelling, once a wave. Jump it to stay put. The
// song's breakdown quiets it.
//
// Time is in beats (the song's beatNow). No light is added: every arc in flight is one instanced draw.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';

export const PULSE = { first: 64 };
// the speaker stacks (act4-arena.js), in firing order round the arena
export const SPEAKERS = [[-0.64, -0.53], [0.64, -0.53], [0.64, 0.53], [-0.64, 0.53]];
const MOUTH = 0.56, LOW = 0.06, POOL = 2, ARCS = 5;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
const _o = new THREE.Vector3(), _h = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class EncorePulses {
  // arena: buildAct4's; push(dx, dz): move the jelly; quiet(beat): the song's breakdown
  constructor(arena, { push = () => {}, quiet = () => false } = {}) {
    Object.assign(this, { arena, push, quiet });
    this.r = LOOK.num('encore-pulse-radius', 0.22);
    this.spread = LOOK.num('encore-pulse-arc', 2.2);              // radians each arc spans
    this.gap = LOOK.num('encore-pulse-gap', 0.03);               // m between the arcs
    this.color = new THREE.Color(LOOK.color('encore-pulse', '#f4f8ff'));
    this.beat = null; this.fired = PULSE.first - 1; this.live = []; this.shoves = [];
    // one arc of a unit circle, centred on +x and lying flat (in the floor's plane)
    const geo = new THREE.TorusGeometry(1, 0.03, 5, 28, this.spread).rotateZ(-this.spread / 2).rotateX(-Math.PI / 2);
    this.arcs = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), POOL * ARCS);
    this.arcs.name = 'Encore speaker pulses'; this.arcs.frustumCulled = false; this.arcs.userData.noCollide = true; this.arcs.renderOrder = 4;
    for (let i = 0; i < POOL * ARCS; i++) { this.arcs.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.arcs.setColorAt(i, _c.set(0)); }
    arena.root.add(this.arcs);
  }
  get travel() { return LOOK.num('encore-pulse-travel', 2); }

  // where the front of wave `p` is at `u` (0..1 of its trip): down from its speaker, across the floor
  // at jelly height to the opposite corner, up into that speaker
  at(p, u, out = _p) {
    const [ax, az] = SPEAKERS[p.from], [bx, bz] = SPEAKERS[(p.from + 2) % 4];
    const x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = u < 0.12 ? MOUTH + (LOW - MOUTH) * (u / 0.12) : u > 0.88 ? LOW + (MOUTH - LOW) * ((u - 0.88) / 0.12) : LOW;
    return out.set(x, y, z);
  }
  // the way wave `p` travels (flat, unit length)
  dir(p, out = _d) { const [ax, az] = SPEAKERS[p.from], [bx, bz] = SPEAKERS[(p.from + 2) % 4]; return out.set(bx - ax, 0, bz - az).normalize(); }

  update(beat, player, dt = 1 / 60) {
    if (this.beat !== null && beat < this.beat) { this.live.length = 0; this.fired = PULSE.first - 1; }
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    // one at a time: the next speaker round fires as the last wave arrives, `travel` beats on
    const T = this.travel;
    for (let k = Math.max(0, Math.floor((this.fired - PULSE.first) / T) + 1); PULSE.first + k * T <= beat; k++) {
      const b = PULSE.first + k * T;
      this.fired = b;
      if (skip || this.quiet(b) || beat - b > T) continue;
      this.live.push({ at: b, from: k % 4, hit: false });
    }
    this.live = this.live.filter((p) => beat - p.at < T);
    let i = 0;
    for (const p of this.live.slice(-POOL)) {
      const u = (beat - p.at) / T, d = this.dir(p), front = this.at(p, u), grow = Math.min(1, u / 0.08);
      const R = this.r * (0.35 + 0.65 * grow), fade = Math.min(1, (1 - u) * 6);
      // the arcs share a centre behind the front, so they nest like a drawn sound wave, widest in front
      const centre = _o.copy(front).addScaledVector(d, -R);
      _q.setFromAxisAngle(UP, Math.atan2(-d.z, d.x));
      for (let k = 0; k < ARCS; k++, i++) {
        const rk = Math.max(0.01, R - k * this.gap);
        this.arcs.setMatrixAt(i, _m.compose(centre, _q, _s.set(rk, rk, rk)));
        this.arcs.setColorAt(i, _c.copy(this.color).multiplyScalar((1 - k * 0.14) * fade));
      }
      // its front through the jelly: a shove the way it's going, once (no damage); over the jelly's
      // head if it's jumped clear
      if (!p.hit && player && !skip && player.position.y < front.y + 0.01) {
        const rx = player.position.x - centre.x, rz = player.position.z - centre.z, dist = Math.hypot(rx, rz), r = player.cfg?.radius ?? 0.03;
        const ang = Math.acos(Math.max(-1, Math.min(1, (rx * d.x + rz * d.z) / (dist || 1))));
        if (dist > R - this.gap * 1.5 && dist < R + r * 0.6 && ang < this.spread / 2 + r / Math.max(R, 0.01)) {
          p.hit = true; sfx.encorePulse?.();
          const push = LOOK.num('encore-pulse-push', 0.12);
          this.shoves.push({ x: d.x * push, z: d.z * push, left: 0.2 });
        }
      }
    }
    for (; i < POOL * ARCS; i++) this.arcs.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.arcs.instanceMatrix.needsUpdate = true; this.arcs.instanceColor.needsUpdate = true;
    // shoves play out over 0.2 s so the jelly slides rather than jumps
    for (const s of this.shoves) { const f = Math.min(dt, s.left) / 0.2; this.push(s.x * f, s.z * f); s.left -= dt; }
    this.shoves = this.shoves.filter((s) => s.left > 1e-6);
  }

  reset() { this.beat = null; this.fired = PULSE.first - 1; this.live.length = 0; this.shoves.length = 0; for (let i = 0; i < POOL * ARCS; i++) this.arcs.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.arcs.instanceMatrix.needsUpdate = true; }
  dispose() { this.arcs.removeFromParent(); this.arcs.geometry.dispose(); this.arcs.material.dispose(); this.arcs.dispose(); }
}
