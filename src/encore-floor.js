// The Encore's floor patterns (act 4): shapes of hot tiles that sweep across the concert floor a
// tile every third of a beat, in time with its song, like notes coming down a rhythm game's lane. Each step
// of a pattern is a set of tiles that goes off in its turn, with a low volume over them to the
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
// beats between a wave's steps: a tile every third of a beat (8th-note triplets)
export const FLOOR_STEP = 1 / 3;
export const DJS = ['silver', 'gold'];
// the tiles a pattern can use: not under the boss's riser and reserved space
const OPEN = [];
for (let i = 0; i < N * N; i++) {
  const x = tileX(i % N), z = tileZ((i / N) | 0);
  if (!(Math.abs(x - BOSS.center[0]) < BOSS.width / 2 && Math.abs(z - BOSS.center[2]) < BOSS.depth / 2)) OPEN.push(i);
}

// each pattern: its steps (step k goes off FLOOR_STEP × k beats after it starts), and which part(s)
// of the Encore light up for it
const fromWing = (o) => ({ left: 'rightWing', right: 'leftWing' })[o.dir] || 'pyramid';
export const PATTERNS = {
  ring: { part: 'pyramid', steps: (o) => rings(o) },
  arc: { part: 'pyramid', steps: (o) => rings({ gap: 0.9, ...o }) },
  arrow: { part: fromWing, steps: (o) => chevrons(o) },
  sweep: { part: 'pyramid', steps: (o) => sweep(o) },
  closing: { part: ['leftWing', 'rightWing'], steps: (o) => closing(o) },
  gate: { part: fromWing, steps: (o) => gate(o) },
  pincer: { part: ['leftWing', 'rightWing'], steps: () => pincer() },
};
// a tile's place along a wave's way (row for down, column for right, mirrored for left) and across it
function axes(i, dir) {
  const row = (i / N) | 0, col = i % N;
  return dir === 'down' ? [row, col] : dir === 'right' ? [col, row] : [N - 1 - col, row];
}
// the first row in front of the boss's space: where a wave coming down starts
const FRONT = Math.ceil((BOSS.center[2] + BOSS.depth / 2 + HALF) / S);
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
  const out = [];
  for (let front = dir === 'down' ? FRONT : 0; front < N + N / 2; front++) {
    const step = [];
    for (const i of OPEN) { const [along, across] = axes(i, dir); if (along === front - Math.floor(Math.abs(across - (N - 1) / 2))) step.push(i); }
    if (step.length) out.push(step);
  }
  return out;
}
// a radar line from the pyramid swinging across the floor, `spin` 1 (left to right) or -1, an
// angle a step: jump it as it swings over you
function sweep({ spin = 1 } = {}) {
  const ox = BOSS.center[0], oz = BOSS.center[2], reach = 1.45, d = 0.16, out = [];
  for (let a = -reach; a < reach; a += d) {
    const lo = spin > 0 ? a : -a - d, step = [];
    for (const i of OPEN) {
      const dx = tileX(i % N) - ox, dz = tileZ((i / N) | 0) - oz, t = Math.atan2(dx, dz);
      if (t >= lo && t < lo + d) step.push(i);
    }
    out.push(step);
  }
  return out;
}
// a ring closing in on a spot (`on`: [x, z], where the jelly stood when it was cast), a tile nearer
// each step, ending on it: you can't outrun it, so jump as it reaches you
function closing({ on = [0, 0.3] } = {}) {
  const out = [];
  for (let r = 7 * S; r > -S / 2; r -= S) {
    const step = [];
    for (const i of OPEN) if (Math.abs(Math.hypot(tileX(i % N) - on[0], tileZ((i / N) | 0) - on[1]) - Math.max(0, r)) < S / 2) step.push(i);
    out.push(step);                                       // kept even when empty, so it closes on time
  }
  return out;
}
// a wall right across the floor, a row a step, with a gap two tiles wide at `gap` (the first of the
// two, across its way): run to the gap or jump it
function gate({ dir = 'down', gap = 5 } = {}) {
  const out = [];
  for (let front = dir === 'down' ? FRONT : 0; front < N; front++) {
    const step = [];
    for (const i of OPEN) { const [along, across] = axes(i, dir); if (along === front && (across < gap || across > gap + 1)) step.push(i); }
    if (step.length) out.push(step);
  }
  return out;
}
// two walls, one from each side, closing on the middle a column a step: jump one as it passes you
function pincer() {
  const out = [];
  for (let k = 0; k < N / 2; k++) out.push(OPEN.filter((i) => i % N === k || i % N === N - 1 - k));
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
    const fade = LOOK.num('encore-floor-fade', 0.45), band = LOOK.num('encore-floor-height', 0.04);
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
      for (const part of [].concat(c.part)) if (b > boss[part][0]) boss[part] = [b, who];
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

// What the Encore plays: a wave every 4 beats (a jump hangs about 2.7, so that is as tight as it
// goes), each one picked at random, never the same pattern twice running, with its direction, gap,
// spin and DJ picked too; at a drop (the song's `drop(beat)`), two waves at once, one from each DJ.
export const WAVE_GAP = 4;
const DIRS = ['down', 'left', 'right'];
const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
// a wave's options, picked; `on` is where the jelly is (the closing ring closes on it)
function options(name, random, on) {
  const dir = pick(DIRS, random);
  switch (name) {
    case 'arc': return { heading: (random() - 0.5) * 1.6 };
    case 'arrow': return { dir };
    case 'sweep': return { spin: random() < 0.5 ? 1 : -1 };
    case 'closing': return { on };
    case 'gate': return { dir, gap: 1 + Math.floor(random() * (N - 3)) };
    default: return {};
  }
}
// an arrow or a gate from a wing is the DJ on that side (silver on the left)
const sideDj = (o) => (o.dir === 'right' ? 'silver' : o.dir === 'left' ? 'gold' : null);

// Plays waves from beat `from`, casting each 6 beats ahead of its first step (time for the Encore's
// wind-up). After a jump in time it skips what was missed. The song's `quiet(beat)` (its breakdown,
// the kick out) rests the floor; its `drop(beat)` doubles the waves. `target()` is where the jelly is.
// With `lasers` (encore-laser.js), a club laser from a corner is one of the picks.
export class EncoreSet {
  constructor(floor, from, { random = Math.random, quiet = () => false, drop = () => false, target = () => [0, 0.3], lasers = null } = {}) {
    Object.assign(this, { floor, from, random, quiet, drop, target, lasers });
    this.next = 0; this.last = null; this.dj = 0;
  }
  update(beat) {
    for (;;) {
      const at = this.from + this.next * WAVE_GAP;
      if (beat < at - 6) return;
      if (at > beat && !this.quiet(at) && !this.quiet(at + 8)) this.wave(at, this.drop(at) ? 2 : 1);
      this.next++;
    }
  }
  // `count` waves on beat `at`, different patterns. Two at once are one from each DJ: a wave from a
  // wing is that side's DJ, so the other wave is turned away from that wing.
  wave(at, count) {
    const names = [...Object.keys(PATTERNS), ...(this.lasers ? ['laser'] : [])], waves = [];
    for (let n = 0; n < count; n++) {
      const name = pick(names.filter((x) => x !== this.last && !waves.some((w) => w.name === x)), this.random);
      waves.push({ name, o: name === 'laser' ? { corner: Math.floor(this.random() * 4) % 4, side: this.random() < 0.5 ? 1 : -1, target: this.target } : options(name, this.random, this.target()) });
    }
    // a laser is the venue's rig, not a DJ's: the floor wave with it takes its turn as usual
    const laser = waves.find((w) => w.name === 'laser');
    if (laser) {
      this.lasers.cast(at, laser.o);
      for (const w of waves) if (w !== laser) { w.o.dj = sideDj(w.o) ?? ['silver', 'gold'][this.dj++ % 2]; this.floor.cast(w.name, at, w.o); }
      this.last = waves[waves.length - 1].name;
      return;
    }
    const [a, b] = waves;
    if (b) {
      if (sideDj(a.o) && sideDj(b.o)) b.o.dir = 'down';              // not both from the same (or opposite) wings
      const first = sideDj(a.o) ?? (sideDj(b.o) === 'silver' ? 'gold' : 'silver');
      a.o.dj = first; b.o.dj = first === 'silver' ? 'gold' : 'silver';
      if (sideDj(b.o) && sideDj(b.o) !== b.o.dj) b.o.dir = 'down';
    } else a.o.dj = sideDj(a.o) ?? ['silver', 'gold'][this.dj++ % 2];
    for (const w of waves) this.floor.cast(w.name, at, w.o);
    this.last = waves[waves.length - 1].name;
  }
}
