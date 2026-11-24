// Stories: the monarch butterfly (act 4) and its `prism`. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { G, JUMP_FEET, V, fresh, holdJelly, near, night4, ok, record, spawn, step, stub, tp, story } from './kit.js';

// the butterfly's prism, as content/enemies.kdl gives it (for rings fired straight in, below)
const PRISM = { beats: 6, peak: 0.24, radius: 0.17, count: 12, rows: 5, speed: 0.26, life: 2.5, dmg: 2, burst: 3, most: 3 };
const balls = () => G().enemies.prismBalls;
const settle = () => { const { run } = G(); stub(run, 'song', null); run.beat = 1.3; };
// one ring of bolts fired from `at` (the floor under it is `floorY`), turned `turn` radians
const ringAt = (at, floorY, turn = 0) => balls().ring({ p: PRISM, to: V(at.x, floorY, at.z), ring: 0, id: -1, source: 'butterfly' }, at, turn);
const hits = (log) => log.filter((d) => d.source === 'butterfly');

night4('butterfly-flies', {
  about: 'A monarch butterfly flies like one: it loops round you 30 to 55 cm off the floor, its wings beating a few times and then holding still in a shallow V for a glide, again and again; the hindwings trail the forewings.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); spawn('butterfly', near(0.35, 0, 0.3)).prismCd = 1e9; },
  play() {
    const e = G().enemies.list[0], P = G().player.position;
    step(60 * 2);
    // the hinges: the body's four groups that each hold one wing mesh (forewings first)
    const hinges = [];
    e.mesh.traverse((o) => { if (o.isGroup && o.children.length === 1 && o.children[0].isMesh && o.children[0].material.map) hinges.push(o); });
    let lo = 9, hi = -9, glide = 0, glides = 0, beats = 0, last = null, lag = 0;
    step(60 * 6, () => {
      const h = e.pos.y - P.y;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      const a = Math.abs(hinges[0].rotation.z), b = Math.abs(hinges[2].rotation.z);
      if (last !== null && Math.abs(a - last) < 1e-4) { if (++glide === 12) glides++; } else glide = 0;   // still for 0.2 s: a glide
      if (last !== null && last < 0.3 && a >= 0.3) beats++;                                               // up through the V: a wingbeat
      if (Math.abs(a - b) > 0.05) lag++;
      last = a;
    });
    return ok(hinges.length === 4 && lo > 0.25 && hi < 0.6 && glides >= 3 && beats >= glides * 2 && lag > 20 && e.T.fly, { hinges: hinges.length, lo: +lo.toFixed(3), hi: +hi.toFixed(3), glides, beats, lagFrames: lag });
  },
});

