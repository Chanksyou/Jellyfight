// Jelly Run's Cloudflare Worker: the public leaderboard. Everything that isn't /api/* is the
// game's own files, served from the CDN by the assets binding (wrangler.jsonc) before this
// code runs at all.
//
//   GET  /api/scores?me=<id>   the top 10, plus your own entry: { top: [...], mine: {...} | null }
//   POST /api/scores           { id, run, name, body, look, score, level, kills, time, won, build, jelly }
//                              (run: the run log's id; the score must match that run's last logged act
//                              and the run must pass checkRun, else why: 'pending' | 'unverified')
//                              (look: the player's jelly descriptor, carried whole so a
//                              board row can draw the jelly it belongs to)
//                              keeps your entry only when it beats it: { posted, best, why? }
//   POST /api/feedback         { id, text, build, act, won, score, device }: a player's beta
//                              feedback from an end screen, kept in the feedback table: { sent, why? }
//                              (read it in the D1 console: SELECT * FROM feedback ORDER BY at DESC)
//   POST /api/runs             { id, run, build, act, outcome, score, time, level, kills, body, treasures,
//                              evolutions, lost, bossLeft, device, details: { jelly, upgrades, … } }: one act played, for the owner's run
//                              log (the runs table, read only in the D1 console): { saved, why? }
//
//   POST /api/dev              { pass }: { open } — the dev tools' password, checked against the
//                              DEV_PASSWORD secret (set it with `npx wrangler secret put DEV_PASSWORD`)
//
// A player is a random id the game keeps in localStorage (leaderboard.js), so anyone can post,
// signed in anywhere or not. Scores come from the player's browser, so they can be faked: this
// caps what's believable and how often one browser or one address can post, which stops casual
// cheating, not a determined one.
import { ACHIEVEMENTS } from '../src/achievements.js';

