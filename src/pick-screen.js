// The jelly type pick screen (docs/jelly-types/spec-pick-screen.md): a two-column Spotlight + 2D
// Roster Grid for content/jellies.kdl. Left: the selected jelly's Spotlight (name, Favorite star,
// live 3D attack preview, six stat bars, diff chips, one line on the attack, and Play or unlock
// progress). Right: a scrollable 2D grid starting with a Random (?) roulette tile, then Favorites,
// remaining unlocked jellies, and locked jellies dimmed at the end.
//
// Each roster tile renders a one-shot aura-lit portrait snapshot (pick-aura.js) so all element
// shaders shine on the grid at zero per-frame GPU cost. Only the Spotlight animates: its live 3D
// attack preview (attack-preview.js) runs when settled and unlocked, and its animated element aura
// fills in while loading, on locked jellies, or when live preview is off. Reduce effects (juice.calm)
// keeps still/frozen frames and instant selection. Nothing here starts a run: Play calls onPlay(id).
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { esc } from './leaderboard.js';
import { icon } from './icons.js';
import { BAR_NAMES, BAR_SEGMENTS, barSegments, favJellies, openTypes, toggleFavJelly, typeBars, typeDetails, typeLock } from './jelly-types.js';

const VIEWS = 8;   // views of the jelly that make one full turn: the portrait fades from one to the next
const shortName = (name) => name.replace(/\s+Jelly$/i, '');

