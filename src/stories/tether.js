// Stories: Tether Current (the tether word, src/tether.js).
import { bus } from '../events.js';
import { G, dmgBy, give, holdJelly, ok, record, roachAt, setupFight, step, story } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); give('tetherCurrent'); holdJelly(); };
// an attack (run.attacked) and the bubble hit it lands on `e`
const attack = (e) => { G().run.attacked(); if (e) bus.emit('damage_taken', { targetId: e.id, amount: 0.01, source: 'bubble' }); };

story('treasures/tether', {
  about: 'tether (Tether Current): the first four attacks tie nothing; the 5th ties a beam to the bug it hits. A bug standing on the beam is cut by it (soft hits, about 1.5x Attack damage a second), the tied bug is not, and a bug off to the side is safe. Another 5th attack while it holds ties nothing new.',
  setup,
  play() {
    const { run } = G(), T = run.tether, log = record('damage_taken');
    const post = roachAt(0, -0.3), mid = roachAt(0, -0.15), aside = roachAt(0.15, -0.15);
    for (let i = 0; i < 4; i++) attack(post);
    const early = T.target;
    attack(post);
    const tied = T.target === post;
    for (let i = 0; i < 50; i++) T.update(0.02);   // 1 s
    const shown = T.mesh.visible;
    const cuts = dmgBy(log, 'tether'), onMid = cuts.filter((d) => d.targetId === mid.id);
    const dealt = onMid.reduce((s, d) => s + d.amount, 0), want = run.power * 1.5;
    const soft = onMid.every((d) => d.feedback?.soft);
    for (let i = 0; i < 5; i++) attack(mid);
    const kept = T.target === post;
    return ok(!early && tied && shown && onMid.length >= 4 && Math.abs(dealt - want) < want * 0.25 && soft
      && !cuts.some((d) => d.targetId === post.id || d.targetId === aside.id) && kept,
      { early: !!early, tied, ticks: onMid.length, dealt, want, soft, kept });
  },
});

story('treasures/tether-breaks-and-lasts-4s', {
  about: 'tether: the beam lets go after 4 s, as soon as the tied bug dies, or when it gets more than 0.6 m away. The Boss is never tied; an Elite can be.',
  setup,
  play() {
    const { run } = G(), T = run.tether, E = run.enemies;
    const tick = (s) => { for (let t = 0; t < s; t += 0.05) T.update(0.05); };
    const fifth = (e) => { T.update(0.1); for (let i = 0; i < 4; i++) attack(); attack(e); };
    let a = roachAt(0, -0.2); fifth(a);
    tick(3.9); const holds = T.target === a; tick(0.2); const timedOut = !T.target;
    a = roachAt(0.1, -0.2); fifth(a); a.dead = true; tick(0.05); const onDeath = !T.target;
    a = roachAt(-0.1, -0.2); fifth(a); a.pos.z -= 0.6; tick(0.05); const tooFar = !T.target;
    const proxy = (boss) => { const o = { position: run.player.position.clone().setZ(run.player.position.z - 0.2), r: 0.03, damage() {}, center: (out) => out.copy(o.position) }; const e = E.addProxy(o); if (boss) e.boss = true; return e; };
    const boss = proxy(true); fifth(boss); const noBoss = !T.target;
    const elite = proxy(false); fifth(elite); const eliteTied = T.target === elite;
    return ok(holds && timedOut && onDeath && tooFar && noBoss && eliteTied, { holds, timedOut, onDeath, tooFar, noBoss, eliteTied });
  },
});

story('treasures/tether-tilts-with-a-jump', {
  about: 'tether: the beam runs from the jelly\'s middle wherever it is, so with the jelly up in the air it slants up through a bug hanging in the air on that line, which a beam from the floor would pass under.',
  setup,
  play() {
    const { run, player } = G(), T = run.tether, log = record('damage_taken');
    const post = roachAt(0, -0.4), flyer = roachAt(0, -0.2);
    for (let i = 0; i < 5; i++) attack(post);
    const lift = 0.16, mid = run.enemies.center(post).y;
    flyer.pos.y += lift * 0.5;   // where the slanted beam's middle runs
    for (let i = 0; i < 10; i++) T.update(0.02);
    const grounded = dmgBy(log, 'tether').filter((d) => d.targetId === flyer.id).length;
    player.position.y += lift;
    for (let i = 0; i < 10; i++) T.update(0.02);
    const up = dmgBy(log, 'tether').filter((d) => d.targetId === flyer.id).length - grounded;
    player.position.y -= lift;
    return ok(grounded === 0 && up >= 1 && T.target === post, { grounded, up, mid });
  },
});

story('treasures/tether-ties-in-play', {
  about: 'tether in real play, for Normal\'s bubbles and the Tentacle jelly\'s stings: shooting a bug ties the beam to it within a few attacks, and the beam shows.',
  setup() {},
  play() {
    const out = {};
    for (const type of ['normal', 'tentacle']) {
      setupFight({ types: type }); give('tetherCurrent'); holdJelly();
      const { run } = G(), T = run.tether;
      roachAt(0.03, -0.05); roachAt(-0.03, -0.05);
      let tied = false, shown = false;
      for (let i = 0; i < 600 && !(tied && shown); i++) { step(1); tied ||= !!T.target; shown ||= T.mesh.visible; }
      out[type] = { tied, shown };
    }
    return ok(Object.values(out).every((o) => o.tied && o.shown), out);
  },
});
