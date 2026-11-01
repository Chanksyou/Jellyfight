// Exercise the real Worker SQL against SQLite, the database engine used by D1.
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.js';
import { ACHIEVEMENTS } from '../src/achievements.js';

const sqlite = new DatabaseSync(':memory:');
let rateBarrier = null;
const statement = (sql, values = []) => ({
  sql, values,
  bind(...next) { return statement(sql, next); },
  async all() {
    const result = { results: sqlite.prepare(sql).all(...values) };
    if (sql === 'SELECT key, at FROM posts WHERE key IN (?, ?)') await rateBarrier?.();
    return result;
  },
  async first() { return sqlite.prepare(sql).get(...values) || null; },
  async run() { return sqlite.prepare(sql).run(...values); },
});
const db = {
  prepare: statement,
  async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const out = statements.map(s => ({ results: sqlite.prepare(s.sql).all(...s.values) }));
      sqlite.exec('COMMIT'); return out;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
const env = { DB: db, ASSETS: { fetch: async () => new Response('asset') } };
const request = async (path, body) => {
  const response = await worker.fetch(new Request('https://game.test' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': body.id || 'test' }, body: JSON.stringify(body),
  }), env);
  return { status: response.status, data: await response.json() };
};
const submit = (id, achievements, name = id) => request('/api/achievements', { id, name, achievements });
const clearRates = () => sqlite.exec('DELETE FROM posts');
await request('/api/achievements');
beforeEach(() => sqlite.exec('DELETE FROM achievement_unlocks; DELETE FROM achievement_players; DELETE FROM posts; DELETE FROM scores; DELETE FROM feedback; DELETE FROM runs'));
after(() => sqlite.close());

test('achievement board unions unique earned IDs without shrinking earlier totals', async () => {
  let result = await submit('player-one', ['perfect-boss', 'perfect-boss'], '<Jelly>');
  assert.equal(result.status, 200); assert.equal(result.data.mine.count, 1); assert.equal(result.data.mine.name, 'Jelly');
  clearRates();
  result = await submit('player-one', ['pack-light']);
  assert.equal(result.data.mine.count, 2);
  clearRates();
  result = await submit('player-one', ['perfect-boss']);
  assert.equal(result.data.mine.count, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM achievement_unlocks').get().n, 2);
});

test('achievement board returns only five leaders, hides other IDs, and includes own total outside top five', async () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  for (let i = 1; i <= 7; i++) await submit('player-' + i, ids.slice(0, i));
  const { data } = await request('/api/achievements?me=player-1');
  assert.deepEqual(data.top.map(r => r.count), [7, 6, 5, 4, 3]);
  assert.ok(data.top.every(r => !Object.hasOwn(r, 'id')));
  assert.equal(data.mine.id, 'player-1'); assert.equal(data.mine.count, 1);
  const own = await request('/api/achievements?me=player-7');
  assert.equal(own.data.top[0].id, 'player-7');
});

