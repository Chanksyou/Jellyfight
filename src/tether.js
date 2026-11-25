// tether (Tether Current): every Nth attack ties a beam from the jelly's middle to the first bug that
// attack hits (an Elite too, never the boss). It holds for its time, or until that bug dies or gets too
// far away, and every other bug it touches is cut by it. One draw: a strip whose shape (the line between
// the two ends, its wobble and its camera-facing width) is all worked out in the vertex shader, so
// nothing is uploaded per frame but uniforms. No light (CLAUDE.md rule 7).
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const SEGS = 40;
const HITS = new Set(['bubble', 'tentacle', 'splash', 'shards']);   // the attack's own hits, not a Treasure's or a status's
const _c = new THREE.Vector3(), _ab = new THREE.Vector3(), _q = new THREE.Vector3(), _end = new THREE.Vector3();

export class Tether {
  constructor(run) {
    this.run = run;
    const n = SEGS + 1, along = new Float32Array(n * 2), side = new Float32Array(n * 2), index = [];
    for (let i = 0; i < n; i++) {
      along[i * 2] = along[i * 2 + 1] = i / SEGS;
      side[i * 2] = -1; side[i * 2 + 1] = 1;
      if (i < SEGS) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));   // unused: the shader places every vertex
    g.setAttribute('along', new THREE.BufferAttribute(along, 1));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    g.setIndex(index);
    this.uniforms = {
      a: { value: new THREE.Vector3() }, b: { value: new THREE.Vector3() },
      clock: { value: 0 }, width: { value: LOOK.num('tether-width', 0.011) }, wobble: { value: LOOK.num('tether-wobble', 0.004) },
      motion: { value: 1 }, fade: { value: 1 }, snap: { value: 0 },
      core: { value: new THREE.Color(LOOK.color('tether-core', '#f2fdff')) },
      edge: { value: new THREE.Color(LOOK.color('tether-edge', '#4fd8ff')) },
      pulse: { value: new THREE.Color(LOOK.color('tether-pulse', '#a58bff')) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 a, b; uniform float clock, width, wobble, motion, snap;
        attribute float along, side;
        varying float vAlong, vSide, vLen;
        void main() {
          vec3 d = b - a; float L = max(length(d), 1e-4); vec3 dir = d / L;
          vec3 p = a + d * along;
          vec3 toCam = normalize(cameraPosition - p);
          vec3 s = cross(dir, toCam); s = length(s) > 1e-4 ? normalize(s) : vec3(0.0, 1.0, 0.0);
          vec3 up = cross(s, dir);
          float env = sin(3.14159265 * along), t = clock * motion;
          float w1 = sin(along * L * 95.0 - t * 23.0) * 0.6 + sin(along * L * 37.0 + t * 11.0) * 0.4;
          float w2 = sin(along * L * 61.0 - t * 17.0 + 1.7);
          p += (s * w1 + up * w2 * 0.6) * wobble * env * (1.0 + snap * 3.0);
          p += s * side * width * (0.75 + 0.25 * env);
          vAlong = along; vSide = side; vLen = L;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform float clock, motion, fade;
        uniform vec3 core, edge, pulse;
        varying float vAlong, vSide, vLen;
        void main() {
          #include <logdepthbuf_fragment>
          float x = abs(vSide), t = clock * motion;
          float coreK = exp(-x * x * 60.0), halo = exp(-x * x * 3.0) * (1.0 - x);
          float flow = pow(0.5 + 0.5 * sin(vAlong * vLen * 140.0 - t * 34.0), 8.0);   // packets of current running out to the bug
          float flick = 0.8 + 0.2 * sin(t * 61.0 + vAlong * 13.0);
          vec3 col = edge * halo * 1.3 + pulse * flow * halo * 1.4 + core * coreK * flick;
          float ends = smoothstep(0.0, 0.04, vAlong) * smoothstep(1.0, 0.96, vAlong);
          gl_FragColor = vec4(col * fade * mix(0.6, 1.0, ends), 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = 'Tether'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    run.scene.add(this.mesh);
    this.sparkCore = new THREE.Color(LOOK.color('tether-core', '#f2fdff'));
    this.sparkEdge = new THREE.Color(LOOK.color('tether-edge', '#4fd8ff'));
    // the first hit of the armed attack ties it; a round of stings hits before it counts as an attack, so the
    // last hit is kept for a moment too
    bus.on('damage_taken', (d) => this.hit(d));
    this.reset();
  }

  reset() {
    this.count = 0; this.armT = 0; this.last = null;
    this.target = null; this.t = 0; this.tickT = 0; this.clock = 0; this.fadeT = 0; this.sparkT = 0;
    this.mesh.visible = false;
  }

  // run.attacked(): one per volley, Element shot or round of stings
  attacked() {
    const T = this.run.mods.tether;
    if (!T) return;
    if (++this.count < T.every) return;
    this.count = 0;
    if (this.target) return;   // only one at a time: the count goes on, this one ties nothing
    if (this.last && this.clock - this.last.t < 0.05 && this.tie(this.last.id)) return;
    this.armT = LOOK.num('tether-arm-time', 1.5);   // the volley's bubbles are still flying
  }

  hit(d) {
    if (d.targetId === PLAYER || !HITS.has(d.source) || !this.run.mods.tether) return;
    this.last = { id: d.targetId, t: this.clock };
    if (this.armT > 0 && !this.target) this.tie(d.targetId);
  }

  tie(id) {
    const R = this.run, E = R.enemies, e = E.byId.get(id), T = R.mods.tether;
    if (!e || e.dead || e.under || e.boss || e.proxy?.immune) return false;
    this.armT = 0; this.target = e; this.t = T.time; this.tickT = 0; this.fadeT = 0;
    const at = E.center(e, _c);
    R.fx.impact(at, this.sparkEdge, 0.012, 6);
    sfx.chainZap(1);
    R.player.avatar?.pulse(0.3);
    return true;
  }

  // the jelly's middle, the beam's near end
  from(out) { const P = this.run.player.position; return out.set(P.x, P.y + this.run.cfg.height * 0.5, P.z); }

  update(dt) {
    const R = this.run, T = R.mods.tether;
    if (!T || !['explore', 'boss'].includes(R.phase) || R.polypT > 0) { if (this.target || this.mesh.visible) this.reset(); return; }
    if (dt <= 0) return;
    this.clock += dt;
    this.armT = Math.max(0, this.armT - dt);
    const U = this.uniforms;
    U.clock.value = this.clock; U.motion.value = juice.calm ? 0 : 1;
    const e = this.target;
    if (!e) {   // a broken beam flickers out in a moment
      if (this.fadeT > 0) { this.fadeT -= dt; U.fade.value = Math.max(0, this.fadeT / 0.12); U.snap.value = 1; }
      this.mesh.visible = this.fadeT > 0;
      return;
    }
    const E = R.enemies, a = this.from(U.a.value), b = E.center(e, U.b.value);
    this.t -= dt;
    if (e.dead || e.under || this.t <= 0 || a.distanceTo(b) > T.range) { this.snap(e.dead); return; }
    this.mesh.visible = true;
    U.fade.value = Math.min(1, this.t / 0.3) * (0.85 + 0.15 * Math.sin(this.clock * 40)); U.snap.value = 0;
    R.fx.glow.hold(a, this.sparkEdge, LOOK.num('tether-end-glow', 0.014), 0.5 * U.fade.value);   // both ends glow
    R.fx.glow.hold(b, this.sparkEdge, LOOK.num('tether-end-glow', 0.014) * 1.3, 0.6 * U.fade.value);
    if ((this.sparkT -= dt) <= 0) {   // sparks spitting off both ends
      this.sparkT = LOOK.num('tether-spark-every', 0.07);
      const G = R.fx.glow;
      for (const at of [a, b]) {
        _q.randomDirection().multiplyScalar(0.05);
        G.emit(at, Math.random() < 0.5 ? this.sparkCore : this.sparkEdge, 0.003, 0.0005, 0.18 + Math.random() * 0.12, 1, _q, 0.3);
      }
    }
    if ((this.tickT -= dt) > 0) return;
    this.tickT += T.tick;
    const amount = R.power * T.dps * T.tick, w = T.width;
    _ab.copy(b).sub(a);
    const L2 = Math.max(1e-10, _ab.lengthSq());
    let cut = false;
    for (const o of E.list) {
      if (o === e || o.dead || o.under || o.proxy?.immune) continue;
      const c = E.center(o, _c), k = THREE.MathUtils.clamp(_q.copy(c).sub(a).dot(_ab) / L2, 0, 1);
      _end.copy(a).addScaledVector(_ab, k);
      if (_end.distanceTo(c) > (o.hitR || o.r) + w) continue;
      bus.emit('damage_taken', { targetId: o.id, amount, color: LOOK.color('tether-edge', '#4fd8ff'), source: 'tether', feedback: { soft: true } });
      cut = true;
    }
    if (cut) sfx.gadgetStatic();
  }

  // the beam lets go: a crackle where it held, and it flickers out
  snap(died) {
    const e = this.target;
    if (e && !died) this.run.fx.impact(this.run.enemies.center(e, _c), this.sparkEdge, 0.008, 4);
    this.target = null; this.fadeT = 0.12;
    sfx.zap();
  }

  warm(on, at) {
    if (!on) { this.reset(); return; }
    this.uniforms.a.value.copy(at); this.uniforms.b.value.copy(at).x += 0.05;
    this.mesh.visible = true;
  }
}
