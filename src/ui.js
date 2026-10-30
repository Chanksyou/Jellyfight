// Full-screen choices and messages: level-up cards, treasure reveal, metamorphosis, run end.
import { STAT_INFO, cardText } from './stats.js';
import { esc } from './leaderboard.js';
import { sfx } from './sfx.js';

// How hard a pick card wears its rarity (treasure-pick-screen plan, step 2): the whole
// card washes and glows in the tier colour, harder the rarer it is — [inner glow %, background wash %].
// Cards that set neither (level-up cards) keep the original 18% glow and no wash.
const TIER_TINT = { Common: [18, 0], Rare: [26, 6], Epic: [36, 12], Legendary: [48, 20] };
const TIERS = Object.keys(TIER_TINT);
const calm = () => document.body.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
// a pick card in its rarity colour: tint, wash, the Legendary sheen and its deal-in delay (ms)
const tierCard = (tier, color, d) => { const [tint, wash] = TIER_TINT[tier] || [18, 0]; return { cls: tier === 'Legendary' ? ' jf-sheen' : '', style: `--d:${d}ms; --c:${color}; --tint:${tint}%; --wash:${wash}%` }; };
const DEAL = 90, BEAT = 300;   // ms between cards dealt; a level-up's beat before the first
const COUNT = 0.7, ROW = 70;   // an end screen's tally: seconds a number counts up, ms between its rows

