import { ACHIEVEMENTS, ACHIEVEMENTS_KEY, newChallenges, awardAchievements, earnedAchievements } from '../achievements.js';
import { TREASURES } from '../stats.js';
import { applyBalance } from '../balance-editor.js';
import { Leaderboard } from '../leaderboard.js';
import { G, fresh, ok, story, phone, act4, stub, V } from './kit.js';

const passes = (id, s) => ACHIEVEMENTS.find(a => a.id === id).test(s);
const protectEarned = fn => {
  const before = localStorage.getItem(ACHIEVEMENTS_KEY);
  try { return fn(); } finally { before == null ? localStorage.removeItem(ACHIEVEMENTS_KEY) : localStorage.setItem(ACHIEVEMENTS_KEY, before); }
};

story('achievements/exact-requirements', {
  about: 'All 13 challenges use the chosen thresholds; negative restrictions fail after the first violation.',
  setup() { fresh({ elites: false }); },
  play() {
    const s = newChallenges(1), results = [];
    results.push(ACHIEVEMENTS.length === 13, passes('floor-dweller', s)); s.eliteKills++; results.push(!passes('floor-dweller', s));
    for (const a of [1, 2, 3]) s.elites[a] = ['a', 'b', 'c']; results.push(passes('full-clearance', s)); s.elites[3].pop(); results.push(!passes('full-clearance', s));
    results.push(passes('perfect-run', s)); s.hurt = true; results.push(!passes('perfect-run', s));
    s.perfect = [1]; results.push(passes('perfect-boss', s), !passes('perfect-pair', s)); s.perfect.push(2); results.push(passes('perfect-pair', s));
    results.push(passes('one-of-everything', s)); s.duplicate = true; results.push(!passes('one-of-everything', s));
    results.push(!passes('early-retirement', s)); s.early = true; results.push(passes('early-retirement', s));
    for (const a of [1, 2, 3]) s.scheduled[a] = [0, 1, 2, 3]; results.push(passes('everything-must-go', s)); s.scheduled[3].pop(); results.push(!passes('everything-must-go', s));
    s.cards.luck = 7; results.push(!passes('make-your-own-luck', s)); s.cards.luck++; results.push(passes('make-your-own-luck', s));
    s.cards = { health: 4, regen: 3, dodge: 3 }; results.push(!passes('built-to-last', s)); s.cards.dodge++; results.push(passes('built-to-last', s));
    s.cards = { bubbleDamage: 5, fireRate: 4 }; results.push(!passes('glass-cannon', s)); s.cards.fireRate++; results.push(passes('glass-cannon', s)); s.cards.health = 1; results.push(!passes('glass-cannon', s));
    s.treasures = 6; results.push(passes('pack-light', s)); s.treasures++; results.push(!passes('pack-light', s));
    results.push(passes('trust-the-hand', s)); s.rerolls++; results.push(!passes('trust-the-hand', s));
    return ok(results.every(Boolean), { results });
  },
});

story('achievements/only-full-unassisted-wins-persist', {
  about: 'Losses, intermediate wins, old saves and dev-assisted histories grant nothing. Full wins persist once.',
  setup() { fresh({ elites: false }); },
  play() { return protectEarned(() => {
    localStorage.removeItem(ACHIEVEMENTS_KEY);
    const s = newChallenges(1), denied = [];
    denied.push(awardAchievements(s, false, false).length === 0, awardAchievements(s, true, false).length === 0);
    s.bosses = [1, 2, 3, 4];
    denied.push(awardAchievements(s, true, true).length === 0);
    const old = newChallenges(4); old.bosses = [1, 2, 3, 4]; denied.push(awardAchievements(old, true, false).length === 0);
    const awarded = awardAchievements(s, true, false), count = Object.keys(earnedAchievements()).length;
    return ok(denied.every(Boolean) && awarded.length > 0 && count === awarded.length && awardAchievements(s, true, false).length === 0, { denied, awarded: awarded.map(a => a.id), count });
  }); },
});

story('achievements/card-picks-and-rerolls-use-real-callbacks', {
  about: 'Selected card types and actual rerolls are recorded separately from final stats.',
  setup() { fresh({ elites: false, levels: true }); },
  play() {
    const { run } = G(); let pick, reroll;
    stub(run, 'onResume', () => {});
    stub(run.ui, 'levelUp', (_l, _c, _s, _r, take, again) => { pick = take; reroll = again; });
    run.pendingLevels = 1; run.levelUp();
    pick({ stat: 'luck', amount: 10, rarity: { id: 'common' } });
    const before = run.challenges.rerolls; reroll();
    return ok(run.challenges.cards.luck === 1 && run.challenges.rerolls === before + 1, { cards: run.challenges.cards, rerolls: run.challenges.rerolls });
  },
});

