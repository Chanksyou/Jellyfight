// The Encore's floor patterns (act 4 preview): tiles that go off on the beat, jumped or dodged.
import * as THREE from 'three';
import { buildAct4 } from '../act4-arena.js';
import { EncoreFloor, EncoreSet, PATTERNS, FLOOR_DMG, FLOOR_STEP, tileX, tileZ } from '../encore-floor.js';
import { STAGE4 } from '../stage4.js';
import { World } from '../collision.js';
import { CONFIG } from '../config.js';
import { Player } from '../player.js';
import { Music, SONGS } from '../music.js';
import { SongTrack, TRACKS } from '../song-track.js';
import { EncoreLasers, CORNERS, LASER_DMG } from '../encore-laser.js';
import { LOOK } from '../look.js';
import { story, ok, V } from './kit.js';

const N = STAGE4.tiles, S = STAGE4.tileSize, BOSS = STAGE4.bossSpace;
const BPM = TRACKS.encore.bpm, DT = 1 / 60;   // the floor plays to the Encore's track
function make() {
  const scene = new THREE.Scene(), arena = buildAct4(scene), world = new World(scene, { staticScene: true });
  for (const m of arena.solids) if (m.userData.noCollide) world.addCollider(m, false);
  world.focus(V(0, 0, 0.3), 1);
  const hits = [], floor = new EncoreFloor(arena, { onHit: (dmg, c) => hits.push({ dmg, name: c.name, beat: floor.beat }) });
  return { scene, arena, world, floor, hits, done() { floor.dispose(); arena.dispose(); } };
}
// a stand-in jelly standing still: only its feet and radius matter to the floor
const standing = (x, z, y = 0) => ({ position: V(x, y, z), cfg: { radius: CONFIG.player.radius } });
// step the floor from beat `from` to `to`, a frame at a time at the song's tempo
function play(floor, player, from, to, each) { for (let b = from; b <= to; b += DT * BPM / 60) { each?.(b); floor.update(b, player); } }
const at = (i) => [tileX(i % N), tileZ((i / N) | 0)];

story('encore/ring-travels-a-tile-a-beat', {
  about: 'The ring leaves the front of the pyramid and moves out a tile every third of a beat, one tile thick, so each tile goes off once.',
  setup() {},
  play() {
    const steps = PATTERNS.ring.steps({}), r0 = BOSS.depth / 2 + S / 2, seen = new Map();
    let thick = true;
    steps.forEach((tiles, k) => tiles.forEach((i) => {
      const [x, z] = at(i);
      thick &&= Math.abs(Math.hypot(x - BOSS.center[0], z - BOSS.center[2]) - (r0 + k * S)) < S / 2;
      seen.set(i, (seen.get(i) || 0) + 1);
    }));
    const once = [...seen.values()].every((n) => n === 1);
    return ok(steps.length >= 7 && thick && once && seen.size > 100, { steps: steps.length, tiles: seen.size, thick, once });
  },
});

story('encore/a-standing-jelly-is-hit-on-the-beat', {
  about: 'A jelly standing on a tile of the ring\'s 4th step is hit when that step goes off (a beat in, a step every third of a beat), not before, once, for the floor\'s heavy damage.',
  setup() {},
  play() {
    const T = make();
    try {
      T.floor.cast('ring', 0);
      const tile = T.floor.casts[0].steps[3][Math.floor(T.floor.casts[0].steps[3].length / 2)];
      play(T.floor, standing(...at(tile)), -3, 8);
      const h = T.hits[0];
      const due = 3 * FLOOR_STEP;
      return ok(Math.abs(FLOOR_STEP - 1 / 3) < 1e-9 && T.hits.length === 1 && h.beat >= due && h.beat < due + 0.05 && h.dmg === FLOOR_DMG, { hits: T.hits });
    } finally { T.done(); }
  },
});

