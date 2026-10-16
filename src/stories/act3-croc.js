// Stories: act 3's Elite, the Alligator (elites.js kind 'croc', croc-model.js): the plush on the
// pillows at the head of the bed. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { hostile, VolumeMaterial } from '../vfx.js';
import { CONTENT } from '../content.js';
import { eliteChestsReachable } from './act2.js';
import { G, V, act3, croc, everyAttack, fresh, ok, onBed, r3, record, shownWarnings, startCroc, step, tp, volumePairs } from './kit.js';

const onFloor = () => tp(1.0, 0.05, 8.85, 0);                 // by the door, off the bed
const isCroc = (o) => o.material.uniforms.uColor.value.getHex() === hostile('croc').getHex();
// the croc's Warnings showing: floor shapes with the volume over each, filling together
const crocPairs = () => volumePairs().filter(([v, f]) => f && isCroc(v));
const hitsBy = (log, source) => log.filter((d) => d.source === source).map((d) => d.amount);
// the jelly's bearing round the croc's base against where the croc faces (0: straight at it)
const offFacing = (e, to) => { const d = Math.atan2(to.x - e.base.x, to.z - e.base.z) - e.holder.rotation.y; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };

act3('croc-sleeps-on-the-pillows', {
  about: 'The Alligator rests on the bed just in front of the pillows, in place of the real plush (hidden), far enough out that turning all the way round never takes it into them (they start at z 10.48), and sleeps while the jelly is off the bed: it never starts an attack.',
  setup() { fresh(); onFloor(); },
  play() {
    const { run } = G(), e = croc();
    if (!e) return ok(false, { croc: 'missing' });
    let started = false;
    step(60 * 4, () => { if (e.state !== 'idle') started = true; });
    let real = false;
    run.elites.findObject('Plush_crocodile').traverse((o) => { if (o.isMesh && o.visible) real = true; });
    const b = e.base;
    const size = new THREE.Box3().setFromObject(e.holder).getSize(V(0, 0, 0)), reach = Math.max(size.x, size.z) / 2;   // as far as any of it gets from its middle as it turns
    const clear = b.x > -0.2 && b.x < 0 && b.z + reach < 10.48 && b.y > 0.6;
    return ok(clear && !real && !e.awake && !started, { at: r3(b), reach: +reach.toFixed(3), realShown: real, awake: e.awake, started });
  },
});