story('achievements/acquisitions-count-repeats-not-carry-restoration', {
  about: 'Starting Elements, rewards and repeats are counted by acquisition; evolution choices and restoring a carry add no treasures.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), t = TREASURES.find(t => t.id === 'candle');
    stub(run.ui, 'choose', (_t, _s, choices, pick) => pick(choices[0]));
    stub(run.ui, 'treasure', () => {}); stub(run, 'onResume', () => {});
    run.offer('test', '', [t]); run.offer('test', '', [t]);
    const carry = run.carryOver(), restored = newChallenges(2, carry.challenges);
    restored.cards.luck = 99;
    return ok(restored.treasures === 2 && restored.duplicate && carry.challenges.cards.luck !== 99 && run.challenges.cards.luck !== 99, { treasures: restored.treasures, duplicate: restored.duplicate });
  },
});

story('achievements/health-loss-includes-drain-but-not-shields', {
  about: 'Shield absorption preserves flawless eligibility; continuous Health damage permanently disqualifies it even after healing.',
  setup() { fresh({ elites: false, hurt: true }); },
  play() {
    const { run } = G(); run.phase = 'boss';
    stub(run.shield, 'absorb', () => 0); run.hurt(5, true);
    const shielded = !run.challenges.hurt && !run.bossHurt;
    stub(run.shield, 'absorb', n => n); run.hurt(0.1, true); run.heal(5);
    run.bossWon = true; run.finishChallengeBoss(); run.finishChallengeBoss();
    return ok(shielded && run.challenges.hurt && run.bossHurt && run.challenges.perfect.length === 0 && run.challenges.bosses.length === 1, { shielded, state: run.challenges });
  },
});

story('achievements/elites-deadlines-and-golden-bugs', {
  about: 'Household Elite tracking deduplicates identities and uses strict deadlines; golden bugs do not count.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(); stub(run, 'dropTreasure', () => {}); stub(run, 'earn', () => {}); stub(run, 'found', () => {});
    run.dev = true; run.t = 179.9;
    const elite = kind => ({ kind, name: kind, spec: { kind, area: 'test' }, base: V(3.2, 0, 3), r: .04 });
    for (const kind of ['controller', 'mug', 'kettle']) run.eliteDefeated(elite(kind));
    const early = run.challenges.early && run.challenges.elites[1].length === 3;
    run.challenges = newChallenges(1); run.t = 180;
    for (const kind of ['controller', 'mug', 'kettle']) run.eliteDefeated(elite(kind));
    const boundary = !run.challenges.early;
    run.challenges = newChallenges(1); run.t = run.duration;
    run.eliteDefeated(elite('mug'));
    return ok(early && boundary && run.challenges.eliteKills === 1 && !run.challenges.elites[1].length, { early, boundary });
  },
});

story('achievements/original-scheduled-chests-only', {
  about: 'Only original scheduled reward slots count; bonus spawns, Elite drops and reused pooled chests cannot substitute.',
  setup() { fresh({ elites: false, treasures: true }); },
  play() {
    const { run, player } = G(); stub(run, 'pickTreasure', () => {});
    run.firstRun.elementChosen = true; run.t = 15; run.scheduleTreasures();
    let chest = run.roomTreasures.find(t => t.active); const first = chest.scheduledSlot === 0;
    stub(chest, 'update', () => 'taken'); run.updateRoomTreasures(0); run.updateRoomTreasures(0);
    const once = run.challenges.scheduled[1].length === 1;
    chest.hide(); run.placeTreasure(player.position.clone(), Infinity); run.updateRoomTreasures(0);
    const elite = chest.scheduledSlot == null && run.challenges.scheduled[1].length === 1;
    chest.hide(); run.bonusTreasureAt.add(30); run.treasureTimesLeft = [30]; run.t = 30; run.scheduleTreasures(); run.updateRoomTreasures(0);
    return ok(first && once && elite && chest.scheduledSlot == null && run.challenges.scheduled[1].length === 1, { first, once, elite });
  },
});

