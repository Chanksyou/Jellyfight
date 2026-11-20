// The jelly type pick screen (docs/jelly-types/spec-pick-screen.md): a row of cards, one per type
// (content/jellies.kdl). The centre card is the largest, its neighbours smaller, the next ones cut off by
// the screen's edges. Each card: the type's name, a framed portrait of the player's own jelly turning
// slowly, and six bars worked out from the type's level-1 stats (jelly-types.js typeBars). Under the
// centre card a panel lists what the bars leave out, one line on the attack, and Play (or, for a locked
// type, what unlocks it).
//
// Swipe or drag; arrow keys or the mouse wheel; tap a neighbour to bring it to the centre. The row
// settles on a card by itself. Reduce motion (juice.calm) turns off the turning and the settling: the
// row jumps. Nothing here starts a run: Play calls onPlay(id) and main.js does that.
//
// Once the row is still, the centre card's portrait comes alive (attack-preview.js): the jelly fires
// its real main attack at a bug. Reduce motion keeps the still portrait. Every other card shows the
// player's jelly as it is with its type's element moving round it (pick-aura.js, aura= in
// content/jellies.kdl); Reduce motion holds those still too.
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { esc } from './leaderboard.js';
import { icon } from './icons.js';
import { drawAura } from './pick-aura.js';
import { BAR_NAMES, BAR_SEGMENTS, barSegments, typeBars, typeDetails, typeLock } from './jelly-types.js';

const VIEWS = 8;   // views of the jelly that make one full turn: the portrait fades from one to the next

