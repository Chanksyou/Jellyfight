// Little bits of feedback: floating damage numbers, poofs and expanding rings, and the combat
// visual language's pieces (vfx.js): glowing projectiles, impacts, floor warnings.
import { IceLooks } from './ice-looks.js';
import { GlitterLooks } from './glitter-looks.js';
import { AcidLooks } from './acid-looks.js';
import * as THREE from 'three';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { DeathRemains } from './death-remains.js';
import { GlowPoints, TeleMaterial, VolumeMaterial, volumeGeometry, shotHits, CRIT } from './vfx.js';

const WHITE = new THREE.Color(1, 1, 1);
const _ahead = new THREE.Vector3();   // scratch: which way a Shot is flying
const NUMBER_ACCENTS = { fire: '· ˙', ice: '◇ ·', lightning: 'ϟ', acid: '•', wind: '〰', glitter: '✧ ·' };

export class Fx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;font:700 14px system-ui,sans-serif;z-index:5';
    this.nums = [];
    this.numberClock = 0; this.numberSerial = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.numberLook = {
      cap: LOOK.num('number-cap', 40), group: LOOK.num('number-tick-window', 0.6),
      hitWindow: LOOK.num('number-hit-window', 0.3),
      life: LOOK.num('number-life', 0.7), critLife: LOOK.num('number-crit-life', 0.95),
      tickLife: LOOK.num('number-tick-life', 0.85), size: LOOK.num('number-size', 14),
      maxSize: LOOK.num('number-max-size', 22), critSize: LOOK.num('number-crit-size', 7),
      lane: LOOK.num('number-lane-space', 22), accents: LOOK.num('number-accent-limit', 20),
    };
    this.numberColors = Object.fromEntries(Object.entries({ fire: '#ffae62', ice: '#bdeeff', lightning: '#fff27a', acid: '#adff79', wind: '#eef8ff', glitter: '#ffb1ec', mixed: '#d6f1ff' }).map(([k, c]) => [k, LOOK.color('number-' + k, c)]));
    this.puffs = [];
    this.puffGeo = new THREE.SphereGeometry(1, 12, 8);
    this.rings = [];
    this.chunks = [];
    this.fireCorpses = [];
    this.ice = new IceLooks(scene);   // the ice Element's shards and frost flowers (ice-looks.js)
    this.glitter = new GlitterLooks(scene, camera);   // the glitter Element's flakes (glitter-looks.js)
    this.acid = new AcidLooks(scene, this);           // the acid Element's drops and melting bugs (acid-looks.js)
    this.deaths = new DeathRemains(scene);
    this.fireAshMat = new THREE.MeshBasicMaterial({ color: LOOK.color('fire-ash', '#382b28') });
    this.chunkGeo = new THREE.TetrahedronGeometry(1, 0);
    this.splats = [];
    this.splatGeo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    // one material per pool, drawn instanced (batch.js); each piece's own tint and fade ride
    // along as userData.color / userData.opacity
    const per = (m) => { m.userData.perInstance = true; return m; };
    this.puffMat = per(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.chunkMat = per(new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }));
    // wet marks on the floor: flat, drawn over it (polygon offset), never hiding what stands on them
    this.splatMat = per(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
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

  number(pos, text, color = '#fff', size = 14, info = {}) {
    const numeric = typeof text === 'number' && Number.isFinite(text), tick = numeric && !!info.tick;
    const crit = numeric && !!info.crit && !tick, element = info.element || '';
    let n;
    if (numeric && info.targetId != null) {
      const groupWindow = tick ? this.numberLook.group : this.numberLook.hitWindow;
      const group = this.nums.find(x => x.alive && x.numeric && x.tick === tick && x.targetId === info.targetId && (!tick || (x.element === element && this.numberClock - x.born <= groupWindow)));
      if (group && this.numberClock - group.born <= groupWindow) {
        group.amount += text; group.pos.copy(pos);
        group.crit ||= crit; group.slam ||= !!info.slam;
        if (group.element !== element) group.element = 'mixed';
        this.numberText(group);
        return group;
      }
      if (!tick) n = group;   // the next burst replaces the old receipt instead of adding another lane
    }
    n ||= this.nums.find((x) => !x.alive);
    if (!n) {
      if (this.nums.length >= this.numberLook.cap) {
        for (const x of this.nums) {
          if (x.crit && !crit) continue;
          if (!n || (x.tick && !n.tick) || (x.tick === n.tick && x.born < n.born)) n = x;
        }
        if (!n || (tick && !n.tick)) return;   // shed optional ticks before direct hits and crits
      }
    }
    if (!n) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 4px #0008;will-change:transform';
      const glyph = document.createElement('span'), accent = document.createElement('span');
      accent.style.cssText = 'position:absolute;left:50%;top:100%;font-size:10px;pointer-events:none';
      accent.setAttribute('aria-hidden', 'true'); el.append(glyph, accent);
      this.layer.appendChild(el);
      n = { el, glyph, accent, pos: new THREE.Vector3() };
      this.nums.push(n);
    }
    n.alive = false;   // don't count the reused slot when choosing a free trajectory
    n.lane = 0;
    const nearby = x => x.alive && (info.targetId != null ? x.targetId === info.targetId : x.pos.distanceToSquared(pos) < 0.0064);
    while (this.nums.some(x => nearby(x) && x.lane === n.lane)) n.lane++;
    Object.assign(n, { alive: true, t: 0, born: this.numberClock, serial: this.numberSerial++, numeric, tick, crit, element, slam: !!info.slam, targetId: info.targetId, amount: text, color, baseSize: size });
    n.pos.copy(pos);
    n.dx = (n.lane % 2 ? 1 : -1) * Math.ceil(n.lane / 2) * this.numberLook.lane;
    const projected = this._v.copy(pos).project(this.camera), px = projected.x * innerWidth / 2 + n.dx, py = projected.y * innerHeight / 2;
    n.aimDx = Math.abs(px) < 35 && Math.abs(py) < 35 ? (px < 0 ? -40 : 40) : 0;
    n.drift = (Math.random() - 0.5) * 14;
    const m = this.camera.matrixWorld.elements;
    n.windSign = info.dir ? Math.sign(info.dir.x * m[0] + info.dir.z * m[2]) || 1 : (n.serial % 2 ? 1 : -1);
    this.numberText(n);
    n.el.style.textShadow = '0 1px 2px #000,0 0 4px #000';
    n.el.style.display = '';
    return n;
  }

  numberText(n) {
    const value = n.numeric ? n.amount > 0 && n.amount < 1 ? (n.amount < 0.1 ? '<0.1' : n.amount.toFixed(1)) : Math.round(n.amount) : n.amount;
    n.glyph.textContent = `${n.crit ? '✦ ' : n.slam ? '◆ ' : ''}${value}`;
    n.accent.textContent = n.numeric ? NUMBER_ACCENTS[n.element] || '' : '';
    n.el.style.color = this.numberColors[n.element] || n.color;
    n.el.style.fontWeight = n.crit ? '900' : n.tick ? '650' : '800';
    n.size = n.numeric ? n.tick ? this.numberLook.size - 2 : Math.min(this.numberLook.maxSize, this.numberLook.size + Math.sqrt(Math.max(0, n.amount))) + (n.crit ? this.numberLook.critSize : 0) : n.baseSize;
    n.el.style.fontSize = n.size + 'px';
    n.el.style.webkitTextStroke = n.crit ? '0.7px #17212d' : '';
    n.life = n.tick ? this.numberLook.tickLife : n.crit ? this.numberLook.critLife : this.numberLook.life;
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

  // A wet mark on the floor where something burst: spreads a little, holds, then fades over
  // --splat-life s. Harmless leftovers only (never something that still hurts). At the cap
  // (--splat-most) the oldest one goes.
  splat(pos, color = null, radius = 0.01) {
    let s = this.splats.find((x) => !x.alive);
    if (!s) {
      if (this.splats.length < LOOK.num('splat-most', 24)) { s = { m: this.piece(this.splatGeo, this.splatMat) }; this.splats.push(s); }
      else s = this.splats.reduce((a, b) => (b.t > a.t ? b : a));
    }
    Object.assign(s, { alive: true, t: 0, life: LOOK.num('splat-life', 2), r: radius, sx: 0.75 + Math.random() * 0.5, sz: 0.75 + Math.random() * 0.5 });
    s.m.visible = true;
    s.m.position.set(pos.x, pos.y + 0.0015, pos.z);
    s.m.rotation.y = Math.random() * Math.PI;
    s.m.userData.color.set(color ?? LOOK.color('splat', '#9fd8ff'));
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
    r.m.scale.setScalar(radius * 0.2);
    r.m.userData.opacity = 0.9;
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

  // A Shot: an orb fired from `from` straight at `to`, a point in 3D (vfx.js shotTarget: the
  // jelly's middle, or a volley height), flying on past it at `speed` m/s for `life` s. Keep the
  // returned shot and call shotStep every frame until it's `done`.
  shot(color, from, to, { speed = 0.9, size = 0.0055, life = 1 } = {}) {
    const m = this.orb(color, size);
    m.position.copy(from);
    const v = to.clone().sub(from);
    v.multiplyScalar(speed / (v.length() || 1));
    return { m, v, t: life, size, color, done: false };
  }
  // Moves a Shot one frame; true the frame it touches the jelly's body (`feet` = player.position,
  // `body` = CONFIG.player). It ends (an impact, then back to the pool) on the jelly, a wall
  // (`world.cast`) or its life running out.
  shotStep(s, dt, world, feet, body) {
    if (s.done) return false;
    s.t -= dt;
    const step = s.v.length() * dt;
    if (world.cast(s.m.position, _ahead.copy(s.v).normalize(), step + 0.004)) s.t = 0;
    s.m.position.addScaledVector(s.v, dt);
    this.orbTick(s.m, dt);
    const hit = shotHits(s.m.position, s.size, feet, body);
    if (hit) s.t = 0;
    if (s.t <= 0) { this.impact(s.m.position, s.color, 0.015, 8); this.free(s.m); s.done = true; }
    return hit;
  }

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
  // standing on `pos`) or 'sphere' (a mid-air Blast, centred on `pos`), `r` its radius; or 'cone'
  // (a spray over a floor wedge from its apex `pos`, `r` = Vector3(w, w, length) with w its far
  // half-width; turn it with rotation.y like the wedge); or 'lane' (a box over a floor strip from
  // `pos`, `r` = Vector3(width, height, length), turned like the strip); or 'ring' (a low wall round
  // `pos`, `r` = Vector3(radius, height, radius)); or 'half' (a low slab over a floor half circle
  // pointing +z, `r` = Vector3(radius, height, radius), turned like it). Added to the scene; set
  // `material.progress` with the floor shape's, and remove it with it.
  volume(color, kind, pos, r) {
    const m = new THREE.Mesh(volumeGeometry(kind), new VolumeMaterial(color, kind));
    m.position.copy(pos);
    if (typeof r === 'number') m.scale.setScalar(r); else m.scale.copy(r);
    m.renderOrder = 4;   // over the floor shape (3)
    this.scene.add(m);
    return m;
  }

  // Reuse the removed enemy silhouette briefly; it is already dead for gameplay.
  fireCorpse(root) {
    if (this.fireCorpses.length >= 12) this.freeFireCorpse(this.fireCorpses.shift());
    root.visible = true;
    this.scene.add(root);
    batcher.track(root);
    root.traverse(o => {
      if (!o.isMesh) return;
      o.userData.fireMat = o.userData.mat || o.material;
      o.material = this.fireAshMat;
    });
    this.fireCorpses.push({ root, t: 0, scale: root.scale.clone(), rotation: root.rotation.z });
  }

  freeFireCorpse(c) {
    this.scene.remove(c.root);
    c.root.scale.copy(c.scale); c.root.rotation.z = c.rotation;
    c.root.traverse(o => {
      if (o.userData.fireMat) { o.material = o.userData.fireMat; delete o.userData.fireMat; }
    });
  }

  update(dt) {
    this.deaths.update(dt);
    this.ice.update(dt);
    this.glitter.update(dt);
    this.acid.update(dt);
    this.numberClock += dt;
    for (let i = this.fireCorpses.length - 1; i >= 0; i--) {
      const c = this.fireCorpses[i]; c.t += dt;
      const k = Math.min(1, c.t / 0.55);
      c.root.scale.copy(c.scale).multiplyScalar(Math.max(0.001, 1 - k * k));
      c.root.rotation.z = c.rotation + Math.sin(k * Math.PI) * 0.65;
      if (k === 1) { this.freeFireCorpse(c); this.fireCorpses.splice(i, 1); }
    }
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
    let activeNumbers = 0; for (const n of this.nums) if (n.alive) activeNumbers++;
    const calm = juice.calm || this.reducedMotion.matches, crowded = activeNumbers > this.numberLook.accents;
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.t += dt;
      if (n.t > n.life) { n.alive = false; n.el.style.display = 'none'; continue; }
      const v = this._v.copy(n.pos).project(this.camera);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      const t = n.t, k = t / n.life;
      if (!n.numeric) {
        const x = (v.x * 0.5 + 0.5) * w + n.drift, y = (-v.y * 0.5 + 0.5) * h - t * 40;
        n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.12 - t) * 8})`;
        n.el.style.opacity = String(Math.max(0, 1 - Math.max(0, t - 0.45) / 0.25));
        n.accent.style.display = 'none'; continue;
      }
      let dx = calm ? 0 : n.drift * t, dy = calm ? 0 : -t * (n.tick ? 25 : 42) + t * t * 10;
      let sx = 1, sy = 1, rotate = 0;
      if (!calm) {
        const punch = Math.max(0, 1 - t / 0.15);
        sx = sy = 1 + punch * (n.tick ? 0.08 : n.crit ? 0.55 : 0.25);
        if (!n.tick) {
          if (n.element === 'fire') { dy = -t * 60; dx += Math.sin(t * 8) * 4; }
          if (n.element === 'ice') { sx = sy = 1 + Math.max(0, 1 - t / 0.08) * (n.crit ? 0.55 : 0.18); }
          if (n.element === 'lightning') dx += t < 0.14 ? Math.sin(t * 85) * 5 * (1 - t / 0.14) : 0;
          if (n.element === 'acid') { dy = -t * 12 + t * t * 30; sy += punch * 0.2; }
          if (n.element === 'wind') { dx += n.windSign * t * (n.slam ? 25 : 55); if (n.slam) { sx += punch * 0.2; sy *= 1 - punch * 0.25; } }
        }
        rotate = n.crit ? Math.sin(Math.min(1, t / 0.16) * Math.PI) * (n.serial % 2 ? 4 : -4) : 0;
      }
      let x = (v.x * 0.5 + 0.5) * w + n.dx + n.aimDx + dx, y = (-v.y * 0.5 + 0.5) * h + dy - Math.floor(n.lane / 5) * 22;
      const margin = Math.min(w * 0.45, Math.max(28, n.size * n.glyph.textContent.length * 0.36 * sx));
      x = Math.max(margin, Math.min(w - margin, x)); y = Math.max(24, Math.min(h - 24, y));
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rotate}deg) scale(${sx}, ${sy})`;
      n.el.style.opacity = String(Math.max(0, Math.min(n.tick ? 0.8 : 1, (1 - k) / 0.3)));
      n.el.style.textShadow = n.crit && !calm && t < 0.1 ? '0 0 2px #fff,0 0 7px currentColor,0 2px 3px #000' : '0 1px 2px #000,0 0 4px #000';
      n.accent.style.display = calm || crowded || n.tick || t > 0.35 ? 'none' : '';
      n.accent.style.transform = `translate(${t * 12}px, ${t * (n.element === 'fire' ? 25 : -10)}px) rotate(${t * 35}deg)`;
      n.accent.style.opacity = String(Math.max(0, 1 - t / 0.35));
    }
    const so = LOOK.num('splat-opacity', 0.45);
    for (const s of this.splats) {
      if (!s.alive) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.alive = false; s.m.visible = false; continue; }
      const g = s.r * (0.7 + 0.3 * Math.min(1, s.t / 0.12));   // spreads out as it lands
      s.m.scale.set(g * s.sx, 1, g * s.sz);
      s.m.userData.opacity = so * Math.min(1, (1 - k) / 0.4);   // holds, then fades over its last 40%
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
    this.deaths.clear();
    this.ice.clear();
    this.glitter.clear();
    this.acid.clear();
    for (const c of this.fireCorpses) this.freeFireCorpse(c);
    this.fireCorpses.length = 0;
    this.nums.forEach((n) => { n.alive = false; n.el.style.display = 'none'; });
    this.puffs.forEach((p) => { p.alive = false; p.m.visible = false; });
    this.rings.forEach((r) => { r.alive = false; r.m.visible = false; });
    this.chunks.forEach((c) => { c.alive = false; c.m.visible = false; });
    this.splats.forEach((s) => { s.alive = false; s.m.visible = false; });
    this.orbs.forEach((o) => { o.alive = false; o.m.visible = false; });
    this.glow.clear();
  }
}
