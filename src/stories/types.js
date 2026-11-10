// Stories: jelly types (content/jellies.kdl, src/jelly-types.js), built behind the GAME.types
// switch until release. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { CONTENT, compileJellies, compileTreasures } from '../content.js';
import { PLAYER } from '../events.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { jellyStats, typeBars, typeDetails, TYPE_SWITCH } from '../jelly-types.js';
import { PLAYED_KEY, picksType } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { SAVE_KEY, carried, keepRun } from '../stages.js';
import { G, fresh, give, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const TYPE_IDS = ['normal', 'fire', 'lightning', 'ice', 'poison', 'wind', 'glitter', 'tentacle'];

story('content/jellies-load', {
  about: 'content/jellies.kdl lists all eight jelly types, Normal lists no stats, and a mistake in the file names the file, line and problem.',
  setup() {},
  play() {
    const ids = Object.keys(CONTENT.jellies);
    const all = TYPE_IDS.every((id) => ids.includes(id)) && ids.length === TYPE_IDS.length;
    const sane = Object.values(CONTENT.jellies).every((j) => j.hit > 0 && j.name && Object.keys(j.stats).every((k) => k in BASE_STATS));
    const tryIt = (src) => { try { compileJellies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const ok1 = 'jelly "normal" name="N" about="A" attack="bubble" hit=1\n';
    const badStat = tryIt(ok1 + 'jelly "x" name="X" about="A" attack="fire" hit=1 {\n    stat speed 2\n}');
    const badAttack = tryIt(ok1 + 'jelly "x" name="X" about="A" attack="laser" hit=1');
    const noHit = tryIt(ok1 + 'jelly "x" name="X" about="A" attack="fire"');
    const noNormal = tryIt('jelly "x" name="X" about="A" attack="fire" hit=1');
    const caught = /test\.kdl:3: "x" stat must be one of/.test(badStat) && /test\.kdl:2: "x" attack= must be one of/.test(badAttack) && /needs hit=/.test(noHit) && /no jelly called "normal"/.test(noNormal);
    return ok(all && sane && caught, { ids, sane, badStat, badAttack, noHit, noNormal });
  },
});

story('types/normal-is-todays-jelly', {
  about: 'With the switch off a run is Normal and starts on BASE_STATS, and does count; a Normal run with the switch on has the same stats but is a dev run.',
  setup() { fresh(); },
  play() {
    const { run, GAME } = G();
    const same = (s) => Object.keys(BASE_STATS).every((k) => s[k] === BASE_STATS[k]);
    const off = run.jelly === 'normal' && same(run.stats) && !GAME.types;
    fresh({ types: 'normal' });
    const on = run.jelly === 'normal' && same(run.stats) && GAME.types && run.dev;
    fresh();
    const back = !GAME.types && run.jelly === 'normal';
    return ok(off && on && back, { off, on, back, jelly: run.jelly });
  },
});

story('types/jelly-stats-apply', {
  about: 'A run started as Fire begins with Health 19, Attack damage 7.5, Fire rate 1.5/s and Move speed 105%; every other stat is Normal\'s.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const { run } = G(), s = run.stats;
    const fire = run.jelly === 'fire' && s.health === 19 && s.bubbleDamage === 7.5 && s.fireRate === 1.5 && s.moveSpeed === 1.05 && run.health === 19;
    const rest = Object.keys(BASE_STATS).filter((k) => !['health', 'bubbleDamage', 'fireRate', 'moveSpeed'].includes(k)).every((k) => s[k] === BASE_STATS[k]);
    const live = run.S.health === 19 && run.S.bubbleDamage >= 7.5;   // what the systems read, with the act's carried Treasures on top
    fresh();
    return ok(fire && rest && live, { fire, rest, live, stats: { health: s.health, bubbleDamage: s.bubbleDamage, fireRate: s.fireRate, moveSpeed: s.moveSpeed } });
  },
});

story('types/jelly-survives-reload', {
  act: 2,
  about: 'A run\'s jelly type is carried into the next act and through a reload part way through an act, with its stats; an older carry with no type is Normal.',
  setup() { fresh(); },
  play() {
    const { run } = G(), was = sessionStorage.getItem('jellyrun.act'), wasCarry = run.carry, kept = localStorage.getItem(SAVE_KEY);
    stub(run, 'later', () => {});
    try {
      // an older carry (from before jelly types): Normal
      const old = run.jelly === 'normal' && !('jelly' in (wasCarry || {}));
      // the act as it began, carried from a Fire run's act 1
      run.jelly = 'fire'; run.stats = jellyStats('fire');
      const start = { ...run.carryOver(), logId: 'types-reload-story' };
      sessionStorage.setItem('jellyrun.act', JSON.stringify({ act: 2, carry: start, then: null }));
      keepRun(2, start);
      run.carry = start; run.resumed = false;
      run.start();
      const carriedOn = run.jelly === 'fire' && run.stats.health === 19 && run.stats.bubbleDamage === 7.5;
      // part way through, then the page reloads
      run.t = 120; run.health = 9; run.dev = false;
      run.keepProgress();
      run.carry = carried(); run.resumed = false;
      run.start();
      const back = run.jelly === 'fire' && run.t === 120 && run.health === 9 && run.stats.fireRate === 1.5;
      return ok(old && carriedOn && back, { old, carriedOn, back, jelly: run.jelly, t: run.t, health: run.health });
    } finally {
      run.carry = wasCarry; run.resumed = false;
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
      if (kept === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, kept);
      fresh();
    }
  },
});

// ------------------------------------------------------------------ P4: each type's one attack
// what hurt bugs during n frames, by source ('bubble' split into plain bubbles and each Element's shot)
function hurtBy(frames) {
  const log = record('damage_taken');
  step(frames);
  const by = {};
  for (const d of log) if (d.targetId !== PLAYER) { const k = d.source === 'bubble' && d.feedback?.element ? d.feedback.element : d.source; (by[k] ||= []).push(d.amount); }
  return by;
}

story('types/normal-has-no-lash', {
  about: 'With the switch on a Normal jelly blows bubbles and never lashes, even with a bug right under its tentacles; with the switch off the same bug is stung.',
  setup() { setupFight({ types: 'normal' }); },
  play() {
    roachAt(0, -0.06);
    const on = hurtBy(60 * 3);
    setupFight();
    roachAt(0, -0.06);
    const off = hurtBy(60 * 3);
    const pass = on.bubble?.length > 0 && !on.tentacle && off.tentacle?.length > 0;
    return ok(pass, { on: Object.keys(on), off: Object.keys(off) });
  },
});

story('types/fire-shot-is-the-only-attack', {
  about: 'A Fire jelly hurts a bug only with its Fire shot and the Burn it sets: no plain bubbles, no tentacle stings, and no Element pick at the start of a run or, on a new player\'s first run, after the first card. Each shot hits for hit= x Attack damage (7.5 x 0.5).',
  setup() { setupFight({ types: 'fire' }); },
  play() {
    const { run, menus } = G();
    run.startPicked = false;
    step(2);
    const noPick = !menus.open && run.owned.size === 0;
    roachAt(0, -0.06);
    const by = hurtBy(60 * 4);
    const only = Object.keys(by).every((k) => k === 'fire') && by.fire?.length > 0;
    const shots = (by.fire || []).filter((a) => Math.abs(a - 7.5 * 0.5) < 1e-9).length, burns = (by.fire || []).length - shots;
    // a new player's first run opens the Element pick after the first card instead: not for a jelly type
    fresh({ types: 'fire', firstRun: true, levels: true });
        const offers = [];
    stub(run, 'offer', (title) => offers.push(title));   // the Element pick is an offer of Treasures
    run.pendingLevels = 1; run.levelUp();
    step(90, () => document.querySelector('.jf-card'));
    document.querySelector('.jf-card')?.click();
    step(60);
    const noFirstRunPick = !offers.length && run.owned.size === 0 && !run.choosingCard;
    return ok(noPick && noFirstRunPick && only && shots > 0 && burns > 0, { noPick, noFirstRunPick, offers, choosing: run.choosingCard, sources: Object.keys(by), shots, burns });
  },
});

story('types/fire-fires-at-full-fire-rate', {
  about: 'A Fire jelly fires its Fire shot at its full Fire rate (1.5 a second, so about 12 in 8 s), not at the old Birthday Candle\'s 0.75 a second; raising Fire rate raises it with it.',
  setup() { setupFight({ types: 'fire' }); },
  play() {
    const { run } = G();
    roachAt(0, -0.15);
    const shots = spy(run.bubbles, 'elementVolley');
    step(60 * 8);
    const base = shots.length;
    run.stats.fireRate = 3;
    step(60 * 8);
    const faster = shots.length - base;
    return ok(base >= 11 && base <= 13 && faster >= 23 && faster <= 25, { base, faster });
  },
});

story('types/tentacle-has-no-bubbles', {
  about: 'A Tentacle jelly never blows a bubble or fires an Element, even with a bug in Range; it stings what comes into Tentacle reach (11 cm) for its Attack damage (9), Fire rate times a second.',
  setup() { setupFight({ types: 'tentacle' }); },
  play() {
    const { run } = G();
    give('candle');   // an Element owned anyway does nothing for it
    const far = roachAt(0, -0.2);
    const blows = spy(run.bubbles, 'blow');
    const before = hurtBy(60 * 2);
    far.dead = true;
    roachAt(0, -0.06);
    const stings = hurtBy(60 * 4).tentacle || [];
    const pass = !blows.length && !Object.keys(before).length && stings.length >= 6 && stings.length <= 8 && stings.every((a) => Math.abs(a - 9) < 1e-9);
    return ok(pass, { blows: blows.length, before: Object.keys(before), stings: stings.length, first: stings[0] });
  },
});

story('types/tentacle-attacks-strike-different-bugs', {
  about: 'A Tentacle jelly\'s Attacks (3) is how many tentacles strike at once, each at a different bug; Tentacle damage, Tentacle speed and Tentacles from Treasures aren\'t read with the switch on.',
  setup() { setupFight({ types: 'tentacle' }); },
  play() {
    const { run } = G();
    give('nettle', 'spaghetti', 'chopsticks');   // old tentacle stats: ignored
    const bugs = [roachAt(0.05, -0.04), roachAt(-0.05, -0.04), roachAt(0, -0.07), roachAt(0.06, 0.03)];
    const strikes = spy(run.lash, 'strike');
    step(60, () => strikes.length > 0);
    step(1);
    const first = strikes.map((a) => a[1]), dmg = strikes.map((a) => a[2]);
    const T = run.tentacleStats;
    const pass = first.length === 3 && new Set(first).size === 3 && first.every((e) => bugs.includes(e)) && dmg.every((d) => Math.abs(d - 9) < 1e-9)
      && T.tentacles === 3 && Math.abs(T.reach - 0.11) < 1e-9 && T.tentacleDamage === run.S.bubbleDamage && T.tentacleSpeed === run.S.fireRate;
    return ok(pass, { strikes: first.length, distinct: new Set(first).size, dmg, T });
  },
});

story('types/tentacle-is-not-offered-range', {
  about: 'A Tentacle jelly is never offered the Range card or a Treasure that only adds Range or Pierce (Drinking Straw, Bobby Pin): not-for="tentacle" on the card and Treasure. A Fire jelly is.',
  setup() { fresh({ types: 'tentacle', levels: true }); },
  play() {
    const { run } = G();
    const offered = () => {
      const cards = new Set(), treasures = new Set();
      stub(run.ui, 'levelUp', (lvl, list) => { for (const c of list) cards.add(c.stat); });
      stub(run, 'offer', (title, sub, list) => { for (const t of list) treasures.add(t.id); });
      for (let i = 0; i < 300; i++) { run.pendingLevels = 1; run.levelUp(); run.pickTreasure(); }
      return { cards, treasures };
    };
    const t = offered();
    fresh({ types: 'fire', levels: true });
    const f = offered();
    const tentacleNot = !t.cards.has('range') && !t.treasures.has('straw') && !t.treasures.has('bobbyPin') && t.cards.has('fireRate');
    const fireGets = f.cards.has('range') && f.treasures.has('straw');
    const caught = (() => { try { compileTreasures(parse('treasure "x" name="X" icon="x" text="x" not-for="laser" {\n    stat range 1\n}', 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } })();
    return ok(tentacleNot && fireGets && /not-for= takes attacks from/.test(caught), { tentacle: [...t.cards], fireCards: [...f.cards], straw: f.treasures.has('straw'), caught });
  },
});

// --- the pick screen (src/pick-screen.js, docs/jelly-types/spec-pick-screen.md) ---------------------
// A story plays as a returning player (a played run on record) or a first-time one, and puts it back after
function asPlayer(returning) {
  const keys = [PLAYED_KEY, BEST_KEY], was = keys.map((k) => localStorage.getItem(k));
  keys.forEach((k) => localStorage.removeItem(k));
  if (returning) localStorage.setItem(PLAYED_KEY, '1');
  return () => keys.forEach((k, i) => (was[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i])));
}
// the title screen's Play with jelly types on, as `start`
function pressPlay(start) {
  const { GAME, mainMenu, picker } = G();
  fresh({ types: start });
  mainMenu.home = true;
  picker.close();
  GAME.startRun();
}
const key = (code) => dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const cardName = (picker) => picker.cards[picker.index].querySelector('h3').textContent;

story('types/pick-screen-shows-every-type', {
  about: 'With the switch on, a returning player\'s Play opens the pick screen on the type the switch names, with one card per type in content/jellies.kdl, six bars each, and the centre card\'s panel; arrow keys, the wheel and a tap on a neighbour move the row; Play starts the run as the centre type.',
  setup() {},
  play() {
    const { picker, run } = G(), back = asPlayer(true);
    try {
      pressPlay('fire');
      const ids = Object.keys(CONTENT.jellies);
      const open = picker.isOpen && picker.cards.length === ids.length && cardName(picker) === 'Fire Jelly';
      const names = picker.cards.every((c, i) => c.querySelector('h3').textContent === CONTENT.jellies[ids[i]].name && c.querySelectorAll('.tp-bar').length === 6);
      const panel = picker.panel.about.textContent === CONTENT.jellies.fire.about && !picker.panel.play.hidden;
      key('ArrowRight');
      const right = cardName(picker) === 'Lightning Jelly' && picker.panel.about.textContent === CONTENT.jellies.lightning.about;
      key('ArrowLeft'); key('ArrowLeft');
      const left = cardName(picker) === 'Normal Jelly' && picker.panel.diff.children.length === 0;   // Normal differs from itself in nothing
      picker.root.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
      const wheel = picker.index === 1;
      picker.cards[3].dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, clientX: 10, bubbles: true }));
      picker.cards[3].dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 10, bubbles: true }));
      const tap = picker.centre === 'ice';
      const before = run.jelly;
      picker.play();
      const played = !picker.isOpen && run.jelly === 'ice' && run.stats.health === 31 && before === 'fire';
      return ok(open && names && panel && right && left && wheel && tap && played, { open, names, panel, right, left, wheel, tap, played, jelly: run.jelly });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-locked-card-cannot-play', {
  about: 'A locked type\'s card is greyed out and its panel shows the unlock goal and progress ("Defeat 6 Elites: 4/6") instead of Play; Play and Enter do nothing on it, and the next open type plays.',
  setup() {},
  play() {
    const { picker, run } = G(), back = asPlayer(true);
    try {
      fresh({ types: 'normal' });
      TYPE_SWITCH.locked = { ice: { goal: 'Defeat 6 Elites', have: 4, need: 6 } };
      G().mainMenu.home = true;
      G().GAME.startRun();
      picker.go(picker.ids.indexOf('ice'));
      const card = picker.cards[picker.ids.indexOf('ice')];
      const shown = card.classList.contains('locked') && !!card.querySelector('.tp-lock') && !picker.cards[0].classList.contains('locked')
        && picker.panel.play.hidden && !picker.panel.goal.hidden && picker.panel.goal.textContent === 'Defeat 6 Elites: 4/6';
      const refused = picker.play() === false && picker.isOpen;
      key('Enter');
      const enter = picker.isOpen && run.jelly === 'normal';
      key('ArrowRight');
      const next = picker.centre === 'poison' && !picker.panel.play.hidden && picker.panel.goal.hidden;
      picker.play();
      return ok(shown && refused && enter && next && run.jelly === 'poison', { shown, refused, enter, next, jelly: run.jelly });
    } finally { back(); picker.close(); TYPE_SWITCH.locked = {}; G().mainMenu.home = false; }
  },
});

