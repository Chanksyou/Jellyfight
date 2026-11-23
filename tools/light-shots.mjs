// Screenshots of the baked light (src/baked-light.js): each act from a few spots, on a phone held sideways
// (844x390) and a desktop (1280x720), once with every lamp live (as before the bake) and once baked, plus a
// side-by-side of the two. The before/after pictures for the baked-lighting work (/mnt/project-files/baked-lighting/).
//
//   node tools/light-shots.mjs                 every act, phone and desktop, into .wrangler/light-shots
//   node tools/light-shots.mjs 3 4             just those acts
//   node tools/light-shots.mjs --phone | --desktop | --low | --out=DIR
//   node tools/light-shots.mjs --shell        only the walls, floors and ceilings (furniture hidden): to match the bake's brightness to the live lamps
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs). A software renderer: looks only, never a frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const acts = args.filter((a) => /^\d$/.test(a)).map(Number);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/light-shots'));
const shellOnly = args.includes('--shell'), gain = +(arg('gain') || 1);   // --gain=0.5: try a brightness before baking it in
const tier = args.includes('--low') ? 'low' : args.includes('--high') ? 'high' : 'medium';
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
const H2 = Math.PI / 2;
// where the jelly stands (x, y, z, heading) and how the camera looks: play (the game's own view) or low (a wider look across the room)
const VIEWS = {
  1: { play: [2.4, 0.05, 2.6, Math.PI * 0.8, 'play'], room: [3.2, 0.05, 3.6, Math.PI * 0.85, 'low'] },
  2: { play: [0.9, 0.05, 6.6, Math.PI, 'play'], hall: [2.6, 0.05, 6.4, Math.PI, 'low'] },
  3: { play: [1.0, 0.05, 8.85, H2, 'play'], room: [1.0, 0.05, 8.85, H2, 'low'] },
  4: { play: [2.4, 0.05, 2.6, Math.PI * 0.8, 'play'], room: [3.2, 0.05, 3.6, Math.PI * 0.85, 'low'], late: [3.2, 0.05, 3.6, Math.PI * 0.85, 'low', 'late'] },   // late: 8 AM, the end of the dawn
};
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const act of acts.length ? acts : [1, 2, 3, 4]) for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act } });
    await page.evaluate(async (tier) => { APT.renderer.setAnimationLoop(null); gfx.setQuality(tier); await gfx.ready; }, tier);
    for (const [name, v] of Object.entries(VIEWS[act])) {
      const files = [];
      for (const baked of [false, true]) {
        await page.evaluate(async ([v, baked, shellOnly, gain]) => {
          const { fresh, tp, step } = await import('/src/stories/kit.js');
          const { setBakedLight, BAKED_LIGHT } = await import('/src/baked-light.js');
          fresh({ elites: false, bubbles: false, lash: false });
          for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
          setBakedLight(baked);
          BAKED_LIGHT.uniforms.lbGain.value *= gain;
          if (shellOnly) {
            APT.root.traverse((o) => { if (o.isMesh && !o.userData.structural) o.visible = false; });
            for (const b of window.statics.batches) b.batch.visible = b.pieces.every((p) => p.mesh.userData.structural);
          }
          tp(v[0], v[1], v[2], v[3]);
          if (v[4] === 'low') { tpc.pitch = 0.42; tpc.distance = 1.1; }
          if (v[5] === 'late') { window.run.t = window.run.duration; window.run.nightT = 0; }
          step(40);
          window.GAME.render();
        }, [v, baked, shellOnly, gain]);
        await page.waitForTimeout(200);
        const file = path.join(out, `act${act}-${name}-${device.name}${shellOnly ? '-shell' : ''}-${baked ? 'baked' : 'live'}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: 180000 });
        files.push(file);
      }
      // the two side by side, live on the left
      const both = await page.evaluate(async (pics) => {
        const imgs = await Promise.all(pics.map((b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + b64; })));
        const c = document.createElement('canvas'); c.width = imgs[0].width * 2 + 8; c.height = imgs[0].height;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(imgs[0], 0, 0); x.drawImage(imgs[1], imgs[0].width + 8, 0);
        return c.toDataURL('image/jpeg', 0.88).split(',')[1];
      }, files.map((f) => fs.readFileSync(f).toString('base64')));
      fs.writeFileSync(path.join(out, `act${act}-${name}-${device.name}${shellOnly ? '-shell' : ''}.jpg`), Buffer.from(both, 'base64'));
      console.log(`act ${act} ${name} ${device.name}`);
    }
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