const MAX_SCORE = 60000;      // the game's own cap (leaderboard.js)
const ID = /^[a-z0-9-]{8,48}$/;
const PER_ID_MS = 15000;      // one post per player every 15 s (a run takes minutes)
const PER_IP_MS = 5000;       // and per address every 5 s

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT, score INTEGER NOT NULL, level INTEGER,
    kills INTEGER, time INTEGER, won INTEGER, build TEXT, at INTEGER NOT NULL, ip TEXT)`,
  'CREATE INDEX IF NOT EXISTS scores_by_score ON scores (score DESC)',
  'CREATE TABLE IF NOT EXISTS posts (key TEXT PRIMARY KEY, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS player_names (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)',
  'CREATE TABLE IF NOT EXISTS achievement_players (id TEXT PRIMARY KEY, name TEXT NOT NULL, look TEXT)',
  'CREATE TABLE IF NOT EXISTS achievement_unlocks (player_id TEXT NOT NULL, achievement_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (player_id, achievement_id))',
  `CREATE TABLE IF NOT EXISTS runs (at INTEGER NOT NULL, player_id TEXT NOT NULL, run_id TEXT NOT NULL, build TEXT, act INTEGER,
    outcome TEXT, score INTEGER, time INTEGER, level INTEGER, kills INTEGER, body TEXT, treasures TEXT, evolutions TEXT,
    health_lost TEXT, boss_left INTEGER, device TEXT, agent TEXT, ip TEXT)`,
  'CREATE TABLE IF NOT EXISTS feedback (at INTEGER NOT NULL, player_id TEXT NOT NULL, text TEXT NOT NULL, build TEXT, act INTEGER, won INTEGER, score INTEGER, device TEXT, agent TEXT, ip TEXT)',
  // Keep legacy runs untouched: older open tabs can continue to post their original format.
  `CREATE TABLE IF NOT EXISTS run_summaries (
    player_id TEXT NOT NULL, run_id TEXT NOT NULL, act INTEGER NOT NULL, at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL, finalized INTEGER NOT NULL, build TEXT, outcome TEXT, score INTEGER, time INTEGER,
    level INTEGER, kills INTEGER, body TEXT, treasures TEXT, evolutions TEXT, health_lost TEXT, boss_left INTEGER, device TEXT, details TEXT,
    PRIMARY KEY (player_id, run_id, act))`,
  'CREATE INDEX IF NOT EXISTS run_summaries_by_build ON run_summaries (build, act, device, at)',
];
let ready = null;
const setUp = (db) => (ready ||= (async () => {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  const players = await db.prepare('PRAGMA table_info(achievement_players)').all();
  if (!players.results.some(c => c.name === 'look')) {
    try { await db.prepare('ALTER TABLE achievement_players ADD COLUMN look TEXT').run(); }
    catch (e) { if (!/duplicate column/i.test(String(e))) throw e; }
  }
  const columns = await db.prepare('PRAGMA table_info(run_summaries)').all();
  if (!columns.results.some(c => c.name === 'details')) {
    try { await db.prepare('ALTER TABLE run_summaries ADD COLUMN details TEXT').run(); }
    catch (e) { if (!/duplicate column/i.test(String(e))) throw e; }   // another cold Worker may have added it first
  }
  await migrateNames(db);
  // databases made before looks rode along have no look column; the ALTER errors once it exists
  try { await db.prepare('ALTER TABLE scores ADD COLUMN look TEXT').run(); } catch {}
  // and before jelly types, no jelly column (a row without one is Normal: jellyOf)
  try { await db.prepare('ALTER TABLE scores ADD COLUMN jelly TEXT').run(); } catch {}
})().catch((e) => { ready = null; throw e; }));

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// a name as the board shows it: printable, trimmed, at most 20 characters
const cleanName = (s) => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim() || 'Guest';

const nameKey = name => cleanName(name).toLowerCase();
const claimName = (db, id, name, at) => db.prepare(`INSERT INTO player_names (id, name, name_key, at) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key,
    at = CASE WHEN player_names.name_key = excluded.name_key THEN player_names.at ELSE excluded.at END`)
  .bind(id, cleanName(name), nameKey(name), at);
const nameConflict = e => /UNIQUE constraint failed: player_names.name_key/i.test(String(e));
const syncName = (db, id, name) => [
  db.prepare('UPDATE scores SET name = ? WHERE id = ?').bind(cleanName(name), id),
  db.prepare('UPDATE achievement_players SET name = ? WHERE id = ?').bind(cleanName(name), id),
];

// Historical first-use dates were not retained: the earliest saved score wins.
async function migrateNames(db) {
  if (await db.prepare("SELECT name FROM migrations WHERE name = 'player-names'").first()) return;
  const rows = await db.prepare(`SELECT id, name, at FROM scores UNION ALL
    SELECT p.id, p.name, MIN(u.at) AS at FROM achievement_players p
    JOIN achievement_unlocks u ON u.player_id = p.id WHERE p.id NOT IN (SELECT id FROM scores)
    GROUP BY p.id ORDER BY at, id`).all();
  const used = new Set(), reserved = new Set(rows.results.map(r => nameKey(r.name)));
  const updates = [];
  for (const row of rows.results) {
    let name = cleanName(row.name), n = 2;
    if (used.has(nameKey(name))) {
      const base = name;
      do { const suffix = ' ' + n++; name = base.slice(0, 20 - suffix.length).trim() + suffix; }
      while (used.has(nameKey(name)) || reserved.has(nameKey(name)));
    }
    used.add(nameKey(name));
    // Guard simultaneous cold starts against overwriting a completed migration.
    updates.push(db.prepare(`INSERT OR IGNORE INTO player_names (id, name, name_key, at)
      SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'player-names')`).bind(row.id, name, nameKey(name), row.at));
    for (const table of ['scores', 'achievement_players']) updates.push(db.prepare(`UPDATE ${table} SET name = (SELECT name FROM player_names WHERE id = ?)
      WHERE id = ? AND NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'player-names')`).bind(row.id, row.id));
  }
  updates.push(db.prepare("INSERT OR IGNORE INTO migrations (name) VALUES ('player-names')"));
  await db.batch(updates);
}

// a look as the board carries it: only the descriptor's own keys (character.js
// DEFAULT_LOOK), short string values and finite numbers, stored as JSON text
const LOOK_KEYS = ['name', 'body', 'finish', 'color', 'accent', 'pattern', 'arms', 'tentacles', 'eyes', 'eyeColor', 'mouth', 'top', 'topColor', 'size'];
const cleanLook = (l) => {
  if (!l || typeof l !== 'object') return null;
  const out = {};
  for (const k of LOOK_KEYS) {
    const v = l[k];
    if (typeof v === 'string') out[k] = v.slice(0, 24);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
};
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : lo);

// addresses are kept only as a salted hash, for the rate limit
async function hashIp(ip, salt) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ROW = 'id, name, body, look, jelly, score, level, kills, time, won, at';
const withLook = (r) => {
  if (!r) return r;
  let look = null;
  try { look = r.look ? JSON.parse(r.look) : null; } catch {}
  return { ...r, look };
};
const shape = r => r ? { ...withLook(r), won: !!r.won } : r;

async function top(db, me) {
  const [list, mine] = await db.batch([
    db.prepare(`SELECT ${ROW} FROM scores ORDER BY score DESC, at ASC LIMIT 10`),
    db.prepare(`SELECT ${ROW} FROM scores WHERE id = ?`).bind(me && ID.test(me) ? me : ''),
  ]);
  // only your own id comes back: an id is all it takes to post as that player
  return { top: list.results.map((r) => shape({ ...r, id: r.id === me ? r.id : undefined })), mine: shape(mine.results[0]) || null };
}

// What a real run can't do, from the run log (run_summaries). Generous: the best real runs so far
// (Nov 2026) reached levels 14 / 17 / 20 / 20 by the end of acts 1-4 and took 260 s+ to clear acts 1-3.
const LEVEL_CAP = [0, 18, 24, 28, 30];   // highest believable level at the end of each act
// the run's jelly type (content/jellies.kdl); a client from before jelly types sends none: Normal
export const jellyOf = (v) => String(v ?? '').replace(/[^a-z]/g, '').slice(0, 16) || 'normal';
const MIN_ACT_TIME = 250;                // seconds: acts 1-3 hold the boss back for 260 s
const MAX_COPIES = 5;                    // no treasure stacks past 5 (content/treasures.kdl)
const MAX_UPGRADES = 3;                  // a jelly type's Attack upgrades: one after each of acts 1-3's bosses
// null when the run backs the score; 'pending' while its last act hasn't been logged yet; else 'unverified'
export function checkRun(acts, score, jelly = 'normal') {
  const last = acts.at(-1);
  if (!last || !last.finalized || last.outcome === 'next-act') return 'pending';
  // logged acts follow on from each other (an older build's or a lost upload's first acts may be missing)
  if (acts.some((a, i) => a.act !== acts[0].act + i || !a.finalized || (a !== last && a.outcome !== 'next-act'))) return 'unverified';
  if (last.score !== score) return 'unverified';
  for (const a of acts) {
    let d = {};
    try { d = JSON.parse(a.details || '{}') || {}; } catch {}
    if (jellyOf(d.jelly) !== jellyOf(jelly)) return 'unverified';   // one jelly type the whole run
    if (a.level > (LEVEL_CAP[a.act] ?? 0)) return 'unverified';
    if (a !== last && a.act < 4 && a.time < MIN_ACT_TIME) return 'unverified';
    let held = [];
    try { held = JSON.parse(a.treasures || '[]'); } catch {}
    if (held.some((t) => !(t?.[1] <= MAX_COPIES))) return 'unverified';
    if (Array.isArray(d.upgrades) && d.upgrades.length > MAX_UPGRADES) return 'unverified';
  }
  if (acts.some((a, i) => i && a.score < acts[i - 1].score)) return 'unverified';
  return null;
}

// The dev tools' password lives in the Worker's DEV_PASSWORD secret, never in the game's files
async function devUnlock(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ open: false }, 400); }
  const now = Date.now(), db = env.DB;
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const key = 'dev:ip:' + ip;
  const recent = await db.prepare('SELECT at FROM posts WHERE key = ?').bind(key).first();
  if (recent && now - recent.at < DEV_TRY_MS) return json({ open: false, why: 'slow' }, 429);
  await db.prepare('INSERT INTO posts (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(key, now).run();
  const want = typeof env.DEV_PASSWORD === 'string' ? env.DEV_PASSWORD.trim() : '', pass = typeof b?.pass === 'string' ? b.pass.trim() : '';
  if (!want) return json({ open: false, why: 'unset' });   // the Worker can't see a DEV_PASSWORD: say so instead of "wrong"
  return json({ open: await same(pass, want) });
}
const DEV_TRY_MS = 3000;   // one password try per address every 3 s
async function same(a, b) {   // compares digests, so the time taken says nothing about the password
  const h = async (v) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  return x.every((v, i) => v === y[i]);
}

async function post(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ posted: false, why: 'bad' }, 400); }
  if (!ID.test(b?.id || '')) return json({ posted: false, why: 'bad' }, 400);
  if (!ID.test(b.run || '')) return json({ posted: false, why: 'unverified' }, 422);
  const score = int(b.score, 0, MAX_SCORE);
  const now = Date.now();
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const db = env.DB;
  // rate limits: one row per player and per address, holding when they last posted
  const recent = await db.prepare('SELECT key, at FROM posts WHERE key IN (?, ?)').bind('id:' + b.id, 'ip:' + ip).all();
  for (const r of recent.results) {
    if (r.key.startsWith('id:') && now - r.at < PER_ID_MS) return json({ posted: false, why: 'slow' }, 429);
    if (r.key.startsWith('ip:') && now - r.at < PER_IP_MS) return json({ posted: false, why: 'slow' }, 429);
  }
  // the score must be the end of a run this player logged act by act, and that run must look playable
  const acts = (await db.prepare('SELECT act, outcome, finalized, score, time, level, treasures, details FROM run_summaries WHERE player_id = ? AND run_id = ? ORDER BY act')
    .bind(b.id, b.run).all()).results;
  const check = checkRun(acts, score, b.jelly);
  if (check) return json({ posted: false, why: check }, check === 'pending' ? 409 : 422);
  const was = await db.prepare('SELECT score FROM scores WHERE id = ?').bind(b.id).first();
  const stamp = db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at')
    .bind('id:' + b.id, now, 'ip:' + ip, now);
  if (was && was.score >= score) { await stamp.run(); return json({ posted: false, why: 'lower' }); }
  try { await db.batch([
    claimName(db, b.id, b.name, now),
    db.prepare(`INSERT INTO scores (id, name, body, look, jelly, score, level, kills, time, won, build, at, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, body = excluded.body, look = excluded.look, jelly = excluded.jelly, score = excluded.score,
                  level = excluded.level, kills = excluded.kills, time = excluded.time, won = excluded.won,
                  build = excluded.build, at = excluded.at, ip = excluded.ip
                WHERE excluded.score > scores.score`)
      .bind(b.id, cleanName(b.name), String(b.body || 'nettle').slice(0, 16), cleanLook(b.look), jellyOf(b.jelly), score, int(b.level, 1, 999),
        int(b.kills, 0, 100000), int(b.time, 0, 100000), b.won ? 1 : 0, String(b.build || '').slice(0, 12), now, ip),
    ...syncName(db, b.id, b.name),
    stamp,
  ]); } catch (e) { if (nameConflict(e)) return json({ posted: false, why: 'taken' }, 409); throw e; }
  return json({ posted: true });
}

// Only identity changes: score, look and ranking timestamps remain intact.
async function rename(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ renamed: false, why: 'bad' }, 400); }
  if (!ID.test(b?.id || '') || typeof b.name !== 'string' || !b.name.trim()) return json({ renamed: false, why: 'bad' }, 400);
  const db = env.DB, now = Date.now(), name = cleanName(b.name);
  if (!(await db.prepare('SELECT id FROM player_names WHERE id = ?').bind(b.id).first())) return json({ renamed: false, why: 'missing' }, 404);
  const key = 'rename:' + b.id;
  const recent = await db.prepare('SELECT at FROM posts WHERE key = ?').bind(key).first();
  if (recent && now - recent.at < PER_ID_MS) return json({ renamed: false, why: 'slow' }, 429);
  try { await db.batch([
    claimName(db, b.id, name, now), ...syncName(db, b.id, name),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(key, now),
  ]); } catch (e) { if (nameConflict(e)) return json({ renamed: false, why: 'taken' }, 409); throw e; }
  return json({ renamed: true, name });
}

async function achievementTop(db, me) {
  const ranked = `SELECT p.id, p.name, COALESCE(p.look, s.look) AS look, s.body, COUNT(*) AS count, MAX(u.at) AS at
    FROM achievement_players p JOIN achievement_unlocks u ON u.player_id = p.id
    LEFT JOIN scores s ON s.id = p.id GROUP BY p.id, p.name`;
  const [list, mine] = await db.batch([
    db.prepare(`${ranked} ORDER BY count DESC, at ASC, p.id ASC LIMIT 5`),
    db.prepare(`SELECT * FROM (${ranked}) WHERE id = ?`).bind(ID.test(me || '') ? me : ''),
  ]);
  return { top: list.results.map(r => withLook({ ...r, id: r.id === me ? r.id : undefined })), mine: withLook(mine.results[0]) || null };
}

async function postAchievements(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ posted: false, why: 'bad' }, 400); }
  const allowed = new Set(ACHIEVEMENTS.map(a => a.id));
  if (!ID.test(b?.id || '') || !Array.isArray(b.achievements) || !b.achievements.length || b.achievements.length > allowed.size
    || b.achievements.some(id => typeof id !== 'string' || !allowed.has(id))) return json({ posted: false, why: 'bad' }, 400);
  const ids = [...new Set(b.achievements)], now = Date.now(), db = env.DB;
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const keys = ['achievements:id:' + b.id, 'achievements:ip:' + ip];
  const recent = await db.prepare('SELECT key, at FROM posts WHERE key IN (?, ?)').bind(...keys).all();
  if (recent.results.some(r => now - r.at < (r.key === keys[0] ? PER_ID_MS : PER_IP_MS))) return json({ posted: false, why: 'slow' }, 429);
  try { await db.batch([
    claimName(db, b.id, b.name, now),
    db.prepare(`INSERT INTO achievement_players (id, name, look) VALUES (?, (SELECT name FROM player_names WHERE id = ?), ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, look = COALESCE(excluded.look, achievement_players.look)`).bind(b.id, b.id, cleanLook(b.look)),
    ...syncName(db, b.id, b.name),
    ...ids.map(id => db.prepare('INSERT OR IGNORE INTO achievement_unlocks (player_id, achievement_id, at) VALUES (?, ?, ?)').bind(b.id, id, now)),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(keys[0], now, keys[1], now),
  ]); } catch (e) { if (nameConflict(e)) return json({ posted: false, why: 'taken' }, 409); throw e; }
  return json({ posted: true, ...(await achievementTop(db, b.id)) });
}

// Beta feedback (the end screens' bubble, run.js showFeedback): plain text up to 1000 characters,
// line breaks kept, one send per player every 30 s and per address every 10 s
const FEEDBACK_MAX = 1000, FEEDBACK_ID_MS = 30000, FEEDBACK_IP_MS = 10000;
async function postFeedback(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ sent: false, why: 'bad' }, 400); }
  const text = String(b?.text ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, FEEDBACK_MAX);
  if (!ID.test(b?.id || '') || !text) return json({ sent: false, why: 'bad' }, 400);
  const now = Date.now(), db = env.DB;
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const keys = ['feedback:id:' + b.id, 'feedback:ip:' + ip];
  const recent = await db.prepare('SELECT key, at FROM posts WHERE key IN (?, ?)').bind(...keys).all();
  if (recent.results.some(r => now - r.at < (r.key === keys[0] ? FEEDBACK_ID_MS : FEEDBACK_IP_MS))) return json({ sent: false, why: 'slow' }, 429);
  await db.batch([
    db.prepare('INSERT INTO feedback (at, player_id, text, build, act, won, score, device, agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(now, b.id, text, String(b.build || '').slice(0, 12), int(b.act, 0, 9), b.won ? 1 : 0, int(b.score, 0, MAX_SCORE),
        b.device === 'phone' ? 'phone' : 'desktop', (request.headers.get('user-agent') || '').slice(0, 200), ip),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(keys[0], now, keys[1], now),
  ]);
  return json({ sent: true });
}

// The run log (run.js recordRun): one row per act played. Lists are kept as short JSON text:
// treasures [[id, count]], evolutions [id], health_lost { source: Health }. One per player every 5 s,
// per address every 2 s (an act takes minutes)
const RUNS_ID_MS = 5000, RUNS_IP_MS = 2000, OUTCOMES = ['died', 'won', 'ended', 'next-act'];
const word = (v) => String(v ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
const pairs = (list) => JSON.stringify((Array.isArray(list) ? list : []).slice(0, 80)
  .filter((p) => Array.isArray(p) && word(p[0])).map(([id, n]) => [word(id), int(n, 1, 99)]));
const wordList = (list) => (Array.isArray(list) ? list : []).slice(0, 10).map(word).filter(Boolean);
const words = (list) => JSON.stringify(wordList(list));
const amounts = (o) => JSON.stringify(Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 40)
  .filter(([k, v]) => word(k) && Number.isFinite(+v)).map(([k, v]) => [word(k), Math.round(Math.max(0, Math.min(1e6, +v)) * 10) / 10])));
const events = (list, max, counts = false) => (Array.isArray(list) ? list : []).slice(0, max)
  .filter(p => Array.isArray(p) && word(p[0]) && Number.isFinite(p[1]) && (!counts || Number.isFinite(p[2])))
  .map(p => [word(p[0]), Math.round(Math.max(0, Math.min(100000, p[1])) * 10) / 10, ...(counts ? [int(p[2], 1, 99)] : [])]);
const details = (d, outcome) => !d || typeof d !== 'object' || Array.isArray(d) ? null : JSON.stringify({
  jelly: jellyOf(d.jelly), upgrades: wordList(d.upgrades), elitesBeaten: int(d.elitesBeaten, 0, 1000), elites: events(d.elites, 32),
  treasuresObtained: int(d.treasuresObtained, 0, 10000), pickups: events(d.pickups, 128, true),
  killedBy: outcome === 'died' && d.killedBy && typeof d.killedBy === 'object'
    ? { unit: word(d.killedBy.unit) || 'unknown', source: word(d.killedBy.source) || 'other' } : null,
});
async function postRun(request, env) {
  let b;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 48000) return json({ saved: false, why: 'large' }, 413);
    b = JSON.parse(text);
  } catch { return json({ saved: false, why: 'bad' }, 400); }
  if (b?.rows !== undefined) return postSummaries(b, request, env);
  if (!ID.test(b?.id || '') || !ID.test(b?.run || '') || !OUTCOMES.includes(b.outcome)) return json({ saved: false, why: 'bad' }, 400);
  const now = Date.now(), db = env.DB;
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const keys = ['runs:id:' + b.id, 'runs:ip:' + ip];
  const recent = await db.prepare('SELECT key, at FROM posts WHERE key IN (?, ?)').bind(...keys).all();
  if (recent.results.some(r => now - r.at < (r.key === keys[0] ? RUNS_ID_MS : RUNS_IP_MS))) return json({ saved: false, why: 'slow' }, 429);
  await db.batch([
    db.prepare(`INSERT INTO runs (at, player_id, run_id, build, act, outcome, score, time, level, kills, body, treasures, evolutions, health_lost, boss_left, device, agent, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(now, b.id, b.run, String(b.build || '').slice(0, 12), int(b.act, 0, 9), b.outcome, int(b.score, 0, MAX_SCORE), int(b.time, 0, 100000),
        int(b.level, 1, 999), int(b.kills, 0, 100000), word(b.body).slice(0, 16), pairs(b.treasures), words(b.evolutions), amounts(b.lost),
        b.bossLeft == null ? null : int(b.bossLeft, 0, 100), b.device === 'phone' ? 'phone' : 'desktop', (request.headers.get('user-agent') || '').slice(0, 200), ip),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(keys[0], now, keys[1], now),
  ]);
  return json({ saved: true });
}

