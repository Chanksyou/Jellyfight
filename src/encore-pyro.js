// The gold DJ's Pyro (act 4, the Encore's gold solo): six flame lanes across the floor from the stage
// lip, each `lane` wide, `reach` out and `height` tall. A lane's Warning is its floor strip and the
// volume over it (the space the flames will fill, so a jump doesn't clear them: step out of the lane),
// both in his colour, filling together for `warn` beats to the beat it fires. Then the flames burst
// (anything of the jelly inside the box then is hit once, for `dmg`) and a scorch mark fades where they
// stood, never in the hostile colour. A set is some of the lanes; never all six together, and a lane
// that just fired is never fired again the beat after (it is safe to step onto).
//
// Time is in beats (the song's beatNow). No light is added: the flames and the scorch marks are one
// pooled instanced draw each; the Warnings are one strip and volume per lane, hidden when idle.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { TeleMaterial, VolumeMaterial, volumeGeometry } from './vfx.js';
import { ENCORE } from './stage4.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';

const HALF = (ENCORE.tiles * ENCORE.tileSize) / 2, BOSS = ENCORE.bossSpace, LIP = BOSS.center[2] + BOSS.depth / 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

// a flame sheet standing on y = 0: a square frustum, white-gold at its foot, gold at its top (unit footprint, unit height)
function flameGeometry(color) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.45, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const hot = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55), cool = new THREE.Color(color), p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) hot.clone().lerp(cool, p.getY(i)).toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// a flat soot mark on the floor, soft at its edge (`edge`: 1 in the middle to 0 on the border; `fade` is per lane)
function scorchGeometry(lanes) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 4).rotateX(-Math.PI / 2), p = g.attributes.position, edge = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) edge[i] = Math.max(0, 1 - (Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) * 2) ** 2);
  g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
  g.setAttribute('fade', new THREE.InstancedBufferAttribute(new Float32Array(lanes), 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}

export class EncorePyro {
  // arena: buildAct4's; fx: the game's (impact); onHit(dmg, cast): the jelly was hit
  // (scene: where the Warnings go, beside every other attack's, so the Warning checks find them)
  constructor(arena, fx, { onHit = () => {}, color = '#ffb01e', scene = arena.root } = {}) {
    Object.assign(this, { arena, fx, onHit, scene });
    this.color = new THREE.Color(color);
    this.w = LOOK.num('encore-pyro-lane', 0.24);
    this.lanes = Math.max(2, Math.round((HALF * 2) / this.w));
    this.warnGlow = LOOK.num('encore-pyro-warning', 0.6); this.laneGlow = LOOK.num('encore-pyro-volume', 0.3);
    this.beat = null; this.casts = [];
    // when each lane's flames last burst (beats; null: none), for the flames and the scorch under them
    this.burnAt = new Array(this.lanes).fill(null); this.at = { height: 0.35, reach: 0.48, burn: 0.5, scorch: 8 };
    const n = this.lanes;
    this.flames = new THREE.InstancedMesh(flameGeometry(color), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: LOOK.num('encore-flame-opacity', 0.8) }), n);
    this.scorch = new THREE.InstancedMesh(scorchGeometry(n), new THREE.MeshBasicMaterial({ color: LOOK.color('encore-scorch', '#1a1410'), transparent: true, depthWrite: false, opacity: LOOK.num('encore-scorch-opacity', 0.55), polygonOffset: true, polygonOffsetFactor: -1 }), n);
    this.scorch.material.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float edge;\nattribute float fade;\nvarying float vA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = edge * fade;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vA;');
    };
    this.flames.name = 'Encore flames'; this.scorch.name = 'Encore scorch';
    this.flames.renderOrder = 5; this.scorch.renderOrder = 1;
    for (const m of [this.flames, this.scorch]) { m.frustumCulled = false; m.userData.noCollide = true; for (let i = 0; i < n; i++) m.setMatrixAt(i, _m.makeScale(0, 0, 0)); arena.root.add(m); }
    this.owned = [this.flames.geometry, this.flames.material, this.scorch.geometry, this.scorch.material];
    // the Warnings: a floor strip and the volume over it, one pair a lane
    this.warnings = Array.from({ length: n }, () => {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.0015, 0.5), new TeleMaterial(this.color, 'strip'));
      const lane = new THREE.Mesh(volumeGeometry('lane'), new VolumeMaterial(this.color, 'lane'));
      band.renderOrder = 3; lane.renderOrder = 4;
      for (const o of [band, lane]) { o.visible = false; o.userData.noCollide = true; scene.add(o); }
      this.owned.push(band.geometry, band.material, lane.material);
      return { band, lane, cast: null };
    });
  }

  laneX(l) { return -HALF + (l + 0.5) * this.w; }

  // a set of `lanes` (indices from the -x side) firing on beat `fire`; null if it would break the rules
  // (all lanes at once, or a lane again within a beat of its last)
  cast(fire, { lanes, dmg = 4, height = 0.35, reach = 0.48, warn = 2, burn = 0.5, scorch = 8 } = {}) {
    const set = new Set(lanes);
    if (!set.size || set.size >= this.lanes || [...set].some((l) => !(l >= 0 && l < this.lanes))) return null;
    for (const o of this.casts) if (Math.abs(o.fire - fire) < 1 && (o.lanes.some((l) => set.has(l)) || new Set([...o.lanes, ...set]).size >= this.lanes)) return null;
    const c = { fire, warnAt: fire - warn, lanes: [...set], dmg, height, reach, burn, scorch, fired: false };
    this.casts.push(c);
    return c;
  }

  update(beat, player, dt = 1 / 60) {
    if (this.beat !== null && beat < this.beat) this.reset();
    const skip = this.beat !== null && beat - this.beat > 1;
    this.beat = beat;
    let moved = false;
    for (const c of this.casts) {
      if (beat < c.warnAt) continue;
      if (beat < c.fire) { this.warnStep(c, beat); continue; }
      // it fires on the beat: a box per lane, the jelly's feet below its top
      c.fired = true; moved = true;
      this.at.height = c.height; this.at.reach = c.reach; this.at.burn = c.burn; this.at.scorch = c.scorch;
      for (const l of c.lanes) {
        this.burnAt[l] = c.fire; this.freeWarning(l, c);
        if (!skip) { _p.set(this.laneX(l), 0.02, LIP + c.reach * 0.2); this.fx.impact(_p, this.color, 0.03, 8); }
      }
      if (!skip) { sfx.whiz?.(); juice.feel('hit'); }
      const p = player?.position, pr = player?.cfg?.radius ?? 0.03;
      if (!skip && p && p.y < c.height && p.z > LIP - pr && p.z < LIP + c.reach + pr && c.lanes.some((l) => p.x > this.laneX(l) - this.w / 2 - pr && p.x < this.laneX(l) + this.w / 2 + pr)) this.onHit(c.dmg, c);
    }
    if (moved) this.casts = this.casts.filter((c) => !c.fired);
    this.draw(beat);
  }

  // its Warning: a strip and volume per lane, filling over `warn` beats to the beat it fires
  warnStep(c, beat) {
    const progress = Math.min(1, Math.max(0, (beat - c.warnAt) / (c.fire - c.warnAt)));
    for (const l of c.lanes) {
      const w = this.warnings[l]; w.cast = c;
      w.band.visible = w.lane.visible = true;
      w.band.position.set(this.laneX(l), 0, LIP); w.band.scale.set(this.w, 1, c.reach);
      w.lane.position.set(this.laneX(l), 0, LIP); w.lane.scale.set(this.w, c.height, c.reach);
      w.band.material.progress = w.lane.material.progress = progress;
      w.band.material.uniforms.uTime.value = beat;
      w.band.material.opacity = this.warnGlow; w.lane.material.opacity = this.laneGlow;
    }
  }
  freeWarning(l, c) { const w = this.warnings[l]; if (w.cast === c) { w.band.visible = w.lane.visible = false; w.cast = null; } }

  // the flames and scorch marks of the lanes that have burst
  draw(beat) {
    const { height, reach, burn, scorch } = this.at, fade = this.scorch.geometry.attributes.fade;
    let any = false;
    for (let l = 0; l < this.lanes; l++) {
      const t0 = this.burnAt[l];
      if (t0 === null) continue;
      const t = beat - t0, s = t / burn;
      if (t > scorch) { this.burnAt[l] = null; this.flames.setMatrixAt(l, _m.makeScale(0, 0, 0)); this.scorch.setMatrixAt(l, _m.makeScale(0, 0, 0)); fade.setX(l, 0); any = true; continue; }
      // the burst: up fast, then down; it flickers as it burns
      const h = s >= 1 ? 0 : height * (s < 0.2 ? s / 0.2 : 1 - (s - 0.2) / 0.8), f = 1 + 0.08 * Math.sin(beat * 40 + l * 2);
      this.flames.setMatrixAt(l, _m.compose(_p.set(this.laneX(l), 0, LIP + reach / 2), _q.identity(), _s.set(this.w * 0.9 * f, Math.max(0, h), reach * 0.95 * f)));
      this.scorch.setMatrixAt(l, _m.compose(_p.set(this.laneX(l), 0.002, LIP + reach / 2), _q.identity(), _s.set(this.w * 0.9, 1, reach * 0.95)));
      fade.setX(l, Math.min(1, t / 0.25) * Math.max(0, 1 - t / scorch));
      any = true;
    }
    if (any) { this.flames.instanceMatrix.needsUpdate = this.scorch.instanceMatrix.needsUpdate = fade.needsUpdate = true; }
  }

  // everything gone at once (a song rewind, the short-out, its defeat)
  reset() {
    this.casts.length = 0; this.beat = null;
    for (let l = 0; l < this.lanes; l++) {
      const w = this.warnings[l]; w.band.visible = w.lane.visible = false; w.cast = null;
      this.flames.setMatrixAt(l, _m.makeScale(0, 0, 0)); this.scorch.setMatrixAt(l, _m.makeScale(0, 0, 0));
      this.scorch.geometry.attributes.fade.setX(l, 0); this.burnAt[l] = null;
    }
    this.flames.instanceMatrix.needsUpdate = this.scorch.instanceMatrix.needsUpdate = this.scorch.geometry.attributes.fade.needsUpdate = true;
  }
  // show the Warnings for the shader build at load (main.js warmUp)
  warm(on) { for (const w of this.warnings) w.band.visible = w.lane.visible = on && !w.cast; }
  dispose() { for (const m of [this.flames, this.scorch]) m.removeFromParent(); for (const w of this.warnings) { w.band.removeFromParent(); w.lane.removeFromParent(); } for (const o of this.owned) o.dispose(); this.flames.dispose(); this.scorch.dispose(); }
}
