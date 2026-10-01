// Shared by the test tools: serve the repo, start Chromium, open the game and wait for it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Playwright: this folder's node_modules, else a global install
function playwright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.kdl': 'text/plain' };

// A static server for the repo and a headless Chromium (software WebGL, works anywhere)
export async function start() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/index.html`;
  const browser = await playwright().chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  return { url, browser, close: async () => { await browser.close(); server.close(); } };
}

// Open the game and wait until it's ready to play; exits with the on-screen error if it can't start
export async function openGame({ url, browser }, opts = {}) {
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
  await page.goto(url);
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
