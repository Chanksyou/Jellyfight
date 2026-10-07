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
import { ROOT } from './lib.mjs';

let bad = 0;
const files = ['src', 'tests', 'tools', 'worker'].flatMap((d) => {
  const dir = path.join(ROOT, d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(m?js)$/.test(f)).map((f) => path.join(dir, f)) : [];
});
for (const f of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f) });
  if (r.status) { bad++; console.log(`✗ ${path.relative(ROOT, f)}\n    ${r.stderr.toString().split('\n').filter(Boolean).slice(0, 4).join('\n    ')}`); }
}
console.log(`${files.length - bad} of ${files.length} modules parse`);
if (bad) process.exit(1);

const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/run.mjs'), 'content/,vocabulary/', '--no-mobile'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
