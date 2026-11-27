// Stories: one Legendary pool (docs/jelly-types/spec-legendaries.md, phase P9). With jelly types on
// there is no separate evolution pick: the evolutions are Legendary treasures in the Boss reward's
// pick, a run can hold several, and their costs add up. Shared helpers are in ./kit.js.
import { bus } from '../events.js';
import { CONTENT, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { rollChance } from '../chance.js';
import { CONTROLLER_AT, G, dmgBy, fresh, give, near, ok, phone, record, roachAt, setupFight, spawn, spy, step, story, stub, tp, V } from './kit.js';

const OLD_LEGENDARIES = ['dice', 'notebook', 'handMirror', 'snooze', 'discoBall', 'bubbleBath', 'hotWaterBottle', 'toyMouse', 'potLid', 'bloodyFangs',
  'goodieBag', 'newtonsCradle', 'pogoStick', 'racket'];   // (the new Legendaries join here)
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
    return ok(!dodged.length && run.iFrames === 0.25, { dodged: dodged.length, iFrames: run.iFrames });
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

// --- Newton's Cradle (overkill): the leftover of a killing hit passes to the nearest bug in 12 cm
const own = (on) => { const { run } = G(); run.enemies.passes.length = 0; run.owned[on ? 'add' : 'delete']('newtonsCradle'); run.enemies.mods = run.mods; };
const cradle = () => own(true);
const hitFor = (e, amount, feedback) => bus.emit('damage_taken', { targetId: e.id, amount, source: 'bubble', feedback });
const tinyAt = (dx, dz, hp) => roachAt(dx, dz, { still: true, hp });
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };

