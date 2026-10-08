// The game's vocabulary: every behaviour word the content files (content/*.kdl) can use,
// each defined exactly once. A word has a one-line `doc`, its positional `args`, its named
// `props` (with defaults), and `make`, which returns what the word does.
//
// Enemy words run every frame for every bug that uses them, in the order the bug lists them.
// A word's tick gets the bug `e`, the frame `c` and the Enemies system `en`:
//   c.dt, c.t           frame time, seconds into the night
//   c.pc                the jelly's middle (Vector3); c.foot where it stands
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
    doc: 'Walks straight at you at `speed` m/s. With `stop` (m), a ranged bug keeps its distance: it stops that far from you and backs away (at `back` times its speed) when you come closer than 3/4 of it. With `weave` (radians), it snakes from side to side as it comes, `rate` swings a second. With `turn` (radians a second), it can only turn that fast, so it swings round in arcs instead of pivoting.',
    args: ['speed'],
    props: { stop: 0, back: 0.6, weave: 0, rate: 2.5, turn: 0 },
    make: ([speed], p) => ({
      ground: true,
      tick(e, c) {
        c.dir.copy(c.flatDir);
        if (p.weave) c.dir.applyAxisAngle(UP, Math.sin(c.t * p.rate * Math.PI + e.phase) * p.weave);
        if (p.turn) {
          // its heading swings toward where it wants to go, no faster than `turn`
          const h = (e.heading ||= c.dir.clone()), cur = Math.atan2(h.x, h.z);
          let d = Math.atan2(c.dir.x, c.dir.z) - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const a = cur + THREE.MathUtils.clamp(d, -p.turn * c.dt, p.turn * c.dt);
          c.dir.copy(h.set(Math.sin(a), 0, Math.cos(a)));
        }
        c.speed = speed * c.slow;
        if (!p.stop || c.flat > p.stop) return;
        if (c.flat < p.stop * 0.75) { c.dir.negate(); c.speed *= p.back; }   // too close: back off
        else c.speed = 0;                                                      // in range: hold
      },
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

  leap: {
    doc: 'Up close (within `range` m) every `every` s or so, crouches for `windup` s while a ring on the floor marks where it will land (the spot locks halfway through), then leaps `height` m high and comes down there `time` s later: you take `dmg` if you are within `radius` m of the landing. Then it rests `rest` s. List it after the walking word.',
    props: { range: 0.3, windup: 0.55, height: 0.2, time: 0.75, radius: 0.075, dmg: 3, rest: 0.9, every: 1.5 },
    make: (_, p) => {
      const target = (e, c) => {
        // where you stand, but no farther than it can jump
        const t = (e.leapAt ||= new THREE.Vector3()).copy(c.foot), d = _away.copy(t).sub(e.pos).setY(0), max = p.range * 1.5;
        if (d.length() > max) t.copy(e.pos).addScaledVector(d.normalize(), max).setY(c.foot.y);
      };
      return {
        leapRadius: p.radius,
        init(e) { e.leapCd = 1 + Math.random() * 1.5; },
        tick(e, c, en) {
          e.stateT -= c.dt;
          e.leapCd -= c.dt;
          if (e.state === 'approach') {
            if (c.flat < p.range && e.grounded && e.leapCd <= 0) { e.state = 'crouch'; e.stateT = p.windup; target(e, c); }
          } else if (e.state === 'crouch') {
            c.speed = 0;
            e.leapK = 1 - Math.max(0, e.stateT) / p.windup;
            if (e.stateT > p.windup * 0.5) target(e, c);
            if (e.stateT <= 0) { e.state = 'leap'; e.stateT = p.time; e.leapK = 0; (e.leapFrom ||= new THREE.Vector3()).copy(e.pos); e.airborne = true; }
          } else if (e.state === 'leap') {
            // a ballistic arc from where it crouched onto the marked spot (it flies itself: no walking, no gravity)
            c.speed = 0;
            e.vel.set(0, 0, 0);
            const u = Math.min(1, 1 - e.stateT / p.time);
            e.leapK = u;
            e.pos.lerpVectors(e.leapFrom, e.leapAt, u);
            e.pos.y += 4 * p.height * u * (1 - u);
            if (u >= 1) { e.airborne = false; e.grounded = false; e.state = 'rest'; e.stateT = p.rest; e.leapCd = p.every; en.slam(e, c, p.radius, p.dmg); }
          } else if (e.state === 'rest') {
            c.speed *= 0.2;
            if (e.stateT <= 0) e.state = 'approach';
          }
        },
      };
    },
  },

  hover: {
    doc: 'Flies `distance` m from you and `above` m higher, circling slowly, at up to `speed` m/s.',
    args: ['distance'],
    props: { above: 0.07, speed: 0.33, circle: 0.4 },
    make: ([distance], p) => ({
      fly: true,
      tick(e, c) {
        if (e.flyHeld) return;              // another word is holding it still (a poke)
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

  sortie: {
    doc: 'A flier that lands to shoot: it flies round you `circle` m out and `height` m up at up to `speed` m/s for about `fly` s, then lands on the floor `land` m from you, raises its carapace and locks on for `aim` s (a reticle closes in round you, beeping faster), and fires a homing missile: `rocket` m/s, turning `turn` radians a second, hunting you for `fuel` s (then it sputters out and falls), `dmg` if it hits. It closes up, rests `rest` s and takes off again.',
    props: { circle: 0.3, height: 0.12, speed: 0.4, fly: 3, land: 0.35, aim: 0.9, rest: 0.7, rocket: 0.36, turn: 2.4, fuel: 4, dmg: 3 },
    make: (_, p) => ({
      fly: true,
      init(e) {
        e.state = 'approach'; e.stateT = p.fly * (0.6 + Math.random() * 0.6);
        e.flyK = 1; e.wingK = 1; e.shellK = 0.35; e.loaded = true;
        e.orbit = Math.random() * Math.PI * 2; e.orbitDir = Math.random() < 0.5 ? 1 : -1;
      },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        if (e.firedT > 0) e.firedT -= c.dt;
        if (e.state === 'approach') {
          // circling you, bobbing, wings a blur
          e.flyK = 1; e.wingK = 1; e.shellK = 0.35;
          e.orbit += c.dt * e.orbitDir * 1.2 * c.slow;
          const to = _spot.set(c.foot.x + Math.cos(e.orbit) * p.circle, c.foot.y + p.height + Math.sin(c.t * 2 + e.phase) * 0.03, c.foot.z + Math.sin(e.orbit) * p.circle).sub(e.pos);
          const s = p.speed * c.slow;
          e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * c.dt));
          e.pos.addScaledVector(e.vel, c.dt);
          if (e.stateT <= 0) {
            // land on the floor between it and you, `land` from you
            const away = _away.copy(e.pos).sub(c.foot).setY(0);
            if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
            const spot = c.foot.clone().addScaledVector(away.normalize(), p.land);
            const floor = en.floorBelow(spot, c.foot.y);
            (e.landFrom ||= new THREE.Vector3()).copy(e.pos);
            (e.landAt ||= new THREE.Vector3()).set(spot.x, floor + 0.76 * e.r, spot.z);
            e.state = 'land'; e.stateT = e.landMax = 0.8;
          }
        } else if (e.state === 'land') {
          const u = THREE.MathUtils.smoothstep(1 - Math.max(0, e.stateT) / e.landMax, 0, 1);
          e.pos.lerpVectors(e.landFrom, e.landAt, u);
          e.pos.y += Math.sin(u * Math.PI) * 0.03;
          e.vel.set(0, 0, 0);
          e.flyK = 1 - u * 0.6;
          if (e.stateT <= 0) { e.state = 'raise'; e.stateT = 0.45; e.flyK = 0; e.wingK = 0; en.ladyLand(e); }
        } else if (e.state === 'raise') {
          e.vel.set(0, 0, 0); e.shellK = 1;
          if (e.stateT <= 0) { e.state = 'aim'; e.stateT = e.aimMax = p.aim; e.beepT = 0; }
        } else if (e.state === 'aim') {
          // locking on: the reticle tracks you and closes in, the beeps quicken
          e.vel.set(0, 0, 0);
          (e.lockAt ||= new THREE.Vector3()).copy(c.foot);
          const k = 1 - Math.max(0, e.stateT) / e.aimMax;
          if ((e.beepT -= c.dt) <= 0) { e.beepT = 0.26 - 0.2 * k; en.lockBeep(k); }
          if (e.stateT <= 0) { en.launchMissile(e, p); e.loaded = false; e.firedT = 0.35; e.state = 'close'; e.stateT = 0.5; }
        } else if (e.state === 'close') {
          e.vel.set(0, 0, 0);
          if (e.stateT < 0.3) e.shellK = 0;
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; }
        } else if (e.state === 'rest') {
          e.vel.set(0, 0, 0);
          e.stepK = 1;
          if (e.stateT <= 0 && live) {
            e.state = 'approach'; e.stateT = p.fly * (0.7 + Math.random() * 0.6);
            e.loaded = true; e.stepK = 0; e.flyK = 1; e.wingK = 1; e.vel.set(0, 0.35, 0);
            en.ladyTakeoff(e);
          }
        }
      },
    }),
  },

  'ball-charge': {
    doc: 'Up close (within `range` m) every `every` s or so, curls into an armoured ball over `curl` s (hits on it do 75% less while it is curled up), spins up in place for `spin` s while a line on the floor shows where it will go (the aim locks halfway through), then rolls along it at `speed` m/s for `time` s, hitting for `dmg`. It uncurls over `uncurl` s and rests `rest` s. List it after the walking word.',
    props: { range: 0.4, curl: 0.45, spin: 0.9, speed: 0.95, time: 0.7, dmg: 4, uncurl: 0.5, rest: 0.8, every: 2.5 },
    make: (_, p) => ({
      rollDmg: p.dmg,                     // touching you mid-roll hits this hard (Run.contactDamage)
      chargeLen: p.speed * p.time,
      init(e) { e.ballCd = 1 + Math.random() * 1.5; e.curlK = 0; e.spinA = 0; e.spinV = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it holds whatever shape it's in
        e.stateT -= c.dt * live;
        e.ballCd -= c.dt;
        if (e.state === 'rest' && e.curlK > 0) { e.state = 'uncurl'; e.stateT = p.uncurl; }   // rolled into a wall (Enemies.moveGround)
        if (e.state === 'approach') {
          if (c.flat < p.range && e.grounded && e.ballCd <= 0 && live) { e.state = 'curl'; e.stateT = p.curl; en.ballCurl(e); }
        } else if (e.state === 'curl') {
          c.speed = 0;
          e.curlK = 1 - Math.max(0, e.stateT) / p.curl;
          if (e.stateT <= 0) { e.state = 'spin'; e.stateT = e.spinMax = p.spin; e.curlK = 1; en.ballRev(e, p.spin); }
        } else if (e.state === 'spin') {
          c.speed = 0;
          const u = 1 - Math.max(0, e.stateT) / p.spin;
          e.spinV = 26 * u * u;                                   // revving up
          if (u < 0.5) {                                          // aiming (locks halfway)
            e.dashDir.copy(c.flatDir);
            e.faceLock = true;
            e.root.rotation.y = Math.atan2(c.flatDir.x, c.flatDir.z);
            e.chargeFloor = e.pos.y;
          }
          if (u > 0.3 && live) en.ballDust(e);
          if (e.stateT <= 0) { e.state = 'dash'; e.stateT = p.time; en.ballGo(e, p.time); }
        } else if (e.state === 'dash') {
          c.speed = p.speed * c.slow;
          c.dir.copy(e.dashDir);
          e.spinV = 26;
          if (e.stateT <= 0) { e.state = 'uncurl'; e.stateT = p.uncurl; }
          e.heading?.copy(e.dashDir);                            // it carries on the way it rolled
        } else if (e.state === 'uncurl') {
          c.speed = 0;
          e.spinV *= Math.exp(-6 * c.dt);
          e.curlK = Math.max(0, e.stateT) / p.uncurl;
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; e.curlK = 0; e.spinV = 0; e.faceLock = false; e.ballCd = p.every; }
        } else if (e.state === 'rest') {
          c.speed *= 0.3;
          if (e.stateT <= 0) e.state = 'approach';
        }
        e.spinA += e.spinV * c.dt * live;
        e.armor = e.curlK > 0.5 ? 0.75 : 0;                       // curled up: armoured, hits do 75% less
        e.hitR = e.armor && e.ballR ? e.ballR : 0;               // and as big as its ball
      },
    }),
  },

  poke: {
    doc: 'Up close (within `range` m) every `every` s or so, hangs beside you rubbing its front legs for `windup` s while a short line on the floor shows where it will strike (the aim locks halfway through), then shoots its straw of a mouth out up to `reach` m in `time` s: you take `dmg` if you are at the end of it. It holds it out `hold` s, pulls it back and rests `rest` s. List it after the flying word.',
    props: { range: 0.14, windup: 0.5, reach: 0.15, dmg: 3, time: 0.08, hold: 0.15, rest: 0.7, every: 1.4 },
    make: (_, p) => {
      // aim at your middle (no farther than it reaches); how long the straw must get, and its tilt
      const lock = (e, c) => {
        const d = Math.min(p.reach, e.pos.distanceTo(c.pc) + 0.02);
        (e.pokeAt ||= new THREE.Vector3()).copy(c.pc).sub(e.pos).normalize().multiplyScalar(d).add(e.pos);
        e.pokeFloor = c.foot.y;
        e.pokeLen = Math.max(0.3, d / e.r - 0.7);                       // radius units, from under its head
        e.pokePitch = Math.atan2(e.pos.y - e.pokeAt.y, Math.hypot(e.pokeAt.x - e.pos.x, e.pokeAt.z - e.pos.z) + 1e-6);
      };
      return {
        init(e) { e.pokeCd = 0.6 + Math.random(); e.pokeK = 0; },
        tick(e, c, en) {
          const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it stays put
          e.stateT -= c.dt * live;
          e.pokeCd -= c.dt;
          if (e.state === 'approach') {
            if (c.dist < p.range && e.pokeCd <= 0 && live) { e.state = 'windup'; e.stateT = e.pokeMax = p.windup; e.flyHeld = true; lock(e, c); }
          } else if (e.state === 'windup') {
            e.vel.multiplyScalar(Math.exp(-10 * c.dt));
            e.pos.addScaledVector(e.vel, c.dt * live);
            if (e.stateT > p.windup * 0.5) lock(e, c);
            else e.faceLock = true;                                     // locked on: it stops turning after you
            if (e.stateT <= 0) { e.state = 'poke'; e.stateT = p.time + p.hold; e.pokeHit = false; }
          } else if (e.state === 'poke') {
            e.pokeK = Math.min(1, (p.time + p.hold - e.stateT) / p.time);
            if (e.pokeK >= 1 && !e.pokeHit) { e.pokeHit = true; en.poke(e, c, p.dmg); }
            if (e.stateT <= 0) { e.state = 'retract'; e.stateT = p.time * 2; }
          } else if (e.state === 'retract') {
            e.pokeK = Math.max(0, e.stateT / (p.time * 2));
            if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; e.flyHeld = false; e.faceLock = false; e.pokeCd = p.every; e.pokeK = 0; }
          } else if (e.state === 'rest' && e.stateT <= 0) e.state = 'approach';
        },
      };
    },
  },

  spit: {
    doc: 'Every `every` s, if you are within `reach` m, shoots at you: `count` shots fanned across `spread` degrees (`speed` m/s, last `life` s, `dmg` damage each), from `height` radii above its middle. `shot` is "laser" (a bolt; while aiming, a beam shows where it will go) or "web" (a ball of silk). `arc` (m/s²) lobs it so it falls onto where you were; `slow` s of slowed swimming when it hits you. For `aim` s first it winds up; the aim locks halfway through, so moving off the line dodges.',
    props: { every: 2.4, reach: 0.45, speed: 0.48, life: 1.47, dmg: 1, aim: 0.35, count: 1, spread: 0, shot: 'laser', height: 0, arc: 0, slow: 0 },
    make: (_, p, where) => {
      if (!['laser', 'web'].includes(p.shot)) throw new Error(`${where}: shot= must be "laser" or "web", not "${p.shot}"`);
      return {
      init(e) { e.shootT = 1 + Math.random() * 1.5; e.aimT = 0; e.aimBeam = p.shot === 'laser'; },
      tick(e, c, en) {
        e.shootT -= c.dt * (c.slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - c.dt);
        if (e.shootT <= p.aim && e.aimT <= 0 && e.shootT > 0 && c.dist < p.reach) e.aimT = e.aimMax = p.aim;
        // the aim locks on half way through the warning, so the line shows where it will really go
        if (e.aimT > p.aim * 0.5) (e.aimAt ||= new THREE.Vector3()).copy(c.pc);
        if (e.shootT <= 0 && c.dist < p.reach) { e.shootT = p.every; en.spit(e, e.aimAt || c.pc, p); e.aimAt = null; e.aimT = 0; e.firedT = 0.25; }
        else if (e.shootT <= 0) e.shootT = 0.5;
        if (e.firedT > 0) e.firedT -= c.dt;
      },
      };
    },
  },

  rolls: {
    doc: 'Its body rolls along the floor as it moves (no animation of its own).',
    make: () => ({ rolls: true }),
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
  // a block word (every N { … }) builds its children from its own little vocabulary
  if (def.block && !node.children.length) throw new Error(`${where}: "${node.name}" needs a { block } of effects (${Object.keys(def.block).join(', ')})`);
  if (!def.block && node.children.length) throw new Error(`${where}: "${node.name}" doesn't take a { block }`);
  const children = def.block ? node.children.map((c) => makeWord(def.block, c, where.replace(/:\d+$/, ':' + c.line))) : null;
  try {
    return def.make(node.args, { ...def.props, ...node.props }, where, children);
  } catch (e) {
    throw new Error(e.message.startsWith(where) ? e.message : `${where}: ${e.message}`);
  }
}