const CSS = `
#type-pick { position: fixed; inset: 0; z-index: 15; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: none; box-sizing: border-box;
  padding: max(var(--ui-space-3), env(safe-area-inset-top, 0px)) max(var(--ui-space-4), env(safe-area-inset-right, 0px)) max(var(--ui-space-3), env(safe-area-inset-bottom, 0px)) max(var(--ui-space-4), env(safe-area-inset-left, 0px));
  background: radial-gradient(120% 90% at 50% 0%, var(--menu-water-shallow) 0%, var(--menu-water-deep) 62%, var(--ui-deep) 100%);
  color: var(--ui-ink); font: 400 var(--ui-size-body)/1.4 var(--ui-font-text); --cw: clamp(280px, 26vw, 480px); }
#type-pick[hidden] { display: none; }
#type-pick header { flex: none; margin-bottom: var(--ui-space-2); }
#type-pick .tp-headline { display: flex; align-items: center; gap: var(--ui-space-3); }
#type-pick .tp-dots { display: flex; gap: var(--ui-space-2); padding-right: var(--ui-space-2); }
#type-pick .tp-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-glass-strong); transition: background-color var(--ui-mid), transform var(--ui-mid) var(--ui-ease-arrive); }
#type-pick .tp-dots i.on { background: var(--ui-mint); transform: scale(1.4); }
#type-pick .tp-stage { position: relative; flex: 1; min-height: 0; container-type: size; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
#type-pick .tp-stage.drag { cursor: grabbing; }
#type-pick .tp-arrow { position: absolute; top: 50%; z-index: 100; margin-top: calc(var(--ui-target) / -2); background: var(--ui-panel); }
#type-pick .tp-arrow[data-dir="-1"] { left: 0; }
#type-pick .tp-arrow[data-dir="1"] { right: 0; }
#type-pick .tp-arrow[data-dir="1"] .ui-icon { transform: scaleX(-1); }
#type-pick .tp-arrow[hidden] { display: none; }
/* a card is as tall as what it holds (never taller than the stage); the portrait is as big as the card leaves room for (a square) */
#type-pick .tp-card { --art: min(calc(var(--cw) - 32px), calc(100cqh - 247px)); position: absolute; left: 50%; top: 50%; width: var(--cw); max-height: calc(100cqh - 8px);
  box-sizing: border-box; display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-3);
  border: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); border-radius: var(--ui-radius-m); background: var(--ui-panel); will-change: transform;
  box-shadow: 0 10px 34px var(--ui-shade), inset 0 0 40px color-mix(in srgb, var(--accent) 12%, transparent); }
#type-pick .tp-card.centre { box-shadow: 0 14px 44px var(--ui-shade), 0 0 0 1px var(--accent), inset 0 0 40px color-mix(in srgb, var(--accent) 18%, transparent); }
#type-pick .tp-card.locked { filter: grayscale(.9) brightness(.8); }
#type-pick .tp-card h3 { margin: 0; text-align: center; color: var(--accent); }
#type-pick .tp-body { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-between; gap: var(--ui-space-3); }
/* Play squeezes just before the run starts (confirm()); the start waits --pick-squeeze for it */
#type-pick .tp-play.tp-squeeze { animation: tp-squeeze calc(var(--pick-squeeze) * 1s) var(--ui-ease-settle) both; }
@keyframes tp-squeeze { to { transform: scale(.94, .88); } }
#type-pick .tp-art { position: relative; flex: none; width: var(--art); height: var(--art); align-self: center; border-radius: var(--ui-radius-m); overflow: hidden;
  border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); background: var(--ui-deep); }
#type-pick .tp-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
#type-pick .tp-art img[hidden] { display: none; }
#type-pick .tp-art .tp-lock { position: absolute; inset: auto 0 0; z-index: 1; padding: var(--ui-space-1) var(--ui-space-2); background: var(--ui-scrim); text-align: center; font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); }
#type-pick .tp-art canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#type-pick .tp-art canvas[hidden] { display: none; }
#type-pick .tp-art .tp-aura { mix-blend-mode: screen; }
#type-pick .tp-art .tp-aura.lit { mix-blend-mode: normal; }   /* a shader kind's whole picture (pick-auras/painter.js) */
#type-pick .tp-bars { display: grid; gap: var(--ui-space-2); }
#type-pick .tp-bar { display: grid; grid-template-columns: 92px 1fr; align-items: center; gap: var(--ui-space-2); font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); color: var(--ui-ink-dim); white-space: nowrap; }
#type-pick .tp-track { display: grid; grid-template-columns: repeat(${BAR_SEGMENTS}, 1fr); gap: 2px; height: 14px; }
#type-pick .tp-seg { border-radius: 3px; background: var(--ui-glass-strong); }
#type-pick .tp-seg.on { background: var(--ui-mint); }
#type-pick .tp-panel { flex: none; width: min(520px, 100%); margin: var(--ui-space-3) auto 0; text-align: center; }
#type-pick .tp-diff { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-2); margin: 0 0 var(--ui-space-2); padding: 0; list-style: none; }
#type-pick .tp-diff:empty { display: none; }
#type-pick .tp-about { margin: 0 0 var(--ui-space-3); }
#type-pick .tp-play { display: flex; width: 100%; }
#type-pick .tp-goal { display: flex; align-items: center; justify-content: center; min-height: var(--ui-target); margin: 0; padding: 0 var(--ui-space-3); border: 1px dashed var(--ui-line); border-radius: var(--ui-radius-pill); color: var(--ui-ink-dim); font-weight: 600; }
#type-pick .tp-play[hidden], #type-pick .tp-goal[hidden], #type-pick .tp-back[hidden] { display: none; }
/* a phone held sideways: a card's portrait sits beside its bars, and Play beside the words, to fit the height */
@media (max-height: 520px) {
  #type-pick { --cw: 420px; padding-top: var(--ui-space-2); padding-bottom: var(--ui-space-2); }
  #type-pick header { margin-bottom: 0; }
  #type-pick h2 { font-size: var(--ui-size-heading); }
  #type-pick .tp-card { --art: min(calc(100cqh - 74px), 190px); gap: var(--ui-space-1); padding: var(--ui-space-2) var(--ui-space-3); }
  #type-pick .tp-card h3 { font-size: var(--ui-size-heading); }
  #type-pick .tp-body { flex-direction: row; align-items: center; justify-content: flex-start; }
  #type-pick .tp-bars { flex: 1; gap: 6px; }
  #type-pick .tp-panel { width: min(640px, 100%); margin-top: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); display: grid; grid-template-columns: 1fr 160px; align-items: center; gap: var(--ui-space-1) var(--ui-space-4); text-align: left; }
  #type-pick .tp-diff { justify-content: flex-start; margin: 0; grid-column: 1; }
  #type-pick .tp-about { margin: 0; grid-column: 1; }
  #type-pick .tp-play, #type-pick .tp-goal { grid-column: 2; grid-row: 1 / span 2; }
}
`;
export class TypePicker {
  // calm: Reduce effects is on. look(): the player's jelly look, so the portraits are redrawn when it changes.
  // portrait(id, turn): a data URL of the player's jelly as that type, turned `turn` radians (jelly-portrait.js), or null.
  // live: the centre card's moving picture (attack-preview.js AttackPreview), or null for still portraits only.
  // painter (set after): draws the side cards' shader kinds (pick-auras/painter.js); without one every kind is 2D.
  constructor({ calm = () => false, look = () => null, portrait = () => null, live = null } = {}) {
    Object.assign(this, { calm, look, portrait, live });
    this.liveFor = null;   // the type the live picture is showing
    this.lookKey = null;
    this.ids = Object.keys(CONTENT.jellies);
    this.frames = Object.fromEntries(this.ids.map((id) => [id, Array(VIEWS).fill(null)]));
    this.pos = 0; this.target = 0; this.vel = 0; this.index = 0;
    this.queue = []; this.spin = 0; this.drag = null; this.wheel = 0; this.wheelAt = 0;
    this.onPlay = null; this.onBack = null; this.raf = 0; this.last = 0;
    this.painter = null;
    this.auraT = 0; this.auraAt = -1;   // the elements' clock, and when they were last drawn (-1: draw them now)
  }

