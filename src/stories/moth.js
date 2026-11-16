// Stories: the moth (act 4) and the `dive` that spares it. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { G, fresh, near, night4, ok, record, spawn, step, stub, tp, story } from './kit.js';

story('words/dive-spare', {
  about: 'A moth circles you, rears with its wings flared, then swoops at where you were for 3; it lives, pulls up and comes round again for a second swoop. A wasp, by contrast, dies in its sting.',
  act: 4,
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const m = spawn('moth', near(0.3, 0, 0.1)); m.diveCd = 0; },
  play() {
    const { enemies } = G(), m = enemies.list[0], log = record('damage_taken'), states = new Set();
    const stings = () => log.filter((d) => d.source === 'moth' && d.amount === 3).length;
    step(60 * 12, () => { states.add(m.state); return stings() >= 2; });
    return ok(stings() >= 2 && states.has('windup') && states.has('dive') && !m.dead, { stings: stings(), states: [...states], dead: m.dead });
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
