// Dev: the balance editor (pause menu → ⚖️ Tuner, behind the dev password). Every number in
// content/enemies.kdl, content/treasures.kdl, content/evolutions.kdl, content/bosses.kdl,
// content/elites.kdl and content/levelups.kdl as a box you can type into. Changing one
// recompiles the content on the spot: the next bug that spawns uses the new numbers, and so
// do the treasures you already hold (the run's combined effects recompute). A boss or elite
// already fighting reads its skills fresh each attack, so its new numbers land from the next
// attack (its Health, from its next spawn or power-on); level-up numbers land at the next
// level-up. Bugs already alive keep the numbers they spawned with. Elites and level-up cards
// can also be removed for the session: a removed elite doesn't spawn and a removed card
// isn't offered, until restored. Nothing is written back to the files: "Copy changes" lists
// what you changed, ready to make permanent (or hand to an agent), and Reset puts the file
// values back and restores everything removed. Only for tuning; players never see it.
import { CONTENT, recompileContent, REMOVED } from './content.js';
import { ENEMY_WORDS, TREASURE_WORDS } from './words.js';
import { STAT_INFO } from './stats.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const originals = new Map();   // field -> the value it has in the file

// One editable number: a slot in a parsed content node (an arg or a prop), remembering the
// value it started with so changes can be listed and reset.
function leaf(where, label, box, key) {
  const f = {
    where, label,
    get: () => box[key],
    edited: () => originals.has(f) && f.get() !== originals.get(f),
    set: (v) => { if (!originals.has(f)) originals.set(f, box[key]); box[key] = v; },
    reset: () => { box[key] = originals.get(f); },
  };
  return f;
}

// Every number in one word: its positional args (named by the word's definition), then its
// props, then its block's words (every N { … }).
function wordFields(where, node, registry, path, out) {
  const def = registry?.[node.name];
  node.args.forEach((a, i) => { if (isNum(a)) out.push(leaf(where, `${path}${node.name} ${def?.args?.[i] ?? 'arg ' + (i + 1)}`, node.args, i)); });
  for (const k of Object.keys(node.props)) if (isNum(node.props[k])) out.push(leaf(where, `${path}${node.name} ${k}`, node.props, k));
  for (const c of node.children) wordFields(where, c, def?.block ?? registry, path, out);
}

// One content entry's numbers: its own numeric props first (a bug's hp/r/dmg/xp, a treasure's
// stack), then its words; a treasure's levels get their own word lists, labelled Lv2, Lv3.
function entryFields(where, node, registry) {
  const out = [];
  for (const k of Object.keys(node.props)) if (isNum(node.props[k])) out.push(leaf(where, k, node.props, k));
  for (const c of node.children) {
    if (c.name === 'level') for (const w of c.children) wordFields(where, w, registry, `Lv${c.args[0]} · `, out);
    else wordFields(where, c, registry, '', out);
  }
  return out;
}

