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
import { BAKED_LAYOUT, ACT4_OWN, HIDDEN_SHELL } from '../src/layout-baked.js';
import { ELITES4 } from '../src/stage4.js';

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
// Act 4 is act 1's living room with the same furniture, plants and things on top: its layout is
// act 1's, and only its Elites' furniture (stage4.js ELITES4 `hide`, `clears`) and vents may differ
const elitesOwn = new Set(ELITES4.flatMap((e) => [e.hide, ...(e.clears || [])]).map((k) => `${k}#1`));
const stray = ACT4_OWN.filter((k) => !k.startsWith('vent:') && !elitesOwn.has(k));
if (stray.length) { bad++; console.log(`✗ act 4's layout must match act 1's, but layout-baked.js act 4 sets ${stray.join(', ')}: bake that change into act 1 instead (act 4 follows it)`); }
if (Object.keys(BAKED_LAYOUT[1]).some((k) => !(k in BAKED_LAYOUT[4])) || JSON.stringify(HIDDEN_SHELL[1]) !== JSON.stringify(HIDDEN_SHELL[4])) { bad++; console.log('✗ act 4 no longer takes act 1\'s layout: keep BAKED_LAYOUT[4] = { ...BAKED_LAYOUT[1], ...act 4\'s own } and the same HIDDEN_SHELL'); }
// A bug's `anim` runs every frame for every bug in view (phones included): no `new`, no unseeded
// randomness and no wall clock inside it, so a pose is a function of the bug's own clock and a bug updated
// every other frame (enemies.js) shows the same pose. Builders listed in KNOWN are on the way out.
const KNOWN_ANIM = {};
for (const file of ['src/critters.js', 'src/attack-motion.js']) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8').split('\n'), seen = new Set();
  let builder = '', from = -1;
  src.forEach((line, i) => {
    const fn = /^(?:export )?function (\w+)/.exec(line);
    if (fn) builder = fn[1].replace(/^build/, '').toLowerCase();
    if (/^  (?:const anim = \(|anim\.reset)/.test(line)) from = /const anim/.test(line) ? i : -1;
    else if (from >= 0) {
      const code = line.replace(/\/\/.*$/, '').replace(/\|\|= new /g, '');   // `x ||= new` allocates once, the first frame (the Worm's and Nest's emergeAt)
      for (const [what, re] of [['new', /\bnew\s/], ['Math.random', /Math\.random/], ['performance.now', /performance\.now/]]) {
        const key = `${builder}:${what}`;
        if (re.test(code) && !(KNOWN_ANIM[builder] || []).includes(what) && !seen.has(key)) { seen.add(key); bad++; console.log(`✗ ${file}:${i + 1} the ${builder} anim uses ${what}: poses must be a function of the bug's clock, with no allocation or unseeded randomness (tests/check.mjs KNOWN_ANIM lists the bugs not converted yet)`); }
      }
    }
  });
}
// LOOK.list gives strings: one in a three.js vector or matrix puts every vector and matrix on the page in
// V8's slow form, so each write allocates (act 4's sun did: game step 3 to 5 times slower). Numbers come from LOOK.nums.
for (const f of files.filter((f) => f.startsWith(path.join(ROOT, 'src') + path.sep))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/(\.(fromArray|set|setScalar|setRGB|copy)|\bVector[234]|\bEuler|\bQuaternion)\(\s*(\.\.\.)?LOOK\.list\(/.test(line)) { bad++; console.log(`✗ ${path.relative(ROOT, f)}:${i + 1} hands LOOK.list's strings to three.js: use LOOK.nums`); }
  });
}
for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^(apartment-act\d+|props)\.glb$/.test(f))) {
  const glb = path.join(ROOT, 'assets', f);
  if (!fs.existsSync(glb + '.gz') || !zlib.gunzipSync(fs.readFileSync(glb + '.gz')).equals(fs.readFileSync(glb))) { bad++; console.log(`✗ assets/${f}.gz is missing or differs from assets/${f}: run node tools/split.mjs, or tools/props.mjs for props.glb`); }
}
// Sound packs (docs/agents/sound.md): every role has takes and a cue that sfx.js has (its synthesized
// sound: story sound/every-role-has-a-synthesized-sound), every sample() role is in a pack, the packs keep
// to their budgets, and every audio file has its source and licence in assets/audio/credits.json
{
  const AUDIO = path.join(ROOT, 'assets/audio'), SFX = fs.readFileSync(path.join(ROOT, 'src/sfx.js'), 'utf8');
  const packs = JSON.parse(fs.readFileSync(path.join(AUDIO, 'packs.json'), 'utf8')), credits = JSON.parse(fs.readFileSync(path.join(AUDIO, 'credits.json'), 'utf8'));
  const ACT_BYTES = 900 * 1024, ALL_BYTES = 3.5 * 1024 * 1024, ACT_SECONDS = 60;
  const roles = Object.values(packs).flatMap((P) => Object.keys(P.roles));
  for (const [name, P] of Object.entries(packs)) {
    const file = path.join(AUDIO, P.file);
    if (!fs.existsSync(file) || fs.statSync(file).size !== P.bytes) { bad++; console.log(`✗ sound pack ${name}: ${P.file} is missing or not the size packs.json says: run node tools/sounds.mjs`); }
    for (const [role, r] of Object.entries(P.roles)) {
      if (!r.takes?.length) { bad++; console.log(`✗ sound role ${role} has no takes`); }
      if (!new RegExp(`\\n  ${r.cue?.[0]}\\(`).test(SFX)) { bad++; console.log(`✗ sound role ${role}'s cue sfx.${r.cue?.[0]} isn't in src/sfx.js`); }
      if (!SFX.includes(`if (sample('${role}'`)) { bad++; console.log(`✗ sound role ${role}: src/sfx.js must play it as if (sample('${role}'…)) return; before its synthesized sound`); }
      if (!['replace', 'layer'].includes(r.mode) || !(r.vol > 0)) { bad++; console.log(`✗ sound role ${role} needs mode replace or layer and a vol`); }
    }
  }
  for (const [, role] of SFX.matchAll(/sample\('([^']+)'/g)) if (!roles.includes(role)) { bad++; console.log(`✗ src/sfx.js plays sound role ${role}, which no pack has (tools/sounds.json)`); }
  // an act loads the 'unlock' packs, its own, and one jelly type's (count the biggest)
  const sum = (list, k) => list.reduce((n, P) => n + P[k], 0), jelly = Object.values(packs).filter((P) => P.for.every((t) => t.startsWith('jelly ')));
  for (let act = 1; act <= 4; act++) {
    const mine = Object.values(packs).filter((P) => P.for.some((t) => t === 'unlock' || t === `act ${act}`));
    const bytes = sum(mine, 'bytes') + Math.max(0, ...jelly.map((P) => P.bytes)), secs = sum(mine, 'seconds') + Math.max(0, ...jelly.map((P) => P.seconds));
    if (bytes > ACT_BYTES || secs > ACT_SECONDS) { bad++; console.log(`✗ act ${act}'s sound packs are ${(bytes / 1024).toFixed(0)} KB and ${secs.toFixed(0)} s decoded: at most ${ACT_BYTES / 1024} KB and ${ACT_SECONDS} s`); }
  }
  if (sum(Object.values(packs), 'bytes') > ALL_BYTES) { bad++; console.log(`✗ the sound packs add up to more than ${(ALL_BYTES / 1048576).toFixed(1)} MB`); }
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)).map((f) => `${e.name}/${f}`) : [e.name]);
  for (const f of files(AUDIO).filter((f) => /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/.test(f))) if (!credits[f]?.from || !credits[f]?.licence) { bad++; console.log(`✗ assets/audio/${f} has no source and licence in assets/audio/credits.json`); }
}
if (bad) process.exit(1);

const unit = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests/random.test.mjs'), path.join(ROOT, 'tests/balance.test.mjs'), path.join(ROOT, 'tests/achievement-board.test.mjs'), path.join(ROOT, 'tests/run-log.test.mjs'), path.join(ROOT, 'tests/balance-sheet.test.mjs'), path.join(ROOT, 'tests/gl-context.test.mjs')], { stdio: 'inherit' });
if (unit.status !== 0) process.exit(unit.status ?? 1);

const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/run.mjs'), 'content/,vocabulary/', '--no-mobile'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
