// Character creator panel. Edits a look object and reports every change so the
// game can rebuild the model live; main.js handles the camera and saving.
import { OPTIONS, SPECIES, SWATCHES, DEFAULT_LOOK, OWN_COLOR_TOPS, randomLook, normalizeLook } from './character.js';
import { esc } from './leaderboard.js';
import { requirement, unlocked, requirementText, feats, price, bank, buy } from './cosmetics.js';

const CSS = `
#creator { position: fixed; top: 0; right: 0; bottom: 0; width: min(360px, 100vw); display: flex; flex-direction: column;
  background: rgba(22, 20, 30, .82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); color: #f3f0ea;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; border-left: 1px solid #ffffff1c; z-index: 20; }
#creator[hidden] { display: none; }
#creator header { padding: 18px 20px 6px; }
#creator h2 { margin: 0; font-size: 22px; letter-spacing: -.01em; }
#creator header p { margin: 2px 0 0; color: #c9c3d6; font-size: 13px; }
#creator .scroll { flex: 1; overflow-y: auto; padding: 4px 20px 16px; }
#creator .sec { margin-top: 14px; }
#creator .lbl { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #b9b2c8; margin-bottom: 6px; }
#creator .chips { display: flex; flex-wrap: wrap; gap: 6px; }
#creator .chips button { border: 1px solid #ffffff26; background: #ffffff0f; color: inherit; font: inherit; font-size: 13px;
  padding: 6px 11px; border-radius: 999px; cursor: pointer; }
#creator .chips button:hover { background: #ffffff1f; }
#creator .chips button.on { background: #ffd23a; color: #1d1a12; border-color: transparent; font-weight: 600; }
#creator .chips button.locked { opacity: .5; cursor: help; border-style: dashed; border-color: #ffd23a88; }
#creator .need { margin-top: 6px; font-size: 12.5px; color: #ffd98a; }
#creator .need:empty { display: none; }
#creator .need button { margin-left: 8px; border: 0; border-radius: 999px; padding: 5px 12px; font: inherit; font-weight: 700; background: #ffd23a; color: #1d1a12; cursor: pointer; }
#creator .chips button.shop { border-color: #9fe3ff88; }
#creator .pearls { margin-top: 4px; font-size: 13.5px; color: #e9f6ff; font-variant-numeric: tabular-nums; }
#creator .blurb { margin-top: 6px; font-size: 13px; color: #c9c3d6; }
#creator .sw { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
#creator .sw button { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ffffff30; cursor: pointer; padding: 0; }
#creator .sw button.on { border-color: #fff; box-shadow: 0 0 0 2px #ffd23a; }
#creator .sw input[type=color] { width: 30px; height: 26px; border: 0; background: none; padding: 0; cursor: pointer; }
#creator input[type=text] { width: 100%; box-sizing: border-box; background: #ffffff12; border: 1px solid #ffffff2a; color: inherit;
  font: inherit; font-size: 16px; font-weight: 600; padding: 8px 10px; border-radius: 10px; outline: none; }
#creator input[type=text]:focus { border-color: #ffd23a; }
#creator input[type=range] { width: 100%; accent-color: #ffd23a; }
#creator footer { display: flex; gap: 8px; padding: 12px 20px 18px; border-top: 1px solid #ffffff14; }
#creator footer button { border: 0; font: inherit; font-weight: 600; border-radius: 12px; padding: 11px 14px; cursor: pointer; }
#creator .ghost { background: #ffffff14; color: inherit; }
#creator .go { flex: 1; background: #ffd23a; color: #1d1a12; font-size: 15px; }
.cr-hint { position: fixed; left: 0; right: min(360px, 100vw); bottom: 18px; text-align: center; color: #fff; opacity: .8;
  font: 13px system-ui, sans-serif; text-shadow: 0 1px 3px #000; pointer-events: none; }
@media (max-width: 640px) { #creator { top: auto; height: 58vh; width: 100vw; border-left: 0; border-top: 1px solid #ffffff1c; }
  .cr-hint { right: 0; bottom: calc(58vh + 10px); } }
`;

const COLOR_ROWS = [['color', 'Bell and tentacle color'], ['accent', 'Arm color'], ['eyeColor', 'Eye color'], ['topColor', 'Hat color']];

