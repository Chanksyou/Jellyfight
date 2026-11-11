// Reasons to play another run: the death screen (how close it came, your best, the unlock you're
// nearest, Try again first), the Treasure book (collection.js: what you've found across runs) and a
// run kept across a closed tab (stages.js: Continue act N).
import { FEATS_KEY } from '../cosmetics.js';
import { FOUND_KEY, KINDS, isFound } from '../collection.js';
import { TREASURES } from '../stats.js';
import { CONTENT } from '../content.js';
import { SAVE_KEY, STAGES, carried, currentAct, keepRun, keptRun, nav, peekAction } from '../stages.js';
import { G, fresh, ok, spy, step, story, stub } from './kit.js';

// run fn with these localStorage keys emptied, then put back what was there
function withEmpty(keys, fn) {
  const saved = keys.map((k) => localStorage.getItem(k));
  try { keys.forEach((k) => localStorage.removeItem(k)); return fn(); }
  finally { keys.forEach((k, i) => (saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]))); }
}
const modal = () => document.querySelector('.jf-modal');
// a board that takes any score and remembers a best of 9,999 (leaderboard.js's shape)
const fakeBoard = (posts) => ({ status: 'online', localBest: { score: 9999 }, mine: null, keepBest: () => false, qualifies: () => true, cutoff: () => 0, post: (e) => { posts.push(e); return new Promise(() => {}); } });

story('end/death-pulls-you-back', {
  about: 'Dying shows how close it came (the boss\'s time still to come, or its Health left), your best score, and the unlock you\'re nearest (a picture of your jelly wearing it) with how far along you are; Try again is the big button, and Enter still submits the score.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FEATS_KEY], () => {
      localStorage.setItem(FEATS_KEY, JSON.stringify({ runs: 3, wins: 0, kills: 812, elites: 0 }));
      const posts = [];
      stub(run, 'board', fakeBoard(posts));
      // before the boss: its time still to come
      run.t = run.duration - 42;
      run.phase = 'dead';
      run.endRun('You dried out', 'dead', 'Try again');
      const text = modal().innerText;
      const btns = [...modal().querySelectorAll('.btns button')];
      const away = text.includes(`${run.stage.boss.name} was 0:42 away`);
      const best = /Your best\s*9,999/.test(text);
      const unlock = /Next unlock\s*Golden laurel · 812 of 1,000 bugs/.test(text);
      const pictured = /^data:image/.test(modal().querySelector('.jf-stats .jf-unlock')?.src || '');   // your jelly wearing it
      const order = /Try again/.test(btns[0]?.textContent) && btns[0].classList.contains('go') && btns.some((b) => /Submit score/.test(b.textContent) && !b.classList.contains('go'));
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      const entered = posts.length === 1;
      menus.close();
      // in the boss fight: its Health left
      stub(run, 'boss', { hp: 380, maxHp: 1000 });
      run.endRun('You dried out', 'dead', 'Try again');
      const left = modal().innerText.includes(`${run.stage.boss.name} had 38% Health left`);
      menus.close();
      return ok(away && best && unlock && pictured && order && entered && left, { away, best, unlock, pictured, order, entered, left, text: text.slice(0, 300) });
    });
  },
});

