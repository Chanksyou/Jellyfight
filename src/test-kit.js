// Dev: the test kit (pause menu → 🧪 Test kit, behind the dev password). Try any treasure or
// evolution on the run in front of you: add or take away copies and levels, see what you have,
// spawn a pack of bugs to try it on, turn the waves off and stop yourself dying. Nothing here is
// for players; it only changes the run it's opened on.
import { TREASURES, EVOLUTIONS, TREASURE_RARITY, ELEMENT_UPGRADES } from './stats.js';
import { CONTENT } from './content.js';

const CSS = `
.jf-kit { position: fixed; inset: 0; z-index: 40; display: flex; justify-content: center; align-items: stretch; background: rgba(8, 10, 22, .7);
  font: 14px system-ui, sans-serif; color: #fff; padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom)); box-sizing: border-box; }
.jf-kit[hidden] { display: none; }
.jf-kit .box { width: min(760px, 100%); display: flex; flex-direction: column; background: #161a2c; border: 1px solid #ffffff22; border-radius: 16px; overflow: hidden; }
.jf-kit header { display: flex; align-items: center; gap: 8px; padding: 12px 14px 8px; }
.jf-kit header h2 { margin: 0; font-size: 20px; flex: 1; }
.jf-kit button { font: inherit; color: #fff; background: #ffffff14; border: 1px solid #ffffff2a; border-radius: 10px; padding: 8px 12px; cursor: pointer; min-height: 38px; }
.jf-kit button.on { background: #3d8cff55; border-color: #5fb4ff; }
.jf-kit button.go { background: #2ff0c455; border-color: #2ff0c4; font-weight: 700; }
.jf-kit .tools, .jf-kit .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 8px; }
.jf-kit .chips button { padding: 5px 10px; min-height: 32px; font-size: 13px; }
.jf-kit .have { padding: 4px 14px 8px; font-size: 18px; line-height: 1.5; min-height: 28px; word-break: break-word; }
.jf-kit .have small { font-size: 12px; opacity: .6; }
.jf-kit input[type=search] { margin: 0 14px 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid #ffffff30; background: #0006; color: #fff; font: inherit; }
.jf-kit .list { flex: 1; overflow-y: auto; padding: 0 8px 8px; -webkit-overflow-scrolling: touch; }
.jf-kit .row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid #ffffff10; }
.jf-kit .row .ic { font-size: 26px; width: 34px; text-align: center; }
.jf-kit .row .tx { flex: 1; min-width: 0; }
.jf-kit .row .tx b { display: block; }
.jf-kit .row .tx span { font-size: 12px; opacity: .75; }
.jf-kit .row .tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; margin-left: 6px; color: #10121e; font-weight: 700; }
.jf-kit .row .n { width: 34px; text-align: center; font-weight: 800; }
.jf-kit .row button { width: 40px; padding: 6px 0; }
.jf-kit footer { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #ffffff18; }
.jf-kit footer .go { flex: 1; }
`;

const TAG = Object.fromEntries(TREASURE_RARITY.map((r) => [r.id, r.color]));
const FILTERS = [['all', 'All'], ['evolution', 'Evolutions'], ['common', 'Common'], ['rare', 'Rare'], ['epic', 'Epic'], ['legendary', 'Legendary'], ['upgrade', 'Element upgrades']];

export class TestKit {
  constructor(parent) {
    if (!document.getElementById('jf-kit-css')) {
      const s = document.createElement('style');
      s.id = 'jf-kit-css'; s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.el = document.createElement('div');
    this.el.className = 'jf-kit';
    this.el.hidden = true;
    parent.appendChild(this.el);
    this.filter = 'all';
    this.query = '';
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => { if (e.target.type === 'search') { this.query = e.target.value.trim().toLowerCase(); this.drawList(); } });
  }

  get open() { return !this.el.hidden; }

  // run: the Run to change. onPlay(): close and play on; onBack(): close back to the pause menu
  show(run, { onPlay, onBack }) {
    this.run = run;
    this.onPlay = onPlay;
    this.onBack = onBack;
    if (run.phase === 'dead' || run.phase === 'won' || run.phase === 'metamorph') this.newRun();
    this.el.innerHTML = `<div class="box">
      <header><h2>🧪 Test kit</h2><button data-k="back">✕</button></header>
      <div class="tools">
        <button data-k="new">New test run</button>
        <button data-k="waves">Waves</button>
        <button data-k="god">Can't die</button>
        <button data-k="pack">Spawn 10 roaches</button>
        <button data-k="mix">Spawn a mixed pack</button>
        <button data-k="heal">Full Health</button>
        <button data-k="clear">Take everything off</button>
      </div>
      <div class="have"></div>
      <input type="search" placeholder="Search treasures and evolutions" value="${this.query}">
      <div class="chips">${FILTERS.map(([id, label]) => `<button data-f="${id}">${label}</button>`).join('')}</div>
      <div class="list"></div>
      <footer><button data-k="back">Back to menu</button><button data-k="play" class="go">▶ Play with this</button></footer>
    </div>`;
    this.el.hidden = false;
    this.draw();
  }

  hide() { this.el.hidden = true; }

