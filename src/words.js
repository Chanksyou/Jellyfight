// The game's vocabulary: every behaviour word the content files (content/*.kdl) can use,
// each defined exactly once. A word has a one-line `doc`, its positional `args`, its named
// `props` (with defaults), and `make`, which returns what the word does.
//
// Enemy words run every frame for every bug that uses them, in the order the bug lists them.
// A word's tick gets the bug `e`, the frame `c` and the Enemies system `en`:
//   c.dt, c.t           frame time, seconds into the night
//   c.pc                the jelly's middle (Vector3)
//   c.toP, c.dist       from the bug to the jelly, and how far
//   c.flatDir, c.flat   the same, flat on the floor (unit vector, meters)
//   c.slow              1 normally, 0.55 slowed, 0 frozen or stunned
//   c.speed, c.dir      ground bugs: set these and the bug walks that way (collision included)
// Flying words move the bug themselves and set `fly`.
//
// To teach the game a new behaviour: add a word here (small, one job), use it in a .kdl file,
// and add a story (src/stories.js) that proves it.
import * as THREE from 'three';

const _away = new THREE.Vector3(), _spot = new THREE.Vector3(), _want = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const ENEMY_WORDS = {
  chase: {
    doc: 'Walks straight at you at `speed` m/s.',
    args: ['speed'],
    make: ([speed]) => ({
      ground: true,
      tick(e, c) { c.dir.copy(c.flatDir); c.speed = speed * c.slow; },
    }),
  },

  'curl-dash': {
    doc: 'Up close, stops and winds up for `windup` s, dashes at `speed` m/s for `time` s (hitting for `dmg`), then rests for `rest` s. List it after the walking word.',
    props: { windup: 0.45, time: 0.45, speed: 0.825, rest: 0.6, dmg: null, range: 0.2 },
    make: (_, p) => ({
      rollDmg: p.dmg,
      tick(e, c) {
        e.stateT -= c.dt;
        if (e.state === 'approach' && c.flat < p.range && e.grounded) { e.state = 'windup'; e.stateT = p.windup; }
        else if (e.state === 'windup') {
          c.speed = 0;
          if (e.stateT <= 0) { e.state = 'dash'; e.stateT = p.time; e.dashDir.copy(c.flatDir); }
        } else if (e.state === 'dash') {
          c.speed = p.speed * c.slow;
          c.dir.copy(e.dashDir);
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; }
        } else if (e.state === 'rest') {
          c.speed *= 0.3;
          if (e.stateT <= 0) e.state = 'approach';
        }
      },
    }),
  },

  hover: {
    doc: 'Flies `distance` m from you and `above` m higher, circling slowly, at up to `speed` m/s.',
    args: ['distance'],
    props: { above: 0.07, speed: 0.33, circle: 0.4 },
    make: ([distance], p) => ({
      fly: true,
      tick(e, c) {
        const away = _away.copy(e.pos).sub(c.pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize().applyAxisAngle(UP, c.dt * p.circle);
        const to = _spot.copy(c.pc).addScaledVector(away, distance).setY(c.pc.y + p.above).sub(e.pos);
        const s = p.speed * c.slow;
        e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * c.dt));
        e.pos.addScaledVector(e.vel, c.dt);
      },
    }),
  },

  drift: {
    doc: 'Flies at your middle at `speed` m/s with a lazy wobble.',
    args: ['speed'],
    make: ([speed]) => ({
      fly: true,
      tick(e, c) {
        const s = speed * c.slow, d = _away.copy(c.toP).normalize();
        const wob = Math.sin(c.t * 3 + e.phase) * 0.35;
        e.vel.lerp(_want.set(d.x + wob * d.z, d.y + Math.sin(c.t * 2 + e.phase) * 0.3, d.z - wob * d.x).multiplyScalar(s), 1 - Math.exp(-3 * c.dt));
        e.pos.addScaledVector(e.vel, c.dt);
      },
    }),
  },

  spit: {
    doc: 'Every `every` s, if you are within `reach` m, spits a shot at you (`speed` m/s, lasts `life` s, `dmg` damage), dipping to aim for `aim` s first.',
    props: { every: 2.4, reach: 0.45, speed: 0.48, life: 1.47, dmg: 1, aim: 0.35 },
    make: (_, p) => ({
      init(e) { e.shootT = 1 + Math.random() * 1.5; e.aimT = 0; },
      tick(e, c, en) {
        e.shootT -= c.dt * (c.slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - c.dt);
        if (e.shootT <= p.aim && e.aimT <= 0 && e.shootT > 0) e.aimT = p.aim;
        if (e.shootT <= 0 && c.dist < p.reach) { e.shootT = p.every; en.spit(e, c.pc, p.speed, p.life, p.dmg); }
        else if (e.shootT <= 0) e.shootT = 0.5;
      },
    }),
  },

  rolls: {
    doc: 'Its body rolls along the floor as it moves (no animation of its own).',
    make: () => ({ rolls: true }),
  },

  'slows-on-touch': {
    doc: 'Touching it slows you down for a moment (sticky lint).',
    make: () => ({ slows: true }),
  },
};

// Check one word use from a content file and build it. Throws a message that names the file
// and line, so a typo in a .kdl file says exactly what's wrong.
export function makeWord(registry, node, where) {
  const def = registry[node.name];
  if (!def) throw new Error(`${where}: unknown word "${node.name}". Known words: ${Object.keys(registry).join(', ')}`);
  const want = def.args || [];
  if (node.args.length !== want.length) throw new Error(`${where}: "${node.name}" takes ${want.length ? want.join(', ') : 'no arguments'}, got ${node.args.length}`);
  for (const k of Object.keys(node.props)) if (!(def.props && k in def.props)) throw new Error(`${where}: "${node.name}" has no setting "${k}"${def.props ? ` (it has: ${Object.keys(def.props).join(', ')})` : ''}`);
  return def.make(node.args, { ...def.props, ...node.props });
}