story('book/finds-are-recorded', {
  about: 'A Treasure picked for the first time wears New! on its card, goes in the Treasure book and is listed on the end screen; the next time it\'s offered it isn\'t new. The book counts what\'s found and shows what a found one does when tapped; unfound ones stay ?. A dev run records nothing.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FOUND_KEY, FEATS_KEY], () => {
      const t = TREASURES.find((x) => x.id === 'lemon'), other = TREASURES.find((x) => x.id === 'bobbyPin');
      const pick = () => { modal().querySelector('.jf-card').click(); step(60); };
      run.offer('Pick', '', [t]);
      const newBadge = !!modal().querySelector('.jf-card .jf-new');
      pick();
      const recorded = isFound('treasures', 'lemon') && run.newFinds.some((n) => n.includes(t.name));
      run.offer('Pick', '', [t]);
      const notNewAgain = !modal().querySelector('.jf-card .jf-new');
      pick();
      const once = run.newFinds.length === 1;
      // the book
      run.showBook(() => {});
      const text = modal().innerText;
      const count = new RegExp(`Treasures\\s*1 / ${TREASURES.filter((x) => !x.retired).length + CONTENT.evolutions.length}`).test(text);
      const cell = [...modal().querySelectorAll('.jf-book-grid button')].find((b) => b.textContent.includes(t.name));
      cell?.click();
      const reads = modal().querySelector('.say').textContent.includes(t.text);
      const unfound = modal().querySelectorAll('.jf-book-grid button:disabled').length > 50;
      modal().querySelector('[data-back]').click();
      const closed = !menus.open;
      // the end screen lists the find
      stub(run, 'board', null);
      run.phase = 'dead';
      run.endRun('You dried out', 'dead', 'Try again');
      const listed = /New in your book\s*🍋 Lemon Slice/.test(modal().innerText);
      menus.close();
      // a dev run records nothing
      run.dev = true;
      run.offer('Pick', '', [other]);
      const devBadge = !!modal().querySelector('.jf-card .jf-new');
      pick();
      run.dev = false;
      const devSkipped = !isFound('treasures', 'bobbyPin');
      return ok(newBadge && recorded && notNewAgain && once && count && reads && unfound && closed && listed && !devBadge && devSkipped,
        { newBadge, recorded, notNewAgain, once, count, reads, unfound, closed, listed, devBadge, devSkipped });
    });
  },
});

story('book/every-entry-has-its-own-icon', {
  about: 'With everything found, every Treasure book entry (Treasures, evolutions, Elites, bosses; the Attack upgrades and Jellies pages aside) shows an icon of its own: none blank, none shared.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FOUND_KEY], () => {
      const calls = spy(run.ui, 'book');
      run.showBook(() => {});
      // find everything, then open it again
      const all = Object.fromEntries(KINDS.map((k) => [k, []]));
      for (const sec of calls[0][1]) {
        const base = sec.title === 'Treasures' ? 'treasures' : sec.title === 'Elites' ? 'elites' : sec.title === 'Bosses' ? 'bosses' : /Attack upgrades/.test(sec.title) ? 'upgrades' : null;
        if (base) for (const it of sec.items) all[it.kind || base].push(it.id);   // (the Jellies page is judged by what is unlocked, not found)
      }
      localStorage.setItem(FOUND_KEY, JSON.stringify(all));
      run.showBook(() => {});
      const upgradeNames = [...CONTENT.upgrades, ...Object.values(CONTENT.jellies)].map((u) => u.name);   // Attack upgrades and jelly types may share emoji: judged apart
      const cells = [...modal().querySelectorAll('.jf-book-grid button:not(.locked)')].filter((b) => !upgradeNames.some((n) => b.textContent.endsWith(n)));
      const icons = cells.map((b) => b.querySelector('.ic').textContent.replace(/\uFE0F/g, '').trim());
      menus.close();
      const allFound = cells.length > 80 && cells.every((b) => !b.disabled);
      const blank = cells.filter((b, i) => !icons[i] || icons[i] === 'undefined').map((b) => b.textContent);
      const shared = cells.filter((b, i) => icons.indexOf(icons[i]) !== i).map((b) => b.textContent);
      return ok(allFound && !blank.length && !shared.length, { entries: cells.length, allFound, blank, shared });
    });
  },
});

story('menu/treasure-book', {
  about: 'The main menu\'s 📖 Treasure book opens the book over the menu; Back returns to the menu.',
  setup() { fresh({ elites: false }); },
  play() {
    const over = document.querySelector('#g-over');
    over.hidden = false;
    over.querySelector('[data-act="book"]').click();
    const opened = over.hidden && /Treasure book/.test(modal().innerText) && !modal().hidden;
    modal().querySelector('[data-back]').click();
    const back = !over.hidden && modal().hidden;
    over.hidden = true;
    return ok(opened && back, { opened, back });
  },
});

