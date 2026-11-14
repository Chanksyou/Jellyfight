// Stories: Normal's 12 Attack upgrades (content/upgrades.kdl, docs/jelly-types phase P8n) and the words
// they brought: trap-on-hit, homing, pop-chain, wobble, focus-ramp, range-pop, orbit-misses, and new
// props on stat (no-penalty), rebound (walls-only) and echo-bubble (on="kill"). Popcorn says it with
// split-on-hit, which Split Blob brought (src/stories/poison.js).
import { bus } from '../events.js';
import { CONTENT, compileMods, compileTreasures } from '../content.js';
import { parse } from '../kdl.js';
import { G, V, offs, ok, record, roachAt, setupFight, spy, step, story, stub, tp } from './kit.js';

const NORMAL_POOL = ['doubleBubble', 'popcorn', 'bubbleTrap', 'bigBubble', 'homing', 'popChain', 'wobble', 'ricochet', 'bubbleChain', 'rapidPop', 'bigFinish', 'orbit'];

// the run's combined effects become what it owns (and its jelly's own) plus these words, until the story ends
function withWords(src) {
  const { run } = G();
  const [t] = compileTreasures(parse(`treasure "p8n" name="P8n" icon="x" text="x" {\n${src}\n}`, 'p8n.kdl'), 'p8n.kdl');
  const m = compileMods(run.owned, run.evolved || [], run.upgrades || [], run.attack ? run.jelly : null);
  for (const fx of t.effects) fx(m, 0);
  Object.defineProperty(run, 'mods', { value: m, configurable: true, writable: true });
  offs.push(() => { delete run.mods; });
  G().enemies.mods = m;
  return m;
}
const mistake = (src) => { try { compileTreasures(parse(`treasure "x" name="X" icon="x" text="x" {\n${src}\n}`, 't.kdl'), 't.kdl'); return null; } catch (e) { return e.message; } };
// a Normal run whose jelly doesn't fire by itself (what a story blows by hand still flies)
const calm = () => { setupFight({ types: 'normal' }); stub(G().run.bubbles, 'volley', () => false); };
// the word `src`, or the Attack upgrades `ids`, as the run's effects (the upgrades list must change size to be seen: see Run.mods)
const give = (ids) => { G().run.upgrades = [...ids]; };

