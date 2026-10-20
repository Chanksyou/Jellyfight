// A two-second history of collision-resolved walking, not a line between old player positions.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { knockFor } from './stats.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const DOWN = new THREE.Vector3(0, -1, 0), MAX = 1024, VERTS = 18;
const TRI = [0, 1, 2, 0, 2, 3];
export class FireTrail {
  constructor(run) {
    this.run = run;
    this.segments = []; this.pool = [];
    this.probe = new THREE.Vector3(); this.end = new THREE.Vector3();
    this.center = new THREE.Vector3(); this.closest = new THREE.Vector3(); this.dir = new THREE.Vector3();
    this.corners = new Float32Array(12);
    const geometry = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['uv', 2], ['born', 1], ['span', 1], ['flame', 1]]) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(MAX * VERTS * size), size).setUsage(THREE.DynamicDrawUsage));
    }
    const material = new THREE.ShaderMaterial({
      uniforms: {
        clock: { value: 0 }, life: { value: 2 }, radius: { value: 0.025 },
        fade: { value: LOOK.num('cinder-fade-time', 0.3) },
        core: { value: new THREE.Color(LOOK.color('cinder-core', '#e6fcff')) },
        edge: { value: new THREE.Color(LOOK.color('cinder-edge', '#4276ed')) },
        fire: { value: new THREE.Color(LOOK.color('cinder-flame', '#55caff')) },
      },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float born, span, flame;
        varying vec2 vUv; varying vec3 vWorld; varying float vBorn, vSpan, vFlame;
        void main() { vUv=uv; vWorld=position; vBorn=born; vSpan=span; vFlame=flame;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform float clock, life, radius, fade;
        uniform vec3 core, edge, fire;
        varying vec2 vUv; varying vec3 vWorld; varying float vBorn, vSpan, vFlame;
        void main() {
          #include <logdepthbuf_fragment>
          float age=clock-vBorn; if(age>=life) discard;
          float flicker=0.5+0.25*sin(vWorld.x*140.0+vWorld.z*180.0-clock*13.0)+0.25*sin(vWorld.x*67.0-vWorld.z*89.0+clock*9.0);
          float heat, alpha;
          if(vFlame<0.5) {
            float along=vUv.x*(vSpan+2.0*radius)-radius;
            float d=length(vec2(along-clamp(along,0.0,vSpan),(vUv.y*2.0-1.0)*radius))/radius;
            if(d>1.0) discard;
            heat=(1.0-d)*(0.55+0.45*flicker); alpha=(1.0-smoothstep(0.7,1.0,d))*(0.2+0.3*flicker);
          } else {
            float tip=0.4+0.6*flicker;
            if(vUv.y>tip) discard;
            heat=1.0-vUv.y/tip; alpha=heat*0.8;
          }
          vec3 color=mix(edge,fire,heat); color=mix(color,core,pow(heat,4.0));
          gl_FragColor=vec4(color,alpha*min(1.0,(life-age)/fade));
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'FireTrail'; this.mesh.frustumCulled = false;
    run.scene.add(this.mesh);
    this.onWalk = (from, dir, length) => this.record(from, dir, length);
    this.reset();
  }
  reset() {
    this.pool.push(...this.segments); this.segments.length = 0;
    this.clock = this.tickT = 0; this.config = null;
    this.mesh.visible = false; this.mesh.geometry.setDrawRange(0, 0);
  }
  record(from, dir, length) {
    const Q = this.config;
    if (!Q || length <= 1e-8) return;
    const n = Math.ceil(length / (Q.radius * 0.5)), stride = length / n;
    for (let i = 0; i < n; i++) {
      const a = this.probe.copy(from).addScaledVector(dir, i * stride);
      a.y += 0.008;
      const start = this.run.world.cast(a, DOWN, 0.016);
      if (!start || start.normal.y < 0.7) continue;
      const ay = start.point.y;
      const b = this.end.copy(from).addScaledVector(dir, (i + 1) * stride);
      this.probe.copy(b).y += 0.008;
      const end = this.run.world.cast(this.probe, DOWN, 0.016);
      if (!end || end.normal.y < 0.7 || Math.abs(end.point.y - ay) > 0.008) continue;
      const last = this.segments.at(-1), sx = from.x + dir.x * i * stride, sz = from.z + dir.z * i * stride;
      if (last && last.time === this.clock && Math.hypot(last.b.x - sx, last.b.z - sz) < 1e-8 && Math.abs(last.b.y - ay - 0.001) < 1e-5) {
        const dx = last.b.x - last.a.x, dz = last.b.z - last.a.z;
        if (Math.abs(dx * dir.z - dz * dir.x) < 1e-8 && dx * dir.x + dz * dir.z > 0) {
          last.b.copy(b).y = end.point.y + 0.001; continue;
        }
      }
      let s = this.pool.pop();
      if (!s && this.segments.length >= MAX) s = this.segments.shift();
      s ||= { a: new THREE.Vector3(), b: new THREE.Vector3() };
      s.a.copy(from).addScaledVector(dir, i * stride).y = ay + 0.001;
      s.b.copy(b).y = end.point.y + 0.001;
      s.time = this.clock;
      this.segments.push(s);
    }
    if (this.segments.length) sfx.cinderStep();
  }
  update(dt) {
    const R = this.run, Q = R.mods.fireTrail;
    if (!Q || !['explore', 'boss'].includes(R.phase) || R.polypT > 0) { this.reset(); return; }
    this.config = Q;
    if (dt <= 0) return;
    this.clock += dt;
    while (this.segments.length && this.clock - this.segments[0].time >= Q.time - 1e-8) this.pool.push(this.segments.shift());
    this.tickT += dt;
    if (this.tickT + 1e-8 < Q.tick) return;
    this.tickT = Math.max(0, this.tickT - Q.tick);
    const damage = R.power * Q.dps * Q.tick, height = Q.height;
    let hit = false;
    for (const e of R.enemies.list) {
      if (e.dead) continue;
      const c = R.enemies.center(e, this.center), er = e.hitR || e.r;
      for (const s of this.segments) {
        this.dir.copy(s.b).sub(s.a);
        const k = THREE.MathUtils.clamp(this.closest.copy(c).sub(s.a).dot(this.dir) / Math.max(1e-12, this.dir.lengthSq()), 0, 1);
        this.closest.copy(s.a).addScaledVector(this.dir, k);
        if (c.y + er < this.closest.y || c.y - er > this.closest.y + height) continue;
        if (Math.hypot(c.x - this.closest.x, c.z - this.closest.z) > Q.radius + er) continue;
        const at = this.closest;
        this.dir.copy(c).sub(at).setY(0);
        if (this.dir.lengthSq() < 1e-10) this.dir.set(s.a.z - s.b.z, 0, s.b.x - s.a.x);
        this.dir.normalize();
        R.fx.impact(at, LOOK.color('cinder-core', '#e6fcff'), Q.radius * 0.3, 4);
        bus.emit('knockback', { targetId: e.id, dir: this.dir, force: knockFor(damage) });
        bus.emit('damage_taken', { targetId: e.id, amount: damage, source: 'fire-trail', sound: 'fire', color: LOOK.color('cinder-flame', '#55caff'), feedback: { tick: true, element: 'fire' } });
        hit = true; break;   // intersections and retraced paths do not multiply damage
      }
    }
    if (hit) { R.player.avatar?.pulse(0.15); juice.feel('hit'); sfx.cinderHit(); }
  }
  draw() {
    const Q = this.config, g = this.mesh.geometry;
    this.mesh.visible = !!Q && this.segments.length > 0;
    if (!Q) return;
    let v = 0;
    const corners = this.corners;
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, born, span, flame) => {
      corners[0]=ax; corners[1]=ay; corners[2]=az; corners[3]=bx; corners[4]=by; corners[5]=bz;
      corners[6]=cx; corners[7]=cy; corners[8]=cz; corners[9]=dx; corners[10]=dy; corners[11]=dz;
      for (const k of TRI) {
        g.attributes.position.setXYZ(v, corners[k*3], corners[k*3+1], corners[k*3+2]);
        g.attributes.uv.setXY(v, k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0);
        g.attributes.born.setX(v, born); g.attributes.span.setX(v, span); g.attributes.flame.setX(v++, flame);
      }
    };
    const h = Q.height, r = Q.radius;
    for (const s of this.segments) {
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const nx = -uz * r, nz = ux * r, ax = s.a.x - ux * r, az = s.a.z - uz * r, bx = s.b.x + ux * r, bz = s.b.z + uz * r;
      quad(ax-nx,s.a.y,az-nz, bx-nx,s.b.y,bz-nz, bx+nx,s.b.y,bz+nz, ax+nx,s.a.y,az+nz, s.time,len,0);
      for (let side = -0.4; side <= 0.4; side += 0.8) quad(s.a.x+nx*side,s.a.y,s.a.z+nz*side, s.b.x+nx*side,s.b.y,s.b.z+nz*side, s.b.x+nx*side,s.b.y+h,s.b.z+nz*side, s.a.x+nx*side,s.a.y+h,s.a.z+nz*side, s.time,len,1);
    }
    g.setDrawRange(0, v);
    if (v) for (const a of Object.values(g.attributes)) { a.clearUpdateRanges(); a.addUpdateRange(0, v * a.itemSize); a.needsUpdate = true; }
    const U = this.mesh.material.uniforms;
    U.clock.value = this.clock; U.life.value = Q.time; U.radius.value = r;
  }
  warm(on, at) {
    if (!on) { this.reset(); return; }
    this.config = { time: 2, radius: 0.025, height: 0.035 };
    this.segments.push({ a: at.clone(), b: at.clone().add(new THREE.Vector3(0.01, 0, 0)), time: 0 });
    this.draw();
  }
}