const CSS = `
.jf-modal { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(8, 10, 22, .62); z-index: 30;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; text-align: center; animation: jfIn .18s ease-out; }
.jf-modal[hidden] { display: none; }
@keyframes jfIn { from { opacity: 0; } }
.jf-modal h2 { margin: 0; font-size: 34px; letter-spacing: -.01em; text-shadow: 0 3px 12px #0009; }
.jf-modal .sub { margin: 6px 0 22px; opacity: .85; font-size: 15px; }
.jf-cards { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; padding: 0 16px; }
.jf-card { width: 200px; min-height: 190px; border-radius: 18px; background: color-mix(in srgb, var(--c) var(--wash, 0%), #1d2034); border: 3px solid var(--c); cursor: pointer; font: inherit; color: inherit;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 18px 14px; position: relative;
  box-shadow: 0 8px 28px #0008, inset 0 0 40px color-mix(in srgb, var(--c) var(--tint, 18%), transparent); transition: transform .12s; }
.jf-card.jf-sheen { background-image: linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--c) 22%, transparent) 48%, transparent 62%); background-size: 230% 100%; background-position: 65% 0; }
@keyframes jfSheen { 0% { background-position: 130% 0; } 42% { background-position: -30% 0; } 100% { background-position: -30% 0; } }
.jf-pick .ic { font-size: 56px; }
.jf-pick .jf-card { animation: jfDeal .3s ease-out backwards; animation-delay: var(--d, 0ms); }
@keyframes jfDeal { from { opacity: 0; transform: translateY(14px) scale(.96); } }
/* a Legendary pick card runs the deal-in and the sheen sweep together (the two
   animations touch different properties); declared together so neither replaces the other */
.jf-pick .jf-card.jf-sheen { animation: jfDeal .3s ease-out backwards, jfSheen 3.6s ease-in-out infinite; animation-delay: var(--d, 0ms), 0ms; }
.jf-pick .jf-card.jf-won { animation: jfWon .5s ease-out; }
@keyframes jfWon { 30% { transform: scale(1.06); box-shadow: 0 10px 34px #000a, inset 0 0 60px color-mix(in srgb, var(--c) 45%, transparent); } }
.jf-pick .jf-card.jf-burn { animation: jfBurn .62s ease-in forwards; pointer-events: none; }
@keyframes jfBurn { 20% { filter: brightness(1.6) sepia(.5) hue-rotate(-15deg); } 45% { filter: brightness(1.2) sepia(.85); transform: translateY(-3px); opacity: 1; } 100% { filter: grayscale(.9) brightness(.5) blur(1px); transform: translateY(-16px); opacity: 0; } }
/* a level-up: the title pops in, then the cards deal after a beat */
.jf-level h2 { animation: jfLevel .45s cubic-bezier(.2, 1.6, .4, 1) backwards; }
@keyframes jfLevel { from { transform: scale(.4); opacity: 0; } }
/* the end screens tally (tick): rows arrive one by one and numbers count up. The real number stays
   in the page (only hidden while it counts), so what the screen says is always the final one */
.jf-tally .jf-stats > * { animation: jfRow .28s ease-out backwards; animation-delay: var(--d, 0ms); }
.jf-tally.jf-done .jf-stats > * { animation: none; }
@keyframes jfRow { from { opacity: 0; transform: translateY(6px); } }
.jf-count.run { position: relative; -webkit-text-fill-color: transparent; }
.jf-count.run::after { content: attr(data-shown); position: absolute; right: 0; top: 0; white-space: nowrap; -webkit-text-fill-color: currentColor; }
.jf-best.on { display: inline-block; animation: jfBest .4s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes jfBest { from { transform: scale(2.4) rotate(-8deg); opacity: 0; } }
/* a golden award earned (award): your jelly wearing it, on turning gold rays, before the score */
.jf-award { position: fixed; inset: 0; z-index: 32; display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, #3a2a08f2, #0b0a14f5 62%);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; text-align: center; animation: jfIn .25s ease-out; }
.jf-award > div { display: grid; justify-items: center; gap: 6px; padding: 16px; }
.jf-award .eyebrow { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #ffd23a; }
.jf-award h2 { margin: 0; font-size: 34px; text-shadow: 0 3px 14px #000a; }
.jf-award .for { margin: 0; opacity: .85; font-size: 15px; }
.jf-award .face { position: relative; width: 190px; height: 190px; display: grid; place-items: center; margin: 6px 0 8px; }
.jf-award .face::before { content: ''; position: absolute; inset: -40px; border-radius: 50%; animation: jfRays 9s linear infinite;
  background: repeating-conic-gradient(#ffd23a55 0 10deg, transparent 10deg 30deg); -webkit-mask: radial-gradient(circle, #000 30%, transparent 70%); mask: radial-gradient(circle, #000 30%, transparent 70%); }
.jf-award .face img { position: relative; width: 150px; height: 150px; border-radius: 50%; box-shadow: 0 0 0 3px #ffd23a, 0 0 40px #ffd23a88; animation: jfRise .6s cubic-bezier(.2, 1.4, .4, 1) .1s backwards; }
@keyframes jfRays { to { transform: rotate(1turn); } }
@keyframes jfRise { from { transform: translateY(30px) scale(.6); opacity: 0; } }
.jf-award .btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
.jf-award button { font: 600 15px system-ui, sans-serif; border: 0; border-radius: 12px; padding: 11px 20px; cursor: pointer; background: #ffffff1c; color: #fff; }
.jf-award button.go { background: #ffd23a; color: #1d1a12; }
.jf-award button:disabled { opacity: .6; cursor: default; }
body.calm .jf-level h2, body.calm .jf-tally .jf-stats > *, body.calm .jf-best.on, body.calm .jf-award, body.calm .jf-award .face::before, body.calm .jf-award .face img { animation: none; }
@media (prefers-reduced-motion: reduce) { .jf-level h2, .jf-tally .jf-stats > *, .jf-best.on, .jf-award, .jf-award .face::before, .jf-award .face img { animation: none; } }
body.calm .jf-sheen, body.calm .jf-pick .jf-card, body.calm .jf-pick .jf-card.jf-sheen, body.calm .jf-pick .jf-card.jf-burn, body.calm .jf-pick .jf-card.jf-won { animation: none; }
@media (prefers-reduced-motion: reduce) { .jf-sheen, .jf-pick .jf-card, .jf-pick .jf-card.jf-sheen, .jf-pick .jf-card.jf-burn, .jf-pick .jf-card.jf-won { animation: none; } }
.jf-card .delta { font-size: 12.5px; font-weight: 700; letter-spacing: .04em; color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); padding: 2px 8px; border-radius: 999px; }
.jf-card:hover, .jf-card:focus-visible { transform: translateY(-6px) scale(1.03); outline: none; }
.jf-card .ic { font-size: 44px; line-height: 1.1; }
.jf-card .big { font-size: 22px; font-weight: 800; }
.jf-card .rar { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--c); }
.jf-card .now { font-size: 12.5px; opacity: .7; }
.jf-card .txt { font-size: 14px; line-height: 1.35; opacity: .92; }
.jf-card .key { position: absolute; top: 8px; left: 10px; font-size: 12px; opacity: .55; font-weight: 700; }
.jf-card .jf-new { position: absolute; top: -11px; right: 12px; box-shadow: 0 2px 8px #0008; font-size: 11px; font-weight: 800; letter-spacing: .06em; background: #ffd23a; color: #1d1a12; padding: 2px 7px; border-radius: 999px; }
/* the Treasure book: a grid per kind, found ones in their colour, the rest as ? */
.jf-book { width: min(900px, 94vw); max-height: 92vh; overflow-y: auto; padding: 12px 12px 16px; box-sizing: border-box; background: #12142af0; border-radius: 16px; }
.jf-book h3 { margin: 18px 0 8px; font-size: 17px; text-align: left; }
.jf-book h3 small { opacity: .65; font-weight: 600; }
.jf-book .say { position: sticky; top: 0; z-index: 1; margin: 0; padding: 8px 10px; min-height: 2.6em; font-size: 14px; background: #1d2034f0; border-radius: 10px; }
.jf-book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; }
.jf-book-grid button { font: 600 11px system-ui, sans-serif; color: #fff; background: color-mix(in srgb, var(--c, #fff) 12%, #1d2034); border: 2px solid var(--c, #ffffff22); border-radius: 10px;
  padding: 6px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; min-height: 64px; }
.jf-book-grid button .ic { font-size: 26px; line-height: 1.1; }
.jf-book-grid button:disabled { cursor: default; opacity: .4; }
.jf-modal .btns { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: min(760px, 94vw); margin-left: auto; margin-right: auto; }
.jf-modal .btns button { font: 600 15px system-ui, sans-serif; border: 0; border-radius: 12px; padding: 11px 20px; cursor: pointer; background: #ffffff1c; color: #fff; }
.jf-modal .btns button.go { background: #ffd23a; color: #1d1a12; }
.jf-modal .btns button:disabled { opacity: .35; cursor: default; }
.jf-stats { margin: 4px auto 0; display: grid; grid-template-columns: auto auto; gap: 4px 18px; text-align: left; font-size: 14px; opacity: .9; }
.jf-stats b { text-align: right; }
.jf-stats small { font-weight: 600; opacity: .75; }
.jf-stats .jf-unlock { width: 56px; height: 56px; border-radius: 50%; vertical-align: middle; margin-right: 10px; box-shadow: 0 0 0 2px #ffc93a99, 0 4px 14px #0008; }
/* the leaderboard: big rows, each player's own jelly by their name */
.jf-board { width: min(760px, 94vw); max-height: 100dvh; overflow-y: auto; padding: 16px 0; box-sizing: border-box; }
.jf-board .jf-stats { font-size: 22px; gap: 10px 36px; width: 100%; grid-template-columns: minmax(0, 1fr) auto; }
.jf-board .jf-stats > span { display: flex; align-items: center; gap: 12px; min-width: 0; }
.jf-board .jf-stats > b { align-self: center; font-size: 24px; }
.jf-board .jf-rank { font-style: normal; min-width: 1.6em; }
.jf-board .jf-jelly { width: var(--board-jelly-size, 80px); height: var(--board-jelly-size, 80px); border-radius: 50%; box-shadow: 0 0 0 2px #ffffff30, 0 4px 14px #0008; flex: none; }
.jf-board .jf-who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14em; }
.jf-score { font-size: 1.5em; color: #ffd23a; }
.jf-name { font: 600 15px system-ui, sans-serif; width: 11em; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid #ffffff55; background: #ffffff18; color: #fff; text-align: right; }
.jf-name::placeholder { color: #ffffff80; }
.jf-name:focus { outline: 2px solid #ffd23a; outline-offset: 1px; }
.jf-pop { position: fixed; left: 50%; top: 16%; transform: translateX(-50%); z-index: 25; background: #1d2034ee; border: 2px solid #ffd23a; border-radius: 16px;
  padding: 12px 18px; display: flex; gap: 12px; align-items: center; color: #fff; font-family: system-ui, sans-serif; box-shadow: 0 8px 28px #0009;
  pointer-events: none; animation: jfPop .25s ease-out; max-width: 90vw; }
.jf-pop[hidden] { display: none; }
@keyframes jfPop { from { transform: translateX(-50%) scale(.7); opacity: 0; } }
.jf-pop .ic { font-size: 38px; }
.jf-pop b { display: block; font-size: 17px; }
.jf-pop span { font-size: 14px; opacity: .9; }
@media (max-height: 520px), (max-width: 700px) {
  .jf-modal > div { max-height: 100%; overflow-y: auto; padding: 10px 0; box-sizing: border-box; }
  .jf-modal h2 { font-size: 24px; }
  .jf-modal .sub { margin: 2px 0 10px; font-size: 13px; }
  .jf-cards { gap: 8px; flex-wrap: nowrap; padding: 0 8px; }
  .jf-card { width: min(190px, 31vw); min-height: 0; padding: 12px 8px; border-radius: 14px; gap: 3px; }
  .jf-card .ic { font-size: 30px; }
  .jf-pick .ic { font-size: 34px; }
  .jf-card .delta { font-size: 11px; }
  .jf-card .big { font-size: 15px; }
  .jf-card .txt { font-size: 12px; }
  .jf-card .now { font-size: 11px; }
  .jf-card .key { display: none; }
  .jf-modal .btns { margin-top: 10px; }
  .jf-modal .btns small { display: none; }
  .jf-stats { font-size: 13px; }
  .jf-stats .jf-unlock { width: 40px; height: 40px; }
  .jf-board .jf-stats { font-size: 16px; gap: 6px 20px; }
  .jf-board .jf-stats > b { font-size: 17px; }
  .jf-board .jf-jelly { width: var(--board-jelly-size-phone, 56px); height: var(--board-jelly-size-phone, 56px); }
  .jf-pop { top: 12%; padding: 8px 12px; }
  .jf-award h2 { font-size: 24px; }
  .jf-award .face { width: 120px; height: 120px; margin: 2px 0 4px; }
  .jf-award .face img { width: 100px; height: 100px; }
  .jf-pop .ic { font-size: 28px; }
  .jf-pop b { font-size: 14px; }
  .jf-pop span { font-size: 12px; }
}
`;