// ------------------------------------------------------------------ the scene
const bell = () => { const { player, run } = G(); return player.position.clone().setY(player.position.y + run.cfg.height * 0.75); };
// a bug standing still at a world point (its middle there)
function bugAt(at, hp = 9999) {
  const e = roachAt(0, 0, { still: true, hp });
  e.pos.set(at.x, at.y - e.r, at.z);
  return e;
}
// one plain bubble, full Attack damage, from the bell along `dir` (or at `target`); `o` overrides
const shoot = (o = {}) => { const { run } = G(); return run.bubbles.blow(o.from || bell(), o.target || null, { size: run.S.bubbleSize, dmg: run.S.bubbleDamage, pierce: 1, dir: V(0, 0, -1), ...o }); };
// a bubble that hangs where it is
const hang = (at, o = {}) => shoot({ from: at, speed: 0.001, ...o });
const clean = () => { G().enemies.clear(); G().run.bubbles.reset(); };
// a hit as the flight loop strikes it
const hit = (e, dmg = 6, o = {}) => G().run.bubbles.strike({ elems: new Set(), tint: null, dmg, pierce: 1, vel: V(0, 0, -0.3), hit: new Set(), r: 0.0065, ...o }, e, G().run.mods);
// every damage a bug took, in order: [amount, source]
const took = (log, e) => log.filter((d) => d.targetId === e.id).map((d) => [+d.amount.toFixed(4), d.source]);
// a horizontal direction from the bell with `free` metres of open air (or with a wall between `near` and `far`)
function open(free = 0.7) {
  const { world } = G(), at = bell();
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, d = V(Math.sin(a), 0, -Math.cos(a));
    if (!world.cast(at, d, free)) return d;
  }
  return null;
}
function wall(near = 0.08, far = 0.3) {
  const { world } = G(), at = bell();
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, d = V(Math.sin(a), 0, -Math.cos(a)), h = world.cast(at, d, far);
    if (h && h.distance > near && Math.abs(h.normal.y) < 0.2) return { dir: d, hit: h };
  }
  return null;
}
// follow a bubble until it is spent: every position it was at, and the one it popped at
function follow(b, frames = 700) {
  const path = [];
  let popped = null;
  step(frames, () => { path.push(b.m.position.clone()); if (b.done) { popped = b.m.position.clone(); return true; } return false; });
  return { path, popped };
}
const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ------------------------------------------------------------------ the words
story('treasures/trap-on-hit', {
  about: 'trap-on-hit chance=1 time=1.5: a hit traps an ordinary bug in a bubble, standing still for 1.5 s, then the bubble bursts; a bug that dies bursts it too; Elites and the boss are never trapped, nor is a bug that the hit kills; chance=0 and time=0 are mistakes.',
  setup() { calm(); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    withWords('trap-on-hit chance=1 time=1.5');
    const a = roachAt(0, -0.45, { hp: 9999 });
    hit(a);
    const held0 = a.trapT, bubble = B.traps.length === 1 && B.traps[0].m.visible;
    step(20);
    const p0 = a.pos.clone();
    step(60);
    const held = a.pos.distanceTo(p0) < 1e-4;
    step(40);
    const freed = !(a.trapT > 0) && B.traps.length === 0;
    const q = a.pos.clone();
    step(30);
    const walks = a.pos.distanceTo(q) > 0.002;
    // it can be trapped again, and dying bursts the bubble
    hit(a); hit(a);
    const once = B.traps.length === 1;
    enemies.kill(a, true);
    step(2);
    const burst = B.traps.length === 0;
    // an Elite and a bug the hit kills
    const elite = enemies.addProxy({ position: V(0, 0, 0), r: 0.03, damage() {} });
    const weak = roachAt(0.2, -0.3, { hp: 5 });
    hit(elite); hit(weak);
    return ok(bubble && held0 > 1.4 && held && freed && walks && once && burst && !elite.trapT && !B.traps.length && !weak.trapT && !!mistake('trap-on-hit chance=0') && !!mistake('trap-on-hit time=0'), { bubble, held0, held, freed, walks, once, burst, elite: elite.trapT, weak: weak.trapT });
  },
});

// a bubble flying past a bug 6 cm off its line: does it hit it, and how hard did it turn
function passBy() {
  clean();
  const at = bell(), e = bugAt(at.clone().add(V(0.06, 0, -0.15)));
  const log = record('damage_taken');
  const b = shoot(), turn = [];
  let last = b.vel.clone().normalize();
  step(60, () => { const v = b.vel.clone().normalize(); turn.push(v.angleTo(last) / (1 / 60)); last = v; return b.done; });
  return { hit: log.some((d) => d.targetId === e.id && d.source === 'bubble'), turn: Math.max(...turn), speed: +b.vel.length().toFixed(3) };
}
story('treasures/homing', {
  about: 'homing 4: a bubble flying past a bug 6 cm off its line curves in and hits it, turning no faster than 4 radians a second and keeping its speed; without the word it misses; turn=0 is a mistake.',
  setup() { calm(); },
  play() {
    const off = passBy();
    withWords('homing 4');
    const on = passBy();
    return ok(!off.hit && on.hit && on.turn <= 4.05 && on.turn > 1 && Math.abs(on.speed - 0.57) < 0.01 && !!mistake('homing 0'), { off, on });
  },
});

// how far a bubble flying straight swings off its line
function swing() {
  clean();
  const dir = open(0.6), b = shoot({ dir }), side = V(-dir.z, 0, dir.x), from = b.m.position.clone();
  let lo = 0, hi = 0;
  step(40, () => { const x = b.m.position.clone().sub(from).dot(side); lo = Math.min(lo, x); hi = Math.max(hi, x); return b.done; });
  return +(hi - lo).toFixed(4);
}
story('treasures/wobble', {
  about: 'wobble 0.02: a bubble swings from side to side as it flies, about 2 cm to either side of its line; without the word it flies dead straight; width=0 is a mistake.',
  setup() { calm(); },
  play() {
    const off = swing();
    withWords('wobble 0.02');
    const on = swing();
    return ok(off < 0.001 && on > 0.02 && on < 0.045 && !!mistake('wobble 0'), { off, on });
  },
});

