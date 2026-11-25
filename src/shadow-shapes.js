// The shadows' shapes (systems.js ShadowSystem): every model the act can show, drawn once from straight above
// (black on clear) into one 64 px cell of a shared 512 px picture, then blurred on the CPU, twice: a sharp copy (red)
// for something on the ground and a soft one (green) for something high up; the shader mixes them per instance.
// All of it happens at load (main.js warmUp): one small render and read-back per model, nothing kept but the picture.
//
// A cell is centred on the model's own origin (where it stands), so the darkest part stays under the creature.
// `half` is the cell's half-width in the model's own units: the shadow's size in the world is `half` times the
// model's scale as it plays. Cell 0 is the old soft round disc, for anything without a model of its own.
//
// A model that wants a different pose for its shadow says so next to its builder (critters.js: `shadowPose`).
import * as THREE from 'three';
import { LOOK } from './look.js';

export const CELL = 64, ATLAS = 512, PER_ROW = ATLAS / CELL;

// `src` spread outward by `r` px (the largest value within r): a shadow reaches a little past the body, as a contact shadow does
function grow(src, r) {
  if (r <= 0) return src;
  const a = new Float32Array(src.length), b = new Float32Array(src.length);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < CELL && src[y * CELL + xx] > m) m = src[y * CELL + xx]; }
    a[y * CELL + x] = m;
  }
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < CELL && a[yy * CELL + x] > m) m = a[yy * CELL + x]; }
    b[y * CELL + x] = m;
  }
  return b;
}

// a box blur of `src` (CELL x CELL, 0..1) `passes` times with radius `r`, separable, into a new array
function blur(src, r, passes) {
  let a = Float32Array.from(src), b = new Float32Array(a.length);
  const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < CELL) s += a[y * CELL + xx]; }
      b[y * CELL + x] = s / n;
    }
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < CELL) s += b[yy * CELL + x]; }
      a[y * CELL + x] = s / n;
    }
  }
  return a;
}

export class ShadowShapes {
  constructor() {
    this.data = new Uint8Array(ATLAS * ATLAS * 4);
    this.texture = new THREE.DataTexture(this.data, ATLAS, ATLAS, THREE.RGBAFormat);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.cells = new Map();   // key -> { i: its index, u, v: its corner in the picture, half }
    this.renders = 0;         // models drawn into the picture (a story checks none are drawn in play)
    this.pad = LOOK.num('shadow-shape-pad', 1.15);          // the cell is this much wider than the model, for the blur
    this.sharp = LOOK.num('shadow-shape-sharp', 3);         // px: the blur on the ground
    this.soft = LOOK.num('shadow-shape-soft', 5);           // px: the blur high up
    this.keep = LOOK.num('shadow-shape-keep', 0.93);        // the share of a shape's ink its drawn circle holds (the faint tips of legs fall outside)
    this.grow = Math.round(LOOK.num('shadow-shape-grow', 2));   // px: how far a shape reaches past its model's edge before the blur
    this.put('disc', (x, z) => { const d = Math.hypot(x, z); return d < 0.45 ? 1 - d * 0.6 : Math.max(0, 0.73 * (1 - d) / 0.55); }, 1, { blurred: true });   // the old soft round one
  }
  has(key) { return this.cells.has(key); }
  cell(key) { return this.cells.get(key) || this.cells.get('disc'); }

