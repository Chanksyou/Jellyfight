// Stories: the Wind jelly type (docs/jelly-types phase P8d): its gust as the only attack, its look, and the
// words its 12 Attack upgrades brought (whirl, pushed-hits, glide, and new props on landing-shockwave,
// when-hit and the wind Element: falloff, angle). The gust's own mechanics (push, scenery, speed lines)
// are proven by attack/wind-* in ./wind.js.
import { bus, PLAYER } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { elementParams } from '../words.js';
import { PLAYED_KEY } from '../first-run.js';
import { BEST_KEY } from '../leaderboard.js';
import { G, V, fresh, ok, record, roachAt, setupFight, spy, step, story, stub, offs, hitJelly } from './kit.js';

// the run's combined effects become what it owns (and its jelly's own) plus these words, until the story ends
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p8d" name="P8d" icon="x" text="x" {\n${src}\n}`, 'p8d.kdl'), 'p8d.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || [], run.attack ? run.jelly : null);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
const WIND_POOL = ['cyclone', 'bowling', 'tailwind', 'updraft', 'gale', 'slipstream', 'crosswind', 'eyeOfTheStorm', 'slamDunk', 'secondWind', 'jetStream', 'glide'];
// a Wind fight whose jelly fires nothing by itself (its upgrades' own effects still run)
const quiet = (o = {}) => { setupFight({ types: 'wind', ...o }); stub(G().run.bubbles, 'elementVolley', () => false); };
// take an upgrade (the run's effects are rebuilt when how many it has changes, so go through none first)
const take = (...ids) => { const { run } = G(); run.upgrades = []; void run.mods; run.upgrades = ids; return run.mods; };
const away = (e, from) => Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
// a gust blown at e by hand, with the run's own wind numbers (as ./wind.js blade())
function gust(e, o = {}) {
  const { run, player } = G();
  return run.bubbles.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 6.9, tint: 'wind', elems: ['wind'], ep: run.mods.element.wind || elementParams('wind'), pierce: 2, dir: V(0, 0, -1), ...o });
}

story('types/wind-plays', {
  about: 'A Wind jelly hurts a bug only with its gusts: no plain bubbles, no tentacle stings. Each gust hits for hit= x Attack damage (6 x 1.15 = 6.9) and goes through 3 bugs (1 + the gust\'s 1 + the type\'s Pierce +1), at its full Fire rate of 1.5 a second.',
  setup() { setupFight({ types: 'wind' }); },
  play() {
    const { run } = G(), log = record('damage_taken'), volleys = spy(run.bubbles, 'volley'), shots = spy(run.bubbles, 'elementVolley'), blows = spy(run.bubbles, 'blow');
    const bug = roachAt(0, -0.15), home = bug.pos.clone();
    for (let i = 0; i < 60 * 4; i++) { step(1); bug.pos.copy(home); }   // a shoved bug is put back: the gusts keep their target
    const by = {};
    for (const d of log) if (d.targetId !== PLAYER) { const k = d.source === 'bubble' && d.feedback?.element ? d.feedback.element : d.source; (by[k] ||= []).push(d.amount); }
    const only = Object.keys(by).every((k) => k === 'wind' || k === 'wind-collision') && by.wind?.length > 0;
    const hits = (by.wind || []).filter((a) => Math.abs(a - 6.9) < 1e-9).length;
    const winds = blows.filter((c) => c[2].tint === 'wind'), pierce = winds.length > 0 && winds.every((c) => c[2].pierce === 3);
    const rate = shots.length >= 5 && shots.length <= 7;
    return ok(only && hits === (by.wind || []).length && hits >= 4 && pierce && rate && !volleys.length, { sources: Object.keys(by), hits, winds: winds.length, pierce: winds.map((c) => c[2].pierce), fired: shots.length, volleys: volleys.length });
  },
});

