// Stories: act 2: the hallway and bathroom (played in a page opened on act 2). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../events.js';
import { STAGES } from '../stages.js';
import { isDeep, pitch } from '../sfx.js';
import { TeleMaterial, VolumeMaterial, hostile } from '../vfx.js';
import { G, JUMP_FEET, V, act2, balloonWarning, besideSoap, byDoor, fresh, hallClock, holdJelly, offs, ok, onBench, record, restore, sim, soapElite, startClock, startSoap, step, story, stub, tp, warningsAt, whipper } from './kit.js';

// --- act 1 hands over to act 2
story('acts/act-1-leads-to-act-2', {
  about: 'Beating the act 1 boss, growing and taking a new element offers the way on to act 2, with the score so far.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    run.kills = 12;
    run.metamorph();
    document.querySelector('.jf-card')?.click();     // the evolution
    run.evolutionReveal.finish();                  // skip the transformation before the next reward
    document.querySelector('.jf-card')?.click();     // the boss's element reward
    const text = document.querySelector('.jf-modal, .jf-panel, #g-ui')?.innerText || document.body.innerText;
    const go = [...document.querySelectorAll('button')].some((b) => /On to act 2/.test(b.textContent));
    menus.close();
    return ok(go && /Act 1 complete/.test(text) && /Score so far/.test(text), { go, text: text.slice(0, 160) });
  },
});

