// Short, harmless, exaggerated death animations. Reuses each bug's real model, sub-parts and
// prepared materials/batches (ModelPool restores detached parts and materials automatically).
// Zero per-frame Box3 traversals and zero hot-loop allocations: bounded body & part pools keep
// phone frame pacing flat even during crowd wipes.
import * as THREE from 'three';
import { batcher, HIDDEN } from './batch.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const _box = new THREE.Box3();
const _pbox = new THREE.Box3();
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();

const WEIGHT_MULT = { light: 1.2, mid: 1, heavy: 0.78 };
const FLYER_STYLES = new Set(['flutter', 'eye-pop', 'lantern-pop']);

function restoreMaterials(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.deathMat) { o.material = o.userData.deathMat; delete o.userData.deathMat; }
    else if (o.userData.mat) { o.material = o.userData.mat; }
  });
}

function swapMaterial(obj, mat) {
  if (!mat) return;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.deathMat) o.userData.deathMat = o.userData.mat || o.material;
    o.material = mat;
  });
}

function makeBodySlot() {
  return {
    active: false, root: null, mesh: null, style: 'crumple', cause: 'normal', weight: 1,
    r: 0.03, floor: 0, t: 0, life: 1.1, hang: 0.055, yaw: 0, boost: 1,
    localMinY: 0, boundR: 0.5, vy: 0, grounded: false, squash: 0,
    zapMatOn: 0, popped: false, sliced: false,
    origin: new THREE.Vector3(), pos: new THREE.Vector3(), dir: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    parts: [],        // limb records on the body (kept for crumple/curl/bicycle animations)
    fragments: [],    // detached part slots owned by this body
    eyes: null, eyesScale: new THREE.Vector3(1, 1, 1),
    splitB: null,
    get fragment() { return this.fragments[0] || null; },
  };
}

function makePartSlot() {
  return {
    active: false, mesh: null, owner: null, mode: 'pop',
    t: 0, delay: 0, life: 1.1, floor: 0, radius: 0.008, bounce: 0.42,
    bounces: 0, stuck: false, squash: 0, seed: 0,
    origin: new THREE.Vector3(), vel: new THREE.Vector3(),
    rot: new THREE.Euler(), rotVel: new THREE.Vector3(),
    baseScale: new THREE.Vector3(1, 1, 1),
    baseColor: new THREE.Color(1, 1, 1), hasColor: false,
  };
}

export class DeathRemains {
  constructor(scene, isLow = () => false) {
    this.scene = scene;
    this.isLow = isLow;
    this.list = [];
    this.detached = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.cap = LOOK.num('death-body-cap', 12);
    this.capLow = LOOK.num('death-body-cap-low', 6);
    this.partCap = LOOK.num('death-part-cap', 36);
    this.partCapLow = LOOK.num('death-part-cap-low', 14);
    this.life = LOOK.num('death-body-life', 1.1);
    this.hangTime = LOOK.num('death-hang-time', 0.055);
    this.bounce = LOOK.num('death-bounce', 0.42);
    this.overkillBoost = LOOK.num('death-overkill-boost', 1.45);
    this.zapTime = LOOK.num('death-zap-time', 0.22);
    this.pancakeY = LOOK.num('death-pancake-y', 0.07);
    this.pancakeXZ = LOOK.num('death-pancake-xz', 1.85);
    this.inflateScale = LOOK.num('death-inflate-scale', 1.48);
    this.flashMat = null;   // set by fx/enemies to share precompiled FLASH / fireAshMat / frostMat
    this.ashMat = null;
    this.frostMat = null;
    this.bodyPool = Array.from({ length: Math.max(12, this.cap) }, makeBodySlot);
    this.partPool = Array.from({ length: Math.max(36, this.partCap) }, makePartSlot);
    this._serial = 0;
  }

  get maxBodies() { return this.isLow() ? this.capLow : this.cap; }
  get maxParts() { return this.isLow() ? this.partCapLow : this.partCap; }
  get quiet() { return juice.calm || this.reducedMotion.matches; }

