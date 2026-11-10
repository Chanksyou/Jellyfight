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
// a score backed by a logged run: one act, finished with that score (the Worker checks it: checkRun)
const logAct = (id, run, act, outcome, extra = {}) => sqlite.prepare(`INSERT OR REPLACE INTO run_summaries
  (player_id, run_id, act, at, updated_at, revision, finalized, outcome, score, time, level, treasures, details)
  VALUES (?, ?, ?, 1, 1, 1, ?, ?, ?, ?, ?, ?, ?)`).run(id, run, act, outcome === 'in-progress' ? 0 : 1, outcome,
  extra.score ?? 0, extra.time ?? 300, extra.level ?? 10, JSON.stringify(extra.treasures ?? [['candle', 1]]), extra.details ?? null);
const postScore = (body) => { logAct(body.id, 'run-' + body.id, 1, 'died', { score: body.score }); return request('/api/scores', { run: 'run-' + body.id, ...body }); };
const submit = (id, achievements, name = id) => request('/api/achievements', { id, name, achievements });
const clearRates = () => sqlite.exec('DELETE FROM posts');
await request('/api/achievements');
beforeEach(() => sqlite.exec('DELETE FROM player_names; DELETE FROM achievement_unlocks; DELETE FROM achievement_players; DELETE FROM posts; DELETE FROM scores; DELETE FROM feedback; DELETE FROM runs; DELETE FROM run_summaries'));
after(() => sqlite.close());

test('an existing summary database gains details without changing historical records', async () => {
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-abcdefgh', act: 1, revision: 1, outcome: 'started' }] });
  sqlite.exec('ALTER TABLE run_summaries DROP COLUMN details');
  const { default: coldWorker } = await import('../worker/index.js?details-migration');
  const response = await coldWorker.fetch(new Request('https://game.test/api/runs'), env);
  assert.equal(response.status, 405);
  const row = sqlite.prepare('SELECT run_id, outcome, details FROM run_summaries').get();
  assert.deepEqual({ ...row }, { run_id: 'run-abcdefgh', outcome: 'started', details: null });
});

test('run details retain Elite defeats, pickup order and fatal attribution with bounded sanitized input', async () => {
  const row = { run: 'run-abcdefgh', act: 1, revision: 1, outcome: 'died', details: {
    elitesBeaten: 2, elites: [['mug', 75.35], ['<clock>', -5]], treasuresObtained: 3,
    pickups: [['candle', 10.25, 1], ['candle', 40, 2], ['bad', 'invalid', 1]],
    killedBy: { unit: '<ladybug>', source: 'missile', extra: 'discard' }, extra: 'discard',
  } };
  const save = async r => { clearRates(); return request('/api/runs', { id: 'player-one', rows: [r] }); };
  assert.equal((await save(row)).data.saved, true);
  const read = () => JSON.parse(sqlite.prepare('SELECT details FROM run_summaries').get().details);
  assert.deepEqual(read(), { jelly: 'normal', elitesBeaten: 2, elites: [['mug', 75.4], ['clock', 0]], treasuresObtained: 3,
    pickups: [['candle', 10.3, 1], ['candle', 40, 2]], killedBy: { unit: 'ladybug', source: 'missile' } });
  await save({ ...row, revision: 2, details: undefined });
  assert.equal(read().elitesBeaten, 2);   // an older client cannot erase recorded detail
  await save({ ...row, revision: 3, details: { ...row.details, elites: Array(40).fill(['mug', 1]), pickups: Array(140).fill(['candle', 1, 2]) } });
  assert.equal(read().elites.length, 32);
  assert.equal(read().pickups.length, 128);
  await save({ ...row, run: 'another-run-id', outcome: 'next-act' });
  assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM run_summaries WHERE run_id = ?').get('another-run-id').details).killedBy, null);
});

