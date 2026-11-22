// Stories: act 4's third Elite, the Headphones (elites.js kind 'headphones', headphones-model.js): up on
// their ear cups on the kitchen counter by the stove in the living room at dawn. They keep the song's time
// (run.beat); these play on the run's own beat (no song). Their waves shove rather than hurt, their Stereo
// bursts a half of the counter at a time (cross over on the beat), and the
// counter ends at a drop, so falling off and coming back by the vent is part of the fight. Shared helpers are
// in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { ELITES4 } from '../stage4.js';
import { G, fresh, headphones, night4, ok, onCounter, r3, record, spy, startHeadphones, step, tp } from './kit.js';

const offTable = () => tp(3.9, 0.02, 2.6, 0);                  // on the kitchen floor in front of the counter
const SK = () => CONTENT.elites.headphones.skills;
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
const offSnap = (b) => Math.min(b % 1, 1 - (b % 1));              // beats from the nearest snap line (the Headphones: snap=1, every beat)
const offBeat = (b) => Math.min(b % 1, 1 - (b % 1));
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const VENT = () => G().run.traversal.vents.find((v) => v.name === ELITES4.find((q) => q.kind === 'headphones').vent);
const onTable = (e, p) => G().run.elites.onPlatform(e, p) && p.y > e.base.y - 0.02;   // (on the kitchen counter)
// the shove waves it lets go, as they go: [beat, from, dir]
function watch() {
  const { run } = G(), E = run.elites, waves = [];
  const w = E.wave;
  E.wave = function (from, dir, ...a) { waves.push({ beat: run.beat, from: from.clone(), dir: dir.clone() }); return w.call(this, from, dir, ...a); };
  return { waves, done: () => { E.wave = w; } };
}
// play an attack to its end (or `n` frames), calling `during(i)` each frame
function playOut(e, during, n = 60 * 14) {
  let started = false;
  step(n, (i) => { if (e.plan) started = true; during?.(i); return started && !e.plan && e.state === 'idle'; });
}
// walk the jelly to the stove's vent, steering round what's in the way (a step sideways when it
// stops getting anywhere), until it's landed back on the counter: how long it took (s), or null
function walkToVent(e, secs = 15) {
  const { input, player, tpc } = G(), v = VENT(), last = player.position.clone();
  let side = 0, back = null;
  step(Math.round(secs * 60), (t) => {
    tpc.yaw = Math.atan2(-(v.at[0] - player.position.x), -(v.at[2] - player.position.z));
    if (t % 30 === 0) { if (player.position.distanceTo(last) < 0.02) side = 24; last.copy(player.position); }
    input.keys = new Set(player.flight ? [] : side-- > 0 ? ['KeyD'] : ['KeyW']);
    if (t > 5 && !player.flight && onTable(e, player.position)) { back = t / 60; return true; }
  });
  input.keys = new Set();
  return back;
}

