// Ants walk in a file, then fan out along the ring round the jelly to throw (the chase word's `file` and `fan`).
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub } from './kit.js';

// a clear spot on the jelly's floor `d` m off, in open floor (nothing between)
function clearSpot(d, from = 0) {
  const P = G().player.position, pc = P.clone().setY(P.y + 0.045);
  for (let i = from; i < from + 24; i++) {
    const a = i * 0.7, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    if (G().run.inStage(x, z) && !G().run.world.castAll(pc, V(x - P.x, 0, z - P.z).normalize(), d + 0.1)) return { a, at: V(x, P.y + 0.01, z) };
  }
  return null;
}
const calm = () => { const { run } = G(); stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6; };

story('bugs/ants-walk-in-a-file', {
  about: 'Ants released side by side, 1.1 to 1.3 m out, close in behind the one ahead of them: after 2 s the ones behind are much nearer the first ant\'s line to the jelly than a straight walk (which is what a lone ant does) would leave them.',
  setup() {},
  play() {
    const { enemies } = G(), P = G().player.position;
    setupFight({ bubbles: false, lash: false }); holdJelly(); calm();
    stub(enemies, 'nav', null);
    const rows = [[0, 0], [0.22, 0.3], [0.22, -0.3], [0.4, 0.32], [0.4, -0.32]], pc = P.clone().setY(P.y + 0.045);
    let s = null, from = [];
    for (let i = 0; i < 48 && !s; i++) {   // an angle where all five start on open floor, nothing between them and the jelly
      const a = i * 0.7, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
      from = rows.map(([along, across]) => V(P.x + ux * (1.2 + along) + vx * across, P.y + 0.01, P.z + uz * (1.2 + along) + vz * across));
      if (from.every((q) => G().run.inStage(q.x, q.z) && !G().run.world.castAll(pc, V(q.x - P.x, 0, q.z - P.z).normalize(), Math.hypot(q.x - P.x, q.z - P.z) + 0.05))) s = { a };
    }
    if (!s) return ok(false, { why: 'no clear spot' });
    // the line out from the jelly through the first ant (u) and across it (v)
    const ux = Math.cos(s.a), uz = Math.sin(s.a), vx = -uz, vz = ux;
    const bugs = from.map((q) => spawn('ants', q, { hp: 1e7 }));
    step(120);
    const side = bugs.slice(1).map((e) => Math.abs((e.pos.x - P.x) * vx + (e.pos.z - P.z) * vz));
    // a straight walk to the jelly would leave a bug 1.2 + along out and `across` wide with (across / (1.2 + along)) of its distance left: 0.3 -> about 0.19 after 0.6 m
    const mean = side.reduce((a, b) => a + b, 0) / side.length;
    for (const e of bugs) enemies.kill(e, true);
    return ok(mean < 0.14, { jelly: [P.x, P.z].map((v) => +v.toFixed(2)), a: +s.a.toFixed(2), pos: bugs.map((e) => [e.pos.x, e.pos.z].map((v) => +v.toFixed(2))), side: side.map((v) => +v.toFixed(2)), mean: +mean.toFixed(3) });
  },
});

story('bugs/ants-fan-out-to-throw', {
  about: 'Five Ants released in a clump 0.3 m from the jelly (their holding distance) spread along the ring round it, not a stack: after 5 s the row is at least 30 cm wide and each is still 0.2 to 0.45 m from the jelly.',
  setup() {},
  play() {
    const { enemies } = G(), P = G().player.position;
    setupFight({ bubbles: false, lash: false }); holdJelly(); calm();
    stub(enemies, 'nav', null);
    const s = clearSpot(0.3);
    if (!s) return ok(false, { why: 'no clear spot' });
    const bugs = [];
    for (let i = 0; i < 5; i++) bugs.push(spawn('ants', V(s.at.x + (i % 2) * 0.01, s.at.y, s.at.z + i * 0.01), { hp: 1e7, still: false }));
    step(5 * 60);
    let span = 0;
    for (const a of bugs) for (const b of bugs) span = Math.max(span, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    const dists = bugs.map((e) => +Math.hypot(e.pos.x - P.x, e.pos.z - P.z).toFixed(2));
    for (const e of bugs) enemies.kill(e, true);
    return ok(span >= 0.3 && dists.every((d) => d > 0.2 && d < 0.45), { span: +span.toFixed(2), dists });
  },
});
