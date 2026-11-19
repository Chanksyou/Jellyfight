// The Wall of sound (act 4: the Encore's duet, from set 3). The silver DJ throws three records
// (encore-records.js), and they stand until the wall has passed them. As the last one lands the whole
// floor fills as a Warning: a strip over the floor and the slab over it, `height` tall, in
// `--hostile-encore-wall`, with a white safe strip behind each standing record (docs/adr/0003). On the
// bar line two bars later the wall rolls out of the stage to the back of the floor in `roll` beats.
// Anything of the jelly it passes, at any height (a jump doesn't clear it), is hit once, unless it is
// in a safe strip: the record in front of it takes the wall for it and shatters as it does (the
// gap shows in the wall). With no record standing as the Warning would start, the wall is called off.
//
// Time is in beats (the song's beatNow). No light is added: the wall is one instanced draw of
// columns; its Warning a floor strip, a slab and up to three white strips, hidden when idle.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { TeleMaterial, VolumeMaterial, volumeGeometry } from './vfx.js';
import { ENCORE } from './stage4.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';

const HALF = (ENCORE.tiles * ENCORE.tileSize) / 2, BOSS = ENCORE.bossSpace, LIP = BOSS.center[2] + BOSS.depth / 2;
const COLS = 36, SAFE = 3, Z0 = -HALF, Z1 = HALF;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export class EncoreWall {
  // arena: buildAct4's; fx: the game's (impact); onHit(dmg): the wall reached the jelly
  // (scene: where the Warnings go, beside every other attack's)
  constructor(arena, fx, { onHit = () => {}, color = '#ff2440', scene = arena.root } = {}) {
    Object.assign(this, { arena, fx, onHit, scene });
    this.color = new THREE.Color(color);
    this.glow = LOOK.num('encore-wall-glow', 1.6); this.warnGlow = LOOK.num('encore-wall-warning', 0.55); this.slabGlow = LOOK.num('encore-wall-volume', 0.3);
    this.w = null; this.beat = null; this.swell = 0;
    // the wall: a row of columns across the floor, like a meter's bars, with a dimmer echo just behind;
    // bright at the floor, fading up. Always drawn (unused ones scaled to nothing), so its shader is built with the arena
    const geo = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.fill(1 - 0.75 * pos.getY(i), i * 3, i * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), COLS * 2);
    this.mesh.name = 'Encore wall of sound'; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true; this.mesh.renderOrder = 5;
    for (let i = 0; i < COLS * 2; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.set(0)); }
    arena.root.add(this.mesh);
    // the Warning: a floor strip from the back of the stage to the back of the floor and the slab over it,
    // and the white strips it spares
    const strip = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.band = new THREE.Mesh(strip(), new TeleMaterial(this.color, 'strip'));
    this.slab = new THREE.Mesh(volumeGeometry('lane'), new VolumeMaterial(this.color, 'lane'));
    this.band.renderOrder = 3; this.slab.renderOrder = 4;
    this.band.position.set(0, 0.0015, Z0); this.band.scale.set(2 * HALF, 1, Z1 - Z0);
    this.slab.position.set(0, 0, Z0);
    this.safe = Array.from({ length: SAFE }, () => {
      const m = new THREE.Mesh(this.band.geometry, new TeleMaterial(LOOK.color('safe-spot', '#ffffff'), 'strip'));
      m.material.progress = 1; m.renderOrder = 4; return m;
    });
    this.owned = [geo, this.mesh.material, this.band.geometry, this.band.material, this.slab.material, ...this.safe.map((m) => m.material)];
    for (const o of [this.band, this.slab, ...this.safe]) { o.visible = false; o.userData.noCollide = true; scene.add(o); }
  }

  // the wall booked: its Warning from beat `warnAt`, behind the `records` (encore-records.js casts)
  // standing then, rolling from beat `rollAt` for `roll` beats. o: { dmg, height, roll, safe (m wide),
  // behind (m long), knock }
  cast(warnAt, rollAt, records, { dmg = 6, height = 0.4, roll = 2, safe = 0.1, behind = 0.3, knock = 0.6 } = {}) {
    this.reset();
    this.w = { warnAt, rollAt, end: rollAt + roll, records, dmg, height, roll, safe, behind, knock, state: 'wait', shields: [], front: Z0, hit: false };
    return this.w;
  }
  // where the front is at beat `b` of a roll (z, from the back of the stage to the back of the floor)
  frontAt(w, b) { return Z0 + (Z1 - Z0) * Math.min(1, Math.max(0, (b - w.rollAt) / w.roll)); }
  // the jelly at x, z is in a safe strip (behind a record that took the wall)
  sheltered(w, x, z) { return w.shields.some((s) => Math.abs(x - s.x) < w.safe / 2 && z > s.z && z < s.z + s.len); }

  update(beat, player) {
    const w = this.w, skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    if (!w) return;
    if (w.state === 'wait' && beat >= w.warnAt) this.raise(w, beat);
    if (w.state === 'warn') {
      const u = Math.min(1, (beat - w.warnAt) / (w.rollAt - w.warnAt));
      this.band.material.progress = this.slab.material.progress = u;
      this.band.material.opacity = this.warnGlow; this.slab.material.opacity = this.slabGlow;
      this.swell = u;
      w.shields.forEach((s, i) => { this.safe[i].visible = s.c.slot.cast === s.c; });   // (gone if its record is)
      if (beat >= w.rollAt) {
        w.state = 'roll';
        this.band.visible = this.slab.visible = false; for (const m of this.safe) m.visible = false;
        if (!skip) { this.fx.impact(_p.set(0, 0.1, LIP), this.color, 0.06, 18); juice.feel('impact-big'); sfx.encoreWall?.(); }
      }
    }
    if (w.state === 'roll') {
      const was = w.front, front = (w.front = this.frontAt(w, beat));
      this.swell = 1 - (beat - w.rollAt) / w.roll;
      // a record taking the wall: a white shimmer fading on the strip it spared (its own shatter is encore-records.js's)
      for (const s of w.shields) if (!s.took && front >= s.z) { s.took = true; if (!skip) this.fx.splat?.(_p.set(s.x, 0.002, s.z + s.len / 2), LOOK.color('safe-spot', '#ffffff'), w.safe / 2, 'dust'); }
      // the hit, as the front passes the jelly: anywhere in the floor, at any height, unless sheltered
      if (!w.hit && player && !skip) {
        const p = player.position;
        if (front >= p.z && was < p.z) {
          w.hit = true;
          if (!this.sheltered(w, p.x, p.z)) this.onHit(w.dmg, w);
        }
      }
      this.draw(w, front, beat);
      if (beat >= w.end) this.reset();
    }
  }

  // the Warning starts: behind each record standing now a safe strip, and each now stands until the
  // front reaches it; none standing, the wall is called off
  raise(w, beat) {
    for (const c of w.records) {
      if (c.slot.cast !== c || c.state !== 'stand' || w.shields.length >= SAFE) continue;
      const z = c.to[1], len = Math.min(w.behind, Z1 - z);
      if (len <= 0) continue;
      const s = { c, x: c.to[0], z, len, took: false }, m = this.safe[w.shields.length];
      m.position.set(s.x, 0.0025, z); m.scale.set(w.safe, 1, len); m.visible = true;
      c.stand = w.rollAt + (c.to[1] - Z0) / (Z1 - Z0) * w.roll - c.land;   // it shatters as the front reaches it
      w.shields.push(s);
    }
    if (!w.shields.length) { w.state = 'off'; this.swell = 0; return; }
    w.state = 'warn';
    this.band.visible = this.slab.visible = true;
    this.slab.scale.set(2 * HALF, w.height, Z1 - Z0);
    this.band.material.progress = this.slab.material.progress = 0;
  }
  // the wall's columns at `front`: each from where the floor starts under it (the stage's front for
  // the ones across the booth), with a gap where a record took it, and the echo behind
  draw(w, front, beat) {
    const cw = (2 * HALF) / COLS, H = w.height;
    for (let i = 0; i < COLS; i++) {
      const x = -HALF + (i + 0.5) * cw, start = Math.abs(x - BOSS.center[0]) < BOSS.width / 2 ? LIP : Z0;
      const gap = w.shields.some((s) => Math.abs(x - s.x) < w.safe / 2 && front > s.z && front < s.z + s.len);
      const on = front >= start && !gap, h = H * (0.82 + 0.18 * Math.abs(Math.sin(i * 1.7 + beat * Math.PI)));
      for (let k = 0; k < 2; k++) {
        const z = front - k * 0.03, j = i + k * COLS;
        if (!on || z < start) { this.mesh.setMatrixAt(j, _m.makeScale(0, 0, 0)); continue; }
        this.mesh.setMatrixAt(j, _m.compose(_p.set(x, 0, z), _q, _s.set(cw * 0.92, h * (1 - k * 0.15), 1)));
        this.mesh.setColorAt(j, _c.copy(this.color).multiplyScalar(this.glow * (k ? 0.35 : 1)));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }

  // nothing booked, nothing shown (its end, a song rewind, the short-out, its defeat)
  reset() {
    this.w = null; this.swell = 0;
    this.band.visible = this.slab.visible = false; for (const m of this.safe) m.visible = false;
    for (let i = 0; i < COLS * 2; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // show the Warnings for the shader build at load (main.js warmUp)
  warm(on) { this.band.visible = this.slab.visible = this.safe[0].visible = on && !this.w; }
  dispose() { this.mesh.removeFromParent(); for (const o of [this.band, this.slab, ...this.safe]) o.removeFromParent(); for (const o of this.owned) o.dispose(); this.mesh.dispose(); }
}
