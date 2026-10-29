// Stories: elites and their 3D attacks (Controller, Mug, Kettle). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { bus } from '../events.js';
import { FLOOR_SHAPES, floorShapeHits, shotTarget, hostile, TeleMaterial, VolumeMaterial } from '../vfx.js';
import { CONTROLLER_AT, G, JUMP_FEET, V, feelVoices, fresh, holdJelly, offs, ok, record, startCoffeeLob, startController, startKettle, step, story, stub, theKettle, tp, warningsAt } from './kit.js';

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
    batcher.sync(); G().GAME.compile();
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(w.floor && w.volume && newShaders === 0, { newShaders, volume: !!w.volume });
  },
});

// --- The shared Shot aims in 3D; Controller explosions use fixed floor prisms.
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
story('elites/controller-four-fixed-floor-shapes', {
  about: 'Four recognizable floor symbols and matching 6 cm prisms charge together, stay fixed when the player moves, then disappear together.',
  setup() { startController(0); },
  play() {
    const { run } = G(), e = run.elites.list.find(e => e.kind === 'controller'), player = holdJelly();
    step(400, () => e.tele.length === 8);
    const floors = e.tele.filter(m => m.material instanceof TeleMaterial), vols = e.tele.filter(m => m.material instanceof VolumeMaterial);
    const positions = e.tele.map(m => m.position.clone()), first = floors[0].material.progress;
    const dimensions = vols.every(m => { const box = new THREE.Box3().setFromObject(m); return Math.abs(box.max.y-box.min.y-.06)<1e-5 && Math.abs(box.min.y-m.position.y)<1e-5; });
    const centered = Math.hypot(floors[0].position.x-player.position.x, floors[0].position.z-player.position.z)<1e-6;
    player.position.x += .35; step(20);
    const fixed = e.tele.every((m,i) => m.position.distanceTo(positions[i])<1e-8);
    const filling = floors.every((m,i) => m.material.progress>first && m.material.progress === vols[i].material.progress);
    const kinds = floors.map(m => m.material.shape).join(',');
    step(120, () => e.state === 'idle');
    return ok(centered && dimensions && fixed && filling && kinds === 'circle,square,triangle,x' && !e.tele.length && !run.elites.bullets.length,
      { centered, dimensions, fixed, filling, kinds, warnings: e.tele.length });
  },
});
story('elites/controller-shapes-hit-and-can-be-dodged', {
  about: 'Each of the four shapes deals 3 damage on the floor, but misses above its 6 cm top or outside its footprint; it never hits again after detonation.',
  setup() { startController(0); },
  play() {
    const { run } = G(), E = run.elites, e = E.list.find(e => e.kind === 'controller'), player = holdJelly(), hits = controllerHits(), result = {};
    for (const kind of FLOOR_SHAPES) for (const dodge of ['none','jump','step']) {
      player.position.set(...CONTROLLER_AT); e.next=0; e.cool=0;
      step(400, () => e.tele.length === 8 && e.stateT>.3);
      const m = e.tele.find(m => m.material instanceof VolumeMaterial && m.userData.symbol === kind);
      if (!m) return ok(false,{kind,dodge,state:e.state,tele:e.tele.length,hp:e.hp,phase:run.phase,next:e.next,time:e.stateT,position:player.position.toArray()});
      player.position.copy(m.position);
      if (dodge === 'jump') player.position.y += JUMP_FEET;
      if (dodge === 'step') player.position.x += 2;
      const n = hits.length;
      step(120, () => e.state === 'idle'); e.cool=99; step(30);
      result[kind+' '+dodge] = hits.length-n;
    }
    const pass = Object.entries(result).every(([k,n]) => n === (k.endsWith('none') ? 1 : 0));
    return ok(pass && hits.every(h => h.amount === 3), result);
  },
});
story('elites/controller-shape-footprints', {
  about: 'The square corners and triangle/X gaps match their visible polygons, rather than using one circular damage area for all symbols.',
  setup() {},
  play() {
    const at=V(0,0,0), body={height:.09,radius:.001}, hit=(k,x,z,y=0)=>floorShapeHits(k,at,1,.06,V(x,y,z),body);
    const yes = [hit('circle',0,0),hit('square',.9,.9),hit('triangle',0,-.9),hit('x',.6,.6),hit('x',-.6,.6)];
    const no = [hit('circle',.9,.9),hit('square',1.1,0),hit('triangle',.7,-.7),hit('x',.7,0),hit('x',0,.7),hit('square',0,0,.061),hit('circle',0,0,-.1)];
    return ok(yes.every(Boolean) && no.every(v=>!v), { yes, no });
  },
});
story('elites/controller-shapes-cancel-on-death-and-reset', {
  about: 'Death or restarting removes all eight warning meshes and cancels their damage; completed cosmetic pulses fade and reset removes them.',
  setup() { startController(0); },
  play() {
    const {run}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'); holdJelly(); const hits=controllerHits();
    step(400,()=>e.tele.length===8); const meshes=[...e.tele]; e.damage(e.hp); step(100);
    const dead = !e.tele.length && meshes.every(m=>!m.parent) && !hits.length;
    startController(0); const next=E.list.find(e=>e.kind==='controller'); holdJelly();
    step(400,()=>next.tele.length===8); const pending=[...next.tele]; E.clear(); step(100);
    return ok(dead && pending.every(m=>!m.parent) && !E.controllerPulses.length, {dead, cleared:pending.every(m=>!m.parent)});
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
    about: `Starting the Controller's ${name} builds no new shader: its warnings and explosions were built behind Play.`,
    setup() { startController(atk); },
    play() {
      const { run, APT, batcher } = G(), e = run.elites.list.find((x) => x.kind === 'controller'), programs = APT.renderer.info.programs.length;
      step(400, () => e.state === 'windup' && e.stateT > 0.5);
      const shown = e.tele.length;
      batcher.sync(); G().GAME.compile();
      if (atk === 0) { step(120, () => run.elites.controllerPulses.length > 0); batcher.sync(); G().GAME.compile(); }
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown > 0 && newShaders === 0, { shown, newShaders });
    },
  });
}