let groups = null;
// The editable things, as the panel shows them: bugs, then treasures, then evolutions. Built
// once: the parsed nodes live as long as the page does, and the fields point into them.
export function balanceGroups() {
  if (groups) return groups;
  const build = (nodes, compiled, kind, file, registry) => nodes.map((n, i) => ({
    kind, id: n.args[0], file, icon: compiled?.[i]?.icon || (kind === 'boss' ? '👹' : kind === 'elite' ? '👺' : '🐞'), name: n.props.name || n.args[0], desc: n.props.text || '',
    fields: entryFields(`${file} · ${n.props.name || n.args[0]}`, n, registry),
  }));
  const lu = CONTENT.nodes.levelups;
  groups = [
    ...build(CONTENT.nodes.enemies, null, 'bug', 'content/enemies.kdl', ENEMY_WORDS),
    ...build(CONTENT.nodes.treasures, CONTENT.treasures, 'treasure', 'content/treasures.kdl', TREASURE_WORDS),
    ...build(CONTENT.nodes.evolutions, CONTENT.evolutions, 'evolution', 'content/evolutions.kdl', TREASURE_WORDS),
    ...build(CONTENT.nodes.bosses, null, 'boss', 'content/bosses.kdl', null),
    { kind: 'elite', id: 'pace', file: 'content/elites.kdl', icon: '⏱️', name: 'Elite pace', desc: 'How fast every elite fights: its rest between attacks runs down recover× as fast, and each attack plays tempo× as fast.', fields: entryFields('content/elites.kdl · Elite pace', CONTENT.nodes.elites.find((n) => n.name === 'pace'), null) },
    ...build(CONTENT.nodes.elites.filter((n) => n.name === 'elite'), null, 'elite', 'content/elites.kdl', null).map((g) => ({ ...g, removeKey: `elite:${g.id}` })),
    { kind: 'levelup', id: 'xp', file: 'content/levelups.kdl', icon: '⭐', name: 'XP curve', desc: 'XP to level up: base × growth^(level − 1).', fields: entryFields('content/levelups.kdl · XP curve', lu.find((n) => n.name === 'xp'), null) },
    { kind: 'levelup', id: 'rarities', file: 'content/levelups.kdl', icon: '🎲', name: 'Card rarities', desc: 'How often each level-up card rarity rolls, before Luck.', fields: entryFields('content/levelups.kdl · Card rarities', lu.find((n) => n.name === 'rarities'), null) },
    ...lu.filter((n) => n.name === 'card').map((n) => ({
      kind: 'levelup', id: n.args[0], file: 'content/levelups.kdl', icon: STAT_INFO[n.args[0]]?.icon || '🃏', name: STAT_INFO[n.args[0]]?.name || n.args[0],
      desc: 'Level-up card: what it gives at Common / Rare / Epic, and how likely it is to be offered (weight).',
      removeKey: `card:${n.args[0]}`, fields: entryFields(`content/levelups.kdl · ${STAT_INFO[n.args[0]]?.name || n.args[0]}`, n, null),
    })),
  ];
  return groups;
}

// What has been changed, one line each: where, which number, file value → your value.
// Removals ride along, so a copied list says everything a session changed.
export function balanceChanges() {
  const lines = [...originals].filter(([f]) => f.edited()).map(([f, was]) => `${f.where} · ${f.label}: ${was} → ${f.get()}`);
  for (const g of balanceGroups()) if (g.removeKey && REMOVED.has(g.removeKey)) lines.push(`${g.file} · ${g.name} · removed (${g.kind === 'elite' ? "won't spawn" : "won't be offered"})`);
  return lines;
}

// Remove a thing for the session (or put it back): a removed elite doesn't spawn and a
// removed card isn't offered. Returns true when the thing is now removed.
export function toggleRemoved(g) {
  if (REMOVED.has(g.removeKey)) { REMOVED.delete(g.removeKey); return false; }
  REMOVED.add(g.removeKey);
  return true;
}

// Rebuild the game's content from the edited files, and make the run in front of you pick the
// new numbers up (its combined effects recompute on the next read). Throws, naming the file
// and line, if a number the compiler won't take got in: then nothing has changed.
export function applyBalance(run) {
  recompileContent();
  if (run) run.owned.version = (run.owned.version || 0) + 1;
}

export function resetBalance(run) {
  for (const f of originals.keys()) f.reset();
  originals.clear();
  REMOVED.clear();
  applyBalance(run);
}

