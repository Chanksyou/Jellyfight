// Post-processing for game mode: ambient occlusion (soft contact shadows in corners and
// under furniture), depth of field (the far side of the room goes soft, like a macro photo,
// which sells being tiny), bloom on lamps and windows, and a light vignette.
import { drawOverdrawView } from './overdraw.js';
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { EXPERIMENTS } from './experiments.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { setBakedAOTier } from './baked-ao.js';
import { ShimmerPass } from './heat-shimmer.js';

export const QUALITY = ['low', 'medium', 'high'];
// what the player can pick in the pause menu (a phone starts on low, a desktop on high); a stored
// pick that's no longer offered (the old 'auto') falls back to the default
export const CHOICES = QUALITY;
const STORE = 'jellyrun.graphics';

// Keeps every pixel a real, sane number before anything spreads light around. N8AO now and
// then writes a NaN on the top or bottom row (its normal reconstruction reads depth past the edge
// of the screen), and a bright glint can overflow half-float to Inf on some GPUs. A blur or bloom
// would smear either into a block of black squares for a frame, so: NaN -> black, and anything
// brighter than MAX_LIGHT is capped (lamps peak around 16). HalfResDofPass, Bloom and the output pass
// call it inline on what they read (saving a full-res pass on High).
const FINITE = /* glsl */`
  vec3 finite(vec3 c) {
    // isnan can be optimised away by some drivers; a NaN also fails every comparison
    bool ok = !any(isnan(c)) && all(greaterThanEqual(c, vec3(-1e4))) && all(lessThanEqual(c, vec3(1e30)));
    return ok ? min(c, vec3(256.0)) : vec3(0.0);
  }`;
const QUAD_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Precomputed 16-tap golden-angle disk offsets for half-res bokeh gather
const DOF_OFFSETS = Array.from({ length: 16 }, (_, i) => {
  const fi = i + 0.5, a = fi * 2.39996, r = Math.sqrt(fi / 16);
  return `vec2(${(Math.cos(a) * r).toFixed(6)}, ${(Math.sin(a) * r).toFixed(6)})`;
}).join(', ');

