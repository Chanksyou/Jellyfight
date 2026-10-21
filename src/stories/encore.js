// The Encore's floor patterns (act 4 preview): tiles that go off on the beat, jumped or dodged.
import * as THREE from 'three';
import { buildAct4 } from '../act4-arena.js';
import { EncoreFloor, EncoreSet, PATTERNS, FLOOR_DMG, tileX, tileZ } from '../encore-floor.js';
import { STAGE4 } from '../stage4.js';
import { World } from '../collision.js';
import { CONFIG } from '../config.js';
import { Player } from '../player.js';
import { Music, SONGS } from '../music.js';
import { LOOK } from '../look.js';
import { story, ok, V } from './kit.js';

const N = STAGE4.tiles, S = STAGE4.tileSize, BOSS = STAGE4.bossSpace;
const BPM = SONGS.encore.bpm, DT = 1 / 60;
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
  about: 'The ring leaves the front of the pyramid and moves out a tile each beat, one tile thick, so each tile goes off once.',
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
  about: 'A jelly standing on a tile of the ring\'s 4th step is hit on that beat, not before, once, for the floor\'s heavy damage.',
  setup() {},
  play() {
    const T = make();
    try {
      T.floor.cast('ring', 0);
      const tile = T.floor.casts[0].steps[3][Math.floor(T.floor.casts[0].steps[3].length / 2)];
      play(T.floor, standing(...at(tile)), -3, 8);
      const h = T.hits[0];
      return ok(T.hits.length === 1 && h.beat >= 3 && h.beat < 3 + 0.05 && h.dmg === FLOOR_DMG, { hits: T.hits });
    } finally { T.done(); }
  },
});

// a real jelly on the arena floor, on a tile the ring's 5th step reaches; it jumps `early` beats
// before that beat (null: it never jumps)
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
    play(T.floor, p, -2, 7, (b) => {
      if (early !== null && !jumped && b >= 4 - early) { jump = jumped = true; }
      T.world.focus(p.position, DT); p.update(DT, input, 0); maxY = Math.max(maxY, p.position.y);
    });
    return { hits: T.hits.length, maxY };
  } finally { T.done(); }
}
story('encore/a-jump-on-the-beat-clears-the-floor', {
  about: 'A real jump pressed just before the beat (a quarter beat) clears the hot tile; one pressed 2.7 beats early has landed by then and is hit, and so is a jelly that never jumps. A jump hangs about 2.5 beats at 121 BPM.',
  setup() {},
  play() {
    const onBeat = jumpTheRing(0.25), early = jumpTheRing(2.7), never = jumpTheRing(null);
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
  about: 'A chevron leads with its tip and crosses the floor a row a beat. The setlist\'s three arrows four beats apart each hit a jelly that stands still: three jumps in a row.',
  setup() {},
  play() {
    const T = make();
    try {
      const steps = PATTERNS.arrow.steps({ dir: 'down' }), mid = steps.find((s) => s.some((i) => (i / N | 0) === 8));
      const rows = (cols) => mid.filter((i) => cols.includes(i % N)).map((i) => (i / N) | 0);
      const tipLeads = Math.min(...rows([5, 6])) > Math.max(...rows([0, 11]));
      const set = new EncoreSet(T.floor, 0, () => 0.5);
      play(T.floor, standing(tileX(5), tileZ(9)), -8, 30, (b) => set.update(b));
      const arrows = T.hits.filter((h) => h.name === 'arrow').length;
      return ok(tipLeads && arrows === 3, { tipLeads, hits: T.hits.map((h) => `${h.name}@${h.beat.toFixed(2)}`) });
    } finally { T.done(); }
  },
});

story('encore/warning-glows-and-rises-to-the-beat', {
  about: 'A tile\'s Warning starts 2 beats before its beat: the floor glow brightens and the volume over it rises to the hit\'s height, both full on the beat and gone half a beat after; the Encore lights up for it. No light is added.',
  setup() {},
  play() {
    const T = make();
    try {
      let lights = 0; T.arena.root.traverse((o) => { if (o.isLight) lights++; });
      T.floor.cast('ring', 6);
      const tile = T.floor.casts[0].steps[2][0], i = tile, c = new THREE.Color(), m = new THREE.Matrix4(), pos = V(0, 0, 0), q = new THREE.Quaternion(), sc = V(0, 0, 0);
      let now = 4;
      const look = (b) => { for (; now < b; now = Math.min(b, now + 0.05)) T.floor.update(now, null); T.floor.update(b, null); T.arena.tiles.getColorAt(i, c); T.floor.volumes.getMatrixAt(i, m); m.decompose(pos, q, sc); return { glow: c.r, height: sc.y }; };
      const before = look(5), early = look(6.5), late = look(7.6), on = look(8), after = look(8.6);
      const band = LOOK.num('encore-floor-height', 0.04);
      const bossLit = T.arena.root.getObjectByName('Encore attack lighting').geometry.attributes.color.array.some((v) => v > 0);
      let after2 = 0; T.arena.root.traverse((o) => { if (o.isLight) after2++; });
      const rises = before.glow === 0 && early.glow > 0 && late.glow > early.glow && on.glow >= late.glow && late.height > early.height && Math.abs(on.height - band) < 1e-6 && after.glow === 0 && after.height < 1e-3;
      return ok(rises && lights === 2 && after2 === 2, { before, early, late, on, after, bossLit, lights });
    } finally { T.done(); }
  },
});

story('encore/a-jump-in-time-drops-patterns-instead-of-firing-them', {
  about: 'After a pause or a long frame (the song keeps playing), the floor and the setlist skip what they missed: no burst of hits all at once, and the rest of a pattern still plays.',
  setup() {},
  play() {
    const T = make();
    try {
      const spot = standing(tileX(5), tileZ(9)), set = new EncoreSet(T.floor, 0, () => 0.5);
      play(T.floor, spot, -8, 13, (b) => set.update(b));
      const before = T.hits.length;
      set.update(40); T.floor.update(40, spot);                       // 27 beats later at once
      const burst = T.hits.length - before;
      play(T.floor, spot, 40, 60, (b) => set.update(b));
      // a 1.2 s hitch in the middle of a ring keeps the ring: its later steps still go off
      T.floor.reset(); T.floor.cast('ring', 70); play(T.floor, null, 66, 71);
      T.floor.update(73.4, null); const kept = T.floor.casts.length === 1 && T.floor.casts[0].fired === 3;
      return ok(burst === 0 && kept && T.floor.casts.length + T.hits.length > before, { before, burst, kept, after: T.hits.length });
    } finally { T.done(); }
  },
});

story('encore/the-encore-song-plays-at-121-bpm', {
  about: 'The Encore\'s own song (original, French house) schedules its bars without error, and Music.beatNow counts its beats from the first downbeat.',
  setup() {},
  play() {
    const ctx = new OfflineAudioContext(2, 44100 * 3, 44100), m = new Music(ctx, ctx.destination);
    m.play('encore'); m.I = m.target = 0.9;
    m.schedule(m.t0 + 8 * 60 / BPM * 4);                              // 8 bars, every layer
    const beat = m.beatNow(), expect = -m.t0 * BPM / 60;
    return ok(SONGS.encore.bpm === 121 && m.step >= 8 * 16 && Math.abs(beat - expect) < 1e-6, { bpm: SONGS.encore.bpm, steps: m.step, beat });
  },
});
