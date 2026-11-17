// On-screen HUD: health, level and XP, the boss countdown and night clock, treasures,
// minimap of the real floor plan, boss bar, hints, toasts.
import { bus } from './events.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { icon } from './icons.js';

// Colours, type and spacing are the UI kit's (--ui-* in content/look.css, src/ui-kit.css: .ui-bar, .ui-toast).
// Text over the floor wears --hud-outline, so it reads on wood, tile and rug alike.
const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font: 600 var(--ui-size-body)/1.3 var(--ui-font-text); color: var(--ui-ink);
  --hud-outline: 0 0 2px var(--ui-deep), 0 0 2px var(--ui-deep), 0 1px 3px var(--ui-deep); }
#hud .combo { position: absolute; right: calc(env(safe-area-inset-right, 0px) + 18px); top: 38%; text-align: right; color: hsl(var(--hue, 50) 100% 62%); text-shadow: var(--hud-outline); pointer-events: none; }
#hud .combo[hidden] { display: none; }
#hud .combo b { display: block; font: 600 44px/1 var(--ui-font-display); transform-origin: right center; }
#hud .combo span { font: 700 var(--ui-size-label) var(--ui-font-text); }
#hud .combo i { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: currentColor; transform-origin: right; }
#hud .combo.punch b { animation: jf-punch .22s ease-out; }
@keyframes jf-punch { 0% { transform: scale(1.6) rotate(-6deg); } 100% { transform: scale(1) rotate(0); } }
body.touch #hud .combo { top: 30%; right: calc(env(safe-area-inset-right, 0px) + 12px); } body.touch #hud .combo b { font-size: 34px; }

/* vitals: the level ring, the Health bar with its number (and the Shield's bar after it), a thin XP bar under it */
#hud .tl { position: absolute; left: calc(env(safe-area-inset-left, 0px) + 18px); top: calc(env(safe-area-inset-top, 0px) + 16px); display: grid; grid-template-columns: auto 1fr; gap: 0 12px; align-items: center; width: 340px; }
#hud .lvl { grid-row: span 2; box-sizing: border-box; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font: 600 22px/1 var(--ui-font-display);
  background: var(--ui-panel); border: 3px solid var(--ui-xp); box-shadow: 0 2px 8px var(--ui-shade); color: var(--ui-ink); font-variant-numeric: tabular-nums; }
/* the bars are the kit's .ui-bar (track, outline and --fill colour by data-kind); the HUD sets their sizes */
#hud .bar { height: 20px; box-shadow: 0 2px 8px var(--ui-shade); }
#hud .bar > i { transition: transform var(--ui-fast) ease-out; }
#hud .moist.low { --fill: var(--hp-critical-color); }
#hud .player-health { position: relative; min-width: 0; transform-origin: center; }
#hud .player-health .hp-fill { transition: transform .18s ease-out; }
#hud .player-health .hp-trail { position: absolute; inset: 0; background: var(--hp-trail-color); transform-origin: left; transition: transform var(--hp-drain) ease-out; }
#hud .player-health .hp-edge { position: absolute; top: 50%; width: 10px; height: 110%; border-radius: 50%; background: var(--ui-ink); opacity: .45; transform: translate(-50%, -50%); transition: left .18s ease-out; pointer-events: none; }
#hud .player-health .hp-warning { display: none; position: absolute; left: 7px; top: 50%; transform: translateY(-50%); font: 800 var(--ui-size-label)/1 var(--ui-font-text); text-shadow: var(--hud-outline); }
#hud .player-health .low .hp-warning { display: block; }
#hud .player-health .low { animation: jf-hp-breathe var(--hp-breathe) ease-in-out infinite; }
#hud .hp-delta { position: absolute; right: -40px; top: 0; width: 36px; font: 800 var(--ui-size-body)/20px var(--ui-font-text); font-variant-numeric: tabular-nums; text-shadow: var(--hud-outline); color: var(--hp-trail-color); }
#hud .hp-delta.heal { color: var(--hp-heal-color); }
#hud .hp-delta[hidden] { display: none; }
@keyframes jf-hp-breathe { 0%, 100% { box-shadow: 0 0 0 2px var(--hp-critical-color), 0 2px 8px var(--ui-shade); } 50% { box-shadow: 0 0 0 2px var(--hp-critical-color), 0 0 12px var(--hp-critical-color); } }
body.calm #hud .player-health, body.calm #hud .hp-delta, body.calm #hud .hp-edge { transform: none !important; filter: none !important; }
body.calm #hud .hp-edge { transform: translate(-50%, -50%) !important; }
body.calm #hud .player-health .moist { box-shadow: 0 2px 8px var(--ui-shade) !important; }
body.calm #hud .player-health .low { animation: none; box-shadow: 0 0 0 2px var(--hp-critical-color) !important; }
@media (prefers-reduced-motion: reduce) {
  #hud .player-health, #hud .hp-delta { transform: none !important; filter: none !important; }
  #hud .player-health .hp-edge { transform: translate(-50%, -50%) !important; }
  #hud .player-health .moist { box-shadow: 0 2px 8px var(--ui-shade) !important; }
  #hud .player-health .low { animation: none; box-shadow: 0 0 0 2px var(--hp-critical-color) !important; }
}
#hud .hpn { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font: 700 var(--ui-size-label)/1 var(--ui-font-text); font-variant-numeric: tabular-nums; text-shadow: var(--hud-outline); }
/* the Shield: its own bar right after Health's, a little longer for every point of Shield (setShield) */
#hud .vit { position: relative; display: flex; gap: 3px; min-width: 0; }
#hud .vit .player-health { flex: 1; }
#hud .shield-bar { flex: none; max-width: 45%; }
#hud .shield-bar[hidden] { display: none; }
#hud .shield-bar > i { transition: transform .12s linear; }
#hud .shield-bar.charging > i { background: linear-gradient(90deg, var(--ui-shield) 30%, var(--ui-ink) 50%, var(--ui-shield) 70%) 0 0 / 200% 100%; animation: jf-shield-charge .7s linear infinite; }
@keyframes jf-shield-charge { to { background-position: -200% 0; } }
#hud .shn { position: absolute; inset: 0; display: grid; place-items: center; font: 800 var(--ui-size-label)/1 var(--ui-font-text); color: var(--ui-deep); }
#hud .shield-bar.empty .shn { color: var(--ui-ink); text-shadow: var(--hud-outline); }
@media (prefers-reduced-motion: reduce) { #hud .shield-bar.charging > i { animation: none; } }
body.calm #hud .shield-bar.charging > i { animation: none; }
#hud .xp { height: 10px; margin-top: 6px; }
/* Treasures taken: a glass tile each, with how many in a badge on its corner */
#hud .items { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
#hud .items span { position: relative; box-sizing: border-box; width: 34px; height: 34px; display: grid; place-items: center; font-size: 22px;
  background: var(--ui-panel); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-s); }
