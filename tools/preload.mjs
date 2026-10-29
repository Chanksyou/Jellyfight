// Writes index.html's preload list: every module the game imports on the way to its menu
// (src/boot.js and src/main.js, followed through their static imports), so the browser fetches
// them all at once while the apartment downloads instead of discovering them one level at a time.
// Modules from the CDN are listed but not followed, except three.js's core (three.module.js's one
// import) and the apartment's decoder (imported on demand, first thing).
//
//   node tools/preload.mjs          rewrite the list (tests/check.mjs fails when it's out of date)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const START = /<!-- preload:[^\n]*-->\n/, END = '<!-- /preload -->';

// the static imports of every module reachable from the entries, in the order they're found
export function preloadList(html = fs.readFileSync(INDEX, 'utf8')) {
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const bare = (spec) => {
    if (map[spec]) return map[spec];
    const prefix = Object.keys(map).find((k) => k.endsWith('/') && spec.startsWith(k));
    return prefix ? map[prefix] + spec.slice(prefix.length) : null;
  };
  const seen = new Set(), out = [];
  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    out.push(rel);
    if (/^https?:/.test(rel)) return;
    const file = path.join(ROOT, rel), source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    for (const [, spec] of source.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      if (spec.startsWith('.')) visit(path.relative(ROOT, path.resolve(path.dirname(file), spec)).split(path.sep).join('/'));
      else { const url = bare(spec); if (url) visit(url.startsWith('./') ? url.slice(2) : url); }
    }
  };
  visit(map.three);
  visit(map.three.replace(/three\.module\.js$/, 'three.core.js'));
  visit(bare('three/addons/libs/meshopt_decoder.module.js'));
  visit('src/boot.js');
  const boot = out.length;
  visit('src/main.js');
  // what boot.js needs comes first; main.js's own modules at low priority, so they don't hold up
  // boot.js starting the apartment's download
  return out.filter((f) => f !== 'src/boot.js').map((f, i) => ({ file: f, low: i >= boot - 1 }));   // index.html's own <script> already asks for boot.js
}

export function preloadBlock(html = fs.readFileSync(INDEX, 'utf8')) {
  return preloadList(html).map(({ file, low }) => `<link rel="modulepreload" href="${/^https?:/.test(file) ? file : './' + file}"${low ? ' fetchpriority="low"' : ''}>\n`).join('');
}

// index.html with its list brought up to date
export function withPreload(html = fs.readFileSync(INDEX, 'utf8')) {
  const start = html.match(START), end = html.indexOf(END);
  if (!start || end < 0) throw new Error('index.html has no <!-- preload: --> … <!-- /preload --> block');
  const at = start.index + start[0].length;
  return html.slice(0, at) + preloadBlock(html) + html.slice(end);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(INDEX, withPreload());
  console.log(`index.html preloads ${preloadList().length} modules`);
}
