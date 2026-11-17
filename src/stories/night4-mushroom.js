// Stories: act 4's second Elite, the Mushroom Pillow (elites.js kind 'pillow', pillow-model.js): the
// plush toadstool on the sofa seat in the living room at dawn. It keeps the song's time (run.beat);
// these play on the run's own beat (no song). Shared helpers are in ./kit.js; src/stories.js imports
// this file in order.

import * as THREE from 'three';
import { hostile } from '../vfx.js';
import { CONTENT } from '../content.js';
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { LOOK } from '../look.js';
import * as kit from './kit.js';
import { G, fresh, night4, ok, onSofa, pillow, r3, record, spy, startPillow, step, tp, volumePairs } from './kit.js';

const offSofa = () => tp(0.3, 0.02, 2.9, 0);                    // on the floor past the sofa's end
const isPillow = (o) => o.material.uniforms.uColor.value.getHex() === hostile('pillow').getHex();
const pillowPairs = () => volumePairs().filter(([v, f]) => f && isPillow(v));
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
const offBar = (b) => Math.min(b % 4, 4 - (b % 4));              // beats from the nearest bar line
const offBeat = (b) => Math.min(b % 1, 1 - (b % 1));
const SK = () => CONTENT.elites.pillow.skills;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// play its spores to the end, noting the plan's beats, its spots and what showed on the way
function playSpores(e, during) {
  const { run } = G(), out = { columns: 0 };
  let plan = null;
  step(60 * 12, (i) => {
    if (e.plan && !plan) plan = e.plan;
    if (e.spores && !out.spots) out.spots = e.spores.map((s) => s.at.clone());
    if (plan && plan.puffed && out.puff == null) out.puff = run.beat;
    if (plan && plan.settled && out.settle == null) out.settle = run.beat;
    out.columns = Math.max(out.columns, pillowPairs().filter(([v]) => v.material.kind === 'disc').length);
    if (during) during(i, plan);
    return plan && !e.plan && e.state === 'idle';
  });
  out.burst = run.beat;
  out.plan = plan;
  return out;
}

