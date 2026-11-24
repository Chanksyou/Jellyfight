// Act 1's media console strip glow, on a phone and a desktop. node tools/console-shots.mjs [--out=DIR]
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';
const out = path.resolve((process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(ROOT, '.wrangler/console-shots'));
fs.mkdirSync(out, { recursive: true });
const env = await start();
try {
  for (const [name, opts] of [['phone', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1280, height: 720 } }]]) {
    const { page } = await openGame(env, { ...opts, act: { act: 1 } });
    await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); await gfx.ready; });
    for (const on of [false, true]) {
      await page.evaluate(async (on) => {
        const { fresh, tp, step } = await import('/src/stories/kit.js');
        fresh({ elites: false, bubbles: false, lash: false });
        for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
        window.floorLight.pools.forEach((p) => { if (p.kind === 'strip') p.mesh.visible = on; });
        tp(1.65, 0.05, 3.2, Math.PI);
        tpc.pitch = 0.5; tpc.distance = 4.2;
        step(40);
        APT.camera.position.set(1.65, 1.15, 3.2); APT.camera.lookAt(1.65, 0.9, 4.83); APT.camera.updateMatrixWorld(true);   // look at the wall above the console
        window.GAME.render();
      }, on);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `${name}-${on ? 'with' : 'without'}-strip.jpg`), type: 'jpeg', quality: 88, timeout: 180000 });
    }
  }
} finally { await env.stop?.(); }
process.exit(0);
