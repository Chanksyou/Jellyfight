// Bodies for the Treasures that answer a hit or a kill: the Rubber Duck's squeak, the Windowsill
// Cactus's needles, the Guitar Pick's chord and Bath Salt's chained bursts (Treasure juice J2).
// Looks only: damage, reach and timing are decided where they always were (run.js, gadgets.js fire);
// this draws the body and the flight after the hit lands. Pieces come from the kit (gadget-looks.js),
// so no material or shader of its own; props are built here and shown by the warm-up (treasure-props.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';

const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _a = new THREE.Vector3();
const backOut = (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
const DUCK_LIFE = 0.55, PICK_LIFE = 0.25;

// rounded guitar-pick silhouette (classic teardrop triangle)
function guitarPickGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -1.05);
  s.bezierCurveTo(0.85, -0.3, 1.05, 0.55, 0.72, 0.9);
  s.bezierCurveTo(0.35, 1.12, -0.35, 1.12, -0.72, 0.9);
  s.bezierCurveTo(-1.05, 0.55, -0.85, -0.3, 0, -1.05);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 });
  g.center();
  return g;
}

export class TreasureBursts {
  constructor(gadgets) {
    this.g = gadgets; this.looks = gadgets.looks; this.fx = gadgets.fx;
    const { props, looks } = gadgets, fx = gadgets.fx, geo = looks.geo;
    const piece = (g, size) => () => { const m = fx.piece(g, looks.mat); m.userData.size = size; return m; };
    const duck = new THREE.Color(LOOK.color('treasure-rubberDuck', '#a8e9ce'));
    // sculpted duck body: ovoid torso + upturned tail cone + twin folded wings merged into one piece
    const duckBodyGeo = mergeGeometries([
      new THREE.SphereGeometry(1, 12, 8).toNonIndexed(),
      new THREE.ConeGeometry(0.42, 0.85, 8).rotateX(-0.9).translate(0, 0.45, -0.85).toNonIndexed(),
      new THREE.SphereGeometry(1, 10, 6).scale(0.28, 0.52, 0.78).translate(0.85, 0.08, -0.05).toNonIndexed(),
      new THREE.SphereGeometry(1, 10, 6).scale(0.28, 0.52, 0.78).translate(-0.85, 0.08, -0.05).toNonIndexed(),
    ]);
    this.duck = [props.prop('duck-body', piece(duckBodyGeo, 0.02)), props.prop('duck-head', piece(geo.foam, 0.012)), props.prop('duck-beak', piece(geo.needle, 0.004))];
    this.duck.forEach((m) => m.userData.color.copy(duck));
    this.duck[2].userData.color.set(LOOK.color('treasure-duck-beak', '#ffcf9e'));
    this.pick = props.prop('pick', piece(guitarPickGeo(), LOOK.num('treasure-pick-size', 0.02)));
    this.pick.userData.color.set(LOOK.color('treasure-guitarPick', '#e0c8ff'));
    this.reset();
  }
  reset() {
    this.later = []; this.flights = []; this.bristle = null; this.duckT = this.pickT = -1; this.clock = 0; this.saltAt = -9; this.saltDepth = 0;
    for (const m of this.duck) m.visible = false;
    this.pick.visible = false;
  }
  // run `fn` in `after` s (a staggered arc); at once when quiet or when after is 0
  at(after, fn) { if (after <= 0) fn(); else this.later.push({ t: after, fn }); }

  // Rubber Duck: the duck pops from under the bell (squash, then overshoot back), three arcs at full reach
  squeak(at, radius) {
    const L = this.looks, n = L.quiet ? 1 : 3;
    for (let i = 0; i < n; i++) this.at(i * 0.05, () => {
      const m = L.arc(_a.copy(at).setY(at.y + 0.003 + i * 0.004), radius, L.duck, 0.22 + i * 0.045);
      if (m) m.rotation.y = i * 2;
    });
    this.duckT = 0;
    const cam = this.fx.camera.position, away = Math.hypot(cam.x - at.x, cam.z - at.z) || 1;   // in front of the bell, toward the camera, so the bell never hides it
    const k = LOOK.num('treasure-duck-forward', 0.03) / away;
    this.duckX = at.x + (cam.x - at.x) * k; this.duckY = at.y; this.duckZ = at.z + (cam.z - at.z) * k; this.duckFX = (cam.x - at.x) * k; this.duckFZ = (cam.z - at.z) * k;
  }
  // a star over a Stunned bug (it follows until the stun ends); at most 6 at once
  star(e) {
    const L = this.looks; let n = 0;
    for (const p of L.pools.crystal) if (p.alive && p.kind === 'star') n++;
    if (n >= 6) return;
    const p = L.take('crystal', e.pos, L.gold, 2); if (!p) return;
    p.kind = 'star'; p.follow = e; p.m.scale.set(0.011, 0.011, 0.004);
  }

