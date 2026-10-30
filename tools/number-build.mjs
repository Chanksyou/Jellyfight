// Numbers what just merged into main: each note in changes/ becomes the next BUILD, its text goes
// to the top of CHANGELOG.md's version list as "vN <note>", and the note is deleted. Pull requests
// never touch BUILD or CHANGELOG's version lines, so two of them can't collide on a number; the
// "Number the build" workflow (.github/workflows/number-build.yml) runs this after every merge
// and commits the result to main.
//
//   node tools/number-build.mjs     prints the new BUILD, or nothing when changes/ has no notes
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dir = path.join(ROOT, 'changes');
// oldest merge first, so the newest note gets the highest number (by the commit that added it)
const added = (f) => Number(execFileSync('git', ['log', '--diff-filter=A', '--format=%ct', '-1', '--', `changes/${f}`], { cwd: ROOT }).toString().trim()) || 0;
const notes = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => ({ f, t: added(f) })).sort((a, b) => a.t - b.t || a.f.localeCompare(b.f));
if (!notes.length) process.exit(0);

const mainJs = path.join(ROOT, 'src/main.js'), changelog = path.join(ROOT, 'CHANGELOG.md');
const src = fs.readFileSync(mainJs, 'utf8');
const m = /const BUILD = 'v(\d+)';/.exec(src);
if (!m) throw new Error("src/main.js has no const BUILD = 'vN'");
let n = Number(m[1]);
const lines = fs.readFileSync(changelog, 'utf8').split('\n');
const top = lines.findIndex((l) => /^v\d+ /.test(l));
if (top < 0) throw new Error('CHANGELOG.md has no "vN …" version line to add above');
const entries = [];
for (const { f } of notes) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8').trim().replace(/\s*\n\s*/g, ' ');
  if (!text) throw new Error(`changes/${f} is empty`);
  entries.unshift(`v${++n} ${text}`, '');   // newest on top
  fs.rmSync(path.join(dir, f));
}
lines.splice(top, 0, ...entries);
fs.writeFileSync(changelog, lines.join('\n'));
fs.writeFileSync(mainJs, src.replace(m[0], `const BUILD = 'v${n}';`));
console.log(`v${n}`);