night4('pillow-sleeps-on-the-sofa', {
  about: 'The Mushroom Pillow sits on the sofa seat in place of the real pillow (hidden while it is alive) and sleeps while the jelly is off the sofa: its eyes shut, it never starts an attack.',
  setup() { fresh(); offSofa(); },
  play() {
    const { run } = G(), e = pillow();
    if (!e) return ok(false, { pillow: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    const real = run.elites.findObject('Mushroom_pillow').visible;
    const on = flat(e.base, { x: 1.68, z: 2.21 }) < 0.01 && Math.abs(e.base.y - 0.51) < 0.02;
    return ok(on && !real && !e.awake && !started && e.model.eyes.scale.y < 0.4, { at: r3(e.base), realShown: real, awake: e.awake, started, eyes: +e.model.eyes.scale.y.toFixed(2) });
  },
});

night4('pillow-wakes-when-you-are-on-the-sofa', {
  about: 'Land on the sofa and the Mushroom Pillow wakes (its eyes open) and turns to face you; leave it and the pillow settles back to sleep. Its Health is act 3\'s 800 at act 4\'s Elite multiplier, like the Singing Bowl\'s.',
  setup() { fresh(); onSofa(); },
  play() {
    const { run, player } = G(), e = pillow();
    step(60 * 2);
    const awake = e.awake, eyes = e.model.eyes.scale.y, d = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z) - e.holder.rotation.y;
    const facing = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    e.cool = 99;
    offSofa();
    step(60 * 4);
    const hp = e.maxHp === Math.round(CONTENT.elites.pillow.hp * run.stage.eliteHp) && e.maxHp === run.elites.list.find((q) => q.kind === 'bowl').maxHp;
    return ok(awake && eyes > 0.8 && facing < 0.3 && !e.awake && e.model.eyes.scale.y < 0.4 && hp,
      { awake, eyes: +eyes.toFixed(2), facing: +facing.toFixed(2), asleep: !e.awake, maxHp: e.maxHp });
  },
});

night4('pillow-spores-settle-then-burst-on-the-bar', {
  about: 'Spores: the cap breathes in, then on a beat it puffs spores that drift over the seat for two beats, the first onto where the jelly stands; each has a Warning from the puff (a circle and the column over it, in the pillow\'s spore violet) filling to the burst. They settle, flash for one beat, then burst on a bar line: a jelly that stays on its spot takes 4, once.',
  setup() { startPillow(0); },
  play() {
    const { e, player } = startPillow(0), log = record('damage_taken'), S = SK().spores, at = player.position.clone();
    let squashed = 1;
    const r = playSpores(e, () => { squashed = Math.min(squashed, e.model.cap.scale.y); });
    const hits = hitsBy(log, 'pillow-spores'), first = r.spots && flat(r.spots[0], at);
    const good = r.spots?.length === S.spots && first < 0.01 && r.columns === S.spots && squashed < 0.9
      && offBeat(r.puff) < 0.05 && Math.abs(r.settle - r.puff - S.drift) < 0.05 && offBar(r.burst) < 0.05 && Math.abs(r.burst - r.settle - 1) < 0.05
      && hits.length === 1 && hits[0] === S.dmg;
    return ok(good, { spots: r.spots?.length, first: first && +first.toFixed(3), columns: r.columns, squashed: +squashed.toFixed(2), puff: +r.puff?.toFixed(2), settle: +r.settle?.toFixed(2), burst: +r.burst.toFixed(2), hits });
  },
});

night4('pillow-spore-columns-hit-as-tall-as-drawn', {
  about: 'Each spore spot bursts as a column that hits as high as its Warning\'s volume is drawn (look.css --pillow-column), which is taller than a full jump: a jelly at the top of a jump over its spot is hit all the same, so step off the spot; a jump does not clear it. Over the drawn column (extra jumps) it is not hit.',
  setup() { startPillow(0); },
  play() {
    const drawn = LOOK.num('pillow-column', 0.35), jump = CONFIG.player.jumpHeight, out = {};
    for (const up of [jump, drawn + 0.03]) {
      const { e, player, seat } = startPillow(0), log = record('damage_taken');
      let tall = 0;
      playSpores(e, (i, plan) => {
        const v = pillowPairs().find(([m]) => m.material.kind === 'disc');
        if (v) tall = Math.max(tall, new THREE.Box3().setFromObject(v[0]).max.y - v[0].position.y);
        if (plan && plan.settled) { player.position.y = seat + up; player.grounded = false; }
      });
      out[up.toFixed(2)] = { tall: +tall.toFixed(3), hits: hitsBy(log, 'pillow-spores').length };
    }
    const [atJump, over] = Object.values(out);
    return ok(Math.abs(atJump.tall - drawn) < 0.01 && atJump.hits === 1 && over.hits === 0 && drawn > jump + CONFIG.player.height, { ...out, drawn, jump });
  },
});

night4('pillow-spores-dodged-by-stepping-off', {
  about: 'Spore spots hit only what stands in them: a jelly that steps off its spot once the spores settle, onto open seat clear of every spot, is not hit by the burst.',
  setup() { startPillow(0); },
  play() {
    const { e, player } = startPillow(0), log = record('damage_taken'), S = SK().spores;
    let moved = null;
    playSpores(e, (i, plan) => {
      if (!plan || !plan.settled || moved) return;
      const spots = e.spores.map((s) => s.at), c = player.position, R = S.radius + CONFIG.player.radius + 0.01;
      for (let k = 0; k < 48 && !moved; k++) {                          // the nearest open seat, clear of every spot
        const a = (k % 16) / 16 * Math.PI * 2, d = 0.1 + Math.floor(k / 16) * 0.05, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > R) && Math.abs(G().run.elites.surfaceBelow(new THREE.Vector3(x, c.y + 0.1, z)) - c.y) < 0.03) { moved = [x, z]; c.x = x; c.z = z; }
      }
    });
    return ok(moved && !hitsBy(log, 'pillow-spores').length, { moved, hits: hitsBy(log, 'pillow-spores') });
  },
});

