// Stories: act 4's first Elite, the Singing Bowl (elites.js kind 'bowl', bowl-model.js): the bowl on
// its cushion on the lounge chair in the living room at dawn. It keeps the song's time (run.beat);
// these play on the run's own beat (no song). Shared helpers are in ./kit.js; src/stories.js imports
// this file in order.

import * as THREE from 'three';
import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { eliteChestsReachable } from './act2.js';
import { juice } from '../juice.js';
import { G, V, bowl, fresh, night4, ok, onChair, r3, record, spy, startBowl, step, tp, volumePairs } from './kit.js';

const offChair = () => tp(2.6, 0.05, 1.5, 0);                // on the floor beside the chair
const isBowl = (o) => o.material.uniforms.uColor.value.getHex() === hostile('bowl').getHex();
const bowlPairs = () => volumePairs().filter(([v, f]) => f && isBowl(v));
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
const offBar = (b) => Math.min(b % 4, 4 - (b % 4));            // beats from the nearest bar line
const SK = () => CONTENT.elites.bowl.skills;

night4('bowl-sleeps-on-the-lounge-chair', {
  about: 'The Singing Bowl sits on the lounge chair seat in place of the real bowl (hidden while it is alive) and sleeps while the jelly is off the chair: its eyes shut, it never starts an attack.',
  setup() { fresh(); offChair(); },
  play() {
    const { run } = G(), e = bowl();
    if (!e) return ok(false, { bowl: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    const real = run.elites.findObject('Singing_bowl').visible;
    const on = Math.hypot(e.base.x - 3.2, e.base.z - 1.4) < 0.01 && Math.abs(e.base.y - 0.435) < 0.01;
    return ok(on && !real && !e.awake && !started && e.model.eyes.scale.y < 0.4, { at: r3(e.base), realShown: real, awake: e.awake, started, eyes: +e.model.eyes.scale.y.toFixed(2) });
  },
});

night4('bowl-wakes-when-you-are-on-the-chair', {
  about: 'Land on the lounge chair and the Singing Bowl wakes (its eyes open) and turns to face you; leave the chair and it settles back to sleep. Its Health is act 3\'s 800 at act 4\'s Elite multiplier.',
  setup() { fresh(); onChair(); },
  play() {
    const { run, player } = G(), e = bowl();
    step(60 * 2);
    const awake = e.awake, eyes = e.model.eyes.scale.y, d = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z) - e.holder.rotation.y;
    const facing = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    e.cool = 99;
    offChair();
    step(60 * 4);
    const hp = e.maxHp === Math.round(CONTENT.elites.bowl.hp * run.stage.eliteHp);
    return ok(awake && eyes > 0.8 && facing < 0.3 && !e.awake && e.model.eyes.scale.y < 0.4 && hp,
      { awake, eyes: +eyes.toFixed(2), facing: +facing.toFixed(2), asleep: !e.awake, maxHp: e.maxHp });
  },
});

night4('bowl-rim-ring-strikes-on-the-bar', {
  about: 'Rim ring: the striker lifts while a Warning (a disc round the bowl with the low ring wall over it, in the bowl\'s bronze orange) fills to each strike; it strikes the rim on the bar lines of the song, one ring a bar, three in all, and each ring wall rolls out across the seat and back in again (its echo): 3 to a jelly standing in its way, once going out and once coming back, from every ring.',
  setup() { startBowl(0); },
  play() {
    const { e } = startBowl(0), { run } = G(), log = record('damage_taken'), beats = [];
    let warned = 0, lifted = 0, was = 0;
    step(60 * 18, () => {
      if (bowlPairs().some(([v]) => v.material.kind === 'ring')) warned++;
      lifted = Math.max(lifted, -e.model.striker.rotation.z);
      if ((e.struckN || 0) > was) { beats.push(+run.beat.toFixed(2)); was = e.struckN; }
      return e.state === 'idle' && beats.length && !run.elites.rings.length;
    });
    const hits = hitsBy(log, 'bowl-ring'), gaps = beats.slice(1).map((b, i) => +(b - beats[i]).toFixed(2));
    return ok(warned > 30 && lifted > 0.1 && beats.length === SK().ring.rings && beats.every((b) => offBar(b) < 0.1) && gaps.every((g) => Math.abs(g - 4) < 0.1) && hits.length === beats.length * 2 && hits.every((n) => n === SK().ring.dmg),
      { warned, lifted: +lifted.toFixed(2), beats, gaps, hits });
  },
});

night4('bowl-rings-are-thin-and-low-and-jumped', {
  about: 'Each rim ring is a thin, low wall (3 cm high, a 2.5 cm band: content/elites.kdl) rolling outward across the seat, wider every moment: a jelly standing in its way is hit (going out, and again coming back), one in the air over it (feet 5 cm up) isn\'t, by any of them.',
  setup() { startBowl(0); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['jumping', 0.05]]) {
      const { e, player, seat } = startBowl(0), { run } = G(), log = record('damage_taken');
      if (up) { player.position.y = seat + up; player.grounded = false; }
      const walls = [], bands = [], radii = [];
      let first = null;
      step(60 * 18, () => {
        const r = first ||= run.elites.rings[0];
        if (r && !r.done && r.phase === 'out') {
          const b = new THREE.Box3().setFromObject(r.vol), p = r.m.geometry.attributes.position;
          walls.push(+(b.max.y - r.vol.position.y).toFixed(3));
          bands.push(+((1 - Math.hypot(p.getX(0), p.getZ(0))) * r.r).toFixed(3));
          radii.push(r.r);
        }
        return e.state === 'idle' && e.strikes === null && !run.elites.rings.length;
      });
      const grows = radii.length > 10 && radii.every((r, i) => !i || r >= radii[i - 1] - 1e-9) && radii[radii.length - 1] > 0.5;
      out[name] = { tall: Math.max(...walls), band: bands[bands.length - 1], grows, reach: +Math.max(...radii).toFixed(2), hits: hitsBy(log, 'bowl-ring').length };
    }
    const { standing: s, jumping: j } = out, R = SK().ring, low = (r) => Math.abs(r.tall - R.height) < 0.006 && Math.abs(r.band - R.band) < 0.004 && r.grows;
    return ok(low(s) && s.hits === R.rings * 2 && low(j) && j.hits === 0, out);
  },
});

