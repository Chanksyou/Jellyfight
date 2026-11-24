import { juice } from '../juice.js';
import { bus } from '../events.js';
import { G, near, ok, phone, record, setupFight, spawn, step, story } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); step(120); };
const kill = (type, offset = 0.24) => {
  const e = spawn(type, near(offset, 0, 0), { still: true });
  step(1);
  bus.emit('damage_taken', { targetId: e.id, amount: 10000, source: 'story' });
  return e;
};

story('words/death-motion', {
  about: 'Death motions are content words. A killed roach crumples and skids as harmless scenery while its reward, target removal and death position resolve immediately.',
  setup,
  play() {
    const { enemies, fx, run } = G(), events = record('enemy_killed'), kills = run.kills;
    const e = kill('roach'), c = fx.deaths.list.at(-1), at = e.pos.clone(), start = c.root.position.clone();
    const immediate = e.dead && !enemies.byId.has(e.id) && run.kills === kills + 1 && events.length === 1;
    step(18);
    const crumple = c.mesh.scale.y < c.mesh.scale.x * 0.6, skid = c.root.position.distanceTo(start) > 0.01;
    enemies.kill(e);
    return ok(immediate && crumple && skid && e.pos.equals(at) && events.length === 1, { immediate, crumple, skid, fixedDeathPosition: e.pos.equals(at) });
  },
});

story('deaths/ant-crumples', {
  about: 'An ant crumples where it falls, its six legs folding out flat.',
  setup,
  play() {
    const { enemies, fx } = G();
    const e = spawn('ants', near(0.3, 0, 0), { still: true });
    step(30); enemies.kill(e);
    const c = fx.deaths.list.at(-1);
    step(18);
    const folded = c.style === 'crumple' && c.parts.length === 6 && c.parts.every((p) => Math.abs(p.mesh.rotation.z - p.rotation.z) > 0.5);
    return ok(folded, { style: c.style, parts: c.parts.length });
  },
});

story('deaths/flyers-fall-and-shells-separate', {
  about: 'Every flyer spins and descends. Armored bugs detach their original recognizable shell geometry, including the ladybug spots, without changing materials.',
  setup,
  play() {
    const { enemies, fx } = G(), flyers = {}, shells = {};
    for (const type of ['mosquito', 'lanternfly', 'housefly', 'dragonfly', 'wasp']) {
      const e = spawn(type, near(0.3, 0, 0.25), { still: true }); step(1); enemies.kill(e);
      const c = fx.deaths.list.at(-1), y = c.root.position.y; step(12);
      flyers[type] = c.root.position.y < y && Math.abs(c.root.rotation.y - c.yaw) > 0.5;
    }
    for (const type of ['ladybug', 'millipede', 'beetle']) {
      const e = spawn(type, near(0.3, 0, 0), { still: true }); step(1);
      const piece = e.deathParts[0], materials = []; piece.traverse(o => { if (o.isMesh) materials.push(o.material); });
      enemies.kill(e); const c = fx.deaths.list.at(-1); step(15);
      const current = []; piece.traverse(o => { if (o.isMesh) current.push(o.material); });
      shells[type] = c.fragment.mesh === piece && piece.parent === fx.scene && piece.position.distanceTo(c.fragment.origin) > 0.01 && materials.every((m, i) => current[i] === m);
    }
    return ok(Object.values(flyers).every(Boolean) && Object.values(shells).every(Boolean), { flyers, shells });
  },
});

