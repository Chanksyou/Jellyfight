// The Encore's club lasers (act 4): emitters on the arena's four corner posts. One fires a fan of
// green beams, a laser plane, from its corner down to a line on the floor through where the jelly
// is. Its Warning is that line and the band it will sweep, flashing green on the floor for `lead`
// beats (the faint plane over it is its volume, docs/adr/0001); on the beat it fires and swings
// `--encore-laser-sweep` (10 cm) sideways across the band over a beat. The plane is tall by its corner
// and low at the far end, as a fan from up high is: step out of the band, or far from the corner, jump it.
//
// Time is in beats (the song's beatNow), like the floor waves. No light is added: the planes, their
// floor bands and the emitters are a few unlit draws, pooled and reused.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { TeleMaterial } from './vfx.js';
import { STAGE4 } from './stage4.js';
import { sfx } from './sfx.js';

const HALF = (STAGE4.tiles * STAGE4.tileSize) / 2;
// Health one hit takes (heavy, as the floor waves); moves to content/bosses.kdl with the campaign
export const LASER_DMG = 4;
// the emitters: just inside each corner of the floor, on the corner posts
export const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (HALF - 0.03), sz * (HALF - 0.03)]);
const POOL = 2;

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// the plane: a triangle from the emitter to a floor segment, drawn as many thin beams fanning out
// (stripes across it) over a faint sheet, brightest where it burns the floor
function laserMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOn: { value: 0 }, uTime: { value: 0 }, uBeams: { value: LOOK.num('encore-laser-beams', 28) } },
    vertexShader: /* glsl */`
      attribute vec2 fan;            // x: across the fan 0..1, y: 0 at the emitter, 1 on the floor
      varying vec2 vFan;
      void main() { vFan = fan; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOn, uTime, uBeams;
      varying vec2 vFan;
      void main() {
        float u = (vFan.x / max(vFan.y, 0.001)) * uBeams + uTime * 0.6;  // where across the fan, in beams
        float d = abs(fract(u) - 0.5), px = max(fwidth(u), 1e-4);       // distance to the nearest beam, and a pixel in those units
        float ray = 1.0 - smoothstep(0.0, px * 1.4, d);                 // each beam a crisp line about a pixel wide, never dotted
        float sheet = (0.22 + 0.08 * sin(vFan.x * 30.0 - uTime * 7.0)) * (0.4 + 0.6 * vFan.y);   // haze between them, denser low down
        float burn = smoothstep(0.94, 1.0, vFan.y) * 1.8;               // the bright line on the floor
        float a = (ray * 0.85 + sheet + burn) * uOn;
        gl_FragColor = vec4(uColor * a * 1.6, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

export class EncoreLasers {
  // arena: buildAct4's; onHit(dmg, laser): the jelly was hit
  constructor(arena, { onHit = () => {} } = {}) {
    this.arena = arena; this.onHit = onHit;
    this.color = LOOK.color('hostile-encore-laser', '#39ff14');
    this.height = LOOK.num('encore-laser-height', 0.35);
    this.beat = null;
    this.casts = [];
    this.root = new THREE.Group(); this.root.name = 'Encore lasers'; arena.root.add(this.root);
    // the emitters: a dark housing with a green lens on each corner post
    const box = new THREE.BoxGeometry(0.03, 0.022, 0.03), lens = new THREE.CircleGeometry(0.011, 16);
    this.housing = new THREE.MeshStandardMaterial({ color: '#0c1014', roughness: 0.5, metalness: 0.6 });
    this.lensMat = new THREE.MeshBasicMaterial({ color: this.color, toneMapped: false });
    this.owned = [box, lens, this.housing, this.lensMat];
    this.lenses = CORNERS.map(([x, z]) => {
      const h = new THREE.Mesh(box, this.housing); h.position.set(x, this.height, z); h.lookAt(0, this.height * 0.4, 0); h.userData.noCollide = true;
      const l = new THREE.Mesh(lens, this.lensMat); l.position.set(0, 0, 0.0155); h.add(l); l.userData.noCollide = true;
      this.root.add(h); return l;
    });
    // the pool: a plane and its floor band each
    this.pool = Array.from({ length: POOL }, () => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('fan', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 2));
      const plane = new THREE.Mesh(geo, laserMaterial(this.color)); plane.frustumCulled = false; plane.visible = false; plane.renderOrder = 4; plane.userData.noCollide = true;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.0015, 0.5), new TeleMaterial(this.color, 'strip'));
      band.visible = false; band.renderOrder = 3; band.userData.noCollide = true;
      this.root.add(plane, band); this.owned.push(geo, plane.material, band.geometry, band.material);
      return { plane, band, cast: null };
    });
  }
  get lead() { return LOOK.num('encore-laser-lead', 2); }
  get busy() { return this.casts.length > 0; }

  // fire on beat `at` from `corner` (0..3) along a line through `on` ([x, z], else where the jelly is
  // when its Warning starts, from `target()`), sweeping to `side` (1 or -1)
  cast(at, { corner = 0, on = null, target = null, side = 1, dmg = LASER_DMG } = {}) {
    const slot = this.pool.find((p) => !p.cast);
    if (!slot) return null;
    const c = { at, corner, on, target, side, dmg, slot, hit: false, fired: false };
    slot.cast = c; this.casts.push(c);
    return c;
  }

  // where the plane meets the floor at sweep `s` (0..1): from near its corner across the floor,
  // through the aimed spot, shifted s × sweep to its side
  line(c, s, a = _a, b = _b) {
    const [cx, cz] = CORNERS[c.corner], dx = c.on[0] - cx, dz = c.on[1] - cz, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len, nx = -uz * c.side, nz = ux * c.side, off = s * LOOK.num('encore-laser-sweep', 0.1);
    const far = this.reach(cx, cz, ux, uz);
    a.set(cx + ux * 0.06 + nx * off, 0, cz + uz * 0.06 + nz * off);
    b.set(cx + ux * far + nx * off, 0, cz + uz * far + nz * off);
    return { ux, uz, nx, nz, far };
  }
  // how far from a corner along (ux, uz) to the floor's edge
  reach(cx, cz, ux, uz) {
    const tx = ux > 0 ? (HALF - cx) / ux : ux < 0 ? (-HALF - cx) / ux : Infinity, tz = uz > 0 ? (HALF - cz) / uz : uz < 0 ? (-HALF - cz) / uz : Infinity;
    return Math.min(tx, tz);
  }

  // is the jelly inside the plane now: its footprint within reach of the floor line, its feet below
  // the plane's top there (tall by the corner, nothing at the far end)
  touches(c, s, player) {
    const p = player.position, r = player.cfg?.radius ?? 0.03, [cx, cz] = CORNERS[c.corner];
    const { ux, uz, nx, nz, far } = this.line(c, s);
    const off = s * LOOK.num('encore-laser-sweep', 0.1), rx = p.x - cx, rz = p.z - cz;
    const along = rx * ux + rz * uz, across = rx * nx + rz * nz - off;
    if (along < 0.06 - r || along > far + r || Math.abs(across) > r + 0.006) return false;
    return p.y < this.height * (1 - Math.max(0, along) / far);
  }

  update(beat, player) {
    if (this.beat !== null && beat < this.beat) this.reset();
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    const lead = this.lead, fire = LOOK.num('encore-laser-fire', 1), fade = 0.25;
    let lit = 0;
    for (const c of this.casts) {
      const { plane, band } = c.slot, u = beat - c.at;
      if (u < -lead) { plane.visible = band.visible = false; continue; }
      if (!c.on) c.on = c.target?.() ?? [0, 0.3];                          // aimed as its Warning starts
      const s = Math.min(1, Math.max(0, u / fire));
      // the floor band: the line and the 10 cm it will sweep, flashing on each half beat until it fires
      const { ux, uz, nx, nz, far } = this.line(c, 0), w = LOOK.num('encore-laser-sweep', 0.1) + 0.02;
      band.visible = u < fire;
      if (band.visible) {
        band.position.set(_a.x + nx * (w / 2 - 0.01), 0, _a.z + nz * (w / 2 - 0.01));
        band.rotation.set(0, Math.atan2(ux, uz), 0); band.scale.set(w, 1, far - 0.06);
        const m = band.material; m.progress = u < 0 ? 1 + u / lead : 1;
        m.opacity = u < 0 ? 0.55 + 0.45 * (Math.floor(beat * 2) % 2) : 0.35;
        m.uniforms.uTime.value = beat;
      }
      // the plane: faint over its Warning (its volume), full from the beat it fires, fading after
      const on = u < 0 ? 0.12 * (1 + u / lead) : u < fire ? 1 : Math.max(0, 1 - (u - fire) / fade);
      plane.visible = on > 0;
      if (plane.visible) {
        const [cx, cz] = CORNERS[c.corner], pos = plane.geometry.attributes.position;
        this.line(c, s);
        pos.setXYZ(0, cx, this.height, cz); pos.setXYZ(1, _a.x, 0.001, _a.z); pos.setXYZ(2, _b.x, 0.001, _b.z);
        pos.needsUpdate = true; plane.geometry.computeBoundingSphere();
        plane.material.uniforms.uOn.value = on; plane.material.uniforms.uTime.value = beat;
        lit = Math.max(lit, on);
      }
      if (u >= 0 && !c.fired) { c.fired = true; if (!skip) sfx.encoreLaser?.(); }
      // the hit: anywhere in the plane while it fires (once a laser)
      if (!skip && !c.hit && player && u >= 0 && u < fire && this.touches(c, s, player)) { c.hit = true; this.onHit(c.dmg, c); }
    }
    for (const c of this.casts) if (beat - c.at > fire + fade) { c.slot.plane.visible = c.slot.band.visible = false; c.slot.cast = null; }
    this.casts = this.casts.filter((c) => c.slot.cast === c);
    this.lensMat.color.set(this.color).multiplyScalar(0.5 + 0.5 * lit);
  }

  reset() {
    for (const c of this.casts) { c.slot.plane.visible = c.slot.band.visible = false; c.slot.cast = null; }
    this.casts.length = 0; this.beat = null;
  }
  dispose() { this.root.removeFromParent(); for (const o of this.owned) o.dispose(); }
}