story('elites/controller-barrage-feedback', {
  about: 'Four symbols charge with pressed buttons, click once and discharge with same-frame recoil, shape pulses, localized impact and mechanical sound; all pulses fade.',
  setup() { startController(0); },
  play() {
    const {run,fx}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'); holdJelly();
    let charge=0, lock=0, fire=0, ends=0;
    stub(sfx,'controllerCharge',()=>charge++); stub(sfx,'controllerLock',()=>lock++);
    stub(sfx,'controllerFire',()=>fire++); stub(sfx,'controllerContact',()=>ends++);
    step(400,()=>e.state==='windup' && e.stateT>.4);
    const pressed=e.model.buttons.every(b=>b.position.y<.027 && b.material.emissiveIntensity>1);
    step(120,()=>E.controllerPulses.length===4); e.cool=99;
    const pulses=[...E.controllerPulses], released=e.state==='idle' && e.model.group.rotation.x<0 && !E.bullets.length;
    const debris=fx.chunks.some(c=>c.alive); step(30);
    return ok(pressed && released && charge===1 && lock===1 && fire===1 && ends===1 && debris && !E.controllerPulses.length && pulses.every(p=>!p.m.parent),
      {pressed,released,charge,lock,fire,ends,debris,pulses:pulses.length});
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
      batcher.sync(); G().GAME.compile();
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown.floor && shown.volume && newShaders === 0, { newShaders, volume: !!shown.volume });
    },
  });
}

story('elites/controller-overlapping-shapes-hit-once', {
  about: 'Even four overlapping symbols subtract exactly 3 Health once; their harmless pulses cannot hurt again.',
  setup() { startController(0,{hurt:true}); },
  play() {
    const {run}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'), player=holdJelly(), hp=run.health;
    stub(e.def.skills,'barrage',{...e.def.skills.barrage,spread:0});
    step(400,()=>e.tele.length===8); player.position.copy(e.tele[1].position);
    const hits=controllerHits(); step(120,()=>E.controllerPulses.length===4); e.cool=99; step(40);
    return ok(hits.length===1 && run.health===hp-3 && !E.controllerPulses.length,{hits:hits.length,damage:hp-run.health});
  },
});
story('phone/controller-shapes-on-low', {
  phone: true,
  about: 'On a phone, Reduce Effects keeps all four floor symbols and matching prisms readable, without new shaders during charging or detonation.',
  setup() { startController(0); },
  play() {
    const {run,APT,batcher}=G(), e=run.elites.list.find(e=>e.kind==='controller'); holdJelly();
    const calm=juice.calm, programs=APT.renderer.info.programs.length;
    try {
      juice.calm=true; step(400,()=>e.tele.length===8 && e.stateT>.5);
      const visible=e.tele.length===8 && e.tele.every(m=>m.visible && m.material.progress>0 && m.material.opacity>.5);
      batcher.sync(); G().GAME.compile();
      step(120,()=>run.elites.controllerPulses.length===4); e.cool=99;
      batcher.sync(); G().GAME.compile();
      return ok(visible && APT.renderer.info.programs.length===programs,{visible,newShaders:APT.renderer.info.programs.length-programs});
    } finally {juice.calm=calm;}
  },
});
story('elites/controller-explosion-ring-first-frame-size', {
  about: 'A new or recycled impact ring starts at its intended small size on the exact release frame, rather than briefly covering the whole console.',
  setup() { startController(0); },
  play() {
    const {fx}=G(), at=V(...CONTROLLER_AT); fx.clear();
    fx.ring(at,hostile('controller'),.072,.3); const ring=fx.rings.find(r=>r.alive), initial=ring.m.scale.x;
    step(30); fx.ring(at,hostile('controller'),.03,.3);
    return ok(Math.abs(initial-.0144)<1e-8 && Math.abs(ring.m.scale.x-.006)<1e-8 && ring.m.userData.opacity===.9,{initial,reused:ring.m.scale.x});
  },
});

