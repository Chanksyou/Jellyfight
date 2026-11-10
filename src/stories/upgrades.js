// Stories: Attack upgrades (content/upgrades.kdl, docs/jelly-types phase P6): the end-of-act pick,
// chests with jelly types on, saves, and the words Fire's pool brought (burn-ramp, refresh-all,
// streak, cone, and new props on element-up, status-damage, on-kill-of and per).
import { bus, PLAYER } from '../events.js';
import { CONTENT, compileMods, compileTreasures, compileUpgrades } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { elementParams } from '../words.js';
import { jellyStats } from '../jelly-types.js';
import { SAVE_KEY, carried, keepRun } from '../stages.js';
import { G, dmgBy, fresh, give, offs, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

// the run's combined effects become what it owns plus these words (until the story ends)
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p6" name="P6" icon="x" text="x" {\n${src}\n}`, 'p6.kdl'), 'p6.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || []);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
const fire = (o = {}) => ({ ...elementParams('fire'), ...o });
// Burn ticks on each bug over n frames: target id -> [amounts]
function burns(frames) {
  const log = record('damage_taken');
  step(frames);
  const by = {};
  for (const d of log) if (d.source === 'fire') (by[d.targetId] ||= []).push(d.amount);
  return by;
}
const TENTACLE_POOL = ['stingingNettle', 'tapeMeasureReel', 'spaghettiSweep', 'toasterCord', 'chopstickRush', 'paperclipHop', 'whipCrack', 'anchor', 'inkCloud', 'venomSac', 'coil', 'bellPulse'];
const FIRE_POOL = ['flashpoint', 'slowBurn', 'fireBreath', 'wildfire', 'hotHead', 'stoke', 'inferno', 'backdraft', 'fuel', 'blueFlame', 'flareUp', 'melt'];

// ------------------------------------------------------------------ the pick, chests, saves
story('types/end-of-act-offers-attack-upgrades', {
  about: 'A Fire run with jelly types on: after act 1\'s boss, the evolution and the Legendary pick as before, then a pick of 3 Fire Attack upgrades, then the act ends. With the switch off there is no third pick.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const once = () => {
      const { run } = G(), picks = [], ended = [];
      stub(run.evolutionReveal, 'begin', (evo, before, done) => done());
      stub(run, 'actComplete', (next) => ended.push(next.id));
      stub(run.ui, 'choose', (title, sub, choices, onPick) => { picks.push({ title, ids: choices.map((c) => c.id) }); onPick(choices[0]); });
      run.dev = true; run.bossWon = true;
      run.metamorph();
      return { picks, ended, upgrades: [...run.upgrades] };
    };
    const on = once();
    fresh();
    const off = once();
    fresh();
    const up = on.picks[2], pool = new Set(FIRE_POOL);
    const pass = on.picks.length === 3 && /Attack upgrade/.test(up.title) && up.ids.length === 3 && up.ids.every((id) => pool.has(id))
      && on.upgrades.length === 1 && on.upgrades[0] === up.ids[0] && on.ended[0] === 2
      && off.picks.length === 2 && !off.upgrades.length && off.ended[0] === 2;
    return ok(pass, { on, off });
  },
});

story('types/attack-upgrade-is-never-in-a-chest', {
  about: 'With jelly types on, no chest or Legendary pick ever offers an Attack upgrade, an Element, an Element upgrade, Power Bank or the six old tentacle Treasures; the upgrade pick offers each upgrade once and Inferno only after Slow Burn. With the switch off the tentacle Treasures still turn up.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const { run } = G();
    const seen = () => {
      const ids = new Set();
      stub(run, 'offer', (title, sub, list) => { for (const t of list) ids.add(t.id); });
      for (let i = 0; i < 400; i++) { run.pickTreasure('x', 'x', i % 2 ? 'room' : 'elite'); if (i % 4 === 0) run.pickLegendary('x', 'x'); }
      return ids;
    };
    const on = seen(), byId = Object.fromEntries(CONTENT.treasures.map((t) => [t.id, t]));
    const upgradeIds = new Set(CONTENT.upgrades.map((u) => u.id));
    const bad = [...on].filter((id) => upgradeIds.has(id) || byId[id].retired || byId[id].vocabulary.includes('element') || byId[id].vocabulary.includes('element-up'));
    // the upgrade pick itself: never one already taken, Inferno only after Slow Burn
    const offered = [];
    stub(run.ui, 'choose', (title, sub, choices) => offered.push(choices.map((c) => c.id)));
    run.upgrades = FIRE_POOL.filter((id) => id !== 'inferno' && id !== 'melt' && id !== 'slowBurn');
    for (let i = 0; i < 20; i++) run.pickUpgrade({ id: 2 }, () => {});
    const noInferno = offered.every((l) => l.length === 2 && l.includes('melt') && l.includes('slowBurn'));
    run.upgrades.push('slowBurn'); offered.length = 0;
    run.pickUpgrade({ id: 2 }, () => {});
    const inferno = offered[0]?.length === 2 && offered[0].includes('inferno');
    fresh();
    const off = seen();
    const oldStill = off.has('spaghetti') && off.has('nettle');
    fresh();
    return ok(!bad.length && on.size > 20 && noInferno && inferno && oldStill, { bad, offeredOn: on.size, noInferno, inferno, oldStill });
  },
});