story('types/wind-pierce-is-the-types-only', {
  about: 'Pierce +1 reaches a type\'s main attack only: with jelly types off, the wind Element (Paper Fan) goes through 2 bugs as it always did; the Wind jelly\'s gusts go through 3.',
  setup() { setupFight({ types: 'wind' }); },
  play() {
    const a = roachAt(0, -0.15), blows = spy(G().run.bubbles, 'blow');
    step(60);
    const on = blows.filter((c) => c[2].tint === 'wind').map((c) => c[2].pierce);
    fresh();
    G().run.owned.add('paperFan');
    roachAt(0, -0.15);
    G().run.stats.pierce = 1;   // even with a Pierce stat, a run without a type is as it was
    const off = spy(G().run.bubbles, 'blow');
    step(120);
    const fan = off.filter((c) => c[2].tint === 'wind').map((c) => c[2].pierce);
    return ok(on.length > 0 && on.every((p) => p === 3) && fan.length > 0 && fan.every((p) => p === 2), { on, fan, a: !!a });
  },
});

story('types/pierce-reaches-every-types-main-attack', {
  about: 'A Pierce stat goes through to any jelly type\'s main attack, not only the Wind jelly\'s: a Fire jelly\'s shot goes through 2 bugs with Pierce 1 and 1 without; so does the Poison jelly\'s blob (2 with Pierce 1), and the bug it first hits is still Poisoned.',
  setup() { setupFight({ types: 'fire' }); },
  play() {
    const shots = () => { const s = spy(G().run.bubbles, 'blow'); step(90); return s.filter((c) => c[2].tint === 'fire').map((c) => c[2].pierce); };
    roachAt(0, -0.15);
    const plain = shots();
    fresh({ types: 'fire' });
    roachAt(0, -0.15);
    G().run.stats.pierce = 1;
    const withPierce = shots();
    fresh({ types: 'poison' });
    const first = roachAt(0, -0.15);
    G().run.stats.pierce = 1;
    const blob = spy(G().run.bubbles, 'blow');
    step(90);
    const blobs = blob.filter((c) => c[2].tint === 'poison').map((c) => c[2].pierce), poisoned = G().run.bubbles.poisoned.has(first) || first.dead;
    return ok(plain.length > 0 && plain.every((p) => p === 1) && withPierce.length > 0 && withPierce.every((p) => p === 2) && blobs.length > 0 && blobs.every((p) => p === 2) && poisoned, { plain, withPierce, blobs, poisoned });
  },
});

story('types/wind-look', {
  about: 'The Wind jelly wears its look (the gale piece: a swirl in the bell and air streaks circling it) and its tentacles stream back; another jelly has neither, and it never changes the body the player made.',
  setup() { setupFight({ types: 'wind' }); },
  play() {
    const { run } = G();
    step(5);
    const rig = () => G().run.player.avatar.tentacles, piece = () => G().run.adorn.pieces.gale;
    const on = !!piece()?.group.visible && rig().breeze === true && rig().barbed === false;
    const children = piece().group.children.length;
    fresh({ types: 'fire' }); step(5);
    const off = !piece()?.group.visible && rig().breeze === false;
    fresh(); step(5);
    const normal = !piece()?.group.visible && rig().breeze === false;
    return ok(on && off && normal && children === 3 && run.typeAdorn !== undefined, { on, off, normal, children });
  },
});

story('treasures/whirl', {
  about: 'every 30 { whirl radius=0.09 time=1.6 pull=0.12 range=0.3 }: a whirlwind rises at the nearest bug within 30 cm and pulls a bug 11 cm from it closer (bugs can not overlap, so it stops about 7 cm from it), not one 32 cm off, and not at all once its 1.6 s are up; with no bug within 30 cm nothing rises. radius, time, pull or range of 0 is a mistake.',
  setup() { quiet(); },
  play() {
    const { run } = G();
    withWords('every 30 first=0.1 {\n  whirl radius=0.09 time=1.6 pull=0.12 range=0.3\n}');
    const near = roachAt(0, -0.2), pulled = roachAt(0.11, -0.2), far = roachAt(0.32, -0.2);
    const was = { pulled: away(pulled, near.pos), far: away(far, near.pos) };
    step(15);
    const rose = run.gadgets.whirls.length === 1 && run.gadgets.whirls[0].at.distanceTo(near.pos) < 0.05;
    step(60 * 1.2);
    const closer = away(pulled, near.pos), farMoved = Math.abs(away(far, near.pos) - was.far);
    step(40);
    const gone = run.gadgets.whirls.length === 0, atRest = pulled.pos.clone();
    step(30);
    const still = pulled.pos.distanceTo(atRest) < 1e-6;
    // nothing within 30 cm: nothing rises
    quiet();
    withWords('every 30 first=0.1 {\n  whirl radius=0.09 time=1.6 pull=0.12 range=0.3\n}');
    roachAt(0.6, 0.6);
    step(15);
    const empty = G().run.gadgets.whirls.length === 0;
    return ok(rose && closer < was.pulled - 0.03 && farMoved < 0.015 && gone && still && empty && !!mistake('every 1 {\n  whirl radius=0\n}') && !!mistake('every 1 {\n  whirl pull=0\n}'), { rose, was, closer, farMoved, gone, still, empty });
  },
});

