// Stories: one Legendary pool (docs/jelly-types/spec-legendaries.md, phase P9). With jelly types on
// there is no separate evolution pick: the evolutions are Legendary treasures in the Boss reward's
// pick, a run can hold several, and their costs add up. Shared helpers are in ./kit.js.
import { bus } from '../events.js';
import { CONTENT, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { G, fresh, ok, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const OLD_LEGENDARIES = ['dice', 'notebook', 'handMirror', 'snooze', 'discoBall', 'bubbleBath', 'hotWaterBottle', 'toyMouse', 'potLid', 'bloodyFangs',
  'newtonsCradle'];   // (the new Legendaries join here)
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
  about: 'An act\'s boss gives one Legendary pick from the Legendary pool (the Legendary treasures and the 10 former evolutions; no Element or Power Bank), then the Attack upgrade pick, then the act ends; after the last act\'s boss there is no pick, just the win. Picking a former evolution plays the metamorphosis.',
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

// --- Newton's Cradle (overkill): the leftover of a killing hit passes to the nearest bug in 12 cm
const own = (on) => { const { run } = G(); run.enemies.passes.length = 0; run.owned[on ? 'add' : 'delete']('newtonsCradle'); run.enemies.mods = run.mods; };
const cradle = () => own(true);
const hitFor = (e, amount, feedback) => bus.emit('damage_taken', { targetId: e.id, amount, source: 'bubble', feedback });
const tinyAt = (dx, dz, hp) => roachAt(dx, dz, { still: true, hp });
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };

story('treasures/overkill', {
  about: 'overkill (Newton\'s Cradle): a 20 hit on a 5 Health bug takes the 15 left over off a bug 10 cm away; a bug 15 cm away is left alone; without the treasure nothing passes.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G();
    const trial = (d, owned) => {
      enemies.clear(); own(owned);
      const a = tinyAt(0, 0, 5), b = tinyAt(d, 0, 100);
      hitFor(a, 20); step(10);
      return b.hp;
    };
    const near = trial(0.10, true), far = trial(0.15, true), without = trial(0.10, false);
    const bad = mistake('overkill passes=0');
    return ok(Math.abs(near - 85) < 1e-6 && far === 100 && without === 100 && /overkill: reach and least/.test(bad), { near, far, without, bad });
  },
});

story('treasures/overkill-three-passes', {
  about: 'overkill stops after 3 passes from one original hit: a row of five 1-Health bugs 10 cm apart, hit once for plenty, loses the first four (the hit and 3 passes) and the fifth stays.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G(); cradle();
    const row = [0, 1, 2, 3, 4].map((i) => tinyAt(i * 0.1, 0, 1));
    hitFor(row[0], 50); step(60);
    const dead = row.map((e) => e.dead);
    return ok(dead.slice(0, 4).every(Boolean) && !dead[4], { dead });
  },
});

story('treasures/overkill-plain-hits-only', {
  about: 'overkill ignores Burn/Poison/Bleed ticks and anything under 1 left over; a passed hit never crits and does not itself add on-hit effects.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G(); cradle();
    const a = tinyAt(0, 0, 5), b = tinyAt(0.1, 0, 100);
    hitFor(a, 20, { tick: true }); step(10);
    const tick = b.hp;
    const c = tinyAt(0.3, 0, 5), d = tinyAt(0.4, 0, 100);
    hitFor(c, 5.5); step(10);
    const small = d.hp;
    const e = tinyAt(0.6, 0, 5), f = tinyAt(0.7, 0, 100);
    const log = []; const off = bus.on('enemy_hit', (h) => log.push(h));
    hitFor(e, 20); step(10); off();
    const passed = log.find((h) => h.targetId === f.id);
    return ok(tick === 100 && small === 100 && passed && passed.amount === 15 && !passed.feedback?.crit, { tick, small, passed: passed && passed.amount });
  },
});
