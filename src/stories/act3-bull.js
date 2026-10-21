// Stories: act 3's second Elite, the Bull (elites.js kind 'bull', bull-model.js): the red plush on
// the changing table (the dresser on the bedroom's north wall). Shared helpers are in ./kit.js;
// src/stories.js imports this file in order.

import * as THREE from 'three';
import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { unlock as unlockAudio, audio, sfx } from '../sfx.js';
import { juice } from '../juice.js';
import { G, V, act3, bull, fresh, ok, onTable, r3, record, spy, startBull, step, tp, volumePairs } from './kit.js';

const onFloor = () => tp(-0.2, 0.05, 8.9, 0);                // on the floor in front of the dresser
const isBull = (o) => o.material.uniforms.uColor.value.getHex() === hostile('bull').getHex();
// the Bull's Warnings showing: floor shapes with the volume over each, filling together
const bullPairs = () => volumePairs().filter(([v, f]) => f && isBull(v));
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
// the jelly's bearing round the Bull's base against where the Bull faces (0: straight at it)
const offFacing = (e, to) => { const d = Math.atan2(to.x - e.base.x, to.z - e.base.z) - e.holder.rotation.y; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };

act3('bull-sleeps-on-the-changing-table', {
  about: 'The Bull sits on the changing table (the dresser on the north wall, its top 1.15 m up) and sleeps while the jelly is down on the floor: its eyes are shut and it never starts an attack.',
  setup() { fresh(); onFloor(); },
  play() {
    const e = bull();
    if (!e) return ok(false, { bull: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    const b = e.base, onTop = b.x > -1.0 && b.x < -0.26 && b.z > 8.14 && b.z < 8.6 && Math.abs(b.y - 1.146) < 0.01;
    return ok(onTop && !e.awake && !started && e.model.eyes.scale.y < 0.4, { at: r3(b), awake: e.awake, started, eyes: +e.model.eyes.scale.y.toFixed(2) });
  },
});

act3('bull-wakes-when-you-are-on-the-table', {
  about: 'Land on the changing table and the Bull wakes (its eyes open), turns to face you and fights; leave the table and it settles back to sleep, facing the room again.',
  setup() { fresh(); onTable(); },
  play() {
    const { player } = G(), e = bull();
    step(60 * 2);
    const awake = e.awake, eyes = e.model.eyes.scale.y, facing = offFacing(e, player.position);
    e.cool = 99;
    onFloor();
    step(60 * 4);
    const rest = Math.abs(Math.atan2(Math.sin(e.holder.rotation.y - e.spec.face), Math.cos(e.holder.rotation.y - e.spec.face)));
    return ok(awake && eyes > 0.8 && facing < 0.3 && !e.awake && e.model.eyes.scale.y < 0.4 && rest < 0.15,
      { awake, eyes: +eyes.toFixed(2), facing: +facing.toFixed(2), asleep: !e.awake, closed: +e.model.eyes.scale.y.toFixed(2), rest: +rest.toFixed(2) });
  },
});

act3('bull-rush', {
  about: 'Bull rush: its horns swell to twice their size and glow while it stamps and a big Warning (a circle with the half sphere over it, 90% of the table top\'s half diagonal) fills round it; then a Blast round itself: 4 and knocked away anywhere in it (beside it, or in the air over the table), nothing outside it. The horns shrink back after.',
  setup() { startBull(0); },
  play() {
    const out = {};
    const R = CONTENT.elites.bull.skills.rush.radius;
    for (const [name, dx, up] of [['beside', R * 0.6, 0], ['over', R * 0.4, 0.12], ['outside', R + 0.06, 0]]) {
      const { e, player, table } = startBull(0), log = record('damage_taken'), knocks = record('knockback');
      player.position.set(e.base.x + dx, table + up, e.base.z);
      player.grounded = !up;
      let radius = 0, horns = 0;
      step(60 * 4, () => {
        const v = bullPairs().find(([w]) => w.material.kind === 'dome');
        if (v) radius = Math.max(radius, v[0].scale.x);
        horns = Math.max(horns, e.model.horns[0].scale.x);
        return e.state === 'idle' && radius > 0;
      });
      out[name] = { radius: +radius.toFixed(3), horns: +horns.toFixed(2), after: +e.model.horns[0].scale.x.toFixed(2), hits: hitsBy(log, 'bull-rush'), away: knocks.filter((k) => k.dir.x > 0.9).length };
    }
    const { beside: b, over: o, outside: x } = out;
    return ok(Math.abs(b.radius - R) < 0.005 && R > 0.35 && b.horns > 1.9 && b.after === 1 && b.hits[0] === 4 && b.away >= 1 && o.hits[0] === 4 && !x.hits.length, out);
  },
});

// every Shot the Bull's spiral fires, as it first shows: its bearing round the Bull, its height
// over the table, when, and its colour; `each()` runs every frame too
function watchSpiral(e, each) {
  const { run } = G(), seen = new Set(), shots = [];
  let frame = 0;
  step(60 * 6, () => {
    frame++;
    for (const b of run.elites.bullets) {
      if (b.source !== 'bull-spiral' || seen.has(b)) continue;
      seen.add(b);
      shots.push({ a: Math.atan2(b.m.position.x - e.base.x, b.m.position.z - e.base.z), h: +(b.m.position.y - e.base.y).toFixed(3), frame, color: new THREE.Color(b.color).getHex() });
    }
    each?.();
    return e.state === 'idle' && shots.length && !run.elites.bullets.length;
  });
  return shots;
}

act3('bull-spiral', {
  about: 'Spiral: a Warning circle fills round the Bull, then it spins and fires red Shots in two arms, always opposite each other, one at floor level and one at jump height; the arms turn as it fires (more than a full turn), so the Shots wind out into a spiral.',
  setup() { startBull(1, { x: -0.3 }); },
  play() {
    const { e } = startBull(1, { x: -0.3 });
    let warned = false;
    const shots = watchSpiral(e, () => { if (e.tele.length && e.tele[0].material.progress > 0.3) warned = true; });
    const byFrame = {};
    for (const s of shots) (byFrame[s.frame] ||= []).push(s);
    const pairs = Object.values(byFrame).filter((p) => p.length === 2);
    const opposite = pairs.every(([a, b]) => Math.abs(Math.abs(Math.atan2(Math.sin(a.a - b.a), Math.cos(a.a - b.a))) - Math.PI) < 0.15 && a.h !== b.h);
    const low = shots.filter((s) => s.h < 0.1), high = shots.filter((s) => s.h > 0.1);
    let turned = 0;
    for (let i = 1; i < low.length; i++) turned += Math.atan2(Math.sin(low[i].a - low[i - 1].a), Math.cos(low[i].a - low[i - 1].a));
    const red = shots.every((s) => s.color === hostile('bull').getHex());
    return ok(warned && shots.length >= 40 && pairs.length >= 20 && opposite && Math.abs(low.length - high.length) <= 4 &&   // (a floor-level Shot fired straight into the pad's raised edge is gone before a frame sees it)
       Math.abs(turned) > Math.PI * 2 && red,
      { warned, shots: shots.length, pairs: pairs.length, opposite, low: low.length, high: high.length, heights: [low[0]?.h, high[0]?.h], turned: +turned.toFixed(2), red });
  },
});

act3('bull-spiral-jump-the-low-arm-stay-down-for-the-high', {
  about: 'The spiral\'s floor-level arm hits a jelly standing on the table and passes under one in the air (feet 8 cm up); its jump-height arm passes over a jelly standing and hits one in the air: 2 a Shot.',
  setup() { startBull(1); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['jumping', 0.08]]) {
      const { e, player, table } = startBull(1, { x: -0.55 }), { run } = G(), log = record('damage_taken');
      player.position.y = table + up; player.grounded = !up;
      const P = player.position, near = new Map(), hit = { low: 0, high: 0 }, passed = { low: 0, high: 0 };
      watchSpiral(e, () => {
        for (const [b, was] of near) if (b.done) { if (was.d < 0.05) hit[was.arm]++; near.delete(b); }
        for (const b of run.elites.bullets) {
          if (b.source !== 'bull-spiral' || b.done) continue;
          const d = Math.hypot(b.m.position.x - P.x, b.m.position.z - P.z), arm = b.m.position.y - e.base.y > 0.1 ? 'high' : 'low';
          const was = near.get(b);
          if (was && d > was.d) { if (was.d < 0.03) passed[arm]++; near.delete(b); continue; }   // right over (or under) the jelly, and on past it
          if (d < 0.06) near.set(b, { d, arm });
        }
      });
      out[name] = { hit, passed, dmg: hitsBy(log, 'bull-spiral') };
    }
    const { standing: s, jumping: j } = out;
    return ok(s.hit.low >= 1 && !s.hit.high && s.passed.high >= 1 && j.hit.high >= 1 && !j.hit.low && j.passed.low >= 1 && s.dmg.length >= 1 && s.dmg.every((n) => n === 2), out);
  },
});

