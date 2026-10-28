// Stories: act 2: the Whipper and the Clog. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../events.js';
import { isDeep } from '../sfx.js';
import { juice } from '../juice.js';
import { TeleMaterial, VolumeMaterial, hostile } from '../vfx.js';
import { BALLOON_MID } from '../elites.js';
import { G, JUMP_FEET, V, act2, balloonWarning, bossHits, byDoor, cameraStory, clogAgain, clogAttack, clogFight, feelSpy, fresh, holdJelly, near, offs, ok, r3, record, shownWarnings, sim, startBalloon, startSpray, step, stub, tp, whipper } from './kit.js';

// --- 3D attacks: the balloon bursts as a whole-sphere Blast round its middle (beside, below or level
// all count), shown only by its floor circle (no volume, the owner's call); the cream spray is a cone
// rising as it spreads (jumping doesn't clear it, stepping out does)
function balloonLoose() { step(60 * 3, () => G().run.elites.balloons.length > 0); return G().run.elites.balloons[0]; }
// where its burst is centred: the middle of its body, above the knot
const balloonMiddle = (B) => B.m.position.clone().setY(B.m.position.y + B.m.scale.y * BALLOON_MID);
function whipperHits(source) { const k = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === source) k.push(d); })); return k; }
act2('whipper-balloon-warning-is-a-floor-circle', {
  about: "The balloon's Warning is just its floor circle (its burst reach, 20 cm), filling and following it, with no volume round the balloon; it goes when the balloon bursts.",
  setup() { startBalloon(); },
  play() {
    const B = balloonLoose();
    if (!B) return ok(false, { loose: false });
    step(30);
    const w1 = balloonWarning(B), p1 = w1.floor?.material.progress, at1 = B.m.position.clone();
    step(60);
    const w2 = balloonWarning(B), p2 = w2.floor?.material.progress, moved = B.m.position.distanceTo(at1);
    const filling = !!(w1.floor && w2.floor === w1.floor) && p2 > p1;
    const noVolume = !w1.volume && !w2.volume;
    step(60 * 3, () => !G().run.elites.balloons.includes(B));
    const gone = !balloonWarning(B).floor;
    return ok(filling && noVolume && moved > 0.01 && gone, { p1, p2, noVolume, moved: +moved.toFixed(3), gone });
  },
});
act2('whipper-balloon-blast-is-a-sphere', {
  about: "A jelly level with the balloon or below it, inside its 20 cm sphere, is caught when it bursts (4, and the sound goes deep); one off to the side and below, outside the sphere, isn't.",
  setup() { fresh({ bubbles: false, lash: false }); byDoor(); },
  play() {
    const hits = whipperHits('balloon'), player = holdJelly(), home = player.position.clone(), e = whipper();
    const top = CONFIG.player.height - CONFIG.player.radius;   // feet to the top of the body's spine
    // one balloon per case: it drifts after you, and just before it bursts the jelly is put with its
    // body's top at `off` from the sphere's centre
    const burstWith = (off) => {
      player.position.copy(home); player.grounded = true;
      e.cool = 0; e.next = 0;
      const B = balloonLoose();
      if (!B) return -1;
      step(60 * 4, () => B.t > B.fuse - 0.05);
      const c = balloonMiddle(B), before = hits.length;
      player.position.set(c.x + off[0], c.y + off[1] - top, c.z); player.grounded = false;
      step(30, () => !G().run.elites.balloons.includes(B));
      return hits.length - before;
    };
    const beside = burstWith([0.18, 0]);          // level with it, 18 cm to the side
    const below = burstWith([0, -0.2]);           // straight under it, the jelly's top 20 cm down
    const corner = burstWith([0.19, -0.16]);      // off to the side and below: 25 cm away, outside the sphere
    return ok(beside === 1 && below === 1 && corner === 0 && hits[0]?.amount === 4 && isDeep(), { beside, below, corner, deep: isDeep() });
  },
});
// the cream spray's Warning, as the scene holds it: its floor wedge and its cone volume
function creamWarning() {
  const kids = G().APT.scene.children, e = whipper(), mine = (o) => e.tele.includes(o);
  return { floor: kids.find((o) => mine(o) && o.material instanceof TeleMaterial), volume: kids.find((o) => mine(o) && o.material instanceof VolumeMaterial) };
}
act2('whipper-cream-warning-has-cone', {
  about: "The cream spray's Warning is a floor wedge with a cone volume over it, rising as it spreads, filling together; both go after the spray.",
  setup() { startSpray(); },
  play() {
    step(400, () => creamWarning().floor);
    step(10);
    const w1 = creamWarning(), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(10);
    const w2 = creamWarning(), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    let shape = {};
    if (w1.volume) {
      const vol = new THREE.Box3().setFromObject(w1.volume), y0 = w1.floor.position.y, tall = vol.max.y - y0;
      // 34 cm long: about 0.34 * tan(0.45) * 1.5 = 25 cm tall at the far end, standing on the floor
      shape = { onFloor: vol.min.y > y0 - 0.01, tall: +tall.toFixed(3) };
      shape.ok = shape.onFloor && tall > 0.2 && tall < 0.3;
    }
    step(400, () => whipper().state !== 'windup');
    const w3 = creamWarning(), gone = !w3.floor && !w3.volume;
    return ok(filling && shape.ok && gone, { p1, p2, shape, gone });
  },
});
act2('whipper-cream-hits-inside-the-cone-even-mid-jump', {
  about: "A jelly in the air inside the cream cone is still hit (3, and slowed); one beside the cone on the floor isn't.",
  setup() { startSpray(); },
  play() {
    const hits = whipperHits('cream');
    step(400, () => creamWarning().floor);
    const { floor } = creamWarning(), a = floor.rotation.y, apex = floor.position.clone();
    const dir = V(Math.sin(a), 0, Math.cos(a)), side = V(Math.cos(a), 0, -Math.sin(a));
    step(400, () => whipper().state === 'windup' && whipper().stateT >= 0.8);   // just before it sprays (0.85)
    const player = holdJelly();
    player.position.copy(apex).addScaledVector(dir, 0.2).addScaledVector(side, 0.2).setY(apex.y); player.grounded = true;   // 20 cm to the side, the wedge is 10 cm wide there
    step(10);
    const beside = hits.length;
    player.position.copy(apex).addScaledVector(dir, 0.2).setY(apex.y + 0.15); player.grounded = false;                     // feet 15 cm up: high in a jump
    step(10);
    const inside = hits.length - beside;
    return ok(beside === 0 && inside === 1 && hits[0]?.amount === 3 && G().run.slowT > 0, { beside, inside, slowed: G().run.slowT > 0 });
  },
});
act2('whipper-cream-jumped-over-near-the-nozzle', {
  about: "Near the nozzle the cream cone is low (it rises as it spreads): a jelly 5 cm out along it with its feet 10 cm up is above it and isn't hit; one there with its feet 1 cm up is inside it and is (3).",
  setup() { startSpray(); },
  play() {
    const hits = whipperHits('cream');
    step(400, () => creamWarning().floor);
    const { floor } = creamWarning(), a = floor.rotation.y, apex = floor.position.clone(), dir = V(Math.sin(a), 0, Math.cos(a));
    step(400, () => whipper().state === 'windup' && whipper().stateT >= 0.8);   // just before it sprays (0.85)
    const player = holdJelly();
    player.position.copy(apex).addScaledVector(dir, 0.05).setY(apex.y + 0.1); player.grounded = false;   // the cone is about 6 cm tall there
    step(10);
    const above = hits.length;
    player.position.copy(apex).addScaledVector(dir, 0.05).setY(apex.y + 0.01);
    step(10);
    const inside = hits.length - above;
    return ok(above === 0 && inside === 1 && hits[0]?.amount === 3, { above, inside });
  },
});
for (const [atk, name] of [[0, 'balloon'], [1, 'cream']]) {
  act2(`whipper-${name}-builds-no-shader`, {
    about: `Starting the Cream Whipper's ${name} builds no new shader: its Warning (${atk ? 'a floor wedge and its cone' : 'a floor circle, no volume'}) was built behind Play.`,
    setup() { if (atk) startSpray(); else startBalloon(); },
    play() {
      const { APT, batcher } = G(), programs = APT.renderer.info.programs.length;
      let shown = {};
      if (atk === 0) { const B = balloonLoose(); step(5); if (B) shown = balloonWarning(B); } else { step(400, () => creamWarning().floor); step(5); shown = creamWarning(); }
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown.floor && !!shown.volume === !!atk && newShaders === 0, { newShaders, volume: !!shown.volume });
    },
  });
}

