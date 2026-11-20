// The silver DJ's Record toss (act 4, the Encore's silver solo): he winds back for 3 beats and flings
// a vinyl record at the jelly. Its Warning is a thin floor strip from the stage to where it will land,
// with the lane over it (the space the record flies through, `height` tall: a jump doesn't clear it,
// step off the strip), both in his colour, following the jelly and locking a beat before he throws;
// they fill together to the moment it lands, on the bar line. The record is a Shot: a spinning disc
// with a glowing core and trail (fx.orb), flying low down the lane. Anything of the jelly it passes
// through is hit once. Where it lands it sticks on edge, faced back at the stage: it stands
// `stand` beats, harmless, blocking the jelly (pushed out through the Encore's `push`, no collider
// added in play; a jump goes over it), then shatters.
//
// Time is in beats (the song's beatNow). No light is added: the records are one pooled instanced draw;
// the Warnings are a small pool of strips and lanes, hidden when idle.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { TeleMaterial, VolumeMaterial, volumeGeometry } from './vfx.js';
import { ENCORE } from './stage4.js';
import { sfx } from './sfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { juice } from './juice.js';

const HALF = (ENCORE.tiles * ENCORE.tileSize) / 2, BOSS = ENCORE.bossSpace;
// the most of a frame's move the push takes as the jelly's own walk (m: well over a boosted walk at 30 fps)
const WALK = 0.05;
const RECORDS = 6, WARNINGS = 2, UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// a vinyl record lying flat (y up): a black disc with grooves and a coloured label, in vertex colours
function recordGeometry(r, label) {
  const disc = new THREE.CylinderGeometry(r, r, r * 0.04, 32), lab = new THREE.CylinderGeometry(r * 0.36, r * 0.36, r * 0.05, 20);
  const black = new THREE.Color(LOOK.color('encore-record', '#0b0c10')), groove = black.clone().lerp(new THREE.Color('#5a6078'), 0.35), c = new THREE.Color(label);
  const paint = (g, fn) => { const p = g.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) fn(Math.hypot(p.getX(i), p.getZ(i))).toArray(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); };
  paint(disc, (d) => (d > r * 0.97 ? groove : black));
  paint(lab, () => c);
  const g = mergeGeometries([disc, lab]); disc.dispose(); lab.dispose();
  return g;
}

// keep a landing spot on the open floor: out of the boss's reserved space by `edge` (its stage edge
// inside it), and on the floor; and `keep` ([x, z, d]: a DJ standing on the floor) at least d from it,
// the nearest way round him that is open floor
export function landing(x, z, r, edge, out = [0, 0], keep = null) {
  onFloor(x, z, r, edge, out);
  if (!keep) return out;
  const [kx, kz, d] = keep;
  if (Math.hypot(out[0] - kx, out[1] - kz) >= d) return out;
  const base = Math.hypot(out[0] - kx, out[1] - kz) > 1e-6 ? Math.atan2(out[1] - kz, out[0] - kx) : Math.PI / 2;
  for (let k = 0; k < 12; k++) {
    const a = base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 6;
    onFloor(kx + Math.cos(a) * (d + 0.001), kz + Math.sin(a) * (d + 0.001), r, edge, out);
    if (Math.hypot(out[0] - kx, out[1] - kz) >= d) return out;
  }
  return out;
}
function onFloor(x, z, r, edge, out) {
  const lim = HALF - r - 0.01;
  x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
  const hw = BOSS.width / 2 + edge + r, z0 = BOSS.center[2] - BOSS.depth / 2, z1 = BOSS.center[2] + BOSS.depth / 2 + edge + r;
  if (Math.abs(x - BOSS.center[0]) < hw && z < z1) {
    // out the nearest way that stays on the floor: the front, or a side
    const front = z1 - z, side = hw - Math.abs(x - BOSS.center[0]);
    if (front <= side || z < z0) z = z1; else x = BOSS.center[0] + Math.sign(x - BOSS.center[0] || 1) * hw;
  }
  out[0] = x; out[1] = z;
}

