// The Encore's floor patterns (act 4 preview): tiles that go off on the beat, jumped or dodged.
import * as THREE from 'three';
import { buildAct4 } from '../act4-arena.js';
import { EncoreFloor, PATTERNS, FLOOR_DMG, FLOOR_STEP, tileX, tileZ } from '../encore-floor.js';
import { SetList, LINE_WAVES } from '../encore.js';
import { ENCORE } from '../stage4.js';
import { World } from '../collision.js';
import { CONFIG } from '../config.js';
import { Player } from '../player.js';
import { Music, SONGS } from '../music.js';
import { SongTrack, TRACKS } from '../song-track.js';
import { EncoreLasers, CORNERS, LASER_DMG } from '../encore-laser.js';
import { EncoreDisco, DISCO, DISCO_DMG } from '../encore-disco.js';
import { LOOK } from '../look.js';
import { buildEncoreBoss, MOVES } from '../encore-model.js';
import { EncoreRecords, landing } from '../encore-records.js';
import { EncoreWall } from '../encore-wall.js';
import { EncorePyro } from '../encore-pyro.js';
import { bus, PLAYER } from '../events.js';
import { sfx } from '../sfx.js';
import { EncoreHints, ENCORE_HINTS, ENCORE_HINTS_KEY } from '../first-run.js';
import { story, ok, V, encoreFight, step, stub, G } from './kit.js';

const N = ENCORE.tiles, S = ENCORE.tileSize, BOSS = ENCORE.bossSpace;
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
    let jumped = false, maxY = 0, overAtDue = null;
    const due = T.floor.stepAt(T.floor.casts[0], 4), band = LOOK.num('encore-floor-height', 0.04);
    play(T.floor, p, -3, 6, (b) => {
      if (early !== null && !jumped && b >= due - early) { jump = jumped = true; }
      T.world.focus(p.position, DT); p.update(DT, input, 0); maxY = Math.max(maxY, p.position.y);
      if (overAtDue === null && b >= due) overAtDue = p.position.y >= band;
    });
    return { hits: T.hits.length, maxY, overAtDue };
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

story('encore/landing-in-the-waves-wake-is-hit', {
  about: 'A hot tile keeps hurting while it is lit (just under half a beat), not only the instant it goes off: a jump pressed so early that the jelly is still over the wave as its tile goes off, but lands while that tile is lit, is hit.',
  setup() {},
  play() {
    const tries = [];
    for (let early = 2.3; early <= 3.1; early += 0.05) tries.push({ early: +early.toFixed(2), ...jumpTheRing(early) });
    const wake = tries.filter((t) => t.overAtDue && t.hits === 1);
    return ok(wake.length >= 1, { wake: wake.map((t) => t.early), tries: tries.map((t) => `${t.early}:${t.overAtDue ? 'over' : 'down'}/${t.hits}`) });
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
      const spot = standing(tileX(5), tileZ(9)), set = new SetList(T.floor, 0, { random: () => 0.5 });
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
    const floor = { casts: [], cast(name, at) { this.casts.push(at); } }, set = new SetList(floor, 0, { random: () => 0.5, quiet: (b) => T.quiet(b) });
    for (let b = 0; b < 2 * L; b += 0.5) set.update(b);
    const rests = floor.casts.every((at) => !T.quiet(at) && !T.quiet(at + 8)), plays = floor.casts.length > 30;
    T.stop();
    return ok(whole && quiet && rests && plays, { whole, quiet, rests, casts: floor.casts.length });
  },
});

