// Stories: the basic bugs' attack animation (plan: enemy-attack-anim). Animation is drawn on a bug's body
// group and never moves a hit: `attacks/animation-never-moves-a-hit` replays all 17 basic attacks on a
// fixed seed and compares, with bug-attack-hits.json (recorded from main before any animation work,
// `node tools/record-bug-hits.mjs`), the frames from the attack's start to its hit test and where the
// bug stood and aimed at that moment.
import { bus } from '../events.js';
import { isMuted, setMuted } from '../sfx.js';
import { seededRandom, seedFor } from '../story-random.mjs';
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
export function stage(a, { miss = false, dt = 1 / 60 } = {}) {
  // a page whose audio an earlier story woke changes the bugs' rolls: sounds draw pitch jitter from Math.random,
  // and a playing song gives the beat the on-beat bugs (Firefly, Cicada) wait for. So mute, and use the run's own beat
  const real = Math.random, wasMuted = isMuted(), run = G().run, song = run.song;
  setMuted(true); run.song = null;
  Math.random = seededRandom(seedFor('bug-attack:' + a.id));
  fresh({ elites: false, bubbles: false, lash: false });
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