// the little bulls of the attack going now, as the scene has them
const minis = () => G().run.elites.minis;
act3('bull-minis', {
  about: 'Little bulls: two little bulls, as big as the jelly, pop up to its left and right (as the camera sees it; how far: content/elites.kdl), each with a lane Warning (a strip and the box over it) through where the jelly is; then they charge along it: one hits the jelly for 3 and knocks it away, and both burst (squashed flat) and are gone.',
  setup() { startBull(2); },
  play() {
    const { e, player } = startBull(2), { camera } = G().APT, log = record('damage_taken'), knocks = record('knockback');
    const P = player.position.clone(), fwd = V(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    let spawned = null, lanes = 0, moved = 0, squashed = false, meshes = [];
    step(60 * 4, () => {
      const m = minis();
      if (!spawned && m.length === 2) {
        meshes = m.map((b) => b.m);
        const o = m.map((b) => b.m.position.clone().sub(P).setY(0));
        spawned = { dist: o.map((v) => +v.length().toFixed(3)), opposite: +o[0].clone().normalize().dot(o[1].clone().normalize()).toFixed(2), across: +Math.max(...o.map((v) => Math.abs(v.clone().normalize().dot(fwd)))).toFixed(2) };
      }
      lanes = Math.max(lanes, bullPairs().filter(([v]) => v.material.kind === 'lane').length);
      for (const b of m) {
        if (b.state === 'charge') { moved = Math.max(moved, b.along); spawned.tall ||= +new THREE.Box3().setFromObject(b.m).getSize(V(0, 0, 0)).y.toFixed(3); }
        if (b.state === 'burst' && b.m.scale.y < 0.6) squashed = true;
      }
      return e.state === 'idle' && spawned;
    });
    const gone = !minis().length && meshes.length === 2 && meshes.every((m) => !m.parent);
    const hits = hitsBy(log, 'bull-mini');
    return ok(spawned && spawned.dist.every((d) => Math.abs(d - CONTENT.elites.bull.skills.minis.side) < 0.005) && spawned.opposite < -0.95 && spawned.across < 0.1 && Math.abs(spawned.tall - 0.09) < 0.02
      && lanes === 2 && moved > 0.05 && hits.length === 1 && hits[0] === 3 && knocks.length >= 1 && squashed && gone, { spawned, lanes, moved: +moved.toFixed(3), hits, knocks: knocks.length, squashed, gone });
  },
});

act3('bull-minis-with-sound', {
  about: 'The little bulls\' attack plays its sounds on live audio without an error (their rolling sound once got no length: harmless with sound off, an error popup in real play).',
  setup() { startBull(2); },
  async play() {
    unlockAudio();
    await new Promise((r) => setTimeout(r, 200));
    const { e } = startBull(2);
    let charged = false;
    step(60 * 4, () => { if (minis().some((b) => b.state === 'charge')) charged = true; return e.state === 'idle' && charged; });
    return ok(!!audio() && charged, { audio: !!audio(), charged });
  },
});

act3('bull-minis-burst-on-each-other-and-are-jumped', {
  about: 'The little bulls charge straight along their lanes: if the jelly has stepped out of them, they meet where it was and burst on each other; a jelly in the air over them (feet 10 cm up) is not hit, and they still burst on each other under it.',
  setup() { startBull(2); },
  play() {
    const out = {};
    for (const [name, how] of [['stepped', 'step'], ['jumped', 'jump']]) {
      const { e, player, table } = startBull(2), { camera } = G().APT, log = record('damage_taken');
      const fwd = V(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      const burst = [];
      let moved = false;
      step(60 * 4, () => {
        const m = minis();
        if (!moved && m.length === 2 && m[0].state === 'charge') {
          moved = true;
          if (how === 'step') player.position.addScaledVector(fwd, 0.15);
          else { player.position.y = table + 0.1; player.grounded = false; }
        }
        for (const b of m) if (b.state === 'burst' && !burst.includes(b)) burst.push(b);
        return e.state === 'idle' && moved;
      });
      out[name] = { burst: burst.map((b) => +b.along.toFixed(3)), hits: hitsBy(log, 'bull-mini').length, left: minis().length };
    }
    const side = CONTENT.elites.bull.skills.minis.side, meet = (r) => r.burst.length === 2 && r.burst.every((a) => a > side * 0.5 && a < side) && !r.hits && !r.left;
    return ok(meet(out.stepped) && meet(out.jumped), out);
  },
});

// the feel of each attack (docs/agents/attack-feel.md): what the jelly sees and hears as it lands
const liveSplats = () => G().fx.splats.filter((x) => x.alive).length;

act3('bull-rush-feel', {
  about: 'Bull rush feel: the Blast slams the Bull down flat (springing back), throws up stuffing, leaves a scuff on the table that fades, shakes the screen hard (feel impact-big) with its own layered boom, and flashes at the jelly it hit.',
  setup() { startBull(0); },
  play() {
    const { e, player, table } = startBull(0), { fx } = G(), log = record('damage_taken'), feels = spy(juice, 'feel'), impacts = spy(fx, 'impact'), booms = spy(sfx, 'bullRush');
    player.position.set(e.base.x + CONTENT.elites.bull.skills.rush.radius * 0.6, table, e.base.z);
    const before = liveSplats();
    let squash = 0, splats = 0;
    step(60 * 4, () => { squash = Math.max(squash, e.squash || 0); splats = Math.max(splats, liveSplats() - before); return e.state === 'idle' && log.length; });
    const atJelly = impacts.some(([at]) => Math.hypot(at.x - player.position.x, at.z - player.position.z) < 0.01);
    return ok(log.some((d) => d.source === 'bull-rush') && squash > 0.9 && splats >= 1 && feels.some(([k]) => k === 'impact-big') && booms.length === 1 && atJelly,
      { hits: log.length, squash: +squash.toFixed(2), splats, booms: booms.length, atJelly });
  },
});

act3('bull-spiral-feel', {
  about: 'Spiral feel: each beat flashes where its Shots leave, its body pulses and a puff sounds; a Shot that reaches the jelly throws a little stuffing, leaves a scuff under it that fades and thuds.',
  setup() { startBull(1, { x: -0.3 }); },
  play() {
    const { e } = startBull(1, { x: -0.3 }), { run } = G(), log = record('damage_taken'), beats = spy(sfx, 'bullShot'), struck = spy(sfx, 'bullHit'), splats = spy(G().fx, 'splat');
    let pulse = 0;
    step(60 * 6, () => { if (e.attack === 1 && e.stateT > CONTENT.elites.bull.skills.spiral.warn) pulse = Math.max(pulse, e.hitPop); return e.state === 'idle' && beats.length && !run.elites.bullets.length; });
    const hits = log.filter((d) => d.source === 'bull-spiral').length;
    return ok(beats.length > 10 && pulse > 0.3 && hits >= 1 && struck.length >= 1 && splats.length >= 1, { beats: beats.length, pulse: +pulse.toFixed(2), hits, struck: struck.length, splats: splats.length });
  },
});

act3('bull-minis-feel', {
  about: 'Little bulls feel: as they charge the big Bull stamps them off (a squash), each kicks up dust with a flash and a snort sounds; the one that reaches the jelly bursts with a shake (feel impact), stuffing and a scuff that fades.',
  setup() { startBull(2); },
  play() {
    const { e } = startBull(2), log = record('damage_taken'), feels = spy(juice, 'feel'), snorts = spy(sfx, 'bullSnort'), bursts = spy(sfx, 'bullMini');
    const before = liveSplats();
    let squash = 0, splats = 0;
    step(60 * 4, () => { squash = Math.max(squash, e.squash || 0); splats = Math.max(splats, liveSplats() - before); return e.state === 'idle' && log.length; });
    return ok(log.some((d) => d.source === 'bull-mini') && squash > 0.4 && snorts.length === 1 && bursts.some(([hit]) => hit) && feels.some(([k]) => k === 'impact') && splats >= 1,
      { hits: log.length, squash: +squash.toFixed(2), snorts: snorts.length, bursts: bursts.map(([h]) => h), splats });
  },
});

act3('bull-angry', {
  about: 'Under 65% Health the Bull is angry: its horns swell bigger and its rush winds up quicker, its spiral has three arms turning faster, and its little bulls charge faster.',
  setup() { startBull(1, { angry: true, x: -0.3 }); },
  play() {
    let { e } = startBull(1, { angry: true, x: -0.3 });
    const shots = watchSpiral(e), byFrame = {};
    for (const s of shots) (byFrame[s.frame] ||= []).push(s);
    const arms = Math.max(...Object.values(byFrame).map((p) => p.length));
    ({ e } = startBull(0, { angry: true }));
    let horns = 0;
    step(60 * 3, () => { horns = Math.max(horns, e.model.horns[0].scale.x); return e.state === 'idle' && horns > 1; });
    ({ e } = startBull(2, { angry: true }));
    step(60 * 2, () => minis().some((b) => b.state === 'charge'));
    const speed = minis()[0]?.speed;
    const D = e.def.skills;
    return ok(arms === 3 && horns > D.rush.horns + 0.2 && D.rush.angryWindup < D.rush.windup && D.spiral.angryTurn > D.spiral.turn && speed === D.minis.angrySpeed && speed > D.minis.speed,
      { arms, horns: +horns.toFixed(2), speed });
  },
});

act3('bull-gone-when-the-pothos-wakes', {
  about: 'When time runs out and the Pothos rises on the bed, the Bull is gone from the changing table too (elites are cleared at the boss intro).',
  setup() { fresh(); },
  play() {
    const { run, menus } = G(), e = bull();
    run.startBossIntro();
    step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    return ok(run.phase === 'boss' && !run.elites.list.length && !e.holder.parent, { phase: run.phase, elites: run.elites.list.length, inScene: !!e.holder.parent });
  },
});
