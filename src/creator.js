// Character creator panel. Edits a look object and reports every change so the
// game can rebuild the model live; main.js handles the camera and saving.
// A locked option (an award not earned, a shop look not bought) can be tried on: tapping it shows it
// on the jelly through onPreview only, never in this.look, so it can't be saved or carried into a run.
// Picking anything else, Surprise me, Done or closing puts the jelly back to this.look.
import { OPTIONS, SPECIES, SWATCHES, DEFAULT_LOOK, OWN_COLOR_TOPS, randomLook, normalizeLook } from './character.js';
import { esc } from './leaderboard.js';
import { requirement, unlocked, requirementText, feats, price, bank, buy } from './cosmetics.js';
import { sfx } from './sfx.js';
import { icon } from './icons.js';

const CSS = `
#creator { position: fixed; top: 0; right: 0; bottom: 0; width: min(360px, 100vw); display: flex; flex-direction: column; box-sizing: border-box;
  background: var(--ui-panel); color: var(--ui-ink); font: 400 var(--ui-size-body)/1.4 var(--ui-font-text); border-left: 1px solid var(--ui-line); z-index: 20; }
#creator[hidden] { display: none; }
#creator header { flex-shrink: 0; padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-1); }
#creator h2 { margin: 0; font: 600 var(--ui-size-title)/1.1 var(--ui-font-display); }
#creator .pearls { display: flex; align-items: center; gap: var(--ui-space-1); margin: var(--ui-space-1) 0 0; color: var(--ui-ink-dim); font-size: var(--ui-size-label); font-variant-numeric: tabular-nums; }
#creator .pearls .ui-icon { color: var(--ui-mint); }
#creator .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: var(--ui-space-1) var(--ui-space-4) 32px; }
/* a row cut at the fold fades out, so it reads as "more below", not as broken pills (the bottom padding clears it at the end) */
#creator .scroll { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 32px), transparent); }
#creator .sec { margin-top: var(--ui-space-4); }
#creator .lbl { margin-bottom: var(--ui-space-2); font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); letter-spacing: .06em; text-transform: uppercase; color: var(--ui-ink-dim); }
#creator .chips { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
#creator .chips .ui-chip.locked { color: var(--ui-ink-dim); border-style: dashed; cursor: help; }
#creator .chips .ui-chip.locked.try { color: var(--ui-ink); border-style: solid; border-color: var(--ui-gold); }
#creator .chips .ui-chip.shop { border-color: color-mix(in srgb, var(--ui-mint) 50%, transparent); }
#creator .chips .ui-chip .ui-icon { width: 1em; height: 1em; }
#creator .need { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-line); font-size: var(--ui-size-label); color: var(--ui-gold); }
#creator .need:empty { display: none; }
#creator .need .ui-icon { width: 1em; height: 1em; }
#creator .blurb { margin-top: var(--ui-space-2); font-size: var(--ui-size-label); color: var(--ui-ink-dim); }
#creator .sw { display: flex; flex-wrap: wrap; gap: 0; align-items: center; }
#creator .sw button { position: relative; width: var(--ui-target); height: var(--ui-target); padding: 0; border: 0; background: none; cursor: pointer; }   /* a 44 px target round a 24 px dot */
#creator .sw button::before { content: ""; position: absolute; inset: 10px; border-radius: 50%; background: var(--c); border: 2px solid var(--ui-line); box-sizing: border-box; }
#creator .sw button.on::before { border-color: var(--ui-ink); box-shadow: 0 0 0 2px var(--ui-gold); }
#creator .sw button:focus-visible { outline: 2px solid var(--ui-mint); outline-offset: -4px; border-radius: 50%; }
#creator .sw input[type=color] { width: var(--ui-target); height: var(--ui-target); border: 0; background: none; padding: 6px; cursor: pointer; }
#creator input[type=text] { width: 100%; box-sizing: border-box; min-height: var(--ui-target); background: var(--ui-glass); border: 1px solid var(--ui-line); color: inherit;
  font: 600 16px var(--ui-font-text); padding: 6px var(--ui-space-3); border-radius: var(--ui-radius-s); outline: none; }
#creator input[type=text]:focus { border-color: var(--ui-gold); }
#creator footer { flex-shrink: 0; display: flex; gap: var(--ui-space-2); padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-line); background: var(--ui-panel-raised); }
#creator footer .go { flex: 1; font-size: var(--ui-size-heading); }
.cr-hint { position: fixed; left: 0; right: min(360px, 100vw); bottom: 18px; text-align: center; color: var(--ui-ink); opacity: .85;
  font: 400 var(--ui-size-label) var(--ui-font-text); text-shadow: 0 1px 3px var(--ui-shade); pointer-events: none; }
@media (max-width: 640px) { #creator { top: auto; height: 58vh; width: 100vw; border-left: 0; border-top: 1px solid var(--ui-line); }
  .cr-hint { right: 0; bottom: calc(58vh + 10px); } }
`;

const COLOR_ROWS = [['color', 'Bell and tentacle color'], ['accent', 'Arm and rim color'], ['eyeColor', 'Eye color'], ['topColor', 'Hat color']];