  mount(parent) {
    const root = this.root = document.createElement('div');
    root.id = 'type-pick';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Choose your jelly');
    root.innerHTML = `<style>${CSS}</style>
      <header class="ui-header"><div class="tp-headline"><button type="button" class="ui-btn ui-btn--icon tp-back" aria-label="Back">${icon('back')}</button><h2 class="ui-title">Choose your jelly</h2></div>
        <span class="tp-dots" aria-hidden="true">${this.ids.map(() => '<i></i>').join('')}</span></header>
      <div class="tp-stage">${this.ids.map((id) => this.card(id)).join('')}
        <button type="button" class="ui-btn ui-btn--icon tp-arrow" data-dir="-1" aria-label="Previous jelly">${icon('back')}</button>
        <button type="button" class="ui-btn ui-btn--icon tp-arrow" data-dir="1" aria-label="Next jelly">${icon('back')}</button>
      </div>
      <section class="tp-panel ui-panel" aria-live="polite">
        <ul class="tp-diff"></ul>
        <p class="tp-about ui-text"></p>
        <button type="button" class="ui-btn ui-btn--primary tp-play">Play</button>
        <p class="tp-goal" hidden></p>
      </section>`;
    parent.appendChild(root);
    this.stage = root.querySelector('.tp-stage');
    this.cards = [...root.querySelectorAll('.tp-card')];
    this.auras = this.cards.map((c) => c.querySelector('.tp-aura'));
    this.panel = { diff: root.querySelector('.tp-diff'), about: root.querySelector('.tp-about'), play: root.querySelector('.tp-play'), goal: root.querySelector('.tp-goal') };
    this.back = root.querySelector('.tp-back');
    this.dots = [...root.querySelectorAll('.tp-dots i')];
    this.arrows = [...root.querySelectorAll('.tp-arrow')];
    for (const a of this.arrows) {
      a.addEventListener('pointerdown', (e) => e.stopPropagation());   // not the start of a drag
      a.addEventListener('click', () => this.step(Number(a.dataset.dir)));
    }
    this.panel.play.addEventListener('click', () => this.confirm());
    this.back.addEventListener('click', () => this.leave());
    this.panel.play.addEventListener('animationend', () => this.panel.play.classList.remove('ui-pop'));
    this.stage.addEventListener('pointerdown', (e) => this.down(e));
    this.stage.addEventListener('pointermove', (e) => this.move(e));
    this.stage.addEventListener('pointerup', (e) => this.up(e));
    this.stage.addEventListener('pointercancel', (e) => this.up(e, true));
    root.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    addEventListener('keydown', (e) => this.onKey(e), true);
    addEventListener('resize', () => { if (this.isOpen) { this.measure(); this.place(); } });
  }