test('act summaries are idempotent, ordered, and final results survive late checkpoints', async () => {
  const save = async (rows) => {
    clearRates();
    return request('/api/runs', { id: 'player-one', rows });
  };
  const row = { run: 'run-abcdefgh', act: 1, revision: 1, outcome: 'started', build: 'v361', device: 'phone', lost: { roach: 4.35 } };
  assert.equal((await save([row])).data.saved, true);
  await save([{ ...row, outcome: 'in-progress', revision: 3, time: 90 }]);
  await save([{ ...row, revision: 2, time: 10 }]);
  assert.equal(sqlite.prepare('SELECT time FROM run_summaries').get().time, 90);
  await save([{ ...row, outcome: 'died', revision: 4, time: 100 }]);
  await save([{ ...row, outcome: 'in-progress', revision: 5, time: 95 }]);
  await save([{ ...row, outcome: 'died', revision: 4, time: 100 }]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM run_summaries').get().n, 1);
  const saved = sqlite.prepare('SELECT * FROM run_summaries').get();
  assert.deepEqual([saved.outcome, saved.time, saved.finalized], ['died', 100, 1]);
  assert.deepEqual(JSON.parse(saved.health_lost), { roach: 4.4 });
  await save([{ ...row, act: 2 }, { ...row, run: 'another-run-id' }]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM run_summaries').get().n, 3);
  assert.equal((await request('/api/runs', { id: 'player-one', rows: [row] })).status, 429);
});

test('summary batches reject invalid and oversized input atomically and keep historical runs', async () => {
  const row = { run: 'run-abcdefgh', act: 1, revision: 1, outcome: 'started' };
  for (const rows of [[], Array(9).fill(row), [row, { ...row, act: 5 }], [{ ...row, revision: NaN }], [{ ...row, outcome: 'invented' }], [null]]) {
    assert.equal((await request('/api/runs', { id: 'player-one', rows })).status, 400);
  }
  assert.equal((await request('/api/runs', { id: 'player-one', rows: [row], extra: 'x'.repeat(48000) })).status, 413);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM run_summaries').get().n, 0);
  assert.equal((await request('/api/runs', { id: 'player-one', run: 'old-run-abcdefgh', act: 1, outcome: 'died' })).data.saved, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 1);
});

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

test('achievement portraits persist a sanitized look without needing a score and survive older clients', async () => {
  const look = { body: 'moon', color: '#12abcd', top: 'crown', unknown: 'discard', name: 'x'.repeat(50) };
  const send = extra => request('/api/achievements', { id: 'player-one', name: 'Portrait Jelly', achievements: ['perfect-boss'], ...extra });
  const first = await send({ look });
  const expected = { body: 'moon', color: '#12abcd', top: 'crown', name: 'x'.repeat(24) };
  assert.deepEqual(first.data.mine.look, expected);
  assert.deepEqual(first.data.top[0].look, expected);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 0);
  clearRates(); await send({});
  assert.deepEqual((await request('/api/achievements?me=player-one')).data.mine.look, expected);
  clearRates(); await send({ look: { body: 'nettle', color: '#abcdef' } });
  assert.equal((await request('/api/achievements')).data.top[0].look.body, 'nettle');
});

test('legacy achievement rows gain portrait storage without losing totals and use an existing score look', async () => {
  await submit('player-one', ['perfect-boss'], 'Legacy Jelly');
  const look = { body: 'moon', color: '#123456' };
  await postScore({ id: 'player-one', name: 'Legacy Jelly', score: 100, look });
  sqlite.exec('ALTER TABLE achievement_players DROP COLUMN look');
  const { default: cold } = await import('../worker/index.js?achievement-look-migration');
  const response = await cold.fetch(new Request('https://game.test/api/achievements?me=player-one'), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.mine.name, 'Legacy Jelly'); assert.equal(data.mine.count, 1);
  assert.deepEqual(data.mine.look, look); assert.deepEqual(data.top[0].look, look);
  assert.ok(sqlite.prepare('PRAGMA table_info(achievement_players)').all().some(c => c.name === 'look'));
});

test('sharing achievements is rate limited separately from posting game scores', async () => {
  assert.equal((await submit('player-one', ['perfect-boss'])).status, 200);
  assert.equal((await submit('player-one', ['pack-light'])).status, 429);
  assert.equal((await postScore({ id: 'player-one', name: 'Jelly', score: 100, won: true })).status, 200);
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
  assert.deepEqual(data.top.map(r => r.name), ['player-one', 'Guest']);
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


test('names are unique across scores and achievements, including case and spaces', async () => {
  assert.equal((await postScore({ id: 'player-one', name: ' Sea   Jelly ', score: 500 })).data.posted, true);
  const clash = await postScore({ id: 'player-two', name: 'sea jelly', score: 700 });
  assert.equal(clash.status, 409); assert.equal(clash.data.why, 'taken');
  assert.equal((await submit('player-three', ['perfect-boss'], 'SEA JELLY')).data.why, 'taken');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM achievement_unlocks').get().n, 0);
});

test('renaming preserves the run and achievement dates and frees the old name', async () => {
  await postScore({ id: 'player-one', name: 'Original', score: 500, look: { body: 'moon' } });
  await submit('player-one', ['perfect-boss'], 'Original');
  const before = { ...sqlite.prepare('SELECT * FROM scores').get() };
  const earned = sqlite.prepare('SELECT at FROM achievement_unlocks').get().at;
  const result = await request('/api/name', { id: 'player-one', name: ' New   Name ' });
  assert.equal(result.data.renamed, true); assert.equal(result.data.name, 'New Name');
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM scores').get() }, { ...before, name: 'New Name' });
  assert.equal(sqlite.prepare('SELECT name FROM achievement_players').get().name, 'New Name');
  assert.equal(sqlite.prepare('SELECT at FROM achievement_unlocks').get().at, earned);
  clearRates();
  await submit('player-one', ['pack-light'], 'New Name');
  assert.equal(sqlite.prepare('SELECT name FROM achievement_players').get().name, 'New Name');
  assert.equal((await postScore({ id: 'player-two', name: 'Original', score: 200 })).data.posted, true);
  clearRates();
  assert.equal((await request('/api/name', { id: 'player-one', name: 'original' })).data.why, 'taken');
  assert.equal(sqlite.prepare('SELECT name FROM scores WHERE id = ?').get('player-one').name, 'New Name');
});

test('rename rejects unknown players, blank names, malformed requests and rapid repeat changes', async () => {
  assert.equal((await request('/api/name', { id: 'player-one', name: 'Unknown' })).status, 404);
  await postScore({ id: 'player-one', name: 'Jelly', score: 500 });
  assert.equal((await request('/api/name', { id: 'player-one', name: ' ' })).status, 400);
  assert.equal((await request('/api/name', { id: 'player-one', name: 'Squid' })).data.renamed, true);
  assert.equal((await request('/api/name', { id: 'player-one', name: 'Octopus' })).status, 429);
});

test('simultaneous name claims have one winner and do not partially save the loser', async () => {
  const results = await Promise.all(['player-one', 'player-two'].map(id => postScore({ id, name: 'Same Jelly', score: 500 })));
  assert.equal(results.filter(r => r.data.posted).length, 1);
  assert.equal(results.filter(r => r.data.why === 'taken').length, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 1);
});

test('migration keeps earliest saved name, reserves existing numbered names, and is idempotent', async () => {
  sqlite.exec("DELETE FROM migrations WHERE name = 'player-names'");
  const insert = sqlite.prepare('INSERT INTO scores (id, name, score, at) VALUES (?, ?, ?, ?)');
  insert.run('player-first', 'Jelly', 500, 10);
  insert.run('player-later', ' jelly ', 900, 20);
  insert.run('player-number', 'Jelly 2', 400, 30);
  const { default: cold } = await import('../worker/index.js?names-migration');
  const result = await cold.fetch(new Request('https://game.test/api/scores'), env);
  assert.equal(result.status, 200);
  assert.equal(sqlite.prepare('SELECT name FROM scores WHERE id = ?').get('player-first').name, 'Jelly');
  assert.equal(sqlite.prepare('SELECT name FROM scores WHERE id = ?').get('player-later').name, 'jelly 3');
  assert.equal(sqlite.prepare('SELECT name FROM scores WHERE id = ?').get('player-number').name, 'Jelly 2');
  assert.equal(sqlite.prepare('SELECT score FROM scores WHERE id = ?').get('player-later').score, 900);
  await request('/api/name', { id: 'player-first', name: 'Squid' });
  const { default: another } = await import('../worker/index.js?names-again');
  await another.fetch(new Request('https://game.test/api/scores'), env);
  assert.equal(sqlite.prepare('SELECT name FROM scores WHERE id = ?').get('player-first').name, 'Squid');
});

test('a score must be the last act of a run its player logged, and the run must look playable', async () => {
  const post = (run, score) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score }); };
  assert.equal((await post(undefined, 500)).data.why, 'unverified');            // no run named
  assert.equal((await post('run-missing', 500)).data.why, 'pending');           // its log hasn't arrived
  logAct('player-one', 'run-good', 1, 'next-act', { score: 12000, level: 13 });
  assert.equal((await post('run-good', 12000)).data.why, 'pending');            // still going
  logAct('player-one', 'run-good', 2, 'died', { score: 20000, level: 16, time: 90 });
  assert.equal((await post('run-good', 60000)).data.why, 'unverified');         // not the score it logged
  assert.equal((await post('run-good', 20000)).data.posted, true);
  logAct('player-one', 'run-skip', 1, 'next-act', { score: 10000 });             // act 2 missing
  logAct('player-one', 'run-skip', 3, 'died', { score: 30000 });
  assert.equal((await post('run-skip', 30000)).data.why, 'unverified');
  logAct('player-one', 'run-open', 1, 'in-progress', { score: 10000 });          // act 1 never finished
  logAct('player-one', 'run-open', 2, 'died', { score: 30000 });
  assert.equal((await post('run-open', 30000)).data.why, 'unverified');
  logAct('player-one', 'run-level', 1, 'died', { score: 30000, level: 30 });     // level 30 in act 1
  assert.equal((await post('run-level', 30000)).data.why, 'unverified');
  logAct('player-one', 'run-stack', 1, 'died', { score: 30000, treasures: [['penSpring', 10]] });
  assert.equal((await post('run-stack', 30000)).data.why, 'unverified');
  logAct('player-one', 'run-rush', 1, 'next-act', { score: 10000, time: 40 });   // cleared act 1 in 40 s
  logAct('player-one', 'run-rush', 2, 'died', { score: 30000 });
  assert.equal((await post('run-rush', 30000)).data.why, 'unverified');
  assert.equal(sqlite.prepare('SELECT score FROM scores').get().score, 20000);
});