story('treasures/focus-ramp', {
  about: 'focus-ramp 0.1 most=0.5: each hit in a row on the same bug does 10% more than the one before, up to +50%; a hit on another bug starts the count over; most below step is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    withWords('focus-ramp 0.1 most=0.5');
    const a = roachAt(0, -0.2, { hp: 9999 }), b = roachAt(0.2, -0.2, { hp: 9999 });
    const log = record('damage_taken');
    for (let i = 0; i < 8; i++) hit(a, 6);
    hit(b, 6); hit(a, 6);
    const seq = log.map((d) => +d.amount.toFixed(3));
    const want = [6, 6.6, 7.2, 7.8, 8.4, 9, 9, 9, 6, 6];
    return ok(seq.length === want.length && seq.every((x, i) => Math.abs(x - want[i]) < 0.01) && !!mistake('focus-ramp 0.1 most=0.05'), { seq });
  },
});

// A pops on bug A, with three bubbles hanging in a row by it and one far off; each of those has its own bug beside it
function chain() {
  clean();
  const { run } = G(), B = run.bubbles, P = bell().add(V(0, 0, -0.15));
  const mk = (x) => hang(P.clone().add(V(x, 0, 0))), a = mk(0), b = mk(0.035), c = mk(0.07), far = mk(0.2);
  const own = bugAt(P.clone().add(V(-0.05, 0, 0))), nb = bugAt(P.clone().add(V(0.035, 0, -0.055))), nc = bugAt(P.clone().add(V(0.07, 0, 0.055))), nf = bugAt(P.clone().add(V(0.2, 0, -0.055)));
  const log = record('damage_taken');
  B.pop(a, own, run.S, run.mods);
  return { own: took(log, own), nb: took(log, nb), nc: took(log, nc), nf: took(log, nf), done: [a, b, c, far].map((x) => (x.done ? 1 : 0)).join('') };
}
const three = (r) => r.nb.length === 1 && r.nb[0][0] === 3 && r.nc.length === 1 && r.nc[0][0] === 3 && !r.nf.length && r.done === '1110';
story('treasures/pop-chain', {
  about: 'pop-chain 0.5: a bubble popping on a bug also pops the bubbles within 4 cm of it, each in a splash doing 50% of its damage, and those pop the ones next to them in turn; one 20 cm away stays; without the word none pop; dmg=0 is a mistake.',
  setup() { calm(); },
  play() {
    const off = chain();
    withWords('pop-chain 0.5');
    const on = chain();
    return ok(!off.nb.length && !off.nc.length && off.done === '1000' && three(on) && on.own.length === 1 && !!mistake('pop-chain 0'), { off, on });
  },
});

// one bubble flies out to the end of its Range: where it popped and whether it splashed wide
function farthest() {
  clean();
  const dir = open(0.7), blows = spy(G().run.bubbles, 'splash'), b = shoot({ dir });
  const { popped } = follow(b);
  return { popped, wide: blows.map((c) => c[1] ?? 1) };
}
// the point a plain bubble pops at (the end of its Range), found by flying one
function flown() {
  clean();
  const dir = open(0.7);
  return { dir, popped: follow(shoot({ dir })).popped };
}
// fly the same bubble again with a bug 7.5 cm off where it pops, across its line: what the bug took, and how wide each splash was
function acrossFrom(ref) {
  clean();
  const e = bugAt(ref.popped.clone().add(V(-ref.dir.z, 0, ref.dir.x).multiplyScalar(0.075))), log = record('damage_taken'), splashes = spy(G().run.bubbles, 'splash');
  follow(shoot({ dir: ref.dir }));
  return { dmg: took(log, e), wide: splashes.map((c) => c[1] ?? 1) };
}
story('treasures/range-pop', {
  about: 'range-pop 2: a bubble that flies to the end of its Range without hitting anything pops in a splash twice as wide, hurting a bug 7.5 cm to the side that a plain splash (2.6 cm) would miss; a bubble that hits a bug splashes as usual; splash=1 is a mistake.',
  setup() { calm(); },
  play() {
    const ref = flown(), plain = acrossFrom(ref);
    withWords('range-pop 2');
    const on = acrossFrom(ref);
    // a hit on a bug is an ordinary splash
    clean();
    const near = bugAt(bell().add(V(0, 0, -0.1))), splashes = spy(G().run.bubbles, 'splash');
    follow(shoot({ target: near }));
    const hitWide = splashes.map((c) => c[1] ?? 1);
    return ok(!plain.wide.length && !plain.dmg.length && on.wide.join() === '2' && on.dmg.length === 1 && on.dmg[0][0] === 2.4 && hitWide.join() === '1' && !!mistake('range-pop 1'), { plain, on, hitWide });
  },
});

