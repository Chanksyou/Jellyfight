// Stories: Jelly Mould (the turret word, src/turrets.js).
import { G, dmgBy, give, holdJelly, near, ok, record, roachAt, setupFight, spawn, spy, step, story, stub } from './kit.js';
import { elementParams } from '../words.js';

const EF = { time: 8, health: 8, dmg: 0.4, most: 4 };
// a Jelly Mould's jelly `dx`, `dz` from the jelly; the jelly's own attack held back so only it shoots
const setup = (types = 'normal') => { setupFight({ types, lash: false }); holdJelly(); };
const quiet = () => { const { run } = G(); stub(run.bubbles, 'volley', () => false); stub(run.bubbles, 'elementVolley', () => false); };
const place = (dx, dz, ef = EF) => { const { run } = G(); run.turrets.place(near(dx, dz), ef); return run.turrets.list.at(-1); };

story('treasures/turret', {
  about: 'turret (Jelly Mould): a little jelly set on the floor shoots the nearest bug in Range at the jelly\'s Fire rate, each hit 40% of Attack damage, as source "turret". None of the Treasures change its shots (a sure Crit never lands on them), no hit counts as one of your attacks, and after its time it melts away.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    const log = record('damage_taken'), attacks = spy(run, 'attacked');
    stub(run.mods.hits.bubbles, 'crit', { chance: 1, mult: 3 });   // a Crit on every hit of yours
    const T = place(0.2, 0), bug = roachAt(0.2, -0.15);
    step(60 * 3);
    const hits = dmgBy(log, 'turret').filter((d) => d.targetId === bug.id), want = run.S.bubbleDamage * 0.4;
    const exact = hits.every((d) => Math.abs(d.amount - want) < want * 0.01), shots = run.S.fireRate * (3 - 0.25);
    const mine = dmgBy(log, 'bubble').length;
    step(60 * 6);
    const gone = !run.turrets.list.includes(T);
    return ok(hits.length >= Math.floor(shots) - 1 && hits.length <= Math.ceil(shots) + 1 && exact && !mine && !attacks.length && gone,
      { hits: hits.length, shots, amounts: hits.map((d) => +d.amount.toFixed(2)), want, mine, attacks: attacks.length, gone });
  },
});

story('treasures/turret-takes-the-bugs-hits', {
  about: 'turret: an ordinary bug nearer the little jelly than you goes for it, and its hits (a Mantis\'s swat) and touches (a Cockroach) land on it, never on you. At 0 Health it pops and the bugs come for you again.',
  setup: () => setup(),
  play() {
    const { run } = G(); quiet();
    const hurt = spy(run, 'hurt');
    const T = place(0, -0.35, { ...EF, health: 30, time: 60 });
    const mantis = spawn('mantis', near(0.05, -0.6), { hp: 9999 });
    let swatted = 0; const was = T.health;
    step(60 * 6, () => { swatted = was - T.health; return swatted >= 4; });
    const T2 = place(0.3, -0.3, { ...EF, time: 60 }); T.health = 0; run.turrets.end(T, true); run.enemies.kill(mantis, true);   // silent: no worm bursting out of it
    const roach = spawn('roach', near(0.3, -0.45), { hp: 9999 });
    step(60 * 6, () => T2.health <= 0);
    const popped = !run.turrets.list.includes(T2), hurtBefore = hurt.length;
    const before = roach.pos.distanceTo(run.player.position);
    step(60 * 2);
    const comes = roach.pos.distanceTo(run.player.position) < before;
    return ok(swatted >= 4 && popped && !hurtBefore && comes, { swatted, popped, hurt: hurtBefore, comes, mantis: mantis.state });
  },
});

story('treasures/turret-fires-the-type-attack', {
  about: 'turret: a Fire jelly\'s little jelly shoots Fire shots with Fire\'s starting numbers, one at a time, even when the jelly\'s own Fire has upgrades (3 more shots, a bigger Burn).',
  setup: () => setup('fire'),
  play() {
    const { run } = G(); quiet();
    run.mods.element.fire = { ...elementParams('fire'), count: 3, burn: 4 };
    place(0.2, 0); roachAt(0.2, -0.15);
    let shot = null;
    step(60 * 2, () => (shot = run.bubbles.list.find((b) => b.turret)));
    const base = elementParams('fire'), flying = run.bubbles.list.filter((b) => b.turret).length;
    return ok(shot && shot.tint === 'fire' && shot.ep.burn === base.burn && flying === 1, { tint: shot?.tint, burn: shot?.ep.burn, base: base.burn, flying });
  },
});

story('treasures/turret-levels', {
  about: 'Jelly Mould: every 10 s a little jelly with 25 Health (45 at level 2, 65 at level 3) and 40% of Attack damage (60% and 80%); it lasts 8 s, then 16 s at level 2 and 24 s at level 3. In play its timer sets one down on the floor under the jelly.',
  setup: () => setup(),
  play() {
    const { run } = G(), times = [];
    for (let k = 0; k < 3; k++) {
      give('jellyMould');
      const T = run.mods.timed.find((t) => t.effects.some((e) => e.kind === 'turret'));
      const e = T.effects.find((x) => x.kind === 'turret');
      times.push([T.every, e.time, e.health, e.dmg].join('/'));
    }
    step(60 * 11);
    const T = run.turrets.list[0], floor = T && Math.abs(T.position.y - run.player.position.y) < 0.02;
    return ok(times.join() === '10/8/25/0.4,10/16/45/0.6,10/24/65/0.8' && floor, { times, placed: run.turrets.list.length, floor, at: T?.position.toArray() });
  },
});
