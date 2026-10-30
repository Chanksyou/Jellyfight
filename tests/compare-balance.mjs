// Compare saved JSONL reports from two revisions without running the game again.
import fs from 'node:fs';
import { estimate } from './balance-core.mjs';

export function compareReports(before, after) {
  const meta = rows => rows.find(r => r.type === 'metadata');
  const a = meta(before), b = meta(after);
  if (!a || !b || a.tool !== b.tool) throw Error('Both reports need metadata from the same tool');
  for (const key of ['act', 'actOnly', 'seconds', 'prefer']) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) throw Error(`Reports use different ${key}`);
  }
  // Card amounts are the treatment under test; identity remains the same across a balance change.
  const key = r => JSON.stringify([r.type, r.style, r.seed, r.arm, [...r.build].sort(), r.card?.id || r.card?.stat, r.itemId, r.enemy, r.mode, r.probe]);
  const measurements = rows => rows.filter(r => ['run', 'encounter'].includes(r.type));
  const old = new Map();
  for (const r of measurements(before)) { const k = key(r); if (old.has(k)) throw Error('Duplicate comparison row'); old.set(k, r); }
  const groups = new Map(), seen = new Set(); let unmatchedAfter = 0;
  for (const r of measurements(after)) {
    const k = key(r); if (seen.has(k)) throw Error('Duplicate comparison row'); seen.add(k);
    const prev = old.get(k); if (!prev) { unmatchedAfter++; continue; }
    old.delete(k);
    const id = JSON.stringify([r.type, r.style, r.arm, r.itemId, r.enemy, r.mode, r.probe]);
    const group = groups.get(id) || { type: r.type, style: r.style, arm: r.arm, itemId: r.itemId, enemy: r.enemy, mode: r.mode, probe: r.probe, pairs: [] };
    group.pairs.push([prev, r]); groups.set(id, group);
  }
  if (!groups.size) throw Error('No matching seeds/styles/builds/scenarios');
  return { before: a.revision, after: b.revision, unmatchedBefore: old.size, unmatchedAfter,
    comparisons: [...groups.values()].map(({ pairs, ...group }) => ({ ...group, n: pairs.length,
      healthLostDifference: estimate(pairs.map(([a, b]) => b.healthLost - a.healthLost)),
      damageDifference: estimate(pairs.map(([a, b]) => b.damage - a.damage)),
      completedClearSecondsDifference: estimate(pairs.filter(([a, b]) => a.outcome === 'cleared' && b.outcome === 'cleared').map(([a, b]) => b.elapsed - a.elapsed)),
      outcomes: pairs.map(([a, b]) => ({ seed: b.seed, before: a.outcome, after: b.outcome })) })) };
}

if (process.argv[1]?.endsWith('compare-balance.mjs')) {
  const paths = process.argv.slice(2);
  if (paths.length !== 2) throw Error('Usage: node tests/compare-balance.mjs before.jsonl after.jsonl');
  const read = p => fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  console.log(JSON.stringify(compareReports(read(paths[0]), read(paths[1])), null, 2));
}
