// The Overdraw view: every drawn piece wearing one flat additive layer, depth test off, so a pixel's
// brightness is how many pieces were drawn over it. A dev tool (dev panel, Check group) and a measurement
// (`measureOverdraw`, read by tools/perf-phone.mjs and the story engine/overdraw-stays-under-budget).
// Counts every layer the pieces submit to the pixel; the real picture's depth test would drop some of them.
// Skipped: Points, Sprites and Lines (they don't draw with a mesh material), and the full-screen passes (AO, bloom).
import * as THREE from 'three';

const STEP = 2 / 255;   // one layer, in an 8-bit channel: counts up to 127 before it clamps

// one layer = `step` of brightness; the on-screen view uses a bigger step so a single layer shows
function layerMaterial(step, side, twoPass) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(step, step, step), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side, toneMapped: false, fog: false });
  m.forceSinglePass = !twoPass;   // a see-through two-sided piece draws its back, then its front: two layers, as in the real picture
  return m;
}
export const VIEW_STEP = 0.012;   // on screen: 1 layer is dark grey, 10 layers mid grey, about 40 layers near white

// Runs `draw` with every mesh wearing a flat layer of its own side (and pass count), the background out of the way.
const MATS = new Map();   // kept for good (a few): a disposed material would drop its shader program, rebuilt every frame of the view
function withOverdraw(renderer, scene, step, seeThrough, draw, room = null) {
  const undo = [], bg = scene.background, clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  const swap = (m) => {
    const twoPass = m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass, k = `${step}|${m.side}|${twoPass}`;
    if (!MATS.has(k)) MATS.set(k, layerMaterial(step, m.side, twoPass));
    return MATS.get(k);
  };
  try {
  scene.traverse((o) => {
    if (!o.visible) return;
    const own = o.isMesh ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
    let inRoom = false;
    if (seeThrough && room && own) for (let a = o; a && !inRoom; a = a.parent) inRoom = a === room;
    if (!own || (seeThrough && (inRoom || !own.some((m) => m.transparent)))) { if (o.isPoints || o.isSprite || o.isLine || own) { undo.push([o, 'visible', true]); o.visible = false; } return; }
    undo.push([o, 'material', o.material]);
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  scene.background = null; renderer.setClearColor(0x000000, 0);
  return draw();
  } finally {
    scene.background = bg; renderer.setClearColor(clear, alpha);
    for (const [o, k, v] of undo) o[k] = v;
  }
}

// One frame of the view, straight to the screen (the dev panel's Overdraw switch; graphics.js)
export function drawOverdrawView(renderer, scene, camera) {
  withOverdraw(renderer, scene, VIEW_STEP, false, () => renderer.render(scene, camera));
}

let target = null;
// How many layers the scene stacks on each pixel of the canvas, as the camera sees it now.
// seeThrough: count only see-through pieces (the Warnings, flames, smoke, pools: what the fight adds to the room).
// room: the apartment's own pieces (glass, prints, furniture the camera has faded) are left out of that count: they come with the view, not the fight.
// Returns { avg: layers a pixel gets on average (the whole canvas), covered: share of the canvas with any, worst, p99 }.
export function measureOverdraw(renderer, scene, camera, { seeThrough = false, room = null } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()), w = size.x, h = size.y;
  if (!target || target.width !== w || target.height !== h) { target?.dispose(); target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }); }
  const px = new Uint8Array(w * h * 4), was = renderer.getRenderTarget();
  withOverdraw(renderer, scene, STEP, seeThrough, () => {
    try { renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera); } finally { renderer.setRenderTarget(was); }
  }, room);
  renderer.readRenderTargetPixels(target, 0, 0, w, h, px);
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) hist[px[i]]++;
  const per = Math.round(STEP * 255), n = w * h;
  let sum = 0, covered = 0, worst = 0, acc = 0, p99 = null;
  for (let v = 0; v < 256; v++) {
    const layers = v / per; sum += hist[v] * layers;
    if (v > 0) covered += hist[v];
    if (hist[v]) worst = layers;
  }
  for (let v = 0; v < 256 && p99 === null; v++) { acc += hist[v]; if (acc >= n * 0.99) p99 = v / per; }
  return { avg: +(sum / n).toFixed(2), covered: +(covered / n).toFixed(3), worst, p99 };
}
