import { SPECIES, buildCharacter } from '../character.js';
import { BASE_STATS } from '../stats.js';
import { G, V, evolve, fresh, near, ok, record, setupFight, spawn, step, story, stub } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); evolve('cinder'); step(2); };
const walk = (x, z) => { const { run, player } = G(); player.moveHorizontal(x, z, run.fireTrail.onWalk); player.syncMesh(); run.fireTrail.draw(); };

story('treasures/fire-trail', {
  about: 'Cinder records actual grounded movement, stops laying fire in a jump, and starts a separate trail after landing.',
  setup,
  play() {
    const { run, player, input } = G(), F = run.fireTrail;
    input.keys = new Set(['KeyW']); step(24);
    const walked = F.segments.length > 0 && F.mesh.visible;
    const last = F.segments.at(-1)?.time;
    input.jumpQueued = true; step(1);
    const airborne = !player.grounded;
    step(15);
    const noAir = F.segments.every(s => s.time <= last);
    step(120, () => player.grounded);
    step(12); input.keys.clear();
    const landed = F.segments.some(s => s.time > last + 0.1);
    const noBridge = F.segments.every(s => s.a.distanceTo(s.b) < 0.02);
    return ok(walked && airborne && noAir && landed && noBridge && Math.abs(run.S.range - BASE_STATS.range * 0.8) < 1e-8,
      { walked, airborne, noAir, landed, noBridge, range: run.S.range });
  },
});

story('evolutions/cinder-exact-two-seconds', {
  about: 'The oldest ground burns out exactly two seconds after it was walked, even while airborne. Newer sections remain; standing still never refreshes them.',
  setup,
  play() {
    const { run } = G(), F = run.fireTrail;
    walk(0.05, 0); const first = F.clock;
    F.update(1); walk(0.05, 0); const second = F.clock;
    F.update(0.999); F.draw(); const before = F.segments.some(s => s.time === first);
    F.update(0.001); F.draw(); const clipped = F.segments.length > 0 && F.segments.every(s => s.time === second);
    F.update(1); F.draw(); const gone = !F.segments.length && !F.mesh.visible;
    return ok(before && clipped && gone, { before, clipped, gone });
  },
});

story('evolutions/cinder-follows-corners-and-height', {
  about: 'An L-shaped walk burns its two arms, not a diagonal shortcut. Bugs beside the path or high above it are safe.',
  setup,
  play() {
    const { run, player } = G(), F = run.fireTrail, start = player.position.clone();
    walk(0.15, 0); walk(0, 0.15);
    const a = spawn('roach', start.clone().add(V(0.08, 0, 0)), { still: true, hp: 100 });
    const b = spawn('roach', start.clone().add(V(0.15, 0, 0.08)), { still: true, hp: 100 });
    const diagonal = spawn('roach', start.clone().add(V(0.075, 0, 0.075)), { still: true, hp: 100 });
    const above = spawn('roach', start.clone().add(V(0.08, 0.3, 0)), { still: true, hp: 100 });
    F.update(0.25);
    return ok(a.hp < 100 && b.hp < 100 && diagonal.hp === 100 && above.hp === 100,
      { a: a.hp, b: b.hp, diagonal: diagonal.hp, above: above.hp });
  },
});

story('evolutions/cinder-wall-slide-and-floor-gaps', {
  about: 'Collision-resolved wall slides never paint through the wall, and missing floor breaks the trail instead of bridging a hole.',
  setup,
  play() {
    const { run, player, world } = G(), F = run.fireTrail, start = player.position.clone();
    const cast = world.cast.bind(world), wall = start.x + 0.12;
    stub(world, 'cast', (origin, dir, length) => {
      if (dir.y < -0.5) return cast(origin, dir, length);
      if (dir.x <= 0) return null;
      const distance = (wall - origin.x) / dir.x;
      return distance >= 0 && distance <= length ? { distance, normal: V(-1, 0, 0), point: origin.clone().addScaledVector(dir, distance) } : null;
    });
    walk(0.2, 0.15);
    const slidePos = player.position.clone().sub(start).toArray(), maxTrailX = Math.max(...F.segments.map(s => Math.max(s.a.x, s.b.x))) - start.x;
    const slid = player.position.z > start.z + 0.1 && player.position.x < wall && F.segments.length > 0 && F.segments.every(s => Math.max(s.a.x, s.b.x) <= player.position.x + 1e-6);
    F.reset(); F.update(0); player.position.copy(start);
    const left = start.x + 0.04, right = start.x + 0.09;
    stub(world, 'cast', (origin, dir, length) => dir.y < -0.5 && origin.x > left && origin.x < right ? null : cast(origin, dir, length));
    walk(0.15, 0);
    const noBridge = F.segments.every(s => s.b.x <= left + 1e-6 || s.a.x >= right - 1e-6);
    const bothSides = F.segments.some(s => s.b.x <= left) && F.segments.some(s => s.a.x >= right);
    return ok(slid && noBridge && bothSides, { slid, noBridge, bothSides, slidePos, maxTrailX, radius: player.cfg.radius });
  },
});