story('deaths/cleanup-floor-and-reduced-effects', {
  about: 'Bodies stay above their actual floor, expire, clear on restart, respect Reduce Effects, and never appear for silent removal.',
  setup,
  play() {
    const { enemies, fx, run, THREE } = G(), calm = juice.calm;
    try {
      const e = kill('mosquito'), c = fx.deaths.list.at(-1);
      let above = true;
      for (let i = 0; i < 55; i++) {
        step(1); c.root.updateMatrixWorld(true);
        above &&= new THREE.Box3().setFromObject(c.root).min.y >= c.floor + 0.0009;
      }
      step(20); const expired = !c.root.parent && !fx.deaths.list.length;
      juice.calm = true; kill('roach'); const quiet = !fx.deaths.list.length;
      juice.calm = false;
      const silent = spawn('roach', near(0.3, 0, 0)); enemies.kill(silent, true);
      const noSilent = !fx.deaths.list.length;
      kill('ladybug'); const piece = fx.deaths.list.at(-1).fragment.mesh;
      run.start();
      return ok(e.dead && above && expired && quiet && noSilent && !piece.parent && !fx.deaths.list.length, { above, expired, quiet, noSilent, cleared: !piece.parent });
    } finally { juice.calm = calm; }
  },
});

story('deaths/crowd-cap-and-prepared-shaders', {
  about: 'Crowded kills retain at most twelve bodies, reuse prepared model materials, and release every body and shell after their short lifetime.',
  setup,
  play() {
    const { fx, GAME, APT, batcher } = G();
    GAME.render(); const programs = APT.renderer.info.programs.length;
    for (let i = 0; i < 30; i++) kill(['roach', 'ants', 'ladybug', 'beetle'][i % 4], 0.24 + i % 4 * 0.08);
    const capped = fx.deaths.list.length === 12;
    batcher.sync(); GAME.render();
    const shaders = APT.renderer.info.programs.length - programs;
    const roots = fx.deaths.list.flatMap(c => [c.root, ...(c.fragment ? [c.fragment.mesh] : [])]);
    step(80); batcher.sync();
    return ok(capped && shaders === 0 && !fx.deaths.list.length && roots.every(r => !r.parent && !batcher.roots.has(r)), { capped, shaders, remaining: fx.deaths.list.length });
  },
});

story('deaths/burning-keeps-ash-treatment', {
  about: 'A burning bug keeps its original ash corpse and never also plays an ordinary body or shell death.',
  setup,
  play() {
    const { run, enemies, fx } = G(), e = spawn('ladybug', near(0.3, 0, 0), { still: true }); step(1);
    run.bubbles.ignite(e, 10, { burn: 1, burnTime: 3 });
    enemies.kill(e); run.bubbles.effects(1 / 60, run.S);
    const ash = fx.fireCorpses.some(c => c.root === e.root);
    return ok(ash && !fx.deaths.list.length && e.deathParts[0].parent !== fx.scene, { ash, ordinary: fx.deaths.list.length });
  },
});

story('deaths/proxy-removal-keeps-position-getter', {
  about: 'Boss transitions can silently remove target proxies with a read-only position; ordinary bug death poses never take ownership of that position.',
  setup,
  play() {
    const { enemies, fx } = G(), position = near(0.3, 0, 0), proxy = enemies.addProxy({ position, r: 0.05 });
    enemies.kill(proxy, true);
    return ok(proxy.dead && proxy.pos === position && !enemies.byId.has(proxy.id) && !fx.deaths.list.length,
      { dead: proxy.dead, samePosition: proxy.pos === position, bodies: fx.deaths.list.length });
  },
});

phone('enemy-death-personalities', {
  about: 'Roach, ant, flyer and shell death motions remain visible on a phone with bounded bodies and unchanged reward timing.',
  setup,
  play() {
    const { fx, gfx, GAME, run } = G(), kills = run.kills;
    ['roach', 'ants', 'mosquito', 'ladybug'].forEach((type, i) => kill(type, 0.22 + i * 0.07));
    step(12); GAME.render();
    return ok(fx.deaths.list.length === 4 && run.kills === kills + 4, { bodies: fx.deaths.list.length, kills: run.kills - kills, tier: gfx.quality });
  },
});