act2('clog-dendi-finish', {
  about: 'At 0 hp the Clog is doomed, not dead: Dendi — never seen in Act 2 otherwise — appears beside it in the tub, and his smack is what kills it.',
  setup() { clogFight(); },
  play() {
    const { run } = G(), B = run.boss, d = window.dendi;
    const hiddenBefore = !d.group.visible;
    B.damage(99999);
    const doomed = B.dying && !B.dead;
    let smacked = false, catNear = false;
    step(60 * 10, () => {
      if (d.state() === 'smack') smacked = true;
      if (B.dead && !catNear) {
        const c = B.center(), gp = d.group.position;
        catNear = Math.hypot(gp.x - c.x, gp.z - c.z) < B.r + 0.45;
      }
      return B.dead && run.bossWon;
    });
    return ok(hiddenBefore && doomed && smacked && catNear && run.bossWon && !d.group.visible,
      { hiddenBefore, doomed, smacked, catNear, won: run.bossWon, goneAfter: !d.group.visible });
  },
});
act2('act-2-fewer-bugs-more-xp', {
  about: 'Act 2 sends a little fewer bugs (0.85x the spawn rate and how many at once) and each drops a little more XP (1.2x).',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, enemies, xpDrops } = G(), stage = run.stage;
    // spawns over the same minute of the night, with and without the act's `bugs`
    const count = (bugs) => {
      let n = 0;
      const was = stage.bugs, spawn = enemies.spawn, point = run.spawnPoint;
      stage.bugs = bugs;
      enemies.spawn = () => { n++; return null; };
      run.spawnPoint = () => near(0.4, 0);
      run.spawnAcc = 0; run.t = 60;
      const waves = Object.getPrototypeOf(run).spawnWaves;   // fresh() switches the waves off: call the real one
      for (let i = 0; i < 60 * 60; i++) waves.call(run, 1 / 60);
      stage.bugs = was; enemies.spawn = spawn;
      if (Object.getPrototypeOf(run).spawnPoint === point) delete run.spawnPoint; else run.spawnPoint = point;
      return n;
    };
    const plain = count(1), act2 = count(stage.bugs);
    // XP from a 5-XP kill
    let dropped = 0;
    stub(xpDrops, 'drop', (p, v, n) => { dropped += v * n; });
    run.onKill({ pos: near(0.1, 0), r: 0.01, xp: 5 });
    return ok(stage.bugs === 0.85 && stage.xpMult === 1.2 && act2 < plain && act2 >= Math.floor(plain * 0.85) - 1 && dropped === 6, { plain, act2, dropped });
  },
});
act2('camera-fixed-view-fades-what-blocks', cameraStory([[1.3, 0.72, 5.37]], 'Fluted_sideboard_8'));   // plus the bottom of the sink
act2('jump-out-of-the-sink', {
  about: 'The bathroom sink bowl is about 17 cm deep: from the bottom of it the jelly jumps clear of the rim and out (the default 20 cm jump clears it; at the old 13 cm it was stuck).',
  setup() { fresh({ elites: false }); tp(1.3, 0.72, 5.37, Math.PI); },
  play() {
    const start = sim(0.5), { input, player } = G();
    // hold forward, jumping every 2/3 s, until the jelly is past the bowl's rim
    input.keys = new Set(['KeyW']);
    let out = false;
    // out: past the bowl's far rim (z 5.5)
    step(60 * 4, (i) => { if (i % 40 === 0) input.jumpQueued = true; out = player.position.z > 5.6; return out; });
    input.keys = new Set();
    return ok(start.pos[1] < 0.75 && out, { start: start.pos, end: r3(player.position) });
  },
});
act2('act-2-hits-harder', {
  about: 'Act 2 is scaled for the stronger jelly that arrives: bugs, elites and the Clog have more health, and hits on you do 1.5x.',
  setup() { fresh({ hurt: true }); },
  play() {
    const { run, enemies } = G(), stage = run.stage;
    const fly = enemies.spawn('housefly', near(0.5, 0), stage.toughness);
    const bugX = fly.maxHp / fly.T.hp;
    const soap = run.elites.list.find((e) => e.kind === 'soap');
    run.iFrames = 0;
    const m0 = run.health;
    import('../events.js').then(({ bus, PLAYER }) => bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'test' }));
    return new Promise((res) => setTimeout(() => {
      const took = m0 - run.health;
      res(ok(bugX === 2 && soap.maxHp === Math.round(500 * 1.8) && Math.abs(took - 3) < 0.01, { bugX, soapHp: soap.maxHp, took: +took.toFixed(2) }));
    }, 50));
  },
});
act2('bathroom-details', {
  about: 'The tub is dressed like the real one: tile, the striped mat, the spout, thermostat and shower rail, the smiley sponge, the Pantene bottles and the wire caddy with its loofah. None of it gets in your way.',
  setup() { fresh(); },
  play() {
    let g = null; G().APT.scene.traverse((o) => { if (o.name === 'Bathroom details') g = o; });
    let meshes = 0, solid = 0; g?.traverse((o) => { if (o.isMesh) { meshes++; if (!o.userData.noCollide) solid++; } });
    return ok(g && meshes > 45 && !solid, { found: !!g, meshes, solid });
  },
});
act2('tub-is-clear', {
  about: 'The bathtub (the Clog\'s arena) is empty: the green see-through blob that sat in it is gone.',
  setup() { fresh(); },
  play() {
    let shown = false;
    G().APT.root.traverse((o) => { if (o.name === 'Bathtub_3' && o.visible) shown = true; });
    return ok(!shown, { shown });
  },
});
act2('clog-rises-and-chases', {
  about: 'When time runs out the Clog, a big wet matted hairball, rises out of the bathtub drain and rolls after you.',
  setup() {},
  play() {
    const B = clogFight(), { player } = G();
    tp(1.2, 0.16, 7.53, 0);
    const d0 = B.position.distanceTo(player.position);
    B.stateT = 99;
    step(90);
    const d1 = B.position.distanceTo(player.position);
    return ok(B.constructor.name === 'Clog' && B.rise === 1 && d1 < d0 - 0.1, { boss: B.constructor.name, d0: +d0.toFixed(2), d1: +d1.toFixed(2) });
  },
});
// how solid each visible mesh of a piece (the shower curtain, the bathroom door) is drawn now
const solidity = (name) => {
  const out = [];
  G().run.scene.traverse((o) => { if (o.name === name && o.visible) o.traverse((m) => { if (m.isMesh && m.visible) out.push(+[].concat(m.material)[0].opacity.toFixed(2)); }); });
  return out;
};
act2('clog-curtain-and-door-are-see-through-in-the-fight', {
  about: 'The shower curtain over the tub and the open bathroom door beside it could hide the Clog fight from the camera, so during the fight both go faint (15% solid): still there, never blocking the view. A new run puts them back solid.',
  setup() {},
  play() {
    const look = () => ({ curtain: solidity('Shower_curtain'), door: solidity('door-bath') });
    fresh();
    const before = look();
    clogFight();
    step(60);
    const during = look();
    fresh();
    const after = look();
    const solid = (a) => a.length > 0 && a.every((o) => o === 1);
    const faint = (a) => a.length > 0 && a.every((o) => o > 0 && o <= 0.2);
    return ok(solid(before.curtain) && solid(before.door) && faint(during.curtain) && faint(during.door) && solid(after.curtain) && solid(after.door), { before, during, after });
  },
});
act2('clog-lash', {
  about: 'Hair lash: a rope of hair rears up while a line fills on the tub floor (a low lane over it), then whips down along it: 3, and you\'re tangled (slowed).',
  setup() {},
  play() {
    const B = clogFight(), { run } = G(), log = record('damage_taken');
    clogAttack(B, 'lash', [0.62, 0.16, 7.53]);
    let warned = false;
    step(60 * 2, () => { if (B.state === 'lash' && B.lines[0].visible) warned = true; return B.struck; });
    step(2);
    const hit = log.find((d) => d.source === 'boss');
    return ok(warned && hit?.amount === 3 && run.slowT > 0.5, { warned, hit: hit?.amount, slowed: +run.slowT.toFixed(2) });
  },
});
act2('clog-snare', {
  about: 'Snare: three circles fill on the floor round you, then hair springs up in them: 3 and slowed if you\'re caught.',
  setup() {},
  play() {
    const B = clogFight(), { run } = G(), log = record('damage_taken');
    clogAttack(B, 'snare', [0.9, 0.16, 7.53]);
    let circles = 0;
    step(60 * 2, () => { circles = Math.max(circles, B.snares.filter((m) => m.visible).length); return B.sprung; });
    step(2);
    const hit = log.find((d) => d.source === 'boss');
    return ok(circles === 3 && hit?.amount === 3 && run.slowT > 0.5 && B.tufts.length > 0, { circles, hit: hit?.amount, tufts: B.tufts.length });
  },
});
act2('clog-roll', {
  about: 'Roll: it spins up while its lane lights up on the floor, then rolls down it at you: 4.',
  setup() {},
  play() {
    const B = clogFight(), log = record('damage_taken');
    clogAttack(B, 'roll', [1.1, 0.16, 7.53]);
    let lane = false, rolled = false;
    step(60 * 3, () => { if (B.state === 'roll' && B.lines[0].visible) lane = true; if (B.locked) rolled = true; return log.some((d) => d.source === 'boss'); });
    const hit = log.find((d) => d.source === 'boss');
    return ok(lane && rolled && hit?.amount === 4, { lane, rolled, hit: hit?.amount });
  },
});
// the jelly floating in the acid beside duck i (`out`: m further from the middle than the duck), or
// on its back, held still
function byDuck(B, i, onBack) {
  const player = holdJelly(), d = B.ducks[i].g.position;
  if (onBack) player.position.set(d.x, B.ducks[i].y + B.duckTop, d.z);
  else player.position.set(B.mid.x + (d.x - B.mid.x) * 1.5, B.acidFloor.position.y, B.mid.z + (d.z - B.mid.z) * 1.5);
  player.grounded = true;
  return player;
}
// start an acid phase (the first at 75%, the second at 25%) and step until the tub is full
function acidUp(B, second = false) {
  B.acidDone = second ? 1 : 0;
  B.hp = B.maxHp * (second ? 0.24 : 0.74);
  step(60 * 5, () => B.acid?.phase === 'volley');
  return B.acid;
}
act2('clog-acid-floats-the-ducks', {
  about: 'At 75% the Clog fills the tub half full of toxic violet acid with bubbles swelling and popping on it: the four rubber ducks on the tub floor bob up on it, it moves to the head of the tub where it can\'t be hurt, and floating in the acid costs the jelly 4 Health a second.',
  setup() {},
  play() {
    const B = clogFight(), { run } = G();
    const before = B.ducks.map((d) => +d.g.position.y.toFixed(3)), onFloor = before.every((y) => Math.abs(y - B.floor) < 0.002);
    const A = acidUp(B), deep = +(B.acidY - B.floor).toFixed(3), floated = B.ducks.every((d) => d.g.position.y > B.floor + 0.15);
    const head = B.position.x < B.arena.arenaMin[0] + 0.2;
    const hp = B.hp; B.damage(100);
    const shielded = B.hp === hp && B.shielded;
    B.chunks.forEach((c) => { c.on = false; }); A.next = 99;                 // no chunks: just the acid
    byDuck(B, 0, false);
    const h0 = run.health; step(60 * 2); const perSecond = +((h0 - run.health) / 2).toFixed(2);
    const m = new THREE.Matrix4(), bubbling = B.bubbles.visible && Array.from({ length: B.bubbleN }, (_, i) => (B.bubbles.getMatrixAt(i, m), m.elements[0])).filter((k) => k > 0.002).length >= 10;
    return ok(onFloor && A && deep >= 0.19 && floated && head && shielded && bubbling && Math.abs(perSecond - 4) < 0.25, { onFloor, deep, floated, at: r3(B.position), shielded, bubbling, perSecond });
  },
});
act2('clog-acid-spares-one-duck', {
  about: 'Every 1.5 s the Clog lobs a hair chunk at three of the four ducks, never the same duck spared twice running, each duck showing its circle and half sphere till the chunk lands; a jelly on the spared duck is safe, one on a struck duck is hit and thrown off. After 8 rounds the acid drains and it can be hurt again.',
  setup() {},
  play() {
    const B = clogFight(), { run } = G(), log = record('damage_taken');
    const A = acidUp(B);
    const rounds = [];
    let player = null, wasRound = 0, hitOnSafe = 0, hitOnStruck = 0;
    step(60 * 16, () => {
      if (A.round !== wasRound) {
        wasRound = A.round;
        const aimed = B.chunks.filter((c) => c.on).map((c) => c.duck);
        rounds.push({ safe: A.safe, aimed, warned: B.chunks.every((c) => c.tele.visible && c.vol.visible) });
        // the even rounds on the spared duck, the odd ones on a struck one
        const on = A.round % 2 ? aimed[0] : A.safe;
        player = byDuck(B, on, true);
        log.length = 0;
      }
      if (player) {
        const d = B.ducks.find((q) => Math.hypot(q.g.position.x - player.position.x, q.g.position.z - player.position.z) < 0.01);
        if (d) player.position.y = d.y + B.duckTop;                     // ride its bob
        const hit = log.some((x) => x.source === 'boss' && !x.drain);
        if (hit && A.round % 2) { hitOnStruck++; player = null; } else if (hit) { hitOnSafe++; player = null; }
      }
      return B.state === 'chase';
    });
    const distinct = rounds.every((r) => new Set(r.aimed).size === 3 && !r.aimed.includes(r.safe));
    const changes = rounds.every((r, k) => !k || r.safe !== rounds[k - 1].safe);
    const hp = B.hp; B.damage(50);
    const ducksDown = B.ducks.every((d) => Math.abs(d.g.position.y - B.floor) < 0.002);
    return ok(rounds.length === 8 && distinct && changes && rounds.every((r) => r.warned) && hitOnSafe === 0 && hitOnStruck >= 3 && B.hp === hp - 50 && ducksDown && !B.water.visible,
      { rounds: rounds.length, distinct, changes, hitOnSafe, hitOnStruck, hurtAfter: hp - B.hp, ducksDown });
  },
});
act2('clog-acid-whirlpool-leads-the-ducks', {
  about: 'The second acid phase, at 25%, swirls: a whirlpool turns in the middle, its bubbles swept round with it, and the ducks circle the middle of the tub evenly, about a turn every 6 s (a jelly on one is carried round with it); each hair chunk lands right where its duck has got to.',
  setup() {},
  play() {
    const B = clogFight(), A = acidUp(B, true);
    const a0 = B.duckAng, p0 = B.ducks.map((d) => d.g.position.clone());
    const gaps = () => B.ducks.map((d, i) => d.g.position.distanceTo(B.ducks[(i + 1) % 4].g.position));
    let miss = 0, landed = 0, carried = 0;
    const watch = B.chunks.map(() => null);
    byDuck(B, 0, true);
    step(60 * 4, () => {
      B.chunks.forEach((c, k) => {
        if (c.on) watch[k] = c;
        else if (watch[k]) { const d = B.ducks[watch[k].duck].g.position; miss = Math.max(miss, Math.hypot(c.to.x - d.x, c.to.z - d.z)); landed++; watch[k] = null; }
      });
    });
    const spun = +B.whirl.material.uniforms.uTime.value.toFixed(2), swirling = B.whirl.visible && spun > 2;
    const turned = B.duckAng - a0, even = Math.max(...gaps()) - Math.min(...gaps());
    // carried: real movement for a jelly on duck 0's back, its push
    B.chunks.forEach((c) => { c.on = false; }); A.next = 99;
    const P = G().player; delete P.update; P.position.copy(B.ducks[0].g.position).setY(B.ducks[0].y + B.duckTop); P.grounded = true; P.velocity.set(0, 0, 0);
    const startAt = P.position.clone(); step(60);
    carried = +P.position.distanceTo(startAt).toFixed(3);
    const stillOn = Math.hypot(P.position.x - B.ducks[0].g.position.x, P.position.z - B.ducks[0].g.position.z) < B.duckL * 0.34 + P.cfg.radius;
    return ok(A.whirl > 0 && swirling && turned > 3 && even < 0.005 && landed >= 3 && miss < 0.01 && carried > 0.02 && stillOn,
      { spun, turned: +turned.toFixed(2), even: +even.toFixed(4), landed, miss: +miss.toFixed(4), carried, stillOn, moved: +p0[0].distanceTo(B.ducks[0].g.position).toFixed(3) });
  },
});
act2('clog-angry-spray', {
  about: 'Below 45% the Clog is angry: faster, and it spins spraying globs of drain gunk all round in three streams at once.',
  setup() {},
  play() {
    const B = clogFight();
    tp(1.2, 0.16, 7.53, 0);
    B.acidDone = 1;
    B.hp = B.maxHp * 0.4;
    clogAttack(B, 'spray');                                             // next in its angry order
    // every glob it sprays (they end on the tub's walls, so count them as they're fired)
    const fired = new Set();
    step(60 * 2.5, () => { if (B.state === 'spray') B.shots.forEach((s) => fired.add(s)); return B.state === 'spray' && fired.size >= 24; });
    const spraying = +(2.2 - B.stateT).toFixed(2), globs = fired.size;
    const dirs = new Set(B.shots.slice(-3).map((q) => Math.round(Math.atan2(q.v.x, q.v.z) * 2)));
    return ok(B.angry && globs >= 24 && spraying < 0.85 && dirs.size === 3, { angry: B.angry, globs, spraying, streams: dirs.size, state: B.state });
  },
});
// --- 3D attacks: the Clog's lash is a low lane (3 cm: jump it), its roll a lane as tall as the
// hairball (a jump doesn't clear it), its snares floor Blasts, and its gunk spray Shots at mixed heights
// the Clog's Warnings showing in the scene (it hides its own, never removes them)
function clogWarnings() {
  const w = shownWarnings(), mine = (o) => o.material.uniforms.uColor.value.getHex() === hostile('clog').getHex();
  return { floor: w.floor.filter(mine), volume: w.volume.filter(mine) };
}
act2('clog-lash-warning-is-a-low-lane', {
  about: "The lash's Warning is its floor strip with a lane volume 3 cm high over it, filling together; angry, both ropes' lines have one.",
  setup() {},
  play() {
    const B = clogFight(), out = {};
    for (const angry of [false, true]) {
      if (angry) { B.acidDone = 1; B.hp = B.maxHp * 0.4; }
      clogAgain(B, 'lash', 0.62);
      step(20, () => B.state === 'lash' && clogWarnings().volume.length);
      step(10);
      const w1 = clogWarnings(), strip = w1.floor[0], lane = w1.volume[0], p1 = [strip?.material.progress, lane?.material.progress];
      step(15);
      const p2 = [strip?.material.progress, lane?.material.progress];
      let shape = {};
      if (strip && lane) {
        const s = new THREE.Box3().setFromObject(strip), l = new THREE.Box3().setFromObject(lane), same = (a, b) => Math.abs(a - b) < 0.005;
        shape = { tall: +(l.max.y - B.floor).toFixed(3), onFloor: Math.abs(l.min.y - B.floor) < 0.005, over: same(s.min.x, l.min.x) && same(s.max.x, l.max.x) && same(s.min.z, l.min.z) && same(s.max.z, l.max.z) };
        shape.ok = Math.abs(shape.tall - 0.03) < 0.003 && shape.onFloor && shape.over;
      }
      const filling = !!(strip && lane) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
      out[angry ? 'angry' : 'calm'] = { floors: w1.floor.length, volumes: w1.volume.length, filling, shape };
      step(120, () => B.state !== 'lash');
      out[angry ? 'angry' : 'calm'].gone = clogWarnings().volume.length === 0;
    }
    const c = out.calm, a = out.angry;
    return ok(c.floors === 1 && c.volumes === 1 && c.filling && c.shape.ok && c.gone && a.floors === 2 && a.volumes === 2 && a.filling && a.shape.ok && a.gone, out);
  },
});
act2('clog-lash-jumped-clear', {
  about: "A jelly standing in the lash's lane is hit (3, slowed); one in the air over it (feet 5 cm up, over a 3 cm lane) isn't.",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), out = {};
    for (const up of [0, 0.05]) {
      clogAgain(B, 'lash', 0.62, up);
      const h0 = hits.length;
      step(150, () => B.state === 'lash' && B.struck);
      step(5);
      out[up ? 'jumping' : 'standing'] = hits.slice(h0).map((h) => h.amount);
      step(60, () => B.state !== 'lash');
    }
    return ok(out.standing[0] === 3 && out.standing.length === 1 && out.jumping.length === 0, out);
  },
});
act2('clog-roll-lane-is-as-tall-as-it-is', {
  about: "The roll's Warning is its floor strip with a lane volume as tall as the hairball (20 cm) over it, filling together. A jelly in the air inside the lane (feet 15 cm up) is still hit (4); one 20 cm beside it on the floor isn't.",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), out = {};
    clogAgain(B, 'roll', 0.75);
    step(30);
    const w = clogWarnings(), lane = w.volume[0], tall = lane ? +(new THREE.Box3().setFromObject(lane).max.y - B.floor).toFixed(3) : 0;
    out.warning = { floors: w.floor.length, volumes: w.volume.length, tall, filling: !!lane && Math.abs(w.floor[0]?.material.progress - lane.material.progress) < 1e-6 };
    for (const side of [false, true]) {
      const player = clogAgain(B, 'roll', 0.75, side ? 0 : 0.15);
      step(120, () => B.locked);
      if (side) player.position.z += 0.2;
      const h0 = hits.length, from = B.position.clone();
      step(120, () => B.state !== 'roll');
      out[side ? 'beside' : 'jumping'] = { hits: hits.slice(h0).map((h) => h.amount), rolled: +B.position.distanceTo(from).toFixed(2) };
    }
    const W = out.warning;
    return ok(W.floors === 1 && W.volumes === 1 && Math.abs(W.tall - 0.2) < 0.005 && W.filling && out.jumping.hits[0] === 4 && out.beside.hits.length === 0 && out.beside.rolled > 0.45, out);
  },
});
act2('clog-snare-is-a-floor-blast', {
  about: "Each snare circle has a half-sphere volume of its radius (5 cm) over it, filling together. A jelly standing in one is hit (3, slowed); one in the air over it (feet 12 cm up) isn't.",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), out = {};
    for (const up of [0, JUMP_FEET]) {
      clogAgain(B, 'snare', 0.9, up);
      step(20);   // mid-fill: at windup 0.9 the circles spring at about frame 39, so 40 was a photo of after they vanished
      const w = clogWarnings(), dome = w.volume[0], b = dome && new THREE.Box3().setFromObject(dome);
      const h0 = hits.length;
      step(120, () => B.state === 'snare' && B.sprung);
      step(3);
      out[up ? 'jumping' : 'standing'] = {
        floors: w.floor.length, volumes: w.volume.length, r: b ? +((b.max.x - b.min.x) / 2).toFixed(3) : 0, tall: b ? +(b.max.y - B.floor).toFixed(3) : 0,
        filling: !!dome && w.floor.some((f) => Math.abs(f.material.progress - dome.material.progress) < 1e-6), hits: hits.slice(h0).map((h) => h.amount),
      };
      step(60, () => B.state !== 'snare');
    }
    const s = out.standing;
    return ok(s.floors === 3 && s.volumes === 3 && Math.abs(s.r - 0.05) < 0.003 && Math.abs(s.tall - 0.05) < 0.003 && s.filling && s.hits[0] === 3 && s.hits.length === 1 && out.jumping.hits.length === 0, out);
  },
});
act2('clog-spray-low-and-high', {
  about: "The angry gunk spray's globs are Shots alternating floor level (4.5 cm) and jump height (16 cm): the low ones pass under a jumping jelly and the high ones over a grounded one (each hits the jelly that doesn't dodge it, 2).",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), out = {};
    B.acidDone = 1; B.hp = B.maxHp * 0.4;
    for (const up of [0, JUMP_FEET]) {
      const player = clogAgain(B, 'spray', 0.75, up);
      B.state = 'spray'; B.stateT = 1.0; B.prevT = 1.0;
      const h0 = hits.length, seen = new Set(), aimed = [];
      // keep one stream facing the jelly, so a glob from it comes straight at it every tenth of a second
      const aim = () => { B.heading = Math.atan2(player.position.x - B.position.x, player.position.z - B.position.z) - 8 / 60; };
      aim();
      step(200, () => {
        for (const s of B.shots) {
          if (seen.has(s)) continue;
          seen.add(s);
          const to = player.position.clone().sub(s.m.position).setY(0).normalize(), v = s.v.clone().setY(0).normalize();
          if (to.dot(v) > 0.98) aimed.push(s.m.position.y - B.floor);
        }
        if (B.state === 'spray') aim();
        else { B.state = 'chase'; B.stateT = 999; B.position.copy(B.drain); }   // hold it there while the last globs land: at chase angrySpeed 0.3 it otherwise reaches the jelly and bumps it (and starts new attacks)
        return B.state !== 'spray' && !B.shots.length;
      });
      const low = aimed.filter((h) => h < 0.07).length, high = aimed.length - low;
      const alternate = aimed.every((h, i) => i === 0 || (h < 0.07) !== (aimed[i - 1] < 0.07));
      out[up ? 'jumping' : 'grounded'] = { low, high, alternate, hits: hits.slice(h0).map((h) => h.amount) };
    }
    const g = out.grounded, j = out.jumping, twos = (r) => r.hits.every((n) => n === 2);
    const pass = g.low > 0 && g.high > 0 && j.low > 0 && j.high > 0 && g.alternate && j.alternate && twos(g) && twos(j)
      && g.hits.length === g.low && j.hits.length === j.high;   // grounded: only the low ones hit; jumping: only the high ones
    return ok(pass, out);
  },
});
for (const attack of ['lash', 'snare', 'roll', 'spray']) {
  act2(`clog-${attack}-builds-no-shader`, {
    about: `Starting the Clog's ${attack} builds no new shader: its Warning's floor shape and volume${attack === 'spray' ? ', and its Shots,' : ''} were built behind Play.`,
    setup() {},
    play() {
      const B = clogFight(), { APT, batcher } = G(), programs = APT.renderer.info.programs.length;
      if (attack === 'spray') { B.acidDone = 1; B.hp = B.maxHp * 0.4; }
      clogAgain(B, attack, 0.75);
      if (attack === 'spray') { B.state = 'spray'; B.stateT = 1.0; B.prevT = 1.0; }
      const showing = () => (attack === 'spray' ? B.shots.length > 3 : clogWarnings().volume.length > 0 && clogWarnings().floor.length > 0);
      step(60, showing);
      const shown = !!showing();
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown && newShaders === 0, { shown, newShaders });
    },
  });
}

