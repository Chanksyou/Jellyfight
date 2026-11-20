// The reward spin's machine (src/spin.js has its numbers): a pick's sign, the Luck panel, a reel per
// offered card and a jelly on a lever. The roll is already made; the reels only show it. Each reel is
// one strip moved by one transform animation (WAAPI) that runs off the main thread; the steps between
// (a reel landing, the hold, the cards) run on the game's clock, from ui.tick, like a pick's outro, so
// stories can step through it. Nothing runs per cell or per frame but a few comparisons.
//   new Spin(modal, { kind, title, offer, cell, rollOne, odds, luck, calm, lead, done })
//   spin.tick(ms) -> false once it has handed over to the cards (done()); spin.tap() lands or skips
// Reduce effects (calm): the machine fades in already landed, holds, and fades out.
import { buildStrips, spinCells, spinTimes } from './spin.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { esc } from './leaderboard.js';

const TIERS = ['common', 'rare', 'epic', 'legendary'];
const NAME = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const tierOf = (c) => c.rarity?.id ?? c.rarity;
const ms = (name, fallback) => LOOK.num(name, fallback);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const pct = (p) => { const v = p * 100; return `${v >= 10 || v === 0 ? Math.round(v) : +v.toFixed(1)}%`; };

// --ui-ease-arrive as numbers: where a reel's slowing starts (its starting speed, so it joins the steady
// run without a jolt) and when each of its last rows crosses the payline (for the tick sound)
function arrive() {
  const m = css('--ui-ease-arrive').match(/cubic-bezier\(([^)]+)\)/), [ax, ay, bx, by] = m ? m[1].split(',').map(parseFloat) : [0.34, 1.5, 0.64, 1];
  const at = (s, a, b) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
  // the share of the slowing's time at which it has covered `y` of its way
  const timeAt = (y) => { for (let s = 0; s <= 1; s += 0.02) if (at(s, ay, by) >= y - 1e-6) return at(s, ax, bx); return 1; };
  return { easing: m ? m[0] : 'cubic-bezier(.34, 1.5, .64, 1)', speed: ay / ax || 4.4, timeAt };
}

// One reel's ride from row j0 (the top row showing) to 0 over D ms: steady, then the last three rows
// slow into place. -> { keys, fast: ms of the steady part, ticks: ms when each row crosses the payline }
function glide(j0, D, H, A) {
  const slow = Math.min(3, j0), lin = j0 - slow, fast = lin ? D / (1 + slow * A.speed / lin) : 0;
  const y = (j) => `translateY(${-j * H}px)`;
  const keys = [{ transform: y(j0), easing: lin ? 'linear' : A.easing }];
  if (lin) keys.push({ offset: fast / D, transform: y(slow), easing: A.easing });
  keys.push({ transform: y(0) });
  const ticks = [];
  for (let j = j0 - 1; j >= slow; j--) ticks.push(fast * (j0 - j) / (lin || 1));
  for (let k = slow - 1; k >= 0; k--) ticks.push(fast + A.timeAt((slow - k) / slow) * (D - fast));
  return { keys, fast, ticks };
}

