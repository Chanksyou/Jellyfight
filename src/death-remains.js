// Short, harmless, exaggerated death animations. Reuses each bug's real model, sub-parts and
// prepared materials/batches (ModelPool restores detached parts and materials automatically).
// Bodies and detached parts NEVER shrink or disappear while airborne: they arc out, slam into the
// floor with a splatter/bounce, settle on the ground for --death-settle-time, and only then pop out.
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

const WEIGHT_MULT = { light: 1.2, mid: 1, heavy: 0.78 };
const FLYER_STYLES = new Set(['flutter', 'eye-pop', 'lantern-pop']);
const AIRBORNE_STYLES = new Set(['belly-up', 'curl-pop', 'flutter', 'eye-pop', 'lantern-pop', 'skin-shed', 'paper-crush']);

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
    r: 0.03, floor: 0, t: 0, settleT: 0, landed: false, splatted: false,
    life: 1.8, hang: 0.03, yaw: 0, boost: 1, splatColor: null,
    localCenter: new THREE.Vector3(), localHalf: new THREE.Vector3(0.5, 0.5, 0.5),
    grounded: false, squash: 0,
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
    t: 0, delay: 0, settleT: 0, landed: false, splatted: false,
    life: 1.8, floor: 0, radius: 0.008, bounce: 0.36, splatColor: null,
    bounces: 0, stuck: false, stuckAt: 0, squash: 0, seed: 0,
    origin: new THREE.Vector3(), vel: new THREE.Vector3(),
    rot: new THREE.Euler(), rotVel: new THREE.Vector3(),
    baseScale: new THREE.Vector3(1, 1, 1),
    baseColor: new THREE.Color(1, 1, 1), hasColor: false,
  };
}

export class DeathRemains {
  constructor(scene, isLow = () => false, onLand = null) {
    this.scene = scene;
    this.isLow = isLow;
    this.onLand = onLand;
    this.list = [];
    this.detached = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.cap = LOOK.num('death-body-cap', 12);
    this.capLow = LOOK.num('death-body-cap-low', 6);
    this.partCap = LOOK.num('death-part-cap', 36);
    this.partCapLow = LOOK.num('death-part-cap-low', 14);
    this.life = LOOK.num('death-body-life', 1.8);
    this.settleTime = LOOK.num('death-settle-time', 0.95);
    this.fadeTime = LOOK.num('death-fade-time', 0.25);
    this.maxLife = LOOK.num('death-max-life', 2.8);
    this.hangTime = LOOK.num('death-hang-time', 0.03);
    this.bounce = LOOK.num('death-bounce', 0.36);
    this.overkillBoost = LOOK.num('death-overkill-boost', 1.45);
    this.zapTime = LOOK.num('death-zap-time', 0.22);
    this.pancakeY = LOOK.num('death-pancake-y', 0.07);
    this.pancakeXZ = LOOK.num('death-pancake-xz', 1.85);
    this.inflateScale = LOOK.num('death-inflate-scale', 1.48);
    this.flashMat = null;
    this.ashMat = null;
    this.frostMat = null;
    this.bodyPool = Array.from({ length: Math.max(12, this.cap) }, makeBodySlot);
    this.partPool = Array.from({ length: Math.max(36, this.partCap) }, makePartSlot);
    this._serial = 0;
  }

  get maxBodies() { return this.isLow() ? this.capLow : this.cap; }
  get maxParts() { return this.isLow() ? this.partCapLow : this.partCap; }
  get quiet() { return juice.calm || this.reducedMotion.matches; }

