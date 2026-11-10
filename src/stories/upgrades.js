// Stories: Attack upgrades (content/upgrades.kdl, docs/jelly-types phase P6): the end-of-act pick,
// chests with jelly types on, saves, and the words Fire's pool brought (burn-ramp, refresh-all,
// streak, cone, and new props on element-up, status-damage, on-kill-of and per).
import { bus } from '../events.js';
import { CONTENT, compileMods, compileTreasures, compileUpgrades } from '../content.js';
import { parse } from '../kdl.js';
import { BASE_STATS } from '../stats.js';
import { elementParams } from '../words.js';
import { jellyStats } from '../jelly-types.js';
import { SAVE_KEY, carried, keepRun } from '../stages.js';
import { G, fresh, give, offs, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

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
    B.freshBurn = a; const fresh = enemies.statuses.burning(a); B.freshBurn = null;
    const boss = { proxy: {} }; B.ignite(boss, 1);
    const eliteK = enemies.statusMore(boss, 'bubble');
    B.burning.delete(boss);
    const pass = landed === 4 && toNear.length === 1 && Math.abs(toNear[0] - 2) < 1e-9 && !toFar && tickQuiet && fresh === 0 && Math.abs(eliteK - 1.2) < 1e-9
      && !!mistake('status-damage "burning" bugs=#false');
    return ok(pass, { landed, toNear, toFar, tickQuiet, fresh, eliteK });
  },
});

story('treasures/on-kill-of-stacks', {
  about: 'on-kill-of status="burning" stacks=3: a bug that dies with 3 Burns sets off its ring; one with a single Burn doesn\'t. stacks= without status= is a mistake.',
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
    kill(three);
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
