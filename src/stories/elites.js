// Stories: elites and their 3D attacks (Controller, Mug, Kettle). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CONTENT } from '../content.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { bus } from '../events.js';
import { FLOOR_SHAPES, floorShapeHits, shotTarget, hostile, TeleMaterial, VolumeMaterial } from '../vfx.js';
import { CONTROLLER_AT, G, JUMP_FEET, V, feelVoices, fresh, holdJelly, offs, ok, record, shownWarnings, startCoffeeLob, startController, startKettle, step, story, stub, theKettle, tp, warningsAt } from './kit.js';

// --- elites: targetable, and every attack telegraphs before it lands
const ELITE_SPOTS = { controller: [1.42, 0.61, 4.5], mug: [0.66, 0.78, 2.84], kettle: [4.6, 0.91, 3.8] };
for (const kind of ['controller', 'mug', 'kettle']) {
  story(`elites/${kind}-takes-bubbles`, {
    about: `Bubbles reach and hurt the ${kind} on its high ground.`,
    setup() { fresh(); tp(...ELITE_SPOTS[kind].map((v, i) => (i === 1 ? v + 0.05 : v)), 0); },
    play() {
      const { run, enemies, menus } = G();
      const e = run.elites.list.find((x) => x.kind === kind), hp0 = e.hp;
      holdJelly();   // stays put (the Mug's spill would wash it along the desk)
      step(600, () => { if (menus.open) menus.close(); });
      const dmg = Math.round(hp0 - e.hp);
      return ok(enemies.list.includes(e.entry) && dmg > 60, { dmg });
    },
  });
  for (const atk of [0, 1]) {
    const when = { controller: [0.45, 0.8], mug: [0.6, 0.6], kettle: [1.6, 0.6] }[kind][atk];
    const at = { controller: [[1.62, 0.61, 4.47], [1.55, 0.61, 4.45]], mug: [[0.62, 0.78, 2.95], [0.62, 0.78, 3.0]], kettle: [[4.5, 0.91, 3.45], [4.5, 0.91, 3.45]] }[kind][atk];
    const name = { controller: ['barrage', 'rumble'], mug: ['lob', 'spill'], kettle: ['steam-ball', 'boil-dry'] }[kind][atk];
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
        if (kind === 'kettle' && atk === 0) {       // the steam ball is fired at you
          const b = run.elites.blobs[0];
          aimed = !!b && Math.hypot(b.to.x - player.position.x, b.to.z - player.position.z) < 0.03;
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
for (const [atk, name] of [[0, 'barrage'], [1, 'rumble'], [2, 'arrow']]) {
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
  about: 'Four symbols charge with pressed buttons and click once; each then discharges on its own frame with recoil, its shape pulse, a localized impact and mechanical sound; all pulses fade.',
  setup() { startController(0); },
  play() {
    const {run,fx}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'); holdJelly();
    let charge=0, lock=0, fire=0, ends=0;
    stub(sfx,'controllerCharge',()=>charge++); stub(sfx,'controllerLock',()=>lock++);
    stub(sfx,'controllerFire',()=>fire++); stub(sfx,'controllerContact',()=>ends++);
    step(400,()=>e.state==='windup' && e.stateT>.4);
    const pressed=e.model.buttons.every(b=>b.position.y<.027) && e.model.buttons[e.combo[0]].material.emissiveIntensity>1;
    const pulses=new Set();
    step(200,()=>{ E.controllerPulses.forEach(p=>pulses.add(p)); return e.state==='idle'; }); e.cool=99;
    const released=e.state==='idle' && e.model.group.rotation.x<0 && !E.bullets.length;
    const debris=fx.chunks.some(c=>c.alive); step(30);
    return ok(pressed && released && charge===1 && lock===1 && fire===4 && ends===4 && pulses.size===4 && debris && !E.controllerPulses.length && [...pulses].every(p=>!p.m.parent),
      {pressed,released,charge,lock,fire,ends,debris,pulses:pulses.size});
  },
});

story('elites/controller-barrage-goes-off-in-button-order', {
  about: "Button combo: the four symbols go off one at a time, gap s apart, in the order the Controller's buttons light (the next one's button glows hottest, spent ones go dark); each symbol's Warning fills to its own moment, so the fullest goes next. A jelly that steps into a symbol that already went off is not hit.",
  setup() { startController(0, { hurt: true }); },
  play() {
    const {run}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'), player=holdJelly(), D=e.def.skills.barrage, hits=controllerHits();
    step(400,()=>e.state==='windup' && e.stateT>D.windup*0.5);
    const order=[...e.combo], vols=()=>e.tele.filter(m=>m.material instanceof VolumeMaterial);
    const fill=Object.fromEntries(vols().map(m=>[m.userData.i,m.material.progress]));
    const fullestNext=order.every((i,k)=>!k || fill[order[k-1]]>fill[i]);
    const hot=e.model.buttons.reduce((b,x,i,a)=>x.material.emissiveIntensity>a[b].material.emissiveIntensity?i:b,0)===order[0];
    const firstAt=vols().find(m=>m.userData.i===order[0]).position.clone();
    player.position.y+=0.3; player.grounded=false;                     // up out of every symbol until the first has gone
    const gone=[], times=[];
    step(400,()=>{ const left=vols().map(m=>m.userData.i), went=order.filter(i=>!left.includes(i)&&!gone.includes(i));
      for (const i of went) { gone.push(i); times.push(e.stateT); if (gone.length===1) { player.position.copy(firstAt); player.grounded=true; } }   // step into the spent one
      return e.state==='idle'; });
    const gaps=times.slice(1).map((t,k)=>+(t-times[k]).toFixed(2)), inOrder=gone.join()===order.join();
    const spaced=gaps.length===3 && gaps.every(g=>Math.abs(g-D.gap)<0.05);
    return ok(fullestNext && hot && inOrder && spaced && hits.length===0,{order,gone,gaps,fullestNext,hot,hits:hits.length});
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

// --- 3D attacks: the Kettle's steam ball charges with nothing on the counter, then is fired at
// where the jelly is and bursts there in gusts, each a floor Blast (step out of it while it flies)
const firstBall = () => { step(400, () => G().run.elites.blobs.length > 0); return G().run.elites.blobs[0]; };
function kettleHits() { const k = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === 'kettle') k.push(d); })); return k; }
story('elites/kettle-steam-ball-warns-only-once-fired', {
  about: "While the Kettle charges its steam ball (about 1 s, the ball swelling at the spout) nothing shows on the counter; the frame it fires, an orange circle with a half dome over it shows where the jelly stood, filling together while the ball flies; both go once its gusts are over.",
  setup() { startKettle(0); },
  play() {
    const { run, player } = G(), E = run.elites, e = theKettle();
    holdJelly();
    const t0 = performance.now(), sizes = [];
    let quiet = true, frames = 0;
    step(400, () => {
      if (e.state === 'windup' && !e.launched) { frames++; if (shownWarnings().floor.length || shownWarnings().volume.length || E.blobs.length) quiet = false; if (e.ball) sizes.push(e.ball.userData.orb.size); }
      return E.blobs.length > 0;
    });
    const charged = +(frames / 60).toFixed(2), grew = sizes.length > 10 && sizes.at(-1) > sizes[0] * 3;
    const b = E.blobs[0], to = b.to.clone(), onYou = Math.hypot(to.x - player.position.x, to.z - player.position.z) < 0.01;
    const w1 = warningsAt(to), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(10);
    const w2 = warningsAt(to), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const filling = !!(w1.floor && w1.volume) && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    step(400, () => e.state === 'idle');
    const w3 = warningsAt(to), gone = !w3.floor && !w3.volume;
    return ok(quiet && charged > 0.9 && charged < 1.1 && grew && onYou && filling && gone, { quiet, charged, grew, onYou, p1, p2, gone, ms: Math.round(performance.now() - t0) });
  },
});
story('elites/kettle-steam-ball-volley-hits-standing-jelly', {
  about: 'Once charged, the Kettle fires its steam balls in a row (shots, every s apart), each at where the jelly is; a jelly standing still is hit by their gusts (3 Health, source kettle) and shoved, and every ball bursts in its gusts.',
  setup() { startKettle(0); },
  play() {
    const hits = kettleHits(), shoves = record('knockback'), { n } = feelVoices('kettleGust'), B = theKettle().def.skills.ball;
    holdJelly();
    const E = G().run.elites, launches = [];
    let seen = 0;
    step(400, () => { const k = theKettle().fired || 0; if (k > seen) { seen = k; launches.push(k); } return theKettle().state === 'idle' && seen > 0; });
    const { player } = G(), allOnYou = E.blobs.length === 0;
    return ok(seen === B.shots && B.shots >= 3 && hits.length >= 1 && hits[0].amount === 3 && shoves.length >= 1 && n.kettleGust.length === B.shots * B.gusts && allOnYou,
      { shots: seen, hits: hits.map((h) => h.amount), shoves: shoves.length, gusts: n.kettleGust.length, at: [player.position.x, player.position.z].map((v) => +v.toFixed(2)) });
  },
});
story('elites/kettle-steam-ball-volley-aims-at-each-new-spot', {
  about: 'Each steam ball in the volley locks on where the jelly is as it leaves: a jelly that moves 15 cm after every shot is never hit, and each ball lands where the jelly was when it fired.',
  setup() { startKettle(0); },
  play() {
    const hits = kettleHits(), player = holdJelly(), E = G().run.elites, aims = [];
    let seen = 0;
    step(400, () => {
      const k = theKettle().fired || 0;
      if (k > seen) { seen = k; const b = E.blobs.at(-1); aims.push(+Math.hypot(b.to.x - player.position.x, b.to.z - player.position.z).toFixed(3)); if (seen === 2) player.position.z += 0.15; else player.position.x += seen === 1 ? 0.15 : -0.15; }   // round three corners of a 15 cm square
      return theKettle().state === 'idle' && seen > 0;
    });
    return ok(seen >= 3 && aims.every((d) => d < 0.01) && hits.length === 0, { shots: seen, aims, hits: hits.length });
  },
});
story('elites/kettle-steam-ball-leads-a-moving-jelly', {
  about: 'Each steam ball aims where a swimming jelly will be as it lands (its position plus its velocity times the flight, lead=1): keeping on in one direction walks into it; a jelly standing still is aimed at where it stands.',
  setup() { startKettle(0); },
  play() {
    const player = holdJelly(), E = G().run.elites, B = theKettle().def.skills.ball;
    player.velocity.set(0, 0, -0.3);                                // swimming along the counter (holdJelly keeps it there)
    step(400, () => E.blobs.length > 0);
    const b = E.blobs[0], want = player.position.clone().addScaledVector(player.velocity, B.lead * B.flight);
    const ahead = +Math.hypot(b.to.x - want.x, b.to.z - want.z).toFixed(3), lead = +Math.hypot(b.to.x - player.position.x, b.to.z - player.position.z).toFixed(3);
    return ok(ahead < 0.01 && lead > 0.15, { ahead, lead });
  },
});
// the Kettle's Boil dry: its lid lands away from you, a white circle round it; the steam then covers
// its reach round the Kettle except that circle
function boilDry(where) {
  const e = theKettle(), player = holdJelly(), hits = kettleHits(), D = e.def.skills.boil;
  if (where === 'stay') { player.position.x = e.base.x; player.position.z = e.base.z + D.reach * 0.5; }   // inside the steam's reach
  let safe = null, filling = false, p0 = null;
  step(400, () => {
    if (!safe && e.lidFly?.landed) {
      safe = e.lidFly.at.clone();
      const T = e.tele.find((m) => m.material.uniforms?.uColor && m.position.distanceTo(e.base) < 0.01);
      p0 = T?.material.progress;
      if (where === 'lid') player.position.copy(safe);
      if (where === 'out') player.position.set(e.base.x, e.base.y, e.base.z + D.reach + 0.08);
    }
    if (safe && p0 != null && !filling) { const T = e.tele.find((m) => m.position.distanceTo(e.base) < 0.01); filling = !!T && T.material.progress > p0; }
    return e.state === 'idle' && safe;
  });
  return { safe, hits: hits.map((h) => h.amount), filling, away: safe ? +Math.hypot(safe.x - player.position.x, safe.z - player.position.z).toFixed(2) : null };
}
story('elites/kettle-boil-dry', {
  about: "Boil dry: the lid pops off and lands on the stove at least away= from the jelly, a white circle round it; an orange circle with a dome over it fills round the Kettle; then steam covers all its reach: 3 to a jelly that stayed in it, nothing to one on the lid's circle or out of reach. The lid goes back on after.",
  setup() { startKettle(1); },
  play() {
    const out = {};
    for (const where of ['stay', 'lid', 'out']) {
      startKettle(1);
      const P0 = G().player.position.clone(), r = boilDry(where), e = theKettle();
      out[where] = { ...r, farFromStart: r.safe ? +Math.hypot(r.safe.x - P0.x, r.safe.z - P0.z).toFixed(2) : null, lidBack: e.model.lid.visible };
    }
    const D = theKettle().def.skills.boil, { stay, lid, out: o } = out;
    return ok(stay.hits[0] === 3 && stay.farFromStart >= D.away - 0.01 && stay.filling && !lid.hits.length && !o.hits.length && stay.lidBack, out);
  },
});
for (const [atk, name] of [[0, 'steam-ball'], [1, 'boil-dry']]) {
  story(`elites/kettle-${name}-builds-no-shader`, {
    about: `Starting the Kettle's ${name} builds no new shader: its Warning's floor shape and volume were built behind Play.`,
    setup() { startKettle(atk); },
    play() {
      const { APT, batcher } = G(), programs = APT.renderer.info.programs.length;
      let shown;
      if (atk === 0) { const b = firstBall(); step(5); shown = warningsAt(b.to); } else { const e = theKettle(); step(400, () => e.lidFly && e.tele.length >= 2); step(5); shown = warningsAt(e.base); }
      batcher.sync(); G().GAME.compile();
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown.floor && shown.volume && newShaders === 0, { newShaders, volume: !!shown.volume });
    },
  });
}

