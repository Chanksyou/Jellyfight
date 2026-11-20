// The pick screen's side cards in shaders (pick-aura.js says how a kind joins).
import * as THREE from 'three';
import { LOOK } from '../look.js';
import { KIT } from './kit.js';
import { SHADERS } from '../pick-aura.js';
import { portraitLayers, freePortraitLayers } from '../jelly-portrait.js';

// Draws the shader kinds onto the cards' canvases: each card a full-quad shader drawn by the game's
// renderer into the bottom-left corner of its canvas, copied onto the card (as attack-preview.js
// does: no second WebGL context, no pixel read back), the renderer put back as it was.
// shortcut: its corner draw is its own copy of attack-preview.js draw(); share one once F1's stage lands.
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
    const ratio = R.getPixelRatio(), px = Math.min(gl.width, gl.height, size);
    const was = { target: R.getRenderTarget(), vp: R.getViewport(new THREE.Vector4()), sc: R.getScissor(new THREE.Vector4()), test: R.getScissorTest(), exposure: R.toneMappingExposure };
    try {
      R.setRenderTarget(null);
      R.setViewport(0, 0, px / ratio, px / ratio);
      R.setScissor(0, 0, px / ratio, px / ratio);
      R.setScissorTest(true);
      R.toneMappingExposure = LOOK.num('portrait-exposure', was.exposure || 1);
      R.render(this.scene, this.camera);
      canvas.getContext('2d').drawImage(gl, 0, gl.height - px, px, px, 0, 0, size, size);   // the viewport is the canvas's bottom-left corner
    } finally {
      R.setRenderTarget(was.target); R.setViewport(was.vp); R.setScissor(was.sc); R.setScissorTest(was.test); R.toneMappingExposure = was.exposure;
    }
    return true;
  }

  // the pick screen closed (or the chip was reset): free the jelly's pictures; the shaders stay built
  release() {
    freePortraitLayers();
    if (this.renderer.getContext().isContextLost?.()) { for (const m of Object.values(this.mats)) m?.dispose(); this.mats = {}; }
  }
}