story('words/prism', {
  about: 'prism: on a beat a butterfly stops, faces you and winds up, then lobs a ball of rainbow light in an arc at the floor where you stood; a Warning circle and dome fill together and are full as it lands 6 beats later as a Blast that hits you for 3. On each beat in the air (6) it fires a burst of 46 bolts every way, and one more as it lands: 322 in all. The ball\'s shell spins as it flies.',
  act: 4,
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); const b = spawn('butterfly', near(0.35, 0, 0.3)); b.prismCd = 0; },
  play() {
    const { run } = G(), e = G().enemies.list[0], P = G().player.position, log = record('damage_taken');
    holdJelly();
    let wound = null, L = null, facing = null, at = null, peak = 0, fill = [], landK = null, b0 = 0, landBeat = null, bolts = 0, spun = 0, lastYaw = null;
    const realRing = balls().ring.bind(balls());
    stub(balls(), 'ring', (...a) => { const n = realRing(...a); bolts += n; return n; });
    step(60 * 8, () => {
      if (e.state === 'windup' && wound == null) wound = +run.beat.toFixed(3);
      if (!L && balls().lobs.length) {
        L = balls().lobs[0]; b0 = run.beat;
        const yaw = e.root.rotation.y, to = Math.atan2(P.x - e.pos.x, P.z - e.pos.z);
        facing = Math.abs(Math.atan2(Math.sin(yaw - to), Math.cos(yaw - to)));
        at = Math.hypot(L.to.x - P.x, L.to.z - P.z);
      }
      if (L && !L.done) {
        const f = Math.hypot(L.m.position.x - L.from.x, L.m.position.z - L.from.z) / Math.max(1e-6, Math.hypot(L.to.x - L.from.x, L.to.z - L.from.z));
        peak = Math.max(peak, L.m.position.y - (L.from.y + (L.to.y - L.from.y) * f));   // over the straight line
        fill.push(+(L.mark.floor.material.progress - L.mark.vol.material.progress).toFixed(6));
        landK = L.mark.floor.material.progress;
        if (lastYaw !== null) spun += Math.abs(L.shell.rotation.y - lastYaw);
        lastYaw = L.shell.rotation.y;
        if (!L.mark.floor.parent || !L.mark.vol.parent) fill.push(9);
      }
      if (L?.done && landBeat === null) landBeat = run.beat - b0;
      return L?.done;
    });
    const burst = hits(log).find((d) => d.amount === 3);
    return ok(wound != null && wound % 1 < 0.1 && facing < 0.3 && at < 0.01 && peak > 0.15 && fill.every((x) => x === 0) && landK > 0.97 && Math.abs(landBeat - 6) < 0.1 && burst && bolts === 322 && spun > Math.PI * 4,
      { wound, facing: facing && +facing.toFixed(2), at: at && +at.toFixed(4), peak: +peak.toFixed(3), landK, landBeat: landBeat && +landBeat.toFixed(2), burst: burst?.amount, bolts, spun: +spun.toFixed(1) });
  },
});

story('words/prism-rings-spiral', {
  about: 'Each burst of a prism ball\'s bolts is turned half a gap from the last, so the gaps spiral: 12 bolts 30 degrees apart round its middle, the next burst 15 degrees round. A burst goes every way: straight up, straight down, and rows between.',
  act: 4,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); },
  play() {
    const { run } = G(), P = G().player.position;
    balls().throw(near(0.3, 0, 0.3), near(1.2, 0), PRISM, -1, 'butterfly', Math.floor(run.beat) + 0.01);
    const angles = [];
    let seen = 0, up = 0, down = 0;
    step(60 * 3, () => {
      const L = balls().lobs[0];
      if (L && L.ring > seen) { seen = L.ring; const B = balls().bolts.filter((b) => b.row === 0).slice(-12); angles.push(B.map((b) => Math.atan2(b.v.x, b.v.z))); if (seen === 1) { const ys = balls().bolts.map((b) => b.v.y / b.v.length()); up = Math.max(...ys); down = Math.min(...ys); } }
      return seen >= 2;
    });
    const deg = (a) => ((a * 180 / Math.PI) % 360 + 360) % 360, first = angles[0]?.map(deg).sort((a, b) => a - b), second = angles[1]?.map(deg).sort((a, b) => a - b);
    const apart = first && first.every((a, i) => i === 0 || Math.abs(a - first[i - 1] - 30) < 0.01);
    const shift = first && second && Math.abs(((second[0] - first[0]) % 30 + 30) % 30 - 15) < 0.01;
    return ok(angles.length >= 2 && apart && shift && up > 0.99 && down < -0.99, { up: +up.toFixed(2), down: +down.toFixed(2), first: first?.map((a) => +a.toFixed(1)), second: second?.map((a) => +a.toFixed(1)) });
  },
});

