// Plays every story (src/stories.js) headlessly in the real game, plus a phone check, and
// fails if any story fails or the page logs an error.
//
//   node tests/run.mjs                 everything
//   node tests/run.mjs elites          only stories whose name contains "elites"
//   node tests/run.mjs --no-mobile     skip the phone check
//
// Needs Playwright (cd tests && npm install && npx playwright install chromium).
// If the machine can't reach the three.js CDN, point JF_THREE at an unpacked three@0.170.0
// npm package and its files are served from there instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--')) || '';
const MOBILE = !args.includes('--no-mobile');

// Playwright: this folder's node_modules, else a global install
function playwright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = playwright();

// --- a static server for the repo
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.kdl': 'text/plain' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/index.html`;

async function openPage(browser, opts = {}) {
  const page = await browser.newPage(opts);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|KHR_parallel/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  if (process.env.JF_THREE) {
    await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)$/, (r) => {
      const rel = r.request().url().match(/three@0\.170\.0\/(.*)$/)[1];
      r.fulfill({ path: path.join(process.env.JF_THREE, rel), contentType: 'text/javascript' });
    });
  }
  await page.goto(URL_);
  try {
    await page.waitForFunction(() => window.GAME && window.run && document.querySelector('#g-over .play') && !document.querySelector('#g-over .play').disabled, null, { timeout: 180000 });
  } catch {
    // the game didn't start: show what it says on screen (content errors name the file and line)
    console.log('✗ the game did not start\n    ' + (await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '')).replace(/\n+/g, '\n    '));
    if (errors.length) console.log('    ' + errors.slice(0, 5).join('\n    '));
    process.exit(1);
  }
  return { page, errors };
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0, passed = 0;
const line = (good, name, ms, info) => console.log(`${good ? '✓' : '✗'} ${name}${ms != null ? `  (${ms} ms)` : ''}${good ? '' : '\n    ' + JSON.stringify(info)}`);

// --- every story, in one page (booting the apartment takes a while)
{
  const { page, errors } = await openPage(browser, { viewport: { width: 1100, height: 650 } });
  const names = await page.evaluate(async (f) => Object.keys((await import('/src/stories.js')).STORIES).filter((n) => n.includes(f)), filter);
  for (const name of names) {
    const before = errors.length;
    const r = await page.evaluate(async (n) => (await import('/src/stories.js')).runStory(n), name);
    const newErrors = errors.slice(before);
    const good = r.ok && !newErrors.length;
    line(good, name, r.ms, newErrors.length ? { ...r.info, errors: newErrors } : r.info);
    good ? passed++ : failed++;
  }
  await page.close();
}

// --- on a phone: tap Play, pick a starting treasure, swim with the joystick, jump
if (MOBILE && (!filter || 'mobile'.includes(filter))) {
  const { page, errors } = await openPage(browser, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const ev = (f, a) => page.evaluate(f, a);
  const step = (n) => ev((n) => { for (let i = 0; i < n; i++) GAME.step(1 / 60); return [player.position.x, player.position.z, player.velocity.y]; }, n);
  const out = {};
  out.touchUi = await ev(() => document.body.classList.contains('touch'));
  await page.tap('#g-over .play');
  await ev(() => { run.spawnWaves = () => {}; run.hurt = () => {}; GAME.step(1 / 60); });
  out.startPick = await ev(() => menus.open);
  await page.tap('.jf-card');
  await step(3);
  out.picked = await ev(() => !menus.open && run.owned.size > 0);
  const a = await step(1);
  await touch('touchStart', [[150, 280]]);
  await touch('touchMove', [[150, 220]]);
  const b = await step(60);
  await touch('touchEnd', []);
  out.swam = +Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(3);
  const jb = await (await page.$('#touch .jump')).boundingBox();
  await touch('touchStart', [[jb.x + jb.width / 2, jb.y + jb.height / 2]]);
  const c = await step(4);
  await touch('touchEnd', []);
  out.jumpVy = +c[2].toFixed(3);
  const good = out.touchUi && out.startPick && out.picked && out.swam > 0.2 && out.jumpVy > 0.1 && !errors.length;
  line(good, 'mobile/touch-controls', null, { ...out, errors });
  good ? passed++ : failed++;
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
