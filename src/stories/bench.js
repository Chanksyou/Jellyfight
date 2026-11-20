// Stories: the phone bench (src/bench.js, index.html?bench). It plays this act's moments in real frames,
// replays the busiest once per switch and ends on a results card, and leaves the game as it found it.
// Here each moment is cut to a fraction of a second: these prove the bench works, not how fast anything is.
import { G, offs, ok, story } from './kit.js';
import { runBench, showResults } from '../bench.js';
import { MOMENTS } from '../bench-moments.js';

const SHORT = { settle: 0.05, secs: 0.25 };

story('bench/runs-to-its-results', {
  phone: true,
  about: 'The phone bench plays act 1\'s quiet room, crowd and Vacuum fight in real frames, then the crowd again with bloom off, pixel ratio 1.0, lamps off, AO off and on Low, and ends on a results card with a row for each and the results ready to copy.',
  setup() {},
  async play() {
    const res = await runBench(SHORT);
    const el = showResults(res);
    offs.push(() => el.remove());
    const measured = res.moments.filter((m) => !m.skipped);
    const sane = measured.every((m) => m.frames > 0 && m.ms > 0 && m.stepMs >= 0 && m.renderMs > 0 && m.draws > 0 && m.tris > 0);
    const names = res.moments.map((m) => m.name);
    const want = [...Object.keys(MOMENTS.act1), ...['bloom off', 'pixel ratio 1.0', 'lamps off', 'AO off', 'Low'].map((s) => `bugs + Controller, ${s}`)];
    const lowRow = res.moments.find((m) => m.name.endsWith(', Low'));
    const e = res.env;
    const envOk = e.build === G().JF_BUILD && e.raf.fps > 0 && typeof e.gpu === 'string' && typeof e.multiDraw === 'boolean' && /offered/.test(e.gpuTime);
    const rows = el.querySelectorAll('tbody tr').length;
    const json = JSON.parse(JSON.stringify(res)).moments.length === res.moments.length;
    return ok(sane && want.every((n, i) => names[i] === n) && lowRow?.tier === 'low' && G().gfx.quality === 'medium' && envOk && rows === res.moments.length && json,
      { names, skipped: res.moments.filter((m) => m.skipped).map((m) => m.name), low: lowRow?.tier, tierAfter: G().gfx.quality, env: { ...e, ua: e.ua.slice(0, 40) }, rows, first: measured[0] });
  },
});

story('bench/leaves-no-trace', {
  phone: true,
  about: 'A phone bench is not a run: it queues no run summary, posts no score, keeps nothing on the device, and puts back the frame cap, the governor, the pixel ratio, the graphics tier and its passes, the lamps and the game\'s own frame loop.',
  setup() {},
  async play() {
    const { GAME, APT, gfx, pacing, run } = G(), R = APT.renderer;
    const queued = () => JSON.stringify([...(G().run.board?.runLog?.pending || [])]);   // run summaries waiting to be sent (run-log.js)
    const q0 = queued();
    const store = JSON.stringify({ ...localStorage }), frame = GAME.frame, sample = pacing.governor.sample;
    const before = { fps: pacing.pacer.fps, scale: pacing.governor.scale, target: pacing.governor.target, ratio: R.getPixelRatio(), tier: gfx.quality, off: [...gfx.off], lamps: litLamps() };
    await runBench({ ...SHORT, only: ['bugs + Controller'], switches: ['bloom off', 'pixel ratio 1.0', 'lamps off', 'AO off'] });
    const after = { fps: pacing.pacer.fps, scale: pacing.governor.scale, target: pacing.governor.target, ratio: R.getPixelRatio(), tier: gfx.quality, off: [...gfx.off], lamps: litLamps() };
    const same = JSON.stringify(before) === JSON.stringify(after);
    const kept = JSON.stringify({ ...localStorage }) === store;
    const loop = GAME.frame === frame && pacing.governor.sample === sample;
    const nothingQueued = queued() === q0;
    return ok(same && kept && loop && nothingQueued && run.dev, { before, after, nothingQueued, dev: run.dev, kept, loop });
  },
});
function litLamps() { let n = 0; G().APT.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; }

story('bench/never-sends-from-a-story', {
  phone: true,
  about: 'A bench results card opened from a story URL has Copy results and Back but no Send button, so a test never fills the developer\'s results table.',
  setup() {},
  play() {
    const el = showResults({ env: { build: 'v0', act: 1 }, moments: [{ name: 'quiet room', frames: 10, ms: 16.7 }] });
    offs.push(() => el.remove());
    const has = (k) => !!el.querySelector(`[data-bench=${k}]`);
    return ok(has('copy') && has('back') && !has('send'), { copy: has('copy'), back: has('back'), send: has('send') });
  },
});