story('treasures/pushed-hits', {
  about: 'pushed-hits: a bug a gust shoves hits every bug in its way as it slides, each for the same damage as the shoved bug took (6.9), once; a bug off its path takes nothing, and without the word nobody does.',
  setup() { setupFight({ types: 'wind', bubbles: false }); },
  play() {
    const run = () => G().run, E = () => G().enemies;
    const slide = (word) => {
      setupFight({ types: 'wind', bubbles: false });
      if (word) withWords('pushed-hits');
      stub(E().world, 'cast', () => null);
      const first = roachAt(0, -0.2), inPath = roachAt(0, -0.27), aside = roachAt(0.15, -0.27), log = record('damage_taken'), knocks = record('knockback');
      const z0 = first.pos.z, b = gust(first);
      run().bubbles.strike(b, first, run().mods);
      const took = (e) => log.filter((d) => d.targetId === e.id && d.source === 'wind-bowl').map((d) => d.amount);
      return { moved: z0 - first.pos.z, inPath: took(inPath), aside: took(aside), self: took(first), bowled: knocks.filter((k) => k.targetId === inPath.id).length };
    };
    const on = slide(true), off = slide(false);
    return ok(on.inPath.length === 1 && Math.abs(on.inPath[0] - 6.9) < 1e-9 && !on.aside.length && !on.self.length && on.moved > 0.03 && !off.inPath.length && !off.aside.length, { on, off });
  },
});

story('treasures/glide', {
  about: 'glide fall=0.2 push=2: holding jump while falling in the air drifts you down at 20% of the fall speed, and gusts blown while you drift push twice as far; let go and you fall as usual and they push as usual. fall of 0 or push under 1 is a mistake.',
  setup() { quiet(); },
  play() {
    const { run, player, input, enemies } = G();
    withWords('glide fall=0.2 push=2');
    stub(enemies.world, 'cast', () => null);
    const maxFall = player.cfg.maxFall;
    const fall = (hold) => {
      player.spawn(player.position.clone().setY(player.position.y + 0.5));
      player.velocity.set(0, -1, 0); player.grounded = false;
      input.keys = new Set(hold ? ['Space'] : []);
      step(12);
      const out = { vy: player.velocity.y, gliding: player.gliding, push: run.bubbles.pushMul };
      input.keys = new Set();
      return out;
    };
    const held = fall(true), loose = fall(false);
    // a gust blown while you drift pushes twice as far as one blown on the ground
    const target = roachAt(0, -0.2), knocks = record('knockback');
    player.spawn(player.position.clone().setY(player.position.y + 0.5)); player.velocity.set(0, -1, 0); player.grounded = false; input.keys = new Set(['Space']);
    step(12);
    const drift = gust(target); run.bubbles.strike(drift, target, run.mods);
    input.keys = new Set();
    const ground = gust(target); ground.pushMul = 1; run.bubbles.strike(ground, target, run.mods);
    const forces = knocks.map((k) => k.force);
    const ok1 = Math.abs(held.vy + maxFall * 0.2) < 1e-9 && held.gliding && held.push === 2 && loose.vy < -maxFall * 0.5 && !loose.gliding && loose.push === 1;
    return ok(ok1 && forces.length === 2 && Math.abs(forces[0] - 2 * forces[1]) < 1e-9 && !!mistake('glide fall=0') && !!mistake('glide push=0.5'), { held, loose, forces });
  },
});