// --- act 2: the hallway and the bathroom (stage2.js). These play in a page opened on act 2,
// carrying a level-6 run with a Candle (tests/run.mjs)
// Beat every elite in this act and walk (jumping now and then) to the chest it leaves, from an
// open spot 25 cm away: the chest must be on an open spot and touchable, never inside or under
// anything (the Kettle's once landed inside the kettle, the Controller's under an overhang)
export function eliteChestsReachable() {
  const { run } = G(), out = {};
  stub(run.ui, 'choose', () => {});
  stub(run.hud, 'toast', () => {});
  for (const E of [...run.elites.list]) {
    for (const t of run.roomTreasures) t.hide();
    E.dead = true;
    step(10);
    const t = run.roomTreasures.find((x) => x.active);
    if (!t) { out[E.kind] = 'no chest'; continue; }
    const p = t.pos.clone(), open = run.openSpot([p.x, p.y, p.z]).ok;
    let taken = false;
    for (let k = 0; k < 16 && !taken; k++) {
      const a = (k / 16) * Math.PI * 2, sx = p.x + Math.cos(a) * 0.25, sz = p.z + Math.sin(a) * 0.25;
      const o = run.openSpot([sx, p.y, sz]);
      if (!o.ok || Math.abs(o.y - p.y) > 0.15) continue;
      tp(sx, o.y + 0.02, sz, 0);
      for (let i = 0; i < 60 * 5 && t.active; i++) {
        const P = G().player.position;
        G().player.facing = Math.atan2(p.x - P.x, p.z - P.z); G().tpc.yaw = G().player.facing + Math.PI;
        G().input.keys = new Set(['KeyW']);
        if (i % 40 === 0) G().input.jumpQueued = true;
        G().GAME.step(1 / 60);
      }
      G().input.keys = new Set();
      taken = !t.active;
    }
    out[E.kind] = open && taken ? 'ok' : `open ${open}, taken ${taken}`;
  }
  restore();
  return ok(Object.keys(out).length > 0 && Object.values(out).every((v) => v === 'ok'), out);
}
story('elites/every-chest-reachable', {
  about: 'Every act 1 elite (Controller, Mug, Kettle) leaves its chest on an open spot the jelly can walk or jump to and touch: never inside the kettle or under the controllers.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
act2('every-elite-chest-reachable', {
  about: 'Every act 2 elite (Soap Dispenser, Wall Clock, Cream Whipper) leaves its chest on an open spot the jelly can walk or jump to and touch.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
for (const v of STAGES[1].vents) {
  act2(`vent-to-${v.to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the ${v.name.toLowerCase()} flings you onto ${v.to}.`,
    setup() { fresh({ elites: false }); tp(v.at[0], 0.05, v.at[2], 0); },
    play() {
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}

// The fluted sideboard's flutes and dark body are one instanced mesh, which nothing collides with
// (so no camera ray finds it): when the camera sees through the sideboard, they fade with it
act2('camera-sees-through-the-sideboard', {
  about: 'In the hallway, whenever the camera looks through the fluted sideboard, its flutes and dark body fade too (not just its solid parts), with no shader built on the spot.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, APT } = G();
    // compile() builds hidden objects too (the layout editor's selection box, once it's been opened),
    // so build what's already in the scene first and count only what seeing through the sideboard needs
    APT.renderer.compile(APT.scene, APT.camera);
    const programs = APT.renderer.info.programs.length;
    const parts = new Set(), flutes = [];
    APT.scene.getObjectByName('Fluted_sideboard').traverse((o) => { if (!o.isMesh) return; parts.add(o); if (o.isInstancedMesh) flutes.push(o); });
    let through = 0, missed = 0;
    for (const [x, y, z] of [[2.95, 0.05, 6.4], [2.95, 0.05, 6.75], [2.95, 0.05, 7.05], [3.27, 0.85, 6.8]]) {
      for (let k = 0; k < 16; k++) {
        tp(x, y, z, (k * Math.PI) / 8); step(20); G().batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
        if (![...tpc.over].some((m) => parts.has(m))) continue;
        through++;
        if (!flutes.every((m) => tpc.over.has(m))) missed++;
      }
    }
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(flutes.length > 0 && through > 0 && missed === 0 && newShaders === 0, { flutes: flutes.length, through, missed, newShaders });
  },
});

act2('soap-dispenser-stands-in', {
  about: 'The soap dispenser by the tap comes alive as an elite (the real one hides while it fights), and the pink soap inside drains as it\'s hurt.',
  setup() { fresh(); besideSoap(); },
  play() {
    const e = soapElite();
    if (!e) return ok(false, { elite: 'missing' });
    step(10);
    const full = e.model.liquid.scale.y;
    G().enemies.applyDamage(e.entry, e.maxHp * 0.6);
    step(60);
    const drained = e.model.liquid.scale.y < full * 0.5;
    return ok(e.hidden && !e.hidden.visible && e.name === 'The Soap Dispenser' && drained, { hidden: !!e.hidden, realShown: e.hidden?.visible, full: +full.toFixed(3), now: +e.model.liquid.scale.y.toFixed(3) });
  },
});
act2('soap-dispenser-squirt', {
  about: 'Soap squirt: it pumps nine times, each glob lobbed onto a pink circle filling where you stand: a hit stings for 4 and leaves a slick that makes you slip.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), log = record('damage_taken');
    let circles = 0, slipped = false, slicks = 0;
    step(60 * 3, () => {
      circles = Math.max(circles, run.elites.blobs.length);
      slicks = Math.max(slicks, run.elites.slicks.length);
      if (run.slipT > 0) slipped = true;
    });
    const hits = log.filter((d) => d.source === 'soap');
    return ok(circles >= 1 && hits.length >= 1 && hits[0].amount === 4 && slicks >= 1 && slipped, { circles, hits: hits.map((d) => d.amount), slicks, slipped });
  },
});
act2('soap-dispenser-bubble-ring', {
  about: 'Bubble ring: it foams up while a pink ring fills round it, then lets go three rings of soap bubbles drifting outward, each with one gap to slip through. They all pop before long.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.cool = 0; e.next = 1; },
  play() {
    const { run } = G(), e = soapElite(), dirs = [], bub = run.elites.bubble.bind(run.elites);
    stub(run.elites, 'bubble', (from, dir, ...rest) => { dirs.push(Math.atan2(dir.x, dir.z)); return bub(from, dir, ...rest); });
    let warned = false;
    step(60 * 6, () => { if (e.state === 'windup' && e.tele.length) warned = true; });
    if (!dirs.length) return ok(false, { warned, bubbles: 'none' });
    const angles = dirs.slice(0, 16).sort((a, b) => a - b);   // the first ring's bubbles
    // the widest gap between neighbouring bubbles (going round) is the way through
    const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + Math.PI * 2 - angles.at(-1)));
    const widest = Math.max(...gaps) * 180 / Math.PI;
    return ok(warned && dirs.length === 48 && angles.length === 16 && widest > 50 && run.elites.soapBubbles.length === 0, { warned, count: dirs.length, widest: Math.round(widest), left: run.elites.soapBubbles.length });
  },
});
act2('soap-dispenser-angry', {
  about: 'Under its angry threshold the Soap Dispenser pumps ten times, each glob landing as a floor Blast, and lets go five bubble rings instead of three, each mixing floor-level and jump-height bubbles.',
  setup() { fresh({ hurt: true }); besideSoap(); const e = soapElite(); e.hp = e.maxHp * 0.4; e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), e = soapElite();
    let globs = 0, domes = 0, bubbles = 0;
    const heights = Array.from({ length: 5 }, () => ({ low: 0, high: 0 }));
    const lob = run.elites.lob.bind(run.elites), bub = run.elites.bubble.bind(run.elites);
    stub(run.elites, 'lob', (...a) => { globs++; if (a[7]?.dome) domes++; return lob(...a); });
    stub(run.elites, 'bubble', (from, ...a) => { heights[Math.min(4, bubbles++ >> 4)][from.y - e.base.y > 0.1 ? 'high' : 'low']++; return bub(from, ...a); });
    step(60 * 3, (i) => i > 10 && e.state === 'idle');          // the squirt attack, to its end
    e.cool = 0; e.next = 1;
    step(60 * 3, (i) => i > 10 && e.state === 'idle');          // then the bubble rings
    const mixed = heights.every((h) => h.low === 8 && h.high === 8);
    return ok(globs === 10 && domes === 10 && bubbles === 80 && mixed, { globs, domes, bubbles, heights });
  },
});
// --- 3D attacks: each soap glob lands as a floor Blast (a 4 cm half sphere over its pink circle),
const firstGlob = () => { step(400, () => G().run.elites.blobs.length > 0); return G().run.elites.blobs[0]; };
function soapHits(source = 'soap') { const s = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === source) s.push(d); })); return s; }
act2('soap-squirt-warning-has-volume', {
  about: "A soap glob's Warning is its pink floor circle with a half-sphere volume over it, filling together; both go when it lands.",
  setup() { startSoap(0); },
  play() {
    const b = firstGlob(), to = b.to.clone();
    holdJelly().position.x += 0.12;   // so the next globs land elsewhere
    step(12);
    const w1 = warningsAt(to), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(12);
    const w2 = warningsAt(to), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const dome = w1.volume ? new THREE.Box3().setFromObject(w1.volume) : null;
    const domed = !!dome && dome.min.y > to.y - 0.005 && dome.max.y > to.y + 0.03 && dome.max.y < to.y + 0.05;   // a 4 cm half sphere
    step(200, () => !G().run.elites.blobs.includes(b));
    const w3 = warningsAt(to), gone = !w3.floor && !w3.volume;
    const filling = !!(w1.floor && w1.volume) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && domed && gone, { p1, p2, domed, gone });
  },
});
act2('soap-squirt-hits-standing-not-jumping', {
  about: "A jelly standing where a soap glob lands is hit by its Blast (4 Health); one in the air just above its 4 cm half sphere isn't.",
  setup() { startSoap(0); },
  play() {
    const { run } = G(), hits = soapHits(), b1 = firstGlob();
    const player = holdJelly();
    player.position.copy(b1.to); player.grounded = true;
    step(200, () => !run.elites.blobs.includes(b1));
    const standing = hits.length;
    step(200, () => run.elites.blobs.some((b) => b !== b1));
    const b2 = run.elites.blobs.find((b) => b !== b1);
    step(200, () => b2.t > b2.T - 0.1);
    player.position.set(b2.to.x, b2.to.y + 0.05, b2.to.z); player.grounded = false;   // feet 5 cm up: above a 4 cm dome
    step(30, () => !run.elites.blobs.includes(b2));
    const jumping = hits.length - standing;
    return ok(standing === 1 && hits[0].amount === 4 && jumping === 0, { standing, jumping, amount: hits[0]?.amount });
  },
});
// let a ring go, then put the jelly 20 cm out in the path of one low and one high bubble in turn
function bubbleVsJelly(jump) {
  const { run } = G(), e = soapElite(), player = holdJelly(), hits = soapHits('soap-bubble'), out = {};
  const floor = e.base.y, toYou = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z);
  for (const kind of ['low', 'high']) {
    e.state = 'idle'; e.next = 1; e.cool = 99; e.rings = 0; e.clearTele();   // wait until all rings from the previous phase have cleared
    step(400, () => !run.elites.soapBubbles.length);
    e.cool = 0;
    player.position.set(e.base.x + Math.sin(toYou) * 0.12, floor, e.base.z + Math.cos(toYou) * 0.12); player.grounded = true;
    step(400, () => run.elites.soapBubbles.length > 0);
    // the bubble of this height drifting nearest the open vanity (where you stood)
    const mine = run.elites.soapBubbles.filter((b) => (b.y - floor > 0.1 ? 'high' : 'low') === kind);
    const off = (b) => Math.abs(Math.atan2(Math.sin(Math.atan2(b.v.x, b.v.z) - toYou), Math.cos(Math.atan2(b.v.x, b.v.z) - toYou)));
    const b = mine.sort((x, y) => off(x) - off(y))[0];
    if (!b) { out[kind] = 'none'; continue; }
    // Test this bubble's height without another ring crossing the jelly during the measurement.
    e.state = 'idle'; e.cool = 99; e.clearTele();
    for (const other of run.elites.soapBubbles) if (other !== b) run.elites.scene.remove(other.m);
    run.elites.soapBubbles = [b];
    const dir = b.v.clone().normalize();
    player.position.set(e.base.x + dir.x * 0.2, floor + (jump ? JUMP_FEET : 0), e.base.z + dir.z * 0.2); player.grounded = !jump;
    const h0 = hits.length;
    step(150, () => hits.length > h0 || !run.elites.soapBubbles.includes(b));
    out[kind] = hits.length - h0;
  }
  return out;
}
act2('soap-bubble-ring-low-and-high', {
  about: 'A bubble ring mixes floor-level and jump-height bubbles: low ones pass under a jumping jelly and hit a grounded one; high ones pass over a grounded jelly and hit a jumping one.',
  setup() { startSoap(1); },
  play() {
    const grounded = bubbleVsJelly(false), jumping = bubbleVsJelly(true);
    const pass = grounded.low === 1 && grounded.high === 0 && jumping.low === 0 && jumping.high === 1;
    return ok(pass, { grounded, jumping });
  },
});
act2('soap-attacks-build-no-shader', {
  about: "Starting the Soap Dispenser's squirt and bubble ring builds no new shader: their Warnings (floor circles, the glob's volume) and bubbles were built behind Play.",
  setup() { startSoap(0); },
  play() {
    const { APT, batcher, run } = G(), programs = APT.renderer.info.programs.length, e = soapElite();
    const b = firstGlob(), to = b.to.clone();
    step(5);
    const w = warningsAt(to);
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    step(200, () => e.state === 'idle');
    e.next = 1; e.cool = 0;
    step(400, () => e.state === 'windup' && e.tele.length > 0);   // the ring's Warning shown
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    step(400, () => run.elites.soapBubbles.length > 0);            // and its bubbles
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(w.floor && w.volume && newShaders === 0, { newShaders, volume: !!w.volume });
  },
});
act2('one-on-one-soap-dispenser', {
  about: 'The 1 on 1 (dev) picker puts you on the vanity beside the Soap Dispenser, alone with it.',
  setup() { fresh(); },
  play() {
    const { run, player } = G();
    const pick = run.duelChoices().find((p) => p.name === 'The Soap Dispenser (elite, act 2)');
    if (!pick) return ok(false, { pick: 'missing' });
    run.startDuel(pick);
    step(30);
    const e = soapElite(), d = e ? Math.hypot(player.position.x - e.base.x, player.position.z - e.base.z) : 9;
    return ok(run.elites.alive.length === 1 && e && d < 0.5 && player.position.y > 0.8, { elites: run.elites.alive.length, near: +d.toFixed(2), y: +player.position.y.toFixed(2) });
  },
});
act2('dev-fight-boss-starts-the-clog', {
  about: 'On an act 2 page, the Fight boss pick for this act starts the Clog\'s intro in place.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    const pick = run.bossChoices().find((p) => p.name === 'The Clog (boss, act 2)');
    if (!pick) return ok(false, { pick: 'missing' });
    run.startBossFight(pick);
    const intro = run.phase === 'intro';
    // the Clog takes its time rising: wait for the boss itself (clicking through any cards, as clogFight does)
    for (let i = 0; i < 360 && !run.boss; i++) { document.querySelector('.jf-card')?.click(); step(1); }
    return ok(intro && !!run.boss, { intro, boss: !!run.boss, phase: run.phase });
  },
});
const oldClockShown = () => { let shown = false; G().APT.root.traverse((o) => { if (/^Ornate_wall_clock/.test(o.name) && o.isMesh && o.visible) shown = true; }); return shown; };
act2('clock-hangs-on-the-wall', {
  about: 'The detailed wall clock hangs over the cubby bench in place of the apartment\'s simple one, its hands showing the real time.',
  setup() { fresh(); tp(2.75, 0.05, 6.6, 0); },
  play() {
    const e = hallClock();
    if (!e) return ok(false, { clock: 'missing' });
    step(120);
    const d = new Date(), want = -(d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2, got = e.model.minuteHand.rotation.z;
    const off = Math.abs(Math.atan2(Math.sin(want - got), Math.cos(want - got)));
    return ok(!oldClockShown() && Math.abs(e.holder.position.y - 1.12) < 0.01 && off < 0.1, { oldShown: oldClockShown(), y: +e.holder.position.y.toFixed(3), handOff: +off.toFixed(3) });
  },
});
act2('clock-comes-down-to-fight', {
  about: 'Land on the cubby bench and the clock comes alive: it slides down the wall to fight you there, and goes back up once you leave.',
  setup() { fresh(); onBench(); },
  play() {
    const e = hallClock();
    step(90);
    const down = e.holder.position.y, ready = e.ready;
    e.cool = 99;
    tp(2.75, 0.05, 6.6, 0);
    step(60 * 4);
    const up = e.holder.position.y;
    return ok(down < 0.5 && ready && up > 1.1, { down: +down.toFixed(3), ready, up: +up.toFixed(3) });
  },
});
act2('clock-can-be-hit', {
  about: 'Down on the bench, the clock\'s mask is in reach: your bubbles hurt it.',
  setup() { fresh(); onBench(1.9, 7.42); G().run.hurt = () => {}; const e = hallClock(); e.cool = 99; },
  play() {
    const e = hallClock();
    step(60 * 5);
    return ok(e.hp < e.maxHp, { hp: Math.round(e.hp), max: e.maxHp });
  },
});
act2('clock-sweeping-hands', {
  about: 'Sweeping hands: a half circle fills on the bench while the hands whirl, then a golden hand sweeps across it for 4. In a far front corner of the bench it can\'t reach you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const sweep = (x, z) => {
      fresh({ hurt: true, bubbles: false, lash: false }); onBench(x, z);
      const e = hallClock(), log = record('damage_taken');
      step(90); e.cool = 0; e.next = 0;
      let warned = false, swept = false;
      step(60 * 3, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (e.beam) swept = true; return swept && e.state === 'idle'; });
      return { warned, swept, hits: log.filter((d) => d.source === 'clock').map((d) => d.amount) };
    };
    const mid = sweep(2.0, 7.42), corner = sweep(2.14, 7.08);
    return ok(mid.warned && mid.swept && mid.hits[0] === 4 && corner.swept && !corner.hits.length, { mid, corner });
  },
});
act2('clock-wreath-boomerang', {
  about: 'Victory\'s wreath: a line on the bench shows where she\'ll throw it, then the wreath flies out along it and comes back to her hand: 4 if it catches you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const { run } = G(), e = hallClock(), log = record('damage_taken');
    step(90); e.cool = 0; e.next = 1;
    let warned = false, flew = false;
    step(60 * 6, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (run.elites.thrown.length) flew = true; return flew && e.state === 'idle' && e.model.wreath.visible; });   // 6 s: at Elite pace recover 1.2 the rest before it plus its 0.5 s-each-way flight outlast the old 4
    const hits = log.filter((d) => d.source === 'clock-wreath').map((d) => d.amount);
    return ok(warned && flew && hits[0] === 4 && e.model.wreath.visible && !run.elites.thrown.length, { warned, flew, hits, back: e.model.wreath.visible });
  },
});
act2('clock-strikes-the-hour', {
  about: 'Under half health the clock also strikes the hour: six chimes, each a golden ring rolling out across the bench (2 if it rolls over you).',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); onBench(); },
  play() {
    const { run } = G(), e = hallClock(), log = record('damage_taken');
    e.hp = e.maxHp * 0.4;
    step(90); e.state = 'idle'; e.clearTele(); e.cool = 0; e.next = 2;
    let rings = 0;
    const ring = run.elites.rings;
    step(60 * 6, () => { rings = Math.max(rings, e.chimed + 1 || 0); return rings >= 6 && e.state === 'idle'; });
    const hits = log.filter((d) => d.source === 'clock-chime');
    // and its attacks now go round three ways
    const order = [0, 1, 2, 3].map(() => e.next++ % (e.hp < e.maxHp * 0.5 ? 3 : 2));
    return ok(rings === 6 && hits.length >= 1 && order.includes(2), { rings, hits: hits.length, order });
  },
});
act2('clock-beaten-hangs-again', {
  about: 'Beat the clock and it goes back up its wall as a plain clock (no face, no health bar), still keeping time; its treasure lands on the bench below, in reach.',
  setup() { fresh(); onBench(); },
  play() {
    const { run, enemies, menus } = G(), e = hallClock(), log = record('elite_defeated');
    step(90);
    enemies.applyDamage(e.entry, e.maxHp + 1);
    step(10);
    const chest = run.roomTreasures.find((t) => t.active && !t.timed), picked = !!chest && chest.pos.y < 0.8 && !menus.open;
    step(60 * 3);
    return ok(log.length === 1 && e.decor && !e.model.face.visible && !e.bar.visible && e.holder.position.y > 1.1 && run.elites.decor.includes(e) && picked, { chestY: chest && +chest.pos.y.toFixed(2), defeated: log.length, decor: !!e.decor, y: +e.holder.position.y.toFixed(3), picked });
  },
});
function clockHits(source) { const c = []; offs.push(bus.on('damage_taken', (d) => { if (d.source === source) c.push(d); })); return c; }
// the clock's Warning, as the scene holds it: its floor shapes and volumes
function clockWarning(e) {
  const kids = G().APT.scene.children, mine = (o) => e.tele.includes(o);
  return { floor: kids.filter((o) => mine(o) && o.material instanceof TeleMaterial), volume: kids.filter((o) => mine(o) && o.material instanceof VolumeMaterial) };
}
act2('clock-sweep-warning-has-volume', {
  about: "The sweeping hands' Warning is the half circle on the bench with a low volume over it (2 cm), filling together; both go after the sweep.",
  setup() { startClock(0); },
  play() {
    const e = hallClock();
    step(200, () => clockWarning(e).floor.length);
    step(10);
    const w1 = clockWarning(e), p1 = [w1.floor[0]?.material.progress, w1.volume[0]?.material.progress];
    step(10);
    const w2 = clockWarning(e), p2 = [w2.floor[0]?.material.progress, w2.volume[0]?.material.progress];
    const filling = !!(w1.floor[0] && w1.volume[0]) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    let shape = {};
    if (w1.volume[0]) {
      const f = new THREE.Box3().setFromObject(w1.floor[0]), v = new THREE.Box3().setFromObject(w1.volume[0]), same = (a, b) => Math.abs(a - b) < 0.01;
      shape = { tall: +(v.max.y - e.base.y).toFixed(3), onBench: Math.abs(v.min.y - e.base.y) < 0.005, over: same(f.min.x, v.min.x) && same(f.max.x, v.max.x) && same(f.min.z, v.min.z) && same(f.max.z, v.max.z), color: w1.volume[0].material.uniforms.uColor.value.getHex() === hostile('clock').getHex() };
      shape.ok = Math.abs(shape.tall - 0.02) < 0.004 && shape.onBench && shape.over && shape.color;
    }
    step(200, () => e.state === 'idle');
    const w3 = clockWarning(e), gone = !w3.floor.length && !w3.volume.length;
    return ok(filling && shape.ok && gone, { p1, p2, shape, gone });
  },
});
act2('clock-sweep-jumped-clear', {
  about: "A jelly standing in the sweeping hand's path is hit (4), and so is one barely off the bench (feet 1 cm up, still in its 2 cm volume); one in the air over it (feet 5 cm up) isn't.",
  setup() { startClock(0); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['hopping', 0.01], ['jumping', 0.05]]) {
      const { e, player, bench } = startClock(0), hits = clockHits('clock');
      if (up) { player.position.y = bench + up; player.grounded = false; }
      let swept = false;
      step(60 * 3, () => { if (e.beam) swept = true; return swept && e.state === 'idle'; });
      out[name] = { swept, hits: hits.map((h) => h.amount) };
    }
    const { standing: s, hopping: h, jumping: j } = out;
    return ok(s.swept && s.hits[0] === 4 && h.swept && h.hits[0] === 4 && j.swept && !j.hits.length, out);
  },
});
act2('clock-wreath-flies-at-jump-height', {
  about: "Victory's wreath is a Shot aimed at the jelly's middle where it is, mid-jump included: its line tilts from her hand to that height and the wreath hits a jelly held mid-jump (4 going out and 4 coming back); if that jelly drops to the bench after the aim locks, the wreath flies through where its middle was, over it.",
  setup() { startClock(1); },
  play() {
    const out = {};
    for (const drop of [false, true]) {
      const { e, player, bench } = startClock(1), hits = clockHits('clock-wreath'), run = G().run;
      player.position.y = bench + JUMP_FEET; player.grounded = false;   // feet 12 cm up: middle at about 16.5 cm
      const mid = bench + JUMP_FEET + CONFIG.player.height * 0.5;
      step(200, () => e.state === 'windup' && e.stateT > 0.6);           // the aim has locked (halfway)
      const line = clockWarning(e).floor.find((m) => (m.updateMatrixWorld(), Math.abs(m.localToWorld(V(0, 0, 1)).y - m.position.y) > 0.01));
      const end = line && line.localToWorld(V(0, 0, 1));
      if (drop) { player.position.y = bench; player.grounded = true; }
      let peak = null;
      step(60 * 3, () => {
        const w = run.elites.thrown[0];
        if (w) { const d = w.m.position.distanceTo(V(player.position.x, mid, player.position.z)); if (!peak || d < peak.d) peak = { d, y: w.m.position.y }; }
        return e.state === 'idle' && !run.elites.thrown.length;
      });
      out[drop ? 'dropped' : 'midJump'] = { line: end ? +(end.y - bench).toFixed(3) : null, closest: peak && +peak.d.toFixed(3), atY: peak && +(peak.y - bench).toFixed(3), hits: hits.map((h) => h.amount), back: e.model.wreath.visible };
    }
    const m = out.midJump, d = out.dropped, high = (y) => y != null && Math.abs(y - (JUMP_FEET + CONFIG.player.height * 0.5)) < 0.01;
    return ok(high(m.line) && m.hits.length === 2 && m.hits.every((h) => h === 4) && m.back && high(d.line) && d.closest < 0.01 && !d.hits.length && d.back, out);
  },
});
act2('clock-wreath-hits-going-out-and-coming-back', {
  about: "Victory's wreath hits a jelly that stays where she threw it twice, 4 each: once going out and once coming back, never twice on the same leg.",
  setup() { startClock(1); },
  play() {
    const e = hallClock(), run = G().run, hits = [];
    offs.push(bus.on('damage_taken', (d) => { if (d.source === 'clock-wreath') hits.push({ amount: d.amount, way: run.elites.thrown.find((w) => w.owner === e)?.out ? 'out' : 'back' }); }));
    let flew = false;
    step(60 * 4, () => { if (run.elites.thrown.length) flew = true; return flew && e.state === 'idle' && !run.elites.thrown.length; });
    const out = hits.filter((h) => h.way === 'out'), back = hits.filter((h) => h.way === 'back');
    return ok(flew && out.length === 1 && back.length === 1 && hits.every((h) => h.amount === 4), { hits });
  },
});
act2('clock-chime-jumped-clear', {
  about: "Each chime is a ring wall 3 cm high rolling out over the bench: a jelly standing in its path is hit (4), and so is one barely off the bench (feet 2 cm up); one in the air over it (feet 5 cm up) isn't hit by any of the six.",
  setup() { startClock(2, { angry: true }); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['hopping', 0.02], ['jumping', 0.05]]) {
      const { e, player, bench } = startClock(2, { angry: true, x: 2.06, z: 7.5 }), hits = clockHits('clock-chime'), run = G().run;
      if (up) { player.position.y = bench + up; player.grounded = false; }
      const walls = [];
      let warned = false;
      step(60 * 4, () => {
        const w = clockWarning(e);
        if (w.floor.length && w.volume.length) warned = true;
        for (const r of run.elites.rings) if (r.vol) { const b = new THREE.Box3().setFromObject(r.vol); walls.push(+(b.max.y - r.at.y).toFixed(3)); }
        return e.chimed === -1 && e.state === 'idle' && !run.elites.rings.length;
      });
      out[name] = { warned, walls: walls.length, tall: walls.length ? Math.max(...walls) : null, hits: hits.map((h) => h.amount) };
    }
    const { standing: s, hopping: h, jumping: j } = out, low = (r) => r.walls > 0 && Math.abs(r.tall - 0.03) < 0.006, fours = (r) => r.hits.length >= 1 && r.hits.every((n) => n === 4);
    return ok(s.warned && low(s) && fours(s) && fours(h) && low(j) && !j.hits.length, out);
  },
});
for (const [atk, name] of [[0, 'sweep'], [1, 'wreath'], [2, 'chime']]) {
  act2(`clock-${name}-builds-no-shader`, {
    about: `Starting the Wall Clock's ${name} builds no new shader: its Warning's floor shape and volume (the wreath: its lines) were built behind Play.`,
    setup() { startClock(atk, { angry: atk === 2 }); },
    play() {
      const { APT, batcher } = G(), e = hallClock(), programs = APT.renderer.info.programs.length;
      step(200, () => clockWarning(e).floor.length);
      step(5);
      const w = clockWarning(e);
      batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
      const newShaders = APT.renderer.info.programs.length - programs;
      const shown = atk === 1 ? w.floor.length >= 2 : w.floor.length && w.volume.length;
      return ok(!!shown && newShaders === 0, { newShaders, floor: w.floor.length, volume: w.volume.length });
    },
  });
}

