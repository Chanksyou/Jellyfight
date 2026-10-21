// The Encore's floor patterns (act 4): shapes of hot tiles that travel across the concert floor one
// step a beat, in time with its song, like notes coming down a rhythm game's lane. Each step of a
// pattern is a set of tiles that goes off on its beat. Its Warning is those tiles glowing in the
// Encore's colour for `lead` beats before, with a low volume rising out of them to the height the
// hit reaches (docs/adr/0001); on the beat, anything of the jelly inside that volume (its feet below
// --encore-floor-height) is hit. So: jump as it passes, or (an arc) step into its gap.
//
//   ring   expands from the pyramid, a tile thick: jump it as it reaches you
//   arc    a ring with a gap: jump it, or run to the gap
//   arrow  a chevron crossing the floor (dir down, left or right): a volley of them is a run of jumps
//
// Time is in beats, read from the music (Music.beatNow) by whoever drives it, so the floor stays on
// the speakers' beat; it never adds or removes a light, and redraws only the arena's tile colours.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { STAGE4 } from './stage4.js';

const N = STAGE4.tiles, S = STAGE4.tileSize, HALF = (N * S) / 2;
export const tileX = (col) => (col + 0.5) * S - HALF;
export const tileZ = (row) => (row + 0.5) * S - HALF;
const BOSS = STAGE4.bossSpace;
// Health one hit takes: heavy and few, like the Vacuum's charge. It moves to content/bosses.kdl with
// the Encore's other numbers when the Encore joins the campaign.
export const FLOOR_DMG = 4;
// the tiles a pattern can use: not under the boss's riser and reserved space
const OPEN = [];
for (let i = 0; i < N * N; i++) {
  const x = tileX(i % N), z = tileZ((i / N) | 0);
  if (!(Math.abs(x - BOSS.center[0]) < BOSS.width / 2 && Math.abs(z - BOSS.center[2]) < BOSS.depth / 2)) OPEN.push(i);
}