export class UI {
  constructor(parent) {
    const style = document.createElement('style');
    style.textContent = CSS;
    parent.appendChild(style);
    this.modal = document.createElement('div');
    this.modal.className = 'jf-modal';
    this.modal.hidden = true;
    parent.appendChild(this.modal);
    this.pop = document.createElement('div');
    this.pop.className = 'jf-pop';
    this.pop.hidden = true;
    parent.appendChild(this.pop);
    this.keyHandler = null;
    this._gen = 0;         // bumped on every modal render/close, so a pick outro never hides a newer modal
    this._outro = 0;       // seconds of pick outro left (counted down by tick, on the game's clock)
    this._outroGen = 0;
    this._awardShown = 0;
    addEventListener('keydown', (e) => {
      // an award's reveal takes Enter, Space and Escape first: Continue
      if (this.awardEl && ['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); this.awardEl.querySelector('[data-next]').click(); return; }
      if (!this.modal.hidden && this.keyHandler) this.keyHandler(e);
    });
  }

  get open() { return !this.modal.hidden; }
  get closing() { return this._outro > 0 && this._outroGen === this._gen; }

  close() {
    this._outro = 0;
    this._tally = null;
    this.award([]);
    this._gen++;
    this.modal.hidden = true;
    this.modal.innerHTML = '';
    this.keyHandler = null;
    this.modal.classList.remove('jf-evolution');
  }

  evolution(evo, skip) {
    this.close();
    this.modal.classList.add('jf-evolution');
    this.modal.innerHTML = `<div class="jf-evolution-heading"><p>Metamorphosis</p><h2>${esc(evo.name)}</h2></div><div class="jf-evolution-footer"><p>${esc(evo.text)}</p><button type="button">Skip animation</button></div>`;
    this.modal.hidden = false;
    const button = this.modal.querySelector('button');
    this.modal.onclick = e => { if (e.target.closest('button')) skip(); };
    this.keyHandler = e => { if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); skip(); } };
    button.focus({ preventScroll: true });
    return this._gen;
  }