story('treasures/overkill', {
  about: 'overkill (Newton\'s Cradle): a 20 hit on a 5 Health bug takes the 15 left over off a bug 10 cm away; a bug 15 cm away is left alone; without the treasure nothing passes.',
  setup() { setupFight({ bubbles: false, lash: false }); step(2); },   // a frame first: Enemies.now is the last run's clock until it updates
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
  setup() { setupFight({ bubbles: false, lash: false }); step(2); },   // a frame first: Enemies.now is the last run's clock until it updates
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
  setup() { setupFight({ bubbles: false, lash: false }); step(2); },   // a frame first: Enemies.now is the last run's clock until it updates
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

// --- stomp (Pogo Stick)
// the jelly hanging `up` m over where it stands, about to fall
function hang(up) { const P = G().player; P.position.y += up; P.peakY = P.position.y; P.grounded = false; P.velocity.set(0, 0, 0); }
// step until the next stomp lands (at most `n` frames): that hit's times Attack damage, or 0 if none
function nextStomp(log, n = 150) {
  const { run } = G(), was = dmgBy(log, 'stomp').length;
  let power = run.power;
  step(n, () => { if (dmgBy(log, 'stomp').length > was) return true; power = run.power; });
  const d = dmgBy(log, 'stomp')[was];
  return d ? +(d.amount / power).toFixed(3) : 0;
}

story('treasures/stomp', {
  about: 'stomp (Pogo Stick): falling onto a bug stomps it for 1x Attack damage: it is Stunned and squashed flat, and the jelly bounces back up at jump speed with a moment it can\'t be hurt. Without the Pogo Stick the jelly just falls past it.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, player } = G(), log = record('damage_taken');
    const bug = roachAt(0, 0);
    hang(0.15);
    const without = nextStomp(log, 60);
    tp(3.2, 0.05, 3.0, 0); give('pogoStick'); hang(0.15);
    const k = nextStomp(log), rising = player.velocity.y, safe = run.iFrames, squashed = bug.squashT > 0, stunned = bug.stunT > 0.9;
    step(10);
    const up = !player.grounded && player.position.y > bug.pos.y + bug.r * 2;
    return ok(without === 0 && k === 1 && rising > 0.6 && up && squashed && stunned && safe > 0.25 && safe <= 0.3, { without, k, rising, up, squashed, stunned, safe });
  },
});

story('treasures/stomp-chain', {
  about: 'stomp: each stomp in a row before the jelly touches the ground hits harder, 1x, 2x, 3x, then 4x and no more; landing on the floor starts the count again at 1x. A mid-air jump spent before a stomp comes back with the bounce.',
  setup() { setupFight({ bubbles: false, lash: false }); give('pogoStick', 'penSpring'); },
  play() {
    const { player } = G(), log = record('damage_taken'), bug = roachAt(0, 0);
    hang(0.15);
    const ks = [];
    for (let i = 0; i < 6; i++) { player.airJumps = 0; ks.push(nextStomp(log)); }
    const jumpsBack = player.airJumps > 0;
    bug.pos.x += 0.5;                                    // out of the way: the jelly lands
    step(150, () => player.grounded);
    const landed = player.grounded;
    bug.pos.x -= 0.5; hang(0.15);
    const again = nextStomp(log);
    return ok(ks.join() === '1,2,3,4,4,4' && jumpsBack && landed && again === 1, { ks, jumpsBack, landed, again });
  },
});

story('treasures/stomp-only-from-above', {
  about: 'stomp: swimming into a bug is never a stomp, and neither is dropping less than 3 cm onto one.',
  setup() { setupFight({ bubbles: false, lash: false }); give('pogoStick'); },
  play() {
    const { input } = G(), log = record('damage_taken'), bug = roachAt(0, -0.15);
    input.keys = new Set(['KeyW']);                     // swim straight at it (and through it)
    step(90);
    input.keys = new Set();
    const swum = dmgBy(log, 'stomp').length;
    tp(3.2, 0.05, 3.0, 0); bug.pos.copy(near(0, 0));
    hang(bug.r * 2 + 0.02);                              // 2 cm over its back
    const small = nextStomp(log, 60);
    return ok(swum === 0 && small === 0, { swum, small });
  },
});

story('treasures/stomp-flyer', {
  about: 'stomp: a bug flying in mid-air can be stomped too (a mosquito 12 cm up).',
  setup() { setupFight({ bubbles: false, lash: false }); give('pogoStick'); },
  play() {
    const { player } = G(), log = record('damage_taken');
    const fly = spawn('mosquito', near(0, 0, 0.12), { still: true, hp: 9999 });
    hang(0.3);
    const k = nextStomp(log), hit = dmgBy(log, 'stomp')[0]?.targetId === fly.id;
    return ok(k === 1 && hit && player.velocity.y > 0.6, { k, hit, vy: player.velocity.y });
  },
});

story('treasures/stomp-elite', {
  about: 'stomp: an Elite can be stomped (1x Attack damage, and the jelly bounces), but it is not Stunned and gives no moment of safety.',
  setup() { fresh({ bubbles: false, lash: false }); give('pogoStick'); },
  play() {
    const { run, player, enemies } = G(), log = record('damage_taken');
    tp(CONTROLLER_AT[0], CONTROLLER_AT[1] + 0.05, CONTROLLER_AT[2], 0);
    const E = run.elites.list.find((x) => x.kind === 'controller'), e = E.entry, c = enemies.center(e);
    player.position.set(c.x, c.y + e.r + 0.1, c.z); player.peakY = player.position.y; player.grounded = false; player.velocity.set(0, 0, 0);
    const k = nextStomp(log), hit = dmgBy(log, 'stomp')[0]?.targetId === e.id;
    return ok(k === 1 && hit && run.iFrames === 0 && !(e.stunT > 0) && player.velocity.y > 0.6, { k, hit, safe: run.iFrames, vy: player.velocity.y });
  },
});

story('treasures/stomp-boss', {
  about: 'stomp: the boss can be stomped from a plain jump (1x Attack damage, and the jelly bounces), but it is never Stunned.',
  setup() { fresh({ bubbles: false, lash: false }); give('pogoStick'); G().run.startBossIntro(); },
  play() {
    const { run, player, enemies } = G(), log = record('damage_taken');
    step(180);
    const B = run.boss, e = enemies.list.find((x) => x.proxy === B);
    B.rise = 1; B.state = 'chase'; B.stateT = 99;
    const c = enemies.center(e);
    player.position.set(c.x, B.holder.position.y + run.cfg.jumpHeight, c.z);   // the peak of a plain jump from the floor player.peakY = player.position.y; player.grounded = false; player.velocity.set(0, 0, 0);
    const k = nextStomp(log), hit = dmgBy(log, 'stomp')[0]?.targetId === e.id;
    return ok(k === 1 && hit && !(e.stunT > 0) && player.velocity.y > 0.6, { k, hit, stun: e.stunT, vy: player.velocity.y, phase: run.phase });
  },
});

story('treasures/stomp-is-not-a-landing', {
  about: 'stomp: a bounce off a bug is not a landing, so Cotton Ball\'s shockwave stays quiet until the jelly really lands.',
  setup() { setupFight({ bubbles: false, lash: false }); give('pogoStick', 'cottonBall'); },
  play() {
    const { player } = G(), log = record('damage_taken'), bug = roachAt(0, 0);
    hang(0.15);
    nextStomp(log); nextStomp(log);
    const bounced = dmgBy(log, 'shockwave').length;
    bug.pos.x += 0.12;                                   // past a stomp's reach, still in the ring's
    step(150, () => player.grounded);
    const landed = dmgBy(log, 'shockwave').length;
    return ok(dmgBy(log, 'stomp').length === 2 && bounced === 0 && landed > 0, { stomps: dmgBy(log, 'stomp').length, bounced, landed });
  },
});

phone('stomp-with-touch', {
  about: 'stomp on a phone: holding the on-screen jump button by a bug jumps, comes down on its back and stomps it, then the bounce carries on with the button still held.',
  setup() { setupFight({ bubbles: false, lash: false }); give('pogoStick'); },
  play() {
    const { touch, player } = G(), log = record('damage_taken'), btn = touch.jumpBtn, capture = btn.setPointerCapture;
    roachAt(0, -0.07);
    btn.setPointerCapture = () => {};
    btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, bubbles: true }));
    const k = nextStomp(log), vy = player.velocity.y;
    btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true }));
    btn.setPointerCapture = capture;
    return ok(k === 1 && vy > 0.6, { k, vy });
  },
});

