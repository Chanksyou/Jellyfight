// Stories: one Legendary pool (docs/jelly-types/spec-legendaries.md, phase P9). With jelly types on
// there is no separate evolution pick: the evolutions are Legendary treasures in the Boss reward's
// pick, a run can hold several, and their costs add up. Shared helpers are in ./kit.js.
import { bus } from '../events.js';
import { CONTENT } from '../content.js';
import { BASE_STATS } from '../stats.js';
import { CONTROLLER_AT, G, dmgBy, fresh, give, near, ok, phone, record, roachAt, setupFight, spawn, spy, step, story, stub, tp } from './kit.js';

const OLD_LEGENDARIES = ['dice', 'notebook', 'handMirror', 'snooze', 'discoBall', 'bubbleBath', 'hotWaterBottle', 'toyMouse', 'potLid', 'bloodyFangs', 'goodieBag', 'pogoStick'];
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
  about: 'stomp (Pogo Stick): falling onto a bug stomps it for 4x Attack damage: it is Stunned and squashed flat, and the jelly bounces back up at jump speed with a moment it can\'t be hurt. Without the Pogo Stick the jelly just falls past it.',
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
    return ok(without === 0 && k === 4 && rising > 0.6 && up && squashed && stunned && safe > 0.25 && safe <= 0.3, { without, k, rising, up, squashed, stunned, safe });
  },
});

story('treasures/stomp-chain', {
  about: 'stomp: each stomp in a row before the jelly touches the ground hits 1x harder, 4x, 5x, 6x, 7x then 8x and no more; landing on the floor starts the count again at 4x. A mid-air jump spent before a stomp comes back with the bounce.',
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
    return ok(ks.join() === '4,5,6,7,8,8' && jumpsBack && landed && again === 4, { ks, jumpsBack, landed, again });
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
    return ok(k === 4 && hit && player.velocity.y > 0.6, { k, hit, vy: player.velocity.y });
  },
});

story('treasures/stomp-elite', {
  about: 'stomp: an Elite can be stomped (4x Attack damage, and the jelly bounces), but it is not Stunned and gives no moment of safety.',
  setup() { fresh({ bubbles: false, lash: false }); give('pogoStick'); },
  play() {
    const { run, player, enemies } = G(), log = record('damage_taken');
    tp(CONTROLLER_AT[0], CONTROLLER_AT[1] + 0.05, CONTROLLER_AT[2], 0);
    const E = run.elites.list.find((x) => x.kind === 'controller'), e = E.entry, c = enemies.center(e);
    player.position.set(c.x, c.y + e.r + 0.1, c.z); player.peakY = player.position.y; player.grounded = false; player.velocity.set(0, 0, 0);
    const k = nextStomp(log), hit = dmgBy(log, 'stomp')[0]?.targetId === e.id;
    return ok(k === 4 && hit && run.iFrames === 0 && !(e.stunT > 0) && player.velocity.y > 0.6, { k, hit, safe: run.iFrames, vy: player.velocity.y });
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
    return ok(k === 4 && vy > 0.6, { k, vy });
  },
});