story('menu/continue-a-kept-run', {
  about: 'Moving on to the next act keeps the run on the device; the act 1 menu then shows Continue act 2 (with its level and score) above Play, and it reloads into act 2 with the run carried. The run ending forgets it, and a dev run keeps nothing.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus, GAME } = G();
    const over = document.querySelector('#g-over'), btn = over.querySelector('.resume');
    const was = sessionStorage.getItem('jellyrun.act');
    let reloads = 0;
    stub(nav, 'reload', () => { reloads++; });
    try {
      return withEmpty([SAVE_KEY], () => {
        const none = (GAME.showKept(), btn.hidden);
        run.level = 7;
        run.actComplete(STAGES[1]);
        [...modal().querySelectorAll('.btns button')].find((b) => /On to act 2/.test(b.textContent)).click();
        menus.close();
        const k = keptRun(), kept = k?.act === 2 && k.carry.level === 7;
        GAME.showKept();
        const shown = !btn.hidden && /Continue act 2/.test(btn.textContent) && /Level 7/.test(btn.textContent) && btn.nextElementSibling === over.querySelector('.play');
        sessionStorage.removeItem('jellyrun.act');
        btn.click();
        const went = JSON.parse(sessionStorage.getItem('jellyrun.act') || 'null');
        const continues = reloads === 2 && went?.act === 2 && went.carry?.level === 7 && went.then?.continue;
        stub(run, 'board', null);
        run.phase = 'dead';
        run.endRun('You dried out', 'dead', 'Try again');
        menus.close();
        const forgotten = !keptRun();
        GAME.showKept();
        const hidden = btn.hidden;
        run.dev = true;
        run.actComplete(STAGES[1]);
        [...modal().querySelectorAll('.btns button')].find((b) => /On to act 2/.test(b.textContent)).click();
        menus.close();
        run.dev = false;
        const devKeepsNothing = !keptRun();
        return ok(none && kept && shown && continues && forgotten && hidden && devKeepsNothing, { none, kept, shown, continues, forgotten, hidden, devKeepsNothing, label: btn.textContent, went });
      });
    } finally {
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
    }
  },
});


story('menu/finished-runs-cannot-continue', {
  about: 'Death and victory erase the saved checkpoint and the tab carry before delayed end screens; returning to the menu cannot offer the finished run again. Unfinished runs remain resumable.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, GAME } = G(), over = document.querySelector('#g-over'), btn = over.querySelector('.resume');
    const was = sessionStorage.getItem('jellyrun.act');
    const saved = localStorage.getItem(SAVE_KEY), oldName = window.name;
    const seed = () => {
      keepRun(2, { level: 7 });
      sessionStorage.setItem('jellyrun.act', JSON.stringify({ act: 2, carry: { level: 7 }, then: { continue: true } }));
      window.name = JSON.stringify({ 'jellyrun.act': { act: 2, carry: { level: 7 } } });
      GAME.showKept();
    };
    const cleared = () => !keptRun() && !carried() && currentAct() === 1 && !peekAction() && !JSON.parse(window.name || '{}')['jellyrun.act']?.carry;
    stub(run, 'later', () => {});   // check before any delayed score screen can clear the save
    try {
      seed();
      const unfinished = !!keptRun() && !btn.hidden;
      run.die();
      const death = cleared();
      over.hidden = true;
      run.onMainMenu();
      await Promise.resolve();   // the menu's visibility observer refreshes Continue
      const menu = btn.hidden;
      seed();
      run.pendingLevels = 0;
      run.won();
      const victory = cleared() && run.victory.active;
      run.victory.cancel();
      seed();
      stub(run, 'stage', STAGES.at(-1));
      stub(run, 'boss', { center: () => run.player.position.clone() });
      run.onBossDead({ impact: false });
      const finalBoss = cleared();
      return ok(unfinished && death && menu && victory && finalBoss, { unfinished, death, menu, victory, finalBoss });
    } finally {
      run.victory.cancel();
      window.name = oldName;
      if (saved === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, saved);
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
      GAME.showKept();
      over.hidden = true;
    }
  },
});


