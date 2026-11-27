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
//   c.beat              the song's beat now (run.js keepTime); c.wait: an attack can't start this frame (the attack gap, or on-beat): start one through go(c)
// Flying words move the bug themselves and set `fly`.
//
// To teach the game a new behaviour: add a word here (small, one job), use it in a .kdl file,
// and add a story (src/stories/<area>.js) that proves it.
import * as THREE from 'three';
import { hitSpot } from './collision.js';
import { LOOK } from './look.js';
import { STYLES, TIERS, knobs } from './attack-motion.js';
const WALL_HIT = hitSpot();   // a dive's or bite's wall ahead, cast every frame (World.cast `out`: no hit allocated)

const _away = new THREE.Vector3(), _spot = new THREE.Vector3(), _want = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), _lead = new THREE.Vector3(), LEAD_PROBE = [0.12, 0.25, 0.4];   // (the Mantis's lead: how far along it the floor map must reach)
const RHYTHM_FROM = () => LOOK.num('bug-rhythm-from', 0.5), SIDE_AFTER = 3;   // rhythms only farther out than this (m); a ranged bug side-steps after holding this long (s)
const FILE_PULL = 3, FAN_SPEED = 0.6;   // how hard a file's leader pulls a bug round, and how fast a fan slides (of its speed)
// Where a rotor flung now should go: you, led by `lead` of the way you will move before it arrives (its flight time, found in two steps, no more than WHIRL_LEAD_MAX)
function aimAhead(e, c, en, p) {
  e.whirlAt.copy(c.pc);
  const v = p.lead ? en.player?.velocity : null;
  if (!v || v.x * v.x + v.z * v.z < 1e-4) return;
  let t = 0;
  for (let i = 0; i < 2; i++) t = Math.min(WHIRL_LEAD_MAX, Math.hypot(c.pc.x + v.x * t - e.pos.x, c.pc.z + v.z * t - e.pos.z) / p.speed);
  e.whirlAt.x += v.x * t * p.lead; e.whirlAt.z += v.z * t * p.lead;
}
const WHIRL_LEAD_MAX = 1.5;
const LEAD_NEAR = 0.1, SWAP_LEAD = 0.3, JERK_SHARE = 0.2;   // the part of each `jerk` run the bug spends turning
const STEER_EASE = 8;   // how fast a walking bug's heading follows the floor map's way (per second): no jitter between squares
// An attack word starts its attack only through go(c): false while c.wait (the attack gap, or on-beat off the beat), and a start
// or a wait held by the gap is noted for enemies.js (c.start, c.want), so two bugs never start their attacks together
const go = (c) => { if (!c.wait) return (c.start = true); if (c.gapped) c.want = true; return false; };
const broodCount = (en, e) => { let n = 0; for (const x of en.list) if (!x.dead && x.motherId === e.id) n++; return n; };   // a nest's live brood (the brood word)

