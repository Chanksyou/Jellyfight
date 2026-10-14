// Stories: wasp nest spots (imported last: it leaves act 3 loaded). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { CONTENT } from '../content.js';
import { NEST } from '../critters.js';
import { STAGE3 } from '../stage3.js';
import { nestMiddle } from '../run.js';
import { G, V, fresh, ok, story } from './kit.js';

// (keep this one last of all: it leaves act 3's bedroom loaded, and its lamps change the light count,
// so every shader after it would be rebuilt)
story('nests/bedroom-spots', {
  about: 'Every spot act 3 lists for a wasp nest has it hanging against a wall or a piece of furniture in the bedroom, clear of everything else, low enough to hit from the floor beside it; a run hangs nests at two different ones.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { world, GAME, run, enemies } = G();
    await GAME.loadRooms(['act3']);
    const r = CONTENT.enemies.nest.r, H = NEST.height * r, W = NEST.width * r, bad = [];
    const cast = (from, dir, far) => { world._focusAge = Infinity; world.focus(from, 0); return world.cast(from, dir.clone().normalize(), far); };
    for (const s of STAGE3.nests.spots) {
      const M = nestMiddle(s, r), out = V(s.out[0], 0, s.out[1]), side = V(-s.out[1], 0, s.out[0]);
      const back = cast(M, out.clone().negate(), W * 1.3);                  // the surface it hangs on
      const clear = [out, side, side.clone().negate()].every((d) => !cast(M, d, W * 0.9));   // nothing else where the nest is
      const floor = cast(M, V(0, -1, 0), 2);                                 // something under it
      const stand = M.clone().addScaledVector(out, W + 0.15), ground = cast(stand.clone().setY(stand.y + 0.3), V(0, -1, 0), 2);
      const eye = ground && ground.point.clone().setY(ground.point.y + 0.045);
      const seen = eye && !cast(eye, M.clone().sub(eye), eye.distanceTo(M) - W);   // a clear shot from the floor beside it
      const ok1 = back && clear && floor && floor.point.y < M.y - H / 2 && ground && ground.point.y < 0.05 && seen;
      if (!ok1) bad.push({ on: s.on, back: !!back, clear, under: floor && +floor.point.y.toFixed(2), standY: ground && +ground.point.y.toFixed(2), seen: !!seen });
    }
    const nests = run.spawnNests(STAGE3), spots = new Set(nests.map((n) => n.spot.on));
    const hanging = nests.every((n) => n.type === 'nest' && n.T.rooted);
    nests.forEach((n) => enemies.kill(n, true));
    return ok(!bad.length && nests.length === 2 && spots.size === 2 && hanging, { bad, nests: nests.length, spots: [...spots] });
  },
});