const CSS = `
#type-pick { position: fixed; inset: 0; z-index: 15; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: none; box-sizing: border-box;
  --accent: var(--ui-mint);
  padding: max(var(--ui-space-3), env(safe-area-inset-top, 0px)) max(var(--ui-space-4), env(safe-area-inset-right, 0px)) max(var(--ui-space-3), env(safe-area-inset-bottom, 0px)) max(var(--ui-space-4), env(safe-area-inset-left, 0px));
  background: radial-gradient(85% 75% at 24% 48%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 65%),
    radial-gradient(120% 90% at 50% 0%, var(--menu-water-shallow) 0%, var(--menu-water-deep) 62%, var(--ui-deep) 100%);
  color: var(--ui-ink); font: 400 var(--ui-size-body)/1.4 var(--ui-font-text); }
#type-pick[hidden] { display: none; }
#type-pick header { flex: none; margin-bottom: var(--ui-space-2); }
#type-pick .tp-headline { display: flex; align-items: center; gap: var(--ui-space-3); }
#type-pick .tp-count { font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); color: var(--ui-ink-dim); white-space: nowrap; }
#type-pick .tp-main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: var(--ui-space-4); width: min(1080px, 100%); margin: 0 auto; align-items: stretch; }
/* --- Spotlight (left column) --- */
#type-pick .tp-spot { display: flex; flex-direction: column; align-self: start; max-height: 100%; box-sizing: border-box; min-height: 0; gap: var(--ui-space-3); padding: var(--ui-space-4);
  border: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); border-radius: var(--ui-radius-m); background: var(--ui-panel);
  box-shadow: 0 14px 44px var(--ui-shade), 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 0 40px color-mix(in srgb, var(--accent) 16%, transparent);
  touch-action: pan-y; user-select: none; -webkit-user-select: none; }
#type-pick .tp-spot-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); flex: none; }
#type-pick .tp-name { margin: 0; color: var(--accent); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#type-pick .tp-fav { flex: none; color: var(--ui-ink-dim); }
#type-pick .tp-fav[aria-pressed="true"] { color: var(--ui-gold); border-color: color-mix(in srgb, var(--ui-gold) 65%, transparent); background: color-mix(in srgb, var(--ui-gold) 14%, var(--ui-glass)); }
#type-pick .tp-fav[aria-pressed="true"] .ui-icon { fill: currentColor; }
#type-pick .tp-body { flex: 1; min-height: 0; display: flex; align-items: center; gap: var(--ui-space-4); }
#type-pick .tp-art { --art: clamp(132px, min(22vw, 34vh), 240px); position: relative; flex: none; width: var(--art); height: var(--art);
  border-radius: var(--ui-radius-m); overflow: hidden; border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); background: var(--ui-deep); }
#type-pick .tp-spot.locked .tp-art { filter: grayscale(.9) brightness(.8); }
#type-pick .tp-art img, #type-pick .tp-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
#type-pick .tp-art img[hidden], #type-pick .tp-thumb img[hidden] { display: none; }
#type-pick .tp-art canvas, #type-pick .tp-thumb canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#type-pick .tp-art canvas[hidden] { display: none; }
#type-pick .tp-art .tp-lock { position: absolute; inset: auto 0 0; z-index: 2; padding: var(--ui-space-1) var(--ui-space-2); background: var(--ui-scrim); text-align: center; font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); }
#type-pick .tp-art .tp-lock[hidden] { display: none; }
#type-pick .tp-bars { flex: 1; min-width: 0; display: grid; gap: var(--ui-space-2); }
#type-pick .tp-bar { display: grid; grid-template-columns: 92px 1fr; align-items: center; gap: var(--ui-space-2); font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); color: var(--ui-ink-dim); white-space: nowrap; }
#type-pick .tp-track { display: grid; grid-template-columns: repeat(${BAR_SEGMENTS}, 1fr); gap: 2px; height: 14px; }
#type-pick .tp-seg { border-radius: 3px; background: var(--ui-glass-strong); }
#type-pick .tp-seg.on { background: var(--ui-mint); }
#type-pick .tp-panel { flex: none; display: flex; flex-direction: column; gap: var(--ui-space-2); }
#type-pick .tp-diff { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin: 0; padding: 0; list-style: none; }
#type-pick .tp-diff:empty { display: none; }
#type-pick .tp-about { margin: 0; }
#type-pick .tp-play { display: flex; width: 100%; }
/* Play squeezes just before the run starts (confirm()); the start waits --pick-squeeze for it */
#type-pick .tp-play.tp-squeeze { animation: tp-squeeze calc(var(--pick-squeeze) * 1s) var(--ui-ease-settle) both; }
@keyframes tp-squeeze { to { transform: scale(.94, .88); } }
#type-pick .tp-goal { display: flex; align-items: center; justify-content: center; min-height: var(--ui-target); margin: 0; padding: 0 var(--ui-space-3); border: 1px dashed var(--ui-line); border-radius: var(--ui-radius-pill); color: var(--ui-ink-dim); font-weight: 600; text-align: center; }
#type-pick .tp-play[hidden], #type-pick .tp-goal[hidden], #type-pick .tp-back[hidden] { display: none; }
/* --- Roster Grid (right column) --- */
#type-pick .tp-roster { min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 4px; -webkit-overflow-scrolling: touch; }
#type-pick .tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--ui-space-2); align-content: start; }
#type-pick .tp-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; box-sizing: border-box; padding: 6px;
  min-width: var(--ui-target); min-height: var(--ui-target); border: 2px solid var(--ui-line); border-radius: var(--ui-radius-m); background: var(--ui-panel); color: var(--ui-ink);
  font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); cursor: pointer; touch-action: manipulation;
  transition: transform var(--ui-fast) var(--ui-ease-arrive), border-color var(--ui-fast), box-shadow var(--ui-fast), background-color var(--ui-fast); }
#type-pick .tp-tile:active { transform: scale(.96); }
#type-pick .tp-tile:focus-visible { outline: 2px solid var(--ui-mint); outline-offset: 2px; }
#type-pick .tp-tile.on { border-color: var(--tile-accent, var(--ui-mint)); background: color-mix(in srgb, var(--tile-accent, var(--ui-mint)) 16%, var(--ui-panel));
  box-shadow: 0 0 0 1px var(--tile-accent, var(--ui-mint)), 0 6px 18px color-mix(in srgb, var(--tile-accent, var(--ui-mint)) 28%, transparent); }
#type-pick .tp-tile.rolling { border-color: var(--ui-gold); box-shadow: 0 0 0 2px var(--ui-gold), 0 0 18px color-mix(in srgb, var(--ui-gold) 45%, transparent); transform: scale(1.04); }
#type-pick .tp-tile.locked { opacity: .82; }
#type-pick .tp-tile.locked .tp-thumb { filter: grayscale(.92) brightness(.72); }
#type-pick .tp-thumb { position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--ui-radius-s); overflow: hidden; background: var(--ui-deep); }
#type-pick .tp-tile-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#type-pick .tp-pip { position: absolute; z-index: 2; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--ui-scrim); pointer-events: none; }
#type-pick .tp-pip .ui-icon { width: 13px; height: 13px; }
#type-pick .tp-pip-fav { top: 4px; right: 4px; color: var(--ui-gold); }
#type-pick .tp-pip-fav .ui-icon { fill: currentColor; }
#type-pick .tp-pip-lock { bottom: 4px; right: 4px; color: var(--ui-ink); }
#type-pick .tp-pip[hidden] { display: none; }
#type-pick .tp-random .tp-thumb { display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--ui-gold) 26%, transparent), var(--ui-deep) 74%); color: var(--ui-gold); }
#type-pick .tp-random .tp-thumb .ui-icon { width: 34%; height: 34%; min-width: 24px; min-height: 24px; }
#type-pick .tp-random { border-color: color-mix(in srgb, var(--ui-gold) 45%, var(--ui-line)); }
body.calm #type-pick .tp-tile, body.calm #type-pick .tp-tile.rolling { transition: none; transform: none; }
/* a phone held sideways: tighten padding and art size so Spotlight + Roster Grid fit with zero overflow */
@media (max-height: 520px) {
  #type-pick { padding-top: var(--ui-space-2); padding-bottom: var(--ui-space-2); }
  #type-pick header { margin-bottom: var(--ui-space-1); min-height: var(--ui-target); }
  #type-pick h2 { font-size: var(--ui-size-heading); }
  #type-pick .tp-main { gap: var(--ui-space-3); }
  #type-pick .tp-spot { gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); }
  #type-pick .tp-name { font-size: var(--ui-size-heading); }
  #type-pick .tp-body { gap: var(--ui-space-3); }
  #type-pick .tp-art { --art: clamp(104px, calc(100vh - 210px), 164px); }
  #type-pick .tp-bars { gap: 4px; }
  #type-pick .tp-bar { grid-template-columns: 84px 1fr; }
  #type-pick .tp-track { height: 11px; }
  #type-pick .tp-panel { gap: var(--ui-space-1); }
  #type-pick .tp-about { font-size: var(--ui-size-label); line-height: 1.3; }
  #type-pick .tp-grid { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 6px; }
  #type-pick .tp-tile { padding: 4px; gap: 3px; }
}
/* portrait window/screen: Spotlight hugs its contents on top, Roster Grid below */
@media (max-aspect-ratio: 4/5) {
  #type-pick .tp-main { grid-template-columns: 1fr; grid-template-rows: auto 1fr; gap: var(--ui-space-3); }
  #type-pick .tp-art { --art: clamp(112px, 28vw, 180px); }
  #type-pick .tp-grid { grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); }
}
`;

