// Stories: elites and their 3D attacks (Controller, Mug, Kettle). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { bus } from '../events.js';
import { shotTarget, hostile, TeleMaterial, VolumeMaterial } from '../vfx.js';
import { CONTROLLER_AT, G, JUMP_FEET, V, fresh, holdJelly, offs, ok, record, startCoffeeLob, startController, startKettle, step, story, stub, theKettle, tp, warningsAt } from './kit.js';

// --- elites: targetable, and every attack telegraphs before it lands
const ELITE_SPOTS = { controller: [1.42, 0.61, 4.5], mug: [0.66, 0.78, 2.84], kettle: [4.6, 0.91, 3.8] };
for (const kind of ['controller', 'mug', 'kettle']) {
  story(`elites/${kind}-takes-bubbles`, {
    about: `Bubbles reach and hurt the ${kind} on its high ground.`,
    setup() { fresh(); tp(...ELITE_SPOTS[kind].map((v, i) => (i === 1 ? v + 0.05 : v)), 0); },
    play() {
      const { run, enemies, menus } = G();
      const e = run.elites.list.find((x) => x.kind === kind), hp0 = e.hp;
      step(600, () => { if (menus.open) menus.close(); });
      const dmg = Math.round(hp0 - e.hp);
      return ok(enemies.list.includes(e.entry) && dmg > 60, { dmg });
    },
  });
  for (const atk of [0, 1]) {
    const when = { controller: [0.45, 0.8], mug: [0.6, 0.6], kettle: [0.7, 0.6] }[kind][atk];
    const at = { controller: [[1.62, 0.61, 4.47], [1.55, 0.61, 4.45]], mug: [[0.62, 0.78, 2.95], [0.62, 0.78, 3.0]], kettle: [[4.5, 0.91, 3.45], [4.5, 0.91, 3.45]] }[kind][atk];
    const name = { controller: ['barrage', 'rumble'], mug: ['lob', 'spill'], kettle: ['steam', 'boil-over'] }[kind][atk];
    story(`elites/${kind}-${name}`, {
      about: `The ${kind}'s ${name} attack shows its warning on the ground before it lands.`,
      setup() { fresh({ bubbles: false, lash: false }); tp(at[0], at[1] + 0.05, at[2], 0); const e = G().run.elites.list.find((x) => x.kind === kind); e.next = atk; e.cool = 0; },
      play() {
        const { run, player } = G();
        const e = run.elites.list.find((x) => x.kind === kind);
        step(400, () => e.state === 'windup' && e.stateT >= when);
        const telegraphs = e.tele.length + run.elites.blobs.length;
        const info = { state: e.state, telegraphs };
        let aimed = true;
        if (kind === 'kettle' && atk === 0) {       // the steam cone must point at you, not the wall
          const b = new THREE.Box3().setFromObject(e.tele[0]), c = b.getCenter(V(0, 0, 0));
          aimed = c.sub(e.base).setY(0).dot(player.position.clone().sub(e.base).setY(0)) > 0;
          info.aimed = aimed;
        }
        return ok(e.state === 'windup' && telegraphs > 0 && aimed, info);
      },
    });
  }
}

