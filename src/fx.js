// Little bits of feedback: floating damage numbers, poofs and expanding rings.
import * as THREE from 'three';

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
    this._v = new THREE.Vector3();
  }

  mount(parent) { parent.appendChild(this.layer); }

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
      const m = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      this.scene.add(m);
      p = { m };
      this.puffs.push(p);
    }
    p.alive = true;
    p.t = 0;
    p.life = life;
    p.r = radius;
    p.m.visible = true;
    p.m.position.copy(pos);
    p.m.material.color.set(color);
  }

  // Bits that fly out, fall, bounce once and fade: an enemy bursting apart, a splash of drops.
  // floorY: where they land. colors: picked at random per bit.
  burst(pos, colors, n = 8, size = 0.004, speed = 0.35, floorY = null) {
    for (let k = 0; k < n; k++) {
      let c = this.chunks.find((x) => !x.alive);
      if (!c) {
        if (this.chunks.length > 120) return;
        const m = new THREE.Mesh(this.chunkGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }));
        this.scene.add(m);
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
      c.m.material.color.set(colors[(Math.random() * colors.length) | 0]);
      c.v.set(Math.random() - 0.5, 0.6 + Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      c.spin = (Math.random() - 0.5) * 30;
    }
  }

  // A flat ring that grows out to `radius` and fades: shows the reach of an area attack
  ring(pos, color = 0xffffff, radius = 0.1, life = 0.4) {
    let r = this.rings.find((x) => !x.alive);
    if (!r) {
      if (this.rings.length > 16) return;
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      this.scene.add(m);
      r = { m };
      this.rings.push(r);
    }
    Object.assign(r, { alive: true, t: 0, life, r: radius });
    r.m.visible = true;
    r.m.position.copy(pos);
    r.m.material.color.set(color);
  }

  update(dt) {
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
      c.m.material.opacity = Math.min(1, (c.life - c.t) * 4);
    }
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { r.alive = false; r.m.visible = false; continue; }
      r.m.scale.setScalar(r.r * (0.2 + 0.8 * Math.sqrt(k)));
      r.m.material.opacity = 0.7 * (1 - k);
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
      p.m.material.opacity = 0.55 * (1 - k);
    }
  }

  clear() {
    this.nums.forEach((n) => { n.alive = false; n.el.style.display = 'none'; });
    this.puffs.forEach((p) => { p.alive = false; p.m.visible = false; });
    this.rings.forEach((r) => { r.alive = false; r.m.visible = false; });
    this.chunks.forEach((c) => { c.alive = false; c.m.visible = false; });
  }
}
