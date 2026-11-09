// Post-processing for game mode: ambient occlusion (soft contact shadows in corners and
// under furniture), depth of field (the far side of the room goes soft, like a macro photo,
// which sells being tiny), bloom on lamps and windows, and a light vignette.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { N8AOPass } from 'n8ao';

export const QUALITY = ['low', 'medium', 'high'];
// what the player can pick in the pause menu (a phone starts on low, a desktop on high); a stored
// pick that's no longer offered (the old 'auto') falls back to the default
export const CHOICES = QUALITY;
const STORE = 'jellyrun.graphics';

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

// Keeps every pixel a real, sane number before anything spreads light around. N8AO now and
// then writes a NaN on the top or bottom row (its normal reconstruction reads depth past the edge
// of the screen), and a bright glint can overflow half-float to Inf on some GPUs. A blur or bloom
// would smear either into a block of black squares for a frame, so: NaN -> black, and anything
// brighter than MAX_LIGHT is capped (lamps peak around 16). Bloom and the output pass call it on
// what they read; High also runs it as a pass of its own before depth of field.
const FINITE = /* glsl */`
  vec3 finite(vec3 c) {
    // isnan can be optimised away by some drivers; a NaN also fails every comparison
    bool ok = !any(isnan(c)) && all(greaterThanEqual(c, vec3(-1e4))) && all(lessThanEqual(c, vec3(1e30)));
    return ok ? min(c, vec3(256.0)) : vec3(0.0);
  }`;
const QUAD_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FiniteShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    ${FINITE}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(finite(c.rgb), c.a);
    }`,
};

// Bloom on lamps, screens and sunlit glass, built for phone GPUs: the bright parts are taken at
// half resolution, halved four more times and widened back up (dual Kawase filter: 5 taps down,
// 8 up, each pass on a quarter of the pixels of the one before). Three.js's UnrealBloomPass did a
// gaussian blur per level in two passes each and blended its result over the full-res image;
// this does about half the passes, none at full resolution, and the output pass adds the result
// while it tone maps, so the image is written once.
const LEVELS = 5;
const GAIN = 2;   // the same --bloom draws about as much glow as UnrealBloomPass did (compared on screenshots)
class MipBloomPass extends Pass {
  constructor(strength, threshold = 1) {
    super();
    this.needsSwap = false;   // reads the image, writes only its own targets: the output pass adds them
    this.strength = strength * GAIN;
    const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.down = Array.from({ length: LEVELS }, target);
    const shader = (frag, extra = {}) => new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, ...extra },
      vertexShader: QUAD_VERTEX, fragmentShader: frag, depthTest: false, depthWrite: false,
    });
    // first step: only what's brighter than the threshold (as UnrealBloomPass: luminance over 1)
    this.bright = shader(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 texel; uniform float threshold;
      varying vec2 vUv;
      ${FINITE}
      vec3 tap(vec2 uv) {
        vec3 c = finite(texture2D(tDiffuse, uv).rgb);
        return c * smoothstep(threshold, threshold + 0.01, dot(c, vec3(0.299, 0.587, 0.114)));
      }
      void main() {
        vec3 s = tap(vUv) * 4.0 + tap(vUv - texel) + tap(vUv + texel) + tap(vUv + vec2(texel.x, -texel.y)) + tap(vUv - vec2(texel.x, -texel.y));
        gl_FragColor = vec4(s / 8.0, 1.0);
      }`, { threshold: { value: threshold } });
    this.halve = shader(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 texel;
      varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tDiffuse, vUv).rgb * 4.0
          + texture2D(tDiffuse, vUv - texel).rgb + texture2D(tDiffuse, vUv + texel).rgb
          + texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb + texture2D(tDiffuse, vUv - vec2(texel.x, -texel.y)).rgb;
        gl_FragColor = vec4(s / 8.0, 1.0);
      }`);
    // widening back up is added on top of the level's own halving (so every level counts)
    this.widen = shader(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 texel;
      varying vec2 vUv;
      vec3 t(vec2 o) { return texture2D(tDiffuse, vUv + o * texel).rgb; }
      void main() {
        vec3 s = t(vec2(-2.0, 0.0)) + t(vec2(2.0, 0.0)) + t(vec2(0.0, -2.0)) + t(vec2(0.0, 2.0))
          + (t(vec2(-1.0, 1.0)) + t(vec2(1.0, 1.0)) + t(vec2(1.0, -1.0)) + t(vec2(-1.0, -1.0))) * 2.0;
        gl_FragColor = vec4(s / 12.0, 1.0);
      }`);
    this.widen.blending = THREE.AdditiveBlending;
    this.quad = new FullScreenQuad(null);
  }

  // what the output pass adds (half resolution), and how much of it
  get texture() { return this.down[0].texture; }

  setSize(w, h) {
    for (let i = 0; i < LEVELS; i++) this.down[i].setSize(Math.max(1, Math.round(w / 2 ** (i + 1))), Math.max(1, Math.round(h / 2 ** (i + 1))));
  }

  pass(material, from, to, texelOf) {
    material.uniforms.tDiffuse.value = from.texture ?? from;
    material.uniforms.texel.value.set(1 / texelOf.width, 1 / texelOf.height);
    this.quad.material = material;
    this.renderer.setRenderTarget(to);
    this.quad.render(this.renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.renderer = renderer;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    this.pass(this.bright, readBuffer, this.down[0], readBuffer);
    for (let i = 1; i < LEVELS; i++) this.pass(this.halve, this.down[i - 1], this.down[i], this.down[i - 1]);
    for (let i = LEVELS - 2; i >= 0; i--) this.pass(this.widen, this.down[i + 1], this.down[i], this.down[i + 1]);
    renderer.autoClear = auto;
  }

  dispose() {
    this.down.forEach((t) => t.dispose());
    [this.bright, this.halve, this.widen].forEach((m) => m.dispose());
    this.quad.dispose();
  }
}

