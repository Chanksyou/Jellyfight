// Stories: the Summoner Jelly (content/jellies.kdl "summoner", docs/jelly-types/types/summoner.md): its Signal, the
// Jelly Mould it starts with, and its 12 Attack upgrades, which all work through the little jellies (src/turrets.js)
// and the words turret-element, turret-up, turret-on and turret-relay (src/words.js). Shared helpers are in ./kit.js.
import { CONTENT, compileJellies } from '../content.js';
import { parse } from '../kdl.js';
import { sfx } from '../sfx.js';
import { PLAYED_KEY } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { elementParams } from '../words.js';
import { G, dmgBy, fresh, give, holdJelly, near, ok, record, roachAt, setupFight, spy, step, story, stub } from './kit.js';

const EF = { time: 30, health: 999, dmg: 0.4, most: 4 };   // a Jelly Mould's little jelly that stays out
const setup = (types = 'summoner') => { setupFight({ types, lash: false }); holdJelly(); };
const quiet = () => { const { run } = G(); stub(run.bubbles, 'volley', () => false); stub(run.bubbles, 'elementVolley', () => false); };
const place = (dx, dz, ef = EF) => { const { run } = G(); run.turrets.place(near(dx, dz), ef); return run.turrets.list.at(-1); };
const take = (...ids) => { const { run } = G(); for (const id of ids) run.upgrades.push(id); };
const only = (...ids) => { const { run } = G(); run.upgrades.length = 0; void run.mods; take(...ids); };   // (read between, so the count changes and the effects are compiled again)
const onBug = (log, bug, source) => dmgBy(log, source).filter((d) => d.targetId === bug.id);
const near2 = (a, b) => Math.abs(a - b) < 1e-6;

story('content/start-treasure', {
  about: 'start-treasure= on a jelly type names a Treasure every run of it starts with: the Summoner Jelly\'s is Jelly Mould, a Normal run starts with nothing, and an id that is not a Treasure is a mistake naming the file and line.',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileJellies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const base = 'jelly "normal" name="N" about="A" attack="bubble" hit=1\n';
    const good = tryIt(base + 'jelly "x" name="X" about="A" attack="signal" hit=1 start-treasure="jellyMould"');
    const bad = tryIt(base + 'jelly "x" name="X" about="A" attack="signal" hit=1 start-treasure="teacup"');
    fresh();
    const normal = G().run.owned.count('jellyMould');
    return ok(CONTENT.jellies.summoner.start === 'jellyMould' && good === null && /test\.kdl:2: "x" start-treasure= must be a Treasure's id/.test(bad) && normal === 0, { start: CONTENT.jellies.summoner.start, good, bad, normal });
  },
});

story('types/summoner-plays', {
  about: 'A Summoner Jelly starts with Jelly Mould at level 1 (owned, not logged as a pickup), fires its Signal at its Fire rate of 1 for 5.5 a hit (Attack damage 5.5 x hit 1), and the bug it hits is Signalled for 3 s. Taking Jelly Mould again levels it to 2 (12 s, 70 Health).',
  setup: () => setup(),
  play() {
    const { run } = G();
    const start = run.owned.count('jellyMould'), logged = run.pickupLog.some((p) => p[0] === 'jellyMould');
    stub(run.turrets, 'place', () => {});   // no little jelly: only the Signal hurts the bug
    const log = record('damage_taken'), bug = roachAt(0, -0.15), home = bug.pos.clone();
    for (let i = 0; i < 60 * 3; i++) { step(1); bug.pos.copy(home); }
    const hits = onBug(log, bug, 'bubble'), exact = hits.every((d) => near2(d.amount, 5.5) && d.feedback?.element === 'signal');
    const S = run.bubbles.signalled, tagged = S?.e === bug && S.t > 2 && S.t <= 3 && near2(S.more, 0.25);
    give('jellyMould');
    const T = run.mods.timed.find((t) => t.effects.some((e) => e.kind === 'turret'))?.effects.find((e) => e.kind === 'turret');
    return ok(start === 1 && !logged && hits.length >= 3 && hits.length <= 6 && exact && tagged && T?.time === 12 && T?.health === 70,
      { start, logged, hits: hits.map((d) => d.amount), tagged: S && { same: S.e === bug, t: S.t }, level2: T && [T.time, T.health] });
  },
});

