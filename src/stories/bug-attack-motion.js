// Stories: the basic bugs' attack animation (plan: enemy-attack-anim). Animation is drawn on a bug's body
// group and never moves a hit: `attacks/animation-never-moves-a-hit` replays all 17 basic attacks on a
// fixed seed and compares, with bug-attack-hits.json (recorded from main before any animation work,
// `node tools/record-bug-hits.mjs`), the frames from the attack's start to its hit test and where the
// bug stood and aimed at that moment.
import { bus } from '../events.js';
import { isMuted, setMuted } from '../sfx.js';
import { seededRandom, seedFor } from '../story-random.mjs';
import { CONTENT, compileEnemies } from '../content.js';
import { parse } from '../kdl.js';
import { LOOK } from '../look.js';
import { ENEMY_WORDS } from '../words.js';
import { TIERS, WORK, WORK_BUDGET, attackPuff, beginFrame, knobs, roll } from '../attack-motion.js';
import { G, fresh, holdJelly, near, offs, ok, spawn, stub, story, tp } from './kit.js';

// Each attack: the bug, where it starts (m from the jelly, along +x and +z), what says its attack has
// begun, and the enemies.js method that tests the hit (`aim` names the point it tests, if it has one).
// The two Dragonfly attacks are told apart by switching the other off (`off`).
const aimed = (e, at) => at;
export const ATTACKS = [
  { id: 'roach', type: 'roach', at: [0.3, 0], begin: (e) => e.pos.distanceTo(G().player.position) < 0.2, hit: 'touch' },
  { id: 'ants', type: 'ants', at: [0.3, 0], begin: (e) => e.aimT > 0, hit: 'spit', aim: aimed },
  { id: 'mosquito', type: 'mosquito', at: [0.2, 0], begin: (e) => e.state === 'windup', hit: 'bite' },
  { id: 'lanternfly', type: 'lanternfly', at: [0.3, 0], begin: (e) => e.state === 'crouch', hit: 'slam' },
  { id: 'housefly', type: 'housefly', at: [0.15, 0], begin: (e) => e.state === 'windup', hit: 'poke', aim: (e) => e.pokeAt },
  { id: 'spider', type: 'spider', at: [0.5, 0], begin: (e) => e.aimT > 0, hit: 'spit', aim: aimed },
  { id: 'millipede', type: 'millipede', at: [0.3, 0], begin: (e) => e.state === 'curl', hit: 'ballGo' },
  { id: 'ladybug', type: 'ladybug', at: [0.3, 0], begin: (e) => e.state === 'aim', hit: 'launchMissile' },
  { id: 'dragonfly-beam', type: 'dragonfly', at: [0.4, 0], begin: (e) => e.state === 'charge', hit: 'beam', off: 'whirlCd' },
  { id: 'dragonfly-whirlwind', type: 'dragonfly', at: [0.4, 0], begin: (e) => e.state === 'whirl', hit: 'whirlFling', aim: aimed, off: 'beamCd' },
  { id: 'mantis', type: 'mantis', at: [0.25, 0], begin: (e) => e.state === 'windup', hit: 'swat' },
  { id: 'worm', type: 'worm', at: [0.25, 0], begin: (e) => e.state === 'windup', hit: 'whip' },
  { id: 'beetle', type: 'beetle', at: [0.4, 0], begin: (e) => e.state === 'charge', hit: 'sparkShot', aim: aimed },
  { id: 'wasp', type: 'wasp', at: [0.3, 0], begin: (e) => e.state === 'windup', hit: 'sting' },
  { id: 'moth', type: 'moth', at: [0.3, 0], begin: (e) => e.state === 'climb', hit: 'plungeLand' },
  { id: 'firefly', type: 'firefly', at: [0.4, 0], begin: (e) => e.state === 'windup', hit: 'lob', aim: (e, c) => c.foot },
  { id: 'cicada', type: 'cicada', at: [0.3, 0], begin: (e) => e.state === 'dig', hit: 'burrowBurst' },
];
export const MAX_FRAMES = 1500;   // 25 s: the slowest (a Ladybug that flies a while first) lands inside it