// Tone mapping and sRGB (as three's OutputPass), plus the bloom added in and every pixel made
// finite on the way: the last pass, the only one that writes a whole full-resolution image.
// A ShaderMaterial (not OutputPass's raw one) so it gets GLSL 3 and isnan on WebGL 2; three's own
// tone mapping is off for it (toneMapped) because it does it itself, as OutputPass does.
const TONE = {
  [THREE.LinearToneMapping]: 'LinearToneMapping', [THREE.ReinhardToneMapping]: 'ReinhardToneMapping',
  [THREE.CineonToneMapping]: 'CineonToneMapping', [THREE.ACESFilmicToneMapping]: 'ACESFilmicToneMapping',
  [THREE.AgXToneMapping]: 'AgXToneMapping', [THREE.NeutralToneMapping]: 'NeutralToneMapping',
};
class BloomOutputPass extends Pass {
  constructor(bloom) {
    super();
    this.bloom = bloom;
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, bloomStrength: { value: 0 }, toneMappingExposure: { value: 1 } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tBloom;
        uniform float bloomStrength;
        #include <tonemapping_pars_fragment>
        varying vec2 vUv;
        ${FINITE}
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          c.rgb = finite(c.rgb) + bloomStrength * texture2D(tBloom, vUv).rgb;
          #ifdef TONE
            c.rgb = TONE(c.rgb);
          #endif
          #ifdef SRGB_TRANSFER
            c = sRGBTransferOETF(c);
          #endif
          gl_FragColor = c;
        }`,
      toneMapped: false, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.key = null;
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms, b = this.bloom;
    u.tDiffuse.value = readBuffer.texture;
    u.tBloom.value = b.texture;
    u.bloomStrength.value = b.enabled ? b.strength : 0;
    u.toneMappingExposure.value = renderer.toneMappingExposure;
    const key = renderer.outputColorSpace + '|' + renderer.toneMapping;
    if (key !== this.key) {
      this.key = key;
      const d = this.material.defines = {};
      if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) d.SRGB_TRANSFER = '';
      if (TONE[renderer.toneMapping]) d.TONE = TONE[renderer.toneMapping];
      this.material.needsUpdate = true;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}

export class Graphics {
  constructor(renderer, scene, camera, defaultQuality = 'high') {
    this.renderer = renderer;
    this.frameInfo = { calls: 0, triangles: 0, points: 0 };
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.focus = 0.16;
    this.off = new Set();   // passes switched off to measure what they cost (dev tools: toggle)
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

  // Switch a pass off or back on ('ao', 'bloom'), to feel what it costs on a real phone
  toggle(pass) {
    if (!this.off.delete(pass)) this.off.add(pass);
    this.build();
    return !this.off.has(pass);
  }

  // the tier actually drawn
  setTier(q) {
    const had = !!this.composer;
    this.quality = q;
    this.build();
    if (had !== !!this.composer) this.onRetarget?.();   // Low draws to the screen, Medium/High into the composer: other shaders
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
    let ao = null;
    if (!this.off.has('ao')) {
      ao = new N8AOPass(this.scene, this.camera, size.x, size.y);
      Object.assign(ao.configuration, {
        gammaCorrection: false,   // the output pass does tone mapping + sRGB
        screenSpaceRadius: true,  // radius in pixels, so it works at any scale
        aoRadius: high ? 48 : 32,
        distanceFalloff: 0.3,
        intensity: 2.2,
        halfRes: !high,
      });
      ao.setQualityMode(high ? 'Medium' : 'Performance');
      if (high) ao.beautyRenderTarget.samples = 4; // MSAA on the scene render
      composer.addPass(ao);
    } else {
      composer.addPass(new RenderPass(this.scene, this.camera));
    }

    this.dof = null;
    if (high && ao) {   // depth of field reads N8AO's depth
      composer.addPass(new ShaderPass(FiniteShader));   // its blur would smear a NaN too
      const dof = new ShaderPass(DofShader);
      dof.uniforms.tDepth.value = ao.beautyRenderTarget.depthTexture;
      composer.addPass(dof);
      this.dof = dof;
    }

    const bloom = new MipBloomPass(LOOK.num('bloom', 0.22));   // only lamps, screens, sunlit glass
    bloom.enabled = !this.off.has('bloom');
    composer.addPass(bloom);
    composer.addPass(new BloomOutputPass(bloom));
    this.bloom = bloom;

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
