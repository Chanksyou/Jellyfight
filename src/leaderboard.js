// The leaderboard: everyone's best score in one shared table. Two homes, whichever the page has:
//  - on claude.ai: the artifact's database (the `db` capability: one document per player at
//    scores/<their id>, readable by everyone, writable only by its own player; see CLAUDE.md)
//  - on the game's own site (Cloudflare, worker/index.js): GET/POST api/scores, open to anyone;
//    a player there is a random id kept in this browser
// Anywhere else (a saved copy, a plain file server) there is no board: the game still shows your
// score and keeps your personal best in this browser.
//
// The score itself is Run.score() (run.js). A run only replaces your entry when it beats it.
const BEST_KEY = 'jellyfight.best';
const MAX_SCORE = 60000;   // a sanity cap: no real run comes close
const PLAYER_KEY = 'jellyfight.player';
const API = 'api/scores';  // relative: works wherever the game is served from

export class Leaderboard {
  constructor() {
    this.rows = [];          // the top 10: [{ id, score, name, body, level, kills, time, won, at }]
    this.mine = null;        // your entry on the board
    this.id = null;
    this.canWrite = null;    // true / false / null (unknown: try, and let a refused write decide)
    this.status = 'loading'; // 'loading' | 'live' | 'offline'
    this.onChange = null;
    try { this.localBest = JSON.parse(localStorage.getItem(BEST_KEY)) || null; } catch { this.localBest = null; }
    this.ready = this.init().catch(() => { this.status = 'offline'; return false; });
  }

  async init() {
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c?.use) return this.initWeb();
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    if (!db) { this.status = 'offline'; return false; }
    this.db = db;
    this.id = user ? await user.id() : null;
    this.canWrite = user && this.id ? await user.can('data.write') : false;
    this.top = db.collection('scores').orderBy('score', 'desc').limit(10);
    // live updates when the viewer delivers them; refresh() also reads the table directly, so
    // the board never depends on a snapshot having arrived
    this.top.onSnapshot((snap) => { this.take(snap); }, () => { this.onChange?.(); });
    if (this.id) {
      const me = await db.doc('scores/' + this.id).get();
      this.mine = me.exists ? me.data() : null;
    }
    await this.refresh();
    return true;
  }

  // The game's own site: the Worker's api/scores. No answer (a plain file server) = offline.
  async initWeb() {
    let id = null;
    try { id = localStorage.getItem(PLAYER_KEY); } catch {}
    if (!/^[a-z0-9-]{8,48}$/.test(id || '')) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).toLowerCase();
      try { localStorage.setItem(PLAYER_KEY, id); } catch {}
    }
    this.id = id;
    if (!(await this.fetchWeb())) { this.status = 'offline'; return false; }
    this.web = true;
    this.canWrite = true;
    return true;
  }

  async fetchWeb() {
    try {
      const r = await fetch(`${API}?me=${encodeURIComponent(this.id)}`, { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return false;
      const d = await r.json();
      if (!Array.isArray(d.top)) return false;
      this.rows = d.top;
      if (d.mine && (!this.mine || d.mine.score >= this.mine.score)) this.mine = d.mine;
      this.status = 'live';
      this.onChange?.();
      return true;
    } catch { return false; }
  }

  take(snap) {
    this.rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.status = 'live';
    this.onChange?.();
  }

  // Read the top 10 now (opening the board calls this). Resolves once the rows are in.
  async refresh() {
    if (this.web) { await this.fetchWeb(); return; }
    if (!this.top) return;
    try { this.take(await this.top.get()); } catch { if (this.status === 'loading') { this.status = 'offline'; this.onChange?.(); } }
  }

  // The table with your own entry in it: a score you just posted shows even before the
  // table read catches up with it
  shown() {
    const rows = this.rows.filter((r) => r.id !== this.id);
    if (this.mine && this.id) rows.push({ id: this.id, ...this.mine });
    else rows.push(...this.rows.filter((r) => r.id === this.id));
    return rows.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  // Record a finished run. Resolves { best, posted, why }: best = whether it beat your personal
  // best; posted = whether it went on the shared board ('why' says why not)
  async submit(entry) {
    return { best: this.keepBest(entry), ...(await this.post(entry)) };
  }

  // Your best in this browser (whether or not you post it): true when this run beat it
  keepBest(entry) {
    const score = Math.max(0, Math.min(MAX_SCORE, Math.round(entry.score)));
    const best = !this.localBest || score > this.localBest.score;
    if (best) { this.localBest = { ...entry, score, at: Date.now() }; try { localStorage.setItem(BEST_KEY, JSON.stringify(this.localBest)); } catch {} }
    return best;
  }

  // Put a run on the shared board (the end screen's Submit score). Resolves { posted, why }
  async post(entry) {
    entry = { ...entry, score: Math.max(0, Math.min(MAX_SCORE, Math.round(entry.score))), at: Date.now() };
    await this.ready;
    if (this.web) return this.postWeb(entry);
    if (!this.db) return { posted: false, why: 'offline' };
    if (!this.id || this.canWrite === false) return { posted: false, why: 'readonly' };
    if (this.mine && this.mine.score >= entry.score) return { posted: false, why: 'lower' };
    try {
      await this.db.doc('scores/' + this.id).set(entry);
      this.mine = entry;
      return { posted: true };
    } catch (e) {
      if (e?.code === 'invalid_argument') this.canWrite = false;   // the rules said no: read-only for this visit
      return { posted: false, why: e?.code === 'invalid_argument' ? 'readonly' : 'error' };
    }
  }

  async postWeb(entry) {
    if (this.mine && this.mine.score >= entry.score) return { posted: false, why: 'lower' };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...entry, id: this.id }) });
      const d = await r.json().catch(() => ({}));
      if (d.posted) { this.mine = entry; this.fetchWeb(); return { posted: true }; }
      return { posted: false, why: d.why === 'lower' ? 'lower' : 'error' };
    } catch { return { posted: false, why: 'error' }; }
  }

  // Your place on the board (1-based), or null when you're not in the top 10
  rank() { const i = this.shown().findIndex((r) => r.id === this.id); return i < 0 ? null : i + 1; }

  // Rows for the in-game table: [label, value] pairs, names escaped (they're other players' input)
  table() {
    if (this.status === 'offline') return [];
    return this.shown().map((r, i) => [
      `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${esc(r.name || 'A jelly')}${r.id === this.id ? ' <small>(you)</small>' : ''}`,
      `${Number(r.score).toLocaleString()}${r.won ? ' 🏆' : ''}`,
    ]);
  }

  // One line about where things stand, for under the table
  note() {
    if (this.status === 'offline') return 'The shared leaderboard isn\'t reachable from here. Your best in this browser: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    if (this.status === 'loading') return 'Loading the leaderboard…';
    if (!this.id || this.canWrite === false) return 'You can see the board, but this game\'s page is view-only for you, so your scores stay in this browser. Your best here: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    if (!this.shown().length) return 'No scores yet. Be the first!';
    return this.mine ? `Your best: ${this.mine.score.toLocaleString()}${this.rank() ? ` (#${this.rank()})` : ''}` : 'Finish a run to get on the board.';
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
