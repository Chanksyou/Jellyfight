import test from 'node:test';
import assert from 'node:assert/strict';
import { options, movement, choose, paired, winInterval } from './balance-core.mjs';
import { compareReports } from './compare-balance.mjs';

test('balance options preserve explicit paired seeds and reject invalid experiments', () => {
  const o = options(['--seeds=0,17', '--styles=close,rooting', '--build=candle', '--add=lighterFluid']);
  assert.deepEqual(o.seeds, [0, 17]); assert.deepEqual(o.styles, ['close', 'rooting']);
  assert.deepEqual(options(['lemon', '1/3'], 'matchup').shard, 1);
  for (const args of [['--styles=typo'], ['--seeds='], ['--seeds=1,1'], ['--seed=-1'], ['0'], ['--wat=1'], ['--synergy=a'], ['--synergy=a+b', '--add=c']]) assert.throws(() => options(args));
});
test('styles seek different engagement distances, and rooting holds until threatened', () => {
  const world = { x: 0, z: 0, nearest: { x: 0.15, z: 0, r: 0.01 } };
  assert.equal(movement('close', world).x, 1);
  assert.equal(movement('ranged', world).x, -1);
  assert.equal(movement('rooting', world).x, 0);
  assert.equal(movement('rooting', { ...world, nearest: { x: 0.05, z: 0, r: 0.01 } }).retreat, true);
  assert.equal(movement('rooting', { ...world, retreat: true }).x, -1);
  assert.equal(movement('stationary', { ...world, shots: [{ x: 0.01, z: 0 }] }).x, 0);
});
test('choices use style priorities, explicit preferences, and seeded tie-breaking', () => {
  const cards = [{ stat: 'health' }, { stat: 'bubbleDamage' }];
  assert.equal(choose(cards, 'close', [], () => 0), 0);
  assert.equal(choose(cards, 'ranged', [], () => 0), 1);
  assert.equal(choose(cards, 'ranged', ['health'], () => 0), 0);
  assert.equal(choose([{ id: 'a' }, { id: 'b' }], 'ranged', [], () => 0.99), 1);
});
test('paired estimates match seeds rather than row order; small win samples retain uncertainty', () => {
  const rows = [{ arm: 'base', style: 'ranged', seed: 1, value: 10 }, { arm: 'base', style: 'ranged', seed: 2, value: 40 },
    { arm: 'added', style: 'ranged', seed: 2, value: 35 }, { arm: 'added', style: 'ranged', seed: 1, value: 5 }];
  assert.equal(paired(rows, r => r.value).mean, -5);
  const ci = winInterval(2, 5); assert.ok(ci.lower95 < 0.12 && ci.upper95 > 0.76);
});
test('saved report comparison rejects mismatched experiments and preserves incomplete outcomes', () => {
  const meta = { type: 'metadata', tool: 'balance', revision: 'before', seconds: 10, prefer: [] };
  const row = { type: 'run', style: 'rooting', arm: 'base', seed: 1, build: [], healthLost: 5, damage: 10, outcome: 'timeout', elapsed: 10 };
  const report = compareReports([meta, row], [{ ...meta, revision: 'after' }, { ...row, healthLost: 3 }]);
  assert.equal(report.comparisons[0].healthLostDifference.mean, -2);
  assert.equal(report.comparisons[0].completedClearSecondsDifference.n, 0);
  assert.throws(() => compareReports([meta, row], [{ ...meta, seconds: 20 }, row]));
  assert.throws(() => compareReports([meta, row], [meta, { ...row, seed: 2 }]));
  const card = { ...row, card: { id: 'card:regen', stat: 'regen', amount: 0.3 } };
  assert.equal(compareReports([meta, card], [meta, { ...card, card: { ...card.card, amount: 0.4 } }]).comparisons[0].n, 1);
});
