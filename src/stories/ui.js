// Stories: the UI kit (src/ui-kit.css, content/look.css --ui-*, src/icons.js) and the guards every
// screen is held to on a phone: no text under 12 px, nothing to tap under 44 px.
import { story, G, fresh, ok, step, offs } from './kit.js';
import { icon, ICON_NAMES } from '../icons.js';
import { juice } from '../juice.js';

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
    // (every stylesheet on the page, the screens' own included, not only the kit's)
    const kitRules = [...[...document.styleSheets].find((s) => s.href?.endsWith('ui-kit.css')).cssRules];
    const topRules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
    const looseHover = topRules.filter((r) => r.selectorText?.includes(':hover') && !r.selectorText.startsWith('body.calm')).map((r) => r.selectorText);
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
  settings: { open() { const m = G().mainMenu; m.show(); over().hidden = false; over().querySelector('[data-act="settings"]').click(); }, close() { const m = G().mainMenu; over().querySelector('[data-act="sheet-close"]').click(); m.restore(); m.home = false; over().classList.remove('menu-home'); over().hidden = true; } },
  trophies: { open() { const m = G().mainMenu; m.show(); over().hidden = false; over().querySelector('[data-act="trophies"]').click(); }, close() { const m = G().mainMenu; over().querySelector('[data-act="sheet-close"]').click(); m.restore(); m.home = false; over().classList.remove('menu-home'); over().hidden = true; } },
  hud: { open() {}, close() {} },
  'dev-panel': { open() { const m = G().mainMenu; m.show(); over().classList.add('dev-open'); over().hidden = false; over().querySelector('[data-act="dev"]').click(); }, close() { const m = G().mainMenu; over().querySelector('[data-act="sheet-close"]').click(); over().classList.remove('dev-open'); m.restore(); m.home = false; over().classList.remove('menu-home'); over().hidden = true; } },
  'type-pick': { open() { G().picker.open({ start: 'normal', onPlay() {}, onBack() {} }); }, close() { G().picker.close(); } },
  'level-up': { open() { const { run } = G(); Object.getPrototypeOf(run).levelUp.call(run); }, close() { G().run.ui.close(); } },
  'treasure-pick': { open() { G().run.pickTreasure(); }, close() { G().run.ui.close(); } },
  book: { open() { G().run.showBook(() => {}); }, close() { G().run.ui.close(); } },
  achievements: { open() { G().run.showAchievements(() => {}); }, close() { G().run.ui.close(); } },
  leaderboard: { open() { G().run.showBoard(() => {}); }, close() { G().run.board.onChange = null; G().run.ui.close(); } },
  'change-look': { open() { over().hidden = false; over().querySelector('[data-act="creator"]').click(); }, close() { document.querySelector('#creator [data-act="done"]').click(); over().hidden = true; } },
  'act-complete': { open() { const { run } = G(); run.devRun(); run.actComplete({ id: 2, subtitle: 'the bathroom' }); }, close() { G().run.ui.close(); } },
  death: { open() { const { run } = G(); run.devRun(); run.phase = 'dead'; run.driedOut.begin(); run.endRun('You dried out', 'Back to a polyp. Another run awaits.', 'Try again'); }, close() { G().run.ui.close(); G().run.start(); } },
  win: { open() { const { run } = G(); run.devRun(); run.phase = 'won'; run.endRun('Run complete', '', 'Play again from act 1', { parts: true }); }, close() { G().run.ui.close(); } },
  'win-sea': { open() { const { run } = G(); run.devRun(); run.victory.begin(() => {}); step(120); }, close() { G().run.victory.cancel(); } },
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
// Offenders allowed for now, as "screen: element" (an entry also covers the same element with more
// classes: its states, .on, .locked). The UI overhaul's redo cleared every one; a new offender fails the
// story, so fix it rather than listing it here.
const KNOWN = { text: [], targets: [] };
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

// --- the death screen at Large text on a phone held sideways: the fullest end screen on the smallest one
story('ui/death-screen-fits-at-large-text', {
  phone: true,
  about: 'On a phone held sideways with Large text, the death screen holds every hint whole: the hint, the time/Level/bugs chips and the numbers all fit above the buttons with nothing scrolled out of sight or overlapping, and "The Vacuum was 4:20 away" stays on one line.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  async play() {
    const root = document.documentElement, was = root.dataset.textSize;
    root.dataset.textSize = 'large';
    try {
      await document.fonts.ready;
      G().run.t = G().run.duration - 260;   // 4:20 before the boss
      SCREENS.death.open(); step(2); settle();
      const { DEATH_HINTS, TYPE_HINTS } = await import('../first-run.js');
      const $ = (s) => document.querySelector('.jf-end ' + s), box = (e) => e.getBoundingClientRect();
      const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const body = $('.jf-end-body'), hint = $('.jf-hint'), btns = box($('.btns')), bad = [];
      for (const h of new Set([...DEATH_HINTS, ...TYPE_HINTS])) {
        hint.lastChild.textContent = ' ' + h;   // after its icon
        const parts = { hint, chips: $('.jf-chips'), numbers: $('.jf-stats') };
        if (body.scrollHeight > body.clientHeight + 1) bad.push(`scrolls ${body.scrollHeight - body.clientHeight} px: ${h}`);
        for (const [k, e] of Object.entries(parts)) if (box(e).bottom > btns.top || box(e).bottom > box(body).bottom + 1) bad.push(`${k} under the buttons: ${h}`);
        if (meet(box(hint), box(parts.chips)) || meet(box(parts.chips), box(parts.numbers))) bad.push(`overlap: ${h}`);
      }
      const close = [...document.querySelectorAll('.jf-end .jf-stats > b')].find((b) => b.textContent.includes('away'));
      const oneLine = !!close && box(close).height < 2 * px(close);   // one line of text is ~1.35 its size
      return ok(!bad.length && oneLine, { bad: bad.slice(0, 5), close: close?.textContent, height: Math.round(close ? box(close).height : 0) });
    } finally { try { SCREENS.death.close(); } catch {} step(1); root.dataset.textSize = was || 'normal'; }
  },
});

