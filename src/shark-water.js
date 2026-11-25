// Interactive shallow-water simulation, moonlit arena water shader, and carved dark-stone
// tide-pool basin walls for Act 3's shark fight.
// Zero extra render passes or lights: CPU 2D damped wave solver -> RGBA DataTexture (height,
// slopes, foam) feeding vertex displacement, wave-coupled caustics, and bedroom-lit reflections.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';
import { BAKED_LIGHT, GRID_GLSL } from './baked-light.js';
import { IS_TOUCH } from './touch.js';

const clamp = THREE.MathUtils.clamp;

// 2D damped shallow-water wave solver with reflective (Neumann) arena wall boundaries.
// Packs height (R), slope X (G), slope Z (B), and aerated foam energy (A) into an RGBA8 DataTexture.
export class SharkWaterSim {
  constructor(minX, maxX, minZ, maxZ, opts = {}) {
    this.minX = minX; this.maxX = maxX; this.minZ = minZ; this.maxZ = maxZ;
    this.spanX = Math.max(1e-4, maxX - minX);
    this.spanZ = Math.max(1e-4, maxZ - minZ);
    const small = opts.low || IS_TOUCH;
    this.w = opts.w || (small ? 56 : 72);
    this.h = opts.h || (small ? 48 : 60);
    const n = this.w * this.h;
    this.curr = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.foam = new Float32Array(n);
    this.pixels = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      this.pixels[o] = 128; this.pixels[o + 1] = 128; this.pixels[o + 2] = 128; this.pixels[o + 3] = 0;
    }
    this.texture = new THREE.DataTexture(this.pixels, this.w, this.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
    this._acc = 0;
    this._energy = 0;
  }

