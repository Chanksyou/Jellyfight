// Screenshots of the plain bubble (src/bubble-film.js): a row of bubbles and a golden one in the air on their
// way to a still roach, in acts 1, 2 and 4, on a phone held sideways (844x390) and a desktop (1280x720). Each
// picture is the play view with a 3x close-up of the bubbles beside it.
//
//   node tools/bubble-shots.mjs                every act, phone and desktop, Medium, into .wrangler/bubble-shots
//   node tools/bubble-shots.mjs 1 --low        just act 1, on Low
//   node tools/bubble-shots.mjs --sheet        act 1 at three drawn sizes (--bubble-draw 1.6, 2, 2.4), side by side
//   --phone | --desktop | --out=DIR | --draw=2.4 (try a size before putting it in look.css)
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs). A software renderer: looks only, never a frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const sheet = args.includes('--sheet');
const acts = sheet ? [1] : args.filter((a) => /^\d$/.test(a)).map(Number);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/bubble-shots'));
const tier = args.includes('--low') ? 'low' : args.includes('--high') ? 'high' : 'medium';
const draws = sheet ? [1.6, 2, 2.4] : [+arg('draw') || 0];
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
// where the jelly stands (x, y, z, heading): an open floor with the room behind
const SPOT = { 1: [2.4, 0.05, 2.6, Math.PI * 0.8], 2: [0.9, 0.05, 6.6, Math.PI], 4: [2.4, 0.05, 2.6, Math.PI * 0.8] };
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const act of acts.length ? acts : [1, 2, 4]) for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act } });
    await page.evaluate(async (tier) => { APT.renderer.setAnimationLoop(null); gfx.setQuality(tier); await gfx.ready; }, tier);
    const pics = [];
    for (const draw of draws) {
      const box = await page.evaluate(async ([v, draw]) => {
        const { fresh, tp, step, spawn, stub, V } = await import('/src/stories/kit.js');
        fresh({ elites: false, lash: false });
        for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
        tp(v[0], v[1], v[2], v[3]);
        step(30);
        const B = run.bubbles, cam = APT.camera;
        stub(B, 'volley', () => false);
        if (draw) B.draw = draw;
        const fwd = cam.getWorldDirection(V(0, 0, 0)).setY(0).normalize(), side = V(-fwd.z, 0, fwd.x);
        const bell = player.position.clone().setY(player.position.y + run.cfg.height * 0.75);
        const e = spawn('roach', player.position.clone().addScaledVector(fwd, 0.32), { still: true, hp: 9999 });
        for (const k of [-1, 0, 1]) B.blow(bell.clone().addScaledVector(side, k * 0.017), e, { size: run.S.bubbleSize, dmg: 1, pierce: 1, off: side.clone().multiplyScalar(k * 0.017) });
        step(9);
        B.blow(bell.clone().addScaledVector(side, 0.01), e, { size: run.S.bubbleSize, dmg: 1, pierce: 1, golden: true });
        step(9);
        for (const b of B.list) b.speed = 0, b.vel.set(0, 0, 0);
        window.GAME.render();
        // the bubbles' box on screen, padded, as a share of the canvas
        const pts = B.list.map((b) => b.m.position.clone().project(cam));
        const xs = pts.map((p) => (p.x + 1) / 2), ys = pts.map((p) => (1 - p.y) / 2);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        return { cx, cy };
      }, [SPOT[act], draw]);
      await page.waitForTimeout(200);
      const shot = (await page.screenshot({ type: 'jpeg', quality: 90, timeout: 180000 })).toString('base64');
      pics.push({ shot, box, draw });
    }
    // each picture beside a 3x close-up of its bubbles; a sheet stacks its sizes
    const joined = await page.evaluate(async (pics) => {
      const imgs = await Promise.all(pics.map((p) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + p.shot; })));
      const W = imgs[0].width, H = imgs[0].height, Z = 3, cw = W / Z / 2, ch = H / Z;
      const c = document.createElement('canvas'); c.width = W + W / 2 + 8; c.height = (H + 8) * imgs.length - 8;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
      imgs.forEach((img, i) => {
        const y = i * (H + 8), { cx, cy } = pics[i].box;
        x.drawImage(img, 0, y);
        const sx = Math.max(0, Math.min(W - cw, cx * W - cw / 2)), sy = Math.max(0, Math.min(H - ch, cy * H - ch / 2));
        x.drawImage(img, sx, sy, cw, ch, W + 8, y, W / 2, H);
        if (pics[i].draw) { x.fillStyle = '#fff'; x.font = `${Math.round(H / 18)}px sans-serif`; x.fillText(`--bubble-draw: ${pics[i].draw}`, W + 20, y + H / 12); }
      });
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    }, pics);
    const name = sheet ? `size-sheet-${device.name}` : `act${act}-${tier}-${device.name}`;
    fs.writeFileSync(path.join(out, `${name}.jpg`), Buffer.from(joined, 'base64'));
    console.log(name);
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
