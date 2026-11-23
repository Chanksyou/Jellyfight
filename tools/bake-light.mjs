// Bake each act's light into its shell with Blender (src/baked-light.js): node tools/bake-light.mjs [act ...] [--samples=N]
// Run it after moving furniture (tools/bake-layout.mjs runs it for the acts it touched), re-exporting the
// apartment, or changing a lamp or src/bake-lights.js; the story engine/baked-light-is-current fails until you do.
// Needs the tests' setup (cd tests && npm install) and Blender as a Python module with Pillow (pip install bpy pillow).
// About 30 to 60 minutes an act on 4 processors. Writes assets/light-<act>.json and assets/light-<act>[-day][-grid].webp (the shell's picture and the furniture's grid).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2);
const samples = args.find((a) => a.startsWith('--samples='))?.split('=')[1];
const acts = args.filter((a) => /^\d+$/.test(a)).map(Number);
const python = process.env.JF_PYTHON || 'python3';
const g = await start();
for (const act of acts.length ? acts : [1, 2, 3, 4]) {
  const t0 = Date.now(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), `light-${act}-`));
  const { page, errors } = await openGame(g, { viewport: { width: 640, height: 360 }, act: { act } });
  const out = await page.evaluate(async (act) => {
    const r = await (await import('./tools/bake-light-page.js')).exportAct(act);
    let bin = '';
    for (let i = 0; i < r.glb.length; i += 0x8000) bin += String.fromCharCode(...r.glb.subarray(i, i + 0x8000));
    return { ...r, glb: btoa(bin) };
  }, act);
  await page.close();
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  fs.writeFileSync(path.join(tmp, 'act.glb'), Buffer.from(out.glb, 'base64'));
  fs.writeFileSync(path.join(tmp, 'inside.bin'), Uint8Array.from(out.inside));
  fs.writeFileSync(path.join(tmp, 'lights.json'), JSON.stringify({ ...out.scene, atlas: out.meta.atlas, grid: { ...out.meta.grid, inside: path.join(tmp, 'inside.bin') } }));
  console.log(`act ${act}: ${out.stats.triangles} triangles, ${out.stats.shell} shell triangles on ${out.stats.planes} planes, ${out.stats.pieces} pieces mapped in ${out.stats.charts} charts, picture ${out.meta.atlas.join('x')}, grid ${out.meta.grid.dims.join('x')} (${out.stats.inside} points inside solids), ${out.scene.lamps.length} lamps + ${out.scene.extra.length} bake-only lights; baking…`);
  const r = spawnSync(python, [path.join(ROOT, 'tools/bake-light.py'), path.join(tmp, 'act.glb'), path.join(tmp, 'lights.json'), tmp, ...(samples ? [samples] : [])], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const done = /JELLY_BAKE_DONE (.*)/.exec(r.stdout || '');
  if (!done) { console.error(r.stdout?.slice(-3000), r.stderr?.slice(-3000)); process.exit(1); }
  const log = JSON.parse(done[1]);
  let kb = 0;
  for (const set of out.scene.sets) {
    for (const [from, to] of [[set, ''], [set + '-grid', '-grid']]) {
      const file = `assets/light-${act}${set === 'lamps' ? '' : '-' + set}${to}.webp`;
      fs.copyFileSync(path.join(tmp, from + '.webp'), path.join(ROOT, file));
      kb += fs.statSync(path.join(ROOT, file)).size / 1024;
    }
  }
  fs.writeFileSync(path.join(ROOT, `assets/light-${act}.json`), JSON.stringify({ ...out.meta, sets: out.scene.sets, top: log.top, gridTop: log.gridTop, samples: log.samples }) + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`act ${act}: ${Object.entries(log.sets).map(([s, v]) => `${s} ${v.seconds} s`).join(', ')} on ${log.device}, ${kb.toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s in all`);
}
await g.close();
