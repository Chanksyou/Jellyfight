// Re-bake the apartment: node tools/export.mjs
// Needs the tools' dev dependencies: cd tools && npm install && npx playwright install chromium
// Writes assets/apartment.glb (the static space) and assets/apartment.json (floor plan, doors, lights).
// Offline: set THREE_LOCAL=/path/to/three/package to serve three.js from disk instead of jsDelivr.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compress } from './compress.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.THREE_LOCAL;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.route('**/*', (r) => {
  const u = new URL(r.request().url());
  if (u.hostname === 'jelly.local') {
    const f = path.join(root, decodeURIComponent(u.pathname));
    return r.fulfill({ path: f, contentType: types[path.extname(f)] || 'application/octet-stream' });
  }
  const m = local && u.href.match(/three@0\.170\.0\/(.*)$/);
  if (m) return r.fulfill({ path: path.join(local, m[1]), contentType: 'application/javascript' });
  if (u.hostname === 'cdn.jsdelivr.net') return r.continue();
  return r.abort();   // fonts etc. aren't needed
});
await page.goto('http://jelly.local/tools/apartment-source.html');
await page.waitForFunction(() => window.EXPORT_READY, null, { timeout: 180000 });
const { glb, meta } = await page.evaluate(() => window.exportApartment({ mins: 0 }));
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/apartment.glb'), Buffer.from(glb, 'base64'));
fs.writeFileSync(path.join(root, 'assets/apartment.json'), JSON.stringify(meta, null, 1));
await compress(path.join(root, 'assets/apartment.glb'));
const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1);
console.log(`apartment.glb ${(Buffer.from(glb, 'base64').length / 1e6).toFixed(1)} MB -> ${mb(path.join(root, 'assets/apartment.glb'))} MB compressed, ${meta.lights.length} lights`, meta.stats);
await browser.close();