// --- 3D attacks: the Mug's coffee lob lands as a floor Blast (a half sphere), and its Warning shows
const firstCoffee = () => { step(400, () => G().run.elites.blobs.length > 0); return G().run.elites.blobs[0]; };
// every coffee Blast hit from now on (the log keeps filling as the story steps)
function coffeeHits() { const mug = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === 'mug') mug.push(d); })); return mug; }
story('elites/mug-coffee-warning-has-volume', {
  about: "The coffee lob's Warning is a floor circle with a half-sphere volume over it, filling together; both go when it lands.",
  setup() { startCoffeeLob(); },
  play() {
    const b = firstCoffee(), to = b.to.clone();
    holdJelly().position.x += 0.12;   // so the second lob lands elsewhere
    step(20);
    const w1 = warningsAt(to), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(20);
    const w2 = warningsAt(to), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const dome = w1.volume ? new THREE.Box3().setFromObject(w1.volume) : null;
    const domed = !!dome && dome.min.y > to.y - 0.005 && dome.max.y > to.y + 0.03;   // a half sphere standing on the surface
    step(200, () => !G().run.elites.blobs.includes(b));
    const w3 = warningsAt(to), gone = !w3.floor && !w3.volume;
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && domed && gone, { p1, p2, domed, gone });
  },
});
story('elites/mug-coffee-blast-hits-standing-jelly', {
  about: 'A jelly standing where the coffee lands is hit by its Blast (3 Health).',
  setup() { startCoffeeLob(); },
  play() {
    const hits = coffeeHits(), b = firstCoffee();
    step(200, () => !G().run.elites.blobs.includes(b));
    return ok(hits.length >= 1 && hits[0].amount === 3, { hits: hits.map((h) => h.amount) });
  },
});
story('elites/mug-coffee-blast-jumped-clear', {
  about: "A jelly in the air above the coffee Blast's radius when it lands is not hit.",
  setup() { startCoffeeLob(); },
  play() {
    const hits = coffeeHits(), b = firstCoffee();
    step(200, () => b.t > b.T - 0.1);
    const player = holdJelly();
    player.position.set(b.to.x, b.to.y + 0.06, b.to.z); player.grounded = false;   // feet 6 cm up: above a 4.5 cm dome
    step(30, () => !G().run.elites.blobs.includes(b));
    const landed = !G().run.elites.blobs.includes(b);
    return ok(landed && hits.length === 0, { landed, hits: hits.length });
  },
});
story('elites/mug-coffee-blast-misses-just-outside', {
  about: "A jelly on the floor just outside the coffee Blast's radius is not hit; one whose body reaches into it is.",
  setup() { startCoffeeLob(); },
  play() {
    const hits = coffeeHits(), b = firstCoffee();
    step(200, () => b.t > b.T - 0.1);
    const player = holdJelly();
    player.position.set(b.to.x + 0.085, b.to.y, b.to.z); player.grounded = true;   // body edge 5.4 cm out: clear of 4.5 cm
    step(30, () => !G().run.elites.blobs.includes(b));
    const outside = hits.length;
    const b2 = G().run.elites.blobs[0] || firstCoffee();
    step(200, () => b2.t > b2.T - 0.1);
    player.position.set(b2.to.x + 0.065, b2.to.y, b2.to.z);                      // body edge 3.5 cm out: inside
    step(30, () => !G().run.elites.blobs.includes(b2));
    const edge = hits.length - outside;
    return ok(outside === 0 && edge === 1, { outside, edge });
  },
});
story('elites/mug-coffee-builds-no-shader', {
  about: "Starting the coffee lob builds no new shader: its Warning's floor circle and volume were built behind Play.",
  setup() { startCoffeeLob(); },
  play() {
    const { APT, batcher } = G(), programs = APT.renderer.info.programs.length;
    const b = firstCoffee(), to = b.to.clone();
    step(10);
    const w = warningsAt(to);
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(w.floor && w.volume && newShaders === 0, { newShaders, volume: !!w.volume });
  },
});

