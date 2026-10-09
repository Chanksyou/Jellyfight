// Jelly Fight's Cloudflare Worker: the public leaderboard. Everything that isn't /api/* is the
// game's own files, served from the CDN by the assets binding (wrangler.jsonc) before this
// code runs at all.
//
//   GET  /api/scores?me=<id>   the top 10, plus your own entry: { top: [...], mine: {...} | null }
//   POST /api/scores           { id, name, body, score, level, kills, time, won, build }
//                              keeps your entry only when it beats it: { posted, best, why? }
//
// A player is a random id the game keeps in localStorage (leaderboard.js), so anyone can post,
// signed in anywhere or not. Scores come from the player's browser, so they can be faked: this
// caps what's believable and how often one browser or one address can post, which stops casual
// cheating, not a determined one.
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
];
let ready = null;
const setUp = (db) => (ready ||= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = null; throw e; }));

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// a name as the board shows it: printable, trimmed, at most 20 characters
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) || 'A jelly';
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : lo);

// addresses are kept only as a salted hash, for the rate limit
async function hashIp(ip, salt) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ROW = 'id, name, body, score, level, kills, time, won, at';
const shape = (r) => r && { ...r, won: !!r.won };

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
    db.prepare(`INSERT INTO scores (id, name, body, score, level, kills, time, won, build, at, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, body = excluded.body, score = excluded.score,
                  level = excluded.level, kills = excluded.kills, time = excluded.time, won = excluded.won,
                  build = excluded.build, at = excluded.at, ip = excluded.ip
                WHERE excluded.score > scores.score`)
      .bind(b.id, cleanName(b.name), String(b.body || 'nettle').slice(0, 16), score, int(b.level, 1, 999),
        int(b.kills, 0, 100000), int(b.time, 0, 100000), b.won ? 1 : 0, String(b.build || '').slice(0, 12), now, ip),
    stamp,
  ]);
  return json({ posted: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/scores') return env.ASSETS.fetch(request);
    try {
      await setUp(env.DB);
      if (request.method === 'GET') return json(await top(env.DB, url.searchParams.get('me')));
      if (request.method === 'POST') return await post(request, env);
      return json({ error: 'method' }, 405);
    } catch (e) {
      return json({ error: 'unavailable' }, 503);
    }
  },
};