// --- the Clog's livelier fight: it hops between attacks, bumping into it is a heavy slam, and two
// attacks with set dodges (Pinball: out of each landing circle, then jump the ring wave; Comb: step
// into the lane that just struck)
act2('clog-hops-and-slams-into-you', {
  about: 'Between attacks the Clog bounds after you in hops (it leaves the floor and lands nearer you); bumping into it is heavy: 3, you\'re tangled (slowed) and thrown back, with the big impact shake.',
  setup() {},
  play() {
    const B = clogFight(), { player, run } = G(), hits = bossHits(), feels = [];
    const feel = juice.feel.bind(juice); stub(juice, 'feel', (k) => { feels.push(k); return feel(k); });
    tp(1.0, 0.16, 7.53, 0);
    B.state = 'chase'; B.stateT = 99; B.hop = null; B.hopWait = 0.1;
    const d0 = B.position.distanceTo(player.position);
    let lifted = 0;
    step(90, () => { lifted = Math.max(lifted, B.lift); });
    const d1 = B.position.distanceTo(player.position);
    // now right up against it
    B.hop = null; B.hopWait = 99; B.knock = 0;
    tp(B.position.x + B.r + 0.01, 0.16, B.position.z, 0);
    const at = player.position.clone();
    step(30, () => hits.length > 0);
    step(15);
    const pushed = +player.position.distanceTo(at).toFixed(3);
    return ok(lifted > 0.02 && d1 < d0 - 0.1 && hits[0]?.amount === 3 && run.slowT > 0 && pushed > 0.05 && feels.includes('impact-big'),
      { lifted: +lifted.toFixed(3), d0: +d0.toFixed(2), d1: +d1.toFixed(2), hit: hits[0]?.amount, slowed: run.slowT > 0, pushed, feels: [...new Set(feels)] });
  },
});
act2('clog-pinball', {
  about: 'Pinball: three leaps at you, each landing spot a circle with a half sphere over it, filling together and following you until just before it lands, then a Blast there (3); a jelly that stays put is hit. The last slam rolls a ring wave out.',
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits();
    const player = clogAgain(B, 'pinball', 0.75);
    let warned = false, together = true, landings = 0, waved = false, lastK = 0;
    step(60 * 6, () => {
      if (B.state === 'pinball' && B.pinTele.visible) { warned ||= B.pinVol.visible; if (B.pinVol.visible) together &&= Math.abs(B.pinVol.material.progress - B.pinTele.material.progress) < 1e-6; }
      if (B.pin && B.pin.k > lastK) { landings++; lastK = B.pin.k; }
      waved ||= !!B.wave;
      return B.state === 'chase' && lastK >= 3;
    });
    const pinHits = hits.filter((h) => h.amount === 3).length;
    return ok(warned && together && landings === 3 && waved && pinHits >= 3, { warned, together, landings, waved, pinHits, hits: hits.map((h) => h.amount) });
  },
});
act2('clog-pinball-dodged', {
  about: 'Pinball dodged: a jelly that steps 30 cm aside after each landing spot locks is never hit by the slams; the ring wave then hits one standing on the floor (2) but not one in the air over it (feet 5 cm up, over a 2.5 cm wall).',
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), S = B.def.skills.pinball, out = {};
    for (const up of [0, 0.05]) {
      const player = clogAgain(B, 'pinball', 0.75);
      const h0 = hits.length;
      let side = 1, moved = -1, slamHits = 0;
      step(60 * 6, () => {
        const J = B.pin;
        if (J && J.phase === 'air' && S.air - J.t < S.lock && moved !== J.k) { moved = J.k; player.position.x += 0.3 * side; side = -side; }
        if (J && J.k >= S.count && J.phase === 'land' && !out.landed) { out.landed = true; slamHits = hits.length - h0; player.position.y = B.floor + up; }
        return B.state === 'chase' && !B.wave;
      });
      out[up ? 'jumping' : 'standing'] = { slamHits, waveHits: hits.slice(h0 + slamHits).map((h) => h.amount) };
      out.landed = false;
    }
    return ok(out.standing.slamHits === 0 && out.jumping.slamHits === 0 && out.standing.waveHits[0] === 2 && out.jumping.waveHits.length === 0, out);
  },
});
act2('clog-comb', {
  about: 'Comb: hair curtains slam down across the tub in 5 lanes, every other lane then the ones between, three times, each a floor strip with a lane too tall to jump (12 cm) over it, filling together. A jelly that stays in one lane is hit (3, slowed); one that steps into the lane that just struck each time is never hit.',
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), out = {};
    for (const dodge of [false, true]) {
      const player = clogAgain(B, 'comb', 0.75);
      step(2);
      const h0 = hits.length;
      let wave = 0, shown = 0, tall = 0, together = true;
      if (B.comb) player.position.x = B.combX[1];
      step(60 * 4, () => {
        const vis = B.combTeles.filter((T) => T.visible);
        shown = Math.max(shown, vis.length);
        B.combVols.forEach((v, i) => { if (v.visible) { tall = Math.max(tall, v.scale.y); together &&= Math.abs(v.material.progress - B.combTeles[i].material.progress) < 1e-6; } });
        if (B.comb && B.comb.wave !== wave) { wave = B.comb.wave; if (dodge) player.position.x = B.combX[wave % 2 ? 0 : 1]; }
        return B.state === 'chase';
      });
      out[dodge ? 'dodging' : 'staying'] = { hits: hits.slice(h0).map((h) => h.amount), shown, tall, together };
    }
    const st = out.staying, dg = out.dodging;
    return ok(st.shown === 3 && Math.abs(st.tall - 0.12) < 1e-6 && st.together && st.hits.includes(3) && dg.hits.length === 0, out);
  },
});