  // Stamp a radial splash / crater impulse + foam burst in world XZ coordinates.
  splash(wx, wz, radius = 0.14, strength = 0.6, foamAmt = 0.7) {
    const W = this.w, H = this.h;
    const gx = ((wx - this.minX) / this.spanX) * (W - 1);
    const gz = ((wz - this.minZ) / this.spanZ) * (H - 1);
    const rx = Math.max(1.5, (radius / this.spanX) * (W - 1));
    const rz = Math.max(1.5, (radius / this.spanZ) * (H - 1));
    const x0 = Math.max(1, Math.floor(gx - rx)), x1 = Math.min(W - 2, Math.ceil(gx + rx));
    const z0 = Math.max(1, Math.floor(gz - rz)), z1 = Math.min(H - 2, Math.ceil(gz + rz));
    for (let z = z0; z <= z1; z++) {
      const dz = (z - gz) / rz;
      const row = z * W;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - gx) / rx;
        const d2 = dx * dx + dz * dz;
        if (d2 >= 1) continue;
        // smooth cosine bowl: center depresses, outer lip rises slightly for a natural splash ring
        const d = Math.sqrt(d2);
        const profile = Math.cos(d * Math.PI * 0.5);
        const ring = Math.sin(d * Math.PI);
        const i = row + x;
        this.curr[i] = clamp(this.curr[i] - strength * (profile * profile * 0.85 - ring * 0.25), -1.6, 1.6);
        if (foamAmt > 0) this.foam[i] = Math.min(1, this.foam[i] + foamAmt * (0.45 * profile + 0.55 * ring));
      }
    }
  }

  // Stamp a directional moving wake (bow ridge ahead + trough & foam trail behind).
  wake(wx, wz, vx, vz, radius = 0.085, strength = 0.35, foamAmt = 0.45) {
    const spd = Math.hypot(vx, vz);
    if (spd < 1e-4) return;
    const dx = vx / spd, dz = vz / spd;
    // push water slightly ahead and depress slightly behind for a convincing V-wake
    this.splash(wx + dx * radius * 0.45, wz + dz * radius * 0.45, radius * 0.85, -strength * 0.45, foamAmt * 0.4);
    this.splash(wx - dx * radius * 0.35, wz - dz * radius * 0.35, radius, strength * 0.85, foamAmt);
  }

  // Central upwelling pulse while the arena fills from the center outward.
  centerPulse(t, fill) {
    if (fill <= 0.001 || fill >= 0.999) return;
    const cx = (this.minX + this.maxX) * 0.5, cz = (this.minZ + this.maxZ) * 0.5;
    const pulse = (0.5 + 0.5 * Math.sin(t * 14)) * (1 - fill * 0.65);
    this.splash(cx, cz, 0.14 + fill * 0.06, 0.22 * pulse, 0.28 * (1 - fill * 0.5));
  }

  // Advance the 2D wave equation at a fixed 60 Hz substep for CFL stability.
  step(dt, calm = false) {
    const W = this.w, H = this.h;
    const c2 = calm ? 0.12 : 0.20;       // wave speed^2 (CFL stable <= 0.25)
    const damp = calm ? 0.94 : 0.986;    // gentle viscous decay so wakes cross & reflect off walls
    const foamDecay = calm ? 0.90 : 0.968;
    this._acc = Math.min(this._acc + Math.min(dt, 0.05), 0.05);
    const fixed = 1 / 60;
    let stepped = false;
    while (this._acc >= fixed * 0.5) {
      this._acc -= fixed;
      stepped = true;
      const curr = this.curr, prev = this.prev, foam = this.foam;
      for (let z = 1; z < H - 1; z++) {
        const row = z * W;
        for (let x = 1; x < W - 1; x++) {
          const i = row + x;
          const lap = curr[i - 1] + curr[i + 1] + curr[i - W] + curr[i + W] - 4 * curr[i];
          let next = (2 * curr[i] - prev[i] + c2 * lap) * damp;
          if (next > 1.5) next = 1.5; else if (next < -1.5) next = -1.5;
          prev[i] = next;
          // steep wave crests generate a little extra whitewater foam
          const steep = Math.abs(lap);
          foam[i] = Math.min(1, foam[i] * foamDecay + (steep > 0.16 ? (steep - 0.16) * 0.18 : 0));
        }
      }
      // Neumann (reflective) boundaries on all 4 stone walls
      for (let x = 0; x < W; x++) {
        prev[x] = prev[W + x] * 0.96;
        prev[(H - 1) * W + x] = prev[(H - 2) * W + x] * 0.96;
        foam[x] = foam[W + x] * 0.92;
        foam[(H - 1) * W + x] = foam[(H - 2) * W + x] * 0.92;
      }
      for (let z = 0; z < H; z++) {
        const r = z * W;
        prev[r] = prev[r + 1] * 0.96;
        prev[r + W - 1] = prev[r + W - 2] * 0.96;
        foam[r] = foam[r + 1] * 0.92;
        foam[r + W - 1] = foam[r + W - 2] * 0.92;
      }
      // swap buffers (prev now holds newest heights)
      this.curr = prev; this.prev = curr;
    }
    if (!stepped) return;
    // pack height, slopes, and foam into RGBA8 DataTexture
    const curr = this.curr, foam = this.foam, px = this.pixels;
    let sumSq = 0;
    for (let z = 0; z < H; z++) {
      const zm = z > 0 ? z - 1 : 0, zp = z < H - 1 ? z + 1 : H - 1;
      const row = z * W, rowM = zm * W, rowP = zp * W;
      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : 0, xp = x < W - 1 ? x + 1 : W - 1;
        const i = row + x, o = i * 4;
        const hVal = curr[i];
        sumSq += hVal * hVal;
        const sx = curr[row + xp] - curr[row + xm];
        const sz = curr[rowP + x] - curr[rowM + x];
        px[o]     = clamp(Math.round((hVal * 0.55 + 0.5) * 255), 0, 255);
        px[o + 1] = clamp(Math.round((sx * 1.45 + 0.5) * 255), 0, 255);
        px[o + 2] = clamp(Math.round((sz * 1.45 + 0.5) * 255), 0, 255);
        px[o + 3] = clamp(Math.round(foam[i] * 255), 0, 255);
      }
    }
    this._energy = Math.sqrt(sumSq / (W * H));
    this.texture.needsUpdate = true;
  }

  energy() { return this._energy; }
  dispose() { this.texture.dispose(); }
}

const neutralWaveTex = (() => {
  const d = new Uint8Array([128, 128, 128, 0]);
  const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.needsUpdate = true;
  return t;
})();

