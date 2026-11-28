// Stories: jelly types (content/jellies.kdl, src/jelly-types.js). Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import * as THREE from 'three';
import { CONTENT, compileJellies, compileMods, compileTreasures } from '../content.js';
import { PLAYER } from '../events.js';
import { juice } from '../juice.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { jellyStats, typeBars, typeDetails, barSegments, TYPE_PICK, LAST_JELLY_KEY, FAV_JELLIES_KEY, savedJelly, favJellies } from '../jelly-types.js';
import { picksType } from '../first-run.js';
import { SHADERS } from '../pick-aura.js';
import { SAVE_KEY, STAGES, carried, keepRun } from '../stages.js';
import { G, asPlayer, fresh, give, ok, record, restore, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const TYPE_IDS = ['normal', 'fire', 'lightning', 'ice', 'poison', 'wind', 'glitter', 'summoner', 'tentacle'];

story('content/jellies-load', {
  about: 'content/jellies.kdl lists all nine jelly types, Normal lists no stats, and a mistake in the file names the file, line and problem.',
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
  about: 'A plain run is Normal: it starts on BASE_STATS, fires the bubble attack, and counts (not a dev run).',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const same = (s) => Object.keys(BASE_STATS).every((k) => s[k] === BASE_STATS[k]);
    return ok(run.jelly === 'normal' && same(run.stats) && run.attack.kind === 'bubble' && !run.dev, { jelly: run.jelly, attack: run.attack, dev: run.dev });
  },
});

story('types/jelly-stats-apply', {
  about: 'A run started as Fire begins with Health 17, Attack damage 8.5, Fire rate 1.5/s and Move speed 105%; every other stat is Normal\'s.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const { run } = G(), s = run.stats;
    const fire = run.jelly === 'fire' && s.health === 17 && s.bubbleDamage === 8.5 && s.fireRate === 1.5 && s.moveSpeed === 1.05 && run.health === 17;
    const rest = Object.keys(BASE_STATS).filter((k) => !['health', 'bubbleDamage', 'fireRate', 'moveSpeed'].includes(k)).every((k) => s[k] === BASE_STATS[k]);
    const live = run.S.health === 17 && run.S.bubbleDamage >= 8.5;   // what the systems read, with the act's carried Treasures on top
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
      const carriedOn = run.jelly === 'fire' && run.stats.health === 17 && run.stats.bubbleDamage === 8.5;
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
  about: 'A Normal jelly blows bubbles and never lashes, even with a bug right under its tentacles.',
  setup() { setupFight({ types: 'normal' }); },
  play() {
    roachAt(0, -0.06);
    const hit = hurtBy(60 * 3);
    return ok(hit.bubble?.length > 0 && !hit.tentacle, { hit: Object.keys(hit) });
  },
});

story('types/fire-shot-is-the-only-attack', {
  about: 'A Fire jelly hurts a bug only with its Fire shot and the Burn it sets: no plain bubbles, no tentacle stings, and no Element pick at the start of a run or, on a new player\'s first run, after the first card. Each shot hits for hit= x Attack damage (8.5 x 0.75).',
  setup() { setupFight({ types: 'fire' }); },
  play() {
    const { run, menus } = G();
    step(2);
    const noPick = !menus.open && run.owned.size === 0;
    roachAt(0, -0.06);
    const by = hurtBy(60 * 4);
    const only = Object.keys(by).every((k) => k === 'fire') && by.fire?.length > 0;
    const shots = (by.fire || []).filter((a) => Math.abs(a - 8.5 * 0.75) < 1e-9).length, burns = (by.fire || []).length - shots;
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
    roachAt(0, -0.15, { hp: 9999 });   // a bug that dies would spread its Burn, which is a volley too
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
  about: 'A Tentacle jelly never blows a bubble or fires an Element, even with a bug in Range; it stings what comes into Tentacle reach (13 cm) for its Attack damage (10), Fire rate times a second.',
  setup() { setupFight({ types: 'tentacle' }); },
  play() {
    const { run } = G();
    const far = roachAt(0, -0.2);
    const blows = spy(run.bubbles, 'blow');
    const before = hurtBy(60 * 2);
    far.dead = true;
    roachAt(0, -0.06);
    const stings = hurtBy(60 * 4).tentacle || [];
    const pass = !blows.length && !Object.keys(before).length && stings.length >= 6 && stings.length <= 8 && stings.every((a) => Math.abs(a - 10) < 1e-9);
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
    const pass = first.length === 3 && new Set(first).size === 3 && first.every((e) => bugs.includes(e)) && dmg.every((d) => Math.abs(d - 10) < 1e-9)
      && T.tentacles === 3 && Math.abs(T.reach - 0.13) < 1e-9 && T.tentacleDamage === run.S.bubbleDamage && T.tentacleSpeed === run.S.fireRate;
    return ok(pass, { strikes: first.length, distinct: new Set(first).size, dmg, T });
  },
});

story('types/tentacle-is-not-offered-range', {
  about: 'A Tentacle jelly is never offered a Treasure that only adds Range or Pierce (Drinking Straw, Bobby Pin): not-for="tentacle" on the Treasure. It is offered the Range card (which stretches its Tentacle reach); a Fire jelly is offered all of them.',
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
    const tentacleNot = t.cards.has('range') && !t.treasures.has('straw') && !t.treasures.has('bobbyPin') && t.cards.has('fireRate');
    const fireGets = f.cards.has('range') && f.treasures.has('straw');
    const caught = (() => { try { compileTreasures(parse('treasure "x" name="X" icon="x" text="x" not-for="laser" {\n    stat range 1\n}', 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } })();
    return ok(tentacleNot && fireGets && /not-for= takes attacks from/.test(caught), { tentacle: [...t.cards], fireCards: [...f.cards], straw: f.treasures.has('straw'), caught });
  },
});

// --- the pick screen (src/pick-screen.js, docs/jelly-types/spec-pick-screen.md) ---------------------
// A story plays as a returning player (a played run on record) or a first-time one, and puts it back after
// the title screen's Play with jelly types on, as `start`
function pressPlay(start) {
  const { GAME, mainMenu, picker } = G();
  fresh({ types: start });
  mainMenu.home = true;
  picker.close();
  GAME.startRun();
}
const key = (code) => dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const cardName = (picker) => picker.nameEl.textContent;

story('types/pick-screen-shows-every-type', {
  about: 'A returning player\'s Play opens the pick screen on the last type picked, with one roster tile per type in content/jellies.kdl plus the Random tile, six bars in the Spotlight, and its details panel; arrow keys, wheel on the Spotlight, swipe, and tapping a tile select that type; Play starts the run as the selected type.',
  setup() {},
  play() {
    const { picker, run } = G(), back = asPlayer(true), hadFavs = localStorage.getItem(FAV_JELLIES_KEY);
    localStorage.removeItem(FAV_JELLIES_KEY);
    try {
      pressPlay('fire');
      const ids = Object.keys(CONTENT.jellies);
      const open = picker.isOpen && picker.tiles.length === ids.length && cardName(picker) === 'Fire Jelly';
      const bars = picker.barEls.length === 6;
      const panel = picker.panel.about.textContent === CONTENT.jellies.fire.about && !picker.panel.play.hidden;
      key('ArrowRight');
      const right = cardName(picker) === 'Lightning Jelly' && picker.panel.about.textContent === CONTENT.jellies.lightning.about;
      key('ArrowLeft'); key('ArrowLeft');
      const left = cardName(picker) === 'Normal Jelly' && picker.panel.diff.children.length === 0;   // Normal differs from itself in nothing
      picker.spot.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
      const wheel = picker.centre === 'fire';
      picker.tiles[ids.indexOf('ice')].click();
      const tap = picker.centre === 'ice' && cardName(picker) === 'Ice Jelly';
      // swipe left on Spotlight steps to next jelly
      picker.spot.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, clientX: 200, clientY: 100, bubbles: true }));
      picker.spot.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 120, clientY: 100, bubbles: true }));
      const swiped = picker.centre === 'poison';
      picker.tiles[ids.indexOf('ice')].click();
      const before = run.jelly;
      picker.play();
      const played = !picker.isOpen && run.jelly === 'ice' && run.stats.health === 31 && before === 'fire';
      return ok(open && bars && panel && right && left && wheel && tap && swiped && played, { open, bars, panel, right, left, wheel, tap, swiped, played, jelly: run.jelly });
    } finally {
      if (hadFavs === null) localStorage.removeItem(FAV_JELLIES_KEY); else localStorage.setItem(FAV_JELLIES_KEY, hadFavs);
      back(); picker.close(); G().mainMenu.home = false;
    }
  },
});