const CSS = `
.jf-tune { position: fixed; inset: 0; z-index: 40; display: flex; justify-content: center; align-items: stretch; background: rgba(8, 10, 22, .7);
  font: 14px system-ui, sans-serif; color: #fff; padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom)); box-sizing: border-box; }
.jf-tune[hidden] { display: none; }
.jf-tune .box { width: min(760px, 100%); display: flex; flex-direction: column; background: #161a2c; border: 1px solid #ffffff22; border-radius: 16px; overflow: hidden; }
.jf-tune header { display: flex; align-items: center; gap: 8px; padding: 12px 14px 8px; }
.jf-tune header h2 { margin: 0; font-size: 20px; flex: 1; }
.jf-tune button { font: inherit; color: #fff; background: #ffffff14; border: 1px solid #ffffff2a; border-radius: 10px; padding: 8px 12px; cursor: pointer; min-height: 38px; }
.jf-tune button.on { background: #3d8cff55; border-color: #5fb4ff; }
.jf-tune button.go { background: #2ff0c455; border-color: #2ff0c4; font-weight: 700; }
.jf-tune .note { padding: 0 14px 8px; font-size: 12px; opacity: .7; }
.jf-tune .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 8px; }
.jf-tune .chips button { padding: 5px 10px; min-height: 32px; font-size: 13px; }
.jf-tune input[type=search] { margin: 0 14px 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid #ffffff30; background: #0006; color: #fff; font: inherit; }
.jf-tune .list { flex: 1; overflow-y: auto; padding: 0 8px 8px; -webkit-overflow-scrolling: touch; }
.jf-tune .row { border-bottom: 1px solid #ffffff10; }
.jf-tune .row .head { display: flex; align-items: center; gap: 10px; padding: 8px 6px; cursor: pointer; width: 100%; background: none; border: none; text-align: left; min-height: 0; }
.jf-tune .row .ic { font-size: 22px; width: 30px; text-align: center; }
.jf-tune .row .tx { flex: 1; }
.jf-tune .row .tx b { display: block; }
.jf-tune .row .tx span { display: block; font-size: 12px; opacity: .75; font-weight: 400; }
.jf-tune .row .dot { color: #ffd34d; }
.jf-tune .row.removed .tx b { text-decoration: line-through; opacity: .6; }
.jf-tune .rm { font-size: 12px; padding: 4px 8px; border: 1px solid #ffffff2a; border-radius: 8px; background: #ffffff14; white-space: nowrap; }
.jf-tune .fields { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 2px 6px 12px 46px; }
.jf-tune .fld { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: .95; }
.jf-tune .fld input { width: 76px; padding: 6px 8px; border-radius: 8px; border: 1px solid #ffffff30; background: #0006; color: #fff; font: inherit; font-size: 13px; }
.jf-tune .fld input.edited { border-color: #ffd34d; }
.jf-tune .status { padding: 6px 14px 0; font-size: 12px; min-height: 16px; color: #ffd34d; }
.jf-tune footer { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #ffffff18; }
.jf-tune footer .go { flex: 1; }
`;

const FILTERS = [['all', 'All'], ['bug', 'Bugs'], ['treasure', 'Treasures'], ['evolution', 'Evolutions'], ['boss', 'Bosses'], ['elite', 'Elites'], ['levelup', 'Level-ups']];

export class BalanceEditor {
  constructor(parent) {
    if (!document.getElementById('jf-tune-css')) {
      const s = document.createElement('style');
      s.id = 'jf-tune-css'; s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.el = document.createElement('div');
    this.el.className = 'jf-tune';
    this.el.hidden = true;
    parent.appendChild(this.el);
    this.filter = 'all';
    this.query = '';
    this.openId = null;
    this.status = '';
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => { if (e.target.type === 'search') { this.query = e.target.value.trim().toLowerCase(); this.drawList(); } });
    this.el.addEventListener('change', (e) => this.change(e));
  }

  get open() { return !this.el.hidden; }

  // run: the Run the new numbers apply to. onPlay(): close and play on; onBack(): back to the pause menu
  show(run, { onPlay, onBack } = {}) {
    this.run = run;
    this.onPlay = onPlay;
    this.onBack = onBack;
    this.groups = balanceGroups();
    this.el.innerHTML = `<div class="box">
      <header><h2>⚖️ Balance editor</h2><button data-k="back">✕</button></header>
      <div class="note">Type a number and it's live: the next bug spawns with it, treasures you hold use it at once, and a boss or elite uses a skill's new numbers from its next attack (its Health, from its next spawn or power-on). Level-up numbers land at the next level-up. ✕ Remove takes an elite out of the run or a card out of the offers until you restore it. Nothing is saved to the files — Copy changes lists your edits to make permanent.</div>
      <input type="search" placeholder="Search bugs, treasures, bosses, elites and level-ups" value="${this.query}">
      <div class="chips">${FILTERS.map(([id, label]) => `<button data-f="${id}">${label}</button>`).join('')}</div>
      <div class="list"></div>
      <div class="status"></div>
      <footer><button data-k="back">Back to menu</button><button data-k="copy">Copy changes</button><button data-k="reset">Reset</button><button data-k="play" class="go">▶ Play with this</button></footer>
    </div>`;
    this.el.hidden = false;
    this.draw();
  }

