// Little bits of feedback: floating damage numbers, poofs and expanding rings, and the combat
// visual language's pieces (vfx.js): glowing projectiles, impacts, floor warnings.
import * as THREE from 'three';
import { batcher } from './batch.js';
import { GlowPoints, TeleMaterial, VolumeMaterial, volumeGeometry, CRIT } from './vfx.js';

const WHITE = new THREE.Color(1, 1, 1);

export class Fx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;font:700 14px system-ui,sans-serif;z-index:5';
    this.nums = [];
    this.puffs = [];
    this.puffGeo = new THREE.SphereGeometry(1, 12, 8);
    this.rings = [];
    this.chunks = [];
    this.chunkGeo = new THREE.TetrahedronGeometry(1, 0);
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    // one material per pool, drawn instanced (batch.js); each piece's own tint and fade ride
    // along as userData.color / userData.opacity
    const per = (m) => { m.userData.perInstance = true; return m; };
    this.puffMat = per(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.chunkMat = per(new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }));
    // shockwave rings glow (additive, unlit): they're how an area attack shows its reach
    this.ringMat = per(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    // the combat visual language (vfx.js): every glow is one point in one draw call, and every
    // projectile a white-hot core (instanced) inside one of them
    this.glow = new GlowPoints(scene);
    this.orbs = [];
    this.orbGeo = new THREE.SphereGeometry(1, 12, 8);
    this.orbMat = per(new THREE.MeshBasicMaterial({ toneMapped: false }));
    this._c = new THREE.Color();
    this._w = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  mount(parent) { parent.appendChild(this.layer); }

  // a pooled piece: in the scene for its transform, drawn instanced
  piece(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.userData.color = new THREE.Color();
    m.userData.opacity = 1;
    this.scene.add(m);
    return batcher.track(m);
  }

  number(pos, text, color = '#fff', size = 14) {
    let n = this.nums.find((x) => !x.alive);
    if (!n) {
      if (this.nums.length > 60) return;
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 4px #0008;will-change:transform';
      this.layer.appendChild(el);
      n = { el, pos: new THREE.Vector3() };
      this.nums.push(n);
    }
    n.alive = true;
    n.t = 0;
    n.pos.copy(pos);
    n.dx = (Math.random() - 0.5) * 16;
    n.el.textContent = text;
    n.el.style.color = color;
    n.el.style.fontSize = size + 'px';
    n.el.style.display = '';
  }

  puff(pos, color = 0xd8d2c6, radius = 0.012, life = 0.35) {
    let p = this.puffs.find((x) => !x.alive);
    if (!p) {
      if (this.puffs.length > 90) return;
      const m = this.piece(this.puffGeo, this.puffMat);
      p = { m };
      this.puffs.push(p);
    }
    p.alive = true;
    p.t = 0;
    p.life = life;
    p.r = radius;
    p.m.visible = true;
    p.m.position.copy(pos);
    p.m.userData.color.set(color);
  }

  // Bits that fly out, fall, bounce once and fade: an enemy bursting apart, a splash of drops.
  // floorY: where they land. colors: picked at random per bit.
  burst(pos, colors, n = 8, size = 0.004, speed = 0.35, floorY = null) {
    for (let k = 0; k < n; k++) {
      let c = this.chunks.find((x) => !x.alive);
      if (!c) {
        if (this.chunks.length > 120) return;
        const m = this.piece(this.chunkGeo, this.chunkMat);
        c = { m, v: new THREE.Vector3() };
        this.chunks.push(c);
      }
      c.alive = true;
      c.t = 0;
      c.life = 0.7 + Math.random() * 0.4;
      c.floor = floorY ?? pos.y - 0.03;
      c.m.visible = true;
      c.m.position.copy(pos);
      c.m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      c.m.userData.color.set(colors[(Math.random() * colors.length) | 0]);
      c.v.set(Math.random() - 0.5, 0.6 + Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      c.spin = (Math.random() - 0.5) * 30;
    }
  }

  // A flat ring that grows out to `radius` and fades: shows the reach of an area attack
  ring(pos, color = 0xffffff, radius = 0.1, life = 0.4) {
    let r = this.rings.find((x) => !x.alive);
    if (!r) {
      if (this.rings.length > 16) return;
      const m = this.piece(this.ringGeo, this.ringMat);
      r = { m };
      this.rings.push(r);
    }
    Object.assign(r, { alive: true, t: 0, life, r: radius });
    r.m.visible = true;
    r.m.position.copy(pos);
    r.m.userData.color.set(color);
  }

  // A projectile: a white-hot core of radius `size` that glows `color`. Move it yourself, call
  // orbTick(m, dt) every frame (its halo and trail), and free(m) when it's gone.
  orb(color, size = 0.005) {
    let o = this.orbs.find((x) => !x.alive);
    if (!o) {
      o = { m: this.piece(this.orbGeo, this.orbMat) };
      this.orbs.push(o);
    }
    o.alive = true;
    const m = o.m;
    m.visible = true;
    m.scale.setScalar(size);
    const c = new THREE.Color(color);
    m.userData.color.copy(c).lerp(WHITE, 0.6);
    m.userData.opacity = 1;
    m.userData.orb = { o, c, size, trailT: 0 };
    return m;
  }
  orbTick(m, dt, glow = 1) {
    const O = m.userData.orb;
    this.glow.hold(m.position, O.c, O.size * 9 * glow, 0.95);
    if ((O.trailT -= dt) <= 0) { O.trailT = 0.018; this.glow.emit(m.position, O.c, O.size * 5 * glow, O.size * 1.5, 0.24, 0.75); }
  }
  free(m) { const O = m?.userData.orb; if (!O) return; O.o.alive = false; m.visible = false; }

  // A hit landing: a flash, a ring of sparks flying out and a shockwave on the ground
  impact(pos, color, size = 0.025, sparks = 10) {
    const c = new THREE.Color(color);
    this.glow.emit(pos, c, size * 2.2, size * 4, 0.16, 1.3);                     // the flash
    for (let k = 0; k < sparks; k++) {
      const v = this._w.set(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(0.25 + Math.random() * 0.45);
      this.glow.emit(pos, c, size * 0.45, size * 0.05, 0.3 + Math.random() * 0.25, 1, v, 1.4);
    }
    this.ring(pos.clone().setY(pos.y - size * 0.3), color, size * 2.4, 0.3);
  }

  // A critical hit (crit): a bright star-flash bigger than the bug, a burst of sparks and a fast ring,
  // so a crit reads at a glance even in a crowd
  crit(pos, r = 0.01) {
    const c = (this._crit ||= CRIT());
    this.glow.emit(pos, c, r * 6, r * 9, 0.14, 1.6);
    this.impact(pos, c, Math.max(0.012, r * 1.4), 14);
  }

  // a floor warning (vfx.js TeleMaterial) of the given shape, ready to place
  tele(color, shape = 'circle', half) { return new TeleMaterial(color, shape, half); }

  // a Warning's volume (vfx.js VolumeMaterial) over its floor shape: kind 'dome' (a floor Blast,
  // standing on `pos`) or 'sphere' (a mid-air Blast, centred on `pos`), `r` its radius. Added to
  // the scene; set `material.progress` with the floor shape's, and remove it with it.
  volume(color, kind, pos, r) {
    const m = new THREE.Mesh(volumeGeometry(kind), new VolumeMaterial(color, kind));
    m.position.copy(pos);
    m.scale.setScalar(r);
    m.renderOrder = 4;   // over the floor shape (3)
    this.scene.add(m);
    return m;
  }

  update(dt) {
    this.glow.update(dt, this.camera, window.APT?.renderer);
    const w = innerWidth, h = innerHeight;
    for (const c of this.chunks) {
      if (!c.alive) continue;
      c.t += dt;
      if (c.t > c.life) { c.alive = false; c.m.visible = false; continue; }
      c.v.y -= 1.4 * dt;
      c.m.position.addScaledVector(c.v, dt);
      if (c.m.position.y < c.floor) { c.m.position.y = c.floor; c.v.y = -c.v.y * 0.35; c.v.x *= 0.6; c.v.z *= 0.6; c.spin *= 0.5; }
      c.m.rotation.x += c.spin * dt;
      c.m.rotation.z += c.spin * 0.7 * dt;
      c.m.userData.opacity = Math.min(1, (c.life - c.t) * 4);
    }
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { r.alive = false; r.m.visible = false; continue; }
      r.m.scale.setScalar(r.r * (0.2 + 0.8 * Math.sqrt(k)));
      r.m.userData.opacity = 0.9 * (1 - k);
    }
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.t += dt;
      if (n.t > 0.7) { n.alive = false; n.el.style.display = 'none'; continue; }
      const v = this._v.copy(n.pos).project(this.camera);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      const x = (v.x * 0.5 + 0.5) * w + n.dx, y = (-v.y * 0.5 + 0.5) * h - n.t * 40;
      // pops big, then settles and floats up: hits read as hits
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.12 - n.t) * 8})`;
      n.el.style.opacity = String(1 - Math.max(0, n.t - 0.45) / 0.25);
    }
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.alive = false; p.m.visible = false; continue; }
      p.m.scale.setScalar(p.r * (0.4 + k * 1.2));
      p.m.userData.opacity = 0.55 * (1 - k);
    }
  }

  clear() {
    this.nums.forEach((n) => { n.alive = false; n.el.style.display = 'none'; });
    this.puffs.forEach((p) => { p.alive = false; p.m.visible = false; });
    this.rings.forEach((r) => { r.alive = false; r.m.visible = false; });
    this.chunks.forEach((c) => { c.alive = false; c.m.visible = false; });
    this.orbs.forEach((o) => { o.alive = false; o.m.visible = false; });
    this.glow.clear();
  }
}