export class EncoreRecords {
  // arena: buildAct4's; fx: the game's (orb, impact, ice); onHit(dmg, record): the jelly was hit
  // (scene: where the Warnings go, beside every other attack's, so the Warning checks find them)
  constructor(arena, fx, { onHit = () => {}, color = '#3d6bff', scene = arena.root } = {}) {
    Object.assign(this, { arena, fx, onHit });
    this.color = new THREE.Color(color);
    this.r = LOOK.num('encore-record-radius', 0.055); this.edge = LOOK.num('encore-record-edge', 0.06);
    this.warnGlow = LOOK.num('encore-record-warning', 0.6); this.laneGlow = LOOK.num('encore-record-volume', 0.35);
    this.on = [0, 0.3];                                   // where the jelly is, when a cast names no target
    this.beat = null; this.casts = []; this.pushX = 0; this.pushZ = 0;
    this.keep = null;                                     // [x, z, d]: no record lands within d of it (a DJ on the floor; the Encore sets it)
    // the records: one instanced draw, always drawn (unused ones scaled to nothing) so its shader is built with the arena
    this.mesh = new THREE.InstancedMesh(recordGeometry(this.r, LOOK.color('encore-record-label', '#9bbaff')),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }), RECORDS);
    this.mesh.name = 'Encore records'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true;
    for (let i = 0; i < RECORDS; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.slots = Array.from({ length: RECORDS }, (_, i) => ({ i, cast: null }));
    // the Warnings: a floor strip and the lane over it each
    this.scene = scene;
    this.owned = [this.mesh.geometry, this.mesh.material];
    this.warnings = Array.from({ length: WARNINGS }, () => {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.0015, 0.5), new TeleMaterial(this.color, 'strip'));
      const lane = new THREE.Mesh(volumeGeometry('lane'), new VolumeMaterial(this.color, 'lane'));
      band.renderOrder = 3; lane.renderOrder = 4;
      for (const o of [band, lane]) { o.visible = false; o.userData.noCollide = true; scene.add(o); }
      this.owned.push(band.geometry, band.material, lane.material);
      return { band, lane, cast: null };
    });
    arena.root.add(this.mesh);
  }

  // a record landing on beat `land`, thrown from `from()` (where his hand is, a Vector3) at `target()`
  // ([x, z]: where the jelly is) until it locks; null if the pool is full. `face` (a yaw, 0 = straight
  // back at the stage): which way it stands, instead of along its lane (the Wall of sound's cover)
  cast(land, { from, target, dmg = 4, height = 0.25, flight = 1, windup = 3, lock = 1, stand = 16, face = null } = {}) {
    const slot = this.slots.find((s) => !s.cast);
    if (!slot) return null;
    const release = land - flight;
    const c = { land, release, warnAt: release - windup, lockAt: release - lock, from, target, dmg, height, stand, face, slot, warn: null,
      start: new THREE.Vector3(), to: [0, 0], ux: 0, uz: 1, nx: 0, nz: 1, len: 0, s: 0, state: 'wind', hit: false, orb: null, spin: Math.random() * 6 };
    slot.cast = c; this.casts.push(c);
    return c;
  }

  // where it will land, from where the hand is to where the jelly is (`on`), kept on the open floor
  aim(c, on) {
    const h = c.from();
    landing(on[0], on[1], this.r, this.edge, c.to, this.keep);
    c.start.copy(h);
    const dx = c.to[0] - h.x, dz = c.to[1] - h.z, len = Math.hypot(dx, dz) || 1;
    c.ux = dx / len; c.uz = dz / len; c.len = len;
    c.nx = c.face === null ? c.ux : Math.sin(c.face); c.nz = c.face === null ? c.uz : Math.cos(c.face);   // the way its face looks, standing
  }
  // the floor strip starts where the lane comes out over the floor, past the boss's riser (from his
  // hand: thrown from the floor, at once)
  stripStart(c) {
    const hw = BOSS.width / 2, z1 = BOSS.center[2] + BOSS.depth / 2;
    if (c.start.z >= z1 || Math.abs(c.start.x - BOSS.center[0]) >= hw) return 0;
    const tz = c.uz > 1e-6 ? (z1 - c.start.z) / c.uz : Infinity, tx = Math.abs(c.ux) > 1e-6 ? (Math.sign(c.ux) * hw - (c.start.x - BOSS.center[0])) / c.ux : Infinity;
    const t = Math.min(tz, tx);
    return Number.isFinite(t) ? Math.max(0, Math.min(c.len - 0.02, t)) : 0;
  }

  update(beat, player, dt = 1 / 60) {
    if (this.beat !== null && beat < this.beat) this.reset();
    const skip = this.beat !== null && beat - this.beat > 1;
    // the jelly's own walk last frame, without our push (its velocity has our push in it): a standing
    // record takes away what of it goes into the record
    const p = player?.position;
    this.walkX = p && this.px != null ? p.x - this.px - this.pushX : 0; this.walkZ = p && this.px != null ? p.z - this.pz - this.pushZ : 0;
    this.px = p?.x ?? null; this.pz = p?.z ?? null;
    // (a move that isn't a walk, a teleport or a long frame, counts as at most WALK: past it the push
    // would feed on itself frame on frame until it flings the jelly or stalls the collision)
    const walk = Math.hypot(this.walkX, this.walkZ);
    if (walk > WALK) { this.walkX *= WALK / walk; this.walkZ *= WALK / walk; }
    this.beat = beat; this.pushX = this.pushZ = 0;
    const R = this.r, pr = player?.cfg?.radius ?? 0.03;
    let dropped = false;
    for (const c of this.casts) {
      if (c.state === 'wind' || c.state === 'fly') this.warnStep(c, beat, player);
      if (c.state === 'wind' && !c.scratched && beat >= c.warnAt) { c.scratched = true; if (!skip) sfx.recordScratch(); }
      if (c.state === 'wind' && beat >= c.release) {
        c.state = 'fly';
        if (!skip) { this.fx.impact(c.start, this.color, 0.02, 8); sfx.recordThrow(); }
        c.orb = this.fx.orb(this.color, 0.006);
      }
      if (c.state === 'fly') {
        c.s = Math.min(1, (beat - c.release) / (c.land - c.release));
        // the hit, as it lands on the bar line: anything of the jelly in its lane then, below the lane's top
        if (c.s >= 1 && !skip && player && player.position.y < c.height) {
          const p = player.position, rx = p.x - c.start.x, rz = p.z - c.start.z;
          const along = rx * c.ux + rz * c.uz, across = Math.abs(rx * c.uz - rz * c.ux);
          if (across < R + pr && along > this.stripStart(c) - pr && along < c.len + R + pr) { c.hit = true; this.onHit(c.dmg, c); }
        }
        this.place(c, c.s, beat);
        if (c.orb) { c.orb.position.copy(_p); this.fx.orbTick(c.orb, dt); }
        if (c.s >= 1) {
          c.state = 'stand'; this.fx.free(c.orb); c.orb = null;
          this.freeWarning(c);
          _p.set(c.to[0], 0.01, c.to[1]);
          if (!skip) { this.fx.impact(_p, this.color, 0.03, 12); juice.feel('hit'); sfx.recordStick(); }
        }
      }
      if (c.state === 'stand') {
        this.place(c, 1, beat);
        if (beat >= c.land + c.stand) { this.shatter(c, !skip); dropped = true; continue; }
        // it blocks the jelly (not over it: a jump clears it): pushed out of the record's footprint
        if (player && player.position.y < 2 * R) this.block(c, player, pr);
      }
    }
    if (dropped) this.casts = this.casts.filter((c) => c.slot.cast === c);
    if (this.casts.length || dropped) this.mesh.instanceMatrix.needsUpdate = true;
  }

  // its Warning: from 3 beats before the throw, following the jelly until a beat before, filling to the landing
  warnStep(c, beat, player) {
    if (beat < c.warnAt) return;
    if (!c.warn) { c.warn = this.warnings.find((w) => !w.cast); if (c.warn) c.warn.cast = c; }
    if (beat < c.lockAt || !c.len) {
      const on = c.target?.() ?? this.on;
      if (!c.target && player) { this.on[0] = player.position.x; this.on[1] = player.position.z; }
      this.aim(c, on);
    }
    const w = c.warn; if (!w) return;
    const t0 = this.stripStart(c), x = c.start.x + c.ux * t0, z = c.start.z + c.uz * t0, len = Math.max(0.01, c.len - t0 + this.r), a = Math.atan2(c.ux, c.uz);
    const progress = Math.min(1, Math.max(0, (beat - c.warnAt) / (c.land - c.warnAt))), width = this.r * 2;
    w.band.visible = w.lane.visible = true;
    w.band.position.set(x, 0, z); w.band.rotation.set(0, a, 0); w.band.scale.set(width, 1, len);
    w.lane.position.set(x, 0, z); w.lane.rotation.set(0, a, 0); w.lane.scale.set(width, c.height, len);
    w.band.material.progress = w.lane.material.progress = progress;
    w.band.material.uniforms.uTime.value = beat;
    w.band.material.opacity = this.warnGlow;
    w.lane.material.opacity = this.laneGlow;
  }
  freeWarning(c) { if (c.warn) { c.warn.band.visible = c.warn.lane.visible = false; c.warn.cast = null; c.warn = null; } }

  // the record at `s` of its flight (1: standing where it landed), into the instance and _p (its centre)
  place(c, s, beat) {
    const R = this.r, d = s * c.len, y = s >= 1 ? R : R + (c.start.y - R) * (1 - s) ** 2;
    _p.set(c.start.x + c.ux * d, y, c.start.z + c.uz * d);
    if (s >= 1) {
      // on edge, its face back towards the stage, with a small wobble as it sticks
      const wob = Math.exp(-(beat - c.land) * 3) * Math.sin((beat - c.land) * 18) * 0.25;
      _q.setFromEuler(_e.set(Math.PI / 2 + wob, Math.atan2(c.nx, c.nz), 0, 'YXZ'));
    } else {
      // spinning flat, tipped a little into its flight
      _q.setFromEuler(_e.set(0.25, Math.atan2(c.ux, c.uz), 0, 'YXZ')).multiply(_q2.setFromAxisAngle(UP, c.spin + beat * 9));
    }
    this.mesh.setMatrixAt(c.slot.i, _m.compose(_p, _q, _s.set(1, 1, 1)));
  }

  // push the jelly out of a standing record's footprint (a thin box across the lane, its diameter wide)
  block(c, player, pr) {
    const p = player.position, t = this.r * 0.04 + 0.004, w = this.r;
    const rx = p.x - c.to[0], rz = p.z - c.to[1];
    const a = rx * c.nx + rz * c.nz, b = rx * c.nz - rz * c.nx;               // through it, across it
    const ca = Math.max(-t, Math.min(t, a)), cb = Math.max(-w, Math.min(w, b)), da = a - ca, db = b - cb, d = Math.hypot(da, db);
    // (the push comes a frame late, so it starts a frame's walk early: within that skin it takes away
    // the jelly's walk into the record, and any overlap that got in anyway)
    const wx = this.walkX, wz = this.walkZ, skin = Math.max(0.004, Math.hypot(wx, wz) * 2);
    if (d >= pr + skin) return;
    let na, nb, depth;
    if (d > 1e-6) { na = da / d; nb = db / d; depth = pr - d; }
    else if (t - Math.abs(a) < w - Math.abs(b)) { na = Math.sign(a) || -1; nb = 0; depth = t - Math.abs(a) + pr; }
    else { na = 0; nb = Math.sign(b) || 1; depth = w - Math.abs(b) + pr; }
    const nx = na * c.nx + nb * c.nz, nz = na * c.nz - nb * c.nx;
    const into = Math.min(0, wx * nx + wz * nz), out = Math.max(0, depth) - into;
    this.pushX += nx * out; this.pushZ += nz * out;
  }

  // push the jelly (below `top`) out of a circle `r` round x, z (a DJ standing on the floor), as block()
  // does out of a record: the same walk, capped at WALK, so a jelly pinned against him can't run away
  ring(x, z, r, top, player) {
    const p = player?.position;
    if (!p || p.y >= top) return;
    const pr = player.cfg?.radius ?? 0.03, dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
    const wx = this.walkX || 0, wz = this.walkZ || 0, skin = Math.max(0.004, Math.hypot(wx, wz) * 2);
    if (d >= r + pr + skin) return;
    const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : 1;
    const into = Math.min(0, wx * nx + wz * nz), out = Math.max(0, r + pr - d) - into;
    this.pushX += nx * out; this.pushZ += nz * out;
  }

  shatter(c, show = true) {
    if (show) {
      _p.set(c.to[0], this.r, c.to[1]);
      this.fx.ice?.shatter(_p, LOOK.num('encore-record-shards', 16), this.r * 0.35, 0.5, 0);
      this.fx.impact(_p, '#ffffff', 0.02, 6); sfx.recordShatter();
    }
    this.drop(c);
  }
  drop(c) {
    this.freeWarning(c); if (c.orb) { this.fx.free(c.orb); c.orb = null; }
    this.mesh.setMatrixAt(c.slot.i, _m.makeScale(0, 0, 0)); c.slot.cast = null;
  }
  // everything gone at once (a song rewind, the short-out, its defeat)
  reset() {
    for (const c of this.casts) this.drop(c);
    this.casts.length = 0; this.beat = null; this.pushX = this.pushZ = 0; this.px = this.pz = null;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // show the Warnings for the shader build at load (main.js warmUp)
  warm(on) { for (const w of this.warnings) w.band.visible = w.lane.visible = on && !w.cast; }
  dispose() { this.mesh.removeFromParent(); for (const w of this.warnings) { w.band.removeFromParent(); w.lane.removeFromParent(); } for (const o of this.owned) o.dispose(); this.mesh.dispose(); }
}