story('encore/a-stuck-track-decode-is-tried-again', {
  about: 'A phone could get stuck decoding the Encore\'s 5 minute track. A decode not done within the track\'s `wait` is started again once (a second one that finishes is used); if that sticks too, load() is false and the fight plays on its own clock with no other song in its place.',
  setup() {},
  async play() {
    const small = { ...TRACKS.encore, url: './assets/audio/fireball-flight.mp3', wait: 0.2 };
    const stuck = new OfflineAudioContext(1, 44100, 44100);
    stuck.decodeAudioData = () => new Promise(() => {});                 // never settles
    const T = new SongTrack(stuck, stuck.destination, small), t0 = performance.now();
    const gave = await T.load(), took = performance.now() - t0;
    const once = new OfflineAudioContext(1, 44100, 44100), real = once.decodeAudioData.bind(once);
    let calls = 0;
    once.decodeAudioData = (b) => (++calls === 1 ? new Promise(() => {}) : real(b));   // stuck the first time only
    const again = await new SongTrack(once, once.destination, small).load();
    return ok(gave === false && !T.buffer && took >= 350 && took < 2000 && again === true && calls === 2, { gave, took: Math.round(took), again, calls });
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
  about: 'The Encore picks every wave at random, a new one every other bar (8 beats), only lines (never a ring or an arc): never the same pattern twice running, all four line waves turning up and no other, its options (direction, gap, spin) picked too, and two different rolls give different sets.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const roll = (seed) => { const f = recorder(), set = new SetList(f, 0, { random: lcg(seed) }); for (let b = -6; b <= 800; b += 0.5) set.update(b); return f.casts; };
    const a = roll(1), b = roll(2), names = a.map((c) => c.name);
    const never = names.every((n, k) => k === 0 || n !== names[k - 1]);
    const all = LINE_WAVES.every((n) => names.includes(n)) && names.every((n) => LINE_WAVES.includes(n)) && !names.some((n) => ['ring', 'arc', 'closing'].includes(n));
    const spaced = a.every((c, k) => k === 0 || c.at - a[k - 1].at === 8);
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
    const f = recorder(), set = new SetList(f, 0, { drop: (b) => track.drop(b) });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const byBeat = new Map(); for (const c of f.casts) byBeat.set(c.at, [...(byBeat.get(c.at) || []), c]);
    const inDrop = [...byBeat].filter(([at]) => at >= 64 && at < 96), outside = [...byBeat].filter(([at]) => at < 64 || at >= 96);
    const pairs = inDrop.length === 4 && inDrop.every(([, w]) => w.length === 2 && w[0].name !== w[1].name && new Set(w.map((c) => c.dj)).size === 2);
    const singles = outside.every(([, w]) => w.length === 1);
    const again = track.drop(64 + track.loopBeats) && !track.drop(63) && !track.drop(96);
    // and on the real floor both DJs dance through it
    const T = make();
    try {
      const real = new SetList(T.floor, 0, { drop: (b) => track.drop(b) });
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
  about: 'With the lasers rigged, a club laser fires on every bar, every 4 beats, with a floor wave on every other one, from a random corner (all four turn up) to a random side, aimed where the jelly is.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const shots = [], lasers = { cast(at, o) { shots.push({ at, ...o }); } }, f = recorder();
    const set = new SetList(f, 0, { random: lcg(7), lasers, target: () => [0.1, 0.2] });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const every4 = shots.length > 40 && shots.every((s, k) => s.at === 4 * k), withWaves = f.casts.length > 20 && f.casts.every((c) => shots.some((s) => s.at === c.at)) && f.casts.every((c, k) => k === 0 || c.at - f.casts[k - 1].at === 8);
    const corners = new Set(shots.map((s) => s.corner)).size === 4, sides = new Set(shots.map((s) => s.side)).size === 2, aimed = shots.every((s) => s.target()[0] === 0.1);
    return ok(every4 && withWaves && corners && sides && aimed, { lasers: shots.length, every4, withWaves, corners, sides, aimed });
  },
});

// the disco ball on an arena of its own, hits recorded
function discoOn(opts = {}) {
  const scene = new THREE.Scene(), arena = buildAct4(scene), hits = [];
  const disco = new EncoreDisco(arena, { onHit: (dmg) => hits.push({ dmg, beat: disco.beat }), ...opts });
  return { scene, arena, disco, hits, done() { disco.dispose(); arena.dispose(); } };
}
const roll = (d, from, to, p = null) => { for (let b = from; b <= to; b += 1 / 30) d.update(b, p); };
story('encore/the-disco-ball-visits-when-the-set-list-books-it', {
  about: 'The disco ball never drops on its own: once the set list books a visit (beat 128 here), it comes down for 8 beats, hanging low over the floor while it plays and out of sight otherwise; a visit that would play into the song\'s breakdown is skipped.',
  setup() {},
  play() {
    const T = discoOn({ quiet: (b) => b >= 224 && b < 232 });
    try {
      const D = T.disco, unbooked = [0, 127.5, 128, 200].every((b) => D.showAt(b) === null);
      D.visit(128);
      const shows = [100, 127.5, 128, 135.9, 150].map((b) => D.showAt(b)), when = shows.join() === [null, 128, 128, 128, null].join();
      roll(D, 120, 126); const before = D.hanger.visible;
      roll(D, 126, 130); const down = D.hanger.visible && D.hanger.position.y < 0.6 && D.spots.visible;
      roll(D, 130, 140); const after = !D.hanger.visible && !D.spots.visible;
      D.visit(224); const rests = D.showAt(226) === null;
      return ok(unbooked && when && !before && down && after && rests && DISCO.spots === 32, { unbooked, shows, before, down, after, rests });
    } finally { T.done(); }
  },
});

story('encore/disco-spots-wheel-then-stop-and-flash-then-strike', {
  about: 'Each 4 beats of the show: the 32 spots wheel round for 3 beats (moving), then stop and flash fast between warm white and hot magenta for the 4th; as it ends they strike where they stopped, hurting a jelly on one (once, for 4 Health), jumping or not (a beam of light: a jump doesn\'t clear it), but not one beside them. The second 4 beats turn the other way and strike again. No light is added.',
  setup() {},
  play() {
    const T = discoOn(); T.disco.visit(128);
    try {
      const D = T.disco, q = new THREE.Vector3(), m = new THREE.Matrix4(), c = new THREE.Color();
      let lights = 0; T.arena.root.traverse((o) => { if (o.isLight) lights++; });
      roll(D, 127, 128.5); const a = D.spot(0, D.turn(0.5), new THREE.Vector3()).clone();
      roll(D, 128.5, 129.5); const b = D.spot(0, D.turn(1.5), new THREE.Vector3()).clone();
      const moves = a.distanceTo(b) > 0.01;
      roll(D, 129.5, 131.2); const s1 = D.spot(0, D.turn(3.2), new THREE.Vector3()).clone();
      roll(D, 131.2, 131.8); const s2 = D.spot(0, D.turn(3.8), new THREE.Vector3()).clone();
      const stops = s1.distanceTo(s2) < 1e-9;
      const colours = new Set(); for (let x = 131.0; x < 132; x += 1 / 16) { D.update(x, null); D.spots.getColorAt(0, c); colours.add(c.getHexString()); }
      const flashes = colours.size >= 2;
      const reverse = Math.sign(D.turn(5) - D.turn(4.5)) !== Math.sign(D.turn(1) - D.turn(0.5));
      // strikes: on a stopped spot, beside one, jumping
      const strike = (place, y = 0) => { const R = discoOn({ random: (() => { let s = 9; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })() }); R.disco.visit(128); try { roll(R.disco, 126, 127.9); const t = R.disco.turn(DISCO.move); const spot = R.disco.spot(0, t, new THREE.Vector3()).clone(); const p = standing(...place(spot, R.disco), y); roll(R.disco, 127.9, 132.2, p); return { n: R.hits.length, dmg: R.hits[0]?.dmg, at: R.hits[0]?.beat }; } finally { R.done(); } };
      const on = strike((s) => [s.x, s.z]), clear = (s, d) => { for (let k = 0; k < 64; k++) { const x = s.x + Math.cos(k) * 0.12, z = s.z + Math.sin(k) * 0.12; let near = false; for (let i = 0; i < 32; i++) { const o = d.spot(i, d.turn(DISCO.move), new THREE.Vector3()); if (o && Math.hypot(o.x - x, o.z - z) < 0.07) near = true; } if (!near) return [x, z]; } return [9, 9]; };
      const beside = strike(clear), jumping = strike((s) => [s.x, s.z], 0.08);
      let after = 0; T.arena.root.traverse((o) => { if (o.isLight) after++; });
      const strikes = on.n === 1 && on.dmg === DISCO_DMG && on.at >= 132 && on.at < 132.1 && beside.n === 0 && jumping.n === 1;
      return ok(moves && stops && flashes && reverse && strikes && lights === after, { moves, stops, colours: [...colours], reverse, on, beside, jumping });
    } finally { T.done(); }
  },
});

// The set list (encore.js SetList). Its waves and lasers at a fixed roll, as recorded when waves became
// line waves every other bar (a laser still every bar)
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const SET_FIXTURE = 'sweep@8:s:s-1 L8:2+ L12:1- gate@16:g:down:g6 L16:1+ L20:2- sweep@24:s:s-1 L24:1- L28:2+ arrow@32:g:down L32:1+ L36:2- gate@40:s:down:g7 L40:3+ L44:1- arrow@48:g:left L48:1- L52:3- pincer@56:g L56:0+ L60:2+ arrow@64:s:down L64:2- L68:1+ pincer@88:g L88:3+ L92:1+ arrow@96:s:down L96:3+ L100:0- pincer@104:g L104:0+ L108:3- arrow@112:g:left L112:2- L116:2+ gate@120:s:down:g9 pincer@120:g L120:2- L124:0+ arrow@128:s:right sweep@128:g:s1 L128:3- L132:1+ gate@136:s:down:g6 L136:2+ L140:1- sweep@144:g:s1 L144:2+ L148:1+ arrow@152:s:right L152:2- L156:2- gate@160:s:down:g9 L160:2- L164:1- sweep@168:g:s-1 L168:0+ L172:2+ gate@176:g:left:g5 L176:1+ L180:2- pincer@184:s L184:3+ L188:2- sweep@192:g:s-1 L192:2+ L196:0- pincer@200:s L200:0- L204:0+ sweep@208:g:s-1 L208:1+ L212:0- pincer@216:s L216:1+ L220:0- sweep@224:g:s-1 L224:2+ L228:2+ pincer@232:s L232:1- L236:3- gate@240:s:right:g3 L240:3+ L244:2+ sweep@248:g:s-1 L248:1- L252:3+ pincer@256:s L256:2+ L260:2+ arrow@264:g:down L264:0+';
const describe = (casts) => casts.map((c) => c.laser != null ? `L${c.laser}:${c.corner}${c.side > 0 ? '+' : '-'}` : `${c.name}@${c.at}:${c.dj[0]}${c.dir ? ':' + c.dir : ''}${c.gap != null ? ':g' + c.gap : ''}${c.spin ? ':s' + c.spin : ''}${c.heading != null ? ':h' + c.heading.toFixed(3) : ''}`).join(' ');
story('encore/the-set-list-lays-out-its-waves-and-lasers-as-recorded', {
  about: 'At a fixed roll, the set list in set 1 lays out exactly the waves and lasers recorded: a line wave every other bar and a laser every bar, the same patterns, options and DJs on the same beats, resting through a breakdown and doubling through a drop.',
  setup() {},
  play() {
    const f = recorder(), lasers = { cast(at, o) { f.casts.push({ laser: at, corner: o.corner, side: o.side }); } };
    const set = new SetList(f, 8, { random: lcg(1), quiet: (b) => b >= 80 && b < 88, drop: (b) => b >= 120 && b < 136, target: () => [0.1, 0.2], lasers });
    for (let b = -6; b <= 260; b += 0.25) set.update(b);
    const got = describe(f.casts), same = got === SET_FIXTURE;
    return ok(same, { same, first: got.split(' ').findIndex((w, k) => w !== SET_FIXTURE.split(' ')[k]), got });
  },
});

story('encore/the-set-list-adds-each-stages-attacks-bar-by-bar', {
  about: 'Whatever stage a bar is laid out in decides what it holds: the warm-up only waves, one at a time (no lasers, no doubling at a drop); from set 1 a laser on every wave; disco ball visits only in set 2, every 8 bars halfway between solo slots; and from the end of the warm-up a solo slot every 16 bars, on a bar line, silver in set 1, silver and gold in turn in set 2, then silver, gold and a duet, the turn carrying on from stage to stage (set 2 opens on gold, set 3 on the duet).',
  setup() {},
  play() {
    // the stage by beat (a stand-in for the Encore's Health)
    const stageAt = (b) => (b < 40 ? 'warmup' : b < 300 ? 'set1' : b < 600 ? 'set2' : 'set3');
    let now = 0;
    const f = recorder(), shots = [], visits = [], slots = [];
    const set = new SetList(f, 8, { random: lcg(3), drop: (b) => b >= 16 && b < 32, stage: () => stageAt(now + 6), lasers: { cast: (at) => shots.push(at) },
      disco: { visit: (at) => visits.push(at) }, slot: (kind, at) => slots.push(`${kind}@${at}`) });
    for (now = -6; now <= 900; now += 0.25) set.update(now);
    const o = set.origin;
    const warm = f.casts.filter((c) => c.at < o), single = warm.length > 0 && new Set(warm.map((c) => c.at)).size === warm.length;
    const noLasers = shots.every((at) => at >= o) && shots.length > 100 && f.casts.filter((c) => c.at >= o).every((c) => shots.includes(c.at));
    const disco = visits.length > 3 && visits.every((at) => stageAt(at) === 'set2' && (at - o) % 32 === 16);
    const want = []; let last = null;
    for (let at = o + 64; at <= 900; at += 64) { const kinds = { set1: ['silver'], set2: ['silver', 'gold'], set3: ['silver', 'gold', 'duet'] }[stageAt(at)]; last = kinds[(kinds.indexOf(last) + 1) % kinds.length]; want.push(`${last}@${at}`); }
    const solos = slots.join() === want.join() && slots.some((x) => x.startsWith('duet'));
    return ok(o === 40 && single && noLasers && disco && solos, { origin: o, single, noLasers, disco, visits: visits.slice(0, 6), solos, slots: slots.slice(0, 8) });
  },
});

story('encore/a-short-fight-still-sees-every-solo', {
  about: 'The solo turn carries on across the 75%, 50% and 25% gates, so a fight paced at about 3.5 minutes (24 bars a stage after a 8 bar warm-up) sees the silver solo, the gold solo and the duet; the duet never plays above half Health (its turn passes to the next DJ), and gold never before set 2.',
  setup() {},
  play() {
    const stageAt = (b) => (b < 32 ? 'warmup' : b < 128 ? 'set1' : b < 224 ? 'set2' : b < 320 ? 'set3' : 'last');
    let now = 0;
    const slots = [], set = new SetList(recorder(), 0, { random: lcg(5), stage: () => stageAt(now + 6), slot: (kind, at) => { slots.push([kind, stageAt(at)]); } });
    for (now = -6; now <= 416; now += 0.25) set.update(now);
    const kinds = new Set(slots.map(([k]) => k)), early = slots.every(([k, st]) => (k !== 'duet' || st === 'set3' || st === 'last') && (k !== 'gold' || st !== 'set1'));
    return ok(kinds.has('silver') && kinds.has('gold') && kinds.has('duet') && early, { slots: slots.map((x) => x.join(' in ')), early, minutes: +(416 * 60 / BPM / 60).toFixed(1) });
  },
});

// the set list in the real fight (an act-4 page in the arena)
const fight = (name, s) => story('encore/' + name, { act: 4, scene: 2, ...s });
const counting = (B) => {
  const n = { floor: 0, laser: 0 };
  for (const [sys, key] of [[B.floor, 'floor'], [B.lasers, 'laser']]) { const real = sys.cast; stub(sys, 'cast', function (...a) { n[key]++; return real.apply(this, a); }); }
  return n;
};
fight('fight-stages-follow-its-health-not-the-clock', {
  about: 'The Encore\'s stage comes from its Health, not the time: behind its opening force field it warms up with waves only (no lasers); then set 1 adds lasers; however long set 1 plays, its disco ball never visits, and a visit is booked within 8 bars of it reaching 75% (set 2). 50% is set 3 and 25% the last song.',
  setup() {},
  play() {
    const B = encoreFight({ guard: true, hurt: false });
    stub(B, 'song', { beat: () => null });
    const n = counting(B);
    step(60 * 8);
    const warm = B.stage === 'warmup' && n.floor >= 1 && n.laser === 0;
    step(60 * 9, () => !B.opening); step(60 * 4);
    const set1 = B.stage === 'set1' && n.laser > 0;
    B.clock += 400; step(60 * 16);                                // a long set 1, far past where the old timer dropped the ball
    const noDisco = B.disco.visitAt == null && B.stage === 'set1';
    B.hp = B.maxHp * 0.75; const set2 = B.stage === 'set2';
    step(60 * 16, () => B.disco.visitAt != null);
    const booked = B.disco.visitAt != null && B.disco.visitAt > B.beat - 8;
    const gates = [[0.76, 'set1'], [0.5, 'set3'], [0.26, 'set3'], [0.25, 'last'], [0.1, 'last']].map(([f, want]) => { B.hp = B.maxHp * f; return B.stage === want; });
    const kdl = B.def.skills.stages?.set2 === 0.75 && B.def.skills.stages?.set3 === 0.5 && B.def.skills.stages?.last === 0.25 && B.def.skills.set?.solo === 16 && B.def.skills.set?.disco === 8;
    return ok(kdl && warm && set1 && noDisco && set2 && booked && gates.every(Boolean), { kdl, warm, set1, noDisco, set2, booked, visit: B.disco.visitAt, beat: B.beat, gates, n });
  },
});

fight('the-solo-turn-carries-on-through-the-short-out', {
  about: 'The short-out rebuilds the set list, but the solo turn carries on: after a gold solo in set 2, the first slot after the short-out (set 3) is the duet, not silver again.',
  setup() {},
  play() {
    const B = encoreFight({ hurt: false }), slots = [];
    stub(B, 'song', { beat: () => null });
    stub(B, 'slot', (kind, at) => { slots.push(kind); return true; });   // (counted, not played)
    B.hp = B.maxHp * 0.6; B.soloTurn.last = 'gold';                       // set 2, its last solo the gold DJ's
    step(30); B.damage(B.hp - B.maxHp * 0.45);
    const cut = !!B.cut;
    step(60 * 60, () => slots.length > 0);
    return ok(cut && B.stage === 'set3' && slots[0] === 'duet', { cut, stage: B.stage, slots });
  },
});

fight('fight-a-hit-straight-past-half-still-shorts-out', {
  about: 'A build that takes the Encore from full Health straight past 50% (even past 25%) in one hit still gets its short-out cut scene, and comes out of it in the right stage with its disco ball down for good.',
  setup() {},
  play() {
    const B = encoreFight({ hurt: false });
    step(30);
    B.damage(B.maxHp * 0.8);
    const cut = !!B.cut && B.broken;
    step(60 * 6, () => !B.cut); step(60 * 3);
    return ok(cut && !B.cut && B.stage === 'last' && B.disco.stayFrom != null, { cut, after: !B.cut, stage: B.stage, stay: B.disco.stayFrom });
  },
});

fight('fight-a-song-rewind-in-any-stage-re-arms-the-set', {
  about: 'When the song rewinds in any stage, the set list starts again cleanly from the new beat: no attack is left booked for the old beats, fresh waves follow with their full wind-up, and what that stage adds (lasers after the warm-up, disco ball visits in set 2) comes back.',
  setup() {},
  play() {
    const B = encoreFight({ guard: true, hurt: false }), results = {};
    let beat = 300;
    stub(B, 'song', { beat: () => beat, quiet: () => false, drop: () => false });
    for (const [stage, f] of [['warmup', 1], ['set1', 1], ['set2', 0.7], ['set3', 0.4], ['last', 0.2]]) {
      B.opening = stage === 'warmup'; B.guardT = B.opening ? 99 : 0; B.hp = B.maxHp * f;
      if (f < 0.5) B.broken = true;                                // (as if it had shorted out already)
      beat = 300; step(60 * 2, () => { beat += 128 / 3600; });
      const n = counting(B);
      beat = 20; step(1);
      const cleared = B.floor.casts.every((c) => c.at >= 20) && B.lasers.casts.every((c) => c.at >= 20) && (B.disco.visitAt ?? 20) >= 20 && B.set?.from >= 20;
      step(60 * 20, () => { beat += 128 / 3600; });
      const warm = stage === 'warmup';
      results[stage] = { ok: cleared && B.stage === stage && n.floor >= 4 && (warm ? n.laser === 0 : n.laser >= 4) && (stage !== 'set2' || B.disco.visitAt >= 20), cleared, floor: n.floor, laser: n.laser, visit: B.disco.visitAt };
    }
    return ok(Object.values(results).every((r) => r.ok), results);
  },
});


// ---- the DJ rig (encore-model.js): parts, moves on the beat
const rigBeat = (fps) => TRACKS.encore.bpm / 60 / fps;
// each move's pose space: how far along its swing (wind-up to accent) the pose is now
const along = (m, now) => { let p = 0; for (let i = 0; i < now.length; i++) p += now[i] * ((m.A[i] || 0) - (m.W[i] || 0)); return p; };
function moveDefs() {
  const n = (k) => LOOK.list('encore-dance-' + k, []).map(Number);
  return Object.fromEntries(MOVES.map((m) => { const t = n(m); return [m, { lead: t[0], strike: t[1], sustain: t[2], release: t[3], W: n(m + '-wind'), A: n(m + '-hit') }]; }));
}

story('encore/dj-rig-rest-pose-and-draws-unchanged', {
  about: 'Split into torso, two arms, two legs and helmet, the DJs at rest stand exactly as before (main v545, encore-rig-rest.json): each performer, helmet, glove and outer arm within 1 mm, drawn with the same number of meshes and materials (the legs, hidden in the booth, draw nothing).',
  setup() {},
  async play() {
    const was = await (await fetch('src/stories/encore-rig-rest.json')).json(), boss = buildEncoreBoss();
    try {
      boss.root.updateMatrixWorld(true);
      const w = (o) => o.getWorldPosition(V(0, 0, 0)).toArray();
      const djs = ['Silver performer', 'Gold performer'].map((n) => { const b = new THREE.Box3().setFromObject(boss.root.getObjectByName(n), true); return [...b.min.toArray(), ...b.max.toArray()]; });
      const now = { djs, heads: boss.heads.map(w), hands: boss.hands.map(w), arms: boss.arms.map(w) };
      let worst = 0;
      for (const k of Object.keys(now)) now[k].forEach((v, i) => v.forEach((x, j) => { worst = Math.max(worst, Math.abs(x - was[k][i][j])); }));
      let meshes = 0; const mats = new Set();
      boss.root.traverseVisible((o) => { if (o.isMesh) { meshes++; mats.add(o.material); } });
      const parts = ['silver', 'gold'].every((who) => { const r = boss.rigs[who]; return r.torso && r.head && r.outer && r.inner && r.outer !== r.inner && r.outerLeg && r.innerLeg && !r.outerLeg.visible && !r.innerLeg.visible; });
      return ok(worst < 0.001 && meshes === was.meshes && mats.size === was.materials && parts, { worst, meshes, materials: mats.size, was: [was.meshes, was.materials], parts });
    } finally { boss.dispose(); }
  },
});

story('encore/dj-rig-every-move-lands-its-accent-on-its-beat', {
  about: 'Each DJ move (four wave gestures, record throw, fader crank, hands up, fist pump, flinch, bow; off the booth: vault, land, slam, conduct, push) asked for on beat 8 (asked again every frame, too) swings furthest at beat 8, within a frame, at 30 and at 60 fps, for each DJ; it moves his torso, helmet or arms on the way, and he is back at rest when it ends.',
  setup() {},
  play() {
    const defs = moveDefs(), out = {};
    for (const fps of [30, 60]) for (const who of ['silver', 'gold']) for (const move of MOVES) {
      const boss = buildEncoreBoss(), r = boss.rigs[who], m = defs[move], db = rigBeat(fps);
      try {
        boss.perform(who, move, 8);
        let best = -Infinity, bestAt = null, moved = 0;
        const end = 8 + m.sustain + m.release;
        for (let b = 8 - m.lead - 1; b <= end + 1; b += db) {
          boss.perform(who, move, 8);   // asked every frame: it plays on
          boss.update(1 / fps, false, b);
          const p = along(m, r.now);
          if (p > best) { best = p; bestAt = b; }
          moved = Math.max(moved, Math.abs(r.torso.rotation.x), Math.abs(r.outer.rotation.x), Math.abs(r.inner.rotation.x), Math.abs(r.outer.rotation.y), Math.abs(r.head.rotation.x), Math.abs(r.outerLeg.rotation.x));
        }
        boss.update(1 / fps, true, end + 2);
        const back = Array.from(r.now).every((v) => Math.abs(v) < 1e-6) && r.torso.rotation.x === 0 && r.outer.rotation.x === 0 && r.inner.rotation.x === 0 && r.outerLeg.rotation.x === 0 && r.innerLeg.rotation.x === 0;
        out[`${who}-${move}@${fps}`] = { ok: Math.abs(bestAt - 8) <= db + 1e-9 && moved > 0.1 && back, at: +bestAt.toFixed(3), moved: +moved.toFixed(2), back };
      } finally { boss.dispose(); }
    }
    const bad = Object.fromEntries(Object.entries(out).filter(([, v]) => !v.ok));
    return ok(Object.keys(out).length === MOVES.length * 4 && !Object.keys(bad).length, { bad, n: Object.keys(out).length });
  },
});

story('encore/dj-rig-reduce-effects-keeps-poses-drops-bounce', {
  about: 'With reduced effects each move still reaches its full accent pose on its beat, but nothing overshoots or bounces: after the accent it only eases back towards rest, never past it. With effects on, a swing does run past its accent and bounce back.',
  setup() {},
  play() {
    const defs = moveDefs(), db = rigBeat(60), out = {};
    let bounces = false;
    for (const move of MOVES) {
      const m = defs[move], full = along(m, m.A);
      for (const quiet of [true, false]) {
        const boss = buildEncoreBoss(), r = boss.rigs.silver;
        try {
          boss.perform('silver', move, 8);
          let peak = 0, last = Infinity, eased = true, past = false;
          for (let b = 6.9 - m.lead; b <= 8 + m.sustain + m.release + 1; b += db) {
            boss.update(1 / 60, quiet, b);
            const p = along(m, r.now);
            if (b >= 8 - db / 2 && b < 8 + db / 2) peak = p;
            if (b > 8 + db) { eased &&= p <= last + 1e-6; past ||= p < -1e-4; last = p; }
          }
          if (quiet) out[move] = { ok: Math.abs(peak - full) < 1e-3 * Math.max(1, full) && eased && !past, peak: +peak.toFixed(3), full: +full.toFixed(3), eased, past };
          else bounces ||= peak > full + 1e-3 && !eased;
        } finally { boss.dispose(); }
      }
    }
    const bad = Object.fromEntries(Object.entries(out).filter(([, v]) => !v.ok));
    return ok(!Object.keys(bad).length && bounces, { bad, bounces });
  },
});

story('encore/dj-rig-a-move-takes-over-from-the-arm-pump-and-gives-it-back', {
  about: 'A DJ pumping his arm to his wave who is asked for a fist pump blends into it within a quarter beat, with no jump in his arm while it takes over, and goes back to pumping after it; a move asked for mid-move blends from where he was.',
  setup() {},
  play() {
    const boss = buildEncoreBoss(), r = boss.rigs.gold, db = rigBeat(60);
    try {
      let jump = 0, prev = null, during = null, after = null;
      for (let b = 0; b <= 12; b += db) {
        boss.dance('gold', b);
        if (Math.abs(b - 4) < db / 2) boss.perform('gold', 'fist-pump', 5);
        if (Math.abs(b - 5.4) < db / 2) boss.perform('gold', 'flinch', 5.7);
        boss.update(1 / 60, true, b);
        const x = r.outer.rotation.x;
        if (prev !== null && ((b > 4.4 && b < 4.75) || (b > 5.4 && b < 5.55))) jump = Math.max(jump, Math.abs(x - prev));
        prev = x;
        if (Math.abs(b - 5) < db / 2) during = x;
        if (Math.abs(b - 11) < db / 2) after = { x, w: r.w };
      }
      const pumping = after.w === 0 && after.x < -1.2;
      return ok(jump < 0.25 && during < -2 && pumping, { jump: +jump.toFixed(3), during, after });
    } finally { boss.dispose(); }
  },
});

story('encore/dj-rig-a-song-rewind-drops-a-move', {
  about: 'If the song rewinds while a DJ is mid-move, the move is dropped: he eases back to rest instead of freezing, and does not play the old gesture when the beat comes round again.',
  setup() {},
  play() {
    const boss = buildEncoreBoss(), r = boss.rigs.silver, db = rigBeat(60);
    try {
      boss.perform('silver', 'hands-up', 20);
      for (let b = 18; b < 19.8; b += db) boss.update(1 / 60, true, b);
      const mid = r.outer.rotation.x;
      for (let b = 0; b < 2; b += db) boss.update(1 / 60, true, b);
      const eased = Math.abs(r.outer.rotation.x) < 1e-3;
      let replayed = 0;
      for (let b = 2; b < 23; b += db) { boss.update(1 / 60, true, b); replayed = Math.max(replayed, Math.abs(r.outer.rotation.x)); }
      return ok(mid < -0.3 && eased && replayed < 1e-3 && !r.move, { mid, eased, replayed });
    } finally { boss.dispose(); }
  },
});

// ---- the DJ rig off the booth (B1): legs, travel(), face(), the other arm
// a booth on its riser in a stand-in arena (travel moves a DJ into the booth's parent)
function rigStage() {
  const arena = new THREE.Group(), boss = buildEncoreBoss();
  boss.root.position.set(0, 0.07, -0.43); arena.add(boss.root); arena.updateMatrixWorld(true);
  return { arena, boss, done() { boss.dispose(); } };
}
const worldAt = (o) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(V(0, 0, 0)); };
const MARK = [-0.3, 0, 0.1];