// Half-resolution depth of field (High tier): prefilters colour + signed CoC at 1/4 pixels,
// then runs a 16-tap golden-angle disk gather rejecting sharp foreground bleed into background.
// Composited together with vignette inside BloomOutputPass so the full-res image is written once.
export class HalfResDofPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.prefilter = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.gather = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.uniforms = {
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      logFar: { value: Math.log2(561) }, // log2(camera.far + 1)
      depthMode: { value: 1 },           // 0 normal depth buffer, 1 logarithmic, 2 reversed (boot.js)
      near: { value: 0.005 },
      far: { value: 560 },
      focus: { value: 0.16 },            // meters from the camera
      cocA: { value: 0 },                // linear focus/z slope for perspective & reversed depth (0 divisions)
      cocB: { value: 0 },                // linear focus/z intercept
      strength: { value: 1.0 },
      maxBlur: { value: 9.0 },           // full-res pixels
    };
    const u = this.uniforms;
    this.prefilterMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: u.tDepth,
        logFar: u.logFar,
        depthMode: u.depthMode,
        near: u.near,
        far: u.far,
        focus: u.focus,
        cocA: u.cocA,
        cocB: u.cocB,
        strength: u.strength,
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tDepth;
        uniform float logFar, focus, cocA, cocB, strength, depthMode, near, far;
        varying vec2 vUv;
        ${FINITE}
        void main() {
          vec3 col = finite(texture2D(tDiffuse, vUv).rgb);
          float d = texture2D(tDepth, vUv).x;
          float fz = depthMode == 1.0 ? focus / max(exp2(d * logFar) - 1.0, 1e-4) : d * cocA + cocB;
          float coc = clamp((1.0 - fz) * strength, -1.0, 1.0);
          gl_FragColor = vec4(col * max(abs(coc), 0.01), coc);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.gatherMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: u.resolution,
        maxBlur: u.maxBlur,
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float maxBlur;
        varying vec2 vUv;
        const vec2 OFFSETS[16] = vec2[16](${DOF_OFFSETS});
        void main() {
          vec4 center = texture2D(tDiffuse, vUv);
          float c0 = center.a;
          float ac0 = abs(c0);
          vec3 cCol = center.rgb / max(ac0, 0.01);
          if (ac0 <= 0.02) {
            gl_FragColor = vec4(cCol, ac0);
            return;
          }
          vec2 scale = (ac0 * maxBlur) / resolution;
          float w0 = ac0 + 0.05;
          vec3 acc = cCol * w0;
          float wsum = w0;
          float maxCoc = ac0;
          for (int i = 0; i < 16; i++) {
            vec4 s = texture2D(tDiffuse, vUv + OFFSETS[i] * scale);
            float sa = abs(s.a);
            // reject sharp foreground samples from leaking into blurred background
            float w = (s.a >= c0 || s.a < 0.0) ? sa + 0.05 : 0.05;
            acc += (s.rgb / max(sa, 0.01)) * w;
            wsum += w;
            if (s.a < 0.0) maxCoc = max(maxCoc, sa);
          }
          gl_FragColor = vec4(acc / wsum, maxCoc);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(null);
  }

  get texture() { return this.gather.texture; }

  setSize(w, h) {
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    this.prefilter.setSize(hw, hh);
    this.gather.setSize(hw, hh);
  }

  render(renderer, writeBuffer, readBuffer) {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    this.prefilterMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.prefilterMat;
    renderer.setRenderTarget(this.prefilter);
    this.quad.render(renderer);
    this.gatherMat.uniforms.tDiffuse.value = this.prefilter.texture;
    this.quad.material = this.gatherMat;
    renderer.setRenderTarget(this.gather);
    this.quad.render(renderer);
    renderer.autoClear = auto;
  }

  dispose() {
    this.prefilter.dispose();
    this.gather.dispose();
    this.prefilterMat.dispose();
    this.gatherMat.dispose();
    this.quad.dispose();
  }
}