// a real jelly on the arena floor, on a tile the ring's 5th step reaches; it jumps
// `early` beats before then (null: it never jumps)
function jumpTheRing(early) {
  const T = make();
  try {
    const p = new Player(T.world, CONFIG.player); T.scene.add(p.mesh);
    T.floor.cast('ring', 0);
    const steps = T.floor.casts[0].steps[4], tile = steps.find((i) => Math.abs(tileX(i % N)) < 0.07) ?? steps[0];
    const [x, z] = at(tile);
    p.spawn(V(x, 0.01, z)); p.snapToGround();
    let jump = false;
    const input = { moveAxes: () => ({ x: 0, y: 0 }), consumeJump: () => { const j = jump; jump = false; return j; }, jumpHeld: false };
    let jumped = false, maxY = 0;
    const due = T.floor.stepAt(T.floor.casts[0], 4);
    play(T.floor, p, -3, 6, (b) => {
      if (early !== null && !jumped && b >= due - early) { jump = jumped = true; }
      T.world.focus(p.position, DT); p.update(DT, input, 0); maxY = Math.max(maxY, p.position.y);
    });
    return { hits: T.hits.length, maxY };
  } finally { T.done(); }
}
story('encore/a-jump-on-the-beat-clears-the-floor', {
  about: 'A real jump pressed just before the wave reaches you (a quarter beat) clears its hot tile; one pressed 3.2 beats early has landed by then and is hit, and so is a jelly that never jumps. A jump hangs about 2.7 beats at 128 BPM.',
  setup() {},
  play() {
    const onBeat = jumpTheRing(0.25), early = jumpTheRing(3.2), never = jumpTheRing(null);
    return ok(onBeat.hits === 0 && early.hits === 1 && never.hits === 1 && onBeat.maxY > 0.15, { onBeat, early, never });
  },
});

story('encore/the-arc-gap-is-safe-to-stand-in', {
  about: 'An arc is a ring with a gap: a jelly standing in its gap is never hit, while the same spot under a full ring is.',
  setup() {},
  play() {
    const T = make();
    try {
      const spot = standing(BOSS.center[0], 0.3);
      T.floor.cast('arc', 0, { heading: 0 }); play(T.floor, spot, -3, 14);
      const inGap = T.hits.length;
      T.floor.reset(); T.floor.cast('ring', 20); play(T.floor, spot, 17, 34);
      return ok(inGap === 0 && T.hits.length === 1, { inGap, ring: T.hits.length });
    } finally { T.done(); }
  },
});

story('encore/arrows-four-beats-apart-are-a-run-of-jumps', {
  about: 'A chevron leads with its tip and crosses the floor a row every third of a beat. Three arrows down, four beats apart, each hit a jelly that stands still: three jumps in a row.',
  setup() {},
  play() {
    const T = make();
    try {
      const steps = PATTERNS.arrow.steps({ dir: 'down' }), mid = steps.find((s) => s.some((i) => (i / N | 0) === 8));
      const rows = (cols) => mid.filter((i) => cols.includes(i % N)).map((i) => (i / N) | 0);
      const tipLeads = Math.min(...rows([5, 6])) > Math.max(...rows([0, 11]));
      for (const at of [4, 8, 12]) T.floor.cast('arrow', at, { dir: 'down' });
      play(T.floor, standing(tileX(5), tileZ(9)), -2, 18);
      const arrows = T.hits.filter((h) => h.name === 'arrow').length;
      return ok(tipLeads && arrows === 3, { tipLeads, hits: T.hits.map((h) => `${h.name}@${h.beat.toFixed(2)}`) });
    } finally { T.done(); }
  },
});