test('invalid achievement IDs, empty submissions, oversized lists and invalid player IDs are rejected', async () => {
  for (const [id, ids] of [['bad', ['perfect-boss']], ['player-one', ['invented']], ['player-one', []], ['player-one', Array(14).fill('perfect-boss')], ['player-one', [null]]]) {
    assert.equal((await submit(id, ids)).status, 400);
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM achievement_players').get().n, 0);
  const response = await worker.fetch(new Request('https://game.test/api/achievements', { method: 'POST', body: '{' }), env);
  assert.equal(response.status, 400);
});

test('sharing achievements is rate limited separately from posting game scores', async () => {
  assert.equal((await submit('player-one', ['perfect-boss'])).status, 200);
  assert.equal((await submit('player-one', ['pack-light'])).status, 429);
  assert.equal((await request('/api/scores', { id: 'player-one', name: 'Jelly', score: 100, won: true })).status, 200);
  clearRates();
  assert.equal((await submit('player-one', ['pack-light'])).data.mine.count, 2);
});

test('concurrent submissions preserve the union of different achievements', async () => {
  // Both requests can pass the asynchronous rate check before either writes; neither grant may be lost.
  let release, readers = 0; const ready = new Promise(resolve => { release = resolve; });
  rateBarrier = () => { if (++readers === 2) release(); return ready; };
  try {
    const responses = await Promise.all([submit('player-one', ['perfect-boss']), submit('player-one', ['pack-light'])]);
    assert.ok(responses.every(r => r.status === 200));
    assert.equal((await request('/api/achievements?me=player-one')).data.mine.count, 2);
  } finally { rateBarrier = null; }
});

test('counts come from grants rather than a supplied count, and ties have stable ordering', async () => {
  await request('/api/achievements', { id: 'player-two', achievements: ['perfect-boss'], count: 999 });
  await submit('player-one', ['perfect-boss']);
  sqlite.exec('UPDATE achievement_unlocks SET at = 1');
  const { data } = await request('/api/achievements');
  assert.deepEqual(data.top.map(r => r.count), [1, 1]);
  assert.deepEqual(data.top.map(r => r.name), ['player-one', 'A jelly']);
});

test('beta feedback is kept as plain text with its run, rate limited, and never readable over the API', async () => {
  const send = (body) => request('/api/feedback', { id: 'player-one', build: 'v361', act: 2, won: false, score: 1234, device: 'phone', ...body });
  assert.equal((await send({ text: '  The Mug is too hard\nloved the jelly \u0007 ' })).data.sent, true);
  const row = sqlite.prepare('SELECT * FROM feedback').get();
  assert.equal(row.text, 'The Mug is too hard\nloved the jelly');
  assert.deepEqual([row.player_id, row.build, row.act, row.won, row.score, row.device], ['player-one', 'v361', 2, 0, 1234, 'phone']);
  assert.equal((await send({ text: 'again' })).status, 429);
  clearRates();
  assert.equal((await send({ text: 'x'.repeat(5000) })).data.sent, true);
  assert.equal(sqlite.prepare('SELECT MAX(LENGTH(text)) AS n FROM feedback').get().n, 1000);
  clearRates();
  assert.equal((await send({ text: '   ' })).status, 400);
  assert.equal((await request('/api/feedback', { id: 'bad', text: 'hi' })).status, 400);
  assert.equal((await request('/api/feedback')).status, 405);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get().n, 2);
});

test('the run log keeps one row per act with its lists as clean JSON, rate limited, and never readable over the API', async () => {
  const save = (body) => request('/api/runs', { id: 'player-one', run: 'run-abcdefgh', build: 'v361', act: 1, outcome: 'next-act', score: 4200, time: 540,
    level: 12, kills: 300, body: 'nettle', treasures: [['candle', 2], ['<x>', 1], 'junk'], evolutions: ['siphon'], lost: { roach: 12.345, boss: 'x', '': 3 }, bossLeft: null, device: 'phone', ...body });
  assert.equal((await save({})).data.saved, true);
  const row = sqlite.prepare('SELECT * FROM runs').get();
  assert.deepEqual([row.player_id, row.run_id, row.act, row.outcome, row.score, row.level, row.kills, row.boss_left, row.device], ['player-one', 'run-abcdefgh', 1, 'next-act', 4200, 12, 300, null, 'phone']);
  assert.deepEqual(JSON.parse(row.treasures), [['candle', 2], ['x', 1]]);
  assert.deepEqual(JSON.parse(row.evolutions), ['siphon']);
  assert.deepEqual(JSON.parse(row.health_lost), { roach: 12.3 });
  assert.equal((await save({ act: 2, outcome: 'died' })).status, 429);
  clearRates();
  assert.equal((await save({ act: 2, outcome: 'died', bossLeft: 37 })).data.saved, true);
  clearRates();
  assert.equal((await save({ outcome: 'cheated' })).status, 400);
  assert.equal((await save({ run: 'x' })).status, 400);
  assert.equal((await request('/api/runs')).status, 405);
  assert.deepEqual(sqlite.prepare('SELECT act, outcome, boss_left FROM runs ORDER BY at, act').all().map(r => ({ ...r })), [{ act: 1, outcome: 'next-act', boss_left: null }, { act: 2, outcome: 'died', boss_left: 37 }]);
});
