// Wind's side card (aura="gust"): air you see by what it does. Soft ribbons of air circle the jelly,
// bright at the head and fading at both ends, those on the near side of the jelly crossing in front of
// it and bending the picture behind them (the bell and tentacles shift where a ribbon passes), the far
// ones behind. Fine dust at two depths and three small leaves ride the same spiral, turning over as
// they go. The tentacles stream sideways in the breeze, and a pale mint light rims the jelly from the
// windward side, swelling with each gust. No hard arcs: every edge is soft. kit.js says what paint()
// can call.
export const RAMP = 'aura-gust-ramp';
export const RAMP_FALLBACK = ['#f4fffb', '#c4f0e0', '#6fbfae', '#1f5a5a'];
export const TINT = 'aura-gust-leaves';   // two leaf colours
export const TINT_FALLBACK = ['#9fc46a', '#d1a455'];

export const PAINT = /* glsl */`
#define PI 3.14159265
#define TAU 6.2831853
uniform vec3 uTint[2];

// polar position about the jelly: x angle, y distance (a little squashed so the rings read as seen from above)
vec2 polar(vec2 uv) {
  vec2 p = uv - vec2(0.5, 0.52);
  p.y *= 1.1;
  return vec2(atan(p.y, p.x), length(p));
}

// ribbon i's air at (ang, rr): 0 .. 1, soft at both ends and across. It chases its head round the
// jelly, drifting outward along its tail, and is streaky along its length
float ribbon(float ang, float rr, float t, float i) {
  float sp = 0.7 + 0.5 * hash(vec2(i, 1.0)), len = 1.5 + 1.1 * hash(vec2(i, 2.0));
  float d = mod(i * 2.4 + t * sp * (mod(i, 2.0) < 1.0 ? 1.0 : 0.8) - ang, TAU);   // how far behind its head
  if (d > len) return 0.0;
  float k = d / len;
  float rad = 0.33 + 0.17 * hash(vec2(i, 3.0)) + 0.03 * sin(ang * 2.0 + t * 0.7 + i * 1.7) + 0.06 * k;
  float w = (0.006 + 0.013 * sin(k * PI)) * (0.8 + 0.5 * hash(vec2(i, 4.0)));
  float across = (rr - rad) / w;
  float body = exp(-across * across);
  float fade = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.45, 1.0, k));
  float streak = 0.45 + 1.0 * noise(vec2(d * 9.0 + i * 5.0, across * 0.7 + t * 0.4));
  return body * fade * streak;
}

// all the ribbons seen from one side: how much air (x), and where it pushes the picture (yz)
vec3 air(vec2 uv, float t, float front) {
  vec2 pr = polar(uv);
  float near = smoothstep(0.2, -0.2, sin(pr.x)) ;                    // 1 on the near (lower) half of the ring
  float side = mix(1.0 - near, near, front);
  float a = 0.0;
  for (int i = 0; i < 6; i++) a += ribbon(pr.x, pr.y, t, float(i));
  a *= side * (0.75 + 0.25 * sin(t * 0.9)) * smoothstep(0.0, 0.07, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec2 tangent = vec2(-sin(pr.x), cos(pr.x));
  return vec3(a, tangent * a);
}

// dust: points riding the circle, ang cells round and sc cells deep, near ones bigger and softer
float dust(vec2 uv, float t, float cells, float sc, float size, float soft, float few, float seed) {
  vec2 pr = polar(uv);
  vec2 g = vec2(pr.x / TAU * cells - t * (0.6 + 0.2 * seed) + sin(pr.y * 9.0 + t * 0.5) * 0.3, pr.y * sc + seed * 3.1);
  vec2 id = floor(g), f = fract(g);
  id.x = mod(id.x, cells);   // round the ring the cells join up
  if (hash(id + seed) > few) return 0.0;
  vec2 at = 0.3 + 0.4 * hash2(id + seed + 2.3);
  return 1.0 - smoothstep(size * (1.0 - soft), size, length(f - at));
}

// a leaf's colour (rgb) and coverage (a) at uv, for the leaves on one side
vec4 leaves(vec2 uv, float t, float front) {
  vec4 o = vec4(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i), h = hash(vec2(fi, 7.0));
    float a = t * (0.35 + 0.15 * h) + fi * 2.1, rad = 0.3 + 0.12 * hash(vec2(fi, 8.0)) + 0.03 * sin(t * 0.8 + fi);
    vec2 at = vec2(0.5 + cos(a) * rad, 0.52 + sin(a) * rad / 1.1);
    float near = sin(a) < 0.0 ? 1.0 : 0.0;
    if (near != front) continue;
    float turn = a + PI * 0.5 + t * (1.2 + h) , flip = cos(t * 2.3 + fi * 2.0);
    vec2 q = uv - at;
    q = vec2(cos(turn) * q.x + sin(turn) * q.y, -sin(turn) * q.x + cos(turn) * q.y);   // into the leaf's own frame
    float x = q.x / 0.05, half_ = 0.019 * abs(flip) * pow(max(1.0 - x * x, 0.0), 0.7);
    float cover = (1.0 - smoothstep(half_ - 0.0015, half_ + 0.001, abs(q.y))) * step(abs(x), 1.0);
    if (cover <= 0.0) continue;
    vec3 col = mix(uTint[0], uTint[1], hash(vec2(fi, 9.0))) * (0.45 + 0.55 * abs(flip));   // dark when edge on
    col *= 1.0 - 0.45 * (1.0 - smoothstep(0.0008, 0.0022, abs(q.y)));                   // its midrib
    o = vec4(mix(o.rgb, col, cover), max(o.a, cover));
  }
  return o;
}

vec3 paint(vec2 uv) {
  float t = uTime, s = uStrength;
  vec3 white = uRamp[0], mint = uRamp[1], teal = uRamp[2];
  float gustK = 0.78 + 0.22 * sin(t * 1.3) * sin(t * 0.45 + 1.0);   // the breeze swells and eases
  // cool water with a pale light above
  vec3 c = water(uv);
  c = mix(c, c * vec3(0.9, 1.1, 1.05), 0.6 * s);
  c += teal * 0.05 * smoothstep(0.3, 1.0, uv.y) * s;
  // behind the jelly: far dust, far air, far leaves
  c = mix(c, mix(mint, uTint[1], 0.3) * 0.5, dust(uv, t, 56.0, 20.0, 0.07, 0.6, 0.25, 1.0) * 0.45 * s);
  vec3 back = air(uv, t, 0.0);
  c = mix(c, mix(mint, white, 0.25) * 0.8, min(back.x, 1.0) * 0.6 * gustK * s);
  vec4 lb = leaves(uv, t, 0.0);
  c = mix(c, lb.rgb * 0.7, lb.a * 0.8 * s);
  // the jelly, its tentacles streaming sideways, pushed a little where near air passes over it
  vec3 fa = air(uv, t, 1.0);
  float low = smoothstep(0.58, 0.18, uv.y);
  float stream = low * (0.04 + 0.012 * sin(t * 1.5)) * (0.65 + 0.35 * sin(t * 1.9 - uv.y * 9.0)) * gustK * s;
  vec2 at = uv - vec2(stream, 0.0) + fa.yz * 0.03 * s;
  vec4 p = portrait(at), j = jelly(at);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;
  // the breeze lights the jelly: a mint cast, a rim from the windward side, a soft glint on the bell
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(c, min(lum, 2.0) * mint / max(mint.g, 1e-3) * 0.9, j.x * 0.18 * s);
  float r = rim(at, vec2(-1.0, 0.35), 0.022);
  c += mix(mint, white, 0.4) * r * (0.55 + 0.4 * gustK + 0.1 * sin(t * 3.1)) * s;
  // near air over the jelly: soft, bright, bending the bell as it crosses
  c = mix(c, mix(mint, white, 0.45) * 1.05, min(fa.x, 1.0) * 0.65 * gustK * s);
  // near dust, bigger and softer, and near leaves
  c = mix(c, mix(white, uTint[1], 0.25) * 0.9, dust(uv, t * 1.2, 30.0, 10.0, 0.1, 0.55, 0.14, 4.0) * 0.55 * s);
  vec4 lf = leaves(uv, t, 1.0);
  c = mix(c, lf.rgb, lf.a * s);
  return c;
}
`;
