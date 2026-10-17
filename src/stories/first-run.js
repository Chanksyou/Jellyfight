// Stories: a player's first run. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { isNewPlayer, PLAYED_KEY, markPlayed } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { G, asNewPlayer, firstMinute, fresh, hintShown, hitJelly, mapShown, modalTitle, near, ok, pickFirstCard, spawn, step, story, stub, tp } from './kit.js';

// --- a player's first run (first-run.js): systems arrive one at a time
story('first-run/no-element-pick-at-start', {
  about: 'On a player\'s first run nothing opens on the first frame: no Element pick, just the jelly swimming among roaches while its bubbles fire on their own.',
  setup() { fresh({ elites: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0, -0.2), { still: true, hp: 9999 }); },
  play() {
    const { menus, run } = G();
    let blown = 0;
    const was = run.bubbles.onBlow; run.bubbles.onBlow = () => { blown++; was(); };
    step(60 * 3);
    run.bubbles.onBlow = was;
    return ok(!menus.open && run.startPicked && blown > 0, { menu: menus.open, title: modalTitle(), blown });
  },
});
story('first-run/element-pick-after-first-card', {
  about: 'On a first run the Element pick opens right after the first Level-up\'s card, once; the next Level-up is just cards.',
  setup() { fresh({ elites: false, firstRun: true, levels: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { menus, run } = G();
    step(5);
    const quietStart = !menus.open;
    run.gainXp(3); step(5);
    const levelTitle = modalTitle();
    pickFirstCard(); step(5);
    const elementTitle = menus.open ? modalTitle() : '';
    pickFirstCard(); step(50);   // the pick's outro (won pulse, discards burn) runs ~0.64 s of game time before the modal closes
    const owned = run.owned.size;
    run.gainXp(20); step(5);
    const secondTitle = modalTitle();
    pickFirstCard(); step(5);
    const after = menus.open ? modalTitle() : '';
    menus.close();
    return ok(quietStart && /level/i.test(levelTitle) && /element/i.test(elementTitle) && owned >= 1 && /level/i.test(secondTitle) && !/element/i.test(after),
      { quietStart, levelTitle, elementTitle, owned, secondTitle, after });
  },
});
story('first-run/health-hint-on-first-hit', {
  about: 'On a player\'s first run, the first hit shows one plain line about the Health bar for a few seconds; later hits don\'t show it again, and other runs never do.',
  setup() { fresh({ elites: false, firstRun: true, hurt: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true; },
  play() {
    step(2);
    const before = hintShown();
    hitJelly(); step(2);
    const shown = hintShown();
    step(60 * 6);
    const gone = !/Health/.test(hintShown());
    hitJelly(); step(2);
    const again = /Health/.test(hintShown());
    // another run: never
    fresh({ elites: false, hurt: true }); tp(3.2, 0.05, 3.0, 0);
    hitJelly(); step(2);
    const other = /Health/.test(hintShown());
    return ok(!/Health/.test(before) && /That's your Health, top left\. Run out and the run ends\./.test(shown) && gone && !again && !other, { before, shown, gone, again, other });
  },
});
story('first-run/treasures-wait-for-the-element-pick', {
  about: 'On a player\'s first run no Treasure turns up before the Element pick is done; the first comes at the next scheduled time after it. An Elite still leaves its Treasure, and other runs get theirs at 0:15.',
  setup() { fresh({ elites: false, firstRun: true, treasures: true, levels: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), toasts = [];
    stub(run.hud, 'toast', (text) => toasts.push(text));
    const sched = () => run.roomTreasures.find((t) => t.active && t.timed);
    step(60 * 20);                                         // past 0:15, no Element pick yet
    const before = !!sched();
    run.gainXp(3); step(3); pickFirstCard(); step(3);      // the first card, then the Element pick
    const elementOpen = /element/i.test(modalTitle());
    pickFirstCard(); step(3);
    const t0 = run.t;
    step(60 * 45, () => sched());                          // the next scheduled time is 1:00
    const at = Math.round(run.t), first = !!sched(), told = toasts.some((t) => /A treasure appeared/.test(t));
    run.dropTreasure(near(0.2, 0));                        // an Elite's Treasure still drops on a first run
    const eliteChest = run.roomTreasures.some((t) => t.active && !t.timed);
    // another run: the first one at 0:15
    fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0);
    step(60 * 17, () => sched());
    const otherAt = Math.round(G().run.t);
    return ok(!before && elementOpen && first && Math.abs(at - 60) <= 1 && told && eliteChest && Math.abs(otherAt - 15) <= 1,
      { before, elementOpen, t0: Math.round(t0), at, first, told, eliteChest, otherAt });
  },
});
story('first-run/minimap-with-the-first-treasure', {
  about: 'On a player\'s first run the minimap is hidden until the first Treasure appears in the room (scheduled, or left by an Elite), then stays; other runs show it from the start.',
  setup() { fresh({ elites: false, firstRun: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true; },
  play() {
    const { run } = G();
    step(5);
    const hiddenAtStart = !mapShown();
    run.dropTreasure(near(0.3, 0)); step(3);               // an Elite's Treasure counts as the first
    const shownWithChest = mapShown();
    run.roomTreasures.forEach((t) => t.hide()); step(60 * 3);
    const stays = mapShown();
    // a scheduled one also counts
    fresh({ elites: false, firstRun: true, treasures: true }); tp(3.2, 0.05, 3.0, 0); G().run.startPicked = true;
    run.firstRun.elementChosen = true;                     // past the Element pick, so the 0:15 one comes
    step(5);
    const hiddenAgain = !mapShown();
    step(60 * 16, () => run.roomTreasures.some((t) => t.active));
    const shownWithScheduled = mapShown();
    // another run: shown from the start
    fresh({ elites: false }); step(3);
    const other = mapShown();
    return ok(hiddenAtStart && shownWithChest && stays && hiddenAgain && shownWithScheduled && other,
      { hiddenAtStart, shownWithChest, stays, hiddenAgain, shownWithScheduled, other });
  },
});
story('first-run/the-first-minute', {
  about: 'A player\'s first minute, in order: swimming among roaches with bubbles firing on their own (no menu, no minimap), the Health hint on the first hit, the first card, the Element pick, then the first Treasure at 1:00 with the minimap.',
  setup() {},
  play: firstMinute,
});
story('first-run/other-runs-unchanged', {
  about: 'Any run that isn\'t a player\'s first opens the Element pick on the first frame, as before.',
  setup() { fresh({ elites: false }); G().run.startPicked = false; },
  play() {
    const { menus } = G();
    step(2);
    const title = modalTitle();
    menus.close();
    return ok(/element/i.test(title), { title });
  },
});
story('first-run/who-is-new', {
  about: 'A player is new until a run of theirs ends (dried out, or the boss beaten); one with a saved best score is not new; a new run (as after a reload) keeps them new.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    stub(run.ui, 'choose', () => {});                     // the metamorphosis pick
    const r = asNewPlayer(() => {
      const fresh0 = isNewPlayer();
      run.start();
      const active = run.firstRun.active, still = isNewPlayer();
      run.die();
      const afterDeath = isNewPlayer();
      localStorage.removeItem(PLAYED_KEY);
      run.start(); run.metamorph();                       // the boss beaten
      const afterBoss = isNewPlayer();
      localStorage.removeItem(PLAYED_KEY); localStorage.setItem(BEST_KEY, JSON.stringify({ score: 10 }));
      const withBest = isNewPlayer();
      localStorage.removeItem(BEST_KEY); markPlayed();
      const marked = isNewPlayer();
      return { fresh0, active, still, afterDeath, afterBoss, withBest, marked };
    });
    return ok(r.fresh0 && r.active && r.still && !r.afterDeath && !r.afterBoss && !r.withBest && !r.marked, r);
  },
});
story('first-run/dev-runs-dont-count', {
  about: 'The dev modes (1 on 1, fight the boss) never run in first-run mode, and dying in one doesn\'t use up a new player\'s first run.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    const r = asNewPlayer(() => {
      run.startDuel(run.duelChoices().find((p) => !p.elite && !p.act) || run.duelChoices()[0]);
      const duelActive = run.firstRun.active;
      run.die();
      const stillNew = isNewPlayer();
      run.start(); run.devRun(); run.startBossIntro();
      const bossActive = run.firstRun.active;
      return { duelActive, stillNew, bossActive };
    });
    G().menus.close();
    return ok(!r.duelActive && r.stillNew && !r.bossActive, r);
  },
});