// A bounded batch amortizes the existing two rate-limit writes over up to eight pending acts.
// Checkpoints update one row; an acknowledged final result is never replaced by an unfinished one.
async function postSummaries(b, request, env) {
  if (!ID.test(b.id || '') || !Array.isArray(b.rows) || !b.rows.length || b.rows.length > 8 || b.rows.some(r =>
    !r || !ID.test(r.run || '') || !Number.isInteger(r.act) || r.act < 1 || r.act > 4
    || ![...OUTCOMES, 'started', 'in-progress'].includes(r.outcome)
    || !Number.isSafeInteger(r.revision) || r.revision < 1)) return json({ saved: false, why: 'bad' }, 400);
  const now = Date.now(), db = env.DB;
  const ip = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown', env.IP_SALT || 'jelly-fight');
  const keys = ['runs:id:' + b.id, 'runs:ip:' + ip];
  const recent = await db.prepare('SELECT key, at FROM posts WHERE key IN (?, ?)').bind(...keys).all();
  if (recent.results.some(r => now - r.at < (r.key === keys[0] ? RUNS_ID_MS : RUNS_IP_MS))) return json({ saved: false, why: 'slow' }, 429);
  await db.batch([
    ...b.rows.map(r => db.prepare(`INSERT INTO run_summaries
      (player_id, run_id, act, at, updated_at, revision, finalized, build, outcome, score, time, level, kills, body, treasures, evolutions, health_lost, boss_left, device, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id, run_id, act) DO UPDATE SET
        updated_at = excluded.updated_at, revision = excluded.revision, finalized = excluded.finalized, build = excluded.build,
        outcome = excluded.outcome, score = excluded.score, time = excluded.time, level = excluded.level, kills = excluded.kills,
        body = excluded.body, treasures = excluded.treasures, evolutions = excluded.evolutions, health_lost = excluded.health_lost,
        boss_left = excluded.boss_left, device = excluded.device, details = COALESCE(excluded.details, run_summaries.details)
      WHERE excluded.finalized > run_summaries.finalized
         OR (excluded.finalized = run_summaries.finalized AND excluded.revision > run_summaries.revision)`)
      .bind(b.id, r.run, r.act, now, now, r.revision, OUTCOMES.includes(r.outcome) ? 1 : 0, String(r.build || '').slice(0, 12),
        r.outcome, int(r.score, 0, MAX_SCORE), int(r.time, 0, 100000), int(r.level, 1, 999), int(r.kills, 0, 100000),
        word(r.body).slice(0, 16), pairs(r.treasures), words(r.evolutions), amounts(r.lost), r.bossLeft == null ? null : int(r.bossLeft, 0, 100),
        r.device === 'phone' ? 'phone' : 'desktop', details(r.details, r.outcome))),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(keys[0], now, keys[1], now),
  ]);
  return json({ saved: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/scores', '/api/name', '/api/achievements', '/api/feedback', '/api/runs', '/api/dev'].includes(url.pathname)) return env.ASSETS.fetch(request);
    try {
      await setUp(env.DB);
      if (url.pathname === '/api/dev') return request.method === 'POST' ? await devUnlock(request, env) : json({ error: 'method' }, 405);
      if (url.pathname === '/api/name') return request.method === 'POST' ? await rename(request, env) : json({ error: 'method' }, 405);
      if (url.pathname === '/api/runs') return request.method === 'POST' ? await postRun(request, env) : json({ error: 'method' }, 405);
      if (url.pathname === '/api/feedback') return request.method === 'POST' ? await postFeedback(request, env) : json({ error: 'method' }, 405);
      if (url.pathname === '/api/achievements') {
        if (request.method === 'GET') return json(await achievementTop(env.DB, url.searchParams.get('me')));
        if (request.method === 'POST') return await postAchievements(request, env);
        return json({ error: 'method' }, 405);
      }
      if (request.method === 'GET') return json(await top(env.DB, url.searchParams.get('me')));
      if (request.method === 'POST') return await post(request, env);
      return json({ error: 'method' }, 405);
    } catch (e) {
      return json({ error: 'unavailable' }, 503);
    }
  },
};