// ------------------------------------------------------------------ treasure words
// A treasure (content/treasures.kdl) is a few of these. Each one adds its effect to the run's
// combined effects, `mods` (see newMods): the systems read mods, never treasure ids. Damage
// numbers are multiples of the run's power (bubble damage x 1.8) unless the doc says otherwise.

// What a run has with no treasures
export function newMods() {
  return {
    bubbles: { pierce: 1, split: false, echo: false, golden: null, giant: null },
    elements: new Set(),
    element: {},                     // element -> its attack's numbers (ELEMENT_BASE, raised by element-up)
    hits: { bubbles: { mark: 0, crit: null, pin: 0 }, tentacles: { mark: 0, crit: null, pin: 0 } },
    popZap: null,
    mouse: null,                     // toy-mouse: { every, dmg, trip, tripDmg, speed }
    reflect: null,                   // reflect: { every, invuln }
    deathSave: null,                 // death-save: { health } (a share of max Health)                    // zap-on-pop: { chance, count, range, stun, dmg }
    stats: { add: {}, pct: {} },     // stat bonuses: added, and % of the starting value
    landingShockwave: null, extraJumps: 0,
    xpReach: 1, xpMult: 1, healOnKill: 0, healOnHit: null, damageTaken: 1,
    growth: [], bugSpeed: 1, moreBugs: 1, cardChoices: 0,
    squeaks: [], onHurt: [], spout: null, burstOnKill: null, cardRarity: 0,
    crumbs: null,                    // crumb-on-kill: { chance, health }
    whiles: [],                      // conditionals: { when, stat, amount, percent } (Run.S)
    per: [],                         // converters: { stat, amount, every, of, percent } (Run.S)
    timed: [], orbit: null, beam: null, aura: null,
  };
}