// --- swat (Badminton Racket)
// an Ant standing 40 cm off with a pin thrown at the jelly: [ant, the pin 10 frames on, in flight]
function pinFromAnt(hp = 9999) {
  const { enemies } = G(), ant = spawn('ants', near(0.4, 0), { still: true, hp });
  enemies.spit(ant, near(0, 0, 0.05), { speed: 0.8, life: 2, dmg: 2, shot: 'pin', height: 0 });
  const pin = enemies.shots.at(-1);
  step(10);
  return [ant, pin];
}
// a bubble of the jelly's, in flight, sitting on `at` (the bubbles are stepped by hand here: bubbles: false stops their update)
function bubbleOn(at) {
  const { run } = G(), b = run.bubbles.blow(at.clone(), null, { dir: V(0, 1, 0), size: 1, dmg: 0, pierce: 1, straight: true });
  run.bubbles.fly(1 / 60, run.S, run.mods);
  return b;
}

story('treasures/swat', {
  about: 'swat (Badminton Racket): a bubble in flight that meets an Ant\'s pushpin knocks it back at the Ant, which flies back faster and hits for 3x Attack damage as a plain hit; the bubble flies on. Without the Racket the bubble ignores the pin.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, enemies } = G(), log = record('damage_taken');
    const [ant, pin] = pinFromAnt();
    const speed = pin.v.length();
    bubbleOn(pin.m.position);
    const without = pin.back !== null;
    give('racket');
    step(1);
    const b = bubbleOn(pin.m.position);
    const turned = pin.back === ant.id, faster = pin.v.length() > speed * 1.4, harmless = pin.dmg === 0, bubbleLives = !b.done;
    step(60, () => dmgBy(log, 'swat').length > 0);
    const hit = dmgBy(log, 'swat')[0];
    return ok(!without && turned && faster && harmless && bubbleLives && hit?.targetId === ant.id && Math.abs(hit.amount / run.power - 3) < 1e-6 && !enemies.shots.includes(pin),
      { without, turned, faster, harmless, bubbleLives, hit: hit && +(hit.amount / run.power).toFixed(3) });
  },
});