story('types/third-chest-is-ordinary', {
  about: 'With jelly types on, every 3rd chest is an ordinary pick of three, even owning the Birthday Candle (still counted: Spare Change reads it); with the switch off every 3rd chest offers an Element upgrade.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const ups = () => {
      const { run } = G(), lists = [];
      give('candle');
      stub(run, 'offer', (title, sub, list) => lists.push(list));
      for (let i = 0; i < 30; i++) run.pickTreasure();
      return { thirds: lists.filter((_, i) => i % 3 === 2).map((l) => l.filter((t) => t.needs === 'candle').length), opened: run.chestsOpened };
    };
    const on = ups();
    fresh();
    const off = ups();
    fresh();
    return ok(on.thirds.every((n) => n === 0) && on.opened === 30 && off.thirds.every((n) => n === 1), { on, off });
  },
});

story('types/upgrades-survive-reload', {
  act: 2,
  about: 'Attack upgrades taken are carried into the next act and through a reload part way through an act, and keep working (Slow Burn: 3 Burns on one bug); the run log lists them.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const { run } = G(), was = sessionStorage.getItem('jellyrun.act'), wasCarry = run.carry, kept = localStorage.getItem(SAVE_KEY);
    stub(run, 'later', () => {});
    try {
      run.jelly = 'fire'; run.stats = jellyStats('fire'); run.upgrades = ['slowBurn', 'stoke'];
      const start = { ...run.carryOver(), logId: 'upgrades-reload-story' };
      sessionStorage.setItem('jellyrun.act', JSON.stringify({ act: 2, carry: start, then: null }));
      keepRun(2, start);
      run.carry = start; run.resumed = false;
      run.start();
      const carriedOn = run.upgrades.join() === 'slowBurn,stoke';
      run.t = 90; run.dev = false;
      run.keepProgress();
      run.carry = carried(); run.resumed = false;
      run.start();
      const back = run.upgrades.join() === 'slowBurn,stoke' && run.t === 90 && run.mods.element.fire?.burnStacks === 3 && !!run.mods.burnRamp;
      const rows = [];
      Object.assign(run, { dev: false, logStarted: true, telemetryDisabled: false, board: { runLog: true, saveRun: (r) => rows.push(r) } });
      run.recordRun('in-progress');
      const logged = rows[0]?.details?.upgrades?.join() === 'slowBurn,stoke';
      return ok(carriedOn && back && logged, { carriedOn, back, logged, upgrades: run.upgrades });
    } finally {
      run.carry = wasCarry; run.resumed = false;
      if (was === null) sessionStorage.removeItem('jellyrun.act'); else sessionStorage.setItem('jellyrun.act', was);
      if (kept === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, kept);
      fresh();
    }
  },
});

story('content/upgrades-load', {
  about: 'content/upgrades.kdl gives Fire its 12 Attack upgrades, each one of a kind; an upgrade with a stack=, an unknown jelly or a needs= of another jelly is a mistake naming the file.',
  setup() {},
  play() {
    const fireIds = CONTENT.upgrades.filter((u) => u.jelly === 'fire').map((u) => u.id);
    const all = FIRE_POOL.every((id) => fireIds.includes(id)) && fireIds.length === 12 && CONTENT.upgrades.every((u) => u.stack === 1 && u.upgrade);
    const tryIt = (src) => { try { compileUpgrades(parse(src, 'u.kdl'), CONTENT.jellies, 'u.kdl'); return null; } catch (e) { return e.message; } };
    const a = 'upgrade "a" jelly="fire" name="A" icon="x" text="x" {\n    stat luck 1\n}\n';
    const bad = [tryIt('upgrade "b" jelly="laser" name="B" icon="x" text="x" {\n    stat luck 1\n}'), tryIt('upgrade "b" jelly="fire" name="B" icon="x" text="x" stack=2 {\n    stat luck 1\n}'),
      tryIt(a + 'upgrade "b" jelly="ice" name="B" icon="x" text="x" needs="a" {\n    stat luck 1\n}')];
    return ok(all && bad.every((m) => m && /u\.kdl/.test(m)) && tryIt(a) === null, { fireIds, bad });
  },
});

