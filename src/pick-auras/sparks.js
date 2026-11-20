// Lightning's side card (aura="sparks"): a dark storm, then a strike. A thin branching bolt cracks
// down from the top onto the jelly's shoulder, tapering to nothing at its forks, a white core in a
// yellow glow; it flickers through two or three return strokes, flashes the whole bell and leaves a
// fading violet afterimage of its channel. Far bolts light the clouds behind the jelly, a faint
// corona crawls round its edge, small arcs jump between its tentacle tips, and sparks fall from where
// the strike lands. Dark between strikes, so each one lands.
export const RAMP = 'aura-sparks-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#fff3a6', '#ffd23c', '#5a46c8'];

export const PAINT = /* glsl */`
#define PI 3.14159265
// straight segments between fixed random points: the jagged steps of a bolt, -0.5..0.5
float jag(float x, float seed) {
  float i = floor(x);
  return mix(hash(vec2(i, seed)), hash(vec2(i + 1.0, seed)), fract(x)) - 0.5;
}
// a bolt's sideways wander at s along it (0-1): steps at four scales, each half as wide; the finest
// one changes with every return stroke (fine) so the channel crackles without moving
float wander(float s, float seed, float fine) {
  return jag(s * 4.0, seed) * 0.55 + jag(s * 9.0, seed + 1.3) * 0.28 + jag(s * 21.0, seed + fine) * 0.13 + jag(s * 46.0, seed + fine + 2.1) * 0.06;
}
// the light of one bolt from a to b at uv: x its white core, y its glow. amp: how far it wanders
// (times its length); w: its core's half width at a, tapering to taper * w at b; pinned: 1 if b is
// fixed too (a strike's end), 0 if it wanders off free (a fork)
vec2 bolt(vec2 uv, vec2 a, vec2 b, float seed, float fine, float amp, float w, float taper, float pinned) {
  vec2 ab = b - a;
  float L = length(ab);
  vec2 dir = ab / L, nrm = vec2(-dir.y, dir.x), q = uv - a;
  float s = dot(q, dir) / L, n = dot(q, nrm);
  float reach = amp * L * 0.6 + 0.12;
  if (s < -0.1 || s > 1.1 || abs(n) > reach) return vec2(0.0);   // far off it: no light
  float sc = clamp(s, 0.0, 1.0);
  float env = mix(smoothstep(0.0, 0.12, sc), sin(sc * PI), pinned) * amp * L;
  float off = wander(sc, seed, fine) * env, off2 = wander(sc + 0.004, seed, fine) * env;
  float slope = (off2 - off) / (0.004 * L);
  float d = abs(n - off) / sqrt(1.0 + slope * slope) + (max(0.0, -s) + max(0.0, s - 1.0)) * L;
  float wd = max(w * mix(1.0, taper, pow(sc, 0.8)), 1e-4);
  float core = 1.0 - smoothstep(wd * 0.5, wd * 1.4, d);
  float g = wd * 4.0 + 0.006;
  float glow = g / (d + g);
  float fade = (1.0 - smoothstep(0.7, 1.0, abs(n) / reach)) * (1.0 - smoothstep(1.02, 1.1, s)) * smoothstep(-0.1, -0.02, s);   // (no hard edge where the light is cut off)
  return vec2(core, glow * glow * (1.0 - sc * (1.0 - taper) * 0.5) * fade);
}
// a point along a bolt (where a fork leaves it)
vec2 along(vec2 a, vec2 b, float s, float seed, float fine, float amp, float pinned) {
  vec2 ab = b - a, nrm = vec2(-ab.y, ab.x);
  float env = mix(smoothstep(0.0, 0.12, s), sin(s * PI), pinned) * amp;
  return a + ab * s + nrm * wander(s, seed, fine) * env;
}
vec2 turn(vec2 v, float r) { float c = cos(r), sn = sin(r); return vec2(c * v.x - sn * v.y, sn * v.x + c * v.y); }

// a strike every period or so: its seed and how long since it began (s)
vec2 strike(float t, float period) {
  float k = floor(t / period), start = k * period + hash(vec2(k, 7.0)) * period * 0.35;
  if (t < start) { k -= 1.0; start = k * period + hash(vec2(k, 7.0)) * period * 0.35; }
  return vec2(k, t - start);
}
// how bright its channel is l seconds in: two or three return strokes, each a sharp flash
float strokes(float l, float k) {
  float p = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i), at = fi * (0.06 + 0.05 * hash(vec2(k, fi + 3.0)));
    if (fi == 2.0 && hash(vec2(k, 11.0)) < 0.4) break;
    float dt = l - at;
    if (dt >= 0.0) p = max(p, (1.0 - 0.3 * fi) * exp(-dt / 0.035));
  }
  return p;
}

vec3 paint(vec2 uv) {
  float t = uTime + 0.26;   // (so Reduce effects' one frozen frame, at 1.34 s on this card, is mid-strike)
  vec3 hot = uRamp[1] / max(max(uRamp[1].r, uRamp[1].g), 1e-3);   // the bolt's yellow, at full brightness
  // -- the strike: from the top of the card down onto the bell's shoulder
  vec2 st = strike(t, 1.35);
  float k = st.x, l = st.y, flash = strokes(l, k) * uStrength;
  float fine = floor(min(l, 0.2) / 0.06);                      // a new fine crackle each return stroke
  float side = hash(vec2(k, 1.0)) < 0.5 ? -1.0 : 1.0;
  float ang = side * (0.5 + 0.55 * hash(vec2(k, 2.0)));
  vec2 hit = vec2(0.49, 0.6) + vec2(sin(ang) * 0.205, cos(ang) * 0.19);   // on the bell's shoulder
  vec2 top = vec2(clamp(hit.x + side * (0.22 + 0.2 * hash(vec2(k, 4.0))), 0.03, 0.97), 1.04);
  float after = smoothstep(0.08, 0.2, l) * exp(-max(l - 0.2, 0.0) / 0.3);   // the channel's afterimage

  // -- behind: the storm. Dark water, clouds moving slowly overhead, lit from inside by far bolts
  vec3 c = water(uv) * 0.75;
  float cl = fbm(uv * vec2(2.6, 1.8) + vec2(t * 0.03, -t * 0.01), 4);
  float cloud = cut(cl, 0.42, 0.35) * smoothstep(0.25, 0.85, uv.y);
  vec2 far = strike(t + 0.8, 1.9);
  float farFlash = strokes(far.y, far.x + 50.0) * uStrength;
  vec2 farAt = vec2(0.3 + 0.4 * hash(vec2(far.x, 21.0)), 0.8);
  float near = 1.0 - smoothstep(0.0, 0.55, length((uv - farAt) * vec2(1.0, 1.4)));
  c += uRamp[3] * cloud * 0.07;                                 // a faint violet in the clouds, always
  c += mix(uRamp[3], uRamp[2], 0.35) * cloud * (farFlash * near * 1.4 + flash * 0.6);
  c += mix(uRamp[3], uRamp[0], 0.5) * flash * 0.05;            // the whole card lights for a moment
  // a far bolt, thin and dim, inside the clouds and behind the jelly
  if (farFlash > 0.01) {
    vec2 fb = bolt(uv, farAt + vec2(0.0, 0.25), farAt + vec2(0.15 * (hash(vec2(far.x, 22.0)) - 0.5), -0.5), far.x + 30.0, 0.0, 0.3, 0.003, 0.15, 0.0);
    c += (uRamp[0] * fb.x * 2.5 + mix(uRamp[3], uRamp[2], 0.4) * fb.y * 1.1) * farFlash;
  }

  // -- the jelly, lit by the strike
  vec4 p = portrait(uv);
  vec4 j = jelly(uv);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb * (1.0 + flash * 0.6);
  // the flash: its light recoloured toward the bolt's (white-yellow), strongest on the side it lands
  vec2 toward = normalize(top - vec2(0.5, 0.55));
  float facing = j.x * (0.55 + 0.45 * max(0.0, dot(j.zw, toward)));
  c = mix(c, min(dot(c, vec3(0.3, 0.5, 0.2)), 2.0) * 0.9 * mix(hot, vec3(1.0), 0.5), min(facing * flash * 1.1, 0.85));
  c += hot * facing * flash * 1.6;
  // charged: a faint yellow light on its top edge that never quite goes out, flickering
  float hum = 0.6 + 0.4 * noise(vec2(t * 11.0, 4.0));
  c += hot * rim(uv, vec2(0.0, 1.0), 0.025) * 0.8 * hum * uStrength;
  c += hot * rim(uv, toward, 0.02) * (flash * 2.5 + after * 0.3);
  // the corona: a thin glow hugging the bell's edge, bright patches crawling along it
  float e1 = 0.0, e2 = 0.0;
  if (uv.y > 0.42 && j.x < 0.99) for (int i = 0; i < 6; i++) {
    vec2 o = vec2(cos(float(i) * PI / 3.0), sin(float(i) * PI / 3.0));
    e1 = max(e1, jelly(uv + o * 0.008).x); e2 = max(e2, jelly(uv + o * 0.02).x);
  }
  float edge = (e1 * 0.7 + e2 * 0.3) * (1.0 - j.x) * smoothstep(0.42, 0.5, uv.y);   // only the water just outside the bell
  if (edge > 0.01) {
    float crawl = cut(noise(uv * 14.0 + vec2(t * 2.3, -t * 3.1)) * 0.6 + noise(uv * 31.0 - vec2(t * 4.0, t * 1.7)) * 0.4, 0.58, 0.12);
    c += mix(uRamp[0], hot, 0.6) * edge * (0.06 + crawl * 1.5) * (1.0 + 2.0 * flash + 0.4 * after) * uStrength;
  }

  // -- in front: the strike itself and its forks
  vec3 light = vec3(0.0);
  if (flash + after > 0.03) {
    vec2 m = bolt(uv, top, hit, k, fine, 0.2, 0.0055, 0.5, 1.0);
    vec2 cg = m;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      if (fi >= uLayers) break;
      float s0 = 0.15 + 0.22 * fi + 0.08 * hash(vec2(k, fi + 40.0));
      vec2 from = along(top, hit, s0, k, fine, 0.22, 1.0);
      vec2 dir = turn(normalize(hit - top), (hash(vec2(k, fi + 50.0)) < 0.5 ? -1.0 : 1.0) * (0.35 + 0.5 * hash(vec2(k, fi + 60.0))));
      float len = (0.18 + 0.2 * hash(vec2(k, fi + 70.0))) * (1.0 - 0.3 * fi);
      vec2 to = from + dir * len;
      vec2 f = bolt(uv, from, to, k + fi * 9.1, fine, 0.3, 0.0034, 0.0, 0.0);
      cg = max(cg, f * vec2(0.85, 0.8));
      // and a fork off the fork
      vec2 from2 = along(from, to, 0.45, k + fi * 9.1, fine, 0.3, 0.0);
      vec2 f2 = bolt(uv, from2, from2 + turn(dir, hash(vec2(k, fi + 80.0)) - 0.5) * len * 0.5, k + fi * 5.3, fine, 0.35, 0.0016, 0.0, 0.0);
      cg = max(cg, f2 * vec2(0.7, 0.6));
    }
    light += (uRamp[0] * cg.x * 5.0 + mix(hot, uRamp[2], 0.5) * cg.y * 1.8) * flash;
    light += uRamp[3] * cg.y * after * 0.45 + uRamp[2] * cg.x * after * 0.3;   // the afterimage: the channel fading violet
    // where it lands: a hot spot on the bell's shoulder
    float spot = 0.012 / (length(uv - hit) + 0.012);
    light += hot * spot * spot * (flash * 1.6 + after * 0.15);
  }
  // sparks falling from where it landed
  for (int i = 0; i < 6; i++) {
    float fi = float(i), age = l - 0.02;
    if (age < 0.0 || age > 0.7) break;
    vec2 v = vec2((hash(vec2(k, fi + 90.0)) - 0.5) * 0.5 + side * 0.2, 0.1 + 0.35 * hash(vec2(k, fi + 91.0)));
    vec2 at = hit + v * age + vec2(0.0, -0.9) * age * age;
    vec2 back = hit + v * max(age - 0.03, 0.0) + vec2(0.0, -0.9) * max(age - 0.03, 0.0) * max(age - 0.03, 0.0);
    vec2 pa = uv - back, ba = at - back;
    float d = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
    light += (mix(uRamp[0], uRamp[1], 0.5) * (1.0 - smoothstep(0.0, 0.003, d)) * 1.8 + hot * 0.15 * 0.006 / (d + 0.006)) * (1.0 - age / 0.7);
  }
  // small arcs jumping between the tentacle tips now and then
  vec2 tip = strike(t + 0.3, 0.45);
  if (tip.y < 0.12 && hash(vec2(tip.x, 5.0)) > 0.35) {
    float x0 = 0.32 + 0.3 * hash(vec2(tip.x, 6.0)), x1 = x0 + 0.08 + 0.12 * hash(vec2(tip.x, 8.0));
    float y0 = 0.07 + 0.06 * hash(vec2(tip.x, 9.0)), y1 = 0.07 + 0.06 * hash(vec2(tip.x, 10.0));
    vec2 a = bolt(uv, vec2(x0, y0), vec2(x1, y1), tip.x + 70.0, floor(tip.y / 0.04), 0.5, 0.002, 0.6, 1.0);
    float on = 1.0 - smoothstep(0.06, 0.12, tip.y);
    light += (uRamp[0] * a.x * 3.0 + uRamp[2] * a.y * 0.6) * on;
  }
  return c + light * uStrength;
}
`;