night4('bowl-angry-two-rings-a-bar-the-second-faster', {
  about: 'Under 65% Health the Singing Bowl is angry: its rim ring strikes twice a bar (two beats apart, still on the beat), four rings in all, and every second ring rolls out faster than the first.',
  setup() { startBowl(0, { angry: true }); },
  play() {
    const { e } = startBowl(0, { angry: true }), { run } = G(), beats = [], speeds = [];
    let was = 0;
    step(60 * 18, () => {
      if ((e.struckN || 0) > was) { beats.push(+run.beat.toFixed(2)); speeds.push(run.elites.rings[run.elites.rings.length - 1].speed); was = e.struckN; }
      return e.state === 'idle' && beats.length && !run.elites.rings.length;
    });
    const R = SK().ring, gaps = beats.slice(1).map((b, i) => +(b - beats[i]).toFixed(2));
    return ok(beats.length === R.angryRings && offBar(beats[0]) < 0.1 && gaps.every((g) => Math.abs(g - 2) < 0.1) && speeds.every((v, i) => v === (i % 2 ? R.angrySpeed : R.speed)) && R.angrySpeed > R.speed,
      { beats, gaps, speeds });
  },
});

night4('bowl-turning-angry-mid-ring-finishes-the-ring', {
  about: 'A Singing Bowl that turns angry part way through its rim ring (the jelly\'s hits take it under 65%) finishes the rings it planned on their beats and rests, rather than waiting on a ring it never planned; its next attacks are angry.',
  setup() { startBowl(0); },
  play() {
    const { e } = startBowl(0), { run } = G(), R = SK().ring;
    let struck = 0;
    step(60 * 18, () => {
      if (e.struckN === 1 && e.hp >= e.maxHp * e.def.angry) e.hp = e.maxHp * 0.5;   // angry after the first ring
      struck = Math.max(struck, e.struckN || 0);
      return e.state === 'idle' && struck && !run.elites.rings.length;
    });
    return ok(struck === R.rings && e.state === 'idle' && !e.strikes && !e.tele.length && e.cool === R.angryRest, { struck, state: e.state, cool: e.cool });
  },
});