for (const fps of [30, 60]) story(`encore/dj-rig-a-vault-lands-on-its-beat-at-${fps}fps`, {
  about: `At ${fps} fps, a DJ asked to travel to a mark from beat 10 to beat 12 stays in the booth till beat 10, rises well over the decks between (highest half way, by the vault height), and stands on the mark at beat 12 within a frame, his legs shown only once he is off the booth; asked again every frame it is the same trip. Then a trip home on beats 20 to 22 puts him back in the booth at rest (within 1 mm), legs hidden again.`,
  setup() {},
  play() {
    const T = rigStage(), M = T.boss, r = M.rigs.silver, db = rigBeat(fps), out = {};
    try {
      const home = worldAt(r.body), h = LOOK.num('encore-vault-height', 0.26);
      let waited = true, peak = -1, peakAt = null, landedAt = null, legsInBooth = false;
      for (let b = 8; b <= 13; b += db) {
        M.travel('silver', MARK, 10, 12);   // asked every frame
        M.update(1 / fps, true, b);
        const p = worldAt(r.body);
        if (b < 10) { waited &&= p.distanceTo(home) < 1e-6 && !M.out('silver'); legsInBooth ||= r.outerLeg.visible; }
        if (b >= 10 && b < 12) { const line = home.y + (MARK[1] - home.y) * (b - 10) / 2; if (p.y - line > peak) { peak = p.y - line; peakAt = b; } }
        if (landedAt === null && p.distanceTo(V(...MARK)) < 1e-6) landedAt = b;
      }
      out.out = { waited, legsInBooth, peak: +peak.toFixed(3), peakAt: +peakAt.toFixed(2), landedAt: +landedAt?.toFixed(3), legs: r.outerLeg.visible && r.innerLeg.visible };
      const outOk = waited && !legsInBooth && Math.abs(peak - h) < 0.01 && Math.abs(peakAt - 11) <= db && Math.abs(landedAt - 12) <= db + 1e-9 && out.out.legs && M.out('silver');
      for (let b = 13; b <= 23; b += db) { M.travel('silver', 'home', 20, 22); M.update(1 / fps, true, b); }
      const back = worldAt(r.body).distanceTo(home), homeOk = back < 0.001 && !M.out('silver') && !r.outerLeg.visible && r.body.parent === M.root && Math.abs(r.body.rotation.y - r.restYaw) < 1e-9;
      out.home = { back, legs: r.outerLeg.visible, parent: r.body.parent === M.root };
      return ok(outOk && homeOk, out);
    } finally { T.done(); }
  },
});

story('encore/dj-rig-the-booth-pump-does-not-move-a-dj-on-the-floor', {
  about: 'While the booth pumps on the beat, squashes when hit and shudders (its group scaled, moved and tipped, as encore.js does), a DJ standing on the floor does not move at all, while the DJ still in the booth rides it as he always has.',
  setup() {},
  play() {
    const T = rigStage(), M = T.boss, db = rigBeat(60), home = M.root.position.clone();
    try {
      for (let b = 0; b <= 3; b += db) { M.travel('gold', [0.36, 0, -0.06], 0.5, 2.5); M.update(1 / 60, true, b); }
      const stand = worldAt(M.rigs.gold.body), still = worldAt(M.rigs.silver.body);
      let floor = 0, booth = 0;
      for (let k = 0; k < 60; k++) {
        const kick = Math.exp(-(k % 30) / 5);
        M.root.position.copy(home).add(V(Math.sin(k * 2.3) * 0.005, -0.012 * kick, 0)); M.root.rotation.z = 0.04 * kick;
        M.root.scale.set(1 + kick * 0.008, 1 - kick * 0.03, 1 + kick * 0.008);
        M.update(1 / 60, true, 3 + k * db);
        floor = Math.max(floor, worldAt(M.rigs.gold.body).distanceTo(stand));
        booth = Math.max(booth, worldAt(M.rigs.silver.body).distanceTo(still));
      }
      return ok(floor < 1e-9 && booth > 0.002 && M.out('gold') && !M.out('silver'), { floor, booth: +booth.toFixed(4) });
    } finally { T.done(); }
  },
});

story('encore/dj-rig-a-clock-hop-home-and-a-knock-back', {
  about: 'On the clock (no beat needed: the short-out\'s knock-back, a rewind\'s hop home), a DJ on the floor asked to travel home in 0.4 s is back in the booth at rest in 0.4 s (within a frame) and not before; a beat trip asked while he is home already changes nothing.',
  setup() {},
  play() {
    const T = rigStage(), M = T.boss, r = M.rigs.silver, db = rigBeat(60);
    try {
      const home = worldAt(r.body);
      for (let b = 0; b <= 3; b += db) { M.travel('silver', MARK, 0.5, 2.5); M.update(1 / 60, true, b); }
      M.travel('silver', 'home', { secs: 0.4 });
      let t = 0, at = null;
      for (let k = 0; k < 40; k++) { M.update(1 / 60, true, null); t += 1 / 60; if (!M.out('silver')) at ??= t; }
      const back = worldAt(r.body).distanceTo(home), again = M.travel('silver', 'home', 30, 32);
      M.update(1 / 60, true, 31); const stays = !M.out('silver') && worldAt(r.body).distanceTo(home) < 1e-6;
      return ok(at !== null && Math.abs(at - 0.4) <= 1 / 60 + 1e-9 && back < 0.001 && again && stays, { at, back, stays });
    } finally { T.done(); }
  },
});