#hud .items span b { font-weight: 400; transition: filter .15s; }
#hud .items sub { position: absolute; right: -5px; bottom: -5px; z-index: 1; box-sizing: border-box; min-width: 18px; padding: 0 4px; border-radius: var(--ui-radius-pill);
  background: var(--ui-deep); border: 1px solid var(--ui-line); font: 700 var(--ui-size-label)/15px var(--ui-font-text); font-variant-numeric: tabular-nums; text-align: center; color: var(--ui-ink); }
/* a timed treasure: a clock face over it. The dark wedge is the wait still to go, sweeping away
   clockwise from 12; while it waits the icon is greyed, and it lights up when it's ready or going off */
#hud .items span.timed::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: conic-gradient(var(--ui-scrim) calc(var(--cd, 0) * 1turn), transparent 0); }
#hud .items span.timed.wait b { filter: grayscale(1) brightness(.8); }
#hud .items span.timed:not(.wait) { border-color: var(--ui-mint); box-shadow: 0 0 10px var(--ui-mint); }
#hud .items span.timed.spent b { filter: grayscale(1) brightness(.5); }
#hud .items span.timed.spent { border-color: var(--ui-line); box-shadow: none; }
#hud .items span.pop { animation: jf-pop .35s ease-out; }
@keyframes jf-pop { 0% { transform: scale(1.3); box-shadow: 0 0 0 3px var(--ui-ink), 0 0 16px var(--ui-mint); } 100% { transform: scale(1); } }
@keyframes jf-glow { 0% { box-shadow: 0 0 0 3px var(--ui-ink), 0 0 16px var(--ui-mint); } }
/* top centre: how long until the boss, and the night's time and boss under it */
#hud .tc { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 12px); transform: translateX(-50%); text-align: center; white-space: nowrap; text-shadow: var(--hud-outline); }
#hud .clock { font: 700 24px/1 var(--ui-font-text); font-variant-numeric: tabular-nums; }
#hud .clock.dry { color: var(--ui-boss); }   /* the boss is almost here */
#hud .stage { margin-top: 4px; font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); letter-spacing: .03em; color: var(--ui-ink-dim); }
/* a boss's or an Elite's name and Health (hot, like everything hostile), under the clock */
#hud .boss { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 116px); transform: translateX(-50%); width: min(460px, 70vw); text-align: center; }
#hud .boss .bar { height: 14px; }
#hud .boss.shield .bar { --fill: var(--ui-epic); border-color: var(--ui-epic); }   /* shielded (the Vacuum's lanternflies): nothing gets through */
#hud .elite { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 66px); transform: translateX(-50%); width: min(320px, 56vw); text-align: center; }
#hud .elite .bar { height: 12px; }
#hud :is(.boss, .elite) .nm { margin-bottom: 4px; font: 700 var(--ui-size-label)/1.2 var(--ui-font-text); letter-spacing: .1em; text-shadow: var(--hud-outline); }
#hud .map { position: absolute; right: calc(env(safe-area-inset-right, 0px) + 18px); bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); width: 285px; height: 285px; }
#hud .hint { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 60px); transform: translateX(-50%); padding: 6px 14px; border: 1px solid var(--ui-line); border-radius: var(--ui-radius-pill);
  background: var(--ui-panel); box-shadow: 0 4px 16px var(--ui-shade); opacity: 0; transition: opacity .2s; }