// --- 3D attacks: Shots aim in 3D (the shared Shot, vfx.js / fx.js), and the Controller is built on
// every Controller hit from now on (the log keeps filling as the story steps)
function controllerHits() { const c = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === 'controller') c.push(d); })); return c; }
story('elites/shot-hits-jelly-mid-jump', {
  about: "A Shot fired from the floor at a jelly held mid-jump flies up to the jelly's height and hits it.",
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(CONTROLLER_AT[0], CONTROLLER_AT[1] + 0.05, CONTROLLER_AT[2], 0); },
  play() {
    const { run } = G(), player = holdJelly(), floor = player.position.y;
    player.position.y = floor + JUMP_FEET; player.grounded = false;
    const hits = controllerHits(), P = player.position;
    const from = V(P.x - 0.25, floor + 0.045, P.z);   // a muzzle on the floor, 25 cm away
    const s = run.elites.shoot(from, shotTarget(P, CONFIG.player), hostile('controller'), 'controller', 2);
    let y = null;
    step(90, () => { if (!s.done) y = s.m.position.y; return hits.length > 0; });
    // it was fired from 4.5 cm up and struck the body 12 to 21 cm up: it flew up to the jelly
    const inBody = y !== null && y > P.y && y < P.y + CONFIG.player.height;
    return ok(hits.length === 1 && inBody, { hits: hits.length, shotY: y && +(y - floor).toFixed(3), feet: JUMP_FEET });
  },
});
// a barrage's aim lines once they've locked: where each starts and ends, and the floor under the jelly
function lockedBarrage(e) {
  step(400, () => e.state === 'windup' && e.locked);
  const floor = G().run.elites.surfaceBelow(G().player.position);
  return { floor, ends: e.tele.map((m) => (m.updateMatrixWorld(), m.localToWorld(V(0, 0, 1)))), starts: e.tele.map((m) => m.localToWorld(V(0, 0, 0))) };
}
story('elites/controller-aim-lines-show-height', {
  about: "The Controller's aim lines tilt to each button's height: they alternate floor level (4.5 cm) and jump height (16 cm), and each Shot flies along its line.",
  setup() { startController(0); },
  play() {
    const { run } = G(), e = run.elites.list.find((x) => x.kind === 'controller');
    holdJelly();
    const { floor, ends, starts } = lockedBarrage(e);
    const heights = ends.map((p) => +(p.y - floor).toFixed(3));
    const n0 = run.elites.bullets.length;
    step(60, () => run.elites.bullets.length > n0);
    const shots = run.elites.bullets.slice(-3);
    // each Shot's path passes through its line's end
    const along = shots.map((s, i) => {
      const dir = s.v.clone().normalize(), rel = ends[i].clone().sub(starts[i]);
      return +rel.sub(dir.multiplyScalar(rel.dot(dir))).length().toFixed(4);
    });
    const low = (h) => Math.abs(h - 0.045) < 0.006, high = (h) => Math.abs(h - 0.16) < 0.006;
    const mixed = heights.every((h) => low(h) || high(h)) && low(heights[0]) !== low(heights[1]) && low(heights[1]) !== low(heights[2]);
    return ok(ends.length === 3 && shots.length === 3 && mixed && along.every((d) => d < 0.004), { heights, along });
  },
});
story('elites/controller-barrage-low-and-high', {
  about: 'In a barrage, floor-level buttons pass under a jumping jelly and jump-height buttons pass over a grounded one (and each hits the jelly that doesn\'t dodge it).',
  setup() { startController(0); },
  play() {
    const { run } = G(), e = run.elites.list.find((x) => x.kind === 'controller');
    const player = holdJelly(), hits = controllerHits(), result = {};
    player.position.x = e.base.x + 0.3;   // far enough that only the middle line reaches you
    // four barrages: the middle line (the one aimed at you) alternates low and high, and the jelly
    // stays down for two and jumps for two
    for (const jump of [false, false, true, true]) {
      e.next = 0; e.cool = 0;
      player.position.y = run.elites.surfaceBelow(player.position); player.grounded = true;
      const { floor, ends } = lockedBarrage(e);
      const kind = ends[1].y - floor > 0.1 ? 'high' : 'low';
      if (jump) { player.position.y = floor + JUMP_FEET; player.grounded = false; }
      const h0 = hits.length;
      step(120, () => e.state === 'idle' && !run.elites.bullets.length);
      result[`${kind} vs ${jump ? 'jumping' : 'grounded'}`] = hits.length - h0;
    }
    const pass = result['low vs jumping'] === 0 && result['high vs grounded'] === 0 && result['low vs grounded'] === 1 && result['high vs jumping'] === 1;
    return ok(pass, result);
  },
});
// the rumble's Warning meshes round the Controller: its floor circle and its volume
function rumbleWarning(e) {
  const near = (o) => Math.hypot(o.position.x - e.base.x, o.position.z - e.base.z) < 0.01;
  const kids = e.tele.filter(near);
  return { floor: kids.find((o) => o.material instanceof TeleMaterial), volume: kids.find((o) => o.material instanceof VolumeMaterial) };
}
story('elites/controller-rumble-is-a-dome', {
  about: "The rumble's Warning is a floor circle with a dome over it (22 cm), filling together; both go when it hits.",
  setup() { startController(1); },
  play() {
    const { run } = G(), e = run.elites.list.find((x) => x.kind === 'controller');
    step(400, () => e.state === 'windup' && e.stateT > 0.3);
    const w1 = rumbleWarning(e), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(15);
    const p2 = [w1.floor?.material.progress, w1.volume?.material.progress];
    const box = w1.volume ? new THREE.Box3().setFromObject(w1.volume) : null;
    const dome = !!box && box.min.y > e.base.y - 0.005 && Math.abs(box.max.y - e.base.y - 0.22) < 0.01 && Math.abs(box.max.x - box.min.x - 0.44) < 0.01;
    step(120, () => e.state === 'idle');
    const w3 = rumbleWarning(e), gone = !w3.floor && !w3.volume;
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && dome && gone, { p1, p2, dome, gone });
  },
});
story('elites/controller-rumble-hits-inside-the-dome', {
  about: 'The rumble hits (3 Health) and knocks back a jelly with any of it inside the dome, even in the air over it; one outside the dome isn\'t touched.',
  setup() { startController(1); },
  play() {
    const { run } = G(), e = run.elites.list.find((x) => x.kind === 'controller');
    const player = holdJelly(), hits = controllerHits(), knocks = record('knockback'), B = e.base, out = {};
    // where the jelly is as the rumble goes off: offset from the Controller, feet height
    const spots = { 'in the air inside': [0.1, 0.12], 'on the floor inside': [0.2, 0], 'on the floor outside': [0.3, 0], 'in the air above': [0.05, 0.24] };
    for (const [name, [dx, up]] of Object.entries(spots)) {
      e.next = 1; e.cool = 0;
      player.position.set(B.x + 0.18, B.y, B.z); player.grounded = true;   // where it sees you
      step(400, () => e.state === 'windup' && e.stateT > 1.0);
      player.position.set(B.x + dx, B.y + up, B.z); player.grounded = up === 0;
      const h0 = hits.length, k0 = knocks.length;
      step(60, () => e.state === 'idle');
      out[name] = [hits.length - h0, knocks.length - k0, hits[h0]?.amount ?? 0];
    }
    const yes = (r) => r[0] === 1 && r[1] === 1 && r[2] === 3, no = (r) => r[0] === 0 && r[1] === 0;
    const pass = yes(out['in the air inside']) && yes(out['on the floor inside']) && no(out['on the floor outside']) && no(out['in the air above']);
    return ok(pass, out);
  },
});
for (const [atk, name] of [[0, 'barrage'], [1, 'rumble']]) {
  story(`elites/controller-${name}-builds-no-shader`, {
    about: `Starting the Controller's ${name} builds no new shader: its Warning and Shots were built behind Play.`,
    setup() { startController(atk); },
    play() {
      const { run, APT, batcher } = G(), e = run.elites.list.find((x) => x.kind === 'controller'), programs = APT.renderer.info.programs.length;
      step(400, () => e.state === 'windup' && e.stateT > 0.5);
      const shown = e.tele.length;
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      if (atk === 0) { step(30, () => run.elites.bullets.length > 0); batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); }
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown > 0 && newShaders === 0, { shown, newShaders });
    },
  });
}