test('a score names the jelly type its run was logged as, and a missing type is Normal', async () => {
  const post = (run, score, jelly) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, jelly }); };
  logAct('player-one', 'run-older', 1, 'died', { score: 1000 });                                   // an older client: no details, no type
  assert.deepEqual((await post('run-older', 1000)).data, { posted: true });
  logAct('player-one', 'run-fire', 1, 'next-act', { score: 2000, details: JSON.stringify({ jelly: 'fire' }) });
  logAct('player-one', 'run-fire', 2, 'died', { score: 3000, details: JSON.stringify({ jelly: 'fire' }) });
  assert.equal((await post('run-fire', 3000)).data.why, 'unverified');                          // posted as Normal
  assert.equal((await post('run-fire', 3000, 'ice')).data.why, 'unverified');                   // posted as another type
  assert.equal((await post('run-fire', 3000, 'fire')).data.posted, true);
  logAct('player-one', 'run-swap', 1, 'next-act', { score: 4000, details: JSON.stringify({ jelly: 'fire' }) });
  logAct('player-one', 'run-swap', 2, 'died', { score: 5000, details: JSON.stringify({ jelly: 'ice' }) });   // changed type mid-run
  assert.equal((await post('run-swap', 5000, 'ice')).data.why, 'unverified');
});

test('the dev password is checked against the secret, slowly, and never opens without one', async () => {
  const unlock = async (pass, secret) => { clearRates(); env.DEV_PASSWORD = secret; return (await request('/api/dev', { pass })).data.open; };
  assert.equal(await unlock('anything', undefined), false);
  assert.equal(await unlock('', ''), false);
  assert.equal(await unlock('nope', 'sea-secret'), false);
  assert.equal(await unlock(' sea-secret ', 'sea-secret'), true);
  assert.equal((await request('/api/dev', { pass: 'sea-secret' })).status, 429);
  delete env.DEV_PASSWORD;
});
