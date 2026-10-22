// The Encore's floor patterns (act 4): shapes of hot tiles that sweep across the concert floor a
// tile every half beat, in time with its song, like notes coming down a rhythm game's lane. Each step
// of a pattern is a set of tiles that goes off on its half beat, with a low volume over them to the
// height the hit reaches; anything of the jelly inside it (its feet below --encore-floor-height) is
// hit. There are no Warning tiles ahead of the wave, by the owner's call (docs/adr/0001): you watch
// the wave come at you. The Encore's wind-up is its Warning: the pyramid (or a wing) lights over the
// bar before, and the DJ whose wave it is throws an arm up and pumps it on the beat until it's done.
// Each wave is that DJ's colour. So: jump as it passes, or (an arc) step into its gap.
//
//   ring   expands from the pyramid, a tile thick: jump it as it reaches you
//   arc    a ring with a gap: jump it, or run to the gap
//   arrow  a chevron crossing the floor (dir down, left or right): a volley of them is a run of jumps
//
// Time is in beats, read from the music (beatNow) by whoever drives it, so the floor stays on the
// speakers' beat; it never adds or removes a light, and redraws only the arena's tile colours.
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
// beats between a wave's steps: a tile every half beat (8th notes)
export const FLOOR_STEP = 0.5;
export const DJS = ['silver', 'gold'];
// the tiles a pattern can use: not under the boss's riser and reserved space
const OPEN = [];
for (let i = 0; i < N * N; i++) {
  const x = tileX(i % N), z = tileZ((i / N) | 0);
  if (!(Math.abs(x - BOSS.center[0]) < BOSS.width / 2 && Math.abs(z - BOSS.center[2]) < BOSS.depth / 2)) OPEN.push(i);
}

// each pattern: its steps (step k goes off FLOOR_STEP × k beats after it starts), and which part of the Encore lights up for it
export const PATTERNS = {
  ring: { part: 'pyramid', steps: (o) => rings(o) },
  arc: { part: 'pyramid', steps: (o) => rings({ gap: 0.9, ...o }) },
  arrow: { part: (o) => ({ left: 'rightWing', right: 'leftWing' })[o.dir] || 'pyramid', steps: (o) => chevrons(o) },
};
// a ring a tile thick from the front of the pyramid, a tile further out each step; `gap` (radians)
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
// a chevron, its tip leading, a row (or column) each step: two tiles of the tip, then the arms
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
const PARTS = ['pyramid', 'leftWing', 'rightWing'];

export class EncoreFloor {
  // arena: buildAct4's; onHit(dmg, cast): the jelly was hit
  constructor(arena, { onHit = () => {} } = {}) {
    this.arena = arena; this.onHit = onHit;
    // each DJ's colour, and a tile going off in it: pushed towards white so the wave's edge reads
    const white = new THREE.Color('#ffffff'), toWhite = LOOK.num('encore-floor-hot-white', 0.08);
    this.colors = DJS.map((dj, i) => new THREE.Color(LOOK.color(`hostile-encore-${dj}`, ['#3d6bff', '#ffb01e'][i])));
    this.hotColors = this.colors.map((c) => c.clone().lerp(white, toWhite));
    this.tileGain = LOOK.num('encore-floor-glow', 1); this.volumeGain = LOOK.num('encore-volume-glow', 0.7);
    this.casts = [];
    this.beat = null;
    this.turn = 0;                                        // whose wave is next, when a cast doesn't say
    this.hot = new Float32Array(N * N); this.who = new Uint8Array(N * N);
    this.lit = false;
    // the volumes over the hot tiles: one instanced draw, unlit, no depth write, black (unseen) when idle
    const geo = new THREE.BoxGeometry(S - 0.006, 1, S - 0.006).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: LOOK.num('encore-volume-opacity', 0.5), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.volumes = new THREE.InstancedMesh(geo, mat, N * N);
    this.volumes.name = 'Encore floor hit volumes';
    this.volumes.userData.noCollide = true;
    this.volumes.frustumCulled = false;
    for (let i = 0; i < N * N; i++) { this.place(i, 0); this.volumes.setColorAt(i, _c.set(0)); }
    arena.root.add(this.volumes);
  }

  // play `name` with its first step going off on beat `at`; opts.dj ('silver' | 'gold') is whose wave
  // it is (else they take turns)
  cast(name, at, opts = {}) {
    const P = PATTERNS[name], o = { ...opts };
    const dj = DJS.includes(o.dj) ? o.dj : DJS[this.turn++ % 2];
    const cast = { name, at, dj, steps: P.steps(o), step: o.step ?? FLOOR_STEP, part: typeof P.part === 'function' ? P.part(o) : P.part, dmg: o.dmg ?? FLOOR_DMG, hit: false, fired: -1 };
    this.casts.push(cast);
    return cast;
  }
  // the beat step k of a cast goes off, and its last
  stepAt(c, k) { return c.at + k * c.step; }
  endOf(c) { return this.stepAt(c, c.steps.length - 1); }
  get busy() { return this.casts.length > 0; }
  get endsAt() { return this.casts.reduce((m, c) => Math.max(m, this.endOf(c)), -Infinity); }

