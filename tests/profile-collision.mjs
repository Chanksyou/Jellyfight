// Same seeded game and CPU workload, old versus current collision code. This is not phone FPS.
// node tests/profile-collision.mjs <baseline-git-ref>
import { execFileSync } from 'node:child_process';
import { start, openGame } from './lib.mjs';
import { DEFAULT_SEED } from '../src/story-random.mjs';

const ref = process.argv[2];
if (!ref) throw new Error('Supply the baseline Git ref, for example: node tests/profile-collision.mjs 5ba9476');
const baseline = execFileSync('git', ['show', `${ref}:src/collision.js`], { encoding: 'utf8' });
const env = await start();
try {
  const newPage = env.browser.newPage.bind(env.browser);
  for (const version of ['baseline', 'current']) {
    env.browser.newPage = async opts => {
      const page = await newPage(opts);
      if (version === 'baseline') await page.route('**/src/collision.js', r => r.fulfill({ body: baseline, contentType: 'text/javascript' }));
      return page;
    };
    const { page, errors } = await openGame(env, { seed: DEFAULT_SEED, viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const measurements = await page.evaluate(async () => {
      APT.renderer.setAnimationLoop(null);
      const K = await import('/src/stories/kit.js'), results = [];
      for (const count of [20, 40]) {
        K.setupFight({ bubbles: false, lash: false }); K.holdJelly(); gfx.setTier('low'); K.step(120);
        for (let i = 0; i < count; i++) {
          const a = i * 2.4, r = .08 + (i % 5) * .035;
          const e = K.spawn(['spider', 'roach', 'ants', 'mosquito'][i % 4], K.near(Math.cos(a) * r, Math.sin(a) * r)); e.shootT = 99;
        }
        const playerBody = { position: player.position, height: run.cfg.height, radius: player.cfg.radius }, times = [];
        for (let i = 0; i < 420; i++) {
          const start = performance.now();
          world.focus(player.position, 1 / 60); enemies.update(1 / 60, playerBody, i / 60);
          if (i >= 60) times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        results.push({ count, samples: times.length, mean: times.reduce((a,b) => a+b,0)/times.length, p95: times[Math.floor(times.length*.95)], max: times.at(-1), colliders: world.colliders.length });
      }
      return results;
    });
    console.log(JSON.stringify({ version, baseline: ref, seed: DEFAULT_SEED, measurements, errors }));
    await page.close();
    if (errors.length) throw new Error('Browser errors during profiling');
  }
} finally { await env.close(); }