const BY = ['bubbles', 'tentacles', 'all'];
const scopes = (by, where) => {
  if (!BY.includes(by)) throw new Error(`${where}: by= must be one of ${BY.join(', ')}`);
  return by === 'all' ? ['bubbles', 'tentacles'] : [by];
};
const ELEMENT_IDS = ['fire', 'lightning', 'ice', 'acid', 'wind', 'glitter'];

// Each element is its own attack (bubbles.js): a projectile it fires on its own timer, separate
// from the bubbles. Its numbers start here; upgrade treasures (element-up) raise them. Every
// element has the common ones; `rate` shots a second and `dmg` x bubble damage per hit are at your
// starting Fire rate and Bubble damage, and scale with them (and Range, Bubble size and extra
// Bubbles count too).
export const ELEMENT_BASE = {
  common: { rate: 0.75, dmg: 0.6, count: 0, pierce: 0, speed: 1, range: 1 },
  fire: { burn: 1, burnTime: 3, spread: 0.06 },                       // burn dps x, seconds, how far a death spreads it
  lightning: { chain: 3, bolt: 1, stun: 0.5, chainRange: 0.16, rate: 1.1 },   // arcs, arc damage x, stun s, arc reach m
  ice: { chill: 2, frost: 0, frozenMul: 1, rate: 1, dmg: 1.35 },         // chill s, frost: chills the whole splash, frozen enemies take x
  acid: { puddleDmg: 1, puddleSize: 1, puddleTime: 3.5, puddles: 6, rate: 1.05 },   // puddle damage x, size x, seconds, most at once
  wind: { push: 0.3, pierce: 1, speed: 1.4, rate: 1.4, dmg: 1.1 },    // push x; gusts pierce once and fly fast
  glitter: { width: 2.2, splash: 1, slow: 0, rate: 1.05 },            // splash width x, splash damage x, slow s
};
// element-up numbers that add (the rest multiply)
const ELEMENT_ADD = new Set(['count', 'pierce', 'chain', 'burnTime', 'puddleTime', 'puddles', 'frost', 'slow', 'frozenMul']);
export const elementParams = (id) => ({ ...ELEMENT_BASE.common, ...ELEMENT_BASE[id] });

