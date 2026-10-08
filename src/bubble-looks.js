// What an element bubble looks like in flight: each element treasure turns the bubble into its
// own projectile, so you can see what every shot will do before it lands.
//
//   fire       a white-hot fireball in a flickering orange flame, licking flames streaming back
//              and embers dropping off it
//   lightning  a ball of light with jagged arcs crackling around it (new ones every frame) and
//              sparks spitting off
//   ice        a spinning crystal shard pointed along its flight, a frosty trail and snow
//   acid       a wobbling green glob with a bubble rolling over it, dripping as it flies
//   wind       a crescent wind blade, flat and bowed forward, with a fainter one behind it and wisps
//              trailing off both tips (bubbles.js hits everything its arc passes through)
//   glitter    a hot pink orb shedding twinkling sparks in every colour
//
// Every mesh is drawn instanced (batch.js) and every glow is a GlowPoints particle (vfx.js);
// the lightning arcs share one line buffer. So a screen full of them is a handful of draw calls.
import * as THREE from 'three';
import { batcher } from './batch.js';

const Z = new THREE.Vector3(0, 0, 1);
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const C = (hex) => new THREE.Color(hex);
const COL = {
  flame: [C(0xffb020), C(0xff6a10), C(0xff2a00)], ember: C(0xffa020),
  bolt: C(0xffe640), spark: C(0xfff8c0),
  frost: C(0x6ad0ff), snow: C(0xe8f8ff),
  acid: C(0x5aff1a), drip: C(0x3aff00),
  wisp: [C(0xffffff), C(0xbfe6ff)],
  glitter: [C(0xff2ab0), C(0xffc81a), C(0x2ae0ff), C(0xb04aff), C(0x6aff6a)],
};
const SIZE = 1.3;    // element projectiles read a little bigger than a plain bubble
// The wind blade: an arc of radius R (in bubble radii) lying flat, bowed forward (+z), its middle at
// the projectile and its tips swept back. WIND_ARC is also how far to each side it hits (bubbles.js).
export const WIND_ARC = 2.6;
function crescent(R, tube) {
  const arc = Math.PI * 0.75;
  return new THREE.TorusGeometry(R, tube, 6, 28, arc).rotateZ(Math.PI / 2 - arc / 2).rotateX(Math.PI / 2).translate(0, 0, -R);
}

// unlit (they're lights, not things); additive ones glow over whatever is behind
const lit = (hex, opacity = 1, add = false) => new THREE.MeshBasicMaterial({
  color: hex, transparent: opacity < 1 || add, opacity, depthWrite: !add && opacity >= 1, toneMapped: false,
  blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
});

