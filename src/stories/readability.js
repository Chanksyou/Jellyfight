// Stories: keeping a crowded fight readable. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { bus } from '../events.js';
import { G, V, fresh, ok, spawn, step, story, tp } from './kit.js';

story('readability/steady-fire-blinks-not-stays-white', {
  about: 'A bug under steady fire (hit every other frame for 2 s) blinks with the hits instead of staying a solid white shape: it flashes several times, but is white for under half the time.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', G().player.position.clone().add(V(0, 0, -0.15)), { still: true, hp: 1e9 }); },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    let white = 0, flashes = 0, was = false;
    for (let f = 0; f < 120; f++) {
      if (f % 2 === 0) bus.emit('damage_taken', { targetId: e.id, amount: 1, source: 'bubble' });
      step(1);
      const on = e.flashT > 0;
      if (on) white++;
      if (on && !was) flashes++;
      was = on;
    }
    return ok(flashes >= 5 && white / 120 < 0.5, { flashes, whiteShare: +(white / 120).toFixed(2) });
  },
});

story('readability/crowd-ring-under-a-swarmed-jelly', {
  about: 'With five bugs pressed round the jelly, a soft cool ring fades in under it so you can find yourself in the swarm; with none near, it fades away.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, player, enemies } = G(), P = player.position, R = run.crowdRing;
    step(20);
    const alone = R.visible;
    const bugs = [0, 1, 2, 3, 4].map((k) => spawn('roach', P.clone().add(V(Math.cos(k * 1.26) * 0.07, 0, Math.sin(k * 1.26) * 0.07)), { still: true, hp: 1e9 }));
    step(40);
    const crowded = R.visible && R.material.opacity > 0.3, under = Math.hypot(R.position.x - P.x, R.position.z - P.z) < 1e-6;
    bugs.forEach((e) => enemies.kill(e, true));
    step(60);
    return ok(!alone && crowded && under && !R.visible, { alone, crowded, opacity: +R.material.opacity.toFixed(2), under, after: R.visible });
  },
});