// one bubble flown out and round: the frames it lasted, how far from you it got, where it went, and what a bug at `bug` took
function lap(bug) {
  clean();
  const dir = open(0.7), b = shoot({ dir });
  let e = null, log = null;
  if (bug) { e = bugAt(bug); log = record('damage_taken'); }
  const { path } = follow(b, 900), o = bell();
  return { frames: path.length, far: Math.max(...path.map((p) => horizontal(p, o))), path, hit: e ? took(log, e) : null };
}
story('treasures/orbit-misses', {
  about: 'orbit-misses: a bubble that reaches the end of its Range without popping circles you once, at that distance from you, taking about 2 pi r / speed, and hits a bug it touches on the way round; without the word it pops there; then it pops.',
  setup() { calm(); },
  play() {
    const off = lap();
    withWords('orbit-misses');
    const first = lap();
    const r = first.far, ring = first.path.slice(60).map((p) => horizontal(p, bell()));
    const round = ring.every((d) => Math.abs(d - r) < 0.03);
    const secs = first.frames / 60, lapSecs = (Math.PI * 2 * r) / 0.57;
    // a bug standing on the far side of the ring is hit by the bubble on its way round
    const on = lap(first.path[Math.round(first.path.length * 0.6)]);
    return ok(off.frames < 80 && round && secs > lapSecs * 0.9 && secs < lapSecs + 1.1 && on.hit.length === 1 && on.hit[0][1] === 'bubble', { off: off.frames, r: +r.toFixed(3), round, secs: +secs.toFixed(2), lapSecs: +lapSecs.toFixed(2), on: on.hit });
  },
});

// a bubble at a wall: does it ricochet, and which way does it go
function glance() {
  clean();
  tp(4.0, 0.05, 4.2, 0);   // a wall 15 cm off, to the +z side
  const w = wall(0.1, 0.3);
  if (!w) return null;
  const b = shoot({ dir: w.dir });
  step(120, () => b.bounces || b.done);
  const turned = Math.sign(b.vel.dot(w.hit.normal)) === -Math.sign(w.dir.dot(w.hit.normal));   // it now heads away from the wall's face it came at
  const out = { bounces: b.bounces || 0, alive: !b.done, turned };
  step(10);
  out.stillFlying = !b.done;
  return out;
}
story('treasures/rebound-walls-only', {
  about: 'rebound walls-only=#true: a bubble that hits a wall glances off it, flying on away from the wall with what is left of its Range, instead of popping; nothing comes back to you (plain rebound still does); times=0 is a mistake.',
  setup() { calm(); },
  play() {
    const { run } = G();
    const off = glance();
    const plain = withWords('rebound');
    const returns = plain.rebound && !plain.ricochet;
    withWords('rebound walls-only=#true times=1');
    const m = run.mods, on = glance();
    return ok(off && !off.bounces && !off.alive && returns && m.ricochet === 1 && !m.rebound && on && on.bounces === 1 && on.alive && on.turned && on.stillFlying && !!mistake('rebound walls-only=#true times=0'), { off, returns, on, ricochet: m.ricochet });
  },
});

story('treasures/rebound-then-ricochet', {
  about: 'Ricochet with Rebound Jelly: a bubble that hits a wall on its way out glances off it first (Ricochet), and Rebound still brings it home after; Rebound no longer swallows Ricochet.',
  setup() { calm(); },
  play() {
    withWords('rebound\nrebound walls-only=#true times=1');
    const m = G().run.mods, on = glance();
    return ok(m.rebound && m.ricochet === 1 && on && on.bounces === 1, { on });
  },
});

