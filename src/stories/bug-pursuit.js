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