  card(id) {
    const J = CONTENT.jellies[id], bars = typeBars(id);
    return `<div class="tp-card" data-id="${id}" style="--accent:${esc(LOOK.color(`type-${id}`, '#8fd9ff'))}">
      <h3 class="ui-title">${esc(J.name)}</h3>
      <div class="tp-body">
        <div class="tp-art"><img alt="" hidden><img alt="" hidden><canvas class="tp-aura" data-aura="${esc(J.aura || '')}" aria-hidden="true"></canvas></div>
        <div class="tp-bars">${BAR_NAMES.map((n, i) => `<div class="tp-bar" role="meter" aria-label="${n}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(bars[i] * 100)}">${n}<span class="tp-track">${Array.from({ length: BAR_SEGMENTS }, (_, k) => `<i class="tp-seg${k < barSegments(bars[i]) ? ' on' : ''}"></i>`).join('')}</span></div>`).join('')}</div>
      </div>
    </div>`;
  }

  get isOpen() { return !!this.root && !this.root.hidden; }
  get centre() { return this.ids[this.index]; }
  get animated() { return !!this.live && !this.calm(); }

  stopLive() { this.live?.hide(); this.liveFor = null; }

  // Show the row with `start` in the centre. onPlay(id) when a type is chosen; onBack() if there is somewhere to go back to.
  open({ start = 'normal', onPlay, onBack = null }) {
    this.onPlay = onPlay; this.onBack = onBack;
    // locks are read again each time: they change between runs
    this.root.querySelectorAll('.tp-lock').forEach((l) => l.remove());
    this.cards.forEach((c, i) => {
      c.classList.toggle('locked', !!typeLock(this.ids[i]));
      const lock = typeLock(this.ids[i]);   // the card says how to open it, in one short line ("Finish act 1")
      if (lock) c.querySelector('.tp-art').insertAdjacentHTML('beforeend', `<span class="tp-lock">${icon('lock', 'Locked')} ${esc(lock.goal)}</span>`);
    });
    // the player may have changed their look since the last time: draw every portrait again
    const lookKey = JSON.stringify(this.look());
    if (lookKey !== this.lookKey) {
      this.lookKey = lookKey;
      for (const id of this.ids) this.frames[id].fill(null);
      this.root.querySelectorAll('.tp-art img').forEach((img) => { img.hidden = true; delete img.dataset.v; });
    }
    this.root.hidden = false;
    this.back.hidden = !onBack;
    this.index = Math.max(0, this.ids.indexOf(start));
    this.pos = this.target = this.index;
    this.spin = 0;
    this.vel = 0;
    this.measure();   // (draws the elements again: the size or Reduce motion may have changed)
    this.setCentre(this.index, true);
    this.place();
    this.queue = [];
    this.want(this.index, true);
    for (const id of this.ids) this.want(this.ids.indexOf(id), false);
    if (matchMedia('(pointer: fine)').matches) this.panel.play.focus({ preventScroll: true });   // a keyboard's Enter plays; a touch screen shows no focus ring
    this.last = performance.now();
    this.raf ||= requestAnimationFrame((t) => this.tick(t));
  }

