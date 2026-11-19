// Stories: the basic bugs' attack animation (plan: enemy-attack-anim). Animation is drawn on a bug's body
// group and never moves a hit: `attacks/animation-never-moves-a-hit` replays all 17 basic attacks on a
// fixed seed and compares, with bug-attack-hits.json (recorded from main before any animation work,
// `node tools/record-bug-hits.mjs`), the frames from the attack's start to its hit test and where the
// bug stood and aimed at that moment.
import * as THREE from 'three';
import { bus } from '../events.js';
import { isMuted, setMuted } from '../sfx.js';
import { seededRandom, seedFor } from '../story-random.mjs';
import { CONTENT, compileEnemies } from '../content.js';
import { parse } from '../kdl.js';
import { LOOK } from '../look.js';
import { ENEMY_WORDS } from '../words.js';
import { TIERS, WORK, WORK_BUDGET, attackClock, attackPuff, beginFrame, knobs, newAttack, roll } from '../attack-motion.js';
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
const KNOWN_UNCONVERTED = ['roach', 'ants', 'spider', 'ladybug', 'dragonfly', 'beetle', 'firefly'];
// Words that set a state but aren't an attack with a build-up: the worm bursting out of the mantis once
const NOT_ATTACK_STATES = ['burst'];

// One attack filmed frame by frame on the fixed seed of `attacks/animation-never-moves-a-hit` (stage above):
// the clock and the body group's pose each frame, from before it begins until it is idle again (and `probe(e)`,
// numbers read off the model each frame: a part the body group doesn't carry, like the worm's tip).
function film(id = 'mosquito', { miss = false, dt = 1 / 60, far = false, also = null, probe = null } = {}) {
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
        recolour: [...mats].some(([o, m]) => o.material !== m), other: other ? { n: other.atk.n, vary: other.atk.vary, side: other.atk.side, seed: other.phase } : null,
        p: probe ? probe(e) : [], at: [e.pos.x, e.pos.y, e.pos.z], key: A.key, from: e.emergeAt ? [e.emergeAt.x, e.emergeAt.y, e.emergeAt.z] : null,
        dir: (e.whipDir || e.swatDir) ? [(e.whipDir || e.swatDir).x, (e.whipDir || e.swatDir).z] : null, floor: e.whipFloor ?? e.pos.y });
      if (A.phase === 'recoil') recoiled = true;
      if (recoiled && A.phase === 'idle') break;
    }
  } finally { S.done(); LOOK.vars['bug-anim-far'] = was; }
  return frames;
}
const of = (F, phase) => F.filter((f) => f.phase === phase);
// where a part of a bug's model is in the world (m), this frame
const W = new THREE.Vector3();
const world = (o, x = 0, y = 0, z = 0) => { o.updateWorldMatrix(true, false); return W.set(x, y, z).applyMatrix4(o.matrixWorld); };
// the Praying mantis's foreleg hooks (each tibia's tip), and how far they are swung in (crossed)
const hooks = (e) => { const L = []; e.mesh.traverse((o) => { if (o.name === 'foreleg') L.push(o); }); return L; };
const mantisProbe = (e) => { const L = hooks(e), out = [Math.abs(L[0].parent.parent.rotation.y)]; for (const o of L) { const p = world(o, 0, -0.06, 0.44); out.push(p.x, p.y, p.z); } return out; };
// the Horsehair worm's tip (its last piece), in the world as its pose draws it (without the squash every bug
// takes when its hit lands, e.recoil, which scales the whole model for 0.2 s)
const UP = new THREE.Vector3(0, 1, 0);
const wormProbe = (e) => { const C = e.mesh.children, p = W.copy(C[C.length - 1].position).applyAxisAngle(UP, e.root.rotation.y).multiplyScalar(e.r).add(e.pos); return [p.x, p.y, p.z]; };
// parts a converted bug's body group doesn't carry, read by the stories below
const PROBES = { mantis: mantisProbe, worm: wormProbe };
const pose = (f) => [f.z, f.rx, f.rz, f.sz, ...f.p];
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

