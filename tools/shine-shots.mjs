// Screenshots to pick --baked-shine-roughness (src/baked-ao.js): each act from a spot or two on a phone held sideways
// (844x390) and a desktop (1280x720), at every threshold side by side, plus how many pixels differ from "as shipped".
//
//   node tools/shine-shots.mjs                       every act, phone and desktop, into .wrangler/shine-shots
//   node tools/shine-shots.mjs 1 3 | --phone | --desktop | --out=DIR | --levels=2,0.5,0.35,0
//
// 2 is every lamp kept (as shipped), 0 skips every lamp on baked surfaces. Uses the test runner's Playwright (tests/lib.mjs).
// A software renderer: looks only, never a frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const acts = args.filter((a) => /^\d$/.test(a)).map(Number);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/shine-shots'));
const levels = (arg('levels') || '2,0.5,0.35,0').split(',').map(Number);
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
const H2 = Math.PI / 2;
// x, y, z, heading, camera. Act 1 by the pink console, act 2 on the tiles, act 3 by the bed, act 4 at dawn
const VIEWS = {
  1: { console: [0.9, 0.05, 1.2, Math.PI * 0.8, 'low'], room: [3.2, 0.05, 3.6, Math.PI * 0.85, 'low'] },
  2: { tiles: [0.9, 0.05, 6.6, Math.PI, 'low'], hall: [2.6, 0.05, 6.4, Math.PI, 'low'] },
  3: { bed: [1.0, 0.05, 8.85, H2, 'low'] },
  4: { dawn: [3.2, 0.05, 3.6, Math.PI * 0.85, 'low', 'late'] },
};
fs.mkdirSync(out, { recursive: true });
const env = await start();
try {
  for (const act of acts.length ? acts : [1, 2, 3, 4]) for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act } });
    await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); gfx.setQuality('medium'); await gfx.ready; });
    for (const [name, v] of Object.entries(VIEWS[act])) {
      const shots = [];
      for (const level of levels) {
        await page.evaluate(async ([v, level]) => {
          const { fresh, tp, step } = await import('/src/stories/kit.js');
          const { BAKED_AO } = await import('/src/baked-ao.js');
          fresh({ elites: false, bubbles: false, lash: false });
          for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
          BAKED_AO.uniforms.bakedShine.value = level;
          tp(v[0], v[1], v[2], v[3]);
          if (v[4] === 'low') { tpc.pitch = 0.42; tpc.distance = 1.1; }
          if (v[5] === 'late') { window.run.t = window.run.duration; window.run.nightT = 0; }
          step(40);
          window.GAME.render();
        }, [v, level]);
        await page.waitForTimeout(200);
        shots.push(fs.readFileSync(await (async () => { const f = path.join(out, `act${act}-${name}-${device.name}-${level}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 180000 }); return f; })()).toString('base64'));
      }
      // a labelled strip, "as shipped" first, and the share of pixels that differ by more than 8 of 255 from it
      const res = await page.evaluate(async ([pics, levels]) => {
        const imgs = await Promise.all(pics.map((b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + b64; })));
        const w = imgs[0].width, h = imgs[0].height, cols = imgs.length > 2 ? 2 : imgs.length, rows = Math.ceil(imgs.length / cols);
        const c = document.createElement('canvas'); c.width = w * cols + 8 * (cols - 1); c.height = h * rows + 8 * (rows - 1);
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        const px = (img) => { const t = document.createElement('canvas'); t.width = w; t.height = h; const g = t.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
        const base = px(imgs[0]), diffs = [];
        imgs.forEach((img, i) => {
          x.drawImage(img, (i % cols) * (w + 8), Math.floor(i / cols) * (h + 8));
          x.font = `${Math.round(h / 18)}px sans-serif`; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3;
          const label = levels[i] >= 2 ? 'as shipped (every lamp)' : levels[i] === 0 ? 'no lamp shine on baked' : `roughness under ${levels[i]} keeps shine`;
          x.strokeText(label, (i % cols) * (w + 8) + 10, Math.floor(i / cols) * (h + 8) + h / 12); x.fillText(label, (i % cols) * (w + 8) + 10, Math.floor(i / cols) * (h + 8) + h / 12);
          const d = px(img); let n = 0;
          for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - base[k]) + Math.abs(d[k + 1] - base[k + 1]) + Math.abs(d[k + 2] - base[k + 2]) > 24) n++;
          diffs.push(+(100 * n / (w * h)).toFixed(1));
        });
        return { jpg: c.toDataURL('image/jpeg', 0.88).split(',')[1], diffs };
      }, [shots, levels]);
      fs.writeFileSync(path.join(out, `act${act}-${name}-${device.name}.jpg`), Buffer.from(res.jpg, 'base64'));
      console.log(`act ${act} ${name} ${device.name}: % pixels changed ${levels.map((l, i) => `${l}=${res.diffs[i]}`).join('  ')}`);
    }
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
