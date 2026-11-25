// Screenshots of the ground mist (src/mist.js): each act from the play view and a flat boss-fight view, on a phone
// held sideways (844x390) and a desktop (1280x720), with the mist off on the left and on on the right.
//
//   node tools/mist-shots.mjs                 every act, phone and desktop, into .wrangler/mist-shots
//   node tools/mist-shots.mjs 3 4             just those acts
//   node tools/mist-shots.mjs --phone | --desktop | --low | --out=DIR | --k=3.6   (--k: try a thickness before baking it into look.css)
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs). A software renderer: looks only, never a frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const acts = args.filter((a) => /^\d$/.test(a)).map(Number);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/mist-shots'));
const tier = args.includes('--low') ? 'low' : args.includes('--high') ? 'high' : 'medium';
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
const H2 = Math.PI / 2;
// where the jelly stands (x, y, z, heading) and how the camera looks: play (the game's own view) or flat (low and level, a boss fight's angle)
const VIEWS = {
  1: { play: [2.4, 0.05, 2.6, Math.PI * 0.8, 'play'], flat: [3.2, 0.05, 3.6, Math.PI * 0.85, 'flat'] },
  2: { play: [0.9, 0.05, 6.6, Math.PI, 'play'], flat: [2.6, 0.05, 6.4, Math.PI, 'flat'] },
  3: { play: [1.0, 0.05, 8.85, H2, 'play'], flat: [1.0, 0.05, 8.85, H2, 'flat'] },
  4: { play: [2.4, 0.05, 2.6, Math.PI * 0.8, 'play'], flat: [3.2, 0.05, 3.6, Math.PI * 0.85, 'flat'], late: [2.4, 0.05, 2.6, Math.PI * 0.8, 'play', 'late'] },
};
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const act of acts.length ? acts : [1, 2, 3, 4]) for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act } });
    await page.evaluate(async (tier) => { APT.renderer.setAnimationLoop(null); gfx.setQuality(tier); await gfx.ready; }, tier);
    for (const [name, v] of Object.entries(VIEWS[act])) {
      const files = [];
      for (const on of [false, true]) {
        await page.evaluate(async ([v, on, k]) => {
          const { fresh, tp, step } = await import('/src/stories/kit.js');
          const { MIST } = await import('/src/mist.js');
          fresh({ elites: false, bubbles: false, lash: false });
          for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
          if (MIST.was === undefined) MIST.was = MIST.uniforms.mistK.value;
          tp(v[0], v[1], v[2], v[3]);
          if (v[4] === 'flat') { tpc.pitch = 0.2; tpc.distance = 1.1; }
          if (v[5] === 'late') { window.run.t = window.run.duration; window.run.nightT = 0; }
          step(40);
          MIST.uniforms.mistK.value = on ? (k || MIST.was) : 0;
          window.GAME.render();
        }, [v, on, +arg('k') || 0]);
        await page.waitForTimeout(200);
        const file = path.join(out, `act${act}-${name}-${device.name}-${on ? 'mist' : 'off'}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: 180000 });
        files.push(file);
      }
      const both = await page.evaluate(async (pics) => {
        const imgs = await Promise.all(pics.map((b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + b64; })));
        const c = document.createElement('canvas'); c.width = imgs[0].width * 2 + 8; c.height = imgs[0].height;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(imgs[0], 0, 0); x.drawImage(imgs[1], imgs[0].width + 8, 0);
        return c.toDataURL('image/jpeg', 0.88).split(',')[1];
      }, files.map((f) => fs.readFileSync(f).toString('base64')));
      fs.writeFileSync(path.join(out, `act${act}-${name}-${device.name}.jpg`), Buffer.from(both, 'base64'));
      console.log(`act ${act} ${name} ${device.name}`);
    }
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