story('evolutions/cinder-overlap-and-damage', {
  about: 'A retraced path hits each bug only once per damage tick, at half current power per second. Expired trail deals nothing.',
  setup,
  play() {
    const { run, player } = G(), F = run.fireTrail, start = player.position.clone();
    walk(0.1, 0); walk(-0.1, 0); walk(0.1, 0);
    const e = spawn('roach', start.clone().add(V(0.05, 0, 0)), { still: true, hp: 100 });
    const log = record('damage_taken'), expected = run.power * 0.5 * 0.25;
    F.update(0.25);
    const hits = log.filter(d => d.source === 'fire-trail' && d.targetId === e.id);
    const one = hits.length === 1 && Math.abs(hits[0].amount - expected) < 1e-9;
    F.update(2.1); const after = log.filter(d => d.source === 'fire-trail').length;
    return ok(one && after === 1 && !F.segments.length, { one, amount: hits[0]?.amount, expected, after });
  },
});

story('evolutions/cinder-teleports-vents-and-reset', {
  about: 'Teleports, vent flight and missing floor never connect two trail sections. Pauses stop trail age; a fresh run clears it.',
  setup,
  play() {
    const { run, player, input } = G(), F = run.fireTrail;
    walk(0.05, 0); const count = F.segments.length, clock = F.clock;
    document.getElementById('g-over').hidden = false; step(120);
    const paused = F.clock === clock && F.segments.length === count;
    document.getElementById('g-over').hidden = true;
    player.position.y += 0.2; player.grounded = false; player.syncMesh();
    step(1); const teleported = F.segments.length === count;
    player.launch(near(0.2, 0, 0.1)); input.keys.add('KeyW'); step(8); input.keys.clear();
    const vent = F.segments.length === count;
    const far = player.position.clone().setY(player.position.y + 10);
    F.record(far, V(1, 0, 0), 0.1); const noFloor = F.segments.length === count;
    fresh({ bubbles: false, lash: false });
    return ok(paused && teleported && vent && noFloor && !F.mesh.visible && !F.segments.length, { paused, teleported, vent, noFloor, cleared: !F.segments.length });
  },
});

story('evolutions/cinder-feet-every-species', {
  about: 'Flaming feet follow the real tentacle tips on every species without replacing the jelly, its face or its selected colors.',
  setup,
  play() {
    const { run, player } = G(), look = player.avatar.look, checked = [];
    try {
      for (const body of Object.keys(SPECIES)) {
        player.setAvatar(buildCharacter({ ...look, body }, run.cfg.height)); step(2);
        const avatar = player.avatar, saved = JSON.stringify(avatar.look);
        const P = run.adorn.piece('flaming-feet'); P.tick(0, run);
        const visible = P.group.children.filter(f => f.visible);
        const aligned = visible.every((f, i) => {
          const tip = avatar.tentacles.list[i].tip.getWorldPosition(V(0, 0, 0));
          return Math.hypot(tip.x-f.position.x, tip.z-f.position.z) < 1e-8 && f.position.y >= player.position.y;
        });
        checked.push({ body, aligned, count: visible.length, same: player.avatar === avatar && JSON.stringify(avatar.look) === saved });
      }
    } finally { player.setAvatar(buildCharacter(look, run.cfg.height)); }
    return ok(checked.every(x => x.aligned && x.same && x.count === SPECIES[x.body].tentacles.count), { checked });
  },
});

story('evolutions/cinder-prepared-on-low', {
  about: 'The ribbon and instanced flames are prepared behind Play, add no lights or shaders on activation, and retain a bounded history.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { run, APT, GAME, gfx } = G(), quality = gfx.quality;
    try {
      gfx.setTier('low'); GAME.render(); const before = APT.renderer.info.programs.length;
      evolve('cinder'); step(2); walk(0.1, 0); GAME.render();
      const ready = run.fireTrail.mesh.visible && APT.renderer.info.programs.length === before;
      for (let i = 0; i < 1100; i++) run.fireTrail.record(G().player.position, V(1, 0, 0), 0.001);
      run.fireTrail.draw();
      return ok(ready && run.fireTrail.segments.length <= 1024 && run.fireTrail.mesh.geometry.drawRange.count <= 1024 * 18,
        { ready, before, after: APT.renderer.info.programs.length, segments: run.fireTrail.segments.length });
    } finally { gfx.setTier(quality); }
  },
});

story('evolutions/cinder-look-restoration-keeps-mirage-ready', {
  about: 'Rebuilding the same selected look after species previews reuses the prepared Mirage model and its shaders.',
  setup,
  play() {
    const { run, player } = G(), look = player.avatar.look, M = run.mirage;
    try {
      M.prepare(); const ghost = M.avatar;
      player.setAvatar(buildCharacter(look, run.cfg.height)); M.prepare();
      const reused = M.avatar === ghost && M.source === player.avatar;
      return ok(reused && M.avatar.look.color === player.avatar.look.color, { reused });
    } finally { player.setAvatar(buildCharacter(look, run.cfg.height)); M.prepare(); }
  },
});
