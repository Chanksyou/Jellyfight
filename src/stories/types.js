// Stories: jelly types (content/jellies.kdl, src/jelly-types.js), built behind the GAME.types
// switch until release. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { CONTENT, compileJellies } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { jellyStats } from '../jelly-types.js';
import { SAVE_KEY, carried, keepRun } from '../stages.js';
import { G, fresh, ok, story, stub } from './kit.js';

const TYPE_IDS = ['normal', 'fire', 'lightning', 'ice', 'poison', 'wind', 'glitter', 'tentacle'];

story('content/jellies-load', {
  about: 'content/jellies.kdl lists all eight jelly types, Normal lists no stats, and a mistake in the file names the file, line and problem.',
  setup() {},
  play() {
    const ids = Object.keys(CONTENT.jellies);
    const all = TYPE_IDS.every((id) => ids.includes(id)) && ids.length === TYPE_IDS.length;
    const sane = Object.values(CONTENT.jellies).every((j) => j.hit > 0 && j.name && Object.keys(j.stats).every((k) => k in BASE_STATS));
    const tryIt = (src) => { try { compileJellies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const ok1 = 'jelly "normal" name="N" attack="bubble" hit=1\n';
    const badStat = tryIt(ok1 + 'jelly "x" name="X" attack="fire" hit=1 {\n    stat speed 2\n}');
    const badAttack = tryIt(ok1 + 'jelly "x" name="X" attack="laser" hit=1');
    const noHit = tryIt(ok1 + 'jelly "x" name="X" attack="fire"');
    const noNormal = tryIt('jelly "x" name="X" attack="fire" hit=1');
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