export class BubbleLooks {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.pools = {};
    const ball = new THREE.IcosahedronGeometry(1, 2);
    // each element's parts: [geometry, material, { name, s: [x, y, z] scale, at: [x, y, z] }]
    // (local +z is the way it flies)
    this.parts = {
      fire: [
        [ball, lit(0xffd060)],
        [ball, lit(0xff7a00, 0.9), { name: 'flame', s: [1.45, 1.45, 2.6], at: [0, 0, -0.8] }],
        [ball, lit(0xe82a00, 0.6), { name: 'flame2', s: [1.7, 1.7, 4.4], at: [0, 0, -2.2] }],
      ],
      lightning: [
        [ball, lit(0xfffbe0)],
        [ball, lit(0xffc800, 0.45), { name: 'halo', s: [1.6, 1.6, 1.6] }],
      ],
      ice: [
        [new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xaee6ff, emissive: 0x1a8aff, emissiveIntensity: 1.3, roughness: 0.08, metalness: 0.3, flatShading: true }), { name: 'shard', s: [0.75, 0.75, 2.2] }],
        [ball, lit(0x2a9aff, 0.25), { s: [1.4, 1.4, 2.4] }],
      ],
      acid: [
        [ball, lit(0x5aee10), { name: 'blob' }],
        [ball, lit(0x1acc00, 0.35), { s: [1.45, 1.45, 1.45] }],
        [ball, lit(0xc8ff6a), { name: 'bub', s: [0.36, 0.36, 0.36] }],
      ],
      wind: [
        [crescent(WIND_ARC, 0.32), lit(0xffffff, 0.85, true), { name: 'blade', s: [1, 0.35, 1] }],
        [crescent(WIND_ARC * 0.8, 0.22), lit(0xbfe8ff, 0.6, true), { name: 'blade2', s: [1, 0.3, 1], at: [0, 0, -1.1] }],
        [ball, lit(0xeef6ff, 0.6, true), { s: [0.6, 0.6, 0.6] }],
      ],
      glitter: [
        [ball, lit(0xff2ab0)],
        [ball, lit(0xff4ac0, 0.4), { name: 'halo', s: [1.6, 1.6, 1.6] }],
      ],
    };
    // lightning arcs, all of them in one line buffer, rebuilt every frame
    const MAX = 96 * 5 * 2;
    this.arcPos = new Float32Array(MAX * 3);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.arcs = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffe640, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.arcs.frustumCulled = false;
    this.arcs.renderOrder = 4;
    scene.add(this.arcs);
    this.arcN = 0;
    this.arcMax = MAX;
  }

  // a projectile for element `el` (pooled)
  get(el) {
    const pool = (this.pools[el] ||= []);
    let m = pool.pop();
    if (!m) {
      m = new THREE.Group();
      m.userData.look = el;
      for (const [geo, mat, o = {}] of this.parts[el]) {
        const part = new THREE.Mesh(geo, mat);
        if (o.s) part.scale.set(...o.s);
        if (o.at) part.position.set(...o.at);
        part.userData.base = part.scale.clone();
        if (o.name) m.userData[o.name] = part;
        m.add(part);
      }
      batcher.track(m);
    }
    if (!m.parent) this.scene.add(m);
    m.visible = true;
    return m;
  }

  release(m) { m.visible = false; this.pools[m.userData.look].push(m); }

  // one of each, for the shader warm-up (main.js)
  warm(at) { return Object.keys(this.parts).map((el) => { const m = this.get(el); m.position.copy(at); m.scale.setScalar(0.01); return m; }); }

  frame() { this.arcN = 0; }
  endFrame() {
    this.arcs.geometry.setDrawRange(0, this.arcN);
    this.arcs.geometry.attributes.position.needsUpdate = true;
    this.arcs.visible = this.arcN > 0;
  }

  // b: a flying bubble (bubbles.js). Points it along its flight, sizes and animates it, and
  // throws off its particles.
  update(b, dt, t) {
    const m = b.m, U = m.userData, glow = this.fx.glow, r = b.r * SIZE * Math.min(1, b.t * 8);
    const dir = _d.copy(b.vel).normalize();
    m.quaternion.setFromUnitVectors(Z, dir);
    m.scale.setScalar(r);
    const tail = _p.copy(m.position).addScaledVector(dir, -b.r);
    // trails are laid along the whole way it moved this frame, so they read as a streak, not dots
    const last = (b.lastTail ||= tail.clone()), gap = last.distanceTo(tail), steps = Math.min(5, Math.max(1, Math.round(gap / (r * 0.35))));
    const along = (k) => _t.copy(last).lerp(tail, (k + 1) / steps);
    b.lookT = (b.lookT || 0) - dt;
    const tick = b.lookT <= 0;
    if (tick) b.lookT = 0.016;
    const w = b.wobble;
    switch (U.look) {
      case 'fire': {
        const f = 1 + 0.18 * Math.sin(t * 41 + w) + 0.08 * Math.sin(t * 67);
        U.flame.scale.set(1.45 * f, 1.45 * f, 2.6 * (2 - f));
        U.flame2.scale.set(1.7 * (2 - f), 1.7 * (2 - f), 4.4 * f);
        glow.hold(m.position, COL.flame[0], r * 3, 0.35);
        if (tick) {
          for (let k = 0; k < steps; k++) {
            _v.copy(dir).multiplyScalar(-0.05).add(_a.set((Math.random() - 0.5) * 0.03, 0.06, (Math.random() - 0.5) * 0.03));
            glow.emit(along(k), COL.flame[(Math.random() * 3) | 0], r * 2.4, r * 0.5, 0.2 + Math.random() * 0.12, 0.7, _v, -0.4);   // flames lick up and back
          }
          if (Math.random() < 0.3) glow.emit(tail, COL.ember, r * 0.5, r * 0.2, 0.5, 1, _a.set((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1), 0.9);
        }
        break;
      }
      case 'lightning': {
        U.halo.scale.setScalar(1.4 + Math.random() * 0.6);              // it flickers
        glow.hold(m.position, COL.bolt, r * (3 + Math.random() * 1.5), 0.45);
        // 4 jagged arcs out from the core, new every frame, beaded with light so they read thick
        for (let k = 0; k < 4 && this.arcN + 10 <= this.arcMax; k++) {
          _a.randomDirection();
          let x = m.position.x, y = m.position.y, z = m.position.z;
          const len = r * (3 + Math.random() * 2.5);
          for (let s = 1; s <= 5; s++) {
            const q = len * (s / 5);
            const nx = m.position.x + _a.x * q + (Math.random() - 0.5) * r * 0.9;
            const ny = m.position.y + _a.y * q + (Math.random() - 0.5) * r * 0.9;
            const nz = m.position.z + _a.z * q + (Math.random() - 0.5) * r * 0.9;
            this.arcPos.set([x, y, z, nx, ny, nz], this.arcN * 3);
            this.arcN += 2;
            glow.hold(_b.set(nx, ny, nz), COL.bolt, r * 0.75, 0.9);
            x = nx; y = ny; z = nz;
          }
        }
        if (tick && Math.random() < 0.5) glow.emit(m.position, COL.spark, r * 0.7, r * 0.1, 0.18, 1, _v.randomDirection().multiplyScalar(0.25));
        break;
      }
      case 'ice': {
        U.shard.rotation.z += dt * 9;
        glow.hold(m.position, COL.frost, r * 3, 0.3);
        if (tick) {
          for (let k = 0; k < steps; k++) glow.emit(along(k), COL.frost, r * 1.8, r * 0.4, 0.45, 0.5);   // the frosty trail hangs in the air
          if (Math.random() < 0.4) glow.emit(tail, COL.snow, r * 0.45, r * 0.3, 0.7, 1, _v.set((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04), 0.15);
        }
        break;
      }
      case 'acid': {
        const k = Math.sin(t * 15 + w), j = Math.cos(t * 11 + w);
        U.blob.scale.set(1 + 0.18 * k, 1 - 0.16 * k, 1 + 0.12 * j);       // a wobbling glob
        U.bub.position.set(Math.cos(t * 7 + w) * 0.75, 0.55 + 0.2 * k, Math.sin(t * 7 + w) * 0.75);
        glow.hold(m.position, COL.acid, r * 3, 0.3);
        if (tick) {
          for (let k = 0; k < steps; k++) glow.emit(along(k), COL.acid, r * 1.3, r * 0.3, 0.25, 0.5);   // a slimy streak
          if (Math.random() < 0.7) glow.emit(_v.copy(m.position).setY(m.position.y - r * 0.8), COL.drip, r * 1.0, r * 0.6, 0.55, 0.95, _a.set(0, -0.02, 0), 1.4);   // drips fall
        }
        break;
      }
      case 'wind': {
        const p = 1 + 0.08 * Math.sin(t * 24 + w);                        // the blade breathes as it flies
        U.blade.scale.set(p, 0.35, p);
        U.blade2.scale.set(2 - p, 0.3, 2 - p);
        glow.hold(m.position, COL.wisp[1], r * 4, 0.4);
        if (tick) {
          // wisps peel off both tips, and a faint streak behind the middle
          _a.set(1, 0, 0).applyQuaternion(m.quaternion);
          for (let s = -1; s <= 1; s += 2) {
            _v.copy(m.position).addScaledVector(_a, s * r * WIND_ARC * 0.85).addScaledVector(dir, -r * WIND_ARC * 0.5);
            glow.emit(_v, COL.wisp[s > 0 ? 0 : 1], r * 1.1, r * 0.3, 0.3, 0.8);
          }
          glow.emit(tail, COL.wisp[1], r * 1.4, r * 0.4, 0.22, 0.6);
        }
        break;
      }
      case 'glitter': {
        U.halo.scale.setScalar(1.5 + 0.2 * Math.sin(t * 25 + w));
        glow.hold(m.position, COL.glitter[0], r * 3, 0.3);
        if (tick) for (let s = 0; s < 3; s++) {
          glow.emit(_v.copy(m.position).addScaledVector(_a.randomDirection(), r * 1.5), COL.glitter[(Math.random() * 5) | 0], r * 1.2, 0, 0.35 + Math.random() * 0.3, 1, _b.randomDirection().multiplyScalar(0.06), 0.2);
        }
        break;
      }
    }
    b.lastTail.copy(tail);
  }
}