// three bugs in a line, the bubble at the first: how many were hit by a bubble
function ladder(hp1) {
  clean();
  const at = bell(), r1 = bugAt(at.clone().add(V(0, 0, -0.12)), hp1), r2 = bugAt(at.clone().add(V(0, 0, -0.2)), 5), r3 = bugAt(at.clone().add(V(0, 0, -0.28)));
  const log = record('damage_taken');
  shoot({ target: r1 });
  step(200);
  return [r1, r2, r3].map((e) => took(log, e).filter(([, src]) => src === 'bubble').length).join('');
}
story('treasures/echo-bubble-on-kill', {
  about: 'echo-bubble on="kill": a bubble that kills its bug flies on to the next bug within 20 cm, and that one, if it kills too, to the next; a bubble that does not kill fires nothing; plain echo-bubble fires once and stops; on="hit" and on="kill" with by="tentacles" are handled.',
  setup() { calm(); },
  play() {
    const none = ladder(5);
    withWords('echo-bubble');
    const plain = ladder(5);
    withWords('echo-bubble on="kill"');
    const kill = ladder(5), noKill = ladder(9999);
    return ok(none === '100' && plain === '110' && kill === '111' && noKill === '100' && !!mistake('echo-bubble on="sometimes"') && !!mistake('echo-bubble on="kill" by="tentacles"'), { none, plain, kill, noKill });
  },
});

story('treasures/stat-no-penalty', {
  about: 'stat bubbles 1 no-penalty=#true: the extra Attack costs the others nothing, so 2 side by side each do 6, where plain `stat bubbles 1` has them do 4.5 each; two free Attacks make 3 do 6 each; it goes with a positive amount of bubbles only.',
  setup() { setupFight({ types: 'normal' }); },
  play() {
    const { run } = G(), B = run.bubbles;
    roachAt(0, -0.1);
    const volleys = () => { const blows = spy(B, 'blow'); step(60 * 3); return [...new Set(blows.map((c) => +c[2].dmg.toFixed(2)))].join(); };
    withWords('stat bubbles 1');
    const plain = volleys();
    withWords('stat bubbles 1 no-penalty=#true');
    const free = volleys();
    withWords('stat bubbles 2 no-penalty=#true');
    const two = volleys();
    return ok(plain === '4.5' && free === '6' && two === '6' && !!mistake('stat range 1 no-penalty=#true') && !!mistake('stat bubbles -1 no-penalty=#true'), { plain, free, two });
  },
});

// ------------------------------------------------------------------ the upgrades
const SAYS = {
  doubleBubble: (m) => m.freeAttacks === 1 && m.stats.add.bubbles === 1,
  popcorn: (m) => m.split?.count === 3 && m.split.dmg === 0.3,
  bubbleTrap: (m) => m.trap?.chance === 0.125 && m.trap.time === 1.5,
  bigBubble: (m) => m.stats.pct.bubbleSize === 50,
  homing: (m) => m.homing?.turn === 4,
  popChain: (m) => m.popChain?.dmg === 0.5,
  wobble: (m) => m.wobble?.width === 0.02,
  ricochet: (m) => m.ricochet === 1 && !m.rebound,
  bubbleChain: (m) => m.bubbles.echo?.onKill === true && m.bubbles.echo.dmg === 1,
  rapidPop: (m) => m.focusRamp?.step === 0.1 && m.focusRamp.most === 0.5,
  bigFinish: (m) => m.rangePop?.splash === 2,
  orbit: (m) => m.orbitMisses === true,
};
story('upgrades/normal-pool', {
  about: 'Normal has exactly 12 Attack upgrades, each setting what its text says (Double Bubble\'s free Attack, Popcorn\'s 3 splits, Orbit, …) and nothing before it is taken; a Normal run is offered only those, all 12 of them, and a Fire run none of them.',
  setup() { setupFight({ types: 'normal' }); },
  play() {
    const { run } = G(), wrong = [], pool = CONTENT.upgrades.filter((u) => u.jelly === 'normal').map((u) => u.id);
    for (const id of NORMAL_POOL) {
      run.upgrades = [];
      let before; try { before = SAYS[id](run.mods); } catch { before = false; }
      run.upgrades = [id];
      if (before || !SAYS[id](run.mods)) wrong.push(id);
    }
    run.upgrades = [];
    const offered = new Set();
    stub(run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => offered.add(c.id)));
    for (let i = 0; i < 60; i++) run.pickUpgrade({ id: 2 }, () => {});
    const own = [...offered].every((id) => NORMAL_POOL.includes(id)) && offered.size === 12;
    setupFight({ types: 'fire' });
    const fireOffered = new Set();
    stub(G().run.ui, 'choose', (title, sub, choices) => choices.forEach((c) => fireOffered.add(c.id)));
    for (let i = 0; i < 40; i++) G().run.pickUpgrade({ id: 2 }, () => {});
    const clean2 = [...fireOffered].every((id) => !NORMAL_POOL.includes(id));
    return ok(!wrong.length && pool.length === 12 && pool.every((id) => NORMAL_POOL.includes(id)) && own && clean2, { wrong, pool: pool.length, own, offered: offered.size, clean: clean2 });
  },
});

