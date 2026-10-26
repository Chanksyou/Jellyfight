// Reasons to play another run: the death screen (how close it came, your best, the unlock you're
// nearest, Try again first) and the Treasure book (collection.js: what you've found across runs).
import { FEATS_KEY } from '../cosmetics.js';
import { FOUND_KEY, isFound } from '../collection.js';
import { TREASURES } from '../stats.js';
import { G, fresh, ok, step, story, stub } from './kit.js';

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
      const unlock = /Next unlock\s*Golden laurel · clear 1,000 bugs \(812 so far\)/.test(text);
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
      const count = new RegExp(`Treasures\\s*1 / ${TREASURES.length}`).test(text);
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