// the bugs converted to an attack-motion, each filmed through one attack
const CONVERTED = ['mosquito', 'housefly', 'wasp', 'lanternfly', 'moth', 'cicada', 'mantis', 'worm', 'millipede'];
// a Wasp that stings dies doing it, so only its miss has a recoil to film
const filmed = (id, o = {}) => film(id, { miss: id === 'wasp', probe: PROBES[id], ...o });
story('motion/attack-has-three-phases', {
  about: 'Each converted bug\'s attack (the Mosquito\'s bite, the House fly\'s poke, the Wasp\'s dive, the Spotted lanternfly\'s leap, the Moth\'s plunge, the Cicada\'s burrow, the Praying mantis\'s swat, the Horsehair worm\'s whip, the Giant millipede\'s roll) runs build-up, swing, recoil in that order on its attack clock, and its body\'s pose differs from its idle pose in each.',
  setup() {},
  play() {
    const out = {};
    for (const id of CONVERTED) {
      const F = filmed(id), idle = F.find((f) => f.phase === 'idle');
      const order = F.map((f) => f.phase).filter((p, i, a) => p !== a[i - 1] && p !== 'idle').join(' ');
      const far = (phase) => +Math.max(...of(F, phase).map((f) => Math.max(apart(f, idle), Math.abs(f.y - idle.y)))).toFixed(3);   // (its height too: a Cicada sinks)
      out[id] = { order, build: far('build'), swing: far('swing'), recoil: far('recoil') };
    }
    return ok(Object.values(out).every((o) => o.order === 'build swing recoil' && o.build > 0.05 && o.swing > 0.05 && o.recoil > 0.05), out);
  },
});

story('motion/contact-pose-is-on-the-hit', {
  about: 'On its contact pose the striking part is drawn where the hit is tested: a Praying mantis\'s foreleg hooks lie inside the wedge its swat tests, a Horsehair worm\'s tip lies on the floor at the end of the line its whip tests (within 1 cm), low enough that a jump still clears it, a House fly\'s straw tip is on the spot its poke tests (within 1 cm), and a Wasp\'s sting tip is on the jelly (within 1 cm of its surface) with its body where the bug really is, on the frame its sting is tested.',
  setup() {},
  async play() {
    const kdl = parse(await (await fetch('content/enemies.kdl')).text());
    const props = (bug, word) => kdl.find((n) => n.args[0] === bug).children.find((w) => w.name === word).props;
    const swat = props('mantis', 'swat'), whip = props('worm', 'whip');
    // the mantis: every frame of its contact hold (a landed swing whose pose is frozen)
    const M = film('mantis', { probe: mantisProbe }), held = M.filter((f, i) => f.phase === 'swing' && f.hit && i && M[i - 1].phase === 'swing' && M[i - 1].pt === f.pt);
    let mantis = held.length ? 0 : 9;
    for (const f of held) {
      for (let j = 1; j < f.p.length; j += 3) {
        const dx = f.p[j] - f.at[0], dz = f.p[j + 2] - f.at[2], d = Math.hypot(dx, dz);
        const off = Math.acos(Math.max(-1, Math.min(1, (dx * f.dir[0] + dz * f.dir[1]) / (d || 1))));
        mantis = Math.max(mantis, d - (swat.reach + 0.01), off > (swat.arc / 2) * Math.PI / 180 ? 1 : 0);
      }
    }
    // the worm: on the frame it cracks down (the hit test) and through its contact hold
    const F = film('worm', { probe: wormProbe }), at = F.findIndex((f) => f.key === 'down');
    const tips = F.filter((f, i) => i >= at && f.phase === 'swing' && (i === at || f.hit && F[i - 1].pt === f.pt));
    let worm = tips.length ? 0 : 9;
    for (const f of tips) {
      const along = Math.hypot(f.p[0] - f.from[0], f.p[2] - f.from[2]);
      const side = Math.abs((f.p[0] - f.from[0]) * f.dir[1] - (f.p[2] - f.from[2]) * f.dir[0]);
      worm = Math.max(worm, Math.abs(along - whip.reach) - 0.01, side - 0.01, f.p[1] - f.floor - 0.03);
    }
    // the House fly's straw tip and the Wasp's sting tip: on the frame their hit is tested
    const out = {}, v = new THREE.Vector3(), tipAt = (e) => { e.mesh.updateWorldMatrix(true, true); return e.mesh.getObjectByName('tip').getWorldPosition(v); };
    {
      const S = stage(ATTACKS.find((a) => a.id === 'housefly'), { hurt: true });
      try {
        while (S.frame < MAX_FRAMES && !S.found) S.advance();
        const e = S.e;
        out.housefly = { found: !!S.found, phase: e.atk.phase, tipOff: mm(tipAt(e).distanceTo(e.pokeAt)) };
      } finally { S.done(); }
    }
    {   // (and when the jelly strafes after the aim locks, so the fly's facing lags the spot it tests)
      const S = stage(ATTACKS.find((a) => a.id === 'housefly'), { hurt: true });
      try {
        while (S.frame < MAX_FRAMES && !S.found) { S.advance(); if (S.begun >= 0 && S.frame === S.begun + 9) G().player.position.z += 0.05; }
        const e = S.e;
        out.strafed = { found: !!S.found, tipOff: mm(tipAt(e).distanceTo(e.pokeAt)) };
      } finally { S.done(); }
    }
    {
      let seen = null;
      // (its hit test is the sting call, and the sting kills it: look at it as it is called)
      const a = { ...ATTACKS.find((x) => x.id === 'wasp'), aim: (e, c) => {
        const pc = c.realPc || c.pc, body = e.mesh.children[0];
        e.mesh.updateWorldMatrix(true, true);
        const mesh = e.mesh.getWorldPosition(new THREE.Vector3()), b = body.getWorldPosition(new THREE.Vector3());
        seen = { phase: e.atk.phase, drawnOff: mm(b.distanceTo(mesh)), tipFromSurface: mm(tipAt(e).distanceTo(pc) - (G().enemies.playerRadius || 0.03)) };
        return null;
      } };
      const S = stage(a, { hurt: true });
      try {
        while (S.frame < MAX_FRAMES && !S.found) S.advance();
        out.wasp = { found: !!S.found, ...seen };
      } finally { S.done(); }
    }
    const bugs = out.housefly.found && out.housefly.phase === 'swing' && out.housefly.tipOff <= 10 && out.strafed.found && out.strafed.tipOff <= 10 && out.wasp.found && out.wasp.phase === 'swing' && out.wasp.drawnOff <= 10 && Math.abs(out.wasp.tipFromSurface) <= 10;
    return ok(held.length >= 2 && mantis <= 0 && tips.length >= 2 && worm <= 0 && bugs, { mantisHeld: held.length, mantisOutside: +mantis.toFixed(4), wormFrames: tips.length, wormOff: +worm.toFixed(4), ...out });
  },
});