act3('croc-wakes-when-you-are-on-the-bed', {
  about: 'Land on the bed and the Alligator wakes (its eyes open), turns to face you and fights; leave the bed and it settles back to sleep, facing the foot of the bed again.',
  setup() { fresh(); onBed(); },
  play() {
    const { player } = G(), e = croc();
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

act3('croc-frost-volley', {
  about: 'Frost volley: its mouth opens while three Warnings (a circle with a half sphere over it) fill in a fan round the jelly; three frost balls then fly there fast and burst as Blasts: 3 to a jelly inside one, and it swims half as fast for 1.5 s. A jelly that left the fan is not hit.',
  setup() { startCroc(0); },
  play() {
    const out = {};
    for (const [name, move] of [['stays', 0], ['leaves', 0.25]]) {
      const { e, player } = startCroc(0), { run } = G(), log = record('damage_taken');
      let most = 0, open = 0, moved = false, slowT = 0;
      step(60 * 4, () => {
        if (log.length && !slowT) slowT = run.slowHardT;                  // as it hits
        most = Math.max(most, crocPairs().length);
        open = Math.max(open, -e.model.upper.rotation.x);
        if (move && !moved && most) { moved = true; player.position.z += move; }   // toward the croc, out of the fan
        return e.state === 'idle' && !run.elites.blobs.length;
      });
      const hits = hitsBy(log, 'croc-frost');
      out[name] = { most, open: +open.toFixed(2), hits, slowK: run.slowK, slowT: +slowT.toFixed(2) };
    }
    const { stays: s, leaves: l } = out;
    return ok(s.most === 3 && s.open > 0.4 && s.hits.length === 1 && s.hits[0] === 3 && s.slowK === 0.5 && s.slowT > 1.2 && l.most === 3 && !l.hits.length, out);
  },
});

act3('croc-tail-slam', {
  about: 'Tail slam: it turns its back on the jelly, then slams its tail 3 to 5 times; before each slam a Warning (a small circle with the ring wall round it) fills where the tail lands, and each slam sends a thick ring wall rolling out over the bed: 3 to a jelly standing in its way, from every ring.',
  setup() { startCroc(1); },
  play() {
    const { e, player } = startCroc(1), { run } = G(), log = record('damage_taken');
    let warned = 0, back = 0, slams = 0;
    step(60 * 8, () => {
      if (crocPairs().some(([v]) => v.material.kind === 'ring')) warned++;
      const d = Math.atan2(player.position.x - e.base.x, player.position.z - e.base.z) - e.holder.rotation.y;
      if (e.slams) back = Math.max(back, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
      slams = Math.max(slams, e.slams || 0);
      return e.state === 'idle' && slams && !run.elites.rings.length;
    });
    const hits = hitsBy(log, 'croc-tail');
    return ok(warned > 10 && back > 2.6 && slams >= 3 && slams <= 5 && hits.length === slams && hits.every((n) => n === 3), { warned, back: +back.toFixed(2), slams, hits });
  },
});

act3('croc-tail-rings-roll-out-and-are-jumped', {
  about: 'Each tail slam\'s ring is a low wall (3 cm high) with a thick band (content/elites.kdl), rolling outward over the bed, wider every moment: a jelly standing in its way is hit, one in the air over it (feet 5 cm up) isn\'t, by any of them.',
  setup() { startCroc(1); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['jumping', 0.05]]) {
      const { e, player, bed } = startCroc(1), { run } = G(), log = record('damage_taken');
      if (up) { player.position.y = bed + up; player.grounded = false; }
      const walls = [], bands = [], radii = [];
      let first = null;
      step(60 * 8, () => {
        const r = first ||= run.elites.rings[0];                          // the first ring, all the way out
        if (r && !r.done) {
          const b = new THREE.Box3().setFromObject(r.vol), p = r.m.geometry.attributes.position, n = p.count / 2;
          walls.push(+(b.max.y - r.vol.position.y).toFixed(3));
          bands.push(+((1 - Math.hypot(p.getX(0), p.getZ(0))) * r.r).toFixed(3));
          radii.push(r.r);
        }
        return e.state === 'idle' && e.slams && !run.elites.rings.length;
      });
      const grows = radii.length > 10 && radii.every((r, i) => !i || r >= radii[i - 1] - 1e-9) && radii[radii.length - 1] > 0.5;
      out[name] = { tall: Math.max(...walls), band: bands[bands.length - 1], grows, reach: +Math.max(...radii).toFixed(2), hits: hitsBy(log, 'croc-tail').length };
    }
    const { standing: s, jumping: j } = out, T = CONTENT.elites.croc.skills.tail, low = (r) => Math.abs(r.tall - T.height) < 0.006 && Math.abs(r.band - T.band) < 0.004 && r.grows;
    return ok(low(s) && s.hits >= 3 && low(j) && j.hits === 0, out);
  },
});

act3('croc-tail-rhythm-differs-each-time', {
  about: 'The tail slams come in a rhythm picked as each tail slam starts: two in a row differ, each gap between 0.35 and 0.9 s.',
  setup() { startCroc(1); },
  play() {
    const rhythm = () => { const { e } = startCroc(1); step(60 * 2, () => e.rhythm); const r = e.rhythm.slice(); return r.map((t, i) => +(t - (i ? r[i - 1] : 0.5)).toFixed(3)); };
    const a = rhythm(), b = rhythm(), within = (r) => r.every((g) => g >= 0.35 && g <= 0.9);
    return ok(within(a) && within(b) && a.join() !== b.join(), { a, b });
  },
});

act3('croc-pounce', {
  about: 'Pounce: it crouches while a big Warning (a circle round it, the half sphere over it, its radius in content/elites.kdl) fills, leaps up and lands where it started as a Blast round itself: 4 and knocked back anywhere in it (on the bed beside it, or in the air over it), nothing outside it.',
  setup() { startCroc(2); },
  play() {
    const out = {};
    const R = CONTENT.elites.croc.skills.pounce.radius;
    for (const [name, dz, up] of [['beside', R * 0.6, 0], ['over', R * 0.4, 0.08], ['outside', R + 0.09, 0]]) {
      const { e, player } = startCroc(2), { run } = G(), log = record('damage_taken'), knocks = record('knockback');
      const a = e.holder.rotation.y;
      player.position.set(e.base.x + Math.sin(a) * dz, 0, e.base.z + Math.cos(a) * dz);
      player.position.y = run.elites.surfaceBelow(player.position.clone().setY(1)) + up;
      player.grounded = !up;
      let radius = 0, peak = 0, came = null;
      step(60 * 4, () => {
        const v = crocPairs().find(([w]) => w.material.kind === 'dome');
        if (v) radius = Math.max(radius, v[0].scale.x);
        peak = Math.max(peak, e.model.group.position.y);
        if (log.length && !came) came = r3(e.holder.position.clone().add(e.model.group.position));
        return e.state === 'idle' && peak > 0;
      });
      out[name] = { radius: +radius.toFixed(3), peak: +peak.toFixed(3), hits: hitsBy(log, 'croc-pounce'), knocked: knocks.length, home: e.holder.position.distanceTo(e.base) < 1e-6 };
    }
    const { beside: b, over: o, outside: x } = out;
    return ok(Math.abs(b.radius - R) < 0.005 && b.peak > 0.06 && b.home && b.hits[0] === 4 && b.knocked >= 1 && o.hits[0] === 4 && !x.hits.length, out);
  },
});

act3('croc-angry', {
  about: 'Under 65% Health the Alligator is angry: five frost balls at a time, 4 to 6 tail slams, and quicker windups.',
  setup() { startCroc(0, { angry: true }); },
  play() {
    const { run } = G();
    let { e } = startCroc(0, { angry: true });
    let most = 0;
    step(60 * 2, () => { most = Math.max(most, crocPairs().length); return e.state === 'idle' && most; });
    ({ e } = startCroc(1, { angry: true }));
    step(60 * 2, () => e.rhythm);
    const slams = e.rhythm.length;
    const D = e.def.skills;
    return ok(most === 5 && slams >= 4 && slams <= 6 && D.volley.angryWindup < D.volley.windup && D.pounce.angryWindup < D.pounce.windup, { most, slams, hp: run.elites.list[0].hp });
  },
});

act3('croc-gone-when-the-pothos-wakes', {
  about: 'When time runs out and the Pothos rises in its pot on the pillows, the Alligator is gone from that spot (elites are cleared at the boss intro), and the real plush stays hidden.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G(), e = croc();
    run.startBossIntro();
    step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    let real = false;
    run.elites.findObject('Plush_crocodile').traverse((o) => { if (o.isMesh && o.visible) real = true; });
    return ok(run.phase === 'boss' && !run.elites.list.length && !e.holder.parent && !real, { phase: run.phase, elites: run.elites.list.length, inScene: !!e.holder.parent, realShown: real });
  },
});

act3('every-elite-chest-reachable', {
  about: 'Beat the Alligator and its chest lands on an open spot on the bed the jelly can walk or jump to and touch.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
