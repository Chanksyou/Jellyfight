// The treasure effects that act on their own: timed effects (an `every N { … }` block of ring,
// zap, brick, marble, pull-dew) and always-on ones (orbit-lights, beam, aura). Which ones run,
// and their numbers, come from the run's combined treasure effects (mods; see words.js and
// content/treasures.kdl): nothing here knows a treasure by name.
import * as THREE from 'three';
import { bus } from './events.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Gadgets {
  constructor(scene, enemies, fx, world) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = fx;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'Gadgets';
    scene.add(this.group);

    const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });
    // Fairy Lights: three warm bulbs that circle you
    this.bulbs = [0xffd27a, 0xff9ad8, 0x9fe2ff, 0xffd27a, 0xff9ad8, 0x9fe2ff].map((c) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), glow(c, 2.4));
      m.visible = false;
      this.group.add(m);
      return m;
    });
    // Magnifying Glass: a beam of focused moonlight on its target
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.012, 0.5, 12, 1, true).translate(0, 0.25, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.beam.visible = false;
    this.group.add(this.beam);
    // Glow Stick: a green glow on the floor around you
    this.aura = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x6aff8a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.visible = false;
    this.group.add(this.aura);
    // Lego bricks and marbles
    this.brickGeo = new THREE.BoxGeometry(0.02, 0.012, 0.01).translate(0, 0.006, 0);
    this.studGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.003, 10).translate(0, 0.0135, 0);
    this.brickMats = [0xd8342a, 0x2a6ad8, 0xf2c81a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
    this.marbleMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, clearcoat: 1, emissive: 0x1a3a5a, emissiveIntensity: 0.5 });
    this.marbleGeo = new THREE.SphereGeometry(0.007, 16, 12);
    // Remote Control zaps
    this.zapMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true });
    this.reset();
  }

  reset() {
    this.t = {};
    for (const b of this.bricks || []) this.group.remove(b.m);
    for (const m of this.marbles || []) this.group.remove(m.m);
    for (const z of this.zaps || []) this.group.remove(z.line);
    this.bricks = [];
    this.marbles = [];
    this.zaps = [];
    this.orbit = 0;
    this.bulbs.forEach((b) => { b.visible = false; });
    this.beam.visible = this.aura.visible = false;
  }

  // Show everything for a frame so its shaders get compiled up front (main.js warmUp)
  warm(on, at) {
    this.bulbs.forEach((b) => { b.visible = on; });
    this.beam.visible = this.aura.visible = on;
    if (on) {
      this.bulbs.forEach((b) => b.position.copy(at));
      this.beam.position.copy(at);
      this.aura.position.copy(at);
      this._warm = [this.brickMats.map((m) => new THREE.Mesh(this.brickGeo, m)), new THREE.Mesh(this.marbleGeo, this.marbleMat),
        new THREE.Line(new THREE.BufferGeometry().setFromPoints([at, at.clone().add(UP)]), this.zapMat)].flat();
      this._warm.forEach((m) => { m.position.copy(at); this.group.add(m); });
    } else {
      (this._warm || []).forEach((m) => this.group.remove(m));
    }
  }

  every(id, dt, period, first = period * 0.6) {
    this.t[id] = (this.t[id] ?? first) - dt;
    if (this.t[id] > 0) return false;
    this.t[id] += period;
    return true;
  }

  near(center, radius, { proxies = true } = {}) {
    const E = this.enemies, out = [], c = new THREE.Vector3();
    for (const e of E.list) {
      if (e.dead || (!proxies && e.proxy)) continue;
      const d = E.center(e, c).distanceTo(center) - e.r;
      if (d <= radius) out.push([d, e]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  // ctx: { mods, feet: Vector3, center: Vector3, facing, sting (your power), pullDew() }
  update(dt, ctx) {
    const { mods: M, feet, center, sting } = ctx;
    const E = this.enemies, fx = this.fx;

    // timed effects: every N s, do what's in the block
    for (const T of M.timed) if (this.every(T.key, dt, T.every, T.first)) for (const ef of T.effects) this.fire(ef, ctx);
    for (const z of this.zaps) { z.t -= dt; if (z.t <= 0) { this.group.remove(z.line); z.line.geometry.dispose(); } }
    this.zaps = this.zaps.filter((z) => z.t > 0);

    // orbit-lights: bulbs circle you and sting whatever they brush
    const O = M.orbit, n = O ? Math.min(O.count, this.bulbs.length) : 0;
    this.orbit += dt * 3.2;
    this.bulbs.forEach((b, i) => {
      b.visible = i < n;
      if (i >= n) return;
      const a = this.orbit + (i / n) * Math.PI * 2;
      b.position.set(center.x + Math.cos(a) * O.radius, center.y + Math.sin(this.orbit * 2 + i) * 0.006, center.z + Math.sin(a) * O.radius);
      for (const e of this.near(b.position, 0.008)) {
        if ((e.fairyT || 0) > 0) continue;
        e.fairyT = 0.4;
        bus.emit('damage_taken', { targetId: e.id, amount: sting * O.dmg, color: '#ffe7a8', source: 'orbit-lights' });
      }
    });
    if (n) for (const e of E.list) if (e.fairyT > 0) e.fairyT -= dt;

    // beam: focused moonlight burns the nearest enemy
    this.beam.visible = false;
    const Bm = M.beam;
    if (Bm) {
      const e = this.near(center, Bm.range)[0];
      if (e) {
        const c = E.center(e);
        this.beam.visible = true;
        this.beam.position.copy(c).setY(c.y - e.r * 0.5);
        this.beam.material.opacity = 0.25 + Math.random() * 0.15;
        if (this.every('beam', dt, Bm.tick)) { bus.emit('damage_taken', { targetId: e.id, amount: sting * Bm.dmg, color: '#ffd27a', source: 'beam' }); if (Math.random() < 0.4) fx.puff(c, 0x8a8078, 0.006, 0.4); }
      }
    }

    // aura: a soft glow around you that stings anything inside it
    const A = M.aura;
    this.aura.visible = !!A;
    if (A) {
      this.aura.position.copy(feet).setY(feet.y + 0.002);
      this.aura.scale.setScalar(A.radius * (1 + Math.sin(this.orbit * 2) * 0.05));
      if (this.every('aura', dt, A.tick)) for (const e of this.near(center, A.radius)) bus.emit('damage_taken', { targetId: e.id, amount: sting * A.dmg, color: '#8aff9f', source: 'aura' });
    }

    // bricks on the floor: the first walking enemy to step on one takes the hit
    for (const b of this.bricks) {
      b.t -= dt;
      const hit = this.near(b.m.position, 0.012, { proxies: false }).find((e) => !e.T.fly);
      if (hit) { bus.emit('damage_taken', { targetId: hit.id, amount: sting * b.dmg, color: '#ff8a6a', source: 'brick' }); fx.puff(b.m.position, 0xd8342a, 0.02, 0.3); b.t = 0; }
      if (b.t <= 0) this.group.remove(b.m);
    }
    this.bricks = this.bricks.filter((b) => b.t > 0);

    // marbles rolling: bounce off walls, bowl through enemies
    for (const mb of this.marbles) {
      mb.t -= dt;
      const step = mb.speed * dt;
      const wall = this.world.cast(mb.m.position, mb.dir, step + 0.007);
      if (wall) { const nrm = wall.normal.clone().setY(0).normalize(); mb.dir.addScaledVector(nrm, -2 * mb.dir.dot(nrm)).normalize(); }
      mb.m.position.addScaledVector(mb.dir, step);
      mb.m.rotateOnAxis(new THREE.Vector3(mb.dir.z, 0, -mb.dir.x), step / 0.007);
      for (const e of this.near(mb.m.position, 0.008)) {
        if (mb.hit.has(e)) continue;
        mb.hit.add(e);
        bus.emit('damage_taken', { targetId: e.id, amount: sting * mb.dmg, color: '#9fd8ff', source: 'marble' });
      }
      if (mb.t <= 0) this.group.remove(mb.m);
    }
    this.marbles = this.marbles.filter((mb) => mb.t > 0);
  }

  // one timed effect going off (TIMED_WORDS in words.js)
  fire(ef, ctx) {
    const { feet, center, sting } = ctx;
    const E = this.enemies, fx = this.fx;
    if (ef.kind === 'ring') {
      const col = new THREE.Color(ef.color);
      if (ef.look === 'puff') fx.puff(feet.clone().setY(feet.y + 0.01), col.getHex(), ef.radius, 0.35);
      else fx.ring(feet.clone().setY(feet.y + 0.004), col.getHex(), ef.radius, ef.show);
      for (const e of this.near(center, ef.radius, { proxies: ef.elites })) {
        if (ef.dmg) bus.emit('damage_taken', { targetId: e.id, amount: sting * ef.dmg, color: ef.color, source: 'ring' });
        if (ef.push) bus.emit('knockback', { targetId: e.id, dir: e.pos.clone().sub(feet).setY(0).normalize(), force: ef.push });
        if (ef.freeze) bus.emit('status_applied', { targetId: e.id, status: 'freeze', duration: ef.freeze });
      }
    } else if (ef.kind === 'zap') {
      for (const e of this.near(center, ef.range).slice(0, ef.count)) {
        const to = E.center(e), pts = [center.clone()];
        for (let k = 1; k < 6; k++) pts.push(center.clone().lerp(to, k / 6).add(new THREE.Vector3().randomDirection().multiplyScalar(0.008)));
        pts.push(to);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.zapMat);
        this.group.add(line);
        this.zaps.push({ line, t: 0.25 });
        bus.emit('damage_taken', { targetId: e.id, amount: sting * ef.dmg, color: '#9fd8ff', source: 'zap' });
      }
    } else if (ef.kind === 'brick') {
      const g = new THREE.Group(), mat = this.brickMats[(Math.random() * 3) | 0];
      g.add(new THREE.Mesh(this.brickGeo, mat));
      for (const x of [-0.005, 0.005]) { const st = new THREE.Mesh(this.studGeo, mat); st.position.x = x; g.add(st); }
      g.position.copy(feet);
      g.rotation.y = Math.random() * Math.PI;
      this.group.add(g);
      this.bricks.push({ m: g, t: ef.last, dmg: ef.dmg });
      while (this.bricks.length > ef.most) this.group.remove(this.bricks.shift().m);
    } else if (ef.kind === 'marble') {
      const m = new THREE.Mesh(this.marbleGeo, this.marbleMat);
      m.position.copy(feet).setY(feet.y + 0.007);
      this.group.add(m);
      this.marbles.push({ m, dir: new THREE.Vector3(Math.sin(ctx.facing), 0, Math.cos(ctx.facing)), t: ef.life, speed: ef.speed, dmg: ef.dmg, hit: new Set() });
    } else if (ef.kind === 'pull-dew') {
      ctx.pullDew?.();
    }
  }
}
