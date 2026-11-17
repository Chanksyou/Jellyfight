// Stories: one Legendary pool (docs/jelly-types/spec-legendaries.md, phase P9). With jelly types on
// there is no separate evolution pick: the evolutions are Legendary treasures in the Boss reward's
// pick, a run can hold several, and their costs add up. Shared helpers are in ./kit.js.
import { bus } from '../events.js';
import { CONTENT } from '../content.js';
import { BASE_STATS } from '../stats.js';
import { rollChance } from '../chance.js';
import { G, fresh, give, ok, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const OLD_LEGENDARIES = ['dice', 'notebook', 'handMirror', 'snooze', 'discoBall', 'bubbleBath', 'hotWaterBottle', 'toyMouse', 'potLid', 'bloodyFangs', 'goodieBag'];
const EVOLUTION_IDS = () => CONTENT.evolutions.filter((e) => !e.retired).map((e) => e.id);

// every id the Boss reward's Legendary pick offers this run, over many rolls
function legendaryPool(rolls = 300) {
  const { run } = G(), ids = new Set();
  stub(run, 'offer', (title, sub, list) => { for (const t of list) ids.add(t.id); });
  for (let i = 0; i < rolls; i++) run.pickLegendary('x', 'x');
  return ids;
}
// take an evolution the way the Boss reward does (Run.evolve), with the reveal skipped
function evolveAll(...ids) {
  const { run } = G();
  stub(run.evolutionReveal, 'begin', (evo, before, done) => done());
  for (const id of ids) run.evolve(CONTENT.evolutions.find((e) => e.id === id), () => {});
}

story('types/boss-gives-legendary-then-upgrade', {
  about: 'An act\'s boss gives one Legendary pick from the pool of 20 (the 10 Legendary treasures and the 10 former evolutions; no Element or Power Bank), then the Attack upgrade pick, then the act ends; after the last act\'s boss there is no pick, just the win. Picking a former evolution plays the metamorphosis.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const once = (pickEvolution) => {
      const { run } = G(), picks = [], ended = [], reveals = [];
      stub(run.evolutionReveal, 'begin', (evo, before, done) => { reveals.push(evo.id); done(); });
      stub(run, 'actComplete', (next) => ended.push(next.id));
      stub(run.ui, 'choose', (title, sub, choices, onPick) => {
        picks.push({ title, ids: choices.map((c) => c.id) });
        onPick((pickEvolution && choices.find((c) => c.evolution)) || choices[0]);
      });
      run.dev = true; run.bossWon = true;
      run.metamorph();
      return { picks, ended, reveals, evolved: [...run.evolved], upgrades: [...run.upgrades], phase: run.phase };
    };
    // the whole pool, for Normal with a Shield bar (Pot Lid needs one)
    fresh({ types: 'normal' });
    G().run.stats.shield = 5;
    const pool = legendaryPool(), want = [...OLD_LEGENDARIES, ...EVOLUTION_IDS()];
    const whole = want.length >= 17 && pool.size === want.length && want.every((id) => pool.has(id));
    // a Fire run: one Legendary pick, then the upgrade pick
    fresh({ types: 'fire' });
    let on;
    for (let tries = 0; tries < 20 && !on?.reveals.length; tries++) { fresh({ types: 'fire' }); on = once(true); }   // (until a former evolution is among the three)
    // the last act's boss (act 4): no pick at all, straight to the win (never the old evolution pick)
    fresh({ types: 'tentacle' });
    const R = G().run, ends = [], lastPicks = [];
    stub(R, 'endRun', (title) => ends.push(title));
    stub(R.ui, 'choose', (title) => lastPicks.push(title));
    const stage = R.stage;
    R.stage = { ...stage, id: 4 };
    R.dev = true; R.bossWon = true;
    R.metamorph();
    const last = ends.length === 1 && /won/.test(ends[0]) && !lastPicks.length && !R.evolved.length;
    R.stage = stage;
    fresh();
    const pass = last && whole && on.picks.length === 2 && /Legendary/.test(on.picks[0].title) && /Attack upgrade/.test(on.picks[1].title)
      && on.reveals.length === 1 && on.evolved.length === 1 && on.evolved[0] === on.reveals[0] && on.upgrades.length === 1 && on.ended[0] === 2;
    return ok(pass, { whole, last, ends, lastPicks, pool: [...pool], on });
  },
});