// --- how the Clog's attacks land (docs/agents/attack-feel.md): each story runs one attack on a
// jelly held in its way and checks its feedback fires on the real hit: the flash where it leaves,
// the flash on the jelly, the shake steps, the harmless gunk smears it leaves, the layered sound
const bodyOf = (p) => p.clone().setY(p.y + CONFIG.player.height * 0.5);
const seen = (spy) => ({ feels: [...new Set(spy.feels)], sounds: [...new Set(spy.sounds)], splats: spy.splats.length });
act2('feel-clog-lash', {
  about: "The Clog's lash catching the jelly: it heaves down with the rope, a flash on the jelly as well as at the rope's tip, the impact shake, wet smears along the line (harmless, they fade), and the crack with its slap and pattering bits.",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), player = clogAgain(B, 'lash', B.drain.x + 0.25), spy = feelSpy(B.fx);
    step(60 * 2, () => B.struck);
    step(2);
    const out = { hit: hits[0]?.amount, onJelly: spy.near(bodyOf(player.position), 0.01), ...seen(spy) };
    return ok(out.hit === 3 && out.onJelly && out.splats >= 3 && out.feels.includes('impact') && out.sounds.includes('clogLash'), out);
  },
});
act2('feel-clog-snare', {
  about: "The Clog's snare springing on the jelly: a flash in each circle and on the jelly, the Clog clenching, the impact shake, a gunk smear in each circle (harmless, they fade), and the snap with its thump and settling strands.",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), player = clogAgain(B, 'snare', B.drain.x + 0.3), spy = feelSpy(B.fx);
    step(60 * 2, () => B.sprung);
    step(2);
    const out = { hit: hits.length, onJelly: spy.near(bodyOf(player.position), 0.01), ...seen(spy) };
    return ok(out.hit >= 1 && out.onJelly && out.splats >= 4 && out.feels.includes('impact') && out.sounds.includes('clogSnare'), out);
  },
});
act2('feel-clog-roll', {
  about: "The Clog's roll: it sets off with a burst of grime behind it and a small shake (hit), smears a gunk track down its lane, and rolling into the jelly is the heavy wet slam where it struck (impact-big).",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits(), player = clogAgain(B, 'roll', B.drain.x + 0.35), spy = feelSpy(B.fx);
    let i0 = -1;
    step(60 * 3, () => { if (B.locked && i0 < 0) i0 = spy.impacts.length; return hits.length > 0; });
    step(10);
    const out = { hit: hits[0]?.amount, released: i0 > 0, slam: spy.impacts.length > i0, ...seen(spy) };
    return ok(out.hit === 4 && out.released && out.slam && out.splats >= 3 && ['hit', 'impact-big'].every((k) => out.feels.includes(k)) && ['clogRoll', 'clogSlam'].every((k) => out.sounds.includes(k)), out);
  },
});
act2('feel-clog-spray', {
  about: "The Clog's gunk spray: each glob spat out with a flash at its hair, a heave and a wet spit; a glob catching the jelly flashes on it and shakes (impact); every glob leaves a smear where it ends (harmless, they fade).",
  setup() {},
  play() {
    const B = clogFight(), hits = bossHits();
    B.acidDone = 1; B.hp = B.maxHp * 0.4;
    const player = clogAgain(B, 'spray', B.drain.x + 0.3), spy = feelSpy(B.fx);
    B.state = 'spray'; B.stateT = 2; B.prevT = 2;
    step(60 * 2, () => hits.length > 0);
    step(5);
    const out = { hit: hits[0]?.amount, onJelly: spy.near(bodyOf(player.position), 0.03), ...seen(spy) };
    return ok(out.hit === 2 && out.onJelly && out.splats >= 1 && out.feels.includes('impact') && ['clogSpit', 'clogSplat'].every((k) => out.sounds.includes(k)), out);
  },
});
act2('feel-clog-acid', {
  about: "The Clog's acid chunks: each round flashes off its hair as it heaves (a hit shake, a spit and crack); each glowing chunk lands on its duck with a flash, hair bits and a puff of acid, the duck dunked and squeaking (the impact shake); floating in the acid fizzes on the jelly with a hiss; once drained, scum rings are left on the tub floor (harmless, they fade).",
  setup() {},
  play() {
    const B = clogFight(), A = acidUp(B), spy = feelSpy(B.fx), player = byDuck(B, 0, false);
    step(60 * 16, () => B.state === 'chase');
    const out = { onJelly: spy.near(bodyOf(player.position), 0.03), ...seen(spy) };
    return ok(A && out.onJelly && out.splats >= 6 && out.feels.includes('impact') && out.feels.includes('hit') && ['clogSpit', 'clogSplat', 'duckSqueak', 'acidSizzle', 'clogDrain'].every((k) => out.sounds.includes(k)), out);
  },
});
act2('feel-clog-shed', {
  about: "The Clog's shed: it heaves with a flash and a small shake (hit) and a wet rip, a glowing clump flies off it to each spot where a tangle grows in, and each lands on a gunk smear (harmless, it fades).",
  setup() {},
  play() {
    const B = clogFight(), { enemies } = G();
    clogAgain(B, 'shed', B.drain.x + 0.4);
    const spy = feelSpy(B.fx), before = enemies.list.length;
    step(60 * 2, () => B.state === 'chase');
    const tangles = enemies.list.length - before, out = { tangles, ...seen(spy) };
    return ok(tangles >= 3 && out.splats >= tangles && out.feels.includes('hit') && out.sounds.includes('clogShed') && spy.impacts.length >= 1, out);
  },
});
