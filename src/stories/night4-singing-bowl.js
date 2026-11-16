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
    return ok(awake && eyes > 0.8 && facing < 0.3 && !e.awake && e.model.eyes.scale.y < 0.4 && hp && CONTENT.elites.bowl.hp === 800,
      { awake, eyes: +eyes.toFixed(2), facing: +facing.toFixed(2), asleep: !e.awake, maxHp: e.maxHp });
  },
});

night4('bowl-rim-ring-strikes-on-the-bar', {
  about: 'Rim ring: the striker lifts while a Warning (a disc round the bowl with the low ring wall over it, in the bowl\'s bronze orange) fills to each strike; it strikes the rim on the bar lines of the song, one ring a bar, three in all, and each ring wall rolls out across the seat: 3 to a jelly standing in its way, from every ring.',
  setup() { startBowl(0); },
  play() {
    const { e } = startBowl(0), { run } = G(), log = record('damage_taken'), beats = [];
    let warned = 0, lifted = 0, was = 0;
    step(60 * 12, () => {
      if (bowlPairs().some(([v]) => v.material.kind === 'ring')) warned++;
      lifted = Math.max(lifted, -e.model.striker.rotation.z);
      if ((e.struckN || 0) > was) { beats.push(+run.beat.toFixed(2)); was = e.struckN; }
      return e.state === 'idle' && beats.length && !run.elites.rings.length;
    });
    const hits = hitsBy(log, 'bowl-ring'), gaps = beats.slice(1).map((b, i) => +(b - beats[i]).toFixed(2));
    return ok(warned > 30 && lifted > 0.1 && beats.length === SK().ring.rings && beats.every((b) => offBar(b) < 0.1) && gaps.every((g) => Math.abs(g - 4) < 0.1) && hits.length === beats.length && hits.every((n) => n === 3),
      { warned, lifted: +lifted.toFixed(2), beats, gaps, hits });
  },
});