story('types/former-evolutions-stack', {
  about: 'With jelly types on a run can hold several former evolutions: their tricks all work, their costs add up in full (Cinder\'s -20% Range and Moon Jelly\'s -30% make -50%; Lion\'s Mane\'s +60% Health and Mirage\'s -15% make +45%), each adds its piece, and one already taken is never offered again.',
  setup() { fresh({ types: 'normal' }); },
  play() {
    const { run } = G();
    evolveAll('cinder', 'moonJelly', 'lionsMane', 'mirage');
    const S = run.S, M = run.mods;
    const range = Math.abs(S.range - BASE_STATS.range * 0.5) < 1e-9, health = Math.abs(S.health - BASE_STATS.health * 1.45) < 1e-9;
    const tricks = !!M.fireTrail && M.timed.some((t) => t.owner === 'moonJelly') && !!M.decoy && !!M.touch;
    const pieces = ['flaming-feet', 'moon-ring', 'mane', 'mirage-rim'].every((k) => M.adorn.includes(k));
    const full = run.health === S.health;   // each metamorphosis refills Health, as it always has
    const pool = legendaryPool(200);
    const notAgain = !['cinder', 'moonJelly', 'lionsMane', 'mirage'].some((id) => pool.has(id)) && pool.has('immortal');
    return ok(range && health && tricks && pieces && full && notAgain, { range: S.range, health: S.health, tricks, pieces, full, notAgain, evolved: run.evolved });
  },
});

story('types/legendary-not-offered-to-wrong-type', {
  about: 'A Legendary that does nothing for a jelly type\'s attack isn\'t offered to it (not-for=): Rebound Jelly only turns plain bubbles, so only Normal gets it (never Fire, Lightning, Ice, Wind or the Tentacle jelly); Man o\' War only works on shots, so never to the Tentacle jelly; Disco Ball\'s spotlight works for every type. Bubble Bath is offered to every type, and Box Jelly is gone from the game.',
  setup() { fresh({ types: 'tentacle' }); },
  play() {
    const pools = {};
    for (const t of ['tentacle', 'fire', 'lightning', 'ice', 'wind', 'normal']) { fresh({ types: t }); pools[t] = legendaryPool(); }
    fresh();
    const { tentacle, fire, normal } = pools;
    const pass = !['rebound', 'manOWar'].some((id) => tentacle.has(id)) && tentacle.has('bubbleBath') && tentacle.has('discoBall')
      && ['fire', 'lightning', 'ice', 'wind'].every((t) => !pools[t].has('rebound'))
      && fire.has('manOWar') && fire.has('discoBall')
      && ['rebound', 'manOWar', 'discoBall', 'bubbleBath'].every((id) => normal.has(id))
      && Object.values(pools).every((p) => !p.has('boxJelly'));
    return ok(pass, Object.fromEntries(Object.entries(pools).map(([t, p]) => [t, [...p]])));
  },
});

story('types/stacked-adornments-draw', {
  phone: true,
  about: 'On a phone, a Fire jelly holding Immortal Jelly, Lion\'s Mane, Man o\' War and Moon Jelly shows its ember and all four pieces (halo, mane, sail and polyps, moon ring) at once, with no new shader and only a few more draws than the bare jelly.',
  setup() { setupFight({ types: 'fire', bubbles: false, lash: false }); },
  play() {
    const { run, APT, GAME } = G(), info = APT.renderer.info;
    const draws = () => { info.autoReset = false; info.reset(); GAME.render(); const n = info.render.calls; info.autoReset = true; return n; };
    step(2);
    const bare = draws(), programs = info.programs.length;
    evolveAll('immortal', 'lionsMane', 'manOWar', 'moonJelly');
    step(30);
    const stacked = draws();
    const P = run.adorn.pieces, shown = ['ember', 'halo', 'mane', 'sail', 'moon-ring', 'polyps'].filter((k) => P[k]?.group.visible);
    return ok(shown.length === 6 && info.programs.length === programs && stacked - bare <= 30, { shown, bare, stacked, programs, after: info.programs.length });
  },
});