// ------------------------------------------------------------------ the new words
story('treasures/burn-stacks', {
  about: 'element-up "fire" burnStacks=3: each re-hit adds a Burn, up to 3 on one bug, each burning as hard (the status reads 3); without it a bug holds one.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    const a = roachAt(0.3, -0.3), b = roachAt(-0.3, -0.3);
    for (let i = 0; i < 4; i++) { B.ignite(a, 10, fire({ burnStacks: 3 })); B.ignite(b, 10); }
    const stacks = [enemies.statuses.burning(a), enemies.statuses.burning(b)];
    const by = burns(60);
    const ratio = by[a.id]?.[0] / by[b.id]?.[0];
    return ok(stacks[0] === 3 && stacks[1] === 1 && Math.abs(ratio - 3) < 1e-9, { stacks, ratio });
  },
});

story('treasures/burn-ramp', {
  about: 'burn-ramp 0.2 most=1: a Burn grows 20% for each second its bug keeps burning, and stops at double.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run } = G();
    withWords('burn-ramp 0.2 most=1');
    const a = roachAt(0.3, -0.3);
    run.bubbles.ignite(a, 10, fire({ burnTime: 30 }));
    const t = burns(60 * 8)[a.id] || [], base = 10 * 0.17 * 0.5;
    const grows = t.length > 10 && t[0] < base * 1.1 && t[4] > t[0] * 1.2 && Math.abs(t.at(-1) - base * 2) < 1e-9;
    return ok(grows && !!mistake('burn-ramp 0'), { first: t[0], fifth: t[4], last: t.at(-1), base });
  },
});

story('treasures/burn-damage', {
  about: 'The burn-damage stat: while "low-health" "burn-damage" 1 under=0.5 makes Burn hit twice as hard below half Health, and as usual above it.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run } = G();
    withWords('while "low-health" "burn-damage" 1 under=0.5');
    const a = roachAt(0.3, -0.3);
    run.bubbles.ignite(a, 10, fire({ burnTime: 30 }));
    run.health = run.S.health;
    const full = burns(60)[a.id]?.[0];
    run.health = 1;
    const low = burns(60)[a.id]?.[0];
    return ok(Math.abs(low / full - 2) < 1e-9 && BASE_STATS.burnDamage === 1, { full, low });
  },
});

story('treasures/refresh-all', {
  about: 'refresh-all "burning": a Fire jelly\'s shot hitting a Burning bug refreshes the Burn on a far-off burning bug, so it keeps burning; without the word that Burn runs out.',
  setup() { setupFight({ types: 'fire', lash: false }); },
  play() {
    const left = (words) => {
      setupFight({ types: 'fire', lash: false });
      if (words) withWords('refresh-all "burning"');
      const { run } = G(), B = run.bubbles;
      roachAt(0, -0.1);
      const far = roachAt(0.6, 0.6);
      B.ignite(far, 1);
      step(60 * 2.5);
      return B.burning.get(far)?.t ?? 0;
    };
    const kept = left(true), plain = left(false);
    return ok(kept > 2 && plain < 1, { kept, plain, bad: mistake('refresh-all "frozen"') });
  },
});

story('treasures/status-blast', {
  about: 'status-damage blast=: a hit on a Burning bug bursts, hurting the bug 2 cm away for half the hit and not one 10 cm away; a Burn tick sets off nothing, and nor does the hit that lights a bug. bugs=#false with elites=#true: only Elites and the boss take its extra damage.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    withWords('status-damage "burning" more=0 blast=0.04 blast-dmg=0.5\nstatus-damage "burning" more=0.2 elites=#true bugs=#false');
    const a = roachAt(0, -0.3), near = roachAt(0.02, -0.3), far = roachAt(0.1, -0.3);
    B.ignite(a, 1);
    const log = record('damage_taken'), hits = record('enemy_hit');
    bus.emit('damage_taken', { targetId: a.id, amount: 4, source: 'bubble' });
    const landed = hits.find((h) => h.targetId === a.id)?.amount, toNear = log.filter((d) => d.targetId === near.id).map((d) => d.amount), toFar = log.filter((d) => d.targetId === far.id).length;
    log.length = 0;
    bus.emit('damage_taken', { targetId: a.id, amount: 4, source: 'fire', feedback: { tick: true } });
    const tickQuiet = !log.some((d) => d.targetId === near.id);
    enemies.freshBurn = a; const fresh = enemies.statusMore(a, 'bubble'), stillBurning = enemies.statuses.burning(a); enemies.freshBurn = null;
    const boss = { proxy: {} }; B.ignite(boss, 1);
    const eliteK = enemies.statusMore(boss, 'bubble');
    B.burning.delete(boss);
    const pass = landed === 4 && toNear.length === 1 && Math.abs(toNear[0] - 2) < 1e-9 && !toFar && tickQuiet && fresh === 1 && stillBurning === 1 && Math.abs(eliteK - 1.2) < 1e-9
      && !!mistake('status-damage "burning" bugs=#false');
    return ok(pass, { landed, toNear, toFar, tickQuiet, fresh, stillBurning, eliteK });
  },
});