  // a cell from a function of the cell's own coordinates (-1..1 across, z forward), 0..1; half: its half-width
  put(key, fn, half, { blurred = false } = {}) {
    const mask = new Float32Array(CELL * CELL);
    for (let r = 0; r < CELL; r++) for (let c = 0; c < CELL; c++) mask[r * CELL + c] = fn((c + 0.5) / CELL * 2 - 1, (r + 0.5) / CELL * 2 - 1);
    return this.store(key, mask, half, blurred);
  }
  store(key, mask, half, blurred) {
    const i = this.cells.has(key) ? this.cells.get(key).i : this.cells.size;
    if (i >= PER_ROW * PER_ROW) return this.cell('disc');
    if (!blurred) mask = grow(mask, this.grow);
    const sharp = blurred ? mask : blur(mask, this.sharp, 2), soft = blur(mask, this.soft, 3);
    const cx = (i % PER_ROW) * CELL, cy = Math.floor(i / PER_ROW) * CELL, d = this.data;
    for (let r = 0; r < CELL; r++) for (let c = 0; c < CELL; c++) {
      const edge = r < 1 || c < 1 || r >= CELL - 1 || c >= CELL - 1;   // a clear rim: no bleed from the next cell
      const at = ((cy + r) * ATLAS + cx + c) * 4, j = r * CELL + c;
      d[at] = edge ? 0 : Math.round(255 * Math.min(1, sharp[j]));
      d[at + 1] = edge ? 0 : Math.round(255 * Math.min(1, soft[j]));
      d[at + 2] = 0; d[at + 3] = 255;
    }
    // how much of the cell the shape really fills: the radius holding all but a sliver of its sharp copy, so the
    // drawn circle is no bigger than the shadow (every pixel of it is a layer on a phone, even a clear one)
    let total = 0;
    const ring = new Float32Array(CELL);
    for (let r = 0; r < CELL; r++) for (let c = 0; c < CELL; c++) { const v = sharp[r * CELL + c], k = Math.min(CELL - 1, Math.floor(Math.hypot(c + 0.5 - CELL / 2, r + 0.5 - CELL / 2))); ring[k] += v; total += v; }
    let crop = 1;
    for (let k = 0, sum = 0; k < CELL; k++) { sum += ring[k]; if (sum >= total * this.keep) { crop = Math.min(1, (k + 1) / (CELL / 2)); break; } }
    const cell = { i, u: cx / ATLAS, v: cy / ATLAS, half, crop };
    this.cells.set(key, cell);
    this.texture.needsUpdate = true;
    return cell;
  }

  // Draw `object` from straight above into the cell `key`, in its own frame: its own position and turn are set aside
  // for the draw and put back after (it's never kept or changed). Glows, see-through parts, points and lines don't
  // cast. Returns the cell, or the disc if the model shows nothing from above.
  draw(renderer, key, object) {
    if (this.cells.has(key)) return this.cells.get(key);
    const was = { parent: object.parent, at: object.parent?.children.indexOf(object), p: object.position.clone(), q: object.quaternion.clone(), s: object.scale.clone(), vis: object.visible };
    const scene = this.scene ||= new THREE.Scene();
    const hidden = [];
    try {
      scene.add(object);
      object.position.set(0, 0, 0); object.quaternion.identity(); object.scale.set(1, 1, 1); object.visible = true;
      object.updateMatrixWorld(true);
      const box = new THREE.Box3(), part = new THREE.Box3();
      object.traverseVisible((o) => {
        const m = o.material, glow = m && (m.blending === THREE.AdditiveBlending || (m.transparent && m.opacity < 0.6) || m.depthTest === false);
        if (o.isMesh && !o.isInstancedMesh && !glow) {
          o.geometry.boundingBox || o.geometry.computeBoundingBox();
          box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
        } else if (o !== object && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) { hidden.push(o); o.visible = false; }
      });
      if (box.isEmpty()) return this.cell('disc');
      const half = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) * this.pad;
      const cam = this.cam ||= new THREE.OrthographicCamera();
      cam.left = cam.bottom = -half; cam.right = cam.top = half; cam.near = 0.001; cam.far = box.max.y - box.min.y + 2;
      cam.position.set(0, box.max.y + 1, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);   // screen right is +x, screen up is -z
      cam.layers.enableAll();   // (the batched bugs' own meshes sit on a layer the game camera never draws)
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const rt = this.rt ||= new THREE.WebGLRenderTarget(CELL, CELL, { depthBuffer: true });
      scene.overrideMaterial = this.ink ||= new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const prev = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping };
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
      try { renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, CELL, CELL, this.px ||= new Uint8Array(CELL * CELL * 4)); }
      finally { renderer.setRenderTarget(prev.target); renderer.setClearColor(prev.color, prev.alpha); renderer.toneMapping = prev.tone; }
      this.renders++;
      const mask = new Float32Array(CELL * CELL);
      for (let r = 0; r < CELL; r++) for (let c = 0; c < CELL; c++) mask[r * CELL + c] = this.px[((CELL - 1 - r) * CELL + c) * 4] / 255;   // read-back row 0 is +z
      return this.store(key, mask, half, false);
    } finally {
      for (const o of hidden) o.visible = true;
      scene.remove(object);
      object.position.copy(was.p); object.quaternion.copy(was.q); object.scale.copy(was.s); object.visible = was.vis;
      if (was.parent) { was.parent.add(object); const c = was.parent.children; c.splice(c.indexOf(object), 1); c.splice(was.at, 0, object); }
      object.updateMatrixWorld(true);
    }
  }

  // done drawing: let the drawing's GPU bits go (the picture itself stays)
  finish() {
    this.rt?.dispose(); this.ink?.dispose();
    this.rt = this.ink = this.scene = this.cam = null;
  }
}