export const ENEMY_WORDS = {
  'death-motion': {
    doc: 'On death, leaves a harmless body that `style` animates (crumple, flutter, shell, belly-up, pop-shell, eye-pop, bead-scatter, curl-pop, lantern-pop, skin-shed, paper-crush, unravel) with optional `weight` (light, mid, heavy). Rewards and removal from combat are immediate.',
    args: ['style'],
    props: { weight: 'mid' },
    make: ([style], p) => {
      const styles = ['crumple', 'flutter', 'shell', 'belly-up', 'pop-shell', 'eye-pop', 'bead-scatter', 'curl-pop', 'lantern-pop', 'skin-shed', 'paper-crush', 'unravel'];
      if (!styles.includes(style)) throw new Error(`death-motion style must be one of ${styles.join(', ')}`);
      if (!['light', 'mid', 'heavy'].includes(p.weight)) throw new Error('death-motion weight must be light, mid or heavy');
      return { init(e) { e.deathMotion = style; e.deathWeight = p.weight; } };
    },
  },
  'attack-motion': {
    doc: 'Its attack moves in `style` (lunge, throw, pounce, swipe, roll or nip: a bug that only touches you, with no attack word), with juice as big as its `tier` (fodder, light, mid or heavy): src/attack-motion.js, numbers in content/look.css (--bug-attack-*). Only how it looks: never when or where it hits.',
    args: ['style'],
    props: { tier: 'light' },
    make: ([style], p) => {
      if (!STYLES.includes(style)) throw new Error(`attack-motion style must be ${STYLES.join(', ')}`);
      if (!TIERS.includes(p.tier)) throw new Error(`attack-motion tier must be ${TIERS.join(', ')}`);
      return { attackMotion: { style, tier: p.tier } };
    },
  },
  chase: {
    doc: 'Walks at you at `speed` m/s, round the furniture by the floor map and spreading round other bugs (straight at you where the map has nothing). With `stop` (m), a ranged bug keeps its distance: it stops that far from you and backs away (at `back` times its speed) when you come closer than 3/4 of it. With `weave` (radians), it snakes from side to side as it comes, `rate` swings a second. With `turn` (radians a second), it can only turn that fast, so it swings round in arcs instead of pivoting. Rhythm, each bug out of step with the rest, and only while it is farther than --bug-rhythm-from from you (closer in it walks as ever): with `bursts` (s) it walks in bursts, going for `go` of each burst at 1/`go` of its speed and standing dead still the rest, so its average speed is `speed`; with `rush` (m) it walks at `stalk` times its speed and sways `sway` radians as it goes until that close, then `rushx` times; with `side` (m/s) a ranged bug that has held at `stop` for a while side-steps instead of standing; with `hug` it keeps to the edges of furniture and walls while far from you. With `lead` (s) it cuts you off: it heads for where you will be, your position plus your velocity times the time it would take to reach you (no more than `lead`), until it is within its attack range, then straight at you. A file: with `file` (m) it follows the nearest bug of its own kind ahead of it (nearer you) within that distance, and with `fan` (m) a ranged bug holding at `stop` side-steps away from its own kind closer than that, so they stand in a line, not a stack.',
    args: ['speed'],
    props: { stop: 0, back: 0.6, weave: 0, rate: 2.5, turn: 0, bursts: 0, go: 0.85, rush: 0, stalk: 1, rushx: 1.5, sway: 0, side: 0, hug: 0, file: 0, fan: 0, lead: 0 },
    make: ([speed], p) => ({
      ground: true,
      tick(e, c, en) {
        // where it heads for: you, or (lead) where you will be, till it is in attack range
        let toward = c.flatDir;
        const v = p.lead && c.pc === c.realPc ? en.player?.velocity : null;
        if (v && v.x * v.x + v.z * v.z > 1e-4 && c.flat > e.T.reach + e.r + LEAD_NEAR) {
          const t = Math.min(p.lead, c.flat / Math.max(speed * (p.rush && c.flat > p.rush ? p.stalk : 1), 0.05));   // Reynolds' pursuit: the time it would take to get there, capped
          toward = _lead.set(c.pc.x + v.x * t - e.pos.x, 0, c.pc.z + v.z * t - e.pos.z);
          if (toward.lengthSq() > 1e-8) toward.normalize(); else toward = c.flatDir;
          // never into furniture or a wall: the floor map must reach three points along the way (else it chases where you are)
          const N = en.nav;
          if (toward !== c.flatDir && N) for (let i = 0; i < LEAD_PROBE.length; i++) if (N.distAt(e.pos.x + toward.x * LEAD_PROBE[i], e.pos.y, e.pos.z + toward.z * LEAD_PROBE[i], e.r) === Infinity) { toward = c.flatDir; break; }
        }
        // round the furniture by the floor map (bug-nav.js), easing from the way it was going; straight at a decoy, or where the map has nothing
        if (c.pc === c.realPc && en.nav?.steer(e, en.list, toward, c.dir, p.hug)) {
          const h = (e.navDir ||= c.dir.clone());
          h.lerp(c.dir, 1 - Math.exp(-STEER_EASE * c.dt));
          if (h.lengthSq() < 1e-6) h.copy(c.dir);
          c.dir.copy(h.normalize());
        } else { c.dir.copy(toward); e.navDir?.copy(toward); }
        if (p.weave) c.dir.applyAxisAngle(UP, Math.sin(c.t * p.rate * Math.PI + e.phase) * p.weave);
        if (p.turn) {
          // its heading swings toward where it wants to go, no faster than `turn`
          const h = (e.heading ||= c.dir.clone()), cur = Math.atan2(h.x, h.z);
          let d = Math.atan2(c.dir.x, c.dir.z) - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const a = cur + THREE.MathUtils.clamp(d, -p.turn * c.dt, p.turn * c.dt);
          c.dir.copy(h.set(Math.sin(a), 0, Math.cos(a)));
        }
        if (p.file && c.flat > (p.stop || 0) * 1.5) {   // a file: head for the nearest of its own kind that is nearer you, within `file`
          let best = p.file * p.file, bx = 0, bz = 0;
          for (let n = 0; n < en.list.length; n++) {
            const o = en.list[n];
            if (o === e || o.dead || o.type !== e.type || o.under) continue;
            const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d2 = dx * dx + dz * dz;
            if (d2 >= best || d2 < 1e-8 || (o.pos.x - c.pc.x) ** 2 + (o.pos.z - c.pc.z) ** 2 >= c.flat * c.flat) continue;
            best = d2; bx = dx; bz = dz;
          }
          if (best < p.file * p.file) { const l = Math.sqrt(best); c.dir.x += bx / l * FILE_PULL; c.dir.z += bz / l * FILE_PULL; c.dir.normalize(); }
        }
        c.speed = speed * c.slow; e.walkSpeed = speed;   // (climbs walks it to a side at this)
        e.backing = e.resting = false;
        const far = c.flat > RHYTHM_FROM();
        if (p.sway && far && c.flat > p.rush) c.dir.applyAxisAngle(UP, Math.sin(c.t * 0.8 * Math.PI * 2 + e.phase) * p.sway);
        if (p.bursts && far) {   // go for `go` of each burst, faster by the same share, stand the rest: the same distance in the end
          const on = (c.t / p.bursts + e.phase * 0.159) % 1 < p.go;
          c.speed *= on ? 1 / p.go : 0; e.resting = !on;
        }
        if (p.rush && far) c.speed *= c.flat < p.rush ? p.rushx : p.stalk;
        if (!p.stop || c.flat > p.stop) return;
        if (c.flat < p.stop * 0.75) e.holdT = 0;
        if (c.flat < p.stop * 0.75) { c.dir.negate(); c.speed *= p.back; e.backing = true; }   // too close: back off (and still faces you)
        else {                                                                  // in range: hold, or side-step slowly once it has held a while
          c.speed = 0; e.resting = false; e.holdT = (e.holdT || 0) + c.dt;
          if (p.fan) {   // a neighbour of its own kind too close: slide along the ring round you, away from it
            let best = p.fan * p.fan, side = 0;
            for (let n = 0; n < en.list.length; n++) {
              const o = en.list[n];
              if (o === e || o.dead || o.type !== e.type || o.under) continue;
              const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d2 = dx * dx + dz * dz;
              if (d2 >= best) continue;
              best = d2; side = -(dx * -c.flatDir.z + dz * c.flatDir.x) || e.phase - 5;   // (exactly on top of each other: either way, by its own phase)
            }
            if (side) { c.dir.set(-c.flatDir.z, 0, c.flatDir.x).multiplyScalar(side > 0 ? 1 : -1); c.speed = speed * FAN_SPEED * c.slow; e.backing = true; }
          }
          if (p.side && e.holdT > SIDE_AFTER) { c.dir.set(-c.flatDir.z, 0, c.flatDir.x).multiplyScalar(Math.sin(c.t * 0.5 + e.phase) > 0 ? 1 : -1); c.speed = p.side * c.slow; e.backing = true; }
        }
      },
    }),
  },

  climbs: {
    doc: 'Climbs after you: while you are up on furniture it walks to a side it can climb (the floor map\'s climb links, src/bug-climb.js) and goes straight up it at `speed` m/s, its body flat to the side and its legs walking, then over onto the top. While climbing it can be hit and still hurts to touch, but can\'t start an attack; knocked off the side it falls, and ground-locked it can\'t climb (it lets go). List it after the walking word and before its attack word.',
    args: ['speed'],
    make: ([speed]) => ({
      tick(e, c, en) {
        const K = e.climb, C = en.nav?.climb;
        if (K) {
          c.wait = true; c.gapped = false; c.speed = 0;   // no attack starts on a side (and it holds no place in the attack gap)
          const off = Math.hypot(e.pos.x - K.x, e.pos.z - K.z) > 0.012;   // knocked off the side
          if (off || e.groundLocked) { en.letGo(e); return; }
          const s = speed * c.slow * c.dt;
          e.vel.set(K.dx * speed * c.slow, 0, K.dz * speed * c.slow); e.vy = 0;   // (its legs walk at the climbing speed)
          if (K.up) {
            e.pos.y = Math.min(K.top, e.pos.y + s);
            e.climbK = Math.min(1, e.climbK + c.dt * 6);
            if (e.pos.y >= K.top) K.up = false;
          } else {
            const dx = K.tx - e.pos.x, dz = K.tz - e.pos.z, d = Math.hypot(dx, dz);
            e.climbK = Math.max(0, e.climbK - c.dt * 6);
            if (d <= s) { e.pos.x = K.tx; e.pos.z = K.tz; en.letGo(e, true); return; }
            e.pos.x += dx / d * s; e.pos.z += dz / d * s;
            K.x = e.pos.x; K.z = e.pos.z;
          }
          return;
        }
        if (C && e.grounded && c.speed > 0 && C.onTop(e.pos.x, e.pos.y, e.pos.z) && C.onTop((c.realFoot || c.foot).x, e.pos.y, (c.realFoot || c.foot).z)) {   // up top with you: it doesn't walk (or back) off the edge (once you've gone, it walks off and drops)
          const a = e.r + 0.02;
          if (!C.onTop(e.pos.x + c.dir.x * a, e.pos.y, e.pos.z + c.dir.z * a)) c.speed = 0;
        }
        if (!C || e.groundLocked || c.pc !== c.realPc || !e.grounded || e.state !== 'approach' || e.aimT > 0) return;
        if (c.realFoot.y - e.pos.y < 0.1) return;   // you aren't up above it
        const way = C.step(e, _want);
        if (way === 1) { c.dir.copy(_want); c.speed = (e.walkSpeed || speed) * c.slow; return; }
        if (way !== 2) return;
        en.startClimb(e, _want, C.ly, C.lx, C.lz);
        c.wait = true; c.gapped = false; c.speed = 0;
      },
    }),
  },

  leap: {
    doc: 'Up close (within `range` m) every `every` s or so, crouches for `windup` s while a ring on the floor marks where it will land (the spot locks halfway through), then leaps `height` m high and comes down there `time` s later: you take `dmg` if you are within `radius` m of the landing. Then it rests `rest` s. List it after the walking word.',
    phases: { crouch: 'build', leap: 'swing', rest: 'recoil' }, lock: { crouch: 0.5 },   // how its attack moves (src/attack-motion.js)
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
            if (c.flat < p.range && e.grounded && e.leapCd <= 0 && !e.groundLocked && go(c)) { e.state = 'crouch'; e.stateT = p.windup; target(e, c); }
          } else if (e.state === 'crouch') {
            c.speed = 0;
            e.leapK = 1 - Math.max(0, e.stateT) / p.windup;
            if (e.stateT > p.windup * 0.5) target(e, c);
            if (e.stateT <= 0) { e.state = 'leap'; e.stateT = p.time; e.leapK = 0; (e.leapFrom ||= new THREE.Vector3()).copy(e.pos); e.airborne = true; en.leapGo(e); }
          } else if (e.state === 'leap') {
            // a ballistic arc from where it crouched onto the marked spot (it flies itself: no walking, no gravity)
            c.speed = 0;
            e.vel.set(0, 0, 0);
            const u = Math.min(1, 1 - e.stateT / p.time);
            e.leapK = u;
            _spot.lerpVectors(e.leapFrom, e.leapAt, u);
            _spot.y += 4 * p.height * u * (1 - u);
            en.moveTo(e, _spot);
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
    doc: 'Flies `distance` m from you and `above` m higher, circling round you at `circle` radians a second, at up to `speed` m/s. With `bob` (m) it bobs that far up and down as it goes; with `pause` (0 to 1) it hangs still that share of the time, in short spells (a firefly drifting). With `swap` (s) each bug, after its first change (a few `swap` in), picks its own way round you and changes it about that often, so a crowd circles both ways; with `jerk` (s) it flies straight and turns in sudden quick swings, one a `jerk`, at the same turn rate overall (a fly-style turn). After its first change a bug with `swap` really orbits you, at `circle` radians a second or as fast as its `speed` allows.',
    args: ['distance'],
    props: { above: 0.07, speed: 0.33, circle: 0.4, bob: 0, pause: 0, swap: 0, jerk: 0 },
    make: ([distance], p) => {
      const still = Math.sin(Math.PI * (p.pause - 0.5));   // under this, the slow wave below means hang still: `pause` of the time
      return {
      fly: true,
      tick(e, c, en) {
        if (e.flyHeld) return;              // another word is holding it still (a poke)
        const s = p.speed * c.slow * (p.pause > 0 && Math.sin(c.t * 1.3 + e.phase) < still ? 0 : 1);
        const away = _away.copy(e.pos).sub(c.pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        let turn = c.dt * p.circle * (s > 0 ? 1 : 0);
        if (p.swap) {   // the way it circles, as it always has until its first change, then its own (e.phase seeds them)
          if (e.swapT === undefined) { e.swapT = p.swap * (1.25 + 0.75 * ((e.phase * 0.37) % 1)); e.swapDir = 1; e.swaps = 0; }
          if ((e.swapT -= c.dt) <= 0) { e.swapT = p.swap * (0.7 + (e.phase * 7.3 + e.swaps) % 0.6); e.swapDir = Math.sin(e.phase * 12.9898 + e.swaps * 78.233) > 0 ? 1 : -1; e.swaps++; }
          turn = e.swaps ? p.circle * SWAP_LEAD * e.swapDir * (s > 0 ? 1 : 0) : turn * e.swapDir;   // after the first change it really circles: its mark is that many seconds ahead of it round you
        }
        if (p.jerk && e.swaps) turn *= ((c.t / p.jerk + e.phase * 0.159) % 1 < JERK_SHARE ? 1 / JERK_SHARE : 0);   // after its first change: all the turning in a quick swing at the start of each run
        away.normalize().applyAxisAngle(UP, turn);
        const to = _spot.copy(c.pc).addScaledVector(away, distance).setY(c.pc.y + p.above + p.bob * Math.sin(c.t * 2.1 + e.phase * 3)).sub(e.pos);
        e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * c.dt));
        en.move(e, e.vel, c.dt);
      },
      };
    },
  },

  sortie: {
    doc: 'A flier that lands to shoot: it flies round you `circle` m out and `height` m up at up to `speed` m/s for about `fly` s, then lands on the floor `land` m from you, raises its carapace and locks on for `aim` s (a reticle closes in round you, beeping faster), and fires a homing missile: `rocket` m/s, turning `turn` radians a second, hunting you for `fuel` s (then it sputters out and falls), `dmg` if it hits. It closes up, rests `rest` s and takes off again.',
    phases: { land: 'build', raise: 'build', aim: 'build', close: 'fire', rest: 'recoil' }, thrown: true,   // how its attack moves (src/attack-motion.js)
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
          en.move(e, e.vel, c.dt);
          if (e.stateT <= 0 && go(c)) {
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
          _spot.lerpVectors(e.landFrom, e.landAt, u);
          _spot.y += Math.sin(u * Math.PI) * 0.03;
          en.moveTo(e, _spot);
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
    phases: { curl: 'build', spin: 'build', dash: 'swing', uncurl: 'recoil', rest: 'recoil' }, lock: { spin: 0.5 },   // how its attack moves (src/attack-motion.js)
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
          if (c.flat < p.range && e.grounded && e.ballCd <= 0 && live && go(c)) { e.state = 'curl'; e.stateT = p.curl; en.ballCurl(e); }
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
    phases: { windup: 'build', poke: 'swing', retract: 'recoil', rest: 'recoil' }, lock: { windup: 0.5 },   // how its attack moves (src/attack-motion.js)
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
            if (c.dist < p.range && e.pokeCd <= 0 && live && go(c)) { e.state = 'windup'; e.stateT = e.pokeMax = p.windup; e.flyHeld = true; lock(e, c); }
          } else if (e.state === 'windup') {
            e.vel.multiplyScalar(Math.exp(-10 * c.dt));
            en.move(e, e.vel, c.dt * live);
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
    doc: 'Every `every` s, if you are within `reach` m, shoots at you: `count` shots fanned across `spread` degrees (`speed` m/s, last `life` s, `dmg` damage each), from `height` radii above its middle. `shot` is "web" (a ball of silk) or "pin" (a pushpin spinning on its long axis, once its aim locks, a dotted line of glow shows where it will fly; it sticks where it hits the scenery). `still` stands still while it aims and throws. `arc` (m/s²) lobs it so it falls onto where you were; `slow` s of slowed swimming when it hits you. For `aim` s first it winds up; the aim locks halfway through, so moving off the line dodges.',
    phases: 'shot', lock: { aim: 0.5 }, thrown: true,   // how its attack moves (src/attack-motion.js)
    props: { every: 2.4, reach: 0.45, speed: 0.48, life: 1.47, dmg: 1, aim: 0.35, count: 1, spread: 0, shot: 'web', height: 0, arc: 0, slow: 0, still: false },
    make: (_, p, where) => {
      if (!['web', 'pin'].includes(p.shot)) throw new Error(`${where}: shot= must be "web" or "pin", not "${p.shot}"`);
      return {
      init(e) { e.shootT = 1 + Math.random() * 1.5; e.aimT = 0; },
      tick(e, c, en) {
        e.shootT -= c.dt * (c.slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - c.dt);
        if (e.shootT <= p.aim && e.aimT <= 0 && e.shootT > 0 && c.dist < p.reach) { if (go(c)) e.aimT = e.aimMax = p.aim; else e.shootT = p.aim; }   // (held by the gap: it winds up the moment it may)
        // the aim locks on half way through the warning, so the line shows where it will really go
        if (e.aimT > p.aim * 0.5) (e.aimAt ||= new THREE.Vector3()).copy(c.pc);
        if (p.shot === 'pin' && e.aimAt && e.aimT > 0 && e.aimT <= p.aim * 0.5) en.pinLine(e, e.aimAt, 1 - e.aimT / (p.aim * 0.5), p.speed * p.life);
        if (e.shootT <= 0 && c.dist < p.reach && !e.aimAt && !go(c)) e.shootT = p.aim;   // it came into reach with no wind-up: it takes the gap too
        else if (e.shootT <= 0 && c.dist < p.reach) { e.shootT = p.every; en.spit(e, e.aimAt || c.pc, p); e.aimAt = null; e.aimT = 0; e.firedT = 0.65; }
        else if (e.shootT <= 0) e.shootT = 0.5;
        if (e.firedT > 0) e.firedT -= c.dt;
        if (p.still && (e.aimT > 0 || e.firedT > 0)) c.speed = 0;
      },
      };
    },
  },

  zip: {
    doc: 'Flies like a dragonfly: hangs in the air for about `pause` s, then darts `length` m in a straight line at `speed` m/s, stopping dead. Each dart goes off in a new direction (sideways, up, down, back), only leaning toward a spot `distance` m from you and `above` m higher, so it closes in by zigzags, never straight at you.',
    props: { distance: 0.3, above: 0.06, speed: 1.4, length: 0.14, pause: 0.35 },
    make: (_, p) => ({
      fly: true,
      init(e) { e.zipT = Math.random() * p.pause; e.zipLeft = 0; e.zipDir = new THREE.Vector3(); },
      tick(e, c, en) {
        if (e.flyHeld) { e.zipLeft = 0; return; }   // another word is holding it still (a charge, a dodge)
        if (e.zipLeft > 0) {
          // darting: full speed, then stopping dead at the end
          const step = Math.min(e.zipLeft, p.speed * c.slow * c.dt);
          e.vel.copy(e.zipDir).multiplyScalar(c.dt > 0 ? step / c.dt : 0);
          en.move(e, e.zipDir, step);
          e.zipLeft -= step;
          if (e.zipLeft <= 1e-4 || c.slow === 0) { e.zipLeft = 0; e.zipT = p.pause * (0.6 + Math.random() * 0.8); e.vel.multiplyScalar(0.05); }   // and stops dead
          return;
        }
        // hanging in the air: it drifts to a stop
        e.vel.multiplyScalar(Math.exp(-12 * c.dt));
        en.move(e, e.vel, c.dt);
        if ((e.zipT -= c.dt * (c.slow > 0 ? 1 : 0)) > 0) return;
        // the next dart: any way at all, leaning toward its spot near you
        const away = _away.copy(e.pos).sub(c.pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize().applyAxisAngle(UP, (Math.random() - 0.5) * 2.4);
        const want = _spot.copy(c.pc).addScaledVector(away, p.distance).setY(c.pc.y + p.above).sub(e.pos);
        const pull = Math.min(1, want.length() / (p.length * 2));
        const dir = _want.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.7, Math.random() - 0.5).normalize();
        dir.addScaledVector(want.normalize(), 0.9 * pull).normalize();
        // no lower than just off the floor, no higher than a little over you: a dart that would leave
        // that band turns back into it, and one that starts outside it (you've jumped off the bed it
        // was over, or flown up) heads back in, steeply (flipping it there only drove it further away)
        const low = c.foot.y + 0.03, high = c.pc.y + p.above + 0.12, to = e.pos.y + dir.y * p.length;
        if (e.pos.y > high || e.pos.y < low) dir.copy(want).setY(e.pos.y > high ? -0.7 : 0.7).normalize();   // straight back toward its spot near you
        else if (to < low || to > high) dir.y = -dir.y * 0.3;
        dir.normalize();
        // stop short of a wall or furniture; blocked (diving onto a bed it's over), try it level, so
        // it slips out past the edge and drops from there
        let hit = en.world.cast(e.pos, dir, p.length + e.r);
        if (hit && hit.distance - e.r < 0.02 && dir.y < 0) { dir.copy(want).setY(0).normalize(); hit = en.world.cast(e.pos, dir, p.length + e.r); }
        e.zipDir.copy(dir);
        e.zipLeft = hit ? Math.max(0, hit.distance - e.r) : p.length;
        if (e.zipLeft < 0.02) { e.zipLeft = 0; e.zipT = 0.05; }   // boxed in: try another way next frame
        else en.zip(e);
      },
    }),
  },

  evade: {
    doc: 'When you hit it, it darts away `distance` m in a random direction at `speed` m/s (breaking off a charge), at most once every `every` s.',
    props: { every: 5, distance: 0.25, speed: 2.2 },
    make: (_, p) => ({
      init(e) { e.evadeCd = 0; e.seenHits = 0; e.dodgeLeft = 0; e.dodgeDir = new THREE.Vector3(); },
      tick(e, c, en) {
        e.evadeCd -= c.dt;
        const hit = (e.hits || 0) > e.seenHits;
        e.seenHits = e.hits || 0;
        if (hit && e.evadeCd <= 0 && c.slow > 0 && e.dodgeLeft <= 0) {
          const dir = _want.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize();
          if (e.pos.y + dir.y * p.distance < c.foot.y + 0.03) dir.y = Math.abs(dir.y);
          const wall = en.world.cast(e.pos, dir, p.distance + e.r);
          e.dodgeDir.copy(dir);
          e.dodgeLeft = wall ? Math.max(0.03, wall.distance - e.r) : p.distance;
          e.evadeCd = p.every;
          e.flyHeld = true;
          en.evade(e);
        }
        if (e.dodgeLeft > 0) {
          const step = Math.min(e.dodgeLeft, p.speed * c.dt);
          en.move(e, e.dodgeDir, step);
          e.vel.copy(e.dodgeDir).multiplyScalar(p.speed);
          e.dodgeLeft -= step;
          if (e.dodgeLeft <= 1e-4) { e.dodgeLeft = 0; e.flyHeld = false; e.vel.multiplyScalar(0.2); }
        }
      },
    }),
  },

  whirlwind: {
    doc: 'Within `range` m every `every` s or so, holds still while its wings whip up a spinning rotor of two blades in front of it for `windup` s (the blades grow and blur, air drawn into them, a rising whirr; the aim locks `lock` of the way through), then flings it at your middle: a Shot `size` m in radius at `speed` m/s for up to `life` s. With `lead` (0 to 1: 0 aims at where you are, 1 at where you will be when it arrives, no more than 1.5 s ahead), a moving jelly is led while the aim still tracks; once it locks, the line is fixed as ever. `count` rotors fly in a row along that line, `gap` s apart. Touching one: `dmg`. It rests `rest` s after the last. Freezing, stunning or a dodge breaks it off. List it after the flying word.',
    phases: { whirl: 'build', 'whirl-rest': 'fire' }, thrown: true, lock: { whirl: (p) => p.lock }, timer: { whirl: 'whirlT', 'whirl-rest': 'whirlT' },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.6, every: 4, windup: 0.7, lock: 0.6, speed: 0.45, size: 0.061, life: 2.2, count: 3, gap: 0.3, dmg: 2, rest: 0.5, lead: 0 },
    make: (_, p) => ({
      init(e) { e.whirlCd = 4 + Math.random() * 2; e.whirlAt = new THREE.Vector3(); e.whirlK = 0; e.whirlKick = 0; e.whirlT = 0; e.whirlVol = 0; e.whirlGap = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.whirlCd -= c.dt;
        if (e.whirlKick > 0) e.whirlKick -= c.dt;
        if (e.state === 'whirl') {
          if (!live || e.dodgeLeft > 0) {                     // frozen, stunned or dodging: the whirlwind falls apart
            en.breakWhirl(e);
            e.state = 'approach'; e.faceLock = false; e.whirlCd = 1.5;
            if (!live) e.flyHeld = false;                     // (a dodge holds it itself)
            return;
          }
          e.vel.set(0, 0, 0);
          e.whirlT -= c.dt;
          e.whirlK = Math.min(1, 1 - e.whirlT / p.windup);
          if (e.whirlK < p.lock) { aimAhead(e, c, en, p); e.root.rotation.y = Math.atan2(c.toP.x, c.toP.z); }
          if (e.whirlT <= 0) { en.whirlFling(e, e.whirlAt, p); e.whirlK = 0; e.whirlKick = 0.2; e.state = 'whirl-rest'; e.whirlT = p.rest; e.whirlVol = p.count - 1; e.whirlGap = p.gap; }
        } else if (e.state === 'whirl-rest') {
          if (e.whirlVol > 0) {                               // the rest of the volley, along the same line
            if ((e.whirlGap -= c.dt * live) <= 0) { en.whirlCharge(e, p, true); en.whirlFling(e, e.whirlAt, p); e.whirlKick = 0.2; e.whirlVol--; e.whirlGap = p.gap; }
            return;
          }
          e.whirlT -= c.dt * live;
          if (e.whirlT <= 0) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.whirlCd = p.every; }
        } else if (e.state === 'approach' && live && !e.flyHeld && e.whirlCd <= 0 && c.dist < p.range && go(c)) {
          e.state = 'whirl'; e.whirlT = p.windup; e.whirlK = 0; e.flyHeld = true; e.faceLock = true;   // its own timer: other attack words run stateT down too
          e.vel.set(0, 0, 0);
          aimAhead(e, c, en, p);
          en.whirlCharge(e, p);
        }
      },
    }),
  },

  swat: {
    doc: 'Up close (within `range` m) every `every` s or so, rears up with its forelegs raised and opened for `windup` s (nothing shows on the floor: the rearing up is the warning; the aim locks halfway through), then lunges and snaps them shut, sweeping `arc` degrees across and `reach` m out: `dmg` if you are in that wedge. It rests `rest` s. List it after the walking word.',
    phases: { windup: 'build', swat: 'swing', rest: 'recoil' }, lock: { windup: 0.5 },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.16, windup: 0.55, reach: 0.19, arc: 80, dmg: 3, rest: 0.8, every: 1.6 },
    make: (_, p) => ({
      init(e) { e.swatCd = 0.8 + Math.random(); e.swatDir = new THREE.Vector3(0, 0, 1); },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.swatCd -= c.dt;
        if (e.state === 'approach') {
          if (c.flat < p.range && e.grounded && e.swatCd <= 0 && live && go(c)) { e.state = 'windup'; e.stateT = e.swatMax = p.windup; e.swatDir.copy(c.flatDir); }
        } else if (e.state === 'windup') {
          c.speed = 0;
          if (e.stateT > p.windup * 0.5) { e.swatDir.copy(c.flatDir); e.root.rotation.y = Math.atan2(c.flatDir.x, c.flatDir.z); }
          e.faceLock = true;
          if (e.stateT <= 0) { e.state = 'swat'; e.stateT = 0.18; en.swat(e, c, p); }
        } else if (e.state === 'swat') {
          c.speed = 0;
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; e.faceLock = false; e.swatCd = p.every; }
        } else if (e.state === 'rest') {
          c.speed *= 0.3;
          if (e.stateT <= 0) e.state = 'approach';
        }
      },
    }),
  },

  burrow: {
    doc: 'Within `range` m every `every` s or so, digs in for `dig` beats, then goes under: a mound trails after you at `speed` m/s for `follow` beats of the act\'s song (under, it can\'t be hit, touched, frozen or stunned), then locks where it is: a Warning circle and dome `radius` m round fill over the next `warn` beats. On that beat it bursts up as a Blast: you take `dmg`, a `knock` shove away from it and a toss `launch` up, and for `tumble` beats you tumble: almost no grip, so the stick can\'t cancel the throw (0: none). It stands dazed for `daze` beats (the time to hit it), then goes back to walking. List it after the walking word; with `on-beat` it starts on the bar.',
    phases: { dig: 'build', under: 'build', dazed: 'fire' },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.55, every: 6, dig: 1, follow: 4, warn: 2, speed: 0.22, radius: 0.1, dmg: 4, knock: 0.5, launch: 0.5, tumble: 0, daze: 4 },
    make: (_, p) => ({
      burrowRadius: p.radius,
      init(e) { e.burrowCd = 1 + Math.random() * 2; e.burrowAt = new THREE.Vector3(); e.burrowK = 0; e.digK = 0; e.under = false; e.burstT = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.burrowCd -= c.dt;
        if (e.state === 'approach') {
          if (c.dist < p.range && e.burrowCd <= 0 && live && e.grounded && go(c)) { e.state = 'dig'; e.stateT = p.dig * c.spb; e.vel.set(0, 0, 0); en.burrowDig(e); }
        } else if (e.state === 'dig') {
          c.speed = 0;
          e.stateT -= c.dt * live;
          e.digK = 1 - Math.max(0, e.stateT) / (p.dig * c.spb);
          if (e.stateT <= 0) { e.state = 'under'; e.under = true; e.burrowLocked = false; e.burrowSwell = false; e.burrowBeats = 0; e.burrowBeatN = 0; e.beatSeen = c.beat; en.burrowGo(e); }
        } else if (e.state === 'under') {
          c.speed = 0;
          if (!e.burrowLocked) en.burrowRumble(e.burrowBeats / p.follow);   // the hush: it cuts out
          e.burrowBeats += THREE.MathUtils.clamp(c.beat - e.beatSeen, 0, 0.5);   // a song handing over (the beat jumping) can't strand it down there
          e.beatSeen = c.beat;
          if (!e.burrowLocked && e.burrowBeats >= p.follow) { e.burrowLocked = true; e.burrowAt.copy(e.pos); e.vel.set(0, 0, 0); en.burrowLock?.(e, p.radius); }
          else if (e.burrowLocked && e.burrowBeats >= p.follow + p.warn / 2 && !e.burrowSwell) { e.burrowSwell = true; en.burrowSwell?.(e, p.radius, p.warn / 2 * c.spb); }   // the Warning's last half: the floor swells
          else if (!e.burrowLocked && Math.floor(e.burrowBeats) > e.burrowBeatN) { e.burrowBeatN = Math.floor(e.burrowBeats); en.burrowHeave?.(e, e.burrowBeats / p.follow); }   // the mound heaves on each beat
          if (!e.burrowLocked) { c.dir.copy(c.flatDir); c.speed = p.speed; }     // the mound trails after you
          else {
            e.burrowK = THREE.MathUtils.clamp((e.burrowBeats - p.follow) / p.warn, 0, 1);
            if (e.burrowBeats >= p.follow + p.warn) { e.under = false; e.pos.copy(e.burrowAt); e.digK = 0; e.burrowK = 0; e.state = 'dazed'; e.stateT = p.daze * c.spb; e.burstT = 0; e.vel.set(0, 0, 0); en.burrowBurst(e, c, p); }
          }
        } else if (e.state === 'dazed') {
          c.speed = 0;
          e.stateT -= c.dt; e.burstT += c.dt;   // (burstT: its pose's clock from the burst, critters.js)
          if (e.stateT <= 0) { e.state = 'approach'; e.burrowCd = p.every; }
        }
      },
    }),
  },

  'charge-shot': {
    doc: 'Within `range` m every `every` s or so, stops, turns to you and charges a ball between its jaws for `charge` s (it grows, crackling; the aim locks `lock` of the way through, so stepping aside after that dodges), then fires it at your middle: a Shot `size` m across at `speed` m/s for up to `life` s. It explodes on whatever it meets (you, furniture, the floor, or the end of its flight): a Blast `blast` m round, `dmg` and a `knock` shove to anything of you inside it. It rests `rest` s. Freezing or stunning it breaks the charge off. List it after the walking word.',
    phases: { charge: 'build', rest: 'fire' }, lock: { charge: (p) => p.lock }, thrown: true,   // how its attack moves (src/attack-motion.js)
    props: { range: 0.6, charge: 1, lock: 0.6, speed: 1.2, dmg: 3, size: 0.011, blast: 0.05, knock: 0.5, life: 1.2, rest: 0.7, every: 3.5 },
    make: (_, p) => ({
      init(e) { e.shotCd = 1 + Math.random() * 1.5; e.shotDir = new THREE.Vector3(0, 0, 1); e.shotAt = new THREE.Vector3(); e.ballK = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.shotCd -= c.dt;
        if (e.state === 'charge' && !live) { en.breakSpark(e); e.state = 'approach'; e.faceLock = false; e.ballK = 0; e.shotCd = 1.5; }
        if (e.state === 'approach') {
          if (c.dist < p.range && e.shotCd <= 0 && live && go(c)) {
            e.state = 'charge'; e.stateT = p.charge; e.aimLocked = false; e.ballK = 0; e.faceLock = true;
            e.vel.set(0, 0, 0);
            en.sparkCharge(e, p.charge);
          }
        } else if (e.state === 'charge') {
          c.speed = 0;
          e.vel.set(0, 0, 0);
          e.stateT -= c.dt;
          e.ballK = Math.min(1, 1 - e.stateT / p.charge);
          if (!e.aimLocked) {                                        // it turns after you until its aim locks
            e.shotDir.copy(c.flatDir);
            e.shotAt.copy(c.pc);
            let d = Math.atan2(c.flatDir.x, c.flatDir.z) - e.root.rotation.y;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            e.root.rotation.y += THREE.MathUtils.clamp(d * (1 - Math.exp(-12 * c.dt)), -5 * c.dt, 5 * c.dt);
            if (e.ballK >= p.lock) e.aimLocked = true;
          }
          if (e.stateT <= 0) { en.sparkShot(e, e.shotAt, p); e.state = 'rest'; e.stateT = p.rest; e.ballK = 0; e.firedT = 0.3; }
        } else if (e.state === 'rest') {
          c.speed = 0;
          e.stateT -= c.dt * live;
          if (e.stateT <= 0) { e.state = 'approach'; e.faceLock = false; e.shotCd = p.every; }
        }
        if (e.firedT > 0) e.firedT -= c.dt;
      },
    }),
  },

  hatch: {
    doc: 'When it dies, the bug named `what` takes its place: where it fell, facing the way it faced, as tough as it was (a parasite bursting out of its body).',
    args: ['what'],
    make: ([what]) => ({
      died(e, en) {
        const w = en.spawn(what, e.pos.clone(), e.maxHp / e.T.hp);
        w.root.rotation.y = e.root.rotation.y;
        w.spawnT = 1;                       // it's already there (in the body), no growing in
      },
    }),
  },

  burst: {
    doc: 'It starts hidden inside: for `delay` s the body twitches while a circle `radius` m round where it will come out fills, then it bursts out there, hitting anything of you within `radius` m (a Blast) for `dmg`. Until then its other words wait.',
    props: { delay: 0.9, radius: 0.1, dmg: 2 },
    make: (_, p) => ({
      burstRadius: p.radius,
      init(e) { e.state = 'emerge'; e.stateT = e.emergeMax = p.delay; },
      tick(e, c, en) {
        if (e.state !== 'emerge') return;
        e.stateT -= c.dt;
        if (e.stateT <= 0) { e.state = 'approach'; e.stateT = 0; en.burst(e, p); }
      },
    }),
  },

  rooted: {
    doc: 'Can\'t move at all: not walking, not turning, not knocked back.',
    make: () => ({
      ground: true,
      rooted: true,
      init(e) { e.faceLock = true; },
      tick(e, c) { c.speed = 0; e.faceLock = true; },
    }),
  },

  whip: {
    doc: 'Within `range` m every `every` s or so, rears up and back for `windup` s while a line on the floor shows where it will strike (`reach` m long; the aim locks halfway through), then cracks down along it: `dmg` if you are within `width` m of the line and not in the air above it. It lies there `down` s, then rests `rest` s.',
    phases: { windup: 'build', lash: 'swing', down: 'swing', rest: 'recoil' }, lock: { windup: 0.5 },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.26, windup: 0.7, reach: 0.28, width: 0.012, dmg: 3, down: 0.35, rest: 1, every: 1.4 },
    make: (_, p) => ({
      init(e) { e.whipCd = 0.6 + Math.random() * 0.6; e.whipDir = new THREE.Vector3(0, 0, 1); e.whipReach = p.reach; },
      tick(e, c, en) {
        if (e.state === 'emerge') return;
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.whipCd -= c.dt;
        const from = e.emergeAt || e.pos, flat = Math.hypot(c.foot.x - from.x, c.foot.z - from.z);
        const aim = () => { if (flat > 1e-4) e.whipDir.set(c.foot.x - from.x, 0, c.foot.z - from.z).normalize(); e.whipFloor = c.foot.y; };
        if (e.state === 'approach') {
          if (flat < p.range && e.whipCd <= 0 && live && go(c)) { e.state = 'windup'; e.stateT = e.whipMax = p.windup; aim(); }
        } else if (e.state === 'windup') {
          if (e.stateT > p.windup * 0.5) aim();
          if (e.stateT <= 0) { e.state = 'lash'; e.stateT = 0.12; en.whipLash(e); }
        } else if (e.state === 'lash') {
          if (e.stateT <= 0) { e.state = 'down'; e.stateT = p.down; en.whip(e, c, p); }
        } else if (e.state === 'down') {
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = p.rest; e.whipCd = p.every; }
        } else if (e.state === 'rest' && e.stateT <= 0) e.state = 'approach';
      },
    }),
  },

  hangs: {
    doc: 'Hangs where it was put (stuck to a wall or the side of furniture): it never moves, turns, falls or gets knocked back. Hits land anywhere within `size` m of its middle.',
    props: { size: 0.1 },
    make: (_, p) => ({
      fly: true,                          // nothing pulls it down
      rooted: true,
      init(e) { e.faceLock = true; e.hitR = p.size; },
      tick(e) { e.vel.set(0, 0, 0); e.faceLock = true; },
    }),
  },

  brood: {
    doc: 'Every `every` s a `what` crawls out of it (where its model says things come out), as tough as it is; it stops while `max` of its own are still alive.',
    args: ['what'],
    props: { every: 5, max: 6 },
    make: ([what], p) => ({
      init(e) { e.broodT = p.every; },
      tick(e, c, en) {
        if (c.slow === 0) return;           // frozen or stunned: nothing comes out
        if ((e.broodT -= c.dt) > 0) {
          if (e.broodT < knobs().nest.lead + 0.2) e.broodFull = broodCount(en, e) >= p.max;   // (its model squeezes only before a wasp that will come: --bug-attack-nest-lead)
          return;
        }
        e.broodT = p.every;
        if (broodCount(en, e) >= p.max) return;
        const child = en.spawn(what, (e.emergeAt || e.pos).clone(), e.maxHp / e.T.hp);
        child.motherId = e.id;
        e.hatchedT = 1;
        en.hatch(e, child);
      },
    }),
  },

  dive: {
    doc: 'Within `range` m every `every` s or so, stops and rears for `windup` s (a rising buzz), then nosedives at where you were when it set off, at `speed` m/s for up to `reach` m: if it reaches you it stings for `dmg` and dies doing it. If it misses or hits a wall, it pulls up, rests `rest` s and goes back to circling. List it after the flying word.',
    phases: { windup: 'build', dive: 'swing', rest: 'recoil' }, span: { dive: (p) => p.reach / p.speed },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.35, every: 3, windup: 0.5, speed: 1.4, reach: 0.6, dmg: 6, rest: 0.6 },
    make: (_, p) => ({
      init(e) { e.diveCd = 1 + Math.random() * 1.5; e.diveDir = new THREE.Vector3(); },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.diveCd -= c.dt;
        if (e.state === 'approach') {
          if (c.dist < p.range && e.diveCd <= 0 && live && !e.flyHeld && go(c)) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; e.faceLock = true; en.diveWind(e, p.windup); }
        } else if (e.state === 'windup') {
          e.vel.multiplyScalar(Math.exp(-10 * c.dt));
          en.move(e, e.vel, c.dt * live);
          e.root.rotation.y = Math.atan2(c.toP.x, c.toP.z);
          if (e.stateT <= 0) { e.state = 'dive'; e.diveLeft = p.reach; e.diveDir.copy(c.toP).normalize(); en.diveGo(e); }   // it aims where you are now, and doesn't turn again
        } else if (e.state === 'dive') {
          if (!live) return;
          const step = Math.min(e.diveLeft, p.speed * c.dt);
          const wall = en.world.cast(e.pos, e.diveDir, step + e.r * 0.5, null, false, WALL_HIT);
          const blocked = en.move(e, e.diveDir, wall ? Math.max(0, wall.distance - e.r * 0.5) : step, false);
          e.vel.copy(e.diveDir).multiplyScalar(p.speed);
          e.diveLeft -= step;
          if (e.pos.distanceTo(c.realPc || c.pc) < (en.playerRadius || 0.03) + (e.hitR || e.r)) { en.sting(e, c, p); return; }   // stung you (as soon as it touches, so its touch can't land first): it dies
          if (wall || blocked || e.diveLeft <= 0) { e.state = 'rest'; e.stateT = p.rest; e.vel.set(0, 0.3, 0); }   // missed: it pulls up
        } else if (e.state === 'rest') {
          e.vel.multiplyScalar(Math.exp(-4 * c.dt));
          en.move(e, e.vel, c.dt * live);
          if (e.stateT <= 0) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.diveCd = p.every; }
        }
      },
    }),
  },

  prism: {
    doc: 'Within `range` m every `every` s or so, stops, faces you and winds up for `windup` s (a ball of hot rainbow light grows between its forelegs), then lobs it in a slow arc (rising `peak` m over the straight line) at the floor under where you are, landing `beats` beats later; while it flies, a Warning circle and dome `radius` m round fill there. The ball spins as it goes: on every beat it fires a burst of bolts out every way, up, down and all round (`rows` rows between the two poles, `count` round its middle and fewer toward the poles; `speed` m/s, gone after `life` s or at the floor, a wall or furniture, `dmg` each; each burst turned half a gap from the last, so the gaps spiral). It lands as a Blast (`burst`) with a last burst. At most `most` balls fly at once. List it after on-beat so it throws on a beat.',
    phases: { windup: 'build', rest: 'fire' }, thrown: true,   // how its attack moves (src/attack-motion.js)
    props: { range: 0.6, every: 6, windup: 0.6, beats: 4, peak: 0.18, radius: 0.12, count: 12, rows: 5, speed: 0.35, life: 1.2, dmg: 2, burst: 3, most: 3, rest: 0.6 },
    make: (_, p, where) => {
      if (!(Number.isInteger(p.beats) && p.beats >= 1)) throw new Error(`${where}: prism beats= must be a whole number of beats, 1 or more`);
      return {
      init(e) { e.prismCd = 1 + Math.random() * 3; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it stays put
        e.prismCd -= c.dt;
        if (e.firedT > 0) e.firedT -= c.dt;
        if (e.state === 'windup' && !live) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.prismCd = 1.5; }   // broken off
        if (e.state === 'approach') {
          if (c.dist < p.range && e.prismCd <= 0 && live && !e.flyHeld && en.prismBalls.flying() < p.most && go(c)) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; e.faceLock = true; e.vel.set(0, 0, 0); en.prismWind(e, p.windup); }
        } else if (e.state === 'windup') {
          let d = Math.atan2(c.flatDir.x, c.flatDir.z) - e.root.rotation.y;   // turns to face you
          d = Math.atan2(Math.sin(d), Math.cos(d));
          e.root.rotation.y += d * (1 - Math.exp(-12 * c.dt));
          if ((e.stateT -= c.dt) <= 0) { en.prism(e, c, p); e.state = 'rest'; e.stateT = p.rest; e.firedT = 0.3; }
        } else if (e.state === 'rest') {
          if ((e.stateT -= c.dt * live) <= 0) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.prismCd = p.every; }
        }
      },
      };
    },
  },

  bite: {
    doc: 'Up close (within `range` m) every `every` s or so, stops and draws back for `windup` s (its whine climbing; the aim locks halfway through), then darts at you at `speed` m/s for up to `reach` m: if it reaches you it bites for `dmg` and bounces off. Hit or miss, it backs off, rests `rest` s and goes back to flying. List it after the flying word.',
    phases: { windup: 'build', dart: 'swing', rest: 'recoil' }, lock: { windup: 0.5 }, span: { dart: (p) => p.reach / p.speed },   // how its attack moves (src/attack-motion.js)
    props: { range: 0.25, every: 1.6, windup: 0.35, speed: 1.6, reach: 0.4, dmg: 1, rest: 0.5 },
    make: (_, p) => ({
      init(e) { e.biteCd = 0.8 + Math.random(); e.biteDir = new THREE.Vector3(); e.biteK = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it stays put
        e.stateT -= c.dt * live;
        e.biteCd -= c.dt;
        if (e.state === 'approach') {
          if (c.dist < p.range && e.biteCd <= 0 && live && !e.flyHeld && go(c)) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; en.biteWind(e, p.windup); }
        } else if (e.state === 'windup') {
          if (e.stateT > p.windup * 0.5) e.biteDir.copy(c.toP).normalize();   // tracks you, then locks on
          else e.faceLock = true;
          e.biteK = 1 - Math.max(0, e.stateT) / p.windup;
          e.vel.copy(e.biteDir).multiplyScalar(-0.12 * live);                // drawing back
          en.move(e, e.vel, c.dt * live);
          e.root.rotation.y = Math.atan2(e.biteDir.x, e.biteDir.z);
          if (e.stateT <= 0) { e.state = 'dart'; e.biteLeft = p.reach; e.biteK = 0; en.biteGo(e); }
        } else if (e.state === 'dart') {
          if (!live) return;
          const step = Math.min(e.biteLeft, p.speed * c.dt);
          const wall = en.world.cast(e.pos, e.biteDir, step + e.r * 0.5, null, false, WALL_HIT);
          const blocked = en.move(e, e.biteDir, wall ? Math.max(0, wall.distance - e.r * 0.5) : step, false);
          e.vel.copy(e.biteDir).multiplyScalar(p.speed);
          e.biteLeft -= step;
          const hit = e.pos.distanceTo(c.realPc || c.pc) < (en.playerRadius || 0.03) + e.r * 0.6;
          if (hit) en.bite(e, c, p.dmg);
          if (hit || wall || blocked || e.biteLeft <= 0) { e.state = 'rest'; e.stateT = p.rest; e.vel.copy(e.biteDir).multiplyScalar(hit ? -0.6 : -0.15).setY(0.15); }   // bounces off you (or pulls up)
        } else if (e.state === 'rest') {
          e.vel.multiplyScalar(Math.exp(-4 * c.dt));
          en.move(e, e.vel, c.dt * live);
          if (e.stateT <= 0) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.biteCd = p.every; }
        }
      },
    }),
  },

  lob: {
    doc: 'Within `range` m every `every` s or so, stops, turns its tail to you and lifts it for `windup` s (its lamp held lit), then lobs a glowing Shot from its tail in a slow, high arc (rising `peak` m over the straight line) that lands `flight` s later where you were when it threw; while it flies, a Warning circle and dome `radius` m round fill there. It lands as a Blast (`dmg`), then lies there as a glowing pool as big for `last` s, draining `drain` Health a second while you stand in it (jump it; overlapping pools add up; at most `most` at once, the oldest fades first). It rests `rest` s. Freezing or stunning it breaks the throw off. List it after the flying word.',
    phases: { windup: 'build', rest: 'fire' }, thrown: true,   // how its attack moves (src/attack-motion.js)
    props: { range: 0.6, every: 8, windup: 0.45, flight: 1.2, peak: 0.2, radius: 0.14, dmg: 2, drain: 1, last: 10, most: 12, rest: 0.6 },
    make: (_, p) => ({
      init(e) { e.lobCd = 1 + Math.random() * 3; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it stays put
        e.lobCd -= c.dt;
        if (e.firedT > 0) e.firedT -= c.dt;
        if (e.state === 'windup' && !live) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.lobCd = 1.5; }   // broken off
        if (e.state === 'approach') {
          if (c.dist < p.range && e.lobCd <= 0 && live && !e.flyHeld && go(c)) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; e.faceLock = true; e.vel.set(0, 0, 0); en.lobWind(e, p.windup); }
        } else if (e.state === 'windup') {
          let d = Math.atan2(-c.flatDir.x, -c.flatDir.z) - e.root.rotation.y;   // its tail to you
          d = Math.atan2(Math.sin(d), Math.cos(d));
          e.root.rotation.y += d * (1 - Math.exp(-12 * c.dt));
          if ((e.stateT -= c.dt) <= 0) { en.lob(e, c, p); e.state = 'rest'; e.stateT = p.rest; e.firedT = 0.3; }
        } else if (e.state === 'rest') {
          if ((e.stateT -= c.dt * live) <= 0) { e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.lobCd = p.every; }
        }
      },
    }),
  },

  bleeds: {
    doc: 'Its hits that land (past i-frames, dodges and shields) make you bleed: you lose `dps` Health a second for `seconds` s. Every hit adds its own bleed, so they stack.',
    args: ['seconds'],
    props: { dps: 1 },
    make: ([seconds], p) => ({ init(e) { e.bleeds = { seconds, dps: p.dps }; } }),
  },

  rolls: {
    doc: 'Its body rolls along the floor as it moves (no animation of its own).',
    make: () => ({ rolls: true }),
  },

  'on-beat': {
    doc: 'Keeps time with the song: it pulses on every beat, and the attack words listed after it that wind up (leap, ball-charge, poke, whirlwind, swat, charge-shot, whip, dive, bite, lob, prism, burrow) only start on every `every`th beat (4: on the bar), so its attacks go off with the music.',
    props: { every: 1 },
    make: (_, p, where) => {
      if (!(Number.isInteger(p.every) && p.every >= 1)) throw new Error(`${where}: on-beat every= must be a whole number of beats, 1 or more`);
      return {
        init(e) { e.beatN = null; e.beatPulse = 0; },
        tick(e, c) {
          const n = Math.floor(c.beat), on = e.beatN !== null && n !== e.beatN;   // a new beat this frame
          e.beatN = n; e.beatAt = c.beat;                                         // (a firefly's lamp keeps time with it)
          e.beatPulse = on ? 1 : Math.max(0, e.beatPulse - c.dt * 4);           // its model (or the size pulse) shows it
          c.wait = !(on && n % p.every === 0); c.gapped = false;   // the music keeps its time: the attack gap doesn't hold it
        },
      };
    },
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
// numbers are multiples of the run's power (attack damage x 1.8) unless the doc says otherwise.

// What a run has with no treasures
export function newMods() {
  return {
    bubbles: { pierce: 1, echo: null, golden: null, giant: null },
    element: {},                     // element -> its attack's numbers (ELEMENT_BASE, raised by element-up)
    hits: { bubbles: { mark: 0, markMore: 0, crit: null, pin: 0 }, splash: { mark: 0, markMore: 0, crit: null, pin: 0 }, tentacles: { mark: 0, markMore: 0, crit: null, pin: 0, venom: null, echo: null, edge: null, coil: null } },
    popZap: null,
    mouse: null,                     // toy-mouse: { every, dmg, speed, size, splash, push }
    reflect: null,                   // reflect: { every, invuln, dmg, burst, burstDmg, push }
    deathSave: null,                 // death-save: { health } (a share of max Health)                    // zap-on-pop: { chance, count, range, stun, dmg }
    stats: { add: {}, pct: {}, dodge: [] },     // stat bonuses: added, and % of the starting value; dodge: each treasure's Dodge, closing that share of the gap to the cap (Run.S)
    landingShockwave: null, extraJumps: 0,
    dodgeCap: 0,                     // dodge-cap: a higher most Dodge than the usual 60% (Run.S)
    xpReach: 1, xpMult: 1, healOnKill: 0, healOnHit: null, damageTaken: 1,
    growth: [], bugSpeed: 1, moreBugs: 1, cardChoices: 0,
    squeaks: [], onHurt: [], onAttack: [], landHeal: null, spotlight: null, burstOnKill: null, cardRarity: 0,
    crumbs: null,                    // crumb-on-kill: { chance, health }
    leaves: [],                      // leave-on-kill: { chance, last, health, look, event } (run.js)
    whiles: [],                      // conditionals: { when, stat, amount, percent } (Run.S)
    per: [],                         // converters: { stat, amount, every, of, percent } (Run.S)
    timed: [], orbit: null, beam: null, aura: null,
    eliteBonus: null,                // elite-bonus: { every } every `every`th Elite beaten leaves a second treasure
    swat: null,                      // swat: { back, reach } an attack of yours in flight (or a burst, or a lash) knocks a bug's Shot back at it (enemies.js swatShots)
    stomp: null,                     // stomp: { dmg, step, most, stun, safe, reach, drop } falling onto a bug stomps it (run.js stomp)
    moreTreasures: 0,                // more-treasures: chance each scheduled room treasure brings another
    polyps: null,                    // polyps: { count, dmg } little helpers that shoot with you
    rebirth: null,                   // rebirth: { time } once an act, a killing blow makes you a polyp for a while
    shield: { faster: 0, sooner: 0, fullDamage: 0, bursts: [], fromHealth: false, near: [], invuln: 0 },   // the Shield stat's treasures (src/shield.js)
    rebound: false, decoy: null, fireTrail: null,
    wake: null,                      // wake: { time, radius, slow, dmg, blast, ignite, cooldown } a slowing trail a jump sets off (src/wake.js)
    tether: null,                    // tether: { every, time, range, dps, tick, width } a beam to a hit bug that cuts what it touches (src/tether.js)
    noRegen: false,                  // no-regen: Health regen does nothing (true), or only once rebirth has saved you ('revived')
    touch: null,                     // touch-sting: { dmg, every, reach }
    touchZap: null,                  // touch-zap: { dmg, stun, each, reach } (gadgets.js)
    overkill: null,                  // overkill: { reach, passes, least } (enemies.js)
    charged: [],                     // charged-shot: { when, time, strike, chain, dmg, key } (run.js builds the charge, bubbles.js spends it)
    adorn: [],                       // adorn: extra pieces on the jelly (src/adornments.js)
    owners: {},                      // which treasure/evolution set mouse, reflect, deathSave, rebirth (the HUD's timer faces)
    eliteDamage: 1,                  // elite-damage: hits on Elites and the boss do this much
    statusDamage: [SHATTER],         // status-damage: { status, more, by, elites, perStack, thaw } (enemies.js)
    statusTaken: [],                 // status-taken: { status, less } (run.js)
    killsOf: [],                     // on-kill-of: { status, by, effects } (run.js onKill)
    nth: [],                         // nth-attack: { every, random, effects } (bubbles.js volley, combat.js fire)
    stingCount: [],                  // sting-count: { every, effects } (combat.js fire)
    buffs: [],                       // stack-buff: { event, stat, amount, percent, time, stacks, key } (run.js)
    burnRamp: null,                  // burn-ramp: { step, most } Burn grows the longer a bug burns (bubbles.js)
    refreshAll: [],                  // refresh-all: statuses a hit on a bug that has it refreshes on every bug (bubbles.js)
    streaks: [],                     // streak: { kills, within, status, effects, key } (run.js onKill)
    chillFreeze: null,               // chill-to-freeze: { hits, time } (bubbles.js strike)
    healOnCrit: 0,                   // heal-on-crit: Health gained on each Crit (run.js)
    critBonus: 0,                    // crit-damage: added to Crit multiplier (bubbles.js, combat.js)
    regenMult: 1,                    // regen-mult: multiplies Health healing, Health regen and Shield refill (run.js, shield.js)
    firstTreasureBonus: 0,           // first-treasure-bonus: extra Treasure picks on the first Treasure opened each act (run.js)
    eliteJump: null,                 // elite-jump: { jumps, time } extra mid-air jumps after killing an Elite (run.js)
    stillHeal: null,                 // still-heal: { share, perStack, wait, radius } (gadgets.js, run.js)
    bombOnHit: null,                 // bomb-on-hit: { chance, dmg, fuse, radius } (run.js -> gadgets)
    missileOnHit: null,              // missile-on-hit: { chance, dmg, speed, turn, life } (run.js -> gadgets)
    cooldownScale: 1,                // cooldown-scale: multiplies Treasure cooldowns and timer periods (0.75 = 25% shorter)
    groundLock: [],                  // ground-lock: statuses whose bugs can't jump, fly up or climb (enemies.js)
    slideOnHit: [],                  // slide-on-hit: { status, distance } (bubbles.js strike)
    percentDots: [],                 // percent-dot: { status, share, boss } (bubbles.js effects)
    spreadOnTouch: [],               // spread-on-touch: statuses a bug passes on to bugs touching it (bubbles.js effects)
    split: null,                     // split-on-hit: { count, dmg, angle } (bubbles.js pop)
    splashShots: [],                 // splash-shots, echo-bubble from="splash": { min, count, dmg } (bubbles.js glitterBurst)
    randomStatus: null,              // random-status: { statuses, time } each glitter bomb rolls one (bubbles.js glitterBurst)
    gild: null,                      // gild: { chance, time, bombs } (bubbles.js glitterBurst, gildTick)
    splashReflect: false,            // splash-reflect: a burst near a wall goes off again, thrown back off it (bubbles.js)
    wish: null,                      // wish: { kills } once an act, a splash that kills that many gives a level-up (run.js)
    jackpot: null,                   // crumb-on-kill drop="level": { chance } a kill drops XP worth a whole level (run.js onKill)
    pushedHits: false,               // pushed-hits: a bug a gust shoves knocks into the bugs on its way (enemies.js push)
    glide: null,                     // glide: { fall, push } hold jump in the air to drift down (player.js), gusts blown then push further (bubbles.js)
    freeAttacks: 0,                  // stat bubbles … no-penalty=#true: Attacks that cost the others no damage (bubbles.js share)
    ricochet: 0,                     // rebound walls-only=#true: wall ricochets a bubble gets (bubbles.js fly)
    trap: null,                      // trap-on-hit: { chance, time } (bubbles.js strike)
    homing: null,                    // homing: { turn, reach } (bubbles.js fly)
    popChain: null,                  // pop-chain: { dmg, range } (bubbles.js pop)
    wobble: null,                    // wobble: { width, rate } (bubbles.js fly)
    focusRamp: null,                 // focus-ramp: { step, most } (bubbles.js strike)
    rangePop: null,                  // range-pop: { splash } (bubbles.js fly)
    orbitMisses: false,              // orbit-misses (bubbles.js fly)
    execute: null,                   // execute: { under, elites } (enemies.js applyDamage)
    freshMore: 0, freshAbove: 0.9,   // fresh-damage: hits on a bug above freshAbove of its Health do this much more (enemies.js)
    closeMore: 0, closeRange: 0,     // close-damage: hits within closeRange m do this much more (enemies.js)
    bleedOnHit: null,                // bleed-on-hit: { chance, dmg, time, stacks } (run.js -> combat.bleed)
    hitLess: 0, hitLeast: 0.5,       // hit-less: each hit on you takes this much less, never below hitLeast (run.js hit)
    bossLevels: 0,                   // boss-levels: Treasures that level up when an act's boss falls (run.js onBossDead)
    nightLight: null,                // night-light: { radius, most } (gadgets.js; while "lit")
    bounty: null,                    // bounty: { every, stat, amount, far } (gadgets.js marks, run.js onKill pays)
    distanceXp: { xp: 0, every: 2 }, // distance-xp: XP for every `every` m swum (run.js)
    drain: { dps: 0, least: 1 },     // health-drain: Health lost a second, never below least (run.js)
    chancy: false,                   // some effect of yours rolls a chance (chance.js): Lucky Cat is offered only then
    luckyRolls: 1,                   // lucky-rolls: tries per chance of yours (chance.js)
    ghosts: null,                    // ghosts: { chance, time, dmg, speed, rest, most } (gadgets.js)
  };
}

const BY = ['bubbles', 'tentacles', 'splash', 'all'];   // splash: a glitter bomb's burst (types on); all is all three
const scopes = (by, where) => {
  if (!BY.includes(by)) throw new Error(`${where}: by= must be one of ${BY.join(', ')}`);
  return by === 'all' ? ['bubbles', 'tentacles', 'splash'] : [by];
};
const ELEMENT_IDS = ['fire', 'lightning', 'ice', 'acid', 'wind', 'glitter', 'poison'];   // poison: the Poison jelly type's attack only (it replaces acid there)

// The statuses a bug can have, as status-damage, status-taken and on-kill-of name them. Each has a
// reader in Enemies.statuses (bubbles.js adds burning, combat.js bleeding) giving its stacks, 0 for none.
export const STATUSES = ['frozen', 'chilled', 'slowed', 'stunned', 'marked', 'burning', 'bleeding', 'poisoned'];
const RANDOM_STATUSES = ['burning', 'chilled', 'stunned', 'slowed'];   // what random-status can roll (bubbles.js colour)
// What dealt a hit, as `by=` names it: a plain bubble, a tentacle, a splash, or an Element's shot
// (its burn, arcs and puddles go by the Element's name too)
export const HIT_BY = ['all', 'bubble', 'tentacle', 'splash', ...ELEMENT_IDS];
export const hitBy = (source, element) => (source === 'bubble' && element) || source;
const status = (name, word) => { if (!STATUSES.includes(name)) throw new Error(`${word}: status must be one of ${STATUSES.join(', ')}, not "${name}"`); return name; };
const by = (name, word) => { if (!HIT_BY.includes(name)) throw new Error(`${word}: by= must be one of ${HIT_BY.join(', ')}, not "${name}"`); return name; };
// Shatter: Fire on a frozen bug does 3x and thaws it. Every run has it (a status-damage)
const SHATTER = Object.freeze({ status: 'frozen', more: 2, by: 'fire', elites: false, bugs: true, perStack: 0, thaw: true, blast: 0, blastDmg: 0 });

// Each element is its own attack (bubbles.js): a projectile it fires on its own timer, separate
// from the bubbles. Its numbers start here; upgrade treasures (element-up) raise them. Every
// element has the common ones; `rate` shots a second and `dmg` x attack damage per hit are at your
// starting Fire rate and Attack damage, and scale with them (and Range, Attack size and extra
// Bubbles count too).
export const ELEMENT_BASE = {
  common: { rate: 0.75, dmg: 0.6, count: 0, pierce: 0, speed: 1, range: 1 },
  fire: { burn: 1, burnTime: 3, spread: 0.06, burnStacks: 1 },        // burn dps x, seconds, how far a death spreads it, Burns one bug can hold at once
  lightning: { chain: 3, bolt: 1, stun: 0.5, chainRange: 0.16, rate: 1.1, revisit: 0, stunFirst: 0, eliteBolt: 1 },   // arcs, arc damage x, stun s, arc reach m, arcs may return to a bug already hit (1), arcs go to Stunned bugs first (1), arc damage x on Elites and the boss
  ice: { chill: 2, frost: 0, slowedMul: 1, rate: 1, dmg: 2, speed: 0.5, frostbite: 0, chillPierce: 0, grow: 0 },   // chill s, frost: chills the whole splash, slowed enemies take x, frostbite: Chill hurts for this share of the hit a second, chillPierce: shards fly through bugs already Chilled, grow: a shard grows this much with each bug it hits
  acid: { puddleDmg: 1, puddleSize: 1, puddleTime: 3.5, puddles: 6, rate: 1.05 },   // puddle damage x, size x, seconds, most at once
  wind: { push: 0.6, pierce: 1, speed: 1.6 / 0.57, rate: 0.88, dmg: 1.5, windup: 0.28, collision: 1, falloff: 0, angle: 0 }, // half base bubble rate; windup s, scenery collision damage x; falloff: damage lost per bug a gust goes through, angle: degrees a second gust fires off to the side
  glitter: { width: 0.08 / 0.026, splash: 1, slow: 0, rate: 1.05, speed: 0.4 / 0.57 },            // splash width x, splash damage x, slow s
  // the Poison jelly's blob (docs/jelly-types/types/poison.md): its burst, a 5 cm sphere (width, as glitter's), does no
  // damage but adds a Poison stack; each stack does `poison` x 20% of Attack damage a second for poisonTime s, up to poisonStacks
  poison: { poison: 1, poisonTime: 5, poisonStacks: 5, width: 0.05 / 0.026 },
};
// element-up numbers that add (the rest multiply)
export const ELEMENT_ADD = new Set(['count', 'pierce', 'chain', 'burnTime', 'puddleTime', 'puddles', 'frost', 'slow', 'slowedMul', 'frostbite', 'chillPierce', 'grow', 'falloff', 'angle', 'revisit', 'stunFirst']);
// What each of those numbers is, for the balance editor
export const ELEMENT_HINTS = {
  rate: 'shots a second', dmg: 'damage per hit (× attack damage)', count: 'extra shots at once', pierce: 'enemies each shot goes through',
  speed: 'shot speed', range: 'how far it reaches', burn: 'burn damage a second', burnTime: 'seconds a burn lasts',
  spread: 'how far (m) a burning kill spreads the burn', burnStacks: 'Burns one bug can hold at once (each re-hit adds one)', chain: 'enemies a bolt arcs to', bolt: 'arc damage',
  stun: 'stun seconds', chainRange: 'arc reach (m)', revisit: 'arcs may return to a bug already hit (1 = on)', stunFirst: 'arcs go to Stunned bugs first (1 = on)', eliteBolt: 'arc damage on Elites and the boss', chill: 'chill seconds', frost: 'chilling the whole splash (1 = on)',
  slowedMul: 'extra damage slowed enemies take', puddleDmg: 'puddle damage', puddleSize: 'puddle size',
  puddleTime: 'seconds a puddle lasts', puddles: 'most puddles at once', push: 'how far it pushes',
  windup: 'wind-up before each shot (s)', collision: 'damage when a pushed enemy hits furniture',
  falloff: 'damage each gust loses on every bug it goes through (0.2 = 20%)', angle: 'degrees an extra gust fires off to the side',
  width: 'splash width', splash: 'splash damage', slow: 'slow seconds',
  frostbite: 'Chill damage a second, as a share of the hit', chillPierce: 'shards fly through already Chilled bugs (1 = on)', grow: 'how much a shard grows with each bug it hits',
  poison: 'Poison damage a second', poisonTime: 'seconds a Poison stack lasts', poisonStacks: 'Poison stacks one bug can hold',
};
export const elementParams = (id) => ({ ...ELEMENT_BASE.common, ...ELEMENT_BASE[id] });

// effects that fire on an `every N { … }` timer; each gets (gadgets, ctx) when it fires
export const TIMED_WORDS = {
  ring: {
    doc: 'A ring around you, `radius` m: stings everything inside for `dmg`, pushes it out by `push` m, freezes it for `freeze` s, slows it for `slow` s, Chills it for `chill` s. `elites=#false` spares elites and the boss; it shows for `show` s; `look` is "ring", "chord" (vibrating arcs) or "needles" (streaks to actual targets).',
    args: ['radius'],
    props: { dmg: 1, push: 0, freeze: 0, slow: 0, chill: 0, elites: true, color: '#ffffff', look: 'ring', show: 0.45 },
    make: ([radius], p) => ({ kind: 'ring', radius, ...p }),
  },
  zap: {
    doc: 'Zaps the `count` nearest enemies within `range` m with a jagged bolt, `dmg` each. `target="toughest"` picks the ones with the most Health left instead (an Elite or the boss counts as the most). `look` is "signal" or "bolt" (a lightning bolt, which counts as a lightning arc).',
    args: ['count'],
    props: { range: 0.45, dmg: 2, target: 'nearest', look: 'signal' },
    make: ([count], p) => {
      if (p.target !== 'nearest' && p.target !== 'toughest') throw new Error('zap: target must be nearest or toughest');
      if (p.look !== 'signal' && p.look !== 'bolt') throw new Error('zap: look must be signal or bolt');
      return { kind: 'zap', count, ...p };
    },
  },
  brick: {
    doc: 'Drops a brick at your feet, `size` times the usual size; the first walking enemy to step on it takes `dmg`, and with `burst` (m) so does every enemy within that of the brick. Lasts `last` s, at most `most` on the floor.',
    props: { dmg: 4, last: 14, most: 5, size: 1, burst: 0 },
    make: (_, p) => ({ kind: 'brick', ...p }),
  },
  marble: {
    doc: 'Rolls a marble `size` times the usual size out the way you face at `speed` m/s for `life` s, bouncing off walls; each enemy it bowls through takes `dmg`. Like a pinball, each of its first `bounces` wall hits makes it `grow` (0.2 = 20%) faster and harder, and lets it bowl the same bugs again.',
    props: { dmg: 2, speed: 0.825, life: 1.47, size: 1, bounces: 0, grow: 0.2 },
    make: (_, p) => ({ kind: 'marble', ...p }),
  },
  swatter: {
    doc: 'A fly swatter slaps down on the nearest flying bug within `range` m for `mult` times your Attack damage and Stuns it for `stun` s; with no flyer that close, it swats the nearest bug for `plain` times instead.',
    props: { mult: 3, plain: 2, stun: 1, range: 0.3 },
    make: (_, p) => ({ kind: 'swatter', ...p }),
  },
  geyser: {
    doc: 'Lobs a fizzing bomb at the biggest crowd within `range` m; after `fuse` s it erupts in a foam column: every bug within `radius` m of it takes `dmg` times your Attack damage and is thrown up into the air (`lift` m/s up, not Elites or the boss), Stunned until it lands.',
    props: { range: 0.4, radius: 0.1, dmg: 2, fuse: 0.6, lift: 0.4 },
    make: (_, p) => ({ kind: 'geyser', ...p }),
  },
  puddle: {
    doc: 'Drops an ice cube at your feet that melts into a slippery puddle `radius` m round for `last` s (at most `most` at once): a bug that walks onto it skids on and is Stunned for `skid` s (once per puddle). Pair it with `while "wet"` for something while you\'re on one.',
    props: { radius: 0.15, last: 5, skid: 0.5, most: 3 },
    make: (_, p) => ({ kind: 'puddle', ...p }),
  },
  lash: {
    doc: 'In a when-hit block: one of your tentacles lashes the enemy that hit you (if it\'s within `range` m) for `dmg` times your Tentacle damage. `all=#true`: every enemy within your Tentacle reach is lashed instead (`range` is ignored).',
    props: { dmg: 2, range: 0.2, all: false },
    make: (_, p) => ({ kind: 'lash', ...p }),
  },
  grab: {
    doc: 'A tentacle shoots out up to `range` m, grabs the toughest enemy there (most Health left; never the boss) and reels it in to you, slamming it for `dmg` times your Tentacle damage; every other enemy it is dragged through takes the same.',
    props: { range: 0.3, dmg: 3 },
    make: (_, p) => {
      if (!(p.range > 0 && p.dmg > 0)) throw new Error('grab: range and dmg must be above 0');
      return { kind: 'grab', ...p };
    },
  },
  ink: {
    doc: 'In a when-hit block: you squirt an ink cloud; for `time` s, a hit from an enemy within `radius` m of you misses `miss` (0.5 = half) of the time, as a second chance beside your Dodge (so together they stay under 100%).',
    props: { radius: 0.15, time: 2, miss: 0.5 },
    make: (_, p) => {
      if (!(p.radius > 0 && p.time > 0 && p.miss > 0 && p.miss < 1)) throw new Error('ink: radius and time must be above 0, miss between 0 and 1 (not 1)');
      return { kind: 'ink', ...p };
    },
  },
  'reach-flare': {
    doc: 'Your tentacles flare out: the next lash reaches `mult` times as far (then it is back to normal until this goes off again).',
    args: ['mult'],
    make: ([mult]) => {
      if (!(mult > 1)) throw new Error('reach-flare: mult must be above 1');
      return { kind: 'reach-flare', mult };
    },
  },
  'bubble-ring': {
    doc: 'Blows `count` bubbles at once, spread evenly in every direction around you, each doing `dmg` times your Attack damage.',
    args: ['count'],
    props: { dmg: 1 },
    make: ([count], p) => ({ kind: 'bubble-ring', count, ...p }),
  },
  dash: {
    doc: 'A burst of speed: +`speed` Move speed (1 = +100% of your starting speed) for `time` s. With `dmg`, bugs you surge through (within `reach` m of you) are stung once each for `dmg` times your power and shoved `push` m aside.',
    args: ['speed'],
    props: { time: 0.35, dmg: 0, push: 0, reach: 0.05 },
    make: ([speed], p) => ({ kind: 'dash', speed, time: p.time, dmg: p.dmg, push: p.push, reach: p.reach }),
  },
  cone: {
    doc: 'A flame cone toward the nearest bug within `range` m (or the way you face): everything within `angle`° of that way takes `dmg` times your power and is set alight (Burn, as your Fire attack\'s).',
    props: { range: 0.12, angle: 70, dmg: 0.5 },
    make: (_, p) => {
      if (!(p.range > 0 && p.angle > 0 && p.angle <= 180)) throw new Error('cone: range must be above 0 and angle between 0 and 180');
      return { kind: 'cone', ...p };
    },
  },
  shards: {
    doc: 'Ice shards fly out from the spot (an on-kill-of block) or from you at the `count` nearest bugs within `range` m: each takes `dmg` times your power and is Chilled for `chill` s.',
    args: ['count'],
    props: { range: 0.12, dmg: 0.5, chill: 2 },
    make: ([count], p) => {
      if (!(Number.isInteger(count) && count >= 1 && p.range > 0 && p.dmg > 0 && p.chill > 0)) throw new Error('shards: count must be a whole number, 1 or more, and range, dmg and chill above 0');
      return { kind: 'shards', count, ...p };
    },
  },
  xp: {
    doc: 'Drops `xp` worth of XP at your feet.',
    args: ['xp'],
    make: ([n]) => ({ kind: 'xp', xp: n }),
  },
  // --- Poison's Attack upgrades (P8c)
  cloud: {
    doc: 'A cloud of gas `radius` m round where it goes off, for `time` s: every 0.5 s each bug inside gets a Poison stack (as your Poison attack\'s).',
    props: { radius: 0.05, time: 3 },
    make: (_, p) => {
      if (!(p.radius > 0 && p.time > 0)) throw new Error('cloud: radius and time must be above 0');
      return { kind: 'cloud', ...p };
    },
  },
  'pass-stacks': {
    doc: 'In an on-kill-of block: the dead bug\'s stacks of `status` (poisoned) pass to every bug within `radius` m of it.',
    args: ['status'],
    props: { radius: 0.06 },
    make: ([s], p) => {
      if (s !== 'poisoned') throw new Error(`pass-stacks: status must be poisoned, not "${s}"`);
      if (!(p.radius > 0)) throw new Error('pass-stacks: radius must be above 0');
      return { kind: 'pass-stacks', status: s, ...p };
    },
  },
  heal: {
    doc: 'Gives back `health`, at most `most` times a second.',
    args: ['health'],
    props: { most: 3 },
    make: ([n], p) => {
      if (!(n > 0 && p.most > 0)) throw new Error('heal: health and most= must be above 0');
      return { kind: 'heal', health: n, most: p.most };
    },
  },
  blob: {
    doc: '`count` Poison blobs (your Poison attack\'s, its hit and burst) fall from above on as many bugs within `range` m of you.',
    props: { count: 4, range: 0.3 },
    make: (_, p) => {
      if (!(Number.isInteger(p.count) && p.count >= 1 && p.range > 0)) throw new Error('blob: count must be a whole number, 1 or more, and range above 0');
      return { kind: 'blob', ...p };
    },
  },
  // --- Glitter's Attack upgrades (P8e)
  'next-attack': {
    doc: 'Your next attack (an Element shot) is a bigger one: its splash or burst `width` times as wide, `size` times bigger and `dmg` times the damage. The bell glows while it waits.',
    props: { width: 1, size: 1, dmg: 1 },
    make: (_, p) => {
      if (!(p.width > 0 && p.size > 0 && p.dmg > 0) || (p.width === 1 && p.size === 1 && p.dmg === 1)) throw new Error('next-attack: width, size and dmg must be above 0, and one of them not 1');
      return { kind: 'next-attack', ...p };
    },
  },
  splash: {
    doc: 'A glitter burst where it goes off (your Glitter attack\'s splash and its upgrades), for `dmg` times its usual damage.',
    props: { dmg: 0.5 },
    make: (_, p) => {
      if (!(p.dmg > 0)) throw new Error('splash: dmg must be above 0');
      return { kind: 'splash', ...p };
    },
  },
  // --- Wind's Attack upgrades (P8d)
  whirl: {
    doc: 'A whirlwind `radius` m across rises at the nearest bug within `range` m of you and stays `time` s, pulling every bug in it toward its middle at `pull` m/s; with `dmg`, every 0.5 s each bug in it takes `dmg` times your power. `most`: at most that many at once (0: any number).',
    props: { radius: 0.09, time: 1.6, pull: 0.12, range: 0.3, dmg: 0, most: 0 },
    make: (_, p) => {
      if (!(p.radius > 0 && p.time > 0 && p.pull > 0 && p.range > 0)) throw new Error('whirl: radius, time, pull and range must be above 0');
      if (!(p.dmg >= 0 && Number.isInteger(p.most) && p.most >= 0)) throw new Error('whirl: dmg must be 0 or more and most a whole number, 0 or more');
      return { kind: 'whirl', ...p };
    },
  },
  // Jelly Mould (src/turrets.js)
  turret: {
    doc: 'Sets a little jelly down on the floor under you for `time` s (at most `most` at once: a new one sends the oldest away). It has `health` Health: ordinary bugs nearer it than you go for it, and their hits and touches land on it instead. It fires your jelly type\'s own attack, none of your Treasures or Attack upgrades, at your Fire rate and Range, for `dmg` of your Attack damage. A Tentacle jelly has no shot to give it.',
    props: { time: 8, health: 8, dmg: 0.4, most: 4 },
    make: (_, p) => {
      if (!(p.time > 0 && p.health > 0 && p.dmg > 0 && Number.isInteger(p.most) && p.most >= 1)) throw new Error('turret: time, health and dmg must be above 0, most a whole number, 1 or more');
      return { kind: 'turret', ...p };
    },
  },
  // Lightning jelly (P8b)
  orb: {
    doc: 'A slow ball of lightning drifts out toward the nearest bug (or the way you face) at `speed` m/s for `life` s, zapping every bug within `radius` m of it for `dmg` (once each).',
    props: { speed: 0.07, life: 5, radius: 0.025, dmg: 1.5 },
    make: (_, p) => {
      if (!(p.speed > 0 && p.life > 0 && p.radius > 0)) throw new Error('orb: speed, life and radius must be above 0');
      return { kind: 'orb', ...p };
    },
  },
};

// what an nth-attack block can make its attack (bubbles.js volley)
export const ATTACK_WORDS = {
  big: {
    doc: 'This attack is a big one: `dmg` times the damage, `size` times bigger, `speed` times as fast, through `pierce` more bugs.',
    props: { dmg: 2, size: 1.5, speed: 1, pierce: 0 },
    make: (_, p) => ({ kind: 'big', ...p }),
  },
  sweep: {
    doc: 'This lash is a sweep (tentacles only; bubbles ignore it): every enemy within reach is stung at once, `dmg` times the damage, and each gets `bleed` Bleed stacks (as venom\'s, or 25% of the sting a second for 3 s, up to 5).',
    props: { dmg: 1, bleed: 0 },
    make: (_, p) => {
      if (!(p.dmg > 0 && Number.isInteger(p.bleed) && p.bleed >= 0)) throw new Error('sweep: dmg must be above 0 and bleed a whole number, 0 or more');
      return { kind: 'sweep', ...p };
    },
  },
  // Lightning jelly (P8b)
  bolt: {
    doc: 'This lightning shot is a big bolt (lightning only; other attacks ignore it): `size` times bigger, its arcs `dmg` times as hard and `reach` times as far.',
    props: { dmg: 2, reach: 2, size: 1.5 },
    make: (_, p) => {
      if (!(p.dmg > 0 && p.reach > 0 && p.size > 0)) throw new Error('bolt: dmg, reach and size must be above 0');
      return { kind: 'bolt', ...p };
    },
  },
};

// stack-buff's events: a kill, a hit by your attack, a lightning arc, a splash that kills 3 or more
export const BUFF_EVENTS = ['kill', 'hit', 'arc', 'big-splash', 'level-up', 'crit', 'elite-kill'];

// When a `while` holds (Run.S checks it each time the stats are read)
// the extra pieces adorn can add (src/adornments.js builds each)
export const ADORNMENTS = ['sail', 'halo', 'moon-ring', 'mane', 'fronds', 'rebound-bands', 'mirage-rim', 'flaming-feet', 'ember', 'barbs', 'toxin', 'frost', 'storm', 'gale', 'sparkle', 'fangs'];   // fangs: Bloody Fangs'; ember, barbs, toxin, frost, storm, gale, sparkle: the Fire, Tentacle, Poison, Ice, Lightning, Wind and Glitter jelly types' looks (content/jellies.kdl adorn=)

export const WHILE_WHEN = ['airborne', 'low-health', 'rooted', 'moving', 'lit', 'unhurt', 'wet'];   // lit: inside a night-light's glow; unhurt: no hit taken for 4 s (run.js UNHURT); wet: on one of your puddles

// What `per` can count (Run.S works each one out)
export const PER_SOURCES = ['max-health', 'move-speed-bonus', 'levels', 'chests', 'burning-nearby'];   // burning-nearby: Burning bugs within 30 cm of you

// The stats a treasure can raise with `stat`, by the name content files use
export const STAT_NAMES = { bubbles: 'bubbles', range: 'range', 'bubble-damage': 'bubbleDamage', 'fire-rate': 'fireRate', health: 'health', shield: 'shield', 'move-speed': 'moveSpeed', 'health-regen': 'regen', 'tentacle-damage': 'tentacleDamage', dodge: 'dodge', luck: 'luck', 'bubble-size': 'bubbleSize', 'jump-height': 'jumpHeight', tentacles: 'tentacles', 'tentacle-reach': 'reach', 'tentacle-speed': 'tentacleSpeed', pierce: 'pierce', 'burn-damage': 'burnDamage' };

export const TREASURE_WORDS = {
  pierce: { doc: 'Each bubble pops on up to `count` enemies in a line.', args: ['count'], make: ([n]) => (m) => { m.bubbles.pierce = Math.max(m.bubbles.pierce, n); } },
  'echo-bubble': {
    doc: 'Every bubble that pops on an enemy fires again from there at the next enemy within 20 cm, once, doing `dmg` times the first bubble\'s damage. `on="kill"`: only a bubble that killed its enemy does, and the one it fires goes on the same way. `by="tentacles"`: every sting jumps on to the nearest other enemy within your Tentacle reach instead, once, doing `dmg` times the sting. `from="splash"`: every glitter burst fires `count` small shots from its middle at the nearest bugs within 20 cm, each `dmg` times the bomb\'s hit.',
    props: { dmg: 1, by: 'bubbles', on: 'hit', from: 'pop', count: 1 },
    make: (_, p, where) => {
      if (p.by !== 'bubbles' && p.by !== 'tentacles') throw new Error(`${where}: by= must be bubbles or tentacles`);
      if (p.on !== 'hit' && p.on !== 'kill') throw new Error(`${where}: on= must be hit or kill`);
      if (p.on === 'kill' && p.by === 'tentacles') throw new Error(`${where}: on="kill" is for bubbles`);
      if (p.from !== 'pop' && p.from !== 'splash') throw new Error(`${where}: from= must be pop or splash`);
      if (!(Number.isInteger(p.count) && p.count >= 1)) throw new Error(`${where}: count= must be a whole number, 1 or more`);
      if (p.from === 'splash') return (m) => { m.splashShots.push({ min: 0, count: p.count, dmg: p.dmg }); };
      return (m) => { if (p.by === 'tentacles') m.hits.tentacles.echo = { dmg: p.dmg }; else m.bubbles.echo = { dmg: p.dmg, onKill: p.on === 'kill' }; };
    },
  },
  'toy-mouse': { doc: 'Every `every` s a wind-up toy mouse `size` times its usual size scurries (`speed` m/s) to the nearest enemy and slams into it for `dmg` times your power, hitting every enemy within `splash` m of it and shoving them `push` m.', props: { every: 12, dmg: 3, speed: 0.6, size: 1, splash: 0, push: 0 }, make: (_, p) => (m) => { m.mouse = { ...p }; } },
  'golden-bubble': { doc: 'Every `every`th attack (a bubble, an Element shot or a tentacle sting) is golden and does `mult` times damage; a bug a golden attack finishes off drops a big gold XP gem worth `coin` times its XP (0 for none).', props: { every: 10, mult: 5, coin: 0 }, make: (_, p) => (m) => { m.bubbles.golden = p; m.hits.tentacles.golden = p; } },
  'giant-bubble': { doc: 'Every `every`th bubble also blows a giant one: `size` times bigger, `dmg` times the damage, `speed` times as fast.', props: { every: 6, size: 2.5, dmg: 4, speed: 0.6 }, make: (_, p) => (m) => { m.bubbles.giant = p; } },
  'element-up': {
    doc: 'Upgrades one element attack (its base treasure must be owned to be offered: needs="…" on the treasure). Any of its numbers (ELEMENT_BASE in words.js): count, pierce, chain, burnTime, puddleTime, puddles, frost, slow, slowedMul, frostbite, chillPierce, grow, revisit and stunFirst add; the rest multiply. E.g. element-up "fire" burn=1.5 burnTime=2.',
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
  'mark-on-hit': { doc: 'Enemies you hit are marked for `seconds` and take `more` (0.5 = 50%) more damage from everything. `by` as above.', args: ['seconds'], props: { by: 'all', more: 0.5 }, make: ([s], p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) { m.hits[k].mark = Math.max(m.hits[k].mark, s); m.hits[k].markMore = Math.max(m.hits[k].markMore, p.more); } }; } },
  crit: { doc: '`chance` of a hit doing `mult` times damage. `by` as above. Several crits (or copies) add their chances and use the biggest mult.', props: { chance: 0.2, mult: 3, by: 'all' }, make: (_, p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) { const c = m.hits[k].crit; m.hits[k].crit = c ? { chance: c.chance + p.chance, mult: Math.max(c.mult, p.mult) } : { chance: p.chance, mult: p.mult }; } }; } },
  'pin-on-crit': { doc: 'A critical hit pins the enemy in place for `seconds` (it can\'t move or attack). `by` as above.', args: ['seconds'], props: { by: 'all' }, make: ([s], p, where) => { const sc = scopes(p.by, where); return (m) => { for (const k of sc) m.hits[k].pin = Math.max(m.hits[k].pin, s); }; } },
  'zap-on-pop': { doc: '`chance` that a bubble popping on an enemy snaps static to `count` other enemies within `range` m, stunning each for `stun` s (and doing `dmg`, x your attack damage). Copies add their chances.', props: { chance: 0.2, count: 1, range: 0.3, stun: 0.5, dmg: 0 }, make: (_, p) => (m) => { const z = m.popZap; m.popZap = z ? { ...z, chance: z.chance + p.chance, count: Math.max(z.count, p.count) } : { ...p }; } },
  'dodge-slip': { doc: 'A bug whose hit you dodge slips: it is Stunned for `stun` s (not Elites or the boss).', args: ['stun'], make: ([t]) => (m) => { m.dodgeSlip = Math.max(m.dodgeSlip || 0, t); } },
  'shot-speed': { doc: 'Your shots (bubbles and Element shots) fly `percent`% faster. Copies add.', args: ['percent'], make: ([n]) => (m) => { m.bubbles.speed = (m.bubbles.speed || 1) + n / 100; } },
  'rear-shot': { doc: 'Every volley also fires `count` more of your shots straight behind you, each for your full Attack damage (no side-by-side share).', args: ['count'], make: ([n]) => (m) => { m.bubbles.rear = (m.bubbles.rear || 0) + n; } },
  'extra-jumps': { doc: '`count` more jumps in mid-air.', args: ['count'], make: ([n]) => (m) => { m.extraJumps += n; } },
  'landing-shockwave': { doc: 'Landing from a drop of at least `drop` m sends out a ring of `radius` m that stings for `dmg` (none if 0) and, with `push` (m), blasts everything in it that far away from you in a gust.', args: ['radius'], props: { dmg: 2, drop: 0.04, push: 0 }, make: ([r], p) => (m) => { m.landingShockwave = { radius: r, ...p }; } },
  'squeak-when-hit': { doc: 'When you get hit, enemies within `radius` m are pushed back `push` m, take `dmg` (a flat number; 0 for none) and are Stunned for `stun` s (not Elites or the boss). Once every `cooldown` s. Several stack.', props: { radius: 0.09, push: 0.06, dmg: 3, stun: 0, cooldown: 5 }, make: (_, p) => (m) => { m.squeaks.push(p); } },
  'on-attack': {
    doc: 'Each attack you make (a volley of bubbles, an Element shot, a round of tentacle stings) has `chance` (0.1 = 1 in 10) to do the effects in its { block } (whirl, ring, zap…). Copies each roll.',
    props: { chance: 0.1 },
    block: TIMED_WORDS,
    make: (_, p, where, effects) => {
      if (!(p.chance > 0 && p.chance <= 1)) throw new Error('on-attack: chance must be above 0 and at most 1');
      return (m) => { m.onAttack.push({ chance: p.chance, effects }); };
    },
  },
  'distance-xp': {
    doc: 'Every `every` m you swim (along the floor or in the air), you gain `xp` XP. Copies add their XP.',
    args: ['xp'],
    props: { every: 2 },
    make: ([n], p) => {
      if (!(n > 0 && p.every > 0)) throw new Error('distance-xp: xp and every= must be above 0');
      return (m) => { m.distanceXp.xp += n; m.distanceXp.every = p.every; };
    },
  },
  'health-drain': {
    doc: 'You lose `health` Health a second (not your Shield), but it never takes you below `least`. Copies add.',
    args: ['health'],
    props: { least: 1 },
    make: ([n], p) => {
      if (!(n > 0 && p.least > 0)) throw new Error('health-drain: health and least= must be above 0');
      return (m) => { m.drain.dps += n; m.drain.least = Math.max(m.drain.least, p.least); };
    },
  },
  'when-hit': {
    doc: 'When you get hit (not a dodge), does the effects in its { block } (ring, zap…), then waits `cooldown` s before it can again. `once-per-act=#true`: only the first time each act. `low-health` (a share of your max Health, 0.3 = 30%): only when you are at or under that. Copies each have their own.',
    props: { cooldown: 1, 'once-per-act': false, 'low-health': null },
    block: TIMED_WORDS,
    make: (_, p, where, effects) => {
      if (p['low-health'] != null && !(p['low-health'] > 0 && p['low-health'] <= 1)) throw new Error('when-hit: low-health must be above 0 and at most 1');
      return (m, copy = 0) => { m.onHurt.push({ cooldown: p.cooldown, effects, key: `${where}#${copy}`, oncePerAct: p['once-per-act'], lowHealth: p['low-health'] }); };
    },
  },
  reflect: { doc: 'Every `every` s, the first hit you take is sent back at whoever dealt it (if an enemy did) for at least `dmg` times your power, and you take none of it, then can\'t be hurt for `invuln` s. A shockwave hits every enemy within `burst` m for `burstDmg` times your power and shoves it `push` m.', props: { every: 20, invuln: 1, dmg: 0, burst: 0, burstDmg: 0, push: 0 }, make: (_, p) => (m) => { m.reflect = { ...p }; } },
  venom: { doc: 'Every tentacle sting adds a Bleed stack to the enemy (at most `stacks`), each bleeding `dps` times your Tentacle damage a second; stacks last `time` s after the last sting.', props: { dps: 0.5, time: 3, stacks: 5 }, make: (_, p) => (m) => { m.hits.tentacles.venom = { ...p }; } },
  'reach-sweetspot': {
    doc: 'A tentacle sting on an enemy at the very edge of your reach (its nearest side `from` or more of the way out, 0.75 = the outer quarter) does `mult` times the damage. Copies take the biggest.',
    props: { from: 0.75, mult: 2 },
    make: (_, p) => {
      if (!(p.from > 0 && p.from < 1 && p.mult > 1)) throw new Error('reach-sweetspot: from must be between 0 and 1, mult above 1');
      return (m) => { const e = m.hits.tentacles.edge; m.hits.tentacles.edge = e ? { from: Math.min(e.from, p.from), mult: Math.max(e.mult, p.mult) } : { ...p }; };
    },
  },
  'pin-on-stings': {
    doc: 'An enemy stung by your tentacles `hits` times within `within` s is pinned in place (it can\'t move or attack) for `seconds`, then counts again from none.',
    args: ['hits'],
    props: { within: 2, seconds: 1 },
    make: ([n], p) => {
      if (!(Number.isInteger(n) && n >= 2 && p.within > 0 && p.seconds > 0)) throw new Error('pin-on-stings: hits must be a whole number, 2 or more, and within= and seconds= above 0');
      return (m) => { m.hits.tentacles.coil = { hits: n, within: p.within, seconds: p.seconds }; };
    },
  },
  'sting-count': {
    doc: 'Every `every`th tentacle sting (stings from sweeps don\'t count) makes your next lash the one in its { block }: sweep.',
    args: ['every'],
    block: ATTACK_WORDS,
    make: ([n], p, where, effects) => {
      if (!(Number.isInteger(n) && n >= 2)) throw new Error('sting-count: every must be a whole number, 2 or more');
      if (effects.some((ef) => ef.kind !== 'sweep')) throw new Error('sting-count: only sweep goes in its block');
      return (m) => { m.stingCount.push({ every: n, effects }); };
    },
  },
  polyps: { doc: '`count` little polyps orbit you and shoot with you: every time you blow bubbles or fire an element, each polyp fires one of the same at the enemy nearest it, doing `dmg` times the damage.', args: ['count'], props: { dmg: 0.5 }, make: ([n], p) => (m) => { m.polyps = { count: n, dmg: p.dmg }; } },
  rebirth: { doc: 'Once each act, a hit that would take your last Health turns you back into a polyp for `time` s instead: nothing can hurt you, but you can\'t attack. Then you bloom back with full Health.', props: { time: 5 }, make: (_, p) => (m) => { m.rebirth = { ...p }; } },
  rebound: {
    doc: 'Ordinary bubbles return toward the jelly after their outward range or a wall, hitting each target at most once per leg. Elements keep their own flight. `walls-only=#true`: instead a bubble that hits a wall ricochets off it, up to `times` times, and flies on with its Range; nothing comes back to you.',
    props: { 'walls-only': false, times: 1 },
    make: (_, p) => {
      if (!(Number.isInteger(p.times) && p.times >= 1)) throw new Error('rebound: times must be a whole number, 1 or more');
      return (m) => { if (p['walls-only']) m.ricochet = Math.max(m.ricochet, p.times); else m.rebound = true; };
    },
  },
  decoy: {
    doc: 'Every `every` seconds spent moving, leaves a harmless copy for `time` seconds that attracts ordinary bugs within `range` m. Existing projectiles and locked aims stay unchanged.',
    props: { every: 8, time: 3, range: 0.45 },
    make: (_, p) => {
      if (!(p.every > 0 && p.time > 0 && p.range > 0 && p.time <= p.every)) throw new Error('decoy: positive every, time and range required; time cannot exceed every');
      return (m) => { m.decoy = { ...p }; };
    },
  },
  'fire-trail': {
    doc: 'Walking leaves a floor trail for `time` seconds, `radius` m either side of the actual route and `height` m tall. Touching bugs take `dps` times power per second, once per `tick`, without overlap stacking. Air, climbs and vents leave no trail.',
    props: { time: 2, radius: 0.025, height: 0.035, dps: 0.5, tick: 0.25 },
    make: (_, p) => {
      if (!(p.time > 0 && p.radius > 0 && p.height > 0 && p.dps > 0 && p.tick > 0)) throw new Error('fire-trail: time, radius, height, dps and tick must be positive');
      return m => { m.fireTrail = { ...p }; };
    },
  },
  'wake': {
    doc: 'Swimming along anything you stand on leaves a glowing trail `radius` m either side of your path that lasts `time` s. Bugs walking in it lose `slow` (0.3 = 30%) of their speed (Elites and the Boss only a light slow; flying bugs not at all). Jumping off the ground sets the whole trail off: a pulse runs from you to its far end in `ignite` s, and every piece goes off as a Blast `blast` m round for `dmg` x Attack damage (each bug hit once). That uses the trail up; at most once every `cooldown` s. A mid-air jump sets nothing off.',
    props: { time: 4, radius: 0.018, slow: 0.3, dmg: 2, blast: 0.04, ignite: 0.3, cooldown: 1 },
    make: (_, p) => {
      if (!(p.time > 0 && p.radius > 0 && p.slow > 0 && p.slow < 1 && p.dmg > 0 && p.blast > 0 && p.ignite > 0 && p.cooldown >= 0)) throw new Error('wake: time, radius, dmg, blast and ignite must be positive, slow between 0 and 1, cooldown 0 or more');
      return (m) => { m.wake = { ...p }; };
    },
  },
  'tether': {
    doc: 'Every `every`th attack you make ties a beam from your middle to the first bug it hits (an Elite too, never the boss) for `time` s. It breaks early if that bug dies or gets more than `range` m away, and only one is up at a time. Every other bug within `width` m of the beam takes `dps` x Attack damage a second, once per `tick` s (a soft hit). Jumping tilts it, since it runs from wherever you are.',
    props: { every: 5, time: 4, range: 0.6, dps: 1.5, tick: 0.2, width: 0.012 },
    make: (_, p) => {
      if (!(Number.isInteger(p.every) && p.every >= 1 && p.time > 0 && p.range > 0 && p.dps > 0 && p.tick > 0 && p.width > 0)) throw new Error('tether: every= must be a whole number, 1 or more; time, range, dps, tick and width must be positive');
      return (m) => { m.tether = { ...p }; };
    },
  },
  'shield-recharge': {
    doc: 'Your Shield refills `faster` (0.5 = 50%) faster and starts refilling `sooner` s sooner after damage. With `near` (m), only while a Chilled bug is within that of you (then `sooner` is not allowed). Copies add.',
    props: { faster: 0, sooner: 0, near: 0 },
    make: (_, p) => {
      if (!(p.near >= 0) || (p.near > 0 && p.sooner)) throw new Error('shield-recharge: near= is 0 or more, and goes with faster= only');
      return (m) => { if (p.near > 0) m.shield.near.push({ faster: p.faster, radius: p.near }); else { m.shield.faster += p.faster; m.shield.sooner += p.sooner; } };
    },
  },
  'shield-full-damage': { doc: 'While your Shield is full, everything you do hurts `percent`% more. Copies add.', args: ['percent'], make: ([n]) => (m) => { m.shield.fullDamage += n / 100; } },
  'shield-burst': {
    doc: 'When your Shield breaks, a blast hits every enemy within `radius` m of you for `dmg` times your Attack damage (a flat `dmg` with flat=#true), and with `invuln` you can\'t be hurt for that many seconds more (dmg=0 for no blast). `look="pops"`: it goes off as a ring of little pops one after another instead of one blast. Copies add their damage into one blast; different blasts each go off.',
    props: { dmg: 2, radius: 0.3, flat: false, invuln: 0, look: 'blast' },
    make: (_, p) => {
      if (!(p.radius > 0 && p.invuln >= 0 && (p.dmg > 0 || p.invuln > 0))) throw new Error('shield-burst: radius must be positive, and dmg or invuln above 0');
      if (p.look !== 'blast' && p.look !== 'pops') throw new Error('shield-burst: look must be blast or pops');
      return (m) => {
        m.shield.invuln = Math.max(m.shield.invuln, p.invuln);
        if (!(p.dmg > 0)) return;
        const same = m.shield.bursts.find((b) => b.radius === p.radius && b.flat === p.flat && b.look === p.look);
        if (same) same.dmg += p.dmg; else m.shield.bursts.push({ dmg: p.dmg, radius: p.radius, flat: p.flat, look: p.look });
      };
    },
  },
  'health-to-shield': { doc: 'Your max Health stays at 1: the rest of it, now and whatever you gain later, is Shield instead. Health and Health regen cards are no longer offered.', make: () => (m) => { m.shield.fromHealth = true; } },
  'no-regen': { doc: 'Health regen does nothing (from cards, treasures or anything else). `revived=#true`: only once rebirth has saved you this run.', props: { revived: false }, make: (_, p) => (m) => { m.noRegen = m.noRegen === true || !p.revived ? true : 'revived'; } },
  'touch-sting': { doc: 'Enemies touching you (within `reach` m of your body) take `dmg` every `every` s.', props: { dmg: 0.6, every: 0.5, reach: 0.02 }, make: (_, p) => (m) => { m.touch = { ...p }; } },
  adorn: { doc: 'Adds an evolution look (src/adornments.js): sail, halo, moon-ring, mane and fronds add pieces.', args: ['piece'], make: ([k]) => { if (!ADORNMENTS.includes(k)) throw new Error(`adorn: one of ${ADORNMENTS.join(', ')}, not "${k}"`); return (m) => { m.adorn.push(k); }; } },
  'death-save': { doc: 'Once per run, a hit that would take your last Health leaves you at `health` (a share of your max Health) instead.', props: { health: 0.5 }, make: (_, p) => (m) => { m.deathSave = { ...p }; } },
  'damage-taken': { doc: 'Hits take `times` as much health.', args: ['times'], make: ([k]) => (m) => { m.damageTaken *= k; } },
  'land-heal': { doc: 'Landing from a jump (a drop of at least 4 cm) spouts water and gives back `health`, at most once every `every` s.', args: ['health'], props: { every: 4 }, make: ([n], p) => (m) => { m.landHeal = { health: Math.max(m.landHeal?.health || 0, n), every: p.every }; } },
  'heal-on-kill': { doc: 'Every enemy you clear gives back `health`.', args: ['health'], make: ([n]) => (m) => { m.healOnKill += n; } },
  'burst-on-kill': { doc: 'Enemies you finish off burst, stinging everything within `radius` m for `dmg`.', args: ['radius'], props: { dmg: 0.5 }, make: ([r], p) => (m) => { m.burstOnKill = { radius: r, dmg: p.dmg }; } },
  'leave-on-kill': {
    doc: '`chance` that an enemy you clear leaves something on the floor for `last` s; it stays put (no drift) until you swim over it. Picking one up heals `health` and, with `stat`, adds a stack of +`amount` of that stat (a % of its start with percent=#true) for `time` s, up to `stacks`. `look` is "dust" (a grey dust bunny) or "meatball". Copies add their chances.',
    props: { chance: 0.1, last: 6, health: 0, look: 'dust', stat: '', amount: 0, percent: true, time: 5, stacks: 5 },
    make: (_, p, where) => {
      if (!['dust', 'meatball'].includes(p.look)) throw new Error(`${where}: leave-on-kill look= must be dust or meatball, not "${p.look}"`);
      const key = p.stat && STAT_NAMES[p.stat];
      if (p.stat && !key) throw new Error(`${where}: leave-on-kill stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${p.stat}"`);
      const event = `left:${p.look}`;
      return (m, copy = 0) => {
        const had = m.leaves.find((l) => l.look === p.look);
        if (had) had.chance += p.chance; else m.leaves.push({ chance: p.chance, last: p.last, health: p.health, look: p.look, event });
        if (key && !had) m.buffs.push({ event, stat: key, amount: p.amount, percent: p.percent, time: p.time, stacks: p.stacks, key: `${where}#${copy}` });
      };
    },
  },
  'crumb-on-kill': {
    doc: '`chance` that an enemy you clear leaves a crumb worth `health`; it drifts to you like XP. `drop="level"`: a big XP gem worth the rest of your level instead. Copies add their chances.',
    props: { chance: 0.02, health: 1, drop: 'health' },
    make: (_, p, where) => {
      if (p.drop !== 'health' && p.drop !== 'level') throw new Error(`${where}: drop= must be health or level`);
      if (p.drop === 'level') return (m) => { m.jackpot = { chance: (m.jackpot?.chance || 0) + p.chance }; };
      return (m) => { m.crumbs = m.crumbs ? { chance: m.crumbs.chance + p.chance, health: Math.max(m.crumbs.health, p.health) } : { chance: p.chance, health: p.health }; };
    },
  },
  'dodge-cap': { doc: 'Raises the most Dodge you can have to `percent`% (60% without it). Dodge cards and treasures then close their share of the gap to that higher cap.', args: ['percent'], make: ([c]) => (m) => { m.dodgeCap = Math.max(m.dodgeCap, c); } },
  'xp-reach': { doc: 'XP drifts to you from `times` as far.', args: ['times'], make: ([k]) => (m) => { m.xpReach *= k; } },
  stat: {
    doc: 'Raises a stat by `amount` (negative lowers it): bubbles, range, bubble-damage, fire-rate, health, shield, move-speed, health-regen (health a second), dodge (% chance a hit misses; each treasure closes that share of the gap to the 60% cap, so copies give less and less), luck (rarer cards and treasures), bubble-size, jump-height, tentacles (how many lash at once), tentacle-reach, tentacle-speed, tentacle-damage or burn-damage (how hard Burn hurts, 1 = as usual). `percent=#true` means % of its starting value. `no-penalty=#true` (bubbles only): those extra Attacks cost the others none of their damage.',
    args: ['name', 'amount'],
    props: { percent: false, 'no-penalty': false },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (typeof amount !== 'number') throw new Error(`stat ${name} needs a number`);
      if (p['no-penalty'] && (key !== 'bubbles' || p.percent || !(amount > 0))) throw new Error('stat: no-penalty=#true only goes with a positive whole number of bubbles (Attacks)');
      if (key === 'dodge' && !p.percent && amount > 0) return (m) => { m.stats.dodge.push(amount); };   // Dodge scales like the cards: each copy closes a share of the gap to the cap
      return (m) => { const t = p.percent ? m.stats.pct : m.stats.add; t[key] = (t[key] || 0) + amount; if (p['no-penalty']) m.freeAttacks += amount; };
    },
  },
  per: {
    doc: 'A stat grows by `amount` (a % of its starting value with percent=#true) for every `every` of `of`: max-health, move-speed-bonus (% above your starting Move speed), levels (gained this run), chests (treasures found this run) or burning-nearby (Burning bugs within 30 cm), counting at most `most` of them. Stat names as in `stat`, plus tentacle-damage. Recomputed live, so it follows the stat it reads.',
    args: ['name', 'amount'],
    props: { every: 1, of: null, percent: false, most: null },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`per: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (!PER_SOURCES.includes(p.of)) throw new Error(`per: of= must be one of ${PER_SOURCES.join(', ')}, not "${p.of}"`);
      if (!(p.every > 0)) throw new Error('per: every= must be more than 0');
      if (p.most != null && !(p.most > 0)) throw new Error('per: most= must be more than 0');
      return (m) => { m.per.push({ stat: key, amount, every: p.every, of: p.of, percent: p.percent, most: p.most }); };
    },
  },
  while: {
    doc: 'Raises a stat by `amount` (a % of its starting value with percent=#true) only while `when` holds: airborne (off the ground), low-health (under `under` of your max Health, 0.3 if not given), rooted (standing still on the ground for 1 s or more), moving (swimming at full speed), lit (inside the glow of one of your night-lights), unhurt (no hit taken for 4 s) or wet (on one of your puddles). Stat names as in `stat`.',
    args: ['when', 'name', 'amount'],
    props: { percent: false, under: 0.3 },
    make: ([when, name, amount], p) => {
      if (!WHILE_WHEN.includes(when)) throw new Error(`while: when must be one of ${WHILE_WHEN.join(', ')}, not "${when}"`);
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`while: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      return (m) => { m.whiles.push({ when, stat: key, amount, percent: p.percent, under: p.under }); };
    },
  },
  'status-damage': {
    doc: 'Hits (not damage over time) on a bug that is `status` do `more` (0.5 = 50%) extra damage, plus `per-stack` for each of its stacks. `by` names what must deal the hit (all, bubble, tentacle, splash or an Element); `elites=#true` counts Elites and the boss too, and `bugs=#false` leaves ordinary bugs out; `thaw=#true` (frozen only) shatters the ice: the hit ends the freeze. `blast` (m): the hit also bursts in a Blast that round, hurting every other bug in it for `blast-dmg` of the hit. Copies add.',
    args: ['status'],
    props: { more: 0.5, by: 'all', elites: false, bugs: true, 'per-stack': 0, thaw: false, blast: 0, 'blast-dmg': 0.5 },
    make: ([s], p) => {
      const st = status(s, 'status-damage'), b = by(p.by, 'status-damage');
      if (p.thaw && st !== 'frozen') throw new Error('status-damage: thaw=#true only goes with "frozen"');
      if (!p.bugs && !p.elites) throw new Error('status-damage: bugs=#false needs elites=#true (or it counts nothing)');
      if (!(p.blast >= 0 && p['blast-dmg'] > 0)) throw new Error('status-damage: blast= must be 0 or more and blast-dmg= above 0');
      return (m) => { m.statusDamage.push({ status: st, more: p.more, by: b, elites: p.elites, bugs: p.bugs, perStack: p['per-stack'], thaw: p.thaw, blast: p.blast, blastDmg: p['blast-dmg'] }); };
    },
  },
  'status-taken': {
    doc: 'Bugs that are `status` deal `less` (0.2 = 20%) less damage to you. Elites and the boss are exempt. Copies multiply.',
    args: ['status'],
    props: { less: 0.2 },
    make: ([s], p) => { const st = status(s, 'status-taken'); return (m) => { m.statusTaken.push({ status: st, less: p.less }); }; },
  },
  'on-kill-of': {
    doc: 'When a bug that is `status` dies (with at least `stacks` of it), or one killed by `by` (bubble, tentacle, splash or an Element; give either or both), does the effects in its { block } where it died: ring, zap, shards, brick, bubble-ring, xp, cloud, pass-stacks, heal, splash.',
    props: { status: null, by: null, stacks: 1 },
    block: TIMED_WORDS,
    make: (_, p, where, effects) => {
      if (p.status == null && p.by == null) throw new Error('on-kill-of: needs status= or by=');
      const st = p.status == null ? null : status(p.status, 'on-kill-of'), b = p.by == null ? null : by(p.by, 'on-kill-of');
      if (!(Number.isInteger(p.stacks) && p.stacks >= 1) || (p.stacks > 1 && !st)) throw new Error('on-kill-of: stacks= is a whole number, 1 or more, and goes with status=');
      return (m) => { m.killsOf.push({ status: st, by: b, stacks: p.stacks, effects }); };
    },
  },
  'nth-attack': {
    doc: 'Every `every`th attack (or, with random=#true, a random 1 in `every`) is the one in its { block } instead: big (bubbles), bolt (lightning shots) or sweep (tentacle lashes).',
    args: ['every'],
    props: { random: false },
    block: ATTACK_WORDS,
    make: ([n], p, where, effects) => {
      if (!(Number.isInteger(n) && n >= 2)) throw new Error('nth-attack: every must be a whole number, 2 or more');
      return (m) => { m.nth.push({ every: n, random: p.random, effects }); if (p.random) m.chancy = true; };
    },
  },
  'stack-buff': {
    doc: 'On each `event` (kill, hit, arc, big-splash, level-up, crit or elite-kill), a stat rises by `amount` (a % of its starting value with percent=#true) for `time` s, up to `stacks` at once; each new one restarts the time. With `extra-stacks`, copies share one buff and raise its stack cap by `extra-stacks` each. Stat names as in `stat`.',
    args: ['event', 'name', 'amount'],
    props: { time: 3, stacks: 5, percent: false, 'extra-stacks': 0 },
    make: ([event, name, amount], p, where) => {
      if (!BUFF_EVENTS.includes(event)) throw new Error(`stack-buff: event must be one of ${BUFF_EVENTS.join(', ')}, not "${event}"`);
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`stack-buff: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      const extra = p['extra-stacks'];
      if (!(p.time > 0 && Number.isInteger(p.stacks) && p.stacks >= 1 && Number.isInteger(extra) && extra >= 0)) throw new Error('stack-buff: time must be above 0, stacks a whole number 1 or more, and extra-stacks 0 or more');
      return (m, copy = 0) => {
        if (extra > 0) {
          const existing = m.buffs.find((b) => b.key === where);
          if (existing) { existing.stacks += extra; return; }
          m.buffs.push({ event, stat: key, amount, percent: p.percent, time: p.time, stacks: p.stacks, key: where });
          return;
        }
        m.buffs.push({ event, stat: key, amount, percent: p.percent, time: p.time, stacks: p.stacks, key: `${where}#${copy}` });
      };
    },
  },
  'burn-ramp': {
    doc: 'Burn grows by `step` (0.2 = 20%) for each second a bug keeps burning, up to `most` (1 = +100%). A Burn that runs out starts over. Copies add their steps.',
    args: ['step'],
    props: { most: 1 },
    make: ([n], p) => {
      if (!(n > 0 && p.most > 0)) throw new Error('burn-ramp: step and most= must be above 0');
      return (m) => { m.burnRamp = m.burnRamp ? { step: m.burnRamp.step + n, most: Math.max(m.burnRamp.most, p.most) } : { step: n, most: p.most }; };
    },
  },
  'refresh-all': {
    doc: 'A hit by your attack on a bug that is `status` (burning) refreshes that status on every bug that has it, to its full time.',
    args: ['status'],
    make: ([s]) => { if (s !== 'burning') throw new Error(`refresh-all: status must be burning, not "${s}"`); return (m) => { if (!m.refreshAll.includes(s)) m.refreshAll.push(s); }; },
  },
  streak: {
    doc: 'When `kills` bugs die within `within` s of each other (only ones that are `status`, if given), does the effects in its { block } around you, then counts again from none.',
    args: ['kills'],
    props: { within: 3, status: null },
    block: TIMED_WORDS,
    make: ([n], p, where, effects) => {
      if (!(Number.isInteger(n) && n >= 2 && p.within > 0)) throw new Error('streak: kills must be a whole number, 2 or more, and within= above 0');
      const st = p.status == null ? null : status(p.status, 'streak');
      return (m, copy = 0) => { m.streaks.push({ kills: n, within: p.within, status: st, effects, key: `${where}#${copy}` }); };
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
  stomp: { doc: 'Falling onto a bug (after a drop of at least `drop` m from the top of the jump, its middle within `reach` m of touching sideways) stomps it for `dmg` x Attack damage, `step` x more for each stomp in a row before you touch the ground (at most `most` x), Stuns an ordinary bug for `stun` s and bounces you back up at jump speed with your mid-air jumps back, safe from bugs for `safe` s (never from Elites or the boss). A bounce is not a landing.', props: { dmg: 4, step: 1, most: 8, stun: 1, safe: 0.3, reach: 0.02, drop: 0.03 }, make: (_, p) => (m) => { m.stomp = { ...p }; } },
  swat: { doc: 'Your attacks swat bug Shots (pushpins, web balls) out of the air: a bubble, Element shot or gust in flight within `reach` m of one, a Glitter or Poison burst round it, or a tentacle lash with it in reach. The swatted Shot flies back at the bug that fired it (else the nearest bug within 30 cm, else it pops) at 1.5x its speed for `back` x Attack damage, and can no longer hurt you. Elite and Boss Shots are not swatted.', props: { back: 3, reach: 0.02 }, make: (_, p) => {
    if (!(p.back > 0 && p.reach >= 0)) throw new Error('swat: back must be above 0 and reach 0 or more');
    return (m) => { m.swat = { ...p }; };
  } },
  'elite-bonus': { doc: 'Every `every`th Elite you beat leaves a second treasure beside the first (the count runs from when you take it, across acts).', props: { every: 2 }, make: (_, p) => (m) => { m.eliteBonus = { every: p.every }; } },
  'more-treasures': { doc: 'Each treasure that turns up in the room on the schedule has a `percent`% chance to bring another one, a little after it goes (so about `percent`% more treasures). Copies add.', args: ['percent'], make: ([n]) => (m) => { m.moreTreasures += n / 100; } },
  'elite-damage': { doc: 'Everything you do hurts Elites and the boss `percent`% more. Copies add.', args: ['percent'], make: ([n]) => (m) => { m.eliteDamage += n / 100; } },
  'bug-speed': { doc: 'Bugs move at `times` their speed (not elites or the boss).', args: ['times'], make: ([k]) => (m) => { m.bugSpeed *= k; } },
  execute: { doc: 'A hit that leaves an ordinary bug under `under` (0.15 = 15%) of its max Health finishes it off; an Elite goes under `elites` (0 for never). Never the boss. Copies take the biggest.', props: { under: 0.15, elites: 0.08 }, make: (_, p) => (m) => { m.execute = { under: Math.max(m.execute?.under || 0, p.under), elites: Math.max(m.execute?.elites || 0, p.elites) }; } },
  'fresh-damage': { doc: 'Hits (not damage over time) on anything above `above` (0.9 = 90%) of its max Health do `percent`% more. Copies add.', args: ['percent'], props: { above: 0.9 }, make: ([n], p) => (m) => { m.freshMore += n / 100; m.freshAbove = p.above; } },
  'hit-less': { doc: 'Every hit on you takes `amount` less Health, but never less than `least` (a hit already under it is left as it is). Bleed and puddles are not hits. Copies add.', args: ['amount'], props: { least: 0.5 }, make: ([n], p) => (m) => { m.hitLess += n; m.hitLeast = p.least; } },
  'boss-levels': { doc: 'When an act\'s boss falls, `count` of your Treasures that have levels to go (picked at random) go up a level. Copies add.', args: ['count'], make: ([n]) => (m) => { m.bossLevels += n; } },
  spotlight: { doc: 'A disco ball hangs over you; every `every` s its spotlight picks the toughest bug within `range` m (an Elite or the boss first) and follows it for `time` s: everything you do hurts it `more` (1 = 100%) more.', props: { every: 4, time: 4, more: 1, range: 0.4 }, make: (_, p) => (m) => { m.spotlight = { ...p }; } },
  'night-light': { doc: 'Each Level-up plugs in a night-light on the floor where you are, glowing `radius` m round it, for the rest of the act; at most `most` at once (a new one unplugs the oldest). With safe=#true ordinary bugs won\'t walk into its glow (Elites, the boss and shots still reach in). Pair it with `while "lit"`.', props: { radius: 0.4, most: 3, safe: false }, make: (_, p) => (m) => { m.nightLight = { ...p }; } },
  bounty: { doc: 'Every `every` s, if no bug has one, an ordinary bug at least `far` m from you (the farthest, if none is) gets a gold target; clearing it raises a stat (names as in `stat`) by `amount` for the rest of the run.', args: ['name', 'amount'], props: { every: 20, far: 0.4 },
    make: ([name, amount], p) => {
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`bounty: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      return (m) => { m.bounty = { every: p.every, far: p.far, stat: key, amount: (m.bounty?.amount || 0) + amount }; };
    } },
  ghosts: { doc: '`chance` that a bug you clear rises as a glowing ghost for `time` s: it flies (`speed` m/s) at the nearest bug, slams it for `dmg` times your power, bounces off and goes again after `rest` s. At most `most` at once. Copies add their chances.', props: { chance: 0.1, time: 8, dmg: 0.6, speed: 0.5, rest: 0.5, most: 5 }, make: (_, p) => (m) => { m.ghosts = { ...p, chance: (m.ghosts?.chance || 0) + p.chance }; } },
  'more-bugs': { doc: '`times` as many bugs come out of the vents (the cap on bugs at once grows too).', args: ['times'], make: ([k]) => (m) => { m.moreBugs *= k; } },
  every: {
    doc: 'Every `seconds` (the first time after `first` s, 60% of the period by default), does the effects in its { block }: ring, zap, shards, brick, marble, cone, grab, reach-flare, orb, xp, whirl, next-attack, turret.',
    args: ['seconds'],
    props: { first: null },
    block: TIMED_WORDS,
    make: ([s], p, where, effects) => (m, copy = 0) => { m.timed.push({ every: s, first: p.first ?? s * 0.6, effects, key: `${where}#${copy}` }); },
  },
  'orbit-lights': { doc: '`count` little bulbs circle you `radius` m out and sting whatever they touch for `dmg` (each enemy at most every 0.4 s).', args: ['count'], props: { radius: 0.07, dmg: 0.6 }, make: ([n], p) => (m) => { m.orbit = { count: n, ...p }; } },
  beam: { doc: 'A beam burns the nearest enemy within `range` m for `dmg` every `tick` s.', props: { range: 0.35, dmg: 0.3, tick: 0.25 }, make: (_, p) => (m) => { m.beam = p; } },
  aura: { doc: 'A glow of `radius` m around you stings everything inside for `dmg` every `tick` s. With `grow` (s) it starts at `min` m and grows to `radius` over `grow` s of swimming flat out, shrinking back as fast when you stop; its sting scales with its size.', args: ['radius'], props: { dmg: 0.4, tick: 0.5, grow: 0, min: 0 }, make: ([r], p) => (m) => { m.aura = { radius: r, ...p }; } },
  // --- Ice jelly (P8a)
  'chill-to-freeze': {
    doc: 'Your Ice attack hitting one Chilled bug `hits` times in a row freezes it solid for `time` s (bugs only: Elites and the boss are not frozen). The count starts over when the Chill runs out or the bug freezes.',
    args: ['hits'],
    props: { time: 1.5 },
    make: ([n], p) => {
      if (!(Number.isInteger(n) && n >= 2 && p.time > 0)) throw new Error('chill-to-freeze: hits must be a whole number, 2 or more, and time= above 0');
      return (m) => { m.chillFreeze = { hits: n, time: p.time }; };
    },
  },
  'ground-lock': {
    doc: 'A bug that is `status` can\'t jump, fly up or climb: it cannot start a leap, rises no higher in the air, and a step that would take a walking bug uphill does not happen.',
    args: ['status'],
    make: ([s]) => { const st = status(s, 'ground-lock'); return (m) => { if (!m.groundLock.includes(st)) m.groundLock.push(st); }; },
  },
  'slide-on-hit': {
    doc: 'A hit on a bug that is `status` shoves it `distance` m along the hit, and every other bug it slides into is Chilled for `chill` s (the bug itself stays as it was).',
    args: ['status'],
    props: { distance: 0.12, chill: 2 },
    make: ([s], p) => {
      const st = status(s, 'slide-on-hit');
      if (!(p.distance > 0 && p.chill > 0)) throw new Error('slide-on-hit: distance and chill must be above 0');
      return (m) => { m.slideOnHit.push({ status: st, distance: p.distance, chill: p.chill }); };
    },
  },
  // --- Poison's Attack upgrades (P8c)
  'percent-dot': {
    doc: 'Bugs that are `status` lose `share` (0.01 = 1%) of their max Health a second, Elites too; `boss=#true` counts the boss as well. Copies add.',
    args: ['status'],
    props: { share: 0.01, boss: false },
    make: ([s], p) => {
      const st = status(s, 'percent-dot');
      if (!(p.share > 0 && p.share < 1)) throw new Error('percent-dot: share must be between 0 and 1');
      return (m) => { m.percentDots.push({ status: st, share: p.share, boss: p.boss }); };
    },
  },
  'spread-on-touch': {
    doc: 'A bug touching one that is `status` (poisoned) and isn\'t itself gets 1 stack of it (checked every 0.5 s).',
    args: ['status'],
    make: ([s]) => { if (s !== 'poisoned') throw new Error(`spread-on-touch: status must be poisoned, not "${s}"`); return (m) => { if (!m.spreadOnTouch.includes(s)) m.spreadOnTouch.push(s); }; },
  },
  'split-on-hit': {
    doc: 'A shot that hits a bug splits into `count` smaller ones, fanned `angle`° apart, that fly on from there (missing that bug) and pop on their own, each `dmg` times its damage; a split never splits again.',
    args: ['count'],
    props: { dmg: 0.5, angle: 40 },
    make: ([n], p) => {
      if (!(Number.isInteger(n) && n >= 1 && p.dmg > 0 && p.angle >= 0)) throw new Error('split-on-hit: count must be a whole number, 1 or more, dmg above 0 and angle 0 or more');
      return (m) => { m.split = { count: n, dmg: p.dmg, angle: p.angle }; };
    },
  },

  // --- Glitter's Attack upgrades (P8e)
  'random-status': {
    doc: 'Each glitter bomb rolls one of `statuses` (any of burning, chilled, stunned, slowed) and gives it for `time` s to every bug its burst reaches; its burst shows in that colour.',
    props: { statuses: 'burning chilled stunned', time: 1.5 },
    make: (_, p) => {
      const list = String(p.statuses).split(/\s+/).filter(Boolean);
      if (!list.length || list.some((s) => !RANDOM_STATUSES.includes(s))) throw new Error(`random-status: statuses must be some of ${RANDOM_STATUSES.join(', ')}`);
      if (!(p.time > 0)) throw new Error('random-status: time must be above 0');
      return (m) => { m.randomStatus = { statuses: list, time: p.time }; };
    },
  },
  gild: {
    doc: '`chance` that a bug a glitter burst splashes turns to gold (never an Elite or the boss): held still and shining for `time` s, then it bursts into `bombs` small glitter bombs at the bugs nearest it, each half a bomb.',
    props: { chance: 0.05, time: 3, bombs: 5 },
    make: (_, p) => {
      if (!(p.chance > 0 && p.chance <= 1 && p.time > 0 && Number.isInteger(p.bombs) && p.bombs >= 1)) throw new Error('gild: chance must be above 0 (at most 1), time above 0 and bombs a whole number, 1 or more');
      return (m) => { m.gild = { ...p }; };
    },
  },
  'splash-reflect': { doc: 'A glitter burst that reaches a wall goes off once more, thrown back off it: a second burst one radius back out from the wall, hurting bugs the first missed.', make: () => (m) => { m.splashReflect = true; } },
  wish: {
    doc: 'Once each act, a single splash that kills `kills` bugs or more gives you a free level-up.',
    args: ['kills'],
    make: ([n]) => {
      if (!(Number.isInteger(n) && n >= 3)) throw new Error('wish: kills must be a whole number, 3 or more');
      return (m) => { m.wish = { kills: n }; };
    },
  },
  'splash-shots': {
    doc: 'A glitter burst that reaches `min` bugs or more fires a shot from its middle at each of them (at most `count`, 0 = all), each `dmg` times the bomb\'s hit.',
    props: { min: 5, dmg: 0.5, count: 0 },
    make: (_, p) => {
      if (!(Number.isInteger(p.min) && p.min >= 1 && p.dmg > 0 && Number.isInteger(p.count) && p.count >= 0)) throw new Error('splash-shots: min must be a whole number, 1 or more, dmg above 0 and count a whole number, 0 or more');
      return (m) => { m.splashShots.push({ min: p.min, count: p.count, dmg: p.dmg }); };
    },
  },
  // --- Wind's Attack upgrades (P8d)
  'pushed-hits': {
    doc: 'A bug your gust shoves hits every bug in its way as it slides: each takes the same damage as the shoved one took, once per shoved bug. Not Elites or the boss.',
    make: () => (m) => { m.pushedHits = true; },
  },
  glide: {
    doc: 'Hold jump in the air while falling to drift down at `fall` (0.2 = 20%) of the usual fall speed; gusts blown while you drift push `push` times as far.',
    props: { fall: 0.2, push: 2 },
    make: (_, p) => {
      if (!(p.fall > 0 && p.fall <= 1 && p.push >= 1)) throw new Error('glide: fall must be above 0 and at most 1, push 1 or more');
      return (m) => { m.glide = { fall: p.fall, push: p.push }; };
    },
  },
  'trap-on-hit': {
    doc: 'Each hit has `chance` to trap an ordinary bug in a bubble that holds it still (it can\'t move) for `time` s, then bursts. Elites and the boss are too big to trap.',
    props: { chance: 0.125, time: 1.5 },
    make: (_, p) => {
      if (!(p.chance > 0 && p.chance <= 1 && p.time > 0)) throw new Error('trap-on-hit: chance must be above 0 and at most 1, and time above 0');
      return (m) => { m.trap = m.trap ? { chance: Math.min(1, m.trap.chance + p.chance), time: Math.max(m.trap.time, p.time) } : { chance: p.chance, time: p.time }; };
    },
  },
  homing: {
    doc: 'Bubbles curve toward the nearest bug within `reach` m of them, turning up to `turn` radians a second.',
    args: ['turn'],
    props: { reach: 0.1 },
    make: ([turn], p) => {
      if (!(turn > 0 && p.reach > 0)) throw new Error('homing: turn and reach= must be above 0');
      return (m) => { m.homing = { turn: Math.max(m.homing?.turn ?? 0, turn), reach: Math.max(m.homing?.reach ?? 0, p.reach) }; };
    },
  },
  'pop-chain': {
    doc: 'A bubble that pops on a bug also pops every other bubble within `range` m of it, in a splash that hurts each bug for `dmg` times that bubble\'s damage; those pop the bubbles next to them in turn.',
    args: ['dmg'],
    props: { range: 0.04 },
    make: ([dmg], p) => {
      if (!(dmg > 0 && p.range > 0)) throw new Error('pop-chain: dmg and range= must be above 0');
      return (m) => { m.popChain = { dmg, range: p.range }; };
    },
  },
  wobble: {
    doc: 'Bubbles zigzag side to side as they fly, swinging `width` m either side of their line, brushing the bugs along it. `rate` is how fast, in radians a second.',
    args: ['width'],
    props: { rate: 9 },
    make: ([width], p) => {
      if (!(width > 0 && p.rate > 0)) throw new Error('wobble: width and rate= must be above 0');
      return (m) => { m.wobble = { width: Math.max(m.wobble?.width ?? 0, width), rate: p.rate }; };
    },
  },
  'focus-ramp': {
    doc: 'Each hit in a row on the same bug does `step` (0.1 = 10%) more than the one before, up to `most` more. Hitting another bug starts over.',
    args: ['step'],
    props: { most: 0.5 },
    make: ([step], p) => {
      if (!(step > 0 && p.most >= step)) throw new Error('focus-ramp: step must be above 0 and most= at least step');
      return (m) => { m.focusRamp = { step, most: p.most }; };
    },
  },
  'range-pop': {
    doc: 'A bubble that flies to the end of its Range without hitting anything pops in a splash `splash` times as wide as usual.',
    args: ['splash'],
    make: ([splash]) => {
      if (!(splash > 1)) throw new Error('range-pop: splash must be more than 1');
      return (m) => { m.rangePop = { splash: Math.max(m.rangePop?.splash ?? 0, splash) }; };
    },
  },
  'orbit-misses': {
    doc: 'A bubble that reaches the end of its Range without popping circles you once, at that distance, hitting the bugs it touches, then pops.',
    make: () => (m) => { m.orbitMisses = true; },
  },
  // Lightning jelly (P8b)
  'touch-zap': {
    doc: 'A bug touching you (within `reach` m of your body) is zapped for `dmg` (x your power) and Stunned for `stun` s, once every `each` s per bug. Elites and the boss take the zap but not the Stun.',
    props: { dmg: 0.6, stun: 1, each: 2, reach: 0.02 },
    make: (_, p) => {
      if (!(p.dmg >= 0 && p.stun > 0 && p.each > 0)) throw new Error('touch-zap: stun and each must be above 0');
      return (m) => { m.touchZap = { ...p }; };
    },
  },
  // Newton's Cradle
  overkill: {
    doc: 'When a hit of yours finishes off a bug, the damage left over (at least `least`) passes to the nearest bug within `reach` m of it, `passes` times at most. Not from Burn, Poison or Bleed, an execute, or an Elite or the boss.',
    props: { reach: 0.12, passes: 3, least: 1 },
    make: (_, p) => {
      if (!(p.reach > 0 && Number.isInteger(p.passes) && p.passes >= 1 && p.least > 0)) throw new Error('overkill: reach and least must be above 0, and passes a whole number of 1 or more');
      return (m) => { m.overkill = { ...p }; };
    },
  },
  'charged-shot': {
    doc: 'Hold `when` ("rooted": standing still on the ground, or "moving": swimming at full speed) for `seconds` and your next lightning shot is charged: it also strikes every bug within `strike` m of where it lands for `dmg` times its damage, and arcs to `chain` more bugs. Then it starts again from none.',
    args: ['when', 'seconds'],
    props: { strike: 0, chain: 0, dmg: 2 },
    make: ([when, seconds], p, where) => {
      if (!['rooted', 'moving'].includes(when)) throw new Error(`charged-shot: when must be rooted or moving, not "${when}"`);
      if (!(seconds > 0 && p.strike >= 0 && Number.isInteger(p.chain) && p.chain >= 0 && p.dmg > 0 && (p.strike > 0 || p.chain > 0))) throw new Error('charged-shot: seconds must be above 0, and it needs strike= or chain=');
      return (m, copy = 0) => { m.charged.push({ when, time: seconds, strike: p.strike, chain: p.chain, dmg: p.dmg, key: `${where}#${copy}` }); };
    },
  },
  'lucky-rolls': {
    doc: 'Every chance of yours that rolls through chance.js (crit, trap-on-hit, ghosts, life steal...) gets `rolls` tries in all, and any one hitting counts. Never Dodge or Rarity.',
    args: ['rolls'],
    make: ([n]) => {
      if (!(Number.isInteger(n) && n >= 2)) throw new Error('lucky-rolls: rolls must be a whole number, 2 or more');
      return (m) => { m.luckyRolls = Math.max(m.luckyRolls, n); };
    },
  },
  'heal-on-crit': {
    doc: 'Each Crit gives back `health` Health. Copies add.',
    args: ['health'],
    make: ([n]) => {
      if (!(n > 0)) throw new Error('heal-on-crit: health must be above 0');
      return (m) => { m.healOnCrit += n; };
    },
  },
  'crit-damage': {
    doc: 'Adds `extra` (1 = +100%) to your Crit damage multiplier. Copies add.',
    args: ['extra'],
    make: ([n]) => {
      if (!(n > 0)) throw new Error('crit-damage: extra must be above 0');
      return (m) => { m.critBonus += n; };
    },
  },
  'regen-mult': {
    doc: 'Multiplies all Health healing, Health regen and Shield refill speed by `times`. Copies multiply.',
    args: ['times'],
    make: ([k]) => {
      if (!(k > 0)) throw new Error('regen-mult: times must be above 0');
      return (m) => { m.regenMult *= k; };
    },
  },
  'close-damage': {
    doc: 'Hits (not damage over time) on anything within `range` m of you do `percent`% more damage. Copies add.',
    args: ['percent'],
    props: { range: 0.14 },
    make: ([n], p) => {
      if (!(n > 0 && p.range > 0)) throw new Error('close-damage: percent and range must be above 0');
      return (m) => { m.closeMore += n / 100; m.closeRange = Math.max(m.closeRange, p.range); };
    },
  },
  'bleed-on-hit': {
    doc: '`chance` that a hit adds a Bleed stack (at most `stacks`): each stack deals `dmg` times your Attack damage over `time` s, and a new stack refreshes the time. Copies add their chances.',
    props: { chance: 0.1, dmg: 2.4, time: 5, stacks: 5 },
    make: (_, p) => {
      if (!(p.chance > 0 && p.chance <= 1 && p.dmg > 0 && p.time > 0 && Number.isInteger(p.stacks) && p.stacks >= 1)) throw new Error('bleed-on-hit: chance must be in (0, 1], dmg and time above 0, and stacks a whole number of 1 or more');
      return (m) => {
        const b = m.bleedOnHit;
        m.bleedOnHit = b ? { ...b, chance: Math.min(1, b.chance + p.chance), dmg: Math.max(b.dmg, p.dmg), time: Math.max(b.time, p.time), stacks: Math.max(b.stacks, p.stacks) } : { ...p };
      };
    },
  },
  'first-treasure-bonus': {
    doc: 'Once each act, the first Treasure you open offers `count` more pick straight after. Copies add.',
    args: ['count'],
    make: ([n]) => {
      if (!(Number.isInteger(n) && n >= 1)) throw new Error('first-treasure-bonus: count must be a whole number, 1 or more');
      return (m) => { m.firstTreasureBonus += n; };
    },
  },
  'elite-jump': {
    doc: 'After defeating an Elite, you gain +`jumps` mid-air jump for `time` s. Copies take the biggest.',
    args: ['jumps'],
    props: { time: 30 },
    make: ([n], p) => {
      if (!(Number.isInteger(n) && n >= 1 && p.time > 0)) throw new Error('elite-jump: jumps must be a whole number of 1 or more and time above 0');
      return (m) => {
        const e = m.eliteJump;
        m.eliteJump = e ? { jumps: Math.max(e.jumps, n), time: Math.max(e.time, p.time) } : { jumps: n, time: p.time };
      };
    },
  },
  'still-heal': {
    doc: 'After standing still on the ground for `wait` s, a floor zone of `radius` m opens under you and heals `share` (0.05 = 5%) of your max Health a second while you stay in it. Extra copies add `per-stack`.',
    args: ['share'],
    props: { 'per-stack': 0.025, wait: 1, radius: 0.12 },
    make: ([share], p) => {
      if (!(share > 0 && p['per-stack'] >= 0 && p.wait > 0 && p.radius > 0)) throw new Error('still-heal: share, wait and radius must be above 0, and per-stack 0 or more');
      return (m) => {
        const s = m.stillHeal;
        m.stillHeal = s ? { ...s, share: s.share + p['per-stack'], radius: Math.max(s.radius, p.radius) } : { share, perStack: p['per-stack'], wait: p.wait, radius: p.radius };
      };
    },
  },
  'bomb-on-hit': {
    doc: '`chance` that a hit attaches a bomb to the bug; after `fuse` s (or when it dies) it blasts bugs within `radius` m for `dmg` times your Attack damage. Copies add their chances.',
    props: { chance: 0.05, dmg: 1.8, fuse: 1.5, radius: 0.09 },
    make: (_, p) => {
      if (!(p.chance > 0 && p.chance <= 1 && p.dmg > 0 && p.fuse > 0 && p.radius > 0)) throw new Error('bomb-on-hit: chance must be in (0, 1], and dmg, fuse and radius above 0');
      return (m) => {
        const b = m.bombOnHit;
        m.bombOnHit = b ? { ...b, chance: Math.min(1, b.chance + p.chance), dmg: Math.max(b.dmg, p.dmg), radius: Math.max(b.radius, p.radius) } : { ...p };
      };
    },
  },
  'missile-on-hit': {
    doc: '`chance` that a hit fires a homing rocket at `speed` m/s (turning up to `turn` rad/s for `life` s) for `dmg` times your Attack damage. Copies add their damage.',
    props: { chance: 0.1, dmg: 2.5, speed: 0.65, turn: 8, life: 2.5 },
    make: (_, p) => {
      if (!(p.chance > 0 && p.chance <= 1 && p.dmg > 0 && p.speed > 0 && p.turn > 0 && p.life > 0)) throw new Error('missile-on-hit: chance must be in (0, 1], and dmg, speed, turn and life above 0');
      return (m) => {
        const r = m.missileOnHit;
        m.missileOnHit = r ? { ...r, chance: Math.max(r.chance, p.chance), dmg: r.dmg + p.dmg } : { ...p };
      };
    },
  },
  'cooldown-scale': {
    doc: 'Multiplies every Treasure cooldown and timer period by `scale` (0.75 = 25% shorter). Copies multiply.',
    args: ['scale'],
    make: ([s]) => {
      if (!(s > 0 && s <= 1)) throw new Error('cooldown-scale: scale must be in (0, 1]');
      return (m) => { m.cooldownScale *= s; };
    },
  },
};

// the words whose chance rolls through chance.js: owning one lets a needs-chance treasure be offered
for (const k of ['crit', 'zap-on-pop', 'on-attack', 'heal-on-hit', 'leave-on-kill', 'crumb-on-kill', 'ghosts', 'gild', 'trap-on-hit', 'bleed-on-hit', 'bomb-on-hit', 'missile-on-hit']) {
  const w = TREASURE_WORDS[k], make = w.make;
  w.make = (...a) => { const apply = make(...a); return (m, copy) => { apply(m, copy); m.chancy = true; }; };
}