story('treasures/on-kill-of-stacks', {
  about: 'on-kill-of status="burning" stacks=3: a bug that dies with 3 Burns sets off its ring, even when the killing hit is the one that lit it; one with a single Burn doesn\'t. stacks= without status= is a mistake.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('on-kill-of status="burning" stacks=3 {\n  ring 0.06 dmg=1\n}');
    const log = record('damage_taken'), kill = (e) => bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'bubble' });
    const one = roachAt(0, -0.6); roachAt(0.04, -0.6);
    B.ignite(one, 1); kill(one);
    const quiet = !log.some((d) => d.source === 'ring');
    const three = roachAt(0, -0.3), beside = roachAt(0.04, -0.3);
    for (let i = 0; i < 3; i++) B.ignite(three, 1, fire({ burnStacks: 3 }));
    G().enemies.freshBurn = three;   // as if the killing hit had just lit it: it still dies burning
    kill(three);
    G().enemies.freshBurn = null;
    const rang = log.some((d) => d.source === 'ring' && d.targetId === beside.id);
    return ok(quiet && rang && !!mistake('on-kill-of stacks=2 {\n  xp 1\n}'), { quiet, rang });
  },
});

story('treasures/streak', {
  about: 'streak 3 within=2 status="burning": the 3rd Burning bug to die within 2 s sets off a ring round the jelly; a bug that wasn\'t burning doesn\'t count, and kills further apart than 2 s start over.',
  setup() { setupFight({ lash: false, bubbles: false }); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('streak 3 within=2 status="burning" {\n  ring 0.1 dmg=1\n}');
    const victim = roachAt(0, -0.05), log = record('damage_taken');
    const rang = () => log.some((d) => d.source === 'ring' && d.targetId === victim.id);
    const die = (burning, x) => { const e = roachAt(x, -0.5); if (burning) B.ignite(e, 1); bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'bubble' }); };
    die(true, 0.1); die(true, 0.15); die(false, 0.2);
    const notYet = !rang();
    die(true, 0.25);
    const third = rang();
    log.length = 0;
    die(true, 0.3); die(true, 0.35); step(60 * 2.5); die(true, 0.4);
    const apart = !rang();
    return ok(notYet && third && apart && !!mistake('streak 1 {\n  xp 1\n}'), { notYet, third, apart });
  },
});

story('treasures/cone', {
  about: 'every 1 { cone }: a flame cone at the nearest bug hits and sets alight the bug in front, not the one behind or the one past its reach. A cone wider than 180° is a mistake.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run, enemies } = G();
    withWords('every 1 first=0.1 {\n  cone range=0.12 angle=70 dmg=1\n}');
    const front = roachAt(0, -0.07), behind = roachAt(0, 0.1), past = roachAt(0, -0.3);
    const log = record('damage_taken');
    step(30);
    const hit = (e) => log.some((d) => d.source === 'cone' && d.targetId === e.id);
    const pass = hit(front) && !hit(behind) && !hit(past) && enemies.statuses.burning(front) > 0 && !enemies.statuses.burning(behind) && !!mistake('every 1 {\n  cone angle=200\n}');
    return ok(pass, { front: hit(front), behind: hit(behind), past: hit(past), burning: enemies.statuses.burning(front) });
  },
});

story('treasures/burning-nearby', {
  about: 'per of="burning-nearby" most=2: +5% Fire rate for each Burning bug within 30 cm, counting at most 2; a burning bug farther off and a bug that isn\'t burning count for nothing.',
  setup() { setupFight({ lash: false }); stub(G().run.bubbles, 'volley', () => false); },
  play() {
    const { run } = G(), B = run.bubbles, step5 = BASE_STATS.fireRate * 0.05;
    withWords('per "fire-rate" 5 percent=#true of="burning-nearby" most=2');
    const base = run.S.fireRate;
    const a = roachAt(0.1, -0.1); roachAt(-0.1, -0.1); const far = roachAt(0.6, 0.6);
    B.ignite(a, 0.01, fire({ burnTime: 30 })); B.ignite(far, 0.01, fire({ burnTime: 30 }));
    step(2);
    const one = run.S.fireRate - base;
    for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1]]) B.ignite(roachAt(x, z), 0.01, fire({ burnTime: 30 }));
    step(2);
    const capped = run.S.fireRate - base;
    return ok(Math.abs(one - step5) < 1e-9 && Math.abs(capped - 2 * step5) < 1e-9, { one, capped, step5 });
  },
});

