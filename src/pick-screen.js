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
import { drawAura } from './pick-aura.js';
import { BAR_NAMES, BAR_SEGMENTS, barSegments, typeBars, typeDetails, typeLock } from './jelly-types.js';

const VIEWS = 8;   // views of the jelly that make one full turn: the portrait fades from one to the next

const CSS = `
#type-pick { position: fixed; inset: 0; z-index: 15; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: none;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  background: radial-gradient(120% 90% at 50% 0%, var(--menu-water-shallow, #175c70) 0%, var(--menu-water-deep, #06162e) 62%, #030d1c 100%);
  color: var(--menu-paper, #fff6dc); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; --cw: clamp(230px, 24vw, 300px); --art: clamp(110px, 25vh, 210px); }
#type-pick[hidden] { display: none; }
#type-pick header { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px 0; }
#type-pick h2 { margin: 0; font: 800 22px Georgia, serif; letter-spacing: -.02em; }
#type-pick .tp-back { min-height: 44px; padding: 8px 16px; border: 1px solid #ffffff30; border-radius: 13px; background: #ffffff0b; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
#type-pick .tp-back:hover { background: #ffffff20; }
#type-pick .tp-stage { position: relative; flex: 1; min-height: 0; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
#type-pick .tp-stage.drag { cursor: grabbing; }
#type-pick .tp-card { position: absolute; left: 50%; top: 50%; width: var(--cw); box-sizing: border-box; padding: 12px 14px 14px;
  border: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); border-radius: 26px; background: #0a2036ee; will-change: transform;
  box-shadow: 0 10px 34px #0006, inset 0 0 40px color-mix(in srgb, var(--accent) 12%, transparent); }
#type-pick .tp-card.centre { box-shadow: 0 14px 44px #0008, 0 0 0 1px var(--accent), inset 0 0 40px color-mix(in srgb, var(--accent) 18%, transparent); }
#type-pick .tp-card.locked { filter: grayscale(.9) brightness(.7); }
#type-pick .tp-card h3 { margin: 0 0 8px; text-align: center; font: 700 17px Georgia, serif; color: var(--accent); }
#type-pick .tp-art { position: relative; width: var(--art); height: var(--art); margin: 0 auto 10px; border-radius: 20px; overflow: hidden;
  border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); background: var(--menu-water-deep, #06162e); }
#type-pick .tp-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
#type-pick .tp-art img[hidden] { display: none; }
#type-pick .tp-art .tp-lock { position: absolute; right: 8px; top: 6px; font-size: 22px; z-index: 1; }
#type-pick .tp-art canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#type-pick .tp-art canvas[hidden] { display: none; }
#type-pick .tp-art .tp-aura { mix-blend-mode: screen; }
#type-pick .tp-bars { display: grid; gap: 5px; }
#type-pick .tp-bar { display: grid; grid-template-columns: 82px 1fr; align-items: center; gap: 8px; font-size: 12.5px; color: #dcd6c4; }
#type-pick .tp-track { display: grid; grid-template-columns: repeat(${BAR_SEGMENTS}, 1fr); gap: 2px; height: 10px; }
#type-pick .tp-seg { border-radius: 2px; background: #ffffff18; }
#type-pick .tp-seg.on { background: var(--accent); box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent); }
#type-pick .tp-panel { flex: none; width: var(--cw); min-width: 260px; margin: 0 auto 14px; box-sizing: border-box; padding: 12px 14px; border-radius: 20px;
  background: #0a2036ee; border: 1px solid #ffffff22; text-align: center; }
#type-pick .tp-diff { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 0 0 8px; padding: 0; list-style: none; }
#type-pick .tp-diff:empty { display: none; }
#type-pick .tp-diff li { padding: 3px 10px; border-radius: 999px; background: #ffffff14; font-size: 12.5px; }
#type-pick .tp-about { margin: 0 0 10px; font-size: 13.5px; }
#type-pick .tp-play { display: block; width: 100%; min-height: 48px; padding: 10px 24px; border: 1px solid #fff8; border-radius: 22px; cursor: pointer;
  font: 800 20px system-ui, sans-serif; color: var(--menu-ink, #101a23); background: var(--menu-gold, #ffd46c); box-shadow: 0 4px 0 #9d7435, 0 10px 24px #0004; transition: transform .12s, background .12s; }
#type-pick .tp-play:hover { background: var(--menu-paper, #fff6dc); transform: translateY(-2px); }
#type-pick .tp-play:active { transform: translateY(3px) scale(.96, .93); }
#type-pick .tp-play.menu-pop { animation: menu-pop .24s ease-out; }
#type-pick .tp-play[hidden], #type-pick .tp-goal[hidden], #type-pick .tp-back[hidden] { display: none; }
#type-pick .tp-goal { margin: 0; padding: 12px; border: 1px dashed #ffd46c88; border-radius: 16px; color: var(--menu-gold, #ffd46c); font-weight: 700; }
#type-pick button:focus-visible { outline: 2px solid var(--menu-mint, #a3f5d5); outline-offset: 4px; }
/* a phone held sideways: the card's bars sit beside its portrait, and Play beside the words, to fit the height */
@media (max-height: 520px) {
  #type-pick { --cw: 330px; --art: 112px; }
  #type-pick header { padding-top: 6px; }
  #type-pick h2 { font-size: 19px; }
  #type-pick .tp-back { min-height: 40px; padding: 4px 14px; }
  #type-pick .tp-card { padding: 8px 12px 10px; border-radius: 22px; }
  #type-pick .tp-card h3 { margin-bottom: 6px; font-size: 15px; }
  #type-pick .tp-body { display: flex; align-items: center; gap: 10px; }
  #type-pick .tp-art { margin: 0; flex: none; border-radius: 16px; }
  #type-pick .tp-bars { flex: 1; gap: 4px; }
  #type-pick .tp-bar { grid-template-columns: 82px 1fr; gap: 6px; font-size: 11.5px; white-space: nowrap; }
  #type-pick .tp-track { height: 8px; gap: 1.5px; }
  #type-pick .tp-panel { width: min(600px, calc(100vw - 32px)); margin-bottom: 8px; padding: 8px 12px; display: grid; grid-template-columns: 1fr 150px; align-items: center; gap: 4px 14px; text-align: left; }
  #type-pick .tp-diff { justify-content: flex-start; margin: 0; grid-column: 1; }
  #type-pick .tp-about { margin: 0; font-size: 12.5px; grid-column: 1; }
  #type-pick .tp-play, #type-pick .tp-goal { grid-column: 2; grid-row: 1 / span 2; min-height: 44px; font-size: 18px; }
  #type-pick .tp-goal { padding: 6px; font-size: 13px; text-align: center; }
}
@media (prefers-reduced-motion: reduce) { #type-pick .tp-play.menu-pop { animation: none; } }
`;