  close() {
    this.root.hidden = true;
    this.confirming = false;
    this.panel.play.classList.remove('tp-squeeze');
    this.stopLive();
    this.live?.release();   // its pictures on the GPU
    this.painter?.release();   // the side cards' pictures on the GPU
    this.drag = null;
    this.stage.classList.remove('drag');
  }

  // The Play button / Enter: the button squeezes for --pick-squeeze, then the run starts (at once with Reduce effects)
  confirm() {
    if (this.confirming || !this.isOpen || typeLock(this.centre)) return;
    if (this.calm()) { this.play(); return; }
    this.confirming = true;
    this.panel.play.classList.add('tp-squeeze');
    // (the row can move during the squeeze: on a locked card nothing starts and Play is pressable again)
    setTimeout(() => { if (!this.confirming) return; this.confirming = false; if (!this.play()) this.panel.play.classList.remove('tp-squeeze'); }, LOOK.num('pick-squeeze', 0.08) * 1000);
  }

  // Play: start a run as the centre type. A locked type can't be played.
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

  // bring card i to the centre (the row settles on it)
  go(i) {
    i = Math.max(0, Math.min(this.ids.length - 1, Math.round(i)));
    this.target = i;
    if (this.calm()) this.pos = i;
    this.setCentre(i);
    this.kick();
  }

  step(by) { this.go(this.index + by); }

  // --- the centre card and its panel ---------------------------------------------------------
  setCentre(i, quiet = false) {
    if (i === this.index && !quiet) return;
    if (i !== this.index) { this.showView(this.index, 0, 0); this.spin = 0; sfx.tap(); this.stopLive(); }
    this.index = i;
    const id = this.ids[i], J = CONTENT.jellies[id], lock = typeLock(id), P = this.panel;
    this.cards.forEach((c, k) => c.classList.toggle('centre', k === i));
    P.diff.innerHTML = typeDetails(id).map((t) => `<li class="ui-chip">${esc(t)}</li>`).join('');
    this.dots.forEach((d, k) => d.classList.toggle('on', k === i));
    this.arrows[0].hidden = i === 0;
    this.arrows[1].hidden = i === this.ids.length - 1;
    P.about.textContent = J.about;
    P.play.hidden = !!lock;
    P.goal.hidden = !lock;
    P.goal.textContent = !lock ? '' : lock.need > 1 ? `${lock.goal}: ${lock.have}/${lock.need}` : lock.goal;   // "Defeat 6 Elites: 4/6", "Finish act 2"
    this.want(i, true);
  }

  // --- where the cards sit ---------------------------------------------------------------------
  measure() {
    this.cardW = this.cards[0].offsetWidth || 280;
    // card spacing and a neighbour's size: --pick-step and --pick-side-scale, unless the row is too narrow
    // for the next card to fit (a phone on its side); then the next card shrinks a little and sits just
    // clear of the centre card, so its name shows whole inside the screen
    const step = LOOK.num('pick-step', 0.96), side = LOOK.num('pick-side-scale', 0.78), half = (this.stage.clientWidth || innerWidth) / 2;
    const fits = this.cardW * (step + side / 2) <= half;
    this.side = fits ? side : Math.min(side, 0.7);
    this.spacing = fits ? this.cardW * step : this.cardW * (1 + this.side) / 2 + 8;
    // the elements' canvases at the screen's sharpness (at most 2x: they're soft anyway)
    const px = Math.round((this.auras[0].clientWidth || 160) * Math.min(2, devicePixelRatio || 1));
    for (const c of this.auras) if (c.width !== px) c.width = c.height = px;
    this.auraAt = -1;
  }

