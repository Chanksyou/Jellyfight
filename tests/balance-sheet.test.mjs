// The balance sheets' model (tools/balance-sheet.mjs, docs/agents/balance-model.md): it must reproduce the
// numbers the content files' own comments work out by hand, and every number and knob must cite a real line.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
const B = await import('../tools/balance-sheet.mjs');

test('level 1 damage a second matches each type\'s note in content/jellies.kdl', () => {
  const want = { normal: 10.56, fire: 11.4, lightning: 9.9, ice: 10.8, poison: 10.3, wind: 10.35, glitter: 9.4, tentacle: 15.8 };
  for (const [type, dps] of Object.entries(want)) assert.ok(Math.abs(B.offence(type, B.baseOf(type)) - dps) < 0.1, `${type}: ${B.offence(type, B.baseOf(type))}`);
  assert.ok(Math.abs(B.offence('glitter', B.baseOf('glitter'), 'clump') - (9.4 + 4 * 4.8 * 0.4 * 1.5)) < 0.1);   // its note: a crowd of 5 takes 21 more
  assert.equal(B.offPts(B.OFF0), 100);
});
test('the night, the level curve and the reference jelly', () => {
  assert.ok(Math.abs(B.night(B.ACTS[0]).out - 131.6) < 1);   // 0.22 x 260 + 0.0011 x 260²
  assert.equal(B.levelAt(4), 2);                             // the first level costs 4 XP
  assert.equal(B.levelAt(9), 3);                             // then round(4 x 1.35) = 5
  assert.deepEqual(B.refStats('normal', 1), B.baseOf('normal'));
  assert.ok(B.refStats('normal', 10).bubbleDamage > B.baseOf('normal').bubbleDamage);
  assert.ok(Math.abs(Object.values(B.offerChance('normal')).reduce((a, b) => a + b, 0) - 3) < 1e-9);
  assert.equal(B.DEF0, 25);
});
test('every number and every knob cites a line that exists', () => {
  const sheets = B.buildSheets();
  assert.deepEqual(sheets.map((s) => s.id), ['S0', 'A1', 'A2', 'A3', 'A4', 'A5']);
  const real = (src) => {
    const m = /^([\w./-]+):(\d+)$/.exec(src);
    if (!m) return /^(src|content|tools)\//.test(src);
    return +m[2] <= fs.readFileSync(path.join(ROOT, m[1]), 'utf8').split('\n').length;
  };
  for (const s of sheets) {
    for (const [label, , src] of s.numbers) for (const one of String(src).split(', ')) assert.ok(real(one.split(' ')[0]), `${s.id} ${label}: ${src}`);
    for (const f of s.flags) { assert.ok(f.text && f.knob.change && f.knob.does, `${s.id}: ${f.text}`); assert.ok(real(f.knob.at), `${s.id} knob ${f.knob.at}`); }
  }
});
