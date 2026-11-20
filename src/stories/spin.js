// The reward spin's numbers (src/spin.js) and three of a kind (src/stats.js, threeOfAKind):
// reels are real rolls on their own dice, they land on the offer, the Luck panel's odds are the
// roll's odds, and three of one rarity on the prize line makes one card a rarity better.
import { CONTENT } from '../content.js';
import { RARITY, TREASURES, CHEST_WEIGHTS, rollCards, cardAmount } from '../stats.js';
import { tierOdds, buildStrips, spinCells, spinTimes } from '../spin.js';
import { seededRandom } from '../story-random.mjs';
import { G, story, ok, fresh, stub, give } from './kit.js';

const card = (stat, tier) => ({ stat, rarity: RARITY[tier], amount: CONTENT.levelups.cards[stat].amounts[tier] });
const treasuresOf = (rarity, n) => TREASURES.filter((t) => t.rarity === rarity && G().run.takeable(t)).slice(0, n);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sameCards = (a, b) => JSON.stringify(a.map((c) => c.id || `${c.stat}:${c.rarity.id}:${c.amount}`)) === JSON.stringify(b.map((c) => c.id || `${c.stat}:${c.rarity.id}:${c.amount}`));

// What the level-up hands the screen, with the run's own roll swapped for `cards`
function levelUpWith(cards) {
  const { run } = G();
  let shown = null;
  stub(run, 'rollLevelUp', () => cards.map((c) => ({ ...c })));
  stub(run.ui, 'levelUp', (level, offered) => { shown = offered; });
  stub(run.hud, 'levelDing', () => {});
  run.pendingLevels = 1;
  run.levelUp();
  return shown;
}
// What a chest offers, with its roll swapped for `offer`
function chestWith(offer) {
  const { run } = G();
  let shown = null;
  stub(run, 'rollChest', () => [...offer]);
  stub(run, 'offer', (title, sub, choices) => { shown = choices; });
  run.pickTreasure();
  return shown;
}
const upgradedOnly = (before, after) => after.filter((c, i) => !sameCards([c], [before[i]]));

story('spin/does-not-move-the-roll', {
  about: 'Building the reels never touches the real dice: with the same seed, the next level-up and chest roll are the same whether reels were built or not.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const twice = (kind, build) => {
      stub(Math, 'random', seededRandom(7));
      const roll = () => (kind === 'treasure' ? run.rollChest('room') : run.rollLevelUp());
      const first = roll();
      if (build) buildStrips(first, (rng) => (kind === 'treasure' ? run.rollChest('room', 1, rng) : run.rollLevelUp(1, rng)), { cells: spinCells(kind), seed: 3 });
      return [first, roll()];
    };
    const res = {};
    for (const kind of ['levelup', 'treasure']) {
      const [a1, a2] = twice(kind, false), [b1, b2] = twice(kind, true);
      res[kind] = sameCards(a1, b1) && sameCards(a2, b2) && a1.length === 3;
    }
    return ok(res.levelup && res.treasure, res);
  },
});

story('spin/reels-land-on-the-offer', {
  about: 'Each reel has its filler, then the offered card on the payline, then one more cell, in the offer\'s order.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const offer = run.rollChest('elite'), cells = spinCells('treasure');
    const strips = buildStrips(offer, (rng) => run.rollChest('elite', 1, rng), { cells, seed: 11 });
    const cards = run.rollLevelUp(), lcells = spinCells('levelup');
    const lstrips = buildStrips(cards, (rng) => run.rollLevelUp(1, rng), { cells: lcells, seed: 12 });
    const lands = (ss, o, n) => ss.length === o.length && ss.every((s, i) => s.length === n + 2 && s[n] === o[i]);
    const neighbours = [...strips, ...lstrips].every((s) => s.every((c, i) => i === 0 || !sameCards([c], [s[i - 1]])));
    return ok(lands(strips, offer, cells) && lands(lstrips, cards, lcells) && neighbours && cells === 16 && lcells === 10, { cells, lcells, neighbours });
  },
});

