// Fliers circle the jelly their own way (the hover word's `swap` and `jerk`). The House fly keeps its old path.
import { seededRandom, seedFor } from '../story-random.mjs';
import { G, V, fresh, holdJelly, ok, spawn, step, story, stub, tp } from './kit.js';

// the House fly's path on a fixed seed with the jelly held still: where it is every half second for 8 s, in mm
export function housePath() {
  const real = Math.random;
  Math.random = seededRandom(seedFor('house-fly-path'));
  try {
    fresh({ elites: false, bubbles: false, lash: false });
    tp(3.2, 0.05, 3.0, 0); holdJelly();
    stub(G().run, 'hurt', () => {}); stub(G().run, 'hit', () => {}); G().run.health = 1e6;
    const P = G().player.position, e = spawn('housefly', V(P.x + 0.6, P.y + 0.05, P.z), { hp: 1e7 }), out = [];
    for (let i = 0; i < 16; i++) { step(30); out.push([e.pos.x, e.pos.y, e.pos.z].map((v) => Math.round(v * 1000))); }
    G().enemies.kill(e, true);
    return out;
  } finally { Math.random = real; }
}

story('bugs/house-fly-moves-as-before', {
  about: 'The House fly flies the same path on a fixed seed as before the hover word learned to swap its circling: src/stories/house-fly-path.json, recorded on main before that change (within 2 mm).',
  setup() {},
  async play() {
    const want = await (await fetch('src/stories/house-fly-path.json')).json(), got = housePath();
    const bad = got.map((p, i) => ({ i, want: want[i], got: p })).filter(({ want: w, got: g }) => !w || w.some((v, k) => Math.abs(v - g[k]) > 2));
    return ok(!bad.length && want.length === got.length, { bad: bad.slice(0, 3) });
  },
});

story('bugs/fliers-circle-both-ways', {
  about: 'Eight Monarch butterflies released round the jelly do not all circle the same way: at least two go each way between 8 and 12 s in, and some change direction. (Before, every flier circled the same way.)',
  setup() {},
  play() {
    const { enemies } = G();
    fresh({ elites: false, bubbles: false, lash: false });
    tp(3.2, 0.05, 3.0, 0); holdJelly();
    stub(G().run, 'hurt', () => {}); stub(G().run, 'hit', () => {}); G().run.health = 1e6;
    const P = G().player.position, bugs = [];
    for (let i = 0; i < 8; i++) { const a = i * 0.785; bugs.push(spawn('butterfly', V(P.x + Math.cos(a) * 0.35, P.y + 0.3, P.z + Math.sin(a) * 0.35), { hp: 1e7 })); }
    const ang = (e) => Math.atan2(e.pos.z - P.z, e.pos.x - P.x), wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
    let last = bugs.map(ang);
    const signs = bugs.map(() => []);   // the way each went in every half second
    const sum = bugs.map(() => 0);
    for (let w = 0; w < 48; w++) {
      step(30);
      const now = bugs.map(ang);
      now.forEach((a, i) => { sum[i] += wrap(a - last[i]); });
      last = now;
      sum.forEach((d, i) => { signs[i].push(Math.abs(d) < 0.05 ? 0 : d > 0 ? 1 : -1); sum[i] = 0; });
    }
    const first = signs.map((s) => Math.sign(s.slice(16, 24).reduce((a, b) => a + b, 0)));
    const flips = signs.filter((s) => s.includes(1) && s.includes(-1)).length;
    for (const e of bugs) enemies.kill(e, true);
    const cw = first.filter((v) => v > 0).length, ccw = first.filter((v) => v < 0).length;
    return ok(cw >= 2 && ccw >= 2 && flips >= 1, { cw, ccw, flips });
  },
});
