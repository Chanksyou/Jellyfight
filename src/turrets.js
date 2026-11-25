// Jelly Mould (the turret word): little jellies set down on the floor that fire the jelly type's own attack
// (bubbles.js turretShot: its starting numbers, none of the run's Treasures) at the jelly's Fire rate and
// Range. Each has its own Health: ordinary bugs nearer one than the jelly go for it (enemies.update decoys),
// their hits land on it (run.js hands them over while enemies.striking) and so do their touches.
// One draw for all of them: an instanced bell, legs, eyes and a floor puddle in one shader (no light, rule 7).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

const MAX = 6;
const _down = new THREE.Vector3(0, -1, 0), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _y = new THREE.Vector3(0, 1, 0);

// the little jelly, R wide and H tall, its front +z: part 0 bell, 1 legs, 2 puddle, 3 eyes
function shape(R, H) {
  const tag = (g, part) => { g.setAttribute('part', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1)); return g; };
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.0005, R * Math.sin(a)), H * 0.42 + H * 0.58 * Math.cos(a))); }
  prof.push(new THREE.Vector2(R * 1.06, H * 0.37), new THREE.Vector2(R * 0.92, H * 0.33), new THREE.Vector2(R * 0.55, H * 0.36));
  const bell = new THREE.LatheGeometry(prof, 32), bp = bell.attributes.position;
  for (let i = 0; i < bp.count; i++) {   // lobes down the bell and a ruffled rim
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.045 * Math.cos(8 * a);
    bp.setXYZ(i, x * k, y + (y < H * 0.45 ? 0.0025 * Math.sin(8 * a + 0.6) : 0), z * k);
  }
  bell.computeVertexNormals();
  const legs = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.2, h = H * 0.4, g = new THREE.CylinderGeometry(R * 0.15, R * 0.3, h, 6, 4, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = 1 - (p.getY(i) + h / 2) / h, out = R * 0.42 + t * t * R * 0.55;   // t: 0 at the bell, 1 on the floor, splaying out
      p.setXYZ(i, p.getX(i) + Math.cos(a) * out, p.getY(i) + h / 2, p.getZ(i) + Math.sin(a) * out);
    }
    g.computeVertexNormals();
    legs.push(tag(g, 1));
  }
  const pool = new THREE.CircleGeometry(R * 1.7, 36).rotateX(-Math.PI / 2), pp = pool.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), k = 1 + 0.12 * Math.sin(7 * Math.atan2(z, x)); pp.setXYZ(i, x * k, 0.0008, z * k); }
  const eyes = [-0.34, 0.34].map((a) => tag(new THREE.SphereGeometry(R * 0.13, 8, 6).translate(Math.sin(a) * R * 0.96, H * 0.5, Math.cos(a) * R * 0.96), 3));
  return mergeGeometries([tag(bell, 0), ...legs, tag(pool, 2), ...eyes]);
}

