// The reward spin's numbers (src/spin.js) and three of a kind (src/stats.js, threeOfAKind):
// reels are real rolls on their own dice, they land on the offer, the Luck panel's odds are the
// roll's odds, and three of one rarity on the prize line makes one card a rarity better.
import { CONTENT } from '../content.js';
import { RARITY, TREASURES, CHEST_WEIGHTS, rollCards, cardAmount } from '../stats.js';
import { tierOdds, buildStrips, spinCells, spinTimes } from '../spin.js';
import { seededRandom } from '../story-random.mjs';
import { FirstRun } from '../first-run.js';
import { G, story, ok, fresh, stub, give, step } from './kit.js';
import { sfx } from '../sfx.js';
import { LOOK } from '../look.js';

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
  about: 'Every filler cell is something the player could be offered now (eligible pool, not-for, stack limits), and each Treasure rarity turns up about as often as the Luck panel says (within 2 points: no two neighbours alike nudges rare kinds down a little).',
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

story('spin/owed-cards-stay-rerolls-upgrade', {
  about: 'Cards owed after a reload come back exactly as they were (no second three of a kind); a reroll of three Commons makes one Rare.',
  setup() { fresh({ levels: true }); },
  play() {
    const { run } = G();
    const three = [card('range', 0), card('fireRate', 0), card('moveSpeed', 0)];
    let shown = null, reroll = null;
    stub(run, 'rollLevelUp', () => three.map((c) => ({ ...c })));
    stub(run.ui, 'levelUp', (level, offered, s, r, pick, again) => { shown = offered; reroll = again; });
    stub(run.hud, 'levelDing', () => {});
    run.owedCards = [three.map((c) => ({ ...c }))];
    run.pendingLevels = 1;
    run.levelUp();
    const owed = sameCards(shown, three) && !shown.some((c) => c.upgraded);
    const again = reroll();
    return ok(owed && again.filter((c) => c.upgraded && c.rarity.id === 'rare').length === 1, { owed, again: again.map((c) => c.rarity.id) });
  },
});

// --- the machine (src/spin-screen.js): stories open a pick with the spin on (fresh({ spin: true })) and step the game's clock
const spinning = () => G().menus._spin;
const machine = () => document.querySelector('.jf-modal .jf-spin');
const shownCards = () => [...document.querySelectorAll('.jf-modal .jf-card')];
// each reel's payline card, as the screen shows it: its rarity and name
const paylines = () => [...document.querySelectorAll('.jf-spin .sp-reel')].map((r) => { const c = r.querySelector('.sp-cell.win'); return { r: c?.dataset.r, name: c?.querySelector('.nm').textContent }; });
const tierId = (c) => c.rarity?.id ?? c.rarity;
// a level-up as the game opens one (levels are stubbed off in stories), its roll swapped for `cards` when given;
// the reels' filler stays the real roll
function openLevelUp(cards = null) {
  const { run } = G(), proto = Object.getPrototypeOf(run);
  if (cards) stub(run, 'rollLevelUp', (n = 3, rng) => (rng ? proto.rollLevelUp.call(run, n, rng) : cards.map((c) => ({ ...c }))));
  stub(run.hud, 'levelDing', () => {});
  run.pendingLevels = 1;
  proto.levelUp.call(run);
}
// step the game until the spin hands over to the cards (or `max` frames); -> frames stepped
const untilCards = (max = 400) => step(max, () => !spinning());

story('spin/cards-follow-the-spin', {
  about: 'A level-up and a chest open on the machine, not the cards; each reel lands on the offered card in order, and the cards deal in by themselves once the reels have landed and held (no tap needed).',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G(), res = {};
    for (const kind of ['levelup', 'treasure']) {
      if (kind === 'levelup') openLevelUp(); else run.pickTreasure('A treasure!', 'Choose a treasure.', 'room');
      const offer = kind === 'levelup' ? run.cardsOnOffer : spinning().o.offer, sp = spinning();
      const first = !!machine() && !shownCards().length && !!sp;
      const T = sp.times, want = T.lever + Math.max(...T.stops) + T.hold;
      const landedAt = step(400, () => sp.reels.every((r) => r.landed)) + 1, lines = paylines();
      const frames = landedAt + untilCards();
      const names = shownCards().map((b) => b.querySelector('.ui-card-name').textContent);
      res[kind] = { first, lines: lines.every((l, i) => l.r === tierId(offer[i])), cards: names.length === offer.length,
        inOrder: lines.every((l, i) => names[i] === l.name), ms: Math.round(frames * 1000 / 60), want };
      res[kind].ok = res[kind].first && res[kind].lines && res[kind].cards && res[kind].inOrder && Math.abs(res[kind].ms - want - 120) < 80;
      G().menus.close();
    }
    return ok(res.levelup.ok && res.treasure.ok, res);
  },
});

