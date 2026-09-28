// Full-screen choices and messages: level-up cards, treasure reveal, metamorphosis, run end.
import { STAT_INFO, cardText } from './stats.js';

const CSS = `
.jf-modal { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(8, 10, 22, .62); z-index: 30;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; text-align: center; animation: jfIn .18s ease-out; }
.jf-modal[hidden] { display: none; }
@keyframes jfIn { from { opacity: 0; } }
.jf-modal h2 { margin: 0; font-size: 34px; letter-spacing: -.01em; text-shadow: 0 3px 12px #0009; }
.jf-modal .sub { margin: 6px 0 22px; opacity: .85; font-size: 15px; }
.jf-cards { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; padding: 0 16px; }
.jf-card { width: 200px; min-height: 190px; border-radius: 18px; background: #1d2034; border: 3px solid var(--c); cursor: pointer; font: inherit; color: inherit;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 18px 14px; position: relative;
  box-shadow: 0 8px 28px #0008, inset 0 0 40px color-mix(in srgb, var(--c) 18%, transparent); transition: transform .12s; }
.jf-card:hover, .jf-card:focus-visible { transform: translateY(-6px) scale(1.03); outline: none; }
.jf-card .ic { font-size: 44px; line-height: 1.1; }
.jf-card .big { font-size: 22px; font-weight: 800; }
.jf-card .rar { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--c); }
.jf-card .now { font-size: 12.5px; opacity: .7; }
.jf-card .txt { font-size: 14px; line-height: 1.35; opacity: .92; }
.jf-card .key { position: absolute; top: 8px; left: 10px; font-size: 12px; opacity: .55; font-weight: 700; }
.jf-modal .btns { margin-top: 22px; display: flex; gap: 10px; justify-content: center; }
.jf-modal .btns button { font: 600 15px system-ui, sans-serif; border: 0; border-radius: 12px; padding: 11px 20px; cursor: pointer; background: #ffffff1c; color: #fff; }
.jf-modal .btns button.go { background: #ffd23a; color: #1d1a12; }
.jf-modal .btns button:disabled { opacity: .35; cursor: default; }
.jf-stats { margin: 4px auto 0; display: grid; grid-template-columns: auto auto; gap: 4px 18px; text-align: left; font-size: 14px; opacity: .9; }
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
    addEventListener('keydown', (e) => { if (!this.modal.hidden && this.keyHandler) this.keyHandler(e); });
  }

  get open() { return !this.modal.hidden; }

  close() {
    this.modal.hidden = true;
    this.modal.innerHTML = '';
    this.keyHandler = null;
  }

  // cards: from rollCards(); stats: current stats; onPick(card); onReroll() -> new cards or null
  levelUp(level, cards, stats, rerolls, onPick, onReroll) {
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
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pick(+e.code.slice(-1) - 1);
      if (e.code === 'KeyR') reroll();
    };
  }

  // choices: [{ icon, name, text }]
  choose(title, sub, choices, onPick) {
    this.modal.innerHTML = `<div><h2>${title}</h2><p class="sub">${sub}</p>
      <div class="jf-cards">${choices.map((c, i) => `
        <button class="jf-card" data-i="${i}" style="--c:#7ff6ee">
          <span class="key">${i + 1}</span><span class="ic">${c.icon}</span><span class="big">${c.name}</span><span class="txt">${c.text}</span>
        </button>`).join('')}</div></div>`;
    this.modal.hidden = false;
    const pick = (i) => { const c = choices[i]; if (!c) return; this.close(); onPick(c); };
    this.modal.onclick = (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
    this.keyHandler = (e) => { if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pick(+e.code.slice(-1) - 1); };
  }

  // rows: [[label, value]], buttons: [{ label, go, onClick }]
  message(title, sub, rows, buttons) {
    this.modal.innerHTML = `<div><h2>${title}</h2><p class="sub">${sub}</p>
      ${rows.length ? `<div class="jf-stats">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>` : ''}
      <div class="btns">${buttons.map((b, i) => `<button data-i="${i}" class="${b.go ? 'go' : ''}">${b.label}</button>`).join('')}</div></div>`;
    this.modal.hidden = false;
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const btn = buttons[+b.dataset.i];
      this.close();
      btn.onClick();
    };
    this.keyHandler = (e) => { if (e.code === 'Enter') { const btn = buttons.find((b) => b.go) || buttons[0]; this.close(); btn.onClick(); } };
  }

  treasure(t) {
    this.pop.innerHTML = `<span class="ic">${t.icon}</span><div><b>${t.name}</b><span>${t.text}</span></div>`;
    this.pop.hidden = false;
    clearTimeout(this._popT);
    this._popT = setTimeout(() => { this.pop.hidden = true; }, 3600);
  }
}