night4('bowl-ring-echo-rolls-back-in', {
  about: 'Each rim ring rolls out to its reach, holds there dim and harmless for echo= beats of the song, brightens through the last of them, then rolls back in to the bowl as bright as it left: it hits a jelly in its way again on the way back (3 more), and a jelly in the air over it (feet 5 cm up) for the return isn\'t hit.',
  setup() { startBowl(0); },
  play() {
    const out = {};
    for (const [name, jumpBack] of [['standing', false], ['jumps the echo', true]]) {
      const { e, player, seat } = startBowl(0), { run } = G(), log = record('damage_taken');
      step(60 * 5, () => e.strikes);
      e.strikes.length = 1;                                             // one ring, to read it alone
      let ring = null, from = null, to = null, outHits = 0, dimOpacity = 0, lastOpacity = 0, minR = 9, bright = 0;
      step(60 * 16, () => {
        ring ||= run.elites.rings[0];
        if (!ring) return false;
        if (ring.phase === 'wait') {
          if (from === null) { from = run.beat; outHits = hitsBy(log, 'bowl-ring').length; dimOpacity = ring.m.material.opacity; if (jumpBack) { player.position.y = seat + 0.05; player.grounded = false; } }
          lastOpacity = ring.m.material.opacity;
        }
        if (ring.phase === 'back') { if (to === null) { to = run.beat; bright = ring.m.material.opacity; } minR = Math.min(minR, ring.r); }
        return ring.done;
      });
      out[name] = { waited: from === null || to === null ? null : +(to - from).toFixed(2), dimOpacity: +dimOpacity.toFixed(2), lastOpacity: +lastOpacity.toFixed(2), bright: +bright.toFixed(2), outHits, hits: hitsBy(log, 'bowl-ring').length, home: +minR.toFixed(3), done: !!ring?.done };
    }
    const R = SK().ring, s = out.standing, j = out['jumps the echo'];
    const echoes = (r) => r.waited !== null && Math.abs(r.waited - R.echo) < 0.15 && r.dimOpacity < 0.4 && r.lastOpacity > 0.8 * 0.9 && r.bright >= 0.8 * 0.9 && r.home < 0.05 && r.done && r.outHits === 1;
    return ok(echoes(s) && s.hits === 2 && echoes(j) && j.hits === 1, out);
  },
});

night4('bowl-echo-rings-dim-and-brighten-each-on-their-own', {
  about: 'Rings overlap (two a bar when angry): one holding dim at its reach while a newer one is still rolling out bright keeps its own look, not the newer ring\'s (each echoing ring has a band material of its own).',
  setup() { startBowl(0, { angry: true }); },
  play() {
    const { e } = startBowl(0, { angry: true }), { run } = G();
    let dim = null, bright = null, apart = false;
    step(60 * 18, () => {
      const rs = run.elites.rings, w = rs.find((r) => r.phase === 'wait'), o = rs.find((r) => r.phase === 'out');
      if (w && o && !apart) { apart = w.m.material !== o.m.material; dim = w.m.material.opacity; bright = o.m.material.opacity; }
      return apart;
    });
    return ok(apart && dim < bright, { apart, dim, bright });
  },
});

night4('bowl-hum-hits-outside-the-safe-circle-not-inside', {
  about: 'Hum: on the first bar line at least windup= beats away the song hits the jelly anywhere on the seat outside a circle of safe= m round the bowl, over a jump too (height= tall): 3 to a jelly out on the seat standing or jumping, nothing to one swum in close.',
  setup() { startBowl(1); },
  play() {
    const out = {}, H = SK().hum;
    for (const [name, x, z, up] of [['outside', 3.2, 1.72, 0], ['outside, jumping', 3.38, 1.76, 0.15], ['inside', 3.2, 1.4 + H.safe * 0.8, 0]]) {
      const { e, player, seat } = startBowl(1, { x, z }), { run } = G(), log = record('damage_taken');
      if (up) { player.position.y = seat + up; player.grounded = false; }
      let from = null, at = null;
      step(60 * 12, () => { if (e.humAt && from === null) from = run.beat; if (e.humDone && at === null) at = run.beat; return e.state === 'idle' && !e.humAt && from !== null; });
      out[name] = { from: from && +from.toFixed(2), at: at && +at.toFixed(2), planned: e.humAt, hits: hitsBy(log, 'bowl-hum') };
    }
    const good = (r) => r.at !== null && offBar(r.at) < 0.1 && r.at - r.from >= H.windup - 0.1;
    return ok(good(out.outside) && good(out['outside, jumping']) && good(out.inside)
      && out.outside.hits.length === 1 && out.outside.hits[0] === H.dmg && out['outside, jumping'].hits.length === 1 && out.inside.hits.length === 0, out);
  },
});

