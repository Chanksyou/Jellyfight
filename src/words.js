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
// and add a story (src/stories/<area>.js) that proves it.
import * as THREE from 'three';

const _away = new THREE.Vector3(), _spot = new THREE.Vector3(), _want = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const ENEMY_WORDS = {
  'death-motion': {
    doc: 'On death, leaves a harmless body that `style` animates: crumple, flutter or shell. Rewards and removal from combat are immediate.',
    args: ['style'],
    make: ([style]) => {
      if (!['crumple', 'flutter', 'shell'].includes(style)) throw new Error('death-motion style must be crumple, flutter or shell');
      return { init(e) { e.deathMotion = style; } };
    },
  },
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
            if (c.flat < p.range && e.grounded && e.leapCd <= 0 && !e.groundLocked) { e.state = 'crouch'; e.stateT = p.windup; target(e, c); }
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
    doc: 'Flies `distance` m from you and `above` m higher, circling round you at `circle` radians a second, at up to `speed` m/s.',
    args: ['distance'],
    props: { above: 0.07, speed: 0.33, circle: 0.4 },
    make: ([distance], p) => ({
      fly: true,
      tick(e, c, en) {
        if (e.flyHeld) return;              // another word is holding it still (a poke)
        const away = _away.copy(e.pos).sub(c.pc).setY(0);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize().applyAxisAngle(UP, c.dt * p.circle);
        const to = _spot.copy(c.pc).addScaledVector(away, distance).setY(c.pc.y + p.above).sub(e.pos);
        const s = p.speed * c.slow;
        e.vel.lerp(to.clampLength(0, 1).multiplyScalar(s * 6).clampLength(0, s), 1 - Math.exp(-3 * c.dt));
        en.move(e, e.vel, c.dt);
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
          en.move(e, e.vel, c.dt);
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
    doc: 'Every `every` s, if you are within `reach` m, shoots at you: `count` shots fanned across `spread` degrees (`speed` m/s, last `life` s, `dmg` damage each), from `height` radii above its middle. `shot` is "web" (a ball of silk) or "pin" (a pushpin spinning on its long axis, no beam: the wind-up is the warning; it sticks where it hits the scenery). `still` stands still while it aims and throws. `arc` (m/s²) lobs it so it falls onto where you were; `slow` s of slowed swimming when it hits you. For `aim` s first it winds up; the aim locks halfway through, so moving off the line dodges.',
    props: { every: 2.4, reach: 0.45, speed: 0.48, life: 1.47, dmg: 1, aim: 0.35, count: 1, spread: 0, shot: 'web', height: 0, arc: 0, slow: 0, still: false },
    make: (_, p, where) => {
      if (!['web', 'pin'].includes(p.shot)) throw new Error(`${where}: shot= must be "web" or "pin", not "${p.shot}"`);
      return {
      init(e) { e.shootT = 1 + Math.random() * 1.5; e.aimT = 0; },
      tick(e, c, en) {
        e.shootT -= c.dt * (c.slow > 0 ? 1 : 0);
        e.aimT = Math.max(0, e.aimT - c.dt);
        if (e.shootT <= p.aim && e.aimT <= 0 && e.shootT > 0 && c.dist < p.reach) e.aimT = e.aimMax = p.aim;
        // the aim locks on half way through the warning, so the line shows where it will really go
        if (e.aimT > p.aim * 0.5) (e.aimAt ||= new THREE.Vector3()).copy(c.pc);
        if (e.shootT <= 0 && c.dist < p.reach) { e.shootT = p.every; en.spit(e, e.aimAt || c.pc, p); e.aimAt = null; e.aimT = 0; e.firedT = 0.25; }
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
          if (e.state === 'charge') en.breakCharge(e);   // (its flyHeld is the dodge's now)
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

  'charge-beam': {
    doc: 'Within `range` m every `every` s or so, turns to face you and holds perfectly still for `charge` s while a whine builds (the only warning: nothing shows), then fires a beam that hits instantly along the way it faced, `reach` m long: `dmg` if any of you is within `width` m of it. Move off the line while it charges. Freezing or stunning it breaks the charge off. List it after the flying word.',
    props: { range: 0.45, charge: 2, dmg: 3, reach: 0.8, width: 0.008, every: 3.5, rest: 0.4 },
    make: (_, p) => ({
      init(e) { e.beamCd = 1.5 + Math.random() * 1.5; e.beamDir = new THREE.Vector3(); },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.beamCd -= c.dt;
        if (e.state === 'charge' && !live) { en.breakCharge(e); e.flyHeld = false; }   // frozen or stunned: the charge is lost
        if (e.state === 'approach') {
          if (c.dist < p.range && e.beamCd <= 0 && live && !e.flyHeld) {
            e.state = 'charge'; e.stateT = e.chargeMax = p.charge; e.flyHeld = true; e.faceLock = true;
            e.vel.set(0, 0, 0);
            e.beamDir.copy(c.toP).normalize();                         // it aims where it faces, and doesn't turn again
            e.root.rotation.y = Math.atan2(c.toP.x, c.toP.z);
            en.beamCharge(e, p.charge);
          }
        } else if (e.state === 'charge') {
          e.vel.set(0, 0, 0);
          if (e.stateT <= 0) { en.beam(e, c, p); e.state = 'rest'; e.stateT = p.rest; e.firedT = 0.2; }
        } else if (e.state === 'rest' && e.stateT <= 0) {
          e.state = 'approach'; e.flyHeld = false; e.faceLock = false; e.beamCd = p.every;
        }
        if (e.firedT > 0) e.firedT -= c.dt;
      },
    }),
  },

  swat: {
    doc: 'Up close (within `range` m) every `every` s or so, rears up with its forelegs raised and opened for `windup` s (nothing shows on the floor: the rearing up is the warning; the aim locks halfway through), then lunges and snaps them shut, sweeping `arc` degrees across and `reach` m out: `dmg` if you are in that wedge. It rests `rest` s. List it after the walking word.',
    props: { range: 0.16, windup: 0.55, reach: 0.19, arc: 80, dmg: 3, rest: 0.8, every: 1.6 },
    make: (_, p) => ({
      init(e) { e.swatCd = 0.8 + Math.random(); e.swatDir = new THREE.Vector3(0, 0, 1); },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.swatCd -= c.dt;
        if (e.state === 'approach') {
          if (c.flat < p.range && e.grounded && e.swatCd <= 0 && live) { e.state = 'windup'; e.stateT = e.swatMax = p.windup; e.swatDir.copy(c.flatDir); }
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

  'charge-shot': {
    doc: 'Within `range` m every `every` s or so, stops, turns to you and charges a ball between its jaws for `charge` s (it grows, crackling; the aim locks `lock` of the way through, so stepping aside after that dodges), then fires it at your middle: a Shot `size` m across at `speed` m/s for up to `life` s. It explodes on whatever it meets (you, furniture, the floor, or the end of its flight): a Blast `blast` m round, `dmg` and a `knock` shove to anything of you inside it. It rests `rest` s. Freezing or stunning it breaks the charge off. List it after the walking word.',
    props: { range: 0.6, charge: 1, lock: 0.6, speed: 1.2, dmg: 3, size: 0.011, blast: 0.05, knock: 0.5, life: 1.2, rest: 0.7, every: 3.5 },
    make: (_, p) => ({
      init(e) { e.shotCd = 1 + Math.random() * 1.5; e.shotDir = new THREE.Vector3(0, 0, 1); e.shotAt = new THREE.Vector3(); e.ballK = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.shotCd -= c.dt;
        if (e.state === 'charge' && !live) { en.breakSpark(e); e.state = 'approach'; e.faceLock = false; e.ballK = 0; e.shotCd = 1.5; }
        if (e.state === 'approach') {
          if (c.dist < p.range && e.shotCd <= 0 && live) {
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
          if (flat < p.range && e.whipCd <= 0 && live) { e.state = 'windup'; e.stateT = e.whipMax = p.windup; aim(); }
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
        if ((e.broodT -= c.dt) > 0) return;
        e.broodT = p.every;
        let mine = 0;
        for (const x of en.list) if (!x.dead && x.motherId === e.id) mine++;
        if (mine >= p.max) return;
        const child = en.spawn(what, (e.emergeAt || e.pos).clone(), e.maxHp / e.T.hp);
        child.motherId = e.id;
        e.hatchedT = 1;
        en.hatch(e, child);
      },
    }),
  },

  dive: {
    doc: 'Within `range` m every `every` s or so, stops and rears for `windup` s (a rising buzz), then nosedives at where you were when it set off, at `speed` m/s for up to `reach` m: if it reaches you it stings for `dmg` and dies doing it. If it misses (or hits a wall) it pulls up, rests `rest` s and goes back to circling. List it after the flying word.',
    props: { range: 0.35, every: 3, windup: 0.5, speed: 1.4, reach: 0.6, dmg: 6, rest: 0.6 },
    make: (_, p) => ({
      init(e) { e.diveCd = 1 + Math.random() * 1.5; e.diveDir = new THREE.Vector3(); },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;
        e.stateT -= c.dt * live;
        e.diveCd -= c.dt;
        if (e.state === 'approach') {
          if (c.dist < p.range && e.diveCd <= 0 && live && !e.flyHeld) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; e.faceLock = true; en.diveWind(e, p.windup); }
        } else if (e.state === 'windup') {
          e.vel.multiplyScalar(Math.exp(-10 * c.dt));
          en.move(e, e.vel, c.dt * live);
          e.root.rotation.y = Math.atan2(c.toP.x, c.toP.z);
          if (e.stateT <= 0) { e.state = 'dive'; e.diveLeft = p.reach; e.diveDir.copy(c.toP).normalize(); en.diveGo(e); }   // it aims where you are now, and doesn't turn again
        } else if (e.state === 'dive') {
          if (!live) return;
          const step = Math.min(e.diveLeft, p.speed * c.dt);
          const wall = en.world.cast(e.pos, e.diveDir, step + e.r * 0.5);
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

  bite: {
    doc: 'Up close (within `range` m) every `every` s or so, stops and draws back for `windup` s (its whine climbing; the aim locks halfway through), then darts at you at `speed` m/s for up to `reach` m: if it reaches you it bites for `dmg` and bounces off. Hit or miss, it backs off, rests `rest` s and goes back to flying. List it after the flying word.',
    props: { range: 0.25, every: 1.6, windup: 0.35, speed: 1.6, reach: 0.4, dmg: 1, rest: 0.5 },
    make: (_, p) => ({
      init(e) { e.biteCd = 0.8 + Math.random(); e.biteDir = new THREE.Vector3(); e.biteK = 0; },
      tick(e, c, en) {
        const live = c.slow > 0 ? 1 : 0;   // frozen or stunned: it stays put
        e.stateT -= c.dt * live;
        e.biteCd -= c.dt;
        if (e.state === 'approach') {
          if (c.dist < p.range && e.biteCd <= 0 && live && !e.flyHeld) { e.state = 'windup'; e.stateT = p.windup; e.flyHeld = true; en.biteWind(e, p.windup); }
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
          const wall = en.world.cast(e.pos, e.biteDir, step + e.r * 0.5);
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
    elements: new Set(),
    element: {},                     // element -> its attack's numbers (ELEMENT_BASE, raised by element-up)
    hits: { bubbles: { mark: 0, markMore: 0, crit: null, pin: 0 }, tentacles: { mark: 0, markMore: 0, crit: null, pin: 0, venom: null, echo: null, edge: null, coil: null } },
    popZap: null,
    mouse: null,                     // toy-mouse: { every, dmg, speed, size, splash, push }
    reflect: null,                   // reflect: { every, invuln, dmg, burst, burstDmg, push }
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
    moreTreasures: 0,                // more-treasures: chance each scheduled room treasure brings another
    polyps: null,                    // polyps: { count, dmg } little helpers that shoot with you
    rebirth: null,                   // rebirth: { time } once an act, a killing blow makes you a polyp for a while
    shield: { faster: 0, sooner: 0, fullDamage: 0, bursts: [], fromHealth: false, near: [], invuln: 0 },   // the Shield stat's treasures (src/shield.js)
    rebound: false, tentacleWeapon: false, decoy: null, fireTrail: null,
    noRegen: false,                  // no-regen: Health regen does nothing (true), or only once rebirth has saved you ('revived')
    touch: null,                     // touch-sting: { dmg, every, reach }
    touchZap: null,                  // touch-zap: { dmg, stun, each, reach } (gadgets.js)
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
    groundLock: [],                  // ground-lock: statuses whose bugs can't jump, fly up or climb (enemies.js)
    slideOnHit: [],                  // slide-on-hit: { status, distance } (bubbles.js strike)
    percentDots: [],                 // percent-dot: { status, share, boss } (bubbles.js effects)
    spreadOnTouch: [],               // spread-on-touch: statuses a bug passes on to bugs touching it (bubbles.js effects)
    split: null,                     // split-on-hit: { count, dmg, angle } (bubbles.js pop)
  };
}

const BY = ['bubbles', 'tentacles', 'all'];
const scopes = (by, where) => {
  if (!BY.includes(by)) throw new Error(`${where}: by= must be one of ${BY.join(', ')}`);
  return by === 'all' ? ['bubbles', 'tentacles'] : [by];
};
const ELEMENT_IDS = ['fire', 'lightning', 'ice', 'acid', 'wind', 'glitter', 'poison'];   // poison: the Poison jelly type's attack only (it replaces acid there)

// The statuses a bug can have, as status-damage, status-taken and on-kill-of name them. Each has a
// reader in Enemies.statuses (bubbles.js adds burning, combat.js bleeding) giving its stacks, 0 for none.
export const STATUSES = ['frozen', 'chilled', 'slowed', 'stunned', 'marked', 'burning', 'bleeding', 'poisoned'];
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
  wind: { push: 0.6, pierce: 1, speed: 1.6 / 0.57, rate: 0.88, dmg: 1.5, windup: 0.28, collision: 1 }, // half base bubble rate; windup s, scenery collision damage x
  glitter: { width: 0.08 / 0.026, splash: 1, slow: 0, rate: 1.05, speed: 0.4 / 0.57 },            // splash width x, splash damage x, slow s
  // the Poison jelly's blob (docs/jelly-types/types/poison.md): its burst, a 5 cm sphere (width, as glitter's), does no
  // damage but adds a Poison stack; each stack does `poison` x 20% of Attack damage a second for poisonTime s, up to poisonStacks
  poison: { poison: 1, poisonTime: 5, poisonStacks: 5, width: 0.05 / 0.026 },
};
// element-up numbers that add (the rest multiply)
export const ELEMENT_ADD = new Set(['count', 'pierce', 'chain', 'burnTime', 'puddleTime', 'puddles', 'frost', 'slow', 'slowedMul', 'frostbite', 'chillPierce', 'grow', 'revisit', 'stunFirst']);
// What each of those numbers is, for the balance editor
export const ELEMENT_HINTS = {
  rate: 'shots a second', dmg: 'damage per hit (× attack damage)', count: 'extra shots at once', pierce: 'enemies each shot goes through',
  speed: 'shot speed', range: 'how far it reaches', burn: 'burn damage a second', burnTime: 'seconds a burn lasts',
  spread: 'how far (m) a burning kill spreads the burn', burnStacks: 'Burns one bug can hold at once (each re-hit adds one)', chain: 'enemies a bolt arcs to', bolt: 'arc damage',
  stun: 'stun seconds', chainRange: 'arc reach (m)', revisit: 'arcs may return to a bug already hit (1 = on)', stunFirst: 'arcs go to Stunned bugs first (1 = on)', eliteBolt: 'arc damage on Elites and the boss', chill: 'chill seconds', frost: 'chilling the whole splash (1 = on)',
  slowedMul: 'extra damage slowed enemies take', puddleDmg: 'puddle damage', puddleSize: 'puddle size',
  puddleTime: 'seconds a puddle lasts', puddles: 'most puddles at once', push: 'how far it pushes',
  windup: 'wind-up before each shot (s)', collision: 'damage when a pushed enemy hits furniture',
  width: 'splash width', splash: 'splash damage', slow: 'slow seconds',
  frostbite: 'Chill damage a second, as a share of the hit', chillPierce: 'shards fly through already Chilled bugs (1 = on)', grow: 'how much a shard grows with each bug it hits',
  poison: 'Poison damage a second', poisonTime: 'seconds a Poison stack lasts', poisonStacks: 'Poison stacks one bug can hold',
};
export const elementParams = (id) => ({ ...ELEMENT_BASE.common, ...ELEMENT_BASE[id] });

// effects that fire on an `every N { … }` timer; each gets (gadgets, ctx) when it fires
export const TIMED_WORDS = {
  ring: {
    doc: 'A ring around you, `radius` m: stings everything inside for `dmg`, pushes it out by `push` m, freezes it for `freeze` s, slows it for `slow` s, Chills it for `chill` s. `elites=#false` spares elites and the boss; it shows for `show` s; `look` is "ring", "puff", "chord" (vibrating arcs) or "needles" (streaks to actual targets).',
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
    doc: 'Rolls a marble `size` times the usual size out the way you face at `speed` m/s for `life` s, bouncing off walls; each enemy it bowls through takes `dmg`.',
    props: { dmg: 2, speed: 0.825, life: 1.47, size: 1 },
    make: (_, p) => ({ kind: 'marble', ...p }),
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
    doc: 'A burst of speed: +`speed` Move speed (1 = +100% of your starting speed) for `time` s.',
    args: ['speed'],
    props: { time: 0.35 },
    make: ([speed], p) => ({ kind: 'dash', speed, time: p.time }),
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
export const BUFF_EVENTS = ['kill', 'hit', 'arc', 'big-splash'];

// When a `while` holds (Run.S checks it each time the stats are read)
// the extra pieces adorn can add (src/adornments.js builds each)
export const ADORNMENTS = ['venom-tips', 'sail', 'halo', 'moon-ring', 'mane', 'fronds', 'rebound-bands', 'mirage-rim', 'flaming-feet', 'ember', 'barbs', 'toxin', 'frost', 'storm'];   // ember, barbs, toxin, frost, storm: the Fire, Tentacle, Poison, Ice and Lightning jelly types' looks (content/jellies.kdl adorn=)

export const WHILE_WHEN = ['airborne', 'low-health', 'rooted', 'moving'];

// What `per` can count (Run.S works each one out)
export const PER_SOURCES = ['max-health', 'move-speed-bonus', 'levels', 'chests', 'burning-nearby'];   // burning-nearby: Burning bugs within 30 cm of you

// The stats a treasure can raise with `stat`, by the name content files use
export const STAT_NAMES = { bubbles: 'bubbles', range: 'range', 'bubble-damage': 'bubbleDamage', 'fire-rate': 'fireRate', health: 'health', shield: 'shield', 'move-speed': 'moveSpeed', 'health-regen': 'regen', 'tentacle-damage': 'tentacleDamage', dodge: 'dodge', luck: 'luck', 'bubble-size': 'bubbleSize', 'jump-height': 'jumpHeight', tentacles: 'tentacles', 'tentacle-reach': 'reach', 'tentacle-speed': 'tentacleSpeed', pierce: 'pierce', 'burn-damage': 'burnDamage' };

export const TREASURE_WORDS = {
  pierce: { doc: 'Each bubble pops on up to `count` enemies in a line.', args: ['count'], make: ([n]) => (m) => { m.bubbles.pierce = Math.max(m.bubbles.pierce, n); } },
  'echo-bubble': {
    doc: 'Every bubble that pops on an enemy fires again from there at the next enemy within 20 cm, once, doing `dmg` times the first bubble\'s damage. `by="tentacles"`: every sting jumps on to the nearest other enemy within your Tentacle reach instead, once, doing `dmg` times the sting.',
    props: { dmg: 1, by: 'bubbles' },
    make: (_, p, where) => {
      if (p.by !== 'bubbles' && p.by !== 'tentacles') throw new Error(`${where}: by= must be bubbles or tentacles`);
      return (m) => { if (p.by === 'tentacles') m.hits.tentacles.echo = { dmg: p.dmg }; else m.bubbles.echo = { dmg: p.dmg }; };
    },
  },
  'toy-mouse': { doc: 'Every `every` s a wind-up toy mouse `size` times its usual size scurries (`speed` m/s) to the nearest enemy and slams into it for `dmg` times your power, hitting every enemy within `splash` m of it and shoving them `push` m.', props: { every: 12, dmg: 3, speed: 0.6, size: 1, splash: 0, push: 0 }, make: (_, p) => (m) => { m.mouse = { ...p }; } },
  'golden-bubble': { doc: 'Every `every`th bubble is golden and does `mult` times damage.', props: { every: 10, mult: 5 }, make: (_, p) => (m) => { m.bubbles.golden = p; } },
  'giant-bubble': { doc: 'Every `every`th bubble also blows a giant one: `size` times bigger, `dmg` times the damage, `speed` times as fast.', props: { every: 6, size: 2.5, dmg: 4, speed: 0.6 }, make: (_, p) => (m) => { m.bubbles.giant = p; } },
  element: {
    doc: 'An element attack of its own: fire, lightning, ice, acid, wind or glitter (bubbles.js). It fires its own projectile on its own timer, separate from your bubbles. Legendary: you get these from the start-of-run pick and the Boss reward, not from treasures in the room.',
    args: ['name'],
    make: ([name]) => { if (!ELEMENT_IDS.includes(name)) throw new Error(`element must be one of ${ELEMENT_IDS.join(', ')}, not "${name}"`); return (m) => { m.elements.add(name); m.element[name] ||= elementParams(name); }; },
  },
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
  'extra-jumps': { doc: '`count` more jumps in mid-air.', args: ['count'], make: ([n]) => (m) => { m.extraJumps += n; } },
  'landing-shockwave': { doc: 'Landing from a drop of at least `drop` m sends out a ring of `radius` m that stings for `dmg`.', args: ['radius'], props: { dmg: 2, drop: 0.04 }, make: ([r], p) => (m) => { m.landingShockwave = { radius: r, ...p }; } },
  'squeak-when-hit': { doc: 'When you get hit, enemies within `radius` m are pushed back `push` m and take `dmg` (a flat number). Once every `cooldown` s. Several stack.', props: { radius: 0.09, push: 0.06, dmg: 3, cooldown: 5 }, make: (_, p) => (m) => { m.squeaks.push(p); } },
  'when-hit': {
    doc: 'When you get hit (not a dodge), does the effects in its { block } (ring, zap…), then waits `cooldown` s before it can again. Copies each have their own.',
    props: { cooldown: 1 },
    block: TIMED_WORDS,
    make: (_, p, where, effects) => (m, copy = 0) => { m.onHurt.push({ cooldown: p.cooldown, effects, key: `${where}#${copy}` }); },
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
  'tentacle-weapon': { doc: 'Your tentacles lash whatever your jelly type (with jelly types only the Tentacle jelly lashes otherwise); for the Tentacle jelly, more `tentacles` (stat) add to its Attacks.', make: () => (m) => { m.tentacleWeapon = true; } },
  rebound: { doc: 'Ordinary bubbles return toward the jelly after their outward range or a wall, hitting each target at most once per leg. Elements keep their own flight.', make: () => (m) => { m.rebound = true; } },
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
    doc: 'When your Shield breaks, a blast hits every enemy within `radius` m of you for `dmg` times your Attack damage (a flat `dmg` with flat=#true), and with `invuln` you can\'t be hurt for that many seconds more (dmg=0 for no blast). Copies add their damage into one blast; different blasts each go off.',
    props: { dmg: 2, radius: 0.3, flat: false, invuln: 0 },
    make: (_, p) => {
      if (!(p.radius > 0 && p.invuln >= 0 && (p.dmg > 0 || p.invuln > 0))) throw new Error('shield-burst: radius must be positive, and dmg or invuln above 0');
      return (m) => {
        m.shield.invuln = Math.max(m.shield.invuln, p.invuln);
        if (!(p.dmg > 0)) return;
        const same = m.shield.bursts.find((b) => b.radius === p.radius && b.flat === p.flat);
        if (same) same.dmg += p.dmg; else m.shield.bursts.push({ dmg: p.dmg, radius: p.radius, flat: p.flat });
      };
    },
  },
  'health-to-shield': { doc: 'Your max Health stays at 1: the rest of it, now and whatever you gain later, is Shield instead. Health and Health regen cards are no longer offered.', make: () => (m) => { m.shield.fromHealth = true; } },
  'no-regen': { doc: 'Health regen does nothing (from cards, treasures or anything else). `revived=#true`: only once rebirth has saved you this run.', props: { revived: false }, make: (_, p) => (m) => { m.noRegen = m.noRegen === true || !p.revived ? true : 'revived'; } },
  'touch-sting': { doc: 'Enemies touching you (within `reach` m of your body) take `dmg` every `every` s.', props: { dmg: 0.6, every: 0.5, reach: 0.02 }, make: (_, p) => (m) => { m.touch = { ...p }; } },
  adorn: { doc: 'Adds an evolution look (src/adornments.js): venom-tips thickens and brightens existing tentacles; sail, halo, moon-ring, mane and fronds add pieces.', args: ['piece'], make: ([k]) => { if (!ADORNMENTS.includes(k)) throw new Error(`adorn: one of ${ADORNMENTS.join(', ')}, not "${k}"`); return (m) => { m.adorn.push(k); }; } },
  'death-save': { doc: 'Once per run, a hit that would take your last Health leaves you at `health` (a share of your max Health) instead.', props: { health: 0.5 }, make: (_, p) => (m) => { m.deathSave = { ...p }; } },
  'damage-taken': { doc: 'Hits take `times` as much health.', args: ['times'], make: ([k]) => (m) => { m.damageTaken *= k; } },
  spout: { doc: 'Stand still for `after` s and you refill `heal` health a second.', props: { after: 1, heal: 0.5 }, make: (_, p) => (m) => { m.spout = p; } },
  'heal-on-kill': { doc: 'Every enemy you clear gives back `health`.', args: ['health'], make: ([n]) => (m) => { m.healOnKill += n; } },
  'burst-on-kill': { doc: 'Enemies you finish off burst, stinging everything within `radius` m for `dmg`.', args: ['radius'], props: { dmg: 0.5 }, make: ([r], p) => (m) => { m.burstOnKill = { radius: r, dmg: p.dmg }; } },
  'crumb-on-kill': { doc: '`chance` that an enemy you clear leaves a crumb worth `health`; it drifts to you like XP. Copies add their chances.', props: { chance: 0.02, health: 1 }, make: (_, p) => (m) => { m.crumbs = m.crumbs ? { chance: m.crumbs.chance + p.chance, health: Math.max(m.crumbs.health, p.health) } : { ...p }; } },
  'xp-reach': { doc: 'XP drifts to you from `times` as far.', args: ['times'], make: ([k]) => (m) => { m.xpReach *= k; } },
  stat: {
    doc: 'Raises a stat by `amount` (negative lowers it): bubbles, range, bubble-damage, fire-rate, health, shield, move-speed, health-regen (health a second), dodge (% chance a hit misses), luck (rarer cards and treasures), bubble-size, jump-height, tentacles (how many lash at once), tentacle-reach, tentacle-speed, tentacle-damage or burn-damage (how hard Burn hurts, 1 = as usual). `percent=#true` means % of its starting value.',
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
    doc: 'Raises a stat by `amount` (a % of its starting value with percent=#true) only while `when` holds: airborne (off the ground), low-health (under `under` of your max Health, 0.3 if not given), rooted (standing still on the ground for 1 s or more) or moving (swimming at full speed). Stat names as in `stat`.',
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
    doc: 'When a bug that is `status` dies (with at least `stacks` of it), or one killed by `by` (bubble, tentacle, splash or an Element; give either or both), does the effects in its { block } where it died: ring, zap, shards, brick, bubble-ring, xp, cloud, pass-stacks, heal.',
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
      return (m) => { m.nth.push({ every: n, random: p.random, effects }); };
    },
  },
  'stack-buff': {
    doc: 'On each `event` (kill, hit, arc or big-splash), a stat rises by `amount` (a % of its starting value with percent=#true) for `time` s, up to `stacks` at once; each new one restarts the time. Stat names as in `stat`.',
    args: ['event', 'name', 'amount'],
    props: { time: 3, stacks: 5, percent: false },
    make: ([event, name, amount], p, where) => {
      if (!BUFF_EVENTS.includes(event)) throw new Error(`stack-buff: event must be one of ${BUFF_EVENTS.join(', ')}, not "${event}"`);
      const key = STAT_NAMES[name];
      if (!key) throw new Error(`stack-buff: stat must be one of ${Object.keys(STAT_NAMES).join(', ')}, not "${name}"`);
      if (!(p.time > 0 && Number.isInteger(p.stacks) && p.stacks >= 1)) throw new Error('stack-buff: time must be above 0 and stacks a whole number, 1 or more');
      return (m, copy = 0) => { m.buffs.push({ event, stat: key, amount, percent: p.percent, time: p.time, stacks: p.stacks, key: `${where}#${copy}` }); };
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
  'more-treasures': { doc: 'Each treasure that turns up in the room on the schedule has a `percent`% chance to bring another one, a little after it goes (so about `percent`% more treasures). Copies add.', args: ['percent'], make: ([n]) => (m) => { m.moreTreasures += n / 100; } },
  'elite-damage': { doc: 'Everything you do hurts Elites and the boss `percent`% more. Copies add.', args: ['percent'], make: ([n]) => (m) => { m.eliteDamage += n / 100; } },
  'bug-speed': { doc: 'Bugs move at `times` their speed (not elites or the boss).', args: ['times'], make: ([k]) => (m) => { m.bugSpeed *= k; } },
  'more-bugs': { doc: '`times` as many bugs come out of the vents (the cap on bugs at once grows too).', args: ['times'], make: ([k]) => (m) => { m.moreBugs *= k; } },
  every: {
    doc: 'Every `seconds` (the first time after `first` s, 60% of the period by default), does the effects in its { block }: ring, zap, shards, brick, marble, cone, grab, reach-flare, orb, xp.',
    args: ['seconds'],
    props: { first: null },
    block: TIMED_WORDS,
    make: ([s], p, where, effects) => (m, copy = 0) => { m.timed.push({ every: s, first: p.first ?? s * 0.6, effects, key: `${where}#${copy}` }); },
  },
  'orbit-lights': { doc: '`count` little bulbs circle you `radius` m out and sting whatever they touch for `dmg` (each enemy at most every 0.4 s).', args: ['count'], props: { radius: 0.07, dmg: 0.6 }, make: ([n], p) => (m) => { m.orbit = { count: n, ...p }; } },
  beam: { doc: 'A beam burns the nearest enemy within `range` m for `dmg` every `tick` s.', props: { range: 0.35, dmg: 0.3, tick: 0.25 }, make: (_, p) => (m) => { m.beam = p; } },
  aura: { doc: 'A glow of `radius` m around you stings everything inside for `dmg` every `tick` s.', args: ['radius'], props: { dmg: 0.4, tick: 0.5 }, make: ([r], p) => (m) => { m.aura = { radius: r, ...p }; } },
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
  // Lightning jelly (P8b)
  'touch-zap': {
    doc: 'A bug touching you (within `reach` m of your body) is zapped for `dmg` (x your power) and Stunned for `stun` s, once every `each` s per bug. Elites and the boss take the zap but not the Stun.',
    props: { dmg: 0.6, stun: 1, each: 2, reach: 0.02 },
    make: (_, p) => {
      if (!(p.dmg >= 0 && p.stun > 0 && p.each > 0)) throw new Error('touch-zap: stun and each must be above 0');
      return (m) => { m.touchZap = { ...p }; };
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
};
