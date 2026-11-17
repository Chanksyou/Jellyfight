// Stories: act 4's third Elite, the Headphones (elites.js kind 'headphones', headphones-model.js): up on
// their ear cups on the glass coffee table in the living room at dawn. They keep the song's time
// (run.beat); these play on the run's own beat (no song). Their waves shove rather than hurt, and the
// table is small, so falling off and coming back by the vent is part of the fight. Shared helpers are
// in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { ELITES4 } from '../stage4.js';
import { G, fresh, headphones, night4, ok, onCoffeeTable, r3, record, spy, startHeadphones, step, tp } from './kit.js';

const offTable = () => tp(3.2, 0.02, 3.4, 0);                  // on the floor past the table's end
const SK = () => CONTENT.elites.headphones.skills;
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
const offBar = (b) => Math.min(b % 4, 4 - (b % 4));              // beats from the nearest bar line
const offBeat = (b) => Math.min(b % 1, 1 - (b % 1));
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const VENT = () => G().run.traversal.vents.find((v) => v.name === ELITES4.find((q) => q.kind === 'headphones').vent);
const onTable = (e, p) => G().run.elites.onPlatform(e, p) && p.y > e.base.y - 0.02;
// the waves and Shots it lets go, as they go: [beat, from, dir] and [beat, from, to, source]
function watch() {
  const { run } = G(), E = run.elites, waves = [], shots = [];
  const w = E.wave, s = E.shoot;
  E.wave = function (from, dir, ...a) { waves.push({ beat: run.beat, from: from.clone(), dir: dir.clone() }); return w.call(this, from, dir, ...a); };
  E.shoot = function (from, to, c, source, ...a) { shots.push({ beat: run.beat, from: from.clone(), to: to.clone(), source }); return s.call(this, from, to, c, source, ...a); };
  return { waves, shots, done: () => { E.wave = w; E.shoot = s; } };
}
// play an attack to its end (or `n` frames), calling `during(i)` each frame
function playOut(e, during, n = 60 * 14) {
  let started = false;
  step(n, (i) => { if (e.plan) started = true; during?.(i); return started && !e.plan && e.state === 'idle'; });
}
// walk the jelly to the coffee table's vent, steering round what's in the way (a step sideways when it
// stops getting anywhere), until it's landed back on the table: how long it took (s), or null
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