story('act2/finished-run-main-menu-reloads-act-one', {
  act: 2,
  about: 'Ending a later act clears its checkpoint immediately; Main menu reloads Act 1 instead of restarting the old carried run in the current scene.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), was = sessionStorage.getItem('jellyrun.act');
    let reloads = 0;
    stub(nav, 'reload', () => { reloads++; });
    stub(run, 'later', () => {});
    try {
      return withEmpty([SAVE_KEY], () => {
        keepRun(2, { level: 7 });
        run.die();
        run.onMainMenu();
        return ok(reloads === 1 && !keptRun() && !carried() && currentAct() === 1, { reloads, checkpoint: keptRun(), carry: carried(), act: currentAct() });
      });
    } finally {
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
    }
  },
});

story('act2/reload-picks-up-the-act', {
  act: 2,
  about: 'Reloading a later act part way through comes back to the act as it stood (its clock, Health, kills, level, Treasures, a beaten Elite staying beaten, its chest still waiting, the same level-up cards still owed), never a fresh act with full Health; the run ending, or a dev run, keeps nothing to come back to.',
  setup() { fresh(); },
  play() {
    const { run } = G(), was = sessionStorage.getItem('jellyrun.act'), wasCarry = run.carry;
    stub(run, 'later', () => {});
    try {
      return withEmpty([SAVE_KEY], () => {
        // the act as it began: carried from act 1
        const start = { ...run.carryOver(), level: 4, score: 5000, logId: 'reload-story' };
        sessionStorage.setItem('jellyrun.act', JSON.stringify({ act: 2, carry: start, then: null }));
        keepRun(2, start);
        run.carry = start;
        // part way through: hurt, stronger, an Elite beaten and its chest left on the floor, cards open
        const t = TREASURES.find((x) => x.id === 'lemon').id, beat = run.stage.elites[0].kind;
        Object.assign(run, { t: 150, kills: 40, level: 6 });
        run.owned.add(t);
        run.health = 7;
        run.eliteLog.push([beat, 120]);
        run.placeTreasure(run.player.position.clone(), Infinity, 0);
        run.choosingCard = true;
        run.cardsOnOffer = [{ stat: 'regen', rarity: { id: 'rare' }, amount: 1 }];
        run.keepProgress();
        const kept = keptRun()?.carry?.mid?.t === 150 && carried()?.mid?.health === 7;
        // the reload: the page builds the run again from what the tab kept
        run.carry = carried();
        run.resumed = false;
        run.start();
        const back = run.t === 150 && run.health === 7 && run.kills === 40 && run.level === 6 && run.owned.has(t);
        const earlier = run.carry.score === 5000 && run.score() > 5000;
        const eliteStaysBeaten = !run.elites.list.some((e) => e.kind === beat);
        const chest = run.roomTreasures.filter((c) => c.active).length === 1;
        const cards = run.pendingLevels === 1 && run.owedCards[0]?.[0]?.stat === 'regen' && run.owedCards[0][0].rarity.id === 'rare';
        // a dev run writes nothing; dying forgets the act
        run.dev = true; run.t = 10; run.keepProgress(); run.dev = false;
        const devNothing = carried()?.mid?.t === 150;
        run.die();
        const gone = !keptRun() && !carried();
        return ok(kept && back && earlier && eliteStaysBeaten && chest && cards && devNothing && gone,
          { kept, back, earlier, eliteStaysBeaten, chest, cards, devNothing, gone, t: run.t, health: run.health, kills: run.kills });
      });
    } finally {
      run.carry = wasCarry; run.resumed = false;
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
    }
  },
});
