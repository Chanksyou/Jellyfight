// Stories: how the plain bubble leaves the bell, flies and tears open when it pops (src/bubbles.js:
// shape, swell, startShell, tickShells, dropletRing). Looks only: its hit size, damage and Range never move.
import { G, V, ok, spawn, step, story, stub, fresh, tp } from './kit.js';
import { sfx } from '../sfx.js';
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

// a bubble popping on a still roach: the pop's picture and sound, counted
function popOnRoach() {
  const { run, fx, enemies } = G(), B = run.bubbles;
  enemies.clear(); B.reset();
  const e = spawn('roach', G().player.position.clone().add(V(0, 0, -0.2)), { still: true, hp: 9999 });
  const at = { impact: 0, drops: 0, pop: [], splat: 0 };
  const real = fx.burst.bind(fx);
  stub(fx, 'impact', () => { at.impact++; }); stub(fx, 'splat', () => { at.splat++; });
  stub(fx, 'burst', (...a) => { at.drops += a[2]; return real(...a); });
  stub(sfx, 'pop', (...a) => { at.pop.push(a[0]); });
  const b = B.blow(bell(), e, { size: run.S.bubbleSize, dmg: run.S.bubbleDamage, pierce: 1 });
  step(120, () => b.done);
  return { B, b, at };
}

story('attack/bubble-pop-sweeps-then-frees', {
  about: 'A bubble that pops on a bug leaves its shell for about a twelfth of a second: the film tears open from the front (extra 0 to 1) while the shell swells, then the shell is hidden and back in the pool, with nothing left in the list. A hit throws six droplets, a flash, a floor splat and a pop sound.',
  setup() { quiet(); },
  play() {
    const { B, b, at } = popOnRoach();
    const m = b.m, r0 = m.scale.z;
    step(1);
    const sh = B.shells.some((S) => S.m === m), early = m.userData.extra;
    step(2);
    const mid = { extra: m.userData.extra, scale: m.scale.z / r0, shown: m.visible };
    step(6);
    const freed = !m.visible && B.pool.includes(m) && !B.shells.length && !B.list.includes(b);
    return ok(sh && early > 0 && early < 1 && mid.extra > early && mid.scale > 1.02 && mid.shown && freed
      && at.impact === 1 && at.drops === 6 && at.splat === 1 && at.pop.length === 1, { early, mid, freed, at });
  },
});

story('attack/bubble-miss-has-no-flash', {
  about: 'A bubble that pops on a wall or at the end of its Range (no bug) tears open too, but thinner, with no flash, no droplets, no floor splat and no pop sound.',
  setup() { quiet(); },
  play() {
    const { run, fx } = G(), B = run.bubbles, at = { impact: 0, burst: 0, splat: 0, pop: 0 };
    B.reset();
    stub(fx, 'impact', () => { at.impact++; }); stub(fx, 'burst', () => { at.burst++; }); stub(fx, 'splat', () => { at.splat++; }); stub(sfx, 'pop', () => { at.pop++; });
    const b = blowStill(B);
    step(2);
    B.pop(b, null, run.S, run.mods);
    step(2);
    const S = B.shells[0];
    const swept = !!S && S.m.userData.extra > 0 && S.m.userData.opacity < 0.7;
    step(8);
    return ok(swept && !B.shells.length && !at.impact && !at.burst && !at.splat && !at.pop, { swept, at, left: B.shells.length });
  },
});

story('motion/bubble-pop-is-a-fade-in-reduce-effects', {
  about: 'With Reduce effects on, a popped bubble fades out quickly without tearing open or swelling.',
  setup() { quiet(); },
  play() {
    const { run } = G(), B = run.bubbles, was = juice.calm;
    juice.calm = true;
    try {
      B.reset();
      const b = blowStill(B);
      step(20);
      const m = b.m, s0 = m.scale.z;
      B.pop(b, null, run.S, run.mods);
      step(2);
      const op = m.userData.opacity, extra = m.userData.extra, same = Math.abs(m.scale.z - s0) < 1e-9;
      step(8);
      return ok(op < 1 && extra === 0 && same && !B.shells.length && !m.visible, { op, extra, same });
    } finally { juice.calm = was; }
  },
});
