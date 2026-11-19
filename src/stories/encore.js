// The Encore's floor patterns (act 4 preview): tiles that go off on the beat, jumped or dodged.
import * as THREE from 'three';
import { buildAct4 } from '../act4-arena.js';
import { EncoreFloor, PATTERNS, FLOOR_DMG, FLOOR_STEP, tileX, tileZ } from '../encore-floor.js';
import { SetList } from '../encore.js';
import { ENCORE } from '../stage4.js';
import { World } from '../collision.js';
import { CONFIG } from '../config.js';
import { Player } from '../player.js';
import { Music, SONGS } from '../music.js';
import { SongTrack, TRACKS } from '../song-track.js';
import { EncoreLasers, CORNERS, LASER_DMG } from '../encore-laser.js';
import { EncoreDisco, DISCO, DISCO_DMG } from '../encore-disco.js';
import { EncorePulses, SPEAKERS } from '../encore-pulse.js';
import { LOOK } from '../look.js';
import { story, ok, V, encoreFight, step, stub } from './kit.js';

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
  about: 'The Encore picks every wave at random, a new one every 4 beats: never the same pattern twice running, all seven turning up, its options (direction, gap, spin) picked too, and two different rolls give different sets.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const roll = (seed) => { const f = recorder(), set = new SetList(f, 0, { random: lcg(seed) }); for (let b = -6; b <= 800; b += 0.5) set.update(b); return f.casts; };
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
    const f = recorder(), set = new SetList(f, 0, { drop: (b) => track.drop(b) });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const byBeat = new Map(); for (const c of f.casts) byBeat.set(c.at, [...(byBeat.get(c.at) || []), c]);
    const inDrop = [...byBeat].filter(([at]) => at >= 64 && at < 96), outside = [...byBeat].filter(([at]) => at < 64 || at >= 96);
    const pairs = inDrop.length === 8 && inDrop.every(([, w]) => w.length === 2 && w[0].name !== w[1].name && new Set(w.map((c) => c.dj)).size === 2);
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
  about: 'With the lasers rigged, a club laser fires on every wave\'s beat, every 4 beats, alongside the random floor waves, from a random corner (all four turn up) to a random side, aimed where the jelly is.',
  setup() {},
  play() {
    const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const shots = [], lasers = { cast(at, o) { shots.push({ at, ...o }); } }, f = recorder();
    const set = new SetList(f, 0, { random: lcg(7), lasers, target: () => [0.1, 0.2] });
    for (let b = -6; b <= 200; b += 0.5) set.update(b);
    const every4 = shots.length > 40 && shots.every((s, k) => s.at === 4 * k), withWaves = shots.every((s) => f.casts.some((c) => c.at === s.at));
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

story('encore/speakers-fire-one-pulse-at-a-time-in-turn', {
  about: 'Once started (the set list starts them after the warm-up; beat 64 here), one corner speaker at a time fires a white sound wave, the four taking turns round the arena; each crosses to the opposite corner\'s speaker in 2 beats, at jelly height across the floor, and the next fires as it arrives, so only one is ever in flight. None before they start, none in the breakdown.',
  setup() {},
  play() {
    const scene = new THREE.Scene(), arena = buildAct4(scene), P = new EncorePulses(arena, { quiet: (b) => b >= 80 && b < 84 }); P.start(64);
    try {
      const seen = [];
      let maxLive = 0;
      for (let b = 50; b <= 90; b += 1 / 30) { P.update(b, null); maxLive = Math.max(maxLive, P.live.length); for (const p of P.live) if (!seen.includes(p)) seen.push(p); }
      const T = LOOK.num('encore-pulse-travel', 2), first = seen[0]?.at === 64, every = seen.every((p, k) => k === 0 || p.at - seen[k - 1].at === (seen[k - 1].at === 78 ? 3 * T : T));
      const turns = seen.every((p) => p.from === ((p.at - 64) / T) % 4), rest = !seen.some((p) => p.at >= 80 && p.at < 84), single = maxLive <= 1;
      const mid = P.at(seen[0], 0.5, new THREE.Vector3()), [ax, az] = SPEAKERS[seen[0].from], [bx, bz] = SPEAKERS[(seen[0].from + 2) % 4];
      const across = Math.abs(mid.y - 0.06) < 1e-9 && Math.abs(mid.x - (ax + bx) / 2) < 1e-9 && Math.abs(mid.z - (az + bz) / 2) < 1e-9;
      return ok(first && every && turns && rest && across && single, { first: seen[0]?.at, at: seen.map((p) => p.at), every, turns, rest, across, maxLive });
    } finally { P.dispose(); arena.dispose(); }
  },
});

story('encore/a-speaker-pulse-shoves-the-jelly-12-cm-and-does-no-damage', {
  about: 'A sound wave rolling through a real jelly standing in its path shoves it 12 cm the way it is going (slid over a moment, not a jump), once, and does no damage (it has no hit at all); a jelly jumping as it passes is not moved.',
  setup() {},
  play() {
    const T = make();
    try {
      const run = (jump) => {
        const p = new Player(T.world, CONFIG.player); T.scene.add(p.mesh);
        const P = new EncorePulses(T.arena, { push: (dx, dz) => { p.moveHorizontal(dx, dz); p.syncMesh(); } }); P.start(64);
        const [ax, az] = SPEAKERS[0], [bx, bz] = SPEAKERS[2], spot = V(ax + (bx - ax) * 0.35, 0.01, az + (bz - az) * 0.35);
        p.spawn(spot); p.snapToGround(); T.world.focus(p.position, 1);
        const start = p.position.clone(); let j = false;
        const input = { moveAxes: () => ({ x: 0, y: 0 }), consumeJump: () => { const k = j; j = false; return k; }, jumpHeld: false };
        let jumped = false;
        for (let b = 63; b <= 66.5; b += DT * BPM / 60) { if (jump && !jumped && b >= 64.2) { j = jumped = true; } T.world.focus(p.position, DT); p.update(DT, input, 0); P.update(b, p, DT); }
        const moved = V(p.position.x - start.x, 0, p.position.z - start.z), dir = V(bx - ax, 0, bz - az).normalize();
        P.dispose(); T.scene.remove(p.mesh);
        return { along: +moved.dot(dir).toFixed(4), side: +Math.abs(moved.x * dir.z - moved.z * dir.x).toFixed(4) };
      };
      const shoved = run(false), jumping = run(true);
      const push = LOOK.num('encore-pulse-push', 0.05);
      return ok(Math.abs(shoved.along - push) < 0.006 && shoved.side < 0.004 && Math.abs(jumping.along) < 0.004, { shoved, jumping, push });
    } finally { T.done(); }
  },
});

// The set list (encore.js SetList). Its waves and lasers at a fixed roll, recorded from the old
// fixed-timer set (encore-floor.js EncoreSet, v544) before the set list replaced it
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const SET_FIXTURE = 'arc@8:s:h0.007 L8:2+ sweep@12:g:s-1 L12:0- arc@16:s:h0.145 L16:3+ pincer@20:g L20:1- sweep@24:s:s1 L24:0+ ring@28:g L28:2+ arrow@32:s:right L32:3+ sweep@36:s:s1 L36:2+ pincer@40:g L40:2- gate@44:s:down:g4 L44:2+ arrow@48:g:down L48:2- arc@52:s:h0.722 L52:0- ring@56:g L56:0+ arc@60:s:h-0.147 L60:0- gate@64:s:right:g1 L64:0- closing@68:g L68:1- pincer@88:s L88:1+ ring@92:g L92:2- closing@96:s L96:0+ sweep@100:g:s1 L100:3+ pincer@104:s L104:1+ arrow@108:g:down L108:2- sweep@112:s:s-1 L112:1+ arrow@116:g:left L116:0+ arc@120:s:h0.436 closing@120:g L120:2- arrow@124:s:down pincer@124:g L124:2+ sweep@128:s:s-1 gate@128:g:down:g2 L128:2+ sweep@132:s:s1 arrow@132:g:down L132:2- gate@136:g:left:g8 L136:1- pincer@140:g L140:3- sweep@144:s:s1 L144:2- ring@148:g L148:3+ arrow@152:s:down L152:1- arc@156:g:h-0.636 L156:2- closing@160:s L160:1+ gate@164:g:down:g8 L164:2- arrow@168:s:right L168:0- sweep@172:s:s-1 L172:3- pincer@176:g L176:1- ring@180:s L180:0+ arrow@184:s:right L184:1- pincer@188:g L188:3+ sweep@192:s:s-1 L192:1+ ring@196:g L196:0- sweep@200:s:s-1 L200:1+ pincer@204:g L204:1- arrow@208:g:left L208:2- sweep@212:s:s1 L212:2+ pincer@216:g L216:1+ ring@220:s L220:1- gate@224:g:down:g7 L224:2- arrow@228:s:right L228:1- arc@232:s:h0.156 L232:2+ gate@236:g:left:g6 L236:3- pincer@240:g L240:3+ sweep@244:s:s1 L244:1+ closing@248:g L248:1- ring@252:s L252:0- sweep@256:g:s-1 L256:1- gate@260:g:left:g4 L260:3- ring@264:s L264:1-';
const describe = (casts) => casts.map((c) => c.laser != null ? `L${c.laser}:${c.corner}${c.side > 0 ? '+' : '-'}` : `${c.name}@${c.at}:${c.dj[0]}${c.dir ? ':' + c.dir : ''}${c.gap != null ? ':g' + c.gap : ''}${c.spin ? ':s' + c.spin : ''}${c.heading != null ? ':h' + c.heading.toFixed(3) : ''}`).join(' ');
story('encore/the-set-list-plays-the-same-waves-as-the-old-set', {
  about: 'At a fixed roll, the set list in set 1 lays out exactly the waves and lasers the old fixed-timer set did (recorded before the change): the same patterns, options and DJs on the same beats, resting through a breakdown and doubling through a drop.',
  setup() {},
  play() {
    const f = recorder(), lasers = { cast(at, o) { f.casts.push({ laser: at, corner: o.corner, side: o.side }); } };
    const set = new SetList(f, 8, { random: lcg(1), quiet: (b) => b >= 80 && b < 88, drop: (b) => b >= 120 && b < 136, target: () => [0.1, 0.2], lasers });
    for (let b = -6; b <= 260; b += 0.25) set.update(b);
    const got = describe(f.casts), same = got === SET_FIXTURE;
    return ok(same, { same, first: got.split(' ').findIndex((w, k) => w !== SET_FIXTURE.split(' ')[k]), got: got.slice(0, 300) });
  },
});

story('encore/the-set-list-adds-each-stages-attacks-bar-by-bar', {
  about: 'Whatever stage a bar is laid out in decides what it holds: the warm-up only waves, one at a time (no lasers, no speaker pulses, no doubling at a drop); from set 1 a laser on every wave and the speakers start on that first bar; disco ball visits only in set 2, every 8 bars halfway between solo slots; and from the end of the warm-up a solo slot every 16 bars, on a bar line, silver in set 1, silver and gold in turn in set 2, then silver, gold and a duet, each stage starting from silver.',
  setup() {},
  play() {
    // the stage by beat (a stand-in for the Encore's Health)
    const stageAt = (b) => (b < 40 ? 'warmup' : b < 300 ? 'set1' : b < 600 ? 'set2' : 'set3');
    let now = 0;
    const f = recorder(), shots = [], visits = [], slots = [], starts = [];
    const set = new SetList(f, 8, { random: lcg(3), drop: (b) => b >= 16 && b < 32, stage: () => stageAt(now + 6), lasers: { cast: (at) => shots.push(at) },
      disco: { visit: (at) => visits.push(at) }, pulses: { first: null, start(at) { this.first = at; starts.push(at); } }, slot: (kind, at) => slots.push(`${kind}@${at}`) });
    for (now = -6; now <= 900; now += 0.25) set.update(now);
    const o = set.origin;
    const warm = f.casts.filter((c) => c.at < o), single = warm.length > 0 && new Set(warm.map((c) => c.at)).size === warm.length;
    const noLasers = shots.every((at) => at >= o) && shots.length > 100 && f.casts.filter((c) => c.at >= o).every((c) => shots.includes(c.at));
    const speakers = starts.join() === `${o}`;
    const disco = visits.length > 3 && visits.every((at) => stageAt(at) === 'set2' && (at - o) % 32 === 16);
    const want = []; let k = 0, was = null;
    for (let at = o + 64; at <= 900; at += 64) { const st = stageAt(at); if (st !== was) { was = st; k = 0; } const kinds = { set1: ['silver'], set2: ['silver', 'gold'], set3: ['silver', 'gold', 'duet'] }[st]; want.push(`${kinds[k++ % kinds.length]}@${at}`); }
    const solos = slots.join() === want.join() && slots.some((x) => x.startsWith('duet'));
    return ok(o === 40 && single && noLasers && speakers && disco && solos, { origin: o, single, noLasers, speakers, starts, disco, visits: visits.slice(0, 6), solos, slots: slots.slice(0, 8) });
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
  about: 'The Encore\'s stage comes from its Health, not the time: behind its opening force field it warms up with waves only (no lasers, no speakers); then set 1 adds lasers and speakers; however long set 1 plays, its disco ball never visits, and a visit is booked within 8 bars of it reaching 75% (set 2). 50% is set 3 and 25% the last song.',
  setup() {},
  play() {
    const B = encoreFight({ guard: true, hurt: false });
    stub(B, 'song', { beat: () => null });
    const n = counting(B);
    step(60 * 8);
    const warm = B.stage === 'warmup' && n.floor >= 3 && n.laser === 0 && B.pulses.first == null;
    step(60 * 9, () => !B.opening); step(60 * 4);
    const set1 = B.stage === 'set1' && n.laser > 0 && B.pulses.first != null;
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
  about: 'When the song rewinds in any stage, the set list starts again cleanly from the new beat: no attack is left booked for the old beats, fresh waves follow with their full wind-up, and what that stage adds (lasers and speakers after the warm-up, disco ball visits in set 2) comes back.',
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
      const cleared = B.floor.casts.every((c) => c.at >= 20) && B.lasers.casts.every((c) => c.at >= 20) && (B.disco.visitAt ?? 20) >= 20 && B.pulses.live.length === 0 && B.set?.from >= 20;
      step(60 * 20, () => { beat += 128 / 3600; });
      const warm = stage === 'warmup';
      results[stage] = { ok: cleared && B.stage === stage && n.floor >= 4 && (warm ? n.laser === 0 && B.pulses.first == null : n.laser >= 4 && B.pulses.first >= 20) && (stage !== 'set2' || B.disco.visitAt >= 20), cleared, floor: n.floor, laser: n.laser, pulses: B.pulses.first, visit: B.disco.visitAt };
    }
    return ok(Object.values(results).every((r) => r.ok), results);
  },
});