night4('bowl-hum-warning-fills-the-seat-bar-the-safe-circle', {
  about: 'Hum\'s Warning: a floor rectangle over the whole seat (the lounge chair\'s cushion, `seat` in stage4.js) and the slab over it, in the bowl\'s bronze orange, fill together to the hit; round the bowl a white circle (safe= m) shows the spared spot from the start. All of it goes the moment the hum is let go.',
  setup() { startBowl(1); },
  play() {
    const { e } = startBowl(1), { run } = G(), W = { min: [e.spec.seat.min[0], 0, e.spec.seat.min[1]], max: [e.spec.seat.max[0], 0, e.spec.seat.max[1]] }, H = SK().hum;
    const seen = { fills: [], together: true, safe: null, seat: null };
    step(60 * 12, () => {
      const pair = bowlPairs().find(([v]) => v.material.kind === 'symbol-square');
      if (pair) {
        const [v, f] = pair;
        seen.fills.push(+v.material.progress.toFixed(2));
        if (Math.abs(f.material.progress - v.material.progress) > 1e-6) seen.together = false;
        seen.seat ||= { floor: f.material.shape, w: +f.scale.x.toFixed(3), d: +f.scale.z.toFixed(3), x: +f.position.x.toFixed(3), z: +f.position.z.toFixed(3), h: +v.scale.y.toFixed(3) };
        if (!seen.safe) seen.safe = e.tele.slice(2).map((m) => [m.material.shape, m.material.progress, +m.scale.x.toFixed(3), m.material.uniforms.uColor.value.getHex()]);
      }
      return e.humDone;
    });
    step(2);
    const rising = seen.fills.length > 30 && seen.fills.every((p, i) => !i || p >= seen.fills[i - 1] - 1e-9) && seen.fills[seen.fills.length - 1] > 0.9;
    const hw = (W.max[0] - W.min[0]) / 2, hd = (W.max[2] - W.min[2]) / 2, s = seen.seat, sf = seen.safe;
    const seat = s && s.floor === 'square' && Math.abs(s.w - hw) < 0.01 && Math.abs(s.d - hd) < 0.01 && Math.abs(s.x - (W.min[0] + hw)) < 0.01 && Math.abs(s.z - (W.min[2] + hd)) < 0.01 && Math.abs(s.h - H.height) < 0.01;
    const white = sf && sf.length === 1 && sf[0][0] === 'circle' && sf[0][1] === 1 && sf[0][3] === 0xffffff && Math.abs(sf[0][2] - H.safe) < 0.005;
    const gone = !e.tele.length && !volumePairs().length;
    return ok(rising && seen.together && seat && white && gone, { ...seen, fills: seen.fills.length, last: seen.fills[seen.fills.length - 1], gone });
  },
});

night4('bowl-leaving-the-chair-calls-off-the-hum-and-the-echo', {
  about: 'Leave the lounge chair while the hum is filling and its Warning goes, nothing is let go and the bowl goes back to rest; leave it while a ring waits at its reach or rolls back in and that ring is gone the same moment (it never reaches you again if you come back).',
  setup() { startBowl(1); },
  play() {
    const { e } = startBowl(1), { run } = G(), log = record('damage_taken');
    step(60 * 5, () => e.humAt && e.tele.length);
    const filling = e.tele.length > 0;
    offChair();
    step(3);
    const hum = filling && e.state === 'idle' && !e.tele.length && !e.humAt && e.model.orbit.rotation.y < -2;
    const again = startBowl(0);
    let waiting = false;
    step(60 * 12, () => (waiting = run.elites.rings.some((r) => r.phase === 'wait')));
    offChair();
    step(3);
    const echo = waiting && !run.elites.rings.length;
    onChair(3.2, 1.72);
    step(60 * 6);
    return ok(hum && echo && !hitsBy(log, 'bowl-hum').length && !hitsBy(log, 'bowl-ring').filter((n, i) => i > 3).length, { hum, echo, waiting, filling, hits: log.length });
  },
});

