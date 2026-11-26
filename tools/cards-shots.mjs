// A/B pictures for act 2's see-through trims (phone performance round 2, G2): the tub's non-slip mat as a see-through layer
// against a cut-out, and the room's soft-shadow cards (the batches of flat see-through shadows under furniture) on against off.
//
//   node tools/cards-shots.mjs [--out=DIR]      phone and desktop, into .wrangler/cards-shots
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';
import { PAGES } from '../src/bench-moments.js';

const out = path.resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) || path.join(ROOT, '.wrangler/cards-shots'));
fs.mkdirSync(out, { recursive: true });
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const MOMENTS = ['Clog acid', 'Soap angry', 'quiet room'];
const env = await start();
try {
  for (const device of SIZES) {
    const { page } = await openGame(env, { ...device.opts, ...PAGES.act2, seed: 1 });
    await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); });
    for (const moment of MOMENTS) {
      const shots = [], labels = [];
      for (const variant of ['as now', 'mat see-through (before)', 'no shadow cards']) {
        if (variant.startsWith('mat') && moment !== 'Clog acid') continue;
        await page.evaluate(async ([moment, variant]) => {
          const K = await import('/src/stories/kit.js'), BM = await import('/src/bench-moments.js'), NAV = (await import('/src/stages.js')).nav;
          BM.MOMENTS.act2[moment]({ K, G: window, nav: NAV });
          for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
          K.step(60);
          if (variant.startsWith('mat')) APT.scene.traverse((o) => { if (o.isMesh && o.material?.alphaTest === 0.5 && o.material.map) { o.material.alphaTest = 0; o.material.transparent = true; o.material.needsUpdate = true; } });
          if (variant === 'no shadow cards') for (const b of statics.batches) if (b.batch.material.transparent) b.batch.visible = false;
          K.step(3); GAME.render();
        }, [moment, variant]);
        await page.waitForTimeout(200);
        const f = path.join(out, `${moment.replace(/ /g, '-')}-${device.name}-${variant.replace(/[^a-z]+/gi, '-')}.png`);
        await page.screenshot({ path: f, timeout: 180000 });
        shots.push(fs.readFileSync(f).toString('base64')); labels.push(variant);
      }
      const jpg = await page.evaluate(async ([pics, labels]) => {
        const imgs = await Promise.all(pics.map((b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; })));
        const w = imgs[0].width, h = imgs[0].height, c = document.createElement('canvas'); c.width = w * imgs.length + 8 * (imgs.length - 1); c.height = h;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        imgs.forEach((im, i) => { x.drawImage(im, i * (w + 8), 0); x.font = `${Math.round(h / 16)}px sans-serif`; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(labels[i], i * (w + 8) + 10, h / 10); x.fillText(labels[i], i * (w + 8) + 10, h / 10); });
        return c.toDataURL('image/jpeg', 0.88).split(',')[1];
      }, [shots, labels]);
      fs.writeFileSync(path.join(out, `${moment.replace(/ /g, '-')}-${device.name}.jpg`), Buffer.from(jpg, 'base64'));
      console.log(moment, device.name);
    }
    await page.close();
  }
} finally { await env.close(); }