story('encore/the-wave-has-no-warning-and-is-its-djs-colour', {
  about: 'By the owner\'s call there are no Warning tiles: a tile stays dark until its step goes off, then lights in its DJ\'s colour (the silver DJ\'s electric blue, the gold DJ\'s gold) with its volume at the hit\'s height, both gone just under half a beat after. The pyramid lights in that colour over the bar before. No light is added.',
  setup() {},
  play() {
    const T = make();
    try {
      let lights = 0; T.arena.root.traverse((o) => { if (o.isLight) lights++; });
      const silver = T.floor.cast('ring', 6, { dj: 'silver' }), i = silver.steps[2][0], due = T.floor.stepAt(silver, 2);
      const c = new THREE.Color(), m = new THREE.Matrix4(), pos = V(0, 0, 0), q = new THREE.Quaternion(), sc = V(0, 0, 0), panels = T.arena.root.getObjectByName('Encore attack lighting').geometry.attributes.color;
      let now = 2;
      const look = (b) => { for (; now < b; now = Math.min(b, now + 0.05)) T.floor.update(now, null); T.floor.update(b, null); T.arena.tiles.getColorAt(i, c); T.floor.volumes.getMatrixAt(i, m); m.decompose(pos, q, sc); return { r: c.r, g: c.g, b: c.b, height: sc.y, pyramid: [panels.getX(0), panels.getY(0), panels.getZ(0)] }; };
      const windup = look(4), before = look(due - 0.05), on = look(due), after = look(due + 0.5);
      const band = LOOK.num('encore-floor-height', 0.04), blue = (v) => v.b > v.r && v.b > 0.3;
      const dark = before.r + before.g + before.b === 0 && before.height < 1e-3;
      const lit = blue(on) && Math.abs(on.height - band) < 1e-6 && after.r + after.g + after.b === 0 && after.height < 1e-3;
      const windupBlue = windup.pyramid[2] > windup.pyramid[0] && windup.pyramid[2] > 0;
      T.floor.reset();
      const gold = T.floor.cast('ring', 20, { dj: 'gold' }), j = gold.steps[2][0]; now = 16;
      const g = (() => { const b = T.floor.stepAt(gold, 2); for (; now < b; now += 0.05) T.floor.update(now, null); T.floor.update(b, null); T.arena.tiles.getColorAt(j, c); return { r: c.r, g: c.g, b: c.b }; })();
      const golden = g.r > g.b && g.g > g.b;
      let after2 = 0; T.arena.root.traverse((o) => { if (o.isLight) after2++; });
      return ok(dark && lit && windupBlue && golden && lights === 2 && after2 === 2, { before, on, after, windup, gold: g, lights });
    } finally { T.done(); }
  },
});

story('encore/the-djs-wave-pumps-an-arm-on-the-beat', {
  about: 'While a DJ\'s wave plays (from the bar before it to its end) that DJ throws his outer arm up and pumps it, down on every beat; the other DJ stays on the decks, and the arm comes back down after.',
  setup() {},
  play() {
    const T = make();
    try {
      const B = T.arena.boss, [silverArm, goldArm] = B.arms, cast = T.floor.cast('arrow', 8, { dir: 'down', dj: 'gold' });
      const go = (from, to) => { for (let b = from; b <= to; b += 1 / 30) { T.floor.update(b, null); B.update(1 / 60 * 2.13); } };
      go(0, 3.9); const rest = goldArm.rotation.x;
      go(3.9, 10); const onBeat = goldArm.rotation.x;                      // beat 10: the pump is down
      go(10, 10.5); const offBeat = goldArm.rotation.x;                    // half a beat later: up
      const silverStill = Math.abs(silverArm.rotation.x) < 1e-3;
      go(10.5, T.floor.endOf(cast) + 3); const back = goldArm.rotation.x;
      const raised = onBeat < -0.8 && offBeat < onBeat - 0.3, settled = Math.abs(back) < 0.05;
      return ok(B.arms.length === 2 && Math.abs(rest) < 1e-3 && raised && silverStill && settled, { rest, onBeat, offBeat, back, silverStill });
    } finally { T.done(); }
  },
});

story('encore/a-jump-in-time-drops-patterns-instead-of-firing-them', {
  about: 'After a pause or a long frame (the song keeps playing), the floor and the setlist skip what they missed: no burst of hits all at once, and the rest of a pattern still plays.',
  setup() {},
  play() {
    const T = make();
    try {
      const spot = standing(tileX(5), tileZ(9)), set = new EncoreSet(T.floor, 0, { random: () => 0.5 });
      play(T.floor, spot, -8, 13, (b) => set.update(b));
      const before = T.hits.length;
      set.update(40); T.floor.update(40, spot);                       // 27 beats later at once
      const burst = T.hits.length - before;
      play(T.floor, spot, 40, 60, (b) => set.update(b));
      // a 1.2 s hitch in the middle of a ring keeps the ring: its later steps still go off
      T.floor.reset(); const ring = T.floor.cast('ring', 70); play(T.floor, null, 66, 70.5);
      T.floor.update(71.9, null); const kept = T.floor.casts.length === 1 && ring.fired === Math.floor(1.9 / FLOOR_STEP + 1e-9);
      return ok(burst === 0 && kept && T.floor.casts.length + T.hits.length > before, { before, burst, kept, after: T.hits.length });
    } finally { T.done(); }
  },
});

