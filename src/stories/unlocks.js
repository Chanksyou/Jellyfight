// Stories: jelly type unlocks, the Treasure book's Jellies page and what an older save holds
// (docs/jelly-types/spec-meta.md, src/jelly-types.js typeLock). Each plays with its own save (kit.js
// asPlayer) and puts the real one back. Shared helpers are in ./kit.js.
import { CONTENT } from '../content.js';
import { TREASURES } from '../stats.js';
import { typeLock, openTypes, leavesWithTypes } from '../jelly-types.js';
import { lifetime } from '../cosmetics.js';
import { discover } from '../collection.js';
import { FirstRun, deathHint, TYPE_HINTS } from '../first-run.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { G, V, asPlayer, fresh, ok, story, stub } from './kit.js';

const LOCKED_AT_START = ['fire', 'lightning', 'ice', 'poison', 'wind', 'glitter', 'tentacle'];
// a beaten Elite, as elites.js hands it to the run
const elite = (kind) => ({ kind, name: kind, spec: { kind, area: 'test' }, base: V(3.2, 0, 3), r: 0.04 });
// the act's boss beaten, without its fight (the run's real onBossDead: the Treasure book notes it)
function beatBoss(run) {
  stub(run, 'boss', { center: () => V(0, 0, 0) }); stub(run, 'later', () => {});
  run.onBossDead({ impact: false });
}
const modal = () => G().run.ui.modal;

story('types/unlock-finish-act-1-opens-fire', {
  about: 'With jelly types on, a fresh save has Normal only, every other card showing its goal; beating act 1\'s boss in a run that counts opens the Fire jelly for good (and nothing else), and the end-of-run screen names it with the other unlocks.',
  setup() {},
  play() {
    const { run } = G(), back = asPlayer(false);
    try {
      fresh({ types: 'normal' });
      const start = openTypes();
      const goals = Object.fromEntries(LOCKED_AT_START.map((id) => [id, typeLock(id)?.goal]));
      const allLocked = start.length === 1 && start[0] === 'normal' && goals.fire === 'Finish act 1' && goals.ice === 'Defeat 3 Elites' && goals.tentacle === 'Finish act 4';
      run.dev = false;   // as after release, when a jelly type's run counts
      beatBoss(run);
      const after = openTypes(), fire = !typeLock('fire') && after.length === 2;
      stub(run, 'board', null); stub(run, 'jellyFace', () => null);
      run.phase = 'dead';
      run.endRun('You dried out', 'dead', 'Try again');
      const row = modal().textContent, named = /🎁 Unlocked\s*Fire Jelly/.test(row);
      fresh({ types: 'normal' });   // a later run: still open
      const kept = !typeLock('fire') && !!typeLock('lightning');
      return ok(allLocked && fire && named && kept, { start, goals, after, named, kept });
    } finally { back(); G().menus.close(); }
  },
});

story('types/unlock-elites-count-across-runs', {
  about: 'Elites beaten count toward the Ice jelly (3), Glitter (6) and Wind (9) across every run, not one run: two in one run and one in the next opens Ice; the locked card\'s progress counts them.',
  setup() {},
  play() {
    const { run } = G(), back = asPlayer(false);
    try {
      fresh({ types: 'normal' }); run.dev = false;
      run.eliteDefeated(elite('mug')); run.eliteDefeated(elite('kettle'));
      const two = typeLock('ice');
      fresh({ types: 'normal' }); run.dev = false;   // the next run
      run.eliteDefeated(elite('controller'));
      const opened = !typeLock('ice'), glitter = typeLock('glitter');
      return ok(two?.have === 2 && two.need === 3 && opened && glitter?.have === 3 && glitter.need === 6 && lifetime().elites === 3, { two, opened, glitter });
    } finally { back(); }
  },
});

story('types/dev-run-unlocks-nothing', {
  about: 'A dev run (dev tools unlocked) beating Elites and a boss opens no jelly type and counts nothing toward one.',
  setup() {},
  play() {
    const { run } = G(), back = asPlayer(false);
    try {
      fresh({ types: 'normal' });
      run.devRun();
      const dev = run.dev;
      for (const kind of ['mug', 'kettle', 'controller']) run.eliteDefeated(elite(kind));
      beatBoss(run);
      const open = openTypes();
      return ok(dev && open.length === 1 && open[0] === 'normal' && lifetime().elites === 0, { dev, open, elites: lifetime().elites });
    } finally { back(); }
  },
});

