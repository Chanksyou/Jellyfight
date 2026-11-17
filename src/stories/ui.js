// Stories: the UI kit (src/ui-kit.css, content/look.css --ui-*, src/icons.js) and the guards every
// screen is held to on a phone: no text under 12 px, nothing to tap under 44 px.
import { story, G, fresh, ok, step, offs } from './kit.js';
import { icon, ICON_NAMES } from '../icons.js';

// --- every piece of the kit on one sheet (index.html?story=ui/kit)
export function kitSheet() {
  const el = document.createElement('div');
  el.id = 'ui-kit-sheet';
  el.style.cssText = 'position:fixed;inset:0;z-index:70;overflow:auto;padding:16px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left));background:var(--ui-deep);display:grid;gap:16px;align-content:start;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))';
  const box = (title, html) => `<section class="ui-panel"><p class="ui-label" style="margin:0 0 12px">${title}</p>${html}</section>`;
  const row = 'style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"';
  el.innerHTML = [
    box('Type', `<h1 class="ui-display">Jelly Run</h1><h2 class="ui-title">Act 2 complete</h2><h3 class="ui-heading">Choose a treasure</h3>
      <p class="ui-text">Bugs drop <b>XP</b>. Grow strong enough to beat the <b>Vacuum</b> in <b>3:00</b>.</p><p class="ui-label">Night 1 · Kitchen</p>`),
    box('Buttons', `<div ${row}><button class="ui-btn ui-btn--primary" data-kit="primary">${icon('play')}Play</button>
      <button class="ui-btn">${icon('reroll')}Reroll</button><button class="ui-btn ui-btn--ghost">Skip</button>
      <button class="ui-btn ui-btn--icon" aria-label="Settings">${icon('gear')}</button><button class="ui-btn" disabled>${icon('lock')}Locked</button></div>`),
    box('Header and panel', `<div class="ui-panel" style="box-shadow:none"><div class="ui-header"><h2>Treasure book</h2>
      <button class="ui-btn ui-btn--icon" aria-label="Close">${icon('close')}</button></div><p class="ui-text">A panel is solid and a little see-through.</p></div>`),
    box('Cards', `<div style="display:grid;gap:8px">${[['common', '🪙', 'Gold Ring', 'Damage <b>+10%</b>.', '×2'], ['rare', '🧲', 'Fridge Magnet', 'Pull XP from <b>+40%</b> farther.', ''],
      ['epic', '🕯️', 'Candle', 'Every <b>3 s</b> a ring of fire deals <b>8</b>.', ''], ['legendary', '🌙', 'Night-Light', 'While lit: <b>+40%</b> Fire rate, <b>+0.5</b> Health a second.', '']]
      .map(([r, i, n, t, c]) => `<button class="ui-card" data-rarity="${r}"><span class="ui-card-icon">${i}</span><span class="ui-card-rarity">${r}</span><h3 class="ui-card-name">${n}</h3><p class="ui-card-body">${t}</p>${c ? `<span class="ui-card-count">${c}</span>` : ''}</button>`).join('')}</div>`),
    box('Tiles', `<div ${row}><button class="ui-tile">${icon('book')}Book</button><button class="ui-tile">${icon('medal')}Achievements</button><button class="ui-tile">${icon('trophy')}Leaderboard</button><button class="ui-tile">${icon('pearl')}Shop</button></div>`),
    box('Bars', `<div style="display:grid;gap:10px"><div class="ui-bar ui-bar--tall" data-kind="health" style="--value:.72"><i></i><span>72 / 100</span></div>
      <div class="ui-bar" data-kind="shield" style="--value:.4"><i></i></div><div class="ui-bar" data-kind="xp" style="--value:.55"><i></i></div>
      <div class="ui-bar ui-bar--tall" data-kind="boss" style="--value:.9"><i></i><span>Vacuum</span></div></div>`),
    box('Toast, chips, choice', `<div ${row}><div class="ui-toast" data-kit="toast">${icon('star')}Achievement earned</div></div>
      <div ${row} style="margin-top:12px"><span class="ui-chip">${icon('clock')}2:41</span><span class="ui-chip">${icon('pearl')}120</span><button class="ui-chip" aria-pressed="true">Fire</button></div>
      <div style="margin-top:12px" class="ui-seg" role="group" aria-label="Text size"><button aria-pressed="true">Normal</button><button aria-pressed="false">Large</button></div>`),
    box('Icons', `<div ${row} data-kit="icons">${ICON_NAMES.map((n) => `<span class="ui-chip" title="${n}">${icon(n)}<span>${n}</span></span>`).join('')}</div>`),
    box('Sheet', `<button class="ui-btn" data-kit="sheet-open">${icon('gear')}Open a sheet</button>
      <div class="ui-scrim" hidden data-kit="scrim"></div><section class="ui-sheet" hidden data-kit="sheet" role="dialog" aria-label="Settings">
      <div class="ui-header"><h2>Settings</h2><button class="ui-btn ui-btn--icon" aria-label="Close" data-kit="sheet-close">${icon('close')}</button></div>
      <p class="ui-text">A sheet rises from the bottom on a phone and sits in the middle on a big screen.</p>
      <div class="ui-seg" role="group" aria-label="Music" style="margin-top:12px"><button aria-pressed="true">${icon('music')}On</button><button aria-pressed="false">Off</button></div></section>`),
    box('Motion', `<div ${row}><span class="ui-chip ui-enter" data-kit="enter">enter</span><span class="ui-chip ui-pop">pop</span><span class="ui-chip ui-leave" style="animation-iteration-count:infinite;animation-duration:1.5s">leave</span></div>`),
  ].join('');
  const scrim = el.querySelector('[data-kit=scrim]'), sheet = el.querySelector('[data-kit=sheet]');
  const show = (on) => { for (const x of [scrim, sheet]) { x.hidden = !on; x.classList.toggle('ui-enter', on); } };
  el.querySelector('[data-kit=sheet-open]').onclick = () => show(true);
  el.querySelector('[data-kit=sheet-close]').onclick = scrim.onclick = () => show(false);
  document.body.appendChild(el);
  return el;
}

