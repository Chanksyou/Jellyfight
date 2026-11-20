// Fire's side card (aura="flames"): noise flames on a white-hot to deep-red ramp licking up round the
// jelly, tallest at the sides, one layer behind it and one in front of the tentacles that hang back;
// heat shimmer bending the jelly above them; embers rising with short trails; thin dark smoke behind;
// warm flickering light on the underside of the bell and the tentacles. The worked example for the
// other kinds: kit.js says what paint() can call.
export const RAMP = 'aura-flames-ramp';
export const RAMP_FALLBACK = ['#fff6dc', '#ffc85a', '#ff6a1f', '#8a1a0a'];

export const PAINT = /* glsl */`
// how much flame is at uv (> 0 inside one, ~1 in a core): nine tongues along the bottom, tallest at
// the sides so they climb round the jelly, each leaning in, swaying and flickering, their edges eaten
// by noise scrolling up so they split and throw off licks
float flame(vec2 uv, float t, float seed, float tall) {
  float I = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i), r = hash(vec2(fi, seed));
    float u = (fi + 0.5) / 9.0 + (r - 0.5) * 0.07, side = abs(u - 0.5) * 2.0;
    float h = (0.14 + 0.42 * side * side + 0.05 * r) * tall * (0.78 + 0.35 * noise(vec2(t * 2.1 + fi * 3.7, seed)));
    float y = uv.y / h;
    if (y > 1.0) continue;
    float sway = (noise(vec2(uv.y * 5.0 - t * 3.2 + fi * 5.3, seed + 2.0)) - 0.5) * 0.11 * y - (u - 0.5) * 0.1 * y;
    float w = (0.055 + 0.03 * hash(vec2(fi, seed + 9.0))) * (1.0 + 0.6 * side) * pow(max(1.0 - y, 0.0), 0.55);
    float d = abs(uv.x - u - sway) / max(w, 1e-3);
    I = max(I, (1.0 - d) * (1.0 - 0.55 * y));
  }
  if (I <= 0.0) return -1.0;
  float n = fbm(vec2(uv.x * 9.0 + seed, uv.y * 4.0 - t * 2.8), 4);
  return I - (n - 0.45) * 0.8 * smoothstep(0.0, 0.35, uv.y);
}
// a flame's colour (rgb, linear) and how much of it there is (a): thin deep-red licks at its edges,
// orange body, a white-yellow core low down that blooms; brightness comes from a, never dark colours
vec4 fire(float f) {
  float a = smoothstep(0.0, 0.45, f);
  return vec4(ramp(smoothstep(-0.05, 1.2, f)) * (0.55 + 0.75 * smoothstep(0.85, 1.2, f)), a);
}

vec3 paint(vec2 uv) {
  float t = uTime, flick = 0.78 + 0.22 * noise(vec2(t * 7.0, 3.0));
  vec3 c = water(uv);
  // the floor and the water low down glow warm
  // the water above the fire takes its light, strongest low down and up the sides where they climb
  float side = abs(uv.x - 0.5) * 2.0;
  c += uRamp[2] * (0.16 * (1.0 - smoothstep(0.0, 0.55 + 0.25 * side, uv.y)) * flick) * uStrength;
  // thin dark smoke drifting up behind, off to the sides
  float s = fbm(uv * vec2(3.2, 2.2) - vec2(t * 0.07, t * 0.3), 3);
  float sa = cut(s, 0.45, 0.3) * smoothstep(0.4, 0.9, uv.y) * smoothstep(0.2, 0.7, side);
  c = mix(c, uRamp[3] * 0.04, sa * 0.6 * uStrength);
  // the flames behind the jelly
  vec4 back = fire(flame(uv, t, 0.0, 1.0));
  float grain = 0.7 + 0.6 * fbm(vec2(uv.x * 16.0, uv.y * 6.0 - t * 3.6), 3);   // brighter and darker streaks rushing up inside
  back.rgb *= grain;
  c = c * (1.0 - back.a * 0.5 * uStrength) + back.rgb * back.a * uStrength;
  // heat shimmer: the jelly wobbles where the hot air rises off the flames
  float heat = (1.0 - smoothstep(0.2, 0.85, uv.y)) * uStrength;
  vec2 h = vec2(noise(uv * vec2(10.0, 7.0) - vec2(0.0, t * 2.4)), noise(uv * vec2(10.0, 7.0) + vec2(7.3, -t * 2.4))) - 0.5;
  vec2 at = bend(uv, h * 0.014 * heat);
  vec4 p = portrait(at);
  vec4 j = jelly(at);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;   // (its glow adds light round it, it covers only where it is)
  // the fire lights the jelly from below: the underside of the bell and the tentacles take its colour
  float under = j.x * (0.6 + 0.4 * max(0.0, -j.w)) * (1.0 - smoothstep(0.25, 0.75, uv.y));
  // (the jelly glows: its light is recoloured toward the fire's rather than tinted, which a glow shrugs off)
  vec3 warm = uRamp[1] / max(uRamp[1].r, 1e-3);
  c = mix(c, min(dot(c, vec3(0.35, 0.45, 0.2)), 2.0) * 0.38 * warm, min(under * 1.2, 1.0) * (0.8 + 0.2 * flick) * uStrength);
  c += (uRamp[2] * 0.22 + uRamp[1] * 0.06) * under * flick * uStrength;
  c += uRamp[1] * rim(at, vec2(0.0, -1.0), 0.015) * 0.45 * flick * uStrength;
  // the flames in front: lower, lapping over the tentacles that hang back (not those nearer than them)
  float hidden = j.x * (1.0 - smoothstep(0.42, 0.58, j.y));
  vec4 front = fire(flame(uv, t * 1.1, 4.7, 0.55));
  front.rgb *= grain;
  front.a *= (1.0 - hidden) * 0.8 * uStrength;
  c = c * (1.0 - front.a * 0.5) + front.rgb * front.a;
  // embers rising off them with short trails, three sizes
  for (int k = 0; k < 3; k++) {
    if (float(k) >= uLayers) break;
    float fk = float(k), sc = 7.0 + 5.0 * fk;
    vec2 g = vec2(uv.x * sc, uv.y * sc * 0.5 - t * (0.85 + 0.35 * fk) - fk * 3.1);
    vec2 id = floor(g), f = fract(g);
    float r = hash(id + fk * 13.7);
    if (r < 0.82) continue;
    vec2 at2 = vec2(0.25 + 0.5 * hash(id + 3.1) + 0.12 * sin(t * 2.3 + r * 40.0), 0.3 + 0.5 * hash(id + 5.7));
    vec2 d = (f - at2) * vec2(1.0, 2.0);                       // in cell widths (a cell is twice as tall as wide)
    float tail = clamp(d.y, -0.22, 0.0), dist = length(vec2(d.x, d.y - tail));
    float e = ((1.0 - smoothstep(0.0, 0.06, dist)) + 0.3 * (1.0 - smoothstep(0.0, 0.2, dist))) * (1.0 + tail / 0.22 * 0.9);
    float life = (1.0 - smoothstep(0.3, 0.9, uv.y)) * smoothstep(0.0, 0.08, uv.y) * (0.5 + 0.5 * sin(t * 9.0 + r * 60.0));
    c += ramp(0.35 + 0.35 * r) * e * life * 0.75 * uStrength;
  }
  return c;
}
`;