story('spin/tap-lands-the-reels', {
  about: 'A tap while the reels roll lands every one within 150 ms; number keys and R do nothing yet; a second tap during the hold goes straight to the cards.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G();
    openLevelUp();
    const sp = spinning(), rerolls = run.rerolls;
    step(20);   // the lever is down and the reels are rolling
    const rolling = sp.reels.filter((r) => !r.landed).length;
    for (const code of ['Digit1', 'KeyR']) dispatchEvent(new KeyboardEvent('keydown', { code }));
    const keysIgnored = !!spinning() && run.choosingCard && run.rerolls === rerolls;
    machine().click();
    const quick = sp.reels.every((r) => r.landed || r.anim.effect.getTiming().duration <= 150);
    step(10);   // 167 ms
    const landed = sp.reels.every((r) => r.landed) && sp.phase === 'hold';
    machine().click();
    step(10);   // the machine leaves (120 ms)
    const cards = shownCards().length === 3 && !spinning();
    return ok(rolling > 0 && keysIgnored && quick && landed && cards, { rolling, keysIgnored, quick, landed, cards });
  },
});

story('spin/reroll-spins-again', {
  about: 'A tap in the first moment after the spin hands over picks nothing (it was meant to skip); then a reroll sends the cards off and plays the short spin again with the new roll, which its reels land on before the new cards deal in.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G();
    run.rerolls = 1;
    openLevelUp();
    untilCards();
    const before = run.cardsOnOffer;
    document.querySelector('.jf-modal [data-act="reroll"]').click();
    const early = run.cardsOnOffer === before;   // a tap straight after the hand-over (meant to skip) is ignored
    step(20);
    document.querySelector('.jf-modal [data-act="reroll"]').click();
    const leaving = !!document.querySelector('.jf-modal .jf-level.ui-leave') && !machine();
    step(10);
    const again = !!machine() && run.cardsOnOffer !== before;
    step(400, () => spinning()?.reels.every((r) => r.landed));
    const lines = paylines().every((l, i) => l.r === tierId(run.cardsOnOffer[i]));
    untilCards();
    return ok(early && leaving && again && lines && shownCards().length === 3 && run.rerolls === 0, { early, leaving, again, lines });
  },
});

story('spin/four-reels-with-notebook', {
  phone: true,
  about: 'With the Notebook a level-up has four reels, and on a phone held sideways (with an iPhone\'s 47 px notch margins) the machine fits on screen with every rarity word whole, at Normal and at Large text.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G(), root = document.documentElement, was = root.dataset.textSize, res = {};
    run.mods.cardChoices = 1;
    G().menus.modal.style.paddingInline = '47px';   // (what env(safe-area-inset-*) gives on an iPhone held sideways)
    try {
      for (const size of ['normal', 'large']) {
        root.dataset.textSize = size;
        openLevelUp();
        spinning().stay = true;
        machine().click();
        step(30);
        for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish();
        const box = machine().querySelector('.sp-cab').getBoundingClientRect(), cut = [...document.querySelectorAll('.jf-spin .sp-cell .r')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
        res[size] = { reels: document.querySelectorAll('.jf-spin .sp-reel').length, fits: box.left >= 47 && box.top >= 0 && box.right <= innerWidth - 47 && box.bottom <= innerHeight, cut: [...new Set(cut)] };
        G().menus.close();
      }
    } finally { root.dataset.textSize = was || 'normal'; G().menus.modal.style.paddingInline = ''; }
    return ok(['normal', 'large'].every((s) => res[s].reels === 4 && res[s].fits && !res[s].cut.length), res);
  },
});

story('spin/calm-only-fades', {
  about: 'With Reduce effects the machine fades in already landed (nothing rolls, the lever stays still), holds 600 ms or until a tap, and fades out for the cards: only opacity animates.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G(), was = document.body.classList.contains('calm');
    document.body.classList.add('calm');
    try {
      const moved = new Set(), read = () => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.jf-spin')) for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(k)) moved.add(k); };
      run.pickTreasure('A treasure!', 'Choose a treasure.', 'room');
      read();
      const landed = [...document.querySelectorAll('.jf-spin .sp-reel')].every((r) => r.classList.contains('landed')) && !spinning().reels.length;
      const held = step(100, () => !spinning());
      read();
      run.ui.close();
      openLevelUp();
      read();
      machine().click();
      step(10);
      read();
      const tapped = !spinning() && shownCards().length === 3;
      const fadesOnly = [...moved].every((k) => k === 'opacity');
      return ok(landed && Math.abs(held * 1000 / 60 - 720) < 40 && tapped && fadesOnly, { landed, heldMs: Math.round(held * 1000 / 60), tapped, moved: [...moved] });
    } finally { document.body.classList.toggle('calm', was); }
  },
});

story('spin/reload-skips-the-spin', {
  about: 'Cards a reload owes come straight back, with no spin; a reroll of them spins.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G();
    run.rerolls = 1;
    run.owedCards = [[card('range', 0), card('fireRate', 1), card('moveSpeed', 0)]];
    openLevelUp();
    const straight = !spinning() && !machine() && shownCards().length === 3;
    step(30);
    document.querySelector('.jf-modal [data-act="reroll"]').click();
    step(10);
    return ok(straight && !!machine(), { straight, spinsOnReroll: !!machine() });
  },
});