story('encore/the-encore-song-plays-at-121-bpm', {
  about: 'The synthesized fallback song (original French house, played if the track can\'t load) schedules its bars without error, and Music.beatNow counts its beats from the first downbeat.',
  setup() {},
  play() {
    const ctx = new OfflineAudioContext(2, 44100 * 3, 44100), m = new Music(ctx, ctx.destination), BPM = SONGS.encore.bpm;
    m.play('encore'); m.I = m.target = 0.9;
    m.schedule(m.t0 + 8 * 60 / BPM * 4);                              // 8 bars, every layer
    const beat = m.beatNow(), expect = -m.t0 * BPM / 60;
    return ok(SONGS.encore.bpm === 121 && m.step >= 8 * 16 && Math.abs(beat - expect) < 1e-6, { bpm: SONGS.encore.bpm, steps: m.step, beat });
  },
});

story('encore/the-track-loops-on-whole-bars-and-rests-in-its-breakdown', {
  about: 'The Encore\'s track starts 64 beats in (the intro skipped) and loops back there from the end of its 159th bar, a whole number of bars, so its beat counts on across the loop; the setlist leaves out any pattern that would play into its breakdown (the kick out, the file\'s bars 75 to 79), on every time round.',
  setup() {},
  play() {
    const ctx = new OfflineAudioContext(1, 44100, 44100), T = new SongTrack(ctx, ctx.destination, TRACKS.encore);
    T.buffer = ctx.createBuffer(1, 44100 * 300, 44100); T.play();
    const p = 60 / T.bpm, from = TRACKS.encore.offset + 64 * p, whole = Math.abs(T.src.loopStart - from) < 1e-9 && Math.abs(T.src.loopEnd - T.src.loopStart - (159 * 4 - 64) * p) < 1e-9 && T.src.loopEnd <= T.buffer.duration && T.loopBeats === 159 * 4 - 64;
    const L = T.loopBeats, f = (fileBeat) => fileBeat - 64, quiet = T.quiet(f(75 * 4)) && T.quiet(f(79 * 4 + 3)) && !T.quiet(f(74 * 4 + 3)) && !T.quiet(f(80 * 4)) && T.quiet(L + f(77 * 4)) && !T.quiet(0);
    const floor = { casts: [], cast(name, at) { this.casts.push(at); } }, set = new EncoreSet(floor, 0, { random: () => 0.5, quiet: (b) => T.quiet(b) });
    for (let b = 0; b < 2 * L; b += 0.5) set.update(b);
    const rests = floor.casts.every((at) => !T.quiet(at) && !T.quiet(at + 8)), plays = floor.casts.length > 30;
    T.stop();
    return ok(whole && quiet && rests && plays, { whole, quiet, rests, casts: floor.casts.length });
  },
});

story('encore/the-track-beat-grid-lands-on-its-kicks', {
  about: 'The track loads and its measured grid (128 BPM, first beat 0.052 s) sits on the kicks: the low end is far louder just after each beat than halfway between beats, through the whole song.',
  setup() {},
  async play() {
    const T = TRACKS.encore, data = await (await fetch(T.url)).arrayBuffer();
    const rate = 11025, buf = await new OfflineAudioContext(1, 1, rate).decodeAudioData(data);
    const off = new OfflineAudioContext(1, Math.ceil(buf.duration * rate), rate), src = off.createBufferSource(), lp = off.createBiquadFilter();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 150; src.connect(lp).connect(off.destination); src.start();
    const x = (await off.startRendering()).getChannelData(0), p = 60 / T.bpm;
    const loud = (t) => { let e = 0; const a = Math.round(t * rate); for (let i = a; i < a + rate * 0.04; i++) e += x[i] * x[i]; return e; };
    let on = 0, between = 0;
    for (let k = 8; k < T.bars * 4 - 8; k++) { const t = T.offset + k * p; if (T.quiet.includes(Math.floor(k / 4))) continue; on += loud(t); between += loud(t + p / 2); }
    const ratio = on / between;
    return ok(Math.abs(buf.duration - 300) < 1 && T.offset + T.bars * 4 * p <= buf.duration && ratio > 2, { duration: buf.duration, ratio });
  },
});