  hide() { this.el.hidden = true; }

  items() {
    const q = this.query, f = this.filter;
    return this.groups.filter((g) => (f === 'all' || g.kind === f)
      && (!q || `${g.name} ${g.id}`.toLowerCase().includes(q)));
  }

  draw() {
    this.el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === this.filter));
    this.drawStatus();
    this.drawList();
  }

  drawStatus() {
    const el = this.el.querySelector('.status');
    if (el) el.textContent = this.status || `${balanceChanges().length} change${balanceChanges().length === 1 ? '' : 's'} this session`;
  }

  drawList() {
    const list = this.el.querySelector('.list');
    if (!list) return;
    list.innerHTML = this.items().map((g) => {
      const gi = this.groups.indexOf(g);
      const removed = g.removeKey && REMOVED.has(g.removeKey);
      const fields = g.id === this.openId ? `<div class="fields">${g.fields.map((f, fi) =>
        `<label class="fld">${f.label} <input type="number" step="any" data-g="${gi}" data-f="${fi}" value="${f.get()}" class="${f.edited() ? 'edited' : ''}"></label>`).join('')}</div>` : '';
      return `<div class="row${removed ? ' removed' : ''}" data-id="${g.id}">
        <button class="head" data-k="toggle"><span class="ic">${g.icon}</span><span class="tx"><b>${g.name}</b>${g.desc ? `<span>${g.desc}</span>` : ''}</span>${g.fields.some((f) => f.edited()) ? '<span class="dot">●</span>' : ''}${g.removeKey ? `<span class="rm" data-k="remove" data-g="${gi}">${removed ? '↩ Restore' : '✕ Remove'}</span>` : ''}<span>${g.id === this.openId ? '▾' : '▸'}</span></button>
        ${fields}
      </div>`;
    }).join('') || '<p style="padding:14px;opacity:.7">Nothing matches.</p>';
  }

  async click(e) {
    const rm = e.target.closest('[data-k="remove"]');
    if (rm) {
      toggleRemoved(this.groups[+rm.dataset.g]);
      try { applyBalance(this.run); this.status = ''; } catch (err) { this.status = err.message; }
      this.draw();
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    const k = b.dataset.k;
    if (b.dataset.f) { this.filter = b.dataset.f; this.draw(); return; }
    if (k === 'toggle') {
      const id = b.closest('.row').dataset.id;
      this.openId = this.openId === id ? null : id;
      this.drawList();
    } else if (k === 'back') { this.hide(); this.onBack?.(); }
    else if (k === 'play') { this.hide(); this.onPlay?.(); }
    else if (k === 'reset') { resetBalance(this.run); this.status = ''; this.draw(); }
    else if (k === 'copy') {
      const lines = balanceChanges();
      if (!lines.length) { this.status = 'No changes yet.'; this.drawStatus(); return; }
      try { await navigator.clipboard.writeText(lines.join('\n')); this.status = `Copied ${lines.length} change${lines.length === 1 ? '' : 's'}.`; }
      catch { this.status = lines.join('  ·  '); }
      this.drawStatus();
    }
  }

  change(e) {
    const input = e.target.closest('input[type=number]');
    if (!input) return;
    const f = this.groups[+input.dataset.g].fields[+input.dataset.f];
    const v = parseFloat(input.value);
    if (!Number.isFinite(v)) { input.value = f.get(); return; }
    f.set(v);
    try {
      applyBalance(this.run);
      this.status = '';
      input.classList.add('edited');
    } catch (err) {
      this.status = err.message;   // the compiler names the file and line; the game kept the old numbers
    }
    this.drawStatus();
    const row = input.closest('.row');
    if (row && f.edited() && !row.querySelector('.dot')) this.drawList();
  }
}
