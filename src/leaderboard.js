// The leaderboard: everyone's best score in one shared table. Two homes, whichever the page has:
//  - on claude.ai: the artifact's database (the `db` capability: one document per player at
//    scores/<their id>, readable by everyone, writable only by its own player; see CLAUDE.md)
//  - on the game's own site (Cloudflare, worker/index.js): GET/POST api/scores, open to anyone;
//    a player there is a random id kept in this browser
// Anywhere else (a saved copy, a plain file server) there is no board: the game still shows your
// score and keeps your personal best in this browser.
//
// The score itself is Run.score() (run.js). A run only replaces your entry when it beats it.
export const BEST_KEY = 'jellyrun.best';   // also read by first-run.js: a saved best means a returning player
import { RunLog } from './run-log.js';
import { icon } from './icons.js';
import { MAX_SCORE } from './score.js';   // the most a run can score
const PLAYER_KEY = 'jellyrun.player';
const API = 'api/scores';  // relative: works wherever the game is served from
const PENDING_WAIT = 4000;  // ms between tries while the run log's last act is still on its way

export class Leaderboard {
  constructor() {
    this.rows = [];          // the top 10: [{ id, score, name, body, jelly, level, kills, time, won, at }]
    this.mine = null;        // your entry on the board (on the game's own site: your best run of any jelly type)
    this.tabs = new Map();   // the game's own site: tab ('champions', 'all', a jelly type) -> { top, mine, visit }, as the Worker answered
    this.pending = new Map();// tab -> { visit, read }: the read of it now under way
    this.past = new Map();   // season -> { champions, all } rows, read once a visit (past seasons never change)
    this.failed = new Set(); // tabs whose last read failed and that have nothing to show
    this.visit = 0;          // bumped when the board is opened or a run posts: a tab read before that is read again
    this.season = null;      // the season the Worker is on
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
    this.runLog = new RunLog(id);
    void this.runLog.flush();
    if (!(await this.fetchWeb())) { this.status = 'offline'; return false; }
    this.web = true;
    this.canWrite = true;
    return true;
  }

  // The all-types tab: it is what the end screen's name and the main menu read
  async fetchWeb() { return !!(await this.load('all')); }

  // One tab of the board (api/scores?tab=): 'champions', 'all' or a jelly type. A tab already read this
  // visit comes straight back; a failed read keeps what was there. Resolves { top, mine } or null.
  load(tab) {
    const have = this.tabs.get(tab);
    if (have && have.visit === this.visit) return Promise.resolve(have);
    const p = this.pending.get(tab);
    if (p && p.visit === this.visit) return p.read;
    const read = this.readTab(tab, this.visit).finally(() => { if (this.pending.get(tab)?.read === read) this.pending.delete(tab); });
    this.pending.set(tab, { visit: this.visit, read });
    return read;
  }

