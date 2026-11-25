// A clip of the jelly swimming through the ground mist (src/mist.js): the hole round it, the trail that curls and fills
// back in. Stills can't show this, so it writes frames, a 6-frame strip and (with ffmpeg on the PATH) an .mp4 and a .gif.
//
//   node tools/mist-clip.mjs              act 3, phone and desktop, into .wrangler/mist-clip
//   node tools/mist-clip.mjs 1            another act
//   node tools/mist-clip.mjs --phone | --desktop | --low | --calm | --shuttle | --out=DIR | --secs=4
//
// Uses the test runner's Playwright and three.js (tests/lib.mjs). A software renderer: looks only, never a frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const act = Number(args.find((a) => /^\d$/.test(a)) || 3);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/mist-clip'));
const tier = args.includes('--low') ? 'low' : 'medium', calm = args.includes('--calm'), secs = +arg('secs') || 4, FPS = 15;
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
];
const picked = SIZES.filter((d) => args.includes('--' + d.name));
// the swim across open floor: from x,z to x,z (a lazy S either side of the line), at --speed m/s, then a stop to watch it fill in
// and whether the camera looks across it (the jelly crosses the screen) or along it (act 3's strip of floor is too narrow to look across)
const PATH = { 1: [3.7, 3.3, 2.6, 3.3, 'across'], 2: [1.6, 6.6, 0.4, 6.6, 'across'], 3: [1.4, 8.55, -0.2, 8.55, 'along'], 4: [3.7, 3.3, 2.6, 3.3, 'across'] };
const speed = +arg('speed') || 0.7, shuttle = args.includes('--shuttle');   // --shuttle: quick dashes back and forth along the first 40 cm, every 0.5 s
fs.mkdirSync(out, { recursive: true });

const env = await start();
try {
  for (const device of picked.length ? picked : SIZES) {
    const { page, errors } = await openGame(env, { ...device.opts, act: { act } });
    await page.evaluate(async ([tier, calm]) => { APT.renderer.setAnimationLoop(null); gfx.setQuality(tier); await gfx.ready; (await import('/src/juice.js')).juice.calm = calm; }, [tier, calm]);
    const dir = path.join(out, `act${act}-${device.name}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(async ([p, speed, shuttle]) => {
      const { fresh, tp, step, stub } = await import('/src/stories/kit.js');
      fresh({ elites: false, bubbles: false, lash: false });
      for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
      const yaw = p[4] === 'along' ? Math.atan2(-(p[2] - p[0]), -(p[3] - p[1])) : Math.atan2(-(p[3] - p[1]), p[2] - p[0]);
      tp(p[0], 0.05, p[1], yaw);
      step(30);
      const P = window.player, len = Math.hypot(p[2] - p[0], p[3] - p[1]), ux = (p[2] - p[0]) / len, uz = (p[3] - p[1]) / len;
      let s = 0;
      const real = P.update;
      stub(P, 'update', function (dt, ...rest) {   // the swim, scripted: along the line with a sideways S, then still (the real update still poses the jelly)
        const was = P.position.clone();
        real.call(this, dt, ...rest);
        s = shuttle ? Math.min(0.4, Math.max(0, s + (Math.floor((P.t = (P.t || 0) + dt) / 0.5) % 2 ? -1 : 1) * 1.2 * dt)) : Math.min(len, s + speed * dt);
        const side = 0.15 * Math.sin((s / len) * Math.PI * 2);
        P.position.set(p[0] + ux * s - uz * side, 0.05, p[1] + uz * s + ux * side);
        P.velocity.copy(P.position).sub(was).divideScalar(dt);
      });
    }, [PATH[act], speed, shuttle]);
    const frames = Math.round(secs * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(async () => {
        const { step } = await import('/src/stories/kit.js');
        step(4);
        window.GAME.render();
      });
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`), timeout: 180000 });
    }
    // a strip of six frames for a chat that can't play video
    const pick = [0, 1, 2, 3, 4, 5].map((k) => path.join(dir, `f${String(Math.round(k * (frames - 1) / 5)).padStart(3, '0')}.png`));
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', path.join(out, `act${act}-${device.name}.mp4`)]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-vf', 'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', path.join(out, `act${act}-${device.name}.gif`)]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...pick.flatMap((f) => ['-i', f]), '-filter_complex', `${pick.map((_, k) => `[${k}]scale=640:-1[s${k}]`).join(';')};${pick.map((_, k) => `[s${k}]`).join('')}xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0`, path.join(out, `act${act}-${device.name}-strip.jpg`)]);
    } catch (e) { console.log('ffmpeg:', e.message.split('\n')[0]); }
    console.log(`act ${act} ${device.name}: ${dir}`);
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
    await page.close();
  }
} finally { await env.close(); }