  // beat: where the song is now; player: the jelly (its feet at player.position)
  update(beat, player) {
    // a jump in time: back (the song restarted) drops what was playing; forward more than a beat (a
    // pause, a long frame) passes the missed steps without hitting, rather than firing them all at once
    if (this.beat !== null && beat < this.beat) this.casts.length = 0;
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    const fade = LOOK.num('encore-floor-fade', 0.6), band = LOOK.num('encore-floor-height', 0.04);
    this.hot.fill(0);
    const boss = { pyramid: [0, 0], leftWing: [0, 0], rightWing: [0, 0] }, dancing = { silver: false, gold: false };
    for (const c of this.casts) {
      const who = DJS.indexOf(c.dj);
      // steps whose time has come: hit the jelly if it's in one (once a cast)
      while (c.fired + 1 < c.steps.length && beat >= this.stepAt(c, c.fired + 1)) {
        c.fired++;
        if (!skip && !c.hit && player && player.position.y < band && this.touches(c.steps[c.fired], player)) { c.hit = true; this.onHit(c.dmg, c); }
      }
      // the wave: steps gone off, held near full then falling away over `fade` beats, so its front stays solid
      for (let k = Math.max(0, c.fired - Math.ceil(fade / c.step)); k <= c.fired; k++) {
        const u = (beat - this.stepAt(c, k)) / fade, h = Math.max(0, 1 - u * u);
        for (const i of c.steps[k]) if (h > this.hot[i]) { this.hot[i] = h; this.who[i] = who; }
      }
      // the Encore winds up for it: its part fills over the bar before, flashes on the first step, fades after
      const u = beat - c.at, b = u < -4 ? 0 : u < 0 ? (u + 4) / 4 * 0.6 : Math.max(0, 1 - u / 2);
      if (b > boss[c.part][0]) boss[c.part] = [b, who];
      // and its DJ dances from the wind-up to the wave's end
      if (u >= -4 && beat <= this.endOf(c) + fade) dancing[c.dj] = true;
    }
    this.casts = this.casts.filter((c) => beat < this.endOf(c) + fade);
    for (const dj of DJS) this.arena.boss.dance?.(dj, dancing[dj] ? beat : null);
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
      const h = this.hot[i], c = this.hotColors[this.who[i]];
      // the wave: a tile lit in its DJ's colour as it goes off, fading behind; its volume shows how high it hits
      A.setTile((i / N) | 0, i % N, c, h * this.tileGain);
      this.place(i, h > 0 ? band : 0);
      this.volumes.setColorAt(i, _c.copy(c).multiplyScalar(h * this.volumeGain));
    }
    this.volumes.instanceMatrix.needsUpdate = true; this.volumes.instanceColor.needsUpdate = true;
    for (const part of PARTS) A.boss.setLighting(part, this.colors[boss[part][1]], boss[part][0]);
    this.lit = any;
  }

  // stop everything: the floor and the Encore dark, the DJs back on the decks
  reset() {
    this.casts.length = 0; this.lit = true; this.hot.fill(0);
    this.draw(0, { pyramid: [0, 0], leftWing: [0, 0], rightWing: [0, 0] });
    for (const dj of DJS) this.arena.boss.dance?.(dj, null);
    this.beat = null;
  }
  dispose() { this.volumes.removeFromParent(); this.volumes.geometry.dispose(); this.volumes.material.dispose(); this.volumes.dispose(); }
}

// The set the Encore plays in the preview: 8 bars, then again. Each entry: [beat in the loop, pattern, opts].
// The arrows four beats apart are three jumps in a row; the arc's gap moves each time round.
// Whose wave each is alternates; an arrow from a wing is the DJ on that side (silver on the left).
export const SETLIST = [
  [0, 'ring', { dj: 'silver' }],
  [12, 'arrow', { dir: 'down', dj: 'gold' }], [16, 'arrow', { dir: 'down', dj: 'silver' }], [20, 'arrow', { dir: 'down', dj: 'gold' }],
  [32, 'arc', { dj: 'silver' }],
  [44, 'arrow', { dir: 'right', dj: 'silver' }], [48, 'arrow', { dir: 'left', dj: 'gold' }],
];
export const SET_BEATS = 64;

// Plays the SETLIST round and round from beat `from`, casting each pattern 6 beats ahead of its first
// step (time for the Encore's wind-up). After a jump in time it skips what was missed;
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