// each upgrade in a real Normal run
const upgrade = (id, about, setup, play) => story('upgrades/' + id, { about, setup, play });
const live = () => setupFight({ types: 'normal' });

upgrade('doubleBubble', 'Double Bubble: the Normal jelly blows 2 bubbles side by side and both do full Attack damage (6, not 4.5); the Attacks stat reads 2.', live, () => {
  const { run } = G(), B = run.bubbles;
  give(['doubleBubble']);
  roachAt(0, -0.1);
  const blows = spy(B, 'blow');
  step(60 * 3);
  const dmg = [...new Set(blows.map((c) => +c[2].dmg.toFixed(2)))];
  return ok(run.S.bubbles === 2 && dmg.join() === '6' && blows.length >= 4 && blows.length % 2 === 0, { bubbles: run.S.bubbles, dmg, blows: blows.length });
});

upgrade('popcorn', 'Popcorn: every bubble that pops on a bug splits into 3 small ones for 30% of its damage each, which fly on and never split again.', live, () => {
  const { run } = G();
  give(['popcorn']);
  const a = roachAt(0, -0.08), log = record('damage_taken'), blows = spy(run.bubbles, 'blow');
  step(60 * 2);
  const full = run.S.bubbleDamage, parents = log.filter((d) => d.targetId === a.id && d.source === 'bubble' && Math.abs(d.amount - full) < 1e-9).length;
  const halves = blows.filter((c) => Math.abs(c[2].dmg - full * 0.3) < 1e-9).length;
  return ok(parents >= 2 && halves === 3 * parents, { parents, halves });
});

upgrade('bubbleTrap', 'Bubble Trap: about 1 hit in 8 traps the bug in a bubble for 1.5 s (it stands still); 160 hits trap somewhere between 4 and 45 bugs.', calm, () => {
  const { run } = G(), B = run.bubbles;
  give(['bubbleTrap']);
  const a = roachAt(0, -0.4, { hp: 9999 }), traps = spy(B, 'trapBug');
  for (let i = 0; i < 160; i++) { hit(a); step(1); }
  const times = new Set(traps.map((c) => c[1]));
  return ok(traps.length >= 4 && traps.length <= 45 && times.size === 1 && times.has(1.5), { traps: traps.length });
});

upgrade('bigBubble', 'Big Bubble: Attack size is 50% bigger, so each bubble is 1.5 times as wide (and its splash with it).', live, () => {
  const { run } = G(), B = run.bubbles, RADIUS = 0.0065;
  const before = run.S.bubbleSize;
  give(['bigBubble']);
  roachAt(0, -0.1);
  step(40);
  const b = B.list[0];
  return ok(before === 1 && Math.abs(run.S.bubbleSize - 1.5) < 1e-9 && b && Math.abs(b.r - RADIUS * 1.5) < 1e-6, { before, size: run.S.bubbleSize, r: b?.r });
});

upgrade('homing', 'Homing: a bubble flying past a bug 6 cm off its line curves in and hits it, where it missed before; it keeps its speed.', calm, () => {
  const off = passBy();
  give(['homing']);
  const on = passBy();
  return ok(!off.hit && on.hit && Math.abs(on.speed - 0.57) < 0.01, { off, on });
});

