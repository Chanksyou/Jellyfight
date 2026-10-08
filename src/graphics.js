// Post-processing for game mode: ambient occlusion (soft contact shadows in corners and
// under furniture), depth of field (the far side of the room goes soft, like a macro photo,
// which sells being tiny), bloom on lamps and windows, and a light vignette.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';

export const QUALITY = ['low', 'medium', 'high'];
// what the player can pick in the pause menu (a phone starts on low, a desktop on high); a stored
// pick that's no longer offered (the old 'auto') falls back to the default
export const CHOICES = QUALITY;
const STORE = 'jellyfight.graphics';

// Depth of field that reads the logarithmic depth buffer. Blur grows with how far a pixel's
// depth is from the focus distance (the player), with a golden-angle disk of samples.
const DofShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    logFar: { value: Math.log2(561) }, // log2(camera.far + 1)
    depthMode: { value: 1 },           // 0 normal depth buffer, 1 logarithmic, 2 reversed (boot.js)
    near: { value: 0.005 },
    far: { value: 560 },
    focus: { value: 0.16 },            // meters from the camera
    strength: { value: 1.0 },
    maxBlur: { value: 9.0 },           // pixels
    vignette: { value: 0.25 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 resolution;
    uniform float logFar, focus, strength, maxBlur, vignette, depthMode, near, far;
    varying vec2 vUv;
    float viewDist(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      if (depthMode > 1.5) return (near * far) / (d * (far - near) + near);   // reversed: 1 at near, 0 at far
      if (depthMode > 0.5) return exp2(d * logFar) - 1.0;
      return (near * far) / ((far - near) * d - far) * -1.0;   // perspective depth -> distance
    }
    float coc(float z) {
      // circle of confusion in 0..1: (1/focus - 1/z) scaled so ~10x focus distance is fully soft
      return clamp(abs(1.0 - focus / max(z, 1e-4)) * strength, 0.0, 1.0);
    }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float c0 = coc(viewDist(vUv));
      vec3 col = base.rgb;
      if (c0 > 0.02) {
        float r = c0 * maxBlur;
        vec3 acc = base.rgb; float wsum = 1.0;
        for (int i = 0; i < 24; i++) {
          float fi = float(i) + 0.5;
          float a = fi * 2.39996;
          vec2 off = vec2(cos(a), sin(a)) * sqrt(fi / 24.0) * r / resolution;
          vec2 uv = vUv + off;
          // a sharp foreground sample shouldn't smear into the blurred background
          float w = coc(viewDist(uv)) + 0.05;
          acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
        }
        col = acc / wsum;
      }
      vec2 p = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.35, 0.85, length(p * vec2(1.1, 1.0)) * 1.3);
      gl_FragColor = vec4(col, base.a);
    }`,
};

// Keeps every pixel a real, sane number before the passes that spread light around. N8AO now and
// then writes a NaN on the top or bottom row (its normal reconstruction reads depth past the edge
// of the screen), and a bright glint can overflow half-float to Inf on some GPUs. Bloom's blur
// would smear either into a block of black squares for a frame, so: NaN -> black, and anything
// brighter than MAX_LIGHT is capped (lamps peak around 16).
const FiniteShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    const float MAX_LIGHT = 256.0;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // isnan can be optimised away by some drivers; a NaN also fails every comparison
      bool ok = !any(isnan(c.rgb)) && all(greaterThanEqual(c.rgb, vec3(-1e4))) && all(lessThanEqual(c.rgb, vec3(1e30)));
      gl_FragColor = ok ? vec4(min(c.rgb, vec3(MAX_LIGHT)), c.a) : vec4(0.0, 0.0, 0.0, 1.0);
    }`,
};

export class Graphics {
  constructor(renderer, scene, camera, defaultQuality = 'high') {
    this.renderer = renderer;
    this.frameInfo = { calls: 0, triangles: 0, points: 0 };
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.focus = 0.16;
    let q = defaultQuality;
    try { q = localStorage.getItem(STORE) || q; } catch {}
    this.choose(CHOICES.includes(q) ? q : defaultQuality, false);
    addEventListener('resize', () => this.resize());
  }

  // the player's pick from the pause menu
  setQuality(q) { this.choose(q, true); }

  choose(q, remember) {
    this.choice = q;
    if (remember) try { localStorage.setItem(STORE, q); } catch {}
    this.setTier(q);
  }

  // the tier actually drawn
  setTier(q) {
    this.quality = q;
    this.build();
  }

  build() {
    if (this.composer) {
      this.composer.passes.forEach((p) => p.dispose?.());
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer = null;
    }
    if (this.quality === 'low') return;

    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const high = this.quality === 'high';
    const composer = new EffectComposer(r);

    // N8AO renders the scene itself (it replaces RenderPass) and keeps the depth buffer we reuse for DOF.
    const ao = new N8AOPass(this.scene, this.camera, size.x, size.y);
    Object.assign(ao.configuration, {
      gammaCorrection: false,   // OutputPass does tone mapping + sRGB
      screenSpaceRadius: true,  // radius in pixels, so it works at any scale
      aoRadius: high ? 48 : 32,
      distanceFalloff: 0.3,
      intensity: 2.2,
      halfRes: !high,
    });
    ao.setQualityMode(high ? 'Medium' : 'Performance');
    if (high) ao.beautyRenderTarget.samples = 4; // MSAA on the scene render
    composer.addPass(ao);
    composer.addPass(new ShaderPass(FiniteShader));   // before anything that blurs or blooms

    if (high) {
      const dof = new ShaderPass(DofShader);
      dof.uniforms.tDepth.value = ao.beautyRenderTarget.depthTexture;
      composer.addPass(dof);
      this.dof = dof;
    } else {
      this.dof = null;
    }

    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), LOOK.num('bloom', 0.22), 0.5, 1.0)); // only lamps, screens, sunlit glass
    composer.addPass(new OutputPass());

    this.ao = ao;
    this.composer = composer;
    this.resize();
  }

  resize() {
    if (!this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);
    if (this.dof) {
      const pr = this.renderer.getPixelRatio();
      this.dof.uniforms.resolution.value.set(size.x * pr, size.y * pr);
    }
  }

  // Draws one frame and keeps what it cost in this.frameInfo (for the F3 readout). three resets
  // renderer.info on every render() call, so with a composer it would only count the last pass.
  render() {
    const info = this.renderer.info, auto = info.autoReset;
    info.autoReset = false; info.reset();
    this._draw();
    const f = this.frameInfo;
    f.calls = info.render.calls; f.triangles = info.render.triangles; f.points = info.render.points;
    info.autoReset = auto;
  }

  _draw() {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.dof) {
      const u = this.dof.uniforms;
      u.focus.value = this.focus;
      u.logFar.value = Math.log2(this.camera.far + 1);
      const caps = this.renderer.capabilities;
      u.depthMode.value = caps.reversedDepthBuffer ? 2 : caps.logarithmicDepthBuffer ? 1 : 0;
      u.near.value = this.camera.near;
      u.far.value = this.camera.far;
    }
    this.composer.render();
  }
}
