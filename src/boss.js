// The Clog: stage 1's boss, a hairball that rises out of the bathtub drain.
//  - rolls after you, faster the longer it chases
//  - sheds hair tangles that join the fight
//  - every so often the drain pulls everything toward it; standing on the drain hurts
import * as THREE from 'three';

export class Clog {
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

    const root = new THREE.Group();
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
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe28a, emissiveIntensity: 0.8 });
    const eyeB = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), eyeW);
      e.position.set(s * 0.32, 0.25, 0.86);
      root.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeB);
      p.position.set(s * 0.32, 0.22, 1.02);
      root.add(p);
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
    scene.add(this.swirl);
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
  update(dt, player) {
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
    this.body.rotation.x += this.vel.length() * dt / this.r * 0.5;

    if (dist < this.r + 0.012) out.contact = true;

    // shed hair tangles
    this.shedT -= dt;
    if (this.shedT <= 0) {
      this.shedT = enraged ? 4.5 : 6.5;
      const n = enraged ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const p = this.holder.position.clone().add(new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(this.r + 0.02));
        this.enemies.spawn('hair', p);
      }
      this.fx.puff(this.center(), 0x5a4030, 0.05, 0.4);
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
  }
}