story('achievements/first-run-rescheduled-treasure-keeps-identity', {
  about: 'The original first treasure still counts when onboarding postpones it after the starting Element choice.',
  setup() { fresh({ elites: false, treasures: true, firstRun: true }); },
  play() {
    const { run } = G(); run.t = 15; run.scheduleTreasures();
    stub(run.ui, 'choose', (_t, _s, choices, pick) => pick(choices[0])); stub(run.ui, 'treasure', () => {}); stub(run, 'onResume', () => {});
    run.t = 20; run.pickStartElement(); run.t = 24; run.scheduleTreasures();
    const chest = run.roomTreasures.find(t => t.active);
    return ok(chest?.scheduledSlot === 0, { slot: chest?.scheduledSlot, remaining: run.treasureTimesLeft });
  },
});

story('achievements/dev-history-survives-act-carry', {
  about: 'A dev-assisted run remains ineligible after moving to another act.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(); run.devRun(); const carried = newChallenges(2, run.carryOver().challenges);
    return ok(!carried.eligible && !newChallenges(2).eligible && newChallenges(1).eligible);
  },
});

story('achievements/run-start-restores-full-history', {
  about: 'The run restores its challenge history from the same carry used by act transitions and saved-run continuation.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    run.challenges.cards.luck = 5; run.challenges.hurt = true; run.challenges.rerolls = 1;
    run.challenges.treasures = 4; run.challenges.seen = ['candle']; run.challenges.scheduled[1] = [0, 2];
    run.challenges.bosses = [1]; run.challenges.perfect = [1];
    const carry = JSON.parse(JSON.stringify(run.carryOver()));
    stub(run, 'carry', carry); run.start();
    const s = run.challenges; s.cards.luck++;
    return ok(s.cards.luck === 6 && carry.challenges.cards.luck === 5 && s.hurt && s.rerolls === 1 && s.treasures === 4 && s.scheduled[1].join() === '0,2' && s.perfect[0] === 1, { state: s });
  },
});

story('achievements/death-cannot-become-a-delayed-victory', {
  about: 'Dying to a lingering effect after a boss falls prevents its delayed win or metamorphosis callback from reviving the run.',
  setup() { fresh({ elites: false }); },
  play() { return protectEarned(() => {
    const { run } = G(); run.bossWon = true; run.phase = 'dead';
    const before = localStorage.getItem(ACHIEVEMENTS_KEY); let ending = false;
    stub(run.victory, 'begin', () => { ending = true; });
    run.won(); run.metamorph();
    return ok(run.phase === 'dead' && !ending && run.challenges.bosses.length === 0 && localStorage.getItem(ACHIEVEMENTS_KEY) === before);
  }); },
});

story('achievements/tuner-invalidates-current-run', {
  about: 'Applying dev balance changes prevents challenge awards, even when the normal run resumes.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(); const before = run.challenges.eligible;
    applyBalance(run);
    return ok(before && !run.challenges.eligible);
  },
});

const panel = {
  about: 'The Achievements section shows all 13 requirements, earned count and win gate, no in-run progress on unearned ones, fits the viewport and returns to its menu.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G(); let back = false;
    run.showAchievements(() => { back = true; });
    const box = menus.modal.querySelector('.jf-achievements'), rect = box.getBoundingClientRect();
    const shown = box.querySelectorAll('article').length === 13 && /four-boss win/.test(box.textContent);
    const noProgress = [...box.querySelectorAll('article:not(.earned)')].every(a => !a.querySelector('small'));
    const fits = rect.left >= 0 && rect.right <= innerWidth + 1 && rect.height <= innerHeight;
    box.querySelector('button.go').click();
    return ok(shown && noProgress && fits && back && !menus.open, { shown, noProgress, fits, back, width: rect.width, height: rect.height });
  },
};
story('achievements/section', panel);
phone('achievements-section', panel);

story('achievements/top-five-submenu-and-shared-ranks', {
  about: 'The submenu shows five players with shared ranks for equal achievement totals, the own total, and returns to achievements.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, menus } = G();
    stub(run, 'board', { id: 'player-one', achievementBoard: async () => ({ top: [
      { name: '<First>', count: 9 }, { name: 'Second', count: 9 }, { name: 'Third', count: 7 }, { name: 'Fourth', count: 5 }, { id: 'player-one', name: 'Me', count: 4 },
    ], mine: { count: 4 } }) });
    run.showAchievements(() => {});
    const key = new KeyboardEvent('keydown', { code: 'Enter', cancelable: true }); menus.keyHandler(key);
    const keyboard = !key.defaultPrevented && !!menus.modal.querySelector('[data-top]');
    menus.modal.querySelector('[data-top]').click();
    await Promise.resolve(); await Promise.resolve();
    const text = menus.modal.textContent, ranks = [...menus.modal.querySelectorAll('.jf-rank')].map(n => n.textContent);
    const good = /Achievement Top 5/.test(text) && /Your shared total/.test(text) && /<First>/.test(text) && !menus.modal.querySelector('First') && ranks.join() === '1.,1.,3.,4.,5.';
    menus.modal.querySelector('button.go').click();
    return ok(good && keyboard && !!menus.modal.querySelector('.jf-achievements'), { ranks, text, keyboard });
  },
});

