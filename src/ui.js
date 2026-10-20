// Full-screen choices and messages: level-up cards, treasure reveal, metamorphosis, run end.
import { STAT_INFO, cardText } from './stats.js';
import { esc } from './leaderboard.js';

// How hard a pick card wears its rarity (treasure-pick-screen plan, step 2): the whole
// card washes and glows in the tier colour, harder the rarer it is — [inner glow %, background wash %].
// Cards that set neither (level-up cards) keep the original 18% glow and no wash.
const TIER_TINT = { Common: [18, 0], Rare: [26, 6], Epic: [36, 12], Legendary: [48, 20] };

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
.jf-modal .btns { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: min(760px, 94vw); margin-left: auto; margin-right: auto; }
.jf-modal .btns button { font: 600 15px system-ui, sans-serif; border: 0; border-radius: 12px; padding: 11px 20px; cursor: pointer; background: #ffffff1c; color: #fff; }
.jf-modal .btns button.go { background: #ffd23a; color: #1d1a12; }
.jf-modal .btns button:disabled { opacity: .35; cursor: default; }
.jf-stats { margin: 4px auto 0; display: grid; grid-template-columns: auto auto; gap: 4px 18px; text-align: left; font-size: 14px; opacity: .9; }
.jf-stats b { text-align: right; }
.jf-stats small { font-weight: 600; opacity: .75; }
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
  .jf-pop { top: 12%; padding: 8px 12px; }
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
    addEventListener('keydown', (e) => { if (!this.modal.hidden && this.keyHandler) this.keyHandler(e); });
  }

  get open() { return !this.modal.hidden; }

  close() {
    this._outro = 0;
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
  levelUp(level, cards, stats, rerolls, onPick, onReroll) {
    this._gen++;
    const render = () => {
      this.modal.innerHTML = `<div><h2>Level ${level}!</h2><p class="sub">Your polyp grows. Pick one.</p>
        <div class="jf-cards">${cards.map((c, i) => `
          <button class="jf-card" data-i="${i}" style="--c:${c.rarity.color}">
            <span class="key">${i + 1}</span>
            <span class="ic">${STAT_INFO[c.stat].icon}</span>
            <span class="big">${cardText(c)}</span>
            <span class="rar">${c.rarity.name}</span>
            <span class="now">now ${STAT_INFO[c.stat].fmt(stats[c.stat])}</span>
          </button>`).join('')}</div>
        <div class="btns"><button data-act="reroll" ${rerolls > 0 ? '' : 'disabled'}>🎲 Reroll (${rerolls}) <small>[R]</small></button></div></div>`;
    };
    const pick = (i) => { const c = cards[i]; if (!c) return; this.close(); onPick(c); };
    const reroll = () => {
      if (rerolls <= 0) return;
      rerolls--;
      cards = onReroll();
      render();
    };
    render();
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
      <div class="jf-cards jf-pick">${choices.map((c, i) => { const [tint, wash] = TIER_TINT[c.tier?.name] || [18, 0]; return `
        <button class="jf-card${c.tier?.name === 'Legendary' ? ' jf-sheen' : ''}" data-i="${i}" style="--d:${i * 90}ms; --c:${c.tier?.color || '#7ff6ee'}; --tint:${tint}%; --wash:${wash}%">
          <span class="key">${i + 1}</span><span class="big">${c.name}</span><span class="ic">${c.icon}</span>${c.tier ? `<span class="rar">${c.tier.name}</span>` : ''}<span class="txt">${c.text}</span>${c.delta ? `<span class="delta">${c.delta}</span>` : ''}
        </button>`; }).join('')}</div></div>`;
    this.modal.hidden = false;
    // The pick resolves at once (the game flows on exactly as before), but the modal
    // stays up for one beat so the moment can land: the won card pulses, its icon
    // flies up to where the treasure toast appears, and the unpicked cards burn away.
    let out = false;
    const pick = (i) => {
      const c = choices[i];
      if (!c || out) return;
      out = true;
      const cards = [...this.modal.querySelectorAll('.jf-card')];
      cards.forEach((el, j) => el.classList.add(j === i ? 'jf-won' : 'jf-burn'));
      this.flyIcon(cards[i]);
      onPick(c);
      // the outro runs on the game's clock (tick, from GAME.step), not a wall timer:
      // a wall timer can't fire while the story harness steps the game synchronously
      this._outroGen = gen;
      this._outro = document.body.classList.contains('calm') ? 0.01 : 0.64;
    };
    this.modal.onclick = (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
    this.keyHandler = (e) => { if (/^Digit[1-9]$/.test(e.code)) pick(+e.code.slice(-1) - 1); };
  }

  // Count down a pick outro; called every GAME.step from main.js. Closes the modal
  // when it ends — unless a newer modal has replaced this one meanwhile (gen check).
  tick(dt) {
    if (this._outro > 0 && (this._outro -= dt) <= 0) {
      this._outro = 0;
      if (this._gen === this._outroGen) this.close();
    }
  }

  // A copy of the won card's icon, flown up to the treasure toast's spot (top centre).
  flyIcon(card) {
    const ic = card?.querySelector('.ic');
    if (!ic || document.body.classList.contains('calm')) return;
    const r = ic.getBoundingClientRect(), el = document.createElement('span');
    el.textContent = ic.textContent;
    el.style.cssText = `position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px; font-size:${r.height}px; line-height:1; text-align:center; z-index:40; pointer-events:none; transition:all .55s cubic-bezier(.5,0,.8,.4);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.left = '50%'; el.style.top = '13%'; el.style.transform = 'translate(-50%,-50%) scale(.65)'; el.style.opacity = '.85'; });
    setTimeout(() => el.remove(), 620);
  }

  // rows: [[label, value]], buttons: [{ label, go, onClick }]
  message(title, sub, rows, buttons) {
    this._gen++;
    this.modal.innerHTML = `<div><h2>${title}</h2><p class="sub">${sub}</p>
      ${rows.length ? `<div class="jf-stats">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>` : ''}
      <div class="btns">${buttons.map((b, i) => `<button data-i="${i}" class="${b.go ? 'go' : ''}">${b.label}</button>`).join('')}</div></div>`;
    this.modal.hidden = false;
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const btn = buttons[+b.dataset.i], vals = this.values();
      this.close();
      btn.onClick(vals);
    };
    this.keyHandler = (e) => { if (e.code === 'Enter') { const btn = buttons.find((b) => b.go) || buttons[0], vals = this.values(); this.close(); btn.onClick(vals); } };
    if (!matchMedia('(pointer: coarse)').matches) this.modal.querySelector('input')?.focus({ preventScroll: true });   // not on phones: it would pop the keyboard up
  }

  // what's typed into the dialog's named inputs: { name: value }
  values() { return Object.fromEntries([...this.modal.querySelectorAll('input[name]')].map((i) => [i.name, i.value])); }

  treasure(t) {
    this.pop.innerHTML = `<span class="ic">${t.icon}</span><div><b>${t.name}</b><span>${t.text}</span></div>`;
    this.pop.hidden = false;
    clearTimeout(this._popT);
    this._popT = setTimeout(() => { this.pop.hidden = true; }, 3600);
  }
}
