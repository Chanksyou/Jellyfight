// The pick screen's side cards in shaders (pick-aura.js says how a kind joins).
import * as THREE from 'three';
import { LOOK } from '../look.js';
import { KIT } from './kit.js';
import { SHADERS } from '../pick-aura.js';
import { portraitLayers, freePortraitLayers } from '../jelly-portrait.js';

// The pick screen's pictures (this and attack-preview.js) are drawn by the game's renderer into the
// bottom-left corner of its canvas, `px` square, and copied straight onto the card's canvas (`size`
// square): no second WebGL context, no pixel read back. paint(corner) draws; corner() points the
// renderer at that corner. The renderer is put back as it was; exposure is the portraits'.
export function drawToCard(R, ctx, px, size, paint) {
  const gl = R.domElement, ratio = R.getPixelRatio();
  const was = { target: R.getRenderTarget(), vp: R.getViewport(new THREE.Vector4()), sc: R.getScissor(new THREE.Vector4()), test: R.getScissorTest(),
    color: R.getClearColor(new THREE.Color()), alpha: R.getClearAlpha(), exposure: R.toneMappingExposure };
  try {
    R.toneMappingExposure = LOOK.num('portrait-exposure', was.exposure || 1);
    paint(() => { R.setRenderTarget(null); R.setViewport(0, 0, px / ratio, px / ratio); R.setScissor(0, 0, px / ratio, px / ratio); R.setScissorTest(true); });
    ctx.drawImage(gl, 0, gl.height - px, px, px, 0, 0, size, size);   // the viewport is the canvas's bottom-left corner
  } finally {
    R.setRenderTarget(was.target); R.setViewport(was.vp); R.setScissor(was.sc); R.setScissorTest(was.test);
    R.setClearColor(was.color, was.alpha); R.toneMappingExposure = was.exposure;
  }
}

// Draws the shader kinds onto the cards' canvases: each card one full-quad shader (drawToCard).
export class AuraPainter {
  // tier(): the graphics tier ('low': fewer noise layers)
  constructor(renderer, tier = () => 'medium') {
    this.renderer = renderer; this.tier = tier;
    this.mats = {};     // kind -> its material
    this.built = {};    // kind -> its shader is built (false while it builds)
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    // a graphics chip reset (gpu-recovery.js) loses what was drawn on it: draw the jelly again and rebuild
    renderer.domElement.addEventListener?.('webglcontextrestored', () => this.release(true));
  }

  has(kind) { return !!SHADERS[kind]; }

  material(kind) {
    // (the game's colours are written in sRGB; the shader works in linear light)
    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
    const K = SHADERS[kind], ramp = LOOK.list(K.RAMP, K.RAMP_FALLBACK).map(lin);
    return new THREE.ShaderMaterial({
      uniforms: {
        uPortrait: { value: null }, uJelly: { value: null }, uTime: { value: 0 }, uStrength: { value: 1 }, uLayers: { value: 4 },
        uColor: { value: new THREE.Color() }, uRamp: { value: ramp },
        uWater: { value: lin(LOOK.color('menu-water-deep', '#06162e')) }, uWaterHigh: { value: lin(LOOK.color('menu-water-shallow', '#175c70')).lerp(lin(LOOK.color('menu-water-deep', '#06162e')), 0.85) },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `${KIT}\n${K.PAINT}\nvoid main() { gl_FragColor = vec4(paint(vUv), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
  }

  // ready to draw `kind`? Its shader is built off the main thread the first time it's asked for (where
  // the browser can): until then the card shows its still portrait, never a stall
  ready(kind) {
    if (this.mats[kind] === undefined) {
      const m = this.mats[kind] = this.material(kind);
      this.built[kind] = false;
      this.quad.material = m;
      const done = () => { this.built[kind] = true; }, R = this.renderer, was = R.getRenderTarget();
      try { R.setRenderTarget(null); Promise.resolve(R.compileAsync?.(this.scene, this.camera)).then(done, done); } finally { R.setRenderTarget(was); }
    }
    return this.built[kind];
  }

  // Draw `kind` onto `canvas` for the player's jelly `look`, its type's `colour`, at `t` seconds.
  // false if it can't (yet): the card then shows its still portrait
  draw(canvas, kind, look, t, colour, strength = 1) {
    const R = this.renderer, gl = R.domElement, size = canvas.width;
    if (!size || R.getContext().isContextLost?.()) { this.release(); return false; }   // the chip was reset (gpu-recovery.js): built again once it's back
    if (!this.ready(kind)) return false;
    const L = portraitLayers(R, look, { room: LOOK.num('pick-portrait-room', 1.3) }), m = this.mats[kind], u = m.uniforms;
    u.uPortrait.value = L.color.texture; u.uJelly.value = L.jelly.texture;
    u.uTime.value = t; u.uStrength.value = strength; u.uColor.value.set(colour).convertSRGBToLinear();
    u.uLayers.value = this.tier() === 'low' ? 2 : 4;
    this.quad.material = m;
    drawToCard(R, canvas.getContext('2d'), Math.min(gl.width, gl.height, size), size, (corner) => { corner(); R.render(this.scene, this.camera); });
    return true;
  }

  // the pick screen closed (or the chip was reset): free the jelly's pictures; the shaders stay built
  release(lost = this.renderer.getContext().isContextLost?.()) {
    freePortraitLayers();
    if (lost) { for (const m of Object.values(this.mats)) m?.dispose(); this.mats = {}; this.built = {}; }
  }
}
