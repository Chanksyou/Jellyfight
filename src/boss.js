// A stage boss that rises out of a spot on the floor (arena.drain) and fights in the arena.
//  - rolls after you, faster once it's hurt
//  - sheds minions that join the fight
//  - every so often it pulls everything toward the spot it rose from; standing there hurts
// arena.kind picks the look: 'hair' (The Clog, a hairball from the bathtub drain) or
// 'dust' (The Dust King, a giant crowned dust bunny from a dust pile, shedding dust bunnies).
import * as THREE from 'three';
import { angryEyes, fuzzGeometry } from './enemies.js';
import { bus, PLAYER } from './events.js';

export class Boss {
  constructor(scene, enemies, fx, arena) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = fx;
    this.arena = arena;
    this.drain = new THREE.Vector3(...arena.drain);
    this.r = 0.06;
    this.maxHp = 520;
    this.hp = this.maxHp;
    this.dead = false;
    this.t = 0;
    this.shedT = 5;
    this.pullT = 9;
    this.pulling = 0;
    this.rise = 0;
    this.vel = new THREE.Vector3();

    this.kind = arena.kind || 'hair';
    this.minion = this.kind === 'dust' ? 'bunny' : 'hair';
    this.dustColor = this.kind === 'dust' ? 0x9c958b : 0x5a4030;
    const root = new THREE.Group();
    if (this.kind === 'dust') {
      // a huge dust bunny wearing a bottle-cap crown
      this.r = 0.075;
      const fuzz = new THREE.Mesh(fuzzGeometry('bunny'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      fuzz.castShadow = true;
      fuzz.scale.setScalar(1.25);
      root.add(fuzz);
      const gold = new THREE.MeshStandardMaterial({ color: 0xe8b83a, metalness: 0.85, roughness: 0.3, emissive: 0x3a2a00 });
      const crown = new THREE.Group();
      crown.position.y = 1.0;
      crown.rotation.z = 0.15;
      root.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.2, 24, 1, true), gold);
      band.material.side = THREE.DoubleSide;
      crown.add(band);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), gold);
        p.position.set(Math.sin(a) * 0.43, 0.2, Math.cos(a) * 0.43);
        crown.add(p);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: [0xd8344a, 0x3a8ad8, 0x3ad88a][k % 3], emissive: [0x5a0a14, 0x0a2a5a, 0x0a5a2a][k % 3], roughness: 0.2 }));
        gem.position.set(Math.sin(a) * 0.46, 0.05, Math.cos(a) * 0.46);
        crown.add(gem);
      }
      root.add(angryEyes({ y: 0.3, z: 1.05, size: 0.26, gap: 0.36, glow: true }));
    } else {
      const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3b2a20').convertSRGBToLinear(), roughness: 1 });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hairMat);
      body.castShadow = true;
      root.add(body);
      // strands sticking out
      const strand = new THREE.TorusKnotGeometry(0.35, 0.05, 40, 5, 2, 3);
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(strand, hairMat);
        const d = new THREE.Vector3().randomDirection();
        m.position.copy(d.multiplyScalar(0.85));
        m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        m.scale.setScalar(0.6 + Math.random() * 0.5);
        root.add(m);
      }
      // glowing, angry: the one thing you can see through the hair
      root.add(angryEyes({ y: 0.25, z: 0.9, size: 0.24, gap: 0.34, glow: true }));
    }
    this.body = root;
    this.holder = new THREE.Group();
    this.holder.add(root);
    this.holder.position.copy(this.drain);
    root.scale.setScalar(0.001);
    scene.add(this.holder);

    // swirl ring on the drain, visible while it pulls
    this.swirl = new THREE.Mesh(
      new THREE.RingGeometry(0.01, 0.06, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.swirl.position.copy(this.drain).setY(this.drain.y + 0.002);
    if (this.kind === 'dust') this.swirl.material.color.setHex(0xcfc6b8);
    scene.add(this.swirl);
    // the dust pile it rises from
    if (this.kind === 'dust') {
      this.pile = new THREE.Mesh(fuzzGeometry('lint'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, color: 0xb8b0a4 }));
      this.pile.scale.set(0.08, 0.02, 0.08);
      this.pile.position.copy(this.drain);
      scene.add(this.pile);
    }
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position).setY(this.holder.position.y + this.r); }

  damage(amount, color = '#fff') {
    if (this.dead || this.rise < 1) return;
    this.hp -= amount;
    this.fx.number(this.center(), Math.round(amount), color, 16);
    this.hitPop = 1;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  // Returns { push: Vector3 (drain pull on the player), hurt: damage to the player this frame }
  // What it does to you goes out as events; the pull on the player comes back as `push`
  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hurt, source: 'boss', drain: true });
    if (out.contact) bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'boss' });
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
    bus.emit('boss_health', { name: this.arena.name, hp: this.hp, maxHp: this.maxHp });
    return { push: out.push };
  }

  tick(dt, player) {
    this.t += dt;
    const out = { push: null, hurt: 0, contact: false };
    if (this.dead) {
      this.holder.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
      return out;
    }
    // rise out of the drain
    if (this.rise < 1) {
      this.rise = Math.min(1, this.rise + dt * 0.7);
      this.body.scale.setScalar(this.r * this.rise);
      this.holder.position.y = this.drain.y + this.r * (this.rise - 1) * 0.5;
      return out;
    }
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 6);
    this.body.scale.setScalar(this.r * (1 + this.hitPop * 0.08));
    const enraged = this.hp < this.maxHp * 0.4;

    // roll toward the player
    const to = player.position.clone().sub(this.holder.position).setY(0);
    const dist = to.length();
    to.normalize();
    const speed = (this.pulling > 0 ? 0.03 : enraged ? 0.14 : 0.1);
    this.vel.lerp(to.multiplyScalar(speed), 1 - Math.exp(-1.5 * dt));
    this.holder.position.add(this.vel.clone().multiplyScalar(dt));
    const a = this.arena;
    this.holder.position.x = THREE.MathUtils.clamp(this.holder.position.x, a.arenaMin[0] + this.r, a.arenaMax[0] - this.r);
    this.holder.position.z = THREE.MathUtils.clamp(this.holder.position.z, a.arenaMin[2] + this.r, a.arenaMax[2] - this.r);
    this.holder.position.y = this.drain.y;
    this.body.rotation.y = Math.atan2(to.x, to.z);
    if (this.kind === 'dust') this.body.position.y = Math.abs(Math.sin(this.t * 5)) * this.r * 0.25;   // hops along, crown up
    else this.body.rotation.x += this.vel.length() * dt / this.r * 0.5;

    if (dist < this.r + 0.012) out.contact = true;

    // shed hair tangles
    this.shedT -= dt;
    if (this.shedT <= 0) {
      this.shedT = enraged ? 4.5 : 6.5;
      const n = enraged ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const p = this.holder.position.clone().add(new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(this.r + 0.02));
        this.enemies.spawn(this.minion, p);
      }
      this.fx.puff(this.center(), this.dustColor, 0.05, 0.4);
    }

    // drain pull
    this.pullT -= dt;
    if (this.pullT <= 0 && this.pulling <= 0) { this.pulling = 3; this.pullT = enraged ? 8 : 11; }
    if (this.pulling > 0) {
      this.pulling -= dt;
      const toDrain = this.drain.clone().sub(player.position).setY(0);
      const dd = toDrain.length();
      out.push = toDrain.normalize().multiplyScalar(0.2 * Math.min(1, dd * 6 + 0.3));
      if (dd < 0.045) out.hurt = 2 * dt;
      this.swirl.rotation.y += dt * 6;
      this.swirl.material.opacity = 0.45;
    } else {
      this.swirl.material.opacity = Math.max(0, this.swirl.material.opacity - dt);
    }
    return out;
  }

  dispose() {
    this.scene.remove(this.holder);
    this.scene.remove(this.swirl);
    if (this.pile) this.scene.remove(this.pile);
  }
}
