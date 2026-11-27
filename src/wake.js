// wake (Bioluminescent Wake): swimming along anything you stand on leaves a glowing plankton trail that
// slows the bugs walking in it; jumping off the ground sends a pulse racing from you down the whole trail,
// every piece going off as a small Blast. One draw: a strip of floor quads rewritten only when the trail
// changes (its glow, fade and ignition all run in the shader off a clock uniform). No light (rule 7).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const MAX = 480, VERTS = 6, TRI = [0, 1, 2, 0, 2, 3];
const _c = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3();

export class Wake {
  constructor(run) {
    this.run = run;
    this.points = [];     // { x, y, z, t (laid), lit (when it goes off, -1 not yet), cut (no joint to the one before) }
    this.blasts = [];     // the ignition's Blasts still to go off: { x, y, z, at }
    this.hit = new Set(); // bugs this ignition has hit (each once)
    const g = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['uv', 2], ['born', 1], ['lit', 1]]) {
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(MAX * VERTS * size), size).setUsage(THREE.DynamicDrawUsage));
    }
    this.uniforms = {
      clock: { value: 0 }, life: { value: 4 }, motion: { value: 1 },
      fresh: { value: new THREE.Color(LOOK.color('wake-fresh', '#1ccfe8')) },
      old: { value: new THREE.Color(LOOK.color('wake-old', '#7a3cff')) },
      flare: { value: new THREE.Color(LOOK.color('wake-flare', '#f4fdff')) },
      glow: { value: LOOK.num('wake-glow', 0.55) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float born, lit;
        varying vec2 vUv; varying vec3 vWorld; varying float vBorn, vLit;
        void main() { vUv = uv; vWorld = position; vBorn = born; vLit = lit;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform float clock, life, motion, glow;
        uniform vec3 fresh, old, flare;
        varying vec2 vUv; varying vec3 vWorld; varying float vBorn, vLit;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          #include <logdepthbuf_fragment>
          float age = clock - vBorn; if (age >= life) discard;
          float d = abs(vUv.y * 2.0 - 1.0);
          float body = 1.0 - smoothstep(0.35, 1.0, d);
          float k = age / life, t = clock * motion;
          vec3 col = mix(fresh, old, smoothstep(0.0, 1.0, k));
          // plankton: specks that twinkle in and out, drifting a little
          vec2 cell = floor(vWorld.xz * 260.0 + vec2(t * 0.6, -t * 0.4));
          float h = hash(cell), speck = step(0.93, h) * (0.5 + 0.5 * sin(t * (4.0 + h * 6.0) + h * 40.0));
          float lap = 0.75 + 0.25 * sin(vWorld.x * 31.0 + vWorld.z * 23.0 - t * 2.0);
          float a = (body * glow * lap + speck * body * 0.6) * min(1.0, age / 0.12) * (1.0 - smoothstep(0.7, 1.0, k));
          vec3 c = col * (0.55 + 0.25 * lap) + flare * speck * 0.7;
          if (vLit >= 0.0) {   // the pulse: brightening as it comes, a white flare as it passes, then gone
            float s = clock - vLit;
            if (s > 0.3) discard;
            float near = smoothstep(-0.08, 0.0, s) * step(s, 0.0), boom = s >= 0.0 ? exp(-s * 14.0) : 0.0;
            c = mix(c, flare, max(near * 0.6, boom)) * (1.0 + near + boom * 1.5);
            a = max(a, body * max(near, boom)) * (s > 0.0 ? 1.0 - s / 0.3 : 1.0);
          }
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true,   // blended, not added: on a pale floor added light only washes to white
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = 'Wake'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    run.scene.add(this.mesh);
    this.flareColor = new THREE.Color(LOOK.color('wake-flare', '#f4fdff'));
    this.freshColor = new THREE.Color(LOOK.color('wake-fresh', '#1ccfe8'));
    this.oldColor = new THREE.Color(LOOK.color('wake-old', '#7a3cff'));
    this.onWalk = (from, dir, length) => this.record(from, dir, length);
    this.reset();
  }

  reset() {
    this.points.length = 0; this.blasts.length = 0; this.hit.clear();
    this.clock = this.tickT = 0; this.lastIgnite = -Infinity; this.dirty = true;
    this.mesh.visible = false; this.mesh.geometry.setDrawRange(0, 0);
  }

  // player.js onWalk (grounded, not climbing): a point every `radius` along the path really swum
  record(from, dir, length) {
    const W = this.run.mods.wake;
    if (!W || length <= 1e-8) return;
    const step = W.radius, end = _p.copy(from).addScaledVector(dir, length), last = this.points.at(-1);
    if (last && last.lit < 0 && Math.hypot(end.x - last.x, end.z - last.z) < step && Math.abs(end.y - last.y) < 0.004) return;
    const cut = !last || last.lit >= 0 || Math.hypot(end.x - last.x, end.z - last.z) > step * 4 || Math.abs(end.y - last.y) > 0.01;
    if (this.points.length >= MAX) this.points.shift();
    this.points.push({ x: end.x, y: end.y + 0.0015, z: end.z, t: this.clock, lit: -1, cut });
    this.dirty = true;
  }

  // player.js onJump (a jump off the ground): the pulse races from the jelly down the whole trail
  ignite() {
    const W = this.run.mods.wake, cd = this.run.mods.cooldownScale ?? 1;
    if (!W || this.clock - this.lastIgnite < W.cooldown * cd) return false;
    const live = [];
    for (let i = this.points.length - 1; i >= 0; i--) if (this.points[i].lit < 0) live.push(this.points[i]);
    if (live.length < 2) return false;
    this.lastIgnite = this.clock; this.hit.clear();
    let total = 0;
    for (let i = 1; i < live.length; i++) total += Math.hypot(live[i].x - live[i - 1].x, live[i].z - live[i - 1].z);
    let run = 0, nextBlast = 0;
    for (let i = 0; i < live.length; i++) {
      const q = live[i];
      if (i) run += Math.hypot(q.x - live[i - 1].x, q.z - live[i - 1].z);
      q.lit = this.clock + W.ignite * (total > 0 ? run / total : 0);
      if (run >= nextBlast || i === live.length - 1) { this.blasts.push({ x: q.x, y: q.y, z: q.z, at: q.lit }); nextBlast = run + W.blast * 1.4; }
    }
    this.dirty = true;
    sfx.gadgetSalt(0); sfx.whiz();
    this.run.player.avatar?.pulse(0.5);
    return true;
  }

  update(dt) {
    const R = this.run, W = R.mods.wake;
    if (!W || !['explore', 'boss'].includes(R.phase) || R.polypT > 0) { if (this.points.length || this.mesh.visible) this.reset(); return; }
    if (dt <= 0) return;
    this.clock += dt;
    const U = this.uniforms;
    U.clock.value = this.clock; U.life.value = W.time; U.motion.value = juice.calm ? 0 : 1;
    // the oldest end burns out, and pieces the pulse has been through are gone once their flare is done
    const done = (q) => this.clock - q.t >= W.time || (q.lit >= 0 && this.clock - q.lit > 0.3);
    if (this.points.some(done)) { this.points = this.points.filter((q) => !done(q)); this.dirty = true; }
    this.blow(W);
    if ((this.tickT -= dt) <= 0) { this.tickT = 0.1; this.wade(W); }
  }

  // the ignition's Blasts as the pulse reaches each one
  blow(W) {
    if (!this.blasts.length) return;
    const R = this.run, E = R.enemies, G = R.fx.glow, amount = R.power * W.dmg;
    let hits = 0, n = 0;
    while (this.blasts.length && this.blasts[0].at <= this.clock) {
      const b = this.blasts.shift(); n++;
      _p.set(b.x, b.y + W.blast * 0.25, b.z);
      G.emit(_p, this.flareColor, W.blast * 0.9, W.blast * 2.2, 0.14, 1.1);
      G.emit(_p, n % 2 ? this.freshColor : this.oldColor, W.blast * 1.2, W.blast * 2.6, 0.3, 0.7);
      for (let k = 0; k < 2; k++) { _v.set(Math.random() - 0.5, 1.2, Math.random() - 0.5).multiplyScalar(0.12); G.emit(_p, this.freshColor, 0.0025, 0.0005, 0.35, 1, _v, 0.6); }
      for (const e of E.list) {
        if (e.dead || e.under || e.proxy?.immune || this.hit.has(e.id)) continue;
        if (E.center(e, _c).distanceTo(_p) - (e.hitR || e.r) > W.blast) continue;
        this.hit.add(e.id); hits++;
        bus.emit('damage_taken', { targetId: e.id, amount, color: LOOK.color('wake-fresh', '#1ccfe8'), source: 'wake', feedback: { dir: _v.set(_c.x - b.x, 0, _c.z - b.z).normalize().clone() } });
      }
      sfx.chainZap(n % 3);
    }
    if (hits) { juice.feel('hit'); sfx.pop(true); }
    if (!this.blasts.length) R.fx.impact(_p, this.flareColor, W.blast * 0.5, 6);   // the far end: a last bright pop
  }

  // bugs walking in the trail are slowed; flyers pass over it
  wade(W) {
    const R = this.run, E = R.enemies, P = this.points;
    if (!P.length) return;
    for (const e of E.list) {
      if (e.dead || e.under || e.T?.fly || e.proxy?.immune) continue;
      const pos = e.pos, r = (e.hitR || e.r) * 0.6 + W.radius;
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i];
        if (q.lit >= 0 || Math.abs(pos.y - q.y) > 0.03 || Math.abs(pos.x - q.x) > r || Math.abs(pos.z - q.z) > r) continue;
        if ((pos.x - q.x) ** 2 + (pos.z - q.z) ** 2 > r * r) continue;
        bus.emit('status_applied', { targetId: e.id, status: 'wade', duration: 0.25, more: W.slow });
        break;
      }
    }
  }

  // run.js after moving: rewrite the strip only when the trail changed
  draw() {
    const W = this.run.mods.wake, g = this.mesh.geometry, P = this.points;
    this.mesh.visible = !!W && P.length > 1;
    if (!W || !this.dirty) return;
    this.dirty = false;
    const r = W.radius, pos = g.attributes.position, uv = g.attributes.uv, born = g.attributes.born, lit = g.attributes.lit;
    let v = 0;
    for (let i = 1; i < P.length && v + VERTS <= MAX * VERTS; i++) {
      const a = P[i - 1], b = P[i];
      if (b.cut || (a.lit < 0) !== (b.lit < 0)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1e-6, ux = dx / len, uz = dz / len, nx = -uz * r, nz = ux * r;
      const e = r * 0.08, ax = a.x - ux * e, az = a.z - uz * e, bx = b.x + ux * e, bz = b.z + uz * e;   // a touch of overlap: no seams
      const C = [ax - nx, a.y, az - nz, bx - nx, b.y, bz - nz, bx + nx, b.y, bz + nz, ax + nx, a.y, az + nz];
      for (const k of TRI) {
        const end = k === 1 || k === 2 ? b : a;
        pos.setXYZ(v, C[k * 3], C[k * 3 + 1], C[k * 3 + 2]);
        uv.setXY(v, k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0);
        born.setX(v, end.t); lit.setX(v++, end.lit);
      }
    }
    g.setDrawRange(0, v);
    if (v) for (const a of Object.values(g.attributes)) { a.clearUpdateRanges(); a.addUpdateRange(0, v * a.itemSize); a.needsUpdate = true; }
  }

  warm(on, at) {
    if (!on) { this.reset(); return; }
    const W = this.run.mods;
    const was = W.wake; W.wake = { time: 4, radius: 0.018 };
    this.points.push({ x: at.x, y: at.y, z: at.z, t: 0, lit: -1, cut: true }, { x: at.x + 0.03, y: at.y, z: at.z, t: 0, lit: -1, cut: false });
    this.dirty = true; this.draw(); this.mesh.visible = true;
    W.wake = was;
  }
}