#hud .hint.on { opacity: 1; }
#hud kbd { background: var(--ui-glass-strong); border: 1px solid var(--ui-line); border-radius: 4px; padding: 0 5px; font: inherit; }
/* a note in the middle of the screen: the kit's .ui-toast, on one line */
#hud .toast { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); display: block; max-width: 92vw; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font: 600 var(--ui-size-heading)/1.3 var(--ui-font-text); opacity: 0; transition: opacity .3s; }
#hud .toast.on { opacity: 1; }
/* a boss cleared: the toast stamps in, big and gold (toast(text, ms, 'stamp')) */
#hud .toast.stamp { top: 28%; overflow: visible; font: 600 40px/1.1 var(--ui-font-display); color: var(--ui-gold); background: none; border-color: transparent; box-shadow: none;
  text-shadow: 0 3px 0 var(--ui-gold-deep), var(--hud-outline), 0 6px 22px var(--ui-deep); }
#hud .toast.stamp.on { animation: jf-stamp .42s cubic-bezier(.2, 1.5, .4, 1); }
@keyframes jf-stamp { 0% { transform: translateX(-50%) scale(2.2) rotate(-4deg); opacity: 0; } 55% { opacity: 1; } 100% { transform: translateX(-50%) scale(1) rotate(0); } }
/* a level-up: the ring pops and a gold ring leaves the jelly (levelDing) before the cards deal */
#hud .lvl.ding { animation: jf-ding .5s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes jf-ding { 0% { transform: scale(1.9); box-shadow: 0 0 30px var(--ui-xp); } 100% { transform: scale(1); } }
.jf-ding-ring { position: fixed; z-index: 31; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; border: 4px solid var(--ui-xp); box-shadow: 0 0 24px var(--ui-xp), inset 0 0 18px var(--ui-xp);
  pointer-events: none; animation: jf-ring .5s ease-out forwards; }