story('elites/controller-overlapping-shapes-hit-once', {
  about: 'Even four overlapping symbols going off one after another subtract exactly 3 Health once; their harmless pulses cannot hurt again.',
  setup() { startController(0,{hurt:true}); },
  play() {
    const {run}=G(), E=run.elites, e=E.list.find(e=>e.kind==='controller'), player=holdJelly(), hp=run.health;
    stub(e.def.skills,'barrage',{...e.def.skills.barrage,spread:0});
    step(400,()=>e.tele.length===8); player.position.copy(e.tele[1].position);
    const hits=controllerHits(); step(200,()=>e.state==='idle'); e.cool=99; step(40);
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
      step(200,()=>e.state==='idle'); e.cool=99;
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
story('elites/kettle-steam-ball-feel', {
  about: 'The Kettle charges with a rising whistle, shaking harder and its lid rattling; it fires each ball of its volley on one frame (a flash at the spout, the Kettle kicking back with its lid jumping, a crack and hiss, a light shake); the balls trail steam; they land with a flash and the impact shake on the jelly and burst in gusts, and leaves the counter wet for a moment.',
  setup() { startKettle(0); },
  play() {
    const { fx } = G(), e = theKettle(), hits = kettleHits();
    const { feels, n } = feelVoices('kettleCharge', 'kettleBlast', 'kettleGust');
    holdJelly();
    step(400, () => e.state === 'windup' && e.stateT > 1.0 && !e.launched);
    const shaking = Math.abs(e.model.group.rotation.z) > 0 || e.model.lid.position.y > 0.112;
    step(60, () => e.fired >= 1);
    const released = e.kick > 0.8 && n.kettleBlast.length === 1 && e.fired === 1 && e.model.lid.position.y > 0.12 && feels.includes('hit');
    step(200, () => e.state === 'idle');
    const wet = fx.splats.filter((s) => s.alive).length;
    return ok(n.kettleCharge.length === 1 && shaking && released && hits.length >= 1 && feels.includes('impact') && n.kettleGust.length === e.def.skills.ball.shots * e.def.skills.ball.gusts && wet >= 3,
      { charge: n.kettleCharge.length, shaking, released, hits: hits.length, feels: [...new Set(feels)], gusts: n.kettleGust.length, wet });
  },
});
story('elites/kettle-boil-dry-feel', {
  about: 'The lid pops on one frame (a flash at the lid, the Kettle kicking, a clank and burble) and clatters down; the steam goes off with a big shake (feel impact-big), a gust on a caught jelly, and puffs all over its reach.',
  setup() { startKettle(1); },
  play() {
    const e = theKettle(), hits = kettleHits();
    const { feels, n } = feelVoices('kettlePop', 'kettleDrop', 'kettleGust');
    const player = holdJelly();
    player.position.x = e.base.x; player.position.z = e.base.z + e.def.skills.boil.reach * 0.5;   // inside the steam's reach
    step(400, () => n.kettlePop.length);
    const released = e.kick > 0.5 && !!e.lidFly;
    step(400, () => e.state === 'idle');
    return ok(released && n.kettleDrop.length === 1 && hits.length === 1 && n.kettleGust.includes(true) && feels.includes('impact-big'), { released, hits: hits.length, gusts: n.kettleGust, feels: [...new Set(feels)] });
  },
});

story('elites/mug-spill-washes-you-along', {
  about: "Spill: a lane Warning (a strip with the box over it) fills along the line while the Mug tips; the wave poured down it scalds a jelly on the line (3) and washes it along toward the line's end; one beside the line is not touched.",
  setup() { fresh({ bubbles: false, lash: false }); tp(0.62, 0.83, 3.0, 0); },
  play() {
    const out = {};
    for (const side of [0, 0.1]) {
      fresh({ bubbles: false, lash: false }); tp(0.35, 0.83, 2.85, 0);
      const { run, player } = G(), e = run.elites.list.find((x) => x.kind === 'mug'), log = record('damage_taken');
      e.next = 1; e.cool = 0;
      let lane = false, dir = null, start = null, pushed = 0;
      step(400, () => {
        if (!lane && e.tele.some((m) => m.material.kind === 'lane')) {
          lane = true; dir = e.spillDir.clone(); player.position.addScaledVector(V(dir.z, 0, -dir.x), side); start = player.position.clone();
        }
        if (run.elites.pull) pushed = Math.max(pushed, run.elites.pull.dot(dir));
        return e.state === 'idle' && lane;
      });
      out[side ? 'beside' : 'on'] = { lane, hits: log.filter((d) => d.source === 'mug').map((d) => d.amount), pushed: +pushed.toFixed(2), moved: start ? +player.position.clone().sub(start).dot(dir).toFixed(2) : null };
    }
    const { on, beside } = out;
    return ok(on.lane && on.hits[0] === 3 && on.pushed > 0.5 && on.moved > 0.1 && !beside.hits.length, out);
  },
});

// --- circling an Elite tightly doesn't stall it: it attacks anyway (it used to wait to face you,
// and at walking speed close in it never caught up)
for (const kind of ['controller', 'mug', 'kettle']) {
  story(`elites/${kind}-attacks-while-circled`, {
    about: `Swimming tight circles round the ${kind} at walking speed doesn't stop it attacking.`,
    setup() { fresh({ bubbles: false, lash: false }); tp(...ELITE_SPOTS[kind].map((v, i) => (i === 1 ? v + 0.05 : v)), 0); },
    play() {
      const { run } = G(), e = run.elites.list.find((x) => x.kind === kind);
      const r = 0.12, w = CONFIG.player.walkSpeed / r, c = e.base, y = holdJelly().position.y;
      const P = G().player.position;
      let a = Math.atan2(P.x - c.x, P.z - c.z);
      const circle = () => { a += w / 60; P.set(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r); };
      step(90, () => { e.cool = 1; circle(); });   // a lap and a half first, so its turn has fallen behind
      e.cool = 0;
      const frames = step(240, () => { circle(); return e.state !== 'idle'; });
      return ok(e.state !== 'idle', { frames, state: e.state, w: +w.toFixed(2) });
    },
  });
}

// --- the Controller's third attack: the arrow drop
const arrowParts = (e) => ({ arrow: e.tele.find((m) => m.geometry && !m.material.uniforms), floor: e.tele.find((m) => m.material instanceof TeleMaterial), volume: e.tele.find((m) => m.material instanceof VolumeMaterial) });
// start an arrow drop with Math.random fixed at `roll` (which way it comes: roll * the ways open to you), jelly at `up` m off the floor
function startArrow(roll, up = 0) {
  const e = startController(2), player = holdJelly(), real = Math.random.real || Math.random;
  Math.random = () => roll; Math.random.real = real; offs.push(() => { Math.random = real; });
  player.position.set(CONTROLLER_AT[0] + 0.2, CONTROLLER_AT[1] + up, CONTROLLER_AT[2]); player.grounded = up === 0;
  return { e, player };
}
story('elites/controller-arrow-drop-warns-then-strikes', {
  about: 'The arrow hovers a little way off you for about 1 s with no circle or dome (the arrow is the whole warning); then it flies the way it points and hits for 3 Health. Down hangs above you; left and right sit to the side, level with you. Standing where it lands hurts; stepping aside does not.',
  setup() { fresh(); },
  play() {
    const out = {};
    for (const [dir, roll] of [['down', 0], ['left', 0.4], ['right', 0.7]]) {
      const { e, player } = startArrow(roll), D = e.def.skills.arrow, hits = controllerHits(), tempo = CONTENT.elites.pace.tempo;
      step(400, () => e.state === 'windup' && e.stateT / tempo > D.warn * 0.5);
      const { arrow, floor, volume } = arrowParts(e), P = player.position;
      const rel = arrow ? [arrow.position.x - P.x, arrow.position.y - P.y, arrow.position.z - P.z] : [9, 9, 9];
      const shape = e.arrowDir === dir && !!arrow && !floor && !volume;   // just the arrow: no circle, no dome
      const where = dir === 'down' ? rel[1] > 0.1 && Math.hypot(rel[0], rel[2]) < 0.01 : Math.hypot(rel[0], rel[2]) > 0.1 && Math.abs(rel[1] - CONFIG.player.height / 2) < 0.01;
      const t0 = e.stateT; step(400, () => e.state === 'idle'); const total = (e.stateT - t0) / tempo;
      out[dir] = { shape, where, hit: hits.length === 1 && hits[0].amount === D.dmg, gone: !arrow.parent && !e.tele.length };
      // the same attack again, but out of the way by the time it lands
      e.next = 2; e.cool = 0; hits.length = 0;
      step(400, () => e.state === 'windup' && e.stateT / tempo > D.warn * 0.9);
      player.position.x += 0.3;
      step(400, () => e.state === 'idle');
      out[dir].dodged = hits.length === 0;
      if (!Object.values(out[dir]).every((v) => v === true)) break;
    }
    return ok(['down', 'left', 'right'].every((d) => out[d] && Object.values(out[d]).every((v) => v === true)), out);
  },
});
story('elites/controller-arrow-up-only-in-the-air', {
  about: "The arrow comes up from below only when you are already in the air; on the floor the roll can never pick it.",
  setup() { fresh(); },
  play() {
    const grounded = startArrow(0.99).e; step(400, () => grounded.state === 'windup' && !!grounded.arrowDir);
    const g = grounded.arrowDir;
    const air = startArrow(0.99, 0.09).e;
    stub(G().run.elites, 'canSee', () => true);   // (the console's lip hides a jelly this high from its muzzle)
    step(400, () => air.state === 'windup' && !!air.arrowDir);
    const a = air.arrowDir, arrow = arrowParts(air).arrow, below = !!arrow && arrow.position.y < air.arrowAt.y;
    return ok(g === 'right' && a === 'up' && below, { g, a, below });
  },
});

story('elites/a-beaten-elite-drops-no-xp', {
  about: 'A beaten Elite leaves its Treasure and no XP: no XP drop on the floor and no +XP number.',
  setup() { fresh(); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G();
    const drops = () => run.xpDrops.list?.length ?? run.xpDrops.drops?.length ?? 0;
    const before = drops(), xp0 = run.xp;
    run.eliteDefeated(run.elites.alive[0]);
    step(30);
    return ok(drops() === before && run.xp === xp0, { before, after: drops(), xp: run.xp });
  },
});
