// Opens tools/apartment-source.html in headless Chromium and waits until it has built its scene
// (the page window.APT; window.exportApartment / window.exportProps are what tools/export.mjs
// and tools/props.mjs call). Returns { page, browser }; close the browser when done.
// Needs the tools' dev dependencies: cd tools && npm install && npx playwright install chromium
// Offline: set THREE_LOCAL=/path/to/three/package to serve three.js from disk instead of jsDelivr.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.THREE_LOCAL;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };

export async function openApartment() {
  // CHROMIUM=/path/to/chrome: use that browser instead of Playwright's own (a cloud image's Chromium may be another build)
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], executablePath: process.env.CHROMIUM || undefined });
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
  return { page, browser };
}