story('types/summoner-signal-is-one-bug-at-a-time', {
  about: 'The Signal moves: a hit on another bug Signals that one instead (a lock-on chime each time it moves, not on a re-hit), a little jelly\'s own shot never Signals, and 3 s after the last hit the Signal is gone.',
  setup: () => setup(),
  play() {
    const { run } = G(), chimes = spy(sfx, 'signalMark'), real = run.turrets.place;
    stub(run.turrets, 'place', () => {});
    const a = roachAt(0, -0.15), homeA = a.pos.clone();
    for (let i = 0; i < 60 * 2; i++) { step(1); a.pos.copy(homeA); }
    const first = run.bubbles.signalled?.e === a, chimesA = chimes.length;
    a.pos.set(homeA.x + 3, homeA.y, homeA.z);   // out of Range
    const b = roachAt(0.1, -0.15), homeB = b.pos.clone();
    for (let i = 0; i < 60 * 2; i++) { step(1); b.pos.copy(homeB); a.pos.set(homeA.x + 3, homeA.y, homeA.z); }
    const moved = run.bubbles.signalled?.e === b, chimesB = chimes.length;
    b.pos.set(homeB.x + 3, homeB.y, homeB.z);
    stub(run.turrets, 'place', real);
    run.bubbles.signalled = null;
    place(0.3, -0.3); const c = roachAt(0.3, -0.45);
    stub(run.bubbles, 'volley', () => false); stub(run.bubbles, 'elementVolley', () => false);
    step(60 * 2);
    const turretSignals = run.bubbles.signalled?.e === c;
    run.bubbles.signal(b, elementParams('signal'));
    step(60 * 3.2);
    return ok(first && chimesA === 1 && moved && chimesB === 2 && !turretSignals && run.bubbles.signalled === null,
      { first, chimesA, moved, chimesB, turretSignals, left: run.bubbles.signalled?.t });
  },
});

story('types/summoner-little-jellies-shoot-the-signalled-bug', {
  about: 'A little jelly shoots the Signalled bug first while it is in Range, even with another bug nearer, each hit 40% x 1.25 of Attack damage (2.75); with no Signal it goes back to the nearest bug, for 40% (2.2).',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    const log = record('damage_taken');
    place(0.2, 0);
    const nearBug = roachAt(0.2, -0.1), farBug = roachAt(0.2, 0.25);
    const P = elementParams('signal');
    step(60 * 3, () => { run.bubbles.signal(farBug, P); });
    const onFar = onBug(log, farBug, 'turret'), onNear = onBug(log, nearBug, 'turret');
    run.bubbles.signalled = null;
    const was = onBug(log, nearBug, 'turret').length;
    step(60 * 3);
    const back = onBug(log, nearBug, 'turret').slice(was);
    return ok(onFar.length >= 2 && !onNear.length && onFar.every((d) => near2(d.amount, 2.75)) && back.length >= 2 && back.every((d) => near2(d.amount, 2.2)),
      { far: onFar.map((d) => d.amount), near: onNear.length, back: back.map((d) => d.amount) });
  },
});

story('treasures/turret-element', {
  about: 'turret-element (the Moulds): little jellies fire that Element in place of the type\'s attack, tinted its --type- colour. With Cinder and Frost Mould taken, the little jellies set down take Fire, Ice, Fire in turn.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    take('cinderMould', 'frostMould');
    const T = [place(0.2, 0), place(-0.2, 0), place(0, 0.2)], els = T.map((t) => t.element);
    const tinted = T[0].color.getHexString() !== run.turrets.cool.getHexString() && T[0].color !== T[1].color;
    roachAt(0.2, -0.12);
    let shot = null;
    step(60 * 2, () => (shot = run.bubbles.list.find((b) => b.turret && b.tint === 'fire')));
    return ok(els.join() === 'fire,ice,fire' && tinted && !!shot, { els, tinted, shot: shot?.tint });
  },
});

story('treasures/turret-on', {
  about: 'turret-on: its block goes off round the little jelly. Cinder Mould\'s "end" Blast (2x Attack damage within 10 cm) when one melts away; Martyr Pop\'s "popped" Blast (3x within 12 cm) only when bugs pop one, never when it melts away; Frost Mould\'s "every" Chills bugs within 12 cm each second; Gale Mould\'s "place" shoves bugs within 12 cm away.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    stub(run.bubbles, 'turretShot', () => null);   // their shots kept out of it
    const log = record('damage_taken'), knocks = record('knockback'), power = run.power;
    take('cinderMould');
    let T = place(0.2, 0); const a = roachAt(0.2, -0.06);
    run.turrets.end(T, false);
    const cinder = onBug(log, a, 'ring').map((d) => d.amount);
    only('martyrPop');
    T = place(0.2, 0); run.turrets.end(T, false);
    const melted = onBug(log, a, 'ring').length - cinder.length;
    T = place(0.2, 0); T.health = 0; run.turrets.end(T, true);
    const martyr = onBug(log, a, 'ring').slice(cinder.length).map((d) => d.amount);
    only('frostMould');
    a.chillT = 0; T = place(0.2, 0);
    step(70);
    const chilled = a.chillT > 0;
    only('galeMould');
    const k0 = knocks.length; place(0.2, 0);
    const shoved = knocks.slice(k0).some((k) => k.targetId === a.id);
    return ok(cinder.length === 1 && near2(cinder[0], power * 1.1) && !melted && martyr.length === 1 && near2(martyr[0], power * 1.67) && chilled && shoved,
      { cinder, power, melted, martyr, chilled, shoved });
  },
});