const mm = (v) => Math.round(v * 1000);
const rel = (p, e) => [mm(p.x - e.pos.x), mm(p.y - e.pos.y), mm(p.z - e.pos.z)];

// One attack set up on a fixed seed, the jelly held still, for the tests and for tools/bug-reel.mjs:
// advance() steps the game one frame of dt and says where the attack is (begun: frame its first attack
// frame came, found: what its hit test saw, { frames from begun, pos: where the bug stood (mm), yaw: which
// way it faced (mrad), aim: the point it tested, from the bug (mm) }). `miss` walks the jelly off the
// line two frames after the attack begins, so the same attack goes wide. `done()` puts Math.random back.
export function stage(a, { miss = false, dt = 1 / 60, hurt = false } = {}) {
  // a page whose audio an earlier story woke changes the bugs' rolls: sounds draw pitch jitter from Math.random,
  // and a playing song gives the beat the on-beat bugs (Firefly, Cicada) wait for. So mute, and use the run's own beat
  const real = Math.random, wasMuted = isMuted(), run = G().run, song = run.song;
  setMuted(true); run.song = null;
  Math.random = seededRandom(seedFor('bug-attack:' + a.id));
  fresh({ elites: false, bubbles: false, lash: false, hurt });   // hurt: its hits land (enemies.js landed), as in play
  tp(3.2, 0.05, 3.0, 0);
  holdJelly();
  const { enemies, player } = G();
  const e = spawn(a.type, near(...a.at), { hp: 99999 });
  if (a.off) e[a.off] = 999;
  const S = { e, frame: 0, begun: -1, found: null, done: () => { Math.random = real; setMuted(wasMuted); run.song = song; } };
  const take = (aim) => { if (!S.found && S.begun >= 0) S.found = { frames: S.frame - S.begun, pos: [mm(e.pos.x), mm(e.pos.y), mm(e.pos.z)], yaw: mm(e.root.rotation.y), aim: aim ? rel(aim, e) : null }; };
  if (a.hit === 'touch') offs.push(bus.on('damage_taken', (d) => { if (d.from === e.id) take(); }));   // its touch hurt (run.js contactDamage)
  else {
    const was = enemies[a.hit];
    stub(enemies, a.hit, function (b, ...args) {
      if (b === e) take(a.aim?.(e, args[0], args[1]) || null);
      return was.call(this, b, ...args);
    });
  }
  S.advance = () => {
    G().GAME.step(dt);
    if (S.begun < 0 && !e.dead && a.begin(e)) S.begun = S.frame;
    if (miss && S.begun >= 0 && S.frame === S.begun + 2) player.position.z += 0.6;
    S.frame++;
    return S;
  };
  return S;
}

export function measure(a) {
  const S = stage(a);
  try {
    while (S.frame < MAX_FRAMES && !S.found) S.advance();
    return S.found || { frames: -1, pos: null, yaw: 0, aim: null };
  } finally { S.done(); }
}

export const measureAll = () => Object.fromEntries(ATTACKS.map((a) => [a.id, measure(a)]));

story('attacks/animation-never-moves-a-hit', {
  about: 'All 17 basic bug attacks, played on a fixed seed with the jelly held still, test their hit on the same frame after the attack begins, and from the same spot, facing and aim as when bug-attack-hits.json was recorded: attack animation never moves a hit.',
  setup() {},
  async play() {
    const fixture = await (await fetch('src/stories/bug-attack-hits.json')).json();
    const got = measureAll(), bad = [];
    for (const a of ATTACKS) {
      const want = fixture[a.id], now = got[a.id];
      const close = (p, q) => !!p === !!q && (!p || p.every((v, i) => Math.abs(v - q[i]) <= 1));   // 1 mm
      if (!want || now.frames < 0 || Math.abs(now.frames - want.frames) > 1 || !close(now.pos, want.pos) || Math.abs(now.yaw - want.yaw) > 2 || !close(now.aim, want.aim)) bad.push({ id: a.id, want, now });
    }
    return ok(!bad.length && Object.keys(fixture).length === ATTACKS.length, { bad: bad.slice(0, 4), count: bad.length, recorded: Object.keys(fixture).length });
  },
});

