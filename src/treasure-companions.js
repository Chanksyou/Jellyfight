// Treasure juice J3: the three Treasures that stay with you, drawn: Fairy Lights (a sagging wire through
// the bulbs, a short trail each, twinkling, a pop when one stings), the Magnifying Glass (a lens that
// tilts at its target while the beam narrows to a point and leaves scorches) and the Disco Ball (light
// dots sweeping the floor, the light stepping through four pastels on the song's beat, the ball dipping
// as it picks). Looks only: bulb places, the beam's range and tick and the spotlight's pick are
// untouched (gadgets.js, house-gadgets.js call in). Reduce effects keeps where and how far and drops the
// motion; Low graphics drops the wire, trails, dots and wisps.
import * as THREE from 'three';
import { LOOK } from './look.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color();
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
const WIRE_MAX = 12, NARROW = 0.4, TAU = Math.PI * 2;

export class TreasureCompanions {
  constructor(g) {
    this.g = g; this.fx = g.fx; this.looks = g.looks; this.t = 0;
    // Fairy Lights: one line loop through the bulbs and a sagging point between each pair (+1 draw)
    this.fairyColor = new THREE.Color(LOOK.color('treasure-fairyLights', '#ffe7a8'));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WIRE_MAX * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.wire = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: this.fairyColor, transparent: true, opacity: LOOK.num('treasure-wire-opacity', 0.5), depthWrite: false, toneMapped: false }));
    this.wire.frustumCulled = false; this.wire.visible = false; g.group.add(this.wire);
    this.lag = new THREE.Vector3();   // where the wire's sag trails to as you swim
    // Magnifying Glass: a rim and a thin pane, kit pieces tinted per instance
    const size = LOOK.num('treasure-lens-size', 0.011), mk = (name, geo2, color, opacity) => g.props.prop(name, () => {
      const m = g.fx.piece(geo2, g.looks.mat); m.userData.size = size; m.userData.color.copy(color); m.userData.opacity = opacity; return m;
    });
    const glass = new THREE.Color(LOOK.color('treasure-magnifier', '#c6f6ff'));
    this.rim = mk('lens-rim', new THREE.TorusGeometry(1, 0.09, 6, 24), glass, 0.85);
    this.pane = mk('lens-pane', new THREE.CircleGeometry(0.92, 24), glass, 0.16);
    this.tilt = new THREE.Quaternion(); this.aimed = false; this.scorchT = 0;
    this.scorch = LOOK.color('beetle-scorch', '#2a1a12');
    this.wisp = new THREE.Color(0xe8e0d8);
    // Disco Ball: four pastels stepped on the beat
    this.palette = [0, 1, 2, 3].map((i) => new THREE.Color(LOOK.color('treasure-disco-' + i, ['#d8beff', '#ffc2e8', '#b8f0ff', '#c8ffd2'][i])));
    this.tint = new THREE.Color(this.palette[0]); this.kick = 0;
  }

  reset() { this.hide(); this.t = 0; this.kick = 0; this.tint.copy(this.palette[0]); }
  hide() {
    this.wire.visible = this.rim.visible = this.pane.visible = false; this.aimed = false;
    this.g.bulbs.forEach((b) => { b.scale.setScalar(1); b.userData.pop = 0; });
    this.g.beam.scale.x = this.g.beam.scale.z = 1;
  }
  // shown for a frame at load so the wire's program is built up front (Gadgets.warm; the lens is a prop)
  warm(on) {
    this.wire.visible = on;
    if (on) this.wire.geometry.setDrawRange(0, 3);
  }

  // ---- Fairy Lights: after the bulbs are placed this frame (n of them, circling `center`)
  pop(bulb) { bulb.userData.pop = 1; }
  fairy(n, center, dt) {
    const g = this.g, q = this.looks.quiet, low = g.fx.low(), t = (this.t += dt);
    this.lag.lerp(center, q || !this.wire.visible ? 1 : 1 - Math.exp(-dt * 6));
    const P = this.wire.geometry.attributes.position.array;
    this.wire.visible = !low && n >= 2;
    if (this.wire.visible) {
      for (let i = 0; i < n; i++) {
        const b = g.bulbs[i].position, c = g.bulbs[(i + 1) % n].position;
        _a.copy(b).add(c).multiplyScalar(0.5).addScaledVector(_b.copy(this.lag).sub(center), 0.7);   // the sag trails behind a swim
        const k = i * 6;   // written in place: nothing allocated a frame
        P[k] = b.x; P[k + 1] = b.y; P[k + 2] = b.z; P[k + 3] = _a.x; P[k + 4] = _a.y - 0.004; P[k + 5] = _a.z;
      }
      this.wire.geometry.setDrawRange(0, n * 2); this.wire.geometry.attributes.position.needsUpdate = true;
    }
    for (let i = 0; i < n; i++) {
      const b = g.bulbs[i], u = b.userData, core = b.children[0];
      u.pop = Math.max(0, (u.pop || 0) - dt / 0.15);
      b.scale.setScalar(q ? 1 : 1 + 0.6 * u.pop);   // a stinging bulb pops to 1.6x for 0.15 s
      core.scale.setScalar(q ? 1 : 1 + 0.3 * Math.sin(t * 7 + i * 2.1));   // each twinkles in turn
      if (q || low) continue;
      for (let j = 1; j <= 2; j++) {   // a short trail: the bulb a moment ago, a glow held where it was
        const a = -0.2 * j, cs = Math.cos(a), sn = Math.sin(a), dx = b.position.x - center.x, dz = b.position.z - center.z;
        g.fx.glow.hold(_a.set(center.x + dx * cs - dz * sn, b.position.y, center.z + dx * sn + dz * cs), b.material.color, 0.011 / j, 0.4 / j);
      }
    }
  }

  // ---- Magnifying Glass: c is its target's centre (null: none), age how long it has held it
  magnify(center, c, e, age, dt, ticked) {
    const g = this.g, q = this.looks.quiet, beam = g.beam;
    if (!c) { this.rim.visible = this.pane.visible = false; this.aimed = false; beam.scale.x = beam.scale.z = 1; this.scorchT = 0; return; }
    const dir = _a.copy(c).sub(center); if (dir.lengthSq() < 1e-10) dir.copy(UP); dir.normalize();
    _q.setFromUnitVectors(Z, _b.copy(dir).addScaledVector(UP, 0.9).normalize());   // tipped up a little so the camera sees its face
    if (!this.aimed || q) this.tilt.copy(_q); else this.tilt.slerp(_q, 1 - Math.exp(-dt * 10));   // it swivels when the target changes
    this.aimed = true;
    for (const o of [this.rim, this.pane]) {
      o.visible = true; o.quaternion.copy(this.tilt); o.scale.setScalar(o.userData.size);
      o.position.set(center.x + dir.x * 0.016, center.y + 0.04 + (q ? 0 : Math.sin(this.t * 2.4) * 0.002) + dir.y * 0.016, center.z + dir.z * 0.016);
    }
    this.t += dt;
    const k = Math.min(1, age / NARROW);
    beam.scale.x = beam.scale.z = 1.5 - 1.15 * (1 - (1 - k) * (1 - k));   // wide at lock, a point by 0.4 s: a look, the damage stays flat
    if (age <= dt || (this.scorchT -= dt) <= 0) {   // a scorch under it on lock and each second
      this.scorchT = 1;
      g.fx.splat(_b.set(c.x, e.proxy ? c.y - (e.r || 0.05) : e.pos.y, c.z), this.scorch, Math.max(0.01, e.r * 0.9), 'scorch');
    }
    if (ticked && !q && !g.fx.low()) for (const s of [-1, 1])   // a curl of smoke off each burn
      g.fx.glow.emit(_b.copy(c).setY(c.y + e.r * 0.4), this.wisp, e.r * 0.4, e.r * 1.1, 0.7, 0.3, _a.set(s * 0.01, 0.03, -s * 0.006));
  }

  // ---- Disco Ball: tints the cone, pool and ball, sweeps the dots, dips the ball
  picked() { if (!this.looks.quiet) this.kick = 1; }
  disco(feet, spotted, dt, beat) {
    const g = this.g.house, q = this.looks.quiet, low = this.fx.low();
    this.t += dt; this.kick = Math.max(0, this.kick - dt * 2.5);
    const i = q ? 0 : Math.floor(beat || 0) & 3;
    this.tint.lerp(_c.copy(this.palette[i]), q ? 1 : 1 - Math.exp(-dt * 14));
    g.cone.material.color.copy(this.tint); g.spotPool.material.uniforms.uColor.value.copy(this.tint); g.ball.material.emissive.copy(this.tint);
    g.ball.position.y -= 0.012 * this.kick;   // it dips as it picks and spins up (house-gadgets.js reads `kick`)
    if (!q && !low) for (let d = 0; d < 8; d++) {   // eight dots of light swing round the floor
      const a = this.t * 0.9 + (d / 8) * TAU, r = 0.055 + 0.025 * Math.sin(this.t * 0.7 + d * 1.3);
      this.fx.glow.hold(_a.set(feet.x + Math.cos(a) * r, feet.y + 0.004, feet.z + Math.sin(a) * r), this.palette[(i + d) & 3], 0.012, 0.8);
    }
    if (spotted) this.fx.glow.hold(this.g.enemies.center(spotted, _a), this.tint, (spotted.r || 0.03) * 2.6, 0.35);   // the picked bug wears the light's colour
  }
}