const CSS = `
.jf-spin { --cell: var(--spin-cell, 74px); --reel: calc(var(--cell) * var(--spin-reel, 2.05)); --gap: calc(var(--cell) * .11);
  position: relative; display: grid; justify-items: center; gap: var(--gap); width: 100%; box-sizing: border-box; padding: 10px var(--ui-space-2) 0; }
.jf-spin.four { --reel: calc(var(--cell) * var(--spin-reel-four, 1.65)); }
/* the sign: the pick's title under a row of pearls */
.jf-spin .sp-sign { position: relative; padding: 4px 40px 6px; border-radius: var(--ui-radius-pill); background: linear-gradient(#24406a, #14284a);
  border: 2px solid var(--ui-gold-deep); box-shadow: 0 0 0 3px var(--ui-deep), 0 0 28px -6px var(--ui-gold); }
.jf-spin .sp-sign h2 { font-size: var(--ui-size-title); color: var(--ui-gold); text-shadow: 0 0 14px color-mix(in srgb, var(--ui-gold) 55%, transparent); }
.jf-spin .sp-sign p { margin: 0; min-height: 1.2em; font: 500 var(--ui-size-label)/1.2 var(--ui-font-text); color: var(--ui-ink-dim); }
.jf-spin .sp-bulbs { position: absolute; inset: -7px 18px auto; display: flex; justify-content: space-between; pointer-events: none; }
.jf-spin .sp-bulbs.low { inset: auto 18px -7px; }
.jf-spin .sp-bulbs i { width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #ffe9a0 45%, var(--ui-gold-deep)); box-shadow: 0 0 8px var(--ui-gold); }
.jf-spin .sp-bulbs i:nth-child(even) { opacity: .45; box-shadow: none; }
/* the cabinet: a tank of night water with a gold rim */
.jf-spin .sp-cab { position: relative; display: flex; align-items: stretch; gap: var(--gap); max-width: 100%; box-sizing: border-box; padding: var(--gap); border-radius: 22px;
  border: 2px solid var(--ui-gold-deep); background: linear-gradient(var(--ui-panel-raised), #0f2038); box-shadow: 0 0 0 3px var(--ui-deep), 0 18px 40px #000a, inset 0 1px 0 #ffffff22; }
/* Luck: the number, and each rarity's chance on one reel without it and with it */
.jf-spin .sp-luck { flex: 0 1 calc(var(--cell) * 2.4); min-width: 0; box-sizing: border-box; padding: var(--ui-space-2) 10px; border-radius: var(--ui-radius-m);
  background: color-mix(in srgb, var(--ui-deep) 67%, transparent); border: 1px solid var(--ui-line); display: flex; flex-direction: column; gap: 5px; text-align: left; }
.jf-spin .sp-luck .top { display: flex; align-items: center; gap: var(--ui-space-2); }
.jf-spin .sp-luck .clover { font-size: calc(var(--cell) * .32); line-height: 1; }
.jf-spin .sp-luck .lab { display: block; font: 600 var(--ui-size-label)/1.1 var(--ui-font-text); letter-spacing: .08em; text-transform: uppercase; color: var(--ui-ink-dim); }
.jf-spin .sp-luck .num { display: block; font: 600 calc(var(--ui-size-title) * 1.05)/1 var(--ui-font-display); color: var(--ui-mint); }
.jf-spin .sp-odds { display: grid; gap: 4px; margin-top: auto; }
.jf-spin .sp-odd { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; column-gap: 6px; font: 600 var(--ui-size-label)/1.15 var(--ui-font-text); }
.jf-spin .sp-odd .n { color: var(--c); letter-spacing: .04em; text-transform: uppercase; }
.jf-spin .sp-odd .v { font-variant-numeric: tabular-nums; color: var(--ui-ink-dim); white-space: nowrap; }
.jf-spin .sp-odd .v b { color: var(--ui-mint); }
.jf-spin .sp-odd .v.down b { color: var(--ui-ink); }
.jf-spin .sp-odd .bar { flex-basis: 100%; position: relative; height: 6px; margin-top: 2px; border-radius: 3px; background: var(--ui-shade); overflow: hidden; }
.jf-spin .sp-odd .bar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; }
.jf-spin .sp-odd .bar .now { background: var(--c); }
.jf-spin .sp-odd .bar .was { border-right: 2px solid var(--ui-deep); }
.jf-spin .sp-boss { margin: auto 0 0; font: 600 var(--ui-size-body)/1.3 var(--ui-font-text); color: var(--ui-legendary); }
/* the reels: three rows each; the middle one is the payline */
.jf-spin .sp-reels { position: relative; display: flex; gap: var(--gap); padding: 0 14px; min-width: 0; }
.jf-spin .sp-reel { position: relative; flex: 0 1 auto; width: var(--reel); min-width: 0; height: calc(var(--cell) * 3); overflow: hidden; border-radius: 12px; background: #081019; box-shadow: inset 0 0 0 1px #ffffff14; }
.jf-spin .sp-reel::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(#060c14f0, #060c1400 26%, #060c1400 74%, #060c14f0); }
.jf-spin .sp-reel.up { box-shadow: inset 0 0 0 1px #ffffff14, 0 0 0 2px var(--ui-gold), 0 0 24px color-mix(in srgb, var(--ui-gold) 55%, transparent); }
.jf-spin .sp-strip { position: absolute; inset: 0 0 auto; }
.jf-spin .rolling .sp-strip { will-change: transform; }
.jf-spin .sp-cell { --c: var(--ui-common); height: var(--cell); padding: 3px; box-sizing: border-box; }
.jf-spin .sp-cell[data-r="rare"] { --c: var(--ui-rare); }
.jf-spin .sp-cell[data-r="epic"] { --c: var(--ui-epic); }
.jf-spin .sp-cell[data-r="legendary"] { --c: var(--ui-legendary); }
.jf-spin .sp-cell > div { position: relative; height: 100%; box-sizing: border-box; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 8px; padding: 0 8px; border-radius: 10px; text-align: left;
  border: 2px solid color-mix(in srgb, var(--c) 70%, transparent); background: linear-gradient(color-mix(in srgb, var(--c) 20%, var(--ui-panel-raised)), color-mix(in srgb, var(--c) 7%, var(--ui-deep))); }
.jf-spin .sp-cell .ic { grid-row: span 2; font-size: calc(var(--cell) * .4); line-height: 1; }
.jf-spin .sp-cell .r { align-self: end; font: 700 var(--ui-size-label)/1.1 var(--ui-font-text); letter-spacing: .08em; text-transform: uppercase; color: var(--c); }
.jf-spin .sp-cell .nm { align-self: start; font: 500 max(var(--ui-size-body), calc(var(--cell) * .17 * var(--ui-text-scale)))/1.1 var(--ui-font-display); color: var(--ui-ink);
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.jf-spin .sp-cell .nm b { color: var(--ui-mint); font-weight: 600; }
/* four reels (the Notebook) are narrower: a slimmer Luck panel and lever, a smaller icon and tighter type,
   so every rarity word stays whole on a phone with its notch margins */
.jf-spin.four .sp-luck { flex-basis: calc(var(--cell) * 1.8); }
.jf-spin.four .sp-lever { flex-basis: calc(var(--cell) * .7); }
.jf-spin.four .sp-reels { padding: 0 12px; }
.jf-spin.four .sp-cell > div { column-gap: 4px; padding: 0 4px; }
.jf-spin.four .sp-cell .ic { font-size: calc(var(--cell) * .24); }
.jf-spin.four .sp-cell .r { letter-spacing: 0; }
.jf-spin.four .sp-cell .nm { font-size: max(var(--ui-size-label), calc(var(--cell) * .15 * var(--ui-text-scale))); }
/* a reel at full speed: each cell is a streak of its rarity's colour (a class swap; only the strip moves) */
.jf-spin .fast .sp-cell > div { grid-template-columns: 1fr; justify-items: center; opacity: .6; transform: scaleY(1.18); border-color: transparent;
  background: linear-gradient(transparent, color-mix(in srgb, var(--c) 55%, transparent) 30%, color-mix(in srgb, var(--c) 55%, transparent) 70%, transparent); }
.jf-spin .fast .sp-cell .ic { transform: scaleY(1.7); opacity: .75; grid-row: auto; }
.jf-spin .fast .sp-cell :is(.r, .nm, .up) { display: none; }
/* landed: the payline's card is lit, its neighbours dim but readable */
.jf-spin .landed .sp-cell:not(.win) > div { opacity: .5; }
.jf-spin .landed .sp-cell.win > div { border-color: var(--c); box-shadow: 0 0 22px -2px var(--c), inset 0 0 18px color-mix(in srgb, var(--c) 35%, transparent); }
.jf-spin .sp-cell .up { position: absolute; right: 8px; top: -2px; transform: translateY(-50%); padding: 1px 8px; border-radius: var(--ui-radius-pill); background: var(--ui-gold); color: var(--ui-gold-ink); font: 700 var(--ui-size-label)/1.25 var(--ui-font-text); white-space: nowrap; }
.jf-spin .sp-payline { position: absolute; left: 0; right: 0; top: var(--cell); height: var(--cell); pointer-events: none; border-block: 2px solid color-mix(in srgb, var(--ui-gold) 33%, transparent); }
.jf-spin .sp-payline::before, .jf-spin .sp-payline::after { content: ''; position: absolute; top: 50%; margin-top: -9px; border: 9px solid transparent; }
.jf-spin .sp-payline::before { left: 0; border-left-color: var(--ui-gold); }
.jf-spin .sp-payline::after { right: 0; border-right-color: var(--ui-gold); }
.jf-spin .bub { position: absolute; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--ui-mint) 40%, transparent); background: radial-gradient(circle at 30% 30%, #ffffff55, transparent 60%); pointer-events: none; }
/* the lever: a little jelly on a gold rod; it drops and springs back (transform only) */
.jf-spin .sp-lever { position: relative; flex: 0 0 calc(var(--cell) * .8); }
.jf-spin .sp-lever .slot { position: absolute; left: 50%; top: 14%; bottom: 14%; width: 12px; margin-left: -6px; border-radius: 6px; background: #060c14; box-shadow: inset 0 0 0 1px #ffffff1f; }
.jf-spin .sp-lever .rod { position: absolute; left: 50%; top: 18%; height: 32%; width: 6px; margin-left: -3px; border-radius: 3px; transform-origin: 50% 100%; background: linear-gradient(90deg, #8a6a18, #ffe9a0, #8a6a18); }
.jf-spin .sp-lever .hub { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffe9a0, var(--ui-gold-deep)); box-shadow: 0 0 0 2px var(--ui-deep); }
.jf-spin .sp-lever .knob { position: absolute; left: 50%; top: 18%; width: calc(var(--cell) * .62); height: calc(var(--cell) * .5); margin: calc(var(--cell) * -.3) 0 0 calc(var(--cell) * -.31);
  border-radius: 50% 50% 42% 42% / 68% 68% 32% 32%; background: radial-gradient(circle at 35% 25%, #ffffffcc, var(--ui-mint) 35%, #3fb39a 90%); box-shadow: 0 0 20px color-mix(in srgb, var(--ui-mint) 65%, transparent); }
.jf-spin .sp-lever .knob::before, .jf-spin .sp-lever .knob::after { content: ''; position: absolute; top: 52%; width: 5px; height: 5px; border-radius: 50%; background: var(--ui-deep); }
.jf-spin .sp-lever .knob::before { left: 30%; }
.jf-spin .sp-lever .knob::after { right: 30%; }
.jf-spin .sp-lever .tent { position: absolute; left: 10%; right: 10%; top: 88%; height: 12px; border-radius: 0 0 6px 6px; opacity: .8;
  background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--ui-mint) 67%, transparent) 0 3px, transparent 3px 9px); }
.jf-spin .sp-foot { margin: 0; min-height: 1.6em; font: 600 var(--ui-size-label)/1.2 var(--ui-font-text); color: var(--ui-ink-dim); }
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

export class Spin {
  // host: the modal it draws into. o: { kind 'levelup'|'treasure'|'legendary', title, offer (the cards
  // as offered, three of a kind's upgrade included), cell(card) -> { icon, name (HTML) }, rollOne(rng)
  // (one real roll, for the filler), odds (tierOdds), luck, calm, hint (a first run's line for the sign), lead (ms the old cards take to leave
  // first: a reroll), seed (stories), done() (draw the cards) }
  constructor(host, o) {
    style();
    const kind = o.kind === 'levelup' ? 'levelup' : 'treasure';
    Object.assign(this, { host, o, kind, t: -(o.lead || 0), phase: 'wait', stay: false, reels: [] });
    this.times = spinTimes(kind, o.offer);
    this.up = o.offer.findIndex((c) => c.upgraded && c.was);
    if (!o.lead) this.build();
  }

  build() {
    const { o } = this, calm = o.calm;
    // the reels land on what was rolled; an upgraded card's reel lands on the card it was first
    this.strips = buildStrips(o.offer.map((c, i) => (i === this.up && !calm ? c.was : c)), o.rollOne, { cells: spinCells(this.kind), seed: o.seed });
    const coarse = matchMedia('(pointer: coarse)').matches, bulbs = '<i></i>'.repeat(15);
    this.host.innerHTML = `<div class="jf-spin ui-enter${o.offer.length > 3 ? ' four' : ''}" role="group" aria-label="${esc(o.title)}">
      <div class="sp-sign"><span class="sp-bulbs">${bulbs}</span><h2>${esc(o.title)}</h2><p aria-live="polite">${calm ? this.line() : esc(o.hint || 'The reels are rolling…')}</p><span class="sp-bulbs low">${bulbs}</span></div>
      <div class="sp-cab">${this.luck()}
        <div class="sp-reels">${this.strips.map((s, i) => `<div class="sp-reel${calm ? ' landed' : ''}${calm && i === this.up ? ' up' : ''}"><div class="sp-strip">${this.cells(s)}</div></div>`).join('')}<div class="sp-payline"></div>
          <i class="bub" style="left:31%;top:12%;width:9px;height:9px"></i><i class="bub" style="left:66%;top:80%;width:13px;height:13px"></i><i class="bub" style="left:5%;top:86%;width:7px;height:7px"></i></div>
        <div class="sp-lever" aria-hidden="true"><i class="slot"></i><i class="rod"></i><i class="hub"></i><i class="knob"><i class="tent"></i></i></div></div>
      <p class="sp-foot">${calm ? '' : coarse ? 'Tap to stop the reels' : 'Click or press Space to stop the reels'}</p></div>`;
    const root = this.root = this.host.firstElementChild;
    this.line$ = root.querySelector('.sp-sign p');
    this.foot$ = root.querySelector('.sp-foot');
    this.t = 0;
    if (calm) { this.reels = []; this.phase = 'hold'; this.holdEnd = ms('spin-calm-hold', 600); return; }
    // the lever drops, the reels set off as it bottoms out, and it springs back while they roll
    const lever = this.times.lever, back = ms('spin-lever-back', 480), A = this.A = arrive();
    const lv = root.querySelector('.sp-lever'), drop = lv.getBoundingClientRect().height * 0.64;
    const pull = (down) => [{ transform: 'none', easing: css('--ui-ease-leave') || 'ease-in' }, { offset: lever / (lever + back), transform: down, easing: A.easing }, { transform: 'none' }];
    lv.querySelector('.rod').animate(pull('scaleY(-1)'), lever + back);
    lv.querySelector('.knob').animate(pull(`translateY(${drop}px)`), lever + back);
    sfx.spinLever();
    const H = this.H = root.querySelector('.sp-cell').getBoundingClientRect().height;
    const ticks = [];
    this.reels = [...root.querySelectorAll('.sp-reel')].map((el, i) => {
      const strip = el.querySelector('.sp-strip'), D = this.times.stops[i], g = glide(this.strips[i].length - 3, D, H, A);
      el.classList.add('rolling');
      ticks.push(g.ticks.map((x) => (lever + x) / 1000));
      return { el, strip, anim: strip.animate(g.keys, { duration: D, delay: lever, fill: 'both' }), fastAt: lever, fastEnd: lever + g.fast, land: lever + D, fast: false, landed: false, card: this.o.offer[i] };
    });
    sfx.spinTick(ticks);
    this.phase = 'roll';
  }

  // the cells of a strip, top to bottom: the row above the payline, the payline's card, then the filler
  // back to the first (a strip runs downward, so its last cell is the one it lands on)
  cells(strip) {
    const n = strip.length - 2;
    return strip.map((c, i) => {
      const v = this.o.cell(c), r = tierOf(c);
      return `<div class="sp-cell${i === n ? ' win' : ''}" data-r="${r}"><div><span class="ic">${v.icon}</span><span class="r">${NAME[r]}</span><span class="nm">${v.name}</span>${i === n && c.upgraded ? '<span class="up">▲ Upgraded</span>' : ''}</div></div>`;
    }).reverse().join('');
  }

  // the Luck panel: the number, then each rarity's chance on one reel (highest first), with no Luck and with yours
  luck() {
    const { odds, luck = 0 } = this.o;
    const rows = this.o.kind === 'legendary' ? '<p class="sp-boss">Boss reward: always Legendary</p>'
      : `<div class="sp-odds">${[...odds].reverse().map((r) => `<div class="sp-odd" style="--c:var(--ui-${r.id})"><span class="n">${r.name}</span>`
        + `<span class="v${r.now < r.was ? ' down' : ''}">${luck ? `${pct(r.was)} → ` : ''}<b>${pct(r.now)}</b></span>`
        + `<span class="bar"><i class="now" style="width:${r.now * 100}%"></i>${luck ? `<i class="was" style="width:${r.was * 100}%"></i>` : ''}</span></div>`).join('')}</div>`;
    return `<aside class="sp-luck"><div class="top"><span class="clover" aria-hidden="true">🍀</span><span><span class="lab">Your Luck</span><b class="num">${Math.round(luck)}</b></span></div>${rows}</aside>`;
  }

  // the sign's line once every reel has landed: three of a kind, or what's on offer
  line() {
    const n = this.o.offer.length, count = ['one', 'two', 'three', 'four', 'five'][n - 1] || String(n);
    if (this.up < 0) return n === 1 ? 'Here it is.' : `Here are your ${count}.`;
    const c = this.o.offer[this.up], was = NAME[tierOf(c.was)];
    return `${count[0].toUpperCase() + count.slice(1)} ${was}s! One becomes ${NAME[tierOf(c)]}.`;
  }

  landed(r) {
    r.landed = true;
    r.anim.finish();   // (the game's clock rules: a reel is where it lands even if the page fell behind)
    r.el.classList.remove('fast', 'rolling');
    r.el.classList.add('landed');
    sfx.spinStop(TIERS.indexOf(tierOf(r.card)), 0);
  }

  // three of a kind: the chosen reel gets a gold rim and rolls on to its upgraded card
  upgrade() {
    const i = this.up, r = this.reels[i], c = this.o.offer[i], D = ms('spin-upgrade', 600);
    this.line$.textContent = this.line();
    // the rows showing now stay at the bottom, more filler and the upgraded card are stacked on top
    const more = buildStrips([c], this.o.rollOne, { cells: ms('spin-upgrade-cells', 6), seed: (this.o.seed ?? performance.now()) + 1 })[0];
    const strip = [...this.strips[i].slice(-3), ...more], g = glide(strip.length - 3, D, this.H, this.A);
    this.strips[i] = strip;
    r.strip.innerHTML = this.cells(strip);
    r.el.classList.remove('landed');
    r.el.classList.add('up', 'rolling');
    Object.assign(r, { anim: r.strip.animate(g.keys, { duration: D, fill: 'both' }), fastAt: this.t, fastEnd: this.t + g.fast, land: this.t + D, landed: false, card: c });
    sfx.spinTick(this.reels.map((x) => (x === r ? g.ticks.map((t) => t / 1000) : [])));
  }

  // a tap, a click or Space: rolling reels land within --spin-skip; during the hold, straight to the cards
  tap() {
    if (this.phase === 'roll' || this.phase === 'upgrade') {
      const skip = ms('spin-skip', 150);
      for (const r of this.reels) {
        if (r.landed || r.land <= this.t + skip) continue;
        const y = new DOMMatrixReadOnly(getComputedStyle(r.strip).transform).m42;
        r.anim.cancel();
        r.anim = r.strip.animate([{ transform: `translateY(${y}px)` }, { transform: 'translateY(0)' }], { duration: skip, easing: this.A.easing, fill: 'both' });
        r.fastEnd = 0;
        r.land = this.t + skip;
      }
      sfx.spinTick([]);   // (a new schedule replaces the last: none)
    } else if (this.phase === 'hold') this.holdEnd = this.t;
  }

  // ms of the game's clock; false once the cards are up
  tick(dt) {
    this.t += dt;
    if (this.phase === 'wait') { if (this.t >= 0) this.build(); return true; }
    for (const r of this.reels) {
      const fast = !r.landed && this.t >= r.fastAt && this.t < r.fastEnd;
      if (fast !== r.fast) { r.fast = fast; r.el.classList.toggle('fast', fast); }
      if (!r.landed && this.t >= r.land) this.landed(r);
    }
    const all = this.reels.every((r) => r.landed);
    if (this.phase === 'roll' && all) {
      this.foot$.textContent = '';
      if (this.up >= 0) { this.phase = 'upgrade'; this.upgrade(); }
      else { this.line$.textContent = this.line(); this.phase = 'hold'; this.holdEnd = this.t + this.times.hold; }
    } else if (this.phase === 'upgrade' && all) { this.phase = 'hold'; this.holdEnd = this.t + this.times.hold; }
    if (this.phase === 'hold' && this.t >= this.holdEnd && !this.stay) {
      this.phase = 'leave';
      this.leaveEnd = this.t + ms('ui-fast', 120);
      this.root.classList.remove('ui-enter');
      this.root.classList.add('ui-leave');
    }
    if (this.phase === 'leave' && this.t >= this.leaveEnd) { this.phase = 'done'; this.o.done(); return false; }
    return true;
  }
}