story('treasures/turret-up', {
  about: 'turret-up: Thick Glass gives little jellies 2x Health and 1.5x time (Jelly Mould\'s 35 and 8 s, plus the 8 s every Mould gives: 70 and 24 s); Budding brings the first one 40% sooner (4.8 s, not 8) and lets 6 out at once, not 4; Cross-Pollination adds 40% damage for each different Element out (Fire and Ice: 1.8x); Prism Mould\'s Crit does 2.5x.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    take('thickGlass');
    step(60 * 5.5);
    const first = run.turrets.list[0], glass = first && near2(first.health, 70) && first.t > 23 && first.t <= 24;
    run.turrets.reset();
    fresh({ types: 'summoner', lash: false }); holdJelly(); quiet();
    only('budding');
    step(60 * 5.2);
    const sooner = run.turrets.list.length === 1;
    for (let k = 0; k < 7; k++) place(0.05 * k, 0.3);
    const most = run.turrets.list.length;
    run.turrets.reset();
    only('crossPollination', 'cinderMould', 'frostMould');
    const log = record('damage_taken');
    place(0.2, 0); place(-0.2, 0); const bug = roachAt(0.2, -0.12);
    step(60 * 2);
    const both = onBug(log, bug, 'turret').filter((d) => !d.feedback?.crit).map((d) => d.amount);
    run.turrets.reset();
    only('prismMould');
    stub(run.gadgets, 'update', () => {});   // no Jelly Mould timer: only the one set down here
    stub(run.mods.turretUp, 'crit', 1);   // every hit a Crit
    const at = log.length; place(0.2, 0);
    step(60 * 2);
    const crits = onBug(log.slice(at), bug, 'turret').filter((d) => d.feedback?.crit).map((d) => d.amount);   // (the Fire and Ice shots still flying land too)
    return ok(glass && sooner && most === 6 && both.length >= 1 && both.every((d) => near2(d, 5.5 * 0.4 * 1.8)) && crits.length >= 1 && crits.every((d) => near2(d, 5.5 * 0.4 * 2.5)),
      { glass: first && [first.health, first.t], sooner, most, both, crits });
  },
});

story('treasures/turret-relay', {
  about: 'turret-relay (Relay): your Signal passing within 8 cm of a little jelly that fires Fire takes Fire (the bug Burns) and does 50% more (5.5 x 1.5); it still Signals the bug, and passing a second little jelly adds nothing more.',
  setup: () => setup(),
  play() {
    const { run } = G();
    stub(run.bubbles, 'turretShot', () => null);   // the little jellies hold their fire
    take('relay', 'cinderMould');
    stub(run.gadgets, 'update', () => {});         // no Jelly Mould timer: only the two set down here
    place(0, -0.06); place(0, -0.1);
    const log = record('damage_taken'), bug = roachAt(0, -0.2), home = bug.pos.clone();
    step(60 * 1.5, () => { bug.pos.copy(home); return onBug(log, bug, 'bubble').length > 0; });
    const hit = onBug(log, bug, 'bubble')[0];
    return ok(hit && near2(hit.amount, 5.5 * 1.5) && run.bubbles.burning.has(bug) && run.bubbles.signalled?.e === bug,
      { amount: hit?.amount, want: 5.5 * 1.5, burning: run.bubbles.burning.has(bug), signalled: run.bubbles.signalled?.e === bug });
  },
});

story('treasures/per-little-jellies', {
  about: 'per of="little-jellies" (Choir): +10% Fire rate for each little jelly out, up to 6, and back down as they go. The little jellies shoot at that Fire rate too.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    take('choir');
    const before = run.S.fireRate;
    place(0.2, 0); place(-0.2, 0); place(0, 0.2);
    const three = run.S.fireRate;
    run.turrets.reset();
    const after = run.S.fireRate;
    return ok(near2(before, 1) && near2(three, 1.3) && near2(after, 1), { before, three, after });
  },
});

