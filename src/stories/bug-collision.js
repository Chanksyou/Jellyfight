import * as THREE from 'three';
import { World } from '../collision.js';
import { bus } from '../events.js';
import { G, V, holdJelly, near, offs, ok, phone, record, setupFight, spawn, step, story, stub } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); step(120); holdJelly(); };

// Real BVH scenery, isolated from apartment furniture so the exact clearance is known.
function room({ corner = false, wall = true, offset = 0 } = {}) {
  const { enemies } = G(), group = new THREE.Group(), origin = near(offset, 0);
  group.position.copy(origin); enemies.scene.add(group);
  const box = (size, at) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: 0x657380 }));
    m.position.set(...at); group.add(m); return m;
  };
  box([3, 0.02, 3], [0, -0.01, 0]);
  if (wall) box([0.004, 0.8, 2], [0.4, 0.4, 0]);
  if (corner) box([2, 0.8, 0.004], [0, 0.4, 0.4]);
  const world = new World(group); stub(enemies, 'world', world);
  offs.push(() => { group.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); });
  return { world, origin, box, group, limit: origin.x + 0.398 };
}

story('collision/spider-retreat-stays-inside-wall', {
  about: 'A spider backing away from a nearby jelly stops its body at the wall instead of retreating through it.',
  setup,
  play() {
    const { limit } = room(), e = spawn('spider', near(0.25, 0)); e.shootT = 99;
    let furthest = e.pos.x; step(240, () => { furthest = Math.max(furthest, e.pos.x); });
    return ok(furthest <= limit - e.r + 0.0001 && e.pos.x > near(0.29, 0).x,
      { furthest, limit: limit - e.r, final: e.pos.x });
  },
});

story('collision/thin-walls-corners-and-sliding', {
  about: 'A long diagonal move cannot tunnel through a thin wall or slide through a second wall in a corner, and moving away stays possible.',
  setup,
  play() {
    const { origin, limit } = room({ corner: true }), { enemies } = G(), e = spawn('roach', origin.clone(), { still: true });
    enemies.move(e, V(2, 0, 0.1));
    const slid = Math.abs(e.pos.z - origin.z - 0.1) < 0.002 && e.pos.x <= limit - e.r + 0.0001;
    enemies.move(e, V(0.8, 0, 2));
    const corner = e.pos.x <= limit - e.r + 0.0001 && e.pos.z <= origin.z + 0.398 - e.r + 0.0001;
    const before = e.pos.clone(); enemies.move(e, V(-0.1, 0, -0.1));
    return ok(slid && corner && e.pos.distanceTo(before) > 0.13, { slid, corner, away: e.pos.distanceTo(before) });
  },
});