story('encore/dj-rig-a-trip-asked-every-frame-or-rewound-plays-once', {
  about: 'A trip asked for every frame plays once: after landing on the mark he stays put (no new trip each frame), a clock hop home asked every frame still gets him home in its time, a trip home asked before a trip out has begun calls it off, and a song rewind past his take-off mid-flight puts him back in the booth at rest instead of freezing him in the air.',
  setup() {},
  play() {
    const T = rigStage(), M = T.boss, r = M.rigs.silver, db = rigBeat(60);
    try {
      const home = worldAt(r.body);
      for (let b = 0; b <= 3; b += db) { M.travel('silver', MARK, 0.5, 2.5); M.update(1 / 60, true, b); }
      const trip = r.trip; M.travel('silver', MARK, 0.5, 2.5); M.update(1 / 60, true, 3.1);
      const kept = r.trip === trip && worldAt(r.body).distanceTo(V(...MARK)) < 1e-6;
      let t = 0, at = null;
      for (let k = 0; k < 40; k++) { M.travel('silver', 'home', { secs: 0.4 }); M.update(1 / 60, true, null); t += 1 / 60; if (!M.out('silver')) at ??= t; }
      const hopped = at !== null && Math.abs(at - 0.4) <= 1 / 60 + 1e-9;
      M.travel('silver', MARK, 10, 12); M.travel('silver', 'home', 10, 12); M.update(1 / 60, true, 11);
      const calledOff = !M.out('silver') && !r.outerLeg.visible && !r.trip;
      for (let b = 20; b <= 21; b += db) { M.travel('silver', MARK, 20, 22); M.update(1 / 60, true, b); }
      const flying = M.out('silver');
      M.update(1 / 60, true, 4);
      const rewound = !M.out('silver') && worldAt(r.body).distanceTo(home) < 1e-6 && !r.outerLeg.visible && !r.trip;
      return ok(kept && hopped && calledOff && flying && rewound, { kept, at, calledOff, flying, rewound });
    } finally { T.done(); }
  },
});

story('encore/dj-rig-on-the-floor-he-faces-the-way-he-goes-then-the-jelly', {
  about: 'Off the booth a DJ turns to face the way he travels and, once landed, the point face() gives him (the jelly), never faster than --encore-turn-rate a second; face(null) holds his facing.',
  setup() {},
  play() {
    const T = rigStage(), M = T.boss, r = M.rigs.gold, db = rigBeat(60), rate = LOOK.num('encore-turn-rate', 6);
    try {
      let fastest = 0, prev = null, midway = null;
      const to = [0.36, 0, -0.06];
      M.face('gold', [0, 0.48]);
      for (let b = 0; b <= 8; b += db) {
        M.travel('gold', to, 0.5, 2.5); M.update(1 / 60, true, b);
        if (M.out('gold')) { if (prev !== null) fastest = Math.max(fastest, Math.abs(Math.atan2(Math.sin(r.body.rotation.y - prev), Math.cos(r.body.rotation.y - prev))) * 60); prev = r.body.rotation.y; }
        if (Math.abs(b - 1.4) < db / 2) midway = r.body.rotation.y;
      }
      const p = worldAt(r.body), want = Math.atan2(0 - p.x, 0.48 - p.z), start = r.rest.clone().add(M.root.position), going = Math.atan2(to[0] - start.x, to[2] - start.z);
      const faces = Math.abs(Math.atan2(Math.sin(r.body.rotation.y - want), Math.cos(r.body.rotation.y - want))) < 0.01;
      M.face('gold', null); const held = r.body.rotation.y; M.update(1 / 60, true, 9); const holds = r.body.rotation.y === held;
      return ok(faces && fastest <= rate + 1e-6 && Math.abs(midway - going) < 0.35 && holds, { faces, fastest: +fastest.toFixed(2), midway: +midway.toFixed(2), going: +going.toFixed(2), holds });
    } finally { T.done(); }
  },
});

story('encore/dj-rig-conduct-plays-with-either-arm', {
  about: 'A conduct asked for with his outer arm raises only that arm on its accent; asked for with his inner arm, the inner arm makes exactly the same gesture and the outer one stays down; the helmet and torso play the same either way.',
  setup() {},
  play() {
    const pose = (arm) => {
      const boss = buildEncoreBoss(), r = boss.rigs.gold;
      try {
        boss.perform('gold', 'conduct', 4, 1, undefined, null, arm);
        for (let b = 2; b <= 4 + 1e-9; b += rigBeat(60)) boss.update(1 / 60, true, b);
        boss.update(0, true, 4);
        return { outer: r.outer.rotation.toArray().slice(0, 3), inner: r.inner.rotation.toArray().slice(0, 3), torso: r.torso.rotation.x, head: r.head.rotation.x };
      } finally { boss.dispose(); }
    };
    const o = pose('outer'), i = pose('inner'), near = (a, b) => a.every((v, k) => Math.abs(v + 0 - b[k]) < 1e-6);
    // the inner arm's y and z turn the other way (each arm's own outwards), so compare x and the sizes
    const same = Math.abs(o.outer[0] - i.inner[0]) < 1e-6 && Math.abs(Math.abs(o.outer[1]) - Math.abs(i.inner[1])) < 1e-6 && Math.abs(Math.abs(o.outer[2]) - Math.abs(i.inner[2])) < 1e-6;
    const rest = Math.abs(o.inner[0]) < 1e-6 && Math.abs(i.outer[0]) < 1e-6;
    return ok(o.outer[0] < -1 && same && rest && o.torso === i.torso && o.head === i.head && !near(o.outer, i.outer), { o, i });
  },
});

fight('dj-rig-each-dj-vaults-to-a-point-and-back', {
  about: 'In the real fight (open it live to watch: each DJ in turn crouches, vaults over his decks onto the floor on the beat, lands, conducts, slams and pushes, then vaults home), every trip lands on its beat and each DJ is back in the booth at rest; the legs and moves build no new shader, and on the floor he does not ride the booth\'s beat pump.',
  setup() {},
  play() {
    const B = encoreFight({ hurt: false }), M = B.arenaView.boss, { APT, GAME } = G();
    GAME.compile();
    const programs = APT.renderer.info.programs.length, res = {};
    for (const [who, to] of [['silver', [-0.3, 0, 0.1]], ['gold', [0.36, 0, -0.06]]]) {
      B.floor.held[who] = true;
      const r = M.rigs[who], home = r.body.getWorldPosition(V(0, 0, 0)), b0 = Math.ceil(B.beat) + 2, T = b0 + 2, L = T + 2, back = L + 8;
      let landed = null, still = 0, spot = null, homeAt = null;
      step(60 * 12, () => {
        const b = B.beat;
        if (b < L - 0.3) { M.perform(who, 'vault', T, 1, 1.5); M.travel(who, to, T, L); }
        else if (b < L + 2) M.perform(who, 'land', L);
        else if (b < L + 3.5) M.perform(who, 'conduct', L + 3, 1, undefined, null, who === 'gold' ? 'inner' : 'outer');
        else if (b < L + 5) M.perform(who, 'slam', L + 5);
        else if (b < back - 0.3) M.perform(who, 'push', L + 6.5);
        else { M.perform(who, 'vault', back); M.travel(who, 'home', back, back + 2); }
        const p = r.body.getWorldPosition(V(0, 0, 0));
        if (landed === null && M.out(who) && b >= L) { landed = b; spot = p.clone(); }
        if (landed !== null && b > L + 0.1 && b < back) still = Math.max(still, p.distanceTo(spot));
        if (b >= back && !M.out(who) && homeAt === null) { homeAt = b; return true; }
      });
      step(30);
      const at = r.body.getWorldPosition(V(0, 0, 0)).distanceTo(home);
      B.floor.held[who] = false; M.perform(who, null);
      res[who] = { ok: landed !== null && Math.abs(landed - L) < 0.1 && spot.distanceTo(V(to[0], to[1], to[2]).applyMatrix4(B.arenaView.root.matrixWorld)) < 0.002 && still < 1e-6 && homeAt !== null && Math.abs(homeAt - (back + 2)) < 0.1 && at < 0.002, landed: landed && +(landed - L).toFixed(3), still, homeAt: homeAt && +(homeAt - back - 2).toFixed(3), at: +at.toFixed(4) };
    }
    G().batcher?.sync?.(); GAME.compile();
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(res.silver.ok && res.gold.ok && newShaders === 0, { ...res, newShaders });
  },
});

// ---- solos, bows and the Record toss (encore.js slot/solo, encore-records.js)
const fakeFx = () => ({ orb: () => new THREE.Object3D(), orbTick() {}, free() {}, impact() {}, splat() {}, ice: { shatter() {} } });
const HAND = () => V(-0.083, 0.45, -0.5);
function recordsRig() {
  const T = make(), hits = [], rec = new EncoreRecords(T.arena, fakeFx(), { onHit: (dmg, c) => hits.push({ dmg, beat: rec.beat, c }) });
  return { ...T, rec, hits, done() { rec.dispose(); T.done(); } };
}
const recordOpts = (target, o = {}) => ({ from: HAND, target, dmg: 4, height: 0.25, flight: 1, windup: 3, lock: 1, stand: 16, ...o });
// a real jelly on the arena floor at x, z
function realJelly(T, x, z) {
  const p = new Player(T.world, CONFIG.player); T.scene.add(p.mesh);
  p.spawn(V(x, 0.01, z)); p.snapToGround();
  const ctl = { move: { x: 0, y: 0 }, jump: false };
  const input = { moveAxes: () => ctl.move, consumeJump: () => { const j = ctl.jump; ctl.jump = false; return j; }, jumpHeld: true };
  return { p, ctl, step: (push) => { T.world.focus(p.position, DT); p.update(DT, input, 0, { push }); } };
}
// play the records from beat `from` to `to` with a jelly, each frame `each(b)` first
function playRecords(T, J, from, to, each) {
  for (let b = from; b <= to; b += DT * BPM / 60) {
    each?.(b);
    T.rec.update(b, J.p ?? J, DT);
    J.step?.({ x: T.rec.pushX / DT, z: T.rec.pushZ / DT });
  }
}

story('encore/a-record-lands-where-its-lane-locked-on-the-bar', {
  about: 'The silver DJ\'s record: its floor strip and the lane over it (25 cm tall) show from 3 beats before he throws, follow the jelly until a beat before, then lock; they fill together to the moment it lands, on the bar line (a beat after the throw), at the spot it locked on, and are gone as it lands. A spot inside the boss\'s reserved space is moved out to 6 cm clear of it.',
  setup() {},
  play() {
    const T = recordsRig();
    try {
      let on = [0.2, 0.1];
      T.rec.cast(8, recordOpts(() => on));
      const seen = [];
      let lockedAt = null, landedAt = null;
      for (let b = 2; b <= 9; b += DT * BPM / 60) {
        if (b < 6) on = [0.2 + (b - 2) * 0.05, 0.1];                     // the jelly walks until just before the throw, then on
        else on = [-0.3, 0.4];
        if (lockedAt === null && b >= 6) lockedAt = [...T.rec.casts[0].to];
        T.rec.update(b, null, DT);
        const c = T.rec.casts[0], w = T.rec.warnings[0];
        if (b > 4.2 && b < 7.9) seen.push({ b, band: w.band.visible && w.lane.visible, same: Math.abs(w.band.material.progress - w.lane.material.progress) < 1e-9, p: w.band.material.progress, h: w.lane.scale.y });
        if (landedAt === null && c.state === 'stand') landedAt = { b, to: [...c.to], warn: w.band.visible || w.lane.visible };
      }
      const before = (() => { const R = recordsRig(); try { R.rec.cast(8, recordOpts(() => [0, 0])); R.rec.update(3.9, null); return R.rec.warnings[0].band.visible; } finally { R.done(); } })();
      const shown = seen.every((s) => s.band && s.same && Math.abs(s.h - 0.25) < 1e-9) && seen.every((s, k) => !k || s.p >= seen[k - 1].p);
      const locked = Math.hypot(landedAt.to[0] - lockedAt[0], landedAt.to[1] - lockedAt[1]) < 1e-6 && Math.abs(lockedAt[0] - 0.4) < 0.01;
      const onBar = landedAt.b >= 8 && landedAt.b < 8 + BPM / 60 * DT + 1e-9 && !landedAt.warn;
      const out = landing(0, -0.3, 0.055, 0.06), clear = out[1] >= BOSS.center[2] + BOSS.depth / 2 + 0.06 + 0.055 - 1e-9;
      const side = landing(0.3, -0.5, 0.055, 0.06), clearSide = Math.abs(side[0]) >= BOSS.width / 2 + 0.06 + 0.055 - 1e-9 || side[1] >= BOSS.center[2] + BOSS.depth / 2 + 0.06;
      return ok(!before && shown && locked && onBar && clear && clearSide, { before, shown, lockedAt, landedAt, out, side });
    } finally { T.done(); }
  },
});

// a jelly standing where the record is aimed; `act(J, b)` each frame (jump or step)
function standUnderRecord(act) {
  const T = recordsRig();
  try {
    const J = realJelly(T, 0.1, 0.25);
    T.rec.cast(8, recordOpts(() => [J.p.position.x, J.p.position.z]));
    let maxY = 0;
    playRecords(T, J, 3, 9.5, (b) => { act?.(J, b); maxY = Math.max(maxY, J.p.position.y); });
    J.ctl.move = { x: 0, y: 0 };
    return { hits: T.hits.map((h) => +h.beat.toFixed(2)), maxY: +maxY.toFixed(3) };
  } finally { T.done(); }
}
story('encore/a-jump-does-not-dodge-a-record-a-step-does', {
  about: 'A record hits a jelly standing where its lane locked as it lands, on the bar, for 4 Health. A full jump timed to be at its top as it lands still gets hit (the lane is 25 cm tall, a jump about 20); stepping off the lane after it locks dodges it.',
  setup() {},
  play() {
    const stand = standUnderRecord();
    const jump = standUnderRecord((J, b) => { if (b >= 6.6 && b < 6.6 + 0.04) J.ctl.jump = true; });
    const step = standUnderRecord((J, b) => { J.ctl.move = b >= 6.2 && b < 7.2 ? { x: 1, y: 0 } : { x: 0, y: 0 }; });
    const onBar = stand.hits.length === 1 && stand.hits[0] >= 7.9 && stand.hits[0] <= 8.05;
    return ok(onBar && jump.hits.length === 1 && jump.maxY > 0.12 && step.hits.length === 0, { stand, jump, step });
  },
});