story('motion/landing-pose-is-on-the-hit', {
  about: 'On the frame a Spotted lanternfly, Moth or Cicada comes down and its hit is tested, its drawn body is where the bug really is and over the spot the hit is tested round (within 1 cm across): a landing pose never shows it somewhere its hit is not.',
  setup() {},
  play() {
    const out = {}, v = new THREE.Vector3();
    for (const [id, spot] of [['lanternfly', (e) => e.pos], ['moth', (e) => e.plungeAt], ['cicada', (e) => e.burrowAt]]) {
      const S = stage(ATTACKS.find((a) => a.id === id), { hurt: true });
      try {
        while (S.frame < MAX_FRAMES && !S.found) S.advance();
        const e = S.e, body = e.mesh.children[0], at = spot(e);
        e.mesh.updateWorldMatrix(true, true);
        body.getWorldPosition(v);
        out[id] = { found: !!S.found, phase: e.atk.phase, across: mm(Math.hypot(v.x - at.x, v.z - at.z)), drawnOff: mm(v.distanceTo(e.mesh.getWorldPosition(new THREE.Vector3()))) };
      } finally { S.done(); }
    }
    return ok(Object.values(out).every((o) => o.found && o.phase === 'swing' && o.across <= 10 && o.drawnOff <= 10), out);
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
  about: 'A Mosquito whose bite lands bounces back squashed; one that misses carries on past and rolls. A House fly whose poke lands rocks its head back; one that misses tips forward off balance. A Praying mantis whose swat misses leaves its forelegs crossed and stuck out --bug-attack-mantis-stuck s longer than one that lands. So the moment to hit back shows on the bug.',
  setup() {},
  play() {
    const H = of(film(), 'recoil'), M = of(film('mosquito', { miss: true }), 'recoil');
    const at = (R, k) => R.find((f) => f.k >= k) || R.at(-1);
    const h = at(H, 0.05), m = at(M, 0.05);
    const landed = H[0]?.hit && h.z < -0.2 && h.sz < 0.95, missed = M[0] && !M[0].hit && m.z > 0.05 && Math.abs(m.rz) > 0.2;
    // the House fly: landed, its head rocks back (nose up, drawn back); missed, it tips forward off balance
    // (the fly hovers against the jelly, so its touch is switched off: only the poke can hurt, or miss)
    const noTouch = () => { stub(G().run, 'contactDamage', () => {}); return null; };
    const FH = of(film('housefly', { also: noTouch }), 'recoil'), FM = of(film('housefly', { miss: true, also: noTouch }), 'recoil');
    const lo = (R, key) => Math.min(...R.map((f) => f[key])), hi = (R, key) => Math.max(...R.map((f) => f[key]));
    const flyHit = FH[0]?.hit && lo(FH, 'rx') < -0.1 && lo(FH, 'z') < -0.1, flyMiss = FM[0] && !FM[0].hit && hi(FM, 'rx') > 0.25 && hi(FM, 'z') > 0.05 && hi(FM, 'rz') > 0.1;
    // the mantis: how far its forelegs are still swung in (crossed), 0.1 s after the follow-through hold
    const when = knobs().style.swipe.follow + 0.1, near = (R) => R.reduce((b, f) => (Math.abs(f.pt - when) < Math.abs(b.pt - when) ? f : b), { pt: 9, p: [0] });
    const MH = of(film('mantis', { probe: mantisProbe }), 'recoil'), MM = of(film('mantis', { miss: true, probe: mantisProbe }), 'recoil');
    const full = 0.3 - 0.08;   // fully crossed: the shoulders swung in 0.3 past their 0.08 rest (buildMantis)
    const ch = near(MH).p[0], cm = near(MM).p[0], back = MM.at(-1)?.p[0] ?? 9;
    const stuck = MH[0]?.hit && MM[0] && !MM[0].hit && cm >= full - 0.01 && ch < cm - 0.03 && Math.abs(back - 0.08) < 0.02;   // and it does uncross
    return ok(landed && missed && stuck && flyHit && flyMiss, { hit: { z: +h.z.toFixed(3), squash: +h.sz.toFixed(3) }, miss: { z: +m.z.toFixed(3), roll: +m.rz.toFixed(3), hit: M[0]?.hit }, mantis: { landedCross: +ch.toFixed(3), missedCross: +cm.toFixed(3), missEnd: +back.toFixed(3), hit: MH[0]?.hit, missHit: MM[0]?.hit },
      flyHit: { rx: +lo(FH, 'rx').toFixed(3), z: +lo(FH, 'z').toFixed(3), hit: FH[0]?.hit }, flyMiss: { rx: +hi(FM, 'rx').toFixed(3), z: +hi(FM, 'z').toFixed(3), rz: +hi(FM, 'rz').toFixed(3), hit: FM[0]?.hit } });
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
  about: 'A far Mosquito, House fly or Wasp (its anim run on alternate frames with both frames\' time) shows the same attack pose as a near one on the frames it is drawn: poses are a function of the attack clock.',
  setup() {},
  play() {
    const out = {};
    for (const id of ['mosquito', 'housefly', 'wasp']) {
      const N = filmed(id), F = filmed(id, { far: true });
      let worst = 0, compared = 0;
      for (let i = 0; i < Math.min(N.length, F.length); i++) {
        const a = N[i], b = F[i];
        if (a.phase === 'idle' || a.phase !== b.phase || !i || apart(b, F[i - 1]) === 0) continue;   // only frames the far one was drawn on
        worst = Math.max(worst, Math.abs(a.z - b.z), Math.abs(a.sz - b.sz), id === 'mosquito' ? 0 : Math.abs(a.rx - b.rx));
        compared++;
      }
      out[id] = { compared, worst: +worst.toFixed(4) };
    }
    return ok(Object.values(out).every((o) => o.compared > 10 && o.worst < 0.01), out);
  },
});

story('motion/attack-pose-is-the-same-at-30-and-60', {
  about: 'A Mosquito\'s bite, a House fly\'s poke and a Wasp\'s dive pose the same at 30 and 60 frames a second: at matching points of its attack clock its body is drawn back, stretched and squashed alike.',
  setup() {},
  play() {
    const out = {};
    for (const id of ['mosquito', 'housefly', 'wasp']) {
      const S = filmed(id, { dt: 1 / 30 }), Q = filmed(id);
      let worst = 0, compared = 0, at = null;
      for (const f of S) {
        if (f.phase === 'idle' || f.phase === 'swing') continue;   // (a swing is two or three frames at 30: its contact is proven by the hit fixture)
        const g = of(Q, f.phase).reduce((b, q) => (Math.abs(q.pt - f.pt) < Math.abs(b.pt - f.pt) ? q : b), { pt: 9 });
        if (Math.abs(g.pt - f.pt) > 0.009) continue;
        const d = Math.max(Math.abs(f.z - g.z), Math.abs(f.sz - g.sz), id === 'mosquito' ? 0 : Math.abs(f.rx - g.rx) * 0.6);   // (the House fly's last-fifth nod moves fast: a frame's k is 0.03 of it)
        if (d > worst) { worst = d; at = { phase: f.phase, k30: +f.k.toFixed(3), k60: +g.k.toFixed(3), pt30: +f.pt.toFixed(3), pt60: +g.pt.toFixed(3), hit: [f.hit, g.hit] }; }
        compared++;
      }
      out[id] = { compared, worst: +worst.toFixed(4), at };
    }
    return ok(Object.values(out).every((o) => o.compared > 5 && o.worst < 0.03), out);
  },
});

story('motion/attacks-never-recolour-the-bug', {
  about: 'No material on an attacking bug (each converted one: Mosquito, House fly, Wasp, Spotted lanternfly, Moth, Cicada) changes through its build-up and swing: no flash, blink or colour change on a bug that attacks (the owner\'s rule; only being hit flashes it white). The lanternfly\'s red shows only because its wings open.',
  setup() {},
  play() {
    const out = {};
    for (const id of CONVERTED) {
      const F = filmed(id).filter((f) => f.phase === 'build' || f.phase === 'swing');
      out[id] = { frames: F.length, recoloured: F.filter((f) => f.recolour).length };
    }
    return ok(Object.values(out).every((o) => o.frames > 3 && !o.recoloured), out);
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

// A bug's states stepped by hand through one attack (no game), the attack clock read each frame
function drive(T, steps, dt = 1 / 60) {
  const e = { T, atk: newAttack({ attackMotion: { style: 'throw', tier: 'mid' } }), state: 'approach', stateT: 0, aimT: 0, firedT: 0, phase: 1.7 };
  const seen = [];
  for (const [state, secs, set] of steps) {
    Object.assign(e, { state, stateT: secs }, set || {});
    for (let t = 0; t < secs - 1e-9; t += dt) {
      attackClock(e, dt);
      seen.push({ phase: e.atk.phase, k: e.atk.k, n: e.atk.n });
      e.stateT -= dt; if (e.aimT > 0) e.aimT = Math.max(0, e.aimT - dt); if (e.firedT > 0) e.firedT = Math.max(0, e.firedT - dt);
    }
  }
  return seen;
}
const dropped = (S) => S.some((f, i) => i && f.phase === S[i - 1].phase && f.phase !== 'idle' && f.k < S[i - 1].k - 1e-9);
story('motion/multi-step-phases-run-on', {
  about: 'An attack whose build-up or recoil takes several of its word\'s steps (the Ladybug\'s land, raise and aim, then close and rest) runs each phase on through them, its k never dropping back; a Shot without states (the Ant\'s spit: aimT, then firedT) is a build-up, a swing and a recoil too; each counts as one attack.',
  setup() {},
  play() {
    const lady = drive(CONTENT.enemies.ladybug, [['approach', 0.2], ['land', 0.8], ['raise', 0.45], ['aim', 0.6], ['close', 0.5], ['rest', 1], ['approach', 0.2]]);
    const ant = drive(CONTENT.enemies.ants, [['approach', 0.2, {}], ['approach', 0.7, { aimT: 0.7, aimMax: 0.7 }], ['approach', 0.25, { aimT: 0, firedT: 0.25 }], ['approach', 0.2]]);
    const order = (S) => S.map((f) => f.phase).filter((p, i, a) => p !== a[i - 1]).join(' ');
    const end = (S, p) => of(S, p).at(-1)?.k ?? 0;
    const good = (S) => !dropped(S) && order(S) === 'idle build swing recoil idle' && S.at(-1).n === 1 && end(S, 'build') > 0.95 && end(S, 'recoil') > 0.95;
    return ok(good(lady) && good(ant), { ladybug: { order: order(lady), dropped: dropped(lady), attacks: lady.at(-1).n, build: +end(lady, 'build').toFixed(2), recoil: +end(lady, 'recoil').toFixed(2) }, ant: { order: order(ant), dropped: dropped(ant), attacks: ant.at(-1).n, build: +end(ant, 'build').toFixed(2), recoil: +end(ant, 'recoil').toFixed(2) } });
  },
});
