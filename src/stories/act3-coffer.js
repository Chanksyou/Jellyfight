// Stories: act 3's third Elite, the Latticework Coffer (elites.js kind 'coffer', coffer-model.js):
// the mimic box on the vanity desk in the bedroom's north-west corner. Shared helpers are in
// ./kit.js; src/stories.js imports this file in order.

import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { CONFIG } from '../config.js';
import { unlock as unlockAudio, audio } from '../sfx.js';
import { G, V, act3, coffer, fresh, onDesk, ok, r3, record, startCoffer, step, tp, volumePairs } from './kit.js';

const onFloor = () => tp(-1.2, 0.05, 9.5, 0);                // on the floor between the desk and the bassinet
const isCoffer = (o) => o.material.uniforms.uColor.value.getHex() === hostile('coffer').getHex();
// the Coffer's Warnings showing: floor shapes with the volume over each, filling together
const cofferPairs = () => volumePairs().filter(([v, f]) => f && isCoffer(v));
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const DESK = { min: [-1.89, 8.4], max: [-1.43, 9.34], top: 0.78 };

act3('coffer-sleeps-on-the-desk', {
  about: 'The Latticework Coffer sits on the vanity desk (the north-west corner, its top 78 cm up) in place of the inlaid wooden box there (hidden for the act), and sleeps while the jelly is down on the floor: a plain closed box, eyes shut, legs tucked away, never starting an attack. It is 20 to 25 cm wide.',
  setup() { fresh(); onFloor(); },
  play() {
    const { run } = G(), e = coffer();
    if (!e) return ok(false, { coffer: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    let real = false;
    run.elites.findObject('Vanity_desk_22').traverse((o) => { if (o.isMesh && o.visible) real = true; });
    const b = e.base, M = e.model;
    const onTop = b.x > DESK.min[0] && b.x < DESK.max[0] && b.z > DESK.min[1] && b.z < DESK.max[1] && Math.abs(b.y - DESK.top) < 0.01;
    const width = M.size.w * e.size;
    return ok(onTop && !real && !e.awake && !started && !M.eyes.visible && !M.legs.visible && M.gap() < 0.004 && width >= 0.2 && width <= 0.25,
      { at: r3(b), realShown: real, awake: e.awake, started, eyes: M.eyes.visible, legs: M.legs.visible, gap: +M.gap().toFixed(4), width });
  },
});

act3('coffer-wakes-when-you-are-on-the-desk', {
  about: 'Land on the desk and the Coffer wakes: its amber eyes open, it rises on its splintered legs and its bellows part, it turns to face you and fights; leave the desk and it settles back down into a plain box, facing the room again.',
  setup() { fresh(); onDesk(); },
  play() {
    const { player } = G(), e = coffer(), M = e.model;
    step(60 * 2);
    const d = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z) - e.holder.rotation.y;
    const awake = { awake: e.awake, eyes: M.eyes.visible && M.eyes.scale.x > 0.8, legs: M.legs.visible && M.lift() > 0.02, facing: +Math.abs(Math.atan2(Math.sin(d), Math.cos(d))).toFixed(2) };
    e.cool = 99;
    onFloor();
    step(60 * 4);
    const rest = Math.abs(Math.atan2(Math.sin(e.holder.rotation.y - e.spec.face), Math.cos(e.holder.rotation.y - e.spec.face)));
    const asleep = { awake: e.awake, eyes: M.eyes.visible, legs: M.legs.visible, gap: +M.gap().toFixed(4), rest: +rest.toFixed(2) };
    return ok(awake.awake && awake.eyes && awake.legs && awake.facing < 0.3 && !asleep.awake && !asleep.eyes && !asleep.legs && asleep.gap < 0.004 && rest < 0.15, { awake, asleep });
  },
});

act3('coffer-accordion', {
  about: 'Accordion: five strikes in a row. Each locks where the jelly is then (no further than 60 cm from the Coffer) and a Warning (a 6 cm circle with the half sphere over it) fills there over 0.5 s while the lid shoots out on its stretching bellows; then the lid slams down on it: 3 to a jelly still on it, nothing to one that moved off it (or stood past the 60 cm).',
  setup() { startCoffer(0); },
  play() {
    const { e, player, desk } = startCoffer(0), log = record('damage_taken'), A = CONTENT.elites.coffer.skills.accordion, tempo = CONTENT.elites.pace.tempo;
    const far = V(-1.52, desk, 9.25), back = V(-1.5, desk, 8.85);
    const locks = [], hitAt = [];
    let arm = 0, k = -1, frames = 0, radius = 0, seen = 0;
    step(60 * 6, () => {
      frames++;
      if (e.strike != null && e.strike !== k) {
        k = e.strike;
        locks.push({ aim: e.aim.clone(), jelly: player.position.clone(), at: frames });
        if (k === 1) player.position.copy(far);            // moves off strike 2, and stands too far for strike 3
        if (k === 2) player.position.copy(back);           // back in reach for strikes 4 and 5
      }
      const n = hitsBy(log, 'coffer-accordion').length;
      // which strike hit: its slam comes the frame the next one locks (or the attack ends)
      for (; seen < n; seen++) hitAt.push(locks.at(-1).at === frames ? locks.length - 2 : locks.length - 1);
      const v = cofferPairs().find(([w]) => w.material.kind === 'dome');
      if (v) radius = Math.max(radius, v[0].scale.x);
      if (e.model.arm.visible) arm = Math.max(arm, e.model.arm.scale.z);
      return e.state === 'idle' && locks.length;
    });
    const struck = hitsBy(log, 'coffer-accordion');
    const fill = locks.slice(1).map((l, i) => +(((l.at - locks[i].at) / 60) * tempo).toFixed(2));   // each Warning's fill, in the attack's time
    const reach = locks.map((l) => +flat(l.aim, e.base).toFixed(3));
    const onJelly = locks.map((l, i) => (i === 2 ? null : +flat(l.aim, l.jelly).toFixed(3)));
    return ok(locks.length === 5 && fill.every((g) => Math.abs(g - A.unfold) < 0.04) && reach.every((d) => d <= A.range + 0.001) && Math.abs(reach[2] - A.range) < 0.005
      && onJelly.every((d) => d === null || d < 0.001) && Math.abs(radius - A.radius) < 0.002 && struck.every((n) => n === A.dmg) && hitAt.join() === '0,3,4' && arm > 0.45,
      { locks: locks.length, fill, reach, onJelly, radius: +radius.toFixed(3), struck, hitAt, arm: +arm.toFixed(3) });
  },
});

// swim straight away from the Coffer (+z, down the desk) with the keys, at `speed` times base move speed
function swimAway(speed) {
  const { run, input, tpc } = G();
  run.stats.moveSpeed += speed - run.S.moveSpeed;
  input.keys = new Set(['KeyW']);
  tpc.yaw = Math.PI;
}
// the tongue attack under way: how long it held on (in the attack's time), its pull, how near the jelly came
function watchTongue(e) {
  const { run, input, tpc } = G(), tempo = CONTENT.elites.pace.tempo;
  let latched = 0, pull = 0, far = 0, closest = 9, held = false, went = false;
  step(60 * 8, () => {
    tpc.yaw = Math.PI;
    if (e.lash) went = true;
    if (e.lash?.state === 'latched') { latched++; held ||= e.model.tongue.visible; if (run.elites.pull) pull = Math.max(pull, run.elites.pull.length()); }
    const d = flat(G().player.position, e.base);
    far = Math.max(far, d); closest = Math.min(closest, d);
    return e.state === 'idle' && went;
  });
  input.keys = new Set();
  return { latchedS: +((latched / 60) * tempo).toFixed(2), held, pull: +pull.toFixed(3), closest: +closest.toFixed(3), far: +far.toFixed(3) };
}

act3('coffer-tongue-drags-a-base-speed-jelly-into-its-mouth', {
  about: 'Tongue: its mouth opens, the tongue shoots to the jelly and latches on (no Warning: it can\'t be dodged), and pulls it toward the mouth faster than a jelly at base move speed (0.42 m/s) can swim away; dragged to the mouth it is bitten (6) and knocked back out, and the tongue lets go.',
  setup() { startCoffer(1, { hold: false, z: 8.9 }); },
  play() {
    const { e } = startCoffer(1, { hold: false, z: 8.9 }), log = record('damage_taken'), knocks = record('knockback'), T = CONTENT.elites.coffer.skills.tongue;
    swimAway(1);
    const speed = G().run.S.moveSpeed;
    const r = watchTongue(e), bites = hitsBy(log, 'coffer-tongue');
    return ok(speed === 1 && r.held && Math.abs(r.pull - T.pull) < 1e-6 && T.pull > CONFIG.player.walkSpeed && bites.length === 1 && bites[0] === T.dmg && knocks.length >= 1 && r.closest < T.bite && r.latchedS < T.hold,
      { speed, ...r, bites, knocks: knocks.length, walk: CONFIG.player.walkSpeed });
  },
});

act3('coffer-tongue-chomps-chews-and-spits', {
  about: 'Dragged into its mouth, the jelly is chomped: on that frame the jaws slam shut with a flash and a spray, and the bite lands (once, 6); the Coffer holds it at its mouth and chews (its jaw parting and slamming, `chews` times), then gapes and spits it back out with a shove, leaving a wet patch on the desk.',
  setup() { startCoffer(1, { hold: false, z: 8.9 }); },
  play() {
    const { e } = startCoffer(1, { hold: false, z: 8.9 }), { run, fx } = G(), log = record('damage_taken'), knocks = record('knockback'), T = CONTENT.elites.coffer.skills.tongue;
    swimAway(1);
    let chompJaw = null, chewFrames = 0, held = 0, jawMoves = 0, lastJaw = null, knocksChewing = null, splats = 0, spat = false;
    const splatsBefore = fx.splats.filter((x) => x.alive).length;
    step(60 * 8, () => {
      G().tpc.yaw = Math.PI;
      const L = e.lash;
      if (L?.state === 'chew') {
        if (chompJaw == null) chompJaw = e.cof.jaw;
        knocksChewing = knocks.length;   // (the hit's own small hurt nudge comes with the chomp)
        chewFrames++;
        held = Math.max(held, flat(G().player.position, e.base));   // how far from its middle while it chews
        if (lastJaw != null && Math.abs(e.cof.jaw - lastJaw) > 0.02) jawMoves++;
        lastJaw = e.cof.jaw;
      }
      if (L?.state === 'done' && chompJaw != null && !spat) { spat = true; splats = fx.splats.filter((x) => x.alive).length - splatsBefore; }
      return e.state === 'idle' && spat;
    });
    G().input.keys = new Set();
    const bites = hitsBy(log, 'coffer-tongue'), tempo = CONTENT.elites.pace.tempo, chewS = +((chewFrames / 60) * tempo).toFixed(2);
    return ok(chompJaw != null && chompJaw < 0.05 && bites.length === 1 && bites[0] === T.dmg && Math.abs(chewS - T.chews * T.chew) < 0.1 && held < T.bite + 0.05 && jawMoves > T.chews && knocks.length > knocksChewing && splats >= 1,   // the spit's shove comes after the chewing
      { chompJaw, bites, chewS, held: +held.toFixed(3), jawMoves, knocksChewing, knocks: knocks.length, splats });
  },
});

act3('coffer-tongue-a-fast-jelly-gets-away', {
  about: 'A jelly with a high move speed (160%) swims away against the tongue\'s pull: it is never dragged into the mouth, and the tongue lets go after 4 s (in the attack\'s time) and snaps back.',
  setup() { startCoffer(1, { hold: false, z: 8.75 }); },
  play() {
    const { e } = startCoffer(1, { hold: false, z: 8.75 }), log = record('damage_taken'), T = CONTENT.elites.coffer.skills.tongue;
    swimAway(1.6);
    const r = watchTongue(e), bites = hitsBy(log, 'coffer-tongue');
    return ok(r.held && !bites.length && Math.abs(r.latchedS - T.hold) < 0.1 && r.far > 0.4 && !e.model.tongue.visible && !G().run.elites.pull, { ...r, bites });
  },
});

// a spot on the open desk top clear of every jewel's Blast (its radius and the jelly's round it)
function safeSpot(spots, r) {
  const { run } = G();
  for (let z = 8.62; z < 9.32; z += 0.01) for (let x = -1.61; x < -1.45; x += 0.01) {
    const o = run.openSpot([x, DESK.top, z]);
    if (o.ok && Math.abs(o.y - DESK.top) < 0.005 && spots.every((s) => Math.hypot(s.x - x, s.z - z) > r + CONFIG.player.radius + 0.01)) return V(x, o.y, z);
  }
  return null;
}

act3('coffer-jewels', {
  about: 'Jewels: ten amber jewels shoot up out of sight off the Coffer\'s lid while ten Warnings (5 cm circles with the half sphere over each) fill on random spots of the desk top, spread out (at least 15 cm apart), for 2 s; then the jewels fall fast onto them (seen falling) and burst as Blasts: 3 to a jelly in one, nothing to a jelly standing between them.',
  setup() { startCoffer(2); },
  play() {
    const J = CONTENT.elites.coffer.skills.jewels, tempo = CONTENT.elites.pace.tempo, out = {};
    for (const where of ['in', 'between']) {
      const { e, player } = startCoffer(2), log = record('damage_taken');
      let spots = null, safe = null, up = 0, falling = 0, frames = 0, shown = 0, burstAt = 0;
      step(60 * 5, () => {
        frames++;
        if (!spots && e.spots) {
          spots = e.spots.map((s) => s.clone());
          safe = where === 'in' ? spots[0] : safeSpot(spots, J.radius);
          if (safe) player.position.copy(safe);
        }
        shown = Math.max(shown, cofferPairs().length);
        const gems = e.model.jewels;
        for (let i = 0; i < gems.count; i++) {
          const y = gems.instanceMatrix.array[i * 16 + 13] - e.base.y;
          if (frames < 25) up = Math.max(up, y); else falling = Math.max(falling, y);
        }
        if (e.burst && !burstAt) burstAt = frames;
        return e.state === 'idle' && spots;
      });
      const apart = Math.min(...spots.flatMap((a, i) => spots.slice(i + 1).map((b) => flat(a, b))));
      const onDesk = spots.every((s) => s.x > DESK.min[0] && s.x < DESK.max[0] && s.z > DESK.min[1] && s.z < DESK.max[1] && s.y > DESK.top - 0.01);
      out[where] = { spots: spots.length, shown, apart: +apart.toFixed(3), onDesk, rain: +((burstAt / 60) * tempo).toFixed(2), up: +up.toFixed(2), falling: +falling.toFixed(2), hits: hitsBy(log, 'coffer-jewel'), at: safe && r3(safe) };
    }
    const { in: a, between: b } = out;
    return ok(a.spots === J.count && a.shown === J.count && a.apart >= 0.15 && a.onDesk && Math.abs(a.rain - J.rain) < 0.06 && a.up > 0.3 && a.falling > 0.1
      && a.hits.length === 1 && a.hits[0] === J.dmg && b.spots === J.count && b.at && !b.hits.length, out);
  },
});

act3('coffer-angry', {
  about: 'Under 65% Health the Coffer is angry: its accordion unfolds quicker (0.4 s), its tongue pulls harder, and it fires fourteen jewels.',
  setup() { startCoffer(0, { angry: true }); },
  play() {
    const D = CONTENT.elites.coffer.skills, tempo = CONTENT.elites.pace.tempo;
    let { e } = startCoffer(0, { angry: true });
    const locks = [];
    let k = -1, frames = 0;
    step(60 * 5, () => { frames++; if (e.strike != null && e.strike !== k) { k = e.strike; locks.push(frames); } return e.state === 'idle' && locks.length; });
    const fill = +(((locks[1] - locks[0]) / 60) * tempo).toFixed(2);
    ({ e } = startCoffer(1, { angry: true, hold: false, z: 8.8 }));
    let pull = 0;
    step(60 * 3, () => { if (G().run.elites.pull) pull = Math.max(pull, G().run.elites.pull.length()); return pull > 0; });
    ({ e } = startCoffer(2, { angry: true }));
    step(30, () => e.spots);
    const jewels = e.spots?.length;
    return ok(Math.abs(fill - D.accordion.angryUnfold) < 0.04 && D.accordion.angryUnfold < D.accordion.unfold && Math.abs(pull - D.tongue.angryPull) < 1e-6 && pull > D.tongue.pull && jewels === D.jewels.angryCount,
      { fill, pull: +pull.toFixed(3), jewels });
  },
});

act3('coffer-all-attacks-with-sound', {
  about: 'Each of the Coffer\'s attacks (accordion, tongue, jewels) plays its sounds on live audio without an error (a sound once got no length: harmless with sound off, an error popup in real play).',
  setup() { startCoffer(0); },
  async play() {
    unlockAudio();
    await new Promise((r) => setTimeout(r, 200));
    const done = [];
    for (const atk of [0, 1, 2]) {
      const { e } = startCoffer(atk);
      let went = false;
      step(60 * 8, () => { if (e.state !== 'idle') went = true; return went && e.state === 'idle'; });
      done.push(went);
    }
    return ok(!!audio() && done.every(Boolean), { audio: !!audio(), done });
  },
});

act3('coffer-beaten-leaves-a-chest', {
  about: 'Beat the Coffer and it leaves an Elite chest on the vanity desk; the wooden box it stood in for stays hidden.',
  setup() { fresh({ treasures: false }); },
  play() {
    const { run } = G(), e = coffer();
    for (const t of run.roomTreasures) t.hide();
    e.dead = true;
    step(10);
    const t = run.roomTreasures.find((x) => x.active);
    let real = false;
    run.elites.findObject('Vanity_desk_22').traverse((o) => { if (o.isMesh && o.visible) real = true; });
    const p = t?.pos;
    return ok(p && p.x > DESK.min[0] && p.x < DESK.max[0] && p.z > DESK.min[1] && p.z < DESK.max[1] && p.y > DESK.top - 0.02 && !real && !e.holder.parent, { chest: p && r3(p), realShown: real });
  },
});

act3('coffer-gone-when-the-pothos-wakes', {
  about: 'When time runs out and the Pothos rises on the bed, the Coffer is gone from the desk too (elites are cleared at the boss intro), its tongue and jewels with it.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G(), e = coffer();
    run.startBossIntro();
    step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    return ok(run.phase === 'boss' && !run.elites.list.length && !e.holder.parent && e.model.loose.every((o) => !o.parent) && !run.elites.pull, { phase: run.phase, elites: run.elites.list.length, inScene: !!e.holder.parent });
  },
});