story('encore/a-standing-record-blocks-the-jelly-and-never-hurts', {
  about: 'A landed record stands on edge for 4 bars: a jelly walking into it is stopped against it (pushed out, never through: no collider is added) and takes no hit from it; then it shatters and the way is open.',
  setup() {},
  play() {
    const T = recordsRig();
    try {
      const J = realJelly(T, 0, 0.45);
      T.rec.cast(8, recordOpts(() => [0, 0.2], { from: () => V(0, 0.45, -0.5) }));
      const c = T.rec.casts[0];
      playRecords(T, J, 3, 9);                                          // it lands at 0, 0.2, faced straight back at the stage
      const stood = c.state === 'stand';
      J.ctl.move = { x: 0, y: 1 };                                      // walk at it, up the floor towards the stage
      let nearest = Infinity;
      playRecords(T, J, 9, 16, () => { nearest = Math.min(nearest, Math.abs(J.p.position.z - 0.2)); });
      const stopped = J.p.position.z > 0.2 && nearest > CONFIG.player.radius * 0.8;
      J.ctl.move = { x: 0, y: 0 };
      playRecords(T, J, 16, 8 + 16 + 0.2);                              // its 4 bars are up: it shatters
      const gone = !T.rec.casts.length;
      J.ctl.move = { x: 0, y: 1 };
      playRecords(T, J, 24.2, 30);
      const through = J.p.position.z < 0.15;
      return ok(stood && stopped && T.hits.length === 0 && gone && through, { stood, stopped, nearest, hits: T.hits.length, gone, through, z: J.p.position.z });
    } finally { T.done(); }
  },
});

story('encore/a-record-held-against-a-jelly-that-cannot-move-stays-a-small-push', {
  about: 'A jelly that a standing record pushes but that doesn\'t move (held by the arena\'s side, a teleport, a long frame) gets the same small push frame after frame: it never feeds on itself into a fling or a stalled collision.',
  setup() {},
  play() {
    const T = recordsRig();
    try {
      T.rec.cast(8, recordOpts(() => [0, 0.2], { from: () => V(0, 0.45, -0.5) }));
      const J = standing(0, 0.23);
      playRecords(T, standing(0.5, 0.5), 3, 9);
      let most = 0;
      playRecords(T, J, 9, 15, () => { most = Math.max(most, Math.hypot(T.rec.pushX, T.rec.pushZ)); });
      return ok(T.rec.casts[0]?.state === 'stand' && most > 0 && most < 0.1, { most: +most.toFixed(4) });
    } finally { T.done(); }
  },
});

story('encore/a-solo-rests-the-lasers-and-the-other-dj-plays-every-16-beats', {
  about: 'In the 4 bars of a solo the set list casts no lasers, and only the other DJ plays a wave, one a bar into it (every 16 beats, half as often as before); before and after it the set plays as usual.',
  setup() {},
  play() {
    const f = recorder(), shots = [], solo = { who: 'silver', at: 72, end: 88 };
    const set = new SetList(f, 8, { random: lcg(5), lasers: { cast: (at) => shots.push(at) }, soloing: (at) => (at >= solo.at && at < solo.end ? solo : null) });
    for (let b = -6; b <= 120; b += 0.25) set.update(b);
    const inSolo = f.casts.filter((c) => c.at >= 72 && c.at < 88);
    const waves = inSolo.map((c) => `${c.at}:${c.dj}`).join() === '76:gold';
    const rest = !shots.some((at) => at >= 72 && at < 88) && shots.includes(68) && shots.includes(88);
    return ok(waves && rest, { waves: inSolo.map((c) => `${c.at}:${c.dj}`), shots: shots.filter((at) => at > 60 && at < 96) });
  },
});

// the real fight on a song we play by hand: `beat` moves on at the track's tempo each frame
function soloFight() {
  const B = encoreFight({ hurt: false }), song = { beat: 0, quiet: () => false };
  stub(B, 'song', { beat: () => song.beat, quiet: (b) => song.quiet(b), drop: () => false });
  // no waves or lasers, and no solo but the ones a story books (slot)
  const slot = B.slot.bind(B);
  stub(B.floor, 'cast', () => null); stub(B.lasers, 'cast', () => null); stub(B, 'slot', () => {});
  const go = (to, each) => step(60 * 60, () => { song.beat += BPM / 60 * DT; each?.(); return song.beat >= to; });
  return { B, song, go, slot };
}
fight('solo-and-its-bow-exposed-2-bars-after-a-hit-4-after-a-clean-solo', {
  about: 'A solo starts on its bar and lasts 4 bars, the spotlight on the soloing DJ and four records thrown, each flung on the beat before a bar line (his wind-up leading to it) and landing on the bar line. Then he bows: the boss bar reads EXPOSED and hits do 1.5x, for 2 bars if a hit reached the jelly during his solo, 4 if none did; before and after, hits do 1x.',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), { hud } = G();
    stub(B, 'hurtPlayer', () => {});                                   // (no record may hurt: this is about the bow)
    const run1 = (at, hurt) => {
      go(at - 6); slot('silver', at);
      const lands = B.records.casts.map((c) => c.land).join(), rig = B.arenaView.boss.rigs.silver;
      go(at - 2.5); const throwing = rig.move != null && rig.at === at - 1;   // winding up to throw on the beat before the bar
      go(at + 2); const lit = B.spots.silver.visible && B.spots.silver.material.opacity > 0 && !B.spots.gold.visible && !!B.soloing(at + 2);
      if (hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'boss' });
      const hp = () => B.hp, hit = () => { const was = hp(); B.damage(100); return Math.round(was - hp()); };
      go(at + 15.9); const inSolo = hit();
      go(at + 16.1); const bowed = hit(), bar = /EXPOSED/.test(hud.$('.boss .nm').textContent) && hud.$('.boss').classList.contains('exposed'), bowing = B.arenaView.boss.rigs.silver.move != null;
      const len = (hurt ? 2 : 4) * 4;
      go(at + 16 + len - 0.2); const late = hit();
      go(at + 16 + len + 0.2); const after = hit(), barAfter = !/EXPOSED/.test(hud.$('.boss .nm').textContent);
      return { lands, throwing, lit, inSolo, bowed, bar, bowing, late, after, barAfter, solo: B.solo, spot: B.spots.silver.visible };
    };
    const hurt = run1(40, true), clean = run1(80, false);
    const good = (r, at) => r.lands === `${at},${at + 4},${at + 8},${at + 12}` && r.throwing && r.lit && r.inSolo === 100 && r.bowed === 150 && r.bar && r.bowing && r.late === 150 && r.after === 100 && r.barAfter && !r.solo && !r.spot;
    return ok(good(hurt, 40) && good(clean, 80), { hurt, clean });
  },
});

fight('the-breakdown-bows-both-djs-exposed', {
  about: 'Through the song\'s breakdown both DJs bow and the Encore is exposed (hits do 1.5x); after it they stand back up and hits do 1x.',
  setup() {},
  play() {
    const { B, song, go } = soloFight();
    song.quiet = (b) => b >= 20 && b < 40;
    go(22);
    const M = B.arenaView.boss, both = M.rigs.silver.move != null && M.rigs.gold.move != null, exposed = B.exposed;
    let was = B.hp; B.damage(100); const inRest = Math.round(was - B.hp);
    go(44); was = B.hp; B.damage(100); const after = Math.round(was - B.hp);
    return ok(both && exposed && inRest === 150 && after === 100 && !B.exposed, { both, exposed, inRest, after });
  },
});

fight('the-short-out-or-defeat-mid-solo-clears-the-djs-acts', {
  about: 'If the Encore shorts out, or is beaten, in the middle of a solo, everything of it goes at once: no record flying or standing, no Warning, no spotlight, the solo and every DJ move dropped.',
  setup() {},
  play() {
    const out = {};
    for (const how of ['short-out', 'defeat']) {
      const { B, go, slot } = soloFight();
      go(34); slot('silver', 40); go(45.2);                            // a record standing, the next one wound up
      const busy = B.records.casts.some((c) => c.state === 'stand') && B.records.casts.some((c) => c.warn) && B.spots.silver.visible;
      if (how === 'short-out') B.damage(B.hp - B.maxHp * 0.45); else { B.broken = true; B.damage(B.hp + 1); }
      const M = B.arenaView.boss, W = B.records.warnings;
      out[how] = { busy, cleared: !B.records.casts.length && W.every((w) => !w.band.visible && !w.lane.visible) && !B.solo && !B.spots.silver.visible && !M.rigs.silver.move && !M.rigs.gold.move };
    }
    return ok(Object.values(out).every((r) => r.busy && r.cleared), out);
  },
});

// ---- the DJs call the waves (encore-floor.js gesture, react)
const GESTURES = { ring: 'circle', arc: 'circle', sweep: 'sweep', arrow: 'point', gate: 'point', closing: 'clap', pincer: 'clap' };
// cast `name` for `dj` on beat 20 and play from beat 12 to 24 with the boss model on; `each(b, T)` runs every frame
function conduct(name, dj, opts, each) {
  const T = make(), B = T.arena.boss, calls = [], real = B.perform.bind(B);
  B.perform = (...a) => { calls.push({ a, beat: T.floor.beat }); return real(...a); };
  try {
    T.floor.cast(name, 20, { dj, ...opts });
    play(T.floor, standing(0, 0.6), 12, 24, (b) => { each?.(b, T); B.update(DT, true, b); });
    return { calls: calls.filter((c) => c.a[1]), all: calls, rig: B.rigs[dj] };
  } finally { T.done(); }
}
story('encore/waves-are-called-by-their-dj-four-beats-ahead', {
  about: 'Each of the 7 wave shapes, for either DJ, starts its gesture (rings and arcs circle, sweeps swing, arrows and gates point, closings and pincers clap) 4 beats before the wave\'s first step, and nothing before; a sweep swings the way the line does for either DJ; two waves at once give each DJ his own.',
  setup() {},
  play() {
    const out = {}, frame = DT * BPM / 60;
    for (const dj of ['silver', 'gold']) for (const name of Object.keys(PATTERNS)) {
      const r = conduct(name, dj, name === 'sweep' ? { spin: -1 } : {}), first = r.calls[0];
      out[`${dj}-${name}`] = first && first.a[0] === dj && first.a[1] === GESTURES[name] && first.a[2] === 20 && first.beat >= 16 - 1e-9 && first.beat < 16 + frame + 1e-9;
    }
    // a sweep's mirror: spin 1 and -1 come out opposite, and the two DJs' swings run opposite for the same spin
    const dirOf = (dj, spin) => conduct('sweep', dj, { spin }).calls[0].a[3];
    const sweeps = dirOf('silver', 1) === 1 && dirOf('silver', -1) === -1 && dirOf('gold', 1) === -1 && dirOf('gold', -1) === 1;
    // two at once: each DJ has his own
    const T = make(), B = T.arena.boss, who = [], real = B.perform.bind(B);
    B.perform = (w, m, ...a) => { if (m) who.push(w + ':' + m); return real(w, m, ...a); };
    try {
      T.floor.cast('ring', 20, { dj: 'silver' }); T.floor.cast('closing', 20, { dj: 'gold' });
      play(T.floor, standing(0, 0.6), 14, 20, (b) => B.update(DT, true, b));
    } finally { T.done(); }
    const both = who.includes('silver:circle') && who.includes('gold:clap') && !who.includes('silver:clap') && !who.includes('gold:circle');
    return ok(Object.values(out).every(Boolean) && sweeps && both, { out, sweeps, both });
  },
});

story('encore/an-arcs-dj-faces-its-gap', {
  about: 'While he calls an arc, the DJ turns his helmet to face the gap (within 0.15 radians, either DJ, a gap left, ahead or right), and it comes back to rest after; a ring leaves his helmet where it was.',
  setup() {},
  play() {
    const out = {}, yaw = (dj, r) => r.head.rotation.y + r.body.rotation.y;
    for (const dj of ['silver', 'gold']) for (const heading of [-0.7, 0, 0.7]) {
      let atAccent = null, rest = null;
      const r = conduct('arc', dj, { heading }, (b, T) => {
        const rig = T.arena.boss.rigs[dj];
        if (Math.abs(b - 20) < 0.02) atAccent = yaw(dj, rig);
        if (Math.abs(b - 12) < 0.02) rest = yaw(dj, rig);
      });
      const end = yaw(dj, r.rig);
      out[`${dj}@${heading}`] = { ok: Math.abs(atAccent - heading) < 0.15 && Math.abs(end - rest) < 0.15, atAccent: +atAccent.toFixed(2), end: +end.toFixed(2), rest: +rest.toFixed(2) };
    }
    const ring = conduct('ring', 'gold', {}, (b, T) => { if (Math.abs(b - 20) < 0.02) out.ringYaw = T.arena.boss.rigs.gold.head.rotation.y; });
    const unturned = Math.abs(out.ringYaw - 0.52 * -1) < 0.2;
    delete out.ringYaw;
    return ok(Object.values(out).every((v) => v.ok) && unturned, { out, unturned });
  },
});

