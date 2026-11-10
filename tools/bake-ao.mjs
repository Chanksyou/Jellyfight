// Bake the corner shadows (src/baked-ao.js) for each act: node tools/bake-ao.mjs [act ...]
// Run it after moving furniture (the layout editor -> src/layout-baked.js) or re-exporting the
// apartment (tools/export.mjs); the story engine/baked-ao-is-current fails until you do.
// Needs the tests' setup (cd tests && npm install). Writes assets/ao-<act>.json + assets/ao-<act>.bin.gz.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const acts = process.argv.slice(2).map(Number).filter(Boolean);
const g = await start();
for (const act of acts.length ? acts : [1, 2, 3]) {
  const t0 = Date.now();
  const { page, errors } = await openGame(g, { viewport: { width: 640, height: 360 }, act: { act } });
  const out = await page.evaluate(async (act) => (await import('./tools/bake-ao-page.js')).bake(act), act);
  const bytes = Buffer.from(out.data, 'base64');
  fs.writeFileSync(path.join(ROOT, `assets/ao-${act}.bin.gz`), zlib.gzipSync(bytes, { level: 9 }));
  fs.writeFileSync(path.join(ROOT, `assets/ao-${act}.json`), JSON.stringify(out.meta, null, 1) + '\n');
  const kb = (fs.statSync(path.join(ROOT, `assets/ao-${act}.bin.gz`)).size / 1024).toFixed(0);
  console.log(`act ${act}: ${out.meta.dims.join('x')} points, ${out.triangles} triangles, ${out.cast} rays, open floor ${out.meta.open}, ${kb} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  await page.close();
}
await g.close();
