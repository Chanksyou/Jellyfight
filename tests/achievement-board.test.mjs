// Exercise the real Worker SQL against SQLite, the database engine used by D1.
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { checkRun, WAVES, top, seasonOf } from '../worker/index.js';
import { readFileSync } from 'node:fs';
import { ACHIEVEMENTS } from '../src/achievements.js';
import { SEASON, actScore } from '../src/score.js';

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
// a score backed by a logged run: acts finished with those scores (the Worker checks them: checkRun) and, in each
// act's details, score facts that add up to what the act earned (the Worker scores the run itself: src/score.js)
function factsFor(points, won, time = 300) {
  const f = won ? { nightShare: 0, bossShare: 1, bugsOut: 100, bugsCleared: 0, damageTaken: 100, bossSeconds: Math.max(10, Math.min(180, time)) }
    : { nightShare: 0, bossShare: 0, bugsOut: 100, bugsCleared: 0, damageTaken: 0, bossSeconds: null };
  let r = points - actScore({ ...f, won, elites: 0 }), elites = Math.max(0, Math.min(3, Math.floor(r / 500)));
  r -= elites * 500;
  const night = Math.max(0, Math.min(2000, Math.floor(r / 20) * 20)); f.nightShare = night / 2000; r -= night;
  if (won) { const c = Math.max(0, Math.min(2000, Math.floor(r / 20) * 20)); f.damageTaken = 100 - c / 20; r -= c; }
  else { const b = Math.max(0, Math.min(3000, Math.floor(r / 30) * 30)); f.bossShare = b / 3000; r -= b; }
  f.bugsCleared = r / 10;
  if (actScore({ ...f, won, elites }) !== points || !Number.isInteger(f.bugsCleared) || f.bugsCleared > 100) throw new Error(`no act earns ${points}${won ? ' cleared' : ''}`);
  return { facts: f, elites };
}
const logAct = (id, run, act, outcome, extra = {}) => {
  const before = sqlite.prepare('SELECT score FROM run_summaries WHERE player_id = ? AND run_id = ? AND act = ?').get(id, run, act - 1)?.score ?? 0;
  const time = extra.time ?? 300, score = extra.score ?? 0;
  const made = extra.facts ? { facts: extra.facts, elites: 0 } : factsFor(score - before, outcome === 'next-act' || outcome === 'won', time);
  const details = JSON.stringify({ season: SEASON, elitesBeaten: made.elites, ...(extra.details ? JSON.parse(extra.details) : {}), score: made.facts });
  sqlite.prepare(`INSERT OR REPLACE INTO run_summaries
  (player_id, run_id, act, at, updated_at, revision, finalized, outcome, score, time, level, treasures, details, boss_left)
  VALUES (?, ?, ?, 1, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, run, act, outcome === 'in-progress' ? 0 : 1, outcome,
  score, time, extra.level ?? 10, JSON.stringify(extra.treasures ?? [['candle', 1]]), extra.raw ?? details, extra.bossLeft ?? null);
};
const postScore = (body) => { logAct(body.id, 'run-' + body.id, 1, 'died', { score: body.score }); return request('/api/scores', { run: 'run-' + body.id, season: SEASON, ...body }); };
const submit = (id, achievements, name = id) => request('/api/achievements', { id, name, achievements });
const clearRates = () => sqlite.exec('DELETE FROM posts');
await request('/api/achievements');
beforeEach(() => sqlite.exec('DELETE FROM player_names; DELETE FROM achievement_unlocks; DELETE FROM achievement_players; DELETE FROM posts; DELETE FROM scores; DELETE FROM feedback; DELETE FROM runs; DELETE FROM run_summaries; DELETE FROM perf_reports; DELETE FROM board'));
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
    offers: [['chest', 12.34, ['candle', '<x>', 'rug', 'a', 'b', 'c', 'd'], 'candle'], ['bogus', 1, ['a'], ''], 'bad'],
    cards: [[20, ['fireRate-rare', 'health-common'], 'fireRate-rare']], dealt: { bubble: 6.54, '<x>': 1, tentacle: 'no' }, bossDoor: { level: 9, fireRate: 2.345 },
    killedBy: { unit: '<ladybug>', source: 'missile', extra: 'discard' }, extra: 'discard',
  } };
  const save = async r => { clearRates(); return request('/api/runs', { id: 'player-one', rows: [r] }); };
  assert.equal((await save(row)).data.saved, true);
  const read = () => JSON.parse(sqlite.prepare('SELECT details FROM run_summaries').get().details);
  assert.deepEqual(read(), { jelly: 'normal', upgrades: [], elitesBeaten: 2, elites: [['mug', 75.4], ['clock', 0]], treasuresObtained: 3,
    pickups: [['candle', 10.3, 1], ['candle', 40, 2]],
    offers: [['chest', 12.3, ['candle', 'x', 'rug', 'a', 'b', 'c'], 'candle'], ['chest', 1, ['a'], '']],
    cards: [[20, ['fireRate-rare', 'health-common'], 'fireRate-rare']], dealt: { bubble: 6.5, x: 1 }, bossDoor: { level: 9, fireRate: 2.3 },
    killedBy: { unit: 'ladybug', source: 'missile' } });
  await save({ ...row, revision: 2, details: undefined });
  assert.equal(read().elitesBeaten, 2);   // an older client cannot erase recorded detail
  await save({ ...row, revision: 3, details: { ...row.details, elites: Array(40).fill(['mug', 1]), pickups: Array(140).fill(['candle', 1, 2]) } });
  assert.equal(read().elites.length, 32);
  assert.equal(read().pickups.length, 128);
  await save({ ...row, run: 'another-run-id', outcome: 'next-act' });
  assert.equal(JSON.parse(sqlite.prepare('SELECT details FROM run_summaries WHERE run_id = ?').get('another-run-id').details).killedBy, null);
});

test('run details keep frame numbers and Settings picks as clamped numbers and fixed words, and drop anything else', async () => {
  clearRates();
  const perf = { ms: 16.74, p95: 900, slow: 0.04871, n: 1200, minRatio: 1.125, tier: 'medium', cap: 30, dpr: 3, w: 844, h: 390, loadMs: 4200.6, lost: 1, ua: 'discard' };
  const settings = { graphics: 'low', fps: 30, text: 'large', easy: 1, music: false, sound: true, calm: false, calmOs: true, name: 'discard' };
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-abcdefgh', act: 1, revision: 1, outcome: 'died', details: { perf, settings } }] });
  const read = () => JSON.parse(sqlite.prepare('SELECT details FROM run_summaries').get().details);
  assert.deepEqual(read().perf, { ms: 16.7, p95: 128, slow: 0.049, n: 1200, minRatio: 1.125, tier: 'medium', cap: 30, dpr: 3, w: 844, h: 390, loadMs: 4201, lost: 1 });
  assert.deepEqual(read().settings, { graphics: 'low', fps: 30, text: 'large', easy: true, music: false, sound: true, calm: false, calmOs: true });
  clearRates();
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-abcdefgh', act: 1, revision: 2, outcome: 'died',
    details: { perf: { tier: '<b>', ms: 'x', cap: 'y' }, settings: { graphics: 'ultra', fps: 144 } } }] });
  assert.deepEqual(read().perf, { ms: null, p95: null, slow: null, n: 0, minRatio: null, tier: null, cap: 0, dpr: null, w: 0, h: 0, loadMs: 0, lost: 0 });
  assert.equal(read().settings.graphics, null);
  assert.equal(read().settings.fps, null);
  clearRates();
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-zzzzzzzz', act: 1, revision: 1, outcome: 'died', details: { elitesBeaten: 1 } }] });
  const older = JSON.parse(sqlite.prepare('SELECT details FROM run_summaries WHERE run_id = ?').get('run-zzzzzzzz').details);
  assert.equal('perf' in older || 'settings' in older, false);   // a client from before sends none
});

test('run details keep each act\'s score facts as clamped numbers, and an older client sends none', async () => {
  clearRates();
  const score = { bugsOut: 120.4, bugsCleared: 999999, damageTaken: 42.36, bossSeconds: 71.04, nightShare: 1.4, bossShare: -2, won: true };
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-scoreabc', act: 1, revision: 1, outcome: 'next-act', details: { score } }] });
  const read = (run) => JSON.parse(sqlite.prepare('SELECT details FROM run_summaries WHERE run_id = ?').get(run).details);
  assert.deepEqual(read('run-scoreabc').score, { bugsOut: 120, bugsCleared: 100000, damageTaken: 42.4, bossSeconds: 71, nightShare: 1, bossShare: 0 });
  clearRates();
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-scorexyz', act: 1, revision: 1, outcome: 'died', details: { score: { bossSeconds: null, damageTaken: 'x' } } }] });
  assert.deepEqual(read('run-scorexyz').score, { bugsOut: 0, bugsCleared: 0, damageTaken: null, bossSeconds: null, nightShare: null, bossShare: null });
  clearRates();
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-scoreold', act: 1, revision: 1, outcome: 'died', details: { elitesBeaten: 1 } }] });
  assert.equal('score' in read('run-scoreold'), false);
  assert.equal('season' in read('run-scoreold'), false);   // an older client sends no season
  clearRates();
  await request('/api/runs', { id: 'player-one', rows: [{ run: 'run-season', act: 1, revision: 1, outcome: 'died', details: { season: SEASON } }] });
  assert.equal(read('run-season').season, SEASON);
});

test('the phone bench\'s results are kept in perf_reports: bounded, no player id, one per address every 30 seconds', async () => {
  const post = (body) => worker.fetch(new Request('https://game.test/api/perf', { method: 'POST', headers: { 'cf-connecting-ip': 'phone-a', 'user-agent': 'U'.repeat(300) }, body: JSON.stringify(body) }), env).then(async r => ({ status: r.status, data: await r.json() }));
  const bench = { env: { build: 'v1' }, moments: [{ name: 'quiet room', ms: 16.7 }] };
  assert.deepEqual((await post({ build: 'v1', device: 'phone', bench })).data, { sent: true });
  const row = sqlite.prepare('SELECT * FROM perf_reports').get();
  assert.deepEqual({ ...row, at: 0, ua: row.ua.length }, { at: 0, build: 'v1', device: 'phone', ua: 200, json: JSON.stringify(bench) });
  assert.equal((await post({ build: 'v1', bench })).status, 429);
  clearRates();
  assert.equal((await post({ bench: { pad: 'x'.repeat(9000) } })).status, 413);
  assert.equal((await post({ bench: 'text' })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM perf_reports').get().n, 1);
  const get = await worker.fetch(new Request('https://game.test/api/perf'), env);
  assert.equal(get.status, 405);
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
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM board').get().n, 0);
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
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM board').get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM achievement_unlocks').get().n, 0);
});

test('renaming preserves the run and achievement dates and frees the old name', async () => {
  await postScore({ id: 'player-one', name: 'Original', score: 500, look: { body: 'moon' } });
  await submit('player-one', ['perfect-boss'], 'Original');
  const before = { ...sqlite.prepare('SELECT * FROM board').get() };
  const earned = sqlite.prepare('SELECT at FROM achievement_unlocks').get().at;
  const result = await request('/api/name', { id: 'player-one', name: ' New   Name ' });
  assert.equal(result.data.renamed, true); assert.equal(result.data.name, 'New Name');
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM board').get() }, { ...before, name: 'New Name' });
  assert.equal(sqlite.prepare('SELECT name FROM achievement_players').get().name, 'New Name');
  assert.equal(sqlite.prepare('SELECT at FROM achievement_unlocks').get().at, earned);
  clearRates();
  await submit('player-one', ['pack-light'], 'New Name');
  assert.equal(sqlite.prepare('SELECT name FROM achievement_players').get().name, 'New Name');
  assert.equal((await postScore({ id: 'player-two', name: 'Original', score: 200 })).data.posted, true);
  clearRates();
  assert.equal((await request('/api/name', { id: 'player-one', name: 'original' })).data.why, 'taken');
  assert.equal(sqlite.prepare('SELECT name FROM board WHERE id = ?').get('player-one').name, 'New Name');
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
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM board').get().n, 1);
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
  const post = (run, score) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, season: SEASON }); };
  assert.equal((await post(undefined, 500)).data.why, 'unverified');            // no run named
  assert.equal((await post('run-missing', 500)).data.why, 'pending');           // its log hasn't arrived
  logAct('player-one', 'run-good', 1, 'next-act', { score: 12000, level: 13 });
  assert.equal((await post('run-good', 12000)).data.why, 'pending');            // still going
  logAct('player-one', 'run-good', 2, 'died', { score: 19000, level: 16, time: 90 });
  assert.equal((await post('run-good', 60000)).data.why, 'unverified');         // not the score it logged
  assert.equal((await post('run-good', 19000)).data.posted, true);
  logAct('player-one', 'run-skip', 1, 'next-act', { score: 10000 });             // act 2 missing
  logAct('player-one', 'run-skip', 3, 'died', { score: 16000, facts: {} });
  assert.equal((await post('run-skip', 16000)).data.why, 'unverified');
  logAct('player-one', 'run-open', 1, 'in-progress', { score: 5000 });          // act 1 never finished
  logAct('player-one', 'run-open', 2, 'died', { score: 11000 });
  assert.equal((await post('run-open', 11000)).data.why, 'unverified');
  logAct('player-one', 'run-level', 1, 'died', { score: 7000, level: 30 });     // level 30 in act 1
  assert.equal((await post('run-level', 7000)).data.why, 'unverified');
  logAct('player-one', 'run-stack', 1, 'died', { score: 7000, treasures: [['penSpring', 10]] });
  assert.equal((await post('run-stack', 7000)).data.why, 'unverified');
  logAct('player-one', 'run-rush', 1, 'next-act', { score: 10000, time: 40 });   // cleared act 1 in 40 s
  logAct('player-one', 'run-rush', 2, 'died', { score: 16000 });
  assert.equal((await post('run-rush', 16000)).data.why, 'unverified');
  assert.equal(sqlite.prepare('SELECT score FROM board').get().score, 19000);
});

test('act 4 has a night before its arena: a win or an Encore fight takes 170 s, and its levels go higher', async () => {
  const post = (run, score) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, season: SEASON }); };
  const upTo3 = (run) => [1, 2, 3].forEach((act) => logAct('player-one', run, act, 'next-act', { score: act * 10000, level: 10 + act }));
  upTo3('run-won4'); logAct('player-one', 'run-won4', 4, 'won', { score: 40000, level: 31, time: 260 });       // the night, then the Encore beaten
  assert.equal((await post('run-won4', 40000)).data.posted, true);
  upTo3('run-quick'); logAct('player-one', 'run-quick', 4, 'won', { score: 40000, level: 20, time: 90 });    // won act 4 without its night
  assert.equal((await post('run-quick', 40000)).data.why, 'unverified');
  upTo3('run-arena'); logAct('player-one', 'run-arena', 4, 'died', { score: 36000, level: 20, time: 120, bossLeft: 60 });   // in the arena too soon
  assert.equal((await post('run-arena', 36000)).data.why, 'unverified');
  upTo3('run-room4'); logAct('player-one', 'run-room4', 4, 'died', { score: 36500, level: 20, time: 60 });     // dried out in the room: no rule on time
  assert.equal((await post('run-room4', 36500)).data.why, 'lower');                // verified, but below the win above
  upTo3('run-high4'); logAct('player-one', 'run-high4', 4, 'won', { score: 40000, level: 33, time: 300 });    // past act 4's level cap
  assert.equal((await post('run-high4', 40000)).data.why, 'unverified');
});

test('a score names the jelly type its run was logged as, and a missing type is Normal', async () => {
  const post = (run, score, jelly) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, jelly, season: SEASON }); };
  logAct('player-one', 'run-older', 1, 'died', { score: 1000 });                                   // no jelly type logged or posted: Normal
  assert.deepEqual((await post('run-older', 1000)).data, { posted: true });
  logAct('player-one', 'run-fire', 1, 'next-act', { score: 10000, details: JSON.stringify({ jelly: 'fire' }) });
  logAct('player-one', 'run-fire', 2, 'died', { score: 15000, details: JSON.stringify({ jelly: 'fire' }) });
  assert.equal((await post('run-fire', 15000)).data.why, 'unverified');                          // posted as Normal
  assert.equal((await post('run-fire', 15000, 'ice')).data.why, 'unverified');                   // posted as another type
  assert.equal((await post('run-fire', 15000, 'fire')).data.posted, true);
  logAct('player-one', 'run-swap', 1, 'next-act', { score: 10000, details: JSON.stringify({ jelly: 'fire' }) });
  logAct('player-one', 'run-swap', 2, 'died', { score: 15000, details: JSON.stringify({ jelly: 'ice' }) });   // changed type mid-run
  assert.equal((await post('run-swap', 15000, 'ice')).data.why, 'unverified');
});

test('a jelly type run with up to 4 Attack upgrades (one at the start, one per boss) and several former evolutions posts, and the board shows its type', async () => {
  const post = (run, score, jelly) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, jelly, season: SEASON }); };
  const typed = (upgrades) => JSON.stringify({ jelly: 'fire', upgrades });
  sqlite.prepare('UPDATE run_summaries SET evolutions = ?').run('[]');
  logAct('player-one', 'run-many', 1, 'next-act', { score: 10000, details: typed(['slowBurn']) });
  logAct('player-one', 'run-many', 2, 'next-act', { score: 20000, details: typed(['slowBurn', 'fireBreath']) });
  logAct('player-one', 'run-many', 3, 'next-act', { score: 30000, details: typed(['slowBurn', 'fireBreath', 'a', 'b', 'c']) });   // a fifth upgrade
  logAct('player-one', 'run-many', 4, 'died', { score: 35000, details: typed(['slowBurn', 'fireBreath', 'a', 'b', 'c']) });
  assert.equal((await post('run-many', 35000, 'fire')).data.why, 'unverified');
  logAct('player-one', 'run-fire', 1, 'next-act', { score: 10000, treasures: [['candle', 1]], details: typed(['slowBurn']) });
  logAct('player-one', 'run-fire', 2, 'next-act', { score: 20000, details: typed(['slowBurn', 'fireBreath']) });
  logAct('player-one', 'run-fire', 3, 'died', { score: 25000, details: typed(['start', 'slowBurn', 'fireBreath', 'a']) });   // the run's opening upgrade, then one per boss
  sqlite.prepare("UPDATE run_summaries SET evolutions = ? WHERE run_id = 'run-fire'").run('["moon","lion","box"]');   // three former evolutions as Legendaries
  assert.equal((await post('run-fire', 25000, 'fire')).data.posted, true);
  const { data } = await request('/api/scores?me=player-one');
  assert.equal(data.top[0].jelly, 'fire');
  assert.equal(data.mine.jelly, 'fire');
  const save = async r => { clearRates(); return request('/api/runs', { id: 'player-one', rows: [r] }); };
  await save({ run: 'run-upgrades', act: 1, revision: 1, outcome: 'died', details: { jelly: 'ice', upgrades: ['frostbite', '<bad>', 7] } });
  assert.deepEqual(JSON.parse(sqlite.prepare("SELECT details FROM run_summaries WHERE run_id = 'run-upgrades'").get().details).upgrades, ['frostbite', 'bad', '7']);
});

// One logged act as checkRun reads it: `points` this act earned (facts made by factsFor), changed by `facts` / `details`
const act = (n, outcome, score, points, { facts = {}, details = {}, time = 300 } = {}) => {
  const made = factsFor(points, outcome === 'next-act' || outcome === 'won', time);
  return { act: n, outcome, finalized: 1, score, time, level: 10, treasures: '[]', boss_left: null,
    details: JSON.stringify({ season: SEASON, elitesBeaten: made.elites, ...details, score: { ...made.facts, ...facts } }) };
};

test('the Worker scores a run itself from its logged acts, and refuses one whose facts say another score', async () => {
  const run = [act(1, 'next-act', 12000, 12000), act(2, 'died', 19000, 7000)];
  assert.equal(checkRun(run, 19000), null);
  const off = [run[0], act(2, 'died', 19000, 7000, { facts: { bugsCleared: 0 } })];        // the facts earn 1,000 less than it logged
  assert.equal(checkRun(off, 19000), 'unverified');
  assert.equal(checkRun([act(2, 'died', 7000, 7000)], 7000), 'unverified');                  // not logged from act 1
  assert.equal(checkRun([{ ...run[0], details: JSON.stringify({ season: SEASON }) }], 12000), 'pending');
  const older = { ...run[0], outcome: 'died', details: JSON.stringify({ season: SEASON, jelly: 'normal' }) };   // no score facts: an older client
  assert.equal(checkRun([older], 12000), 'unverified');
});

test('a run from another season, or a post without the season, is unverified', async () => {
  assert.equal(checkRun([act(1, 'died', 7000, 7000)], 7000, 'normal', SEASON + 1), 'unverified');
  assert.equal(checkRun([act(1, 'died', 7000, 7000)], 7000, 'normal', null), 'unverified');
  assert.equal(checkRun([act(1, 'died', 7000, 7000, { details: { season: SEASON - 1 } })], 7000), 'unverified');
  logAct('player-one', 'run-noseason', 1, 'died', { score: 7000 });
  assert.equal((await request('/api/scores', { id: 'player-one', name: 'Jelly', run: 'run-noseason', score: 7000 })).data.why, 'unverified');
});

test('checkRun refuses score facts no real act can have', async () => {
  const one = (outcome, points, o) => checkRun([act(1, outcome, points, points, o)], points);
  assert.equal(one('died', 7000), null);
  assert.equal(one('died', 7000, { facts: { bugsOut: 40, bugsCleared: 41 } }), 'unverified');            // cleared more than came out
  assert.equal(one('died', 7000, { facts: { bugsOut: 100000, bugsCleared: 100000 } }), 'unverified');    // more than the waves could send
  assert.equal(one('won', 12000, { facts: { bossSeconds: 9 } }), 'unverified');                     // a boss beaten in 9 s
  assert.equal(one('won', 12000, { facts: { bossSeconds: null } }), 'unverified');                  // a boss beaten with no fight
  assert.equal(one('died', 7000, { facts: { bossSeconds: 400 } }), 'unverified');                        // a fight longer than the act
  assert.equal(one('died', 7000, { details: { elitesBeaten: 4 } }), 'unverified');                       // 3 Elites an act at most
  assert.equal(one('died', 7000, { facts: { damageTaken: -1 } }), 'unverified');
  assert.equal(one('died', 7000, { facts: { damageTaken: null } }), 'unverified');
  assert.equal(one('died', 7000, { facts: { nightShare: 1.5 } }), 'unverified');
  assert.equal(one('died', 7000, { facts: { bossShare: null } }), 'unverified');
});

test('the bugs-out ceiling uses the spawn rate in content/waves.kdl', () => {
  const [, rate, grow] = readFileSync(new URL('../content/waves.kdl', import.meta.url), 'utf8').match(/^\s*rate ([\d.]+) grow=([\d.]+)/m);
  assert.deepEqual(WAVES, { rate: +rate, grow: +grow });
});

test('the board keeps a best run per player and jelly type this season, with the act reached and acts cleared untouched', async () => {
  const post = (run, score, jelly) => { clearRates(); return request('/api/scores', { id: 'player-one', name: 'Jelly', run, score, jelly, season: SEASON }); };
  const typed = (jelly) => JSON.stringify({ jelly });
  logAct('player-one', 'run-normal1', 1, 'next-act', { score: 14000, details: typed('normal'),                  // cleared with no damage
    facts: { nightShare: 1, bossShare: 1, bugsOut: 100, bugsCleared: 100, damageTaken: 0, bossSeconds: 60 } });
  logAct('player-one', 'run-normal1', 2, 'died', { score: 20000, details: typed('normal') });   // and took no damage dying: not cleared, so it doesn't count
  assert.equal((await post('run-normal1', 20000, 'normal')).data.posted, true);
  logAct('player-one', 'run-fire1', 1, 'died', { score: 5000, details: typed('fire') });                     // lower, but another type: its own row
  assert.equal((await post('run-fire1', 5000, 'fire')).data.posted, true);
  logAct('player-one', 'run-fire2', 1, 'died', { score: 4000, details: typed('fire') });
  assert.equal((await post('run-fire2', 4000, 'fire')).data.why, 'lower');
  const rows = sqlite.prepare('SELECT season, jelly, score, acts, clean, won FROM board ORDER BY score DESC').all().map(r => ({ ...r }));
  assert.deepEqual(rows, [{ season: SEASON, jelly: 'normal', score: 20000, acts: 2, clean: 1, won: 0 }, { season: SEASON, jelly: 'fire', score: 5000, acts: 1, clean: 0, won: 0 }]);
  await request('/api/name', { id: 'player-one', name: 'Renamed' });
  assert.deepEqual(sqlite.prepare('SELECT DISTINCT name FROM board').all().map(r => r.name), ['Renamed']);
});

test('board tabs: champions, all and a jelly type, each with your own row and its real place', async () => {
  const add = sqlite.prepare('INSERT INTO board (season, id, jelly, name, score, won, acts, clean, at) VALUES (?, ?, ?, ?, ?, 0, 1, 0, ?)');
  for (let i = 1; i <= 12; i++) add.run(SEASON, 'player-' + String(i).padStart(2, '0'), 'normal', 'N' + i, 1000 * i, i);
  add.run(SEASON, 'player-01', 'fire', 'N1', 50000, 1);      // player 1's best is a Fire run
  add.run(SEASON, 'player-02', 'fire', 'N2', 50000, 0);      // the same score, earlier: first
  add.run(SEASON, 'player-03', 'ice', 'N3', 2000, 5);
  add.run(SEASON - 1, 'player-04', 'wind', 'Old', 60000, 5); // another season: never shown
  const tab = async (t, me = 'player-01') => (await request(`/api/scores?${t ? 'tab=' + t + '&' : ''}me=${me}`)).data;
  const all = await tab('all');
  assert.equal(all.season, SEASON); assert.equal(all.tab, 'all');
  assert.deepEqual(all.top.map(r => [r.name, r.jelly, r.score]).slice(0, 4), [['N2', 'fire', 50000], ['N1', 'fire', 50000], ['N12', 'normal', 12000], ['N11', 'normal', 11000]]);
  assert.equal(all.top.length, 10);
  assert.ok(all.top.every(r => r.name === 'N1' ? r.id === 'player-01' : !('id' in r)));    // only your own id comes back
  assert.deepEqual([all.mine.jelly, all.mine.score, all.mine.place], ['fire', 50000, 2]);
  assert.deepEqual(await tab(''), all);                                                   // no tab: all
  const normal = await tab('normal', 'player-03');
  assert.deepEqual(normal.top.map(r => r.score), [12000, 11000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000]);
  assert.deepEqual([normal.mine.score, normal.mine.place, normal.mine.id], [3000, 10, 'player-03']);
  const low = await tab('normal', 'player-01');
  assert.deepEqual([low.mine.score, low.mine.place], [1000, 12]);                          // outside the top 10: still there, with its place
  const champs = await tab('champions');
  assert.deepEqual(champs.top.map(r => [r.jelly, r.name]), [['fire', 'N2'], ['normal', 'N12'], ['ice', 'N3']]);
  assert.equal(champs.mine, null);
  assert.deepEqual((await tab('glitter')).top, []);                                        // a type nobody has played yet
  assert.equal((await tab('wind')).top.length, 0);
  assert.deepEqual(Object.keys(all.top[0]).sort(), ['acts', 'at', 'body', 'clean', 'jelly', 'kills', 'level', 'look', 'name', 'score', 'time', 'won']);
});

test('the dev password is checked against the secret, slowly, and never opens without one', async () => {
  const unlock = async (pass, secret) => { clearRates(); env.DEV_PASSWORD = secret; return (await request('/api/dev', { pass })).data.open; };
  assert.equal(await unlock('anything', undefined), false);
  assert.equal(await unlock('', ''), false);
  clearRates(); assert.equal((await request('/api/dev', { pass: 'x' })).data.why, 'unset');
  assert.equal(await unlock('nope', 'sea-secret'), false);
  assert.equal(await unlock(' sea-secret ', 'sea-secret'), true);
  assert.equal((await request('/api/dev', { pass: 'sea-secret' })).status, 429);
  delete env.DEV_PASSWORD;
});

test('a past season is read-only: its Champions, or the top 3 of All', async () => {
  const add = sqlite.prepare('INSERT INTO board (season, id, jelly, name, score, won, acts, clean, at) VALUES (?, ?, ?, ?, ?, 0, 1, 0, ?)');
  for (let i = 1; i <= 5; i++) add.run(7, 'player-old' + i, 'normal', 'O' + i, 1000 * i, i);
  add.run(7, 'player-old1', 'fire', 'O1', 9000, 1);
  add.run(8, 'player-old9', 'normal', 'Now', 99000, 1);                  // the current season (now = 8) is never in a past read
  const read = (tab, season, me = 'player-old1') => top(db, me, tab, seasonOf(season, 8), 8);
  const champs = await read('champions', 7);
  assert.deepEqual([champs.season, champs.mine, champs.top.map(r => [r.jelly, r.score])], [7, null, [['fire', 9000], ['normal', 5000]]]);
  const all = await read('all', 7);
  assert.deepEqual(all.top.map(r => r.name), ['O1', 'O5', 'O4']);   // top 3 only, each player's best row
  assert.equal(all.mine, null);                                      // no place on a past board
  assert.equal(all.top[0].id, 'player-old1');                              // your own id, nobody else's
  assert.ok(all.top.slice(1).every(r => r.id === undefined));
  assert.equal((await read('fire', 7)).tab, 'all');                  // a type tab reads as all in a past season
  assert.equal((await read('all', 8)).top[0].name, 'Now');            // the current season keeps its own rules
  assert.deepEqual([seasonOf('0', 8), seasonOf('abc', 8), seasonOf('9', 8), seasonOf('3', 8)], [8, 8, 8, 3]);
});
