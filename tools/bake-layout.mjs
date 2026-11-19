// Bake a layout editor export into src/layout-baked.js in one command, then re-bake the corner
// shadows for the acts it changed.
//   node tools/bake-layout.mjs <file|->  [--check]
// The code is what the editor's Export gives: { act, edits }, or a map of acts { "1": edits, ... }.
// Each edit is merged over the act's baked entry (moves, deleted, hidden, copy:, prop:, vent:).
// Comments and untouched lines in layout-baked.js stay as they are; running it twice changes nothing.
// An object put back at its baked spot has no entry in the export, so a revert is edited by hand.
// --check prints the summary and writes nothing. Needs the tests' setup (cd tests && npm install).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/layout-baked.js');
const args = process.argv.slice(2);
const check = args.includes('--check');
const src = args.find((a) => a === '-' || !a.startsWith('--'));
if (!src) { console.error('usage: node tools/bake-layout.mjs <file|-> [--check]'); process.exit(1); }

const text = fs.readFileSync(src === '-' ? 0 : src, 'utf8').trim();
let code;
try { code = JSON.parse(text); } catch (e) { console.error(`Not valid JSON: ${e.message}`); process.exit(1); }
const acts = {};   // act number -> { key: edit }
const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v);
for (const d of Array.isArray(code) ? code : [code]) {
  if (isMap(d) && Number.isInteger(d.act) && isMap(d.edits)) acts[d.act] = { ...acts[d.act], ...d.edits };
  else if (isMap(d) && Object.keys(d).length && Object.keys(d).every((k) => /^\d+$/.test(k) && isMap(d[k]))) for (const k of Object.keys(d)) acts[k] = { ...acts[k], ...d[k] };
  else { console.error('Unrecognised code: expected { act, edits } or { "1": edits, ... }.'); process.exit(1); }
}

const lit = (v) => Array.isArray(v) ? `[${v.join(', ')}]`
  : typeof v === 'string' ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  : isMap(v) ? `{ ${Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')} }` : String(v);
const line = (k, v) => `    '${k.replace(/'/g, "\\'")}': ${lit(v)},`;
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kind = (k) => k.startsWith('vent:') ? 'vent' : k.startsWith('copy:') || k.startsWith('prop:') ? 'added' : 'moved';

const { BAKED_LAYOUT } = await import(pathToFileURL(FILE).href);
// act 4 takes act 1's layout (layout-baked.js); only its Elites' furniture and vents are its own
if (acts[4]) {
  const { ELITES4 } = await import(pathToFileURL(path.join(ROOT, 'src/stage4.js')).href);
  const own = new Set(ELITES4.flatMap((e) => [e.hide, ...(e.clears || [])]).map((k) => `${k}#1`));
  const stray = Object.keys(acts[4]).filter((k) => !k.startsWith('vent:') && !own.has(k) && !(BAKED_LAYOUT[4][k] && sameJson(Object.entries(acts[4][k]).sort(), Object.entries(BAKED_LAYOUT[4][k]).sort())));
  if (stray.length) { console.error(`act 4 uses act 1's layout: make these changes in act 1 instead (act 4 follows): ${stray.join(', ')}. Nothing written.`); process.exit(1); }
}
let out = fs.readFileSync(FILE, 'utf8').split('\n');
const changed = [];
for (const act of Object.keys(acts).sort()) {
  const baked = BAKED_LAYOUT[act] || {};
  const n = { moved: 0, added: 0, vent: 0, deleted: 0, hidden: 0, same: 0 };
  const fresh = [];
  for (const [key, e] of Object.entries(acts[act])) {
    const next = e;   // the export's entry is the whole entry (restoring a hidden/deleted object drops the flag)
    if (baked[key] && sameJson(Object.entries(next).sort(), Object.entries(baked[key]).sort())) { n.same++; continue; }
    n[next.deleted ? 'deleted' : next.hidden ? 'hidden' : kind(key)]++;
    const at = out.findIndex((l) => l.startsWith(`    '${key.replace(/'/g, "\\'")}': {`));
    if (at >= 0) out[at] = line(key, next);
    else fresh.push(line(key, next));
  }
  if (fresh.length) {
    const open = out.findIndex((l) => new RegExp(`^  ${act}: \\{`).test(l));
    if (open < 0) out.splice(out.lastIndexOf('};'), 0, `  ${act}: {`, ...fresh, '  },');
    else if (out[open].trim().endsWith('{},')) out.splice(open, 1, `  ${act}: {`, ...fresh, '  },');
    else { let close = open + 1; while (out[close] !== '  },') if (++close >= out.length) { console.error(`act ${act} in layout-baked.js isn't laid out as "N: {" ... "  },"; nothing written.`); process.exit(1); } out.splice(close, 0, ...fresh); }
  }
  const did = Object.entries(n).filter(([k, v]) => v && k !== 'same').map(([k, v]) => `${v} ${k}`);
  console.log(`act ${act}: ${did.length ? did.join(', ') : 'no changes'}${n.same ? ` (${n.same} already baked)` : ''}`);
  if (did.some((d) => !d.endsWith(' vent'))) changed.push(act);   // vents aren't in the shadows
}
if (check) { console.log('--check: nothing written.'); process.exit(0); }
if (!changed.length) process.exit(0);
if (changed.includes('1') && !changed.includes('4')) changed.push('4');   // act 4 is act 1's room
fs.writeFileSync(FILE, out.join('\n'));
console.log(`wrote src/layout-baked.js; baking shadows for act ${changed.join(', ')}`);
const r = spawnSync('node', ['tools/bake-ao.mjs', ...changed], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