// a pattern's steps, and the tile a spot is on
const tileAt = (x, z) => Math.floor((z + N * S / 2) / S) * N + Math.floor((x + N * S / 2) / S);
const angle = (i) => Math.atan2(tileX(i % N) - BOSS.center[0], tileZ((i / N) | 0) - BOSS.center[2]);
story('encore/sweep-closing-gate-and-pincer-shapes', {
  about: 'The four newer waves: a sweep is a radar line swinging across the floor from the pyramid (each tile in front once, in angle order, either way round); a closing ring shrinks a tile a step onto its spot, ending on it; a gate is a whole row with a two-tile gap; a pincer is two walls from the sides meeting in the middle.',
  setup() {},
  play() {
    const cw = PATTERNS.sweep.steps({ spin: 1 }), ccw = PATTERNS.sweep.steps({ spin: -1 }), flat = (st) => st.flat();
    const once = new Set(flat(cw)).size === flat(cw).length && flat(cw).length > 80;
    const order = cw.every((st, k) => k === 0 || st.every((i) => cw[k - 1].every((j) => angle(i) >= angle(j))));
    const reverse = ccw.every((st, k) => k === 0 || st.every((i) => ccw[k - 1].every((j) => angle(i) <= angle(j))));
    const on = [tileX(3), tileZ(8)], cl = PATTERNS.closing.steps({ on });
    const ends = cl.at(-1).includes(tileAt(...on)) && cl.length === 8 && !cl.slice(0, -1).some((st) => st.includes(tileAt(...on)));
    const g = PATTERNS.gate.steps({ dir: 'down', gap: 4 }), gapOpen = g.every((st) => !st.some((i) => i % N === 4 || i % N === 5)), rows = g.every((st) => new Set(st.map((i) => (i / N) | 0)).size === 1 && st.length === N - 2);
    const pc = PATTERNS.pincer.steps(), meets = pc.length === N / 2 && pc.every((st, k) => st.every((i) => i % N === k || i % N === N - 1 - k));
    return ok(once && order && reverse && ends && gapOpen && rows && meets, { sweepSteps: cw.length, once, order, reverse, closing: cl.length, ends, gapOpen, rows, meets });
  },
});

story('encore/the-gap-the-squeeze-and-the-closing-ring-hit-as-they-should', {
  about: 'Standing in a gate\'s gap is safe and anywhere else on its way is hit; a pincer hits a jelly in the middle as its walls meet; a closing ring cast on the jelly hits it standing still and misses it jumping as it closes.',
  setup() {},
  play() {
    const T = make();
    try {
      const run = (name, o, spot, to = 12) => { T.floor.reset(); T.hits.length = 0; T.floor.cast(name, 0, o); play(T.floor, spot, -2, to); return T.hits.length; };
      const inGap = run('gate', { dir: 'down', gap: 4 }, standing(tileX(4), tileZ(9))), offGap = run('gate', { dir: 'down', gap: 4 }, standing(tileX(8), tileZ(9)));
      const middle = run('pincer', {}, standing(tileX(5), tileZ(9)));
      const on = [tileX(6), tileZ(9)], still = run('closing', { on }, standing(...on));
      const lastAt = (7 * FLOOR_STEP), jumping = (() => { T.floor.reset(); T.hits.length = 0; T.floor.cast('closing', 0, { on }); const p = standing(...on); play(T.floor, p, -2, 6, (b) => { p.position.y = b > lastAt - 0.5 && b < lastAt + 0.5 ? 0.1 : 0; }); return T.hits.length; })();
      return ok(inGap === 0 && offGap === 1 && middle === 1 && still === 1 && jumping === 0, { inGap, offGap, middle, still, jumping });
    } finally { T.done(); }
  },
});

