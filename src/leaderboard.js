// The leaderboard: everyone's best score in one shared table, kept in the artifact's database
// (the claude.ai `db` capability: one document per player at scores/<their id>, readable by
// everyone, writable only by its own player; see the publish rules in CLAUDE.md). Off claude.ai
// (a saved copy, another host, signed out) there is no database: the game still shows your
// score and keeps your personal best in this browser, and the board says where it lives.
//
// The score itself is Run.score() (run.js). A run only replaces your entry when it beats it.
const BEST_KEY = 'jellyfight.best';
const MAX_SCORE = 60000;   // a sanity cap: no real run comes close

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
    if (!c?.use) { this.status = 'offline'; return false; }
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

  take(snap) {
    this.rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.status = 'live';
    this.onChange?.();
  }

  // Read the top 10 now (opening the board calls this). Resolves once the rows are in.
  async refresh() {
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
    entry = { ...entry, score: Math.max(0, Math.min(MAX_SCORE, Math.round(entry.score))), at: Date.now() };
    const best = !this.localBest || entry.score > this.localBest.score;
    if (best) { this.localBest = entry; try { localStorage.setItem(BEST_KEY, JSON.stringify(entry)); } catch {} }
    await this.ready;
    if (!this.db) return { best, posted: false, why: 'offline' };
    if (!this.id || this.canWrite === false) return { best, posted: false, why: 'readonly' };
    if (this.mine && this.mine.score >= entry.score) return { best, posted: false, why: 'lower' };
    try {
      await this.db.doc('scores/' + this.id).set(entry);
      this.mine = entry;
      return { best, posted: true };
    } catch (e) {
      if (e?.code === 'invalid_argument') this.canWrite = false;   // the rules said no: read-only for this visit
      return { best, posted: false, why: e?.code === 'invalid_argument' ? 'readonly' : 'error' };
    }
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
    if (this.status === 'offline') return 'The shared leaderboard lives on the game\'s claude.ai page (signed in). Your best here: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    if (this.status === 'loading') return 'Loading the leaderboard…';
    if (!this.shown().length) return 'No scores yet. Be the first!';
    if (!this.id || this.canWrite === false) return 'You can see the board; posting scores needs edit access to the game\'s page. Your best here: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    return this.mine ? `Your best: ${this.mine.score.toLocaleString()}${this.rank() ? ` (#${this.rank()})` : ''}` : 'Finish a run to get on the board.';
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