export class Turrets {
  constructor(run) {
    this.run = run;
    this.list = [];
    const R = this.R = LOOK.num('turret-radius', 0.022), H = this.H = LOOK.num('turret-height', 0.05);
    const g = shape(R, H);
    this.state = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aState', this.state);
    this.cool = new THREE.Color(LOOK.color('turret-cool', '#4fe6ff'));
    this.deep = new THREE.Color(LOOK.color('turret-deep', '#9a5cff'));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        cool: { value: this.cool }, deep: { value: this.deep },
        core: { value: new THREE.Color(LOOK.color('turret-core', '#f2c8ff')) },
        glow: { value: LOOK.num('turret-glow', 0.75) }, height: { value: H }, clock: { value: 0 },
      },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float part; attribute vec4 aState;
        varying vec3 vN, vV, vL; varying float vPart; varying vec4 vS;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          vL = position; vPart = part; vS = aState;
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform vec3 cool, deep, core; uniform float glow, height, clock;
        varying vec3 vN, vV, vL; varying float vPart; varying vec4 vS;
        void main() {
          #include <logdepthbuf_fragment>
          float rim = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0), h = clamp(vL.y / height, 0.0, 1.0);
          vec3 col; float a;
          if (vPart > 2.5) { col = vec3(0.05, 0.03, 0.12) + rim * 0.5 * cool; a = 1.0; }                    // eyes
          else if (vPart > 1.5) {                                                                           // the puddle it stands in
            float r = length(vL.xz) / (height * 0.85);
            col = mix(cool, deep, r); a = (1.0 - smoothstep(0.35, 1.0, r)) * 0.5;
          } else {
            float vein = pow(0.5 + 0.5 * sin(atan(vL.z, vL.x) * 8.0 + h * 7.0 + clock * 1.5), 6.0);   // glowing veins drifting through it
            col = mix(deep, cool, smoothstep(0.3, 0.9, h)) * (0.7 + 0.5 * rim) + core * vein * 0.35;
            a = vPart > 0.5 ? 0.35 + 0.4 * rim : 0.45 + 0.45 * rim;
          }
          col += cool * vS.y * 0.9;                       // charging: brighter as its next shot comes
          col = mix(col, vec3(1.0), vS.z);                // hurt: a white flash
          gl_FragColor = vec4(col * glow, min(1.0, a + vS.y * 0.2) * vS.x);
        }`,
      transparent: true, depthWrite: false, toneMapped: false,
    });
    this.uniforms = material.uniforms;
    this.mesh = new THREE.InstancedMesh(g, material, MAX);
    this.mesh.name = 'Turrets'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    run.scene.add(this.mesh);
  }

  reset() { this.list.length = 0; this.mesh.count = 0; this.clock = 0; }

  // the turret word going off (gadgets.js fire): a little jelly on the floor under `at`
  place(at, ef) {
    const R = this.run, kind = R.attack?.kind ?? 'bubble';
    if (kind === 'tentacle') return;   // no shot to give it (the treasure is not-for="tentacle")
    while (this.list.length >= Math.min(ef.most, MAX)) this.end(this.list[0], false);
    const hit = R.world.castAll(_p.copy(at).setY(at.y + 0.01), _down, 2), y = hit ? hit.point.y : at.y;
    const T = {
      position: new THREE.Vector3(at.x, y, at.z), center: new THREE.Vector3(at.x, y + this.H * 0.55, at.z),
      range: LOOK.num('turret-lure', 0.3), takes: true,   // a decoy (enemies.update) that takes the hits aimed at it
      health: ef.health, t: ef.time, dmg: ef.dmg, age: 0, timer: 0, noHurt: 0, flash: 0, kick: 0, face: R.player.facing ?? 0,
      hurt: (n) => this.hurt(T, n),
    };
    this.list.push(T);
    R.fx.burst(_p.copy(T.center), ['#' + this.cool.getHexString(), '#' + this.deep.getHexString(), '#ffffff'], 8, 0.004, 0.3, y);
    R.fx.puff(T.center, this.cool.getHex(), this.R * 1.6, 0.3);
    sfx.jump();
  }

  // a bug's hit or touch: Health off, a white flash, then a moment it can't be hurt (as the jelly's own)
  hurt(T, n) {
    if (T.health <= 0 || T.noHurt > 0 || !(n > 0)) return;
    T.health -= n; T.noHurt = LOOK.num('turret-no-hurt', 0.25); T.flash = 1;
    const fx = this.run.fx;
    fx.number(_p.copy(T.center).setY(T.center.y + this.H * 0.6), String(Math.round(n * 10) / 10), LOOK.color('turret-hurt', '#ffffff'), 11);
    fx.burst(_p.copy(T.center), ['#' + this.cool.getHexString(), '#ffffff'], 4, 0.003, 0.2, T.position.y);
    if (T.health <= 0) this.end(T, true);
    else sfx.pop(false);
  }

  // gone: time up (it melts away), or popped by the bugs (a burst of jelly)
  end(T, popped) {
    const i = this.list.indexOf(T);
    if (i < 0) return;
    this.list.splice(i, 1);
    T.health = 0;
    const fx = this.run.fx;
    fx.burst(_p.copy(T.center), ['#' + this.cool.getHexString(), '#' + this.deep.getHexString()], popped ? 14 : 6, 0.004, 0.35, T.position.y);
    fx.puff(T.center, this.deep.getHex(), this.R * (popped ? 2.4 : 1.6), 0.35);
    fx.splat(_p.copy(T.position), this.deep.getHex(), this.R * 1.4);
    sfx.pop(popped);
    if (popped) juice.feel('hit');
  }

  // ordinary bugs touching it hurt it, as they would the jelly (run.js contactDamage)
  touches(T) {
    const E = this.run.enemies, power = this.run.stage.power || 1;
    for (const e of E.list) {
      if (e.dead || e.proxy || e.freezeT > 0 || e.under || e.airborne || !e.T.dmg) continue;
      if (E.center(e, _c).distanceTo(T.center) < (e.hitR || e.r) + this.R) { T.hurt((e.state === 'dash' && e.T.rollDmg ? e.T.rollDmg : e.T.dmg) * power); if (T.health <= 0) return; }
    }
  }

  update(dt) {
    const R = this.run;
    if (!this.list.length) { this.mesh.count = 0; return; }
    if (!['explore', 'boss'].includes(R.phase) || R.polypT > 0) { this.reset(); return; }
    if (dt <= 0) return;
    this.clock += dt;
    const kind = R.attack?.kind ?? 'bubble', S = R.S, fireRate = S.fireRate;
    for (const T of [...this.list]) {
      T.age += dt; T.t -= dt; T.noHurt -= dt;
      T.flash = Math.max(0, T.flash - dt * 8); T.kick = Math.max(0, T.kick - dt * 5);
      if (T.t <= 0) { this.end(T, false); continue; }
      this.touches(T);
      if (T.health <= 0) continue;
      T.timer = Math.min(1, T.timer + dt * fireRate);   // the jelly's own Fire rate: one shot a beat of it
      if (T.timer < 1 || T.age < 0.25) continue;
      const m = _p.set(Math.sin(T.face) * this.R * 0.9, this.H * 0.55, Math.cos(T.face) * this.R * 0.9).add(T.position);
      const e = R.bubbles.turretShot(m, kind, S, T.dmg);
      T.idle = !e;
      if (!e) continue;   // ready, waiting for something in Range (no charging glow meanwhile)
      T.timer -= 1; T.kick = 1;
      const to = R.enemies.center(e, _c);
      T.face = Math.atan2(to.x - T.position.x, to.z - T.position.z);
      R.fx.glow.emit(m, this.cool, this.R * 0.7, this.R * 0.2, 0.1, 1.1);
    }
    this.draw();
  }

  // the instances: popping up, breathing, squashing as each shot leaves, melting away at the end
  draw() {
    const calm = juice.calm, st = this.state.array, n = Math.min(this.list.length, MAX);
    this.uniforms.clock.value = calm ? 0 : this.clock;
    for (let i = 0; i < n; i++) {
      const T = this.list[i], up = Math.min(1, T.age / 0.25), pop = up < 1 ? 1 - (1 - up) ** 3 * (1 - 2.5 * up) : 1;
      const fade = Math.min(1, T.t / 0.4), breathe = calm ? 0 : Math.sin(T.age * 4) * 0.04;
      const k = pop * (0.6 + 0.4 * fade), sq = T.kick * 0.2;
      _q.setFromAxisAngle(_y, T.face);
      _m.compose(T.position, _q, _s.set(k * (1 + sq * 0.5 - breathe * 0.5), k * (1 - sq + breathe), k * (1 + sq * 0.5 - breathe * 0.5)));
      this.mesh.setMatrixAt(i, _m);
      st[i * 4] = fade; st[i * 4 + 1] = T.idle ? 0 : Math.max(0, (T.timer - 0.8) / 0.2); st[i * 4 + 2] = T.flash; st[i * 4 + 3] = T.kick;
    }
    this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.state.needsUpdate = true; }
  }

  // main.js warmUp: one shown for a frame so its shader is built before play
  warm(on, at) {
    if (!on) { this.reset(); return; }
    this.list.push({ position: at.clone(), center: at.clone(), health: 1, t: 1, age: 1, timer: 0, flash: 0, kick: 0, face: 0 });
    this.draw();
    this.list.length = 0;
  }
}
