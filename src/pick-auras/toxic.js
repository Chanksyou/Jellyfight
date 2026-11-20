// Poison's side card (aura="toxic"): thick poison in murky green water. Bubbles of it, each a fat
// drop with a dark edge and a bright curved highlight, wobble as they rise and merge when they touch
// (one field, so two that meet flow into one); small dim ones behind the jelly, big sharp ones in
// front. Goo lines the top of the card's glass, swells into drips that stretch and fall, and runs
// down its inner edges; a bubbling pool lies along the bottom. Vapour curls up behind and breaks
// apart as it rises, and a sickly green light from below lights the jelly's underside.
// kit.js says what paint() can call.
export const RAMP = 'aura-toxic-ramp';
export const RAMP_FALLBACK = ['#f4ffd8', '#c4ff6a', '#5fcf3c', '#0e3a1a'];

export const PAINT = /* glsl */`
// Drops of goo are a field: each piece adds a bump that reaches 2.2x its radius and is 0.5 at its
// edge, so pieces that come close flow together. gf_ is the gradient, for the surface's slope.
vec2 gf_;
float goo_;
void blob(vec2 q, float r) {
  float R2 = r * r * 4.84, d2 = dot(q, q);
  if (d2 >= R2) return;
  float k = 1.0 - d2 / R2;
  goo_ += k * k * k;
  gf_ += -6.0 * k * k * q / R2;
}
// a run of goo from a to b, r thick
void run(vec2 p, vec2 a, vec2 b, float r) {
  vec2 ab = b - a;
  blob(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0), r);
}

// bubble i of a layer: xy its centre, z its radius (0 once popped), w how long since it popped (0-1,
// 1: long gone). Pairs share a column and rise at different speeds, so they catch up and merge
vec4 bubble(float i, float t, float seed, float front) {
  float col = floor(i * 0.5), h = hash(vec2(i, seed));
  float life = fract(t * (0.05 + 0.05 * hash(vec2(i, seed + 1.0))) + h);
  float side = hash(vec2(col, seed + 2.0)) < 0.5 ? -1.0 : 1.0;
  float out_ = front > 0.5 ? 0.3 + 0.16 * hash(vec2(col, seed + 3.0)) : 0.04 + 0.42 * hash(vec2(col, seed + 3.0));
  float x = 0.5 + side * out_ + 0.025 * sin(t * 1.3 + i * 2.3 + life * 7.0);
  float r = mix(0.016, 0.03, hash(vec2(i, seed + 4.0))) * (front > 0.5 ? 1.8 : 1.0) * (0.7 + 0.5 * life);
  float popAt = 0.7 + 0.3 * hash(vec2(i, seed + 5.0)), since = (life - popAt) / 0.08;
  return vec4(x, -0.08 + life * 1.2, since > 0.0 ? 0.0 : r, since > 0.0 ? min(since, 1.0) : 1.0);
}
// a bubble's piece of the field, squashing and stretching as it wobbles
float ring_;
void bubbles(vec2 p, float t, float seed, float front, int n) {
  for (int k = 0; k < 10; k++) {
    if (k >= n) break;
    float i = float(k);
    vec4 b = bubble(i, t, seed, front);
    if (b.z > 0.0) {
      float w = 0.1 * sin(t * (4.0 + hash(vec2(i, seed + 6.0)) * 3.0) + i * 1.7);
      blob((p - b.xy) * vec2(1.0 + w, 1.0 - w), b.z);
    } else if (b.w < 1.0) {   // just popped: a thin ring flung out where it was
      float r0 = mix(0.016, 0.03, hash(vec2(i, seed + 4.0))) * (front > 0.5 ? 1.8 : 1.0) * 1.1;
      float d = abs(length(p - b.xy) - r0 * (1.0 + b.w * 1.4));
      float a = atan(p.y - b.y, p.x - b.x);   // it tears into droplets as it spreads
      ring_ = max(ring_, (1.0 - smoothstep(0.0, 0.005 + 0.005 * front, d)) * (1.0 - b.w) * cut(noise(vec2(a * 2.5, i)), 0.45 + 0.3 * b.w, 0.1));
    }
  }
}

// the goo in front of the jelly at p: the lip along the top of the glass, its drips swelling and
// falling, drips running down the inner edges, the pool along the bottom, and the big bubbles
void frontGoo(vec2 p, float t) {
  // the lip: thicker in places, creeping
  blob(vec2(0.0, 1.0 - p.y), 0.016 + 0.018 * noise(vec2(p.x * 7.0 + t * 0.05, 3.0)));
  // drips off the lip, three to a side (clear of the middle, where the jelly is): each swells, stretches
  // on a thinning neck, lets go and falls
  for (int k = 0; k < 6; k++) {
    float i = float(k), side = k < 3 ? 0.0 : 1.0;
    float x = mix(0.05 + 0.08 * mod(i, 3.0), 0.95 - 0.08 * mod(i, 3.0), side) + 0.02 * (hash(vec2(i, 7.0)) - 0.5);
    float life = fract(t * (0.11 + 0.05 * hash(vec2(i, 8.0))) + hash(vec2(i, 9.0)));
    float swell = smoothstep(0.0, 0.7, life), fall = max(0.0, life - 0.7) / 0.3;
    float tip = 0.985 - 0.035 - 0.07 * swell - fall * fall * 1.3, r = 0.008 + 0.014 * swell;
    float neck = 1.0 - smoothstep(0.0, 0.35, fall);
    if (neck > 0.0) run(p, vec2(x, 0.99), vec2(x, mix(0.99, tip, neck)), (0.006 + 0.003 * (1.0 - swell)) * neck);
    blob((p - vec2(x, tip)) * vec2(1.0, 1.0 - 0.35 * min(fall * 3.0, 1.0)), r);
  }
  // drips running down the inner edges, leaving a thin trail
  for (int k = 0; k < 2; k++) {
    float i = float(k), x = (k == 0 ? 0.018 : 0.982) + 0.0015 * sin(p.y * 23.0 + i * 3.0);
    float life = fract(t * 0.07 + 0.5 * i + 0.13), y = 1.0 - life * 1.15;
    run(p, vec2(x, 1.0), vec2(x, y + 0.05), 0.0035 + 0.003 * smoothstep(0.4, 1.0, p.y));
    run(p, vec2(x, y + 0.05), vec2(x, y), 0.008);
    blob(p - vec2(x, y), 0.015);
  }
  // the pool along the bottom, slowly heaving
  blob(vec2(0.0, p.y), 0.022 + 0.022 * noise(vec2(p.x * 5.0 - t * 0.2, t * 0.3)));
  bubbles(p, t, 21.0, 1.0, 8);
}

// how a field of goo looks over c (what's behind it): a thick drop with a dark edge, light through
// its middle tinted green, a bright curved highlight up on its left, green light from below on its
// underside. behind: the colour seen through it (refracted), dim: how far back it is (0 near .. 1 far)
vec3 shade(vec3 c, vec3 behind, float dim) {
  float cover = smoothstep(0.46, 0.54, goo_);
  if (cover <= 0.0) return c;
  // its height (a sphere's, for one drop) and the slope of its surface
  float z = sqrt(clamp(1.0 - 4.84 * (1.0 - pow(min(goo_, 1.0), 0.3333)), 0.0, 1.0));
  vec3 n = vec3(-normalize(gf_ + 1e-6) * sqrt(1.0 - z * z), z);
  float edge = pow(1.0 - z, 1.1);
  vec3 body = mix(ramp(0.6), uRamp[3] * 0.3, edge);
  vec3 col = behind * mix(vec3(1.0), body * 1.6, 0.7) * (1.0 - 0.85 * edge) + body * (0.18 + 0.2 * edge);
  vec3 L = normalize(vec3(-0.5, 0.65, 0.6)), H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(0.0, dot(n, H)), 70.0);
  vec2 rn = n.xy / max(length(n.xy), 1e-4);
  float crescent = pow(max(0.0, dot(rn, vec2(-0.55, 0.83))), 3.0) * smoothstep(0.25, 0.6, length(n.xy)) * (1.0 - smoothstep(0.85, 0.99, length(n.xy)));
  float under = pow(max(0.0, dot(rn, vec2(0.25, -0.97))), 2.0) * smoothstep(0.4, 0.95, length(n.xy));
  col += uRamp[0] * (spec * 1.6 + crescent * 0.55) * (1.0 - dim * 0.6) + ramp(0.8) * under * 0.35;
  return mix(c, mix(col, c, dim * 0.4) * (1.0 - 0.3 * dim), cover);
}

// vapour curling up and breaking apart as it rises: x its body (0 clear .. 1 thick), y its thin
// curling filaments (the body's edge, carried on higher than the body, torn into pieces)
vec2 vapour(vec2 uv, float t) {
  vec2 p = uv * vec2(3.2, 2.4) - vec2(0.0, t * 0.16);
  vec2 warp = vec2(fbm(p + vec2(t * 0.04, 0.0), 3), fbm(p + vec2(5.2, 1.3 - t * 0.03), 3)) - 0.5;
  float v = fbm(p * 1.7 + warp * 2.6, 4);
  float body = cut(v, 0.5 + 0.35 * uv.y, 0.14) * (1.0 - smoothstep(0.35, 0.8, uv.y));
  float thick = 0.015 + 0.05 * noise(p * 1.3 + 9.0);   // filaments swell and thin along their length
  float curl = (1.0 - smoothstep(0.0, thick, abs(v - 0.47))) * cut(noise(p * 2.3 + 4.0), 0.45, 0.25) * (0.5 + 0.5 * cut(v, 0.3, 0.3));
  return vec2(body, curl * smoothstep(0.05, 0.3, uv.y) * (1.0 - smoothstep(0.6, 0.95, uv.y)));
}

vec3 paint(vec2 uv) {
  float t = uTime, s = uStrength;
  vec3 sick = uRamp[2], pale = uRamp[1];
  // murky water, lit sickly green from below
  vec3 c = water(uv);
  c = mix(c, c * vec3(0.75, 1.1, 0.7), 0.7 * s);
  c += sick * (0.12 * pow(1.0 - uv.y, 2.2) + 0.03) * s;
  c *= 0.85 + 0.3 * fbm(uv * 4.0 + vec2(0.0, -t * 0.05), 3);
  // vapour behind, pale where it's thick, dark at its torn edges
  vec2 v = vapour(uv, t) * s;
  c = mix(c, mix(uRamp[3], pale * 0.5, v.x), v.x * 0.5);
  c = mix(c, pale * 0.55, v.y * 0.3);
  // small dim bubbles far behind the jelly
  goo_ = 0.0; gf_ = vec2(0.0); ring_ = 0.0;
  bubbles(uv, t * 0.8, 3.0, 0.0, 10);
  c = shade(c, c, 1.0);
  c += pale * ring_ * 0.15;
  // the goo in front (worked out first: the jelly behind it is seen bent through it)
  goo_ = 0.0; gf_ = vec2(0.0); ring_ = 0.0;
  frontGoo(uv, t);
  vec2 bentBy = goo_ > 0.46 ? -normalize(gf_ + 1e-6) * 0.025 * smoothstep(0.46, 1.0, goo_) : vec2(0.0);
  // the jelly, its light turned sickly and lit green from below
  vec4 p = portrait(uv), j = jelly(uv);
  vec3 green = pale / max(pale.g, 1e-3);
  float lum = dot(p.rgb, vec3(0.3, 0.5, 0.2));
  vec3 jc = mix(p.rgb, min(lum, 2.0) * green * 0.9 * p.a, 0.4 * s);
  float pulse = 0.85 + 0.15 * sin(t * 2.1) * sin(t * 0.7 + 1.0);
  jc += mix(sick, pale, 0.4) * (rim(uv, vec2(0.0, -1.0), 0.025) * 1.6 + rim(uv, vec2(0.8, -0.4), 0.02) * 0.6 + rim(uv, vec2(-0.8, -0.4), 0.02) * 0.6) * pulse * s;
  jc += sick * 0.3 * j.x * smoothstep(0.75, 0.0, uv.y) * pulse * s;   // the glow from below, up the tentacles
  c = c * (1.0 - min(p.a, j.x)) + jc;
  // a few thin wisps drift in front, out at the sides
  vec2 w = vapour(uv + vec2(0.37, 0.21), t * 1.3) * smoothstep(0.2, 0.4, abs(uv.x - 0.5)) * s;
  c = mix(c, pale * 0.7, w.y * 0.45 + w.x * 0.15);
  // what the front goo sees through itself: the water and jelly, bent
  vec2 at = uv + bentBy;
  vec4 pb = portrait(at);
  vec3 behind = goo_ > 0.46 ? water(at) * (1.0 - pb.a) + pb.rgb : c;
  c = shade(c, mix(c, behind, 0.6), 0.0);
  c += pale * ring_ * 0.4;
  return c;
}
`;
