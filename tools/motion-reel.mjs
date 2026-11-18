// Motion reel: the same scripted minute of jelly movement, filmed from the side and from above, on a
// phone (844x390) and a desktop (1280x720) page, for before/after comparison of motion work.
// The script runs at a fixed 1/30 s step, so a reel is repeatable: idle 3 s, swim off and cruise,
// a 90 degree turn, stop, jump and land, then one Lash at a still roach.
//
//   node tools/motion-reel.mjs                       the Normal look, into .wrangler/motion-reel
//   node tools/motion-reel.mjs --only=box,lion       those species (character.js SPECIES), one reel each
//   node tools/motion-reel.mjs --out=DIR             somewhere else (keep the "before" apart from the "after")
//   node tools/motion-reel.mjs --phone | --desktop   one page size
//   node tools/motion-reel.mjs --every=3             contact sheet takes every 3rd frame (default 3)
//
// Writes, per page size / species: DIR/<size>/<species>/<view>/NNNN.png (every frame, cropped round
// the jelly), DIR/<size>-<species>-<view>-sheet.png (contact sheet) and, when ffmpeg is installed,
// DIR/<size>-<species>-<view>.webm. Uses the test runner's Playwright and three.js (tests/lib.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',').filter(Boolean);
const out = path.resolve(arg('out') || path.join(ROOT, '.wrangler/motion-reel'));
const every = Math.max(1, +(arg('every') || 3));
const DT = 1 / 30;
const SIZES = [
  { name: 'phone', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, crop: { w: 440, h: 330 } },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 720 } }, crop: { w: 640, h: 480 } },
].filter((d) => !args.includes('--phone') && !args.includes('--desktop') || args.includes('--' + d.name));
// the script: [seconds, keys held, then what to do on its first frame]
const SCRIPT = [
  [3, [], 'idle'], [2.5, ['KeyW'], 'swim'], [1.5, ['KeyD'], 'turn'], [1.5, [], 'stop'], [2, [], 'jump'], [2, [], 'lash'],
];

const env = await start();
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
try {
  for (const size of SIZES) {
    const { page, errors } = await openGame(env, size.opts);
    await page.evaluate(() => { APT.renderer.setAnimationLoop(null); });   // drawn by stepping the game, like the stories
    await page.addStyleTag({ content: 'body > :not(canvas) { visibility: hidden !important; }' });
    const species = await page.evaluate(async () => Object.keys((await import('/src/character.js')).SPECIES));
    const bodies = only || [await page.evaluate(() => window.player.avatar.look.body)];
    const unknown = bodies.filter((b) => !species.includes(b));
    if (unknown.length) throw new Error(`no species called ${unknown.join(', ')} (have: ${species.join(', ')})`);
    for (const body of bodies) {
      await page.evaluate(async ({ body, script }) => {
        const kit = await import('/src/stories/kit.js'), { buildCharacter } = await import('/src/character.js');
        const { CONFIG } = await import('/src/config.js');
        kit.fresh({ elites: false, bubbles: false });
        kit.tp(3.2, 0.05, 3.0, 0);
        window.player.setAvatar(buildCharacter({ ...window.player.avatar.look, body }, CONFIG.player.height));
        window.__reel = { script, i: 0, n: 0, roach: null, kit };
        window.__reel.frames = script.reduce((a, [s]) => a + Math.round(s / (1 / 30)), 0);
      }, { body, script: SCRIPT });
      const views = ['side', 'above'];
      const dirs = Object.fromEntries(views.map((v) => [v, path.join(out, size.name, body, v)]));
      for (const d of Object.values(dirs)) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
      const total = await page.evaluate(() => window.__reel.frames);
      let frame = 0;
      for (const [secs, keys, action] of SCRIPT) {
        for (let i = 0, n = Math.round(secs / DT); i < n; i++, frame++) {
          const placed = await page.evaluate(({ keys, action, first, dt }) => {
            const { input, player } = window, R = window.__reel, kit = R.kit;
            input.keys = new Set(keys);
            if (first && action === 'jump') input.jumpQueued = true;
            if (first && action === 'lash') {
              const at = player.position.clone(); at.x += 0.2;
              R.roach = kit.spawn('roach', at, { still: true, hp: 9999 });
            }
            window.GAME.step(dt);
            const c = player.position, look = c.clone(); look.y += 0.06;
            return { x: c.x, y: look.y, z: c.z };
          }, { keys, action, first: i === 0, dt: DT });
          for (const view of views) {
            await page.evaluate(({ placed, view }) => {
              const { THREE } = window, camera = window.tpc.camera, p = new THREE.Vector3(placed.x, placed.y, placed.z);
              if (view === 'side') { camera.position.set(p.x + 0.3, p.y, p.z); camera.up.set(0, 1, 0); }
              else { camera.position.set(p.x, p.y + 0.4, p.z + 0.001); camera.up.set(0, 0, -1); }
              camera.lookAt(p);
              camera.updateMatrixWorld(true);
              window.GAME.render();
            }, { placed, view });
            const { w, h } = size.crop, vp = size.opts.viewport;
            await page.screenshot({ path: path.join(dirs[view], String(frame).padStart(4, '0') + '.png'), clip: { x: (vp.width - w) / 2, y: (vp.height - h) / 2, width: w, height: h } });
          }
        }
      }
      for (const view of views) {
        const name = `${size.name}-${body}-${view}`, dir = dirs[view];
        await sheet(page, dir, path.join(out, `${name}-sheet.png`), size.crop);
        if (ffmpeg) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, '%04d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '1M', path.join(out, `${name}.webm`)]);
        console.log(`${name}: ${total} frames -> ${path.relative(process.cwd(), dir)}`);
      }
    }
    if (errors.length) console.log(`${size.name} page errors:\n  ` + errors.slice(0, 5).join('\n  '));
    await page.close();
  }
  if (!ffmpeg) console.log('ffmpeg not found: no .webm written (the PNG frames are all there)');
} finally {
  await env.close();
}

// every `every`-th frame in a grid, small, with its time in seconds, drawn in a blank page
async function sheet(page, dir, file, crop) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().filter((_, i) => i % every === 0);
  const cols = 8, scale = 0.5, w = Math.round(crop.w * scale), h = Math.round(crop.h * scale);
  const urls = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
  const b64 = await page.evaluate(async ({ urls, cols, w, h, every }) => {
    const c = document.createElement('canvas');
    c.width = cols * w; c.height = Math.ceil(urls.length / cols) * h;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.font = '11px sans-serif'; g.fillStyle = '#fff';
    await Promise.all(urls.map(async (u, i) => {
      const img = new Image(); img.src = u; await img.decode();
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      g.drawImage(img, x, y, w, h);
      g.fillText((i * every / 30).toFixed(1) + 's', x + 4, y + 12);
    }));
    return c.toDataURL('image/png').split(',')[1];
  }, { urls, cols, w, h, every });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}
