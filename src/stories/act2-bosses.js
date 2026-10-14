// Stories: act 2: the Whipper and the Clog. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../events.js';
import { isDeep } from '../sfx.js';
import { TeleMaterial, VolumeMaterial, hostile } from '../vfx.js';
import { BALLOON_MID } from '../elites.js';
import { G, JUMP_FEET, V, act2, balloonWarning, bossHits, byDoor, cameraStory, clogAgain, clogAttack, clogFight, fresh, holdJelly, near, offs, ok, r3, record, shownWarnings, sim, startBalloon, startSpray, step, stub, tp, whipper } from './kit.js';

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
    step(60 * 6, () => {
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
act2('clog-flood', {
  about: 'Fill and drain: the spout gushes and the tub fills, then it drains all at once and the whirlpool drags you to the drain, where the Clog sits waiting (it hurts).',
  setup() {},
  play() {
    const B = clogFight(), { player } = G(), log = record('damage_taken');
    clogAttack(B, 'flood', [1.3, 0.16, 7.53]);
    let filled = 0, poured = false;
    step(60 * 2.2, () => { filled = Math.max(filled, B.waterY - B.floor); if (B.stream.visible) poured = true; });
    const d0 = Math.hypot(player.position.x - B.drain.x, player.position.z - B.drain.z);
    step(60 * 1.6);
    const d1 = Math.hypot(player.position.x - B.drain.x, player.position.z - B.drain.z);
    step(60 * 6.5);   // flood time is 8 s now: the tub stays full far longer before it drains
    const drained = !B.water.visible, hurt = log.some((d) => d.source === 'boss');   // dragged into the drain (and the hairball sitting on it)
    return ok(poured && filled > 0.08 && d1 < d0 - 0.3 && drained && hurt, { poured, filled: +filled.toFixed(3), d0: +d0.toFixed(2), d1: +d1.toFixed(2), drained, hurt });
  },
});
act2('clog-ladybug-swarm-once', {
  about: 'The first time the Clog drops below 70% it roars, four ladybugs burst out of its hair, and it hides in the drain (it can\'t be hurt) until they\'re dead. It only happens once.',
  setup() {},
  play() {
    const B = clogFight(), { enemies } = G();
    tp(1.2, 0.16, 7.53, 0);
    B.hp = B.maxHp * 0.69;
    step(60 * 3);
    const bugs = B.guards.length, hp = B.hp;
    B.damage(100);
    const immune = B.hp === hp && B.shielded;
    for (const e of [...B.guards]) enemies.applyDamage(e, 1e5);
    step(60 * 3);
    B.damage(50);
    const hurtAgain = B.hp === hp - 50, back = B.state !== 'swarm' && B.sink === 0;
    B.hp = B.maxHp * 0.5;
    step(60 * 2);
    const again = B.guards.length;
    return ok(bugs === 4 && immune && hurtAgain && back && again === 0, { bugs, immune, hurtAgain, back, again });
  },
});
act2('clog-angry-spray', {
  about: 'Below 45% the Clog is angry: faster, and it spins spraying globs of drain gunk all round in three streams at once.',
  setup() {},
  play() {
    const B = clogFight();
    tp(1.2, 0.16, 7.53, 0);
    B.swarmed = true;
    B.hp = B.maxHp * 0.4;
    B.state = 'chase'; B.stateT = 0; B.next = 1;                         // the angry order: lash, spray, ...
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
      if (angry) { B.swarmed = true; B.hp = B.maxHp * 0.4; }
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
    B.swarmed = true; B.hp = B.maxHp * 0.4;
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
      if (attack === 'spray') { B.swarmed = true; B.hp = B.maxHp * 0.4; }
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