night4('bowl-rings-are-thin-and-low-and-jumped', {
  about: 'Each rim ring is a thin, low wall (3 cm high, a 2.5 cm band: content/elites.kdl) rolling outward across the seat, wider every moment: a jelly standing in its way is hit, one in the air over it (feet 5 cm up) isn\'t, by any of them.',
  setup() { startBowl(0); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['jumping', 0.05]]) {
      const { e, player, seat } = startBowl(0), { run } = G(), log = record('damage_taken');
      if (up) { player.position.y = seat + up; player.grounded = false; }
      const walls = [], bands = [], radii = [];
      let first = null;
      step(60 * 12, () => {
        const r = first ||= run.elites.rings[0];
        if (r && !r.done) {
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
    return ok(low(s) && s.hits === R.rings && low(j) && j.hits === 0, out);
  },
});

night4('bowl-angry-two-rings-a-bar-the-second-faster', {
  about: 'Under 65% Health the Singing Bowl is angry: its rim ring strikes twice a bar (two beats apart, still on the beat), four rings in all, and every second ring rolls out faster than the first.',
  setup() { startBowl(0, { angry: true }); },
  play() {
    const { e } = startBowl(0, { angry: true }), { run } = G(), beats = [], speeds = [];
    let was = 0;
    step(60 * 12, () => {
      if ((e.struckN || 0) > was) { beats.push(+run.beat.toFixed(2)); speeds.push(run.elites.rings[run.elites.rings.length - 1].speed); was = e.struckN; }
      return e.state === 'idle' && beats.length && !run.elites.rings.length;
    });
    const R = SK().ring, gaps = beats.slice(1).map((b, i) => +(b - beats[i]).toFixed(2));
    return ok(beats.length === R.angryRings && offBar(beats[0]) < 0.1 && gaps.every((g) => Math.abs(g - 2) < 0.1) && speeds.every((v, i) => v === (i % 2 ? R.angrySpeed : R.speed)) && R.angrySpeed > R.speed,
      { beats, gaps, speeds });
  },
});

night4('bowl-chime-shots-on-the-beat', {
  about: 'Chime: the striker runs round the rim and a ball of song swells over the bowl until a bar line; then a Shot a beat (three) flies from it at the jelly\'s middle, mid-jump included: a jelly that stays put is hit by each, 3 a Shot, jumping or not.',
  setup() { startBowl(1); },
  play() {
    const out = {};
    for (const [name, up] of [['standing', 0], ['jumping', 0.06]]) {
      const { e, player, seat } = startBowl(1), { run } = G(), log = record('damage_taken'), beats = [];
      if (up) { player.position.y = seat + up; player.grounded = false; }
      let swell = 0, turned = 0, was = 0;
      step(60 * 10, () => {
        if (e.ball && !e.fired) swell = Math.max(swell, e.ball.scale.x);
        turned = Math.max(turned, e.turn || 0);
        if ((e.fired || 0) > was) { beats.push(+run.beat.toFixed(2)); was = e.fired; }
        return e.state === 'idle' && beats.length && !run.elites.bullets.length;
      });
      const gaps = beats.slice(1).map((b, i) => +(b - beats[i]).toFixed(2));
      out[name] = { swell: +swell.toFixed(4), turned: +turned.toFixed(1), beats, gaps, hits: hitsBy(log, 'bowl-chime') };
    }
    const C = SK().chime, good = (r) => r.swell > C.size * 0.8 && r.turned > 3 && r.beats.length === C.shots && offBar(r.beats[0]) < 0.1 && r.gaps.every((g) => Math.abs(g - C.every) < 0.1) && r.hits.length === C.shots && r.hits.every((n) => n === 3);
    return ok(good(out.standing) && good(out.jumping), out);
  },
});

night4('bowl-chime-dodged-by-moving-sideways', {
  about: 'Each chime is aimed at where the jelly is as it leaves, no leading: a jelly that keeps stepping the same way sideways, 12 cm after each one leaves, is missed by all three.',
  setup() { startBowl(1, { x: 3.0 }); },
  play() {
    const { e, player } = startBowl(1, { x: 3.0 }), { run } = G(), log = record('damage_taken');
    let was = 0;
    step(60 * 10, () => {
      if ((e.fired || 0) > was) { was = e.fired; player.position.x += 0.12; }
      return e.state === 'idle' && was && !run.elites.bullets.length;
    });
    return ok(was === SK().chime.shots && !hitsBy(log, 'bowl-chime').length, { fired: was, hits: hitsBy(log, 'bowl-chime'), x: +player.position.x.toFixed(2) });
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
    return ok(warned && off && again, { warned, off, again });
  },
});

night4('bowl-attacks-feel', {
  about: 'Singing Bowl feel: each strike flashes where the striker meets the rim, throws glints and leaves a fading shimmer on the cushion, shakes the screen (feel impact), and the bowl\'s song glows in it and its rim trembles while it rings out; each chime flashes as it leaves the bowl and kicks it back, and one that hits leaves a shimmer under the jelly.',
  setup() { startBowl(0); },
  play() {
    let { e, player } = startBowl(0), { run, fx } = G();
    let impacts = spy(fx, 'impact'), splats = spy(fx, 'splat'), feels = spy(juice, 'feel');
    let glow = 0, tremble = 0;
    step(60 * 12, () => { glow = Math.max(glow, e.model.song.material.opacity); tremble = Math.max(tremble, Math.abs(e.model.body.scale.x - 1)); return e.state === 'idle' && e.strikes === null && !run.elites.rings.length; });
    const strikes = SK().ring.rings, rimFlash = impacts.filter(([at]) => at.distanceTo(e.base) < e.r * 2 && at.y > e.base.y + 0.05).length, shimmer = splats.filter(([at]) => Math.hypot(at.x - e.base.x, at.z - e.base.z) < 0.01).length;
    const ring = { rimFlash, shimmer, impact: feels.filter(([k]) => k === 'impact').length, glow: +glow.toFixed(2), tremble: +tremble.toFixed(3) };
    ({ e, player } = startBowl(1));
    impacts = spy(fx, 'impact'); splats = spy(fx, 'splat');
    let kick = 0;
    step(60 * 10, () => { kick = Math.max(kick, e.kick || 0); return e.state === 'idle' && e.chimes === null && !run.elites.bullets.length; });
    const chime = { release: impacts.filter(([at]) => at.distanceTo(e.base) < e.r * 2.5 && at.y > e.base.y + 0.1).length, kick: +kick.toFixed(2), underJelly: splats.filter(([at]) => Math.hypot(at.x - player.position.x, at.z - player.position.z) < 0.05).length };
    return ok(ring.rimFlash >= strikes && ring.shimmer >= strikes && ring.impact >= strikes && ring.glow > 0.5 && ring.tremble > 0.01
      && chime.release >= SK().chime.shots && chime.kick > 0.5 && chime.underJelly >= 1, { ring, chime });
  },
});

night4('bowl-chest-reachable', {
  about: 'Beat the Singing Bowl and its chest lands on an open spot on the lounge chair the jelly can walk or jump to and touch.',
  setup() { fresh({ treasures: false }); },
  play: eliteChestsReachable,
});