story('spin/three-of-a-kind-rolls-one-reel-again', {
  about: 'Three Commons land matching; the sign says "Three Commons! One becomes Rare.", the upgraded card\'s reel gets a gold rim and rolls on to it with an Upgraded tag, and its pick card says Upgraded too.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G();
    openLevelUp([card('range', 0), card('fireRate', 0), card('moveSpeed', 0)]);
    const sp = spinning(), up = run.cardsOnOffer.findIndex((c) => c.upgraded);
    step(400, () => sp.phase === 'upgrade');
    const sign = document.querySelector('.jf-spin .sp-sign p').textContent;
    const reels = [...document.querySelectorAll('.jf-spin .sp-reel')], rim = reels.map((r) => r.classList.contains('up'));
    const otherLines = paylines().filter((_, i) => i !== up).every((l) => l.r === 'common');
    const rolling = !sp.reels[up].landed;
    step(60, () => sp.reels[up].landed);
    const line = paylines()[up], tag = !!reels[up].querySelector('.sp-cell.win .up');
    untilCards();
    const badge = shownCards()[up]?.querySelector('.jf-up')?.textContent || '';
    return ok(up >= 0 && sign === 'Three Commons! One becomes Rare.' && rim.filter(Boolean).length === 1 && rim[up] && otherLines && rolling && line.r === 'rare' && tag && badge.includes('Upgraded'),
      { up, sign, rim, otherLines, rolling, line, tag, badge });
  },
});

story('spin/boss-reward-has-no-spin', {
  about: 'The Boss reward (and an Attack upgrade) opens straight on its cards: no machine.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run } = G();
    run.pickLegendary('A Legendary treasure', 'Choose a treasure.', () => {});
    const boss = !spinning() && !machine() && shownCards().length === 3;
    G().menus.close();
    return ok(boss, { boss });
  },
});

story('spin/first-run-says-how-to-stop', {
  about: 'A first run\'s first spin says "Tap to stop the reels." on its sign, once; the next spin, and any spin of a later run, does not.',
  setup() { fresh({ spin: true, firstRun: true }); },
  play() {
    const { run } = G(), line = () => machine()?.querySelector('.sp-sign p').textContent;
    openLevelUp();
    const first = line();
    untilCards();
    G().menus.close();
    openLevelUp();
    const second = line();
    untilCards();
    G().menus.close();
    run.firstRun = new FirstRun(false);
    openLevelUp();
    const later = line();
    return ok(first === 'Tap to stop the reels.' && second === 'The reels are rolling…' && later === 'The reels are rolling…', { first, second, later });
  },
});

story('spin/reels-keep-to-the-page-clock', {
  about: 'The reels roll on the page\'s clock, so the machine never falls behind them: with the game\'s clock held back (hit-stop, slow-mo or long frames on a slow phone), every reel still lands, with no streaks left on it, once its roll has played out.',
  setup() { fresh({ spin: true }); },
  async play() {
    openLevelUp();
    step(1);
    const D = spinning().times.lever + Math.max(...spinning().times.stops);
    await new Promise((r) => setTimeout(r, D + 300));   // the page's time passes; the game's barely moves
    step(1);
    const sp = spinning(), landed = !!sp && sp.reels.every((r) => r.landed), streaks = document.querySelectorAll('.jf-spin .sp-reel.fast').length;
    return ok(landed && !streaks && sp.phase !== 'roll', { landed, streaks, phase: sp?.phase, t: Math.round(sp?.t) });
  },
});

story('spin/sounds-follow-the-machine', {
  about: 'The lever\'s clunk lands as the lever bottoms out (--spin-lever), and a spin closed or replaced mid-roll silences its ticking rather than leave it running over the next screen.',
  setup() { fresh({ spin: true }); },
  play() {
    const { run, menus } = G(), ticks = [], levers = [];
    stub(sfx, 'spinTick', (reels) => ticks.push(reels.length));
    stub(sfx, 'spinLever', (down) => levers.push(down));
    openLevelUp();
    step(5);
    const lever = Math.abs(levers[0] - LOOK.num('spin-lever', 250) / 1000) < 1e-6;
    menus.close();
    const closed = ticks.at(-1) === 0;
    openLevelUp();
    step(5);
    run.pickTreasure('A treasure!', 'Choose a treasure.', 'room');   // a chest over a rolling level-up: its own ticks replace the old ones
    const replaced = ticks.at(-2) === 0 && ticks.at(-1) > 0;
    return ok(lever && closed && replaced, { levers, ticks, lever, closed, replaced });
  },
});

story('spin/touch-controls-hide-under-the-machine', {
  phone: true,
  about: 'On a phone the touch controls (stick, jump) would show round the machine\'s edges: they are hidden while it is up, and back, dimmed as before, once the cards are dealt.',
  setup() { fresh({ spin: true }); },
  play() {
    const pad = document.getElementById('touch'), shown = () => !!pad && !pad.hidden && getComputedStyle(pad).visibility === 'visible';
    step(5);
    const before = shown();
    openLevelUp();
    step(5);
    const during = shown();
    untilCards();
    const after = shown();
    return ok(before && !during && after, { before, during, after });
  },
});
