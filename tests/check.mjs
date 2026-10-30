// The fast check, seconds not minutes: every module parses the way the browser loads it (as an ES
// module: plain `node --check` reads these .js files as CommonJS and misses errors), then the guard
// stories run (content/ and vocabulary/: words without docs or stories, bad content, words the
// glossary retired). The pre-push hook runs it on every push; the full story run is still what
// gates main (CLAUDE.md rule 2).
//
//   node tests/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
import { ROOT } from './lib.mjs';
import { withPreload } from '../tools/preload.mjs';
import { README, oneSentencePerLine } from '../tools/one-sentence.mjs';

let bad = 0;
const files = ['src', 'src/stories', 'tests', 'tools', 'worker'].flatMap((d) => {
  const dir = path.join(ROOT, d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(m?js)$/.test(f)).map((f) => path.join(dir, f)) : [];
});
for (const f of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f) });
  if (r.status) { bad++; console.log(`✗ ${path.relative(ROOT, f)}\n    ${r.stderr.toString().split('\n').filter(Boolean).slice(0, 4).join('\n    ')}`); }
}
console.log(`${files.length - bad} of ${files.length} modules parse`);
// Browser stories are shipped too. A local test server can otherwise hide imports of
// modules excluded from Cloudflare's assets (the current ignore list uses literal paths).
const ignored = fs.readFileSync(path.join(ROOT, '.assetsignore'), 'utf8').split(/\r?\n/).map(s => s.split('#')[0].trim()).filter(Boolean);
for (const f of files.filter(f => f.startsWith(path.join(ROOT, 'src') + path.sep))) {
  const source = fs.readFileSync(f, 'utf8');
  for (const [, spec] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    const target = spec.startsWith('/') ? path.resolve(ROOT, '.' + spec) : path.resolve(path.dirname(f), spec);
    const relative = path.relative(ROOT, target).split(path.sep).join('/');
    if (ignored.some(p => relative === p || relative.startsWith(p + '/'))) {
      bad++; console.log(`✗ ${path.relative(ROOT, f)} imports excluded deployment asset ${relative}`);
    }
  }
}
// index.html preloads what the game imports (tools/preload.mjs), and the apartment's gzipped copies,
// which the game downloads first, are the same files as the .glb (tools/split.mjs makes both)
if (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') !== withPreload()) { bad++; console.log('✗ index.html\'s preload list is out of date: run node tools/preload.mjs'); }
// README keeps one sentence per line, so pull requests editing different sentences don't conflict
if (fs.readFileSync(README, 'utf8') !== oneSentencePerLine(fs.readFileSync(README, 'utf8'))) { bad++; console.log('✗ README.md has a line with more than one sentence: run node tools/one-sentence.mjs'); }
for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^apartment-act\d+\.glb$/.test(f))) {
  const glb = path.join(ROOT, 'assets', f);
  if (!fs.existsSync(glb + '.gz') || !zlib.gunzipSync(fs.readFileSync(glb + '.gz')).equals(fs.readFileSync(glb))) { bad++; console.log(`✗ assets/${f}.gz is missing or differs from assets/${f}: run node tools/split.mjs`); }
}
if (bad) process.exit(1);

const unit = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests/random.test.mjs')], { stdio: 'inherit' });
if (unit.status !== 0) process.exit(unit.status ?? 1);

const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/run.mjs'), 'content/,vocabulary/', '--no-mobile'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
