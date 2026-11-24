// Stories: the basic bugs' attack animation (plan: enemy-attack-anim). Animation is drawn on a bug's body
// group and never moves a hit: `attacks/animation-never-moves-a-hit` replays all 16 basic attacks on a
// fixed seed and compares, with bug-attack-hits.json (recorded from main before any animation work,
// `node tools/record-bug-hits.mjs`), the frames from the attack's start to its hit test and where the
// bug stood and aimed at that moment.
import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { isMuted, setMuted } from '../sfx.js';
import { seededRandom, seedFor } from '../story-random.mjs';
import { CONTENT, compileEnemies } from '../content.js';
import { parse } from '../kdl.js';
import { LOOK } from '../look.js';
import { ENEMY_WORDS } from '../words.js';
import { TIERS, WORK, WORK_BUDGET, attackClock, attackPuff, beginFrame, knobs, newAttack, roll } from '../attack-motion.js';
import { G, fresh, holdJelly, near, offs, ok, spawn, step, stub, story, tp } from './kit.js';

// Each attack: the bug, where it starts (m from the jelly, along +x and +z), what says its attack has
// begun, and the enemies.js method that tests the hit (`aim` names the point it tests, if it has one).
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
  { id: 'dragonfly-whirlwind', type: 'dragonfly', at: [0.4, 0], begin: (e) => e.state === 'whirl', hit: 'whirlFling', aim: aimed },
  { id: 'mantis', type: 'mantis', at: [0.25, 0], begin: (e) => e.state === 'windup', hit: 'swat' },
  { id: 'worm', type: 'worm', at: [0.25, 0], begin: (e) => e.state === 'windup', hit: 'whip' },
  { id: 'beetle', type: 'beetle', at: [0.4, 0], begin: (e) => e.state === 'charge', hit: 'sparkShot', aim: aimed },
  { id: 'wasp', type: 'wasp', at: [0.3, 0], begin: (e) => e.state === 'windup', hit: 'sting' },
  { id: 'butterfly', type: 'butterfly', at: [0.4, 0], begin: (e) => e.state === 'windup', hit: 'prism', aim: (e, c) => c.foot },
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
export function stage(a, { miss = false, dt = 1 / 60, hurt = false, touch = true } = {}) {
  // a page whose audio an earlier story woke changes the bugs' rolls: sounds draw pitch jitter from Math.random,
  // and a playing song gives the beat the on-beat bugs (Firefly, Cicada) wait for. So mute, and use the run's own beat
  const real = Math.random, wasMuted = isMuted(), run = G().run, song = run.song;
  setMuted(true); run.song = null;
  Math.random = seededRandom(seedFor('bug-attack:' + a.id));
  fresh({ elites: false, bubbles: false, lash: false, hurt });   // hurt: its hits land (enemies.js landed), as in play
  tp(3.2, 0.05, 3.0, 0);
  holdJelly();
  if (!touch && a.hit !== 'touch' && a.id !== 'millipede') stub(G().run, 'contactDamage', () => {});   // (only the attack's own hit hurts: a bug the jelly overlaps would hurt it by touch first, and its hit would be swallowed by the i-frames. A Cockroach's touch is its attack, a rolling Millipede hurts through it)
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
  about: 'All 16 basic bug attacks, played on a fixed seed with the jelly held still, test their hit on the same frame after the attack begins, and from the same spot, facing and aim as when bug-attack-hits.json was recorded: attack animation never moves a hit.',
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
const KNOWN_UNCONVERTED = [];
// Words that set a state but aren't an attack with a build-up: the worm bursting out of the mantis once
const NOT_ATTACK_STATES = ['burst'];

// One attack filmed frame by frame on the fixed seed of `attacks/animation-never-moves-a-hit` (stage above):
// the clock and the body group's pose each frame, from before it begins until it is idle again (and `probe(e)`,
// numbers read off the model each frame: a part the body group doesn't carry, like the worm's tip; `read(e, body)`, one number).
function film(id = 'mosquito', { miss = false, dt = 1 / 60, far = false, also = null, probe = null, read = null } = {}) {
  // its hits land on the jelly (hurt), as in play, so a landed bite is told from a miss
  const was = LOOK.vars['bug-anim-far'];
  if (far) LOOK.vars['bug-anim-far'] = '-1';   // every bug counts as far: it animates on alternate frames
  const S = stage(ATTACKS.find((a) => a.id === id), { miss, dt, hurt: true, touch: false });
  const e = S.e, body = e.mesh.children[0], frames = [], other = also?.(S);
  const mats = new Map();
  e.mesh.traverse((o) => { if (o.isMesh) mats.set(o, o.material); });
  try {
    let recoiled = false;
    while (S.frame < 900) {
      S.advance();
      const A = e.atk;
      frames.push({ frame: S.frame, phase: A.phase, k: A.k, pt: A.pt, hit: A.hit, seed: e.phase, still: A.still, n: A.n, vary: A.vary, side: A.side,
        z: body.position.z, y: body.position.y, rx: body.rotation.x, rz: body.rotation.z, sz: body.scale.z, sy: body.scale.y, left: A.len - A.st, x: read ? read(e, body) : 0,
        recolour: [...mats].some(([o, m]) => o.material !== m), other: other ? { n: other.atk.n, vary: other.atk.vary, side: other.atk.side, seed: other.phase } : null,
        p: probe ? probe(e) : [], at: [e.pos.x, e.pos.y, e.pos.z], key: A.key, from: e.emergeAt ? [e.emergeAt.x, e.emergeAt.y, e.emergeAt.z] : null,
        dir: (e.whipDir || e.swatDir) ? [(e.whipDir || e.swatDir).x, (e.whipDir || e.swatDir).z] : null, floor: e.whipFloor ?? e.pos.y });
      if (A.phase === 'recoil') recoiled = true;
      if (recoiled && A.phase !== 'recoil') break;   // (a bug that only touches you, the Cockroach, goes on to lean in again at once)
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
    const plain = spawn('nest', near(-0.5, 0), { hp: 9999 }).atk === null;
    const tryIt = (src) => { try { compileEnemies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (err) { return err.message; } };
    const badStyle = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "wiggle"\n    chase 0.3\n    swat\n}');
    const badTier = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "swipe" tier="huge"\n    chase 0.3\n    swat\n}');
    const noAttack = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "swipe"\n    chase 0.3\n}');
    const touch = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    attack-motion "nip"\n    chase 0.3\n}');   // a bug that only touches you has no attack word
    const caught = /style must be/.test(badStyle) && /tier must be/.test(badTier) && /no attack word/.test(noAttack) && touch === null;
    return ok(given && plain && caught, { given, plain, badStyle, badTier, noAttack, touch });
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
const THROWS = ['ants', 'spider', 'firefly', 'ladybug', 'beetle'];   // (the throw style: aimed Shots)
const CONVERTED = ['roach', 'mosquito', 'housefly', 'wasp', 'lanternfly', 'butterfly', 'cicada', 'mantis', 'worm', 'millipede', 'dragonfly-whirlwind', ...THROWS];
// a Wasp that stings dies doing it, so only its miss has a recoil to film
const filmed = (id, o = {}) => film(id, { miss: id === 'wasp', probe: PROBES[id], ...o });
story('motion/attack-has-three-phases', {
  about: 'Each converted bug\'s attack (the Cockroach\'s nip, the Mosquito\'s bite, the House fly\'s poke, the Wasp\'s dive, the Spotted lanternfly\'s leap, the Monarch butterfly\'s prism, the Cicada\'s burrow, the Praying mantis\'s swat, the Horsehair worm\'s whip, the Giant millipede\'s roll, the Dragonfly\'s whirlwind, and the Ant, House spider, Firefly, Ladybug and Stag beetle throws) runs build-up, swing, recoil in that order on its attack clock, and its body\'s pose differs from its idle pose in each.',
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
  about: 'On the frame its hit is tested and through its contact pose, the striking part is drawn where the hit is tested: a Praying mantis\'s foreleg hooks are already shut (within 1 cm of its contact pose) and lie inside the wedge its swat tests, a Horsehair worm\'s tip lies on the floor at the end of the line its whip tests (within 1 cm), low enough that a jump still clears it, a House fly\'s straw tip is on the spot its poke tests (within 1 cm), and a Wasp\'s sting tip is on the jelly (within 1 cm of its surface) with its body where the bug really is, on the frame its sting is tested.',
  setup() {},
  async play() {
    const kdl = parse(await (await fetch('content/enemies.kdl')).text());
    const props = (bug, word) => kdl.find((n) => n.args[0] === bug).children.find((w) => w.name === word).props;
    const swat = props('mantis', 'swat'), whip = props('worm', 'whip');
    // the mantis: on the frame its swat is tested (the first swat frame) and every frame of its contact hold (a
    // landed swing whose pose is frozen); on the hit frame its hooks are already where the hold draws them (1 cm)
    const M = film('mantis', { probe: mantisProbe }), hitAt = M.findIndex((f) => f.key === 'swat');
    const held = M.filter((f, i) => f.phase === 'swing' && f.hit && i && M[i - 1].phase === 'swing' && M[i - 1].pt === f.pt);
    const onHit = M[hitAt], closed = onHit && held.length ? mm(Math.max(...onHit.p.slice(1).map((v, j) => Math.abs(v - held[0].p[j + 1])))) : 999;
    let mantis = held.length && onHit?.hit ? 0 : 9;
    for (const f of onHit ? [onHit, ...held] : held) {
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
    return ok(held.length >= 2 && mantis <= 0 && closed <= 10 && tips.length >= 2 && worm <= 0 && bugs, { mantisHeld: held.length, mantisOutside: +mantis.toFixed(4), mantisHitFrameFromContactMm: closed, wormFrames: tips.length, wormOff: +worm.toFixed(4), ...out });
  },
});

story('motion/landing-pose-is-on-the-hit', {
  about: 'On the frame a Spotted lanternfly or Cicada comes down and its hit is tested, its drawn body is where the bug really is and over the spot the hit is tested round (within 1 cm across): a landing pose never shows it somewhere its hit is not.',
  setup() {},
  play() {
    const out = {}, v = new THREE.Vector3();
    for (const [id, spot] of [['lanternfly', (e) => e.pos], ['cicada', (e) => e.burrowAt]]) {
      const S = stage(ATTACKS.find((a) => a.id === id), { hurt: true, touch: false });
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

story('motion/cicada-burst-lands-or-misses', {
  about: 'A Cicada whose burst hits the jelly counts it as landed (its swing\'s contact pose holds) and sways dazed upright; one whose burst misses (the jelly swam off its locked spot) lands tipped onto one side.',
  setup() {},
  play() {
    // the miss: the jelly swims away once the mound has locked onto its spot, inside the Warning's beats
    const away = (S) => { const go = S.advance; let moved = false; S.advance = () => { if (!moved && S.e.burrowLocked) { G().player.position.z += 0.6; moved = true; } return go(); }; return null; };
    const H = of(film('cicada'), 'recoil'), M = of(film('cicada', { also: away }), 'recoil');
    const tip = (R) => (R.length ? Math.abs(R.reduce((a, f) => a + f.rz, 0) / R.length) : 9);
    const landed = !!H[0]?.hit && tip(H) < 0.08, missed = !!M[0] && !M[0].hit && tip(M) > 0.15;
    return ok(landed && missed, { hit: H[0]?.hit, hitTip: +tip(H).toFixed(3), missHit: M[0]?.hit, missTip: +tip(M).toFixed(3), frames: [H.length, M.length] });
  },
});

story('motion/cicada-burrow-beats', {
  about: 'The Cicada\'s burrow shows every beat (plan cicada-burrow, task 3): it rears back head up before it sinks; under, the mound humps higher just after each beat; locked, it sinks flat while a mud chimney pushes up (the hush), then bulges past twice its width (the swell) and holds dead still for the last tenth; on the hit frame its body is still at the floor, then it rockets up stretched past 1.8 and lands squashed, leaving a crater and its shed shell that fade before it walks off, with no hostile glow on them.',
  setup() {},
  play() {
    const read = (e, b) => { const C = ['mound', 'chimney', 'shell', 'crater'].map((n) => e.mesh.getObjectByName(n)); C.unshift(b); return { st: e.state, dig: e.digK || 0, lock: e.under && e.burrowLocked ? e.burrowK : -1, beats: e.under && !e.burrowLocked ? e.burrowBeats : -1, bt: e.state === 'dazed' ? e.burstT : -1,
      mh: C[1].visible ? C[1].scale.y : 0, mw: C[1].scale.x, mx: C[1].position.x, ch: C[2].visible ? C[2].scale.y : 0, chx: C[2].position.x, shell: C[3].visible, crater: C[4].visible, rx: b.rotation.x, y: b.position.y, sy: b.scale.y }; };
    const F = film('cicada', { read }).map((f) => ({ ...f.x, phase: f.phase }));
    const rearUp = Math.min(...F.filter((f) => f.st === 'dig' && f.dig < 0.3).map((f) => f.rx)), rearHigh = Math.max(...F.filter((f) => f.st === 'dig' && f.dig < 0.3).map((f) => f.y));
    const trail = F.filter((f) => f.beats > 1), onBeat = trail.filter((f) => f.beats % 1 < 0.06), offBeat = trail.filter((f) => f.beats % 1 > 0.4 && f.beats % 1 < 0.6);
    const avg = (L, k) => L.reduce((a, f) => a + f[k], 0) / Math.max(1, L.length);
    const hush = F.filter((f) => f.lock > 0.3 && f.lock < 0.45), swell = F.filter((f) => f.lock > 0.8 && f.lock < 0.89), still = F.filter((f) => f.lock >= 0.92);
    const first = F.find((f) => f.st === 'dazed'), top = Math.max(...F.filter((f) => f.bt >= 0 && f.bt < 0.2).map((f) => f.y)), long = Math.max(...F.filter((f) => f.bt >= 0 && f.bt < 0.2).map((f) => f.sy));
    const landed = F.filter((f) => f.bt > 0.3 && f.bt < 0.5), left = F.filter((f) => f.bt > 1.85);
    const out = {
      rear: +rearUp.toFixed(2), rearHigh: +rearHigh.toFixed(3), heave: [+avg(onBeat, 'mh').toFixed(2), +avg(offBeat, 'mh').toFixed(2)], hush: [+avg(hush, 'mh').toFixed(2), +avg(hush, 'ch').toFixed(2)],
      swell: +avg(swell, 'mw').toFixed(2), still: still.length && Math.max(...still.map((f) => Math.abs(f.mx) + Math.abs(f.chx))), hitFrameY: first && +first.y.toFixed(3), top: +top.toFixed(2), long: +long.toFixed(2),
      landSquash: +Math.min(...landed.map((f) => f.sy)).toFixed(2), leftovers: landed.some((f) => f.shell && f.crater), gone: left.length ? left.every((f) => !f.shell && !f.crater) : 'n/a',
    };
    const good = rearUp < -0.3 && rearHigh > -0.2 && onBeat.length && offBeat.length && out.heave[0] > out.heave[1] + 0.1 && out.hush[0] < 0.6 * avg(offBeat, 'mh') && out.hush[1] > 0.5
      && out.swell > 2 && still.length && out.still === 0 && Math.abs(out.hitFrameY) < 0.05 && out.top > 1.5 && out.long > 1.8 && out.landSquash < 0.8 && out.leftovers && out.gone !== false;
    return ok(good, out);
  },
});

story('motion/cicada-miss-lands-on-its-back', {
  about: 'A Cicada whose burst misses goes higher and lands on its back, kicking its legs for about a beat, then rolls upright before its dazed beats run out.',
  setup() {},
  play() {
    const away = (S) => { const go = S.advance; let moved = false; S.advance = () => { if (!moved && S.e.burrowLocked) { G().player.position.z += 0.6; moved = true; } return go(); }; return null; };
    const F = film('cicada', { also: away, read: (e) => (e.state === 'dazed' ? e.burstT : -1) }).filter((f) => f.x >= 0);
    const back = F.filter((f) => f.x > 0.35 && f.x < 0.6), end = F.filter((f) => f.x > 1.3);
    const onBack = back.length && back.every((f) => Math.abs(Math.cos(f.rz)) > 0.9 && Math.cos(f.rz) < 0), upright = end.length && end.every((f) => Math.cos(f.rz) > 0.9);
    return ok(!F[0]?.hit && onBack && upright, { hit: F[0]?.hit, back: back.length, onBack, upright, frames: F.length });
  },
});

// A Cicada's recoil is its dazed sway, ended by a head shake and wings snapping shut over the last quarter second:
// that closing tell is the window closing, so it is posed to the end by design.
const CLOSES_WITH_A_TELL = ['cicada'];
story('motion/recoil-ends-ready', {
  about: 'Hit or miss (a Wasp that stings dies doing it, so only its miss), every converted bug is back in its ready stance by the last fifth of its recoil: how far it is drawn back, rolled and squashed there is under 6% of the most it was in that recoil, so the punish window is honest on a heavy bug as well as a light one (a Cicada closes with its own head shake and wing snap).',
  setup() {},
  play() {
    const worst = {};
    for (const id of CONVERTED) {
      if (CLOSES_WITH_A_TELL.includes(id)) continue;
      for (const miss of id === 'wasp' ? [true] : [false, true]) {
        const R = of(filmed(id, { miss }), 'recoil'), end = R.at(-1);
        const left = [(f) => f.z, (f) => f.rz, (f) => f.sz].map((c) => {
          const dev = (f) => Math.abs(c(f) - c(end)), peak = Math.max(...R.map(dev));
          return peak < 0.05 ? 0 : Math.max(...R.filter((f) => f.k >= 0.8).map(dev)) / peak;   // (a channel it barely uses is not a pose)
        });
        worst[id + (miss ? ' miss' : ' hit')] = +Math.max(...left).toFixed(3);
      }
    }
    return ok(Object.values(worst).every((w) => w < 0.06), worst);
  },
});

// Rule 4 of the plan: a build-up changes the bug's outline by a quarter of its body, or turns a big part 15 degrees.
// outline(e) reads, for its model and every part of it, the box round it and how it is turned, in the bug's own
// frame (so where it walks and which way it faces don't count), as 10 numbers each: centre, size, rotation.
const OUTLINE = new WeakMap();
const BOX = new THREE.Box3(), CORNER = new THREE.Vector3(), UNIT = new THREE.Matrix4(), POS = new THREE.Vector3(), SCALE = new THREE.Vector3(), TURN = new THREE.Quaternion();
const outline = (e) => {
  const root = e.mesh;
  let L = OUTLINE.get(root);
  if (!L) { L = { list: [], boxes: [], index: new Map() }; root.traverse((o) => L.list.push(o)); L.list.forEach((o, i) => L.index.set(o, i)); L.boxes = L.list.map(() => new THREE.Box3()); OUTLINE.set(root, L); }
  root.updateWorldMatrix(true, true);
  const inv = UNIT.copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), out = [];
  for (let i = L.list.length - 1; i >= 0; i--) {   // children before their parents
    const o = L.list[i], b = L.boxes[i].makeEmpty();
    if (o.visible) {
      if (o.isMesh) {
        o.geometry.boundingBox || o.geometry.computeBoundingBox();
        const g = o.geometry.boundingBox; M.multiplyMatrices(inv, o.matrixWorld);
        for (let c = 0; c < 8; c++) b.expandByPoint(CORNER.set(c & 1 ? g.max.x : g.min.x, c & 2 ? g.max.y : g.min.y, c & 4 ? g.max.z : g.min.z).applyMatrix4(M));
      }
      for (const k of o.children) { const j = L.index.get(k); if (L.boxes[j].isEmpty() === false) b.union(L.boxes[j]); }
    }
  }
  for (let i = 0; i < L.list.length; i++) {
    const b = L.boxes[i]; M.multiplyMatrices(inv, L.list[i].matrixWorld).decompose(POS, TURN, SCALE);
    if (b.isEmpty()) out.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
    else out.push((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z, TURN.x, TURN.y, TURN.z, TURN.w);
  }
  return out;
};

story('motion/build-up-changes-the-outline', {
  about: 'Rule 4, for every converted bug: its build-up changes its outline by a quarter of its body (a big part moved, or the whole bug grown or shrunk that much) or turns a big part (a quarter of its body or more) 15 degrees, by at least 0.3 of that more than anything its ordinary idling does (wings beating, legs walking), so a player reads it on the bug itself and not only in its Warning.',
  setup() {},
  play() {
    const out = {}, deg15 = 15 * Math.PI / 180;
    for (const id of CONVERTED) {
      let calls = 0;
      const F = filmed(id, { probe: (e) => { const A = e.atk; return A.phase === 'build' || (A.phase === 'idle' && A.n === 0 && calls++ % 4 === 0) ? outline(e) : []; } });
      const idle = F.filter((f) => f.phase === 'idle' && f.p.length).map((f) => f.p), build = F.filter((f) => f.phase === 'build' && f.p.length).map((f) => f.p);
      const ref = idle[0], parts = ref.length / 10, size = Math.max(ref[3], ref[4], ref[5]);
      // each measure, as a multiple of its threshold: where a part has moved or the bug grown (of the body), how far a big part has turned
      const measures = (P) => {
        const m = [];
        for (let i = 0; i < parts; i++) {
          const a = i * 10, big = i === 0 || Math.max(ref[a + 3], ref[a + 4], ref[a + 5]) >= 0.25 * size;
          m.push(big ? Math.hypot(P[a] - ref[a], P[a + 1] - ref[a + 1], P[a + 2] - ref[a + 2]) / (0.25 * size) : 0);
          m.push(i === 0 ? Math.max(Math.abs(P[3] - ref[3]), Math.abs(P[4] - ref[4]), Math.abs(P[5] - ref[5])) / (0.25 * size) : 0);
          m.push(big && i ? 2 * Math.acos(Math.min(1, Math.abs(P[a + 6] * ref[a + 6] + P[a + 7] * ref[a + 7] + P[a + 8] * ref[a + 8] + P[a + 9] * ref[a + 9]))) / deg15 : 0);
        }
        return m;
      };
      const most = (set) => set.map(measures).reduce((m, v) => v.map((x, i) => Math.max(m[i] || 0, x)), []);
      const quiet = most(idle), moved = most(build), best = moved.map((v, i) => (v >= 1 && v >= quiet[i] + 0.3 ? v : 0));
      const top = Math.max(...best);
      out[id] = { by: +top.toFixed(2), part: best.indexOf(top), idle: idle.length, build: build.length };
    }
    return ok(Object.values(out).every((o) => o.by >= 1), out);
  },
});

story('motion/touching-is-not-a-swing-landing', {
  about: 'A Praying mantis whose swat missed but whose body the jelly then touches mid-swing is hurt by the touch, yet draws no landed hit (no contact pose, no hit recoil): only its own swing landing does. A hit that is the swat itself still counts.',
  setup() {},
  play() {
    const S = stage(ATTACKS.find((a) => a.id === 'mantis'), { miss: true, hurt: true });
    try {
      while (S.frame < MAX_FRAMES && S.e.atk.phase !== 'swing') S.advance();
      const e = S.e, run = G().run, hurts = [];
      offs.push(bus.on('player_hurt', (h) => hurts.push(h)));
      const hurt = (touch) => { run.iFrames = 0; bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: e.type, from: e.id, contact: true, touch }); };
      const swinging = e.atk.phase === 'swing', before = e.atk.hit;
      hurt(true);
      const touched = e.atk.hit;
      hurt(false);
      return ok(swinging && !before && !touched && e.atk.hit && hurts.length === 2 && hurts[0].touch === true && hurts[1].touch === false, { swinging, before, touched, own: e.atk.hit, hurts: hurts.map((h) => h.touch) });
    } finally { S.done(); }
  },
});

story('motion/a-throw-does-not-droop-the-eyes', {
  about: 'After a throw (the Ant, House spider, Firefly, Ladybug, Stag beetle and the Dragonfly\'s whirlwind) the bug\'s eyes do not droop, whether the thing thrown hits or not: it is not a miss yet. A Mosquito whose bite misses still droops its eyes.',
  setup() {},
  play() {
    const droop = (F) => Math.max(...of(F, 'recoil').map((f) => f.x));
    // (the angry eyes: the group of two eye groups, each turned 0.25 and holding ball, iris, pupil and brow)
    const eye = (e) => { let g = null; e.mesh.traverse((o) => { if (!g && o.children.length === 2 && o.children.every((c) => c.children.length === 4 && Math.abs(Math.abs(c.rotation.y) - 0.25) < 1e-6)) g = o; }); return g ? g.children[0].rotation.x : 0; }, out = {};
    for (const id of [...THROWS, 'dragonfly-whirlwind']) out[id] = Math.max(...[false, true].map((miss) => droop(film(id, { miss, read: eye }))));
    const missed = droop(film('mosquito', { miss: true, read: eye }));
    return ok(Object.values(out).every((d) => d < 0.01) && missed > 0.1, { ...out, mosquitoMiss: +missed.toFixed(3) });
  },
});

story('motion/half-rate-shows-the-same-pose', {
  about: 'A far bug (its anim run on alternate frames with both frames\' time) shows the same attack pose as a near one on the frames it is drawn: poses are a function of the attack clock. Proven on the Mosquito and the five throws.',
  setup() {},
  play() {
    const bugs = {};
    for (const id of ['mosquito', 'housefly', 'wasp', ...THROWS]) {   // (each bug's own wave adds its case when its pose is only the clock's)
      const N = filmed(id), F = filmed(id, { far: true });
      let worst = 0, compared = 0;
      for (let i = 0; i < Math.min(N.length, F.length); i++) {
        const a = N[i], b = F[i];
        if (a.phase === 'idle' || a.phase !== b.phase || !i || apart(b, F[i - 1]) === 0) continue;   // only frames the far one was drawn on
        worst = Math.max(worst, Math.abs(a.z - b.z), Math.abs(a.sz - b.sz), id === 'housefly' || id === 'wasp' ? Math.abs(a.rx - b.rx) : 0);
        compared++;
      }
      bugs[id] = { compared, worst: +worst.toFixed(4) };
    }
    return ok(Object.values(bugs).every((b) => b.compared > 5 && b.worst < 0.01), bugs);
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
    // (a landed House fly's last-fifth nod moves 0.07 rad in the 0.02 of k that a 30 fps frame can put between the two clocks; the rest are within 0.03)
    return ok(Object.entries(out).every(([id, o]) => o.compared > 5 && o.worst < (id === 'housefly' ? 0.05 : 0.03)), out);
  },
});

story('motion/attacks-never-recolour-the-bug', {
  about: 'No material on an attacking bug (each converted one) changes through its build-up and swing: no flash, blink or colour change on a bug that attacks (the owner\'s rule; only being hit flashes it white). The lanternfly\'s red shows only because its wings open.',
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
  about: 'The attack tiers (fodder, light, mid, heavy) each stretch further than the one below and hold contact at least as long, and the heavy tier never bounces.',
  setup() {},
  play() {
    const K = knobs(), T = TIERS.map((t) => K.tier[t]);
    const rising = (key, by = 0) => T.every((x, i) => i === 0 || x[key] >= T[i - 1][key] + by);
    const heavy = K.tier.heavy;
    return ok(rising('stretch', 0.01) && rising('contact') && T[3].stretch > T[0].stretch && !heavy.bounce && heavy.over === 0, { stretch: T.map((x) => x.stretch), contact: T.map((x) => x.contact), heavyBounces: heavy.bounce, heavyOver: heavy.over });
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
  about: 'One bug\'s attack motion makes no more curve calls in a frame than the budget (WORK_BUDGET in src/attack-motion.js), counted through a whole attack of each converted bug.',
  setup() {},
  play() {
    const most = {};
    for (const id of CONVERTED) { WORK.most = 0; film(id); most[id] = WORK.most; }
    return ok(Object.values(most).every((m) => m > 0 && m <= WORK_BUDGET), { most, budget: WORK_BUDGET });
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


// ------------------------------------------------------------------ the throws (attack-motion "throw")
// the channel each throw's body rocks along (the Firefly pitches, the others slide)
const ROCK = { ants: 'z', spider: 'z', firefly: 'rx', ladybug: 'z', beetle: 'z' };

story('motion/throws-recoil-by-weight', {
  about: 'The Ant, House spider, Firefly and Ladybug rock back past neutral and settle after a throw; the Stag beetle, the heavy tier, is shoved back and eases home without ever springing forward.',
  setup() {},
  play() {
    const bugs = {};
    for (const id of THROWS) {
      const F = film(id), idle = F.find((f) => f.phase === 'idle'), R = of(F, 'recoil'), ch = ROCK[id];
      const d = R.map((f) => f[ch] - idle[ch]), first = d.find((v) => Math.abs(v) > 0.01) ?? 0;
      const crossed = d.some((v) => v * Math.sign(first) < -0.01);
      let eases = true;                                                // the heavy one: never farther from rest than a moment ago
      for (let i = 1; i < d.length; i++) if (Math.abs(d[i]) > Math.abs(d[i - 1]) + 1e-4) eases = false;
      bugs[id] = { crossed, eases, first: +first.toFixed(3) };
    }
    const light = THROWS.filter((id) => id !== 'beetle').every((id) => bugs[id].crossed && bugs[id].first !== 0);
    return ok(light && !bugs.beetle.crossed && bugs.beetle.eases && Math.abs(bugs.beetle.first) > 0.05, bugs);
  },
});

story('motion/ant-pin-leaves-on-the-throw-frame', {
  about: 'The Ant\'s pin is full in its jaws through the build-up and gone on the very frame its throw begins (the spit word\'s firedT), as it always was.',
  setup() {},
  play() {
    const F = film('ants', { read: (e, body) => body.getObjectByName('ant-pin').scale.x });
    const at = F.findIndex((f) => f.phase === 'swing');
    const before = F[at - 1], first = F[at];
    return ok(at > 0 && before.phase === 'build' && before.x > 0.95 && first.x < 0.01, { before: before?.x, first: first?.x });
  },
});

story('motion/throws-go-still-before-the-throw', {
  about: 'For the last 0.1 s of a throw\'s build-up the Ant, House spider, Firefly, Ladybug and Stag beetle stop their bobbing, tremble and sway: no change in height or lean from frame to frame until it throws.',
  setup() {},
  play() {
    const bugs = {};
    for (const id of THROWS) {
      const still = of(film(id), 'build').filter((f) => f.still);
      let moved = 0;
      for (let i = 1; i < still.length; i++) moved = Math.max(moved, Math.abs(still[i].rz - still[i - 1].rz), Math.abs(still[i].y - still[i - 1].y));
      bugs[id] = { stillFrames: still.length, moved: +moved.toFixed(4) };
    }
    return ok(Object.values(bugs).every((b) => b.stillFrames >= 5 && b.stillFrames <= 7 && b.moved < 0.005), bugs);
  },
});

story('motion/throws-hold-the-coil', {
  about: 'Once the Ant and House spider have drawn back (a body slide), and the Ladybug and Stag beetle have braced or planted (a body drop), they stay there over the last fifth of the build-up; the Firefly winds its tail back a further 10 degrees in the last 0.1 s.',
  setup() {},
  play() {
    const held = { ants: ['z', 0.1], spider: ['z', 0.08], ladybug: ['y', 0.06], beetle: ['y', 0.06] }, bugs = {};
    for (const [id, [ch, reach]] of Object.entries(held)) {
      const B = of(film(id), 'build'), end = B.at(-1), late = B.filter((f) => f.k >= 0.8);
      const drift = Math.max(...late.map((f) => Math.abs(f[ch] - end[ch])));
      bugs[id] = { reached: +Math.abs(end[ch]).toFixed(3), drift: +drift.toFixed(4), late: late.length };
    }
    const lit = of(film('firefly'), 'build'), early = lit.find((f) => f.k >= 0.7), last = lit.at(-1);
    const windBack = last.rx - early.rx;
    const good = Object.entries(held).every(([id, [, reach]]) => bugs[id].reached > reach && bugs[id].drift < 0.01 && bugs[id].late >= 3) && windBack > 0.08;
    return ok(good, { ...bugs, firefly: { windBack: +windBack.toFixed(3) } });
  },
});

story('motion/ladybug-lands-crouches-and-flares', {
  about: 'A Ladybug touching down squashes (0.15) and springs back; its wing cases flare wider on the fire frame; and in the last 0.15 s of its rest it crouches before it takes off.',
  setup() {},
  play() {
    const F = film('ladybug', { read: (e, body) => body.getObjectByName('elytron').rotation.z }), raise = F.filter((f) => f.key === 'raise'), rest = F.filter((f) => f.key === 'rest');
    const squash = 1 - Math.min(...raise.map((f) => f.sy));
    const springs = raise.at(-1).sy > 0.98;
    const y0 = rest[0].y, crouch = y0 - Math.min(...rest.filter((f) => f.left < 0.15).map((f) => f.y));
    const early = Math.max(...rest.filter((f) => f.left > 0.3).map((f) => Math.abs(f.y - y0)));
    const swing = of(F, 'swing'), aim = F.filter((f) => f.key === 'aim').at(-1);
    const flare = Math.abs(Math.max(...swing.map((f) => Math.abs(f.x)))) - Math.abs(aim.x);   // the cases swing wider once the missile goes
    return ok(squash > 0.1 && springs && crouch > 0.06 && early < 0.02 && flare > 0.05, { squash: +squash.toFixed(3), springs, crouch: +crouch.toFixed(3), early: +early.toFixed(3), flare: +flare.toFixed(3) });
  },
});

story('motion/beetle-plants-before-it-charges', {
  about: 'A Stag beetle drops its body 0.08 r and splays its legs in the first fifth of a second of its charge, and stays planted through the shot, then stands back up smoothly as its recoil ends (no pop when the pose lets go).',
  setup() {},
  play() {
    const F = film('beetle'), B = of(F, 'build'), R = of(F, 'recoil');
    const at = B.find((f) => f.pt >= 0.2), drop = -at.y;
    const planted = [...of(F, 'swing'), ...R.filter((f) => f.k < 0.2)].every((f) => f.y < -0.06);
    const stands = Math.abs(R.at(-1).y) < 0.01 && R.every((f, i) => !i || f.y >= R[i - 1].y - 1e-6);   // and rises smoothly as it eases home
    return ok(drop > 0.07 && planted && stands, { dropped: +drop.toFixed(3), planted, stands, lastY: +R.at(-1).y.toFixed(4) });
  },
});

// ------------------------------------------------------------------ B5: the Dragonfly, the Cockroach, the Wasp nest
// The Dragonfly's tail and its right-hand wings, read off the model: the tail's angle up over its back, then for
// each of the fore and hind wing on the right: its flap (its angle up off flat, 0.05) and sweep (forward, from
// where it rests)
const dragonflyProbe = (e) => {
  const out = [], right = [];
  e.mesh.traverse((o) => { if (o.name === 'tail') out.push(o.rotation.x); else if (o.name === 'wing' && o.position.x > 0) right.push(o); });
  right.sort((a, b) => b.position.z - a.position.z);   // fore first
  for (const w of right) out.push(Math.abs(w.rotation.z - 0.05), (w === right[0] ? -0.1 : 0.14) - w.rotation.y);
  return out;   // [tail, fore flap, fore sweep, hind flap, hind sweep]
};
const spread = (F, i) => { const v = F.map((f) => f.p[i]); return Math.max(...v) - Math.min(...v); };
const flapped = (F) => Math.max(...F.map((f) => f.p[1]));   // how far a fore wing is off flat, at most

story('motion/dragonfly-charge-shows-on-its-body', {
  about: 'With the sound off (the stage mutes it), a Dragonfly winding up its rotor sweeps its wings forward past 15 degrees and freezes them when the aim locks while it leans back. That never moves it more than 0.35 of its radius, and the tell is a pose, never a colour.',
  setup() {},
  play() {
    const out = {}, deg15 = 15 * Math.PI / 180;
    const W = film('dragonfly-whirlwind', { probe: dragonflyProbe }), Wb = of(W, 'build'), Wl = Wb.filter((f) => f.k >= 0.75), Wc = Wb.filter((f) => f.k >= 0.15 && f.k <= 0.5);
    out.whirl = { sweep: +Math.max(...Wl.map((f) => f.p[2])).toFixed(2), lean: +Math.min(...Wl.map((f) => f.rx)).toFixed(2), frozen: +spread(Wl, 1).toFixed(4), beating: +spread(Wc, 1).toFixed(2) };
    const whirl = out.whirl.sweep > deg15 && out.whirl.lean < -0.2 && out.whirl.frozen < 0.01 && out.whirl.beating > 0.1;
    const reach = Math.max(...W.filter((f) => f.phase !== 'idle').map((f) => Math.abs(f.z)));
    const recoloured = W.filter((f) => f.phase !== 'idle' && f.recolour).length;
    return ok(whirl && reach <= 0.35 && !recoloured, { ...out, reach: +reach.toFixed(3), recoloured });
  },
});

story('motion/cockroach-leans-in-and-jabs-on-the-touch', {
  about: 'A Cockroach leans in, head low, before its touch lands (within --bug-attack-nip-near radii of you); the frame its touch lands (or the next) its head jabs forward; it hops back and rocks, and is back in its walking stance over the last fifth of its hop. Its touch and its damage come when they did (animation-never-moves-a-hit).',
  setup() {},
  play() {
    const a = ATTACKS.find((x) => x.id === 'roach'), S = stage(a, { hurt: true });
    let landed = -1, jab = -1;
    try {
      while (S.frame < 600 && (landed < 0 || jab < 0)) {
        S.advance();
        if (landed < 0 && S.found) landed = S.frame;
        if (jab < 0 && S.e.atk.phase === 'swing') jab = S.frame;
      }
    } finally { S.done(); }
    const F = film('roach'), build = of(F, 'build'), before = build.filter((f) => !f.hit), swing = of(F, 'swing'), hop = of(F, 'recoil'), late = hop.filter((f) => f.k >= 0.8);
    const out = { landed, jab, lean: +Math.max(...before.map((f) => f.rx)).toFixed(2), jabZ: +Math.max(...swing.map((f) => f.z)).toFixed(3), reach: +Math.max(...swing.map((f) => f.z + (f.sz - 1))).toFixed(3), hopZ: +Math.min(...hop.map((f) => f.z)).toFixed(3), ready: late.length ? +Math.max(...late.map((f) => Math.max(Math.abs(f.z), Math.abs(f.rx), Math.abs(f.sz - 1)))).toFixed(3) : null };
    return ok(landed > 0 && jab >= landed && jab - landed <= 1 && out.lean > 0.17 && out.jabZ > 0.15 && out.reach <= 0.35 && out.hopZ < -0.1 && out.ready !== null && out.ready < 0.03, out);
  },
});

story('motion/nest-squeezes-before-each-wasp', {
  about: 'A Wasp nest squeezes across (--bug-attack-nest-squeeze) and bulges down at its entrance (--bug-attack-nest-bulge) over the --bug-attack-nest-lead s before each wasp crawls out, fully on the frame it does, then relaxes; it is the shape of the nest and nothing else (hung from its top, its colour untouched). A nest whose brood is full squeezes for nothing.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { enemies } = G(), K = knobs().nest, n = spawn('nest', near(0.6, 0, 0.25)), body = n.mesh.children[0];
    const brood = () => enemies.list.filter((x) => !x.dead && x.motherId === n.id).length;
    const top = () => { n.mesh.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(body).max.y; };
    step(3);                       // (it grows in)
    n.broodT = 1;
    const rest = top(), seen = [];
    let spawned = -1;
    for (let i = 0; i < 120 && spawned < 0; i++) {
      const was = brood(), left = n.broodT;
      step(1);
      seen.push({ left, x: body.scale.x, y: body.scale.y, top: top() });
      if (brood() > was) spawned = i;
    }
    const before = seen.filter((s) => s.left > K.lead + 0.02), squeezing = seen.filter((s) => s.left < K.lead && s.left > 0.02), last = seen[spawned - 1];
    const calm = before.length > 10 && before.every((s) => s.x === 1 && s.y === 1);
    const grows = squeezing.length > 5 && squeezing.every((s, i) => !i || s.x <= squeezing[i - 1].x + 1e-9) && last.x <= 1 - K.squeeze * 0.7 && last.y >= 1 + K.bulge * 0.9;
    const hung = seen.every((s) => Math.abs(s.top - rest) < 0.001);   // its top stays where it hangs
    step(30);
    const relaxed = body.scale.x === 1 && body.scale.y === 1;
    // a nest with a full brood: nothing comes out, so it doesn't squeeze
    n.broodT = 1;
    for (let i = brood(); i < 9; i++) { const w = spawn('wasp', near(-0.8, 0.8), { still: true }); w.motherId = n.id; }
    let squeezed = 0;
    for (let i = 0; i < 90; i++) { step(1); if (n.broodT < K.lead && body.scale.x < 1) squeezed++; }
    return ok(spawned > 0 && calm && grows && hung && relaxed && !squeezed, { spawned, calm, lastX: +last.x.toFixed(3), lastY: +last.y.toFixed(3), hung, relaxed, squeezedWhenFull: squeezed });
  },
});

story('motion/bug-ik-and-lofted-shells', {
  about: 'All 16 upgraded bugs build valid finite geometry and animate smoothly with finite joint poses when close (!unseen) and far (unseen), with articulated 2-bone IK legs moving on ground walkers.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); holdJelly(); },
  play() {
    const out = {};
    let allOk = true;
    const ikWalkers = new Set(['roach', 'ants', 'spider', 'lanternfly', 'beetle']);
    const types = ['roach', 'ants', 'mosquito', 'lanternfly', 'spider', 'housefly', 'millipede', 'ladybug', 'dragonfly', 'mantis', 'worm', 'beetle', 'cicada', 'wasp', 'butterfly', 'firefly'];
    for (const type of types) {
      const e = spawn(type, near(0.35, 0), { hp: 9999 });
      let tris = 0, badVerts = 0, meshes = 0;
      e.mesh.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const p = o.geometry.attributes.position, n = o.geometry.attributes.normal;
        tris += o.geometry.index ? o.geometry.index.count / 3 : p.count / 3;
        for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i]) || (n && !Number.isFinite(n.array[i]))) badVerts++;
      });
      const moved = new Set();
      for (let i = 0; i < 16; i++) {
        e.unseen = false;
        e.vel.set(0, 0, 0.3);
        e.pos.z += 0.3 / 60;
        e.anim(1 / 60, e);
        e.mesh.traverse((o) => { if (o.isGroup && (Math.abs(o.rotation.z) > 0.05 || Math.abs(o.rotation.x) > 0.05)) moved.add(o.id); });
      }
      e.unseen = true;
      e.anim(1 / 30, e);
      let finite = true;
      e.mesh.traverse((o) => { if (!Number.isFinite(o.rotation.x) || !Number.isFinite(o.rotation.y) || !Number.isFinite(o.rotation.z)) finite = false; });
      const good = badVerts === 0 && finite && (!ikWalkers.has(type) || moved.size >= 6);
      if (!good) allOk = false;
      out[type] = { tris: Math.round(tris), meshes, badVerts, finite, movedJoints: moved.size };
    }
    return ok(allOk, out);
  },
});

