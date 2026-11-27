// Stories: how the plain bubble leaves the bell, flies and tears open when it pops (src/bubbles.js:
// shape, swell, startShell, tickShells, dropletRing). Looks only: its hit size, damage and Range never move.
import { G, V, ok, step, story, stub, fresh, tp } from './kit.js';
import { juice } from '../juice.js';

const quiet = () => { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(G().run.bubbles, 'volley', () => false); juice.calm = false; };
const bell = () => { const { player, run } = G(); return player.position.clone().setY(player.position.y + run.cfg.height * 0.75); };
const blowStill = (B) => B.blow(bell(), null, { size: 1, dmg: 1, pierce: 1, dir: V(0, 0, -1), speed: 0.001 });

story('motion/bubble-settles-after-launch', {
  about: 'A new bubble swells out of the bell past its size (to 115%), is stretched along its flight and faces it, and is back at its size, round, within half a second. Its hit size never moves.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles, b = blowStill(B), R = b.r * B.draw, z = V(0, 0, 1);
    let peak = 0, stretch = 0, faces = true;
    for (let i = 0; i < 30; i++) {
      step(1);
      peak = Math.max(peak, b.m.scale.z / R);
      if (i < 8) stretch = Math.max(stretch, b.m.scale.z / b.m.scale.x);
      faces &&= z.set(0, 0, 1).applyQuaternion(b.m.quaternion).distanceTo(V(0, 0, -1)) < 0.01;
    }
    const rest = { x: b.m.scale.x / R, z: b.m.scale.z / R };
    return ok(peak > 1.08 && stretch > 1.1 && faces && Math.abs(rest.x - 1) < 0.03 && Math.abs(rest.z - 1) < 0.03 && b.r === 0.0065 * run.S.bubbleSize, { peak, stretch, faces, rest });
  },
});

story('motion/bubble-holds-still-in-reduce-effects', {
  about: 'With Reduce effects on, a new bubble appears at its size, round: no swell, no spring, no stretch.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles, was = juice.calm;
    juice.calm = true;
    try {
      const b = blowStill(B), R = b.r * B.draw, seen = [];
      for (let i = 0; i < 12; i++) { step(1); seen.push([b.m.scale.x / R, b.m.scale.y / R, b.m.scale.z / R]); }
      return ok(seen.every((s) => s.every((v) => Math.abs(v - 1) < 1e-6)), { first: seen[0] });
    } finally { juice.calm = was; }
  },
});