// a stand-in floor that only records what it's asked to play
const recorder = () => ({ casts: [], cast(name, at, o) { this.casts.push({ name, at, ...o }); } });
story('encore/waves-come-at-random-and-never-twice-running', {
  about: 'The Encore picks every wave at random, a new one every 4 beats: never the same pattern twice running, all seven turning up, its options (direction, gap, spin) picked too, and two different rolls give different sets.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const roll = (seed) => { const f = recorder(), set = new EncoreSet(f, 0, { random: lcg(seed) }); for (let b = -6; b <= 800; b += 0.5) set.update(b); return f.casts; };
    const a = roll(1), b = roll(2), names = a.map((c) => c.name);
    const never = names.every((n, k) => k === 0 || n !== names[k - 1]);
    const all = Object.keys(PATTERNS).every((n) => names.includes(n));
    const spaced = a.every((c, k) => k === 0 || c.at - a[k - 1].at === 4);
    const differ = a.slice(0, 8).map((c) => c.name).join() !== b.slice(0, 8).map((c) => c.name).join();
    const varied = new Set(a.filter((c) => c.name === 'gate').map((c) => `${c.dir}${c.gap}`)).size > 3 && new Set(a.filter((c) => c.dir).map((c) => c.dir)).size === 3;
    const sides = a.every((c) => (c.dir === 'right' ? c.dj === 'silver' : c.dir === 'left' ? c.dj === 'gold' : true));
    return ok(never && all && spaced && differ && varied && sides, { waves: a.length, never, all, spaced, differ, varied, sides, first: names.slice(0, 10) });
  },
});

story('encore/the-drop-sends-two-waves-at-once-one-per-dj', {
  about: 'At the track\'s drop, 64 beats into the fight (the file\'s bars 32 to 39), the waves come two at a time, different patterns, one from each DJ, so both DJs pump; before and after it, one at a time. The drop comes round again on every loop.',
  setup() {},
  play() {
    const ctx = new OfflineAudioContext(1, 44100, 44100), track = new SongTrack(ctx, ctx.destination, TRACKS.encore);
    const f = recorder(), set = new EncoreSet(f, 0, { drop: (b) => track.drop(b) });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const byBeat = new Map(); for (const c of f.casts) byBeat.set(c.at, [...(byBeat.get(c.at) || []), c]);
    const inDrop = [...byBeat].filter(([at]) => at >= 64 && at < 96), outside = [...byBeat].filter(([at]) => at < 64 || at >= 96);
    const pairs = inDrop.length === 8 && inDrop.every(([, w]) => w.length === 2 && w[0].name !== w[1].name && new Set(w.map((c) => c.dj)).size === 2);
    const singles = outside.every(([, w]) => w.length === 1);
    const again = track.drop(64 + track.loopBeats) && !track.drop(63) && !track.drop(96);
    // and on the real floor both DJs dance through it
    const T = make();
    try {
      const real = new EncoreSet(T.floor, 0, { drop: (b) => track.drop(b) });
      for (let b = 56; b <= 72; b += 1 / 30) { real.update(b); T.floor.update(b, null); T.arena.boss.update(1 / 60); }
      const both = T.arena.boss.arms.every((arm) => arm.rotation.x < -0.8);
      return ok(pairs && singles && again && both, { inDrop: inDrop.map(([at, w]) => `${at}:${w.map((c) => `${c.name}/${c.dj}`).join('+')}`), singles, again, both });
    } finally { T.done(); }
  },
});

