// Stories: Easy mode (easy.js). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { BEST_KEY } from '../leaderboard.js';
import { EASY_KEY, DEATHS_KEY, chooseEasy, easyChosen, act1Deaths } from '../easy.js';
import { FOUND_KEY } from '../collection.js';
import { G, fresh, hitJelly, ok, phone, spawn, near, step, story, tp } from './kit.js';
import { bus } from '../events.js';

const modal = () => document.querySelector('.jf-modal');

story('easy/twice-the-damage-half-the-hits', {
  about: 'In Easy mode a hit on a bug lands for twice its damage and a hit on the jelly takes half its Health; a normal run is unchanged, Elites and the boss included.',
  setup() { fresh({ elites: false, hurt: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies } = G(), measure = () => {
      const e = spawn('roach', near(0, -0.2), { still: true, hp: 9999 });
      bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'story' });
      const dealt = 9999 - e.hp, h = run.health;
      hitJelly(4);
      return [dealt, h - run.health];
    };
    run.easy = false; step(1); const [d0, t0] = measure();
    run.easy = true; step(1); const [d1, t1] = measure();
    return ok(d1 === d0 * 2 && Math.abs(t1 * 2 - t0) < 1e-6 && t0 > 0, { d0, d1, t0, t1, enemies: enemies.list.length });
  },
});

story('easy/half-the-pearls', {
  about: 'Easy mode pays half the Pearls, the odd one carried to the next award, so nothing is lost to rounding.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    run.easy = true; run.easyPearls = 0; run.pearls = 0;
    run.earn(3); const afterThree = run.pearls;   // 1.5 -> 1
    run.earn(1); const afterFour = run.pearls;    // 2.0 -> 2
    run.easy = false; run.earn(4);
    return ok(afterThree === 1 && afterFour === 2 && run.pearls === 6, { afterThree, afterFour, all: run.pearls });
  },
});

story('easy/choice-is-kept-for-the-whole-run', {
  about: 'Easy mode is read when a run begins, not changed by a Settings tap mid-run, and it goes with the run into its next act.',
  setup() { chooseEasy(true); fresh({ elites: false }); },
  play() {
    const { run } = G(), began = run.easy, carried = run.carryOver().easy;
    chooseEasy(false);
    step(2);
    const stays = run.easy;
    run.start();
    const next = run.easy;
    localStorage.removeItem(EASY_KEY);
    return ok(began && carried && stays && !next, { began, carried, stays, next });
  },
});

phone('easy/badge-and-score-not-posted', {
  about: 'On a phone an Easy run shows an "Easy mode" badge under the clock, and its end screen says the score is not on the leaderboard, offers no Submit, and saves no best.',
  setup() { fresh({ elites: false }); G().run.easy = true; },
  play() {
    const { run, hud } = G();
    localStorage.removeItem(BEST_KEY);
    step(2); run.refreshHud();
    const badge = hud.$('.easy-badge'), box = badge.getBoundingClientRect();
    const shown = !badge.hidden && box.width > 0 && box.left >= 0 && box.right <= innerWidth && parseFloat(getComputedStyle(badge).fontSize) >= 12;
    run.kills = 30;
    run.endRun('Done', 'x', 'Again');
    const text = modal().innerText, noSubmit = !/Submit score/.test(text), says = /not on the leaderboard/.test(text), noBest = localStorage.getItem(BEST_KEY) === null;
    run.easy = false; hud.setEasy(false);
    return ok(shown && noSubmit && says && noBest && badge.hidden, { shown, noSubmit, says, noBest, box: [box.x, box.y, box.width] });
  },
});

phone('easy/dev-run-says-why-no-submit', {
  about: 'A dev run\'s end screen says the score is not on the leaderboard and offers no Submit.',
  setup() { fresh({ elites: false }); G().run.devRun(); },
  play() {
    const { run } = G();
    run.kills = 30;
    run.endRun('Done', 'x', 'Again');
    const text = modal().innerText, noSubmit = !/Submit score/.test(text), says = /Dev run/.test(text) && /not on the leaderboard/.test(text);
    run.dev = false;
    return ok(noSubmit && says, { noSubmit, says });
  },
});

// --- the death screen's offer of Easy mode (easy.js easyOffered, run.js endRun)
// a finished run writes to the save (Pearls, lifetime totals, played flag), so the whole save is put back after
const keep = () => Object.entries(localStorage);
const restore = (saved) => { localStorage.clear(); for (const [k, v] of saved) localStorage.setItem(k, v); };
const dieAt = (run, deaths, cleared) => {
  localStorage.setItem(DEATHS_KEY, String(deaths));
  localStorage.setItem(FOUND_KEY, JSON.stringify(cleared ? { bosses: ['vacuum'] } : {}));
  run.phase = 'dead';
  run.endRun('You dried out', 'x', 'Try again');
  return [...modal().querySelectorAll('button')].find((b) => /Try Easy mode/.test(b.textContent));
};

story('easy/offered-after-a-second-act-1-death', {
  about: 'After a second death in act 1 by a player who has never cleared it, the death screen says what Easy mode is and offers "Try Easy mode"; tapping it turns Easy on for the next run. Not offered after the first death, once act 1 is cleared, in a dev run, or when Easy is already on; the death itself is counted.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), saved = keep();
    try {
      localStorage.removeItem(DEATHS_KEY); chooseEasy(false);
      run.die(); const counted = act1Deaths() === 1;
      run.start();   // a new run: the death's own end screen (a timer, run.later) never lands
      const first = !!dieAt(run, 1, false);
      const cleared = !!dieAt(run, 5, true);
      run.dev = true; const dev = !!dieAt(run, 5, false); run.dev = false;
      chooseEasy(true); const already = !!dieAt(run, 5, false); chooseEasy(false);
      const btn = dieAt(run, 2, false), says = /deal twice the damage and take half/.test(modal().innerText);
      btn?.click();
      G().picker.close(); run.ui.close();
      return ok(counted && !first && !cleared && !dev && !already && !!btn && says && easyChosen(), { counted, first, cleared, dev, already, btn: !!btn, says, chosen: easyChosen() });
    } finally { run.start(); restore(saved); }
  },
});