// ------------------------------------------------------------------ how an attack moves (src/attack-motion.js)
// Bugs whose attack still moves the old way: wave 1 of the plan converts them, then this list is empty.
const KNOWN_UNCONVERTED = ['roach', 'ants', 'lanternfly', 'housefly', 'spider', 'millipede', 'ladybug', 'dragonfly', 'mantis', 'worm', 'beetle', 'wasp', 'moth', 'firefly', 'cicada'];
// Words that set a state but aren't an attack with a build-up: the worm bursting out of the mantis once
const NOT_ATTACK_STATES = ['burst'];

// One attack filmed frame by frame on the fixed seed of `attacks/animation-never-moves-a-hit` (stage above):
// the clock and the body group's pose each frame, from before it begins until it is idle again.
function film(id = 'mosquito', { miss = false, dt = 1 / 60, far = false, also = null } = {}) {
  // its hits land on the jelly (hurt), as in play, so a landed bite is told from a miss
  const was = LOOK.vars['bug-anim-far'];
  if (far) LOOK.vars['bug-anim-far'] = '-1';   // every bug counts as far: it animates on alternate frames
  const S = stage(ATTACKS.find((a) => a.id === id), { miss, dt, hurt: true });
  const e = S.e, body = e.mesh.children[0], frames = [], other = also?.(S);
  const mats = new Map();
  e.mesh.traverse((o) => { if (o.isMesh) mats.set(o, o.material); });
  try {
    let recoiled = false;
    while (S.frame < 900) {
      S.advance();
      const A = e.atk;
      frames.push({ frame: S.frame, phase: A.phase, k: A.k, pt: A.pt, hit: A.hit, seed: e.phase, still: A.still, n: A.n, vary: A.vary, side: A.side,
        z: body.position.z, y: body.position.y, rx: body.rotation.x, rz: body.rotation.z, sz: body.scale.z,
        recolour: [...mats].some(([o, m]) => o.material !== m), other: other ? { n: other.atk.n, vary: other.atk.vary, side: other.atk.side, seed: other.phase } : null });
      if (A.phase === 'recoil') recoiled = true;
      if (recoiled && A.phase === 'idle') break;
    }
  } finally { S.done(); LOOK.vars['bug-anim-far'] = was; }
  return frames;
}
const of = (F, phase) => F.filter((f) => f.phase === phase);
const pose = (f) => [f.z, f.rx, f.rz, f.sz];
const apart = (a, b) => Math.max(...pose(a).map((v, i) => Math.abs(v - pose(b)[i])));

story('words/attack-motion', {
  about: 'attack-motion "<style>" tier="<tier>" gives a bug its attack clock (e.atk) with that style\'s and tier\'s look.css numbers; a style or tier it doesn\'t know stops loading with a message.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const e = spawn('mosquito', near(0.5, 0), { hp: 9999 });
    const K = knobs(), A = e.atk;
    const given = !!A && A.style === K.style.lunge && A.tier === K.tier.light && A.phase === 'idle';
    const plain = spawn('roach', near(-0.5, 0), { hp: 9999 }).atk === null;
    const tryIt = (src) => { try { compileEnemies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (err) { return err.message; } };
    const badStyle = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "wiggle"\n    chase 0.3\n    swat\n}');
    const badTier = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "swipe" tier="huge"\n    chase 0.3\n    swat\n}');
    const noAttack = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "nip"\n    chase 0.3\n}');
    const caught = /style must be/.test(badStyle) && /tier must be/.test(badTier) && /no attack word/.test(noAttack);
    return ok(given && plain && caught, { given, plain, badStyle, badTier, noAttack });
  },
});

