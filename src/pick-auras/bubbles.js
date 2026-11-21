// Normal's side card (aura="bubbles"): glassy bubbles rising through deep water. Three depths: far
// small ones behind the jelly, mid ones, and a few big near ones in front, each a lens (the jelly
// and the water seen magnified and bent through it) with a thin rainbow film on its rim, a bright
// window highlight and a soft second glint. Light ripples (a drifting net of caustics) cross the
// water and fall on the jelly, whose edges take a pale blue rim. kit.js says what paint() can call.
export const RAMP = 'aura-bubbles-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#d9f4ff', '#7fd0e8', '#2a6f9a'];

export const PAINT = /* glsl */`
// thin bright lines where noise crosses its middle (two octaves: one alone leaves flat patches)
float ridge(vec2 p) { return 1.0 - abs((noise(p) * 0.6 + noise(p * 2.03 + 5.1) * 0.4) * 2.0 - 1.0); }

// light rippling across the water: two drifting nets of lines whose crossings are bright. 0 .. 1
float caustics(vec2 uv, float t) {
  vec2 p = uv * 3.6;
  vec2 w = vec2(noise(p * 0.7 + t * 0.05), noise(p * 0.7 + 9.0 - t * 0.04)) * 2.0;
  float a = ridge(p + w + vec2(t * 0.07, t * 0.05));
  if (uLayers < 3.0) return pow(a, 4.0);
  float b = ridge(p * 1.35 + 4.0 - w + vec2(-t * 0.06, t * 0.04));
  return pow(a * b, 3.0);
}

// One layer of bubbles at uv, rising. A cell of the layer's grid (sc cells across the card, moving up
// rise cells a second) holds one bubble with chance few, up to rmax cells in radius (so it never
// leaves its cell). Out: off, where to look for what is seen through it; cover, 0 outside .. 1
// inside (soft at the edge); add, the film and glints on its surface.
void bubbles(vec2 uv, float t, float sc, float rise, float rmax, float few, float seed, float shine, out vec2 off, out float cover, out vec3 add) {
  off = vec2(0.0); cover = 0.0; add = vec3(0.0);
  vec2 g = vec2(uv.x * sc, uv.y * sc - t * rise), id = floor(g), f = fract(g);
  float h = hash(id + seed);
  if (h > few) return;
  vec2 h2 = hash2(id + seed + 3.7);
  float r = rmax * (0.45 + 0.55 * h2.x), wob = sin(t * (1.1 + h2.y) + h * 40.0);
  vec2 c = vec2(mix(r + 0.1, 1.0 - r - 0.1, h2.y), mix(r + 0.1, 1.0 - r - 0.1, hash(id + seed + 8.1)));
  c.x += 0.06 * sin(t * 0.8 + h * 30.0);                    // sways as it climbs
  vec2 d = f - c;
  d *= vec2(1.0 + 0.05 * wob, 1.0 - 0.05 * wob);            // and wobbles a little
  float L = length(d) / r;
  if (L > 1.0) return;
  cover = 1.0 - smoothstep(0.95, 1.0, L);
  vec3 n = vec3(d / r, sqrt(max(0.0, 1.0 - L * L)));
  // a lens: magnified in the middle, bent hard at the rim
  off = -d / sc * (0.4 + 0.55 * L * L);
  // the rainbow film: its colour turns with the angle (strong on the rim) and drifts across the bubble
  float fres = pow(1.0 - n.z, 2.2);
  float phase = 1.4 * fres + 0.45 * noise(d * 5.0 + t * 0.25 + h * 20.0) + h;
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (phase + vec3(0.0, 0.33, 0.67)));
  float ring = smoothstep(0.8, 0.95, L) * (1.0 - smoothstep(0.95, 1.0, L));
  add = film * (0.05 + 0.7 * fres) * shine + mix(vec3(1.0), film, 0.45) * ring * 0.45 * shine;
  // a window highlight up and to the left, a small soft glint low on the other side
  vec2 q = d / r - vec2(-0.4, 0.42);
  q = mat2(0.82, 0.57, -0.57, 0.82) * q;
  vec2 w = abs(q) - vec2(0.17, 0.065);
  float win = 1.0 - smoothstep(0.0, 0.035, length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - 0.035);
  float dot2 = 1.0 - smoothstep(0.04, 0.11, length(d / r - vec2(0.45, -0.5)));
  add += vec3(1.25) * win * shine + vec3(0.8, 0.95, 1.0) * dot2 * 0.35 * shine;
  add *= cover;
}

// the water and all behind the near bubbles: ripples of light, far bubbles, the jelly, the light on it
vec3 scene(vec2 uv, float t, float s) {
  vec3 pale = uRamp[1], cold = uRamp[2];
  vec3 c = water(uv);
  float rip = caustics(uv, t);
  c += mix(cold, pale, 0.4) * rip * 0.5 * smoothstep(0.1, 1.0, uv.y * 0.85 + 0.2) * s;
  // far bubbles, small and dim, behind the jelly
  if (uLayers >= 3.0) {
    vec2 off; float cover; vec3 add;
    bubbles(uv, t, 11.0, 0.35, 0.3, 0.22, 1.0, 0.45, off, cover, add);
    c = mix(c, c * 1.15 + cold * 0.05, cover * 0.6) + add * s;
  }
  vec4 p = portrait(uv);
  vec4 j = jelly(uv);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;
  // the ripples' light falls on the jelly, and a pale blue rim lights its upper left edge
  c += pale * rip * 0.18 * j.x * s;
  float r = rim(uv, vec2(-0.6, 0.8), 0.02);
  c += mix(cold, pale, 0.5) * r * (0.55 + 0.1 * sin(t * 1.1)) * s;
  return c;
}

vec3 paint(vec2 uv) {
  float t = uTime + 1.3, s = uStrength;   // (so Reduce effects' one frozen frame has no near bubble over the face)
  vec3 cold = uRamp[2];
  vec3 c = scene(uv, t, s);
  vec2 off; float cover; vec3 add;
  // mid bubbles, in front of the jelly
  bubbles(uv, t, 6.0, 0.5, 0.32, 0.17, 4.0, 0.8, off, cover, add);
  if (cover > 0.0) c = mix(c, scene(uv + off, t, s) * 1.04 + cold * 0.07, cover * s) + add * s;
  // a few big near ones: the jelly seen through them
  bubbles(uv, t, 3.2, 0.6, 0.38, 0.3, 9.0, 1.0, off, cover, add);
  if (cover > 0.0) c = mix(c, scene(uv + off, t, s) * 1.04 + cold * 0.07, cover * s) + add * s;
  return c;
}
`;
