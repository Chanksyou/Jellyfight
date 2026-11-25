// Stories: Bioluminescent Wake (the wake word, src/wake.js).
import { G, V, dmgBy, give, ok, record, setupFight, spawn, step, story } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); give('bioWake'); step(2); };
const walk = (x, z) => { const { run, player } = G(); player.moveHorizontal(x, z, run.onWalk); player.syncMesh(); run.wake.draw(); };

story('treasures/wake', {
  about: 'wake (Bioluminescent Wake): swimming along the floor lays a trail that shows; a bug walking in it is slowed by 30%, one beside it is not, and a flying bug over it is not. The trail is gone 4 s after it was laid.',
  setup,
  play() {
    const { run, player } = G(), W = run.wake, start = player.position.clone();
    walk(0.2, 0);
    const laid = W.points.length > 5 && W.mesh.visible;
    const on = spawn('roach', start.clone().add(V(0.1, 0, 0)), { still: true, hp: 999 });
    const off = spawn('roach', start.clone().add(V(0.1, 0, 0.12)), { still: true, hp: 999 });
    W.update(0.11);
    const slowed = on.wadeT > 0 && Math.abs(on.wadeK - 0.3) < 1e-9, spared = !(off.wadeT > 0);
    W.update(3.8); const holds = W.points.length > 0;
    W.update(0.25); W.draw(); const gone = W.points.length === 0 && !W.mesh.visible;
    return ok(laid && slowed && spared && holds && gone, { points: laid, slowed, spared, holds, gone });
  },
});

story('treasures/wake-jump-sets-it-off', {
  about: 'wake: a jump off the ground sends a pulse from the jelly to the far end of the trail in 0.3 s; bugs by the trail are each hit once for 2x Attack damage, the near one before the far one, and the trail is used up. A second jump within 1 s sets nothing off, and a mid-air jump never does.',
  setup,
  play() {
    const { run, player, input } = G(), W = run.wake, start = player.position.clone(), log = record('damage_taken');
    walk(0.3, 0);
    const far = spawn('roach', start.clone().add(V(0.02, 0, 0.01)), { still: true, hp: 999 });
    const near = spawn('roach', start.clone().add(V(0.28, 0, 0.01)), { still: true, hp: 999 });
    const lit = W.ignite();
    let nearAt = -1, farAt = -1;
    for (let i = 0; i < 25; i++) {
      W.update(0.02);
      const hit = dmgBy(log, 'wake');
      if (nearAt < 0 && hit.some((d) => d.targetId === near.id)) nearAt = i;
      if (farAt < 0 && hit.some((d) => d.targetId === far.id)) farAt = i;
    }
    const hits = dmgBy(log, 'wake'), want = run.power * 2;
    const once = hits.filter((d) => d.targetId === near.id).length === 1 && hits.filter((d) => d.targetId === far.id).length === 1;
    const amount = hits.every((d) => Math.abs(d.amount - want) < 1e-6);
    W.update(0.2); const usedUp = W.points.length === 0;
    walk(0.1, 0); const again = W.ignite();
    W.update(1); walk(0.05, 0);
    input.jumpQueued = true; step(1);   // a real jump off the ground
    const fromJump = W.points.every((q) => q.lit >= 0);
    step(10); walk(0.05, 0); W.update(1.1);
    run.mods.extraJumps = 1; input.jumpQueued = true; step(1);   // in mid-air
    const midAir = W.points.some((q) => q.lit < 0) && !player.grounded;
    return ok(lit && nearAt >= 0 && farAt > nearAt && once && amount && usedUp && !again && fromJump && midAir,
      { lit, nearAt, farAt, once, amount, usedUp, again, fromJump, midAir });
  },
});