story('vocabulary/every-attack-word-names-its-phases', {
  about: 'Every bug word that sets an attack state (or aims a Shot) has a `phases` line naming each of its states as build, swing, fire or recoil, so src/attack-motion.js can read its clock.',
  setup() {},
  play() {
    const problems = [];
    for (const [w, def] of Object.entries(ENEMY_WORDS)) {
      const code = def.make.toString(), states = new Set([...code.matchAll(/e\.state = '([a-z-]+)'/g)].map((m) => m[1]).filter((s) => s !== 'approach'));
      const shot = /e\.aimMax = /.test(code) && !states.size;
      if ((!states.size && !shot) || NOT_ATTACK_STATES.includes(w)) continue;
      if (!def.phases) { problems.push(`${w}: no phases line`); continue; }
      if (shot) { if (def.phases !== 'shot') problems.push(`${w}: a Shot without states names its phases 'shot'`); continue; }
      for (const s of states) if (!['build', 'swing', 'fire', 'recoil'].includes(def.phases[s])) problems.push(`${w}: state ${s} has no phase`);
    }
    return ok(!problems.length, { problems });
  },
});

story('vocabulary/every-basic-bug-has-an-attack-motion', {
  about: 'Every basic bug with an attack names how it moves (attack-motion), apart from the ones the plan\'s wave 1 has still to convert (KNOWN_UNCONVERTED, which must end up empty).',
  setup() {},
  play() {
    const attackers = new Set([...ATTACKS.map((a) => a.type), ...Object.values(CONTENT.enemies).filter((T) => T.attack).map((T) => T.id)]);
    const missing = [...attackers].filter((id) => !CONTENT.enemies[id].attackMotion && !KNOWN_UNCONVERTED.includes(id));
    const stale = KNOWN_UNCONVERTED.filter((id) => CONTENT.enemies[id]?.attackMotion);
    return ok(!missing.length && !stale.length, { missing, stale, unconverted: KNOWN_UNCONVERTED.length });
  },
});

story('motion/attack-has-three-phases', {
  about: 'A Mosquito\'s bite runs build-up, swing, recoil in that order on its attack clock, and its body\'s pose differs from its idle pose in each.',
  setup() {},
  play() {
    const F = film(), idle = F.find((f) => f.phase === 'idle');
    const order = F.map((f) => f.phase).filter((p, i, a) => p !== a[i - 1] && p !== 'idle').join(' ');
    const far = (phase) => Math.max(...of(F, phase).map((f) => apart(f, idle)));
    const differ = { build: far('build'), swing: far('swing'), recoil: far('recoil') };
    return ok(order === 'build swing recoil' && Object.values(differ).every((d) => d > 0.05), { order, differ });
  },
});

story('motion/build-up-holds-its-pose', {
  about: 'A Mosquito reaches its drawn-back, reared pose by 80% of its wind-up and holds it to the end (only the tension quiver moves).',
  setup() {},
  play() {
    const B = of(film(), 'build'), end = B.at(-1), late = B.filter((f) => f.k >= 0.8);
    const drift = Math.max(...late.map((f) => Math.abs(f.z - end.z)));
    return ok(late.length >= 3 && end.z < -0.2 && drift < 0.02, { frames: B.length, held: late.length, drawnBack: +end.z.toFixed(3), drift: +drift.toFixed(4) });
  },
});