// --- motion guards (the motion-design plan): what moves on each screen, and how
// The HUD's own moving states, set going the way the game does; each screen's own animations come from SCREENS.
const HUD_STATES = {
  'hud: low Health': { open() { const h = G().hud; h.resetHealth(); h.setHealth(100, 100); h.setHealth(20, 100); h.setHealth(60, 100); h.setHealth(20, 100); const e = h.hpNodes['hp-edge-track']; e.style.transitionDuration = '180ms'; e.style.transform = 'translateX(90%)'; }, close() { G().hud.resetHealth(); } },
  'hud: Shield charging': { open() { const h = G().hud; h.setShield({ hp: 1, max: 3, state: 'broken', charging: false }); h.setShield({ hp: 1, max: 3, state: 'charging', charging: true }); h.setShield({ hp: 3, max: 3, state: 'full', charging: false }); h.setShield({ hp: 1, max: 3, state: 'charging', charging: true }); }, close() { G().hud.setShield({ hp: 0, max: 0, state: null, charging: false }); } },
  'hud: Treasure pop': { open() { const items = G().hud.$('.items'), el = items.firstElementChild || items.appendChild(document.createElement('span')); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }, close() { G().hud.$('.items').querySelectorAll('.pop').forEach((e) => e.classList.remove('pop')); } },
  'treasure pick: outro': { open() { G().run.pickTreasure(); const cards = [...G().run.ui.modal.querySelectorAll('.jf-card')]; cards[0]?.classList.add('jf-sheen'); cards[0]?.click(); }, close() { G().run.ui.close(); document.querySelectorAll('.jf-flyer').forEach((e) => e.remove()); } },   // (a flyer outlives the screen by a moment: not into the next guard)
  'hud: level ding': { open() { G().hud.levelDing(innerWidth / 2, innerHeight / 2); }, close() { document.querySelectorAll('.jf-ding-ring').forEach((e) => e.remove()); G().hud.$('.lvl').classList.remove('ding'); } },
};
// Everything animating (CSS animations and transitions) while each screen is open, as "<name>: <property>".
// Read straight after the screen opens and again two steps in, so short and delayed ones are both caught.
function motionOf() {
  const found = new Map(), failed = [];
  for (const [screen, s] of Object.entries({ ...SCREENS, ...HUD_STATES })) {
    const read = () => { for (const a of document.getAnimations()) {
      const target = a.effect?.target; if (!target) continue;
      const name = a.animationName || (a.transitionProperty ? 'transition ' + a.transitionProperty : 'script ' + nameOf(target));
      for (const kf of a.effect.getKeyframes()) for (const prop of Object.keys(kf)) {
        if (!['offset', 'computedOffset', 'easing', 'composite'].includes(prop)) found.set(`${screen} | ${name}: ${prop}`, true);
      }
    } };
    try { s.open(); read(); step(2); read(); }
    catch (e) { failed.push(`${screen}: ${e.message}`); }
    finally { try { s.close(); } catch {} step(1); }
  }
  return { list: [...found.keys()], failed };
}
// Allowed for now, as "animation name: property" tagged by the task that removes it (a name matches on any screen).
// A new offender fails the story: use transform and opacity (a glow is a pre-painted layer whose opacity moves).
const KNOWN_MOTION = {
};
const KNOWN_CALM = {
  'jf-swim: transform': 'M4', 'jf-wave: transform': 'M4', 'jf-shine: transform': 'M4',   // the title screen's ambient loops keep going
};
const motionGuard = (name, about, calm, bad, known) => story(name, {
  phone: true,
  about,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const was = document.body.classList.contains('calm'), wasJuice = juice.calm;
    document.body.classList.toggle('calm', calm); juice.calm = calm;
    let r;
    try { r = motionOf(); } finally { document.body.classList.toggle('calm', was); juice.calm = wasJuice; }
    const key = (k) => k.split(' | ')[1];
    const hits = r.list.filter((k) => bad.test(key(k).split(': ').pop()));
    const added = [...new Set(hits.filter((k) => !(key(k) in known)).map(key))];
    const fixed = Object.keys(known).filter((k) => !hits.some((h) => key(h) === k));
    const byTask = {}; for (const k of Object.keys(known)) (byTask[known[k]] ||= []).push(k);
    return ok(!r.failed.length && !added.length, { new: added, failed: r.failed, fixed, known: byTask, animating: r.list.length });
  },
});
motionGuard('ui/motion-is-cheap', 'On every main screen and the HUD\'s moving states (low Health, Shield charging, a Treasure pop, a level ding), nothing animates box-shadow, filter, left, top, width, height or background-position (they repaint every frame on a phone), apart from today\'s known offenders, each listed under the task that removes it.', false, /^(boxShadow|filter|left|top|width|height|backgroundPosition[XY]?)$/, KNOWN_MOTION);
motionGuard('ui/calm-only-fades', 'With Reduce effects on, everything that animates on the main screens only fades: opacity (and colour) are the only properties that change, apart from today\'s known offenders.', true, /^(?!opacity$|color$|backgroundColor$|borderColor$|visibility$|display$)/, KNOWN_CALM);