story('achievements/late-ranking-response-never-reopens-submenu', {
  about: 'A pending response cannot replace the achievements section after the player goes Back.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, menus } = G(); let resolve;
    stub(run, 'board', { achievementBoard: () => new Promise(r => { resolve = r; }) });
    run.showAchievements(() => {}); menus.modal.querySelector('[data-top]').click();
    menus.modal.querySelector('button.go').click();
    resolve({ top: [], mine: null }); await Promise.resolve(); await Promise.resolve();
    return ok(!!menus.modal.querySelector('.jf-achievements'));
  },
});

story('achievements/sharing-is-independent-of-score', {
  about: 'Players with earned achievements can share without a qualifying score, using their existing identity and unique earned IDs.',
  setup() { fresh({ elites: false }); },
  async play() {
    const before = localStorage.getItem(ACHIEVEMENTS_KEY), name = localStorage.getItem('jellyrun.name');
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ 'perfect-boss': '2026-10-30', 'pack-light': '2026-10-30', fake: true }));
      const { run, menus } = G(); let sent;
      stub(run, 'board', { achievementBoard: async entry => { sent = entry; return { top: [], mine: null }; } });
      await run.showAchievementBoard(() => {});
      menus.modal.querySelector('input').value = 'Beta Jelly';
      menus.keyHandler(new KeyboardEvent('keydown', { code: 'Enter' }));
      await Promise.resolve(); await Promise.resolve();
      return ok(sent?.name === 'Beta Jelly' && sent.achievements.join() === 'perfect-boss,pack-light', { sent });
    } finally {
      before == null ? localStorage.removeItem(ACHIEVEMENTS_KEY) : localStorage.setItem(ACHIEVEMENTS_KEY, before);
      name == null ? localStorage.removeItem('jellyrun.name') : localStorage.setItem('jellyrun.name', name);
    }
  },
});

story('achievements/shared-client-handles-offline-and-rate-limit', {
  about: 'The achievement API uses the existing player ID, remains independent of score eligibility, and reports rate limits or offline hosts.',
  setup() { fresh({ elites: false }); },
  async play() {
    const B = Object.create(Leaderboard.prototype); B.id = 'player-one'; B.ready = Promise.resolve();
    let payload;
    stub(window, 'fetch', async (_url, options) => { payload = JSON.parse(options.body); return new Response(JSON.stringify({ top: [], posted: true }), { headers: { 'content-type': 'application/json' } }); });
    const result = await B.achievementBoard({ name: 'Jelly', achievements: ['perfect-boss'] });
    stub(window, 'fetch', async () => new Response(JSON.stringify({ why: 'slow' }), { status: 429 }));
    const slow = await B.achievementBoard({ achievements: ['perfect-boss'] });
    stub(window, 'fetch', async () => { throw new Error('offline'); });
    const offline = await B.achievementBoard();
    return ok(result.posted && payload.id === B.id && slow.error === 'slow' && offline.error === 'offline');
  },
});

act4('achievements/final-win-awards-and-remembers', {
  about: 'The real final-victory path awards challenges only after all four bosses and does not award them twice.',
  setup() { fresh({ elites: false }); },
  play() { return protectEarned(() => {
    localStorage.removeItem(ACHIEVEMENTS_KEY);
    const { run } = G(); run.challenges = newChallenges(1); run.challenges.bosses = [1, 2, 3]; run.challenges.perfect = [1];
    run.bossWon = true; run.bossHurt = false; run.pendingLevels = 0; run.ui.close();
    stub(run.victory, 'begin', () => {});
    run.won(); const first = run.newAchievements.map(a => a.id); run.won();
    return ok(first.includes('perfect-pair') && first.includes('perfect-run') && run.newAchievements.length === first.length && earnedAchievements()['perfect-pair'], { first });
  }); },
});