// Bloom on lamps, screens and sunlit glass, built for phone GPUs: the bright parts are taken at
// half resolution with a Karis-weighted 13-tap box downsample (suppresses single-pixel fireflies),
// halved four more times, and widened back up with a 9-tap 3x3 tent filter. None of the passes run
// at full resolution, and the output pass adds the result while it tone maps, so the image is written once.
// picture buffer formats: half floats (RGBA, 64 bits a pixel), or packed R11G11B10 (32 bits, no alpha: the canvas is opaque)
const HALF_BUFFER = { type: THREE.HalfFloatType };
const PACKED_BUFFER = { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat };
const LEVELS = 5;
const GAIN = 2;   // the same --bloom draws about as much glow as UnrealBloomPass did (compared on screenshots)
export class MipBloomPass extends Pass {
  constructor(strength, threshold = 1, buffer = HALF_BUFFER) {
    super();
    this.needsSwap = false;   // reads the image, writes only its own targets: the output pass adds them
    this.strength = strength * GAIN;
    const target = () => new THREE.WebGLRenderTarget(1, 1, { ...buffer, depthBuffer: false });
    this.down = Array.from({ length: LEVELS }, target);
    const shader = (frag, extra = {}) => new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, ...extra },
      vertexShader: QUAD_VERTEX, fragmentShader: frag, depthTest: false, depthWrite: false,
    });
    // first step: Call of Duty: AW 13-tap box downsample with Karis average across 5 overlapping 2x2 groups
    this.bright = shader(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 texel; uniform float threshold;
      varying vec2 vUv;
      ${FINITE}
      vec3 tap(vec2 o) {
        vec3 c = max(finite(texture2D(tDiffuse, vUv + o * texel).rgb), vec3(0.0));
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return c * smoothstep(threshold, threshold + 0.2, luma);
      }
      float karis(vec3 c) {
        return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)));
      }
      void main() {
        vec3 a = tap(vec2(-2.0,  2.0)), b = tap(vec2( 0.0,  2.0)), c = tap(vec2( 2.0,  2.0));
        vec3 d = tap(vec2(-1.0,  1.0)), e = tap(vec2( 1.0,  1.0));
        vec3 f = tap(vec2(-2.0,  0.0)), g = tap(vec2( 0.0,  0.0)), h = tap(vec2( 2.0,  0.0));
        vec3 i = tap(vec2(-1.0, -1.0)), j = tap(vec2( 1.0, -1.0));
        vec3 k = tap(vec2(-2.0, -2.0)), l = tap(vec2( 0.0, -2.0)), m = tap(vec2( 2.0, -2.0));
        vec3 g0 = (d + e + i + j) * 0.25;
        vec3 g1 = (a + b + f + g) * 0.25;
        vec3 g2 = (b + c + g + h) * 0.25;
        vec3 g3 = (f + g + k + l) * 0.25;
        vec3 g4 = (g + h + l + m) * 0.25;
        float w0 = 0.5 * karis(g0);
        float w1 = 0.125 * karis(g1);
        float w2 = 0.125 * karis(g2);
        float w3 = 0.125 * karis(g3);
        float w4 = 0.125 * karis(g4);
        gl_FragColor = vec4((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
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
    // widening back up: 9-tap 3x3 tent filter added on top of the level's own halving (so every level counts)
    this.widen = shader(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 texel;
      varying vec2 vUv;
      vec3 t(vec2 o) { return texture2D(tDiffuse, vUv + o * texel).rgb; }
      void main() {
        vec3 s = t(vec2(-1.0,  1.0)) + t(vec2(1.0,  1.0)) + t(vec2(-1.0, -1.0)) + t(vec2(1.0, -1.0))
          + (t(vec2(0.0,  1.0)) + t(vec2(-1.0, 0.0)) + t(vec2(1.0, 0.0)) + t(vec2(0.0, -1.0))) * 2.0
          + t(vec2(0.0,  0.0)) * 4.0;
        gl_FragColor = vec4(s / 16.0, 1.0);
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
// The act's colour grade (main.js sets it from look.css --grade-*-act<n>): a gain and a lift on the tone-mapped
// picture, and a saturation. Numbers only: one shader for every act. Low (no output pass) has none.
export const GRADE = { gain: new THREE.Color(1, 1, 1), lift: new THREE.Color(0, 0, 0), sat: 1 };
export class BloomOutputPass extends Pass {
  constructor(bloom) {
    super();
    this.bloom = bloom;
    this.dof = null;
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, bloomStrength: { value: 0 }, toneMappingExposure: { value: 1 }, grey: { value: 0 }, gradeGain: { value: GRADE.gain }, gradeLift: { value: GRADE.lift }, gradeSat: { value: 1 }, tShimmer: { value: null }, shimmer: { value: new THREE.Vector2() }, tDof: { value: null }, vignette: { value: 0.25 } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tBloom, tShimmer, tDof;
        uniform vec2 shimmer;
        uniform float bloomStrength, grey, gradeSat, vignette;
        uniform vec3 gradeGain, gradeLift;
        #include <tonemapping_pars_fragment>
        varying vec2 vUv;
        ${FINITE}
        void main() {
          #ifdef SHIMMER
            vec4 c = texture2D(tDiffuse, vUv + texture2D(tShimmer, vUv).xy * shimmer);   // heat over the vents (heat-shimmer.js)
          #else
            vec4 c = texture2D(tDiffuse, vUv);
          #endif
          c.rgb = finite(c.rgb);
          #ifdef DOF
            vec4 dofSample = texture2D(tDof, vUv);
            c.rgb = mix(c.rgb, dofSample.rgb, smoothstep(0.02, 0.25, dofSample.a));
            vec2 p = vUv - 0.5;
            c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, length(p * vec2(1.1, 1.0)) * 1.3);
          #endif
          c.rgb += bloomStrength * texture2D(tBloom, vUv).rgb;
          #ifdef TONE
            c.rgb = TONE(c.rgb);
          #endif
          vec3 cl = clamp(c.rgb, 0.0, 1.0);
          c.rgb = cl * gradeGain + gradeLift * (1.0 - cl);   // the act's grade
          c.rgb = mix(vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722))), c.rgb, gradeSat * (1.0 - grey));   // grade saturation + colour drain (juice.grey)
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
    u.grey.value = juice.grey;
    u.gradeSat.value = GRADE.sat;
    if (this.dof) u.tDof.value = this.dof.texture;
    if (this.shimmer) {
      const m = this.shimmer.map, px = LOOK.num('vent-shimmer', 2.5) * renderer.getPixelRatio();
      u.tShimmer.value = m.texture;
      u.shimmer.value.set(px / (m.width / this.shimmer.scale), px / (m.height / this.shimmer.scale));
    }
    this.prepare(renderer);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  // its shader's defines for the renderer's tone mapping and output (also so its shader can be built ahead)
  prepare(renderer) {
    const key = renderer.outputColorSpace + '|' + renderer.toneMapping + '|' + !!this.shimmer + '|' + !!this.dof;
    if (key === this.key) return;
    this.key = key;
    const d = this.material.defines = {};
    if (this.shimmer) d.SHIMMER = '';
    if (this.dof) d.DOF = '';
    if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) d.SRGB_TRANSFER = '';
    if (TONE[renderer.toneMapping]) d.TONE = TONE[renderer.toneMapping];
    this.material.needsUpdate = true;
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}

// N8AO (233 KB) is only drawn on High, or in a room with no baked shadows: Medium and Low never need it, so it loads
// after the game is up (main.js calls this once Play works) or, where the first picture needs it, before it. A build
// that wants it before it has arrived draws the plain scene and rebuilds when it lands (`ready`).
let N8AOPass = null, n8aoLoading = null;
export const loadN8AO = () => (n8aoLoading ||= import('n8ao').then((m) => { N8AOPass = m.N8AOPass; }));

export class Graphics {
  // does the first build need N8AO? (the same pick the constructor makes)
  static wantsAO(defaultQuality, baked) {
    let q = defaultQuality;
    try { q = localStorage.getItem(STORE) || q; } catch {}
    return q === 'high' || (q !== 'low' && !baked);
  }

  // baked: the act has baked corner shadows (baked-ao.js), so Low and Medium don't need N8AO
  // heat: the vents' heat scene, only for the ?shimmer=1 experiment (heat-shimmer.js); null draws none
  constructor(renderer, scene, camera, defaultQuality = 'high', baked = false, heat = null) {
    this.renderer = renderer;
    this.baked = baked;
    this.heat = heat;
    this.frameInfo = { calls: 0, triangles: 0, points: 0 };
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.focus = 0.16;
    this.overdraw = false;  // the dev Overdraw view (overdraw.js): the scene as flat layers, no passes
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

  // can this GPU draw to an R11G11B10 target? (some phones can't: then the half-float buffers stay)
  canPack(samples = 0) {
    const r = this.renderer, was = r.getRenderTarget();
    const t = new THREE.WebGLRenderTarget(1, 1, { ...PACKED_BUFFER, depthBuffer: false, samples });
    r.setRenderTarget(t);
    const gl = r.getContext();
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    r.setRenderTarget(was);
    t.dispose();
    return ok;
  }

  build() {
    this.shimmer = null;
    if (this.composer) {
      this.composer.passes.forEach((p) => p.dispose?.());
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer = null;
    }
    setBakedAOTier(this.off.has('ao') ? 'high' : this.quality);   // the dev AO switch turns the baked shadows off too
    if (this.quality === 'low') return;

    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const high = this.quality === 'high';
    // Medium defaults to 32-bit R11G11B10F + 2x MSAA (with graceful fallback to packed 0x or RGBA16F);
    // ?rt=half forces 64-bit half floats, ?msaa=0|2|4 overrides samples (High uses N8AO's own 4x MSAA).
    let msaa = 0;
    let buffer = HALF_BUFFER;
    if (high) {
      buffer = EXPERIMENTS.rt === 'packed' && this.canPack(0) ? PACKED_BUFFER : HALF_BUFFER;
    } else {
      const wantMsaa = EXPERIMENTS.msaa !== null ? EXPERIMENTS.msaa : LOOK.num('medium-msaa', 2);
      if (EXPERIMENTS.rt !== 'half' && this.canPack(wantMsaa)) {
        buffer = PACKED_BUFFER;
        msaa = wantMsaa;
      } else if (EXPERIMENTS.rt !== 'half' && this.canPack(0)) {
        buffer = PACKED_BUFFER;
        msaa = 0;
      } else {
        buffer = HALF_BUFFER;
        msaa = EXPERIMENTS.msaa ?? 0;
      }
    }
    this.bufferType = buffer.type;
    this.msaa = msaa;
    // the heat shimmer reads the room's depth: the scene's own buffers keep it as a texture (N8AO's already does)
    const composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { ...buffer, depthTexture: this.heat ? new THREE.DepthTexture(1, 1) : null }));

    // N8AO renders the scene itself (it replaces RenderPass) and keeps the depth buffer we reuse for DOF.
    let ao = null;
    const wantAO = !this.off.has('ao') && (high || !this.baked);
    if (wantAO && !N8AOPass) this.ready = (this.ready || Promise.resolve()).then(loadN8AO).then(() => this.build());   // not here yet: the plain scene now, N8AO when it lands
    if (wantAO && N8AOPass) {
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
    if (msaa) {
      // the target the scene is drawn into: N8AO's own, or else the composer's read buffer (the output pass below stops swapping, so on that path it is always the same one and only one pays for the samples)
      (ao ? ao.beautyRenderTarget : composer.readBuffer).samples = msaa;
    }

    if (this.heat) {   // right after the room is drawn, while its depth is this frame's
      this.shimmer = new ShimmerPass(this.heat, this.camera, (read) => (ao ? ao.beautyRenderTarget.depthTexture : read.depthTexture));
      composer.addPass(this.shimmer);
    }

    this.dof = null;
    if (high && ao) {   // half-res depth of field reads N8AO's depth and is composited in BloomOutputPass
      const dof = new HalfResDofPass();
      dof.uniforms.tDepth.value = ao.beautyRenderTarget.depthTexture;
      composer.addPass(dof);
      this.dof = dof;
    }

    const bloom = new MipBloomPass(LOOK.num('bloom', 0.22), 1, buffer);   // only lamps, screens, sunlit glass
    bloom.enabled = !this.off.has('bloom');
    composer.addPass(bloom);
    const output = new BloomOutputPass(bloom);
    output.shimmer = this.shimmer;
    output.dof = this.dof;
    output.needsSwap = false;   // it draws to the screen: nothing reads the buffer it would swap
    composer.addPass(output);
    this.bloom = bloom;

    this.ao = ao;
    this.composer = composer;
    this.resize();
  }

  resize() {
    if (!this.composer) return;
    const size = this.renderer.getSize(this._size ||= new THREE.Vector2());
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
    if (this.overdraw) { drawOverdrawView(this.renderer, this.scene, this.camera); return; }
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.dof) {
      const u = this.dof.uniforms, n = this.camera.near, f = this.camera.far, foc = this.focus;
      const caps = this.renderer.capabilities, mode = caps.reversedDepthBuffer ? 2 : caps.logarithmicDepthBuffer ? 1 : 0;
      u.focus.value = foc;
      u.logFar.value = Math.log2(f + 1);
      u.depthMode.value = mode;
      u.near.value = n;
      u.far.value = f;
      if (mode === 2) { u.cocA.value = foc * (1 / n - 1 / f); u.cocB.value = foc / f; }
      else if (mode === 0) { u.cocA.value = -foc * (1 / n - 1 / f); u.cocB.value = foc / n; }
    }
    this.composer.render();
  }
}