story('elites/controller-barrage-feedback', {
  about: 'Buttons press and charge, aim lock clicks once, and the original three Shots release with recoil and sound on the same frame. End fragments and contact sounds play once per Shot.',
  setup() { startController(0); },
  play() {
    const { run } = G(), E = run.elites, e = E.list.find(e => e.kind === 'controller'); holdJelly();
    let charge = 0, lock = 0, fire = 0, ends = 0;
    stub(sfx, 'controllerCharge', () => charge++); stub(sfx, 'controllerLock', () => lock++);
    stub(sfx, 'controllerFire', () => fire++); stub(sfx, 'controllerContact', () => ends++);
    step(400, () => e.state === 'windup' && e.stateT > 0.4);
    const pressed = e.model.buttons.every(b => b.position.y < 0.027 && b.material.emissiveIntensity > 1);
    step(80, () => e.volley === 1);
    const shots = [...E.bullets], released = e.stateT >= 0.85 && e.stateT < 0.88 && e.model.group.rotation.x < 0 && fire === 1;
    e.cool = 99; step(120, () => !E.bullets.length);
    const debris = G().fx.chunks.some(c => c.alive);
    return ok(pressed && released && charge === 1 && lock === 1 && ends === 3 && shots.length === 3 && shots.every(s => s.damage === 3 && Math.abs(s.v.length() - 0.9) < 1e-9) && debris,
      { pressed, released, charge, lock, fire, ends, shots: shots.length, debris });
  },
});