  // Measure a model's local AABB center & half-extents once at death spawn (replaces per-frame Box3 traversal).
  measureLocal(mesh, outCenter, outHalf) {
    _box.makeEmpty();
    mesh.updateMatrixWorld(true);
    _inv.copy(mesh.matrixWorld).invert();
    mesh.traverseVisible((o) => {
      if (!o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _pbox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(_inv);
      _box.union(_pbox);
    });
    if (_box.isEmpty()) { outCenter.set(0, 0, 0); outHalf.set(0.5, 0.5, 0.5); return; }
    _box.getCenter(outCenter);
    _box.getSize(outHalf).multiplyScalar(0.5);
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
  detachOne(piece, { owner = null, floor = 0, dir = null, r = 0.03, mode = 'pop', delay = 0, life = this.life, mat = null, boost = 1, index = 0, splatColor = null } = {}) {
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
    const spd = (0.3 + (seed % 1) * 0.25) * boost * Math.max(0.65, r / 0.035);

    slot.active = true;
    slot.mesh = piece;
    slot.owner = owner;
    slot.mode = mode;
    slot.t = 0;
    slot.delay = delay;
    slot.settleT = 0;
    slot.landed = mode === 'husk' || mode === 'float-sink';
    slot.splatted = false;
    slot.life = life;
    slot.floor = floor;
    slot.radius = Math.max(0.004, r * (mode === 'flutter' ? 0.14 : 0.24));
    slot.bounce = mode === 'flutter' ? 0.12 : mode === 'stick' ? 0 : this.bounce;
    slot.splatColor = splatColor;
    slot.bounces = 0;
    slot.stuck = false;
    slot.stuckAt = 0;
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
      slot.vel.set(ca * spd * 0.55 + dx * 0.18, (0.95 + (seed % 0.25)) * boost, sa * spd * 0.55 + dz * 0.18);
      slot.rotVel.set(14 * boost, 2, 3);
    } else if (mode === 'flutter') {
      slot.vel.set(ca * spd * 0.85 + dx * 0.18, (0.45 + (seed % 0.2)) * boost, sa * spd * 0.85 + dz * 0.18);
      slot.rotVel.set(ca * 4, (7 + (seed % 4)) * (index % 2 ? 1 : -1), sa * 5);
    } else if (mode === 'corkscrew') {
      slot.vel.set(ca * 0.35 + dx * 0.22, 0.85 * boost, sa * 0.35 + dz * 0.22);
      slot.rotVel.set(14, 10, 18);
    } else if (mode === 'float-sink') {
      slot.vel.set(ca * 0.04, 0.12, sa * 0.04);
      slot.rotVel.set(1.5, 3, 1.5);
    } else if (mode === 'slipstream') {
      slot.vel.set(dx * 0.75 + ca * 0.22, 0.72 + (seed % 0.2), dz * 0.75 + sa * 0.22);
      slot.rotVel.set(10, 14, 12);
    } else if (mode === 'pinata') {
      slot.vel.set(ca * spd * 1.35, (0.88 + (seed % 0.3)) * boost, sa * spd * 1.35);
      slot.rotVel.set(12, 16, 12);
    } else if (mode === 'pancake-pop') {
      slot.vel.set(ca * spd * 1.45 + dx * 0.18, 0.42 * boost, sa * spd * 1.45 + dz * 0.18);
      slot.rotVel.set(9, 12, 9);
    } else if (mode === 'ice') {
      slot.vel.set(ca * spd * 1.25 + dx * 0.22, (0.78 + (seed % 0.25)) * boost, sa * spd * 1.25 + dz * 0.22);
      slot.rotVel.set(15, 13, 16);
    } else {
      const lift = LOOK.num('death-shell-lift', 0.65) * (1.1 + (seed % 0.45)) * boost;
      slot.vel.set(ca * spd * 1.15 + dx * 0.25, lift, sa * spd * 1.15 + dz * 0.25);
      slot.rotVel.set((8 + (seed % 6)) * (index % 2 ? 1 : -1), 5 + (seed % 4), (7 + (seed % 5)) * (index % 2 ? -1 : 1));
    }

    this.detached.push(slot);
    if (owner) owner.fragments.push(slot);
    return slot;
  }

  // Standalone part ejection for elemental kills (ice, glitter, acid/poison, wind) without adding a body to this.list.
  ejectParts(remains, { mode = 'pop', mat = null, dir = null, count = 3, boost = 1.1, splatColor = null } = {}) {
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
      if (this.detachOne(p.mesh, { owner: null, floor, dir, r, mode: p.mode, delay: i * 0.015, life: this.life, mat, boost, index: i, splatColor })) n++;
    }
    return n;
  }