// ------------------------------------------------------------------ Fire's pool, as content
// each upgrade compiled alone: the combined effects it must set (its behaviour is its words' stories)
const SAYS = {
  flashpoint: (m) => m.statusDamage.some((d) => d.status === 'burning' && d.blast === 0.04 && d.blastDmg === 0.5),
  slowBurn: (m) => m.element.fire.burnStacks === 3 && m.element.fire.burnTime === 6,
  fireBreath: (m) => m.timed.some((T) => T.every === 4 && T.effects[0].kind === 'cone'),
  wildfire: (m) => Math.abs(m.element.fire.spread - 0.12) < 1e-9,
  hotHead: (m) => m.whiles.some((w) => w.when === 'low-health' && w.stat === 'burnDamage' && w.amount === 1 && w.under === 0.5),
  stoke: (m) => m.burnRamp?.step === 0.2 && m.burnRamp.most === 1,
  inferno: (m) => m.killsOf.some((K) => K.status === 'burning' && K.stacks === 3 && K.effects[0].kind === 'ring'),
  backdraft: (m) => m.streaks.some((S) => S.kills === 5 && S.within === 3 && S.status === 'burning'),
  fuel: (m) => m.per.some((p) => p.of === 'burning-nearby' && p.most === 5 && p.amount === 5 && p.percent),
  blueFlame: (m) => m.element.fire.burn === 1.5 && Math.abs(m.damageTaken - 1.1) < 1e-9,
  flareUp: (m) => m.refreshAll.includes('burning'),
  melt: (m) => m.statusDamage.some((d) => d.status === 'burning' && d.more === 0.2 && d.elites && d.bugs === false),
};
story('upgrades/fire-pool', {
  about: 'Each of Fire\'s 12 Attack upgrades, taken in a Fire run, sets what its text says (Flashpoint\'s blast, Slow Burn\'s 3 stacks for 6 s, Fire Breath\'s cone every 4 s, …), and nothing before it is taken.',
  setup() { fresh({ types: 'fire' }); },
  play() {
    const { run } = G(), wrong = [];
    for (const id of FIRE_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    return ok(!wrong.length, { wrong });
  },
});

// ------------------------------------------------------------------ Tentacle's pool (P7)
// a Tentacle run's lash: 3 tentacles of 9 (Attack damage), reach 11 cm, 1.76 a second. `tent(words)` sets one up with
// the words in force; bugs are placed by how far from the jelly's middle they are, measured as the lash measures it
const tent = (words = '', { lash = true, hurt = false } = {}) => {
  setupFight({ types: 'tentacle', bubbles: false, hurt });
  if (!lash) stub(G().run.lash, 'fire', () => false);   // no lashes of its own (the lash still animates what a word sends)
  return words ? withWords(words) : G().run.mods;
};
// a still, tough roach `d` m from the jelly's middle, to the side (reach is measured from there, less the bug's own size)
const roachReach = (d, z = 0, opts) => {
  const { run, enemies } = G(), o = run.player.position.clone().setY(run.player.position.y + run.cfg.height * 0.45), e = roachAt(0, z, opts);
  for (let x = 0; x < 0.6; x += 0.002) { e.pos.x = run.player.position.x + x; if (enemies.center(e).distanceTo(o) - e.r >= d) break; }
  return e;
};
const stings = (log) => dmgBy(log, 'tentacle');
// n still, tough roaches in a ring round the jelly, 8 cm out (bugs shove each other apart, so no heaps)
const ringOfBugs = (n) => Array.from({ length: n }, (_, i) => roachAt(0.08 * Math.cos(i * 2 * Math.PI / n), 0.08 * Math.sin(i * 2 * Math.PI / n)));

story('treasures/lash-all', {
  about: 'lash all=#true (Toaster Cord): getting hit lashes every bug within your Tentacle reach for twice the damage, not just the one that hit you and not one out of reach; at most 5 times a second.',
  setup() { tent('when-hit cooldown=0.2 {\n  lash all=#true dmg=2\n}', { lash: false, hurt: true }); },
  play() {
    const { run } = G(), a = roachReach(0.05), b = roachReach(0.06, 0.03), c = roachReach(0.07, -0.03), far = roachReach(0.3, 0.2), log = record('damage_taken');
    run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', from: a.id });
    step(5);
    run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', from: a.id });   // within its 0.2 s: nothing
    step(15);
    const hit = stings(log), who = new Set(hit.map((d) => d.targetId)), want = run.tentacleStats.tentacleDamage * 2;
    return ok(hit.length === 3 && who.has(a.id) && who.has(b.id) && who.has(c.id) && !who.has(far.id) && hit.every((d) => Math.abs(d.amount - want) < 1e-6), { hit: hit.map((d) => [d.targetId, d.amount]), want });
  },
});

story('treasures/grab', {
  about: 'every 1 { grab }: a tentacle grabs the toughest bug within 30 cm (not the weaker one nearer, not one out of range) and reels it in until it touches the jelly, slamming it for 3x damage; a bug on the way takes the same, one off to the side nothing.',
  setup() { tent('every 1 first=0.1 {\n  grab range=0.3 dmg=3\n}', { lash: false }); },
  play() {
    const { run, enemies } = G(), P = run.player.position, o = P.clone().setY(P.y + run.cfg.height * 0.45);
    const weak = roachReach(0.1, 0.06, { still: true, hp: 10 }), tough = roachReach(0.22, 0, { still: true, hp: 9000 }), way = roachReach(0.1, 0, { still: true, hp: 20 }), side = roachReach(0.1, -0.06, { still: true, hp: 20 });
    const far = roachReach(0.5, 0, { still: true, hp: 99999 }), log = record('damage_taken');
    const was = enemies.center(tough).distanceTo(o);
    step(40);
    const hit = stings(log), want = run.tentacleStats.tentacleDamage * 3, got = (e) => hit.filter((d) => d.targetId === e.id);
    const now = enemies.center(tough).distanceTo(o) - tough.r;
    return ok(got(tough).length === 1 && Math.abs(got(tough)[0].amount - want) < 1e-6 && got(way).length === 1 && !got(weak).length && !got(side).length && !got(far).length && now < 0.06 && was > 0.2,
      { want, hit: hit.map((d) => [d.targetId, d.amount]), was, now, bad: mistake('every 1 {\n  grab range=0\n}') });
  },
});

story('treasures/ink', {
  about: 'when-hit { ink }: after a hit, for 2 s a hit from a bug within 15 cm misses half the time, one from a bug farther off doesn\'t, and after 2 s hits land as usual; it is a second chance beside Dodge, so with 60 Dodge the two together miss 80% of the time, never every time. miss=1 is a mistake. It squirts dark ink, not a glow.',
  setup() { tent('when-hit cooldown=2 {\n  ink radius=0.15 time=2 miss=0.5\n}', { lash: false, hurt: true }); },
  play() {
    // a hit while Math.random rolls `roll`: did it land?
    const hitMe = (from, roll) => {
      const { run } = G(), was = run.health, real = Math.random;
      run.iFrames = 0; Math.random = () => roll;
      try { bus.emit('damage_taken', { targetId: PLAYER, amount: 10, source: 'story', from: from.id }); } finally { Math.random = real; }
      return run.health < was;
    };
    const near = roachReach(0.05), far = roachReach(0.4, 0.2), lands = [];
    lands.push(hitMe(near, 0.99));                                  // before the squirt: lands (and squirts)
    lands.push(hitMe(near, 0.49), hitMe(near, 0.51));               // inked: a roll under half misses, over lands
    lands.push(hitMe(far, 0.49));                                   // far bug: not covered
    step(60 * 2.1);
    lands.push(hitMe(near, 0.49));                                  // the cloud is gone
    const puffs = G().run.fx.puffs.filter((p) => p.alive).length;
    // with 60 Dodge: 1 - 0.4 x 0.5 = 80% to miss, so a roll of 0.79 misses and 0.81 lands
    tent('when-hit cooldown=2 {\n  ink radius=0.15 time=2 miss=0.5\n}\nstat dodge 60', { lash: false, hurt: true });
    const n2 = roachReach(0.05);
    hitMe(n2, 0.99);                                                // lands only if no Dodge roll (0.99 is over 60%)
    const dodged = [hitMe(n2, 0.79), hitMe(n2, 0.81)];
    return ok(lands.join() === 'true,false,true,true,true' && dodged.join() === 'false,true' && puffs > 0 && !!mistake('when-hit {\n  ink miss=1\n}'), { lands, dodged, puffs });
  },
});

story('treasures/reach-flare', {
  about: 'every 1 { reach-flare 2 }: the lash that follows a flare reaches twice as far and stings a bug just out of ordinary reach, once; without the word that bug is never stung. A flare of 1 or less is a mistake.',
  setup() { tent(); },
  play() {
    const stung = (words) => {
      tent(words);
      const e = roachReach(0.16), { lash, run } = G(), log = record('damage_taken');
      const o = run.player.position.clone().setY(run.player.position.y + run.cfg.height * 0.45), inReach = lash.inReach(o, run.tentacleStats.reach).length;
      step(60);
      return { n: stings(log).length, inReach, e };
    };
    const with_ = stung('every 1 first=0.1 {\n  reach-flare 2\n}'), without = stung('');
    return ok(with_.n === 1 && with_.inReach === 0 && without.n === 0 && !!mistake('every 1 {\n  reach-flare 1\n}'), { with: with_.n, without: without.n, outsideReach: with_.inReach === 0 });
  },
});

story('treasures/stat-percent-own-base', {
  about: 'stat percent=#true is a percent of the jelly\'s own starting value: +50% Attack damage is +3 on Normal (6) and +4.5 on the Tentacle jelly (9); the same for while, per and stack-buff.',
  setup() { fresh(); },
  play() {
    const got = (types) => {
      fresh({ types }); withWords('stat bubble-damage 50 percent=#true');
      const { run } = G();
      return run.S.bubbleDamage;
    };
    const normal = got(null), tentacle = got('tentacle');
    fresh({ types: 'tentacle' }); withWords('while "rooted" "bubble-damage" 50 percent=#true');
    const run = G().run; run.stillT = 5;
    const rooted = run.S.bubbleDamage;
    fresh();
    return ok(Math.abs(normal - 9) < 1e-9 && Math.abs(tentacle - 13.5) < 1e-9 && Math.abs(rooted - 13.5) < 1e-9, { normal, tentacle, rooted });
  },
});

story('treasures/sweep', {
  about: 'nth-attack 2 { sweep }: every 2nd lash stings every bug in reach (4 here), the others only the 3 tentacles; sweep is a lash\'s word, so a bubble volley with it is unchanged.',
  setup() { tent('nth-attack 2 {\n  sweep\n}'); },
  play() {
    const { lash } = G(), bugs = ringOfBugs(4), log = record('damage_taken');
    const lashes = [];
    for (let n = 1; n <= 2; n++) { const before = stings(log).length; step(200, () => lash.count === n); step(15); lashes.push(stings(log).length - before); }
    return ok(lashes.join() === '3,4' && bugs.length === 4, { lashes });
  },
});

story('treasures/sting-count', {
  about: 'sting-count 3 { sweep bleed=3 }: after 3 stings the next lash stings every bug in reach and gives each 3 Bleed stacks; its own stings don\'t count, so the count starts again from none.',
  setup() { tent('sting-count 3 {\n  sweep bleed=3\n}'); },
  play() {
    const { lash } = G(), bugs = ringOfBugs(4), log = record('damage_taken');
    step(200, () => lash.count === 1); step(15);
    const first = stings(log).length, bled1 = bugs.filter((e) => lash.venom.get(e)).length, counted = lash.stings;
    step(200, () => lash.count === 2); step(15);
    const second = stings(log).length - first, stacks = bugs.map((e) => lash.venom.get(e)?.stacks);
    return ok(first === 3 && bled1 === 0 && counted === 3 && second === 4 && stacks.every((n) => n === 3) && lash.stings === 0 && !!mistake('sting-count 1 {\n  sweep\n}') && !!mistake('sting-count 20 {\n  big\n}'), { first, bled1, counted, second, stacks, now: lash.stings });
  },
});

story('treasures/reach-sweetspot', {
  about: 'reach-sweetspot: a sting on a bug at the outer quarter of your reach does double damage; one closer in does the usual.',
  setup() { tent('reach-sweetspot from=0.75 mult=2'); },
  play() {
    const { run } = G(), near = roachReach(0.03), edge = roachReach(0.1, 0.04), log = record('damage_taken');
    step(200, () => stings(log).length >= 2); step(10);
    const hit = stings(log), base = run.tentacleStats.tentacleDamage, by = (e) => hit.find((d) => d.targetId === e.id)?.amount;
    // a grab reaches far past the lash, and a flared lash is judged by its own reach: neither is an edge hit
    const once = (words, d, z = 0) => {
      tent(words);
      const e = roachReach(d, z), l = record('damage_taken');
      step(80, () => stings(l).length >= 1); step(5);
      return stings(l).find((x) => x.targetId === e.id)?.amount;
    };
    const grabbed = once('reach-sweetspot\nevery 1 first=0.1 {\n  grab range=0.3 dmg=3\n}', 0.2);
    const flared = once('reach-sweetspot\nevery 1 first=0.1 {\n  reach-flare 2\n}', 0.16);
    return ok(Math.abs(by(near) - base) < 1e-6 && Math.abs(by(edge) - base * 2) < 1e-6 && Math.abs(grabbed - base * 3) < 1e-6 && Math.abs(flared - base) < 1e-6 && !!mistake('reach-sweetspot mult=1'), { near: by(near), edge: by(edge), base, grabbed, flared });
  },
});

story('treasures/pin-on-stings', {
  about: 'pin-on-stings 2 within=3: a bug stung twice within 3 s is pinned for 1 s, not after the first sting; hits further apart than that start over.',
  setup() { tent('pin-on-stings 2 within=3 seconds=1'); },
  play() {
    const { lash } = G(), e = roachReach(0.05), pins = record('status_applied');
    step(200, () => lash.count === 1); step(15);
    const afterOne = pins.filter((s) => s.status === 'pin').length;
    step(200, () => lash.count === 2); step(15);
    const afterTwo = pins.filter((s) => s.status === 'pin' && s.targetId === e.id && s.duration === 1).length;
    return ok(afterOne === 0 && afterTwo === 1 && !!mistake('pin-on-stings 1'), { afterOne, afterTwo });
  },
});

story('treasures/echo-bubble-tentacles', {
  about: 'echo-bubble by="tentacles": a sting jumps on to the nearest other bug within reach for 60% of its damage, once; with one tentacle and two bugs the first takes the sting and the second the echo, and without the word only the first is hurt.',
  setup() { tent(); },
  play() {
    const run1 = (words) => {
      tent(words);
      const a = roachReach(0.04), b = roachReach(0.07, 0.03), log = record('damage_taken');
      step(200, () => stings(log).length >= 1); step(15);
      return { a: stings(log).filter((d) => d.targetId === a.id).map((d) => d.amount), b: stings(log).filter((d) => d.targetId === b.id).map((d) => d.amount) };
    };
    const echo = run1('stat bubbles -2\necho-bubble by="tentacles" dmg=0.6'), plain = run1('stat bubbles -2');
    const base = G().run.tentacleStats.tentacleDamage;
    return ok(echo.a.length === 1 && echo.b.length === 1 && Math.abs(echo.b[0] - base * 0.6) < 1e-6 && plain.b.length === 0 && !!mistake('echo-bubble by="claws"'), { echo, plain, base });
  },
});

// each upgrade compiled alone: the combined effects it must set
const TENT_SAYS = {
  stingingNettle: (m) => m.hits.tentacles.venom?.dps === 0.25 && m.hits.tentacles.venom.time === 3 && m.hits.tentacles.venom.stacks === 5,
  tapeMeasureReel: (m) => m.stats.pct.reach === 60 && m.timed.some((T) => T.every === 2 && T.effects[0].kind === 'grab' && T.effects[0].range === 0.3 && T.effects[0].dmg === 3),
  spaghettiSweep: (m) => m.nth.some((N) => N.every === 4 && N.effects[0].kind === 'sweep'),
  toasterCord: (m) => m.onHurt.some((H) => H.cooldown === 0.2 && H.effects[0].kind === 'lash' && H.effects[0].all && H.effects[0].dmg === 2),
  chopstickRush: (m) => m.buffs.some((b) => b.event === 'kill' && b.stat === 'fireRate' && b.amount === 10 && b.percent && b.time === 3 && b.stacks === 5),
  paperclipHop: (m) => m.hits.tentacles.echo?.dmg === 0.6 && !m.bubbles.echo,
  whipCrack: (m) => m.hits.tentacles.edge?.from === 0.75 && m.hits.tentacles.edge.mult === 2,
  anchor: (m) => m.whiles.some((w) => w.when === 'rooted' && w.stat === 'bubbleDamage' && w.amount === 50 && w.percent),
  inkCloud: (m) => m.onHurt.some((H) => H.cooldown === 2 && H.effects[0].kind === 'ink' && H.effects[0].time === 2 && H.effects[0].miss === 0.5),
  venomSac: (m) => m.stingCount.some((S) => S.every === 20 && S.effects[0].kind === 'sweep' && S.effects[0].bleed === 3),
  coil: (m) => m.hits.tentacles.coil?.hits === 5 && m.hits.tentacles.coil.within === 2 && m.hits.tentacles.coil.seconds === 1,
  bellPulse: (m) => m.timed.some((T) => T.every === 3 && T.effects[0].kind === 'reach-flare' && T.effects[0].mult === 2),
};
story('upgrades/tentacle-pool', {
  about: 'Tentacle has exactly 12 Attack upgrades, each setting what its text says (Tape Measure\'s grab every 2 s, Toaster Cord\'s lash back at everything in reach, Venom Sac\'s sweep every 20 stings, …) and nothing before it is taken; a Tentacle run is offered only those, a Fire run none of them.',
  setup() { fresh({ types: 'tentacle' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'tentacle').map((u) => u.id);
    for (const id of TENTACLE_POOL) {
      run.upgrades = [];
      let before; try { before = TENT_SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !TENT_SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    const offered = new Set();
    stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => offered.add(c.id)));
    for (let i = 0; i < 40; i++) run.pickUpgrade({ id: 2 }, () => {});
    const own = [...offered].every((id) => TENTACLE_POOL.includes(id)) && offered.size === 12;
    fresh({ types: 'fire' });
    const fireOffered = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireOffered.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean = [...fireOffered].every((id) => !TENTACLE_POOL.includes(id));
    fresh();
    return ok(!wrong.length && pool.length === 12 && pool.every((id) => TENTACLE_POOL.includes(id)) && own && clean, { wrong, pool: pool.length, own, offered: offered.size, clean });
  },
});