night4('headphones-sleep-on-the-counter', {
  about: 'The Headphones stand on the kitchen counter in place of the real pair on the coffee table (hidden while they are alive) and sleep while the jelly is off the counter: eyes shut, no attack.',
  setup() { fresh(); offTable(); },
  play() {
    const { run } = G(), e = headphones();
    if (!e) return ok(false, { headphones: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    const real = run.elites.findObject('Headphones').visible;
    const on = flat(e.base, { x: 4.62, z: 2.85 }) < 0.01 && Math.abs(e.base.y - 0.94) < 0.02;
    return ok(on && !real && !e.awake && !started && e.model.eyes.scale.y < 0.4, { at: r3(e.base), realShown: real, awake: e.awake, started, eyes: +e.model.eyes.scale.y.toFixed(2) });
  },
});

night4('headphones-wake-when-you-are-on-the-counter', {
  about: 'Land on the kitchen counter and the Headphones wake (eyes open) and turn to face you; leave it and they settle back to sleep. Their Health is act 3\'s 800 at act 4\'s Elite multiplier, like the other two room Elites\'.',
  setup() { fresh(); onCounter(); },
  play() {
    const { run, player } = G(), e = headphones();
    step(60 * 2);
    const awake = e.awake, eyes = e.model.eyes.scale.y, d = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z) - e.holder.rotation.y;
    const facing = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    e.cool = 99;
    offTable();
    step(60 * 4);
    const others = run.elites.list.filter((q) => q.kind !== 'headphones').map((q) => q.maxHp);
    const hp = e.maxHp === Math.round(CONTENT.elites.headphones.hp * run.stage.eliteHp) && others.every((h) => h === e.maxHp);
    return ok(awake && eyes > 0.8 && facing < 0.3 && !e.awake && e.model.eyes.scale.y < 0.4 && hp,
      { awake, eyes: +eyes.toFixed(2), facing: +facing.toFixed(2), asleep: !e.awake, maxHp: e.maxHp, others });
  },
});

night4('headphones-shove-waves-on-the-bar', {
  about: 'Shove waves: the ear cups take turns, one wave a bar on the bar line. Each one\'s Warning, a white strip from the cup through the jelly to the counter\'s edge and the low lane over it, fills to the wave; then a white sound wave rolls down it. It does no damage: a jelly in its way is shoved along it, about 20 cm.',
  setup() { startHeadphones(0, { hold: true }); },
  play() {
    const { e, player } = startHeadphones(0, { hold: true }), { run } = G(), W = SK().shove, log = record('damage_taken'), seen = watch();
    let white = 0, edge = 0, moved = null;
    const at = player.position.clone();
    playOut(e, () => {
      const [strip, lane] = e.tele;
      if (strip && lane && strip.material.shape === 'strip' && lane.material.kind === 'lane' && lane.material.uniforms.uColor.value.getHex() === run.elites.waveColor.getHex()) white++;
      if (strip) edge = Math.max(edge, strip.scale.z);
      // a held jelly isn't moved, so the shove shows as the run's pull on it: its first one, along the wave
      if (run.elites.washT > 0 && !moved) moved = run.elites.washDir.clone().multiplyScalar(run.elites.washT);
    });
    seen.done();
    const cups = seen.waves.map((w) => w.from), along = moved && seen.waves[0] ? moved.clone().normalize().dot(seen.waves[0].dir) : 0;
    const good = seen.waves.length === W.waves && seen.waves.every((w) => offSnap(w.beat) < 0.05) && flat(cups[0], cups[1]) > 0.1 && flat(cups[0], cups[2]) < 0.03
      && white > 60 && edge > flat(cups[0], at) && !log.length && moved && along > 0.99 && Math.abs(moved.length() - W.push) < 0.03;
    return ok(good, { waves: seen.waves.map((w) => +w.beat.toFixed(2)), cupsApart: +flat(cups[0], cups[1]).toFixed(2), white, edge: +edge.toFixed(2), hurt: log.length, push: moved && +moved.length().toFixed(3), along: +along.toFixed(3) });
  },
});

night4('headphones-shove-moves-you-and-a-jump-keeps-you-put', {
  about: 'A shove wave moves a jelly standing in its lane about 20 cm along it, the way the wave goes; a jelly in the air over the lane\'s top as the wave passes stays where it is.',
  setup() { startHeadphones(0); },
  play() {
    const out = {};
    for (const jump of [false, true]) {
      const { e, player, top } = startHeadphones(0, { x: 4.62, z: 2.55 }), { run } = G(), W = SK().shove, seen = watch();   // (between them and the room's edge: room to slide)
      const at = player.position.clone();
      step(60 * 8, () => {
        const w = run.elites.waves[0];
        if (jump && w) { const d = flat(player.position, w.from) - w.f; if (d < 0.12 && d > -0.08) { player.position.y = top + W.height + 0.02; player.velocity.y = 0; } }   // up over its top as it passes
        return seen.waves.length && !run.elites.waves.length;
      });
      seen.done();
      e.cool = 1e9; e.cancelAttack(); e.cool = 1e9;
      step(30);
      const d = new THREE.Vector3().subVectors(player.position, at).setY(0);
      out[jump ? 'jumped' : 'stayed'] = { moved: +d.length().toFixed(3), along: seen.waves[0] ? +d.clone().normalize().dot(seen.waves[0].dir).toFixed(2) : null };
    }
    const { stayed, jumped } = out, W = SK().shove;
    return ok(Math.abs(stayed.moved - W.push) < 0.04 && stayed.along > 0.95 && jumped.moved < 0.02, out);
  },
});

night4('headphones-shove-off-the-edge-and-back-by-the-vent', {
  about: 'The counter\'s edge is a drop: a jelly near it that rides a shove falls off (unhurt), and the Headphones call their attack off. The vent by the stove brings it back: walk to it and you land on the kitchen counter again, and they fight on.',
  setup() { startHeadphones(0); },
  play() {
    const { e, player } = startHeadphones(0, { x: 4.45, z: 2.85 }), log = record('damage_taken');
    let off = null;
    step(60 * 10, () => { if (player.position.y < e.base.y - 0.1) off = r3(player.position); return off && player.grounded; });
    const called = e.state === 'idle' && !e.tele.length;
    const back = off && walkToVent(e);
    e.cool = 0;
    let again = false;
    step(60 * 4, () => (again = e.state !== 'idle'));
    return ok(off && called && back != null && again && !log.length, { off, called, back, again, at: r3(player.position), hurt: log.length });
  },
});

night4('headphones-counter-never-strands-you', {
  about: 'Wherever a jelly comes off the kitchen counter, on the kitchen floor in front of it, it can walk to the vent by the stove (steering round the clutter) and is carried back up onto the kitchen counter in a few seconds.',
  setup() { fresh(); },
  play() {
    const out = [];
    for (const [x, z] of [[3.5, 2.3], [3.5, 3.0], [3.9, 1.8], [3.9, 2.6], [3.9, 3.3], [4.15, 2.2], [4.15, 3.0], [4.1, 3.6], [3.6, 3.9], [3.5, 1.6]]) {
      fresh(); tp(x, 0.3, z, 0);
      out.push({ from: [x, z], back: walkToVent(headphones(), 12) });
    }
    return ok(out.every((r) => r.back != null && r.back < 10), out);
  },
});

// Stereo's halves, as the plan holds them: one entry per burst, [beat, half 0/1, the marks' colour hex, x range]
const LOW = () => hostile('headphones').getHex(), HIGH = () => hostile('headphones-right').getHex();
const side = (e, p) => (p.x < e.base.x ? 0 : 1);   // the half a jelly's middle is on (0: x under the line through the Headphones)
// play Stereo out (the jelly held where it is, or moved by `during(i, e)` each frame); what it bursts as it goes
function stereo(e, during) {
  const { run } = G(), bursts = [];
  let k = 0, marked = null;
  playOut(e, (i) => {
    const L = e.plan;
    if (L?.marks) marked = { colour: L.marks[0].material.uniforms.uColor.value.getHex(), x: [L.marks[0].position.x - L.marks[0].scale.x, L.marks[0].position.x + L.marks[0].scale.x], z: [L.marks[0].position.z - L.marks[0].scale.z, L.marks[0].position.z + L.marks[0].scale.z], square: L.marks[0].material.shape === 'square' && L.marks[1].material.kind === 'symbol-square', progress: L.marks[0].material.progress, tall: L.marks[1].scale.y };
    if (L && L.k > k) { k = L.k; bursts.push({ beat: run.beat, half: (L.half + k - 1) % 2, marked }); }
    during?.(i, e);
  });
  return bursts;
}

night4('headphones-stereo-halves-burst-on-the-beat', {
  about: 'Stereo: a line down the counter through the Headphones splits its ground into two halves. A cup lights up and marks its half, a floor square and a slab over it, each half in its own hostile colour (indigo, spearmint), filling to its beat; then that half bursts, the other cup\'s half two beats later, and so on. The first half is the one the jelly is standing on. Calm: no wave.',
  setup() { startHeadphones(1, { hold: true }); },
  play() {
    const out = {}, { run } = G(), S = SK().stereo;
    for (const [name, x] of [['lowSide', 4.57], ['highSide', 4.8]]) {
      const { e } = startHeadphones(1, { hold: true, x, z: 2.45 }), seen = watch(), W = e.spec.wake;
      const lit = [0, 0];
      const bursts = stereo(e, () => e.lit.forEach((v, i) => { lit[i] = Math.max(lit[i], v); }));
      seen.done();
      const first = bursts[0]?.half;
      const alternates = bursts.every((b, k) => b.half === (first + k) % 2 && b.marked?.colour === (b.half ? HIGH() : LOW()) && b.marked.square && b.marked.progress > 0.9 && b.marked.tall === S.height);
      const spans = bursts.every((b) => Math.abs(b.marked.z[0] - W.min[2]) < 0.01 && Math.abs(b.marked.z[1] - W.max[2]) < 0.01
        && (b.half ? Math.abs(b.marked.x[0] - e.base.x) < 0.01 && Math.abs(b.marked.x[1] - W.max[0]) < 0.01 : Math.abs(b.marked.x[0] - W.min[0]) < 0.01 && Math.abs(b.marked.x[1] - e.base.x) < 0.01));
      const timed = bursts.length === S.bursts && offSnap(bursts[0].beat) < 0.05 && bursts.every((b, k) => !k || Math.abs(b.beat - bursts[k - 1].beat - S.every) < 0.05);
      out[name] = { n: bursts.length, first, beats: bursts.map((b) => +b.beat.toFixed(2)), alternates, spans, timed, waves: seen.waves.length, lit: lit.map((v) => +v.toFixed(2)) };
      out[name].ok = first === (name === 'lowSide' ? 0 : 1) && alternates && spans && timed && !seen.waves.length && lit.every((v) => v > 0.9);
    }
    return ok(out.lowSide.ok && out.highSide.ok, out);
  },
});

night4('headphones-stereo-only-the-marked-half-hurts', {
  about: 'A half that bursts hurts a jelly whose middle is on it (its dmg), even one in the air under the slab\'s top: a jump does not clear it. A jelly that stays put on one half is hit by that half\'s bursts and not by the other\'s.',
  setup() { startHeadphones(1, { hold: true }); },
  play() {
    const S = SK().stereo, out = {};
    for (const jump of [false, true]) {
      const { e, player, top } = startHeadphones(1, { hold: true }), log = record('damage_taken');
      const bursts = stereo(e, () => { if (jump && e.plan && e.plan.marks && e.plan.marks[0].material.progress > 0.9) player.position.y = top + 0.2; });
      const hits = hitsBy(log, 'headphones-stereo');
      out[jump ? 'jumping' : 'standing'] = { bursts: bursts.map((b) => b.half), hits };
    }
    // a jelly on the low half (x 4.57) is hit by every even-numbered burst, the low half's, never by the high half's
    const pattern = Array.from({ length: S.bursts }, (_, i) => i % 2).join(), mine = Math.ceil(S.bursts / 2);
    const good = ['standing', 'jumping'].every((n) => out[n].bursts.join() === pattern && out[n].hits.length === mine && out[n].hits.every((h) => h === S.dmg));
    return ok(good, out);
  },
});

night4('headphones-stereo-crossing-on-the-beat-avoids-both', {
  about: 'Cross to the other half as each one is marked and no burst touches the jelly: it is on the unmarked half at every burst, from the first (the half it started on) to the last.',
  setup() { startHeadphones(1); },
  play() {
    const { e, player } = startHeadphones(1), log = record('damage_taken'), S = SK().stereo;
    let crossed = 0, was = -1;
    const bursts = stereo(e, () => {
      const L = e.plan; if (!L || L.k >= L.due.length) return;
      const marked = (L.half + L.k) % 2;                                   // the half about to burst
      if (was !== L.k) { was = L.k; if (side(e, player.position) === marked) { crossed++; player.position.x = e.base.x + (marked ? -0.1 : 0.1); } }
    });
    return ok(bursts.length === S.bursts && crossed === S.bursts && !hitsBy(log, 'headphones-stereo').length, { bursts: bursts.length, crossed, hurt: hitsBy(log, 'headphones-stereo') });
  },
});

night4('headphones-stereo-can-be-crossed-on-foot', {
  about: 'Walking at the jelly\'s base speed, from the far edge of the half it starts on, it gets across the line before the first burst and back before each next one: the two-beat Warnings are enough on foot (a jelly walks 0.42 m/s; a beat is 0.47 s at the act\'s 128 BPM).',
  setup() { startHeadphones(1); },
  play() {
    const { e, player } = startHeadphones(1, { x: 4.4, z: 2.45 }), { input, tpc } = G(), log = record('damage_taken');
    let moved = 0;
    const bursts = stereo(e, () => {
      const L = e.plan; if (!L || L.k >= L.due.length) { input.keys = new Set(); return; }
      const safe = 1 - (L.half + L.k) % 2, goal = e.base.x + (safe ? 0.06 : -0.06);   // the half that won't burst next: 6 cm past the line
      const need = side(e, player.position) !== safe || Math.abs(player.position.x - goal) > 0.07 && (safe ? player.position.x < goal : player.position.x > goal);
      if (need) { moved++; tpc.yaw = Math.atan2(-(goal - player.position.x), 0); input.keys = new Set(['KeyW']); } else input.keys = new Set();
    });
    G().input.keys = new Set();
    return ok(bursts.length === SK().stereo.bursts && !hitsBy(log, 'headphones-stereo').length, { bursts: bursts.length, hurt: hitsBy(log, 'headphones-stereo'), walkedFrames: moved, at: r3(player.position) });
  },
});

night4('headphones-stereo-never-covers-all-the-ground', {
  about: 'Neither half of Stereo ever covers all the ground a jelly can stand on: the counter\'s top (every spot within 3 cm of its height inside the Headphones\' wake box) is split by the line through the Headphones, each half is a strip of it with at least a third of the spots, the two together are all of them and the line is shared (a spot counts for the high half).',
  setup() { startHeadphones(1, { hold: true }); },
  play() {
    const { e } = startHeadphones(1, { hold: true }), { run } = G(), E = run.elites, W = e.spec.wake, top = e.base.y;
    const spots = [], p = new THREE.Vector3();
    for (let x = W.min[0] + 0.01; x < W.max[0]; x += 0.02) for (let z = W.min[2] + 0.01; z < W.max[2]; z += 0.02) if (Math.abs(E.surfaceBelow(p.set(x, top + 0.05, z)) - top) < 0.03) spots.push([x, z]);
    const marks = [];
    stereo(e, () => { const L = e.plan; if (L?.marks && L.k < 2 && !marks[L.k]) marks[L.k] = { x: [L.marks[0].position.x - L.marks[0].scale.x, L.marks[0].position.x + L.marks[0].scale.x], z: [L.marks[0].position.z - L.marks[0].scale.z, L.marks[0].position.z + L.marks[0].scale.z] }; });
    const inside = (m, [x, z]) => x >= m.x[0] && x <= m.x[1] && z >= m.z[0] && z <= m.z[1];
    const covered = marks.map((m) => spots.filter((q) => inside(m, q)).length), both = spots.filter((q) => marks.every((m) => inside(m, q))).length, either = spots.filter((q) => marks.some((m) => inside(m, q))).length;
    return ok(marks.length === 2 && spots.length > 200 && covered.every((c) => c < spots.length && c >= spots.length / 3) && either === spots.length && both === 0 && Math.abs(marks[0].x[1] - e.base.x) < 0.01,
      { spots: spots.length, covered, both, either });
  },
});

night4('headphones-stereo-angry-wave-crosses-the-line', {
  about: 'Angry (under 65% Health) Stereo has angryBursts bursts and, a beat after each burst but the last, the cup that burst sends a shove wave at the jelly across the line (the shove\'s own white Warning, locking half a beat before). Crossing back toward that cup, a jelly that stays down is shoved 20 cm back into the half about to burst and hit; one that jumps the wave (low, over its 5 cm top) is not shoved and crosses cleanly. The wave never hurts.',
  setup() { startHeadphones(1, { angry: true }); },
  play() {
    const S = SK().stereo, W = SK().shove, out = {};
    const by = S.every > S.lead ? 1 : 2;   // bursts per wave: a wave still on its way keeps the next one off, so with every= no longer than lead= only every second burst sends one
    for (const jump of [true, false]) {
      const { e, player, top } = startHeadphones(1, { angry: true }), { run } = G(), log = record('damage_taken'), seen = watch();
      let was = -1, wash = false;
      const shoves = [];
      const bursts = stereo(e, () => {
        const L = e.plan; if (!L) return;
        // cross as each half is marked, just over the line (close enough that a shove keeps it on the counter)
        if (L.k < L.due.length && was !== L.k) { was = L.k; const marked = (L.half + L.k) % 2; if (side(e, player.position) === marked) player.position.x = e.base.x + (marked ? -0.04 : 0.04); }
        const w = run.elites.waves[0];
        if (jump && w) { const d = flat(player.position, w.from) - w.f; if (d < 0.12 && d > -0.08) { player.position.y = top + W.height + 0.02; player.velocity.y = 0; } }   // up over its top as it passes
        const washed = run.elites.washT > 0; if (washed && !wash) shoves.push(run.elites.washDir.clone().multiplyScalar(run.elites.washT)); wash = washed;
      });
      seen.done();
      const w = seen.waves, line = e.base.x;
      out[jump ? 'jumped' : 'stayed'] = { bursts: bursts.length, waves: w.length,
        fromBurst: w.every((q, j) => (bursts[by * j].half ? q.from.x > line : q.from.x < line)),   // from the cup that burst
        crossing: w.every((q, j) => (bursts[by * j].half ? q.dir.x < 0 : q.dir.x > 0)),           // toward the half about to burst
        leads: w.every((q, j) => Math.abs(q.beat - bursts[by * j].beat - S.lead) < 0.06),
        shoves: shoves.map((m) => +m.length().toFixed(3)), hurt: log.map((d) => d.source) };
    }
    const { jumped, stayed } = out;
    const shape = (r) => r.bursts === S.angryBursts && r.waves === Math.floor((S.angryBursts - 1) / by + (by - 1) / 2) && r.fromBurst && r.crossing && r.leads;
    return ok(shape(jumped) && !jumped.shoves.length && !jumped.hurt.length
      && stayed.bursts >= 2 && stayed.waves >= 1 && stayed.fromBurst && stayed.crossing && stayed.leads && Math.abs(stayed.shoves[0] - W.push) < 0.03 && (stayed.hurt.includes('headphones-stereo') || stayed.bursts < S.angryBursts) && !stayed.hurt.some((h) => h !== 'headphones-stereo'), out);
  },
});

night4('headphones-call-off-an-attack-when-the-beat-jumps', {
  about: 'If the song\'s beat jumps mid-attack (a menu ate some of it, or the song just started), the Headphones call the attack off rather than letting go unwarned: their Warnings go, nothing more is fired, and they start again later.',
  setup() { startHeadphones(0, { hold: true }); },
  play() {
    const out = {};
    for (const atk of [0, 1]) {
      const { e } = startHeadphones(atk, { hold: true }), { run } = G(), seen = watch(), log = record('damage_taken');
      step(60 * 2, () => e.tele.length && e.tele[0].material.progress > 0.3);
      const warned = e.tele.length > 0;
      run.beat += 6;
      step(2);
      let off = e.state === 'idle' && !e.tele.length && !e.plan && !seen.waves.length;
      let again = false;
      step(60 * 4, () => (again = e.state !== 'idle'));
      seen.done();
      off = off && !log.length;   // (a burst after the jump would have hurt the held jelly)
      out[atk ? 'stereo' : 'shove'] = { warned, off, again };
    }
    return ok(Object.values(out).every((r) => r.warned && r.off && r.again), out);
  },
});

night4('headphones-attacks-feel', {
  about: 'Headphones feel: a cup\'s speaker glows as it gets ready and the cup kicks back as it plays, with a flash at it; a wave lifts fading motes off the glass and flashes white on the jelly it shoves; a Stereo burst flashes at its cup, throws sparks off its half and leaves a fading muted scuff there, and one that hits the jelly throws a buzz of sparks off it, leaves a scuff under it and lands with feel impact.',
  setup() { startHeadphones(0); },
  play() {
    let { e } = startHeadphones(0, { x: 4.62, z: 2.55 }), { run } = G();
    const fx = run.elites.fx, impacts = spy(fx, 'impact'), motes = spy(fx.glow, 'emit');
    let glow = 0, kick = 0;
    playOut(e, () => { glow = Math.max(glow, ...e.model.glows.map((m) => m.material.opacity)); kick = Math.max(kick, ...e.pump); });
    const white = run.elites.waveColor.getHex(), shove = { glow: +glow.toFixed(2), kick: +kick.toFixed(2), flashes: impacts.filter(([, c]) => c.getHex?.() === white).length, motes: motes.length };
    ({ e } = startHeadphones(1, { hold: true }));
    const flashes = spy(fx, 'impact'), sparks = spy(fx, 'burst'), splats = spy(fx, 'splat'), feels = spy(juice, 'feel');
    const mark = hostile('headphones').getHex(), other = hostile('headphones-right').getHex();
    playOut(e);
    step(60 * 2);
    const S = SK().stereo, stereo = { flashes: flashes.filter(([, c]) => [mark, other].includes(c.getHex?.())).length, sparks: sparks.length, scuffs: splats.length, hit: feels.filter(([k]) => k === 'hit').length, impact: feels.filter(([k]) => k === 'impact').length };
    // every burst: a flash at its cup, sparks and a scuff on its half, feel hit; the held jelly is on the low half, hit by two of the four, each with its own sparks, scuff and feel impact
    return ok(shove.glow > 0.5 && shove.kick > 0.5 && shove.flashes > SK().shove.waves / 2 && shove.motes > 10
      && stereo.flashes >= S.bursts && stereo.sparks >= S.bursts + 2 && stereo.scuffs >= S.bursts + 2 && stereo.hit >= S.bursts && stereo.impact >= 2, { shove, stereo });
  },
});