act2('whipper-balloon-bursts-on-time', {
  about: 'The Cream Whipper blows a balloon up on its nozzle and lets it go; it drifts after you with its Warning (a floor circle) filling, and bursts 4 s after it\'s let go: 4, and all the sound goes deep.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); const e = whipper(); e.cool = 0; e.next = 0; },
  play() {
    const { run } = G(), log = record('damage_taken');
    let loose = -1, burst = -1, followed = false, d0 = null, first = null;
    step(60 * 6, (i) => {
      const B = first || run.elites.balloons[0];
      if (B && loose < 0) { loose = i; first = B; d0 = B.m.position.distanceTo(G().player.position); }
      if (B && B.t > 1.5 && B.m.position.distanceTo(G().player.position) < d0 - 0.03) followed = true;
      if (first && burst < 0 && !run.elites.balloons.includes(first)) burst = i;
      return burst >= 0;
    });
    const fuse = (burst - loose) / 60, hits = log.filter((d) => d.source === 'balloon');
    return ok(loose >= 0 && Math.abs(fuse - 4) < 0.1 && followed && hits[0]?.amount === 4 && isDeep(), { fuse: +fuse.toFixed(2), followed, hits: hits.map((d) => d.amount), deep: isDeep() });
  },
});
act2('whipper-deep-sound-recovers', {
  about: 'Caught in a burst, the sound stays deep for 5 s, then eases back to normal over the next few seconds.',
  setup() { fresh(); },
  play() {
    let fake = performance.now();
    stub(performance, 'now', () => fake);
    G().run.elites.balloons.length = 0;
    return import('../sfx.js').then(({ deepen }) => {
      deepen(5, 3);
      const at = (s) => { fake += s * 1000; return pitch(); };
      const p1 = at(1), p4 = at(3.5), p6 = at(2), p7 = at(1), p9 = at(2);
      return ok(p1 < 0.65 && p4 < 0.65 && p6 > p4 && p6 < p7 && p7 < 1 && p9 === 1, { p1, p4: +p4.toFixed(2), p6: +p6.toFixed(2), p7: +p7.toFixed(2), p9 });
    });
  },
});
act2('whipper-burst-misses-outside', {
  about: 'Outside the burst sphere, the balloon pops harmlessly and your hearing is fine.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); },
  play() {
    const { run } = G(), log = record('damage_taken');
    const e = whipper(); e.cool = 0; e.next = 0;
    let gone = false;
    step(60 * 6, () => {
      const B = run.elites.balloons[0];
      if (B && B.t > 2.6 && !gone) { gone = true; tp(2.3, 0.02, 7.0, 0); }   // dash away just before it bursts
      return gone && !run.elites.balloons.length;
    });
    return ok(gone && !log.some((d) => d.source === 'balloon') && !isDeep(), { gone, hits: log.map((d) => d.source), deep: isDeep() });
  },
});
act2('whipper-cream-spray', {
  about: 'Cream spray: the whipper tips toward you while a wedge and its cone fill on the floor, then sprays whipped cream along it: 3, and it slows you.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(3.27, 0.02, 8.78, 0); const e = whipper(); e.cool = 0; e.next = 1; },
  play() {
    const { run } = G(), e = whipper(), log = record('damage_taken');
    let warned = false, slowed = false;
    step(60 * 3, () => { if (e.state === 'windup' && e.tele.length) warned = true; if (run.slowT > 0) slowed = true; return e.sprayed && e.state === 'idle'; });
    const hits = log.filter((d) => d.source === 'cream');
    return ok(warned && hits[0]?.amount === 3 && slowed, { warned, hits: hits.map((d) => d.amount), slowed });
  },
});
act2('whipper-angry-balloons', {
  about: 'Under its angry threshold the Cream Whipper blows three balloons each time, each with its own floor circle (and no volume).',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); byDoor(); const e = whipper(); e.hp = e.maxHp * 0.4; e.cool = 0; e.next = 0; },
  play() {
    const { run } = G();
    let most = 0, warned = 0;
    step(60 * 3.5, () => {
      most = Math.max(most, run.elites.balloons.length);
      warned = Math.max(warned, run.elites.balloons.filter((B) => { const w = balloonWarning(B); return w.floor && !w.volume; }).length);
    });
    return ok(most === 3 && warned === 3, { most, warned });
  },
});
