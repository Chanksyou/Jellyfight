// Enemies. The bugs of the living room (critters.js) are the waves: cockroaches, ant squads
// that curl into a ball and roll at you, and mosquitoes that hover out of reach and spit. The
// dust types (motes, bunnies, lint, hair) belong to the bathroom stage and the bosses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildRoach, buildAnts, buildMosquito, buildStapler } from './critters.js';
import { bus, PLAYER, nextId } from './events.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { CONTENT } from './content.js';

// what each type bursts into when it dies
const GUTS_BUILTIN = {
  roach: ['#4a2210', '#8a4a1c', '#b27a40', '#e8d070'], ants: ['#1c0a06', '#5a1a0c', '#3a1a10'],
  mosquito: ['#15151a', '#f4f4f0', '#b0202a', '#b0202a'], stapler: ['#26262c', '#c8ccd4', '#c0222c', '#d8dde4'], mote: ['#e9e1d2', '#d4cab8'], bunny: ['#8f887e', '#a59e94', '#c0392b'],
  lint: ['#8a9bb0', '#b4c2d2'], hair: ['#3b2618', '#5a3a24'],
};
// --guts-<type> in content/look.css overrides these
export const GUTS = Object.fromEntries(Object.entries(GUTS_BUILTIN).map(([k, v]) => [k, LOOK.list('guts-' + k, v)]));
const UP_AXIS = new THREE.Vector3(0, 1, 0);
export const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });

// The apartment is dark at night, so enemies stand out from it: each lit material gets a little
// glow in its own colors plus a warm rim light along its silhouette. Pass a material or a whole
// model (every lit material in it is patched once).
export function standOut(target, { base = 0.28, rim = 0.75 } = {}) {
  const rc = new THREE.Color(LOOK.color('rim-color', '#ffcc9e'));
  const patch = (m) => {
    if (!m || m.userData.standOut || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
    m.userData.standOut = true;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float soRim = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 2.5);
        totalEmissiveRadiance += diffuseColor.rgb * ${base.toFixed(3)} + vec3(${rc.r.toFixed(3)}, ${rc.g.toFixed(3)}, ${rc.b.toFixed(3)}) * soRim * ${rim.toFixed(3)};`);
    };
    m.customProgramCacheKey = () => `standOut${base}:${rim}`;
    m.needsUpdate = true;
  };
  if (target.isMaterial) patch(target);
  else target.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); });
  return target;
}

// The bug types come from content/enemies.kdl (numbers + behaviour words, see src/words.js)
export const TYPES = CONTENT.enemies;

const DOWN = new THREE.Vector3(0, -1, 0);

// Angry eyes: white eyeballs with small red-rimmed pupils and thick brows slanted down toward
// the middle. Built in "radius units" (the body is about 1 across) facing +z. The face sits on the
// enemy's root, not its body, so it keeps glaring at you while the fuzz rolls and spins.
const EYE = {
  white: new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.25, emissive: 0xfff4e6, emissiveIntensity: LOOK.num('eye-glow', 0.35) }),   // eyes catch the light in the dark
  iris: new THREE.MeshStandardMaterial({ color: 0xc8231c, roughness: 0.3, emissive: 0xff2a1a, emissiveIntensity: LOOK.num('iris-glow', 1.1) }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.2 }),
  brow: new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 0.8 }),
  ball: new THREE.SphereGeometry(1, 16, 12),
  brow_: new THREE.BoxGeometry(1, 1, 1),
  glow: new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffc23a, emissiveIntensity: 1.2 }),
  halo: new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.6, roughness: 0.3 }),
};
export function angryEyes({ y = 0.2, z = 0.78, size = 0.34, gap = 0.36, glow = false } = {}) {
  const face = new THREE.Group();
  const white = glow ? new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe28a, emissiveIntensity: 0.8 }) : EYE.white;
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * gap, y, z);
    eye.rotation.y = s * 0.25;
    face.add(eye);
    const ball = new THREE.Mesh(EYE.ball, white);
    ball.scale.set(size, size * 0.8, size * 0.55);
    eye.add(ball);
    const iris = new THREE.Mesh(EYE.ball, EYE.iris);
    iris.scale.set(size * 0.5, size * 0.45, size * 0.2);
    iris.position.set(-s * size * 0.12, -size * 0.12, size * 0.44);
    eye.add(iris);
    const pupil = new THREE.Mesh(EYE.ball, EYE.pupil);
    pupil.scale.set(size * 0.24, size * 0.24, size * 0.12);
    pupil.position.set(-s * size * 0.12, -size * 0.12, size * 0.58);
    eye.add(pupil);
    // the brow cuts across the top of the eye, low on the inside: the angry V
    const brow = new THREE.Mesh(EYE.brow_, EYE.brow);
    brow.scale.set(size * 2.3, size * 0.5, size * 0.5);
    brow.position.set(-s * size * 0.1, size * 0.62, size * 0.3);
    brow.rotation.z = s * 0.5;
    eye.add(brow);
  }
  return face;
}

// --- Fuzz: every enemy is built from a lumpy core, hundreds of fine fibers and a few bits
// caught in it (a thread, a crumb). Built once per type and merged into one mesh.
function rng(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }
function paint(geo, color) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { c[k * 3] = color.r; c[k * 3 + 1] = color.g; c[k * 3 + 2] = color.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// A bumpy ball whose shading varies with the bumps
function core(r, bump, dark, light, seed) {
  const g = new THREE.IcosahedronGeometry(r, 3), p = g.attributes.position, v = new THREE.Vector3();
  const n = (x, y, z) => Math.sin(x * 7.1 + seed) * Math.sin(y * 6.3 + seed * 2) * Math.sin(z * 8.7 + seed * 3) + 0.5 * Math.sin(x * 17 + y * 13 + z * 11 + seed);
  const c = new Float32Array(p.count * 3), a = new THREE.Color(dark), b = new THREE.Color(light), t = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k).normalize();
    const h = n(v.x, v.y, v.z);
    p.setXYZ(k, v.x * r * (1 + bump * h), v.y * r * (1 + bump * h), v.z * r * (1 + bump * h));
    t.copy(a).lerp(b, THREE.MathUtils.clamp(0.5 + h * 0.6, 0, 1));
    c[k * 3] = t.r; c[k * 3 + 1] = t.g; c[k * 3 + 2] = t.b;
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// Fine fibers sticking out of a ball of radius r. lie: 0 = straight out, 1 = lying flat on it.
function fibers(count, r, len, thick, colors, rand, lie = 0.3) {
  const out = [], up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), tan = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let k = 0; k < count; k++) {
    d.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    tan.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).cross(d).normalize();
    const dir = d.clone().lerp(tan, lie * (0.5 + rand() * 0.5)).normalize();
    const L = len * (0.5 + rand() * 0.7);
    const g = new THREE.CylinderGeometry(thick * 0.25, thick, L, 3, 1).translate(0, L / 2, 0);
    g.applyQuaternion(q.setFromUnitVectors(up, dir));
    g.translate(d.x * r * 0.9, d.y * r * 0.9, d.z * r * 0.9);
    out.push(paint(g, new THREE.Color(colors[(rand() * colors.length) | 0]).offsetHSL(0, 0, (rand() - 0.5) * 0.08)));
  }
  return out;
}
// A thread or hair: a thin tube along a wandering curve
function strand(points, thick, color, segs = 40) {
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, thick, 4), new THREE.Color(color));
}
function curl(rand, r, turns, spread) {
  const pts = [], a0 = rand() * 6.3, tilt = rand() * 3.1;
  for (let k = 0; k <= 24; k++) {
    const t = k / 24, a = a0 + t * turns * Math.PI * 2, rr = r * (0.7 + 0.5 * Math.sin(t * 5 + a0));
    const p = new THREE.Vector3(Math.cos(a) * rr, (t - 0.5) * spread, Math.sin(a) * rr);
    pts.push(p.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
  }
  return pts;
}

const GEO = {};
// The shared fuzz geometry for an enemy type (the Dust King borrows the dust bunny's)
export function fuzzGeometry(type) { return (GEO[type] ||= buildGeometry(type)); }
function buildGeometry(type) {
  const rand = rng({ mote: 11, bunny: 23, lint: 37, hair: 51 }[type]);
  const parts = [];
  if (type === 'mote') {          // a pale wisp of dust
    parts.push(core(0.5, 0.25, '#b9ae9c', '#efe8da', 1));
    parts.push(...fibers(70, 0.5, 0.75, 0.035, ['#e9e1d2', '#d4cab8', '#fff8ea'], rand, 0.2));
  } else if (type === 'bunny') {  // a grey dust bunny with a red thread and a crumb caught in it
    parts.push(core(0.72, 0.3, '#6e6760', '#aaa399', 2));
    parts.push(...fibers(260, 0.72, 0.7, 0.04, ['#8f887e', '#a59e94', '#7a746c', '#bdb6ab'], rand, 0.35));
    parts.push(strand(curl(rand, 0.75, 1.3, 0.5), 0.025, '#c0392b'));
    parts.push(paint(new THREE.DodecahedronGeometry(0.14, 0).translate(0.45, 0.45, 0.35), new THREE.Color('#b08858')));
  } else if (type === 'lint') {   // a flat, pilled puff of dryer lint with a thread loop
    const c = core(0.8, 0.18, '#6f8296', '#a9b8c8', 3);
    c.scale(1, 0.55, 1);
    parts.push(c);
    for (let k = 0; k < 14; k++) {
      const a = rand() * 6.3, y = (rand() - 0.3) * 0.35;
      parts.push(paint(new THREE.IcosahedronGeometry(0.1 + rand() * 0.06, 1).translate(Math.cos(a) * 0.72, y, Math.sin(a) * 0.72), new THREE.Color('#c6d0dc').offsetHSL(0, 0, (rand() - 0.5) * 0.1)));
    }
    const f = fibers(160, 0.8, 0.55, 0.035, ['#8a9bb0', '#b4c2d2', '#76889c'], rand, 0.75);
    f.forEach((g) => g.scale(1, 0.6, 1));
    parts.push(...f);
    parts.push(strand(curl(rand, 0.6, 0.8, 0.2).map((p) => p.add(new THREE.Vector3(0.5, 0.15, 0))), 0.03, '#e7b73a'));
  } else {                        // hair: curly strands wrapped round a small clump
    parts.push(core(0.4, 0.3, '#2a1c14', '#4a3222', 4));
    for (let k = 0; k < 9; k++) parts.push(strand(curl(rand, 0.55 + rand() * 0.3, 1.5 + rand(), 0.8), 0.022, k < 7 ? (k % 2 ? '#3b2618' : '#5a3a24') : '#9a948e', 60));
    parts.push(...fibers(40, 0.4, 0.5, 0.03, ['#3b2618', '#5a3a24'], rand, 0.5));
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

function makeLooks() {
  const fuzz = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const glowFuzz = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0x3a3426, emissiveIntensity: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const body = (type, mat) => {
    const m = new THREE.Mesh(fuzzGeometry(type), mat);
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    return g;
  };
  // body: the fuzz (may spin and roll); face: where the angry eyes go
  return {
    mote: () => ({ body: body('mote', glowFuzz), face: angryEyes({ y: 0.15, z: 0.75, size: 0.4, gap: 0.38 }) }),
    bunny: () => ({ body: body('bunny', fuzz), face: angryEyes({ y: 0.3, z: 0.95 }) }),
    lint: () => ({ body: body('lint', fuzz), face: angryEyes({ y: 0.12, z: 0.85 }) }),
    hair: () => ({ body: body('hair', hairMat), face: angryEyes({ y: 0.2, z: 0.75 }) }),
    roach: buildRoach,
    ants: buildAnts,
    mosquito: buildMosquito,
    stapler: buildStapler,
    fuzz, glowFuzz, hairMat,
  };
}

export class Enemies {
  constructor(scene, world, fx) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.list = [];
    this.looks = makeLooks();
    this.eliteMats = {};
    this.haloGeo = new THREE.TorusGeometry(0.7, 0.08, 6, 24);
    this.byId = new Map();    // id -> enemy, for events that name their target
    this.shots = [];          // mosquito laser bolts (the spit word)
    // a bolt: a thin bright core inside a soft coloured glow, stretched along its flight
    const laser = new THREE.Color(LOOK.color('laser-color', '#ff2a4a')), len = LOOK.num('laser-length', 0.03);
    this.laserColor = laser;
    this.shotGeo = new THREE.CapsuleGeometry(0.0022, len, 4, 8).rotateX(Math.PI / 2);   // along +z
    this.shotMat = new THREE.MeshBasicMaterial({ color: laser.clone().lerp(new THREE.Color('#ffffff'), 0.65), toneMapped: false });
    this.glowGeo = new THREE.CapsuleGeometry(0.0055, len * 1.15, 4, 8).rotateX(Math.PI / 2);
    this.glowMat = new THREE.MeshBasicMaterial({ color: laser.clone().multiplyScalar(2), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    // aiming beams: while a mosquito dips to shoot, a beam (a bright core in a red glow) marks
    // where the bolt will go. Real geometry, since WebGL draws lines 1 pixel wide whatever you ask.
    const aw = LOOK.num('laser-aim-width', 0.006);
    this.aimCoreGeo = new THREE.CylinderGeometry(aw / 6, aw / 6, 1, 6, 1, true).rotateX(Math.PI / 2);   // 1 m long along +z
    this.aimGlowGeo = new THREE.CylinderGeometry(aw / 2, aw / 2, 1, 10, 1, true).rotateX(Math.PI / 2);
    this.aimBeams = [];       // pooled: one per mosquito aiming this frame
    // a staple: a thin steel U (the crown and two legs), 16 mm across
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    this.stapleGeo = mergeGeometries([box(0.016, 0.0018, 0.0018, 0, 0, 0), box(0.0018, 0.0018, 0.008, -0.0071, 0, -0.004), box(0.0018, 0.0018, 0.008, 0.0071, 0, -0.004)]);   // a little oversized, so you can see them coming
    this.stapleMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.85, roughness: 0.25, emissive: 0xb8c4d8, emissiveIntensity: 1.4, toneMapped: false });   // glints in the dark
    this.frame = 0;
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._c = { flatDir: new THREE.Vector3(), dir: new THREE.Vector3() };   // the frame every word sees

    // Everything that happens to an enemy arrives as an event; this system owns their HP,
    // status timers and position.
    bus.on('damage_taken', ({ targetId, amount, color }) => {
      if (targetId !== PLAYER) this.applyDamage(this.byId.get(targetId), amount, color);
    });
    bus.on('status_applied', ({ targetId, status, duration }) => {
      const e = this.byId.get(targetId);
      if (!e || e.dead || e.proxy) return;
      if (status === 'slow') e.slowT = Math.max(e.slowT || 0, duration);
      else if (status === 'mark') e.markT = Math.max(e.markT || 0, duration);
      else if (status === 'stun') e.stunT = Math.max(e.stunT || 0, duration);
      else if (status === 'freeze') e.freezeT = duration;
      else if (status === 'thaw') e.freezeT = 0;
      else if (status === 'chill') {
        // the second chill in a row freezes it solid
        e.chill = (e.chill || 0) + 1;
        if (e.chill >= 2) {
          e.chill = 0;
          e.freezeT = duration;
          bus.emit('enemy_frozen', { targetId, pos: this.center(e), r: e.r });
        }
      }
    });
    bus.on('knockback', ({ targetId, dir, force }) => {
      const e = this.byId.get(targetId);
      if (e && !e.dead && !e.proxy) e.pos.addScaledVector(dir, force);
    });
  }

  get alive() { return this.list.length; }

  // elite: 35% bigger, 2.2x health, 4x dew, gold, with a spinning halo and glowing eyes
  spawn(type, pos, hpScale = 1, elite = false) {
    let T = TYPES[type];
    const { body: mesh, face, anim } = this.looks[T.model || type]();
    const root = new THREE.Group();
    if (elite && !anim) {
      T = { ...T, dew: T.dew * 4, r: T.r * 1.35, dmg: T.dmg + 1 };
      hpScale *= 2.2;
      const m = mesh.children[0];
      this.eliteMats[type] ||= Object.assign(m.material.clone(), { emissive: new THREE.Color(0xffb020), emissiveIntensity: 0.35 });
      m.material = this.eliteMats[type];
      face.traverse((o) => { if (o.isMesh && o.material === EYE.white) o.material = EYE.glow; });
      const halo = new THREE.Mesh(this.haloGeo, EYE.halo);
      halo.name = 'halo';
      halo.rotation.x = Math.PI / 2;
      halo.position.y = T.r * 1.35;
      halo.scale.setScalar(T.r);
      root.add(halo);
    }
    mesh.scale.multiplyScalar(T.r);
    root.add(mesh, face);
    root.position.copy(pos);
    this.scene.add(root);
    batcher.track(root);                  // every part drawn instanced with the other bugs' (batch.js)
    const e = {
      id: nextId(), type, T, root, mesh, face, anim, elite, pos: root.position, r: T.r, shootT: 0, aimT: 0, hold: false,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale,
      vel: new THREE.Vector3(), vy: 0, grounded: false,
      state: 'approach', stateT: 0, dashDir: new THREE.Vector3(),
      slowT: 0, pop: 0, spawnT: 0, phase: Math.random() * 10, baseScale: mesh.scale.x,
    };
    mesh.scale.setScalar(0.001); // grows in
    face.scale.setScalar(0.001);
    for (const w of T.words) w.init?.(e);
    this.list.push(e);
    this.byId.set(e.id, e);
    return e;
  }

  // Sticky Note mark: a little yellow note above the enemy while it lasts; Ice Cube frost: a
  // pale blue tint on the eyes' whites is enough to read "frozen"
  markLook(e, dt) {
    e.markT = Math.max(0, (e.markT || 0) - dt);
    if (e.markT > 0 && !e.note) {
      this.noteGeo ||= new THREE.PlaneGeometry(1, 1);
      this.noteMat ||= new THREE.MeshStandardMaterial({ color: 0xffe45a, emissive: 0x6a5a00, side: THREE.DoubleSide, roughness: 0.8 });
      e.note = new THREE.Mesh(this.noteGeo, this.noteMat);
      e.note.scale.setScalar(e.r * 0.9);
      e.note.position.y = e.r * 2.3;
      e.note.rotation.z = 0.2;
      e.root.add(e.note);
    }
    if (e.note) e.note.visible = e.markT > 0;
    if (e.freezeT > 0 && !e.frost) {
      this.frostMat ||= new THREE.MeshStandardMaterial({ color: 0xcff6ff, emissive: 0x3a8aa8, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, roughness: 0.1 });
      this.frostGeo ||= new THREE.IcosahedronGeometry(1, 1);   // shared: one per enemy leaked GPU buffers
      e.frost = new THREE.Mesh(this.frostGeo, this.frostMat);
      e.frost.scale.setScalar(e.r * 1.25);
      e.frost.position.y = e.T.fly ? 0 : e.r;
      e.root.add(e.frost);
    }
    if (e.frost) e.frost.visible = e.freezeT > 0;
  }

  // Something else (a boss) that tentacles can target. obj needs position, r and damage(amount, color).
  addProxy(obj) {
    const e = { id: nextId(), proxy: obj, T: { fly: false }, get pos() { return obj.position; }, get r() { return obj.r; }, dead: false };
    this.list.push(e);
    this.byId.set(e.id, e);
    return e;
  }

  center(e, out = new THREE.Vector3()) {
    if (e.proxy?.center) return e.proxy.center(out);     // bosses know where their middle is
    return out.copy(e.pos).setY(e.pos.y + (e.T.fly ? 0 : e.r));
  }

  // (the damage_taken listener) elites and bosses keep their own HP
  applyDamage(e, amount, color = '#fff') {
    if (!e || e.dead) return;
    if (e.proxy) {
      e.proxy.damage(amount, color);
      if (e.proxy.dead) { e.dead = true; this.byId.delete(e.id); }
      return;
    }
    if (e.markT > 0) amount *= 1.5;       // Sticky Note
    e.hp -= amount;
    e.pop = 1;
    e.flashT = 0.07;                      // flashes white for a moment
    bus.emit('enemy_hit', { targetId: e.id, amount, color, pos: this.center(e) });
    if (e.hp <= 0) this.kill(e);
  }

  // Bursts, shakes and sounds are feedback.js's; the reward is run.js's
  kill(e, silent = false) {
    if (e.dead) return;
    e.dead = true;
    this.byId.delete(e.id);
    this.scene.remove(e.root);
    bus.emit('enemy_killed', { targetId: e.id, type: e.type, elite: !!e.elite, pos: this.center(e), floor: e.pos.y, r: e.r, dew: e.T.dew, silent });
  }

  clear() {
    for (const e of this.list) { e.dead = true; if (e.root) this.scene.remove(e.root); }
    this.list = [];
    this.byId.clear();
    this.shots.forEach((s) => this.scene.remove(s.m));
    this.shots = [];
  }

  // the spit word: `count` shots from e at `at` (the jelly's middle when it locked on), fanned
  // across `spread` degrees. A laser is a streak of light with a flash at the muzzle; a staple
  // is a little bent wire that tumbles as it flies.
  spit(e, at, { speed, life, dmg, count = 1, spread = 0, shot = 'laser', height = 0 }) {
    const from = this.center(e).add(S.ray.set(0, height * e.r, 0));
    const aim = at.clone().sub(from).normalize();
    for (let i = 0; i < count; i++) {
      const turn = count > 1 ? THREE.MathUtils.degToRad(spread) * (i / (count - 1) - 0.5) : 0;
      const v = aim.clone().applyAxisAngle(UP_AXIS, turn).multiplyScalar(speed);
      const staple = shot === 'staple';
      const m = batcher.track(new THREE.Mesh(staple ? this.stapleGeo : this.shotGeo, staple ? this.stapleMat : this.shotMat));
      if (!staple) m.add(new THREE.Mesh(this.glowGeo, this.glowMat));
      m.position.copy(from).addScaledVector(v, 0.03 / speed);           // leaves from in front of its mouth
      m.lookAt(m.position.clone().add(v));
      this.scene.add(m);
      this.shots.push({ m, v, t: life, dmg, spin: staple ? 18 + Math.random() * 8 : 0, source: staple ? 'staple' : 'spit' });
    }
    this.fx.puff(from.addScaledVector(aim, 0.03), shot === 'staple' ? 0xdfe6ee : this.laserColor.getHex(), 0.012, 0.12);
  }

  // the aiming beam of every mosquito about to fire (the spit word sets e.aimT, e.aimMax and e.aimAt):
  // it flickers, and burns brighter and steadier as the shot gets close
  drawAim(t) {
    let n = 0;
    for (const e of this.list) {
      if (e.dead || !(e.aimT > 0) || !e.aimAt || e.aimBeam === false) continue;
      let B = this.aimBeams[n];
      if (!B) {
        const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        B = new THREE.Mesh(this.aimGlowGeo, mat(this.laserColor.clone().multiplyScalar(1.6), 0.5));
        B.add(new THREE.Mesh(this.aimCoreGeo, mat(this.laserColor.clone().lerp(new THREE.Color('#ffffff'), 0.6).multiplyScalar(1.5), 1)));
        B.frustumCulled = B.children[0].frustumCulled = false;
        this.scene.add(B);
        this.aimBeams.push(B);
      }
      const a = e.pos, b = e.aimAt, len = a.distanceTo(b) + 0.03;   // runs a little past you
      B.position.copy(a);
      B.lookAt(b);
      B.translateZ(len / 2);
      B.scale.set(1, 1, len);
      const charge = 1 - e.aimT / (e.aimMax || 0.5);                // 0 when it starts aiming, 1 as it fires
      const flick = 0.75 + 0.25 * Math.abs(Math.sin(t * 40));
      B.material.opacity = (0.3 + 0.5 * charge) * flick;
      B.children[0].material.opacity = (0.55 + 0.45 * charge) * flick;
      B.visible = true;
      n++;
    }
    for (let i = n; i < this.aimBeams.length; i++) this.aimBeams[i].visible = false;
  }

  // Mosquito spit that reached the player this frame
  shotHits(pc, radius) {
    for (const s of this.shots) {
      if (s.done || s.m.position.distanceTo(pc) >= radius + 0.005) continue;
      s.done = true;
      this.fx.puff(s.m.position, s.spin ? 0xdfe6ee : this.laserColor.getHex(), 0.014, 0.2);
      bus.emit('damage_taken', { targetId: PLAYER, amount: s.dmg ?? 1, source: s.source || 'spit' });
    }
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.t -= dt;
      const step = s.v.length() * dt;
      if (this.world.cast(s.m.position, S.ray.copy(s.v).normalize(), step + 0.004)) { s.done = true; this.fx.puff(s.m.position, s.spin ? 0xdfe6ee : this.laserColor.getHex(), 0.01, 0.15); }   // scorches (or pings off) the wall
      s.m.position.addScaledVector(s.v, dt);
      if (s.spin) s.m.rotateX(s.spin * dt);              // staples tumble end over end
      if (s.t <= 0) s.done = true;
      if (s.done) this.scene.remove(s.m);
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  // player: { position, radius, height }
  update(dt, player, t) {
    this.frame++;
    const pace = this.pace ?? 1;   // bug-speed (treasures): every bug's speed
    const pc = this._o.copy(player.position).setY(player.position.y + player.height * 0.5);
    const list = this.list;

    for (const e of list) {
      if (e.dead || e.proxy) continue;
      e.spawnT = Math.min(1, e.spawnT + dt * 4);
      e.slowT = Math.max(0, e.slowT - dt);
      e.freezeT = Math.max(0, (e.freezeT || 0) - dt);
      this.markLook(e, dt);
      e.stunT = Math.max(0, (e.stunT || 0) - dt);                    // lightning
      const slow = (e.freezeT > 0 || e.stunT > 0 ? 0 : e.slowT > 0 ? 0.55 : 1) * pace;
      const toP = this._d.copy(pc).sub(this.center(e, tmp));
      const dist = toP.length();
      const near = dist < 1.4;

      // its behaviour words (content/enemies.kdl, src/words.js), in the order it lists them
      const c = this._c;
      c.dt = dt; c.t = t; c.pc = pc; c.slow = slow; c.dist = dist; c.near = near; c.toP = toP;
      c.flatDir.copy(toP).setY(0);
      c.flat = c.flatDir.length();
      c.flatDir.normalize();
      c.speed = 0;
      c.dir.set(0, 0, 0);
      if (!e.hold) for (const w of e.T.words) w.tick?.(e, c, this);
      if (!e.T.fly) {                        // ground bugs walk where their words point, with collision
        e.vel.x += (c.dir.x * c.speed - e.vel.x) * (1 - Math.exp(-8 * dt));
        e.vel.z += (c.dir.z * c.speed - e.vel.z) * (1 - Math.exp(-8 * dt));
        this.moveGround(e, dt, near);
      }

      // look at the player, pop when hit, grow in when spawned
      // turn smoothly toward the player (snapping every frame made them twitch up close)
      if (dist > e.r * 0.5) {
        let d = Math.atan2(pc.x - e.pos.x, pc.z - e.pos.z) - e.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.root.rotation.y += THREE.MathUtils.clamp(d * (1 - Math.exp(-10 * dt)), -6 * dt, 6 * dt);
      }
      e.pop = Math.max(0, e.pop - dt * 6);
      // white hit flash: swap every mesh to a flat white for a moment
      if (e.flashT > 0 || e.flashing) {
        e.flashT = Math.max(0, (e.flashT || 0) - dt);
        const on = e.flashT > 0;
        if (on !== !!e.flashing) {
          e.flashing = on;
          e.mesh.traverse((o) => { if (!o.isMesh) return; if (on) { o.userData.mat = o.material; o.material = FLASH; } else if (o.userData.mat) o.material = o.userData.mat; });
        }
      }
      let sc = e.baseScale * e.spawnT * (1 + e.pop * 0.35);
      if (e.state === 'windup') sc *= 1 + Math.sin(t * 60) * 0.08;
      e.mesh.scale.setScalar(sc);
      e.face.scale.setScalar(sc);
      if (e.elite) { const h = e.root.getObjectByName('halo'); if (h) h.rotation.z += dt * 3; }
      if (e.anim) e.anim(dt, e);
      else if (e.T.fly) e.mesh.rotation.x += dt * 2;
      else if (e.T.rolls) e.mesh.rotation.x += Math.hypot(e.vel.x, e.vel.z) * dt / e.r;
    }

    // keep them from stacking into one blob
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.proxy) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.proxy) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = (a.r + b.r) * 1.05;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-10 || Math.abs(a.pos.y - b.pos.y) > min) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.5 / d;
        a.pos.x -= dx * push; a.pos.z -= dz * push;
        b.pos.x += dx * push; b.pos.z += dz * push;
      }
    }

    this.updateShots(dt);
    this.drawAim(t);
    if (this.frame % 30 === 0) this.list = list.filter((e) => !e.dead);
  }

  moveGround(e, dt, near) {
    const w = this.world;
    const step = S.step.set(e.vel.x * dt, 0, e.vel.z * dt);
    const len = step.length();
    if (near && len > 1e-6) {
      const dir = S.dir.copy(step).divideScalar(len);
      const o = S.o.set(e.pos.x, e.pos.y + e.r, e.pos.z);
      const hit = w.cast(o, dir, e.r + len);
      if (hit) {
        const n = hit.normal; n.y = 0;
        if (n.lengthSq() > 1e-6) {
          n.normalize();
          step.addScaledVector(n, -step.dot(n));
          e.vel.addScaledVector(n, -e.vel.dot(n));
        }
        if (e.state === 'dash') { e.state = 'rest'; e.stateT = 0.6; }
      }
    }
    e.pos.add(step);

    // gravity and ground (every other frame per enemy to save rays)
    if (!near) return;
    e.vy = Math.max(-1, e.vy - 1.0 * dt);
    if ((this.frame + e.phase * 10) % 2 < 1 || !e.grounded) {
      const o = S.o.set(e.pos.x, e.pos.y + e.r, e.pos.z);
      const hit = w.cast(o, DOWN, e.r + Math.max(0.004, -e.vy * dt * 2));
      if (hit) { e.pos.y = hit.point.y; e.vy = 0; e.grounded = true; return; }
      e.grounded = false;
    }
    if (!e.grounded) e.pos.y += e.vy * dt;
  }
}

const tmp = new THREE.Vector3();
// scratch vectors for the per-frame movement code (no garbage per enemy per frame)
const S = { step: new THREE.Vector3(), dir: new THREE.Vector3(), o: new THREE.Vector3(), away: new THREE.Vector3(), spot: new THREE.Vector3(), want: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), ray: new THREE.Vector3() };