story('treasures/landing-shockwave-push', {
  about: 'landing-shockwave 0.12 dmg=0 push=0.06: landing from a jump blasts every bug within 12 cm of you 6 cm away from you and does no damage; a bug 30 cm off stays put; without push it is the cotton ring that stings.',
  setup() { quiet(); },
  play() {
    const { run, player } = G();
    withWords('landing-shockwave 0.12 dmg=0 push=0.06');
    stub(G().enemies.world, 'cast', () => null);
    const close = roachAt(0.09, 0), far = roachAt(0.3, 0), from = player.position.clone(), log = record('damage_taken');
    const was = away(close, from);
    player.onLand(0.1);
    const pushed = away(close, from) - was, farMoved = Math.abs(away(far, from) - 0.3), noDamage = !log.some((d) => d.source === 'shockwave');
    // not a drop that counts
    const before = close.pos.clone(); player.onLand(0.01);
    const small = close.pos.distanceTo(before) < 1e-6;
    // without push, the old ring
    withWords('landing-shockwave 0.12 dmg=2');
    close.hp = close.maxHp; player.onLand(0.1);
    const sting = log.some((d) => d.source === 'shockwave' && d.targetId === close.id);
    return ok(pushed > 0.045 && pushed < 0.075 && farMoved < 1e-6 && noDamage && small && sting && run.mods.landingShockwave.push === 0, { pushed, farMoved, noDamage, small, sting });
  },
});

story('treasures/when-hit-low-health-once-per-act', {
  about: 'when-hit once-per-act=#true low-health=0.3 { ring 0.15 dmg=0 push=0.1 / dash 0.5 time=5 }: hit at full Health nothing happens; hit at 30% Health or less the ring throws a bug 8 cm off back and you get +50% Move speed for 5 s; hit again the same act and nothing happens. A low-health above 1 is a mistake.',
  setup() { quiet(); },
  play() {
    const { run, player } = G();
    withWords('when-hit once-per-act=#true low-health=0.3 {\n  ring 0.15 dmg=0 push=0.1\n  dash 0.5 time=5\n}');
    stub(G().enemies.world, 'cast', () => null);
    const bug = roachAt(0.08, 0), from = player.position.clone(), start = away(bug, from);
    hitJelly(1);
    const healthy = away(bug, from) === start && !(run.dashT > 0);
    run.health = run.S.health * 0.2;
    hitJelly(1);
    const thrown = away(bug, from) - start > 0.06, sped = run.dashT > 4.9 && run.dashK === 0.5 && run.S.moveSpeed > run.baseStats.moveSpeed + 0.4;
    const spent = run.cooldowns();
    bug.pos.copy(player.position).add(V(0.08, 0, 0)); run.dashT = 0; run.hurtCd = {};
    const again = away(bug, from);
    hitJelly(1);
    const once = away(bug, from) === again && !(run.dashT > 0);
    run.onceUsed.clear();   // a later act starts fresh (Run is made again for each act)
    hitJelly(1);
    const next = away(bug, from) > again + 0.06;
    return ok(healthy && thrown && sped && once && next && !!mistake('when-hit low-health=2 {\n  ring 0.1\n}'), { healthy, thrown, sped, once, next, spent: Object.keys(spent).length });
  },
});