night4('pillow-angry-more-spores-settling-faster', {
  about: 'Under 65% Health the Mushroom Pillow is angry: it puffs eight spores instead of five, and they settle in one beat instead of two (still a beat of flashing, still bursting on the bar). Even with the jelly by the sofa\'s back, every spot settles on the seat, never up on the back or an arm.',
  setup() { startPillow(0, { angry: true }); },
  play() {
    const { e } = startPillow(0, { angry: true }), S = SK().spores;
    const r = playSpores(e);
    const { e: c } = startPillow(0, { angry: true, x: 1.6, z: 1.95 }), corner = playSpores(c);   // by the sofa's back: every spot still on the seat
    const offSeat = (corner.spots || []).filter((s) => Math.abs(s.y - c.base.y) > 0.04).length;
    return ok(r.spots?.length === S.angrySpots && S.angrySpots > S.spots && Math.abs(r.settle - r.puff - S.angryDrift) < 0.05 && S.angryDrift < S.drift && offBar(r.burst) < 0.05 && Math.abs(r.burst - r.settle - 1) < 0.05
      && corner.spots?.length > 1 && offSeat === 0,
      { spots: r.spots?.length, drift: +(r.settle - r.puff).toFixed(2), burst: +r.burst.toFixed(2), corner: corner.spots?.length, offSeat, ys: corner.spots?.map((s) => +s.y.toFixed(2)) });
  },
});

night4('pillow-hop-slams-where-it-lands-on-the-beat', {
  about: 'Hop-slam: the pillow crouches while a Warning (a circle and the half sphere over it, in its colour) fills where it will land, a short hop toward the jelly (30 cm at most); it leaps on a beat and lands a beat later as a Blast round itself: 4 and a shove to a jelly that stays. Then it waddles back to its spot.',
  setup() { startPillow(1); },
  play() {
    const { e } = startPillow(1), { run } = G(), log = record('damage_taken'), knocks = record('knockback'), H = SK().hop, home = e.home.clone();
    let warned = 0, crouch = 1, leap = null, land = null, plan = null, far = 0;
    step(60 * 6, () => {
      if (e.plan) plan = e.plan;
      if (pillowPairs().some(([v]) => v.material.kind === 'dome')) warned++;
      if (plan && !plan.leapt) crouch = Math.min(crouch, e.model.group.scale.y);
      if (plan?.leapt && leap == null) leap = run.beat;
      if (plan?.landed && land == null) { land = run.beat; far = flat(e.base, home); }
      return plan && !e.plan && e.state === 'idle';
    });
    const hits = hitsBy(log, 'pillow-hop');
    step(60 * 4);
    const back = flat(e.base, home);
    return ok(warned > 30 && crouch < 0.9 && offBeat(leap) < 0.05 && Math.abs(land - leap - H.air) < 0.05 && far > 0.1 && far <= H.reach + 0.01 && hits.length === 1 && hits[0] === H.dmg && knocks.length > 0 && back < 0.01,
      { warned, crouch: +crouch.toFixed(2), leap: leap && +leap.toFixed(2), land: land && +land.toFixed(2), far: +far.toFixed(2), hits, knocks: knocks.length, back: +back.toFixed(3) });
  },
});

night4('pillow-hop-dodged-by-stepping-away', {
  about: 'The hop-slam\'s landing follows the jelly only until the pillow leaps: a jelly that steps 30 cm back once it is in the air is outside the Blast and not hit.',
  setup() { startPillow(1); },
  play() {
    const { e, player } = startPillow(1), log = record('damage_taken');
    let moved = false;
    step(60 * 6, () => {
      if (e.plan?.leapt && !moved) { moved = true; player.position.x -= 0.3; }
      return moved && !e.plan && e.state === 'idle';
    });
    return ok(moved && !hitsBy(log, 'pillow-hop').length, { moved, hits: hitsBy(log, 'pillow-hop'), x: +player.position.x.toFixed(2) });
  },
});