export class Creator {
  constructor({ onChange, onDone, onPreview }) {
    this.onChange = onChange;
    this.onPreview = onPreview;
    this.trying = false;
    this.onDone = onDone;
    this.look = { ...DEFAULT_LOOK };
    this.el = document.createElement('div');
    this.el.innerHTML = `<style>${CSS}</style><div id="creator" hidden>
      <header><h2>Change your look</h2><p class="pearls"></p></header>
      <div class="scroll"></div>
      <div class="need" aria-live="polite"></div>
      <footer><button class="ui-btn" data-act="random" title="Randomize">${icon('reroll')} Surprise me</button><button class="ui-btn ui-btn--primary go" data-act="done">Let's go!</button></footer>
      </div><div class="cr-hint" hidden>Drag to spin your jellyfish</div>`;
    this.panel = this.el.querySelector('#creator');
    this.hint = this.el.querySelector(".cr-hint");
    this.body = this.el.querySelector('.scroll');
    this.note = this.panel.querySelector('.need');
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

  close() { this.untry(true); this.panel.hidden = this.hint.hidden = true; }

  // try a locked option on: the jelly wears it, the look doesn't change
  // (the line over the jelly says what it takes: the row's note can be scrolled out of sight)
  tryOn(b, says) {
    this.body.querySelectorAll('.chips button.try').forEach((x) => x.classList.remove('try'));
    b.classList.add('try');
    this.trying = true;
    this.hint.textContent = 'Trying it on · ' + says;
    this.onPreview?.({ ...this.look, [b.dataset.k]: b.dataset.v });
  }
  // stop trying on; show = put the jelly back now (otherwise the caller's onChange rebuilds it)
  untry(show = false) {
    this.note.textContent = '';
    if (!this.trying) return;
    this.trying = false;
    this.hint.textContent = 'Drag to spin your jellyfish';
    if (show) this.onPreview?.(this.look);
  }

  render() {
    this.note.textContent = '';
    const L = this.look;
    // an earned option not yet earned shows locked, with what it asks for and how far along you are
    // (tap it to read that here: a phone has no hover)
    // a shop look not yet bought shows its price in Pearls (tap it to buy it here)
    const F = feats(), B = bank();
    this.el.querySelector('.pearls').innerHTML = `${icon('pearl')} ${B.pearls.toLocaleString()} Pearls · every run you finish earns more`;
    const chips = (key, label) => `<div class="sec"><div class="lbl">${label}</div><div class="chips">${
      OPTIONS[key].map(([id, name]) => {
        const need = requirement(key, id), cost = price(key, id), open = unlocked(key, id, F, B.bought);
        const lock = open ? '' : need ? ` data-need="${esc(name + ' · ' + requirementText(need, F))}" title="${esc(requirementText(need, F))}"` : ` data-cost="${cost}" data-name="${esc(name)}" title="${cost} Pearls"`;
        return `<button data-k="${key}" data-v="${id}"${lock} aria-pressed="${L[key] === id}" class="ui-chip ${L[key] === id ? 'on' : ''}${open ? '' : ' locked'}${cost ? ' shop' : ''}">${need ? icon('star') : ''}${name}${open ? '' : need ? icon('lock') : ` · ${icon('pearl')} ${cost}`}</button>`;
      }).join('')}</div></div>`;
    const colors = (key, label) => `<div class="sec"><div class="lbl">${label}</div><div class="sw">${
      SWATCHES.map((c) => `<button data-k="${key}" data-v="${c}" style="--c:${c}" class="${L[key].toLowerCase() === c ? 'on' : ''}" aria-label="${c}"></button>`).join('')
    }<input type="color" data-k="${key}" value="${L[key]}" title="Any color"></div></div>`;
    this.body.innerHTML = `
      <div class="sec"><div class="lbl">Name</div><input type="text" data-k="name" maxlength="16" value="${esc(L.name)}"></div>
      ${chips('body', 'Jellyfish')}
      <div class="blurb">${SPECIES[L.body].blurb}</div>
      ${colors('color', COLOR_ROWS[0][1])}
      ${colors('accent', COLOR_ROWS[1][1])}
      ${chips('pattern', 'Bell pattern')}
      ${chips('arms', 'Arms')}
      ${chips('tentacles', 'Tentacles')}
      ${chips('finish', 'Finish')}
      ${chips('eyes', 'Eyes')}
      ${colors('eyeColor', COLOR_ROWS[2][1])}
      ${chips('mouth', 'Mouth')}
      ${chips('top', 'On top')}
      ${!OWN_COLOR_TOPS.includes(L.top) ? colors('topColor', COLOR_ROWS[3][1]) : ''}`;
  }

  set(key, value, rerender = true) {
    this.untry();
    this.look = normalizeLook({ ...this.look, [key]: value });
    if (rerender) this.render();
    this.onChange(this.look);
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (!b.dataset.buy) sfx.tap();
    if (b.dataset.need) {                   // locked: try it on and say what it takes
      const note = this.note;
      note.dataset.for = b.dataset.k;
      if (note) note.innerHTML = `${icon('lock')} ${esc(b.dataset.need)}`;
      this.tryOn(b, b.dataset.need);
      return;
    }
    if (b.dataset.cost) {                   // in the shop: try it on, its price, and Buy when you have enough
      this.tryOn(b, `${b.dataset.name} · ${b.dataset.cost} Pearls`);
      const note = this.note, cost = +b.dataset.cost, have = bank().pearls;
      note.dataset.for = b.dataset.k;
      if (note) note.innerHTML = `${icon('pearl')} ${esc(b.dataset.name)} · ${cost} Pearls` + (have >= cost
        ? `<button class="ui-btn ui-btn--primary" data-buy="${b.dataset.k}" data-v="${b.dataset.v}">Buy</button>`
        : ` <small>(you have ${have}: finish more runs to earn them)</small>`);
      return;
    }
    if (b.dataset.buy) {
      if (buy(b.dataset.buy, b.dataset.v)) { sfx.buy(); this.set(b.dataset.buy, b.dataset.v); }   // bought: wear it straight away
      return;
    }
    if (b.dataset.act === 'random') {
      this.untry();
      this.look = randomLook((key, id) => unlocked(key, id));
      this.render();
      this.onChange(this.look);
    } else if (b.dataset.act === 'done') {
      this.untry(true);
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