fight('fight-the-djs-react-to-hits', {
  about: 'A wave\'s hit on the jelly sends a fist pump from the DJ whose wave it was, accent on the next beat, and not from the other; a hit on the booth makes the DJ nearer the jelly flinch, accent just after, at most once a beat; short-out and defeat clear both reactions.',
  setup() {},
  play() {
    const B = encoreFight({ hurt: false }), M = B.arenaView.boss, calls = [], real = M.perform.bind(M);
    let beat = 300;
    stub(B, 'song', { beat: () => beat, quiet: () => false, drop: () => false });
    stub(B.floor, 'cast', () => null); stub(B, 'slot', () => {});   // (no waves, no solo: not the breakdown either, where both DJs bow)
    M.perform = (w, m, at, ...a) => { calls.push([w, m, at]); return real(w, m, at, ...a); };
    const tick = () => { beat += 1 / 60 * TRACKS.encore.bpm / 60; };
    step(10, tick);
    B.hurtPlayer(4, null, 'gold');
    step(2, tick);
    const pump = calls.find((c) => c[0] === 'gold' && c[1] === 'fist-pump');
    const rightBeat = pump && pump[2] === Math.ceil(B.beat - 2 * 1 / 60 * TRACKS.encore.bpm / 60) && !calls.some((c) => c[0] === 'silver' && c[1] === 'fist-pump');
    step(60 * 3, tick);
    // booth hits: the jelly stands on silver's side, then on gold's; two hits in one beat flinch once
    calls.length = 0;
    const p = window.player.position, cx = B.center().x;
    p.x = cx - 0.3; B.damage(1); B.damage(1); step(1, tick);
    const silver = calls.filter((c) => c[1] === 'flinch').map((c) => c[0]);
    step(60 * 3, tick); calls.length = 0;
    p.x = cx + 0.3; B.damage(1); step(1, tick);
    const gold = calls.filter((c) => c[1] === 'flinch').map((c) => c[0]);
    B.floor.react('silver', 'fist-pump', beat + 1);
    B.floor.reset();
    const cleared = !B.floor.reacting.silver && !B.floor.reacting.gold;
    return ok(rightBeat && silver[0] === 'silver' && new Set(silver).size === 1 && gold[0] === 'gold' && cleared, { pump, rightBeat, silver, gold, cleared });
  },
});

fight('a-dj-in-his-solo-or-bow-keeps-his-pose-over-wave-gestures', {
  about: 'While the silver DJ solos (from his first wind-up) and bows, a wave of his own does not take him over with its gesture: he keeps winding up and throwing his records, then stays bowed, while the gold DJ plays his wave\'s gesture as usual; after the bow the waves move him again.',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), rigs = B.arenaView.boss.rigs, cast = (name, at, dj) => EncoreFloor.prototype.cast.call(B.floor, name, at, { dj });
    go(30); slot('silver', 40);
    cast('ring', 46, 'silver'); cast('pincer', 46, 'gold');
    go(45.5); const throwing = rigs.silver.at === 47 && !!rigs.silver.move, goldWave = rigs.gold.at === 46 && !!rigs.gold.move;
    cast('ring', 60, 'silver');
    go(58.5); const bowed = rigs.silver.at === 56 && !!rigs.silver.move;
    go(72); cast('ring', 78, 'silver'); go(76); const after = rigs.silver.at === 78;
    return ok(throwing && goldWave && bowed && after, { throwing, goldWave, bowed, after, silver: rigs.silver.at, gold: rigs.gold.at });
  },
});

// ---- the gold DJ's Pyro (encore-pyro.js)
const LIP = BOSS.center[2] + BOSS.depth / 2;
function pyroRig() {
  const T = make(), hits = [], pyro = new EncorePyro(T.arena, fakeFx(), { onHit: (dmg, c) => hits.push({ dmg, beat: pyro.beat, fire: c.fire }) });
  return { ...T, pyro, hits, done() { pyro.dispose(); T.done(); } };
}
// play the pyro from beat `from` to `to` with a jelly (stand-in or real), each frame `each(b)` first
function playPyro(T, J, from, to, each) {
  for (let b = from; b <= to; b += DT * BPM / 60) { each?.(b); T.pyro.update(b, J.p ?? J, DT); J.step?.(); }
}
const SETS = { odd: [0, 2, 4], even: [1, 3, 5] };

story('encore/pyro-sets-alternate-never-all-six-and-warn-two-beats', {
  about: 'The gold DJ\'s flame lanes (six, 24 cm wide across the floor) fire a set a beat, odd lanes then even lanes, each on its beat; each lane\'s floor strip and its 35 cm volume fill together over the 2 beats before it fires and are gone as it does. A set of all six, or a lane again within a beat of its last, is refused.',
  setup() {},
  play() {
    const T = pyroRig();
    try {
      const P = T.pyro;
      for (let k = 0; k < 4; k++) P.cast(10 + k, { lanes: SETS[k % 2 ? 'even' : 'odd'] });
      const refused = P.cast(20, { lanes: [0, 1, 2, 3, 4, 5] }) === null && P.cast(10.5, { lanes: [2] }) === null && P.cast(11.5, { lanes: [1, 2] }) === null && P.cast(10, { lanes: [1, 3, 5] }) === null && P.casts.length === 4;
      const fired = {}, warned = [];
      for (let b = 7; b <= 14.5; b += DT * BPM / 60) {
        P.update(b, null, DT);
        for (let l = 0; l < 6; l++) if (P.burnAt[l] !== null && !(l in fired)) fired[l] = [];
        for (let l = 0; l < 6; l++) if (P.burnAt[l] !== null && fired[l].at(-1) !== P.burnAt[l]) fired[l].push(P.burnAt[l]);
        const w = P.warnings[0];
        if (b >= 8.05 && b < 9.95) warned.push({ b, on: w.band.visible && w.lane.visible, same: Math.abs(w.band.material.progress - w.lane.material.progress) < 1e-9, p: w.band.material.progress, h: w.lane.scale.y, w: w.lane.scale.x, z: w.lane.scale.z });
      }
      const odd = [0, 2, 4].every((l) => fired[l].join() === '10,12'), even = [1, 3, 5].every((l) => fired[l].join() === '11,13');
      const shown = warned.every((x) => x.on && x.same && Math.abs(x.h - 0.35) < 1e-9 && Math.abs(x.w - 0.24) < 1e-9 && Math.abs(x.z - 0.48) < 1e-9) && warned.every((x, k) => !k || x.p >= warned[k - 1].p) && warned.at(-1).p > 0.9;
      const gone = !P.warnings.some((w) => w.band.visible || w.lane.visible);
      const wide = Math.abs(P.laneX(0) + 0.6) < 1e-9 && Math.abs(P.laneX(5) - 0.6) < 1e-9;
      return ok(refused && odd && even && shown && gone && wide && P.lanes === 6, { refused, fired, shown, gone, wide });
    } finally { T.done(); }
  },
});

story('encore/pyro-hits-its-lane-on-the-beat-and-a-lane-that-just-fired-is-safe', {
  about: 'A jelly standing in a lane (inside its 48 cm reach, below 35 cm) is hit once, for 4 Health, on the beat that lane fires; the next beat, as the other set fires, the lane it stood in is safe, and it is hit again two beats on. A jelly in the other set\'s lane is hit a beat later. Past 48 cm out, or standing above 35 cm, is safe.',
  setup() {},
  play() {
    const T = pyroRig();
    try {
      const run = (x, z, y = 0) => {
        T.hits.length = 0; T.pyro.reset();
        for (let k = 0; k < 4; k++) T.pyro.cast(10 + k, { lanes: SETS[k % 2 ? 'even' : 'odd'] });
        playPyro(T, standing(x, z, y), 7, 14.5);
        return T.hits.map((h) => `${h.fire}@${+h.beat.toFixed(2)}`);
      };
      const lane0 = run(T.pyro.laneX(0), LIP + 0.2), lane1 = run(T.pyro.laneX(1), LIP + 0.2);
      const onBeat = (r) => r.every((h) => { const [f, b] = h.split('@'); return +b >= +f && +b < +f + 0.05; });
      const far = run(T.pyro.laneX(0), LIP + 0.48 + 0.05), high = run(T.pyro.laneX(0), LIP + 0.2, 0.4);
      const edge = run(T.pyro.laneX(0) + 0.12 + 0.02, LIP + 0.2);        // just inside lane 1's side of the line, its body over lane 0's
      return ok(lane0.map((h) => h.split('@')[0]).join() === '10,12' && lane1.map((h) => h.split('@')[0]).join() === '11,13' && onBeat(lane0) && onBeat(lane1)
        && far.length === 0 && high.length === 0 && edge.map((h) => h.split('@')[0]).join() === '10,11,12,13', { lane0, lane1, far, high, edge });
    } finally { T.done(); }
  },
});

story('encore/a-jump-does-not-clear-the-flames-a-step-does', {
  about: 'A real jump timed to be at its top as a lane fires still gets hit (the flames are 35 cm tall, a jump about 20); stepping from a lane that fires into the neighbour that does not clears it.',
  setup() {},
  play() {
    const trial = (act) => {
      const T = pyroRig();
      try {
        const J = realJelly(T, T.pyro.laneX(0), LIP + 0.2);
        T.pyro.cast(8, { lanes: [0, 2, 4] });
        let maxY = 0;
        playPyro(T, J, 3, 9.5, (b) => { act?.(J, b); maxY = Math.max(maxY, J.p.position.y); });
        return { hits: T.hits.length, maxY: +maxY.toFixed(3) };
      } finally { T.done(); }
    };
    const stand = trial(), jump = trial((J, b) => { if (b >= 6.6 && b < 6.64) J.ctl.jump = true; });
    const step = trial((J, b) => { J.ctl.move = b >= 7 && b < 7.9 ? { x: 1, y: 0 } : { x: 0, y: 0 }; });
    return ok(stand.hits === 1 && jump.hits === 1 && jump.maxY > 0.12 && step.hits === 0, { stand, jump, step });
  },
});

fight('a-gold-solo-cranks-then-burns-lane-sets-on-the-beat', {
  about: 'A gold solo: the spotlight on the gold DJ, his fader crank in the first bar as the first Warning shows (two beats before the first set), then a set of lanes every beat for 3 bars (12 sets, odd then even), each a hit on the beat for 4 Health; no hit shows before it; then the bow and EXPOSED as for any solo. A short-out mid-solo clears the Warnings, flames and scorch.',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), P = B.pyro, hits = [], rigs = B.arenaView.boss.rigs;
    go(34); slot('gold', 40);
    const sets = P.casts.map((c) => `${c.fire}:${c.lanes.join('')}`);
    const plan = sets.length === 12 && sets[0] === '44:024' && sets[1] === '45:135' && sets[11] === '55:135';
    stub(B, 'hurtPlayer', (dmg) => hits.push({ dmg, beat: B.beat }));
    const p = window.player.position; p.set(P.laneX(0), 0, LIP + 0.2);
    go(40.9); const quiet = !P.warnings.some((w) => w.band.visible);
    go(42.6); const warn = [0, 2, 4].every((l) => P.warnings[l].band.visible && P.warnings[l].lane.visible) && ![1, 3, 5].some((l) => P.warnings[l].band.visible) && rigs.gold.at === 42 && B.spots.gold.visible && !B.spots.silver.visible;
    go(44.4); const burst = [0, 2, 4].every((l) => P.burnAt[l] === 44);
    go(47.5);
    const beats = hits.map((h) => h.beat);
    const onBeat = hits.length === 2 && beats.every((b, i) => b >= [44, 46][i] && b < [44, 46][i] + 0.05) && hits.every((h) => h.dmg === 4);
    go(56.5); const bowing = !!rigs.gold.move && B.solo && B.solo.bowing;
    go(60); stub(B, 'hurtPlayer', () => {}); go(73);
    const done = !B.solo && !P.casts.length;
    // a second solo, cut short by the short-out
    go(77); slot('gold', 80); go(86.2);
    const busy = P.warnings.some((w) => w.band.visible) && P.burnAt.some((t) => t !== null);
    B.damage(B.hp - B.maxHp * 0.45);
    const cleared = !P.casts.length && !P.warnings.some((w) => w.band.visible || w.lane.visible) && P.burnAt.every((t) => t === null) && !B.solo && !rigs.gold.move;
    return ok(plan && quiet && warn && burst && onBeat && bowing && done && busy && cleared, { sets, plan, quiet, warn, burst, beats, onBeat, bowing, done, busy, cleared });
  },
});

