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
const offSnap = (b) => Math.min(b % 2, 2 - (b % 2));              // beats from the nearest snap line (act 4 Elites: snap=2, a half bar)
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
    const on = flat(e.base, { x: 1.165, z: 1.282 }) < 0.01 && Math.abs(e.base.y - 0.51) < 0.02;
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
      && offBeat(r.puff) < 0.05 && Math.abs(r.settle - r.puff - S.drift) < 0.05 && offSnap(r.burst) < 0.05 && Math.abs(r.burst - r.settle - 1) < 0.05
      && hits.length === 1 && hits[0] === S.dmg;
    return ok(good, { spots: r.spots?.length, first: first && +first.toFixed(3), columns: r.columns, squashed: +squashed.toFixed(2), puff: +r.puff?.toFixed(2), settle: +r.settle?.toFixed(2), burst: +r.burst.toFixed(2), hits });
  },
});

night4('pillow-spore-columns-stay-dim-until-their-last-beat', {
  about: 'Five to eight tall spore columns at once are busy, so while they fill each column shows dim (look.css --pillow-column-opacity) and its floor circle quiet (--pillow-spot-warning); on the last beat, settled, they flash up to full, and they still fill to the burst on the bar.',
  setup() { startPillow(0); },
  play() {
    const { e } = startPillow(0), dim = LOOK.num('pillow-column-opacity', 0.2), spot = LOOK.num('pillow-spot-warning', 0.6);
    let before = 0, circles = 0, flash = 0, full = 0;
    playSpores(e, (i, plan) => {
      const pairs = pillowPairs().filter(([v]) => v.material.kind === 'disc');
      if (!pairs.length || !plan || plan.burst <= G().run.beat) return;
      const o = Math.max(...pairs.map(([v]) => v.material.opacity));
      if (!plan.settled) { before = Math.max(before, o); circles = Math.max(circles, ...pairs.map(([, f]) => f.material.opacity)); }
      else flash = Math.max(flash, o);
      full = Math.max(full, Math.min(...pairs.map(([v]) => v.material.progress)));
    });
    return ok(dim <= 0.25 && before > 0 && before <= dim + 1e-6 && circles <= spot + 1e-6 && flash > 0.95 && full > 0.9,
      { dim, before: +before.toFixed(2), spot, circles: +circles.toFixed(2), flash: +flash.toFixed(2), full: +full.toFixed(2) });
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
    const { e: c } = startPillow(0, { angry: true, x: 1.915, z: 1.682 }), corner = playSpores(c);   // by the sofa's back: every spot still on the seat
    const offSeat = (corner.spots || []).filter((s) => Math.abs(s.y - c.base.y) > 0.04).length;
    return ok(r.spots?.length === S.angrySpots && S.angrySpots > S.spots && Math.abs(r.settle - r.puff - S.angryDrift) < 0.05 && S.angryDrift < S.drift && offSnap(r.burst) < 0.05 && Math.abs(r.burst - r.settle - 1) < 0.05
      && corner.spots?.length > 1 && offSeat === 0,
      { spots: r.spots?.length, drift: +(r.settle - r.puff).toFixed(2), burst: +r.burst.toFixed(2), corner: corner.spots?.length, offSeat, ys: corner.spots?.map((s) => +s.y.toFixed(2)) });
  },
});

// play its Fairy ring to the end, noting each ring (the plan's `ring`, then `second` when angry) as it sprouts
function playFairy(e, during) {
  const { run } = G(), out = { rings: [] };
  let plan = null;
  step(60 * 14, (i) => {
    if (e.plan && !plan) plan = e.plan;
    for (const k of ['ring', 'second']) if (plan?.[k] && !out.rings.includes(plan[k])) out.rings.push(plan[k]);
    if (during) during(i, plan);
    return plan && !e.plan && e.state === 'idle';
  });
  out.end = run.beat;
  out.plan = plan;
  return out;
}
const aliveCaps = () => G().fx.orbs.filter((o) => o.alive).length;