  // Windowsill Cactus: needles fly bell to bug (after the hit has landed), stick a moment, a few stand in
  // the floor at the ring's edge and the bell bristles. Quiet: no flight, no bristle.
  needles(center, feet, radius, hits, col) {
    const L = this.looks, quiet = L.quiet, w = LOOK.num('gadget-needle-width', 0.0013);
    for (const { at, e } of hits) {
      const p = L.take('needle', center, col, 0.5); if (!p) break;
      _d.copy(at).sub(center); const len = _d.length(); if (len < 1e-6) { p.alive = false; p.m.visible = false; continue; }
      p.m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len)); p.m.scale.set(w * 3, 0.02, w * 3);
      p.stick = true; p.off = new THREE.Vector3().copy(at).sub(e.pos); p.off.y = at.y - e.pos.y;
      p.fromX = center.x; p.fromY = center.y; p.fromZ = center.z;
      this.flights.push({ p, e, t: quiet ? 1 : 0, dur: LOOK.num('treasure-needle-flight', 0.08) });
      p.follow = quiet ? e : null;
    }
    if (quiet) return;
    const edge = Math.min(radius, LOOK.num('treasure-needle-floor-reach', 1) * radius);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.4, p = L.take('needle', feet, col, 0.45); if (!p) break;
      p.m.position.set(feet.x + Math.cos(a) * edge, feet.y + 0.004, feet.z + Math.sin(a) * edge);
      p.m.rotation.set(0.35 * Math.cos(a), 0, -0.35 * Math.sin(a)); p.m.scale.set(w * 3, 0.014, w * 3);
    }
    const r = LOOK.num('treasure-bristle-radius', 0.03), ps = [];
    for (let i = 0; i < 8; i++) {
      const p = L.take('needle', center, col, 0.2); if (!p) break;
      p.a = i * Math.PI / 4; p.m.scale.set(w * 3, 0.016, w * 3); ps.push(p);
    }
    this.bristle = { ps, r };
  }

  // Guitar Pick: the pick flicks across the bell during the prepare; the chord is three arcs 0.06 s apart
  // with the kit's string wobble; a note drifts up off each bug it hit
  pickPrepare(center, k) {   // k: 0..1 through the prepare
    const m = this.pick; m.visible = true;
    m.position.set(center.x + (k - 0.5) * 0.05, center.y + 0.012, center.z);
    m.rotation.set(0, k * 3, -0.6 + k * 1.2); m.userData.opacity = 1 - k * 0.5; this.pickT = 0.05;
  }
  chord(feet, radius, col, life) {
    const L = this.looks, n = L.quiet ? 1 : 3;
    for (let i = 0; i < n; i++) this.at(i * 0.06, () => L.arc(_a.copy(feet).setY(feet.y + 0.004), radius, col, life));
  }
  note(at, col) {
    const L = this.looks, q = L.quiet, k = LOOK.num('treasure-note-size', 1.8);   // above the bug and its damage number, big enough to read on a phone
    const head = L.take('stud', _a.copy(at).setY(at.y + 0.03), col, 0.8); if (!head) return;
    head.kind = 'drift'; head.m.scale.set(0.009 * k, 0.0035 * k, 0.0065 * k); head.m.rotation.z = 0.35; head.v.set(0, q ? 0 : 0.04, 0);
    const stem = L.take('rod', head.m.position, col, 0.8); if (!stem) return;
    stem.kind = 'drift'; stem.m.position.add(_d.set(0.0078 * k, 0.017 * k, 0)); stem.m.scale.set(0.0017 * k, 0.034 * k, 0.0017 * k); stem.v.copy(head.v);
  }

  // Bath Salt: a burst that follows another within 0.5 s is deeper in the chain: more, bigger crystals
  // thrown faster, a rising chime and a second of glitter on the floor. Nothing is drawn past `radius`.
  salt(at, radius) {
    const L = this.looks, quiet = L.quiet;
    this.saltDepth = this.clock - this.saltAt < 0.5 ? Math.min(4, this.saltDepth + 1) : 0; this.saltAt = this.clock;
    const depth = this.saltDepth, life = LOOK.num('gadget-salt-life', 0.36);
    L.arc(at, radius, L.silver, 0.18);
    const n = quiet ? 2 : 7 + depth * 4, reach = radius * 0.9;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, p = L.take('crystal', at, L.silver, life); if (!p) break;
      const speed = Math.min(0.045 * (1 + depth * 0.4), reach / life);
      p.m.position.add(_d.set(Math.cos(a) * radius * 0.2, 0.002, Math.sin(a) * radius * 0.2));
      p.m.scale.setScalar(0.004 * (1 + depth * 0.3)); p.v.set(Math.cos(a) * speed, 0.06, Math.sin(a) * speed);
    }
    if (!quiet && !this.fx.low()) for (let i = 0; i < 4 + depth * 2; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * reach;
      this.fx.glow.emit(_d.set(at.x + Math.cos(a) * d, at.y + 0.003, at.z + Math.sin(a) * d), L.silver, 0.004, 0.001, 0.6 + Math.random() * 0.4, 0.8);
    }
    return depth;
  }

  update(dt, center, feet) {
    this.clock += dt;
    for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; if ((l.t -= dt) <= 0) { this.later.splice(i, 1); l.fn(); } }
    if (this.duckT >= 0) {   // pop up from under the bell: squash 0.08 s, overshoot back over 0.25 s, then fade
      const t = (this.duckT += dt), [body, head, beak] = this.duck, quiet = this.looks.quiet;
      if (t > DUCK_LIFE) { this.duckT = -1; for (const m of this.duck) m.visible = false; } else {
        const u = Math.min(1, Math.max(0, (t - 0.08) / 0.25)), y = quiet ? 1 : t < 0.08 ? 1 - 0.4 * t / 0.08 : 0.6 + 0.4 * backOut(u), xz = 1 + (1 - y) * 0.5;
        const rise = 0.02 * Math.min(1, t / 0.2), op = Math.min(1, (DUCK_LIFE - t) / 0.15), s = body.userData.size;
        body.position.set(this.duckX, this.duckY + 0.008 + rise, this.duckZ); body.scale.set(s * xz * 1.2, s * y, s * xz);
        head.position.set(this.duckX + this.duckFX * 0.2, this.duckY + 0.008 + rise + s * y + 0.006, this.duckZ + this.duckFZ * 0.2); head.scale.setScalar(head.userData.size * (0.5 + 0.5 * y));
        beak.position.set(this.duckX + this.duckFX * 0.5, head.position.y - 0.001, this.duckZ + this.duckFZ * 0.5); beak.quaternion.setFromUnitVectors(UP, _a.set(this.duckFX, 0, this.duckFZ).normalize()); beak.scale.set(0.004, 0.007, 0.004);
        for (const m of this.duck) { m.visible = true; m.userData.opacity = op; }
      }
    }
    if (this.pickT >= 0 && (this.pickT -= dt) < 0) { this.pick.visible = false; this.pickT = -1; }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i], p = f.p;
      if (!p.alive || !p.stick) { this.flights.splice(i, 1); continue; }
      if ((f.t += dt / f.dur) >= 1) {
        p.follow = f.e; this.flights.splice(i, 1); continue;
      }
      const k = f.t, to = f.e.pos;
      p.m.position.set(p.fromX + (to.x + p.off.x - p.fromX) * k, p.fromY + (to.y + p.off.y - p.fromY) * k, p.fromZ + (to.z + p.off.z - p.fromZ) * k);
    }
    const B = this.bristle;
    if (B) {
      let live = false;
      for (const p of B.ps) if (p.alive) { live = true; p.m.position.set(center.x + Math.cos(p.a) * B.r, center.y, center.z + Math.sin(p.a) * B.r); p.m.quaternion.setFromUnitVectors(UP, _d.set(Math.cos(p.a), 0, Math.sin(p.a))); }
      if (!live) this.bristle = null;
    }
  }
}