story('types/pick-screen-motion', {
  about: 'Play squeezes for --pick-squeeze (80 ms at most) before the run starts, and with Reduce effects it starts at once; the title\'s tiles come in one after another.',
  setup() {},
  play() {
    const { picker, run } = G(), back = asPlayer(true), calm = juice.calm;
    try {
      pressPlay('normal');
      juice.calm = false;
      picker.go(1);
      // Play: squeezes, waits at most 80 ms, then starts the run
      let timer = null, delay = 0;
      stub(window, 'setTimeout', (fn, ms) => { timer = fn; delay = ms; return 1; });
      const before = run.jelly;
      picker.confirm();
      const squeezing = picker.panel.play.classList.contains('tp-squeeze') && picker.isOpen && delay > 0 && delay <= 80;
      picker.confirm();   // a second press does nothing
      const once = picker.confirming === true;
      timer();
      const started = !picker.isOpen && run.jelly === picker.centre && run.jelly !== before;
      // Reduce effects: no squeeze, no wait
      pressPlay('normal');
      juice.calm = true; timer = null;
      picker.confirm();
      const calmNow = timer === null && !picker.isOpen;
      // the title's tiles
      const over = document.getElementById('g-over'), had = over.classList.contains('menu-home');
      over.classList.add('menu-home');
      const tiles = [...document.querySelectorAll('#g-over .menu-tiles .ui-tile')];
      const delays = tiles.map((t) => parseFloat(getComputedStyle(t).animationDelay) * 1000);
      over.classList.toggle('menu-home', had);
      const cascade = tiles.length === 3 && delays[0] === 0 && delays[1] > delays[0] && delays[2] > delays[1] && delays[2] < 200;
      return ok(squeezing && once && started && calmNow && cascade, { squeezing, delay, once, started, calmNow, cascade, delays });
    } finally { juice.calm = calm; back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-favorites-and-random', {
  about: 'Starring a jelly pins it to the front of the roster grid (after Random) and persists in localStorage; the Random (?) tile sweeps across unlocked tiles and lands on an unlocked jelly in the Spotlight (instant with Reduce effects); playing saves the last picked jelly.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true), calm = juice.calm;
    const hadFavs = localStorage.getItem(FAV_JELLIES_KEY), hadLast = localStorage.getItem(LAST_JELLY_KEY);
    localStorage.removeItem(FAV_JELLIES_KEY); localStorage.removeItem(LAST_JELLY_KEY);
    try {
      pressPlay('tentacle');
      juice.calm = false;
      // Random (?) tile is always first in the grid
      const randomFirst = picker.grid.firstElementChild === picker.randomBtn;
      // Star Tentacle -> pinned first among jellies, persisted in localStorage
      picker.favBtn.click();
      const pinned = picker.order[0] === 'tentacle' && picker.grid.children[1].dataset.id === 'tentacle' && favJellies().has('tentacle');
      // Random roulette sweeps unlocked tiles and lands on an unlocked jelly (not starting the run)
      const before = picker.centre;
      picker.randomBtn.click();
      const rolling = !!picker.roll;
      let now = picker.last, sawHighlight = false;
      for (let i = 0; i < 60 && picker.roll; i++) {
        now += 25; picker.tick(now);
        if (picker.tiles.some((t) => t.classList.contains('rolling'))) sawHighlight = true;
      }
      const landed = !picker.roll && picker.isOpen && picker.centre !== before;
      // Reduce effects: Random jumps immediately without sweeping
      juice.calm = true;
      const beforeCalm = picker.centre;
      picker.randomBtn.click();
      const calmJump = !picker.roll && picker.centre !== beforeCalm;
      // Playing persists last jelly
      const picked = picker.centre;
      picker.play();
      const saved = savedJelly() === picked;
      return ok(randomFirst && pinned && rolling && sawHighlight && landed && calmJump && saved,
        { randomFirst, pinned, rolling, sawHighlight, landed, calmJump, saved, picked });
    } finally {
      juice.calm = calm;
      if (hadFavs === null) localStorage.removeItem(FAV_JELLIES_KEY); else localStorage.setItem(FAV_JELLIES_KEY, hadFavs);
      if (hadLast === null) localStorage.removeItem(LAST_JELLY_KEY); else localStorage.setItem(LAST_JELLY_KEY, hadLast);
      back(); picker.close(); G().mainMenu.home = false;
    }
  },
});

story('types/pick-screen-squeeze-onto-locked-card', {
  about: 'Switched onto a locked jelly while Play squeezes, nothing starts and Play is pressable again; back on an open jelly it starts the run.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true, { feats: { elites: 4 } }), calm = juice.calm;
    try {
      pressPlay('normal');
      juice.calm = false;
      let timer = null;
      stub(window, 'setTimeout', (fn) => { timer = fn; return 1; });
      picker.confirm(); picker.go(picker.ids.indexOf('glitter')); timer();
      const held = picker.isOpen && !picker.confirming && !picker.panel.play.classList.contains('tp-squeeze');
      picker.go(0); timer = null; picker.confirm(); timer?.();
      const again = !picker.isOpen;
      return ok(held && again, { held, again });
    } finally { juice.calm = calm; back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-locked-card-says-how-to-open', {
  about: 'Locked jellies sit at the end of the roster grid with a lock pip, and selecting one shows how to open it on the Spotlight portrait ("Finish act 1", "Defeat 9 Elites"); open jellies show none.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true, { feats: { elites: 4 } });
    try {
      fresh({ types: 'normal' });
      G().mainMenu.home = true;
      G().GAME.startRun();
      const line = (id) => { picker.go(picker.ids.indexOf(id)); return picker.spotLock.hidden ? '' : picker.spotLock.textContent.trim(); };
      const lines = line('fire') === 'Finish act 1' && line('wind') === 'Defeat 9 Elites' && line('glitter') === 'Defeat 6 Elites' && line('normal') === '' && line('ice') === '';
      // unlocked jellies (normal, ice) come before locked jellies in the grid order
      const openIdx = Math.max(picker.order.indexOf('normal'), picker.order.indexOf('ice'));
      const lockIdx = Math.min(picker.order.indexOf('fire'), picker.order.indexOf('wind'), picker.order.indexOf('glitter'));
      const ordered = openIdx < lockIdx;
      return ok(lines && ordered, { lines, ordered, order: picker.order });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-locked-card-cannot-play', {
  about: 'A locked type is dimmed in the roster and its Spotlight panel shows the unlock goal and progress ("Defeat 6 Elites: 4/6", from the save\'s real Elite count) instead of Play; Play and Enter do nothing on it, and an open type plays.',
  setup() {},
  play() {
    const { picker, run } = G(), back = asPlayer(true, { feats: { elites: 4 }, book: { bosses: STAGES.map((st) => st.boss.kind) } });
    try {
      fresh({ types: 'normal' });
      G().mainMenu.home = true;
      G().GAME.startRun();
      picker.go(picker.ids.indexOf('glitter'));
      const tile = picker.tiles[picker.ids.indexOf('glitter')];
      const shown = tile.classList.contains('locked') && picker.spot.classList.contains('locked') && !picker.spotLock.hidden && !picker.tiles[0].classList.contains('locked')
        && picker.panel.play.hidden && !picker.panel.goal.hidden && picker.panel.goal.textContent === 'Defeat 6 Elites: 4/6';
      const refused = picker.play() === false && picker.isOpen;
      key('Enter');
      const enter = picker.isOpen && run.jelly === 'normal';
      picker.go(picker.ids.indexOf('tentacle'));
      const next = picker.centre === 'tentacle' && !picker.panel.play.hidden && picker.panel.goal.hidden;
      picker.play();
      return ok(shown && refused && enter && next && run.jelly === 'tentacle', { shown, refused, enter, next, jelly: run.jelly });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-bars-normal-is-half', {
  about: 'Normal sits at 0.5 on all six bars; every bar is from 0 to 1; the Tentacle jelly is scaled the same as the rest (a 13 cm reach is a short Range bar, three Attacks is half the Area bar); the panel lists only what differs from Normal; the Spotlight bars match the formula for every type, as 10 segments (Normal: 5 lit).',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true);
    try {
      pressPlay('normal');
      const half = typeBars('normal').every((b) => Math.abs(b - 0.5) < 1e-9);
      const inRange = Object.keys(CONTENT.jellies).every((id) => { const b = typeBars(id); return b.length === 6 && b.every((x) => x >= 0 && x <= 1); });
      const t = typeBars('tentacle'), l = typeBars('lightning'), f = typeBars('fire');
      const tentacle = Math.abs(t[2] - 0.13 / 0.6) < 1e-9 && Math.abs(t[3] - 0.5) < 1e-9 && Math.abs(t[0] - 10 / 14) < 1e-9;
      const area = Math.abs(l[3] - 0.75) < 1e-9 && Math.abs(f[0] - 8.5 * 0.75 / 14) < 1e-9;   // an arc counts 1.5x; Fire's hit=0.75 trims its Damage
      const same = (id) => JSON.stringify(typeDetails(id));
      const details = same('normal') === '[]' && same('ice') === '["+5 Shield","Jump height 90%"]' && same('wind') === '["Jump height 110%","Pierce +1"]'
        && same('glitter') === '["Dodge 10%","+15 Luck"]' && same('poison') === '["Health regen 0.5 every 5 s"]' && same('tentacle') === '["+3 Shield"]';
      const drawn = picker.ids.every((id, i) => {
        picker.go(i);
        return picker.barEls.every((bar, k) => +bar.getAttribute('aria-valuenow') === Math.round(typeBars(id)[k] * 100)
          && bar.querySelectorAll('.tp-seg').length === 10 && bar.querySelectorAll('.tp-seg.on').length === barSegments(typeBars(id)[k]));
      });
      const segments = barSegments(0.5) === 5 && barSegments(0.01) === 1 && barSegments(1) === 10;   // Normal's bars are half lit
      return ok(half && inRange && tentacle && area && details && drawn && segments, { half, inRange, tentacle, area, segments, details: ['normal', 'ice', 'wind', 'glitter', 'poison', 'tentacle'].map(same), drawn });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-fits-phone', {
  phone: true,
  about: 'On a phone held sideways the Spotlight (with Play at least 44 px tall) sits on the left and the Roster Grid on the right, both fit the screen with zero sideways scroll, and the Spotlight\'s bars sit beside its portrait.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true);
    try {
      pressPlay('lightning');
      step(3);
      const W = innerWidth, H = innerHeight, rect = (el) => el.getBoundingClientRect();
      const spot = rect(picker.spot), roster = rect(picker.roster), playBtn = rect(picker.panel.play);
      const inside = (r) => r.top >= 0 && r.bottom <= H + 1 && r.left >= 0 && r.right <= W + 1;
      const fits = inside(spot) && inside(roster) && inside(playBtn) && playBtn.height >= 44;
      const split = spot.right <= roster.left + 1;
      const art = rect(picker.spotArt), bars = rect(picker.spot.querySelector('.tp-bars'));
      const beside = art.right <= bars.left + 1;
      const tilesOk = picker.tiles.every((t) => { const r = rect(t); return r.width >= 44 && r.height >= 44; });
      const still = document.documentElement.scrollWidth <= W;
      return ok(fits && split && beside && tilesOk && still, { fits, split, beside, tilesOk, still, size: [W, H], spot: [spot.left, spot.right, spot.bottom], roster: [roster.left, roster.right], play: [playBtn.top, playBtn.bottom, playBtn.height] });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-screen-centre-card-attacks', {
  about: 'Only the Spotlight comes alive (attack-preview.js): Fire\'s jelly fires real Fire shots at three roaches that burn, die and come back; the Tentacle jelly\'s lash takes all three at once; nothing reaches the game (no damage event, no shake); switching jellies stops it; Reduce motion keeps the still portrait.',
  setup() {},
  play() {
    const { picker } = G(), live = picker.live, back = asPlayer(true);
    const settle = () => picker.tick(picker.last + 16);
    const hurt = record('damage_taken'), trauma = juice.trauma;
    // watch it for `secs`: the most shots in the air at once and how many roaches died
    const watch = (secs, kind) => {
      let shots = 0, kills = 0, dead = 0, list = live.P.enemies.list;
      for (let i = 0; i < secs * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; } else { kills += n - dead; dead = n; }
        shots = Math.max(shots, kind === 'tentacle' ? live.P.lash.strikes.length : live.P.bubbles.list.filter((b) => b.tint === kind).length);
      }
      return { shots, kills };
    };
    try {
      pressPlay('fire');   // (fresh() takes back stubs: these come after it)
      stub(live, 'draw', () => {});   // the picture itself: screenshots (a software renderer takes ~40 s to build its shaders)
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');   // and the still portraits (the same ~40 s)
      settle();
      const centreOnly = live.on && picker.liveFor === 'fire' && picker.root.querySelectorAll('.tp-live').length === 1 && !!picker.spotArt.querySelector('.tp-live');
      const fire = watch(10, 'fire');
      const burned = fire.shots >= 1 && fire.kills >= 3;
      key('ArrowRight');
      const stopped = !live.on && picker.liveFor === null;
      picker.go(picker.ids.indexOf('tentacle')); settle();
      const lash = watch(4, 'tentacle');
      const lashed = picker.liveFor === 'tentacle' && lash.shots === 3 && lash.kills >= 3;
      const quiet = hurt.length === 0 && juice.trauma === trauma;
      stub(picker, 'calm', () => true);
      key('ArrowLeft'); settle();
      const calm = !live.on && picker.liveFor === null;
      return ok(centreOnly && burned && stopped && lashed && quiet && calm, { centreOnly, fire, stopped, lash, quiet, hurt: hurt.length, calm });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-stage-ice', {
  about: 'On the centre card the Ice jelly\'s shards Chill the roaches (attack-preview.js reads status_applied), and a Chilled roach shows it: rime glints and cold breath (fx glow); its shards stay solid ice (not see-through) and the water behind takes a cold blue grade (--preview-grade-ice), and Fire\'s a warm one.',
  setup() {},
  play() {
    const { picker } = G(), live = picker.live, back = asPlayer(true);
    const settle = () => picker.tick(picker.last + 16);
    try {
      pressPlay('ice');   // (fresh() takes back stubs: these come after it)
      stub(live, 'draw', () => {});
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      settle();
      const P = live.P, chills = spy(live, 'chilled');
      let chilled = 0;
      for (let i = 0; i < 6 * 30; i++) { live.simulate(1 / 30); chilled = Math.max(chilled, P.enemies.list.filter((b) => b.chillT > 0 && !b.dead).length); }
      const shown = chilled >= 1 && chills.length > 0;
      const solid = !P.fx.ice.shards.material.transparent;
      const grade = P.stage.back.material.uniforms.uGrade.value.clone(), cold = grade.b > grade.r + 0.2;
      picker.go(picker.ids.indexOf('fire')); picker.pos = picker.target; settle();
      const fire = P.stage.back.material.uniforms.uGrade.value, warm = fire.r > fire.b + 0.2;
      return ok(shown && solid && cold && warm, { chilled, frames: chills.length, solid, grade: grade.toArray().map((v) => +v.toFixed(2)), warm });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-stage-fire', {
  about: 'On the centre card (fx.showcase) the Fire jelly\'s fireballs boil (their parts\' materials churn, each fireball out of step with the others) and trail a flame tail, and a burning roach wears real flames (fire-looks.js BurnFlames: one quad each, gone when it stops burning); in play the same parts keep their plain materials and no flames are added.',
  setup() {},
  play() {
    const { picker } = G(), live = picker.live, back = asPlayer(true);
    const settle = () => picker.tick(picker.last + 16);
    try {
      pressPlay('fire');   // (fresh() takes back stubs: these come after it)
      stub(live, 'draw', () => {});
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      settle();
      const P = live.P, looks = P.bubbles.looks;
      let flames = 0, tails = 0;
      for (let i = 0; i < 4 * 30; i++) {
        live.simulate(1 / 30);
        flames = Math.max(flames, looks.burnFlames?.on.size || 0);
        tails = Math.max(tails, (looks.pools.fire || []).concat(P.bubbles.list.map((b) => b.m)).filter((m) => m?.userData.tail?.visible).length);
      }
      const boils = looks.parts.fire.slice(0, 3).every(([, m]) => m.customProgramCacheKey?.().startsWith('fireChurn'));
      // each fireball boils on its own: the noise is offset by where it is (not in step with the others)
      const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <opaque_fragment>' };
      looks.parts.fire[0][1].onBeforeCompile(sh);
      const ownBoil = sh.vertexShader.includes('instanceMatrix[3].xyz');
      P.bubbles.reset();
      const tailsLeft = (looks.pools.fire || []).filter((m) => m.userData.tail?.visible).length;
      const gone = (!looks.burnFlames || looks.burnFlames.on.size === 0) && tailsLeft === 0;
      const play = G().run.bubbles.looks, plain = !play.fx.showcase && play.parts.fire.every(([, m]) => !m.onBeforeCompile || m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) && !play.burnFlames;
      return ok(flames >= 1 && tails >= 1 && boils && ownBoil && gone && plain, { flames, tails, tailsLeft, boils, ownBoil, gone, plain });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-stage-roaches-keep-their-brown', {
  about: 'On the centre card the stand-in roaches wear the stage\'s own shell (less of the glow, warm rim and water sheen that wash a bug out to near white under the stage lights), the stage\'s puffs fade to their edges (gas, not balls), and its Glitter pool holds two crit bursts whole; in play the roach shell, the puffs and the 420-flake pool are as they were.',
  setup() {},
  play() {
    const { picker } = G(), live = picker.live, back = asPlayer(true);
    try {
      pressPlay('glitter');   // (fresh() takes back stubs: these come after it)
      stub(live, 'draw', () => {});
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      const P = live.P, game = G().run.bubbles.looks.fx;
      const shells = new Set();
      for (const b of P.enemies.list) { let first = null; b.mesh.traverse((o) => { if (o.isMesh) first ||= o.material; }); shells.add(first); }   // (its body's material, as roach() swaps it)
      const shell = [...shells][0], stage = shells.size === 1 && shell.envMapIntensity < 1 && shell.userData.standOut?.base === 0.08 && shell.customProgramCacheKey().startsWith('standOut');
      const soft = P.fx.puffMat.userData.soft > 0 && !game.puffMat.userData.soft;
      const at = new THREE.Vector3(0.1, 0.05, 0), n = 420;
      P.fx.glitter.clear(); P.fx.glitter.cloud(at, n, 0.1, 0); P.fx.glitter.cloud(at, n, 0.1, 0);
      const whole = P.fx.glitter.live === 2 * n, pool = game.glitter.count === 420;
      return ok(stage && soft && whole && pool, { stage, key: shell?.customProgramCacheKey(), soft, live: P.fx.glitter.live, pool });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-stage-poison', {
  about: 'On the centre card the Poison jelly\'s blob is a darker core inside a see-through glossy body with a wet highlight; its burst leaves a cloud of green gas puffs (normal blending, so it stays green, not glow that whitens) and falling droplets; the water behind takes a sickly green grade (--preview-grade-poison). In play the blob keeps its plain unlit body.',
  setup() {},
  play() {
    const { picker } = G(), live = picker.live, back = asPlayer(true);
    const settle = () => picker.tick(picker.last + 16);
    try {
      pressPlay('poison');   // (fresh() takes back stubs: these come after it)
      stub(live, 'draw', () => {});
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      settle();
      const P = live.P, looks = P.bubbles.looks, puffs = spy(P.fx, 'puff'), bursts = spy(looks, 'poisonBurst');
      let wet = false;
      for (let i = 0; i < 4 * 30; i++) { live.simulate(1 / 30); P.scene.traverse((o) => { if (o.userData.look === 'poison' && o.visible && o.userData.core && o.userData.blob.material === looks.wetPoison) wet = true; }); }
      const cloud = bursts.length > 0 && puffs.length >= bursts.length * 8;   // its gas: a middle and a cloud of puffs round it
      const grade = P.stage.back.material.uniforms.uGrade.value.clone(), green = grade.g > grade.b + 0.15 && grade.g > grade.r + 0.1;
      const plain = !G().run.bubbles.looks.wetPoison;
      return ok(wet && cloud && green && plain, { wet, bursts: bursts.length, puffs: puffs.length, grade: grade.toArray().map((v) => +v.toFixed(2)), plain });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-stage-films-through-bloom', {
  about: 'The centre card films its attack on a stage (pick-stage.js) into its own picture: through bloom on Medium graphics, without it on Low; its first frame builds no shader (they were all built ahead, the bloom and the pass to the screen too); the stage keeps one set of lights whatever the type (only their colours change), so going to another type and back builds no shader; the stage\'s pictures are freed when the screen closes; the room behind the screen is not drawn while it is open; Reduce effects keeps the still portrait.',
  setup() {},
  async play() {
    const { picker, gfx, GAME } = G(), live = picker.live, R = live.renderer, back = asPlayer(true);
    const settle = () => picker.tick(picker.last + 16);
    const show = async (id) => {
      picker.go(picker.ids.indexOf(id)); picker.pos = picker.target; picker.vel = 0;
      settle();
      while (!live.built.get(id)) await new Promise((r) => setTimeout(r, 50));   // shown, and its shaders built (a software renderer takes a while)
      // what's on the stage once they're built, and the bloom and screen passes: the frame must use
      // the shaders built for them, not build its own (a shot or a bit of a body appearing later can't count)
      const F = live.film_, mats = new Set([F.bloom.bright, F.bloom.halve, F.bloom.widen, F.out.material]);
      live.P.scene.traverse((o) => [].concat(o.material || []).forEach((m) => mats.add(m)));
      const built = (m) => new Set(R.properties.get(m).programs?.values() || []), was = [...mats].map(built);
      for (let i = 0; i < 20; i++) live.simulate(1 / 30);
      live.draw();
      return [...mats].filter((m, i) => shader(m) && !was[i].has(shader(m))).map((m) => m.type);   // the ones the frame had to build itself
    };
    const shader = (m) => R.properties.get(m).currentProgram;
    const lights = () => live.P.scene.children.filter((o) => o.isLight).map((o) => o.type).join();
    try {
      pressPlay('fire');   // (fresh() takes back stubs: these come after it)
      stub(picker, 'portrait', () => '');
      stub(gfx, 'quality', 'medium');
      live.built.clear();   // (an earlier story may have marked them built with compileAsync stubbed)
      const builtSelf = await show('fire'), builtAhead = builtSelf.length === 0;
      const F = live.film_, blooms = spy(F.bloom, 'render');
      live.draw();
      const medium = blooms.length === 1 && F.out.material.uniforms.bloomStrength.value > 0 && F.rt.texture.type === THREE.HalfFloatType && F.rt.samples === 4;
      stub(gfx, 'quality', 'low');
      live.draw();
      const low = blooms.length === 1 && F.out.material.uniforms.bloomStrength.value === 0;
      stub(gfx, 'quality', 'medium');
      const fireLights = lights(), fireRim = live.P.stage.rim.color.getHexString();
      // the stage's own lit floor and its other pieces keep their shaders whatever the type: a light
      // added or taken away would build every lit shader again
      const S = live.P.stage, own = [S.floor.material, S.shadows.material, S.back.material], kept = own.map(shader);
      await show('ice'); await show('fire'); await show('ice');
      const sameLights = lights() === fireLights && S.rim.color.getHexString() !== fireRim;
      const noNewShaders = own.every((m, i) => shader(m) === kept[i] && !!kept[i]);
      const drawn = spy(GAME, 'render');
      GAME.frame(performance.now() + 5000);
      const roomHidden = drawn.length === 0;
      const freed = spy(F.rt, 'dispose');
      picker.close();
      GAME.frame(performance.now() + 10000);
      const roomBack = drawn.length === 1 && freed.length === 1;
      pressPlay('fire');
      stub(picker, 'portrait', () => '');
      stub(picker, 'calm', () => true);
      settle();
      const still = !live.on && picker.liveFor === null;
      return ok(builtAhead && medium && low && sameLights && noNewShaders && roomHidden && roomBack && still,
        { builtAhead, builtSelf, medium, low, lights: fireLights, sameLights, noNewShaders, roomHidden, roomBack, freed: freed.length, still });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-shader', {
  about: 'A kind with a shader (pick-auras/: Ice\'s frost, Lightning\'s sparks) animates both the Spotlight aura and visible roster tiles with the game\'s renderer; Low graphics uses fewer noise layers; closing the screen frees the jelly\'s pictures.',
  setup() {},
  async play() {
    const { picker, gfx } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) picker.tick(t += 50); };
    try {
      pressPlay('ice');
      stub(picker, 'live', null);   // no live Spotlight: Ice shows its element aura in the Spotlight
      stub(picker, 'calm', () => false);
      stub(gfx, 'quality', 'medium');
      const spot = picker.spotAura, iceTile = picker.auras[picker.ids.indexOf('ice')], stormTile = picker.auras[picker.ids.indexOf('lightning')];
      for (let i = 0; i < 400 && !(spot.classList.contains('lit') && iceTile.classList.contains('lit') && stormTile.classList.contains('lit')); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = spot.classList.contains('lit') && iceTile.classList.contains('lit') && stormTile.classList.contains('lit') && P.built.frost === true && P.built.sparks === true;
      const draws = spy(P, 'draw');
      picker.auraAt = -1; tick();
      // Spotlight and visible roster tiles animate on the clock
      const shader = draws.some(([c, kind]) => c === spot && kind === 'frost') && draws.some(([c, kind]) => c === iceTile && kind === 'frost') && draws.some(([c, kind]) => c === stormTile && kind === 'sparks');
      const medium = P.mats.frost.uniforms.uLayers.value;
      stub(gfx, 'quality', 'low'); picker.auraAt = -1; tick();
      const low = P.mats.frost.uniforms.uLayers.value;
      const R = P.renderer, textures = R.info.memory.textures;
      picker.close();
      const gone = R.info.memory.textures <= textures - 2;   // the jelly's two pictures freed
      return ok(lit && shader && medium > low && low >= 1 && gone, { lit, built: P.built, shader, layers: [medium, low], textures: [textures, R.info.memory.textures] });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-frost', {
  about: 'Ice\'s card (aura="frost", pick-auras/frost.js) is painted by its shader, with no 2D drawing left: frost on the card\'s glass, thick in the corners and clear round the jelly in the middle.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('ice');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const ice = picker.spotAura;
      for (let i = 0; i < 400 && !ice.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = ice.classList.contains('lit') && P.built.frost === true && P.has('frost');
      picker.auraAt = -1; tick();
      const S = ice.width, ctx = ice.getContext('2d');
      const lum = (x, y) => { const d = ctx.getImageData(Math.floor(x * S), Math.floor(y * S), Math.ceil(S * 0.08), Math.ceil(S * 0.08)).data; let v = 0; for (let k = 0; k < d.length; k += 4) v += d[k] * 0.3 + d[k + 1] * 0.5 + d[k + 2] * 0.2; return v / (d.length / 4); };
      const corners = Math.min(lum(0, 0), lum(0.92, 0), lum(0, 0.92), lum(0.92, 0.92)), open = Math.max(lum(0.2, 0.3), lum(0.72, 0.3));
      return ok(lit && corners > open + 40, { lit, corners: Math.round(corners), open: Math.round(open) });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-gust', {
  about: 'Wind\'s card (aura="gust", pick-auras/gust.js) is painted by its shader, with no 2D drawing left: soft ribbons of air, dust and leaves round the jelly, which stays lit in the middle and dark in the corners.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('wind');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const wind = picker.spotAura;
      for (let i = 0; i < 400 && !wind.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = wind.classList.contains('lit') && P.built.gust === true && P.has('gust');
      picker.auraAt = -1; tick();
      const S = wind.width, ctx = wind.getContext('2d');
      const lum = (x, y) => { const d = ctx.getImageData(Math.floor(x * S), Math.floor(y * S), Math.ceil(S * 0.08), Math.ceil(S * 0.08)).data; let v = 0; for (let k = 0; k < d.length; k += 4) v += d[k] * 0.3 + d[k + 1] * 0.5 + d[k + 2] * 0.2; return v / (d.length / 4); };
      const middle = lum(0.46, 0.4), corners = Math.max(lum(0, 0.92), lum(0.92, 0.92));
      return ok(lit && middle > corners + 20, { lit, middle: Math.round(middle), corners: Math.round(corners) });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-bubbles', {
  about: 'Normal\'s card (aura="bubbles", pick-auras/bubbles.js) is painted by its shader, with no 2D drawing left: glassy bubbles rise through the water and the picture moves from one frame to the next.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('normal');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const card = picker.spotAura;
      for (let i = 0; i < 400 && !card.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = card.classList.contains('lit') && P.built.bubbles === true && P.has('bubbles');
      const S = card.width, ctx = card.getContext('2d');
      const grab = () => ctx.getImageData(0, 0, S, S).data;
      const before = grab();
      for (let i = 0; i < 20; i++) { picker.auraAt = -1; tick(); }
      const after = grab();
      let changed = 0;
      for (let k = 0; k < before.length; k += 16) changed += Math.abs(before[k] - after[k]) > 6;
      const moves = changed / (before.length / 16) > 0.02;
      return ok(lit && moves, { lit, moves, changed: Math.round(1000 * changed / (before.length / 16)) / 1000 });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-toxic', {
  about: 'Poison\'s card (aura="toxic", pick-auras/toxic.js) is painted by its shader, with no 2D drawing left: goo lines the top of the card\'s glass and pools along its bottom, sickly green, with the murky water darker between.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('poison');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const card = picker.spotAura;
      for (let i = 0; i < 400 && !card.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = card.classList.contains('lit') && P.built.toxic === true && P.has('toxic');
      picker.auraAt = -1; tick();
      const S = card.width, ctx = card.getContext('2d');
      const green = (x, y, w, h) => { const d = ctx.getImageData(Math.floor(x * S), Math.floor(y * S), Math.ceil(w * S), Math.ceil(h * S)).data; let v = 0; for (let k = 0; k < d.length; k += 4) v += d[k + 1] - Math.max(d[k], d[k + 2]); return v / (d.length / 4); };
      const lip = green(0.1, 0, 0.8, 0.02), pool = green(0.1, 0.98, 0.8, 0.02), water = Math.min(green(0.3, 0.12, 0.08, 0.08), green(0.62, 0.12, 0.08, 0.08), green(0.3, 0.55, 0.06, 0.06));
      return ok(lit && lip > water + 15 && pool > water + 15, { lit, lip: Math.round(lip), pool: Math.round(pool), water: Math.round(water) });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-sting', {
  about: 'The Tentacle\'s card (aura="sting", pick-auras/sting.js) is painted by its shader, with no 2D drawing left: whip ribbons and snaps in a violet dusk, so the open water on the card leans violet, not teal.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('tentacle');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const card = picker.spotAura;
      for (let i = 0; i < 400 && !card.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = card.classList.contains('lit') && P.built.sting === true && P.has('sting');
      picker.auraAt = -1; tick();
      const S = card.width, d = card.getContext('2d').getImageData(0, 0, Math.ceil(S * 0.1), Math.ceil(S * 0.1)).data;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      return ok(lit && b > g * 1.8, { lit, r: Math.round(r / (d.length / 4)), g: Math.round(g / (d.length / 4)), b: Math.round(b / (d.length / 4)) });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-glitter', {
  about: 'Glitter\'s card (aura="glitter", pick-auras/glitter.js) is painted by its shader, with no 2D drawing left, and moves: out-of-focus lights, falling flakes that flash and winking stars glitter all over the card.',
  setup() {},
  async play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = () => picker.tick(t += 50);
    try {
      pressPlay('glitter');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => false);
      const card = picker.spotAura;
      for (let i = 0; i < 400 && !card.classList.contains('lit'); i++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
      const lit = card.classList.contains('lit') && P.built.glitter === true && P.has('glitter');
      picker.auraAt = -1; tick();
      const S = card.width, ctx = card.getContext('2d');
      const grab = () => ctx.getImageData(0, 0, S, Math.floor(S * 0.4)).data;
      const bright = (d) => { let n = 0; for (let k = 0; k < d.length; k += 4) n += d[k] + d[k + 1] + d[k + 2] > 600; return n; };
      const a = grab(); picker.auraAt = -1; tick(); tick(); tick(); tick(); tick(); tick();
      const b = grab();
      let moved = 0; for (let k = 0; k < a.length; k += 16) moved += Math.abs(a[k] - b[k]) > 30;
      const kinds = picker.ids.map((id) => CONTENT.jellies[id].aura);
      const distinct = kinds.every((k) => k && P.has(k)) && new Set(kinds).size === kinds.length;
      return ok(lit && distinct && bright(a) > 20 && moved > 50, { lit, distinct, kinds, bright: bright(a), moved });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/pick-side-card-shader-holds-still-calm', {
  about: 'With Reduce effects on, a shader kind\'s Spotlight and tile are one frozen frame: drawn once at a fixed moment, not again while the screen stays open; if it can\'t be drawn yet (its shader building) it is drawn as soon as it can.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true), P = picker.painter;
    let t = picker.last;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) picker.tick(t += 50); };
    try {
      pressPlay('fire');
      stub(picker, 'live', null);
      stub(picker, 'calm', () => true);
      stub(picker, 'portrait', () => 'data:,');
      let ready = false;
      const draws = [];
      stub(P, 'draw', (c, kind, look, at) => { if (kind === 'flames') draws.push(at); return ready; });
      picker.measure(); tick(3);
      const waited = draws.length >= 2;
      ready = true; tick(1);
      const n = draws.length; tick(6);
      const frozen = draws.length === n && picker.spotAura.classList.contains('lit') && picker.auras[picker.index].classList.contains('lit');
      return ok(waited && frozen && new Set(draws).size === 1, { tries: draws.length, waited, frozen, at: [...new Set(draws)] });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});

story('types/first-run-is-normal', {
  about: 'A first-time player never sees the pick screen: their Play starts a Normal run whatever was picked before; a returning player\'s Play opens the screen.',
  setup() {},
  play() {
    const { picker, run } = G();
    let back = asPlayer(false);
    let first;
    try {
      const newPlayer = !picksType();
      pressPlay('fire');
      first = { newPlayer, closed: !picker.isOpen, normal: run.jelly === 'normal' && run.stats.health === BASE_STATS.health, start: TYPE_PICK.start };
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

story('types/pick-screen-opens-on-try-again', {
  about: 'After a death in act 1, a returning player\'s Try again opens the pick screen (no Back) and Play starts the next run as the chosen type; a first-time player\'s Try again restarts at once as Normal; with the switch off it restarts as before. A look changed in between is drawn on the cards.',
  setup() {},
  play() {
    const { run, picker } = G();
    const die = () => { stub(run, 'board', null); stub(run, 'jellyFace', () => null); run.phase = 'dead'; run.endRun('You dried out', 'dead', 'Try again'); };
    const tryAgain = () => [...run.ui.modal.querySelectorAll('.btns button')].find((b) => /Try again/.test(b.textContent))?.click();
    let back = asPlayer(true), returning, first, off;
    try {
      fresh({ types: 'fire' });
      die(); tryAgain();
      const opened = picker.isOpen && picker.centre === 'fire' && picker.back.hidden && run.phase === 'dead';
      // a changed look is drawn again: the cards' portraits are cleared when the screen opens with a different look
      picker.frames.fire[0] = 'stale';
      picker.close(); picker.lookKey = '"another look"'; picker.open({ start: 'fire', onPlay: () => {} });
      const redrawn = picker.frames.fire[0] === null && picker.lookKey !== '"another look"';
      picker.close();
      fresh({ types: 'fire' });
      die(); tryAgain(); key('ArrowRight'); picker.play();
      returning = { opened, redrawn, started: !picker.isOpen && run.phase === 'explore' && run.jelly === 'lightning' };
    } finally { back(); picker.close(); }
    back = asPlayer(false);
    try {
      fresh({ types: 'fire' });
      die(); tryAgain();
      first = { closed: !picker.isOpen, normal: run.jelly === 'normal' && run.phase === 'explore' };
      fresh();
      die(); tryAgain();
      off = { closed: !picker.isOpen, restarted: run.phase === 'explore' && run.jelly === 'normal' };
    } finally { back(); picker.close(); }
    const pass = returning.opened && returning.redrawn && returning.started && first.closed && first.normal && off.closed && off.restarted;
    return ok(pass, { returning, first, off });
  },
});

// --- Treasures that fit the jelly types (the Nov 14 treasure audit) ---------------------------------
story('types/treasures-offered-only-where-they-work', {
  about: 'Reed Stick\'s giant bubble is Normal\'s alone (not-for every other attack); Bobby Pin is offered to the shot types it pierces with (Fire, Lightning, Ice, Wind, Summoner, Normal) but not to Poison and Glitter, whose blob and bomb burst on the first bug, nor the Tentacle jelly.',
  setup() { fresh({ types: 'normal' }); },
  play() {
    const by = (id) => CONTENT.treasures.find((t) => t.id === id), offers = {};
    for (const type of TYPE_IDS) { fresh({ types: type }); const { run } = G(); offers[type] = ['reedStick', 'bobbyPin'].filter((id) => run.forAttack(by(id))); }
    fresh();
    const reed = TYPE_IDS.filter((t) => offers[t].includes('reedStick')), pin = TYPE_IDS.filter((t) => offers[t].includes('bobbyPin'));
    return ok(reed.join() === 'normal' && pin.join() === 'normal,fire,lightning,ice,wind,summoner', { reed, pin });
  },
});
story('types/bobby-pin-pierces-element-shots', {
  about: 'Bobby Pin\'s pierce reaches a jelly type\'s Element shot: a Fire jelly\'s fireball goes through 3 more bugs with it (up to 4), as a Normal bubble does.',
  setup() { setupFight({ types: 'fire' }); roachAt(0.1, 0); },
  play() {
    const { run } = G(), shot = () => { const blows = spy(run.bubbles, 'blow'); step(60 * 2, () => blows.length); restore(); return blows[0]?.[2]?.pierce; };
    const plain = shot();
    give('bobbyPin');
    const pinned = shot();
    return ok(plain === 1 && pinned === 4, { plain, pinned });
  },
});
story('types/range-costs-cut-tentacle-reach', {
  about: 'A Range cost bites the Tentacle jelly too: Hot Chili takes 30% off its Tentacle reach and Cinder Jelly 20%, as they take Range off a shot type.',
  setup() { fresh({ types: 'tentacle' }); },
  play() {
    const { run } = G(), base = run.tentacleStats.reach;
    give('chili');
    const chili = run.tentacleStats.reach;
    run.evolved.push('cinder');
    const both = run.tentacleStats.reach;
    fresh();
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    return ok(near(chili, base * 0.7) && near(both, base * 0.5), { base, chili, both });
  },
});
story('types/roller-skate-counts-from-your-start', {
  about: 'Roller Skate counts Move speed above your jelly type\'s own start: a fresh Wind jelly (Move speed 1.2) gets no Fire rate from it until it speeds up.',
  setup() { fresh({ types: 'wind' }); },
  play() {
    const { run } = G(), before = run.S.fireRate;
    give('rollerSkate');
    const after = run.S.fireRate;
    fresh();
    return ok(Math.abs(after - before) < 1e-9, { before, after });
  },
});
story('types/crit-treasures-reach-glitter-bursts', {
  about: 'by="all" covers a Glitter bomb\'s burst too: Nail Clipper gives the splash its 10% crit chance (Lucky Sparkle\'s 15% adds to it), as it does bubbles, shots and stings.',
  setup() {},
  play() {
    const m = compileMods(new Set(['nailClipper'])), both = compileMods(new Set(['nailClipper']), [], ['luckySparkle']);
    const H = m.hits, near = (a, b) => Math.abs(a - b) < 1e-9;
    return ok(near(H.splash.crit?.chance, 0.1) && near(H.bubbles.crit?.chance, 0.1) && near(H.tentacles.crit?.chance, 0.1) && near(both.hits.splash.crit?.chance, 0.25), { splash: H.splash.crit, both: both.hits.splash.crit });
  },
});

story('types/pick-card-hugs-its-contents-on-a-tall-screen', {
  portrait: true,
  about: 'On a tall window the Spotlight hugs its contents instead of stretching into a giant empty box.',
  setup() {},
  play() {
    const { picker } = G(), back = asPlayer(true);
    try {
      pressPlay('lightning');
      step(3);
      const spot = picker.spot.getBoundingClientRect();
      const art = picker.spotArt.getBoundingClientRect(), bars = picker.spot.querySelector('.tp-bars').getBoundingClientRect();
      const hugs = spot.height < innerHeight * 0.6;
      const compact = Math.abs(art.top - bars.top) <= 60;
      return ok(hugs && compact, { hugs, compact, spotH: Math.round(spot.height), winH: innerHeight });
    } finally { back(); picker.close(); G().mainMenu.home = false; }
  },
});
