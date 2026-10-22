// The Encore's speaker pulses (act 4). From bar 16 of the fight (beat 64), on every beat one corner
// speaker fires a white sound ring (`--encore-pulse-radius`, 6 cm), the four taking turns round the
// arena. It drops from its speaker to jelly height and rolls across the floor to the opposite corner's
// speaker over `--encore-pulse-travel` beats, a trailing echo behind it. It does no damage: a jelly it
// passes through is shoved `--encore-pulse-push` (5 cm) the way it's travelling, once a pulse. Jump
// it to stay put. The song's breakdown quiets it.
//
// Time is in beats (the song's beatNow). No light is added: every ring in flight is one instanced draw.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';

export const PULSE = { first: 64 };
// the speaker stacks (act4-arena.js), in firing order round the arena
export const SPEAKERS = [[-0.64, -0.53], [0.64, -0.53], [0.64, 0.53], [-0.64, 0.53]];
const MOUTH = 0.56, LOW = 0.06, POOL = 4, RINGS = 4;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
const AXIS = new THREE.Vector3(0, 0, 1), _r = new THREE.Vector3(), _h = new THREE.Vector3();

export class EncorePulses {
  // arena: buildAct4's; push(dx, dz): move the jelly; quiet(beat): the song's breakdown
  constructor(arena, { push = () => {}, quiet = () => false } = {}) {
    Object.assign(this, { arena, push, quiet });
    this.r = LOOK.num('encore-pulse-radius', 0.06);
    this.color = new THREE.Color(LOOK.color('encore-pulse', '#f4f8ff'));
    this.beat = null; this.fired = PULSE.first - 1; this.live = []; this.shoves = [];
    const geo = new THREE.TorusGeometry(1, 0.14, 8, 40);
    this.rings = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), POOL * RINGS);
    this.rings.name = 'Encore speaker pulses'; this.rings.frustumCulled = false; this.rings.userData.noCollide = true; this.rings.renderOrder = 4;
    for (let i = 0; i < POOL * RINGS; i++) { this.rings.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.rings.setColorAt(i, _c.set(0)); }
    arena.root.add(this.rings);
  }
  get travel() { return LOOK.num('encore-pulse-travel', 2); }

  // where pulse `p` is at `u` (0..1 of its trip): down from its speaker, across the floor at jelly
  // height to the opposite corner, up into that speaker
  at(p, u, out = _p) {
    const [ax, az] = SPEAKERS[p.from], [bx, bz] = SPEAKERS[(p.from + 2) % 4];
    const x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = u < 0.12 ? MOUTH + (LOW - MOUTH) * (u / 0.12) : u > 0.88 ? LOW + (MOUTH - LOW) * ((u - 0.88) / 0.12) : LOW;
    return out.set(x, y, z);
  }

  update(beat, player, dt = 1 / 60) {
    if (this.beat !== null && beat < this.beat) { this.live.length = 0; this.fired = PULSE.first - 1; }
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    // fire on each beat from the first: the next speaker round
    for (let b = Math.max(this.fired + 1, PULSE.first); b <= beat; b++) {
      this.fired = b;
      if (skip || this.quiet(b) || beat - b > this.travel) continue;
      this.live.push({ at: b, from: ((b - PULSE.first) % 4 + 4) % 4, hit: false });
    }
    this.live = this.live.filter((p) => beat - p.at < this.travel);
    // the rings: the pulse and its echoes trailing it, each fainter, smaller and thinner
    let i = 0;
    for (const p of this.live.slice(-POOL)) {
      const u = (beat - p.at) / this.travel, [ax, az] = SPEAKERS[p.from], [bx, bz] = SPEAKERS[(p.from + 2) % 4];
      _q.setFromUnitVectors(AXIS, _d.set(bx - ax, 0, bz - az).normalize());
      for (let k = 0; k < RINGS; k++, i++) {
        const uk = Math.max(0, u - k * 0.035), pos = this.at(p, uk, _r), grow = Math.min(1, uk / 0.06);
        const r = this.r * grow * (1 - k * 0.16), thin = 1 - k * 0.2;
        this.rings.setMatrixAt(i, _m.compose(pos, _q, _s.set(r, r, r * thin)));
        this.rings.setColorAt(i, _c.copy(this.color).multiplyScalar([1, 0.55, 0.32, 0.18][k] * Math.min(1, (1 - u) * 6)));
      }
      // through the jelly: a shove the way it's going, once (no damage)
      if (!p.hit && player && !skip) {
        const c = this.at(p, u, _h), h = (player.cfg?.height ?? 0.09) / 2, r = player.cfg?.radius ?? 0.03;
        if (Math.hypot(player.position.x - c.x, player.position.y + h - c.y, player.position.z - c.z) < this.r + r * 0.6) {
          p.hit = true; sfx.encorePulse?.();
          this.shoves.push({ x: _d.x * LOOK.num('encore-pulse-push', 0.05), z: _d.z * LOOK.num('encore-pulse-push', 0.05), left: 0.15 });
        }
      }
    }
    for (; i < POOL * RINGS; i++) this.rings.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true;
    // shoves play out over 0.15 s so the jelly slides rather than jumps
    for (const s of this.shoves) { const f = Math.min(dt, s.left) / 0.15; this.push(s.x * f, s.z * f); s.left -= dt; }
    this.shoves = this.shoves.filter((s) => s.left > 1e-6);
  }

  reset() { this.beat = null; this.fired = PULSE.first - 1; this.live.length = 0; this.shoves.length = 0; for (let i = 0; i < POOL * RINGS; i++) this.rings.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.rings.instanceMatrix.needsUpdate = true; }
  dispose() { this.rings.removeFromParent(); this.rings.geometry.dispose(); this.rings.material.dispose(); this.rings.dispose(); }
}