  // --- the elements round the jellies: drawn at --pick-aura-fps, the cards in view only ----------
  // (the live picture covers the centre card's once it shows; Reduce motion draws them once, still)
  drawAuras(dt) {
    const calm = this.calm();
    this.auraT += calm ? 0 : dt;
    if (this.auraAt >= 0 && (calm || this.auraT - this.auraAt < 1 / LOOK.num('pick-aura-fps', 30))) return;
    this.auraAt = this.auraT;
    const t = calm ? 0.6 : this.auraT, strength = LOOK.num('pick-aura-strength', 1);
    const covered = this.liveFor && this.live?.canvas && !this.live.canvas.hidden ? this.index : -1;
    this.auras.forEach((c, i) => {
      if (Math.abs(i - this.pos) > 2.6 || i === covered) return;
      const kind = c.dataset.aura, colour = LOOK.color(`type-${this.ids[i]}`, '#8fd9ff');
      if (!this.painter?.has(kind)) { drawAura(c, kind, t + i * 0.37, colour, strength); return; }
      // a shader kind paints the whole picture, the jelly relit in it; until it can (its shader
      // building, a lost graphics chip) the card shows its still portrait. It waits for that portrait:
      // the jelly's own shaders are built by then, so its first picture never stalls the screen
      let lit = false;
      try { lit = !!this.frames[this.ids[i]][0] && this.painter.draw(c, kind, this.look(), t + i * 0.37, colour, strength); } catch (e) { console.warn('pick aura', e); }
      if (!lit) { c.getContext('2d').clearRect(0, 0, c.width, c.height); if (calm && this.frames[this.ids[i]][0] !== '') this.auraAt = -1; }   // (Reduce effects: its one frozen frame as soon as its portrait and shader are ready, the frame loop going till then; never if its portrait failed)
      c.classList.toggle('lit', lit);
    });
  }

  place() {
    this.placed = this.pos;
    const step = this.spacing, side = this.side;
    this.cards.forEach((c, i) => {
      const d = i - this.pos, a = Math.abs(d);
      const s = Math.max(0.5, 1 - (1 - side) * Math.min(a, 1) - 0.18 * Math.max(0, Math.min(a, 2) - 1));
      c.style.transform = `translate(-50%, -50%) translateX(${(d * step).toFixed(1)}px) scale(${s.toFixed(3)})`;
      c.style.opacity = Math.max(0.55, 1 - 0.2 * Math.min(a, 2)).toFixed(2);
      c.style.zIndex = String(100 - Math.round(a * 10));
      c.style.visibility = a > 3.2 ? 'hidden' : 'visible';
    });
  }

  // --- portraits: eight views of each jelly, drawn one a frame when the row is still -------------
  want(i, first) {
    const id = this.ids[i], at = first ? 0 : this.queue.length;
    const views = first && !this.animated ? [...Array(VIEWS).keys()] : [0];   // the turning views: only for a still centre card
    const add = views.filter((v) => !this.frames[id][v] && !this.queue.some(([a, b]) => a === id && b === v)).map((v) => [id, v]);
    this.queue.splice(at, 0, ...add);
    if (this.isOpen) this.raf ||= requestAnimationFrame((t) => this.tick(t));
  }

  draw() {
    const [id, v] = this.queue.shift();
    if (this.frames[id][v]) return;
    this.frames[id][v] = this.portrait(id, (v * 2 * Math.PI) / VIEWS) || '';
    if (v === 0) {
      const imgs = this.cards[this.ids.indexOf(id)].querySelectorAll('img');
      if (this.frames[id][0]) { imgs[0].src = imgs[1].src = this.frames[id][0]; imgs[0].hidden = false; imgs[1].hidden = false; imgs[1].style.opacity = 0; }
    }
  }

  showView(i, view, mix) {
    const f = this.frames[this.ids[i]], imgs = this.cards[i].querySelectorAll('img');
    if (!f[view]) return;
    const next = f[(view + 1) % VIEWS] || f[view];
    if (imgs[0].dataset.v !== String(view)) { imgs[0].src = f[view]; imgs[1].src = next; imgs[0].dataset.v = String(view); }
    imgs[1].style.opacity = mix;
  }