export class TypePicker {
  // calm: Reduce effects is on. look(): the player's jelly look, so the portraits are redrawn when it changes.
  // portrait(id, turn): a data URL of the player's jelly as that type, turned `turn` radians (jelly-portrait.js), or null.
  // live: the centre card's moving picture (attack-preview.js AttackPreview), or null for still portraits only.
  constructor({ calm = () => false, look = () => null, portrait = () => null, live = null } = {}) {
    Object.assign(this, { calm, look, portrait, live });
    this.liveFor = null;   // the type the live picture is showing
    this.lookKey = null;
    this.ids = Object.keys(CONTENT.jellies);
    this.frames = Object.fromEntries(this.ids.map((id) => [id, Array(VIEWS).fill(null)]));
    this.pos = 0; this.target = 0; this.index = 0;
    this.queue = []; this.spin = 0; this.drag = null; this.wheel = 0; this.wheelAt = 0;
    this.onPlay = null; this.onBack = null; this.raf = 0; this.last = 0;
    this.auraT = 0; this.auraAt = -1;   // the elements' clock, and when they were last drawn (-1: draw them now)
  }

  mount(parent) {
    const root = this.root = document.createElement('div');
    root.id = 'type-pick';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Choose your jelly');
    root.innerHTML = `<style>${CSS}</style>
      <header><button type="button" class="tp-back">‹ Back</button><h2>Choose your jelly</h2></header>
      <div class="tp-stage">${this.ids.map((id) => this.card(id)).join('')}</div>
      <section class="tp-panel" aria-live="polite">
        <ul class="tp-diff"></ul>
        <p class="tp-about"></p>
        <button type="button" class="tp-play">Play</button>
        <p class="tp-goal" hidden></p>
      </section>`;
    parent.appendChild(root);
    this.stage = root.querySelector('.tp-stage');
    this.cards = [...root.querySelectorAll('.tp-card')];
    this.auras = this.cards.map((c) => c.querySelector('.tp-aura'));
    this.panel = { diff: root.querySelector('.tp-diff'), about: root.querySelector('.tp-about'), play: root.querySelector('.tp-play'), goal: root.querySelector('.tp-goal') };
    this.back = root.querySelector('.tp-back');
    this.panel.play.addEventListener('click', () => this.play());
    this.back.addEventListener('click', () => this.leave());
    this.panel.play.addEventListener('animationend', () => this.panel.play.classList.remove('menu-pop'));
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
      <h3>${esc(J.name)}</h3>
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
      if (typeLock(this.ids[i])) c.querySelector('.tp-art').insertAdjacentHTML('beforeend', '<span class="tp-lock" aria-label="Locked">🔒</span>');
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
    this.stopLive();
    this.drag = null;
    this.stage.classList.remove('drag');
  }