// --- Attack Feel (docs/agents/attack-feel.md): the Mug's and Kettle's attacks complete the chain on a real hit
story('elites/mug-coffee-feel', {
  about: 'Each coffee lob is flung with a flash at the rim, the Mug leaning back and a slosh-and-whoosh on the throw frame; landing on the jelly it throws coffee drops, a wet slap with patter and shakes the screen (feel impact); standing in the puddle steams and sizzles off the jelly.',
  setup() { startCoffeeLob(); },
  play() {
    const { run, fx } = G(), E = run.elites, e = E.list.find((x) => x.kind === 'mug'), hits = coffeeHits();
    const { feels, n } = feelVoices('mugLob', 'mugSplash', 'scald');
    const b = firstCoffee(), kicked = e.kick > 0.8 && n.mugLob.length === 1;
    step(200, () => !E.blobs.includes(b));
    const drops = fx.chunks.some((c) => c.alive);
    step(30);
    return ok(kicked && hits.length >= 1 && n.mugSplash.includes(true) && feels.includes('impact') && drops && n.scald.length >= 1,
      { kicked, hits: hits.length, splash: n.mugSplash, feels: [...new Set(feels)], drops, scald: n.scald.length });
  },
});
story('elites/mug-spill-feel', {
  about: 'The spill lets go on one frame (a flash at the rim, the Mug jolting on as it tips, a glug and a light shake), each puddle splashes, and a jelly standing in the wave steams and sizzles.',
  setup() { fresh({ bubbles: false, lash: false }); tp(0.62, 0.83, 3.0, 0); const e = G().run.elites.list.find((x) => x.kind === 'mug'); e.next = 1; e.cool = 0; },
  play() {
    const E = G().run.elites, e = E.list.find((x) => x.kind === 'mug'), drains = record('damage_taken');
    const { feels, n } = feelVoices('mugPour', 'mugSplash', 'scald');
    step(400, () => e.state === 'windup' && e.poured >= 0);
    const released = e.kick > 0.8 && n.mugPour.length === 1 && feels.includes('hit');
    step(60, () => E.puddles.length >= 3);
    const player = holdJelly(), wet = E.puddles[2].m.position;
    player.position.set(wet.x, wet.y - 0.0015, wet.z); player.grounded = true;   // standing in the wave
    step(120, () => e.state === 'idle');
    const scalded = drains.some((d) => d.source === 'coffee');
    return ok(released && n.mugSplash.length >= 3 && scalded && n.scald.length >= 1, { released, splashes: n.mugSplash.length, scalded, scald: n.scald.length });
  },
});
story('elites/kettle-steam-feel', {
  about: 'The steam blast vents on one frame (a flash at the spout, the Kettle kicking back with its lid jumping, a crack and roaring hiss); where it scalds the jelly a flash and steam burst there with the impact shake; after it the counter stays wet along the cone for a moment.',
  setup() { startKettle(0); },
  play() {
    const { fx } = G(), e = theKettle(), hits = kettleHits();
    const { feels, n } = feelVoices('kettleBlast');
    steamStarted();
    const { apex, dir } = steamAim();
    step(400, () => e.blasted);
    const released = e.kick > 0.8 && n.kettleBlast.length === 1 && e.model.lid.position.y > 0.12;
    const player = holdJelly();
    player.position.copy(apex).addScaledVector(dir, 0.25); player.grounded = true;
    step(10);
    const struck = hits.length >= 1 && feels.includes('impact');
    step(120, () => e.state === 'idle');
    const wet = fx.splats.filter((s) => s.alive).length;
    return ok(released && struck && wet >= 3, { released, hits: hits.length, feels: [...new Set(feels)], wet });
  },
});
story('elites/kettle-boil-over-feel', {
  about: 'The lid pops on one frame (a flash at the lid, the Kettle kicking, a clank and burble); a boiling drop landing on the jelly plops and sizzles and shakes the screen (feel impact), and each drop leaves a harmless wet mark that fades.',
  setup() { startKettle(1); },
  play() {
    const { fx } = G(), e = theKettle(), hits = kettleHits();
    const { feels, n } = feelVoices('kettlePop', 'kettleDrop');
    const b = firstDrop(), released = e.kick > 0.5 && n.kettlePop.length === 1;
    holdJelly().position.copy(b.to);
    step(200, () => !G().run.elites.blobs.includes(b));
    const wet = fx.splats.some((s) => s.alive);
    return ok(released && hits.length >= 1 && n.kettleDrop.includes(true) && feels.includes('impact') && wet, { released, hits: hits.length, drops: n.kettleDrop, feels: [...new Set(feels)], wet });
  },
});