story('types/book-has-jellies-page', {
  about: 'The Treasure book opens on a Jellies page: all eight types, locked ones as silhouettes with their goal; each type\'s Attack upgrades follow, a found one shown; the Treasures page has no Element, Element upgrade or Power Bank and takes the former evolutions in; there is no Evolutions page.',
  setup() {},
  play() {
    const { run } = G(), back = asPlayer(true, { feats: { elites: 3 } });
    try {
      discover('upgrades', 'slowBurn');
      fresh({ types: 'normal' });
      const shown = [];
      stub(run.ui, 'book', (title, sections) => shown.push(sections));
      run.showBook(() => {});
      const S = shown[0], titles = S.map((s) => s.title), jellies = S[0];
      const cards = jellies.title === 'Jellies' && jellies.items.length === 8;
      const normal = jellies.items.find((i) => i.id === 'normal'), ice = jellies.items.find((i) => i.id === 'ice'), fire = jellies.items.find((i) => i.id === 'fire');
      const locks = normal.found && ice.found && !fire.found && fire.locked === 'Finish act 1';
      const fireUps = S.find((s) => /Fire Jelly: Attack upgrades/.test(s.title));
      const upgrade = fireUps?.items.length === CONTENT.upgrades.filter((u) => u.jelly === 'fire').length && fireUps.items.find((i) => i.id === 'slowBurn').found;
      const T = S.find((s) => s.title === 'Treasures'), ids = new Set(T.items.map((i) => i.id));
      const gone = TREASURES.filter(leavesWithTypes).every((t) => !ids.has(t.id)) && !ids.has('powerBank');
      const evos = CONTENT.evolutions.every((e) => ids.has(e.id)) && !titles.includes('Evolutions');
      // drawn: a locked type is a silhouette with its goal
      Object.getPrototypeOf(run.ui).book.call(run.ui, 'book', S, () => {});
      const drawn = modal().querySelectorAll('.jf-book-grid button.locked').length === 6 && /Finish act 1/.test(modal().textContent);
      G().menus.close(); run.ui.close();
      return ok(cards && locks && upgrade && gone && evos && drawn, { titles, cards, locks, upgrade, gone, evos, drawn });
    } finally { back(); }
  },
});

story('types/old-save-with-retired-treasure-loads', {
  about: 'A saved run that names a Treasure the game no longer has (or, with jelly types on, an Element or another retired one) loads without error and simply drops it; the rest of what it carried stays.',
  setup() {},
  play() {
    const { run } = G();
    fresh({ types: 'fire' });
    const carry = { ...run.carryOver(), owned: [['goldRing', 2], ['notATreasureAnyMore', 1], ['candle', 1]], evolved: ['goneEvolution'], upgrades: ['slowBurn', 'goneUpgrade'] };
    stub(run, 'carry', carry);
    let error = null;
    try { run.start(); run.refreshHud(); } catch (e) { error = e.message; }
    const kept = run.owned.count('goldRing') === 2 && !run.owned.has('notATreasureAnyMore') && !run.owned.has('candle');   // the Birthday Candle is the Fire Element
    const lists = run.evolved.length === 0 && run.upgrades.join() === 'slowBurn';
    return ok(!error && kept && lists, { error, owned: [...run.owned], evolved: run.evolved, upgrades: run.upgrades });
  },
});

story('types/player-text-without-elements', {
  about: 'With a jelly type there is no Element pick: a first run has no double XP, holds no Treasure back and gives no jump tip, but keeps its opening tip; the death hints swap the Element ones for type hints; Pack Light and One of Everything say nothing about Elements.',
  setup() {},
  play() {
    const F = new FirstRun(true, true);
    const first = F.xpMul === 1 && F.treasuresDue && !F.elementPickAfterCard() && /Attack automatically/.test(F.startHint);
    const hints = Array.from({ length: 200 }, () => deathHint(true));
    const noElement = hints.every((h) => !/Element/.test(h)) && TYPE_HINTS.every((h) => hints.includes(h));
    const texts = ACHIEVEMENTS.map((a) => a.typesText || a.text);
    const words = texts.every((t) => !/Element|evolutions are separate|Bubble/.test(t));
    return ok(first && noElement && words, { first, noElement, texts });
  },
});