const seenNow = (e) => e.getClientRects().length > 0;
const px = (el, prop = 'fontSize') => parseFloat(getComputedStyle(el)[prop]);
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue('--ui-' + name).trim();
async function fontsReady() {
  await Promise.all(['600 20px Fredoka', '400 15px Inter', '700 15px Inter'].map((f) => document.fonts.load(f).catch(() => [])));
  return { fredoka: document.fonts.check('600 20px Fredoka'), inter: document.fonts.check('400 15px Inter') };
}

const kitStory = (phone) => ({
  phone,
  about: phone
    ? 'The kit\'s sizes on a phone held sideways (844x390): display 44, title 24, heading 18, body 14 and label 12 px, every button, tile and choice at least 44 px tall, and the Large text setting scaling them all.'
    : 'Every piece of the UI kit on one sheet: Fredoka headings and Inter text loaded from assets/fonts, the --ui-* colours from look.css (gold primary, rarity frames, bar fills), all 25 icons drawn from the sprite, nothing to tap under 44 px, no text under 12 px, and with Reduce effects on, things only fade in.',
  setup() {
    fresh({ elites: false });
    const sheet = kitSheet();
    offs.push(() => sheet.remove());
  },
  async play() {
    const sheet = document.getElementById('ui-kit-sheet'), $ = (s) => sheet.querySelector(s), $$ = (s) => [...sheet.querySelectorAll(s)];
    const fonts = await fontsReady();
    const family = (s) => getComputedStyle($(s)).fontFamily.split(',')[0].replace(/"/g, '').trim();
    const faces = { display: family('.ui-display'), text: family('.ui-text') };
    const sizes = Object.fromEntries(['display', 'title', 'heading', 'text', 'label'].map((k) => [k, +px($('.ui-' + k)).toFixed(2)]));
    const gold = getComputedStyle($('[data-kit=primary]')).backgroundColor === 'rgb(255, 212, 108)' && token('gold') === '#ffd46c';
    const rarity = $$('.ui-card').map((c) => getComputedStyle(c).borderTopColor);
    const rarities = new Set(rarity).size === 4 && rarity[1] === 'rgb(95, 182, 255)';
    const bar = $('.ui-bar[data-kind="health"] > i').getBoundingClientRect(), track = $('.ui-bar[data-kind="health"]').getBoundingClientRect();
    const filled = Math.abs(bar.width / (track.width - 2) - .72) < .02;
    const drawn = $$('[data-kit=icons] svg.ui-icon').filter((s) => s.querySelector('use').getBBox().width > 4).length;
    const icons = drawn === ICON_NAMES.length && ICON_NAMES.length >= 25;
    $('[data-kit=sheet-open]').click();
    for (const a of $('[data-kit=sheet]').getAnimations()) a.finish();   // where it rests, not mid-rise
    const sh = $('[data-kit=sheet]').getBoundingClientRect();
    const sheetAt = phone ? Math.abs(sh.bottom - innerHeight) < 1 && sh.width === innerWidth : Math.abs((sh.top + sh.bottom) / 2 - innerHeight / 2) < 2 && sh.width < innerWidth;
    const tappable = $$('button').filter(seenNow);
    const small = tappable.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((b) => b.className + ' ' + b.textContent.trim());
    $('[data-kit=sheet-close]').click();
    const closed = $('[data-kit=sheet]').hidden;
    const tiny = $$('*').filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && px(e) < 12).map((e) => e.className || e.tagName);
    // Large text: every size grows by --ui-text-large
    const root = document.documentElement;
    root.dataset.textSize = 'large';
    const large = +(px($('.ui-text')) / sizes.text).toFixed(2);
    delete root.dataset.textSize;
    // Reduce effects (body.calm, and the device's reduced motion): arriving only fades
    const calm = document.body.classList.contains('calm');
    document.body.classList.add('calm');
    const fades = getComputedStyle($('[data-kit=enter]')).animationName === 'ui-fade-in';
    document.body.classList.toggle('calm', calm);
    const moves = getComputedStyle($('[data-kit=enter]')).animationName === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'ui-fade-in' : 'ui-in');
    // hover looks only where there is a mouse: a tapped button on a phone would otherwise stay lit (Reduce effects' reset is fine)
    const kitRules = [...[...document.styleSheets].find((s) => s.href?.endsWith('ui-kit.css')).cssRules];
    const looseHover = kitRules.filter((r) => r.selectorText?.includes(':hover') && !r.selectorText.startsWith('body.calm')).map((r) => r.selectorText);
    const hoverGated = !looseHover.length && kitRules.some((r) => r.media?.mediaText === '(hover: hover)');
    const near = (a, b) => Math.abs(a - b) < .05;
    const scale = phone
      ? near(sizes.display, 44) && near(sizes.title, 24) && near(sizes.heading, 18) && near(sizes.text, 14) && near(sizes.label, 12)
      : sizes.display > 44 && sizes.display <= 64 && sizes.label >= 12 && sizes.label <= 13;
    const good = fonts.fredoka && fonts.inter && faces.display === 'Fredoka' && faces.text === 'Inter' && scale && gold && rarities && filled && icons
      && sheetAt && closed && !small.length && !tiny.length && large === 1.15 && fades && moves && hoverGated;
    return ok(good, { fonts, faces, sizes, gold, rarity, filled, icons: `${drawn}/${ICON_NAMES.length}`, sheetAt, closed, small, tiny, large, fades, moves, looseHover });
  },
});
story('ui/kit', kitStory(false));
story('ui/kit-on-a-phone', kitStory(true));