  // Play: start a run as the centre type. A locked type can't be played.
  play() {
    const id = this.centre;
    if (!this.isOpen || typeLock(id)) return false;
    sfx.tap();
    if (!this.calm()) { this.panel.play.classList.remove('menu-pop'); void this.panel.play.offsetWidth; this.panel.play.classList.add('menu-pop'); }
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
    P.diff.innerHTML = typeDetails(id).map((t) => `<li>${esc(t)}</li>`).join('');
    P.about.textContent = J.about;
    P.play.hidden = !!lock;
    P.goal.hidden = !lock;
    P.goal.textContent = !lock ? '' : lock.need > 1 ? `${lock.goal}: ${lock.have}/${lock.need}` : lock.goal;   // "Defeat 6 Elites: 4/6", "Finish act 2"
    this.want(i, true);
  }

  // --- where the cards sit ---------------------------------------------------------------------
  measure() {
    this.cardW = this.cards[0].offsetWidth || 280;
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
      drawAura(c, c.dataset.aura, t + i * 0.37, LOOK.color(`type-${this.ids[i]}`, '#8fd9ff'), strength);
    });
  }

  place() {
    this.placed = this.pos;
    const step = this.cardW * LOOK.num('pick-step', 0.96), side = LOOK.num('pick-side-scale', 0.78);
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
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0.016);
    this.last = now;
    let moving = !!this.drag;
    if (!this.drag) {
      const gap = this.target - this.pos;
      if (Math.abs(gap) > 0.002 && !this.calm()) { this.pos += gap * (1 - Math.exp(-dt * LOOK.num('pick-snap', 14))); moving = true; }
      else if (gap) this.pos = this.target;
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
    if (moving || turning || live || this.queue.length || !this.calm()) this.kick();   // the elements keep moving
  }

  // --- moving the row --------------------------------------------------------------------------
  down(e) {
    if (e.button) return;
    this.drag = { id: e.pointerId, x: e.clientX, pos: this.pos, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  }

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 8) return;
    if (!d.moved) { d.moved = true; this.stage.setPointerCapture?.(e.pointerId); this.stage.classList.add('drag'); }
    const step = this.cardW * LOOK.num('pick-step', 0.96);
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
    else if (e.code === 'Enter' && !e.target.closest?.('button')) this.play();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