  // visit: the visit the read began in (an answer is only as fresh as when it was asked for)
  async readTab(tab, visit) {
    const fail = () => { const had = this.tabs.get(tab) || null; if (!had) { this.failed.add(tab); this.onChange?.(tab); } return had; };
    try {
      const r = await fetch(`${API}?tab=${encodeURIComponent(tab)}&me=${encodeURIComponent(this.id)}`, { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return fail();
      const d = await r.json();
      if (!Array.isArray(d.top)) return fail();
      const got = { top: d.top, mine: d.mine || null, visit };
      this.tabs.set(tab, got);
      this.failed.delete(tab);
      if (Number.isInteger(d.season)) this.season = d.season;
      if (tab === 'all') { this.rows = d.top; this.mine = got.mine; }
      this.status = 'live';
      this.onChange?.(tab);
      return got;
    } catch { return fail(); }
  }

  // Every tab is read again the next time it is shown (the board opening, or a run posting)
  open() { this.visit++; }

  take(snap) {
    this.rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.status = 'live';
    this.onChange?.();
  }

  // Read the top 10 now (opening the board calls this). Resolves once the rows are in.
  async refresh() {
    if (this.web) { this.open(); await this.fetchWeb(); return; }
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
    // one row per jelly type: only a better run with the same type replaces it
    if (this.mineOf(entry.jelly)?.score >= entry.score) return { posted: false, why: 'lower' };
    try {
      // the Worker checks the score against this run's log, so the log's last act has to land first
      for (let tries = 0; ; tries++) {
        await this.runLog?.flush();
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...entry, id: this.id }) });
        const d = await r.json().catch(() => ({}));
        if (d.posted) { if (!(this.mine?.score > entry.score)) this.mine = entry; this.open(); await Promise.all([this.load(jellyOf(entry.jelly)), this.load('all')]); return { posted: true }; }
        if (d.why === 'pending' && tries < 5) { await new Promise((ok) => setTimeout(ok, PENDING_WAIT)); continue; }
        return { posted: false, why: ['lower', 'taken', 'slow', 'unverified'].includes(d.why) ? d.why : 'error' };
      }
    } catch { return { posted: false, why: 'error' }; }
  }

  async rename(name) {
    await this.ready;
    if (!this.web) return { renamed: false, why: 'offline' };
    try {
      const response = await fetch('api/name', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: this.id, name }) });
      const result = await response.json();
      if (result.renamed) {
        if (this.mine) this.mine.name = result.name;
        if (this.localBest) {
          this.localBest.name = result.name;
          try { localStorage.setItem(BEST_KEY, JSON.stringify(this.localBest)); } catch {}
        }
        try { localStorage.setItem('jellyrun.name', result.name); } catch {}
        await this.refresh();
      }
      return result;
    } catch { return { renamed: false, why: 'error' }; }
  }

  // Beta feedback from an end screen (run.showFeedback): only the game's own site keeps it (the
  // Worker's feedback table). note: { text, build, act, won, score, device }. Resolves { sent, why }
  async feedback(note) {
    await this.ready;
    if (!this.web) return { sent: false, why: 'offline' };
    try {
      const r = await fetch('api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...note, id: this.id }) });
      const d = await r.json().catch(() => ({}));
      return d.sent ? { sent: true } : { sent: false, why: d.why === 'slow' ? 'slow' : 'error' };
    } catch { return { sent: false, why: 'error' }; }
  }

  // Independent of score submission: offline reports remain queued until acknowledged.
  saveRun(row) {
    this.runLog?.save(row);
  }

  // Would `score` make the top 10 (and beat your own best on it)? The end screen only offers to post it then
  async achievementBoard(entry = null) {
    await this.ready;
    // The artifact's database only has the score board; the shared achievement board is on the game's own site.
    if (this.db || !this.id) return { error: 'offline' };
    try {
      const r = await fetch(entry ? 'api/achievements' : `api/achievements?me=${encodeURIComponent(this.id)}`, entry
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...entry, id: this.id }) }
        : { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok || !Array.isArray(data.top)) return { error: ['slow', 'taken'].includes(data.why) ? data.why : 'offline' };
      if (entry && data.mine?.name) {
        if (this.mine) this.mine.name = data.mine.name;
        try { localStorage.setItem('jellyrun.name', data.mine.name); } catch {}
      }
      return data;
    } catch { return { error: 'offline' }; }
  }

  // Your own row for a jelly type (on the game's own site a board is kept for each type; on claude.ai there is one list)
  mineOf(jelly) { return this.web ? this.tabs.get(jellyOf(jelly))?.mine || null : this.mine; }

  // The top 10 of a jelly type's board (claude.ai: the one list)
  topOf(jelly) { return this.web ? this.tabs.get(jellyOf(jelly))?.top || [] : this.shown(); }

  // Would `score` make the top 10 (and beat your own best) with this jelly type? The end screen only offers to post it then.
  // A type's board not read yet says yes: the Worker decides.
  qualifies(score, jelly) {
    if (this.web && !this.tabs.has(jellyOf(jelly))) return true;
    if (this.mineOf(jelly)?.score >= score) return false;
    const rows = this.topOf(jelly).filter((r) => r.id !== this.id);
    return rows.length < 10 || score > rows[rows.length - 1].score;
  }
  // the score to beat for a place: #10's (0 while the board has room)
  cutoff(jelly) { const rows = this.topOf(jelly).filter((r) => r.id !== this.id); return rows.length < 10 ? 0 : rows[rows.length - 1].score; }

  // Your place on the board (1-based), or null when you're not in the top 10
  rank(jelly) {
    if (this.web) { const m = this.mineOf(jelly); return m && m.place <= 10 ? m.place : null; }
    const i = this.shown().findIndex((r) => r.id === this.id); return i < 0 ? null : i + 1;
  }

  // The pieces of a board row: who (name and second line), pic (their jelly), score
  lines(face, name, tab) {
    const second = (r, withType) => esc([withType ? name(r.jelly) : null, r.won ? 'Won' : `Reached act ${r.acts || 1}`, tab !== 'champions' && r.clean > 0 ? `${r.clean} ${r.clean === 1 ? 'act' : 'acts'} untouched` : null].filter(Boolean).join(' · '));
    const who = (r, withType) => `<span class="jf-who">${esc(r.name || 'A jelly')}${r.id === this.id ? ' <small>(you)</small>' : ''}<small class="jf-sub">${second(r, withType)}</small></span>`;
    const pic = (r) => (face ? `<img class="jf-jelly" src="${face(r.look || { body: r.body }) || ''}" alt="">` : '');
    const score = (r) => `${Number(r.score).toLocaleString()}${r.won ? ` ${icon('trophy', 'Won')}` : ''}`;
    return { who, pic, score };
  }

  // A past season (read-only, never changes): its Champions and the top 3 of All, or null when a read failed
  async loadPast(n) {
    if (!this.past.has(n)) {
      const get = async (tab) => {
        try {
          const r = await fetch(`${API}?season=${n}&tab=${tab}&me=${encodeURIComponent(this.id)}`, { cache: 'no-store' });
          const d = r.ok && await r.json();
          return Array.isArray(d?.top) ? d.top : null;
        } catch { return null; }
      };
      const [champions, all] = await Promise.all([get('champions'), get('all')]);
      if (champions && all) this.past.set(n, { champions, all });
    }
    return this.past.get(n) || null;
  }

  // What to draw for one past season (data from loadPast, or null while it is read / when it failed): { note, rows, cls }
  pastView(n, data, { face, types }) {
    const name = (id) => types.find((t) => t.id === id)?.name || 'Jelly';
    if (data === undefined) return { note: 'Loading the leaderboard…', rows: [], cls: '' };
    if (!data) return { note: 'Couldn\'t load this season. Tap its tab to try again.', rows: [], cls: '' };
    const { who, pic, score } = this.lines(face, name, 'champions');
    const head = (t) => [`<b class="jf-sec">${t}</b>`, ''];
    const champs = types.map((t) => [t, data.champions.find((r) => r.jelly === t.id)]).filter(([, r]) => r)
      .map(([t, r]) => [`<i class="jf-type-ic" aria-hidden="true">${t.icon}</i>${pic(r)}${who(r, true)}`, score(r)]);
    const best = data.all.map((r, i) => [`<i class="jf-rank" data-place="${i + 1}">${i + 1}.</i>${pic(r)}${who(r, true)}`, score(r)]);
    const rows = champs.length || best.length ? [head('Champions'), ...champs, head('Top 3'), ...best] : [];
    return { note: rows.length ? `How Season ${n} ended.` : `Nobody finished a run in Season ${n}.`, rows, cls: 'jf-past' };
  }

  // The game's own site: what to draw for one tab. types: [{ id, name, icon }] in jellies.kdl order;
  // face(look): a picture of a player's jelly. Resolves nothing: { note, rows: [[label, value]], cls } for ui.boardBody
  view(tab, { face, types }) {
    const name = (id) => types.find((t) => t.id === id)?.name || 'Jelly';
    const c = this.tabs.get(tab), mine = c?.mine;
    if (this.status === 'offline') return { note: this.note(), rows: [], cls: '' };
    if (!c) return { note: this.failed.has(tab) ? 'Couldn\'t load this board. Tap its tab to try again.' : 'Loading the leaderboard…', rows: [], cls: '' };
    const { who, pic, score } = this.lines(face, name, tab);
    if (tab === 'champions') {
      const held = types.filter((t) => c.top.some((r) => r.jelly === t.id && r.id === this.id)).length;
      return { cls: 'jf-champs', note: `The best run with each jelly type this season. You hold ${held} of ${types.length}.`, rows: types.map((t) => {
        const r = c.top.find((x) => x.jelly === t.id), ic = `<i class="jf-type-ic" aria-hidden="true">${t.icon}</i>`;
        return r ? [`${ic}${pic(r)}${who(r, true)}`, score(r)]
          : [`${ic}<span class="jf-who jf-nobody">Nobody yet<small class="jf-sub">${esc(t.name)} · be the first</small></span>`, '<span class="jf-none" aria-label="No score yet">–</span>'];
      }) };
    }
    const withType = tab === 'all', place = (r, i) => `<i class="jf-rank"${i < 3 ? ` data-place="${i + 1}"` : ''}>${i + 1}.</i>`;
    const rows = c.top.map((r, i) => [`${place(r, i)}${pic(r)}${who(r, withType)}`, score(r)]);
    if (mine && !c.top.some((r) => r.id === this.id)) {
      rows.push(['<span class="jf-gap" aria-hidden="true">⋯</span>', '']);
      rows.push([`<i class="jf-rank">${mine.place}.</i>${pic(mine)}${who({ ...mine, id: this.id }, withType)}`, score(mine)]);
    }
    const label = tab === 'all' ? '' : ` with ${name(tab)}`;
    const note = mine ? `Your best${label}: ${Number(mine.score).toLocaleString()} (#${mine.place})`
      : !c.top.length ? (tab === 'all' ? 'No scores yet. Be the first!' : `Nobody has played ${name(tab)} yet. Be the first!`)
        : tab === 'all' ? 'Finish a run to get on the board.' : `Finish a run with ${name(tab)} to get on this board.`;
    return { note, rows, cls: '' };
  }

  // Rows for the in-game table: [label, value] pairs, names escaped (they're other players' input).
  // face(look): a picture of that player's own jelly (jelly-portrait.js), shown by their name;
  // typeName(jelly): the run's jelly type in words, under the name (with jelly types on), or null
  table(face = null, typeName = null) {
    if (this.status === 'offline') return [];
    return this.shown().map((r, i) => [
      `<i class="jf-rank"${i < 3 ? ` data-place="${i + 1}"` : ''}>${i + 1}.</i>${face ? `<img class="jf-jelly" src="${face(r.look || { body: r.body }) || ''}" alt="">` : ''}<span class="jf-who">${esc(r.name || 'A jelly')}${r.id === this.id ? ' <small>(you)</small>' : ''}${typeName ? ` <small class="jf-type">${esc(typeName(r.jelly))}</small>` : ''}</span>`,
      `${Number(r.score).toLocaleString()}${r.won ? ` ${icon('trophy', 'Won')}` : ''}`,
    ]);
  }

  // One line about where things stand, for under the table
  note() {
    if (this.status === 'offline') return 'Leaderboard unavailable. Best in this browser: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    if (this.status === 'loading') return 'Loading the leaderboard…';
    if (!this.id || this.canWrite === false) return 'View-only leaderboard. Scores save in this browser. Best: ' + (this.localBest ? this.localBest.score.toLocaleString() : 'none yet') + '.';
    if (!this.shown().length) return 'No scores yet. Be the first!';
    return this.mine ? `Your best: ${this.mine.score.toLocaleString()}${this.rank() ? ` (#${this.rank()})` : ''}` : 'Finish a run to get on the board.';
  }
}

// a jelly type id as the Worker keeps it (a score from before jelly types is Normal's)
const jellyOf = (v) => String(v ?? '').replace(/[^a-z]/g, '').slice(0, 16) || 'normal';

// text made safe to put in HTML (other players' names, what you typed)
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