story('words/prism-bolts', {
  about: 'A prism bolt flies straight and hits for 2: one round the ball\'s middle hits a jelly level with it, one straight down hits a jelly under the ball (a jump doesn\'t clear a burst); a jelly standing in a gap between bolts is not hit.',
  act: 4,
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); },
  play() {
    const { run, player } = G(), P = player.position;
    holdJelly();
    const floor = P.y, mid = floor + 0.045;
    const fire = (from, turn) => { const log = record('damage_taken'); run.iFrames = 0; ringAt(from, floor, turn); step(60 * 2.6); return hits(log); };
    const straight = fire(V(P.x, mid, P.z - 0.25), 0);          // 25 cm in front, level with its middle: a bolt heads straight at it (angle 0 is +z)
    P.y = floor + JUMP_FEET;                                    // feet 12 cm up, near the top of a jump
    const above = fire(V(P.x, P.y + 0.3, P.z), 0);              // the ball 30 cm over it: the bolt straight down
    P.y = floor;
    const gap = fire(V(P.x, mid, P.z - 0.25), Math.PI / 12);    // half a gap round: the jelly stands in the gap
    return ok(straight.length === 1 && straight[0].amount === 2 && above.length === 1 && above[0].amount === 2 && !gap.length && !balls().bolts.length,
      { straight: straight.map((d) => d.amount), above: above.map((d) => d.amount), gap: gap.length, left: balls().bolts.length });
  },
});

story('words/prism-bolts-stop', {
  about: 'Prism bolts stop at walls, furniture and the floor, and there are never more than 240 alive at once (the oldest go first).',
  act: 4,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); },
  play() {
    const { world, player } = G(), P = player.position, floor = P.y, at = V(P.x, floor + 0.045, P.z);
    // the nearest scenery along the floor, then a ring fired 25 cm short of it, the jelly 20 cm off to one side in a gap
    let best = null;
    for (let i = 0; i < 16; i++) { const d = V(Math.sin(i * Math.PI / 8), 0, Math.cos(i * Math.PI / 8)), h = world.cast(at, d, 3); if (h && h.distance > 0.3 && (!best || h.distance < best.h)) best = { d, h: h.distance }; }
    const C = at.clone().addScaledVector(best.d, best.h - 0.25), side = V(best.d.z, 0, -best.d.x);
    tp(C.x + side.x * 0.2, floor, C.z + side.z * 0.2); holdJelly(); step(20);
    const aJ = Math.atan2(side.x, side.z), wall = world.cast(C, best.d, 1)?.distance;
    ringAt(C, floor, aJ + Math.PI / 12);
    let far = 0, hitJelly = false, low = 0;
    const log = record('damage_taken');
    step(60 * 1.5, () => { for (const B of balls().bolts) { if (B.m.position.y < floor - 0.001) low++; } for (const B of balls().bolts) if (B.v.clone().normalize().dot(best.d) > 0.95) far = Math.max(far, Math.hypot(B.m.position.x - C.x, B.m.position.z - C.z)); });
    hitJelly = hits(log).length > 0;
    for (let i = 0; i < 6; i++) ringAt(V(C.x + 2, C.y, C.z), floor);
    const most = balls().bolts.length;
    return ok(wall > 0.2 && wall < 0.3 && far > 0.15 && far <= wall / Math.cos(Math.PI / 12) + 0.01 && !hitJelly && !low && most === 240, { low, wall: wall && +wall.toFixed(3), far: +far.toFixed(3), hitJelly, most });
  },
});

night4('butterfly-from-0-45', {
  about: 'Act 4\'s night brings monarch butterflies from 0:45, and not before: a roll favouring the last eligible bug cannot spawn one at 0:44.9, but does at 0:45. The moth is gone.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => 0.999999);
    stub(run, 'spawnPoint', () => player.position.clone());   // eligibility is separate from scenery placement
    const during = (t) => { enemies.clear(); run.t = t; run.spawnAcc = 1; run.spawnWaves(0); return enemies.list.map((e) => e.type); };
    const before = during(44.9), after = during(45);
    return ok(!before.includes('butterfly') && after.includes('butterfly') && !after.includes('moth'), { before, after });
  },
});