story('collision/body-edges-and-backfaces', {
  about: 'A whole body catches a wall edge even when its center ray misses, and one-sided rendered surfaces block movement from either side.',
  setup,
  play() {
    const { group, origin } = room({ wall: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshBasicMaterial());
    plane.rotation.y = Math.PI / 2; plane.position.set(0.4, 0.4, 0); group.add(plane);
    const world = new World(group), hit = { point: V(), normal: V() };
    const edge = world.sweepSphere(origin.clone().add(V(0.2, 0.2, 0.32)), V(0.5, 0, 0), 0.04, hit);
    const edgeDistance = hit.distance;
    const back = world.sweepSphere(origin.clone().add(V(0.2, 0.2, 0)), V(0.5, 0, 0), 0.04, hit);
    const backDistance = hit.distance;
    const front = world.sweepSphere(origin.clone().add(V(0.6, 0.2, 0)), V(-0.5, 0, 0), 0.04, hit);
    return ok(edge && edgeDistance > 0.16 && edgeDistance < 0.17 && back && front && Math.abs(backDistance - 0.16) < 0.0001 && Math.abs(hit.distance - 0.16) < 0.0001,
      { edge, edgeDistance, back, backDistance, front, frontDistance: hit.distance });
  },
});

story('collision/distant-bugs-still-hit-walls', {
  about: 'Ground bugs outside the player collision shortlist still stop at walls, even on a large movement step.',
  setup,
  play() {
    const { world, origin, limit } = room({ offset: 4 }), { enemies, player } = G();
    world.focus(player.position, 1, 0.1);
    const e = spawn('spider', origin, { still: true }); e.vel.set(2, 0, 0);
    enemies.moveGround(e, 0.5, false);
    return ok(e.pos.x <= limit - e.r + 0.0001 && e.pos.x > origin.x + 0.2, { x: e.pos.x, limit: limit - e.r, nearby: world.nearby.length });
  },
});

story('collision/flying-words-and-knockback-hit-walls', {
  about: 'Hovering, orbiting, darting and diving bugs obey walls during their real behaviour words; ordinary knockback cannot push a body through them either.',
  setup,
  play() {
    const { origin, limit } = room(), { enemies, player, run } = G(), results = {};
    for (const type of ['mosquito', 'housefly', 'dragonfly', 'ladybug', 'wasp']) {
      enemies.clear();
      const e = spawn(type, origin.clone().add(V(0.2, 0.2, 0))); e.shootT = 99;
      let inside = true;
      const target = origin.clone().add(V(0.9, 0, 0));
      for (let i = 0; i < 180; i++) {
        enemies.update(1 / 60, { position: target, height: run.cfg.height, radius: player.radius }, i / 60);
        inside &&= e.pos.x <= limit - e.r + 0.0001;
      }
      results[type] = inside;
    }
    enemies.clear(); const e = spawn('spider', origin.clone().add(V(0.2, 0, 0)), { still: true });
    bus.emit('knockback', { targetId: e.id, dir: V(1, 0, 0), force: 2 });
    results.knockback = e.pos.x <= limit - e.r + 0.0001;
    return ok(Object.values(results).every(Boolean), results);
  },
});

story('collision/crowd-separation-cannot-push-through-wall', {
  about: 'Overlapping bugs beside a wall separate into free space without displacing a body through the wall.',
  setup,
  play() {
    const { origin, limit } = room(), { enemies } = G(), bugs = [0.3, 0.34].map(x => spawn('spider', origin.clone().add(V(x, 0, 0)), { still: true }));
    step(120);
    return ok(bugs.every(e => e.pos.x <= limit - e.r + 0.0001) && bugs[1].pos.x - bugs[0].pos.x > 0.08,
      { x: bugs.map(e => e.pos.x), limit: limit - bugs[0].r, distance: bugs[1].pos.x - bugs[0].pos.x, alive: enemies.alive });
  },
});

story('collision/openings-and-vertical-clearance', {
  about: 'Bodies can move through real openings, but their full radius stops at a ceiling and their feet stop at the floor.',
  setup,
  play() {
    const { group, origin, box } = room({ wall: false }), { enemies } = G();
    box([0.004, 0.8, 0.8], [0.4, 0.4, -0.45]); box([0.004, 0.8, 0.8], [0.4, 0.4, 0.45]);
    box([1, 0.01, 1], [0, 0.5, 0]);
    stub(enemies, 'world', new World(group));
    const e = spawn('roach', origin, { still: true }); enemies.move(e, V(0.7, 0, 0));
    const doorway = e.pos.x > origin.x + 0.69;
    const fly = spawn('mosquito', origin.clone().add(V(0, 0.2, 0)), { still: true }); enemies.move(fly, V(0, 2, 0));
    const ceiling = fly.pos.y <= origin.y + 0.495 - fly.r + 0.0001;
    enemies.move(fly, V(0, -2, 0));
    return ok(doorway && ceiling && fly.pos.y >= origin.y + fly.r - 0.0001,
      { doorway, ceiling, floor: fly.pos.y, expectedFloor: origin.y + fly.r });
  },
});

story('collision/moving-collider-bounds-refresh', {
  about: 'New colliders join body collision immediately; moving, rotating and scaling one refreshes its bounds, blocking its new location and clearing its old one.',
  setup,
  play() {
    const { world, box, origin } = room({ wall: false }), hit = { normal: V(), point: V() };
    const wall = box([0.02, 0.4, 0.3], [0.3, 0.2, 0]); world.addCollider(wall);
    const before = world.sweepSphere(origin.clone().add(V(0, 0.2, 0)), V(0.4, 0, 0), 0.02, hit);
    wall.position.x = 0.75; wall.rotation.y = 0.6; wall.scale.z = 0.5; wall.updateMatrixWorld(true);
    const newPosition = world.sweepSphere(origin.clone().add(V(0.6, 0.2, 0)), V(0.4, 0, 0), 0.02, hit);
    const oldPosition = world.sweepSphere(origin.clone().add(V(0, 0.2, 0)), V(0.4, 0, 0), 0.02, hit);
    return ok(before && newPosition && !oldPosition, { before, newPosition, oldPosition });
  },
});

story('collision/blocked-root-lands-on-scenery', {
  about: 'A falling root stopped on furniture impacts that surface and cannot hit or grab the jelly through it at the old floor target.',
  setup,
  play() {
    const { group, origin, box } = room({ wall: false }), { enemies } = G();
    box([0.6, 0.02, 0.6], [0, 0.25, 0]); stub(enemies, 'world', new World(group));
    const damage = record('damage_taken'), root = spawn('root', origin);
    step(75);
    return ok(root.pos.y >= origin.y + 0.26 - 0.0001 && root.state !== 'hold' && !root.landedOn && !damage.some(d => d.source === 'root'),
      { y: root.pos.y, surface: origin.y + 0.26, state: root.state, landedOn: root.landedOn, damage: damage.length });
  },
});

phone('spider-wall-retreat', {
  about: 'On phone Low graphics, a retreating spider stays visible on the room side of its wall.',
  setup,
  play() {
    const { limit } = room(), { gfx, GAME } = G(), e = spawn('spider', near(0.25, 0)); e.shootT = 99;
    gfx.setTier('low'); step(180); GAME.render();
    return ok(e.pos.x <= limit - e.r + 0.0001, { x: e.pos.x, limit: limit - e.r });
  },
});
