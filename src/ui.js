// Full-screen choices and messages: level-up cards, treasure reveal, metamorphosis, run end.
import { STAT_INFO, cardText } from './stats.js';
import { esc } from './leaderboard.js';
import { sfx } from './sfx.js';
import { icon } from './icons.js';
import { Spin } from './spin-screen.js';

// How hard a pick card wears its rarity (treasure-pick-screen plan, step 2): the whole
// card washes and glows in the kit's rarity colour, harder the rarer it is — [inner glow %, background wash %].
// Cards that set neither (level-up cards) keep the original 18% glow and no wash.
const TIER_TINT = { Common: [18, 0], Rare: [26, 6], Epic: [36, 12], Legendary: [48, 20] };
const TIERS = Object.keys(TIER_TINT);
const calm = () => document.body.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
// A number in card text, with its sign and unit: "+20%", "8 s", "22 cm", "×2"
const NUM = /(?<![\w.])[+×−]?\d+(?:[.,]\d+)*(?:\s?(?:%|cm|s|m)(?!\w))?/g;
// text made safe for HTML, with every number in a <b> (the kit shows it in mint)
const hi = (text) => { let out = '', at = 0; for (const m of String(text).matchAll(NUM)) { out += esc(text.slice(at, m.index)) + `<b>${esc(m[0])}</b>`; at = m.index + m[0].length; } return out + esc(text.slice(at)); };
// One pick card (the kit's .ui-card): its frame and label by rarity (the label says it, so colour is never
// the only sign), tint, wash, the Legendary sheen and its deal-in delay (ms). A pick that isn't a rarity (an
// Attack upgrade) wears mint. icon: an emoji; badges: HTML for the top corner (count, New!); up: three of a
// kind made it a rarity better (stats.js threeOfAKind), said beside its rarity
const tierCard = ({ i, tier, icon: ic, name, body, badges = '', key = '', d, up = false }) => {
  const [tint, wash] = TIER_TINT[tier?.name] || [18, 0], rarity = TIERS.includes(tier?.name) ? tier.name.toLowerCase() : '';
  return `<button class="ui-card jf-card ui-enter${tier?.name === 'Legendary' ? ' jf-sheen' : ''}" data-i="${i}" data-rarity="${rarity}" style="--d:${calm() ? 0 : d}ms; --tint:${tint}%; --wash:${wash}%${rarity ? '' : '; --rarity:var(--ui-mint)'}">
    <span class="ui-card-icon ic">${ic}</span>${tier ? `<span class="ui-card-rarity rar">${esc(tier.name)}${up ? ' <span class="jf-new jf-up">▲ Upgraded</span>' : ''}</span>` : ''}<span class="ui-card-name">${name}</span>
    <span class="ui-card-body">${body}</span><span class="jf-badges">${key ? `<span class="key" aria-hidden="true">${key}</span>` : ''}${badges}</span></button>`;
};
const BEAT = 300;     // a level-up's beat (ms) before the first card is dealt (when no spin plays)
const COUNT = 0.7;    // an end screen's tally: seconds a number counts up
const DEAL_MAX = 360; // a deal or a cascade of rows is over inside this many ms (the skill's staggers stay under 400)
// A motion token from look.css (--ui-fast, --ui-stagger…) as a number of ms (read when a motion starts, never per frame)
export const tok = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;
export const stagger = () => tok('--ui-stagger', 60);
// When each card is dealt (ms), the rarest last: a rarer card waits longer, equals keep their order. `tiers` are tier names
export const dealDelays = (tiers, beat = 0) => {
  const s = stagger(), order = tiers.map((t, i) => [Math.max(0, TIERS.indexOf(t)), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), at = [];
  order.forEach(([, i], rank) => { at[i] = beat + Math.min(rank * s, DEAL_MAX); });
  return at;
};

const CSS = `
.jf-modal { position: fixed; inset: 0; display: grid; place-items: center; box-sizing: border-box; background: var(--ui-scrim); z-index: 30;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  font-family: var(--ui-font-text); color: var(--ui-ink); text-align: center; animation: jfIn var(--ui-fast) var(--ui-ease-settle); }
.jf-modal[hidden] { display: none; }
@keyframes jfIn { from { opacity: 0; } }
.jf-modal h2 { margin: 0; font: 600 var(--ui-size-title)/1.1 var(--ui-font-display); text-shadow: 0 2px 10px var(--ui-shade); text-wrap: balance; }
.jf-modal .sub { margin: var(--ui-space-2) 0 var(--ui-space-5); color: var(--ui-ink-dim); font-size: var(--ui-size-body); }
.jf-modal small { font-size: var(--ui-size-label); }
.jf-hint { position: relative; max-width: min(420px, calc(100vw - 32px)); margin: var(--ui-space-1) auto var(--ui-space-4); padding: var(--ui-space-3) var(--ui-space-4); border-radius: var(--ui-radius-m); text-align: left; font-size: var(--ui-size-body); line-height: 1.35;
  background: var(--ui-panel-raised); border: 1px solid var(--ui-line); }
/* one card for every pick (the kit's .ui-card): its rarity frame, label and tint come from data-rarity */
.jf-cards { display: flex; gap: var(--ui-space-4); justify-content: center; align-items: stretch; padding: 0 var(--ui-space-4); }
.jf-cards .ui-card { flex: 0 1 280px; min-width: 0; align-content: start; padding-top: var(--ui-space-4); text-align: left;
  background: linear-gradient(color-mix(in srgb, var(--rarity) var(--wash, 0%), var(--ui-panel-raised)), color-mix(in srgb, var(--rarity) var(--wash, 0%), var(--ui-deep)));
  box-shadow: 0 8px 20px var(--ui-shade), inset 0 0 40px color-mix(in srgb, var(--rarity) var(--tint, 18%), transparent); }
@media (hover: hover) { .jf-cards .ui-card:hover { box-shadow: 0 10px 24px var(--ui-shade), inset 0 0 40px color-mix(in srgb, var(--rarity) var(--tint, 18%), transparent); } }
.jf-cards .ui-card-icon { width: 52px; height: 52px; font-size: 36px; }
.jf-cards .ui-card-name b { color: var(--ui-mint); font-weight: inherit; }
.jf-cards .ui-card-body { color: var(--ui-ink); }
.jf-card.ui-enter { animation-fill-mode: backwards; animation-delay: var(--d, 0ms); }
.jf-sheen { overflow: hidden; }
/* the Legendary sheen: a pre-painted strip slid across the card (transform only) */
.jf-sheen::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 60%; pointer-events: none; animation: jfSheen 3.6s var(--ui-ease-float) infinite;
  background: linear-gradient(115deg, transparent 20%, color-mix(in srgb, var(--rarity) 22%, transparent) 50%, transparent 80%); transform: translateX(-110%); }
@keyframes jfSheen { 0% { transform: translateX(-110%); } 42%, 100% { transform: translateX(230%); } }
/* count / New! in the card's top corner, and the number key that picks it */
.jf-badges { position: absolute; top: var(--ui-space-2); right: var(--ui-space-2); display: flex; gap: var(--ui-space-1); align-items: center; }
.jf-badges .ui-card-count { position: static; }
.jf-card .key { font: 700 var(--ui-size-label)/1 var(--ui-font-text); opacity: .55; }
.jf-card .jf-up { margin-left: 4px; letter-spacing: 0; text-transform: none; white-space: nowrap; }
.jf-card .jf-new { padding: 2px 8px; border-radius: var(--ui-radius-pill); background: var(--ui-gold); color: var(--ui-gold-ink); font: 700 var(--ui-size-label)/1.3 var(--ui-font-text); }
.jf-pick .jf-card::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; }
/* the picked card swells while a glow layer (its rarity, pre-painted) fades in and out; the others drop away under a dark ember tint.
   Only transform and opacity move: no filter or shadow is animated (they repaint every frame on a phone) */
.jf-pick .jf-card.jf-won { animation: jfWon var(--ui-slow) var(--ui-ease-arrive); }
.jf-pick .jf-card.jf-won::after { box-shadow: inset 0 0 60px color-mix(in srgb, var(--rarity) 45%, transparent); animation: jfGlow var(--ui-slow) var(--ui-ease-settle); }
@keyframes jfWon { 40% { transform: scale(1.06); } }
@keyframes jfGlow { 40% { opacity: 1; } }
.jf-pick .jf-card.jf-burn { animation: jfBurn var(--ui-fast) var(--ui-ease-leave) forwards; pointer-events: none; }
.jf-pick .jf-card.jf-burn::after { background: color-mix(in srgb, var(--ui-boss) 30%, var(--ui-deep)); animation: jfBurnTint var(--ui-fast) var(--ui-ease-leave) forwards; }
@keyframes jfBurn { to { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes jfBurnTint { to { opacity: .75; } }
/* the picked icon, flying to its slot in the HUD (flyIcon): a new Treasure's own slot waits empty until it lands */
.jf-flyer { position: fixed; left: 0; top: 0; z-index: 40; display: grid; place-items: center; pointer-events: none; will-change: transform; }
#hud .items span.jf-landing { opacity: 0; }
/* reduced motion (the device setting, or Reduce effects): the deal-in and the title only fade (the kit's
   .ui-enter / .ui-pop), the sheen and the won / burn outro stand still (the pick closes at once) */
body.calm .jf-sheen::before, body.calm .jf-pick .jf-card.jf-burn, body.calm .jf-pick .jf-card.jf-won, body.calm .jf-pick .jf-card::after { animation: none; }
@media (prefers-reduced-motion: reduce) { .jf-sheen::before, .jf-pick .jf-card.jf-burn, .jf-pick .jf-card.jf-won, .jf-pick .jf-card::after { animation: none; } }
/* the end screens tally (tick): rows arrive one by one and numbers count up. The real number stays
   in the page (only hidden while it counts), so what the screen says is always the final one */
.jf-tally .jf-stats > * { animation: jfRow var(--ui-mid) var(--ui-ease-settle) backwards; animation-delay: var(--d, 0ms); }
.jf-tally.jf-done .jf-stats > * { animation: none; }
@keyframes jfRow { from { opacity: 0; transform: translateY(6px); } }
.jf-count.run { position: relative; -webkit-text-fill-color: transparent; }
.jf-count.run::after { content: attr(data-shown); position: absolute; right: 0; top: 0; white-space: nowrap; -webkit-text-fill-color: currentColor; }
.jf-best.on { display: inline-block; animation: jfBest var(--ui-slow) var(--ui-ease-arrive); }
@keyframes jfBest { from { transform: scale(2.4) rotate(-8deg); opacity: 0; } }
/* a golden award earned (award): your jelly wearing it, on turning gold rays, before the score */
.jf-award { position: fixed; inset: 0; z-index: 32; display: grid; place-items: center; box-sizing: border-box;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--ui-gold) 22%, var(--ui-deep)), var(--ui-deep) 62%);
  font-family: var(--ui-font-text); color: var(--ui-ink); text-align: center; animation: jfIn var(--ui-mid) var(--ui-ease-settle); }
.jf-award > div { display: grid; justify-items: center; gap: var(--ui-space-2); padding: var(--ui-space-4); }
.jf-award .eyebrow { margin: 0; font: 700 var(--ui-size-label)/1.3 var(--ui-font-text); letter-spacing: .16em; text-transform: uppercase; color: var(--ui-gold); }
.jf-award h2 { margin: 0; font: 600 var(--ui-size-title)/1.1 var(--ui-font-display); text-shadow: 0 3px 14px var(--ui-shade); }
.jf-award .for { margin: 0; color: var(--ui-ink-dim); font-size: var(--ui-size-body); }
.jf-award .face { position: relative; width: 190px; height: 190px; display: grid; place-items: center; margin: 6px 0 8px; }
.jf-award .face::before { content: ''; position: absolute; inset: -40px; border-radius: 50%; animation: jfRays 12s linear 2;   /* two slow turns, then still */
  background: repeating-conic-gradient(color-mix(in srgb, var(--ui-gold) 33%, transparent) 0 10deg, transparent 10deg 30deg); -webkit-mask: radial-gradient(circle, #000 30%, transparent 70%); mask: radial-gradient(circle, #000 30%, transparent 70%); }
.jf-award .face img { position: relative; width: 150px; height: 150px; border-radius: 50%; box-shadow: 0 0 0 3px var(--ui-gold), 0 0 40px color-mix(in srgb, var(--ui-gold) 55%, transparent); animation: jfRise var(--ui-slow) var(--ui-ease-arrive) var(--ui-fast) backwards; }
@keyframes jfRays { to { transform: rotate(1turn); } }
@keyframes jfRise { from { transform: translateY(30px) scale(.6); opacity: 0; } }
.jf-award .btns { display: flex; gap: var(--ui-space-3); flex-wrap: wrap; justify-content: center; margin-top: var(--ui-space-3); }
/* the title pops in, the award fades in and the face rises; with reduced motion nothing moves */
body.calm .jf-tally .jf-stats > *, body.calm .jf-best.on, body.calm .jf-award, body.calm .jf-award .face::before, body.calm .jf-award .face img { animation: none; }
@media (prefers-reduced-motion: reduce) { .jf-tally .jf-stats > *, .jf-best.on, .jf-award, .jf-award .face::before, .jf-award .face img { animation: none; } }
/* panels: the end screens and the leaderboard (message), the Treasure book and the Achievements list */
.jf-panel { width: min(560px, 94vw); max-height: 100%; overflow-y: auto; }
.jf-panel > .ui-header { justify-content: center; }
.jf-panel > .ui-header > :first-child { text-align: center; }
.jf-panel .sub { margin: 0 0 var(--ui-space-3); }
/* the Treasure book and the Achievements list: one panel (.jf-sheet) whose header and footer stay put and whose middle scrolls */
.jf-book { width: min(900px, 94vw); max-height: 92dvh; overflow-y: auto; box-sizing: border-box; }
.jf-sheet { display: flex; flex-direction: column; overflow: hidden; padding-bottom: 0; }
.jf-sheet .jf-head .ui-header { margin: 0; }
.jf-sheet .jf-head .ui-header > :first-child { display: flex; align-items: center; gap: var(--ui-space-2); text-align: left; }
.jf-sheet .jf-head .sub { margin: 0 0 var(--ui-space-2); font-size: var(--ui-size-label); color: var(--ui-ink-dim); text-align: left; }
.jf-sheet .jf-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: var(--ui-space-1) 0; }
.jf-sheet .jf-info { margin: 0 0 var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); background: var(--ui-deep); border-radius: var(--ui-radius-s); font-size: var(--ui-size-label); line-height: 1.4; color: var(--ui-ink-dim); text-align: left; }
.jf-modal .jf-sheet .btns { flex: none; margin: var(--ui-space-3) calc(-1 * var(--ui-space-4)) 0; max-width: none; padding: var(--ui-space-3); background: var(--ui-panel-raised); border-top: 1px solid var(--ui-line); }
.jf-sheet .btns .ui-btn { font-size: var(--ui-size-body); }
.jf-sheet .btns .ui-btn:disabled { opacity: 1; color: var(--ui-ink-dim); background: var(--ui-shade); cursor: default; }   /* Share with nothing to share: dim, still readable (4.5:1) */
.jf-tabs { align-self: flex-start; max-width: 100%; overflow-x: auto; margin: 0 0 var(--ui-space-2); }
.jf-tabs > button { flex: none; padding: 0 var(--ui-space-3); }
.jf-sheet h3 { margin: var(--ui-space-3) 0 var(--ui-space-2); font: 500 var(--ui-size-heading)/1.2 var(--ui-font-display); text-align: left; }
.jf-sheet h3:first-child { margin-top: 0; }
.jf-sheet h3 small { color: var(--ui-ink-dim); font-weight: 600; }
.jf-book .say { flex: none; margin: var(--ui-space-2) 0 var(--ui-space-3); padding: var(--ui-space-2) var(--ui-space-3); min-height: 2.6em; box-sizing: border-box; font-size: var(--ui-size-label); line-height: 1.35; background: var(--ui-deep); border-radius: var(--ui-radius-s); text-align: left; }
.jf-book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: var(--ui-space-2); }
.jf-book-grid .ui-tile { width: 100%; min-width: 0; min-height: 72px; align-content: start; padding: var(--ui-space-2) var(--ui-space-1); text-align: center; background: color-mix(in srgb, var(--c, var(--ui-line)) 12%, var(--ui-panel-raised)); border: 2px solid var(--c, var(--ui-line)); }
.jf-book-grid .ui-tile .ic { font-size: 26px; line-height: 1.1; }
.jf-book-grid .ui-tile:disabled { cursor: default; border-color: var(--ui-line); background: var(--ui-shade); color: var(--ui-ink-dim); }
.jf-book-grid .ui-tile:disabled .ui-icon { color: var(--ui-ink-dim); opacity: .45; }   /* not found yet: a dim silhouette of its section's icon, and where to find it */
.jf-book-grid .ui-tile.locked { border-style: dashed; color: var(--ui-ink-dim); }
.jf-book-grid .ui-tile.locked .ic { filter: brightness(0); opacity: .6; }   /* a locked jelly type: its silhouette */
.jf-achievements .challenges { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: var(--ui-space-2); text-align: left; }
.jf-achievements article.ui-panel { padding: var(--ui-space-3); border-radius: var(--ui-radius-m); background: var(--ui-glass); box-shadow: none; }
.jf-achievements article.earned { border-color: var(--ui-mint); background: color-mix(in srgb, var(--ui-mint) 8%, transparent); }
.jf-achievements article h3 { display: flex; align-items: center; gap: var(--ui-space-2); margin: 0 0 var(--ui-space-1); font-size: var(--ui-size-body); }
.jf-achievements article h3 .ui-icon { color: var(--ui-mint); }
.jf-achievements article h3 .jf-dot { width: .9em; height: .9em; flex: none; box-sizing: border-box; border: 2px solid var(--ui-ink-dim); border-radius: 50%; margin: 0 .17em; }
.jf-achievements article p { font-size: var(--ui-size-label); line-height: 1.4; margin: 0 0 var(--ui-space-1); color: var(--ui-ink-dim); }
.jf-achievements article small { display: block; color: var(--ui-mint); line-height: 1.4; }
.jf-share-note { flex-basis: 100%; margin: 0; font-size: var(--ui-size-label); color: var(--ui-ink-dim); text-align: center; }
.jf-modal .btns { margin-top: var(--ui-space-5); display: flex; flex-wrap: wrap; gap: var(--ui-space-3); justify-content: center; max-width: min(760px, 94vw); margin-left: auto; margin-right: auto; }
.jf-modal .btns .ui-btn--primary { font-size: var(--ui-size-heading); }
.jf-modal .btns .jf-key { color: var(--ui-ink-dim); font-size: var(--ui-size-label); }
.jf-stats { margin: var(--ui-space-1) auto 0; display: grid; align-items: center; grid-template-columns: auto auto; gap: var(--ui-space-1) var(--ui-space-5); text-align: left; font-size: var(--ui-size-body); }
.jf-stats > span { color: var(--ui-ink-dim); }
.jf-stats b { text-align: right; font-variant-numeric: tabular-nums; }
.jf-stats small { font-weight: 600; color: var(--ui-ink-dim); }
.jf-stats .jf-unlock { width: 56px; height: 56px; border-radius: 50%; vertical-align: middle; margin-right: var(--ui-space-3); box-shadow: 0 0 0 2px var(--ui-gold), 0 4px 14px var(--ui-shade); }
/* the leaderboard: big rows, each player's own jelly by their name */
.jf-empty { margin: var(--ui-space-2) 0 var(--ui-space-1); color: var(--ui-ink-dim); }
.jf-empty .ui-icon { width: 44px; height: 44px; opacity: .6; }
.jf-board { width: min(760px, 94vw); max-height: 100dvh; overflow-y: auto; padding: var(--ui-space-4); box-sizing: border-box; }
.jf-board .jf-stats { font-size: 22px; gap: 10px 36px; width: 100%; grid-template-columns: minmax(0, 1fr) auto; }
.jf-board .jf-stats > span { display: flex; align-items: center; gap: var(--ui-space-3); min-width: 0; color: var(--ui-ink); }
.jf-board .jf-stats > b { align-self: center; font-size: 24px; }
.jf-board .jf-rank { font-style: normal; min-width: 1.6em; }
.jf-board .jf-rank[data-place] { font-weight: 700; color: var(--ui-gold); }
.jf-board .jf-rank[data-place="2"] { color: var(--ui-silver); }
.jf-board .jf-rank[data-place="3"] { color: var(--ui-bronze); }
.jf-board .jf-jelly { width: var(--board-jelly-size, 80px); height: var(--board-jelly-size, 80px); border-radius: 50%; box-shadow: 0 0 0 2px var(--ui-line), 0 4px 14px var(--ui-shade); flex: none; }
.jf-board .jf-who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14em; }
.jf-score { font-size: 1.5em; color: var(--ui-gold); }
.jf-name { box-sizing: border-box; min-height: var(--ui-target); font: 600 16px var(--ui-font-text); width: 11em; max-width: 100%; padding: 6px 10px; border-radius: var(--ui-radius-s); border: 1px solid var(--ui-line); background: var(--ui-glass); color: var(--ui-ink); text-align: right; }
.jf-name::placeholder { color: var(--ui-ink-dim); }
/* the end screens' beta bubble (a corner button), and the feedback box it opens (run.showFeedback) */
.jf-modal .jf-beta { position: fixed; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); z-index: 1; box-sizing: border-box; min-height: var(--ui-target); max-width: min(250px, 44vw);
  font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); text-align: left; color: var(--ui-ink); cursor: pointer; padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-m) var(--ui-radius-m) var(--ui-radius-m) 4px;
  background: var(--ui-panel); border: 1px solid var(--ui-epic); box-shadow: 0 6px 18px var(--ui-shade); }
@media (max-height: 500px) { .jf-modal .jf-beta { top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); max-width: 200px; } }
@media (hover: hover) { .jf-modal .jf-beta:hover { border-color: var(--ui-ink); } }
.jf-modal .jf-beta:focus-visible { outline: 2px solid var(--ui-mint); outline-offset: 2px; }
.jf-feedback { display: block; box-sizing: border-box; width: min(460px, calc(100vw - 32px)); margin: var(--ui-space-3) auto 0; padding: 10px var(--ui-space-3); resize: vertical;
  font: 16px/1.4 var(--ui-font-text); border-radius: var(--ui-radius-s); border: 1px solid var(--ui-line); background: var(--ui-glass); color: var(--ui-ink); }
.jf-feedback::placeholder { color: var(--ui-ink-dim); }
.jf-feedback:focus, .jf-name:focus { outline: 2px solid var(--ui-gold); outline-offset: 1px; }
/* the Treasure you just took, as a toast (the kit's .ui-toast, kept apart from the HUD's) */
.jf-pop { position: fixed; left: 50%; top: 16%; translate: -50% 0; z-index: 25; border-color: var(--ui-gold); border-radius: var(--ui-radius-m); padding: var(--ui-space-3) var(--ui-space-4); gap: var(--ui-space-3); pointer-events: none; max-width: 90vw; }
.jf-pop[hidden] { display: none; }
.jf-pop .ic { font-size: 38px; line-height: 1; }
.jf-pop b { display: block; font: 500 var(--ui-size-heading)/1.2 var(--ui-font-display); }
.jf-pop span:not(.ic) { color: var(--ui-ink-dim); font-size: var(--ui-size-body); }
.jf-evolution-heading p { margin: 0; font: 700 var(--ui-size-label)/1.3 var(--ui-font-text); letter-spacing: .16em; text-transform: uppercase; color: var(--ui-gold); }
@media (max-height: 520px), (max-width: 700px) {
  .jf-modal > div { max-height: 100%; overflow-y: auto; padding: 10px 0; box-sizing: border-box; }
  .jf-modal > .jf-panel { padding: var(--ui-space-4); }
  .jf-modal .sub { margin: 2px 0 10px; }
  .jf-cards { gap: var(--ui-space-2); flex-wrap: nowrap; padding: 0 var(--ui-space-2); }
  .jf-cards .ui-card { padding: var(--ui-space-3); }
  .jf-cards .ui-card-icon { width: 44px; height: 44px; font-size: 30px; }
  .jf-card .key { display: none; }
  .jf-modal .btns { margin-top: 10px; }
  .jf-modal .btns .jf-key { display: none; }
  .jf-stats .jf-unlock { width: 40px; height: 40px; }
  .jf-board .jf-stats { font-size: 16px; gap: 6px 20px; }
  .jf-board .jf-stats > b { font-size: 17px; }
  .jf-board .jf-jelly { width: var(--board-jelly-size-phone, 56px); height: var(--board-jelly-size-phone, 56px); }
  .jf-pop { top: 12%; padding: var(--ui-space-2) var(--ui-space-3); }
  .jf-award .face { width: 120px; height: 120px; margin: 2px 0 4px; }
  .jf-award .face img { width: 100px; height: 100px; }
  .jf-pop .ic { font-size: 28px; }
}
`;

// the Treasure book's unfound tiles: a dim icon for the section, and where its things turn up
const WHERE = { Treasures: ['star', 'Find in a run'], Elites: ['shield', 'Beat an Elite'], Bosses: ['trophy', 'Beat a boss'], Upgrades: ['medal', 'After a boss'] };
// a title without the emoji run.js still puts in front of it (the screens draw an icon of their own)
const bare = (t) => t.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');

export class UI {
  constructor(parent) {
    const style = document.createElement('style');
    style.textContent = CSS;
    parent.appendChild(style);
    this.modal = document.createElement('div');
    this.modal.className = 'jf-modal';
    this.modal.hidden = true;
    // A second thumb gets pointer events but no click while the joystick thumb stays down.
    this.modal.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' && !e.isPrimary && this.picking) { if (this.spinning) this.spinning.tap(); else if (!(this._arm > 0)) this.modal.onclick?.(e); }
    });
    // while the reward spin plays, a tap or click anywhere lands the reels (or skips to the cards) and nothing else
    // (and for a moment after it hands over, so a late tap meant to skip doesn't pick a card)
    this.modal.addEventListener('click', (e) => { if (this.spinning || this._arm > 0) { e.stopImmediatePropagation(); this.spinning?.tap(); } }, true);
    this.spinOn = true;    // the reward spin plays before level-up and chest cards (off in stories unless fresh({ spin: true }))
    this._spin = null;
    this._arm = 0;         // seconds the fresh cards ignore taps after a spin hands over
    parent.appendChild(this.modal);
    this.pop = document.createElement('div');
    this.pop.className = 'ui-toast jf-pop';
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
      // the spin takes Space (lands the reels, then skips to the cards); number keys and R wait for the cards
      if (!this.modal.hidden && this.spinning) { if (e.code === 'Space') { e.preventDefault(); this.spinning.tap(); } return; }
      if (!this.modal.hidden && this.keyHandler) this.keyHandler(e);
    });
  }

  get open() { return !this.modal.hidden; }
  get picking() { return this.open && (!!this.spinning || !!this.modal.querySelector('.jf-pick')); }
  // the reward spin playing now, if a newer screen hasn't replaced it
  get spinning() { if (this._spin && this._spinGen !== this._gen) this._spin = null; return this._spin; }
  get closing() { return this._outro > 0 && this._outroGen === this._gen; }

  close() {
    this._outro = 0;
    this._tally = null;
    this._spin = null;
    this._arm = 0;
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
    this.modal.innerHTML = `<div class="jf-evolution-heading"><p>Metamorphosis</p><h2>${esc(evo.name)}</h2></div><div class="jf-evolution-footer"><p>${esc(evo.text)}</p><button type="button" class="ui-btn">Skip animation</button></div>`;
    this.modal.hidden = false;
    const button = this.modal.querySelector('button');
    this.modal.onclick = e => { if (e.target.closest('button')) skip(); };
    this.keyHandler = e => { if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); skip(); } };
    button.focus({ preventScroll: true });
    return this._gen;
  }

  // cards: from rollCards(); stats: current stats; onPick(card); onReroll() -> new cards or null
  // to: where the won card's icon flies (the HUD's level badge, a DOMRect). The cards deal in after a
  // beat (run.levelUp's ding) and leave like a treasure pick's (outro).
  // spin: { first, rollOne, odds, luck } (run.levelUp): the reward spin plays before the cards (first:
  // not for cards a reload owes) and again on a reroll, the cards dealt the moment it hands over
  levelUp(level, cards, stats, rerolls, onPick, onReroll, to = null, spin = null) {
    const gen = ++this._gen;
    this._spin = null;
    this._arm = 0;
    let out = false;
    const render = (beat) => {
      const at = dealDelays(cards.map((c) => c.rarity?.name), beat);
      this.modal.innerHTML = `<div class="jf-level"><h2 class="ui-pop">Level ${level}!</h2><p class="sub">Choose an upgrade.</p>
        <div class="jf-cards jf-pick">${cards.map((c, i) => {
          const info = STAT_INFO[c.stat], [head, ...more] = cardText(c).split(' · ');   // (the Attacks card's "· 20% less damage each" goes under its name)
          return tierCard({ i, tier: c.rarity, icon: info.icon, name: hi(head), body: [...more, `now ${info.fmt(stats[c.stat])}`].map(hi).join('<br>'), key: i + 1, d: at[i], up: c.upgraded });
        }).join('')}</div>
        <div class="btns"><button class="ui-btn" data-act="reroll" ${rerolls > 0 ? '' : 'disabled'}>${icon('reroll')} Reroll (${rerolls}) <span class="jf-key">[R]</span></button></div></div>`;
      this.dealSound(at, cards.map((c) => c.rarity?.name));
    };
    const pick = (i) => { const c = cards[i]; if (!c || out) return; out = true; this.outro(gen, i, to); onPick(c); };
    const spins = spin && this.spinOn;
    const play = (lead) => this.spin({ ...spin, kind: 'levelup', title: `Level ${level}!`, offer: cards, lead, done: () => render(0),
      cell: (c) => ({ icon: STAT_INFO[c.stat].icon, name: hi(cardText(c).split(' · ')[0]) }) });
    const reroll = () => {
      if (rerolls <= 0 || out) return;
      rerolls--;
      cards = onReroll();
      if (!spins) { render(0); return; }
      this.modal.firstElementChild?.classList.add('ui-leave');   // the cards leave, then the spin plays with the new roll
      play(tok('--ui-fast', 120));
    };
    this.modal.hidden = false;
    if (spins && spin.first) play(0);
    else render(calm() ? 0 : BEAT);
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
  // slot(choice) -> { to: DOMRect, done?() } | null: where the won card's icon lands in the HUD (measured once, as it's picked), else the toast's spot
  // spin: { kind, rollOne, odds, luck } (run.pickTreasure): the reward spin plays before the cards
  choose(title, sub, choices, onPick, slot = null, spin = null) {
    const gen = ++this._gen;
    this._spin = null;
    this._arm = 0;
    const render = () => {
      const at = dealDelays(choices.map((c) => c.tier?.name));
      this.modal.innerHTML = `<div><h2>${title}</h2><p class="sub">${sub}</p>
        <div class="jf-cards jf-pick">${choices.map((c, i) => tierCard({ i, tier: c.tier, icon: c.icon, name: esc(c.name), body: hi(c.text), key: i + 1, d: at[i],
          up: c.upgraded, badges: `${c.fresh ? '<span class="jf-new">New!</span>' : ''}${c.delta ? `<span class="ui-card-count">${esc(c.delta)}</span>` : ''}` })).join('')}</div></div>`;
      this.dealSound(at, choices.map((c) => c.tier?.name));
    };
    this.modal.hidden = false;
    if (spin && this.spinOn) this.spin({ ...spin, title: bare(title), offer: choices, done: render, cell: (t) => ({ icon: t.icon, name: esc(t.name) }) });
    else render();
    let out = false;
    const pick = (i) => {
      const c = choices[i];
      if (!c || out) return;
      out = true;
      const land = slot?.(c);
      this.outro(gen, i, land?.to, land?.done);
      onPick(c);   // resume can capture the mouse during this click, before user activation expires
    };
    this.modal.onclick = (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
    this.keyHandler = (e) => { if (/^Digit[1-9]$/.test(e.code)) pick(+e.code.slice(-1) - 1); };
  }

  // The reward spin (spin-screen.js) in the modal; o.done draws the cards once it hands over
  // (if the machine ever fails, the cards come straight up rather than leave the modal stuck)
  spin(o) {
    const done = () => { this._spin = null; this._arm = 0.25; o.done(); };
    this._spinGen = this._gen;
    try { this._spin = new Spin(this.modal, { calm: calm(), ...o, done }); } catch (e) { console.error(e); done(); }
  }

  // A whoosh per card as it's dealt (`at`: when each is, ms), then a chord as big as the rarest card's rarity
  dealSound(at, tiers) {
    at.forEach((ms) => sfx.deal(calm() ? 0 : ms / 1000));
    sfx.reveal(Math.max(0, ...tiers.map((t) => TIERS.indexOf(t))), calm() ? 0 : (Math.max(0, ...at) + stagger()) / 1000);
  }

  // A pick resolves at once (the game flows on exactly as before), but the modal stays up for one
  // beat so the moment can land: the won card pulses, its icon flies up (to `to`, else to where the
  // treasure toast appears; `done` runs as it lands), and the unpicked cards drop away
  outro(gen, i, to, done) {
    const cards = [...this.modal.querySelectorAll('.jf-card')];
    cards.forEach((el, j) => el.classList.add(j === i ? 'jf-won' : 'jf-burn'));
    this.flyIcon(cards[i], to, done);
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
    if (this._arm > 0) this._arm -= dt;
    const sp = this.spinning;
    if (sp) try { sp.tick(dt * 1000); } catch (e) { console.error(e); if (this._spin === sp) sp.o.done(); }
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

  // A copy of the won card's icon, flown to the treasure toast's spot (top centre), or to `to` (a DOMRect: a slot in the HUD).
  // It's one element moved by transform alone (the card's own box measured once, scaled and carried to the target): up and over
  // in an arc, then in with a little overshoot. Reduce effects: no flight, `done` runs at once
  flyIcon(card, to = null, done = null) {
    const ic = card?.querySelector('.ic');
    if (!ic || calm()) { done?.(); return null; }
    const r = ic.getBoundingClientRect(), el = document.createElement('span'), end = to || new DOMRect(innerWidth / 2 - r.width * 0.325, innerHeight * 0.13 - r.height * 0.325, r.width * 0.65, r.height * 0.65);
    el.className = 'jf-flyer';
    el.textContent = ic.textContent;
    el.style.cssText = `width:${r.width}px; height:${r.height}px; font-size:${getComputedStyle(ic).fontSize}`;
    document.body.appendChild(el);
    // the flight: from the icon's centre to the target's, scaled about its centre to the target's size, along a curve
    // (a quadratic whose middle is pulled up) sampled into a few keyframes
    const at = (x, y, k) => `translate(${x - r.width / 2}px, ${y - r.height / 2}px) scale(${k})`;
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = end.left + end.width / 2, y1 = end.top + end.height / 2, k1 = Math.max(0.25, end.width / r.width);
    const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - Math.max(40, Math.abs(y1 - y0) * 0.5);   // the control point: above both ends
    const path = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ offset: t, transform: at((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1, 1 + (k1 - 1) * t) }));
    const ms = tok('--ui-mid', 240) + tok('--ui-fast', 120), ease = getComputedStyle(document.documentElement).getPropertyValue('--ui-ease-arrive').trim() || 'ease-out';
    const fin = () => { if (el.isConnected) { el.remove(); done?.(); } };
    const a = el.animate(path, { duration: ms, easing: ease, fill: 'forwards' });
    a.onfinish = fin;
    setTimeout(fin, ms + 80);   // (a hidden tab never finishes an animation)
    return a;
  }

  // rows: [[label, value]], buttons: [{ label, go, enter?, onClick }] (Enter presses the `enter` one, else the `go` one)
  // cls: a class for this dialog (the leaderboard's 'jf-board' lays its rows out big)
  // A value with a <span class="jf-count" data-n> in it counts up (tally)
  achievements(items, onBack, onTop = null) {
    this._gen++;
    const count = items.filter(a => a.earned).length;
    this.modal.innerHTML = `<section class="ui-panel jf-book jf-sheet jf-achievements" aria-label="Achievements">
      <div class="jf-head"><div class="ui-header"><h2>${icon('medal')} Achievements</h2><button class="ui-btn ui-btn--ghost ui-btn--icon" data-info aria-expanded="false" aria-label="About achievements">${icon('info')}</button><button class="ui-btn ui-btn--ghost ui-btn--icon jf-x" data-back aria-label="Close">${icon('close')}</button></div><p class="sub">${count}/${items.length} earned · Every challenge needs a full four-boss win.</p>
      <p class="jf-info" hidden>Earned achievements stay on this browser. Shields and Dodge are allowed; healing never erases Health lost.${onTop ? ` ${count ? 'Share your earned total with the achievement leaderboard.' : 'Earn an achievement to share your total with the leaderboard.'}` : ''}</p></div>
      <div class="jf-scroll"><div class="challenges">${items.map(a => `<article class="ui-panel ${a.earned ? 'earned' : ''}">
        <h3>${a.earned ? icon('check') : '<span class="jf-dot"></span>'} ${esc(a.name)}</h3><p>${esc(a.text)}</p>
        ${a.earned ? `<small>Earned · ${esc(new Date(a.earned).toLocaleDateString())}</small>` : ''}</article>`).join('')}</div></div>
      <div class="btns">${onTop ? `<button class="ui-btn" data-share ${count ? '' : 'disabled'}>${icon('share')} Share achievements</button><button class="ui-btn" data-top>${icon('trophy')} Top 5 players</button>` : ''}<button class="ui-btn ui-btn--primary go">${icon('back')} Back</button>${onTop && !count ? '<p class="jf-share-note">Earn one to share your total.</p>' : ''}</div></section>`;
    this.modal.hidden = false;
    const back = () => { this.close(); onBack(); };
    this.modal.onclick = e => {
      const button = e.target.closest('button');
      if (button?.disabled) return;
      if (button?.matches('[data-info]')) { const info = this.modal.querySelector('.jf-info'); info.hidden = !info.hidden; button.setAttribute('aria-expanded', String(!info.hidden)); }
      else if (button?.matches('[data-top], [data-share]')) { this.close(); onTop(); }
      else if (button) back();
    };
    this.keyHandler = e => { if (e.code === 'Escape') { e.preventDefault(); back(); } };   // Enter activates the focused button natively
    this.modal.querySelector('.btns button:not(:disabled)').focus({ preventScroll: true });
  }

  // buttons: [{ label, onClick(values), go?, enter?, corner? }]; a corner one sits apart, top left (the beta bubble)
  // hold: ms the rows wait before they start arriving (a death lets its jelly finish drying out first)
  message(title, sub, rows, buttons, cls = '', hint = '', hold = 0) {
    this._gen++;
    const board = cls.includes('jf-board');   // the leaderboards: a plain title, and an icon over a board with nothing on it yet
    const s = stagger(), d = (i) => hold + Math.min(i * s, DEAL_MAX);   // when row i arrives (the tally counts each up from there)
    this.modal.innerHTML = `<div class="ui-panel jf-panel ${cls}"><div class="ui-header"><h2>${board ? bare(title) : title}</h2></div>${board && !rows.length ? `<div class="jf-empty">${icon('trophy')}</div>` : ''}${sub ? `<p class="sub">${sub}</p>` : ''}
      ${hint ? `<p class="jf-hint">${icon('info')} ${esc(hint)}</p>` : ''}
      ${rows.length ? `<div class="jf-stats">${rows.map(([k, v], i) => `<span style="--d:${d(i)}ms">${k}</span><b style="--d:${d(i)}ms">${v}</b>`).join('')}</div>` : ''}
      <div class="btns">${buttons.map((b, i) => (b.corner ? '' : `<button data-i="${i}" class="ui-btn${b.go ? ' ui-btn--primary go' : ''}">${b.label}</button>`)).join('')}</div>
      ${buttons.map((b, i) => (b.corner ? `<button data-i="${i}" class="jf-beta">${b.label}</button>` : '')).join('')}</div>`;
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
    this.keyHandler = (e) => { if (e.code === 'Enter' && e.target?.tagName !== 'TEXTAREA') { const btn = buttons.find((b) => b.enter) || buttons.find((b) => b.go) || buttons[0], vals = this.values(); this.close(); btn.onClick(vals); } };
    if (!matchMedia('(pointer: coarse)').matches) this.modal.querySelector('input, textarea')?.focus({ preventScroll: true });   // not on phones: it would pop the keyboard up
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
      <div class="btns"><button class="ui-btn" data-wear>Wear it now</button><button class="ui-btn ui-btn--primary go" data-next>Continue</button></div></div>`;
    this.modal.parentNode.appendChild(el);
    this.awardEl = el;
    sfx.award();
    const next = () => { this._awardShown++; this.award(rest); };
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (b && 'wear' in b.dataset) { sfx.tap(); a.wear(); b.disabled = true; b.innerHTML = `${icon('check')} Wearing it`; }
      else if (b) { sfx.tap(); next(); }
    };
    el.querySelector('[data-next]').focus({ preventScroll: true });
  }

  // The Treasure book (run.showBook): sections [{ title, items: [{ icon, name, text, color?, found, locked? }] }].
  // The sections are tabs (every jelly's Attack upgrades share one). Tap a found one to read what it does;
  // an unfound one is a dim silhouette of its section's icon and where to find it.
  book(title, sections, onBack) {
    this._gen++;
    const key = (s) => (s.title.includes(': ') ? 'Upgrades' : s.title), tabs = [...new Set(sections.map(key))];
    const cell = (it, s) => (it.found
      ? `<button class="ui-tile" data-say="${esc(`${it.icon} ${it.name}: ${it.text}`)}" style="--c:${it.color || 'var(--ui-mint)'}"><span class="ic">${it.icon}</span><span>${esc(it.name)}</span></button>`
      : it.locked ? `<button class="ui-tile locked" data-say="${esc(`${it.name}: ${it.locked}`)}"><span class="ic">${it.icon}</span><span>${esc(it.locked)}</span></button>`   // locked: a silhouette with its goal
        : `<button class="ui-tile" disabled aria-label="Not found yet">${icon((WHERE[key(s)] || WHERE.Treasures)[0])}<span>${(WHERE[key(s)] || WHERE.Treasures)[1]}</span></button>`);
    this.modal.innerHTML = `<div class="ui-panel jf-book jf-sheet"><div class="jf-head"><div class="ui-header"><h2>${icon('book')} ${bare(title)}</h2><button class="ui-btn ui-btn--ghost ui-btn--icon jf-x" data-back aria-label="Close">${icon('close')}</button></div></div>
      <div class="ui-seg jf-tabs" role="group" aria-label="Sections">${tabs.map((t, i) => `<button data-tab="${i}" aria-pressed="${!i}">${t}</button>`).join('')}</div>
      <div class="jf-scroll">${tabs.map((t, i) => `<div data-pane="${i}"${i ? ' hidden' : ''}>${sections.filter((s) => key(s) === t).map((s) => `<h3>${s.title} <small>${s.items.filter((it) => it.found).length} / ${s.items.length}</small></h3><div class="jf-book-grid">${s.items.map((it) => cell(it, s)).join('')}</div>`).join('')}</div>`).join('')}</div>
      <p class="say" aria-live="polite">Select a discovery to read more.</p></div>`;
    this.modal.hidden = false;
    const back = () => { this.close(); onBack(); };
    this.modal.onclick = (e) => {
      const b = e.target.closest('button');
      if (b) sfx.tap();
      if (b?.dataset.say) this.modal.querySelector('.say').textContent = b.dataset.say;
      else if (b && 'tab' in b.dataset) {
        this.modal.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
        this.modal.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
        this.modal.querySelector('.jf-scroll').scrollTop = 0;
      } else if (b && 'back' in b.dataset) back();
    };
    this.keyHandler = (e) => { if (e.code === 'Escape' || (e.code === 'Enter' && !e.target.closest?.('button'))) back(); };
  }

  // what's typed into the dialog's named inputs: { name: value }
  values() { return Object.fromEntries([...this.modal.querySelectorAll('input[name], textarea[name]')].map((i) => [i.name, i.value])); }

  treasure(t, count = 1) {
    const amount = t.levels?.length > 1 ? `Level ${count}` : t.stack > 1 ? `×${count}` : '';
    this.pop.innerHTML = `<span class="ic">${t.icon}</span><div><b>${t.name}</b>${amount ? `<span>${amount}</span>` : ''}</div>`;
    this.pop.classList.remove('ui-pop'); void this.pop.offsetWidth; this.pop.classList.add('ui-pop');   // (replays the pop for a second pick)
    this.pop.hidden = false;
    clearTimeout(this._popT);
    this._popT = setTimeout(() => { this.pop.hidden = true; }, 3600);
  }
}