story('elites/controller-rumble-feedback-and-cleanup', {
  about: 'The motor charges once, then the original rumble releases one short cosmetic dome, recoil, debris and a harmless scuff. The dome fades and reset clears it; no extra damage is emitted by feedback.',
  setup() { startController(1); },
  play() {
    const { run, fx } = G(), E = run.elites, e = E.list.find(e => e.kind === 'controller'); holdJelly();
    let charge = 0, release = 0;
    stub(sfx, 'controllerCharge', () => charge++); stub(sfx, 'controllerRumble', () => release++);
    const hits = controllerHits();
    step(400, () => e.state === 'windup' && e.stateT > 0.8);
    const loaded = e.model.barMat.emissiveIntensity > 4.5 && e.model.group.scale.y < e.size;
    step(60, () => e.state === 'idle'); e.cool = 99;
    const p = E.controllerPulses[0], box = p && new THREE.Box3().setFromObject(p.m);
    const discharged = charge === 1 && release === 1 && p && Math.abs(box.max.y - e.base.y - 0.222) < 0.01 && e.model.group.rotation.x < 0;
    const aftermath = fx.chunks.some(c => c.alive) && fx.splats.some(s => s.alive);
    const h = hits.length; step(30);
    const faded = !E.controllerPulses.length && !p.m.parent && hits.length === h;
    e.next = 1; e.cool = 0; step(400, () => E.controllerPulses.length > 0);
    const last = E.controllerPulses[0]; run.start();
    return ok(loaded && discharged && aftermath && faded && !E.controllerPulses.length && !last.m.parent,
      { loaded, discharged: !!discharged, aftermath, faded, release, cleared: !E.controllerPulses.length });
  },
});

story('elites/controller-reduced-vibration', {
  about: 'Reduce Effects removes the new motor vibration while the filled dome and bright light bar still communicate the rumble.',
  setup() { startController(1); },
  play() {
    const { run } = G(), e = run.elites.list.find(e => e.kind === 'controller'), calm = juice.calm;
    try {
      juice.calm = true;
      step(400, () => e.state === 'windup' && e.stateT > 0.8);
      const g = e.model.group;
      return ok(g.position.x === 0 && g.position.z === 0 && e.tele.length === 2 && e.model.barMat.emissiveIntensity > 4.5,
        { x: g.position.x, z: g.position.z, warnings: e.tele.length });
    } finally { juice.calm = calm; }
  },
});