// ------------------------------------------------------------------ Wind's pool, as content
const SAYS = {
  cyclone: (m) => m.timed.some((T) => T.every === 5 && T.effects[0].kind === 'whirl' && T.effects[0].radius === 0.09 && T.effects[0].time === 1.6),
  bowling: (m) => m.pushedHits === true,
  tailwind: (m) => m.buffs.some((b) => b.event === 'hit' && b.stat === 'moveSpeed' && b.amount === 30 && b.percent && b.time === 2),
  updraft: (m) => m.landingShockwave?.radius === 0.12 && m.landingShockwave.push === 0.06 && m.landingShockwave.dmg === 0,
  gale: (m) => m.element.wind.pierce === 100 && Math.abs(m.element.wind.falloff - 0.2) < 1e-9,
  slipstream: (m) => m.whiles.some((c) => c.when === 'moving' && c.stat === 'dodge' && c.amount === 20),
  crosswind: (m) => m.element.wind.count === 1 && m.element.wind.angle === 30,
  eyeOfTheStorm: (m) => m.timed.some((T) => T.every === 2 && T.effects[0].kind === 'ring' && T.effects[0].radius === 0.06 && T.effects[0].push === 0.04 && T.effects[0].dmg === 0),
  slamDunk: (m) => m.element.wind.collision === 3,
  secondWind: (m) => m.onHurt.some((H) => H.oncePerAct && H.lowHealth === 0.3 && H.effects[0].kind === 'ring' && H.effects[1].kind === 'dash' && H.effects[1].speed === 0.5 && H.effects[1].time === 5),
  jetStream: (m) => Math.abs(m.element.wind.speed - 1.5 * 1.6 / 0.57) < 1e-9 && m.element.wind.range === 1.5,
  glide: (m) => m.glide?.fall === 0.2 && m.glide.push === 2,
};
story('upgrades/wind-pool', {
  about: 'Wind has exactly 12 Attack upgrades, each setting what its text says (Gale\'s unlimited pierce and falloff, Glide\'s drift, Second Wind\'s once-an-act ring and dash…) and nothing before it is taken; a Wind run is offered only those, a Fire run none of them.',
  setup() { fresh({ types: 'wind' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'wind').map((u) => u.id);
    for (const id of WIND_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    const offered = new Set();
    stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => offered.add(c.id)));
    for (let i = 0; i < 40; i++) run.pickUpgrade({ id: 2 }, () => {});
    const own = [...offered].every((id) => WIND_POOL.includes(id)) && offered.size === 12;
    fresh({ types: 'fire' });
    const fireOffered = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireOffered.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean = [...fireOffered].every((id) => !WIND_POOL.includes(id));
    fresh();
    return ok(!wrong.length && pool.length === 12 && pool.every((id) => WIND_POOL.includes(id)) && own && clean, { wrong, pool: pool.length, own, offered: offered.size, clean });
  },
});

// ------------------------------------------------------------------ what each upgrade does
story('upgrades/wind-gale-and-jet-stream', {
  about: 'Gale: a gust goes through any number of bugs and each takes 20% less than the one before (6.9, 5.52, 4.4…); without it a gust stops after 3. Jet Stream: gusts fly 50% faster and the jelly sees bugs 50% farther (54 cm, not 36).',
  setup() { setupFight({ types: 'wind', bubbles: false }); },
  play() {
    const { run } = G(), B = run.bubbles;
    take('gale');
    const bugs = [roachAt(0, -0.12), roachAt(0, -0.2), roachAt(0, -0.28), roachAt(0, -0.36)], b = gust(bugs[0], { pierce: 1 + run.mods.element.wind.pierce });
    const dealt = [];
    stub(G().enemies.world, 'cast', () => null);
    const log = record('damage_taken');
    for (const e of bugs) { b.hit.add(e); B.strike(b, e, run.mods); }
    for (const d of log) if (d.source === 'bubble') dealt.push(d.amount);
    const falling = dealt.length === 4 && dealt.every((a, i) => Math.abs(a - 6.9 * 0.8 ** i) < 1e-9);
    // Jet Stream: the shot and its reach
    take('jetStream');
    const P = B.mainParams('wind', run.mods), far = roachAt(0, -0.5), blows = spy(B, 'blow');
    const sees = B.inRange(run.player.position.clone().setY(run.player.position.y + 0.1), run.S.range * P.range).includes(far);
    take();
    const seesNot = !B.inRange(run.player.position.clone().setY(run.player.position.y + 0.1), run.S.range * B.mainParams('wind', run.mods).range).includes(far);
    take('jetStream');
    B.elementVolley('wind', B.mainParams('wind', run.mods), run.player.position.clone().setY(run.player.position.y + 0.1), run.S, run.mods);
    const shot = blows.find((c) => c[2].tint === 'wind')?.[2], faster = Math.abs(shot.speed - 1.5 * 1.6 / 0.57) < 1e-9;
    return ok(falling && sees && seesNot && faster, { dealt, sees, seesNot, speed: shot?.speed });
  },
});

