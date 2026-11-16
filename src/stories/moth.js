// Stories: the moth (act 4), its `lamp` word and the lamp-triggered `dive`. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import * as THREE from 'three';
import { G, V, fresh, near, night4, ok, record, spawn, step, stub, tp, story } from './kit.js';

// a lit lamp `dx` metres beside the jelly, a little over its head (a stand-in: stories add no real light)
function lampBeside(dx, intensity = 5) {
  const { enemies, player } = G(), L = new THREE.PointLight(0xffd9a0, intensity);
  L.position.copy(player.position).add(V(dx, 0.3, 0));
  enemies.lamps.push(L);
  return L;
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const mothSetup = () => { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); G().enemies.lamps.length = 0; tp(3.2, 0.05, 3.0, 0); };

story('words/lamp', {
  about: 'A moth circles the nearest lit lamp (not an unlit one, not one out of reach), staying out of its swoop while you are away from it; with no lamp lit near you it circles you instead.',
  act: 4,
  setup: mothSetup,
  play() {
    const { enemies, player } = G();
    const lit = lampBeside(0.9); lampBeside(0.5, 0); lampBeside(2.5);   // an unlit one nearer, and a lit one out of reach
    const m = spawn('moth', near(0.9, 0, 0.1));
    step(60 * 3);
    const round = flat(m.pos, lit.position), away = m.state === 'approach' && !m.lampNear;
    enemies.lamps.length = 0;                      // every lamp out: it circles you
    step(60 * 3);
    const roundYou = flat(m.pos, player.position);
    return ok(round < 0.3 && away && m.lampAt === null && roundYou < 0.3, { round, away, roundYou });
  },
});

story('words/dive-lamp', {
  about: 'Standing under a moth\'s lamp makes it rear up, then swoop at you for 3; it lives, pulls up and goes back to circling its lamp. Standing away from the lamp, it never swoops.',
  act: 4,
  setup: mothSetup,
  play() {
    const { enemies, player } = G(), log = record('damage_taken');
    const lamp = lampBeside(0.6);
    const m = spawn('moth', near(0.6, 0, 0.1));
    m.diveCd = 0;
    step(60 * 3);
    const calm = m.state === 'approach' && !log.length;           // you are 0.6 m from its lamp
    tp(lamp.position.x - 0.1, 0.05, lamp.position.z, 0);           // now you stand under the lamp
    const states = new Set();
    step(60 * 4, () => { states.add(m.state); return log.some((d) => d.source === 'moth'); });
    const hit = log.find((d) => d.source === 'moth');
    step(60 * 3, () => { states.add(m.state); return false; });
    return ok(calm && states.has('windup') && states.has('dive') && hit?.amount === 3 && !m.dead && m.state === 'approach' && m.lampNear,
      { calm, states: [...states], hit: hit?.amount, dead: m.dead, state: m.state });
  },
});

night4('moth-from-0-45', {
  about: 'Act 4\'s night brings moths from 0:45, and not before: a roll favouring the last eligible bug cannot spawn one at 0:44.9, but does at 0:45.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => 0.999999);
    stub(run, 'spawnPoint', () => player.position.clone());   // eligibility is separate from scenery placement
    const during = (t) => { enemies.clear(); run.t = t; run.spawnAcc = 1; run.spawnWaves(0); return enemies.list.filter((e) => e.type === 'moth').length; };
    const before = during(44.9), after = during(45);
    return ok(!before && after > 0, { before, after });
  },
});