night4('pillow-calls-off-an-attack-when-the-beat-jumps', {
  about: 'If the song\'s beat jumps mid-attack (a menu ate some of it, or the song just started), the Mushroom Pillow calls the attack off rather than going off unwarned: its Warnings and drifting spores go, it is back on its spot, and it starts again later.',
  setup() { startPillow(0); },
  play() {
    const out = {};
    for (const atk of [0, 1]) {
      const { e } = startPillow(atk), { run, fx } = G();
      step(60 * 4, () => (atk ? e.plan?.leapt : e.spores) && e.tele.length);
      const warned = e.tele.length > 0;
      run.beat += 6;
      step(2);
      const off = e.state === 'idle' && !e.tele.length && !e.spores && !e.plan && flat(e.holder.position, e.base) < 1e-6 && !fx.orbs.some((o) => o.alive);
      let again = false;
      step(60 * 4, () => (again = e.state !== 'idle'));
      out[atk ? 'hop' : 'spores'] = { warned, off, again };
    }
    return ok(Object.values(out).every((r) => r.warned && r.off && r.again), out);
  },
});

night4('pillow-attacks-feel', {
  about: 'Mushroom Pillow feel: its spots glow as it breathes in; the puff flashes at its cap and pops it up; each spot\'s burst flashes at its foot and leaves fading spore dust; the burst shakes the screen. The hop-slam\'s landing shows its real reach (a ring), throws fluff, leaves dust, squashes the pillow flat and lands hard (feel impact-big).',
  setup() { startPillow(0); },
  play() {
    let { e } = startPillow(0), { run, fx } = G();
    let impacts = spy(fx, 'impact'), splats = spy(fx, 'splat'), feels = spy(juice, 'feel');
    let glow = 0, pop = 0;
    const r = playSpores(e, () => { glow = Math.max(glow, e.model.glow.material.opacity); pop = Math.max(pop, e.model.cap.scale.y); });
    const S = SK().spores, n = r.spots?.length || 0;
    const puffFlash = impacts.filter(([at]) => at.y > e.base.y + 0.2).length, footFlash = impacts.filter(([at]) => r.spots?.some((s) => flat(s, at) < 0.01 && at.y - s.y < 0.05)).length;
    const dust = splats.filter(([at]) => r.spots?.some((s) => flat(s, at) < 0.01)).length;
    const spores = { glow: +glow.toFixed(2), pop: +pop.toFixed(2), puffFlash, footFlash, dust, n, shake: feels.filter(([k]) => k === 'impact' || k === 'hit').length };
    ({ e } = startPillow(1));
    const rings = spy(fx, 'ring'), bursts = spy(fx, 'burst');
    splats = spy(fx, 'splat'); feels = spy(juice, 'feel');
    let squash = 1, landed = false;
    step(60 * 6, () => { if (e.plan?.landed) { landed = true; squash = Math.min(squash, e.model.group.scale.y); } return landed && e.state === 'idle'; });
    const hop = { ring: rings.filter(([, , rad]) => Math.abs(rad - SK().hop.radius) < 1e-6).length, fluff: bursts.length, dust: splats.length, big: feels.filter(([k]) => k === 'impact-big').length, squash: +squash.toFixed(2) };
    return ok(spores.glow > 0.5 && spores.pop > 1.05 && spores.puffFlash >= 1 && spores.footFlash >= n && spores.dust >= n && spores.shake >= 2 && n === S.spots
      && hop.ring >= 1 && hop.fluff >= 1 && hop.dust >= 1 && hop.big >= 1 && hop.squash < 0.9, { spores, hop, run: !!run });
  },
});

night4('room-elites-eyes-keep-their-size', {
  about: 'The room\'s Elites blink by squashing their eyes (scale.y from 0.12 asleep to 1 awake), so their eyes are sized by the face round them: awake, the Singing Bowl\'s, the Mushroom Pillow\'s and the Headphones\' eyes stay about 3 cm tall, not stretched up over the whole Elite.',
  setup() { fresh(); },
  play() {
    const out = {};
    for (const [kind, at] of [['bowl', () => kit.onChair()], ['pillow', () => onSofa()], ['headphones', () => kit.onCoffeeTable()]]) {
      fresh(); at(); step(90);
      const e = G().run.elites.list.find((q) => q.kind === kind);
      e.holder.updateMatrixWorld(true);
      out[kind] = { awake: e.awake, scale: +e.model.eyes.getWorldScale(new THREE.Vector3()).y.toFixed(3) };   // an eye is about 0.6 of this tall (enemies.js angryEyes)
    }
    return ok(Object.values(out).every((r) => r.awake && r.scale < 0.08), out);
  },
});