export class Creator {
  constructor({ onChange, onDone }) {
    this.onChange = onChange;
    this.onDone = onDone;
    this.look = { ...DEFAULT_LOOK };
    this.el = document.createElement('div');
    this.el.innerHTML = `<style>${CSS}</style><div id="creator" hidden>
      <header><h2>Make your jellyfish</h2><p class="pearls"></p></header>
      <div class="scroll"></div>
      <footer><button class="ghost" data-act="random" title="Randomize">🎲 Surprise me</button><button class="go" data-act="done">Let's go!</button></footer>
      </div><div class="cr-hint" hidden>Drag to spin your jellyfish</div>`;
    this.panel = this.el.querySelector('#creator');
    this.hint = this.el.querySelector(".cr-hint");
    this.body = this.el.querySelector('.scroll');
    this.panel.addEventListener('click', (e) => this.click(e));
    this.panel.addEventListener('input', (e) => this.input(e));
    // keep keys typed here away from the game
    this.panel.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.matches('input[type=text]')) e.target.blur();
    });
  }

  mount(parent) { parent.appendChild(this.el); }
  get isOpen() { return !this.panel.hidden; }

  open(look) {
    this.look = normalizeLook(look);
    this.render();
    this.panel.hidden = this.hint.hidden = false;
  }

  close() { this.panel.hidden = this.hint.hidden = true; }

  render() {
    const L = this.look;
    // an earned option not yet earned shows locked, with what it asks for and how far along you are
    // (tap it to read that here: a phone has no hover)
    // a shop look not yet bought shows its price in Pearls (tap it to buy it here)
    const F = feats(), B = bank();
    this.el.querySelector('.pearls').textContent = `🦪 ${B.pearls.toLocaleString()} Pearls · every run you finish earns more`;
    const chips = (key, label) => `<div class="sec"><div class="lbl">${label}</div><div class="chips">${
      OPTIONS[key].map(([id, name]) => {
        const need = requirement(key, id), cost = price(key, id), open = unlocked(key, id, F, B.bought);
        const lock = open ? '' : need ? ` data-need="${esc(name + ' · ' + requirementText(need, F))}" title="${esc(requirementText(need, F))}"` : ` data-cost="${cost}" data-name="${esc(name)}" title="${cost} Pearls"`;
        return `<button data-k="${key}" data-v="${id}"${lock} class="${L[key] === id ? 'on' : ''}${open ? '' : ' locked'}${cost ? ' shop' : ''}">${need ? '✨ ' : ''}${name}${open ? '' : need ? ' 🔒' : ` · 🦪 ${cost}`}</button>`;
      }).join('')}</div><div class="need" data-for="${key}"></div></div>`;
    const colors = (key, label) => `<div class="sec"><div class="lbl">${label}</div><div class="sw">${
      SWATCHES.map((c) => `<button data-k="${key}" data-v="${c}" style="background:${c}" class="${L[key].toLowerCase() === c ? 'on' : ''}" aria-label="${c}"></button>`).join('')
    }<input type="color" data-k="${key}" value="${L[key]}" title="Any color"></div></div>`;
    this.body.innerHTML = `
      <div class="sec"><div class="lbl">Name</div><input type="text" data-k="name" maxlength="16" value="${esc(L.name)}"></div>
      ${chips('body', 'Jellyfish')}
      <div class="blurb">${SPECIES[L.body].blurb}</div>
      ${colors('color', COLOR_ROWS[0][1])}
      ${colors('accent', COLOR_ROWS[1][1])}
      ${chips('pattern', 'Bell pattern')}
      ${chips('finish', 'Finish')}
      ${chips('eyes', 'Eyes')}
      ${colors('eyeColor', COLOR_ROWS[2][1])}
      ${chips('mouth', 'Mouth')}
      ${chips('top', 'On top')}
      ${!OWN_COLOR_TOPS.includes(L.top) ? colors('topColor', COLOR_ROWS[3][1]) : ''}`;
  }

  set(key, value, rerender = true) {
    this.look = normalizeLook({ ...this.look, [key]: value });
    if (rerender) this.render();
    this.onChange(this.look);
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.need) {                   // locked: say what it takes
      const note = this.body.querySelector(`.need[data-for="${b.dataset.k}"]`);
      if (note) note.textContent = '🔒 ' + b.dataset.need;
      return;
    }
    if (b.dataset.cost) {                   // in the shop: its price, and Buy when you have enough
      const note = this.body.querySelector(`.need[data-for="${b.dataset.k}"]`), cost = +b.dataset.cost, have = bank().pearls;
      if (note) note.innerHTML = `🦪 ${esc(b.dataset.name)} · ${cost} Pearls` + (have >= cost
        ? `<button data-buy="${b.dataset.k}" data-v="${b.dataset.v}">Buy</button>`
        : ` <small>(you have ${have}: finish more runs to earn them)</small>`);
      return;
    }
    if (b.dataset.buy) {
      if (buy(b.dataset.buy, b.dataset.v)) this.set(b.dataset.buy, b.dataset.v);   // bought: wear it straight away
      return;
    }
    if (b.dataset.act === 'random') {
      this.look = randomLook((key, id) => unlocked(key, id));
      this.render();
      this.onChange(this.look);
    } else if (b.dataset.act === 'done') {
      this.onDone(this.look);
    } else if (b.dataset.k) {
      const k = b.dataset.k;
      this.set(k, b.dataset.v);
    }
  }

  input(e) {
    const t = e.target;
    const k = t.dataset.k;
    if (!k) return;
    if (k === 'name') this.set(k, t.value, false);
    else if (t.type === 'color') this.set(k, t.value, false);
  }
}
