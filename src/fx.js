// Little bits of feedback: floating damage numbers and poofs.
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
      if (this.puffs.length > 40) return;
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

  update(dt) {
    const w = innerWidth, h = innerHeight;
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.t += dt;
      if (n.t > 0.7) { n.alive = false; n.el.style.display = 'none'; continue; }
      const v = this._v.copy(n.pos).project(this.camera);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      const x = (v.x * 0.5 + 0.5) * w + n.dx, y = (-v.y * 0.5 + 0.5) * h - n.t * 40;
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.15 - n.t) * 3})`;
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
  }
}