story('motion/a-miss-recovers-differently', {
  about: 'A Mosquito whose bite lands bounces back squashed; one that misses carries on past and rolls, so the moment to hit back shows on the bug.',
  setup() {},
  play() {
    const H = of(film(), 'recoil'), M = of(film('mosquito', { miss: true }), 'recoil');
    const at = (R, k) => R.find((f) => f.k >= k) || R.at(-1);
    const h = at(H, 0.05), m = at(M, 0.05);
    const landed = H[0]?.hit && h.z < -0.2 && h.sz < 0.95, missed = M[0] && !M[0].hit && m.z > 0.05 && Math.abs(m.rz) > 0.2;
    return ok(landed && missed, { hit: { z: +h.z.toFixed(3), squash: +h.sz.toFixed(3) }, miss: { z: +m.z.toFixed(3), roll: +m.rz.toFixed(3), hit: M[0]?.hit } });
  },
});

story('motion/recoil-ends-ready', {
  about: 'Hit or miss, a Mosquito is back in its ready stance (no pull-back, roll or squash) over the last fifth of its rest: the punish window is honest.',
  setup() {},
  play() {
    const worst = {};
    for (const miss of [false, true]) {
      const late = of(film('mosquito', { miss }), 'recoil').filter((f) => f.k >= 0.8);
      worst[miss ? 'miss' : 'hit'] = late.length ? +Math.max(...late.map((f) => Math.max(Math.abs(f.z), Math.abs(f.sz - 1)))).toFixed(4) : null;
    }
    return ok(Object.values(worst).every((w) => w !== null && w < 0.03), worst);
  },
});

story('motion/half-rate-shows-the-same-pose', {
  about: 'A far Mosquito (its anim run on alternate frames with both frames\' time) shows the same attack pose as a near one on the frames it is drawn: poses are a function of the attack clock.',
  setup() {},
  play() {
    const N = film(), F = film('mosquito', { far: true });
    let worst = 0, compared = 0;
    for (let i = 0; i < Math.min(N.length, F.length); i++) {
      const a = N[i], b = F[i];
      if (a.phase === 'idle' || a.phase !== b.phase || !i || apart(b, F[i - 1]) === 0) continue;   // only frames the far one was drawn on
      worst = Math.max(worst, Math.abs(a.z - b.z), Math.abs(a.sz - b.sz));
      compared++;
    }
    return ok(compared > 10 && worst < 0.01, { compared, worst: +worst.toFixed(4) });
  },
});

story('motion/attack-pose-is-the-same-at-30-and-60', {
  about: 'A Mosquito\'s bite poses the same at 30 and 60 frames a second: at matching points of its attack clock its body is drawn back, stretched and squashed alike.',
  setup() {},
  play() {
    const S = film('mosquito', { dt: 1 / 30 }), Q = film();
    let worst = 0, compared = 0, at = null;
    for (const f of S) {
      if (f.phase === 'idle' || f.phase === 'swing') continue;   // (a swing is two or three frames at 30: its contact is proven by the hit fixture)
      const g = of(Q, f.phase).reduce((b, q) => (Math.abs(q.pt - f.pt) < Math.abs(b.pt - f.pt) ? q : b), { pt: 9 });
      if (Math.abs(g.pt - f.pt) > 0.009) continue;
      const d = Math.max(Math.abs(f.z - g.z), Math.abs(f.sz - g.sz));
      if (d > worst) { worst = d; at = { phase: f.phase, k30: +f.k.toFixed(3), k60: +g.k.toFixed(3), pt30: +f.pt.toFixed(3), pt60: +g.pt.toFixed(3), z30: +f.z.toFixed(3), z60: +g.z.toFixed(3), hit: [f.hit, g.hit] }; }
      compared++;
    }
    return ok(compared > 5 && worst < 0.03, { compared, worst: +worst.toFixed(4), at });
  },
});

story('motion/attacks-never-recolour-the-bug', {
  about: 'No material on an attacking Mosquito changes through its build-up and swing: no flash, blink or colour change on a bug that attacks (the owner\'s rule; only being hit flashes it white).',
  setup() {},
  play() {
    const F = film().filter((f) => f.phase === 'build' || f.phase === 'swing');
    const recoloured = F.filter((f) => f.recolour).length;
    return ok(F.length > 10 && !recoloured, { frames: F.length, recoloured });
  },
});

