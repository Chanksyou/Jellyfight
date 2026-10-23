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

story('readability/new-effect-pieces-start-small', {
  about: 'The first hit of a run used to flash huge white circles: a brand-new puff or splat (a pooled piece, 1 m across) was drawn for a frame at full size before its first update. A new piece now starts at size 0, and a puff or splat is sized the moment it\'s spawned.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { fx, player } = G(), at = player.position.clone();
    const busy = (list) => { const was = list.map((x) => x.alive); list.forEach((x) => { x.alive = true; }); return () => list.forEach((x, i) => { x.alive = was[i]; }); };
    const freePuffs = busy(fx.puffs), freeSplats = busy(fx.splats);
    try {
      const np = fx.puffs.length, ns = fx.splats.length;
      fx.puff(at, 0xffffff, 0.02); fx.splat(at, null, 0.02);
      const puff = fx.puffs[np]?.m, splat = fx.splats.length > ns ? fx.splats[ns].m : null;
      const puffSize = puff ? +puff.scale.x.toFixed(4) : null, splatSize = splat ? +splat.scale.x.toFixed(4) : 0;
      return ok(puff && puffSize <= 0.02 && splatSize <= 0.02, { puffSize, splatSize, newSplat: !!splat });
    } finally { freePuffs(); freeSplats(); }
  },
});