night4('pillow-fairy-ring-hold-still-is-safe', {
  about: 'Fairy ring: the cap breathes in while a circle follows the jelly, then on a beat eight caps sprout in a 12 cm ring round where it stands, each with its Warning (a circle and the column over it, in the pillow\'s violet) filling together to the burst on the bar. A jelly that holds still in the middle is not hit. The caps are pooled instanced pieces: no light is added.',
  setup() { startPillow(1); },
  play() {
    const { e } = startPillow(1), { run, APT } = G(), scene = APT.scene, log = record('damage_taken'), F = SK().fairy, at = G().player.position.clone();
    const lights = () => { let n = 0; scene.traverse((o) => { if (o.isLight) n++; }); return n; }, before = lights();
    let followed = 0, columns = 0, caps = 0, circles = 0, squashed = 1, lit = before;
    const r = playFairy(e, (i, plan) => {
      squashed = Math.min(squashed, e.model.cap.scale.y);
      if (plan && !plan.ring && e.tele.length === 1) followed++;
      if (plan?.ring && !plan.ring.gone) {
        columns = Math.max(columns, pillowPairs().filter(([v]) => v.material.kind === 'disc').length);
        caps = Math.max(caps, aliveCaps()); lit = lights();
      }
    });
    const R = r.rings[0], ringAt = R && R.caps.map((k) => flat(k.at, R.c));
    const good = r.rings.length === 1 && R.caps.length === F.caps && flat(R.c, at) < 0.01 && ringAt.every((d) => Math.abs(d - F.ring) < 0.002)
      && followed > 20 && columns === F.caps && caps === F.caps && lit === before && squashed < 0.9
      && Math.abs(R.settle - (r.plan.puff + F.grow)) < 0.05 && offBeat(R.burst) < 0.05 && Math.abs(R.burst - R.settle - 1) < 0.05
      && !hitsBy(log, 'pillow-fairy').length && F.ring - F.radius > CONFIG.player.radius;
    return ok(good, { rings: r.rings.length, caps: R?.caps.length, centre: R && +flat(R.c, at).toFixed(3), followed, columns, alive: caps, lights: [before, lit], squashed: +squashed.toFixed(2), burst: R && +R.burst.toFixed(2), hits: hitsBy(log, 'pillow-fairy') });
  },
});

night4('pillow-fairy-ring-leaving-it-is-hit', {
  about: 'A jelly that leaves its Fairy ring once the caps have sprouted crosses a column (the caps are 9 cm apart, the jelly 6 cm across: no gap to slip through) and takes 4, once, however many columns it crosses. Over a jump too: a column hits as high as it is drawn.',
  setup() { startPillow(1); },
  play() {
    const out = {};
    for (const [name, up] of [['run', 0], ['jump', CONFIG.player.jumpHeight]]) {
      const { e, player, seat } = startPillow(1), log = record('damage_taken');
      let walking = false;
      playFairy(e, (i, plan) => {
        if (plan?.ring && !plan.ring.gone) { walking = true; player.position.x += 0.01; if (up) { player.position.y = seat + up; player.grounded = false; } }
      });
      out[name] = { hits: hitsBy(log, 'pillow-fairy'), walking, x: +player.position.x.toFixed(2) };
    }
    return ok(Object.values(out).every((r) => r.walking && r.hits.length === 1 && r.hits[0] === SK().fairy.dmg), out);
  },
});

night4('pillow-fairy-ring-angry-second-ring-where-you-flee', {
  about: 'Under 65% Health the Mushroom Pillow follows its Fairy ring with a second: when the first bursts, eight more caps sprout 34 cm on from it, the way the jelly was moving (away from the pillow if it held still, or the other way where the seat runs out), with their own Warnings, and burst a bar later. Holding still through both is safe; a jelly that bolts for the second ring walks into it.',
  setup() { startPillow(1, { angry: true }); },
  play() {
    const { e } = startPillow(1, { angry: true }), log = record('damage_taken'), F = SK().fairy;
    const r = playFairy(e, () => {});
    const [a, b] = r.rings, apart = a && b && flat(a.c, b.c);
    const still = hitsBy(log, 'pillow-fairy').length;
    const { e: f, player } = startPillow(1, { angry: true }), log2 = record('damage_taken');
    let from = null;
    playFairy(f, (i, plan) => {
      if (plan?.ring && !from) from = player.position.clone();
      if (plan?.second && !plan.second.gone) { const d = plan.second.c.clone().sub(player.position).setY(0).normalize(); player.position.x += d.x * 0.012; player.position.z += d.z * 0.012; }   // the jelly flees the first ring, into the second
    });
    const fled = hitsBy(log2, 'pillow-fairy');
    return ok(r.rings.length === 2 && apart > 0.25 && still === 0 && Math.abs(b.burst - a.burst - F.grow - 1) < 0.1 && fled.length === 1,
      { rings: r.rings.length, apart: apart && +apart.toFixed(3), still, fled, gap: b && +(b.burst - a.burst).toFixed(2) });
  },
});