  add({ root, mesh, parts = [], rig = null, style = 'crumple', weight = 'mid', r = 0.03, velocity, floor, cause = 'normal', dir = null, crit = false, overkill = 0, splatColor = null }) {
    if (this.quiet) return false;
    while (this.list.length >= this.maxBodies) this.free(this.list[0], true);

    const c = this.bodyPool.find((b) => !b.active);
    if (!c) return false;

    restoreMaterials(root);
    for (const child of root.children) if (child !== mesh) child.visible = false;
    mesh.scale.setScalar(r);
    this.scene.add(root);
    batcher.track(root);

    if (dir && dir.lengthSq() > 1e-6) c.dir.copy(dir).setY(0);
    else if (velocity && velocity.lengthSq() > 1e-4) c.dir.copy(velocity).setY(0);
    else c.dir.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    if (c.dir.lengthSq() < 1e-6) c.dir.set(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    c.dir.normalize();

    const wMult = WEIGHT_MULT[weight] ?? 1;
    const isOverkill = crit || overkill > 0.5;
    const boost = (isOverkill ? this.overkillBoost : 1) * wMult;

    this.measureLocal(mesh, c.localCenter, c.localHalf);
    const airborne = cause === 'whip' || cause === 'bowl' || cause === 'wall-splat' || (cause === 'normal' && AIRBORNE_STYLES.has(style));
    c.active = true;
    c.root = root;
    c.mesh = mesh;
    c.style = style;
    c.cause = cause;
    c.weight = wMult;
    c.r = r;
    c.floor = floor;
    c.t = 0;
    c.settleT = 0;
    c.landed = !airborne;
    c.splatted = !airborne;
    c.life = this.life;
    c.hang = cause === 'pancake' ? 0 : cause === 'slice' ? 0.12 : cause === 'balloon' ? 0.11 : this.hangTime;
    c.yaw = root.rotation.y;
    c.boost = boost;
    c.splatColor = splatColor;
    c.grounded = !airborne;
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

    const isFlyer = FLYER_STYLES.has(style);
    if (cause === 'whip') {
      c.vel.copy(c.dir).multiplyScalar(1.05 * boost);
      c.vel.y = 0.72 * boost;
    } else if (cause === 'bowl') {
      c.vel.copy(c.dir).multiplyScalar(0.85 * boost);
      c.vel.y = 0.92 * boost;
    } else if (cause === 'wall-splat' || cause === 'pancake' || cause === 'zap' || cause === 'slice') {
      c.vel.set(0, 0, 0);
    } else if (style === 'belly-up' || style === 'curl-pop' || style === 'skin-shed') {
      c.vel.copy(c.dir).multiplyScalar(0.32 * boost);
      c.vel.y = (style === 'skin-shed' ? 0.82 : 0.62) * boost;
    } else if (isFlyer) {
      c.vel.copy(c.dir).multiplyScalar(0.18 * boost);
      c.vel.y = 0.08 * boost;
    } else {
      c.vel.copy(c.dir).multiplyScalar(0.18 * boost);
      c.vel.y = 0.15 * boost;
    }

    const limbSrc = rig?.limbs?.length ? rig.limbs : (style === 'crumple' ? parts : []);
    c.parts.length = 0;
    for (let i = 0; i < limbSrc.length; i++) {
      const p = limbSrc[i];
      if (p) c.parts.push({ mesh: p, pos: p.position.clone(), rotation: p.rotation.clone() });
    }

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

    const wantParts = cause === 'slice' ? 0 : Math.min(detachList.length, isOverkill ? 6 : 4);
    const allow = this.partBudgetFor(wantParts, mustOne);
    for (let i = 0; i < detachList.length && c.fragments.length < allow; i++) {
      const item = detachList[i];
      if (!item.mesh.visible && item.mode !== 'husk') continue;
      const delay = item.mode === 'husk' || (style === 'shell' && i === 0) ? 0 : Math.min(0.035, i * 0.01);
      this.detachOne(item.mesh, {
        owner: c, floor, dir: c.dir, r, mode: item.mode, delay, life: c.life,
        boost: boost * (cause === 'whip' || cause === 'bowl' ? 1.25 : 1), index: i, splatColor,
      });
    }

    this.clampBodyFloor(c, 0);
    this.list.push(c);
    return true;
  }

  // Exact O(1) lowest world Y of the rotated local AABB (no traversal, no mid-air levitation).
  clampBodyFloor(c, dt) {
    const { root, mesh } = c;
    root.updateMatrix();
    const m = root.matrix.elements;
    const sx = mesh.scale.x, sy = mesh.scale.y, sz = mesh.scale.z;
    const cx = c.localCenter.x * sx, cy = c.localCenter.y * sy, cz = c.localCenter.z * sz;
    const hx = c.localHalf.x * sx, hy = c.localHalf.y * sy, hz = c.localHalf.z * sz;
    const bottomOffset = -(m[1] * cx + m[5] * cy + m[9] * cz) + Math.abs(m[1]) * hx + Math.abs(m[5]) * hy + Math.abs(m[9]) * hz;
    const minY = c.floor + 0.0018 + bottomOffset;
    if (root.position.y <= minY) {
      root.position.y = minY;
      if (dt > 0) {
        if (!c.landed) {
          c.landed = true;
          c.settleT = 0;
        }
        if (!c.splatted && c.vel.y < -0.18) {
          c.splatted = true;
          this.onLand?.(_v.set(root.position.x, c.floor, root.position.z), c.r, true, c.splatColor, c.style);
        }
        if (c.vel.y < -0.22) {
          c.vel.y = -c.vel.y * this.bounce;
          c.vel.x *= 0.72;
          c.vel.z *= 0.72;
          c.squash = 0.5;
        } else if (c.vel.y <= 0) {
          c.vel.y = 0;
          c.grounded = true;
          const drag = Math.exp(-10 * dt);
          c.vel.x *= drag;
          c.vel.z *= drag;
        }
      }
    }
  }

  update(dt) {
    const grav = LOOK.num('death-fall-gravity', 1.85);
    const skidDist = LOOK.num('death-skid', 0.055);
    const flySpin = LOOK.num('death-fly-spin', 7);
    const settleTotal = this.settleTime + this.fadeTime;
    const quiet = this.quiet;

    // 1. Update active bodies (NEVER shrink or expire while still airborne!)
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.t += dt;
      if (c.landed && c.t >= c.hang) c.settleT += dt;
      if (quiet || c.t >= this.maxLife || (c.landed && c.settleT >= settleTotal)) {
        // Natural expiry detaches ownership of still-airborne parts so they finish landing!
        this.free(c, quiet);
        continue;
      }

      const { root, mesh, style, cause, r, t, hang } = c;
      const u = Math.max(0, t - hang);
      const move = 1 - Math.exp(-u * 7);
      // Full size while airborne and while settling on the floor; crisp pop-out only during final fadeTime
      const shrink = c.landed
        ? 1 - THREE.MathUtils.smoothstep(c.settleT, this.settleTime, settleTotal)
        : 1;
      c.squash *= Math.exp(-15 * dt);

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
        root.position.y -= grav * 0.65 * slide * slide;
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
            this.detachOne(c.splitB, { owner: c, floor: c.floor, dir: _side, r, mode: 'pop', delay: 0, life: c.life, boost: 0.7, index: 0, splatColor: c.splatColor });
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
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const smear = u < 0.05 ? 1.5 : 1;
        const invSm = 1 / Math.sqrt(smear);
        const sq = 1 - c.squash * 0.45, sw = 1 / Math.sqrt(Math.max(0.3, sq));
        mesh.scale.set(r * shrink * invSm * sw, r * shrink * invSm * sq, r * shrink * smear * sw);
        if (!c.grounded) root.rotation.set(u * 13 * c.boost, c.yaw + u * 9, u * 11);
        this.clampBodyFloor(c, dt);
        c.pos.copy(root.position);
        continue;
      }

      if (cause === 'balloon') {
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.3);
        root.rotation.set(0, c.yaw + move * 0.7, move * Math.PI);
        const wob = Math.exp(-u * 12) * Math.sin(u * 36) * 0.18;
        mesh.scale.set(r * shrink * (1.3 + wob), r * shrink * Math.max(0.18, 0.35 - move * 0.12), r * shrink * (1.3 - wob));
        this.clampBodyFloor(c, dt);
        continue;
      }

