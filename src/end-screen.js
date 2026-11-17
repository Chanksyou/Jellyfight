// The look of the end screens (act complete, death, the score after a win): the kit's panel (ui.js message)
// laid out in two columns wherever the screen is wide, so a phone on its side sees every button, plus a
// kit tile for each Treasure taken and a few chips for the run's time, Level and bugs. Built from --ui-*
// tokens and the kit's pieces (src/ui-kit.css); run.js calls these from endRun and actComplete.
import { icon } from './icons.js';
import { esc } from './leaderboard.js';
import { TREASURES, EVOLUTIONS } from './stats.js';

const CSS = `
/* the panel's words and numbers scroll if they must; its buttons stay put under them */
.jf-modal .jf-panel.jf-end { display: grid; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }
.jf-end-body { min-height: 0; overflow-y: auto; margin: -2px; padding: 2px; }
.jf-end > .btns { margin-top: var(--ui-space-3); }
.jf-end .jf-stats > span { white-space: nowrap; }
/* wide screens (a phone on its side, a desktop): words and chips on the left, the numbers on the right */
@media (min-aspect-ratio: 4/3) {
  .jf-modal .jf-panel.jf-end { width: min(780px, 94vw); }
  .jf-end-body { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 5fr); column-gap: var(--ui-space-5); align-items: start; }
  .jf-end-body > .jf-stats { width: 100%; margin: 0; grid-template-columns: auto minmax(0, 1fr); gap: var(--ui-space-1) var(--ui-space-4); }
  .jf-end-left > .jf-hint { max-width: none; margin: 0 0 var(--ui-space-3); padding: var(--ui-space-2) var(--ui-space-3); }
  /* a death: narrower, so the jelly lying dried out beside it (dried-out.js) shows */
  .jf-modal .jf-panel.jf-end-dead { width: min(640px, 94vw); }
}
/* the beta bubble sits in the top corner: on a short screen the panel starts below it */
@media (max-height: 520px) { .jf-modal:has(.jf-end > .jf-beta) { padding-top: max(56px, env(safe-area-inset-top)); } }
.jf-end h2 { display: flex; align-items: center; justify-content: center; gap: var(--ui-space-3); }
.jf-end h2 > .ui-icon { color: var(--ui-gold); }
.jf-end .sub { margin-bottom: var(--ui-space-3); }
.jf-end .jf-stats .ui-icon { margin-right: var(--ui-space-1); color: var(--ui-mint); }
/* the one stamp of an act cleared: a gold seal slams down beside the heading */
.jf-stamp { display: inline-grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%; background: var(--ui-gold); color: var(--ui-gold-ink);
  box-shadow: 0 3px 0 var(--ui-gold-deep), 0 0 0 4px color-mix(in srgb, var(--ui-gold) 35%, transparent); animation: jfStamp .5s cubic-bezier(.2, 1.3, .4, 1) .1s backwards; }
.jf-stamp .ui-icon { width: 26px; height: 26px; color: inherit; stroke-width: 3; }
@keyframes jfStamp { from { transform: scale(2.4) rotate(-16deg); opacity: 0; } 55% { opacity: 1; } 75% { transform: scale(.92) rotate(3deg); } }
.jf-chips, .jf-tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-2); margin: 0 0 var(--ui-space-3); }
/* the Treasures taken, a few rows at most (a long list scrolls) */
.jf-tiles { max-height: 124px; overflow-y: auto; padding: 2px; }
.jf-tile { min-width: 44px; min-height: 44px; padding: var(--ui-space-1); position: relative; cursor: default; font-size: 22px; line-height: 1; animation: ui-pop var(--ui-slow) var(--ui-ease-in) backwards; animation-delay: var(--d, 0ms); }
.jf-tile:hover { background: var(--ui-glass); }
.jf-tile small { position: absolute; right: 2px; bottom: 1px; padding: 0 3px; border-radius: var(--ui-radius-pill); background: var(--ui-shade); color: var(--ui-ink); font: 700 var(--ui-size-label)/1.2 var(--ui-font-text); }
.jf-tile.jf-evo { border-color: var(--ui-gold); }
body.calm .jf-stamp, body.calm .jf-tile { animation-name: ui-fade-in; }
@media (prefers-reduced-motion: reduce) { .jf-stamp, .jf-tile { animation-name: ui-fade-in; } }
`;

// once, the first time an end screen is drawn
export function endStyles() {
  if (document.getElementById('jf-end-css')) return;
  const el = document.createElement('style');
  el.id = 'jf-end-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// the gold seal that goes before an act's "complete" heading (message puts the title in an h2 as HTML)
export const stamp = () => `<span class="jf-stamp">${icon('check')}</span>`;

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// What a run has to show for itself: its time, Level and bugs as chips, and, with `tiles`, a kit tile for each
// evolution and Treasure it has (×N if taken again), put in the screen above its numbers
export function dressEnd(modal, run, { tiles = true } = {}) {
  const panel = modal.querySelector('.jf-panel');
  if (!panel) return;
  const div = (cls, html = '') => Object.assign(document.createElement('div'), { className: cls, innerHTML: html });
  const left = div('jf-end-left'), body = div('jf-end-body');
  left.append(...panel.querySelectorAll(':scope > .ui-header, :scope > .sub, :scope > .jf-hint'));
  left.append(div('jf-chips', `<span class="ui-chip">${icon('clock')} ${clock(run.t)}</span><span class="ui-chip">${icon('star')} Level ${run.level}</span><span class="ui-chip">${run.kills.toLocaleString()} bugs</span>`));
  const list = !tiles ? [] : [
    ...run.evolved.map((id) => EVOLUTIONS.find((e) => e.id === id)).filter(Boolean).map((e) => ({ ...e, n: 1, evo: true })),
    ...[...run.owned].map((id) => TREASURES.find((t) => t.id === id)).filter(Boolean).map((t) => ({ ...t, n: run.owned.count(t.id) })),
  ];
  if (list.length) left.append(div('jf-tiles', list.map((x, i) => `<span class="ui-tile jf-tile${x.evo ? ' jf-evo' : ''}" style="--d:${i * 40}ms" role="img" aria-label="${esc(x.name)}${x.n > 1 ? ` ×${x.n}` : ''}">${x.icon}${x.n > 1 ? `<small>×${x.n}</small>` : ''}</span>`).join('')));
  body.append(left, ...panel.querySelectorAll(':scope > .jf-stats'));
  panel.querySelector(':scope > .btns').before(body);
}