  // cards: from rollCards(); stats: current stats; onPick(card); onReroll() -> new cards or null
  // to: where the won card's icon flies (the HUD's level badge, a DOMRect). The cards deal in after a
  // beat (run.levelUp's ding) and leave like a treasure pick's (outro)
  levelUp(level, cards, stats, rerolls, onPick, onReroll, to = null) {
    const gen = ++this._gen;
    let out = false;
    const render = (beat) => {
      this.modal.innerHTML = `<div class="jf-level"><h2>Level ${level}!</h2><p class="sub">Choose an upgrade.</p>
        <div class="jf-cards jf-pick">${cards.map((c, i) => { const t = tierCard(c.rarity.name, c.rarity.color, beat + i * DEAL); return `
          <button class="jf-card${t.cls}" data-i="${i}" style="${t.style}">
            <span class="key">${i + 1}</span>
            <span class="ic">${STAT_INFO[c.stat].icon}</span>
            <span class="big">${cardText(c)}</span>
            <span class="rar">${c.rarity.name}</span>
            <span class="now">now ${STAT_INFO[c.stat].fmt(stats[c.stat])}</span>
          </button>`; }).join('')}</div>
        <div class="btns"><button data-act="reroll" ${rerolls > 0 ? '' : 'disabled'}>🎲 Reroll (${rerolls}) <small>[R]</small></button></div></div>`;
      this.dealSound(cards.map((c) => c.rarity.name), beat);
    };
    const pick = (i) => { const c = cards[i]; if (!c || out) return; out = true; this.outro(gen, i, to); onPick(c); };
    const reroll = () => {
      if (rerolls <= 0 || out) return;
      rerolls--;
      cards = onReroll();
      render(0);
    };
    render(calm() ? 0 : BEAT);
    this.modal.hidden = false;
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'reroll') reroll();
      else pick(+b.dataset.i);
    };
    this.keyHandler = (e) => {
      if (/^Digit[1-9]$/.test(e.code)) pick(+e.code.slice(-1) - 1);
      if (e.code === 'KeyR') reroll();
    };
  }

  // choices: [{ icon, name, text, tier?, delta? }] — the pick screen's order (plan step 1):
  // name, the big icon, the rarity written out, what it does, and a delta line when the
  // treasure grows (Lv 1 → Lv 2, ×1 → ×2)
  choose(title, sub, choices, onPick) {
    const gen = ++this._gen;
    this.modal.innerHTML = `<div><h2>${title}</h2><p class="sub">${sub}</p>
      <div class="jf-cards jf-pick">${choices.map((c, i) => { const t = tierCard(c.tier?.name, c.tier?.color || '#7ff6ee', i * DEAL); return `
        <button class="jf-card${t.cls}" data-i="${i}" style="${t.style}">
          <span class="key">${i + 1}</span>${c.fresh ? '<span class="jf-new">New!</span>' : ''}<span class="big">${c.name}</span><span class="ic">${c.icon}</span>${c.tier ? `<span class="rar">${c.tier.name}</span>` : ''}<span class="txt">${c.text}</span>${c.delta ? `<span class="delta">${c.delta}</span>` : ''}
        </button>`; }).join('')}</div></div>`;
    this.modal.hidden = false;
    this.dealSound(choices.map((c) => c.tier?.name), 0);
    let out = false;
    const pick = (i) => {
      const c = choices[i];
      if (!c || out) return;
      out = true;
      this.outro(gen, i);
      onPick(c);   // resume can capture the mouse during this click, before user activation expires
    };
    this.modal.onclick = (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
    this.keyHandler = (e) => { if (/^Digit[1-9]$/.test(e.code)) pick(+e.code.slice(-1) - 1); };
  }

  // A whoosh per card as it's dealt, then a chord as big as the rarest card's rarity
  dealSound(tiers, beat) {
    const d = calm() ? 0 : beat / 1000;
    tiers.forEach((_, i) => sfx.deal(d + (calm() ? 0 : i * DEAL / 1000)));
    sfx.reveal(Math.max(0, ...tiers.map((t) => TIERS.indexOf(t))), d + (calm() ? 0 : tiers.length * DEAL / 1000));
  }

  // A pick resolves at once (the game flows on exactly as before), but the modal stays up for one
  // beat so the moment can land: the won card pulses, its icon flies up (to `to`, else to where the
  // treasure toast appears), and the unpicked cards burn away
  outro(gen, i, to) {
    const cards = [...this.modal.querySelectorAll('.jf-card')];
    cards.forEach((el, j) => el.classList.add(j === i ? 'jf-won' : 'jf-burn'));
    this.flyIcon(cards[i], to);
    sfx.pick();
    if (cards.length > 1) sfx.burn();
    // the outro runs on the game's clock (tick, from GAME.step), not a wall timer:
    // a wall timer can't fire while the story harness steps the game synchronously
    this._outroGen = gen;
    this._outro = document.body.classList.contains('calm') ? 0.01 : 0.64;
  }

  // Count down a pick outro, and run an end screen's tally; called every GAME.step from main.js.
  // Closes the modal when an outro ends — unless a newer modal has replaced this one meanwhile (gen check).
  tick(dt) {
    if (this._outro > 0 && (this._outro -= dt) <= 0) {
      this._outro = 0;
      if (this._gen === this._outroGen) this.close();
    }
    const T = this._tally;
    if (!T || this.awardEl) return;          // (it waits for an award's reveal to be dismissed)
    T.t += dt;
    let counting = false;
    for (const c of T.counts) {
      if (c.done) continue;
      const k = Math.min(1, Math.max(0, (T.t - c.start) / COUNT)), e = 1 - Math.pow(1 - k, 3);
      c.el.dataset.shown = c.pre + Math.round(c.from + (c.n - c.from) * e).toLocaleString();
      if (k > 0 && k < 1) counting = true;
      if (k === 1) {
        c.done = true;
        c.el.classList.remove('run');
        if (c === T.counts[0]) { sfx.counted(); this.modal.querySelector('.jf-best')?.classList.add('on'); }
      }
    }
    if (counting) sfx.count(Math.min(1, T.t / (T.end || 1)));
    if (T.counts.every((c) => c.done)) this._tally = null;
  }

  // An end screen's numbers count up and its rows arrive one by one (message adds the stagger);
  // a tap on the screen (not a button) skips to the end. Reduce motion: everything at once
  tally(root) {
    this._tally = null;
    const counts = [...root.querySelectorAll('.jf-count')];
    if (!counts.length || calm()) return;
    root.classList.add('jf-tally');
    this._tally = { t: 0, counts: counts.map((el) => {
      const row = el.closest('[style*="--d"]'), start = row ? parseFloat(row.style.getPropertyValue('--d')) / 1000 : 0;
      const from = +el.dataset.from || 0, pre = el.dataset.pre || '';
      el.classList.add('run');
      el.dataset.shown = pre + from.toLocaleString();
      return { el, n: +el.dataset.n, from, pre, start, done: false };
    }) };
    this._tally.end = Math.max(...this._tally.counts.map((c) => c.start)) + COUNT;
  }

  // the end of a tally, now
  skipTally() {
    if (!this._tally) return;
    this._tally.t = 1e3;
    this.modal.firstElementChild?.classList.add('jf-done');
  }

  // A copy of the won card's icon, flown up to the treasure toast's spot (top centre), or to `to` (a DOMRect)
  flyIcon(card, to = null) {
    const ic = card?.querySelector('.ic');
    if (!ic || document.body.classList.contains('calm')) return;
    const r = ic.getBoundingClientRect(), el = document.createElement('span');
    el.textContent = ic.textContent;
    el.style.cssText = `position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px; font-size:${r.height}px; line-height:1; text-align:center; z-index:40; pointer-events:none; transition:all .55s cubic-bezier(.5,0,.8,.4);`;
    document.body.appendChild(el);
    const [x, y] = to ? [`${to.left + to.width / 2}px`, `${to.top + to.height / 2}px`] : ['50%', '13%'];
    requestAnimationFrame(() => { el.style.left = x; el.style.top = y; el.style.transform = 'translate(-50%,-50%) scale(.65)'; el.style.opacity = '.85'; });
    setTimeout(() => el.remove(), 620);
  }

  // rows: [[label, value]], buttons: [{ label, go, enter?, onClick }] (Enter presses the `enter` one, else the `go` one)
  // cls: a class for this dialog (the leaderboard's 'jf-board' lays its rows out big)
  // A value with a <span class="jf-count" data-n> in it counts up (tally)
  message(title, sub, rows, buttons, cls = '') {
    this._gen++;
    this.modal.innerHTML = `<div class="${cls}"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}
      ${rows.length ? `<div class="jf-stats">${rows.map(([k, v], i) => `<span style="--d:${i * ROW}ms">${k}</span><b style="--d:${i * ROW}ms">${v}</b>`).join('')}</div>` : ''}
      <div class="btns">${buttons.map((b, i) => `<button data-i="${i}" class="${b.go ? 'go' : ''}">${b.label}</button>`).join('')}</div></div>`;
    this.modal.hidden = false;
    this.tally(this.modal.firstElementChild);
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) { this.skipTally(); return; }
      sfx.tap();
      const btn = buttons[+b.dataset.i], vals = this.values();
      this.close();
      btn.onClick(vals);
    };
    this.keyHandler = (e) => { if (e.code === 'Enter') { const btn = buttons.find((b) => b.enter) || buttons.find((b) => b.go) || buttons[0], vals = this.values(); this.close(); btn.onClick(vals); } };
    if (!matchMedia('(pointer: coarse)').matches) this.modal.querySelector('input')?.focus({ preventScroll: true });   // not on phones: it would pop the keyboard up
  }

  // Golden awards earned (run.endRun), each revealed in turn over the end screen before its tally:
  // [{ name, need, face (a picture of your jelly wearing it), wear() }]. Wear it now puts it on.
  award(list) {
    this.awardEl?.remove();
    if (!list.length) { this.awardEl = null; this._awardShown = 0; return; }
    const [a, ...rest] = list, el = document.createElement('div');
    el.className = 'jf-award';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div><p class="eyebrow">Golden award unlocked${list.length + this._awardShown > 1 ? ` · ${this._awardShown + 1} of ${list.length + this._awardShown}` : ''}</p>
      <div class="face">${a.face ? `<img src="${a.face}" alt="">` : ''}</div>
      <h2>${esc(a.name)}</h2><p class="for">${esc(a.need)}</p>
      <div class="btns"><button data-wear>Wear it now</button><button class="go" data-next>Continue</button></div></div>`;
    this.modal.parentNode.appendChild(el);
    this.awardEl = el;
    sfx.award();
    const next = () => { this._awardShown++; this.award(rest); };
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (b && 'wear' in b.dataset) { sfx.tap(); a.wear(); b.disabled = true; b.textContent = 'Wearing it ✓'; }
      else if (b) { sfx.tap(); next(); }
    };
    el.querySelector('[data-next]').focus({ preventScroll: true });
  }

  // The Treasure book (run.showBook): sections [{ title, items: [{ icon, name, text, color?, found }] }].
  // Tap a found one to read what it does; unfound ones stay a ?
  book(title, sections, onBack) {
    this._gen++;
    const cell = (it) => (it.found
      ? `<button data-say="${esc(`${it.icon} ${it.name}: ${it.text}`)}" style="--c:${it.color || '#7ff6ee'}"><span class="ic">${it.icon}</span><span>${esc(it.name)}</span></button>`
      : '<button disabled aria-label="Not found yet"><span class="ic">?</span><span>???</span></button>');
    this.modal.innerHTML = `<div class="jf-book"><h2>${title}</h2><p class="say" aria-live="polite">Select a discovery to read more.</p>
      ${sections.map((s) => `<h3>${s.title} <small>${s.items.filter((it) => it.found).length} / ${s.items.length}</small></h3><div class="jf-book-grid">${s.items.map(cell).join('')}</div>`).join('')}
      <div class="btns"><button class="go" data-back>Back</button></div></div>`;
    this.modal.hidden = false;
    const back = () => { this.close(); onBack(); };
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (b) sfx.tap();
      if (b?.dataset.say) this.modal.querySelector('.say').textContent = b.dataset.say;
      else if (b && 'back' in b.dataset) back();
    };
    this.keyHandler = (e) => { if (e.code === 'Escape' || e.code === 'Enter') back(); };
  }

  // what's typed into the dialog's named inputs: { name: value }
  values() { return Object.fromEntries([...this.modal.querySelectorAll('input[name]')].map((i) => [i.name, i.value])); }

  treasure(t, count = 1) {
    const amount = t.levels?.length > 1 ? `Level ${count}` : t.stack > 1 ? `×${count}` : '';
    this.pop.innerHTML = `<span class="ic">${t.icon}</span><div><b>${t.name}</b>${amount ? `<span>${amount}</span>` : ''}</div>`;
    this.pop.hidden = false;
    clearTimeout(this._popT);
    this._popT = setTimeout(() => { this.pop.hidden = true; }, 3600);
  }
}