story('spin/reels-are-real-rolls', {
  about: 'Every filler cell is something the player could be offered now (eligible pool, not-for, stack limits), and each rarity turns up about as often as the Luck panel says.',
  setup() { fresh({ types: 'tentacle' }); give('lemon', 'lemon', 'lemon', 'lemon', 'lemon'); },
  play() {
    const { run } = G();
    run.stats.luck = 40;
    const can = TREASURES.filter((t) => CHEST_WEIGHTS.room[t.rarity] > 0 && run.takeable(t)).map((t) => t.id);
    const counts = {}, cells = spinCells('treasure');
    let filler = 0, outside = 0, lemon = 0, badCard = 0;
    for (let s = 0; s < 150; s++) {
      for (const strip of buildStrips(run.rollChest('room'), (rng) => run.rollChest('room', 1, rng), { cells, seed: s })) {
        for (const t of strip.filter((_, i) => i !== cells)) {
          filler++;
          counts[t.rarity] = (counts[t.rarity] || 0) + 1;
          if (!can.includes(t.id)) outside++;
          if (t.id === 'lemon') lemon++;
        }
      }
      for (const strip of buildStrips(run.rollLevelUp(), (rng) => run.rollLevelUp(1, rng), { cells: spinCells('levelup'), seed: s })) {
        for (const c of strip) if (CONTENT.levelups.cards[c.stat].notFor?.includes('tentacle') || CONTENT.levelups.cards[c.stat].weight === 0) badCard++;
      }
    }
    const odds = tierOdds('treasure', { luck: 40, source: 'room', pool: TREASURES.filter((t) => can.includes(t.id)) });
    const off = odds.map((r) => ({ id: r.id, want: +r.now.toFixed(3), got: +((counts[r.id] || 0) / filler).toFixed(3) }));
    return ok(outside === 0 && lemon === 0 && badCard === 0 && off.every((r) => near(r.want, r.got, 0.02)), { filler, outside, lemon, badCard, off });
  },
});

story('spin/luck-panel-matches-the-roll', {
  about: 'The Luck panel\'s odds are the roll\'s: measured first-slot rarities match tierOdds at Luck 0, 40 and 100, for room and Elite chests and level-ups with and without the Game Die.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const pool = TREASURES.filter((t) => run.takeable(t));
    const bad = [];
    const check = (label, odds, rollFirst, n = 6000) => {
      const rng = seededRandom(99), seen = {};
      for (let i = 0; i < n; i++) { const r = rollFirst(rng); seen[r] = (seen[r] || 0) + 1; }
      for (const o of odds) if (!near(o.now, (seen[o.id] || 0) / n, 0.02)) bad.push({ label, id: o.id, want: +o.now.toFixed(3), got: +((seen[o.id] || 0) / n).toFixed(3) });
    };
    for (const luck of [0, 40, 100]) {
      run.stats.luck = luck;
      for (const source of ['room', 'elite']) {
        const odds = tierOdds('treasure', { luck, source, pool: pool.filter((t) => CHEST_WEIGHTS[source][t.rarity] > 0) });
        check(`${source}@${luck}`, odds, (rng) => run.rollChest(source, 3, rng)[0].rarity);
      }
      for (const bonus of [0, 1]) {
        // a card that has every tier, so the panel's per-reel odds are the card's
        check(`levelup+${bonus}@${luck}`, tierOdds('levelup', { luck, bonus }), (rng) => rollCards({ bubbles: 6 }, 1, bonus, luck, {}, ['bubbles'], rng)[0].rarity.id);
      }
    }
    // a chest with no Legendary left to take: its share goes to the rest
    const real = run.takeable.bind(run);
    stub(run, 'takeable', (t) => t.rarity !== 'legendary' && real(t));
    run.stats.luck = 40;
    const noLeg = tierOdds('treasure', { luck: 40, source: 'elite', pool: TREASURES.filter((t) => run.takeable(t)) });
    check('elite@40 no legendary', noLeg, (rng) => run.rollChest('elite', 3, rng)[0].rarity);
    if (noLeg.some((o) => o.id === 'legendary')) bad.push('legendary listed');
    const legendary = tierOdds('legendary');
    return ok(!bad.length && legendary.length === 1 && legendary[0].now === 1, { bad });
  },
});

story('spin/times-wait-on-rare-reels', {
  about: 'Reels stop in order from look.css; a reel landing Epic or Legendary (and every reel after it) waits a little longer; a 4th reel keeps the step.',
  setup() {},
  play() {
    const c = (id) => ({ rarity: RARITY.find((r) => r.id === id) });
    const plain = spinTimes('levelup', [c('common'), c('common'), c('rare')]);
    const rare = spinTimes('treasure', [{ rarity: 'common' }, { rarity: 'epic' }, { rarity: 'common' }, { rarity: 'legendary' }]);
    return ok(String(plain.stops) === '500,700,900' && plain.hold === 300 && String(rare.stops) === '900,1500,1850,2450' && rare.hold === 450 && rare.lever > 0, { plain, rare });
  },
});

