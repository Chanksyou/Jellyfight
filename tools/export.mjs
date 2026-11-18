// Re-bake the apartment: node tools/export.mjs
// Needs the tools' dev dependencies: cd tools && npm install && npx playwright install chromium
// Writes assets/apartment.glb + apartment-q.glb (the whole static space), splits them into
// apartment-act1/2/3.glb (what the game loads, one act at a time; tools/split.mjs) and writes
// assets/apartment.json (floor plan, acts, doors, lights).
// Offline: set THREE_LOCAL=/path/to/three/package to serve three.js from disk instead of jsDelivr (tools/apartment-page.mjs).
// Also writes assets/props.glb, the prop library (tools/props.mjs).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compress } from './compress.mjs';
import { split } from './split.mjs';
import { openApartment } from './apartment-page.mjs';
import { buildProps } from './props.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { page, browser } = await openApartment();
const { glb, meta } = await page.evaluate(() => window.exportApartment({ mins: 0 }));
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/apartment.glb'), Buffer.from(glb, 'base64'));
fs.writeFileSync(path.join(root, 'assets/apartment.json'), JSON.stringify(meta, null, 1));
await compress(path.join(root, 'assets/apartment.glb'), path.join(root, 'assets/apartment-q.glb'));
console.log('split into acts', await split(path.join(root, 'assets')));
console.log('props', await buildProps(page, path.join(root, 'assets')));   // what the game loads: apartment-act<N>.glb
const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1);
console.log(`apartment.glb ${(Buffer.from(glb, 'base64').length / 1e6).toFixed(1)} MB -> ${mb(path.join(root, 'assets/apartment.glb'))} MB compressed (${mb(path.join(root, 'assets/apartment-q.glb'))} MB fallback), ${meta.lights.length} lights`, meta.stats);
await browser.close();
