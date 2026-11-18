// Bakes the prop library: node tools/props.mjs (tools/export.mjs does it too, after a re-bake).
// content/props.kdl lists the props; tools/props-export.js draws each one in the apartment page
// (tools/apartment-page.mjs) and this writes assets/props.glb (+ props-q.glb without meshopt, and
// props.glb.gz, the same trio as the act files, tools/split.mjs).
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '../src/kdl.js';
import { compress } from './compress.mjs';
import { openApartment } from './apartment-page.mjs';

export async function buildProps(page, assets) {
  const nodes = parse(fs.readFileSync(path.join(assets, '../content/props.kdl'), 'utf8'), 'content/props.kdl');
  const specs = nodes.map((n) => ({ id: n.args[0], source: n.props.source }));
  const glb = await page.evaluate((s) => window.exportProps(s), specs);
  const file = path.join(assets, 'props.glb');
  fs.writeFileSync(file, Buffer.from(glb, 'base64'));
  await compress(file, path.join(assets, 'props-q.glb'));
  fs.writeFileSync(file + '.gz', zlib.gzipSync(fs.readFileSync(file), { level: 9 }));
  return Object.fromEntries(['props.glb', 'props-q.glb'].map((f) => [f, +(fs.statSync(path.join(assets, f)).size / 1e3).toFixed(0) + ' kB']));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { page, browser } = await openApartment();
  console.log(await buildProps(page, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets')));
  await browser.close();
}