// --- the guards: the main screens on a phone, measured as a player sees them. Screens are opened the
// way the game opens them and closed again; each returns what to measure.
const over = () => document.getElementById('g-over');
export const SCREENS = {
  title: { open() { const m = G().mainMenu; m.show(); over().hidden = false; }, close() { const m = G().mainMenu; m.restore(); m.home = false; over().classList.remove('menu-home'); over().hidden = true; } },
  pause: { open() { over().hidden = false; }, close() { over().hidden = true; } },
  hud: { open() {}, close() {} },
  'type-pick': { open() { G().picker.open({ start: 'normal', onPlay() {}, onBack() {} }); }, close() { G().picker.close(); } },
  'level-up': { open() { const { run } = G(); Object.getPrototypeOf(run).levelUp.call(run); }, close() { G().run.ui.close(); } },
  'treasure-pick': { open() { G().run.pickTreasure(); }, close() { G().run.ui.close(); } },
  book: { open() { G().run.showBook(() => {}); }, close() { G().run.ui.close(); } },
  achievements: { open() { G().run.showAchievements(() => {}); }, close() { G().run.ui.close(); } },
  leaderboard: { open() { G().run.showBoard(() => {}); }, close() { G().run.board.onChange = null; G().run.ui.close(); } },
  'change-look': { open() { over().hidden = false; over().querySelector('[data-act="creator"]').click(); }, close() { document.querySelector('#creator [data-act="done"]').click(); over().hidden = true; } },
  'act-complete': { open() { const { run } = G(); run.devRun(); run.actComplete({ id: 2, subtitle: 'the bathroom' }); }, close() { G().run.ui.close(); } },
  death: { open() { const { run } = G(); run.devRun(); run.die(); }, close() { G().run.ui.close(); } },
  win: { open() { const { run } = G(); run.devRun(); run.phase = 'won'; run.endRun('🏆 You won!', run.stage.won || 'The apartment is yours.', 'Play again from act 1', { parts: true }); }, close() { G().run.ui.close(); } },
  'turn-sideways': { phone: true, open() { const { upright } = G(); upright.test = true; upright.update(); }, close() { const { upright } = G(); upright.test = null; upright.update(); over().hidden = true; } },
};
// a short, stable name for an element: its tag and classes, under its parent's
const tagOf = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].filter((c) => !/^(menu-pop|ui-enter|ui-leave)$/.test(c)).map((c) => '.' + c).join('');
const nameOf = (e) => (e.parentElement && e.parentElement !== document.body ? tagOf(e.parentElement) + ' > ' : '') + tagOf(e);
const seen = (e) => {
  if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
};
const TAPPABLE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])';
// the HUD shows behind most screens: it's measured as its own screen only
const mine = (screen) => (e) => screen === 'hud' || !e.closest('#hud');
const MEASURE = {
  text: (screen) => [...document.body.querySelectorAll('*')].filter(mine(screen)).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && seen(e) && px(e) < 12)
    .map((e) => [nameOf(e), `${+px(e).toFixed(1)} px`]),
  targets: (screen) => [...document.body.querySelectorAll(TAPPABLE)].filter(mine(screen)).filter((e) => seen(e) && !e.disabled).map((e) => [e, e.getBoundingClientRect()])
    .filter(([e, r]) => e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)))   // on top, not under another screen
    .filter(([, r]) => r.width < 44 || r.height < 44).map(([e, r]) => [nameOf(e), `${Math.round(r.width)}x${Math.round(r.height)}`]),
};
// Today's offenders (before the UI overhaul restyles their screens), as "screen: element". Each is
// allowed until its screen is redone; wave 3 empties these lists. A new offender fails the story.
// An entry also covers the same element with more classes (its states: .on, .locked, .shop).
const KNOWN = {
  text: [
    'hud: div.bar.moist > span.hpn', 'hud: div.tc > div.stage',
    'type-pick: div.tp-bars > div.tp-bar',
    'change-look: div.sec > div.lbl',
    // found once screens were measured at rest, after their deal-in (settle, below)
    'level-up: button.jf-card > span.rar', 'level-up: button.jf-card > span.now',
    'treasure-pick: button.jf-card > span.jf-new', 'treasure-pick: button.jf-card > span.rar', 'treasure-pick: button.jf-card > span.delta',
    'treasure-pick: button.jf-card.jf-sheen > span.jf-new', 'treasure-pick: button.jf-card.jf-sheen > span.rar',
    'book: button > span', 'book: button.locked > span', 'win: b > small.jf-best',
  ],
  targets: [
    'title: details.menu-help > summary', 'title: div.row > button', 'title: b.seg > button',
    'pause: div > button.play', 'pause: div.row > button', 'pause: b.seg > button',
    'type-pick: header > button.tp-back',
    'change-look: div.sec > input', 'change-look: div.chips > button', 'change-look: footer > button',
    // 41 px tall with Inter or San Francisco (padding round one line of 15-18 px text, no min-height); taller fonts hide them
    'title: div > button.play', 'level-up: div.btns > button', 'achievements: div.btns > button', 'leaderboard: div.btns > button',
    'act-complete: div.btns > button', 'win: div.btns > button',
  ],
};
// a screen is measured where it comes to rest: arriving animations (.ui-enter, a card's deal-in) start
// see-through, and an element at opacity 0 isn't seen, so skip them to their end (looping ones run on)
const settle = () => { for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); };
const guard = (kind, about) => story('ui/' + (kind === 'text' ? 'text-at-least-12px' : 'targets-at-least-44px'), {
  phone: true,
  about,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const found = {}, failed = [];
    for (const [screen, s] of Object.entries(SCREENS)) {
      try { s.open(); step(2); settle(); found[screen] = MEASURE[kind](screen); }
      catch (e) { failed.push(`${screen}: ${e.message}`); }
      finally { try { s.close(); } catch {} step(1); }
    }
    const all = [...new Map(Object.entries(found).flatMap(([screen, list]) => list.map(([name, size]) => [`${screen}: ${name}`, size]))).entries()];
    const covers = (k, a) => a === k || a.startsWith(k + '.');
    const added = all.filter(([a]) => !KNOWN[kind].some((k) => covers(k, a))).map(([a, size]) => `${a} (${size})`);
    const fixed = KNOWN[kind].filter((k) => !all.some(([a]) => covers(k, a)));   // not seen any more: take it off the list
    return ok(!failed.length && !added.length, { new: added, failed, fixed, known: KNOWN[kind].length, screens: Object.keys(found).length });
  },
});
guard('text', 'On a phone held sideways, no text on the main screens (title, pause, HUD, type pick, level-up, treasure pick, book, achievements, leaderboard, Change your look, act complete, death, win, turn your phone) is smaller than 12 px, apart from today\'s known offenders, which their screen\'s redo removes.');
guard('targets', 'On a phone held sideways, nothing to tap on the main screens is smaller than 44 x 44 px, apart from today\'s known offenders, which their screen\'s redo removes.');