story('upgrades/wind-crosswind', {
  about: 'Crosswind: each volley fires a second gust 30° off the first (give or take its usual 3° of spread) that flies straight on instead of steering back to the bug; the first still goes at the bug. Without it the volley is one gust.',
  setup() { setupFight({ types: 'wind', bubbles: false }); },
  play() {
    const { run, player } = G(), B = run.bubbles, origin = player.position.clone().setY(player.position.y + 0.1);
    const bug = roachAt(0, -0.2);
    const volley = (upgrades) => {
      take(...upgrades); B.list.forEach((b) => B.release(b, true)); B.list = [];
      B.elementVolley('wind', B.mainParams('wind', run.mods), origin, run.S, run.mods);
      return B.list.slice();
    };
    const [one] = [volley([])], two = volley(['crosswind']);
    const angle = two.length === 2 ? Math.acos(Math.max(-1, Math.min(1, two[0].vel.clone().setY(0).normalize().dot(two[1].vel.clone().setY(0).normalize())))) * 180 / Math.PI : 0;
    return ok(one.length === 1 && two.length === 2 && angle > 21 && angle < 39 && two[0].homing === true && two[1].homing === false && two[1].target === bug, { one: one.length, two: two.length, angle, homing: two.map((b) => b.homing) });
  },
});

story('upgrades/wind-tailwind', {
  about: 'Tailwind: a gust that hits gives +30% Move speed for 2 s (it does not stack), then it is gone; Eye of the Storm: every 2 s a ring pushes a bug 4 cm off 4 cm further out and leaves one 20 cm off.',
  setup() { quiet(); },
  play() {
    const { run } = G();
    take('tailwind');
    const base = run.S.moveSpeed, bug = roachAt(0, -0.2);
    const hit = () => bus.emit('damage_taken', { targetId: bug.id, amount: 1, source: 'bubble', feedback: { element: 'wind' } });
    hit(); hit();
    const boosted = run.S.moveSpeed, want = base + run.baseStats.moveSpeed * 0.3;
    step(60 * 2.2);
    const gone = Math.abs(run.S.moveSpeed - base) < 1e-9;
    // Eye of the Storm
    quiet();
    take('eyeOfTheStorm');
    const close = roachAt(0.04, 0), far = roachAt(0.2, 0), from = G().player.position.clone(), c0 = away(close, from), f0 = away(far, from);
    step(60 * 2);
    return ok(Math.abs(boosted - want) < 1e-9 && gone && away(close, from) - c0 > 0.03 && Math.abs(away(far, from) - f0) < 0.005, { base, boosted, want, gone, pushed: away(close, from) - c0, far: away(far, from) - f0 });
  },
});

story('types/wind-pick-card-attacks', {
  about: 'On the pick screen, the Wind card wears its look (the gale piece) and, in the centre, its jelly fires real gusts at the three roaches: they are hit, die and come back.',
  setup() {},
  play() {
    const { GAME, mainMenu, picker } = G(), live = picker.live;
    const keys = [PLAYED_KEY, BEST_KEY], was = keys.map((k) => localStorage.getItem(k));
    keys.forEach((k) => localStorage.removeItem(k)); localStorage.setItem(PLAYED_KEY, '1');   // a returning player sees the pick screen
    try {
      fresh({ types: 'wind' }); mainMenu.home = true; picker.close(); GAME.startRun();
      stub(live, 'draw', () => {});   // the pictures themselves are for screenshots (a software renderer builds shaders slowly)
      stub(live.renderer, 'compileAsync', () => Promise.resolve());
      stub(picker, 'portrait', () => '');
      picker.tick(picker.last + 16);
      let gusts = 0, hits = 0, kills = 0, dead = 0, list = live.P.enemies.list;
      const hp = (l) => l.reduce((a, b) => a + (b.dead ? 0 : b.hp), 0);
      let lowest = hp(list);
      for (let i = 0; i < 14 * 30; i++) {
        live.simulate(1 / 30);
        const now = live.P.enemies.list, n = now.filter((b) => b.dead).length;
        if (now !== list) { kills += 3 - dead; list = now; dead = 0; lowest = hp(now); } else { kills += n - dead; dead = n; lowest = Math.min(lowest, hp(now)); }
        gusts = Math.max(gusts, live.P.bubbles.list.filter((b) => b.tint === 'wind').length);
        hits = Math.max(hits, 75 - lowest);
      }
      const worn = !!live.P.worn.pieces.gale?.group.visible;
      return ok(picker.liveFor === 'wind' && gusts >= 1 && hits >= 6.9 && kills >= 1 && worn, { live: picker.liveFor, gusts, hits, kills, worn });
    } finally {
      keys.forEach((k, i) => (was[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i])));
      picker.close(); mainMenu.home = false;
    }
  },
});