// effects that fire on an `every N { … }` timer; each gets (gadgets, ctx) when it fires
export const TIMED_WORDS = {
  ring: {
    doc: 'A ring around you, `radius` m: stings everything inside for `dmg`, pushes it out by `push` m, freezes it for `freeze` s, slows it for `slow` s. `elites=#false` spares elites and the boss; `look` is "ring" or "puff".',
    args: ['radius'],
    props: { dmg: 1, push: 0, freeze: 0, slow: 0, elites: true, color: '#ffffff', look: 'ring', show: 0.45 },
    make: ([radius], p) => ({ kind: 'ring', radius, ...p }),
  },
  zap: {
    doc: 'Zaps the `count` nearest enemies within `range` m with a jagged bolt, `dmg` each. In a when-hit block, at="attacker" zaps whoever hit you first (if it\'s in range), and share= makes each bolt that share of the damage you took instead of `dmg`.',
    args: ['count'],
    props: { range: 0.45, dmg: 2, at: 'nearest', share: 0 },
    make: ([count], p) => ({ kind: 'zap', count, ...p }),
  },
  brick: {
    doc: 'Drops a brick at your feet; the first walking enemy to step on it takes `dmg`. Lasts `last` s, at most `most` on the floor.',
    props: { dmg: 4, last: 14, most: 5 },
    make: (_, p) => ({ kind: 'brick', ...p }),
  },
  marble: {
    doc: 'Rolls a marble out the way you face at `speed` m/s for `life` s, bouncing off walls; each enemy it bowls through takes `dmg`.',
    props: { dmg: 2, speed: 0.825, life: 1.47 },
    make: (_, p) => ({ kind: 'marble', ...p }),
  },
  'bubble-ring': {
    doc: 'Blows `count` bubbles at once, spread evenly in every direction around you, each doing `dmg` times your Bubble damage.',
    args: ['count'],
    props: { dmg: 1 },
    make: ([count], p) => ({ kind: 'bubble-ring', count, ...p }),
  },
  xp: {
    doc: 'Drops `xp` worth of XP at your feet.',
    args: ['xp'],
    make: ([n]) => ({ kind: 'xp', xp: n }),
  },
};

