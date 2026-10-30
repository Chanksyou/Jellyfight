import { PLAYER } from '../events.js';
import { BASE_STATS } from '../stats.js';
import { G, V, evolve, fresh, give, near, ok, record, setupFight, spawn, step, story, stub } from './kit.js';

story('treasures/rebound', {
  about: 'A bubble hits once going out and once returning, retains hit feedback, then is caught. Elements keep their own flight.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('rebound'); },
  play() {
    const { run, enemies, player } = G(), B = run.bubbles;
    const e = spawn('roach', near(0, -0.1), { still: true, hp: 100 });
    const origin = player.position.clone().setY(enemies.center(e).y);
    B.origin = origin;
    const b = B.blow(origin, e, { size: 1, dmg: 1, pierce: 1 });
    const log = record('damage_taken'), stats = { ...run.S, range: 0.14 };
    let turned = false;
    for (let i = 0; i < 240; i++) { B.fly(1 / 120, stats, run.mods); turned ||= !!b.returning; }
    const hits = log.filter(d => d.source === 'bubble' && d.targetId === e.id);
    const caught = B.list.length === 0;
    return ok(turned && hits.length === 2 && caught && Math.abs(run.S.fireRate - BASE_STATS.fireRate * 0.8) < 1e-8,
      { turned, hits: hits.length, caught, fireRate: run.S.fireRate });
  },
});

story('evolutions/rebound-wall-and-guidance', {
  about: 'Walls reverse outward bubbles, return flight follows the current jelly position, and the lifetime bounds a missed catch.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('rebound'); },
  play() {
    const { run } = G(), B = run.bubbles, stats = { ...run.S, range: 0.14 };
    const origin = near(0, 0, 0.05); B.origin = origin.clone();
    const b = B.blow(origin, null, { size: 1, dmg: 1, pierce: 1, dir: V(0, 0, -1) });
    B.fly(0, stats, run.mods);
    b.travel = B.grace + 0.01;
    stub(B.world, 'cast', () => ({ distance: 0.001 }));
    B.fly(1 / 120, stats, run.mods);
    const wall = b.returning === true && !b.done;
    stub(B.world, 'cast', () => null);
    B.origin.x += 0.1;
    B.fly(1 / 120, stats, run.mods);
    const guided = b.vel.x > 0 && !b.homing;
    b.t = 10; B.fly(1 / 120, stats, run.mods);
    const bounded = B.list.length === 0;
    return ok(wall && guided && bounded, { wall, guided, bounded });
  },
});

story('evolutions/rebound-elements-and-pierce', {
  about: 'Pierce permits two distinct bugs per leg; Element projectiles never become returning bubbles.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('rebound'); give('freezerPack'); },
  play() {
    const { run, enemies } = G(), B = run.bubbles;
    const a = spawn('roach', near(0, -0.08), { still: true, hp: 100 });
    const z = spawn('roach', near(0, -0.16), { still: true, hp: 100 });
    const origin = near(0, 0).setY(enemies.center(a).y); B.origin = origin;
    B.blow(origin, a, { size: 1, dmg: 1, pierce: 2 });
    const ice = B.blow(origin, a, { size: 1, dmg: 1, pierce: 1, tint: 'ice', elems: ['ice'], ep: run.mods.element.ice });
    const log = record('damage_taken'), stats = { ...run.S, range: 0.18 };
    for (let i = 0; i < 300; i++) B.fly(1 / 120, stats, run.mods);
    const hits = log.filter(d => d.source === 'bubble' && !d.feedback?.element);
    return ok(hits.filter(d => d.targetId === a.id).length === 2 && hits.filter(d => d.targetId === z.id).length === 2 && ice.rebound === false && ice.done,
      { hits: hits.map(d => d.targetId), ice: ice.rebound, iceDone: ice.done });
  },
});

function leaveGhost() {
  const { run, player } = G(), M = run.mirage;
  M.update(1 / 60);
  for (let i = 0; i < 481; i++) { player.position.x += 0.0001; M.update(1 / 60); }
  return M;
}