  // --- the frame loop: runs only while the screen is open ------------------------------------
  kick() { this.raf ||= requestAnimationFrame((t) => this.tick(t)); }

  tick(now) {
    this.raf = 0;
    if (!this.isOpen) return;
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000 || 0.016));   // (never back in time: stories tick it by hand between real frames)
    this.last = now;
    let moving = !!this.drag;
    if (!this.drag) {
      // the row settles on a card like a spring: it lands a touch past it and comes back
      const gap = this.target - this.pos;
      if ((Math.abs(gap) > 0.002 || Math.abs(this.vel) > 0.02) && !this.calm()) {
        const w = LOOK.num('pick-snap', 14), zeta = LOOK.num('pick-bounce', 0.7);
        for (let left = dt; left > 0; left -= 1 / 60) {   // small steps keep the spring steady on a slow frame
          const h = Math.min(left, 1 / 60);
          this.vel += (w * w * (this.target - this.pos) - 2 * zeta * w * this.vel) * h;
          this.pos += this.vel * h;
        }
        moving = true;
      } else if (gap || this.vel) { this.pos = this.target; this.vel = 0; }
    }
    if (this.pos !== this.placed) { this.place(); this.auraAt = -1; }   // a card coming into view gets its element at once
    this.drawAuras(dt);
    // pictures are drawn only while the row is still: a draw can take a few milliseconds
    if (!moving && this.queue.length) this.draw();
    // the row has settled: the centre card comes alive (its still portrait stays under it, and stays
    // if the live picture can't be drawn)
    if (!moving && this.animated && this.liveFor !== this.centre) {
      this.liveFor = this.centre;
      this.live.show(this.centre, this.look(), this.cards[this.index].querySelector('.tp-art'));
    }
    const live = !!this.liveFor && this.live.step(dt);
    // a still centre jelly turns slowly, once all eight views are drawn
    const f = this.frames[this.ids[this.index]], turning = !live && !this.calm() && f.every(Boolean);
    if (turning) {
      this.spin += dt / LOOK.num('pick-spin-step', 1.4);
      this.showView(this.index, Math.floor(this.spin) % VIEWS, this.spin % 1);
    }
    if (moving || turning || live || this.queue.length || !this.calm() || this.auraAt < 0) this.kick();   // the elements keep moving (or one is still to be drawn)
  }

  // --- moving the row --------------------------------------------------------------------------
  down(e) {
    if (e.button) return;
    this.vel = 0;
    this.drag = { id: e.pointerId, x: e.clientX, pos: this.pos, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  }

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 8) return;
    if (!d.moved) { d.moved = true; this.stage.setPointerCapture?.(e.pointerId); this.stage.classList.add('drag'); }
    const step = this.spacing;
    this.pos = this.target = Math.max(0, Math.min(this.ids.length - 1, d.pos - dx / step));
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = 0.6 * d.v + 0.4 * ((d.lastX - e.clientX) / step / (dt / 1000));   // cards a second, smoothed
    d.lastX = e.clientX; d.lastT = e.timeStamp;
    const near = Math.round(this.pos);
    if (near !== this.index) this.setCentre(near);
    this.place();
  }

  up(e, cancelled = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.stage.classList.remove('drag');
    if (d.moved) this.go(this.pos + Math.max(-1.2, Math.min(1.2, d.v)) * 0.18);   // a flick carries a little further
    else if (!cancelled) {
      const card = e.target.closest?.('.tp-card');
      if (card) this.go(this.cards.indexOf(card));   // tapping a neighbour brings it to the centre
    }
    this.kick();
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
    else if (e.code === 'Escape') this.leave();
    else if (e.code === 'Enter' && !e.target.closest?.('button')) this.confirm();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