story('types/pick-screen-bars-normal-is-half', {
  about: 'Normal sits at 0.5 on all six bars; every bar is from 0 to 1; the Tentacle jelly is scaled the same as the rest (an 11 cm reach is a short Range bar, three Attacks is half the Area bar); the panel lists only what differs from Normal; the bars drawn are the ones the formula gives.',
  setup() {},
  play() {
    const { picker } = G();
    const half = typeBars('normal').every((b) => Math.abs(b - 0.5) < 1e-9);
    const inRange = Object.keys(CONTENT.jellies).every((id) => { const b = typeBars(id); return b.length === 6 && b.every((x) => x >= 0 && x <= 1); });
    const t = typeBars('tentacle'), l = typeBars('lightning'), f = typeBars('fire');
    const tentacle = Math.abs(t[2] - 0.11 / 0.6) < 1e-9 && Math.abs(t[3] - 0.5) < 1e-9 && Math.abs(t[0] - 0.75) < 1e-9;
    const area = Math.abs(l[3] - 0.75) < 1e-9 && Math.abs(f[0] - 0.3125) < 1e-9;   // an arc counts 1.5x; Fire's hit=0.5 halves its Damage
    const same = (id) => JSON.stringify(typeDetails(id));
    const details = same('normal') === '[]' && same('ice') === '["+5 Shield","Jump height 90%"]' && same('wind') === '["Jump height 120%","Pierce +1"]'
      && same('glitter') === '["Dodge 5%","+10 Luck"]' && same('poison') === '["Health regen 0.5 every 5 s"]' && same('tentacle') === '["+3 Shield"]';
    const drawn = picker.cards.every((c, i) => [...c.querySelectorAll('.tp-bar')].every((bar, k) => +bar.getAttribute('aria-valuenow') === Math.round(typeBars(picker.ids[i])[k] * 100)));
    return ok(half && inRange && tentacle && area && details && drawn, { half, inRange, tentacle, area, details: ['normal', 'ice', 'wind', 'glitter', 'poison', 'tentacle'].map(same), drawn });
  },
});