story('treasures/swat-never-hurts-you', {
  about: 'swat: a swatted Shot passing straight through the jelly does nothing to it.',
  setup() { setupFight({ bubbles: false, lash: false }); give('racket'); step(1); },
  play() {
    const { player } = G(), log = record('damage_taken');
    const [, pin] = pinFromAnt();
    bubbleOn(pin.m.position);
    pin.m.position.copy(player.position).setY(player.position.y + 0.03);   // right in the jelly
    step(30);
    const hurt = log.some((d) => d.targetId !== undefined && d.source === 'pin' && d.amount > 0);
    return ok(pin.back !== null && !hurt, { swatted: pin.back !== null, hurt });
  },
});

story('treasures/swat-lash', {
  about: 'swat: a tentacle lash swats one Shot inside its reach, not every one.',
  setup() { setupFight({ bubbles: false, lash: false }); give('racket'); step(1); },
  play() {
    const { run, enemies } = G();
    const [, a] = pinFromAnt(), [, b] = pinFromAnt();
    roachAt(0.05, 0);                                     // something in reach to lash at
    for (const s of [a, b]) s.m.position.copy(near(0.02, 0.01, 0.05));
    run.lash.fire(near(0, 0, 0.06), run.tentacleStats, run.mods.hits.tentacles, { mods: run.mods });
    const swatted = [a, b].filter((s) => s.back !== null).length;
    return ok(swatted === 1 && enemies.shots.length === 2, { swatted });
  },
});

story('treasures/swat-ignores-stuck-pins', {
  about: 'swat: a pin stuck in the scenery is left alone.',
  setup() { setupFight({ bubbles: false, lash: false }); give('racket'); step(1); },
  play() {
    const { enemies } = G(), ant = spawn('ants', near(0.4, 0), { still: true });
    enemies.spit(ant, near(0, 0, -0.2), { speed: 0.8, life: 1, dmg: 2, shot: 'pin', height: -0.4 });
    const pin = enemies.shots.at(-1);
    step(60 * 2, () => pin.stuckT > 0);
    bubbleOn(pin.m.position);
    return ok(pin.stuckT > 0 && pin.back === null, { stuck: pin.stuckT > 0, back: pin.back });
  },
});

story('treasures/swat-owner-gone', {
  about: 'swat: if the bug that fired the Shot is gone, it flies at the nearest bug within 30 cm instead, and pops if there is none.',
  setup() { setupFight({ bubbles: false, lash: false }); give('racket'); step(1); },
  play() {
    const { enemies } = G();
    const [ant, pin] = pinFromAnt(1);
    enemies.byId.delete(ant.id); ant.dead = true;         // (gone)
    const P = G().player.position, other = roachAt(pin.m.position.x - P.x + 0.1, pin.m.position.z - P.z);   // 10 cm from the pin
    bubbleOn(pin.m.position);
    const spared = pin.back === other.id;
    other.dead = true; enemies.byId.delete(other.id);
    const [ant2, pin2] = pinFromAnt(1);
    enemies.byId.delete(ant2.id); ant2.dead = true;
    bubbleOn(pin2.m.position);
    step(2);
    const gone = !enemies.shots.includes(pin2) && !pin2.m.parent;   // let go of: out of the scene, pool entry freed
    return ok(spared && pin2.back === null && pin2.done && gone, { spared, popped: pin2.done, gone });
  },
});

story('treasures/swat-burst', {
  about: 'swat: a Poison burst covering a Shot swats it too.',
  setup() { setupFight({ bubbles: false, lash: false }); give('racket'); step(1); },
  play() {
    const { run } = G();
    const [, pin] = pinFromAnt();
    run.bubbles.poisonBurst({ m: { position: pin.m.position.clone() }, r: 0.012, pw: 1, ep: null });
    return ok(pin.back !== null, { back: pin.back });
  },
});