let shared = null;
export function sharkWaterMaterial() {
  if (shared) return shared;
  shared = new THREE.ShaderMaterial({
    uniforms: {
      ...BAKED_LIGHT.uniforms,
      uTime: { value: 0 }, uFill: { value: 0 }, uReach: { value: 1 }, uMurky: { value: 0 }, uCircular: { value: 0 },
      uCalm: { value: 0 }, uDepth: { value: 0.03 }, uWaveAmp: { value: LOOK.num('shark-water-wave-amp', 0.018) },
      uCenter: { value: new THREE.Vector2() }, uExtent: { value: new THREE.Vector2(1, 1) }, uSource: { value: new THREE.Vector2() },
      uPlayer: { value: new THREE.Vector2(1000, 1000) }, uWake: { value: 0 },
      uWaveMap: { value: neutralWaveTex },
      uClear: { value: new THREE.Color(LOOK.color('shark-water', '#254854')) },
      uDeepWater: { value: new THREE.Color(LOOK.color('shark-water-deep', '#0e2433')) },
      uSss: { value: new THREE.Color(LOOK.color('shark-water-sss', '#3b8a99')) },
      uDeep: { value: new THREE.Color(LOOK.color('shark-pool-deep', '#0b1326')) },
      uShallow: { value: new THREE.Color(LOOK.color('shark-pool-shallow', '#c42830')) },
      uFoam: { value: new THREE.Color(LOOK.color('shark-water-foam', '#c8d8dc')) },
      uGlint: { value: LOOK.num('shark-water-glint', 0.34) },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform sampler2D uWaveMap;
      uniform float uFill, uReach, uMurky, uDepth, uWaveAmp, uTime, uCalm;
      uniform vec2 uCenter, uExtent, uSource;
      varying vec3 vWorld;
      varying vec2 vWuv;
      varying float vWaveH;
      varying float vLip;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 local = (w.xz - uCenter) / max(uExtent, vec2(1e-4));
        vWuv = local * 0.5 + 0.5;
        vWaveH = 0.0;
        vLip = 0.0;
        if (uMurky < 0.5) {
          float front = uFill * uReach;
          float dist = distance(w.xz, uSource);
          float spread = 1.0 - smoothstep(front - 0.09, front, dist);
          float lip = exp(-pow((dist - front + 0.032) / 0.045, 2.0)) * (1.0 - smoothstep(0.86, 1.0, uFill));
          float spring = exp(-dist * dist / 0.016) * (1.0 - smoothstep(0.75, 1.0, uFill));
          float simH = (texture2D(uWaveMap, clamp(vWuv, 0.004, 0.996)).r - 0.5) * 2.0;
          float ambient = (1.0 - uCalm) * (sin(w.x * 13.0 + uTime * 2.1) * cos(w.z * 11.0 - uTime * 1.7)) * 0.0022;
          float disp = (simH * uWaveAmp + ambient) * smoothstep(0.0, 0.25, uFill) * spread;
          // smooth water elevation from 0 at the leading edge up to full depth
          float rise = uDepth * smoothstep(0.0, 0.35, spread) * clamp(uFill * 1.35, 0.0, 1.0);
          w.y += rise + disp + lip * 0.011 + spring * 0.009;
          vWaveH = simH;
          vLip = lip;
        }
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <logdepthbuf_pars_fragment>
      ${GRID_GLSL}
      uniform sampler2D uWaveMap;
      uniform float uTime, uFill, uReach, uMurky, uCircular, uWake, uGlint, uCalm, uDepth;
      uniform vec2 uCenter, uExtent, uSource, uPlayer;
      uniform vec3 uClear, uDeepWater, uSss, uDeep, uShallow, uFoam;
      uniform vec3 lbGlowPos, lbGlowColor;
      uniform float lbGlowDist, lbGlowDecay;
      varying vec3 vWorld;
      varying vec2 vWuv;
      varying float vWaveH;
      varying float vLip;

      // one directional capillary wave: adds sharpened crest slope and returns 0..1 height
      float wave(vec2 p, vec2 dir, float k, float speed, float amp, inout vec2 slope) {
        float ph = dot(p, dir) * k - uTime * speed;
        float s = 0.5 + 0.5 * sin(ph);
        slope += dir * k * amp * cos(ph) * (0.4 + 1.2 * s);
        return s;
      }

      // procedural caustics (3-fold domain warp) modulated by real wave refraction
      float caustic(vec2 p, float t) {
        vec2 i = p;
        float c = 1.0;
        for (int n = 0; n < 3; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
        }
        c = 1.17 - pow(c / 3.0, 1.4);
        return pow(abs(c), 8.0);
      }

      // rotated multi-octave lace noise so foam breaks into organic seafoam webs (never a grid)
      float foamNoise(vec2 p) {
        vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
        float a = sin(q.x * 31.0 + uTime * 1.1 + sin(q.y * 23.0 - uTime * 0.9) * 1.4);
        vec2 r = mat2(0.5, 0.866, -0.866, 0.5) * p;
        float b = sin(r.x * 59.0 - uTime * 1.7 + cos(r.y * 47.0 + uTime * 1.3) * 1.2);
        float c = cos((q.x - r.y) * 95.0 + uTime * 2.1);
        return clamp(0.5 + 0.28 * a + 0.18 * b + 0.09 * c, 0.0, 1.0);
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = vWorld.xz;
        vec2 local = (p - uCenter) / max(uExtent, vec2(1e-4));
        float rad = length(local);
        float edge = mix(max(abs(local.x), abs(local.y)), rad, uCircular);
        float front = uFill * uReach;
        float dist = distance(p, uSource);
        float spread = 1.0 - smoothstep(front - 0.032, front, dist);
        if (uFill < 0.001 || spread < 0.001) discard;

        // Feeding-frenzy pools (uMurky > 0): keep high-contrast hostile crimson-indigo vortex
        if (uMurky > 0.5) {
          vec2 slope = vec2(0.0);
          float h = wave(p, vec2(0.83, 0.55), 57.0, 1.5, 0.0016, slope) + wave(p, vec2(-0.80, 0.60), 89.0, 1.1, 0.0011, slope);
          float ang = atan(local.y, local.x);
          float spin = ang - uTime * (2.9 + 1.7 / (rad + 0.20)) + log(rad + 0.07) * 4.2;
          float warp = sin(rad * 14.0 - uTime * 4.2) * 1.1 + cos(ang * 3.0 + uTime * 2.1) * 0.6;
          float swirlArms = smoothstep(0.25, 1.0, 0.5 + 0.5 * sin(spin * 3.0 + warp)) * smoothstep(1.0, 0.14, rad);
          float veins = smoothstep(0.66, 1.0, 0.5 + 0.5 * sin(spin * 7.0 - warp * 1.3 + rad * 10.0));
          swirlArms = clamp(swirlArms * 0.65 + veins * 0.6, 0.0, 1.0);
          float froth = smoothstep(0.76, 1.0, 0.5 + 0.5 * sin(spin * 5.0 + rad * 16.0 - uTime * 5.5)) * smoothstep(0.96, 0.25, rad);
          float pulse = 0.5 + 0.5 * sin(rad * 16.0 - uTime * 7.0);
          slope += normalize(local + vec2(1e-4)) * cos(rad * 16.0 - uTime * 7.0) * 0.055;
          float rimWave = 0.5 + 0.5 * sin(ang * 7.0 + uTime * 5.5);
          float frenzyRim = smoothstep(0.82, 0.97, rad) * smoothstep(1.02, 0.95, rad) * (0.6 + 0.4 * rimWave + 0.2 * pulse);
          vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 view = normalize(cameraPosition - vWorld);
          float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
          float lightLines = caustic(p * 65.0 + slope * 420.0, uTime * 0.9);
          vec3 poolCore = mix(uDeep, uShallow, clamp(0.12 + swirlArms * 0.72 + rad * 0.18, 0.0, 1.0));
          poolCore = mix(poolCore, uDeep * 0.35, smoothstep(0.42, 0.0, rad));
          poolCore += uShallow * lightLines * 0.22 + mix(uFoam, uShallow, 0.55) * froth * 0.45;
          vec3 col = mix(poolCore, uFoam * 0.4, fresnel * 0.18);
          col += mix(uShallow, uFoam, 0.35) * frenzyRim * 0.95;
          float alpha = (0.90 * smoothstep(1.02, 0.88, rad) + frenzyRim * 0.22) * spread;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        // --- Arena Interactive Water ---
        vec2 uv = clamp(vWuv, 0.004, 0.996);
        vec4 sim = texture2D(uWaveMap, uv);
        float simH = (sim.r - 0.5) * 2.0;
        vec2 simSlope = (sim.gb - 0.5) * 2.0;
        float simFoam = sim.a;

        // Micro capillary ripples layered over the macro simulated wave slopes
        vec2 microSlope = vec2(0.0);
        float motion = 1.0 - uCalm * 0.82;
        float h = wave(p, vec2(0.83, 0.55), 48.0, 1.6 * motion, 0.0018 * motion, microSlope)
                + wave(p, vec2(-0.78, 0.62), 79.0, 1.2 * motion, 0.0012 * motion, microSlope)
                + wave(p, vec2(0.22, -0.97), 121.0, 2.2 * motion, 0.0007 * motion, microSlope)
                + wave(p, vec2(-0.46, -0.89), 178.0, 2.9 * motion, 0.0004 * motion, microSlope);

        // Combine macro interactive waves (strong facet response) + fine capillary ripples
        vec2 slope = simSlope * 1.15 + microSlope;
        vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 view = normalize(cameraPosition - vWorld);
        float NdotV = max(dot(n, view), 0.0);
        // Schlick Fresnel for air-water interface (IOR 1.333 -> F0 = 0.02)
        float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
        vec3 reflected = reflect(-view, n);

        // Real bedroom lighting from the baked light grid (1 lookup) + moonlit night-sky reflection
        vec4 gL = gridLight(vWorld, n);
        vec3 skyRefl = mix(uDeepWater * 1.15, vec3(0.24, 0.44, 0.62), smoothstep(-0.08, 0.72, reflected.y));
        // subtle moonlit window sheen band across the reflected sky
        skyRefl += vec3(0.45, 0.68, 0.90) * pow(max(0.0, dot(reflected, normalize(vec3(-0.7, 0.6, -0.2)))), 8.0) * 0.45;
        vec3 envRefl = mix(skyRefl, gL.rgb * 0.95 + skyRefl * 0.45, clamp(gL.a * 0.42, 0.0, 0.72));

        // Act 3 west-window moonlight specular + secondary cool rim glint on wave facets
        vec3 moonDir = normalize(vec3(-0.78, 0.58, -0.22));
        vec3 moonCol = vec3(0.72, 0.88, 1.0);
        float moonSpec = pow(max(dot(reflect(-moonDir, n), view), 0.0), 120.0) * 2.8
                       + pow(max(dot(reflect(-moonDir, n), view), 0.0), 20.0) * 0.35;
        float facetRim = max(0.0, dot(n, moonDir)) * 0.22;

        // Live jelly bioluminescent glow glistening on nearby waves
        vec3 gVec = lbGlowPos - vWorld;
        float gDist = length(gVec);
        vec3 gDir = gVec / max(gDist, 1e-4);
        float gAtt = (lbGlowDist > 0.0 && lbGlowDecay > 0.0) ? pow(clamp(1.0 - gDist / lbGlowDist, 0.0, 1.0), lbGlowDecay) : 0.0;
        float gSpec = pow(max(dot(reflect(-gDir, n), view), 0.0), 40.0) * 1.15 + max(dot(n, gDir), 0.0) * 0.3;
        vec3 jellyLight = lbGlowColor * gAtt * gSpec;

        // Wave-coupled caustics: wave crests focus light & slopes refract caustic webs onto the quilt
        float curvature = clamp(simH * 1.35 + length(simSlope) * 0.85, 0.0, 1.6);
        float caust = caustic(p * 42.0 + simSlope * 4.5 + microSlope * 340.0, uTime * 0.8 * motion);
        float caustBright = caust * (0.65 + curvature * 0.95) + max(0.0, simH) * 0.25;

        // Beer-Lambert optical absorption & moonlit subsurface scattering in raised wave crests
        float opticalDepth = clamp((uDepth * 28.0 + max(0.0, simH) * 0.55) / max(NdotV, 0.22), 0.0, 3.2);
        vec3 body = mix(uDeepWater, uClear, exp(-opticalDepth * 0.48));
        float sss = clamp(max(0.0, simH) * 1.1 + vLip * 0.75 + length(simSlope) * 0.3, 0.0, 1.2)
                  * (0.45 + 0.55 * pow(max(0.0, dot(view, -moonDir)), 2.0));
        body += uSss * sss * 0.62 + mix(uSss, moonCol, 0.5) * caustBright * 0.45 + uClear * facetRim;
        body *= 0.85 + clamp(dot(gL.rgb, vec3(0.3, 0.59, 0.11)), 0.0, 0.8) * 0.35;

        vec3 col = mix(body, envRefl, clamp(fresnel * 0.85 + 0.06, 0.0, 0.88));
        col += moonCol * moonSpec * uGlint + jellyLight * 0.9;

        // Multi-layer lacy seafoam: dynamic wake/splash foam + wave crests + wall meniscus + center-fill lip
        float fn = foamNoise(p);
        float lace = smoothstep(0.42, 0.78, fn);
        float wakeFoam = smoothstep(0.22, 0.85, simFoam) * (0.28 + 0.72 * lace);
        float crestFoam = smoothstep(0.42, 0.98, simH + length(simSlope) * 0.55) * lace;
        float wallBand = smoothstep(0.92, 0.992, edge);
        float meniscus = wallBand * (0.25 + 0.75 * smoothstep(0.35, 0.78, fn + simH * 0.6 + 0.16 * sin(h * 2.4)));
        float lipFoam = (1.0 - smoothstep(0.0, 0.048, abs(dist - front + 0.015))) * (1.0 - smoothstep(0.84, 1.0, uFill)) * (0.45 + 0.55 * lace);
        float springFroth = exp(-dist * dist / 0.016) * (1.0 - smoothstep(0.70, 1.0, uFill)) * (0.35 + 0.65 * lace);
        float totalFoam = clamp(wakeFoam * 0.62 + crestFoam * 0.42 + meniscus * 0.45 + lipFoam * 0.82 + springFroth * 0.60, 0.0, 1.0);
        col = mix(col, uFoam * (0.88 + 0.12 * moonCol), totalFoam * 0.78);

        // Translucent deep water alpha: lets quilt & caustics peek through while reading as real liquid
        float depthAlpha = 1.0 - exp(-opticalDepth * 0.75);
        float alpha = clamp((0.42 + depthAlpha * 0.30 + fresnel * 0.38 + totalFoam * 0.42) * spread + lipFoam * 0.25, 0.0, 0.95);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  return shared;
}

// --- Carved Dark Stone / Tide-Pool Basin Rim Arena Walls ---
// Builds a merged carved-stone perimeter curb with corner bollards + a recessed central spring
// medallion where the water wells up from. Only 2 draw calls total, zero extra lights.
let sharedStoneMat = null;
function stoneWallMaterial() {
  if (sharedStoneMat) return sharedStoneMat;
  sharedStoneMat = new THREE.ShaderMaterial({
    uniforms: {
      ...BAKED_LIGHT.uniforms,
      uTime: { value: 0 },
      uWaterY: { value: 0 },
      uFill: { value: 0 },
      uCalm: { value: 0 },
      uMoss: { value: new THREE.Color(LOOK.color('shark-wall-moss', '#1d3a3a')) },
      uRune: { value: new THREE.Color(LOOK.color('shark-wall-rune', '#6ec6d4')) },
      uCenter: { value: new THREE.Vector2() },
      uExtent: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vColor = color;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <logdepthbuf_pars_fragment>
      ${GRID_GLSL}
      uniform float uTime, uWaterY, uFill, uCalm;
      uniform vec3 uMoss, uRune, lbGlowPos, lbGlowColor;
      uniform float lbGlowDist, lbGlowDecay;
      uniform vec2 uCenter, uExtent;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;

      // fine chiseled stone grain
      float grain(vec3 p) {
        float g = sin(p.x * 165.0 + p.z * 95.0) * cos(p.y * 210.0 - p.z * 140.0);
        g += 0.5 * sin(p.x * 340.0 - p.y * 290.0 + p.z * 260.0);
        return g * 0.5;
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float g = grain(vWorld);
        vec3 base = vColor * (0.90 + 0.14 * g);

        // Strictly inward-facing wall check so wet sheen & waterline stay inside the basin
        float innerFace = smoothstep(-0.1, -0.55, dot(n.xz, normalize(vWorld.xz - uCenter + vec2(1e-4))));

        // Damp tide-pool moss & wet darkening below the rising waterline
        float belowWater = (uWaterY + 0.008) - vWorld.y;
        float wet = smoothstep(-0.008, 0.014, belowWater) * smoothstep(0.15, 0.95, uFill) * innerFace;
        float waterline = exp(-pow((vWorld.y - uWaterY) / 0.006, 2.0)) * smoothstep(0.25, 0.95, uFill) * innerFace;
        base = mix(base, mix(base * 0.45, uMoss, 0.35), wet);

        // Real bedroom baked light + Act 3 west-window moonlight + chiseled rim highlight
        vec4 gL = gridLight(vWorld, n);
        vec3 ambient = max(gL.rgb * 0.95, vec3(0.14, 0.18, 0.25));
        vec3 moonDir = normalize(vec3(-0.85, 0.55, -0.15));
        vec3 moonCol = vec3(0.68, 0.84, 1.0);
        float NdotL = max(dot(n, moonDir), 0.0);
        float topRim = smoothstep(0.65, 0.98, n.y) * 0.22;
        float specPow = mix(18.0, 72.0, wet);
        float specGain = mix(0.08, 0.48, wet);
        float spec = pow(max(dot(reflect(-moonDir, n), view), 0.0), specPow) * specGain;

        // Live jelly glow on the stone blocks
        vec3 gv = lbGlowPos - vWorld;
        float gd = length(gv);
        float gAtt = (lbGlowDist > 0.0 && lbGlowDecay > 0.0) ? pow(clamp(1.0 - gd / lbGlowDist, 0.0, 1.0), lbGlowDecay) : 0.0;
        vec3 jellyDiff = lbGlowColor * gAtt * (max(dot(n, gv / max(gd, 1e-4)), 0.0) * 0.65 + wet * 0.25);

        vec3 col = base * (ambient + moonCol * (NdotL * 0.65 + topRim)) + moonCol * spec + jellyDiff * base * 1.4;

        // Shimmering caustic/meniscus reflection along the inner wet waterline
        float shimmer = 0.55 + 0.45 * sin((vWorld.x + vWorld.z) * 48.0 - uTime * (1.0 - uCalm * 0.8) * 3.8);
        col += uRune * waterline * shimmer * 0.26;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    vertexColors: true,
    toneMapped: true,
  });
  return sharedStoneMat;
}

function paintGeo(geo, hex, topHex = null, botHex = null) {
  const c = new THREE.Color(hex), ct = topHex ? new THREE.Color(topHex) : c, cb = botHex ? new THREE.Color(botHex) : c;
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const arr = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm ? nrm.getY(i) : 0;
    tmp.copy(ny > 0.55 ? ct : ny < -0.55 ? cb : c);
    arr[i * 3] = tmp.r; arr[i * 3 + 1] = tmp.g; arr[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

export function buildSharkArena(arena, waterFloor) {
  const [x0, , z0] = arena.arenaMin, [x1, , z1] = arena.arenaMax;
  const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
  const w = x1 - x0, l = z1 - z0;
  const wallH = LOOK.num('shark-wall-height', 0.095);
  const thick = LOOK.num('shark-wall-thick', 0.052);
  const stoneHex = LOOK.color('shark-wall-stone', '#2b3340');
  const hiHex = LOOK.color('shark-wall-highlight', '#526072');
  const darkHex = '#1a2029';

  const parts = [];
  // Deterministic subtle stone block variation (carved ashlar look, no Math.random drift)
  const hash = (i) => Math.sin(i * 127.1 + 311.7) * 0.5;

  const addSide = (alongX, fixedCoord, start, end, sign) => {
    const span = end - start;
    const count = Math.max(8, Math.round(span / 0.145));
    const step = span / count;
    for (let i = 0; i < count; i++) {
      const jitterH = hash(i + fixedCoord * 13) * 0.008;
      const jitterT = hash(i * 3.1 + fixedCoord * 7) * 0.005;
      const bh = wallH + jitterH;
      const bt = thick + jitterT;
      const mid = start + (i + 0.5) * step;
      const blen = step * 0.96; // tiny mortar seam between carved stone blocks
      const bx = alongX ? blen : bt;
      const bz = alongX ? bt : blen;
      const block = new THREE.BoxGeometry(bx, bh, bz);
      const px = alongX ? mid : fixedCoord + sign * (thick * 0.42);
      const pz = alongX ? fixedCoord + sign * (thick * 0.42) : mid;
      block.translate(px - cx, bh * 0.5, pz - cz);
      parts.push(paintGeo(block, stoneHex, hiHex, darkHex));

      // Beveled stone coping cap slightly overhanging the top of each block
      const capH = 0.015;
      const cap = new THREE.BoxGeometry(bx + (alongX ? 0.002 : 0.009), capH, bz + (alongX ? 0.009 : 0.002));
      cap.translate(px - cx, bh + capH * 0.35, pz - cz);
      parts.push(paintGeo(cap, hiHex, hiHex, stoneHex));
    }
  };

  addSide(true, z0, x0, x1, -1); // foot of the bed (near wall)
  addSide(true, z1, x0, x1, +1); // along front of the pillows (far wall)
  addSide(false, x0, z0, z1, -1); // west wall (by bassinet)
  addSide(false, x1, z0, z1, +1); // east wall

  // 4 carved corner bollards anchoring the arena rectangle
  const postW = thick * 1.48, postH = wallH + 0.026;
  const corners = [
    [x0 - thick * 0.35, z0 - thick * 0.35],
    [x1 + thick * 0.35, z0 - thick * 0.35],
    [x0 - thick * 0.35, z1 + thick * 0.35],
    [x1 + thick * 0.35, z1 + thick * 0.35],
  ];
  for (const [px, pz] of corners) {
    const post = new THREE.BoxGeometry(postW, postH, postW);
    post.translate(px - cx, postH * 0.5, pz - cz);
    parts.push(paintGeo(post, stoneHex, hiHex, darkHex));
    const cap = new THREE.BoxGeometry(postW * 1.14, 0.018, postW * 1.14);
    cap.translate(px - cx, postH + 0.006, pz - cz);
    parts.push(paintGeo(cap, hiHex, hiHex, stoneHex));
  }

  const mergedGeo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  const wallMat = stoneWallMaterial();
  wallMat.uniforms.uCenter.value.set(cx, cz);
  wallMat.uniforms.uExtent.value.set(w * 0.5, l * 0.5);

  const wallMesh = new THREE.Mesh(mergedGeo, wallMat);
  wallMesh.name = 'Shark stone arena walls';
  wallMesh.userData.noCollide = true;
  wallMesh.userData.noCameraFade = true;

  // Recessed central carved stone spring ring where the water wells up from
  const ringGeo = new THREE.RingGeometry(0.055, 0.115, 28).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(LOOK.color('shark-wall-rune', '#6ec6d4')),
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const springRing = new THREE.Mesh(ringGeo, ringMat);
  springRing.name = 'Shark arena center spring';
  springRing.position.set(0, 0.004, 0);
  springRing.userData.noCollide = true;
  springRing.renderOrder = 1;

  const group = new THREE.Group();
  group.name = 'Shark arena basin';
  group.position.set(cx, waterFloor, cz);
  group.add(wallMesh, springRing);

  const hiddenY = -(wallH + 0.032);
  wallMesh.position.y = hiddenY;

  return {
    group, wallMesh, springRing, wallH,
    setRise(k) {
      const t = clamp(k, 0, 1);
      // smooth ease-out with heavy stone settle
      const eased = 1 - Math.pow(1 - t, 3);
      wallMesh.position.y = THREE.MathUtils.lerp(hiddenY, -0.008, eased);
      wallMesh.visible = t > 0.001;
    },
    update(time, waterY, fill, calm) {
      const U = wallMat.uniforms;
      U.uTime.value = time;
      U.uWaterY.value = waterY;
      U.uFill.value = fill;
      U.uCalm.value = calm ? 1 : 0;
      // central spring glows softly while water wells up from it, then dims gently beneath the surface
      const glow = fill > 0 ? Math.sin(clamp(fill, 0, 1) * Math.PI) * 0.55 + (1 - Math.min(1, fill)) * 0.15 : 0;
      const pulse = calm ? 1 : 0.85 + 0.15 * Math.sin(time * 7);
      ringMat.opacity = clamp(glow * pulse, 0, 0.65);
      springRing.visible = ringMat.opacity > 0.01;
    },
    dispose() {
      mergedGeo.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