// ---- the duet: the Wall of sound (encore-wall.js), behind the silver DJ's records
const HALF = (N * S) / 2;
// three records facing the stage at x -0.3, 0 and 0.3 (z 0.1), landing on beats 8, 12, 16; the wall's
// Warning from 16, rolling from 24 for 2 beats
function wallRig({ records = true } = {}) {
  const T = recordsRig(), hits = [], wall = new EncoreWall(T.arena, fakeFx(), { onHit: (dmg) => hits.push({ dmg, beat: wall.beat }) });
  const casts = records ? [-0.3, 0, 0.3].map((x, k) => T.rec.cast(8 + k * 4, recordOpts(() => [x, 0.1], { from: () => V(x, 0.45, -0.5), stand: 99, face: 0 }))) : [];
  const w = wall.cast(16, 24, casts, { dmg: 6, height: 0.4, roll: 2, safe: 0.1, behind: 0.3, knock: 0.6 });
  return { ...T, wall, w, casts, wallHits: hits, done() { wall.dispose(); T.done(); } };
}
// play a wall rig from beat `from` to `to` with jelly J (a stand-in, or a real one), `each(b)` first each frame
function playWall(T, J, from, to, each) {
  for (let b = from; b <= to; b += DT * BPM / 60) { each?.(b); T.rec.update(b, J.p ?? J, DT); T.wall.update(b, J.p ?? J); J.step?.({ x: T.rec.pushX / DT, z: T.rec.pushZ / DT }); }
}
// where the front is as beat b: from the back of the stage at 24 to the back of the floor 2 beats later
const frontBeat = (z) => 24 + (z + HALF) / (2 * HALF) * 2;

story('encore/wall-spares-only-a-strip-behind-a-standing-record', {
  about: 'As the last record lands the whole floor fills as a Warning (a floor strip and the 40 cm slab over it, filling together for 2 bars) with a white strip 10 cm wide and 30 cm long behind each standing record. On the bar line the wall rolls from the stage to the back of the floor in 2 beats: a jelly in a strip is spared; anywhere else (in front of a record, just beside a strip, out on the floor, or jumping 35 cm up) it is hit once, for 6 Health, as the front reaches it.',
  setup() {},
  play() {
    const at = { strip: [0, 0.25, 0], front: [0, 0.02, 0], beside: [0.075, 0.2, 0], open: [0.15, 0.45, 0], jump: [0.15, 0.45, 0.35] }, out = {};
    let warn = null;
    for (const [k, [x, z, y]] of Object.entries(at)) {
      const T = wallRig();
      try {
        const J = standing(x, z, y), seen = [];
        playWall(T, J, 3, 27, (b) => {
          if (k === 'strip' && b > 16.2 && b < 23.9) seen.push({ band: T.wall.band.visible && T.wall.slab.visible, p: T.wall.band.material.progress, same: T.wall.band.material.progress === T.wall.slab.material.progress, safe: T.wall.safe.filter((m) => m.visible).length });
          if (k === 'strip' && Math.abs(b - 24.5) < 0.02) warn ??= { gone: !T.wall.band.visible && !T.wall.safe.some((m) => m.visible) };
        });
        if (k === 'strip') {
          const s = T.wall.safe[1];
          warn = { ...warn, shown: seen.every((f) => f.band && f.same && f.safe === 3) && seen.every((f, i) => !i || f.p >= seen[i - 1].p), height: T.wall.slab.scale.y, strip: [s.scale.x, s.scale.z, +s.position.x.toFixed(3), +s.position.z.toFixed(3)] };
        }
        out[k] = T.wallHits.map((h) => ({ dmg: h.dmg, beat: +h.beat.toFixed(2), want: +frontBeat(z).toFixed(2) }));
      } finally { T.done(); }
    }
    const once = (h) => h.length === 1 && h[0].dmg === 6 && Math.abs(h[0].beat - h[0].want) < 0.05;
    const good = out.strip.length === 0 && ['front', 'beside', 'open', 'jump'].every((k) => once(out[k]));
    const shown = warn.shown && warn.gone && Math.abs(warn.height - 0.4) < 1e-9 && Math.abs(warn.strip[0] - 0.1) < 1e-9 && Math.abs(warn.strip[1] - 0.3) < 1e-9 && warn.strip[2] === 0 && Math.abs(warn.strip[3] - 0.1) < 1e-3;
    return ok(good && shown, { out, warn });
  },
});

story('encore/wall-records-shatter-as-they-take-it', {
  about: 'Each record stands until the wall reaches it and shatters on that frame; while the front crosses its strip the wall shows a gap there (the columns behind the record are not drawn) and is whole again past the strip; after the roll no record and nothing of the wall is left.',
  setup() {},
  play() {
    const T = wallRig();
    try {
      const gone = [], gaps = [], frame = DT * BPM / 60, col = (x) => Math.round((x + HALF) / (2 * HALF / 36) - 0.5), m = new THREE.Matrix4(), sc = new THREE.Vector3();
      const drawn = (i) => { T.wall.mesh.getMatrixAt(i, m); sc.setFromMatrixScale(m); return sc.y > 0; };
      playWall(T, standing(0.6, 0.6), 3, 27, (b) => {
        T.casts.forEach((c, k) => { if (gone[k] == null && c.slot.cast !== c) gone[k] = b; });
        if (Math.abs(b - frontBeat(0.25)) < frame / 2) gaps.push({ behind: !drawn(col(0)), open: drawn(col(0.15)) });
        if (Math.abs(b - frontBeat(0.5)) < frame / 2) gaps.push({ past: drawn(col(0)) });
      });
      const want = frontBeat(0.1), onTime = gone.length === 3 && gone.every((b) => b >= want - 1e-9 && b < want + 2 * frame);
      const gap = gaps[0]?.behind && gaps[0]?.open && gaps[1]?.past;
      const after = !T.rec.casts.length && !T.wall.w && [...Array(72).keys()].every((i) => !drawn(i));
      return ok(onTime && gap && after, { gone: gone.map((b) => +b.toFixed(3)), want: +want.toFixed(3), gaps, after });
    } finally { T.done(); }
  },
});

story('encore/wall-with-no-standing-record-is-called-off', {
  about: 'If no record is standing as the Warning would start (none could be thrown, or they are gone), the wall is called off: no Warning, no wall, no hit.',
  setup() {},
  play() {
    const out = {};
    for (const how of ['none', 'gone']) {
      const T = wallRig({ records: how !== 'none' });
      try {
        const J = standing(0.15, 0.45);
        let shown = false;
        playWall(T, J, 3, 27, (b) => { if (how === 'gone' && b > 15 && b < 15.1) T.rec.reset(); shown ||= T.wall.band.visible || T.wall.slab.visible; });
        out[how] = { off: T.w.state === 'off', shown, hits: T.wallHits.length };
      } finally { T.done(); }
    }
    return ok(Object.values(out).every((r) => r.off && !r.shown && !r.hits), out);
  },
});

story('encore/the-duet-rests-the-floor-and-comes-only-below-half', {
  about: 'A duet slot rests the floor and the lasers from its first bar until a bar after the wall rolls (no wave from either DJ), then the set plays on; the set list books a duet only in set 3 and the last song (below half Health), never in set 1 or 2.',
  setup() {},
  play() {
    const f = recorder(), shots = [], solo = { who: 'duet', at: 72, end: 88, rest: 92 };
    const set = new SetList(f, 8, { random: lcg(7), lasers: { cast: (at) => shots.push(at) }, soloing: (at) => (at >= solo.at && at < solo.rest ? solo : null) });
    for (let b = -6; b <= 120; b += 0.25) set.update(b);
    const rests = !f.casts.some((c) => c.at >= 72 && c.at < 92) && !shots.some((at) => at >= 72 && at < 92) && f.casts.some((c) => c.at === 96) && f.casts.some((c) => c.at === 64);
    const kinds = (stage) => { const slots = [], L = new SetList(recorder(), 8, { random: lcg(7), stage: () => stage, slot: (kind) => slots.push(kind) }); for (let b = -6; b <= 900; b += 0.5) L.update(b); return slots; };
    const below = ['set1', 'set2'].every((st) => !kinds(st).includes('duet')) && ['set3', 'last'].every((st) => kinds(st).includes('duet'));
    return ok(rests && below, { rests, below, waves: f.casts.filter((c) => c.at > 60 && c.at < 100).map((c) => c.at) });
  },
});

fight('the-duet-throws-three-records-rolls-the-wall-and-both-djs-bow', {
  about: 'Below half Health a duet slot plays the Wall of sound: both DJs lit, the silver DJ throws three records that land a bar apart on the bar lines, at least 20 cm from each other even with the jelly standing still (and in a corner); all three stand as the Warning starts, both DJs throw their hands up and the disco ball rests; the wall rolls as the 4th bar ends and reaches a jelly out in the open; then both DJs bow and the Encore is EXPOSED for 2 bars (hits do 1.5x), and everything is gone after.',
  setup() {},
  play() {
    const out = {};
    for (const [k, spot] of [['middle', null], ['corner', [0.58, 0.5]]]) {
      const { B, go, slot } = soloFight(), M = B.arenaView.boss, p = G().player.position, hurt = [];
      B.hp = B.maxHp * 0.4; B.broken = true;
      stub(B, 'hurtPlayer', (dmg, color) => hurt.push({ dmg, beat: +B.beat.toFixed(2), wall: color === B.colors.duet }));
      if (spot) { p.x = spot[0]; p.z = spot[1]; }
      go(34); slot('duet', 40);
      const lands = B.records.casts.map((c) => c.land).join();
      go(41); const lit = B.spots.silver.visible && B.spots.gold.visible;
      go(48.1);
      const to = B.records.casts.map((c) => c.to), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const apart = [d(to[0], to[1]), d(to[0], to[2]), d(to[1], to[2])].map((x) => +x.toFixed(3));
      const standing = B.records.casts.length === 3 && B.records.casts.every((c) => c.state === 'stand') && B.solo?.wall?.shields.length === 3 && B.wall.band.visible;
      go(50); const hands = M.rigs.silver.move != null && M.rigs.gold.move != null && M.rigs.silver.at === 49 && M.rigs.gold.at === 49, disco = B.walling(50) && B.disco.quiet(50);
      const open = [[-0.62, 0.62], [0.62, 0.62], [-0.62, 0.1], [0.62, 0.1]].sort((u, v) => Math.min(...to.map((t) => d(v, t))) - Math.min(...to.map((t) => d(u, t))))[0];
      p.x = open[0]; p.z = open[1];                                        // out in the open, far from every strip
      go(56.2);
      const hp = () => B.hp, hit = () => { const was = hp(); B.damage(100); return Math.round(was - hp()); };
      const bowed = M.rigs.silver.at === 56 && M.rigs.gold.at === 56 && B.exposed && hit() === 150;
      go(58.1); const wallHit = hurt.filter((h) => h.wall);
      go(63.8); const late = hit();
      go(64.3); const after = hit(), clear = !B.solo && !B.records.casts.length && !B.wall.w && !B.spots.silver.visible && !B.disco.quiet(64.3);
      out[k] = { ok: lands === '40,44,48' && lit && apart.filter((x) => x > 0.2 - 1e-6).length >= (spot ? 2 : 3) && standing && hands && disco && wallHit.length === 1 && wallHit[0].dmg === 6 && wallHit[0].beat > 56 && wallHit[0].beat < 58 && bowed && late === 150 && after === 100 && clear,
        lands, lit, apart, standing, hands, disco, wallHit, bowed, late, after, clear };
    }
    return ok(Object.values(out).every((r) => r.ok), out);
  },
});

// ---- the sounds of the new moves (sfx.js): each on its moment, never before the beat it belongs to
const CUES = ['recordScratch', 'recordThrow', 'recordStick', 'recordShatter', 'faderCrank', 'flameJet', 'wallSwell', 'wallShield', 'encoreWall', 'bowExhale', 'crowdCheer'];
// every cue called from now on: { cue: [[beat, ...args]] } (`now()` says the beat)
function cueBeats(now) {
  const out = Object.fromEntries(CUES.map((c) => [c, []]));
  for (const c of CUES) stub(sfx, c, (...a) => out[c].push([now(), ...a]));
  return out;
}
const near = (list, want, tol = 0.07) => list.length === want.length && list.every(([b], i) => Math.abs(b - want[i]) < tol);

fight('the-silver-solos-records-and-bow-have-their-sounds-on-the-beat', {
  about: 'In a silver solo each record is scratched as it winds up (four beats before it lands), thrown on the beat before the bar and sticks on the bar line; each shatters when its four bars are up. The bow breathes out on its beat, and the crowd cheers only if no hit reached the jelly in the solo.',
  setup() {},
  play() {
    const out = {};
    for (const hurt of [false, true]) {
      const { B, go, slot } = soloFight(), cues = cueBeats(() => B.beat);
      stub(B, 'hurtPlayer', () => {});
      go(34); slot('silver', 40);
      go(42); if (hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'boss' });
      go(78);
      out[hurt ? 'hurt' : 'clean'] = { cues, scratch: near(cues.recordScratch, [36, 40, 44, 48]), thrown: near(cues.recordThrow, [39, 43, 47, 51]), stuck: near(cues.recordStick, [40, 44, 48, 52]), shattered: near(cues.recordShatter, [56, 60, 64, 68]), breath: near(cues.bowExhale, [56]), cheer: cues.crowdCheer.length };
    }
    const good = (r) => r.scratch && r.thrown && r.stuck && r.shattered && r.breath;
    const { clean, hurt } = out;
    return ok(good(clean) && good(hurt) && clean.cheer === 1 && hurt.cheer === 0, { clean: { ...clean, cues: undefined }, hurt: { ...hurt, cues: undefined } });
  },
});