// When a `while` holds (Run.S checks it each time the stats are read)
export const WHILE_WHEN = ['airborne', 'high-ground', 'low-health'];

// What `per` can count (Run.S works each one out)
export const PER_SOURCES = ['max-health', 'move-speed-bonus', 'levels', 'chests'];

// The stats a treasure can raise with `stat`, by the name content files use
export const STAT_NAMES = { bubbles: 'bubbles', range: 'range', 'bubble-damage': 'bubbleDamage', 'fire-rate': 'fireRate', health: 'health', 'move-speed': 'moveSpeed', 'health-regen': 'regen', 'tentacle-damage': 'tentacleDamage', dodge: 'dodge', luck: 'luck' };

export const TREASURE_WORDS = {
  pierce: { doc: 'Each bubble pops on up to `count` enemies in a line.', args: ['count'], make: ([n]) => (m) => { m.bubbles.pierce = Math.max(m.bubbles.pierce, n); } },
  'split-bubble': { doc: 'Each bubble that pops blows a smaller one at another enemy nearby, once.', make: () => (m) => { m.bubbles.split = true; } },
  'echo-bubble': { doc: 'Every bubble that pops on an enemy fires again from there at the next enemy within 20 cm, at full damage, once.', make: () => (m) => { m.bubbles.echo = true; } },
  'toy-mouse': { doc: 'Every `every` s a wind-up toy mouse scurries (`speed` m/s) to the nearest enemy and hits it for `dmg` (a flat number); `trip` of the time it runs into you instead, for `tripDmg`.', props: { every: 12, dmg: 30, trip: 0.15, tripDmg: 2, speed: 0.6 }, make: (_, p) => (m) => { m.mouse = { ...p }; } },
  'golden-bubble': { doc: 'Every `every`th bubble is golden and does `mult` times damage.', props: { every: 10, mult: 5 }, make: (_, p) => (m) => { m.bubbles.golden = p; } },
  'giant-bubble': { doc: 'Every `every`th bubble also blows a giant one: `size` times bigger, `dmg` times the damage, `speed` times as fast.', props: { every: 6, size: 2.5, dmg: 4, speed: 0.6 }, make: (_, p) => (m) => { m.bubbles.giant = p; } },
  element: {
    doc: 'An element attack of its own: fire, lightning, ice, acid, wind or glitter (bubbles.js). It fires its own projectile on its own timer, separate from your bubbles. Legendary: you get these from the start-of-run pick and the Boss reward, not from treasures in the room.',
    args: ['name'],
    make: ([name]) => { if (!ELEMENT_IDS.includes(name)) throw new Error(`element must be one of ${ELEMENT_IDS.join(', ')}, not "${name}"`); return (m) => { m.elements.add(name); m.element[name] ||= elementParams(name); }; },
  },
  'element-up': {
    doc: 'Upgrades one element attack (its base treasure must be owned to be offered: needs="…" on the treasure). Any of its numbers (ELEMENT_BASE in words.js): count, pierce, chain, burnTime, puddleTime, puddles, frost, slow and frozenMul add; the rest multiply. E.g. element-up "fire" burn=1.5 burnTime=2.',
    args: ['name'],
    props: Object.fromEntries([...new Set(Object.values(ELEMENT_BASE).flatMap((o) => Object.keys(o)))].map((k) => [k, null])),
    make: ([name], p) => {
      if (!ELEMENT_IDS.includes(name)) throw new Error(`element-up needs an element (${ELEMENT_IDS.join(', ')}), not "${name}"`);
      const has = elementParams(name), set = Object.entries(p).filter(([, v]) => v != null);
      for (const [k] of set) if (!(k in has)) throw new Error(`element-up "${name}" has no "${k}" (it has: ${Object.keys(has).join(', ')})`);
      if (!set.length) throw new Error(`element-up "${name}" changes nothing`);
      return (m) => { const P = (m.element[name] ||= elementParams(name)); for (const [k, v] of set) P[k] = ELEMENT_ADD.has(k) ? P[k] + v : P[k] * v; };
    },
  },
  'mark-on-hit': { doc: 'Enemies you hit are marked for `seconds` and take 50% more damage from everything. `by` as above.', args: ['seconds'], props: { by: 'all' }, make: ([s], p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) m.hits[k].mark = Math.max(m.hits[k].mark, s); }; } },
  crit: { doc: '`chance` of a hit doing `mult` times damage. `by` as above. Several crits (or copies) add their chances and use the biggest mult.', props: { chance: 0.2, mult: 3, by: 'all' }, make: (_, p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) { const c = m.hits[k].crit; m.hits[k].crit = c ? { chance: c.chance + p.chance, mult: Math.max(c.mult, p.mult) } : { chance: p.chance, mult: p.mult }; } }; } },
  'pin-on-crit': { doc: 'A critical hit pins the enemy in place for `seconds` (it can\'t move or attack). `by` as above.', args: ['seconds'], props: { by: 'all' }, make: ([s], p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) m.hits[k].pin = Math.max(m.hits[k].pin, s); }; } },
  'zap-on-pop': { doc: '`chance` that a bubble popping on an enemy snaps static to `count` other enemies within `range` m, stunning each for `stun` s (and doing `dmg`, x your bubble damage). Copies add their chances and targets.', props: { chance: 0.2, count: 1, range: 0.3, stun: 0.5, dmg: 0 }, make: (_, p) => (m) => { const z = m.popZap; m.popZap = z ? { ...z, chance: z.chance + p.chance, count: z.count + p.count } : { ...p }; } },
  'extra-jumps': { doc: '`count` more jumps in mid-air.', args: ['count'], make: ([n]) => (m) => { m.extraJumps += n; } },
  'landing-shockwave': { doc: 'Landing from a drop of at least `drop` m sends out a ring of `radius` m that stings for `dmg`.', args: ['radius'], props: { dmg: 2, drop: 0.04 }, make: ([r], p) => (m) => { m.landingShockwave = { radius: r, ...p }; } },
  'squeak-when-hit': { doc: 'When you get hit, enemies within `radius` m are pushed back `push` m and take `dmg` (a flat number). Once every `cooldown` s. Several stack.', props: { radius: 0.09, push: 0.06, dmg: 3, cooldown: 5 }, make: (_, p) => (m) => { m.squeaks.push(p); } },
  'when-hit': {
    doc: 'When you get hit (not a dodge), does the effects in its { block } (ring, zap…), then waits `cooldown` s before it can again. Copies each have their own.',
    props: { cooldown: 1 },
    block: TIMED_WORDS,
    make: (_, p, where, effects) => (m, copy = 0) => { m.onHurt.push({ cooldown: p.cooldown, effects, key: `${where}#${copy}` }); },
  },
  reflect: { doc: 'Every `every` s, the first hit you take is sent back at whoever dealt it (if an enemy did), and you take none of it, then can\'t be hurt for `invuln` s.', props: { every: 20, invuln: 1 }, make: (_, p) => (m) => { m.reflect = { ...p }; } },
  'death-save': { doc: 'Once per run, a hit that would take your last Health leaves you at `health` (a share of your max Health) instead.', props: { health: 0.5 }, make: (_, p) => (m) => { m.deathSave = { ...p }; } },
  'damage-taken': { doc: 'Hits take `times` as much health.', args: ['times'], make: ([k]) => (m) => { m.damageTaken *= k; } },
  spout: { doc: 'Stand still for `after` s and you refill `heal` health a second.', props: { after: 1, heal: 0.5 }, make: (_, p) => (m) => { m.spout = p; } },
  'heal-on-kill': { doc: 'Every enemy you clear gives back `health`.', args: ['health'], make: ([n]) => (m) => { m.healOnKill += n; } },
  'burst-on-kill': { doc: 'Enemies you finish off burst, stinging everything within `radius` m for `dmg`.', args: ['radius'], props: { dmg: 0.5 }, make: ([r], p) => (m) => { m.burstOnKill = { radius: r, dmg: p.dmg }; } },
  'crumb-on-kill': { doc: '`chance` that an enemy you clear leaves a crumb worth `health`; it drifts to you like XP. Copies add their chances.', props: { chance: 0.02, health: 1 }, make: (_, p) => (m) => { m.crumbs = m.crumbs ? { chance: m.crumbs.chance + p.chance, health: Math.max(m.crumbs.health, p.health) } : { ...p }; } },
  'xp-reach': { doc: 'XP drifts to you from `times` as far.', args: ['times'], make: ([k]) => (m) => { m.xpReach *= k; } },
  stat: {
    doc: 'Raises a stat by `amount` (negative lowers it): bubbles, range, bubble-damage, fire-rate, health, move-speed, health-regen (health a second), tentacle-damage, dodge (% chance a hit misses) or luck (rarer cards and treasures). `percent=#true` means % of its starting value.',
    args: ['name', 'amount'],
    props: { percent: false },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (typeof amount !== 'number') throw new Error(`stat ${name} needs a number`);
      return (m) => { const t = p.percent ? m.stats.pct : m.stats.add; t[key] = (t[key] || 0) + amount; };
    },
  },
  per: {
    doc: 'A stat grows by `amount` (a % of its starting value with percent=#true) for every `every` of `of`: max-health, move-speed-bonus (% above your starting Move speed), levels (gained this run) or chests (treasures found this run). Stat names as in `stat`, plus tentacle-damage. Recomputed live, so it follows the stat it reads.',
    args: ['name', 'amount'],
    props: { every: 1, of: null, percent: false },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`per: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (!PER_SOURCES.includes(p.of)) throw new Error(`per: of= must be one of ${PER_SOURCES.join(', ')}, not "${p.of}"`);
      if (!(p.every > 0)) throw new Error('per: every= must be more than 0');
      return (m) => { m.per.push({ stat: key, amount, every: p.every, of: p.of, percent: p.percent }); };
    },
  },
  while: {
    doc: 'Raises a stat by `amount` (a % of its starting value with percent=#true) only while `when` holds: airborne (off the ground), high-ground (standing on furniture, above the floor) or low-health (under 30% of your max Health). Stat names as in `stat`.',
    args: ['when', 'name', 'amount'],
    props: { percent: false },
    make: ([when, name, amount], p) => {
      if (!WHILE_WHEN.includes(when)) throw new Error(`while: when must be one of ${WHILE_WHEN.join(', ')}, not "${when}"`);
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`while: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      return (m) => { m.whiles.push({ when, stat: key, amount, percent: p.percent }); };
    },
  },
  'xp-mult': { doc: 'Enemies drop `times` as much XP.', args: ['times'], make: ([k]) => (m) => { m.xpMult *= k; } },
  'card-rarity': { doc: 'Level-up cards roll `steps` rarity higher.', args: ['steps'], make: ([n]) => (m) => { m.cardRarity += n; } },
  'card-choices': { doc: 'Level-ups offer `count` more cards to pick from.', args: ['count'], make: ([n]) => (m) => { m.cardChoices += n; } },
  'heal-on-hit': { doc: '`chance` that a bubble or tentacle hit gives back `health` (life steal).', props: { chance: 0.1, health: 1 }, make: (_, p) => (m) => { m.healOnHit = m.healOnHit ? { chance: m.healOnHit.chance + p.chance, health: Math.max(m.healOnHit.health, p.health) } : { ...p }; } },
  'grow-on-kills': {
    doc: 'Every `kills` enemies you clear, a stat grows by `amount` (a % of its starting value with percent=#true) for the rest of the run (stat names as in `stat`; max health also refills by as much). With `cap`, each copy stops once it has grown that much in all.',
    args: ['name', 'amount'],
    props: { kills: 10, percent: false, cap: null },
    make: ([name, amount], p, where) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`grow-on-kills: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      return (m, copy = 0) => { m.growth.push({ stat: key, amount, kills: p.kills, percent: p.percent, cap: p.cap, key: `${where}#${copy}` }); };
    },
  },
  'bug-speed': { doc: 'Bugs move at `times` their speed (not elites or the boss).', args: ['times'], make: ([k]) => (m) => { m.bugSpeed *= k; } },
  'more-bugs': { doc: '`times` as many bugs come out of the vents (the cap on bugs at once grows too).', args: ['times'], make: ([k]) => (m) => { m.moreBugs *= k; } },
  every: {
    doc: 'Every `seconds` (the first time after `first` s, 60% of the period by default), does the effects in its { block }: ring, zap, brick, marble, xp.',
    args: ['seconds'],
    props: { first: null },
    block: TIMED_WORDS,
    make: ([s], p, where, effects) => (m, copy = 0) => { m.timed.push({ every: s, first: p.first ?? s * 0.6, effects, key: `${where}#${copy}` }); },
  },
  'orbit-lights': { doc: '`count` little bulbs circle you `radius` m out and sting whatever they touch for `dmg` (each enemy at most every 0.4 s).', args: ['count'], props: { radius: 0.07, dmg: 0.6 }, make: ([n], p) => (m) => { m.orbit = { count: n, ...p }; } },
  beam: { doc: 'A beam burns the nearest enemy within `range` m for `dmg` every `tick` s.', props: { range: 0.35, dmg: 0.3, tick: 0.25 }, make: (_, p) => (m) => { m.beam = p; } },
  aura: { doc: 'A glow of `radius` m around you stings everything inside for `dmg` every `tick` s.', args: ['radius'], props: { dmg: 0.4, tick: 0.5 }, make: ([r], p) => (m) => { m.aura = { radius: r, ...p }; } },
};