// --- 3D attacks: the Kettle's steam blast is a cone rising from the spout as it spreads (jumping
// the steam blast's Warning, as the scene holds it: its floor wedge and its cone volume
function steamWarning() {
  const kids = G().APT.scene.children, e = theKettle();
  const mine = (o) => e.tele.includes(o);
  return { floor: kids.find((o) => mine(o) && o.material instanceof TeleMaterial), volume: kids.find((o) => mine(o) && o.material instanceof VolumeMaterial) };
}
// where the steam cone starts on the counter, which way it points, and the way to its side
function steamAim() {
  const { floor } = steamWarning(), a = floor.rotation.y;
  return { apex: floor.position.clone(), dir: V(Math.sin(a), 0, Math.cos(a)), side: V(Math.cos(a), 0, -Math.sin(a)) };
}
const steamStarted = () => step(400, () => steamWarning().floor);
const steamBlowing = () => step(400, () => theKettle().state === 'windup' && theKettle().stateT >= 1.15);
function kettleHits() { const k = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === 'kettle') k.push(d); })); return k; }
story('elites/kettle-steam-warning-has-cone', {
  about: "The steam blast's Warning is a floor wedge with a cone volume over it, rising as it spreads to about 1.5x its half-width at the far end, filling together; both go after the blast.",
  setup() { startKettle(0); },
  play() {
    steamStarted();
    step(15);
    const w1 = steamWarning(), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(15);
    const w2 = steamWarning(), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    let shape = {};
    if (w1.volume) {
      const { apex, dir } = steamAim(), vol = new THREE.Box3().setFromObject(w1.volume), y0 = apex.y;
      const tall = vol.max.y - y0, near = apex.clone().addScaledVector(dir, 0.05), far = apex.clone().addScaledVector(dir, 0.45);
      const covers = (p) => p.x > vol.min.x && p.x < vol.max.x && p.z > vol.min.z && p.z < vol.max.z;
      // on the counter, about 0.5 * sin(0.45) * 1.5 = 33 cm tall at the far end, over the whole wedge
      shape = { onCounter: vol.min.y > y0 - 0.01, tall: +tall.toFixed(3), spans: covers(near) && covers(far) };
      shape.ok = shape.onCounter && tall > 0.28 && tall < 0.4 && shape.spans;
    }
    step(400, () => theKettle().state !== 'windup');
    const w3 = steamWarning(), gone = !w3.floor && !w3.volume;
    return ok(filling && shape.ok && gone, { p1, p2, shape, gone });
  },
});
story('elites/kettle-steam-hits-inside-the-cone-even-mid-jump', {
  about: "A jelly in the air inside the steam cone is still hit (3, source kettle); one beside the cone on the counter isn't.",
  setup() { startKettle(0); },
  play() {
    const hits = kettleHits();
    steamStarted();
    const { apex, dir, side } = steamAim();
    steamBlowing();
    const player = holdJelly();
    player.position.copy(apex).addScaledVector(dir, 0.25).setY(apex.y + 0.18); player.grounded = false;   // feet 18 cm up: near the top of a jump
    step(10);
    const inside = hits.length;
    player.position.copy(apex).addScaledVector(dir, 0.25).addScaledVector(side, 0.2).setY(apex.y); player.grounded = true;   // 20 cm to the side, the wedge is 12 cm wide there
    const before = hits.length;
    step(10);
    const beside = hits.length - before;
    return ok(inside >= 1 && hits[0].amount === 3 && beside === 0, { inside, beside });
  },
});
story('elites/kettle-steam-jumped-over-near-the-spout', {
  about: "Near the spout the steam cone is low (it rises as it spreads): a jelly 5 cm out from the spout with its feet 10 cm up is above it and isn't hit; one there with its feet 1 cm up is inside it and is (3).",
  setup() { startKettle(0); },
  play() {
    const hits = kettleHits();
    steamStarted();
    const { apex, dir } = steamAim();
    steamBlowing();
    const player = holdJelly();
    player.position.copy(apex).addScaledVector(dir, 0.05).setY(apex.y + 0.1); player.grounded = false;   // the cone is about 6 cm tall there
    const h0 = hits.length;
    step(10);
    const above = hits.length - h0;
    player.position.copy(apex).addScaledVector(dir, 0.05).setY(apex.y + 0.01);
    step(10);
    const inside = hits.length - h0 - above;
    return ok(above === 0 && inside >= 1 && hits.every((h) => h.amount === 3), { above, inside });
  },
});
const firstDrop =() => { step(400, () => G().run.elites.blobs.length > 0); return G().run.elites.blobs[0]; };
story('elites/kettle-drop-warning-has-volume', {
  about: "Each boiling drop's Warning is its orange floor circle with a half-sphere volume over it, filling together; both go when it lands.",
  setup() { startKettle(1); },
  play() {
    const b = firstDrop(), to = b.to.clone();
    step(20);
    const w1 = warningsAt(to), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(20);
    const w2 = warningsAt(to), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const dome = w1.volume ? new THREE.Box3().setFromObject(w1.volume) : null;
    const domed = !!dome && dome.min.y > to.y - 0.005 && dome.max.y > to.y + 0.025 && dome.max.y < to.y + 0.045;   // a 3.5 cm half sphere
    step(200, () => !G().run.elites.blobs.includes(b));
    const w3 = warningsAt(to), gone = !w3.floor && !w3.volume;
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && domed && gone, { p1, p2, domed, gone });
  },
});
story('elites/kettle-drop-hits-standing-jelly', {
  about: 'A jelly standing in a boiling drop\'s circle is hit by its Blast (3 Health).',
  setup() { startKettle(1); },
  play() {
    const hits = kettleHits(), b = firstDrop();
    holdJelly().position.copy(b.to);
    step(200, () => !G().run.elites.blobs.includes(b));
    return ok(hits.length >= 1 && hits[0].amount === 3, { hits: hits.map((h) => h.amount) });
  },
});
story('elites/kettle-drop-jumped-clear', {
  about: "A jelly in the air just above a boiling drop's 3.5 cm Blast when it lands is not hit.",
  setup() { startKettle(1); },
  play() {
    const hits = kettleHits(), b = firstDrop();
    const player = holdJelly();
    player.position.set(b.to.x, b.to.y + 0.045, b.to.z); player.grounded = false;   // feet 4.5 cm up: above a 3.5 cm dome
    step(200, () => !G().run.elites.blobs.includes(b));
    const landed = !G().run.elites.blobs.includes(b);
    return ok(landed && hits.length === 0, { landed, hits: hits.length });
  },
});
for (const [atk, name] of [[0, 'steam'], [1, 'boil-over']]) {
  story(`elites/kettle-${name}-builds-no-shader`, {
    about: `Starting the Kettle's ${name} builds no new shader: its Warning's floor shape and volume were built behind Play.`,
    setup() { startKettle(atk); },
    play() {
      const { APT, batcher } = G(), programs = APT.renderer.info.programs.length;
      let shown;
      if (atk === 0) { steamStarted(); step(5); shown = steamWarning(); } else { const b = firstDrop(); step(5); shown = warningsAt(b.to); }
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown.floor && shown.volume && newShaders === 0, { newShaders, volume: !!shown.volume });
    },
  });
}
