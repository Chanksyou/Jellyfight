// Glitter's side card (aura="glitter"): a party in the water. Big out-of-focus discs of coloured light
// swell and fade far behind the jelly (bokeh, brighter at their rims); glitter flakes fall through three
// depths, each a tumbling facet that is dull until it turns face on, then flashes white with a tiny star;
// a few big soft flakes drift in front. The jelly is lit a little pink (its own colour still reads) with a slowly turning rainbow
// rim and a disco glint sliding over the bell, glitter clings along its edge, four-point stars wink round
// it (few inside the bell: nothing is drawn on it) and a drift of flakes glitters low across the card.
// kit.js says what paint() can call.
export const RAMP = 'aura-glitter-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#ff9ae8', '#9a5cff', '#2a1458'];

export const PAINT = /* glsl */`
// a saturated colour for h (0-1 round the rainbow), softened toward white
vec3 spectrum(float h) {
  vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return mix(vec3(1.0), c * c, 0.82);
}

// out-of-focus discs of light: a disc (soft edge, brighter ring) in some of a grid's cells, swelling and
// fading at their own pace. A disc stays inside its cell, so the grid can slide without clipping them
vec3 bokeh(vec2 uv, float t, float sc, float rad, float seed, float few) {
  vec2 g = uv * sc + vec2(t * 0.03, t * 0.05 * (1.0 + seed * 0.2)) + seed * 5.0;
  vec2 id = floor(g), f = fract(g);
  float h = hash(id + seed);
  if (h > few) return vec3(0.0);
  vec2 at = 0.3 + 0.4 * hash2(id + seed + 2.3);
  float r = rad * (0.55 + 0.45 * hash(id + seed + 1.7)), d = length(f - at);
  float swell = 0.5 + 0.5 * sin(t * (0.35 + 0.4 * hash(id + seed + 4.0)) + h * 60.0);
  float disc = 1.0 - smoothstep(r * 0.8, r, d);
  float ring = smoothstep(r * 0.5, r * 0.95, d) * disc;
  return spectrum(hash(id + seed + 3.3)) * (disc * 0.2 + ring * 0.3) * (0.25 + 0.75 * swell * swell);
}

// a tiny star: a bright core and four thin rays (not kit.js's glint, whose box shows on a small flake)
float sparkle(vec2 d, float r) {
  vec2 a = abs(d) / r;
  float core = max(0.0, 1.0 - length(d) / (r * 0.3));
  float rays = max((1.0 - smoothstep(0.0, 0.07, a.x)) * (1.0 - smoothstep(0.0, 1.0, a.y)), (1.0 - smoothstep(0.0, 0.07, a.y)) * (1.0 - smoothstep(0.0, 1.0, a.x)));
  return core * core + rays * 0.8;
}

// glitter flakes in a jittered grid of sc cells across, falling and fluttering: rgb is what each one
// shines (a dull colour, flashing white as it tumbles face on), a is its shape (0 where there's none)
vec4 flakes(vec2 uv, float t, float sc, float fall, float size, float seed, float few) {
  vec2 g = vec2(uv.x * sc + sin(t * 0.5 + uv.y * 3.0 + seed) * 0.25, uv.y * sc + t * fall + seed * 3.7);
  vec2 id = floor(g), f = fract(g);
  if (hash(id + seed) > few) return vec4(0.0);
  vec2 at = 0.3 + 0.4 * hash2(id + seed + 2.3), p = f - at;
  float turn = hash(id + seed + 5.1) * 6.2832, c = cos(turn), sn = sin(turn);
  p = vec2(c * p.x + sn * p.y, -sn * p.x + c * p.y);
  float tumble = cos(t * (0.9 + 1.6 * hash(id + seed + 8.0)) + hash(id + seed + 9.0) * 6.2832);
  p.y /= 0.18 + 0.82 * abs(tumble);                                  // seen edge on, a flake is a thin line
  float shape = 1.0 - smoothstep(0.55, 1.0, (abs(p.x) + abs(p.y) * 1.3) / size);   // a diamond facet
  float flash = pow(abs(tumble), 18.0);                              // face on to the light
  vec3 body = spectrum(hash(id + seed + 3.3)) * (0.25 + 0.4 * abs(tumble));
  vec3 shine = body * shape + vec3(1.0) * flash * shape * 1.6 + spectrum(hash(id + seed + 6.0)) * sparkle(p, size * 2.2) * flash * 1.4;
  return vec4(shine, shape);
}

// a four-point star that winks on and off in a few of a grid's cells
vec3 stars(vec2 uv, float t, float sc, float seed, float few) {
  vec2 g = uv * sc + seed * 7.0, id = floor(g), f = fract(g);
  float h = hash(id + seed);
  if (h > few) return vec3(0.0);
  vec2 at = 0.25 + 0.5 * hash2(id + seed + 1.1);
  float wink = pow(max(0.0, sin(t * (0.9 + hash(id + seed + 2.0)) + hash(id + seed + 3.0) * 40.0)), 4.0);
  vec2 j = jelly((id + at - seed * 7.0) / sc).xy;                        // (not on the bell)
  vec3 c = mix(vec3(1.0), spectrum(hash(id + seed + 4.0)), 0.55);
  return c * glint(f - at, 0.2 + 0.1 * hash(id + seed + 5.0)) * wink * (1.0 - 0.85 * j.x);
}

vec3 paint(vec2 uv) {
  float t = uTime, s = uStrength;
  bool rich = uLayers > 2.5;
  vec3 pink = uRamp[1], violet = uRamp[2];
  // the water, warmed to violet, with a pink glow behind the jelly and a haze of sparkle through it
  vec3 c = water(uv) * vec3(1.1, 0.55, 1.3);
  c += violet * 0.22 * (1.0 - smoothstep(0.1, 0.65, length((uv - vec2(0.5, 0.56)) * vec2(1.0, 1.1)))) * s;
  c += pink * 0.07 * cut(fbm(uv * vec2(3.0, 2.5) + vec2(t * 0.04, -t * 0.03), 4), 0.45, 0.4) * s;
  // far away: out-of-focus lights, two sizes
  c += bokeh(uv, t, 4.0, 0.3, 1.0, 0.35) * 0.8 * s;
  if (rich) c += bokeh(uv, t, 8.0, 0.3, 4.0, 0.3) * 0.55 * s;
  // far flakes, small and dim, behind the jelly
  vec4 f = flakes(uv, t, 46.0, 0.3, 0.2, 1.0, 0.3);
  c = c * (1.0 - f.a * 0.5 * s) + f.rgb * 0.5 * s;
  if (rich) { f = flakes(uv, t * 1.1, 26.0, 0.5, 0.22, 3.0, 0.22); c = c * (1.0 - f.a * 0.7 * s) + f.rgb * 0.8 * s; }
  // the jelly
  vec4 p = portrait(uv), j = jelly(uv);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;
  // lit by the party: its light warms toward pink, a rainbow rim turning slowly on one side and pink on the other
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(c, min(lum, 2.0) * pink / max(pink.g, 1e-3) * 0.9, j.x * 0.18 * s);   // (lightly: the player's own colour still reads)
  float ang = t * 0.25;
  c += spectrum(fract(t * 0.06)) * rim(uv, vec2(cos(ang), sin(ang)), 0.035) * 1.5 * s;
  c += pink * rim(uv, vec2(-cos(ang), -sin(ang) * 0.6 - 0.4), 0.035) * 1.3 * s;
  // a disco glint sliding over the bell as a light turns
  float turnL = t * 0.45;
  float spec = pow(max(0.0, dot(normalize(j.zw + 1e-4), normalize(vec2(cos(turnL), 0.6 + 0.4 * sin(turnL))))), 14.0) * j.x * step(0.4, uv.y);
  c += mix(vec3(1.0), pink, 0.4) * spec * 0.4 * s;
  // glitter clinging along the jelly's edge
  float edge = j.x * (1.0 - jelly(uv + vec2(0.0, 0.012)).x) + j.x * (1.0 - jelly(uv - vec2(0.012, 0.0)).x);
  f = flakes(uv, t * 0.2, 90.0, 0.0, 0.22, 7.0, 0.5);
  c += f.rgb * min(edge, 1.0) * 1.3 * s;
  // mid flakes, bright, in front of the far ones and round the jelly
  f = flakes(uv, t * 1.2, 16.0, 0.8, 0.16, 5.0, 0.16);
  c = c * (1.0 - f.a * 0.8 * s * (1.0 - 0.6 * j.x)) + f.rgb * s * (1.0 - 0.6 * j.x);
  // stars, winking
  c += stars(uv, t, 5.0, 1.0, 0.4) * 1.6 * s;
  if (rich) c += stars(uv, t * 1.3, 9.0, 2.0, 0.25) * 1.1 * s;
  if (rich) {
    // a drift of glitter low across the card: the pile the flakes land on, its top torn by noise, its
    // flakes at two sizes in grids turned against each other, so no rows show
    float h = 0.045 + 0.075 * fbm(vec2(uv.x * 4.0, 3.0), 3) + 0.02 * (noise(uv * vec2(40.0, 12.0)) - 0.5);
    float pile = 1.0 - smoothstep(h - 0.03, h + 0.02, uv.y);
    vec2 r1 = mat2(0.8, 0.6, -0.6, 0.8) * uv, r2 = mat2(0.6, -0.8, 0.8, 0.6) * uv + 0.37;
    f = flakes(r1, t * 0.1, 53.0, 0.0, 0.25, 11.0, 0.35);
    vec4 f2 = flakes(r2, t * 0.13, 87.0, 0.0, 0.22, 17.0, 0.3);
    float patchy = 0.4 + 0.9 * noise(uv * vec2(9.0, 30.0) + 4.0);
    c = c * (1.0 - pile * 0.45 * s) + ((f.rgb + f2.rgb * 0.8) * 1.4 * patchy + violet * 0.12) * pile * s;
    // a few big soft flakes in front, out of focus
    f = flakes(uv, t * 0.9, 5.0, 0.35, 0.3, 13.0, 0.25);
    c = mix(c, c + f.rgb * 0.9, f.a * 0.55 * s);
  }
  return c;
}
`;