night4('bowl-calls-off-an-attack-when-the-beat-jumps', {
  about: 'If the song\'s beat jumps mid-attack (a menu ate some of it, or the song just started), the Singing Bowl calls the attack off rather than striking unwarned: its Warning goes, no ring rolls out, the striker goes back to rest, and it starts again later.',
  setup() { startBowl(0); },
  play() {
    const { e } = startBowl(0), { run } = G();
    step(60 * 4, () => e.strikes && e.tele.length);
    const warned = e.tele.length > 0;
    run.beat += 6;                                                       // past the first strike
    step(2);
    const off = e.state === 'idle' && !e.tele.length && !run.elites.rings.length && !e.strikes && e.model.orbit.rotation.y < -2;
    let again = false;
    step(60 * 4, () => (again = e.state !== 'idle'));
    // the hum too: a bar and more jumped, its Warning goes and it never goes off
    const humming = startBowl(1), hlog = record('damage_taken');
    step(60 * 4, () => humming.e.humAt && humming.e.tele.length);
    const hwarned = humming.e.tele.length > 0;
    G().run.beat += 8;
    step(2);
    const hoff = humming.e.state === 'idle' && !humming.e.tele.length && !humming.e.humAt && humming.e.model.orbit.rotation.y < -2;
    step(60 * 3);
    return ok(warned && off && again && hwarned && hoff && !hitsBy(hlog, 'bowl-hum').length, { warned, off, again, hwarned, hoff });
  },
});

night4('bowl-attacks-feel', {
  about: 'Singing Bowl feel: each strike flashes where the striker meets the rim, throws glints and leaves a fading shimmer on the cushion, shakes the screen (feel impact), and the bowl\'s song glows in it and its rim trembles while it rings out; the hum flashes at the bowl as it is let go, kicks it back, throws a shock ring across the seat and shakes the screen, its song glows in it as it swells, and one that hits leaves a shimmer under the jelly.',
  setup() { startBowl(0); },
  play() {
    let { e, player } = startBowl(0), { run, fx } = G();
    let impacts = spy(fx, 'impact'), splats = spy(fx, 'splat'), feels = spy(juice, 'feel');
    let glow = 0, tremble = 0;
    step(60 * 18, () => { glow = Math.max(glow, e.model.song.material.opacity); tremble = Math.max(tremble, Math.abs(e.model.body.scale.x - 1)); return e.state === 'idle' && e.strikes === null && !run.elites.rings.length; });
    const strikes = SK().ring.rings, rimFlash = impacts.filter(([at]) => at.distanceTo(e.base) < e.r * 2 && at.y > e.base.y + 0.05).length, shimmer = splats.filter(([at]) => Math.hypot(at.x - e.base.x, at.z - e.base.z) < 0.01).length;
    const ring = { rimFlash, shimmer, impact: feels.filter(([k]) => k === 'impact').length, glow: +glow.toFixed(2), tremble: +tremble.toFixed(3) };
    ({ e, player } = startBowl(1));
    impacts = spy(fx, 'impact'); splats = spy(fx, 'splat'); feels = spy(juice, 'feel'); const shocks = spy(fx, 'ring');
    let kick = 0, swell = 0;
    step(60 * 12, () => { kick = Math.max(kick, e.kick || 0); swell = Math.max(swell, e.model.song.material.opacity); return e.state === 'idle' && !e.humAt && e.humDone === undefined; });
    const hum = { release: impacts.filter(([at]) => at.distanceTo(e.base) < e.r * 2.5 && at.y > e.base.y + 0.05).length, kick: +kick.toFixed(2), swell: +swell.toFixed(2), shock: shocks.length, big: feels.filter(([k]) => k === 'impact-big').length, underJelly: splats.filter(([at]) => Math.hypot(at.x - player.position.x, at.z - player.position.z) < 0.05).length };
    return ok(ring.rimFlash >= strikes && ring.shimmer >= strikes && ring.impact >= strikes && ring.glow > 0.5 && ring.tremble > 0.01
      && hum.release >= 1 && hum.kick > 0.5 && hum.swell > 0.5 && hum.shock >= 1 && hum.big >= 1 && hum.underJelly >= 1, { ring, hum });
  },
});

night4('bowl-chest-reachable', {
  about: 'Beat each of act 4\'s Elites (the Singing Bowl, the Mushroom Pillow) and its chest lands on an open spot on its furniture (the lounge chair, the sofa) the jelly can walk or jump to and touch.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
