// The Praying mantis cuts off a jelly that swims away (the chase word's `lead`); its attack is not touched.
import { CONTENT } from '../content.js';
import { G, V, holdJelly, ok, setupFight, spawn, step, story, stub } from './kit.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The chase word's own output, stepped by hand with nothing else in the way: the jelly swims +x from the origin and the mantis starts ahead and to the side. Seconds until it is within 0.4 m (null if never in 20 s). `sees` false hides the jelly's velocity: the plain chase.
function race(sees, sx = 0.9, sz = 0.9, jv = 0.2) {
  const word = CONTENT.enemies.mantis.words.find((w) => w.ground);   // its chase, as the content makes it
  const e = { pos: V(sx, 0, sz), r: 0.05, phase: 1, T: { reach: 0.3 } }, jelly = V(0, 0, 0), vel = V(jv, 0, 0), dt = 1 / 60;
  const en = { player: { velocity: sees ? vel : V(0, 0, 0) }, nav: null, list: [] };
  const c = { dt, t: 0, slow: 1, dir: V(), flatDir: V(), pc: jelly, realPc: jelly, speed: 0, flat: 0 };
  for (let f = 0; f < 20 * 60; f++) {
    c.t = f * dt; c.flatDir.set(jelly.x - e.pos.x, 0, jelly.z - e.pos.z); c.flat = c.flatDir.length(); c.flatDir.normalize();
    if (c.flat < 0.4) return f / 60;
    word.tick(e, c, en);
    e.pos.addScaledVector(c.dir, c.speed * dt);
    jelly.addScaledVector(vel, dt);
  }
  return null;
}

story('bugs/mantis-cuts-off-a-fleeing-jelly', {
  about: 'The Praying mantis\'s chase word, stepped by hand with nothing in the way, gets within 0.4 m of a jelly swimming a straight line (0.4 m/s across the mantis\'s front, from two starts) sooner when it aims where the jelly will be (`lead`) than when it only follows (the jelly\'s velocity hidden from it).',
  setup() {},
  play() {
    const starts = [[1, 1.5], [0.5, 1.2]].map(([sx, sz]) => [race(false, sx, sz, 0.4), race(true, sx, sz, 0.4)]);
    return ok(starts.every(([plain, led]) => plain !== null && led !== null && led < plain - 0.3), { starts });
  },
});

story('bugs/mantis-attack-is-unchanged', {
  about: 'A Praying mantis already in attack range of a moving jelly does not lead it: it moves exactly as it does when the jelly\'s velocity is hidden from it, so its swat is aimed and timed as before.',
  setup() {},
  play() {
    const where = (sees) => {
      setupFight({ bubbles: false, lash: false }); holdJelly();
      const { enemies, player, run } = G(), P = player.position;
      stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6;
      stub(enemies, 'nav', null);
      const e = spawn('mantis', V(P.x + 0.2, P.y + 0.01, P.z), { hp: 1e7 });
      stub(player, 'velocity', sees ? V(0, 0, 0.3) : V(0, 0, 0));
      step(20, () => { P.z += 0.3 / 60; });
      const out = [e.pos.x, e.pos.z, e.root.rotation.y];
      enemies.kill(e, true);
      return out;
    };
    const a = where(true), b = where(false);
    return ok(a.every((v, i) => Math.abs(v - b[i]) < 0.002), { a, b });
  },
});

// The Dragonfly's whirlwind aims ahead of a moving jelly (the whirlwind word's `lead`); wind-up, size, speed, damage and timing are not touched.
// Fight a Dragonfly through one wind-up with the jelly swimming `vx`/`vz` m/s (0 = still): returns the jelly's spot when the aim locked, the aim at the fling, and how far the aim moved after the lock.
function windup(vx, vz, { aside = 0 } = {}) {
  setupFight({ bubbles: false, lash: false }); holdJelly();
  const { enemies, player, run } = G(), P = player.position;
  stub(run, 'hurt', () => {}); stub(run, 'hit', () => {}); run.health = 1e6;
  stub(enemies, 'nav', null);
  const e = spawn('dragonfly', V(P.x + 0.4, P.y + 0.03, P.z), { hp: 1e7 });
  e.whirlCd = 0;
  const vel = V(vx, 0, vz);
  stub(player, 'velocity', vel);
  let aim = null, locked = null, drift = 0;
  stub(enemies, 'whirlFling', (en, at) => { aim = aim || at.clone(); });
  for (let f = 0; f < 60 * 3 && !aim; f++) {
    step(1, () => { P.x += vel.x / 60; P.z += vel.z / 60; });
    if (e.state === 'whirl' && e.whirlK >= 0.6 && !locked) { locked = { jelly: P.clone(), at: e.whirlAt.clone() }; if (aside) vel.set(0, 0, aside); }
    else if (locked && !aim) drift = Math.max(drift, e.whirlAt.distanceTo(locked.at));
  }
  enemies.kill(e, true);
  return { aim, locked, drift };
}

story('bugs/dragonfly-leads-a-moving-jelly', {
  about: 'A Dragonfly winding up a whirlwind at a jelly swimming 0.3 m/s across its front aims ahead of it, along its swim: when the aim locks, it is well beyond where the jelly is.',
  setup() {},
  play() {
    const w = windup(0, 0.3), ahead = w.locked ? w.locked.at.z - w.locked.jelly.z : null;
    return ok(ahead !== null && ahead > 0.1 && Math.abs(w.locked.at.x - w.locked.jelly.x) < 0.01, { ahead });
  },
});

story('bugs/dragonfly-aims-at-a-still-jelly-as-before', {
  about: 'A Dragonfly winding up a whirlwind at a jelly holding still aims right at it, as it always has.',
  setup() {},
  play() {
    const w = windup(0, 0), off = w.locked ? Math.hypot(w.locked.at.x - w.locked.jelly.x, w.locked.at.z - w.locked.jelly.z) : null;
    return ok(off !== null && off < 0.005, { off });
  },
});

story('bugs/dragonfly-misses-a-jelly-that-steps-aside-after-the-lock', {
  about: 'Once the whirlwind\'s aim has locked, a jelly changing course does not move it: the line it is flung along is exactly the locked one.',
  setup() {},
  play() {
    const w = windup(0, 0.3, { aside: -0.3 });
    return ok(w.locked && w.aim && w.drift < 1e-6 && w.aim.distanceTo(w.locked.at) < 1e-6, { drift: w.drift });
  },
});
