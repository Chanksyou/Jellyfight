// The Vacuum: stage 1's boss, a robot vacuum that powers on in front of the kitchen.
// It chases you and bumps you back, and between chases it cycles through attacks:
//   charge    the ring light flashes red and a strip on the floor shows its line, then it rams
//   suction   it pulls you in toward itself; caught close, it hurts
//   brushes   the side brushes whirr up, then two sweeping rings hit everything close
//   dump      it stops and drops cockroaches out of its dust bin
//   spin      (below 45% health) it spins in place, spraying dust clumps all around
//   flies     its light flashes purple, then it launches 4 lanternflies out of the bin in high
//             arcs (a ring marks each landing) and raises a shield: it can't be hurt until all
//             4 are dead (a purple dome, with a tether to each fly; it gives up after 30 s)
// Below 45% health it's angry: an orange light, faster driving, shorter pauses.
// Same interface as Boss (boss.js): position, r, center(), damage(), dead, update() -> {push, hurt, hit}.
import * as THREE from 'three';
import { angryEyes, standOut } from './enemies.js';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { hostile, TeleMaterial } from './vfx.js';
import { sfx } from './sfx.js';

const UP = new THREE.Vector3(0, 1, 0);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...o });

export class Vacuum {
  constructor(scene, enemies, fx, arena, world) {
    Object.assign(this, { scene, enemies, fx, arena, world });
    this.r = 0.17;
    this.h = 0.08;
    this.maxHp = this.hp = 1400;
    this.dead = false;
    this.t = 0;
    this.rise = 0;
    this.state = 'chase';
    this.stateT = 3;
    this.next = 0;
    this.heading = 0;
    this.knock = 0;
    this.knockDir = new THREE.Vector3();
    this.shots = [];
    this.guards = [];         // the lanternflies holding up its shield
    this.shieldT = 0;

    const root = new THREE.Group();
    const shell = std(0x2a2c31, { roughness: 0.25, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(this.r, this.r * 0.98, 0.07, 64), shell);
    body.position.y = 0.04;
    root.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(this.r * 0.9, this.r * 0.95, 0.012, 64), std(0x3b3f47, { roughness: 0.12, metalness: 0.4 }));
    lid.position.y = 0.081;
    root.add(lid);
    // bumper across the front
    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(this.r * 1.02, this.r * 1.02, 0.05, 48, 1, true, -Math.PI * 0.45, Math.PI * 0.9), std(0x111114, { roughness: 0.7, side: THREE.DoubleSide }));
    bumper.position.y = 0.035;
    root.add(bumper);
    // ring light: blue while it drives, red when it's about to charge, orange when angry
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x4ab8ff, emissive: 0x4ab8ff, emissiveIntensity: 2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(this.r * 0.62, 0.004, 8, 64), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.088;
    root.add(ring);
    // lidar turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.022, 24), std(0x16171a, { roughness: 0.3 }));
    turret.position.set(0, 0.098, -0.07);
    root.add(turret);
    this.lidar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.01), std(0x2a2c31));
    this.lidar.position.set(0, 0.111, -0.07);
    root.add(this.lidar);
    // dust bin at the back
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), std(0x4a4d55, { roughness: 0.2, transparent: true, opacity: 0.8 }));
    bin.position.set(0, 0.04, -this.r * 0.95);
    root.add(bin);
    // side brushes: spin slowly while driving, fast before a sweep
    this.brushes = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * this.r * 0.7, 0.006, this.r * 0.62);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.006, 12), std(0x16171a));
      g.add(hub);
      for (let k = 0; k < 3; k++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.07).translate(0, 0, 0.035), std(0x6a6d75, { roughness: 0.8 }));
        arm.rotation.y = (k / 3) * Math.PI * 2;
        arm.rotation.x = 0.12;
        g.add(arm);
      }
      root.add(g);
      return g;
    });
    // angry glowing eyes, like status LEDs gone wrong, on the front of the lid
    const face = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42, glow: true });
    face.scale.setScalar(0.07);
    face.position.set(0, 0.092, this.r * 0.55);
    face.rotation.x = -1.0;
    root.add(face);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    standOut(root, { base: LOOK.num('boss-glow', 0.15), rim: LOOK.num('boss-rim', 0.6) });     // readable in the dark room

    this.body = root;
    this.holder = new THREE.Group();
    this.holder.add(root);
    this.holder.position.set(...arena.drain);
    root.scale.setScalar(0.001);
    scene.add(this.holder);

    // floor telegraphs: the charge line, the suction swirl, the sweep reach
    // (vfx.js warnings in the boss's hostile colour: the charge is a strip, the suction a disc with
    // stripes pouring into the middle)
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new TeleMaterial(hostile('vacuum'), 'strip'));
    this.line.material.opacity = 0;
    this.line.renderOrder = 3;
    scene.add(this.line);
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new TeleMaterial(hostile('vacuum'), 'circle'));
    this.swirl.material.opacity = 0;
    this.swirl.renderOrder = 3;
    scene.add(this.swirl);
    // the shield: a glowing dome, and a tether from it to each lanternfly keeping it up
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({
      color: hostile('vacuum'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.dome.renderOrder = 4;
    this.dome.visible = false;
    scene.add(this.dome);
    this.tethers = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3)),
      new THREE.LineBasicMaterial({ color: hostile('vacuum'), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.tethers.frustumCulled = false;
    this.tethers.visible = false;
    scene.add(this.tethers);
    this.shotGeo = new THREE.IcosahedronGeometry(0.008, 1);
    this.shotMat = std(0x8a8278, { roughness: 1 });
  }

  get position() { return this.holder.position; }
  center(out = new THREE.Vector3()) { return out.copy(this.holder.position).setY(this.holder.position.y + 0.045); }

  // up while any of the lanternflies it launched is alive
  get shielded() { return this.guards.length > 0; }

  damage(amount, color = '#fff') {
    if (this.dead || this.rise < 1) return;
    if (this.shielded) {             // bounces off: a flash on the dome
      this.domeFlash = 1;
      sfx.shieldHit();
      return;
    }
    this.hp -= amount;
    this.hitPop = 1;
    this.fx.number(this.center().setY(this.holder.position.y + 0.12), Math.round(amount), color, 16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  get angry() { return this.hp < this.maxHp * 0.45; }

  // drive forward along the heading, turning toward `target` at most `turn` rad/s
  drive(dt, target, speed, turn) {
    const p = this.holder.position;
    if (target) {
      const want = Math.atan2(target.x - p.x, target.z - p.z);
      let d = want - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += THREE.MathUtils.clamp(d, -turn * dt, turn * dt);
    }
    p.x += Math.sin(this.heading) * speed * dt;
    p.z += Math.cos(this.heading) * speed * dt;
    const a = this.arena, x0 = a.arenaMin[0] + this.r, x1 = a.arenaMax[0] - this.r, z0 = a.arenaMin[2] + this.r, z1 = a.arenaMax[2] - this.r;
    const hitWall = p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1;
    p.x = THREE.MathUtils.clamp(p.x, x0, x1);
    p.z = THREE.MathUtils.clamp(p.z, z0, z1);
    this.body.rotation.y = this.heading;
    return hitWall;
  }

  setLight(hex, k = 2) { this.ringMat.color.setHex(hex); this.ringMat.emissive.setHex(hex); this.ringMat.emissiveIntensity = k; }

  // What it does to you goes out as events; the pull on the player comes back as `push`
  update(dt, player) {
    const out = this.tick(dt, player);
    if (out.hurt) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hurt, source: 'boss', drain: true });
    if (out.contact) bus.emit('damage_taken', { targetId: PLAYER, amount: 4, source: 'boss' });
    if (out.hit) bus.emit('damage_taken', { targetId: PLAYER, amount: out.hit, source: 'boss' });
    bus.emit('boss_health', { name: this.arena.name, hp: this.hp, maxHp: this.maxHp, shielded: this.shielded });
    return { push: out.push };
  }

  tick(dt, player) {
    this.t += dt;
    const out = { push: null, hurt: 0, hit: 0, contact: false };
    const p = this.holder.position, P = player.position;
    if (this.dead) {
      if (!this.deathSound) { this.deathSound = true; sfx.vacDeath(); }
      this.holder.scale.multiplyScalar(Math.max(0, 1 - dt * 2));
      this.line.material.opacity = this.swirl.material.opacity = 0;
      this.dome.visible = this.tethers.visible = false;
      if (Math.random() < dt * 20) this.fx.puff(this.center().add(new THREE.Vector3().randomDirection().multiplyScalar(0.1)), 0x6a6d75, 0.04, 0.5);
      return out;
    }
    // power on: grow in with a puff
    if (this.rise < 1) {
      if (this.rise === 0) sfx.vacPowerOn();
      this.rise = Math.min(1, this.rise + dt * 0.8);
      this.body.scale.setScalar(this.rise);
      this.heading = Math.atan2(P.x - p.x, P.z - p.z);
      this.body.rotation.y = this.heading;
      this.setLight(0x4ab8ff, 0.5 + this.rise * 1.5);
      return out;
    }
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 6);
    this.body.scale.setScalar(1 + this.hitPop * 0.03);
    this.lidar.rotation.y += dt * 8;
    const angry = this.angry, toP = P.clone().sub(p).setY(0), dist = toP.length();
    let brushSpin = 6;
    this.stateT -= dt;

    if (this.state === 'chase') {
      this.setLight(angry ? 0xff8a2a : 0x4ab8ff, 2);
      this.drive(dt, P, angry ? 0.195 : 0.15, angry ? 2.2 : 1.6);
      if (this.stateT <= 0) this.pick();
    } else if (this.state === 'charge') {
      // wind up (flashing red, a strip on the floor shows the line), then ram along it
      if (!this.locked) {
        this.drive(dt, P, 0, 3);
        this.setLight(0xff2a2a, Math.sin(this.t * 30) > 0 ? 3 : 0.6);
        this.line.position.copy(p).setY(p.y + 0.002);
        this.line.rotation.y = this.heading;
        this.line.scale.set(this.r * 1.6, 1, 0.9);
        this.chargeWind ??= Math.max(0.01, this.stateT);
        this.line.material.opacity = 0.8 + Math.sin(this.t * 30) * 0.2;
        this.line.material.progress = 1 - this.stateT / this.chargeWind;   // fills as the ram gets closer
        if (this.stateT <= 0) { this.locked = true; this.stateT = 1.3; this.line.material.opacity = 0; this.chargeWind = null; sfx.vacRam(); }
      } else {
        this.setLight(0xff2a2a, 3);
        const wall = this.drive(dt, null, angry ? 1.275 : 1.05, 0);
        if (Math.random() < dt * 25) this.fx.puff(p.clone().setY(0.01), 0xb8b0a4, 0.03, 0.35);
        if (wall || this.stateT <= 0) { sfx.vacImpact(wall); this.locked = false; this.fx.impact(p.clone().setY(0.02), hostile('vacuum'), this.r * 0.6, 18); this.toChase(); }
      }
    } else if (this.state === 'suction') {
      // pull you in toward it; too close and it hurts
      this.setLight(0x9fd8ff, 3);
      this.swirl.position.copy(p).setY(0.003);
      this.swirl.scale.setScalar(0.45 + this.r);
      this.swirl.material.opacity = 0.75;              // its stripes pour into the middle: you're being pulled in
      const pull = toP.clone().normalize().multiplyScalar(-(0.18 + (angry ? 0.06 : 0)) * THREE.MathUtils.clamp(1.4 - dist * 1.5, 0.3, 1.2));
      out.push = pull;
      if (dist < this.r + 0.04 && P.y < 0.1) out.hurt = 2 * dt;
      if (Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2, rr = this.r + 0.05 + Math.random() * 0.3;
        this.fx.puff(p.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.01, Math.sin(a) * rr)), 0xcfc6b8, 0.008, 0.25);
      }
      if (this.stateT <= 0) { this.swirl.material.opacity = 0; this.toChase(); }
    } else if (this.state === 'brushes') {
      // brushes whirr up (the warning), then two sweeps
      this.drive(dt, P, 0.045, 1);
      this.setLight(0xffe24a, 2.5);
      brushSpin = 60;
      const sweeps = [0.9, 0.35];
      for (const at of sweeps) {
        if (this.prevT > at && this.stateT <= at) {
          const reach = this.r + 0.1;
          this.fx.ring(p.clone().setY(0.004), hostile('vacuum'), reach, 0.4);
          sfx.vacSweep();
          if (dist < reach + 0.018 && P.y < 0.12) { out.hit = 3; this.knockBack(toP, 0.5); }
        }
      }
      if (this.stateT <= 0) this.toChase();
    } else if (this.state === 'dump') {
      // stop and drop cockroaches out of the bin
      this.setLight(0xa8ff6a, 2);
      if (this.prevT > 0.6 && this.stateT <= 0.6) {
        const back = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
        const n = angry ? 4 : 3;
        for (let k = 0; k < n; k++) {
          const q = p.clone().addScaledVector(back, this.r + 0.04).add(new THREE.Vector3((k - (n - 1) / 2) * 0.05, 0, 0));
          this.enemies.spawn('roach', q, 1.3);
        }
        this.fx.puff(p.clone().addScaledVector(back, this.r + 0.02).setY(0.03), 0x9c958b, 0.06, 0.5);
        sfx.vacDump();
      }
      if (this.stateT <= 0) this.toChase();
    } else if (this.state === 'flies') {
      // the light flashes purple while it winds up, then 4 lanternflies spring out of the bin
      this.drive(dt, P, 0, 2);
      this.setLight(0xb04aff, Math.sin(this.t * 24) > 0 ? 3 : 0.8);
      if (this.prevT > 0.4 && this.stateT <= 0.4) this.launch();
      if (this.stateT <= 0) this.toChase();
    } else if (this.state === 'spin') {
      // spin in place, spraying dust clumps all around
      this.heading += dt * 9;
      this.body.rotation.y = this.heading;
      this.setLight(0xff8a2a, 3);
      brushSpin = 40;
      this.sprayT = (this.sprayT ?? 0) - dt;
      if (this.sprayT <= 0) {
        this.sprayT = 0.18;
        const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        const m = this.fx.orb(hostile('vacuum'), 0.007);   // dust clumps, glowing so you can read them
        m.position.copy(p).addScaledVector(dir, this.r).setY(0.03);
        this.shots.push({ m, v: dir.multiplyScalar(0.525), t: 1.33 });
        sfx.vacSpray();
      }
      if (this.stateT <= 0) this.toChase();
    }
    this.prevT = this.stateT;
    this.shield(dt);
    // crossing into angry sounds the siren
    if (angry && !this.wasAngry) sfx.vacAngry();
    this.wasAngry = angry;
    for (const b of this.brushes) b.rotation.y += dt * brushSpin;

    // bumping into it knocks you back
    if (this.knock <= 0 && dist < this.r + 0.018 && P.y < 0.1) {
      out.hit = Math.max(out.hit, this.state === 'charge' && this.locked ? 4 : 2);
      this.knockBack(toP, this.state === 'charge' && this.locked ? 1.0 : 0.6);
    }
    if (this.knock > 0) {
      this.knock -= dt;
      out.push = (out.push || new THREE.Vector3()).clone().addScaledVector(this.knockDir, this.knockSpeed);
    }

    // dust clumps
    const pc = P.clone().setY(P.y + 0.026);
    for (const s of this.shots) {
      s.t -= dt;
      s.m.position.addScaledVector(s.v, dt);
      this.fx.orbTick(s.m, dt);
      if (s.m.position.distanceTo(pc) < 0.025) { out.hit = Math.max(out.hit, 2); s.t = 0; }
      if (s.t <= 0) { this.fx.impact(s.m.position, hostile('vacuum'), 0.015, 8); this.fx.free(s.m); }
    }
    this.shots = this.shots.filter((s) => s.t > 0);
    return out;
  }

  // 4 lanternflies leap out of the bin in high arcs, landing around it (the leap word's own
  // landing rings warn where), and the shield goes up until they're all dead
  launch() {
    const p = this.holder.position, a = this.arena;
    this.guards = [];
    for (let k = 0; k < 4; k++) {
      const ang = this.heading + Math.PI / 4 + (k * Math.PI) / 2;
      const d = 0.32 + Math.random() * 0.06;
      const at = new THREE.Vector3(
        THREE.MathUtils.clamp(p.x + Math.sin(ang) * d, a.arenaMin[0] + 0.05, a.arenaMax[0] - 0.05), p.y,
        THREE.MathUtils.clamp(p.z + Math.cos(ang) * d, a.arenaMin[2] + 0.05, a.arenaMax[2] - 0.05));
      const e = this.enemies.spawn('lanternfly', p.clone().setY(p.y + 0.09));
      e.spawnT = 0.6;
      (e.leapFrom ||= new THREE.Vector3()).copy(e.pos);
      (e.leapAt ||= new THREE.Vector3()).copy(at);
      e.state = 'leap';
      e.stateT = 0.75;
      e.leapK = 0;
      e.airborne = true;
      this.guards.push(e);
    }
    this.shieldT = 30;
    sfx.vacFliesLaunch();
    sfx.shieldUp();
    this.fx.impact(p.clone().setY(p.y + 0.1), hostile('vacuum'), 0.05, 14);
    this.fx.puff(p.clone().setY(p.y + 0.08), 0x9c958b, 0.06, 0.5);
  }

  // the shield: the dome breathes, flashes when hit, and a tether runs to each fly still alive
  shield(dt) {
    this.guards = this.guards.filter((e) => !e.dead);
    this.shieldT -= dt;
    if (this.shieldT <= 0 && this.guards.length) this.guards = [];       // never stuck forever
    const on = this.shielded, p = this.holder.position;
    if (this.wasShielded && !on) { this.fx.impact(p.clone().setY(p.y + 0.05), hostile('vacuum'), this.r, 24); sfx.shieldBreak(); }   // it breaks
    this.wasShielded = on;
    this.dome.visible = this.tethers.visible = on;
    if (!on) return;
    this.domeFlash = Math.max(0, (this.domeFlash || 0) - dt * 5);
    this.dome.position.copy(p);
    this.dome.scale.setScalar(this.r * 1.35);
    this.dome.material.opacity = 0.22 + 0.06 * Math.sin(this.t * 5) + this.domeFlash * 0.35;
    const A = this.tethers.geometry.attributes.position;
    for (let k = 0; k < 4; k++) {
      const e = this.guards[k];
      const q = e ? e.pos : p;
      A.setXYZ(k * 2, p.x, p.y + 0.1, p.z);
      A.setXYZ(k * 2 + 1, q.x, q.y + (e ? e.r : 0.1), q.z);
    }
    A.needsUpdate = true;
  }

  knockBack(toP, speed) {
    this.knock = 0.3;
    this.knockSpeed = speed;
    this.knockDir.copy(toP).setY(0).normalize();
  }

  toChase() {
    this.state = 'chase';
    this.stateT = this.angry ? 1.6 : 2.6;
    this.setLight(this.angry ? 0xff8a2a : 0x4ab8ff, 2);
  }

  // the next attack, in a loop (the spin joins once it's angry)
  pick() {
    const order = this.angry ? ['charge', 'spin', 'flies', 'suction', 'brushes', 'charge', 'dump'] : ['charge', 'suction', 'flies', 'brushes', 'dump'];
    this.state = order[this.next++ % order.length];
    if (this.state === 'flies' && this.shielded) this.state = order[this.next++ % order.length];   // one shield at a time
    this.stateT = { charge: 1.0, suction: 3.0, brushes: 1.4, dump: 1.1, spin: 2.2, flies: 1.0 }[this.state];
    // every attack announces itself
    ({ charge: () => sfx.vacChargeWind(this.stateT), suction: () => sfx.vacSuction(this.stateT), brushes: () => sfx.vacBrushes(this.stateT),
      spin: () => sfx.vacSpin(this.stateT), flies: () => sfx.vacFliesWind() })[this.state]?.();
    this.prevT = this.stateT;
    this.locked = false;
  }

  dispose() {
    this.scene.remove(this.holder);
    this.scene.remove(this.line);
    this.scene.remove(this.swirl);
    this.scene.remove(this.dome);
    this.scene.remove(this.tethers);
    this.shots.forEach((s) => this.fx.free(s.m));
  }
}