fight('the-golds-crank-and-flames-have-their-sounds-on-the-beat', {
  about: 'In a gold solo the fader crank sounds once, on its beat in the first bar (two beats before the first set), then a flame jet sounds on each of the 12 sets, on the beat it fires.',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), cues = cueBeats(() => B.beat);
    stub(B, 'hurtPlayer', () => {});
    go(34); slot('gold', 40); go(60);
    const crank = near(cues.faderCrank, [42]), jets = near(cues.flameJet, Array.from({ length: 12 }, (_, i) => 44 + i));
    return ok(crank && jets, { crank: cues.faderCrank, jets: cues.flameJet.map(([b]) => +b.toFixed(2)) });
  },
});

story('encore/the-wall-has-a-swell-a-roll-and-a-crack-for-each-record', {
  about: 'The wall\'s Warning starts a riser lasting as long as the Warning (8 beats), the roll sounds on the bar line, and each record that takes the wall cracks as the front reaches it.',
  setup() {},
  play() {
    const T = wallRig();
    try {
      const cues = cueBeats(() => T.wall.beat);
      playWall(T, standing(0.6, 0.6), 3, 27);
      const secs = 8 * 60 / BPM, swell = near(cues.wallSwell, [16]) && Math.abs(cues.wallSwell[0][1] - secs) < 1e-6;
      const roll = near(cues.encoreWall, [24]), want = frontBeat(0.1), cracks = cues.wallShield.length === 3 && cues.wallShield.every(([b]) => Math.abs(b - want) < 0.07);
      return ok(swell && roll && cracks, { swell: cues.wallSwell, roll: cues.encoreWall, cracks: cues.wallShield.map(([b]) => +b.toFixed(2)), want });
    } finally { T.done(); }
  },
});

story('encore/a-wall-cut-short-mid-warning-stops-its-riser', {
  about: 'The wall\'s riser stops as soon as its Warning is cut short (a song rewind, the short-out, the defeat all reset the wall), instead of playing out its 8 beats; one that runs to the roll ends by itself and is not stopped again.',
  setup() {},
  play() {
    const out = {};
    for (const cut of [true, false]) {
      const T = wallRig();
      try {
        let stopped = 0;
        stub(sfx, 'wallSwell', () => () => stopped++);
        playWall(T, standing(0.6, 0.6), 3, cut ? 19 : 27);
        T.wall.reset();                                                   // (a rolled wall's riser has ended: nothing to stop)
        out[cut ? 'cut' : 'rolled'] = stopped;
      } finally { T.done(); }
    }
    return ok(out.cut === 1 && out.rolled === 0, out);
  },
});

fight('the-breakdown-bow-breathes-out-on-its-beat', {
  about: 'When the song\'s breakdown bows both DJs, the bow breathes out once, on the beat they go down (a beat into the breakdown), as a solo\'s bow does.',
  setup() {},
  play() {
    const { B, song, go } = soloFight(), cues = cueBeats(() => B.beat);
    song.quiet = (b) => b >= 40 && b < 56;
    go(60);
    return ok(near(cues.bowExhale, [41]), { exhale: cues.bowExhale.map(([b]) => +b.toFixed(2)) });
  },
});

// ---- the feel pass (E7): what each Encore attack adds to its chain (docs/agents/attack-feel.md)
// an fx that counts its impacts and splats, where they were
const countingFx = () => { const fx = { ...fakeFx(), impacts: [], splats: [] }; fx.impact = (p, c) => fx.impacts.push({ p: p.clone(), c }); fx.splat = (p, c, r, mark) => fx.splats.push({ p: p.clone(), r, mark }); return fx; };

story('encore/feel-a-laser-flashes-its-emitter-as-it-fires', {
  about: 'A club laser\'s release is marked at its emitter: on the beat it fires, a flash in laser green at its corner post (where the plane starts), once, the frame its sound plays; nothing flashes there during its Warning.',
  setup() {},
  play() {
    const scene = new THREE.Scene(), arena = buildAct4(scene), fx = countingFx(), lasers = new EncoreLasers(arena, { fx });
    try {
      lasers.cast(4, { corner: 2, on: [0, 0.3], side: 1 });
      const at = []; for (let b = 1; b <= 6; b += 1 / 30) { const n = fx.impacts.length; lasers.update(b, null); if (fx.impacts.length > n) at.push(+b.toFixed(3)); }
      const [cx, cz] = CORNERS[2], p = fx.impacts[0]?.p;
      const atPost = !!p && Math.abs(p.x - cx) < 1e-6 && Math.abs(p.z - cz) < 1e-6 && Math.abs(p.y - LOOK.num('encore-laser-height', 0.35)) < 1e-6;
      return ok(at.length === 1 && at[0] >= 4 && at[0] < 4 + 1 / 30 + 1e-6 && atPost, { at, p });
    } finally { lasers.dispose(); arena.dispose(); }
  },
});

story('encore/feel-disco-spots-blaze-as-they-strike-and-the-ball-flares', {
  about: 'As the disco ball\'s spots strike (the end of each 4 beats) they blaze brighter and bigger than while they flashed, in the hot magenta, for --encore-disco-strike beats, and the ball flares once with them, the last strike of a visit included (its spots stay that long past the show); then they wheel on in warm white.',
  setup() {},
  play() {
    const scene = new THREE.Scene(), arena = buildAct4(scene), fx = countingFx(), D = new EncoreDisco(arena, { fx });
    try {
      D.visit(128);
      const c = new THREE.Color(), m = new THREE.Matrix4(), size = () => { D.spots.getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixScale(m).x; };
      const look = (b) => { roll(D, D.beat ?? 126, b); D.spots.getColorAt(0, c); return { lum: c.r + c.g + c.b, size: size(), on: D.spots.visible }; };
      const flashing = look(131.9), blaze = look(132.1), wheel = look(132.6), last = look(136.1), gone = look(136.5);
      const flares = fx.impacts.length, hot = new THREE.Color(LOOK.color('hostile-encore-disco', '#ff2fd2'));
      const blazes = blaze.lum > flashing.lum && blaze.size > flashing.size && blaze.lum > wheel.lum * 1.5 && last.on && last.size > wheel.size && !gone.on;
      return ok(blazes && flares === 2 && fx.impacts.every((i) => i.c.equals(hot)), { flashing, blaze, wheel, last, gone, flares });
    } finally { D.dispose(); arena.dispose(); }
  },
});

story('encore/feel-pyro-the-set-firing-next-warns-brightest', {
  about: 'With two of the gold DJ\'s flame sets warning at once (a set a beat, each warning 2 beats), the lanes firing next show brighter than the lanes that just fired and warn again, so the six Warnings never read as one wall of gold; each still fills to full as its lanes fire.',
  setup() {},
  play() {
    const T = pyroRig();
    try {
      const P = T.pyro;
      for (let k = 0; k < 4; k++) P.cast(10 + k, { lanes: SETS[k % 2 ? 'even' : 'odd'] });
      playPyro(T, standing(9, 9), 7, 10.5);                             // odd lanes just fired at 10 and warn again for 12; even fire at 11
      const next = P.warnings[1].band.material.opacity, again = P.warnings[0].band.material.opacity, nextVol = P.warnings[1].lane.material.opacity, againVol = P.warnings[0].lane.material.opacity;
      playPyro(T, standing(9, 9), 10.5, 10.98); const full = P.warnings[1].band.material.opacity;
      const top = LOOK.num('encore-pyro-warning', 0.6);
      return ok(next > again * 1.5 && nextVol > againVol * 1.5 && Math.abs(full - top) < top * 0.05 && again >= top * LOOK.num('encore-pyro-warning-early', 0.4) - 1e-9, { next, again, nextVol, againVol, full });
    } finally { T.done(); }
  },
});

fight('feel-every-encore-hit-leaves-a-fading-scorch', {
  about: 'Every Encore hit on the jelly (a floor wave, a laser, a disco strike, the stage edge\'s shock...) leaves a scorch mark on the floor under it, harmless, fading as splats do; the stage edge\'s shock crackles.',
  setup() {},
  play() {
    const B = encoreFight({ hurt: false }), { player } = G();
    step(10);
    const before = B.fx.splats.filter((s) => s.alive).length;
    B.hurtPlayer(4, '#39ff14');
    const marks = B.fx.splats.filter((s) => s.alive), mark = marks.at(-1);
    const under = !!mark && Math.hypot(mark.m.position.x - player.position.x, mark.m.position.z - player.position.z) < 1e-6 && mark.m.position.y < 0.01;
    const scorch = !!mark && mark.m.material === B.fx.splatMats.scorch;
    step(60 * (LOOK.num('splat-life', 2) + 0.5)); const faded = !mark?.alive;
    return ok(marks.length >= Math.min(before + 1, LOOK.num('splat-most', 24)) && under && scorch && faded, { before, after: marks.length, under, scorch, faded });
  },
});

// ---- the last song (25% Health): its set, its toast, the boss bar's words, the first-time hints
story('encore/the-last-song-doubles-every-wave-and-books-a-slot-every-10-bars', {
  about: 'In the last song every wave is two at a time (one from each DJ), where set 3 plays one; its solo slots come 2 bars in and then every 10 bars (silver, gold, duet, silver…), and a slot that finds a solo still playing is tried again the next bar, not skipped.',
  setup() {},
  play() {
    const run = (stage, refuse) => {
      const f = recorder(), slots = [], set = new SetList(f, 8, { random: lcg(7), stage: () => stage, soloLast: 10, slot: (kind, at) => { if (refuse-- > 0) return false; slots.push(kind + '@' + at); } });
      for (let b = -6; b <= 200; b += 0.5) set.update(b);
      const per = {}; for (const c of f.casts) per[c.at] = (per[c.at] || 0) + 1;
      return { slots: slots.join(), waves: [...new Set(Object.values(per))].join() };
    };
    const last = run('last', 1), set3 = run('set3', 0);
    return ok(last.waves === '2' && set3.waves === '1' && last.slots === 'silver@20,gold@60,duet@100,silver@140,gold@180', { last, set3 });
  },
});

fight('the-last-song-starts-at-a-quarter-health-with-a-toast', {
  about: 'Crossing 25% Health turns the stage to the last song and shows one toast, "The last song!", once however long it plays; above 25% there is none.',
  setup() {},
  play() {
    const { B, go } = soloFight(), { hud } = G(), toasts = [];
    stub(hud, 'toast', (t) => toasts.push(t)); B.broken = true; B.hp = B.maxHp * 0.26;
    go(10); const before = B.stage === 'set3' && !toasts.length;
    B.damage(B.maxHp * 0.02); go(14); const now = B.stage === 'last' && toasts.filter((t) => /^The last song/.test(t)).length;
    go(60);
    return ok(before && now === 1 && toasts.length === 1, { before, now, toasts });
  },
});

fight('the-boss-bar-names-the-solo-the-duet-and-the-bow', {
  about: 'The boss bar says whose solo is playing (SILVER DJ SOLO, GOLD DJ SOLO, DUET), turns to BOW · EXPOSED (gold) while a DJ bows, and is just the Encore\'s name between.',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), { hud } = G(), name = () => hud.$('.boss .nm').textContent, out = {};
    stub(B, 'hurtPlayer', () => {}); B.hp = B.maxHp * 0.4; B.broken = true;
    go(34); slot('silver', 40);
    go(42); out.silver = name();
    go(58); out.bow = name(); out.gold = hud.$('.boss').classList.contains('exposed');
    go(76); out.between = name();
    slot('gold', 80); go(82); out.goldSolo = name();
    go(114); slot('duet', 120); go(126); out.duet = name();
    const good = /SILVER DJ SOLO$/.test(out.silver) && /BOW · EXPOSED$/.test(out.bow) && out.gold && !/·/.test(out.between) && /GOLD DJ SOLO$/.test(out.goldSolo) && /DUET$/.test(out.duet);
    return ok(good, out);
  },
});

fight('the-first-bow-and-the-first-standing-record-each-show-a-hint-once', {
  about: 'The first time a DJ bows, a toast says the Encore is exposed and hits do 1.5x; the first time a duet record stands before its wall, one says to get behind it. Each shows once, never again in the fight or after it (it is remembered across runs).',
  setup() {},
  play() {
    const { B, go, slot } = soloFight(), { hud } = G(), toasts = [], had = localStorage.getItem(ENCORE_HINTS_KEY);
    try {
      localStorage.removeItem(ENCORE_HINTS_KEY); B.hints = new EncoreHints();
      stub(hud, 'toast', (t) => toasts.push(t)); stub(B, 'hurtPlayer', () => {}); B.hp = B.maxHp * 0.4; B.broken = true;
      const n = (id) => toasts.filter((t) => t === ENCORE_HINTS[id]).length, seen = {};
      go(34); slot('silver', 40); go(55); seen.early = n('bow') + n('cover');
      go(60); seen.bow = n('bow');
      go(74); slot('silver', 80); go(100); seen.bow2 = n('bow');
      go(114); slot('duet', 120); go(119); seen.coverEarly = n('cover');
      go(122); seen.cover = n('cover');
      go(150); seen.after = [n('bow'), n('cover'), toasts.length];
      const again = new EncoreHints(); seen.remembered = again.take('bow') === null && again.take('cover') === null;
      return ok(seen.early === 0 && seen.bow === 1 && seen.bow2 === 1 && seen.coverEarly === 0 && seen.cover === 1 && seen.after.join() === '1,1,2' && seen.remembered, seen);
    } finally { had === null ? localStorage.removeItem(ENCORE_HINTS_KEY) : localStorage.setItem(ENCORE_HINTS_KEY, had); }
  },
});