// Lucky Cat (words.js lucky-rolls, chance.js): every "1 in N" chance of yours gets a second try
const randoms = (...values) => { const q = [...values]; stub(Math, 'random', () => (q.length ? q.shift() : 0.9)); };
story('treasures/lucky-rolls', {
  about: 'lucky-rolls (Lucky Cat): a 20% chance that misses on the first roll (0.9) and would hit on a second (0.1) misses without the cat, hits with it, and takes exactly one Math.random() without it.',
  setup() { fresh({ elites: false }); give('nailClipper'); },
  play() {
    const { run } = G();
    let calls = 0; stub(Math, 'random', () => { calls++; return 0.9; });
    const plain = rollChance(0.2, run.mods);
    randoms(0.9, 0.1); const without = rollChance(0.2, run.mods);
    give('luckyCat');
    randoms(0.9, 0.1); const withCat = rollChance(0.2, run.mods);
    randoms(0.9, 0.9); const bothMiss = rollChance(0.2, run.mods);
    return ok(!plain && calls === 1 && !without && withCat && !bothMiss && run.mods.luckyRolls === 2, { plain, calls, without, withCat, bothMiss });
  },
});
story('treasures/lucky-rolls-not-dodge', {
  about: 'lucky-rolls: Dodge is rolled once, even with the cat: a hit that misses the Dodge roll (0.9) is not dodged though a second roll (0.1) would have dodged it.',
  setup() { fresh({ elites: false }); give('luckyCat'); G().run.stats.dodge = 20; },
  play() {
    const { run } = G(), dodged = [];
    stub(run.fx, 'number', (pos, text) => { if (text === 'DODGE') dodged.push(text); });
    randoms(0.9, 0.1);
    run.hit(1);
    return ok(!dodged.length && run.iFrames === 1, { dodged: dodged.length, iFrames: run.iFrames });
  },
});
story('treasures/lucky-rolls-offer', {
  about: 'needs-chance: Lucky Cat is not offered to a run with no chance effect, and is once it owns Nail Clipper.',
  setup() { fresh({ elites: false }); },
  play() {
    const without = legendaryPool(200).has('luckyCat');
    give('nailClipper');
    const withClipper = legendaryPool(200).has('luckyCat');
    return ok(!without && withClipper, { without, withClipper });
  },
});
story('treasures/lucky-rolls-paw', {
  about: 'lucky-rolls: a second roll that hits shows a paw over the jelly, at most twice a second; a first-roll hit shows none.',
  setup() { fresh({ elites: false }); give('nailClipper', 'luckyCat'); },
  play() {
    const { run } = G(), paws = [];
    stub(run.fx, 'number', (pos, text) => { if (text === '🐾') paws.push(text); });
    randoms(0.1); rollChance(0.2, run.mods); const first = paws.length;
    randoms(0.9, 0.1, 0.9, 0.1); rollChance(0.2, run.mods); rollChance(0.2, run.mods); const quick = paws.length;
    step(40); randoms(0.9, 0.1); rollChance(0.2, run.mods);
    return ok(first === 0 && quick === 1 && paws.length === 2, { first, quick, later: paws.length });
  },
});

// the chests an Elite just left, then cleared away so the next count is fresh
function chestsAfterElite(i) {
  const { run } = G();
  for (const t of run.roomTreasures) t.hide();
  bus.emit('elite_defeated', { elite: run.elites.list[i % run.elites.list.length] });
  return run.roomTreasures.filter((t) => t.active).length;
}

story('treasures/elite-bonus', {
  about: 'elite-bonus (Goodie Bag): with it, the 1st Elite beaten leaves one treasure and the 2nd leaves two, the 3rd one, the 4th two; without it every Elite leaves one. The count runs from when it is taken.',
  setup() { fresh({ treasures: true }); },
  play() {
    const { run } = G();
    if (!run.elites.list.length) return ok(false, "no elites");
    const without = chestsAfterElite(0);
    give('goodieBag');
    const got = [chestsAfterElite(1), chestsAfterElite(2), chestsAfterElite(3), chestsAfterElite(4)];
    return ok(without === 1 && got.join() === '1,2,1,2', { without, got });
  },
});

story('treasures/elite-bonus-carries-across-acts', {
  about: 'The Goodie Bag\'s count rides along into the next act: one Elite in act 1, then the first Elite of act 2 is the second.',
  setup() { fresh({ treasures: true }); },
  play() {
    const { run } = G();
    give('goodieBag');
    const first = chestsAfterElite(0);
    const carried = JSON.parse(JSON.stringify(run.carryOver())).growCount.goodieBag;
    return ok(first === 1 && carried === 1, { first, carried });
  },
});
