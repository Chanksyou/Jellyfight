// The Tentacle's side card (aura="sting"): lashes cracking round the jelly in a violet dusk. Each lash
// is a whip: a ribbon trail that is thin and dim at its tail, wider and white at its leading edge, flung
// along a curve from the tentacles out past the bell (some pass behind the jelly, some in front), a
// second thinner ribbon twisting with it. At the end of the swing it snaps: a star flash, a thin ring
// of shock and a few venom drops thrown off that fall with a wet highlight. Each snap lights the
// jelly's edge on the side it came from; a dim violet light on the bell never quite goes out.
// kit.js says what paint() can call.
export const RAMP = 'aura-sting-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#e9d4ff', '#a468ff', '#3b1b7c'];

export const PAINT = /* glsl */`
vec2 bez(vec2 a, vec2 c, vec2 b, float u) { float v = 1.0 - u; return v * v * a + 2.0 * v * u * c + u * u * b; }

// the light of one lash's ribbon from a through c to b, its leading edge at u = head and its tail at
// u = tail along the curve. x: its white core, y: its glow, z: how far along it is here (0 tail .. 1 head)
vec3 ribbon(vec2 uv, vec2 a, vec2 c, vec2 b, float head, float tail, float width, float seed) {
  vec2 lo = min(min(a, c), b) - 0.25, hi = max(max(a, c), b) + 0.25;   // (far from the whole curve: no light, and none of the work)
  if (uv.x < lo.x || uv.y < lo.y || uv.x > hi.x || uv.y > hi.y) return vec3(0.0);
  float span = max(head - tail, 1e-3);
  float best = 9.0, along = 0.0;
  vec2 prev = bez(a, c, b, tail);
  for (int i = 1; i <= 10; i++) {
    float f = float(i) / 10.0;
    vec2 cur = bez(a, c, b, tail + span * f);
    vec2 pa = uv - prev, ba = cur - prev;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    float d = length(pa - ba * h);
    if (d < best) { best = d; along = f - (1.0 - h) / 10.0; }
    prev = cur;
  }
  float w = along;
  float wd = width * pow(w, 0.7) + 1e-4;
  // the ribbon's edge breaks up a little, like cloth in the air
  float d = best * (1.0 + 0.6 * (noise(vec2(w * 26.0 + seed * 9.0, seed)) - 0.5));   // (by how far along, never by how far off: that would ring it)
  float core = 1.0 - smoothstep(wd * 0.35, wd * 1.1, d);
  float glow = exp(-d / (wd * 2.2 + 0.004));   // (a short tail, so nothing is cut off hard)
  return vec3(core, glow * pow(w, 1.2), w);
}

// one lash's light at uv, k: which lash, a: seconds into it (0-1.3 s); tip, snap and away say where its snap
// is, how strong it is now and which way it points
vec3 lash(vec2 uv, float k, float a, out vec2 tip, out float snap, out vec2 away) {
  float side = hash(vec2(k, 1.0)) < 0.5 ? -1.0 : 1.0;
  vec2 A = vec2(0.5 - side * (0.02 + 0.08 * hash(vec2(k, 2.0))), 0.22 + 0.1 * hash(vec2(k, 3.0)));
  vec2 B = vec2(0.5 + side * (0.26 + 0.14 * hash(vec2(k, 4.0))), 0.5 + 0.28 * hash(vec2(k, 5.0)));
  vec2 C = vec2(0.5 + side * (0.52 + 0.1 * hash(vec2(k, 6.0))), 0.12 + 0.22 * hash(vec2(k, 7.0)));
  float swing = 0.32;
  float x = clamp(a / swing, 0.0, 1.0);
  float head = 1.0 - pow(1.0 - x, 2.2);                       // flung out fast, slowing as it snaps
  float tail = max(head - 0.6, smoothstep(0.35, 1.0, a) * 0.98);
  float fade = 1.0 - smoothstep(0.55, 1.15, a);
  tip = bez(A, C, B, head);
  away = normalize(B - vec2(0.5, 0.5));
  snap = exp(-max(a - swing, 0.0) / 0.07) * step(swing, a);
  vec3 r = ribbon(uv, A, C, B, head, tail, 0.015, k);
  vec3 col = ramp(0.35 + 0.65 * r.z * r.z);
  vec3 light = (uRamp[0] * r.x * 2.4 * (0.4 + 0.6 * r.z) + col * r.y * 1.1) * fade;
  // a second ribbon, thinner, twisting round the first
  if (uLayers > 2.0) {
    vec2 C2 = C + vec2(side * 0.05, 0.14) * (0.5 + 0.5 * sin(a * 9.0));
    vec3 r2 = ribbon(uv, A, C2, B + vec2(0.0, 0.03), head * 0.97, tail, 0.008, k + 3.0);
    light += (uRamp[1] * r2.x * 1.2 + uRamp[2] * r2.y * 0.5) * fade * (0.5 + 0.5 * r2.z);
  }
  return light;
}

vec3 paint(vec2 uv) {
  float t = uTime + 0.75,   // (so Reduce effects' one frozen frame is mid-snap)
       s = uStrength;
  vec3 lilac = uRamp[1], violet = uRamp[2], deep = uRamp[3];
  // -- behind: violet dusk, slow haze, a few motes drifting up
  vec3 c = water(uv) * 0.7;
  c = mix(c, c * vec3(1.3, 0.45, 1.7), 0.85 * s);
  float haze = cut(fbm(uv * 2.4 + vec2(t * 0.04, -t * 0.03), 4), 0.4, 0.4);
  c += deep * haze * 0.35 * s;
  c += violet * 0.05 * smoothstep(0.4, 0.0, uv.y) * s;
  vec2 g = vec2(uv.x * 18.0, uv.y * 18.0 - t * 0.5);
  vec2 id = floor(g);
  if (hash(id) < 0.22) c += lilac * 0.25 * (1.0 - smoothstep(0.0, 0.14, length(fract(g) - 0.3 - 0.4 * hash2(id)))) * s;

  // -- the lashes: three at once, each a third of a cycle behind the last; even ones pass behind the jelly
  vec3 behind = vec3(0.0), front = vec3(0.0), flash = vec3(0.0);
  vec2 lit = vec2(0.0);
  float snapSum = 0.0;
  float period = 1.2;
  for (int i = 0; i < 3; i++) {
    float fi = float(i), ph = t / period + fi / 3.0, k = mod(floor(ph) * 3.0 + fi, 96.0), a = fract(ph) * period;
    vec2 tip, away; float snap;
    vec3 L = lash(uv, k, a, tip, snap, away);
    if (mod(fi, 2.0) < 0.5) behind += L; else front += L;
    snapSum += snap;
    lit += away * snap;
    if (snap > 0.01) {
      vec2 d = uv - tip;
      float r = length(d);
      // the snap: a hot flash with a star in it, and a thin ring of shock
      flash += (uRamp[0] * glint(d, 0.07 + 0.05 * snap) * 2.2 + lilac * exp(-r / 0.02) * 0.6) * snap;
      float age = 1.0 - snap;
      float rr = (r - 0.015 - 0.14 * age) / 0.012, ring = exp(-rr * rr) * snap;
      flash += violet * ring * 1.4;
    }
    // venom drops thrown off: they fly out, then fall, shrinking to nothing as the lash's cycle ends
    float aa = a - 0.3;
    if (aa > 0.0) {
      for (int j = 0; j < 6; j++) {
        if (float(j) >= uLayers + 2.0) break;
        float fj = float(j), ang = (hash(vec2(k, fj + 20.0)) - 0.5) * 2.6 + atan(away.y, away.x);
        float sp = 0.18 + 0.2 * hash(vec2(k, fj + 30.0));
        vec2 at = tip + vec2(cos(ang), sin(ang)) * sp * aa + vec2(0.0, -0.9) * aa * aa;
        float rd = (0.008 + 0.008 * hash(vec2(k, fj + 40.0))) * (1.0 - aa / 0.9);
        vec2 q = uv - at;
        float disc = 1.0 - smoothstep(rd * 0.8, rd, length(q));
        float spec = 1.0 - smoothstep(0.0, rd * 0.35, length(q - vec2(-0.3, 0.35) * rd));
        if (disc > 0.0) flash = mix(flash, violet * 0.9 + lilac * 0.4 * spec, disc * 0.9 * step(0.0, rd)) + uRamp[0] * spec * 0.8 * disc;
      }
    }
  }
  c += behind * s;

  // -- the jelly, lit by the snaps
  vec4 p = portrait(uv);
  vec4 j = jelly(uv);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(c, min(lum, 2.0) * (violet / max(violet.b, 1e-3)) * 0.95, j.x * 0.5 * s);   // violet through the whole jelly
  float sn = min(snapSum, 1.5);
  vec2 toward = normalize(lit + vec2(0.0, 1e-3) + vec2(0.0, 0.3));
  c += mix(violet, lilac, 0.5) * rim(uv, vec2(-0.5, 0.8), 0.02) * 1.0 * (0.8 + 0.2 * sin(t * 2.1)) * s;
  c += mix(lilac, uRamp[0], 0.4) * rim(uv, toward, 0.022) * sn * 2.0 * s;
  c += violet * j.x * sn * 0.35 * s;
  c += deep * j.x * smoothstep(0.55, 0.2, uv.y) * 0.5 * s;   // a violet underlight on the tentacles
  // -- in front
  c += (front + flash) * s;
  return c;
}
`;