story('types/summoner-upgrades', {
  about: 'The Summoner Jelly has exactly 12 Attack upgrades, each changing the little jellies or the Signal as its text says (an Element, a turret-on block, turret-up numbers, Relay, Choir), and nothing before it is taken; a Fire run is offered none of them.',
  setup: () => setup(),
  play() {
    const { run } = G();
    const pool = CONTENT.upgrades.filter((u) => u.jelly === 'summoner'), none = run.mods;
    const clean = !none.turretElements.length && !none.turretOn.length && !none.turretRelay && none.turretUp.rate === 1;
    const sets = {};
    for (const u of pool) {
      only(u.id);
      const m = run.mods, U = m.turretUp;
      sets[u.id] = !!(m.turretElements.length || m.turretOn.length || m.turretRelay || m.per.some((p) => p.of === 'little-jellies') || U.rate !== 1 || U.most || U.health !== 1 || U.perElement || U.crit);
    }
    const all = Object.values(sets).every(Boolean);
    fresh({ types: 'fire' });
    const fire = CONTENT.upgrades.filter((u) => u.jelly === G().run.jelly).some((u) => u.jelly === 'summoner');
    return ok(pool.length === 12 && clean && all && !fire, { n: pool.length, clean, sets, fire });
  },
});

story('types/summoner-pick-card-attacks', {
  about: 'On the pick screen, the Summoner card wears its look (the beacon piece) and, in the centre, its jelly fires real Signals at the three roaches while a little jelly beside it (its Jelly Mould) shoots them too: they are hit, die and come back.',
  setup() {},
  play() {
    const { GAME, mainMenu, picker } = G(), live = picker.live;
    const keys = [PLAYED_KEY, BEST_KEY], was = keys.map((k) => localStorage.getItem(k));
    keys.forEach((k) => localStorage.removeItem(k)); localStorage.setItem(PLAYED_KEY, '1');   // a returning player sees the pick screen
    try {
      fresh({ types: 'summoner' }); mainMenu.home = true; picker.close(); GAME.startRun();
      stub(live, 'draw', () => {});   // the pictures themselves are for screenshots (a software renderer builds shaders slowly)
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      let signals = 0, theirs = 0, kills = 0, dead = 0, list = live.P.enemies.list;
      for (let i = 0; i < 14 * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; } else { kills += n - dead; dead = n; }
        signals = Math.max(signals, live.P.bubbles.list.filter((b) => b.tint === 'signal' && !b.turret).length);
        theirs = Math.max(theirs, live.P.bubbles.list.filter((b) => b.turret).length);
      }
      const worn = !!live.P.worn.pieces.beacon?.group.visible, little = live.P.turrets?.list.length === 1;
      return ok(picker.liveFor === 'summoner' && signals >= 1 && theirs >= 1 && kills >= 1 && worn && little, { live: picker.liveFor, signals, theirs, kills, worn, little });
    } finally {
      keys.forEach((k, i) => (was[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i])));
      picker.close(); mainMenu.home = false;
    }
  },
});

story('types/summoner-look', {
  about: 'The Summoner Jelly wears its beacon (a ring of light over the bell with three motes circling it); another jelly does not, and it never changes the body the player made.',
  setup: () => setup(),
  play() {
    step(5);
    const piece = () => G().run.adorn.pieces.beacon;
    const on = !!piece()?.group.visible, children = piece()?.group.children.length;
    fresh({ types: 'fire' }); step(5);
    const off = !piece()?.group.visible;
    return ok(on && off && children === 4, { on, off, children });
  },
});

story('treasures/every-mould-adds-8-seconds', {
  about: 'Every Summoner Attack upgrade (the six Moulds, Budding, Relay, Cross-Pollination, Martyr Pop, Choir, Thick Glass) makes little jellies last 8 s longer: one of them takes Jelly Mould\'s 8 s to 16 s, and Thick Glass adds 50% on top of that (24 s).',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    const ids = ['cinderMould', 'frostMould', 'teslaMould', 'sporeMould', 'galeMould', 'prismMould', 'budding', 'relay', 'crossPollination', 'martyrPop', 'choir', 'thickGlass'];
    const adds = ids.map((id) => { only(id); return run.mods.turretUp.addTime; });
    const t = place(0, 0, { ...EF, time: 8 }).t;   // the last one taken is Thick Glass
    return ok(adds.every((a) => a === 8) && t === 24, { adds, t });
  },
});
