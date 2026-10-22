import * as THREE from 'three';
import { bus } from '../events.js';
import { sfx } from '../sfx.js';
import { BASE_STATS, knockFor } from '../stats.js';
import { G, V, give, offs, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

function setup() { setupFight({ bubbles: false, lash: false }); give('paperFan'); roachAt(0, -0.18); step(2); }
function blade() {
  const { run, player, enemies } = G(), B = run.bubbles;
  return B.blow(player.position.clone().add(V(0, 0.06, 0)), enemies.list[0], { size: 1, dmg: run.S.bubbleDamage * run.mods.element.wind.dmg, tint: 'wind', elems: ['wind'], ep: run.mods.element.wind, pierce: 2, dir: V(0, 0, -1) });
}
// A real mesh/ray intersection isolates scenery from the apartment and other enemies.
function wall(e, side = false) {
  const { enemies } = G(), scene = enemies.scene;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.02), new THREE.MeshBasicMaterial({ color: 0x657380 }));
  mesh.position.copy(e.pos).add(V(0, 0.075, -e.r - 0.022));
  if (side) { mesh.rotation.y = Math.PI / 4; }
  mesh.updateMatrixWorld(true); scene.add(mesh);
  offs.push(() => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
  const ray = new THREE.Raycaster();
  stub(enemies.world, 'cast', (origin, dir, far) => {
    ray.set(origin, dir); ray.far = far;
    const hit = ray.intersectObject(mesh)[0];
    return hit ? { distance: hit.distance, point: hit.point, normal: hit.face.normal.clone().transformDirection(mesh.matrixWorld) } : null;
  });
  return mesh;
}

story('attack/wind-scenery-collision', {
  about: 'Wind pushes stop at scenery and deal one extra hit equal to the wind hit; a collision can kill and grants one kill reward.',
  setup,
  play() {
    const { run, enemies } = G(), e = enemies.list[0], B = run.bubbles, b = blade(), start = e.pos.clone();
    wall(e);
    e.hp = b.dmg * 1.5;
    const kills = record('enemy_killed'), damage = record('damage_taken');
    B.strike(b, e, run.mods);
    const hits = damage.filter(d => d.targetId === e.id), collision = hits.filter(d => d.source === 'wind-collision');
    const travelled = start.distanceTo(e.pos);
    return ok(hits.length === 2 && collision.length === 1 && collision[0].amount === b.dmg && e.dead && kills.filter(k => k.targetId === e.id).length === 1 && travelled > 0 && travelled < 0.014,
      { amounts: hits.map(h => h.amount), collisionHits: collision.length, dead: e.dead, travelled });
  },
});

story('attack/wind-doubled-base-push', {
  about: 'Wind uses a 0.6 base push multiplier (4.2 cm), adds its original damage-based shove, and Box Fan multiplies only the base by 1.6.',
  setup,
  play() {
    const { run, enemies } = G(), e = enemies.list[0], knocks = record('knockback');
    stub(enemies.world, 'cast', () => null);
    const base = blade(), push = run.mods.element.wind.push;
    run.bubbles.strike(base, e, run.mods);
    give('boxFan'); const upgraded = blade(); run.bubbles.strike(upgraded, e, run.mods);
    const forces = knocks.filter(k => k.targetId === e.id).map(k => k.force);
    const expected = [0.042 + knockFor(base.dmg), 0.042 * 1.6 + knockFor(upgraded.dmg)];
    return ok(push === 0.6 && forces.length === 2 && forces.every((f, i) => Math.abs(f - expected[i]) < 1e-9), { push, forces, expected });
  },
});

story('attack/wind-enemies-are-not-scenery', {
  about: 'Pushing a wind target into another enemy never produces collision damage or damages that enemy.',
  setup,
  play() {
    const { run, enemies } = G(), e = enemies.list[0];
    const other = roachAt(0, -0.22), health = other.hp;
    stub(enemies.world, 'cast', () => null);
    const damage = record('damage_taken');
    run.bubbles.strike(blade(), e, run.mods);
    return ok(!damage.some(d => d.source === 'wind-collision') && other.hp === health, { collisionHits: damage.filter(d => d.source === 'wind-collision').length, otherHealth: other.hp });
  },
});

story('attack/wind-floor-and-rooted', {
  about: 'A horizontal wind shove does not count floor contact or a push-immune rooted target as a wall slam.',
  setup,
  play() {
    const { run, enemies } = G(), e = enemies.list[0], b = blade();
    stub(enemies.world, 'cast', (origin, dir) => ({ distance: 0.01, point: origin.clone().addScaledVector(dir, 0.01), normal: V(0, 1, 0) }));
    const damage = record('damage_taken');
    run.bubbles.strike(b, e, run.mods);
    wall(e); stub(e, 'T', { ...e.T, rooted: true });
    const position = e.pos.clone();
    run.bubbles.strike(blade(), e, run.mods);
    return ok(!damage.some(d => d.source === 'wind-collision') && e.pos.equals(position), { collisions: damage.filter(d => d.source === 'wind-collision').length, rootedMoved: !e.pos.equals(position) });
  },
});