story('motion/bigger-bugs-move-bigger', {
  about: 'The attack tiers (fodder, light, mid, heavy) stretch further and hold contact longer as they go up, and the heavy tier never bounces.',
  setup() {},
  play() {
    const K = knobs(), T = TIERS.map((t) => K.tier[t]);
    const rising = (key) => T.every((x, i) => i === 0 || x[key] >= T[i - 1][key]);
    const heavy = K.tier.heavy;
    return ok(rising('stretch') && rising('contact') && T[3].stretch > T[0].stretch && !heavy.bounce && heavy.over === 0, { stretch: T.map((x) => x.stretch), contact: T.map((x) => x.contact), heavyBounces: heavy.bounce, heavyOver: heavy.over });
  },
});

story('motion/no-two-bugs-move-in-step', {
  about: 'Two Mosquitoes biting together roll their own size and lean for each attack, and the same seed replays the same rolls.',
  setup() {},
  play() {
    const twin = (S) => spawn('mosquito', near(-0.2, 0.05), { hp: 99999 });
    const F = film('mosquito', { also: twin }), f = F.find((x) => x.n >= 1 && x.other.n >= 1);
    const a = f && [f.vary, f.side], b = f && [f.other.vary, f.other.side];
    const differ = !!f && (Math.abs(a[0] - b[0]) > 0.005 || a[1] !== b[1]);
    const again = (seed, n) => { const R = roll({}, seed, n); return [R.vary, R.side]; };   // the same seed, the same roll
    const replay = !!f && again(f.seed, f.n).every((v, i) => v === a[i]) && again(f.other.seed, f.other.n).every((v, i) => v === b[i]);
    const next = !!f && again(f.seed, f.n + 1)[0] !== a[0];                                    // and its next attack rolls anew
    return ok(differ && replay && next, { first: a, second: b, replay, next });
  },
});

story('motion/stillness-before-the-strike', {
  about: 'For the last 0.1 s of its wind-up a Mosquito goes dead still: no hover bob, no quiver, its pose frozen until it darts.',
  setup() {},
  play() {
    const B = of(film(), 'build'), still = B.filter((f) => f.still);
    let moved = 0;
    for (let i = 1; i < still.length; i++) moved = Math.max(moved, Math.abs(still[i].rx - still[i - 1].rx), Math.abs(still[i].rz - still[i - 1].rz), Math.abs(still[i].y));
    return ok(still.length >= 5 && still.length <= 7 && moved < 0.005, { stillFrames: still.length, moved: +moved.toFixed(4) });
  },
});

story('engine/attack-puffs-are-capped', {
  about: 'Twenty bugs kicking up a weight puff on one frame make at most --bug-attack-puffs of them, and a far or off-screen bug (no fx passed) makes none.',
  setup() {},
  play() {
    const fx = { n: 0, puff() { this.n++; } }, e = { pos: { x: 0, y: 0, z: 0 }, r: 0.05 };
    beginFrame();
    for (let i = 0; i < 20; i++) attackPuff(fx, e);
    const first = fx.n;
    let far = 0;
    for (let i = 0; i < 20; i++) far += attackPuff(null, e) ? 1 : 0;
    beginFrame();
    attackPuff(fx, e);
    return ok(first === knobs().puffs && far === 0 && fx.n === first + 1, { first, cap: knobs().puffs, far, nextFrame: fx.n - first });
  },
});

story('engine/bug-attack-work-is-bounded', {
  about: 'One bug\'s attack motion makes no more curve calls in a frame than the budget (WORK_BUDGET in src/attack-motion.js), counted through a whole bite.',
  setup() {},
  play() {
    WORK.most = 0;
    film();
    const most = WORK.most;
    return ok(most > 0 && most <= WORK_BUDGET, { most, budget: WORK_BUDGET });
  },
});