story('deaths/multi-part-and-part-cap', {
  about: 'Exaggerated deaths detach multiple real bug parts, respect the global part cap, compile zero new shaders, and release every part back to ModelPool on expiry.',
  setup,
  play() {
    const { fx, GAME, APT, batcher } = G();
    GAME.render(); const programs = APT.renderer.info.programs.length;
    for (let i = 0; i < 16; i++) kill(['ladybug', 'beetle', 'millipede', 'ants', 'housefly', 'firefly'][i % 6], 0.24 + (i % 4) * 0.07);
    const activeParts = fx.deaths.detached.length;
    const multiPart = activeParts > fx.deaths.list.length;
    const withinCap = activeParts <= fx.deaths.maxParts;
    const parts = fx.deaths.detached.map((p) => p.mesh);
    batcher.sync(); GAME.render();
    const shaders = APT.renderer.info.programs.length - programs;
    step(90); batcher.sync();
    const cleaned = fx.deaths.list.length === 0 && fx.deaths.detached.length === 0 && parts.every((m) => !m.parent);
    return ok(multiPart && withinCap && shaders === 0 && cleaned, { activeParts, maxParts: fx.deaths.maxParts, shaders, cleaned });
  },
});

story('deaths/cause-of-death-treatments', {
  about: 'Lightning zap, stomp pancake, tentacle whip, wind wall-slam, and poison DoT kills each play their own distinct death treatment and clean up.',
  setup,
  play() {
    const { fx, THREE } = G();
    const hitKill = (type, extra) => {
      const e = spawn(type, near(0.28, 0, 0), { still: true }); step(1);
      bus.emit('damage_taken', { targetId: e.id, amount: 10000, ...extra });
      return e;
    };
    hitKill('roach', { source: 'lightning', feedback: { element: 'lightning' } });
    const zap = fx.deaths.list.at(-1)?.cause === 'zap';
    hitKill('ants', { source: 'stomp' });
    const pancake = fx.deaths.list.at(-1)?.cause === 'pancake';
    hitKill('beetle', { source: 'tentacle', feedback: { dir: new THREE.Vector3(1, 0, 0) } });
    const whip = fx.deaths.list.at(-1)?.cause === 'whip';
    hitKill('spider', { source: 'wind-collision', feedback: { element: 'wind', slam: true, dir: new THREE.Vector3(0, 0, 1) } });
    const wallSplat = fx.deaths.list.at(-1)?.cause === 'wall-splat';
    const meltsBefore = fx.acid.melts.length;
    hitKill('roach', { source: 'poison' });
    const poisonMelts = fx.acid.melts.length > meltsBefore;
    step(90);
    const cleaned = fx.deaths.list.length === 0 && fx.deaths.detached.length === 0 && fx.acid.melts.length === 0;
    return ok(zap && pancake && whip && wallSplat && poisonMelts && cleaned, { zap, pancake, whip, wallSplat, poisonMelts, cleaned });
  },
});

story('deaths/low-tier-and-calm-budgets', {
  about: 'Low graphics enforces tighter body and detached-part caps; Reduce Effects suppresses death bodies and detached parts completely.',
  setup,
  play() {
    const { fx } = G(), prevLow = fx.low, calm = juice.calm;
    try {
      fx.low = () => true;
      for (let i = 0; i < 16; i++) kill(['ladybug', 'beetle', 'millipede', 'ants'][i % 4], 0.24 + (i % 4) * 0.06);
      const lowBodies = fx.deaths.list.length <= fx.deaths.capLow;
      const lowParts = fx.deaths.detached.length <= fx.deaths.partCapLow;
      fx.deaths.clear();
      juice.calm = true;
      kill('ladybug');
      const calmQuiet = fx.deaths.list.length === 0 && fx.deaths.detached.length === 0;
      return ok(lowBodies && lowParts && calmQuiet, { bodies: fx.deaths.list.length, parts: fx.deaths.detached.length, lowBodies, lowParts, calmQuiet });
    } finally { fx.low = prevLow; juice.calm = calm; }
  },
});