// each pattern: its steps (step k goes off on beat k), and which part of the Encore lights up for it
export const PATTERNS = {
  ring: { part: 'pyramid', steps: (o) => rings(o) },
  arc: { part: 'pyramid', steps: (o) => rings({ gap: 0.9, ...o }) },
  arrow: { part: (o) => ({ left: 'rightWing', right: 'leftWing' })[o.dir] || 'pyramid', steps: (o) => chevrons(o) },
};
// a ring a tile thick from the front of the pyramid, a tile further out each beat; `gap` (radians)
// leaves the tiles within gap/2 of `heading` (0 = straight down the floor, towards the jelly's start) cold
function rings({ gap = 0, heading = 0 } = {}) {
  const ox = BOSS.center[0], oz = BOSS.center[2], r0 = BOSS.depth / 2 + S / 2, out = [];
  for (let k = 0; ; k++) {
    const r = r0 + k * S, step = [];
    for (const i of OPEN) {
      const dx = tileX(i % N) - ox, dz = tileZ((i / N) | 0) - oz;
      if (Math.abs(Math.hypot(dx, dz) - r) >= S / 2) continue;
      if (gap && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading))) < gap / 2) continue;
      step.push(i);
    }
    if (!step.length && (out.length || r > HALF * 2)) return out;
    out.push(step);
  }
}
// a chevron, its tip leading, a row (or column) on each beat: two tiles of the tip, then the arms
// sweeping back a tile for every tile across (a 45° V)
function chevrons({ dir = 'down' } = {}) {
  // a down arrow starts with its tip on the first row in front of the boss's space
  const out = [], first = dir === 'down' ? Math.ceil((BOSS.center[2] + BOSS.depth / 2 + HALF) / S) : 0;
  for (let front = first; front < N + N / 2; front++) {
    const step = [];
    for (const i of OPEN) {
      const row = (i / N) | 0, col = i % N;
      const [along, across] = dir === 'down' ? [row, col] : dir === 'right' ? [col, row] : [N - 1 - col, row];
      if (along === front - Math.floor(Math.abs(across - (N - 1) / 2))) step.push(i);
    }
    if (step.length) out.push(step);
  }
  return out;
}

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class EncoreFloor {
  // arena: buildAct4's; onHit(dmg, cast): the jelly was hit on the beat
  constructor(arena, { onHit = () => {} } = {}) {
    this.arena = arena; this.onHit = onHit;
    this.color = LOOK.color('hostile-encore', '#ff1f5a');
    this.hotColor = new THREE.Color(this.color).lerp(new THREE.Color('#ffffff'), LOOK.num('encore-floor-hot-white', 0.35));   // a tile going off: brighter, towards white, so the beat's tiles stand out from the Warning ahead
    this.casts = [];
    this.beat = null;
    this.warm = new Float32Array(N * N); this.hot = new Float32Array(N * N);
    this.lit = false;
    // the volumes over the warned tiles: one instanced draw, unlit, no depth write, black (unseen) when idle
    const geo = new THREE.BoxGeometry(S - 0.006, 1, S - 0.006).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: LOOK.num('encore-volume-opacity', 0.5), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.volumes = new THREE.InstancedMesh(geo, mat, N * N);
    this.volumes.name = 'Encore floor Warning volumes';
    this.volumes.userData.noCollide = true;
    this.volumes.frustumCulled = false;
    for (let i = 0; i < N * N; i++) { this.place(i, 0); this.volumes.setColorAt(i, _c.set(0)); }
    arena.root.add(this.volumes);
  }

  // play `name` with its first step going off on beat `at` (its Warning starts `lead` beats before)
  cast(name, at, opts = {}) {
    const P = PATTERNS[name], o = { ...opts };
    const cast = { name, at, steps: P.steps(o), part: typeof P.part === 'function' ? P.part(o) : P.part, dmg: o.dmg ?? FLOOR_DMG, hit: false, fired: -1 };
    this.casts.push(cast);
    return cast;
  }
  get lead() { return LOOK.num('encore-floor-lead', 2); }
  get busy() { return this.casts.length > 0; }
  // the beat the last step of everything playing goes off
  get endsAt() { return this.casts.reduce((m, c) => Math.max(m, c.at + c.steps.length - 1), -Infinity); }

  // beat: where the song is now; player: the jelly (its feet at player.position)
  update(beat, player) {
    // a jump in time: back (the song restarted) drops what was playing; forward more than a beat (a
    // pause, a long frame) passes the missed steps without hitting, rather than firing them all at once
    if (this.beat !== null && beat < this.beat) this.casts.length = 0;
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    const lead = this.lead, fade = LOOK.num('encore-floor-fade', 0.5), band = LOOK.num('encore-floor-height', 0.04);
    this.warm.fill(0); this.hot.fill(0);
    const boss = { pyramid: 0, leftWing: 0, rightWing: 0 };
    for (const c of this.casts) {
      // steps whose beat has come: hit the jelly if it's in one (once a cast)
      while (c.fired + 1 < c.steps.length && beat >= c.at + c.fired + 1) {
        c.fired++;
        if (!skip && !c.hit && player && player.position.y < band && this.touches(c.steps[c.fired], player)) { c.hit = true; this.onHit(c.dmg, c); }
      }
      for (let k = Math.max(0, c.fired - 1); k < c.steps.length; k++) {
        const B = c.at + k;
        if (beat < B - lead) break;
        const w = beat < B ? (beat - (B - lead)) / lead : 0, h = beat >= B ? Math.max(0, 1 - (beat - B) / fade) : 0;
        for (const i of c.steps[k]) { if (w > this.warm[i]) this.warm[i] = w; if (h > this.hot[i]) this.hot[i] = h; }
      }
      // the Encore winds up for it: its part fills over the bar before, flashes on the first step, fades after
      const u = beat - c.at;
      boss[c.part] = Math.max(boss[c.part], u < -4 ? 0 : u < 0 ? (u + 4) / 4 * 0.6 : Math.max(0, 1 - u / 2));
    }
    this.casts = this.casts.filter((c) => c.fired + 1 < c.steps.length || beat < c.at + c.steps.length - 1 + fade);
    this.draw(band, boss);
  }

  // does the jelly's footprint (a circle) overlap any of these tiles
  touches(tiles, player) {
    const p = player.position, r = player.cfg?.radius ?? 0.03;
    for (const i of tiles) {
      const dx = Math.max(0, Math.abs(p.x - tileX(i % N)) - S / 2), dz = Math.max(0, Math.abs(p.z - tileZ((i / N) | 0)) - S / 2);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  place(i, h) {
    _p.set(tileX(i % N), 0, tileZ((i / N) | 0)); _s.set(1, Math.max(1e-4, h), 1);
    this.volumes.setMatrixAt(i, _m.compose(_p, _q, _s));
  }

  draw(band, boss) {
    const any = this.casts.length > 0;
    if (!any && !this.lit) return;
    const A = this.arena;
    for (let i = 0; i < N * N; i++) {
      const w = this.warm[i], h = this.hot[i];
      // the floor: a dim Warning that brightens as its beat nears, then the hot tile full on the beat
      const warn = w > 0 ? 0.04 + 0.2 * w * w : 0, hot = h > warn;
      A.setTile((i / N) | 0, i % N, hot ? this.hotColor : this.color, hot ? h : warn);
      // the volume rises out of the tile to the hit's height as the beat nears, and is gone just after
      this.place(i, w > 0 ? band * w : h > 0 ? band : 0);
      if (hot) this.volumes.setColorAt(i, _c.copy(this.hotColor).multiplyScalar(h));
      else this.volumes.setColorAt(i, _c.set(this.color).multiplyScalar(w > 0 ? 0.03 + 0.15 * w : 0));
    }
    this.volumes.instanceMatrix.needsUpdate = true; this.volumes.instanceColor.needsUpdate = true;
    for (const part of ['pyramid', 'leftWing', 'rightWing']) A.boss.setLighting(part, this.color, boss[part]);
    this.lit = any;
  }

  // stop everything and put the floor and the Encore dark
  reset() { this.casts.length = 0; this.lit = true; this.warm.fill(0); this.hot.fill(0); this.draw(0, { pyramid: 0, leftWing: 0, rightWing: 0 }); this.beat = null; }
  dispose() { this.volumes.removeFromParent(); this.volumes.geometry.dispose(); this.volumes.material.dispose(); this.volumes.dispose(); }
}

// The set the Encore plays in the preview: 8 bars, then again. Each entry: [beat in the loop, pattern, opts].
// The arrows four beats apart are three jumps in a row; the arc's gap moves each time round.
export const SETLIST = [
  [0, 'ring'],
  [12, 'arrow', { dir: 'down' }], [16, 'arrow', { dir: 'down' }], [20, 'arrow', { dir: 'down' }],
  [32, 'arc'],
  [44, 'arrow', { dir: 'right' }], [48, 'arrow', { dir: 'left' }],
];
export const SET_BEATS = 64;

// Plays the SETLIST round and round from beat `from`, casting each pattern 6 beats ahead of its first
// step (time for its Warning and the Encore's wind-up). After a jump in time it skips what was missed;
// `quiet(beat)` true (the song's breakdown, its kick out) rests the floor: a pattern that would play
// into it is left out.
export class EncoreSet {
  constructor(floor, from, random = Math.random, quiet = () => false) { Object.assign(this, { floor, from, random, quiet }); this.next = 0; }
  update(beat) {
    for (;;) {
      const loop = Math.floor(this.next / SETLIST.length), [b, name, opts = {}] = SETLIST[this.next % SETLIST.length];
      const at = this.from + loop * SET_BEATS + b;
      if (beat < at - 6) return;
      if (at > beat && !this.quiet(at) && !this.quiet(at + 8)) this.floor.cast(name, at, name === 'arc' ? { heading: (this.random() - 0.5) * 1.6, ...opts } : opts);
      this.next++;
    }
  }
}