story('treasures/decoy', {
  about: 'Moving for eight seconds leaves one copy for four seconds. Nearby ordinary bugs chase it, then resume chasing the real jelly; Elites ignore it.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('mirage'); },
  play() {
    const { run, player, enemies } = G(), M = leaveGhost();
    const shown = M.group.visible && M.left > 3.9;
    player.position.x += 0.3;
    const bug = spawn('roach', M.position.clone().add(V(0.1, 0, 0)), { hp: 100 });
    const elite = spawn('roach', M.position.clone().add(V(0.1, 0, 0.12)), { hp: 100 }); elite.elite = true;
    const P = { position: player.position, height: run.cfg.height, radius: run.cfg.radius };
    enemies.update(1 / 60, P, run.t, M.target);
    const lured = bug.vel.x < 0, ignored = elite.vel.x > 0;
    M.update(4.1); enemies.update(0.3, P, run.t, M.target);
    const resumed = bug.vel.x > 0 && !M.group.visible;
    return ok(shown && lured && ignored && resumed && Math.abs(run.S.health - BASE_STATS.health * 0.85) < 1e-8,
      { shown, lured, ignored, resumed, health: run.S.health });
  },
});

story('evolutions/mirage-real-collisions', {
  about: 'Pokes, beams, leaps, swats and whips hitting the ghost never damage the distant real jelly. Contact with the real jelly remains dangerous.',
  setup() { setupFight({ hurt: true, bubbles: false, lash: false }); evolve('mirage'); },
  play() {
    const { run, player, enemies } = G(), M = leaveGhost();
    player.position.x += 0.7;
    const e = spawn('roach', M.position.clone(), { still: true, hp: 100 });
    e.pokeAt = M.center.clone(); e.beamDir = V(0, 0, 1); e.swatDir = V(0, 0, 1); e.whipDir = V(0, 0, 1);
    const c = { pc: M.center, foot: M.position, realPc: player.position.clone().add(V(0, run.cfg.height * 0.5, 0)), realFoot: player.position };
    const log = record('damage_taken');
    enemies.poke(e, c, 2); enemies.slam(e, c, 0.08, 2);
    enemies.beam(e, c, { reach: 0.1, width: 0.01, dmg: 2 });
    enemies.swat(e, c, { reach: 0.1, arc: 90, dmg: 2 });
    enemies.whip(e, c, { reach: 0.1, width: 0.01, dmg: 2 });
    const safe = !log.some(d => d.targetId === PLAYER);
    e.beamDir.copy(c.realPc).sub(enemies.center(e)).normalize();
    enemies.beam(e, c, { reach: 1, width: 0.01, dmg: 2 });
    const lockedHit = log.some(d => d.targetId === PLAYER);
    log.length = 0;
    e.pos.copy(player.position); run.iFrames = 0; run.contactDamage();
    return ok(safe && lockedHit && log.some(d => d.targetId === PLAYER), { safe, lockedHit, realHit: log.some(d => d.targetId === PLAYER) });
  },
});

story('evolutions/rebound-mirage-ready', {
  about: 'Both adornments and the reusable ghost are prepared before Play and need no new shader when chosen.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { APT, run, GAME } = G();
    GAME.render();
    const before = APT.renderer.info.programs.length;
    evolve('rebound'); evolve('mirage'); step(2); leaveGhost(); GAME.render();
    return ok(APT.renderer.info.programs.length === before && run.mirage.group.visible && run.adorn.pieces['rebound-bands'].group.visible && run.adorn.pieces['mirage-rim'].group.visible,
      { before, after: APT.renderer.info.programs.length });
  },
});

story('evolutions/mirage-pause-reset-and-look', {
  about: 'Standing still and pausing do not charge Mirage. It copies the selected look without changing it, reuses its meshes, and clears on a fresh run.',
  setup() { setupFight({ bubbles: false, lash: false }); evolve('mirage'); },
  play() {
    const { run, player } = G(), M = run.mirage;
    step(120); const idle = M.wait === 0;
    const before = JSON.stringify(player.avatar.look), ghost = leaveGhost(), root = ghost.avatar.root;
    const copy = JSON.stringify(ghost.avatar.look) === before && root !== player.avatar.root;
    document.getElementById('g-over').hidden = false;
    const left = M.left; step(120);
    const paused = M.left === left;
    document.getElementById('g-over').hidden = true;
    give('coffeeBean'); step(1);
    const preserved = M.avatar.root === root && JSON.stringify(player.avatar.look) === before;
    fresh({ bubbles: false, lash: false });
    return ok(idle && copy && paused && preserved && !M.group.visible && M.wait === 0,
      { idle, copy, paused, preserved, cleared: !M.group.visible });
  },
});