story('spin/three-commons-make-a-rare', {
  about: 'Three of a kind: three Common level-up cards make one of them Rare (marked upgraded); a mixed offer is left alone; four Commons with the Notebook upgrade one too.',
  setup() { fresh({ levels: true }); },
  play() {
    const three = [card('range', 0), card('fireRate', 0), card('moveSpeed', 0)];
    const shown = levelUpWith(three);
    const changed = upgradedOnly(three, shown);
    const mixed = [card('range', 0), card('fireRate', 1), card('moveSpeed', 0)];
    const left = levelUpWith(mixed);
    const four = [...three, card('health', 0)];
    const four2 = levelUpWith(four);
    return ok(changed.length === 1 && changed[0].rarity.id === 'rare' && changed[0].upgraded && sameCards(left, mixed) && !left.some((c) => c.upgraded) && four2.filter((c) => c.upgraded).length === 1, { changed, four: four2.map((c) => c.rarity.id) });
  },
});

story('spin/three-rares-make-an-epic', {
  about: 'Three Rare level-up cards make one of them Epic.',
  setup() { fresh({ levels: true }); },
  play() {
    const three = [card('range', 1), card('health', 1), card('moveSpeed', 1)];
    const changed = upgradedOnly(three, levelUpWith(three));
    return ok(changed.length === 1 && changed[0].rarity.id === 'epic' && changed[0].upgraded, { changed });
  },
});

story('spin/three-epic-cards-stay', {
  about: 'Epic is the top level-up tier, so three Epic cards stay as they are.',
  setup() { fresh({ levels: true }); },
  play() {
    const three = [card('range', 2), card('health', 2), card('moveSpeed', 2)];
    const shown = levelUpWith(three);
    return ok(sameCards(shown, three) && !shown.some((c) => c.upgraded), { shown: shown.map((c) => c.rarity.id) });
  },
});

story('spin/upgrade-keeps-the-stat', {
  about: 'The upgraded card keeps its stat and gives the next tier\'s amount, measured from what you have now (Dodge closes less of the gap at 30 Dodge).',
  setup() { fresh({ levels: true }); },
  play() {
    const { run } = G();
    run.stats.dodge = 30;
    const three = [card('dodge', 0), card('dodge', 0), card('dodge', 0)].map((c) => ({ ...c, amount: cardAmount('dodge', c.amount, 30) }));
    const up = levelUpWith(three).find((c) => c.upgraded);
    const want = cardAmount('dodge', CONTENT.levelups.cards.dodge.amounts[1], 30);
    return ok(up && up.stat === 'dodge' && up.rarity.id === 'rare' && up.amount === want && want < CONTENT.levelups.cards.dodge.amounts[1], { up, want });
  },
});

story('spin/three-epic-treasures-make-a-legendary', {
  about: 'Three Epic Treasures in a chest make one slot a Legendary Treasure the player could take and isn\'t already offered; three Commons make a Rare.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const epics = treasuresOf('epic', 3), commons = treasuresOf('common', 3);
    const a = chestWith(epics), b = chestWith(commons);
    const upA = a.filter((t) => t.upgraded), upB = b.filter((t) => t.upgraded);
    const fine = (up, rarity, was) => up.length === 1 && up[0].rarity === rarity && run.takeable(up[0]) && !was.some((t) => t.id === up[0].id);
    return ok(epics.length === 3 && fine(upA, 'legendary', epics) && fine(upB, 'rare', commons) && a.filter((t) => epics.some((e) => e.id === t.id)).length === 2, { a: a.map((t) => `${t.id}:${t.rarity}`), b: b.map((t) => `${t.id}:${t.rarity}`) });
  },
});

story('spin/no-treasure-left-no-upgrade', {
  about: 'Three Epic Treasures with no Legendary left to take: the chest is left as it was.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const epics = treasuresOf('epic', 3);
    const real = run.takeable.bind(run);
    stub(run, 'takeable', (t) => t.rarity !== 'legendary' && real(t));
    const shown = chestWith(epics);
    return ok(shown.length === 3 && !shown.some((t) => t.upgraded) && shown.every((t) => t.rarity === 'epic'), { shown: shown.map((t) => t.id) });
  },
});
