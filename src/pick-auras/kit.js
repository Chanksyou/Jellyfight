// The pick screen side cards' shader kit (pick-aura.js draws the cards; one file per element kind
// beside this one). GLSL every kind can call, put ahead of the kind's own `paint()`:
//
//   uniforms   uTime (s), uColor (the type's --type-<id>, linear), uStrength (0-1), uLayers (noise
//              layers: fewer on Low graphics), uRamp[4] (the kind's colour ramp, hot to deep, linear)
//   water(uv)            the card's deep water, behind everything
//   portrait(uv)         the player's jelly, premultiplied (rgb already times alpha; linear, not tone mapped)
//   jelly(uv)            x: how much jelly covers here (0-1), y: its depth (0 near .. 1 far),
//                        zw: its view-space normal's xy (-1..1)
//   noise(p) fbm(p, octaves)   value noise 0-1, and up to uLayers octaves of it at x0.5/x1/x2 scales
//   cell(p)              x: distance to the nearest cell point, y: distance to the cell's edge, zw: the cell's id
//   ramp(k)              uRamp sampled 0 (deep edge) .. 1 (white hot)
//   cut(v, edge, soft)   a soft threshold: 0 below edge, 1 above edge + soft (erosion)
//   glint(d, r)          a four-point star glint at offset d, size r
//   rim(uv, dir, width)  light on the jelly's edges facing `dir` (2D, screen space, y up)
//   bend(uv, by)         uv moved by `by` (the portrait seen through heat or ice)
//
// UVs run 0-1 with y up; the jelly fills the middle (pick-portrait-room in look.css frames it).
export const KIT = /* glsl */`
uniform sampler2D uPortrait, uJelly;
uniform float uTime, uStrength, uLayers;
uniform vec3 uColor, uWater, uWaterHigh;
uniform vec3 uRamp[4];
varying vec2 vUv;

vec3 water(vec2 uv) {
  vec2 d = (uv - vec2(0.5, 0.62)) * vec2(1.0, 1.15);
  return mix(uWaterHigh, uWater, smoothstep(0.0, 0.75, length(d)));
}
vec4 portrait(vec2 uv) { return texture2D(uPortrait, uv); }
vec4 jelly(vec2 uv) { vec4 j = texture2D(uJelly, uv); return vec4(j.x, j.y, j.zw * 2.0 - 1.0); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// octaves at x0.5, x1, x2 ... (scales that never pulse against each other), up to uLayers of them
float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5, w = 0.0;
  p *= 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves || float(i) >= uLayers) break;
    v += a * noise(p); w += a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0; a *= 0.5;
  }
  return v / max(w, 1e-3);
}
vec4 cell(vec2 p) {
  vec2 i = floor(p), f = fract(p), best = vec2(0), id = vec2(0);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), o = g + hash2(i + g) - f;
    float d = dot(o, o);
    if (d < d1) { d2 = d1; d1 = d; best = o; id = i + g; } else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d1), 0.5 * (sqrt(d2) - sqrt(d1)), id);
}
vec3 ramp(float k) {
  k = clamp(k, 0.0, 1.0) * 3.0;
  return k < 1.0 ? mix(uRamp[3], uRamp[2], k) : k < 2.0 ? mix(uRamp[2], uRamp[1], k - 1.0) : mix(uRamp[1], uRamp[0], k - 2.0);
}
float cut(float v, float edge, float soft) { return smoothstep(edge, edge + soft, v); }
float glint(vec2 d, float r) {
  vec2 a = abs(d) / r;
  return max(0.0, 1.0 - length(d) / r) * 0.5 + max(0.0, 1.0 - a.x * a.y * 40.0 - (a.x + a.y) * 0.6) * 0.8;
}
float rim(vec2 uv, vec2 dir, float width) {
  vec4 j = jelly(uv);
  float edge = j.x * (1.0 - jelly(uv + normalize(dir) * width).x);   // jelly here, open water a little way toward the light
  float facing = max(0.0, dot(normalize(j.zw + 1e-4), normalize(dir)));
  return max(edge, j.x * facing * facing * 0.6);
}
vec2 bend(vec2 uv, vec2 by) { return uv + by; }
`;