export class TypePicker {
  // calm: Reduce effects is on. look(): the player's jelly look, so portraits redraw when it changes.
  // portrait(id, turn): a data URL of the player's jelly as that type, turned `turn` radians (jelly-portrait.js), or null.
  // live: the Spotlight's moving picture (attack-preview.js AttackPreview), or null for still/aura portraits only.
  // painter (set after): draws element auras (pick-auras/painter.js) on Spotlight and one-shot tile snapshots.
  constructor({ calm = () => false, look = () => null, portrait = () => null, live = null } = {}) {
    Object.assign(this, { calm, look, portrait, live });
    this.liveFor = null;
    this.lookKey = null;
    this.ids = Object.keys(CONTENT.jellies);
    this.order = [...this.ids];   // current grid order: Favorites -> remaining unlocked -> locked
    this.frames = Object.fromEntries(this.ids.map((id) => [id, Array(VIEWS).fill(null)]));
    this.tileLit = Object.fromEntries(this.ids.map((id) => [id, false]));
    this.index = 0;               // index into this.ids of the selected jelly
    this.queue = []; this.spin = 0; this.swipe = null; this.wheel = 0; this.wheelAt = 0;
    this.roll = null;
    this.onPlay = null; this.onBack = null; this.raf = 0; this.last = 0;
    this.painter = null;
    this.auraT = 0; this.auraAt = -1;
  }

