// Bug attack animation bench (plan: enemy-attack-anim): the JS time all the bugs' `anim` calls take in a
// frame, and what they allocate, with 20 basic bugs (every attack, mixed) fighting a jelly that is held
// still and can't die, on the phone page (844x390, touch) under a 4x CPU slowdown. Run it before and after
// an attack animation change and put both in the pull request.
//
//   node tools/bug-anim-bench.mjs                  600 frames, medium graphics
//   node tools/bug-anim-bench.mjs --frames=1200    more frames
//   node tools/bug-anim-bench.mjs --throttle=1     no CPU slowdown
//   node tools/bug-anim-bench.mjs --json=out.json  also write the numbers
//
// Headless Chromium draws with SwiftShader, so only the JS side is measured (the game step; nothing is
// rendered). The times are this machine's, so compare runs from the same machine: run main first, then
// your branch, back to back. Each `anim` is timed with two performance.now() calls round it (the same
// overhead in both runs). A wasp stings itself to death, so dead bugs are replaced by a fresh one of the
// same kind, and the nest has no attack so it isn't there.
import fs from 'node:fs';
import { start, openGame } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const FRAMES = +arg('frames', 600), THROTTLE = +arg('throttle', 4), JSON_OUT = arg('json', '');
const KINDS = ['roach', 'ants', 'mosquito', 'lanternfly', 'housefly', 'spider', 'millipede', 'ladybug', 'dragonfly', 'mantis', 'worm', 'beetle', 'wasp', 'moth', 'firefly', 'cicada'];
const COUNT = 20, WARM = 120;

const env = await start();
try {
  const { page, errors } = await openGame(env, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, seed: 1 });
  await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); await (window.gfx.ready || Promise.resolve()); });
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(async ({ KINDS, COUNT }) => {
    const K = await import('/src/stories/kit.js');
    window.K = K;
    K.fresh({ elites: false, bubbles: false, lash: false });
    K.tp(3.2, 0.05, 3.0, 0);
    K.holdJelly();
    K.stub(window.run, 'hurt', () => {}); window.run.health = 1e6;
    window.__bench = { mix: [], acc: 0 };
    const B = window.__bench;
    // one wrapper per bug, timing its anim; a replacement for any that died
    B.fill = () => {
      for (let i = 0; i < COUNT; i++) {
        const kind = KINDS[i % KINDS.length];
        if (B.mix[i] && !B.mix[i].dead) continue;
        const a = (i / COUNT) * Math.PI * 2, r = 0.25 + (i % 3) * 0.1;
        const e = K.spawn(kind, K.near(Math.cos(a) * r, Math.sin(a) * r), { hp: 1e9 });
        if (e.anim) { const f = e.anim, w = (dt, x) => { const t = performance.now(); f(dt, x); B.acc += performance.now() - t; }; w.reset = f.reset; e.anim = w; }
        B.mix[i] = e;
      }
    };
    B.fill();
  }, { KINDS, COUNT });
  await page.evaluate(() => { for (let i = 0; i < 60; i++) { window.__bench.fill(); window.GAME.step(1 / 60); } });   // let them settle
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const m = await page.evaluate(({ N, WARM }) => {
    const B = window.__bench, animMs = [], stepMs = [], busy = [];
    for (let i = 0; i < WARM + N; i++) {
      B.fill(); B.acc = 0;
      const t0 = performance.now(); window.GAME.step(1 / 60); const t1 = performance.now();
      if (i < WARM) continue;
      animMs.push(B.acc); stepMs.push(t1 - t0);
      busy.push(B.mix.filter((e) => e && !e.dead && e.state && !['approach', 'idle', 'rest'].includes(e.state) || e && e.aimT > 0).length);
    }
    const q = (a, k) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(k * s.length))].toFixed(3); };
    return { animMs: { median: q(animMs, 0.5), p95: q(animMs, 0.95), max: q(animMs, 1) }, stepMs: { median: q(stepMs, 0.5), p95: q(stepMs, 0.95) }, inAttack: { mean: +(busy.reduce((a, b) => a + b, 0) / busy.length).toFixed(1), max: Math.max(...busy) }, bugs: B.mix.filter((e) => e && !e.dead).length };
  }, { N: FRAMES, WARM });
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // allocation by site, over the sampled frames (the warm-up too: WARM + FRAMES)
  const n = FRAMES + WARM, sites = new Map(); let total = 0, anim = 0;
  const walk = (x) => {
    if (x.selfSize) {
      const f = x.callFrame, k = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/src\//, 'src/').replace(/^.*\/three\.\w+\.js/, 'three')}:${f.lineNumber + 1}`;
      sites.set(k, (sites.get(k) || 0) + x.selfSize); total += x.selfSize;
      if (/critters\.js|attack-motion\.js/.test(f.url)) anim += x.selfSize;
    }
    x.children.forEach(walk);
  };
  walk(profile.head);
  m.allocKBPerFrame = { all: +(total / n / 1024).toFixed(2), inBugBuilders: +(anim / n / 1024).toFixed(3) };
  m.topAlloc = [...sites].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${(v / n / 1024).toFixed(2)} KB/f ${k}`);
  m.config = { frames: FRAMES, throttle: THROTTLE, bugs: COUNT, kinds: KINDS.length };
  console.log(`anim JS per frame: median ${m.animMs.median} ms, p95 ${m.animMs.p95} ms, max ${m.animMs.max} ms (${THROTTLE}x slowdown); game step median ${m.stepMs.median} ms, p95 ${m.stepMs.p95} ms`);
  console.log(`bugs ${m.bugs}, mid-attack per frame ${m.inAttack.mean} (most ${m.inAttack.max}); allocation ${m.allocKBPerFrame.all} KB/frame in all, ${m.allocKBPerFrame.inBugBuilders} KB/frame inside critters.js / attack-motion.js`);
  console.log(m.topAlloc.join('\n'));
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(m, null, 1));
  if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 5).join('\n  '));
} finally { await env.close(); }