upgrade('popChain', 'Pop Chain: a bubble popping on a bug pops the bubbles within 4 cm of it, and theirs in turn, each in a splash for 50% of its damage; one 20 cm off stays.', calm, () => {
  const off = chain();
  give(['popChain']);
  const on = chain();
  return ok(!off.nb.length && three(on), { off, on });
});

upgrade('wobble', 'Wobble: bubbles swing about 2 cm to either side of their line as they fly.', calm, () => {
  const off = swing();
  give(['wobble']);
  const on = swing();
  return ok(off < 0.001 && on > 0.02 && on < 0.045, { off, on });
});

upgrade('ricochet', 'Ricochet: a bubble that hits a wall glances off it and flies on, once, where it used to pop.', calm, () => {
  const off = glance();
  give(['ricochet']);
  const on = glance();
  return ok(off && !off.alive && on && on.bounces === 1 && on.alive && on.turned && on.stillFlying, { off, on });
});

upgrade('bubbleChain', 'Bubble Chain: a bubble that kills its bug flies on to the next one within 20 cm, and so on down a line; one that does not kill fires nothing.', calm, () => {
  const off = ladder(5);
  give(['bubbleChain']);
  const kill = ladder(5), noKill = ladder(9999);
  return ok(off === '100' && kill === '111' && noKill === '100', { off, kill, noKill });
});

upgrade('rapidPop', 'Rapid Pop: each hit in a row on the same bug does 10% more, up to +50%: 6, 6.6, 7.2, 7.8, 8.4, then 9 a hit.', live, () => {
  const { run } = G();
  give(['rapidPop']);
  const a = roachAt(0, -0.1), log = record('damage_taken');
  step(60 * 5);
  const seq = log.filter((d) => d.targetId === a.id && d.source === 'bubble').map((d) => +d.amount.toFixed(3)), want = [6, 6.6, 7.2, 7.8, 8.4, 9];
  return ok(seq.length > 7 && want.every((x, i) => Math.abs(seq[i] - x) < 0.01) && seq.slice(6).every((x) => Math.abs(x - 9) < 0.01) && run.S.bubbleDamage === 6, { seq });
});

upgrade('bigFinish', 'Big Finish: a bubble that flies to the end of its Range and pops in the air splashes twice as wide, hurting a bug 7.5 cm off that a plain splash would miss.', calm, () => {
  const ref = flown(), off = acrossFrom(ref);
  give(['bigFinish']);
  const on = acrossFrom(ref);
  return ok(!off.dmg.length && on.dmg.length === 1 && on.dmg[0][0] === 2.4, { off, on });
});

upgrade('orbit', 'Orbit: a bubble that reaches the end of its Range without popping circles you once instead, and hits a bug standing on its ring.', calm, () => {
  const off = lap();
  give(['orbit']);
  const first = lap(), on = lap(first.path[Math.round(first.path.length * 0.6)]);
  return ok(off.frames < 80 && first.frames > 250 && on.hit.length === 1 && on.hit[0][1] === 'bubble', { off: off.frames, frames: first.frames, on: on.hit });
});

story('treasures/flight-combos', {
  about: 'The words that share the flight loop work together: Rebound (bubbles coming home) with orbit-misses, and rebound walls-only with orbit-misses and homing, leave no bubble flying after 15 s, and an orbiting bubble still laps once.',
  setup() { calm(); },
  play() {
    const { run } = G(), B = run.bubbles;
    withWords('rebound\norbit-misses');
    const out = shoot({ dir: open(0.7) });
    step(70);
    out.t = 1e3;   // it has been out far too long (stuck on its way home): the timed-out path
    step(60 * 15);
    const home = !B.list.length && !!out;
    clean();
    withWords('rebound walls-only=#true times=1\norbit-misses\nhoming 4');
    const w = (tp(4.0, 0.05, 4.2, 0), wall(0.1, 0.3));
    shoot({ dir: w.dir }); shoot({ dir: open(0.7) });
    step(60 * 15);
    return ok(home && !B.list.length, { home, left: B.list.length });
  },
});