  // a clean run to test in: no element pick, no waves, no dying (turn them back on above)
  newRun() {
    const R = this.run;
    R.start();
    R.devRun();
    R.startPicked = true;
    R.devCalm = true;
    R.devGod = true;
  }

  items() {
    const q = this.query, f = this.filter;
    const evo = EVOLUTIONS.map((e) => ({ ...e, kind: 'evolution' }));
    const tre = TREASURES.map((t) => ({ ...t, kind: ELEMENT_UPGRADES.includes(t.id) ? 'upgrade' : t.rarity }));
    return [...evo, ...tre].filter((t) => (f === 'all' || t.kind === f)
      && (!q || `${t.name} ${t.text} ${t.id}`.toLowerCase().includes(q)));
  }

  count(t) { return t.kind === 'evolution' ? (this.run.evolved.includes(t.id) ? 1 : 0) : this.run.owned.count(t.id); }

  draw() {
    const R = this.run, $ = (s) => this.el.querySelector(s);
    this.el.querySelector('[data-k="waves"]').classList.toggle('on', !R.devCalm);
    this.el.querySelector('[data-k="waves"]').textContent = R.devCalm ? 'Waves off' : 'Waves on';
    this.el.querySelector('[data-k="god"]').classList.toggle('on', !!R.devGod);
    this.el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === this.filter));
    const evo = R.evolved.map((id) => EVOLUTIONS.find((e) => e.id === id)?.icon).join(' ');
    const tre = [...R.owned].map((id) => { const t = TREASURES.find((x) => x.id === id), n = R.owned.count(id); return t ? t.icon + (n > 1 ? `<small>×${n}</small>` : '') : ''; }).join(' ');
    $('.have').innerHTML = evo || tre ? `${evo}${evo && tre ? ' · ' : ''}${tre}` : '<small>Nothing yet: tap + to add a treasure or an evolution.</small>';
    this.drawList();
  }

  drawList() {
    const list = this.el.querySelector('.list');
    if (!list) return;
    list.innerHTML = this.items().map((t) => {
      const n = this.count(t), max = t.kind === 'evolution' ? 1 : t.stack;
      const tag = t.kind === 'evolution' ? `<span class="tag" style="background:#2ff0c4">Evolution</span>` : `<span class="tag" style="background:${TAG[t.rarity]}">${t.rarity}${t.kind === 'upgrade' ? ' · upgrade' : ''}</span>`;
      const text = t.levels?.length > 1 && n > 0 ? t.levelText[Math.min(n, t.levels.length) - 1] : t.text;
      return `<div class="row" data-id="${t.id}" data-kind="${t.kind === 'evolution' ? 'evolution' : 'treasure'}">
        <div class="ic">${t.icon}</div>
        <div class="tx"><b>${t.name}${tag}</b><span>${text}</span></div>
        <button data-k="minus" ${n ? '' : 'disabled'}>−</button><div class="n">${n ? (t.levels?.length > 1 ? `Lv${n}` : n) : ''}</div><button data-k="plus" ${n >= max ? 'disabled' : ''}>+</button>
      </div>`;
    }).join('') || '<p style="padding:14px;opacity:.7">Nothing matches.</p>';
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const R = this.run, k = b.dataset.k;
    if (b.dataset.f) { this.filter = b.dataset.f; this.draw(); return; }
    const row = b.closest('.row');
    if (row && (k === 'plus' || k === 'minus')) { this.change(row.dataset.kind, row.dataset.id, k === 'plus' ? 1 : -1); return; }
    if (k === 'back') { this.hide(); this.onBack?.(); return; }
    if (k === 'play') { this.hide(); this.onPlay?.(); return; }
    if (k === 'new') this.newRun();
    else if (k === 'waves') R.devCalm = !R.devCalm;
    else if (k === 'god') R.devGod = !R.devGod;
    else if (k === 'heal') R.health = R.S.health;
    else if (k === 'clear') { R.owned.clear(); R.evolved.length = 0; R.health = Math.min(R.health, R.S.health); }
    else if (k === 'pack') this.spawn(['roach']);
    else if (k === 'mix') this.spawn(CONTENT.waves.bugs.filter((w) => w.act === R.stage.id).map((w) => w.id));
    R.refreshHud();
    this.draw();
  }

  // add (+1) or take away (-1) a copy, a level or an evolution
  change(kind, id, d) {
    const R = this.run;
    if (kind === 'evolution') {
      const i = R.evolved.indexOf(id);
      if (d > 0 && i < 0) R.evolved.push(id);
      if (d < 0 && i >= 0) R.evolved.splice(i, 1);
    } else if (d > 0) R.owned.add(id);
    else R.owned.remove(id);
    R.health = Math.min(Math.max(R.health, 1), R.S.health);
    R.refreshHud();
    this.draw();
  }

  // ten bugs in a ring a little way in front of the jelly, of the given kinds in turn
  spawn(types) {
    const R = this.run, P = R.player.position, f = R.player.facing;
    for (let k = 0; k < 10; k++) {
      const a = f + (k / 10 - 0.5) * 1.6, d = 0.28 + (k % 3) * 0.04;
      R.enemies.spawn(types[k % types.length], P.clone().set(P.x + Math.sin(a) * d, P.y, P.z + Math.cos(a) * d));
    }
  }
}