night4('headphones-sleep-on-the-coffee-table', {
  about: 'The Headphones stand on the glass coffee table in place of the real pair on its stand (hidden while they are alive) and sleep while the jelly is off the table: eyes shut, no attack.',
  setup() { fresh(); offTable(); },
  play() {
    const { run } = G(), e = headphones();
    if (!e) return ok(false, { headphones: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    const real = run.elites.findObject('Headphones').visible;
    const on = flat(e.base, { x: 1.75, z: 2.9 }) < 0.01 && Math.abs(e.base.y - 0.46) < 0.02;
    return ok(on && !real && !e.awake && !started && e.model.eyes.scale.y < 0.4, { at: r3(e.base), realShown: real, awake: e.awake, started, eyes: +e.model.eyes.scale.y.toFixed(2) });
  },
});

night4('headphones-wake-when-you-are-on-the-table', {
  about: 'Land on the coffee table and the Headphones wake (eyes open) and turn to face you; leave it and they settle back to sleep. Their Health is act 3\'s 800 at act 4\'s Elite multiplier, like the other two room Elites\'.',
  setup() { fresh(); onCoffeeTable(); },
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
  about: 'Shove waves: the ear cups take turns, one wave a bar on the bar line. Each one\'s Warning, a white strip from the cup through the jelly to the table\'s edge and the low lane over it, fills to the wave; then a white sound wave rolls down it. It does no damage: a jelly in its way is shoved along it, about 20 cm.',
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
    const good = seen.waves.length === W.waves && seen.waves.every((w) => offBar(w.beat) < 0.05) && flat(cups[0], cups[1]) > 0.1 && flat(cups[0], cups[2]) < 0.03
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
      const { e, player, top } = startHeadphones(0, { x: 2.45, z: 2.85 }), { run } = G(), W = SK().shove, seen = watch();   // (the open end of the table: room to slide)
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
  about: 'The table is small: a jelly near its edge that rides a shove falls off (unhurt), and the Headphones call their attack off. The vent by the coffee table brings it back: walk to it and you land on the table again, and they fight on.',
  setup() { startHeadphones(0); },
  play() {
    const { e, player } = startHeadphones(0, { x: 2.3, z: 3.08 }), log = record('damage_taken');
    let off = null;
    step(60 * 10, () => { if (player.position.y < e.base.y - 0.1) off = r3(player.position); return off && player.grounded; });
    const called = e.state === 'idle' && !e.tele.length;
    const back = off && walkToVent(e);
    e.cool = 0;
    let again = false;
    step(60 * 4, () => (again = e.state !== 'idle'));
    return ok(off && called && back != null && again && !hitsBy(log, 'headphones-bass').length, { off, called, back, again, at: r3(player.position), hurt: log.length });
  },
});

night4('headphones-table-never-strands-you', {
  about: 'Wherever a jelly comes off the coffee table, all round it and under it, it can walk to the vent by the table (steering round the legs) and is carried back up onto the table top in a few seconds.',
  setup() { fresh(); },
  play() {
    const out = [];
    for (const [x, z] of [[1.4, 2.4], [1.4, 2.9], [1.45, 3.3], [1.9, 3.35], [2.4, 3.3], [2.9, 3.2], [2.9, 2.7], [2.85, 2.35], [2.3, 2.38], [1.8, 2.38], [2.0, 2.8], [2.5, 3.15]]) {
      fresh(); tp(x, 0.3, z, 0);
      out.push({ from: [x, z], back: walkToVent(headphones(), 12) });
    }
    return ok(out.every((r) => r.back != null && r.back < 10), out);
  },
});

night4('headphones-bass-shots-on-the-beat', {
  about: 'Bass Shots: from a bar line, a Shot a beat, the ear cups taking turns. Each one\'s Warning (a line on the table and the tube over it to the jelly\'s middle, in the Headphones\' indigo) fills to its beat; a jelly that stands still is hit by every one.',
  setup() { startHeadphones(1, { hold: true }); },
  play() {
    const { e, player } = startHeadphones(1, { hold: true }), B = SK().bass, log = record('damage_taken'), seen = watch();
    let tubes = 0;
    const col = hostile('headphones').getHex();
    playOut(e, () => { if (e.tele.length === 2 && e.tele[1].material.kind === 'lane' && e.tele[1].material.uniforms.uColor.value.getHex() === col && e.tele[1].rotation.order === 'YXZ') tubes++; });
    step(60 * 2);
    seen.done();
    const S = seen.shots, mid = player.position.y + CONFIG.player.height * 0.5, hits = hitsBy(log, 'headphones-bass');
    const good = S.length === B.shots && offBar(S[0].beat) < 0.05 && S.every((s, k) => offBeat(s.beat) < 0.05 && (!k || Math.abs(s.beat - S[k - 1].beat - B.every) < 0.05))
      && flat(S[0].from, S[1].from) > 0.1 && S.every((s) => Math.abs(s.to.y - mid) < 0.005) && tubes > 60 && hits.length === B.shots && hits.every((h) => h === B.dmg);
    return ok(good, { beats: S.map((s) => +s.beat.toFixed(2)), cupsApart: S[1] && +flat(S[0].from, S[1].from).toFixed(2), tubes, hits });
  },
});

night4('headphones-bass-dodged-by-stepping-sideways', {
  about: 'Each bass Shot\'s Warning locks half a beat before it fires and the Shot flies down it: a jelly that steps 8 cm sideways after each lock (always the same way, so it never steps into the last Shot still flying) is never hit.',
  setup() { startHeadphones(1, { hold: true }); },
  play() {
    const { e, player } = startHeadphones(1, { hold: true }), B = SK().bass, log = record('damage_taken');
    let steps = 0, k = -1;
    playOut(e, () => {
      const L = e.plan;
      if (L && L.k < L.due.length && G().run.beat >= L.due[L.k] - B.lock && k !== L.k) {
        k = L.k; steps++;
        const d = new THREE.Vector3(L.aim.x - L.mouth.x, 0, L.aim.z - L.mouth.z).normalize();
        player.position.x += d.z * 0.08; player.position.z -= d.x * 0.08;   // across the line, toward the table's middle
      }
    });
    step(60 * 2);
    return ok(steps === B.shots && !hitsBy(log, 'headphones-bass').length, { steps, hits: hitsBy(log, 'headphones-bass') });
  },
});

night4('headphones-angry-shove-and-shot-together', {
  about: 'Under 65% Health the Headphones are angry: with each shove wave the other cup fires a bass Shot at jump height along with it, as fast as the wave, its Warning beside the wave\'s. A jelly that stays down rides the shove and the Shot flies over it; one that jumps the wave flies into the Shot.',
  setup() { startHeadphones(0, { angry: true }); },
  play() {
    const out = {}, B = SK().bass, W = SK().shove;
    for (const jump of [false, true]) {
      const { e, player, top } = startHeadphones(0, { angry: true, x: 2.45, z: 2.85 }), { run } = G(), log = record('damage_taken'), seen = watch();
      let both = 0;
      step(60 * 8, () => {
        if (e.tele.length === 4 && e.tele[3].material.uniforms.uColor.value.getHex() === hostile('headphones').getHex()) both++;
        const w = run.elites.waves[0];
        if (jump && w) { const d = flat(player.position, w.from) - w.f; if (d < 0.1 && d > -0.15) { player.position.y = top + 0.11; player.velocity.y = 0; player.grounded = false; } }   // up through the Shot's height as they pass
        return seen.waves.length && !run.elites.waves.length && !run.elites.bullets.length;
      });
      seen.done();
      const shot = seen.shots[0], wave = seen.waves[0];
      out[jump ? 'jumped' : 'stayed'] = { both, together: shot && wave && Math.abs(shot.beat - wave.beat) < 1e-6, high: shot && +(shot.to.y - e.base.y).toFixed(3), hits: hitsBy(log, 'headphones-bass'), shoved: !!wave && flat(player.position, wave.from) > 0 };
    }
    const { stayed, jumped } = out;
    return ok(stayed.both > 60 && stayed.together && Math.abs(stayed.high - 0.16) < 0.005 && !stayed.hits.length && jumped.together && jumped.hits.length === 1 && jumped.hits[0] === B.dmg && W.speed > 0, out);
  },
});

night4('headphones-call-off-an-attack-when-the-beat-jumps', {
  about: 'If the song\'s beat jumps mid-attack (a menu ate some of it, or the song just started), the Headphones call the attack off rather than letting go unwarned: their Warnings go, nothing more is fired, and they start again later.',
  setup() { startHeadphones(0, { hold: true }); },
  play() {
    const out = {};
    for (const atk of [0, 1]) {
      const { e } = startHeadphones(atk, { hold: true }), { run } = G(), seen = watch();
      step(60 * 2, () => e.tele.length && e.tele[0].material.progress > 0.3);
      const warned = e.tele.length > 0;
      run.beat += 6;
      step(2);
      const off = e.state === 'idle' && !e.tele.length && !e.plan && seen.waves.length + seen.shots.length === 0;
      let again = false;
      step(60 * 4, () => (again = e.state !== 'idle'));
      seen.done();
      out[atk ? 'bass' : 'shove'] = { warned, off, again };
    }
    return ok(Object.values(out).every((r) => r.warned && r.off && r.again), out);
  },
});

night4('headphones-attacks-feel', {
  about: 'Headphones feel: a cup\'s speaker glows as it gets ready and the cup kicks back as it plays, with a flash at it; a wave lifts fading motes off the glass and flashes white on the jelly it shoves; a bass Shot that hits throws sparks, leaves a fading scuff and lands with feel impact.',
  setup() { startHeadphones(0); },
  play() {
    let { e } = startHeadphones(0, { x: 2.0, z: 2.9 }), { run } = G();
    const fx = run.elites.fx, impacts = spy(fx, 'impact'), motes = spy(fx.glow, 'emit');
    let glow = 0, kick = 0;
    playOut(e, () => { glow = Math.max(glow, ...e.model.glows.map((m) => m.material.opacity)); kick = Math.max(kick, ...e.pump); });
    const white = run.elites.waveColor.getHex(), shove = { glow: +glow.toFixed(2), kick: +kick.toFixed(2), flashes: impacts.filter(([, c]) => c.getHex?.() === white).length, motes: motes.length };
    ({ e } = startHeadphones(1, { hold: true }));
    const bursts = spy(fx, 'burst'), splats = spy(fx, 'splat'), feels = spy(juice, 'feel');
    playOut(e);
    step(60 * 2);
    const bass = { sparks: bursts.length, scuffs: splats.length, impact: feels.filter(([k]) => k === 'impact').length };
    return ok(shove.glow > 0.5 && shove.kick > 0.5 && shove.flashes > SK().shove.waves && shove.motes > 10 && bass.sparks >= SK().bass.shots && bass.scuffs >= SK().bass.shots && bass.impact >= SK().bass.shots, { shove, bass });
  },
});