night4('pillow-calls-off-an-attack-when-the-beat-jumps', {
  about: 'If the song\'s beat jumps mid-attack (a menu ate some of it, or the song just started), the Mushroom Pillow calls the attack off rather than going off unwarned: its Warnings, drifting spores and caps go, it is back on its spot, and it starts again later.',
  setup() { startPillow(0); },
  play() {
    const out = {};
    for (const atk of [0, 1]) {
      const { e } = startPillow(atk), { run, fx } = G();
      step(60 * 4, () => (atk ? e.plan?.ring : e.spores) && e.tele.length);
      const warned = e.tele.length > 0;
      run.beat += 6;
      step(2);
      const off = e.state === 'idle' && !e.tele.length && !e.spores && !e.plan && flat(e.holder.position, e.base) < 1e-6 && !fx.orbs.some((o) => o.alive);
      let again = false;
      step(60 * 4, () => (again = e.state !== 'idle'));
      out[atk ? 'fairy' : 'spores'] = { warned, off, again };
    }
    return ok(Object.values(out).every((r) => r.warned && r.off && r.again), out);
  },
});

night4('pillow-attacks-feel', {
  about: 'Mushroom Pillow feel: its spots glow as it breathes in; the puff flashes at its cap and pops it up; each spot\'s burst flashes at its foot and leaves fading spore dust; the burst shakes the screen. The Fairy ring\'s caps sprout with a flash and a pale puff in the middle of the ring, each column\'s burst flashes at its foot and leaves fading dust, and the burst shakes the screen.',
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
    impacts = spy(G().fx, 'impact'); splats = spy(G().fx, 'splat'); feels = spy(juice, 'feel');
    const F = SK().fairy, f = playFairy(e), R = f.rings[0];
    const sprout = impacts.filter(([at]) => R && flat(at, R.c) < 0.01).length, foot = impacts.filter(([at]) => R?.caps.some((k) => flat(k.at, at) < 0.01 && at.y - k.at.y < 0.05)).length;
    const fairyDust = splats.filter(([at]) => R?.caps.some((k) => flat(k.at, at) < 0.01)).length;
    const fairy = { sprout, foot, dust: fairyDust, shake: feels.filter(([k]) => k === 'impact' || k === 'hit').length };
    return ok(spores.glow > 0.5 && spores.pop > 1.05 && spores.puffFlash >= 1 && spores.footFlash >= n && spores.dust >= n && spores.shake >= 2 && n === S.spots
      && fairy.sprout >= 1 && fairy.foot >= F.caps && fairy.dust >= F.caps && fairy.shake >= 2, { spores, fairy, run: !!run });
  },
});

night4('room-elites-eyes-keep-their-size', {
  about: 'The room\'s Elites blink by squashing their eyes (scale.y from 0.12 asleep to 1 awake), so their eyes are sized by the face round them: awake, the Singing Bowl\'s, the Mushroom Pillow\'s and the Headphones\' eyes stay about 3 cm tall, not stretched up over the whole Elite.',
  setup() { fresh(); },
  play() {
    const out = {};
    for (const [kind, at] of [['bowl', () => kit.onChair()], ['pillow', () => onSofa()], ['headphones', () => kit.onCounter()]]) {
      fresh(); at(); step(90);
      const e = G().run.elites.list.find((q) => q.kind === kind);
      e.holder.updateMatrixWorld(true);
      out[kind] = { awake: e.awake, scale: +e.model.eyes.getWorldScale(new THREE.Vector3()).y.toFixed(3) };   // an eye is about 0.6 of this tall (enemies.js angryEyes)
    }
    return ok(Object.values(out).every((r) => r.awake && r.scale < 0.08), out);
  },
});