      // Standard style-driven animations
      const sq = 1 - c.squash * 0.42, sw = 1 / Math.sqrt(Math.max(0.35, sq));
      mesh.scale.set(r * shrink * sw, r * shrink * sq, r * shrink * sw);

      if (style === 'belly-up') {
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const flip = Math.min(1, u / 0.16);
        root.rotation.set(0, c.yaw + move * 0.6, flip * Math.PI + Math.sin(u * 16) * 0.14 * (1 - move * 0.6));
        mesh.scale.y *= 1 - move * 0.58;
        const kick = Math.sin(u * 38) * Math.max(0, 1 - c.settleT * 1.1);
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
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const flip = Math.min(1, u / 0.18);
        root.rotation.set(0, c.yaw + move * 0.8, flip * Math.PI);
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z + Math.sign(p.pos.x) * move * 1.45;
      } else if (style === 'flutter' || style === 'eye-pop' || style === 'lantern-pop') {
        c.vel.y -= grav * 0.75 * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        root.position.x += Math.sin(u * 18) * move * r * 0.65 * (c.grounded ? 0.05 : 1);
        if (!c.grounded) root.rotation.set(move * 1.35, c.yaw + u * flySpin * 1.25, Math.sin(u * 21) * 0.75);
      } else if (style === 'shell' || style === 'pop-shell') {
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.15);
        const rock = Math.sin(u * 15) * 0.35 * Math.exp(-u * 2.0);
        root.rotation.set(0, c.yaw + move * 0.5, Math.min(1, u / 0.22) * Math.PI + rock);
        mesh.scale.y *= 1 - move * 0.52;
        for (const p of c.parts) p.mesh.rotation.z = p.rotation.z - Math.sign(p.pos.x) * move * 1.1;
      } else if (style === 'bead-scatter') {
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist * 1.2);
        root.rotation.set(move * 0.5, c.yaw + u * 5, move * 1.6);
        mesh.scale.y *= 1 - move * 0.55;
      } else if (style === 'skin-shed') {
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        if (!c.grounded) root.rotation.set(u * 9, c.yaw + u * 6, u * 7);
      } else if (style === 'paper-crush') {
        c.vel.y -= grav * dt;
        c.pos.addScaledVector(c.vel, dt);
        root.position.copy(c.pos);
        const cr = 1 - Math.exp(-u * 10);
        mesh.scale.set(r * shrink * (1 + cr * 0.45), r * shrink * Math.max(0.18, 1 - cr * 0.78), r * shrink * (1 + cr * 0.45));
        root.rotation.set(cr * 0.4, c.yaw + cr * 0.8, cr * 0.6);
      } else if (style === 'unravel') {
        root.position.copy(c.origin).addScaledVector(c.dir, move * skidDist);
        const spin = u * 22;
        root.rotation.set(0, c.yaw + spin, 0);
        const sqz = Math.max(0.12, 1 - move * 0.85);
        mesh.scale.set(r * shrink * sqz, r * shrink * (1 + move * 0.5), r * shrink * sqz);
      }

      this.clampBodyFloor(c, dt);
      c.pos.y = root.position.y;
    }

    // 2. Update all detached parts (NEVER shrink or disappear while still in the air!)
    for (let i = this.detached.length - 1; i >= 0; i--) {
      const p = this.detached[i];
      p.t += dt;
      if (p.landed) p.settleT += dt;
      if (quiet || p.t >= this.maxLife || (p.landed && p.settleT >= settleTotal)) {
        this.freePart(p);
        continue;
      }
      if (p.t < p.delay) continue;

      const u = p.t - p.delay;
      const shrink = p.landed
        ? 1 - THREE.MathUtils.smoothstep(p.settleT, this.settleTime, settleTotal)
        : 1;
      p.squash *= Math.exp(-15 * dt);
      const m = p.mesh;

      if (p.mode === 'husk') {
        const wob = Math.sin(u * 18) * Math.exp(-u * 5) * 0.14;
        m.rotation.set(p.rot.x, p.rot.y, p.rot.z + wob);
        m.scale.copy(p.baseScale).multiplyScalar(shrink);
        continue;
      }

      if (p.mode === 'float-sink') {
        const k = Math.min(1, p.settleT / settleTotal);
        m.position.x += p.vel.x * dt;
        m.position.z += p.vel.z * dt;
        p.vel.x *= Math.exp(-5 * dt); p.vel.z *= Math.exp(-5 * dt);
        const bob = k < 0.65 ? Math.sin(u * 10) * 0.0025 : -(k - 0.65) / 0.35 * p.radius * 1.4;
        m.position.y = Math.max(p.floor + 0.001, p.floor + p.radius * 0.6 + bob);
        m.rotation.y += 2.2 * dt;
        m.scale.copy(p.baseScale).multiplyScalar(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
        continue;
      }

      if (p.mode === 'stick' && p.stuck) {
        const wob = Math.sin((u - p.stuckAt) * 38) * Math.exp(-(u - p.stuckAt) * 8) * 0.35;
        m.rotation.set(Math.PI * 0.5 + wob, p.rot.y, wob * 0.6);
        m.scale.copy(p.baseScale).multiplyScalar(shrink);
        continue;
      }

      // Ballistic / flutter / corkscrew physics — realistic parabolic motion!
      if (p.mode === 'corkscrew') {
        if (!p.landed) {
          const spiral = u < 0.16 ? 0.18 : 0; // brief sputter spiral, then clean ballistic dive
          const a = u * 22 + p.seed;
          p.vel.y -= grav * dt;
          m.position.x += (p.vel.x + Math.cos(a) * spiral) * dt;
          m.position.z += (p.vel.z + Math.sin(a) * spiral) * dt;
          m.position.y += p.vel.y * dt;
        }
      } else if (p.mode === 'flutter') {
        if (!p.landed) {
          p.vel.multiplyScalar(Math.exp(-5.5 * dt));
          p.vel.y -= grav * 0.28 * dt;
          m.position.x += (p.vel.x + Math.sin(u * 11 + p.seed) * 0.06) * dt;
          m.position.z += (p.vel.z + Math.cos(u * 9 + p.seed) * 0.06) * dt;
          m.position.y += p.vel.y * dt;
        }
      } else {
        p.vel.y -= grav * dt;
        m.position.addScaledVector(p.vel, dt);
      }

      const floorY = p.floor + 0.0018 + p.radius * shrink;
      if (m.position.y <= floorY) {
        m.position.y = floorY;
        if (!p.landed) {
          p.landed = true;
          p.settleT = 0;
        }
        if (!p.splatted) {
          p.splatted = true;
          this.onLand?.(_v.set(m.position.x, p.floor, m.position.z), p.radius * 3.5, false, p.splatColor, p.mode);
        }
        if (p.mode === 'stick') {
          p.stuck = true; p.stuckAt = u;
          p.vel.set(0, 0, 0); p.rotVel.set(0, 0, 0);
        } else if (p.mode === 'corkscrew') {
          p.vel.set(0, 0, 0); p.rotVel.multiplyScalar(0.15);
          p.squash = 0.55;
        } else if (Math.abs(p.vel.y) > 0.2 && p.bounces < 2) {
          p.vel.y = -p.vel.y * p.bounce;
          p.vel.x *= 0.72; p.vel.z *= 0.72;
          p.rotVel.multiplyScalar(0.55);
          p.bounces++;
          p.squash = 0.45;
        } else {
          p.vel.y = 0;
          const drag = Math.exp(-10 * dt);
          p.vel.x *= drag; p.vel.z *= drag;
          p.rotVel.multiplyScalar(drag);
        }
      }

      m.rotation.x += p.rotVel.x * dt;
      m.rotation.y += p.rotVel.y * dt;
      m.rotation.z += p.rotVel.z * dt;

      // Firefly lamp: flickers brightly twice on the floor then dims out like a broken bulb
      if (p.mode === 'flicker' && p.hasColor) {
        const k = p.landed ? Math.min(1, p.settleT / settleTotal) : 0;
        const pulse = !p.landed ? 1.6 : (k > 0.22 && k < 0.34) || (k > 0.48 && k < 0.58) ? 2.2 : 0.2;
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

  // forceParts = true on clear()/eviction/calm (frees all owned parts immediately);
  // forceParts = false on natural expiry (still-airborne parts finish landing on their own).
  free(c, forceParts = true) {
    if (!c || !c.active) return;
    c.active = false;
    for (let i = c.fragments.length - 1; i >= 0; i--) {
      const p = c.fragments[i];
      if (forceParts || p.landed) this.freePart(p);
      else p.owner = null;
    }
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
    for (let i = this.list.length - 1; i >= 0; i--) this.free(this.list[i], true);
    for (let i = this.detached.length - 1; i >= 0; i--) this.freePart(this.detached[i]);
    this.list.length = 0;
    this.detached.length = 0;
  }
}
