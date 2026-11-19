// Bug attack reel: each basic bug's attack, once landing and once going wide, filmed from the side and
// from above on a phone (844x390, stepped at 30 fps) and a desktop (1280x720, 60 fps) page, for
// before/after comparison of attack animation (plan: enemy-attack-anim). Same idea as motion-reel.mjs.
// The attacks are the ones the story attacks/animation-never-moves-a-hit plays (src/stories/bug-attack-motion.js,
// ATTACKS): a fixed seed, the jelly held still, then (miss) walked off the line two frames in.
//
//   node tools/bug-reel.mjs                          every attack, into .wrangler/bug-reel
//   node tools/bug-reel.mjs --only=wasp,mantis       those attacks (ids from ATTACKS, or a bug's type: dragonfly = both)
//   node tools/bug-reel.mjs --out=DIR                somewhere else (keep "before" apart from "after")
//   node tools/bug-reel.mjs --phone | --desktop      one page size
//   node tools/bug-reel.mjs --every=2                keep every 2nd stepped frame (default: 2 on phone, 4 on desktop: 15 per second of play)
//
// Writes DIR/<size>/<attack>-<hit|miss>/<view>/NNNN.png (cropped round the fight, from 0.4 s before the
// attack begins to 1.2 s after its hit test) and DIR/<size>-<attack>-<hit|miss>-<view>-sheet.png, a
// contact sheet with each frame's time from the attack's start. A reel takes about 10 minutes a size;
// write it locally, then copy to project files (/mnt/project-files/enemy-attack-anim/<task>/).
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',').filter(Boolean);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/bug-reel'));
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, fps: 30, every: 2, crop: { w: 440, h: 330 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } }, fps: 60, every: 4, crop: { w: 640, h: 480 } },
].filter((d) => !args.includes('--phone') && !args.includes('--desktop') || args.includes('--' + d.name));
const BEFORE = 0.4, AFTER = 1.2, VIEWS = ['side', 'above'];