@keyframes jf-ring { from { transform: scale(.25); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
/* reduced motion: nothing scales or turns; the toast fades (its transition), a Treasure going off and the combo glow instead */
body.calm #hud .toast.stamp.on, body.calm #hud .lvl.ding { animation: none; }
body.calm #hud .items span.pop { animation-name: jf-glow; } body.calm #hud .combo.punch b { animation: none; }
@media (prefers-reduced-motion: reduce) {
  #hud .toast.stamp.on, #hud .lvl.ding, #hud .combo.punch b { animation: none; }
  #hud .items span.pop { animation-name: jf-glow; }
}
#hud .hurt { position: absolute; inset: 0; box-shadow: inset 0 0 120px 30px #ff6a20; opacity: 0; transition: opacity .5s; }
#hud .hurt.on { opacity: .5; transition: none; }
body.calm #hud .hurt.on { opacity: .25; }
#hud .debug { position: absolute; left: calc(env(safe-area-inset-left, 0px) + 18px); bottom: calc(env(safe-area-inset-bottom, 0px) + 14px); font: 12px/1.4 ui-monospace, monospace; white-space: pre; text-shadow: var(--hud-outline); opacity: .8; }
/* phones: smaller, and keep the bottom corners free for the thumbs */
@media (max-height: 520px), (max-width: 700px) {
  #hud .tl { left: calc(env(safe-area-inset-left, 0px) + 10px); top: calc(env(safe-area-inset-top, 0px) + 8px); width: 235px; gap: 0 8px; }
  #hud .lvl { width: 38px; height: 38px; font-size: 18px; border-width: 2.5px; }
  #hud .bar { height: 17px; }
  #hud .hpn { right: 7px; }
  #hud .hp-delta { line-height: 17px; }
  #hud .xp { height: 7px; margin-top: 5px; }
  #hud .items { margin-top: 8px; gap: 5px; }
  #hud .items span { width: 28px; height: 28px; font-size: 18px; }
  #hud .tc { top: calc(env(safe-area-inset-top, 0px) + 6px); }
  #hud .clock { font-size: 19px; }
  #hud .stage { margin-top: 2px; }
  #hud .boss { top: calc(env(safe-area-inset-top, 0px) + 70px); }
  #hud .toast { top: 28%; padding: 6px 14px; font-size: var(--ui-size-body); }
  #hud .toast.stamp { font-size: 26px; }
  #hud .hint { bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); }
}
body.touch #hud .map { top: calc(env(safe-area-inset-top, 0px) + 60px); bottom: auto; right: calc(env(safe-area-inset-right, 0px) + 10px); width: 135px; height: 135px; }
body.touch #hud .hint { bottom: calc(env(safe-area-inset-bottom, 0px) + 124px); }
`;

export class Hud {
  constructor(plan) {
    this.plan = plan; // [[name, [[x, z], ...]], ...] for the rooms in this stage
    bus.on('boss_health', ({ name, hp, maxHp, shielded, shieldText }) => this.setBoss(name, hp / maxHp, shielded, shieldText));
    bus.on('xp_collected', ({ amount }) => this.pulseXp(amount));
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `<style>${CSS}</style>
      <div class="tl">
        <div class="lvl"></div>
        <div class="vit"><div class="player-health" role="progressbar" aria-label="Health"><div class="bar ui-bar moist" data-kind="health"><em class="hp-trail"></em><i class="hp-fill"></i><b class="hp-edge" aria-hidden="true"></b><span class="hp-warning" aria-hidden="true">!</span><span class="hpn"></span></div></div><div class="bar ui-bar shield-bar" data-kind="shield" role="progressbar" aria-label="Shield" hidden><i></i><span class="shn"></span></div><span class="hp-delta" aria-hidden="true" hidden></span></div>
        <div class="bar ui-bar xp" data-kind="xp" role="progressbar" aria-label="XP"><i></i></div>
        <div class="items"></div>
      </div>
      <div class="tc"><div class="clock"></div><div class="stage"></div></div>
      <div class="boss" hidden><div class="nm"></div><div class="bar ui-bar" data-kind="boss"><i></i></div></div>
      <div class="elite" hidden><div class="nm"></div><div class="bar ui-bar" data-kind="boss"><i></i></div></div>
      <canvas class="map"></canvas>
      <div class="hint"></div><div class="toast ui-toast" role="status"></div><div class="hurt"></div><div class="debug" hidden></div>
      <div class="combo" hidden><b></b><span>combo</span><i></i></div>`;
    this.$ = (s) => this.el.querySelector(s);
    this.map = this.$('.map');
    this.ctx = this.map.getContext('2d');
    this.room = undefined;
    this.cache = {};
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.hpNodes = Object.fromEntries(['player-health', 'moist', 'hp-fill', 'hp-trail', 'hp-edge', 'hp-delta'].map(k => [k, this.$('.' + k)]));
    this.hpLook = {
      hold: LOOK.num('hp-trail-hold', 200), drain: LOOK.num('hp-trail-drain', 400),
      recoil: LOOK.num('hp-recoil-time', 180), group: LOOK.num('hp-number-time', 650),
      heal: LOOK.num('hp-heal-time', 350), strength: LOOK.num('hp-recoil-max', 0.11),
    };
    for (const [key, value] of Object.entries({
      'hp-trail-color': LOOK.color('hp-trail', '#ffc0a0'), 'hp-heal-color': LOOK.color('hp-heal', '#9dffd9'),
      'hp-critical-color': LOOK.color('hp-critical', '#ff7068'), 'hp-drain': this.hpLook.drain + 'ms',
      'hp-breathe': LOOK.num('hp-breathe-time', 1400) + 'ms',
    })) this.el.style.setProperty('--' + key, value);
    this.resetHealth();
    // the minimap's colours: the kit's (look.css --ui-*), read once
    this.mapLook = { deep: LOOK.color('ui-deep', '#0b1622'), ink: LOOK.color('ui-ink', '#e8f4f8'), you: LOOK.color('ui-mint', '#a3f5d5'),
      treasure: LOOK.color('ui-gold', '#ffd46c'), elite: LOOK.color('ui-boss', '#ff6a55'), boss: LOOK.color('ui-boss', '#ff6a55'), exit: LOOK.color('ui-mint', '#a3f5d5') };
    const pts = plan.flatMap(([, poly]) => poly);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }

  mount(parent) {
    parent.appendChild(this.el);
    addEventListener('resize', () => this.fit());
    this.fit();
  }

  // The HUD grows and shrinks with the window: one scale (CSS zoom on the whole HUD) from the window
  // against a base size (content/look.css --hud-base-*), kept within --hud-scale-min/max. Phones and
  // small windows keep their own layout (the small-screen rules below and body.touch) at 1.
  fit() {
    const w = innerWidth, h = innerHeight;
    const small = document.body.classList.contains('touch') || h <= 520 || w <= 700;
    const s = small ? 1 : Math.min(LOOK.num('hud-scale-max', 1.75), Math.max(LOOK.num('hud-scale-min', 0.85),
      Math.min(w / LOOK.num('hud-base-width', 1600), h / LOOK.num('hud-base-height', 900))));
    this.scale = Math.round(s * 100) / 100;
    this.el.style.zoom = this.scale === 1 ? '' : String(this.scale);
    this.touch = document.body.classList.contains('touch');
  }

  set(key, sel, fn) { // only touch the DOM when a value changes
    const v = fn();
    if (this.cache[key] === v) return;
    this.cache[key] = v;
    this.$(sel).innerHTML = v;
  }

  // kill combo: a big number that punches up on every kill, with a draining timer bar
  setCombo(n, frac, bonus) {
    const c = this.$('.combo');
    c.hidden = n < 3;
    if (n < 3) { this.cache.combo = 0; return; }
    if (this.cache.combo !== n) {
      this.cache.combo = n;
      c.querySelector('b').textContent = `x${n}`;
      c.querySelector('span').textContent = bonus > 1.01 ? `combo · +${Math.round((bonus - 1) * 100)}% XP` : 'combo';
      c.classList.remove('punch'); void c.offsetWidth; c.classList.add('punch');
      c.style.setProperty('--hue', String(Math.max(0, 50 - n * 2)));
    }
    c.querySelector('i').style.transform = `scaleX(${frac})`;
  }

  resetHealth() {
    clearTimeout(this.hpTrailTimer); clearTimeout(this.hpNumberTimer);
    for (const a of Object.values(this.hpAnimations || {})) a.cancel();
    this.hpAnimations = {}; this.hpGroup = null; this.hpTrailTimer = null; this.hpTrailFrac = 0; this.hpDamage = 0; this.hpLastKick = -Infinity; this.hpLastHeal = -Infinity;
    delete this.cache.hp; delete this.cache.hpMax;
    this.hpNodes['hp-delta'].hidden = true;
    this.hpNodes.moist.classList.remove('low'); this.$('.hurt').classList.remove('on');
  }

  healthAnimate(key, node, frames, duration) {
    this.hpAnimations[key]?.cancel();
    if (juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.hpAnimations[key] = node.animate(frames, { duration, easing: 'ease-out' });
  }

  healthNumber(amount, healing, now) {
    const node = this.hpNodes['hp-delta'], group = this.hpGroup;
    const fresh = !group || group.healing !== healing || now - group.at > this.hpLook.group;
    if (fresh) this.hpGroup = { healing, total: 0, at: now };
    this.hpGroup.total += amount; this.hpGroup.at = now;
    const total = this.hpGroup.total;
    node.hidden = false; node.classList.toggle('heal', healing);
    const text = (healing ? '+' : '−') + (total < 0.1 ? '<0.1' : total < 1 ? total.toFixed(1) : String(Math.round(total)));
    if (node.textContent !== text) node.textContent = text;
    if (fresh) this.healthAnimate('number', node, [{ opacity: 0.3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], this.hpLook.recoil);
    clearTimeout(this.hpNumberTimer);
    this.hpNumberTimer = setTimeout(() => { node.hidden = true; this.hpGroup = null; }, this.hpLook.group);
  }

  setHealth(v, max, { heal = true } = {}) {
    v = Math.max(0, Math.min(max, v));
    const N = this.hpNodes, frac = max > 0 ? v / max : 0, now = performance.now();
    const initial = this.cache.hp === undefined || max !== this.cache.hpMax;
    const previous = this.cache.hp, delta = initial ? 0 : v - previous;
    if (!initial && delta === 0) return;   // don't interrupt a healing transition on the next HUD frame
    if (initial) this.resetHealth();
    if (delta < -0.01) {
      const h = this.$('.hurt');
      h.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
    }
    if (delta < 0) {
      this.healthNumber(-delta, false, now); this.hpDamage -= delta;
      if (this.hpTrailFrac < previous / max) {
        this.hpTrailFrac = previous / max;
        N['hp-trail'].style.transitionDuration = '0ms'; N['hp-trail'].style.transform = `scaleX(${this.hpTrailFrac})`;
      }
      if (!this.hpTrailTimer) {
        this.hpTrailTimer = setTimeout(() => {
          N['hp-trail'].style.transitionDuration = this.hpLook.drain + 'ms';
          this.hpTrailFrac = this.cache.hp / this.cache.hpMax;
          N['hp-trail'].style.transform = `scaleX(${this.hpTrailFrac})`;
          this.hpTrailTimer = null;
        }, this.hpLook.hold);
      }
      if (now - this.hpLastKick >= this.hpLook.recoil) {
        const k = Math.min(this.hpLook.strength, this.hpDamage / max);
        this.healthAnimate('kick', N['player-health'], [{ transform: `scale(1.01, ${1 - k})` }, { transform: `scale(0.995, ${1 + k * 0.5})`, offset: 0.5 }, { transform: 'scale(1)' }], this.hpLook.recoil);
        this.healthAnimate('edge', N['hp-edge'], [{ transform: 'translate(-50%, -50%) scale(1.5, .7)' }, { transform: 'translate(-50%, -50%) scale(1)' }], this.hpLook.recoil);
        this.hpDamage = 0; this.hpLastKick = now;
      }
    } else if (delta > 0 && heal) {
      this.hpDamage = 0;
      this.healthNumber(delta, true, now);
      if (!this.hpLastHeal || now - this.hpLastHeal > this.hpLook.heal) {
        this.healthAnimate('heal', N.moist, [{ boxShadow: '0 0 0 2px var(--hp-heal-color), 0 0 16px var(--hp-heal-color)' }, { boxShadow: '0 0 0 0 transparent, 0 2px 8px var(--ui-shade)' }], this.hpLook.heal);
        this.healthAnimate('edge', N['hp-edge'], [{ transform: 'translate(-50%, -50%) scale(1.6, .8)' }, { transform: 'translate(-50%, -50%) scale(1)' }], this.hpLook.heal);
        this.hpLastHeal = now;
      }
    }
    if (initial || (delta > 0 && heal)) {
      clearTimeout(this.hpTrailTimer); this.hpTrailTimer = null;
      this.hpTrailFrac = frac;
      N['hp-trail'].style.transitionDuration = '0ms'; N['hp-trail'].style.transform = `scaleX(${frac})`;
    }
    N['hp-fill'].style.transitionDuration = delta > 0 ? this.hpLook.recoil + 'ms' : '0ms';
    N['hp-fill'].style.transform = `scaleX(${frac})`;
    N['hp-edge'].style.transitionDuration = delta > 0 ? this.hpLook.recoil + 'ms' : '0ms';
    N['hp-edge'].style.left = `${frac * 100}%`; N['hp-edge'].hidden = frac <= 0;
    const low = v > 0 && frac < 0.3;
    if (low && !N.moist.classList.contains('low') && !initial) this.healthAnimate('critical', N['player-health'], [{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], this.hpLook.heal);
    N.moist.classList.toggle('low', low);
    N['player-health'].setAttribute('aria-valuenow', String(v));
    N['player-health'].setAttribute('aria-valuemin', '0'); N['player-health'].setAttribute('aria-valuemax', String(max));
    this.cache.hp = v; this.cache.hpMax = max;
    this.set('hpText', '.hpn', () => `${Math.ceil(v)}`);
  }

  // The Shield bar (shield.js): hidden until the jelly has any Shield, then as long as
  // --shield-bar-base px plus --shield-bar-per px for every point of it. state is what just
  // happened: 'broken' (a shake and a red flash), 'charging' (a shimmer while it refills), 'full' (a glow)
  setShield({ hp, max, state, charging }) {
    const bar = this.shieldBar ||= this.$('.shield-bar');
    bar.hidden = !(max > 0);
    if (bar.hidden) return;
    if (this.cache.shMax !== max) {
      this.cache.shMax = max;
      bar.style.width = LOOK.num('shield-bar-base', 14) + LOOK.num('shield-bar-per', 3) * max + 'px';
      bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(Math.round(max)));
    }
    bar.querySelector('i').style.transform = `scaleX(${hp / max})`;
    bar.classList.toggle('charging', charging);
    bar.classList.toggle('empty', hp <= 0);
    bar.setAttribute('aria-valuenow', String(Math.ceil(hp)));
    this.set('shText', '.shn', () => `${Math.ceil(hp)}`);
    if (state === 'broken') this.healthAnimate('shield', bar, [{ transform: 'translateX(-3px)', boxShadow: '0 0 0 2px var(--hp-critical-color), 0 0 12px var(--hp-critical-color)' }, { transform: 'translateX(3px)', offset: 0.3 }, { transform: 'translateX(0)', boxShadow: '0 0 0 0 transparent, 0 2px 8px var(--ui-shade)' }], 320);
    if (state === 'full') this.healthAnimate('shield', bar, [{ boxShadow: '0 0 0 2px var(--ui-ink), 0 0 16px var(--ui-shield)' }, { boxShadow: '0 0 0 0 transparent, 0 2px 8px var(--ui-shade)' }], 450);
  }

  setXp(level, xp, need, purse) {
    this.$('.xp i').style.transform = `scaleX(${Math.min(1, xp / need)})`;
    this.set('lvl', '.lvl', () => `${level}`);
    this.$('.lvl').title = `Level ${level} · ${xp} / ${need} XP`;
    const bar = this.$('.xp');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(need)); bar.setAttribute('aria-valuenow', String(xp));
  }

  resetXp() { this.xpAnimation?.cancel(); this.xpAnimation = null; }

  pulseXp(amount) {
    if (juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.resetXp(); return; }
    if (this.xpAnimation?.playState === 'running') return;
    this.xpAnimation = this.$('.xp').animate([
      { transform: `scaleY(${LOOK.num('xp-bar-pulse', 1.35)})`, filter: `brightness(${amount >= 5 ? 1.8 : 1.4})` },
      { transform: 'scaleY(1)', filter: 'brightness(1)' },
    ], { duration: LOOK.num('xp-bar-time', 180), easing: 'ease-out' });
  }

  setItems(items) {
    const before = this.cache.items;
    this.set('items', '.items', () => items.map((t) => `<span data-id="${t.id}" title="${t.name}: ${t.text}"><b>${t.icon}</b></span>`).join(''));
    if (this.cache.items !== before) this.cd = {};     // new spans: draw every face again
  }

  // cds: Run.cooldowns() — for each timed item, the share of its wait still to go, and whether a
  // once-only effect is spent. Only touches a span when what it shows changes.
  setCooldowns(cds) {
    const was = (this.cd ||= {});
    for (const el of this.$('.items').children) {
      const id = el.dataset.id, c = cds[id], prev = was[id];
      const left = c ? Math.round(c.left * 50) / 50 : -1, spent = !!c?.spent;
      if (prev && prev.left === left && prev.spent === spent) continue;
      el.classList.toggle('timed', !!c);
      el.classList.toggle('wait', left > 0 && !spent);
      el.classList.toggle('spent', spent);
      el.style.setProperty('--cd', c ? String(left) : '0');
      if (prev && prev.left >= 0 && prev.left < 0.15 && left > 0.85 && !spent) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }   // it just went off
      was[id] = { left, spent };
    }
  }

  setClock(text, dry) {
    this.set('clock', '.clock', () => text);
    this.$('.clock').classList.toggle('dry', dry);
  }
  setStage(text) { this.set('stage', '.stage', () => text); }

  // shielded: the bar turns purple and says so (the Vacuum's lanternflies)
  setBoss(name, frac, shielded = false, shieldText = 'SHIELDED') {
    const b = this.$('.boss');
    b.hidden = name == null;
    if (name == null) return;
    b.classList.toggle('shield', shielded);
    this.set('bossName', '.boss .nm', () => (shielded ? `${name.toUpperCase()} · ${shieldText}` : name.toUpperCase()));
    this.$('.boss i').style.transform = `scaleX(${Math.max(0, frac)})`;
  }

  // the elite you're fighting (null: none)
  setElite(name, frac) {
    const b = this.$('.elite');
    b.hidden = name == null;
    if (name == null) return;
    this.set('eliteName', '.elite .nm', () => `${icon('star')} ${name.toUpperCase()}`);
    this.$('.elite i').style.transform = `scaleX(${Math.max(0, frac)})`;
  }

  hint(html) {
    const h = this.$('.hint');
    if (html) this.set('hint', '.hint', () => html);
    h.classList.toggle('on', !!html);
  }

  // kind 'stamp': big and gold, stamped in (a boss cleared)
  toast(text, ms = 1800, kind = '') {
    const t = this.$('.toast');
    t.textContent = text;
    t.classList.remove('on');
    t.classList.toggle('stamp', kind === 'stamp');
    void t.offsetWidth;   // restart the stamp's animation
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  // A level-up lands (run.levelUp): the badge pops, and a gold ring leaves the jelly at (x, y) on screen
  levelDing(x, y) {
    if (juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lvl = this.$('.lvl');
    lvl.classList.remove('ding'); void lvl.offsetWidth; lvl.classList.add('ding');
    const ring = document.createElement('div');
    ring.className = 'jf-ding-ring';
    ring.style.left = `${x}px`; ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
    setTimeout(() => ring.remove(), 900);   // (animationend never fires on a hidden tab)
  }

  setDebug(text) {
    const d = this.$('.debug');
    d.hidden = !text;
    if (text) d.textContent = text;
  }

  roomAt(x, z) {
    for (const [name, poly] of this.plan) if (inPoly(x, z, poly)) return name;
    return null;
  }

  // the minimap on or off (a player's first run hides it until the first Treasure: first-run.js)
  showMap(on) { if (this.map.hidden === !on) return; this.map.hidden = !on; }

  // The minimap: a glass disc centred on you and turned so up is where the camera looks (the way
  // "forward" moves you). The rooms are outlines; marks only for what's worth going to, each its own
  // shape so colour isn't the only clue: a chest (gold square), an Elite (hot diamond), the boss (a big
  // hot dot), the way out (a mint door). One past the edge waits on the rim, pointing the way, with a
  // small arrow when it's well above or below you. You are a mint arrow.
  // markers: [{ kind: 'treasure' | 'elite' | 'boss' | 'exit', x, y, z, color? }]
  update(pos, facing, cameraYaw, markers = []) {
    if (this.map.hidden) return;
    const c = this.map, g = this.ctx, C = this.mapLook;
    const dpr = Math.min(3, devicePixelRatio || 1);
    if (this.touch !== document.body.classList.contains('touch')) this.fit();   // (a touch device is only known after the HUD mounts)
    const css = (c.clientWidth || 285) * (this.scale || 1);   // drawn at its zoomed size, so it stays sharp
    const W = Math.round(css * dpr);
    if (c.width !== W) { c.width = c.height = W; this.mapCone = null; }
    const b = this.bounds, R = W / 2, TAU = Math.PI * 2;
    // the whole room fits across the map; centred on you, the far side of it can run off the edge
    const s = W / Math.max(b.x1 - b.x0, b.z1 - b.z0);
    const X = (x) => (x - b.x0) * s, Z = (z) => (z - b.z0) * s;
    const u = W / 190;                                    // scale for sizes, so small maps stay readable
    // turn so the camera's forward, (-sin yaw, -cos yaw) on the floor, points up
    const turn = -Math.PI / 2 - Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw));
    const cs = Math.cos(turn), sn = Math.sin(turn), px = X(pos.x), pz = Z(pos.z);
    const out = this._pt || (this._pt = { x: 0, y: 0, d: 0 });
    const toMap = (x, z) => { const dx = X(x) - px, dz = Z(z) - pz; out.x = R + dx * cs - dz * sn; out.y = R + dx * sn + dz * cs; out.d = Math.hypot(dx, dz); return out; };

    // the glass: dark water, the rooms' outlines on it, a light rim and a sheen across the top
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R - u, 0, TAU);
    g.globalAlpha = 0.62; g.fillStyle = C.deep; g.fill();
    g.clip();
    g.translate(R, R); g.rotate(turn); g.translate(-px, -pz);
    g.beginPath();
    for (const [, poly] of this.plan) { poly.forEach(([x, z], k) => (k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.closePath(); }
    g.globalAlpha = 0.1; g.fillStyle = C.ink; g.fill();
    g.globalAlpha = 0.75; g.lineWidth = 1.5 * u; g.lineJoin = 'round'; g.strokeStyle = C.ink; g.stroke();
    g.restore();
    g.strokeStyle = C.ink;
    g.globalAlpha = 0.6; g.lineWidth = 2 * u; g.beginPath(); g.arc(R, R, R - 2 * u, 0, TAU); g.stroke();
    g.globalAlpha = 0.2; g.lineWidth = 3 * u; g.lineCap = 'round'; g.beginPath(); g.arc(R, R, R - 6 * u, -0.9 * Math.PI, -0.62 * Math.PI); g.stroke();
    g.globalAlpha = 1;

    // the marks, outlined in the water's colour so they read over a wall
    const still = juice.calm || this.reduced.matches;
    const pulse = still ? 0.3 : 0.25 + 0.2 * Math.sin(performance.now() / 250), rim = R - 9 * u;
    g.lineWidth = 1.5 * u; g.lineJoin = 'round'; g.strokeStyle = C.deep;
    for (const m of markers) {
      const kind = MARK_SIZE[m.kind] ? m.kind : 'treasure', color = m.color || C[kind];
      const p = toMap(m.x, m.z);
      if (p.d > rim) { p.x = R + (p.x - R) * rim / p.d; p.y = R + (p.y - R) * rim / p.d; }
      const x = p.x, y = p.y, r = MARK_SIZE[kind] * u * (kind === 'treasure' ? LOOK.num('map-treasure-scale', 1.33) : 1);
      g.fillStyle = color;
      if (kind !== 'elite') { g.globalAlpha = pulse; g.beginPath(); g.arc(x, y, r * 2.2, 0, TAU); g.fill(); g.globalAlpha = 1; }   // a soft glow: worth going to
      g.beginPath();
      if (kind === 'treasure') g.roundRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6, r * 0.35);
      else if (kind === 'elite') { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
      else if (kind === 'exit') g.roundRect(x - r * 0.6, y - r, r * 1.2, r * 2, [r * 0.6, r * 0.6, r * 0.15, r * 0.15]);
      else g.arc(x, y, r, 0, TAU);
      g.fill(); g.stroke();
      const dy = m.y - pos.y;
      if (Math.abs(dy) > 0.15) {   // well above (pointing up) or below you
        const a = dy > 0 ? -1 : 1, ty = y - r - 5 * u;
        g.beginPath(); g.moveTo(x, ty + a * 3 * u); g.lineTo(x + 3.2 * u, ty - a * 2 * u); g.lineTo(x - 3.2 * u, ty - a * 2 * u); g.closePath();
        g.fillStyle = C.ink; g.fill(); g.stroke();
      }
    }

    // you: a soft view cone (always up: it's where the camera looks) and an arrow for the way the jelly faces
    if (!this.mapCone) {
      this.mapCone = g.createRadialGradient(R, R, 0, R, R, 34 * u);
      this.mapCone.addColorStop(0, C.you + '50'); this.mapCone.addColorStop(1, C.you + '00');
    }
    g.fillStyle = this.mapCone;
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, 34 * u, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
    g.save();
    g.translate(R, R);
    g.rotate(turn + Math.atan2(Math.cos(facing), Math.sin(facing)));
    g.beginPath();
    g.moveTo(9 * u, 0); g.lineTo(-5.5 * u, -6 * u); g.lineTo(-2 * u, 0); g.lineTo(-5.5 * u, 6 * u); g.closePath();
    g.fillStyle = C.you; g.fill();
    g.lineWidth = 1.5 * u; g.strokeStyle = C.deep; g.stroke();
    g.restore();
    this.mapTurn = turn;
  }

}

// a mark's size on the minimap (x the map's scale): a chest, an Elite, the boss, the way out
const MARK_SIZE = { treasure: 3.6, elite: 5, boss: 5.5, exit: 5 };

function inPoly(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export { inPoly };