story('attack/wind-windup-and-rate', {
  about: 'Wind winds up visibly before release, repeats at half the bubble rate, scales with attack speed, and cancels cleanly on pause/reset.',
  setup() { setupFight({ lash: false }); give('paperFan'); roachAt(0, -0.18); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, P = run.mods.element.wind, origin = player.position.clone().add(V(0, 0.06, 0));
    stub(B, 'volley', () => true); stub(B, 'elementVolley', () => true); stub(B, 'fly', () => {}); stub(B, 'effects', () => {});
    stub(B, 'inRange', () => [enemies.list[0]]);
    let stops = 0, gathers = 0;
    stub(sfx, 'windCharge', () => () => { stops++; }); stub(sfx, 'windLaunch', () => {});
    stub(B.looks, 'windGather', () => { gathers++; }); stub(B.looks, 'windRelease', () => {});
    const intervals = [];
    for (const speed of [1, 4]) {
      B.reset(); B.elTimers.wind = 0;
      let t = 0; const releases = [];
      stub(B, 'onWindRelease', () => releases.push(t));
      for (let i = 0; i < 600; i++) { t += 1 / 60; B.update(1 / 60, origin, { ...run.S, fireRate: BASE_STATS.fireRate * speed }, run.mods); }
      const expected = 1 / (P.rate * speed);
      intervals.push(releases.length >= 4 && releases.slice(1).every((v, i) => Math.abs(v - releases[i] - expected) < 0.035));
    }
    B.reset(); B.elTimers.wind = 1; B.update(0.01, origin, run.S, run.mods);
    const charging = !!B.windCharge;
    B.silenceAttacks(); const cancelled = !B.windCharge;
    return ok(P.rate === BASE_STATS.fireRate * 0.5 && intervals.every(Boolean) && gathers > 0 && stops > 0 && charging && cancelled,
      { rate: P.rate, intervals, gathers, stops, charging, cancelled });
  },
});

story('attack/ice-shatter-feel', {
  about: 'Ice lands like ice: a shard that hits throws real crystal shards that skip off the floor and melt away, and a frost flower spreads where it struck and fades; the chilled bug wears a crown of ice spikes exactly while the chill lasts; a bug that dies chilled shatters into ice (shards and a frost flower, its shatter sound, no body left), and everything is gone again within about 2.5 s. Its looks were prepared at load: no new shader mid-fight.',
  setup() { setupFight({ bubbles: false, lash: false }); give('freezerPack'); roachAt(0, -0.18); roachAt(0.2, -0.2); step(2); },
  play() {
    const { run, player, enemies, fx, APT } = G(), B = run.bubbles, [e, other] = enemies.list, P = run.mods.element.ice;
    const programs = APT.renderer.info.programs.length;
    let shatters = 0; const ice = sfx.iceShatter; sfx.iceShatter = function (...a) { shatters++; return ice.apply(this, a); };
    try {
      // a shard that hits
      const b = B.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 0.1, tint: 'ice', elems: ['ice'], ep: P, pierce: 1 });
      for (let i = 0; i < 90 && B.list.length; i++) { B.fly(1 / 60, run.S, run.mods); B.effects(1 / 60, run.S); }
      step(1);
      const hit = fx.ice.live, crowned = !!e.iceCrown?.visible && e.chillT > 0;
      // the chill wears off: the crown goes with it
      step(Math.ceil(60 * ((e.chillT || 0) + 0.1)));
      const thawed = !e.iceCrown?.visible && !(e.chillT > 0);
      step(60 * 2.5);
      const melted = fx.ice.live === 0;
      // a bug that dies chilled shatters
      const bodies = fx.deaths.list.length;
      bus.emit('status_applied', { targetId: other.id, status: 'chill', duration: 2 });
      step(1);
      enemies.kill(other);
      step(1);
      const shattered = other.dead && shatters === 1 && fx.ice.live > 10 && fx.deaths.list.length === bodies;
      step(60 * 2.5);
      const gone = fx.ice.live === 0;
      APT.renderer.compile(APT.scene, APT.camera);
      const shaders = APT.renderer.info.programs.length - programs;
      return ok(hit >= 6 && crowned && thawed && melted && shattered && gone && shaders === 0, { hit, crowned, thawed, melted, shattered, shatters, gone, shaders });
    } finally { sfx.iceShatter = ice; }
  },
});

story('attack/ice-slow-and-followup-upgrade', {
  about: 'Freezer Pack and Snow Globe only slow; Freezer Burn doubles a follow-up shard against an already slowed enemy.',
  setup() { setupFight({ bubbles: false, lash: false }); give('freezerPack', 'freezerBurn', 'snowGlobe'); roachAt(0, -0.18); roachAt(0.01, -0.18); step(2); },
  play() {
    const { run, player, enemies } = G(), B = run.bubbles, e = enemies.list[0], other = enemies.list[1], P = run.mods.element.ice;
    const b = B.blow(player.position.clone().add(V(0, 0.06, 0)), e, { size: 1, dmg: 5, tint: 'ice', elems: ['ice'], ep: P, pierce: 2 });
    const damage = record('damage_taken');
    B.strike(b, e, run.mods); B.strike(b, e, run.mods);
    other.pos.copy(e.pos).add(V(0.03, 0, 0));
    b.m.position.copy(enemies.center(e)); b.hit.add(e); B.splash(b);
    const hits = damage.filter(d => d.targetId === e.id && d.source === 'bubble');
    return ok(hits[0].amount === 5 && hits[1].amount === 10 && e.slowT > 0 && other.slowT > 0 && !e.freezeT && !other.freezeT,
      { hits: hits.map(h => h.amount), slow: e.slowT, splashSlow: other.slowT, frozen: !!e.freezeT || !!other.freezeT });
  },
});