story('types/pick-screen-fits-phone', {
  phone: true,
  about: 'On a phone held sideways the centre card and its panel fit the screen (Play inside it, at least 44 px tall), the page does not scroll sideways, the neighbours are cut off by the screen\'s edge, and the card\'s bars sit beside its portrait.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true);
    try {
      pressPlay('lightning');
      step(3);
      const W = innerWidth, H = innerHeight, rect = (el) => el.getBoundingClientRect();
      const centre = rect(picker.cards[picker.index]), panel = rect(picker.panel.play), card = picker.cards[picker.index];
      const inside = (r) => r.top >= 0 && r.bottom <= H && r.left >= 0 && r.right <= W;
      const fits = inside(centre) && inside(panel) && panel.height >= 44 && centre.bottom <= rect(picker.root.querySelector('.tp-panel')).top + 1;
      const cut = picker.cards.some((c) => { const r = rect(c); return r.right > W || r.left < 0; }) && picker.cards.some((c) => { const r = rect(c); return r.right > 0 && r.left < W && c !== card; });
      const art = rect(card.querySelector('.tp-art')), bars = rect(card.querySelector('.tp-bars'));
      const beside = art.right <= bars.left + 1;
      const still = document.documentElement.scrollWidth <= W;
      return ok(fits && cut && beside && still, { fits, cut, beside, still, size: [W, H], centre: [centre.top, centre.bottom], panel: [panel.top, panel.bottom, panel.height] });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/first-run-is-normal', {
  about: 'A first-time player never sees the pick screen: with the switch on, their Play starts a Normal run whatever the switch names; a returning player\'s Play opens the screen.',
  setup() {},
  play() {
    const { picker, run } = G();
    let back = asPlayer(false);
    let first;
    try {
      const newPlayer = !picksType();
      pressPlay('fire');
      first = { newPlayer, closed: !picker.isOpen, normal: run.jelly === 'normal' && run.stats.health === BASE_STATS.health, start: TYPE_SWITCH.start };
    } finally { back(); }
    back = asPlayer(true);
    let again;
    try {
      pressPlay('fire');
      again = { returning: picksType(), open: picker.isOpen, fire: picker.centre === 'fire' };
    } finally { back(); picker.close(); G().mainMenu.home = false; }
    return ok(first.newPlayer && first.closed && first.normal && first.start === 'normal' && again.returning && again.open && again.fire, { first, again });
  },
});