const env = await start();
try {
  for (const size of SIZES) {
    const every = +(arg('every') || size.every), dt = 1 / size.fps;
    const { page, errors } = await openGame(env, size.opts);
    await page.evaluate(() => { APT.renderer.setAnimationLoop(null); });   // drawn by stepping the game, like the stories
    await page.addStyleTag({ content: 'body > :not(canvas) { visibility: hidden !important; }' });
    const ids = await page.evaluate(async () => (await import('/src/stories/bug-attack-motion.js')).ATTACKS.map((a) => [a.id, a.type]));
    const chosen = ids.filter(([id, type]) => !only || only.includes(id) || only.includes(type)).map(([id]) => id);
    if (!chosen.length) throw new Error(`no attack called ${only}: ${ids.map(([id]) => id).join(', ')}`);
    for (const id of chosen) for (const miss of [false, true]) {
      const name = `${id}-${miss ? 'miss' : 'hit'}`;
      // pass 1 finds the frames (the attack's start and its hit test); pass 2 replays it exactly and films
      const span = await page.evaluate(async ({ id, miss, dt }) => {
        const M = await import('/src/stories/bug-attack-motion.js'), S = M.stage(M.ATTACKS.find((a) => a.id === id), { miss, dt, hurt: true });
        // where the bug goes from its attack beginning to its hit test: the box the cameras frame (a bug that
        // attacks from far off, the Dragonfly, is framed on itself, not on the gap to the jelly)
        const P = [];
        try {
          while (S.frame < M.MAX_FRAMES * 2 && !S.found) { S.advance(); P.push([S.e.pos.x, S.e.pos.y, S.e.pos.z, S.e.r]); }
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (const [x, y, z, r] of P.slice(Math.max(0, S.begun))) { lo[0] = Math.min(lo[0], x - r); lo[1] = Math.min(lo[1], y - r); lo[2] = Math.min(lo[2], z - r); hi[0] = Math.max(hi[0], x + r); hi[1] = Math.max(hi[1], y + r); hi[2] = Math.max(hi[2], z + r); }
          return { begun: S.begun, hit: S.begun + (S.found?.frames ?? 0), ok: !!S.found, lo, hi };
        } finally { S.done(); }
      }, { id, miss, dt });
      if (!span.ok) { console.log(`${size.name} ${name}: no hit test seen, skipped`); continue; }
      const first = Math.max(0, span.begun - Math.round(BEFORE / dt)), last = span.hit + Math.round(AFTER / dt);
      const dirs = Object.fromEntries(VIEWS.map((v) => [v, path.join(out, size.name, name, v)]));
      for (const d of Object.values(dirs)) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
      await page.evaluate(async ({ id, miss, dt }) => {
        const M = await import('/src/stories/bug-attack-motion.js');
        window.__bug = M.stage(M.ATTACKS.find((a) => a.id === id), { miss, dt, hurt: true });
      }, { id, miss, dt });
      const times = [], { w, h } = size.crop, vp = size.opts.viewport;
      for (let f = 0; f <= last; f++) {
        await page.evaluate(() => { window.__bug.advance(); });
        if (f < first || (f - first) % every) continue;
        for (const view of VIEWS) {
          await page.evaluate(({ view, lo, hi }) => {
            const camera = window.tpc.camera;
            // fixed on the box the bug fills (pass 1), far enough back to hold all of it
            const p = new window.THREE.Vector3((lo[0] + hi[0]) / 2, Math.max((lo[1] + hi[1]) / 2, window.player.position.y + 0.05), (lo[2] + hi[2]) / 2);   // (never down at the floor: eye level with the jelly at least)
            const wide = Math.max(hi[0] - lo[0], (hi[1] - lo[1]) * 1.4, hi[2] - lo[2]), back = Math.max(0.3, wide * 0.9);
            if (view === 'side') { camera.position.set(p.x, p.y, hi[2] + back); camera.up.set(0, 1, 0); }
            else { camera.position.set(p.x, hi[1] + back, p.z + 0.001); camera.up.set(0, 0, -1); }
            camera.lookAt(p);
            camera.updateMatrixWorld(true);
            window.GAME.render();
          }, { view, lo: span.lo, hi: span.hi });
          await page.screenshot({ path: path.join(dirs[view], String(times.length).padStart(4, '0') + '.png'), clip: { x: (vp.width - w) / 2, y: (vp.height - h) / 2, width: w, height: h } });
        }
        times.push(((f - span.begun) * dt).toFixed(2));
      }
      await page.evaluate(() => { window.__bug.done(); });
      for (const view of VIEWS) await sheet(page, dirs[view], path.join(out, `${size.name}-${name}-${view}-sheet.png`), size.crop, times);
      console.log(`${size.name} ${name}: ${times.length} frames (attack begins at ${(span.begun * dt).toFixed(2)} s, hit test ${(span.hit * dt).toFixed(2)} s)`);
    }
    if (errors.length) console.log(`${size.name} page errors:\n  ` + errors.slice(0, 5).join('\n  '));
    await page.close();
  }
} finally {
  await env.close();
}

// every kept frame in a grid, with its time from the attack's start (0.00 s = first attack frame), drawn in a blank page
async function sheet(page, dir, file, crop, times) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const cols = 8, scale = 0.5, w = Math.round(crop.w * scale), h = Math.round(crop.h * scale);
  const urls = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
  const b64 = await page.evaluate(async ({ urls, cols, w, h, times }) => {
    const c = document.createElement('canvas');
    c.width = cols * w; c.height = Math.ceil(urls.length / cols) * h;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.font = '11px sans-serif'; g.fillStyle = '#fff';
    await Promise.all(urls.map(async (u, i) => {
      const img = new Image(); img.src = u; await img.decode();
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      g.drawImage(img, x, y, w, h);
      g.fillText(times[i] + 's', x + 4, y + 12);
    }));
    return c.toDataURL('image/png').split(',')[1];
  }, { urls, cols, w, h, times });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}