  // Measure a model's local Y bounds once at death spawn (replaces per-frame Box3 traversal).
  measureLocal(mesh) {
    _box.makeEmpty();
    mesh.updateMatrixWorld(true);
    _inv.copy(mesh.matrixWorld).invert();
    mesh.traverseVisible((o) => {
      if (!o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _pbox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(_inv);
      _box.union(_pbox);
    });
    if (_box.isEmpty()) return { minY: -0.5, boundR: 0.7 };
    const maxAbs = Math.max(
      Math.abs(_box.min.x), Math.abs(_box.max.x),
      Math.abs(_box.min.y), Math.abs(_box.max.y),
      Math.abs(_box.min.z), Math.abs(_box.max.z),
    );
    return { minY: _box.min.y, boundR: maxAbs * 1.05 };
  }

  // Adaptive detached-part allowance so mass AoE kills never spike CPU or instance counts.
  partBudgetFor(want, mustHaveOne = false) {
    const cap = this.maxParts;
    const used = this.detached.length;
    let allow = want;
    if (used >= cap * 0.78) allow = mustHaveOne ? 1 : 0;
    else if (used >= cap * 0.48) allow = Math.min(want, 2);
    return allow;
  }

  takePartSlot() {
    let slot = this.partPool.find((p) => !p.active);
    if (!slot || this.detached.length >= this.maxParts) {
      if (this.detached.length) this.freePart(this.detached[0]);
      slot = this.partPool.find((p) => !p.active);
    }
    return slot || null;
  }

  // Detach a single child mesh/group from a bug into the scene, tracked by Batcher (+0 draw calls).
  detachOne(piece, { owner = null, floor = 0, dir = null, r = 0.03, mode = 'pop', delay = 0, life = this.life, mat = null, boost = 1, index = 0 } = {}) {
    if (!piece || !piece.parent || piece.parent === this.scene) return null;
    const slot = this.takePartSlot();
    if (!slot) return null;
    if (mode === 'husk') piece.visible = true;
    this.scene.attach(piece);
    piece.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.ownDraw) o.layers.set(HIDDEN); });
    batcher.track(piece);
    if (mat) swapMaterial(piece, mat);

    const seed = (++this._serial * 1.6180339) % 100;
    const ang = (index * 2.39996 + seed) % (Math.PI * 2);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const spd = (0.28 + (seed % 1) * 0.24) * boost * Math.max(0.65, r / 0.035);

    slot.active = true;
    slot.mesh = piece;
    slot.owner = owner;
    slot.mode = mode;
    slot.t = 0;
    slot.delay = delay;
    slot.life = life;
    slot.floor = floor;
    slot.radius = Math.max(0.004, r * (mode === 'flutter' ? 0.14 : 0.24));
    slot.bounce = mode === 'flutter' ? 0.12 : mode === 'stick' ? 0 : this.bounce;
    slot.bounces = 0;
    slot.stuck = false;
    slot.squash = 0;
    slot.seed = seed;
    slot.origin.copy(piece.position);
    slot.baseScale.copy(piece.scale);
    slot.rot.copy(piece.rotation);
    slot.hasColor = !!piece.userData.color;
    if (slot.hasColor) slot.baseColor.copy(piece.userData.color);

    const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
    if (mode === 'husk') {
      slot.vel.set(0, 0, 0);
      slot.rotVel.set(0, 0, 0);
    } else if (mode === 'stick') {
      slot.vel.set(ca * spd * 0.45 + dx * 0.12, (0.48 + (seed % 0.18)) * boost, sa * spd * 0.45 + dz * 0.12);
      slot.rotVel.set(11 * boost, 2, 3);
    } else if (mode === 'flutter') {
      slot.vel.set(ca * spd * 0.8 + dx * 0.16, (0.24 + (seed % 0.14)) * boost, sa * spd * 0.8 + dz * 0.16);
      slot.rotVel.set((ca * 4), (7 + (seed % 4)) * (index % 2 ? 1 : -1), sa * 5);
    } else if (mode === 'corkscrew') {
      slot.vel.set(ca * 0.35 + dx * 0.25, 0.55 * boost, sa * 0.35 + dz * 0.25);
      slot.rotVel.set(14, 10, 18);
    } else if (mode === 'float-sink') {
      slot.vel.set(ca * 0.04, 0.12, sa * 0.04);
      slot.rotVel.set(1.5, 3, 1.5);
    } else if (mode === 'slipstream') {
      slot.vel.set(dx * 0.65 + ca * 0.18, 0.38 + (seed % 0.15), dz * 0.65 + sa * 0.18);
      slot.rotVel.set(10, 14, 12);
    } else if (mode === 'pinata') {
      slot.vel.set(ca * spd * 1.25, (0.45 + (seed % 0.25)) * boost, sa * spd * 1.25);
      slot.rotVel.set(12, 16, 12);
    } else if (mode === 'pancake-pop') {
      slot.vel.set(ca * spd * 1.35 + dx * 0.15, 0.14 * boost, sa * spd * 1.35 + dz * 0.15);
      slot.rotVel.set(9, 12, 9);
    } else if (mode === 'ice') {
      slot.vel.set(ca * spd * 1.15 + dx * 0.18, (0.36 + (seed % 0.2)) * boost, sa * spd * 1.15 + dz * 0.18);
      slot.rotVel.set(15, 13, 16);
    } else {
      // 'pop' / 'flicker' / shell pop: exaggerated upward-and-outward comedic arc
      const lift = LOOK.num('death-shell-lift', 0.28) * (1.25 + (seed % 0.45)) * boost;
      slot.vel.set(ca * spd + dx * 0.22, lift, sa * spd + dz * 0.22);
      slot.rotVel.set((7 + (seed % 6)) * (index % 2 ? 1 : -1), 5 + (seed % 4), (6 + (seed % 5)) * (index % 2 ? -1 : 1));
    }

    this.detached.push(slot);
    if (owner) owner.fragments.push(slot);
    return slot;
  }

  // Standalone part ejection for elemental kills (ice, glitter, acid/poison, wind) without adding a body to this.list.
  ejectParts(remains, { mode = 'pop', mat = null, dir = null, count = 3, boost = 1.1 } = {}) {
    if (this.quiet || !remains) return 0;
    const { root, rig, parts = [], r = 0.03, floor = 0 } = remains;
    const pool = [];
    if (rig?.props) for (const pr of rig.props) if (pr?.mesh && pr.mode !== 'husk') pool.push({ mesh: pr.mesh, mode: mode === 'float-sink' ? 'float-sink' : pr.mode || mode });
    if (rig?.detach) for (const d of rig.detach) if (d) pool.push({ mesh: d.mesh || d, mode });
    if (!pool.length && parts.length) pool.push({ mesh: parts[0], mode });
    const allow = this.partBudgetFor(Math.min(count, pool.length), false);
    if (!allow) return 0;
    root.updateMatrixWorld(true);
    let n = 0;
    for (let i = 0; i < pool.length && n < allow; i++) {
      const p = pool[i];
      if (!p.mesh?.visible) continue;
      if (this.detachOne(p.mesh, { owner: null, floor, dir, r, mode: p.mode, delay: i * 0.015, life: this.life * 0.95, mat, boost, index: i })) n++;
    }
    return n;
  }

  add({ root, mesh, parts = [], rig = null, style = 'crumple', weight = 'mid', r = 0.03, velocity, floor, cause = 'normal', dir = null, crit = false, overkill = 0 }) {
    if (this.quiet) return false;
    while (this.list.length >= this.maxBodies) this.free(this.list[0]);

    const c = this.bodyPool.find((b) => !b.active);
    if (!c) return false;

    // A previous hit may have left the model using the shared white flash material.
    restoreMaterials(root);
    for (const child of root.children) if (child !== mesh) child.visible = false;
    mesh.scale.setScalar(r);
    this.scene.add(root);
    batcher.track(root);

    // Direction of travel: prefer explicit killing-hit direction, else velocity, else facing
    if (dir && dir.lengthSq() > 1e-6) c.dir.copy(dir).setY(0);
    else if (velocity && velocity.lengthSq() > 1e-4) c.dir.copy(velocity).setY(0);
    else c.dir.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    if (c.dir.lengthSq() < 1e-6) c.dir.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    c.dir.normalize();

    const wMult = WEIGHT_MULT[weight] ?? 1;
    const isOverkill = crit || overkill > 0.5;
    const boost = (isOverkill ? this.overkillBoost : 1) * wMult;

    const { minY, boundR } = this.measureLocal(mesh);
    c.active = true;
    c.root = root;
    c.mesh = mesh;
    c.style = style;
    c.cause = cause;
    c.weight = wMult;
    c.r = r;
    c.floor = floor;
    c.t = 0;
    c.life = this.life * (cause === 'zap' ? 1.05 : 1);
    c.hang = cause === 'pancake' ? 0 : cause === 'slice' ? 0.12 : cause === 'balloon' ? 0.11 : this.hangTime;
    c.yaw = root.rotation.y;
    c.boost = boost;
    c.localMinY = minY;
    c.boundR = boundR;
    c.grounded = false;
    c.squash = 0;
    c.zapMatOn = 0;
    c.popped = false;
    c.sliced = false;
    c.origin.copy(root.position);
    c.pos.copy(root.position);
    c.fragments.length = 0;
    c.eyes = rig?.eyes || null;
    if (c.eyes) c.eyesScale.copy(c.eyes.scale);
    c.splitB = rig?.split?.[1] || null;

    // Initial body velocity based on cause & style
    const isFlyer = FLYER_STYLES.has(style);
    if (cause === 'whip') {
      c.vel.copy(c.dir).multiplyScalar(0.95 * boost);
      c.vel.y = 0.32 * boost;
    } else if (cause === 'bowl') {
      c.vel.copy(c.dir).multiplyScalar(0.75 * boost);
      c.vel.y = 0.52 * boost;
    } else if (cause === 'wall-splat') {
      c.vel.set(0, 0, 0);
    } else if (cause === 'pancake' || cause === 'zap' || cause === 'slice') {
      c.vel.set(0, 0, 0);
    } else if (style === 'belly-up' || style === 'curl-pop' || style === 'skin-shed') {
      c.vel.copy(c.dir).multiplyScalar(0.24 * boost);
      c.vel.y = (style === 'skin-shed' ? 0.46 : 0.34) * boost;
    } else if (isFlyer) {
      c.vel.copy(c.dir).multiplyScalar(0.16 * boost);
      c.vel.y = 0.08 * boost;
    } else {
      c.vel.copy(c.dir).multiplyScalar(0.18 * boost);
      c.vel.y = 0.12 * boost;
    }

    // Limb records (used by crumple, belly-up bicycle, curl-pop death-curl)
    const limbSrc = rig?.limbs?.length ? rig.limbs : (style === 'crumple' ? parts : []);
    c.parts.length = 0;
    for (let i = 0; i < limbSrc.length; i++) {
      const p = limbSrc[i];
      if (p) c.parts.push({ mesh: p, pos: p.position.clone(), rotation: p.rotation.clone() });
    }

    // Collect detachable anatomical parts (never detach during zap/slice until pop, except shell which stories check immediately)
    root.updateMatrixWorld(true);
    const detachList = [];
    const mustOne = style === 'shell' || style === 'bead-scatter';
    if (style === 'shell' && parts.length) {
      detachList.push({ mesh: parts[0], mode: cause === 'pancake' ? 'pancake-pop' : 'pop' });
    }
    if (rig?.props) {
      for (const pr of rig.props) {
        if (pr?.mesh && !detachList.some((x) => x.mesh === pr.mesh)) {
          const m = cause === 'pancake' && pr.mode !== 'husk' ? 'pancake-pop' : (pr.mode || 'pop');
          detachList.push({ mesh: pr.mesh, mode: m });
        }
      }
    }
    if (rig?.detach) {
      for (const d of rig.detach) {
        const mObj = d?.mesh || d;
        if (!mObj || detachList.some((x) => x.mesh === mObj)) continue;
        const m = cause === 'pancake' ? 'pancake-pop' : (d?.mode || (isFlyer ? 'flutter' : 'pop'));
        detachList.push({ mesh: mObj, mode: m });
      }
    }
    if (style === 'unravel' && rig?.eyes) {
      detachList.push({ mesh: rig.eyes, mode: 'pop' });
    }

    // Cap detached parts adaptively (more on overkill/crit, fewer when crowded)
    const wantParts = cause === 'slice' ? 0 : Math.min(detachList.length, isOverkill ? 6 : 4);
    const allow = this.partBudgetFor(wantParts, mustOne);
    for (let i = 0; i < detachList.length && c.fragments.length < allow; i++) {
      const item = detachList[i];
      if (!item.mesh.visible && item.mode !== 'husk') continue;
      const delay = item.mode === 'husk' || (style === 'shell' && i === 0) ? 0 : Math.min(0.045, i * 0.014);
      this.detachOne(item.mesh, {
        owner: c, floor, dir: c.dir, r, mode: item.mode, delay, life: c.life,
        boost: boost * (cause === 'whip' || cause === 'bowl' ? 1.25 : 1), index: i,
      });
    }

    // Apply initial floor safety so frame 0 is never under floor
    this.clampBodyFloor(c, 0);
    this.list.push(c);
    return true;
  }

  clampBodyFloor(c, dt) {
    const { root, mesh } = c;
    const tilt = Math.min(1, (Math.abs(root.rotation.x) + Math.abs(root.rotation.z)) / 0.75);
    const maxS = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
    const uprightLift = Math.max(0, -c.localMinY) * mesh.scale.y;
    const tiltLift = c.boundR * maxS;
    const minY = c.floor + 0.002 + uprightLift * (1 - tilt) + tiltLift * tilt;
    if (root.position.y < minY) {
      root.position.y = minY;
      if (dt > 0 && c.vel.y < -0.09) {
        c.vel.y = -c.vel.y * this.bounce;
        c.vel.x *= 0.65;
        c.vel.z *= 0.65;
        c.squash = 0.42;
      } else if (c.vel.y < 0) {
        c.vel.y = 0;
        c.grounded = true;
      }
    }
  }

  update(dt) {
    const grav = LOOK.num('death-fall-gravity', 1.2);
    const skidDist = LOOK.num('death-skid', 0.055);
    const flySpin = LOOK.num('death-fly-spin', 7);
    const quiet = this.quiet;

    // 1. Update active bodies
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.t += dt;
      if (quiet || c.t >= c.life) { this.free(c); continue; }

      const { root, mesh, style, cause, r, t, life, hang } = c;
      const u = Math.max(0, t - hang);
      const move = 1 - Math.exp(-u * 7);
      const shrink = 1 - THREE.MathUtils.smoothstep(t, life * 0.78, life);
      c.squash *= Math.exp(-16 * dt);

      // Beat 1: Hang / Anticipation pose
      if (t < hang) {
        const hk = t / Math.max(0.001, hang);
        if (cause === 'balloon') {
          const inf = 1 + (this.inflateScale - 1) * (1 - (1 - hk) * (1 - hk));
          mesh.scale.set(r * inf, r * inf * (1 + Math.sin(hk * 28) * 0.06), r * inf);
        } else if (cause === 'slice') {
          mesh.scale.setScalar(r);
          root.position.x = c.origin.x + Math.sin(t * 95) * r * 0.08;
        } else {
          // Punchy volume-preserving anticipation squash
          const sq = 1 - 0.35 * Math.sin(hk * Math.PI);
          const wide = 1 / Math.sqrt(Math.max(0.25, sq));
          mesh.scale.set(r * wide, r * sq, r * wide);
        }
        if (c.eyes && c.eyes.parent && c.eyes.parent !== this.scene) {
          c.eyes.scale.copy(c.eyesScale).multiplyScalar(1 + 0.6 * hk);
        }
        this.clampBodyFloor(c, 0);
        continue;
      }

      // Restore eyes scale after hang
      if (c.eyes && c.eyes.parent && c.eyes.parent !== this.scene) c.eyes.scale.copy(c.eyesScale);

      // Cause-specific overrides
      if (cause === 'zap') {
        const zt = this.zapTime;
        if (t < zt) {
          const j = 1 - t / zt;
          root.position.set(
            c.origin.x + Math.sin(t * 170) * r * 0.24 * j,
            c.origin.y + Math.abs(Math.sin(t * 90)) * r * 0.22 * j,
            c.origin.z + Math.cos(t * 155) * r * 0.24 * j,
          );
          root.rotation.set(Math.sin(t * 110) * 0.18, c.yaw, Math.cos(t * 130) * 0.22);
          mesh.scale.setScalar(r * (1 + 0.1 * Math.sin(t * 140)));
          // Alternating cartoon X-ray FLASH / charred ash every ~3 frames
          const phase = ((t * 22) | 0) % 2;
          if (phase !== c.zapMatOn) {
            c.zapMatOn = phase;
            swapMaterial(root, phase ? this.flashMat : this.ashMat);
          }
          for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * 1.1;
        } else {
          if (c.zapMatOn !== 2) { c.zapMatOn = 2; swapMaterial(root, this.ashMat); }
          const post = 1 - Math.exp(-(t - zt) * 8);
          root.position.copy(c.origin).addScaledVector(c.dir, post * skidDist * 0.6);
          root.rotation.set(0, c.yaw, post * Math.PI);
          mesh.scale.set(r * shrink * (1 + post * 0.15), r * shrink * (1 - post * 0.55), r * shrink * (1 + post * 0.15));
        }
        this.clampBodyFloor(c, dt);
        continue;
      }

      if (cause === 'pancake') {
        const wob = Math.exp(-u * 14) * Math.cos(u * 42) * 0.22;
        const sxz = this.pancakeXZ + wob;
        const sy = Math.max(0.04, this.pancakeY * (1 - wob * 0.5));
        root.position.copy(c.origin);
        root.rotation.set(0, c.yaw, 0);
        mesh.scale.set(r * sxz * shrink, r * sy * shrink, r * sxz * shrink);
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * 1.4;
        this.clampBodyFloor(c, 0);
        continue;
      }

      if (cause === 'wall-splat') {
        const hold = 0.16;
        const slide = Math.max(0, u - hold);
        root.position.copy(c.origin);
        root.position.y -= grav * 0.55 * slide * slide;
        root.rotation.set(0, c.yaw, slide * 1.8);
        mesh.scale.set(r * 1.45 * shrink, r * 1.35 * shrink, r * 0.16 * shrink);
        this.clampBodyFloor(c, dt);
        continue;
      }

      if (cause === 'slice') {
        if (!c.sliced) {
          c.sliced = true;
          if (c.splitB && c.splitB.parent && c.splitB.parent !== this.scene) {
            _side.crossVectors(_up, c.dir).normalize();
            this.detachOne(c.splitB, { owner: c, floor: c.floor, dir: _side, r, mode: 'pop', delay: 0, life: c.life - t, boost: 0.7, index: 0 });
          }
        }
        _side.crossVectors(_up, c.dir).normalize();
        const sep = (1 - Math.exp(-u * 7)) * r * 1.5;
        root.position.copy(c.origin).addScaledVector(_side, -sep);
        root.rotation.set(0, c.yaw, -move * 1.25);
        mesh.scale.setScalar(r * shrink);
        this.clampBodyFloor(c, dt);
        continue;
      }

      if (cause === 'whip' || cause === 'bowl') {
        c.vel.y -= grav * 1.45 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const smear = u < 0.06 ? 1.55 : 1;
        const invSm = 1 / Math.sqrt(smear);
        const sq = 1 - c.squash * 0.45, sw = 1 / Math.sqrt(Math.max(0.3, sq));
        mesh.scale.set(r * shrink * invSm * sw, r * shrink * invSm * sq, r * shrink * smear * sw);
        root.rotation.set(u * 13 * c.boost, c.yaw + u * 9, u * 11);
        this.clampBodyFloor(c, dt);
        c.pos.copy(root.position);
        continue;
      }

      if (cause === 'balloon') {
        // Post-pop: rapid flat deflation & skid
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.3);
        root.rotation.set(0, c.yaw + move * 0.7, move * Math.PI);
        const wob = Math.exp(-u * 12) * Math.sin(u * 36) * 0.18;
        mesh.scale.set(r * shrink * (1.3 + wob), r * shrink * Math.max(0.18, 0.35 - move * 0.12), r * shrink * (1.3 - wob));
        this.clampBodyFloor(c, dt);
        continue;
      }

      // Standard style-driven animations (upgraded with bounce, squash, and comedy)
      const sq = 1 - c.squash * 0.4, sw = 1 / Math.sqrt(Math.max(0.35, sq));
      mesh.scale.set(r * shrink * sw, r * shrink * sq, r * shrink * sw);

      if (style === 'belly-up') {
        // Classic upside-down roach: hops, flips 180° onto back, skids, legs frantically bicycle!
        c.vel.y -= grav * 1.5 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const flip = Math.min(1, u / 0.18);
        root.rotation.set(0, c.yaw + move * 0.6, flip * Math.PI + Math.sin(u * 16) * 0.18 * (1 - move * 0.6));
        mesh.scale.y *= 1 - move * 0.58; // flattened belly-up silhouette (also satisfies words/death-motion)
        const kick = Math.sin(u * 38) * Math.max(0, 1 - u * 1.3);
        for (let k = 0; k < c.parts.length; k++) {
          const p = c.parts[k];
          p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * (0.9 + kick * (k % 2 ? 0.55 : -0.55));
        }
      } else if (style === 'crumple') {
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * c.boost);
        root.rotation.set(0, c.yaw, Math.sin(u * 16) * 0.22 * (1 - move));
        mesh.scale.y *= 1 - move * 0.72;
        mesh.scale.x *= 1 + move * 0.22;
        mesh.scale.z *= 1 + move * 0.22;
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * move * 1.35;
      } else if (style === 'curl-pop') {
        // Classic dead-spider curl: pops up, flips over, all 8 legs violently curl inward!
        c.vel.y -= grav * 1.45 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const flip = Math.min(1, u / 0.2);
        root.rotation.set(0, c.yaw + move * 0.8, flip * Math.PI);
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z + Math.sign(p.pos.x) * move * 1.45;
      } else if (style === 'flutter' || style === 'eye-pop' || style === 'lantern-pop') {
        // Exaggerated spiraling flyer tumble + floor bounce!
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        root.position.x += Math.sin(u * 18) * move * r * 0.85 * (c.grounded ? 0.15 : 1);
        root.rotation.set(move * 1.35, c.yaw + u * flySpin * 1.25, Math.sin(u * 21) * 0.75 * (c.grounded ? 0.2 : 1));
      } else if (style === 'shell' || style === 'pop-shell') {
        // Armored bug: flips onto back and rocks side-to-side like a stuck turtle while shell/mandibles fly
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.15);
        const rock = Math.sin(u * 15) * 0.35 * Math.exp(-u * 2.2);
        root.rotation.set(0, c.yaw + move * 0.5, Math.min(1, u / 0.22) * Math.PI + rock);
        mesh.scale.y *= 1 - move * 0.52;
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * move * 1.1;
      } else if (style === 'bead-scatter') {
        // Millipede / worm: snaps into a dramatic curled recoil while sampled segments fly everywhere
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.2);
        root.rotation.set(move * 0.5, c.yaw + u * 5, move * 1.6);
        mesh.scale.y *= 1 - move * 0.55;
      } else if (style === 'skin-shed') {
        // Cicada: jumps straight out of its empty brown husk!
        c.vel.y -= grav * 1.45 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        root.rotation.set(u * 9, c.yaw + u * 6, u * 7);
      } else if (style === 'paper-crush') {
        // Wasp nest: accordion paper-bag crush + drop
        c.vel.y -= grav * 1.6 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const cr = 1 - Math.exp(-u * 10);
        mesh.scale.set(r * shrink * (1 + cr * 0.45), r * shrink * Math.max(0.18, 1 - cr * 0.78), r * shrink * (1 + cr * 0.45));
        root.rotation.set(cr * 0.4, c.yaw + cr * 0.8, cr * 0.6);
      } else if (style === 'unravel') {
        // Hair tangle: wild spin-whirlpool shrink while angry eyes pop up
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist);
        const spin = u * 22;
        root.rotation.set(0, c.yaw + spin, 0);
        const sqz = Math.max(0.12, 1 - move * 0.85);
        mesh.scale.set(r * shrink * sqz, r * shrink * (1 + move * 0.5), r * shrink * sqz);
      }

      this.clampBodyFloor(c, dt);
      if (c.pos !== root.position) c.pos.y = root.position.y;
    }

    // 2. Update all detached parts (both body-owned and standalone elemental)
    for (let i = this.detached.length - 1; i >= 0; i--) {
      const p = this.detached[i];
      p.t += dt;
      if (quiet || p.t >= p.life) { this.freePart(p); continue; }
      if (p.t < p.delay) continue;

      const u = p.t - p.delay;
      const shrink = 1 - THREE.MathUtils.smoothstep(p.t, p.life * 0.78, p.life);
      p.squash *= Math.exp(-16 * dt);
      const m = p.mesh;

      if (p.mode === 'husk') {
        // Stands upright on floor wobbling slightly, then pops out at the end
        const wob = Math.sin(u * 18) * Math.exp(-u * 5) * 0.14;
        m.rotation.set(p.rot.x, p.rot.y, p.rot.z + wob);
        m.scale.copy(p.baseScale).multiplyScalar(shrink);
        continue;
      }

      if (p.mode === 'float-sink') {
        // Bobs on top of the acid puddle, then sinks smoothly into floor
        const k = p.t / p.life;
        m.position.x += p.vel.x * dt;
        m.position.z += p.vel.z * dt;
        p.vel.x *= Math.exp(-5 * dt); p.vel.z *= Math.exp(-5 * dt);
        const bob = k < 0.55 ? Math.sin(u * 10) * 0.0025 : -(k - 0.55) / 0.45 * p.radius * 1.4;
        m.position.y = Math.max(p.floor + 0.001, p.floor + p.radius * 0.6 + bob);
        m.rotation.y += 2.2 * dt;
        m.scale.copy(p.baseScale).multiplyScalar(k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
        continue;
      }

      if (p.mode === 'corkscrew') {
        // Ladybug missile sputters off in a silly upward spiral
        const a = u * 18 + p.seed;
        m.position.x += (p.vel.x + Math.cos(a) * 0.28) * dt;
        m.position.z += (p.vel.z + Math.sin(a) * 0.28) * dt;
        m.position.y += p.vel.y * dt;
        p.vel.y -= grav * 0.5 * dt;
        m.rotation.x += p.rotVel.x * dt;
        m.rotation.y += p.rotVel.y * dt;
        m.rotation.z += p.rotVel.z * dt;
        m.scale.copy(p.baseScale).multiplyScalar(shrink);
        continue;
      }

      if (p.mode === 'stick' && p.stuck) {
        // Stuck upright in the floor with a cartoon arrow wobble!
        const wob = Math.sin((u - p.stuckAt) * 38) * Math.exp(-(u - p.stuckAt) * 8) * 0.35;
        m.rotation.set(Math.PI * 0.5 + wob, p.rot.y, wob * 0.6);
        m.scale.copy(p.baseScale).multiplyScalar(shrink);
        continue;
      }

      // Ballistic / flutter / bounce physics
      if (p.mode === 'flutter') {
        p.vel.multiplyScalar(Math.exp(-4.2 * dt));
        p.vel.y -= grav * 0.42 * dt;
        m.position.x += (p.vel.x + Math.sin(u * 11 + p.seed) * 0.08) * dt;
        m.position.z += (p.vel.z + Math.cos(u * 9 + p.seed) * 0.08) * dt;
        m.position.y += p.vel.y * dt;
      } else {
        p.vel.y -= grav * 1.45 * dt;
        m.position.addScaledVector(p.vel, dt);
      }

      const floorY = p.floor + 0.0018 + p.radius * shrink;
      if (m.position.y <= floorY) {
        m.position.y = floorY;
        if (p.mode === 'stick') {
          p.stuck = true; p.stuckAt = u;
          p.vel.set(0, 0, 0); p.rotVel.set(0, 0, 0);
        } else if (Math.abs(p.vel.y) > 0.08 && p.bounces < 2) {
          p.vel.y = -p.vel.y * p.bounce;
          p.vel.x *= 0.66; p.vel.z *= 0.66;
          p.rotVel.multiplyScalar(0.55);
          p.bounces++;
          p.squash = 0.45;
        } else {
          p.vel.set(0, 0, 0);
          p.rotVel.multiplyScalar(Math.exp(-12 * dt));
        }
      }

      m.rotation.x += p.rotVel.x * dt;
      m.rotation.y += p.rotVel.y * dt;
      m.rotation.z += p.rotVel.z * dt;

      // Firefly lamp: flickers brightly twice then dims out like a broken bulb
      if (p.mode === 'flicker' && p.hasColor) {
        const k = p.t / p.life;
        const pulse = k < 0.35 ? 1.5 : (k > 0.42 && k < 0.5) || (k > 0.58 && k < 0.64) ? 2.2 : 0.15;
        m.userData.color.copy(p.baseColor).multiplyScalar(pulse * shrink);
      }

      const sq = 1 - p.squash * 0.42, sw = 1 / Math.sqrt(Math.max(0.35, sq));
      m.scale.set(p.baseScale.x * shrink * sw, p.baseScale.y * shrink * sq, p.baseScale.z * shrink * sw);
    }
  }

  freePart(p) {
    if (!p || !p.active) return;
    p.active = false;
    if (p.mesh) {
      if (p.hasColor && p.mesh.userData.color) p.mesh.userData.color.copy(p.baseColor);
      restoreMaterials(p.mesh);
      this.scene.remove(p.mesh);
    }
    const idx = this.detached.indexOf(p);
    if (idx !== -1) this.detached.splice(idx, 1);
    if (p.owner) {
      const oi = p.owner.fragments.indexOf(p);
      if (oi !== -1) p.owner.fragments.splice(oi, 1);
    }
    p.mesh = null;
    p.owner = null;
  }

  free(c) {
    if (!c || !c.active) return;
    c.active = false;
    // Free all detached parts owned by this body first
    for (let i = c.fragments.length - 1; i >= 0; i--) this.freePart(c.fragments[i]);
    c.fragments.length = 0;
    if (c.eyes && c.eyes.parent && c.eyes.parent !== this.scene) c.eyes.scale.copy(c.eyesScale);
    if (c.root) {
      restoreMaterials(c.root);
      this.scene.remove(c.root);
    }
    const idx = this.list.indexOf(c);
    if (idx !== -1) this.list.splice(idx, 1);
    c.mesh = c.eyes = c.splitB = null;
    c.parts.length = 0;
  }

  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this.free(this.list[i]);
    for (let i = this.detached.length - 1; i >= 0; i--) this.freePart(this.detached[i]);
    this.list.length = 0;
    this.detached.length = 0;
  }
}