// the lasers on an arena of their own, hits recorded
function lasersOn() {
  const scene = new THREE.Scene(), arena = buildAct4(scene), hits = [];
  const lasers = new EncoreLasers(arena, { onHit: (dmg, c) => hits.push({ dmg, beat: lasers.beat }) });
  return { scene, arena, lasers, hits, done() { lasers.dispose(); arena.dispose(); } };
}
story('encore/the-laser-flashes-its-band-then-fires-a-plane-that-sweeps', {
  about: 'A club laser\'s Warning is a thin line (3 cm) flashing faintly green on the floor for 2 beats where it will land, with the plane barely there over it; on the beat the plane fires full from its corner\'s emitter and swings 10 cm across the band over a beat, then it is gone and its slot free. No light is added.',
  setup() {},
  play() {
    const T = lasersOn();
    try {
      let lights = 0; T.arena.root.traverse((o) => { if (o.isLight) lights++; });
      const c = T.lasers.cast(4, { corner: 1, on: [0, 0.3], side: 1 }), { plane, band } = c.slot;
      const at = (b) => { for (let x = T.lasers.beat ?? 0; x < b; x += 0.05) T.lasers.update(x, null); T.lasers.update(b, null); return { band: band.visible, flash: band.material.opacity, on: plane.material.uniforms.uOn.value, plane: plane.visible }; };
      const idle = at(1.5), warnA = at(2.6), warnB = at(3.1), fire = at(4.3);
      const apex = new THREE.Vector3().fromBufferAttribute(plane.geometry.attributes.position, 0), [cx, cz] = CORNERS[1];
      const fromEmitter = Math.abs(apex.x - cx) < 1e-6 && Math.abs(apex.z - cz) < 1e-6 && apex.y > 0.3;
      const a0 = T.lasers.line(c, 0).nx, s0 = T.lasers.line(c, 0), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
      T.lasers.line(c, 0, p0); T.lasers.line(c, 1, p1);
      const swept = Math.abs(p1.clone().sub(p0).dot(new THREE.Vector3(s0.nx, 0, s0.nz)) - LOOK.num('encore-laser-sweep', 0.1)) < 1e-6;
      const gone = at(5.6), freed = !c.slot.cast && !T.lasers.busy;
      let after = 0; T.arena.root.traverse((o) => { if (o.isLight) after++; });
      const thin = Math.abs(band.scale.x - LOOK.num('encore-laser-band', 0.03)) < 1e-9;
      const warns = thin && !idle.band && warnA.band && warnB.band && warnA.flash !== warnB.flash && Math.max(warnA.flash, warnB.flash) <= 0.2 && warnA.on > 0 && warnA.on <= 0.04;
      return ok(warns && fire.on === 1 && fromEmitter && swept && !gone.band && !gone.plane && freed && lights === 2 && after === 2 && typeof a0 === 'number', { idle, warnA, warnB, fire, gone, fromEmitter, swept, freed, lights });
    } finally { T.done(); }
  },
});

story('encore/the-laser-hits-in-its-sweep-and-can-be-jumped-far-from-its-corner', {
  about: 'Standing where the laser is aimed, or in the 10 cm it sweeps over, is a hit (once, for 4 Health); standing just outside its band on the other side is safe. The plane is tall by its corner and low at the far end, so a jump clears it far away and not near the corner.',
  setup() {},
  play() {
    const T = lasersOn();
    try {
      const run = (spot, y = 0) => { T.lasers.reset(); T.hits.length = 0; const c = T.lasers.cast(2, { corner: 3, on: [0, 0], side: 1 }); const p = standing(...spot, y); for (let b = 0; b <= 4; b += 1 / 30) T.lasers.update(b, p); return { n: T.hits.length, c }; };
      const probe = T.lasers.cast(0, { corner: 3, on: [0, 0], side: 1 }), L = T.lasers.line(probe, 0); T.lasers.reset();
      const [cx, cz] = CORNERS[3], along = (t, off) => [cx + L.ux * t + L.nx * off, cz + L.uz * t + L.nz * off];
      const aimed = run(along(0.9, 0)).n, swept = run(along(0.9, 0.06)).n, other = run(along(0.9, -0.08)).n, beyond = run(along(0.9, 0.16)).n;
      const farJump = run(along(L.far - 0.15, 0.03), 0.08).n, nearJump = run(along(0.2, 0.03), 0.08).n;
      const dmg = (() => { run(along(0.9, 0)); return T.hits[0]?.dmg; })();
      return ok(aimed === 1 && swept === 1 && other === 0 && beyond === 0 && farJump === 0 && nearJump === 1 && dmg === LASER_DMG, { aimed, swept, other, beyond, farJump, nearJump, far: L.far });
    } finally { T.done(); }
  },
});

story('encore/a-laser-fires-every-4-beats', {
  about: 'With the lasers rigged, a club laser fires on every wave\'s beat, every 4 beats, alongside the random floor waves, from a random corner (all four turn up) to a random side, aimed where the jelly is.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const shots = [], lasers = { cast(at, o) { shots.push({ at, ...o }); } }, f = recorder();
    const set = new EncoreSet(f, 0, { random: lcg(7), lasers, target: () => [0.1, 0.2] });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const every4 = shots.length > 40 && shots.every((s, k) => s.at === 4 * k), withWaves = shots.every((s) => f.casts.some((c) => c.at === s.at));
    const corners = new Set(shots.map((s) => s.corner)).size === 4, sides = new Set(shots.map((s) => s.side)).size === 2, aimed = shots.every((s) => s.target()[0] === 0.1);
    return ok(every4 && withWaves && corners && sides && aimed, { lasers: shots.length, every4, withWaves, corners, sides, aimed });
  },
});
