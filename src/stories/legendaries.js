// Stories: one Legendary pool (docs/jelly-types/spec-legendaries.md, phase P9). With jelly types on
// there is no separate evolution pick: the evolutions are Legendary treasures in the Boss reward's
// pick, a run can hold several, and their costs add up. Shared helpers are in ./kit.js.
import { CONTENT } from '../content.js';
import { BASE_STATS } from '../stats.js';
import { G, fresh, ok, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const OLD_LEGENDARIES = ['dice', 'notebook', 'handMirror', 'snooze', 'discoBall', 'bubbleBath', 'hotWaterBottle', 'toyMouse', 'potLid'];
const EVOLUTION_IDS = () => CONTENT.evolutions.map((e) => e.id);

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
  about: 'With jelly types on, an act\'s boss gives one Legendary pick from the pool of 19 (the 9 Legendary treasures and the 10 former evolutions; no Element or Power Bank), then the Attack upgrade pick, then the act ends; after the last act\'s boss there is no pick, just the win. Picking a former evolution plays the metamorphosis. With the switch off it is still the evolution pick, then the Legendary pick.',
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
    const all19 = want.length === 19 && pool.size === 19 && want.every((id) => pool.has(id));
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
    const off = once(false);
    fresh();
    const pass = last && all19 && on.picks.length === 2 && /Legendary/.test(on.picks[0].title) && /Attack upgrade/.test(on.picks[1].title)
      && on.reveals.length === 1 && on.evolved.length === 1 && on.evolved[0] === on.reveals[0] && on.upgrades.length === 1 && on.ended[0] === 2
      && off.picks.length === 2 && /Metamorphosis/.test(off.picks[0].title) && /Legendary/.test(off.picks[1].title) && off.evolved.length === 1 && !off.upgrades.length && off.ended[0] === 2;
    return ok(pass, { all19, last, ends, lastPicks, pool: [...pool], on, off });
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
  about: 'A Legendary that does nothing for a jelly type\'s attack isn\'t offered to it (not-for=): Rebound Jelly, Man o\' War and Disco Ball only work on shots, so never to the Tentacle jelly; Rebound only turns plain bubbles, so never to Fire either. Box Jelly and Bubble Bath are offered to every type.',
  setup() { fresh({ types: 'tentacle' }); },
  play() {
    const tentacle = legendaryPool();
    fresh({ types: 'fire' });
    const fire = legendaryPool();
    fresh({ types: 'normal' });
    const normal = legendaryPool();
    fresh();
    const pass = !['rebound', 'manOWar', 'discoBall'].some((id) => tentacle.has(id)) && tentacle.has('boxJelly') && tentacle.has('bubbleBath')
      && !fire.has('rebound') && fire.has('manOWar') && fire.has('discoBall') && fire.has('boxJelly')
      && ['rebound', 'manOWar', 'discoBall', 'boxJelly', 'bubbleBath'].every((id) => normal.has(id));
    return ok(pass, { tentacle: [...tentacle], fire: [...fire], normal: [...normal] });
  },
});

story('treasures/tentacle-weapon', {
  about: 'tentacle-weapon (Box Jelly): with jelly types on, a Fire jelly\'s tentacles lash too, a second close-range attack beside its Fire shot (4 tentacles at twice the reach, stacking venom); for the Tentacle jelly the 3 extra tentacles add to its Attacks (3 + 3 = 6) with +100% Tentacle reach (a percent of Normal\'s 8.3 cm, so 11 + 8.3 cm). Without it, a Fire jelly never lashes.',
  setup() { setupFight({ types: 'fire' }); },
  play() {
    const { run } = G();
    roachAt(0.12, 0);
    const before = spy(run.lash, 'strike');
    step(60 * 2);
    const noLash = !before.length;
    evolveAll('boxJelly');
    const strikes = spy(run.lash, 'strike');
    step(60 * 3);
    const T = run.tentacleStats, venom = run.lash.venom.size, fireLash = strikes.length > 0 && T.tentacles === 4 && Math.abs(T.reach - BASE_STATS.reach * 2) < 1e-9 && venom > 0;
    setupFight({ types: 'tentacle' });
    const base = run.tentacleStats.tentacles;
    evolveAll('boxJelly');
    const U = run.tentacleStats, tentacle = base === 3 && U.tentacles === 6 && Math.abs(U.reach - (0.11 + BASE_STATS.reach)) < 1e-9;
    fresh();
    return ok(noLash && fireLash && tentacle, { noLash, strikes: strikes.length, venom, T, base, U });
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
