// Jelly Run's Cloudflare Worker: the public leaderboard. Everything that isn't /api/* is the
// game's own files, served from the CDN by the assets binding (wrangler.jsonc) before this
// code runs at all.
//
//   GET  /api/scores?me=<id>   the top 10, plus your own entry: { top: [...], mine: {...} | null }
//   POST /api/scores           { id, name, body, look, score, level, kills, time, won, build }
//                              (look: the player's jelly descriptor, carried whole so a
//                              board row can draw the jelly it belongs to)
//                              keeps your entry only when it beats it: { posted, best, why? }
//   POST /api/feedback         { id, text, build, act, won, score, device }: a player's beta
//                              feedback from an end screen, kept in the feedback table: { sent, why? }
//                              (read it in the D1 console: SELECT * FROM feedback ORDER BY at DESC)
//   POST /api/runs             { id, run, build, act, outcome, score, time, level, kills, body, treasures,
//                              evolutions, lost, bossLeft, device }: one act played, for the owner's run
//                              log (the runs table, read only in the D1 console): { saved, why? }
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
  'CREATE TABLE IF NOT EXISTS achievement_players (id TEXT PRIMARY KEY, name TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS achievement_unlocks (player_id TEXT NOT NULL, achievement_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (player_id, achievement_id))',
  `CREATE TABLE IF NOT EXISTS runs (at INTEGER NOT NULL, player_id TEXT NOT NULL, run_id TEXT NOT NULL, build TEXT, act INTEGER,
    outcome TEXT, score INTEGER, time INTEGER, level INTEGER, kills INTEGER, body TEXT, treasures TEXT, evolutions TEXT,
    health_lost TEXT, boss_left INTEGER, device TEXT, agent TEXT, ip TEXT)`,
  'CREATE TABLE IF NOT EXISTS feedback (at INTEGER NOT NULL, player_id TEXT NOT NULL, text TEXT NOT NULL, build TEXT, act INTEGER, won INTEGER, score INTEGER, device TEXT, agent TEXT, ip TEXT)',
];
let ready = null;
const setUp = (db) => (ready ||= (async () => {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // databases made before looks rode along have no look column; the ALTER errors once it exists
  try { await db.prepare('ALTER TABLE scores ADD COLUMN look TEXT').run(); } catch {}
})().catch((e) => { ready = null; throw e; }));

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// a name as the board shows it: printable, trimmed, at most 20 characters
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) || 'A jelly';

// a look as the board carries it: only the descriptor's own keys (character.js
// DEFAULT_LOOK), short string values and finite numbers, stored as JSON text
const LOOK_KEYS = ['name', 'body', 'finish', 'color', 'accent', 'pattern', 'eyes', 'eyeColor', 'mouth', 'top', 'topColor', 'size'];
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

const ROW = 'id, name, body, look, score, level, kills, time, won, at';
const shape = (r) => {
  if (!r) return r;
  let look = null;
  try { look = r.look ? JSON.parse(r.look) : null; } catch {}
  return { ...r, won: !!r.won, look };
};

async function top(db, me) {
  const [list, mine] = await db.batch([
    db.prepare(`SELECT ${ROW} FROM scores ORDER BY score DESC, at ASC LIMIT 10`),
    db.prepare(`SELECT ${ROW} FROM scores WHERE id = ?`).bind(me && ID.test(me) ? me : ''),
  ]);
  // only your own id comes back: an id is all it takes to post as that player
  return { top: list.results.map((r) => shape({ ...r, id: r.id === me ? r.id : undefined })), mine: shape(mine.results[0]) || null };
}

async function post(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ posted: false, why: 'bad' }, 400); }
  if (!ID.test(b?.id || '')) return json({ posted: false, why: 'bad' }, 400);
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
  const was = await db.prepare('SELECT score FROM scores WHERE id = ?').bind(b.id).first();
  const stamp = db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at')
    .bind('id:' + b.id, now, 'ip:' + ip, now);
  if (was && was.score >= score) { await stamp.run(); return json({ posted: false, why: 'lower' }); }
  await db.batch([
    db.prepare(`INSERT INTO scores (id, name, body, look, score, level, kills, time, won, build, at, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, body = excluded.body, look = excluded.look, score = excluded.score,
                  level = excluded.level, kills = excluded.kills, time = excluded.time, won = excluded.won,
                  build = excluded.build, at = excluded.at, ip = excluded.ip
                WHERE excluded.score > scores.score`)
      .bind(b.id, cleanName(b.name), String(b.body || 'nettle').slice(0, 16), cleanLook(b.look), score, int(b.level, 1, 999),
        int(b.kills, 0, 100000), int(b.time, 0, 100000), b.won ? 1 : 0, String(b.build || '').slice(0, 12), now, ip),
    stamp,
  ]);
  return json({ posted: true });
}

async function achievementTop(db, me) {
  const ranked = `SELECT p.id, p.name, COUNT(*) AS count, MAX(u.at) AS at
    FROM achievement_players p JOIN achievement_unlocks u ON u.player_id = p.id GROUP BY p.id, p.name`;
  const [list, mine] = await db.batch([
    db.prepare(`${ranked} ORDER BY count DESC, at ASC, p.id ASC LIMIT 5`),
    db.prepare(`SELECT * FROM (${ranked}) WHERE id = ?`).bind(ID.test(me || '') ? me : ''),
  ]);
  return { top: list.results.map(r => ({ ...r, id: r.id === me ? r.id : undefined })), mine: mine.results[0] || null };
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
  await db.batch([
    db.prepare('INSERT INTO achievement_players (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name').bind(b.id, cleanName(b.name)),
    ...ids.map(id => db.prepare('INSERT OR IGNORE INTO achievement_unlocks (player_id, achievement_id, at) VALUES (?, ?, ?)').bind(b.id, id, now)),
    db.prepare('INSERT INTO posts (key, at) VALUES (?, ?), (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(keys[0], now, keys[1], now),
  ]);
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
const words = (list) => JSON.stringify((Array.isArray(list) ? list : []).slice(0, 10).map(word).filter(Boolean));
const amounts = (o) => JSON.stringify(Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 40)
  .filter(([k, v]) => word(k) && Number.isFinite(+v)).map(([k, v]) => [word(k), Math.round(Math.max(0, Math.min(1e6, +v)) * 10) / 10])));
async function postRun(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ saved: false, why: 'bad' }, 400); }
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/scores', '/api/achievements', '/api/feedback', '/api/runs'].includes(url.pathname)) return env.ASSETS.fetch(request);
    try {
      await setUp(env.DB);
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