  mount(parent) {
    const root = this.root = document.createElement('div');
    root.id = 'type-pick';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Choose your jelly');
    root.innerHTML = `<style>${CSS}</style>
      <header class="ui-header">
        <div class="tp-headline"><button type="button" class="ui-btn ui-btn--icon tp-back" aria-label="Back">${icon('back')}</button><h2 class="ui-title">Choose your jelly</h2></div>
        <span class="tp-count" aria-hidden="true"></span>
      </header>
      <div class="tp-main">
        <section class="tp-spot ui-panel" aria-live="polite">
          <div class="tp-spot-head">
            <h3 class="ui-title tp-name"></h3>
            <button type="button" class="ui-btn ui-btn--icon tp-fav" aria-label="Favorite" aria-pressed="false">${icon('star')}</button>
          </div>
          <div class="tp-body">
            <div class="tp-art">
              <img alt="" hidden><img alt="" hidden>
              <canvas class="tp-aura tp-spot-aura" aria-hidden="true"></canvas>
              <span class="tp-lock" hidden></span>
            </div>
            <div class="tp-bars">${BAR_NAMES.map((n) => `<div class="tp-bar" role="meter" aria-label="${n}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${n}<span class="tp-track">${Array.from({ length: BAR_SEGMENTS }, () => '<i class="tp-seg"></i>').join('')}</span></div>`).join('')}</div>
          </div>
          <div class="tp-panel">
            <ul class="tp-diff"></ul>
            <p class="tp-about ui-text"></p>
            <button type="button" class="ui-btn ui-btn--primary tp-play">Play</button>
            <p class="tp-goal" hidden></p>
          </div>
        </section>
        <section class="tp-roster" aria-label="Jelly roster">
          <div class="tp-grid">
            <button type="button" class="tp-tile tp-random" aria-label="Random jelly">
              <div class="tp-thumb">${icon('reroll')}</div>
              <span class="tp-tile-name">Random</span>
            </button>
            ${this.ids.map((id) => this.tileHtml(id)).join('')}
          </div>
        </section>
      </div>`;
    parent.appendChild(root);
    this.countEl = root.querySelector('.tp-count');
    this.back = root.querySelector('.tp-back');
    this.spot = root.querySelector('.tp-spot');
    this.nameEl = root.querySelector('.tp-name');
    this.favBtn = root.querySelector('.tp-fav');
    this.spotArt = root.querySelector('.tp-spot .tp-art');
    this.spotImgs = [...this.spotArt.querySelectorAll('img')];
    this.spotAura = this.spotArt.querySelector('.tp-spot-aura');
    this.spotLock = this.spotArt.querySelector('.tp-lock');
    this.barEls = [...root.querySelectorAll('.tp-spot .tp-bar')];
    this.panel = { diff: root.querySelector('.tp-diff'), about: root.querySelector('.tp-about'), play: root.querySelector('.tp-play'), goal: root.querySelector('.tp-goal') };
    this.roster = root.querySelector('.tp-roster');
    this.grid = root.querySelector('.tp-grid');
    this.randomBtn = root.querySelector('.tp-random');
    this.tiles = this.ids.map((id) => root.querySelector(`.tp-tile[data-id="${id}"]`));
    this.auras = this.tiles.map((t) => t.querySelector('.tp-aura'));

    this.panel.play.addEventListener('click', () => this.confirm());
    this.back.addEventListener('click', () => this.leave());
    this.favBtn.addEventListener('click', () => this.toggleFav());
    this.randomBtn.addEventListener('click', () => this.rollRandom());
    this.tiles.forEach((t, i) => t.addEventListener('click', () => { this.cancelRoll(); this.go(i); }));
    this.panel.play.addEventListener('animationend', () => this.panel.play.classList.remove('ui-pop'));
    // Swipe left/right on the Spotlight steps through the ordered roster casually
    this.spot.addEventListener('pointerdown', (e) => this.down(e));
    this.spot.addEventListener('pointerup', (e) => this.up(e));
    this.spot.addEventListener('pointercancel', () => { this.swipe = null; });
    this.spot.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    addEventListener('keydown', (e) => this.onKey(e), true);
    addEventListener('resize', () => { if (this.isOpen) this.measure(); });
  }

  tileHtml(id) {
    const J = CONTENT.jellies[id];
    return `<button type="button" class="tp-tile" data-id="${id}" style="--tile-accent:${esc(LOOK.color(`type-${id}`, '#8fd9ff'))}" aria-label="${esc(J.name)}">
      <div class="tp-thumb">
        <img alt="" hidden>
        <canvas class="tp-aura" data-aura="${esc(J.aura || '')}" aria-hidden="true"></canvas>
        <span class="tp-pip tp-pip-fav" hidden aria-hidden="true">${icon('star')}</span>
        <span class="tp-pip tp-pip-lock" hidden aria-hidden="true">${icon('lock')}</span>
      </div>
      <span class="tp-tile-name">${esc(shortName(J.name))}</span>
    </button>`;
  }

  get isOpen() { return !!this.root && !this.root.hidden; }
  get centre() { return this.ids[this.index]; }
  get animated() { return !!this.live && !this.calm(); }

  stopLive() { this.live?.hide(); this.liveFor = null; }

  // Order tiles: Random (?) stays first, then Favorites (unlocked), remaining unlocked, locked at the end
  reorder() {
    const favs = favJellies();
    const unlocked = [], locked = [];
    for (const id of this.ids) (typeLock(id) ? locked : unlocked).push(id);
    const favUnlocked = unlocked.filter((id) => favs.has(id));
    const restUnlocked = unlocked.filter((id) => !favs.has(id));
    this.order = [...favUnlocked, ...restUnlocked, ...locked];
    for (const id of this.order) {
      const i = this.ids.indexOf(id), t = this.tiles[i], lock = !!typeLock(id);
      t.classList.toggle('locked', lock);
      t.querySelector('.tp-pip-fav').hidden = !favs.has(id);
      t.querySelector('.tp-pip-lock').hidden = !lock;
      this.grid.appendChild(t);
    }
    this.countEl.textContent = `${unlocked.length} / ${this.ids.length} unlocked`;
    this.favBtn.setAttribute('aria-pressed', String(favs.has(this.centre)));
  }

  toggleFav() {
    if (!this.isOpen) return;
    sfx.tap();
    toggleFavJelly(this.centre);
    this.reorder();
    this.tiles[this.index].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  // Show the pick screen with `start` selected in the Spotlight.
  open({ start = 'normal', onPlay, onBack = null }) {
    this.onPlay = onPlay; this.onBack = onBack;
    this.cancelRoll();
    // the player may have changed their look since the last time: draw every portrait & snapshot again
    const lookKey = JSON.stringify(this.look());
    if (lookKey !== this.lookKey) {
      this.lookKey = lookKey;
      for (const id of this.ids) { this.frames[id].fill(null); this.tileLit[id] = false; }
      this.root.querySelectorAll('.tp-art img, .tp-thumb img').forEach((img) => { img.hidden = true; delete img.dataset.v; });
      this.auras.forEach((c) => c.classList.remove('lit'));
      this.spotAura.classList.remove('lit');
    }
    this.root.hidden = false;
    this.back.hidden = !onBack;
    this.index = Math.max(0, this.ids.indexOf(start));
    this.spin = 0;
    this.reorder();
    this.measure();
    this.setCentre(this.index, true);
    this.queue = [];
    this.want(this.index, true);
    for (const id of this.order) this.want(this.ids.indexOf(id), false);
    if (matchMedia('(pointer: fine)').matches) this.panel.play.focus({ preventScroll: true });
    this.last = performance.now();
    this.kick();
  }

  close() {
    this.root.hidden = true;
    this.confirming = false;
    this.cancelRoll();
    this.panel.play.classList.remove('tp-squeeze');
    this.stopLive();
    this.live?.release();
    this.painter?.release();
    this.swipe = null;
  }

  // The Play button / Enter: the button squeezes for --pick-squeeze, then the run starts (at once with Reduce effects)
  confirm() {
    if (this.confirming || !this.isOpen || typeLock(this.centre)) return;
    if (this.calm()) { this.play(); return; }
    this.confirming = true;
    this.panel.play.classList.add('tp-squeeze');
    setTimeout(() => { if (!this.confirming) return; this.confirming = false; if (!this.play()) this.panel.play.classList.remove('tp-squeeze'); }, LOOK.num('pick-squeeze', 0.08) * 1000);
  }

  // Play: start a run as the selected type. A locked type can't be played.
  play() {
    const id = this.centre;
    if (!this.isOpen || typeLock(id)) return false;
    sfx.tap();
    if (!this.calm()) { this.panel.play.classList.remove('ui-pop'); void this.panel.play.offsetWidth; this.panel.play.classList.add('ui-pop'); }
    this.close();
    this.onPlay?.(id);
    return true;
  }

  leave() {
    if (!this.isOpen || !this.onBack) return;
    this.close();
    this.onBack();
  }

  // Select jelly at index `i` in `this.ids`
  go(i) {
    i = Math.max(0, Math.min(this.ids.length - 1, Math.round(i)));
    this.setCentre(i);
    this.kick();
  }

  // Step through the grid's visible order (`this.order`) by `by`
  step(by) {
    this.cancelRoll();
    const pos = this.order.indexOf(this.centre);
    const next = Math.max(0, Math.min(this.order.length - 1, pos + by));
    this.go(this.ids.indexOf(this.order[next]));
  }

  gridCols() {
    const first = this.randomBtn.getBoundingClientRect().top;
    let cols = 1;
    for (const id of this.order) {
      if (Math.abs(this.tiles[this.ids.indexOf(id)].getBoundingClientRect().top - first) < 8) cols++;
      else break;
    }
    return Math.max(1, cols);
  }

  // --- Random (?) roulette across unlocked jellies ---------------------------------------------
  cancelRoll() {
    if (!this.roll) return;
    sfx.spinTick([]);
    this.tiles.forEach((t) => t.classList.remove('rolling'));
    this.roll = null;
  }

  rollRandom() {
    if (!this.isOpen) return;
    this.cancelRoll();
    const pool = this.order.filter((id) => !typeLock(id));
    if (!pool.length) return;
    const choices = pool.length > 1 ? pool.filter((id) => id !== this.centre) : pool;
    const target = choices[Math.floor(Math.random() * choices.length)];
    if (this.calm() || pool.length <= 1) {
      this.go(this.ids.indexOf(target));
      return;
    }
    const steps = Math.max(4, Math.round(LOOK.num('pick-roll-steps', 10)));
    const total = Math.max(0.2, LOOK.num('pick-roll-time', 0.58));
    const seq = [];
    for (let k = 0; k < steps - 1; k++) {
      const prev = seq[k - 1];
      const opts = pool.length > 1 ? pool.filter((id) => id !== prev) : pool;
      seq.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    seq.push(target);
    // Quadratic ease-out hop timestamps so the roulette slows down right before landing
    const times = seq.map((_, k) => total * Math.pow((k + 1) / steps, 1.7));
    sfx.spinTick([times.slice(0, -1)]);
    this.roll = { seq, times, t: 0, at: -1, target };
    this.kick();
  }

  stepRoll(dt) {
    const r = this.roll;
    if (!r) return false;
    r.t += dt;
    let k = r.at;
    while (k + 1 < r.times.length && r.t >= r.times[k + 1]) k++;
    if (k !== r.at) {
      r.at = k;
      this.tiles.forEach((t) => t.classList.remove('rolling'));
      const id = r.seq[k];
      const idx = this.ids.indexOf(id);
      if (k >= r.seq.length - 1) {
        this.roll = null;
        sfx.spinStop(1);
        this.setCentre(idx, false, true);
        return false;
      }
      this.tiles[idx].classList.add('rolling');
    }
    return true;
  }

  // --- the Spotlight and its panel -------------------------------------------------------------
  setCentre(i, quiet = false, silent = false) {
    if (i === this.index && !quiet) return;
    if (i !== this.index) { this.spin = 0; if (!silent) sfx.tap(); this.stopLive(); }
    this.index = i;
    const id = this.ids[i], J = CONTENT.jellies[id], lock = typeLock(id), P = this.panel;
    const accent = LOOK.color(`type-${id}`, '#8fd9ff');
    this.root.style.setProperty('--accent', accent);
    this.spot.classList.toggle('locked', !!lock);
    this.nameEl.textContent = J.name;
    this.favBtn.setAttribute('aria-pressed', String(favJellies().has(id)));
    this.spotAura.dataset.aura = J.aura || '';
    this.spotAura.classList.remove('lit');
    this.auraAt = -1;
    // Update the 6 stat bars in the Spotlight
    const bars = typeBars(id);
    this.barEls.forEach((bar, k) => {
      const lit = barSegments(bars[k]);
      bar.setAttribute('aria-valuenow', String(Math.round(bars[k] * 100)));
      bar.querySelectorAll('.tp-seg').forEach((seg, s) => seg.classList.toggle('on', s < lit));
    });
    // Still portrait fallback immediately if already cached
    const f0 = this.frames[id][0];
    if (f0) {
      this.spotImgs[0].src = this.spotImgs[1].src = f0;
      this.spotImgs[0].hidden = this.spotImgs[1].hidden = false;
      this.spotImgs[1].style.opacity = 0;
      this.spotImgs[0].dataset.v = '0';
    } else {
      this.spotImgs[0].hidden = this.spotImgs[1].hidden = true;
    }
    this.spotLock.hidden = !lock;
    this.spotLock.innerHTML = lock ? `${icon('lock', 'Locked')} ${esc(lock.goal)}` : '';
    this.tiles.forEach((t, k) => {
      t.classList.toggle('on', k === i);
      t.setAttribute('aria-pressed', String(k === i));
    });
    this.tiles[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    P.diff.innerHTML = typeDetails(id).map((t) => `<li class="ui-chip">${esc(t)}</li>`).join('');
    P.about.textContent = J.about;
    P.play.hidden = !!lock;
    P.goal.hidden = !lock;
    P.goal.textContent = !lock ? '' : lock.need > 1 ? `${lock.goal}: ${lock.have}/${lock.need}` : lock.goal;
    this.want(i, true);
  }

  // --- canvas sizing ---------------------------------------------------------------------------
  measure() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const spotPx = Math.round((this.spotArt.clientWidth || 180) * dpr);
    if (this.spotAura.width !== spotPx) this.spotAura.width = this.spotAura.height = spotPx;
    const thumbW = this.tiles[0]?.querySelector('.tp-thumb')?.clientWidth || 88;
    const tilePx = Math.min(192, Math.round(thumbW * dpr));
    this.auras.forEach((c, i) => {
      if (c.width !== tilePx) { c.width = c.height = tilePx; this.tileLit[this.ids[i]] = false; c.classList.remove('lit'); }
    });
    this.auraAt = -1;
  }

  // --- element auras: live on Spotlight (when AttackPreview isn't covering it), one-shot on tiles
  drawAuras(dt) {
    const calm = this.calm();
    this.auraT += calm ? 0 : dt;
    const strength = LOOK.num('pick-aura-strength', 1);
    const covered = this.liveFor && this.live?.canvas && !this.live.canvas.hidden;
    const due = this.auraAt < 0 || (!calm && this.auraT - this.auraAt >= 1 / LOOK.num('pick-aura-fps', 30));
    if (due && !covered) {
      this.auraAt = this.auraT;
      const id = this.centre, kind = this.spotAura.dataset.aura, colour = LOOK.color(`type-${id}`, '#8fd9ff');
      const t = calm ? 0.6 : this.auraT;
      let lit = false;
      try { lit = !!this.painter?.has(kind) && !!this.frames[id][0] && this.painter.draw(this.spotAura, kind, this.look(), t + this.index * 0.37, colour, strength); } catch (e) { console.warn('pick aura', e); }
      if (!lit) { this.spotAura.getContext('2d').clearRect(0, 0, this.spotAura.width, this.spotAura.height); if (calm && this.frames[id][0] !== '') this.auraAt = -1; }
      this.spotAura.classList.toggle('lit', lit);
    }
    // Paint at most one unlit roster tile per frame (one-shot snapshot, zero ongoing GPU cost)
    const pending = [this.centre, ...this.order].find((id) => !this.tileLit[id] && this.frames[id][0] && this.painter?.has(CONTENT.jellies[id].aura || ''));
    if (pending) {
      const i = this.ids.indexOf(pending), c = this.auras[i], kind = c.dataset.aura, colour = LOOK.color(`type-${pending}`, '#8fd9ff');
      let lit = false;
      try { lit = this.painter.draw(c, kind, this.look(), 0.6 + i * 0.37, colour, strength); } catch (e) { console.warn('pick tile aura', e); }
      if (lit) { this.tileLit[pending] = true; c.classList.add('lit'); }
    }
  }

  // --- portraits: drawn lazily one a frame -----------------------------------------------------
  want(i, first) {
    const id = this.ids[i], at = first ? 0 : this.queue.length;
    const views = first && !this.animated ? [...Array(VIEWS).keys()] : [0];
    const add = views.filter((v) => !this.frames[id][v] && !this.queue.some(([a, b]) => a === id && b === v)).map((v) => [id, v]);
    this.queue.splice(at, 0, ...add);
    if (this.isOpen) this.kick();
  }

  draw() {
    const [id, v] = this.queue.shift();
    if (this.frames[id][v]) return;
    const url = this.portrait(id, (v * 2 * Math.PI) / VIEWS) || '';
    this.frames[id][v] = url;
    if (v === 0 && url) {
      // Base view-0 portrait depends only on state.look: share it across all tiles on frame 1
      this.ids.forEach((other, idx) => {
        if (!this.frames[other][0]) this.frames[other][0] = url;
        const thumbImg = this.tiles[idx].querySelector('img');
        thumbImg.src = this.frames[other][0]; thumbImg.hidden = false;
      });
      this.spotImgs[0].src = this.spotImgs[1].src = this.frames[this.centre][0];
      this.spotImgs[0].hidden = this.spotImgs[1].hidden = false;
      this.spotImgs[1].style.opacity = 0;
      this.spotImgs[0].dataset.v = '0';
    }
  }

  showView(view, mix) {
    const f = this.frames[this.centre];
    if (!f[view]) return;
    const next = f[(view + 1) % VIEWS] || f[view];
    if (this.spotImgs[0].dataset.v !== String(view)) { this.spotImgs[0].src = f[view]; this.spotImgs[1].src = next; this.spotImgs[0].dataset.v = String(view); }
    this.spotImgs[1].style.opacity = mix;
  }

  // --- the frame loop: runs only while the screen is open --------------------------------------
  kick() { this.raf ||= requestAnimationFrame((t) => this.tick(t)); }

  tick(now) {
    this.raf = 0;
    if (!this.isOpen) return;
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000 || 0.016));
    this.last = now;
    const rolling = this.stepRoll(dt);
    this.drawAuras(dt);
    if (!rolling && this.queue.length) this.draw();
    // Spotlight live 3D attack preview (runs once settled and not in Reduce effects; locked jellies preview desaturated under the lock banner)
    if (!rolling && this.animated && this.liveFor !== this.centre) {
      this.liveFor = this.centre;
      this.live.show(this.centre, this.look(), this.spotArt);
    }
    const live = !!this.liveFor && this.live.step(dt);
    const f = this.frames[this.centre], turning = !live && !this.calm() && !this.spotAura.classList.contains('lit') && f.every(Boolean);
    if (turning) {
      this.spin += dt / LOOK.num('pick-spin-step', 1.4);
      this.showView(Math.floor(this.spin) % VIEWS, this.spin % 1);
    }
    const needTile = this.ids.some((id) => !this.tileLit[id] && this.frames[id][0] && this.painter?.has(CONTENT.jellies[id].aura || ''));
    if (rolling || turning || live || this.queue.length || needTile || !this.calm() || this.auraAt < 0) this.kick();
  }

  // --- Spotlight swipe, wheel & keyboard -------------------------------------------------------
  down(e) {
    if (e.button || e.target.closest?.('button')) return;
    this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  up(e) {
    const s = this.swipe;
    if (!s || e.pointerId !== s.id) return;
    this.swipe = null;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.2) this.step(dx < 0 ? 1 : -1);
  }

  onWheel(e) {
    if (!this.isOpen) return;
    e.preventDefault();
    this.wheel += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(this.wheel) < 40 || e.timeStamp - this.wheelAt < 140) return;
    this.step(this.wheel > 0 ? 1 : -1);
    this.wheel = 0; this.wheelAt = e.timeStamp;
  }

  onKey(e) {
    if (!this.isOpen || e.repeat) return;
    if (e.code === 'ArrowRight') this.step(1);
    else if (e.code === 'ArrowLeft') this.step(-1);
    else if (e.code === 'ArrowDown') this.step(this.gridCols());
    else if (e.code === 'ArrowUp') this.step(-this.gridCols());
    else if (e.code === 'Escape') this.leave();
    else if (e.code === 'Enter' && !e.target.closest?.('button')) this.confirm();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
