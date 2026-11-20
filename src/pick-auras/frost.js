// Ice's side card (aura="frost"): frost growing across the card's glass from its edges, thickest in the
// corners: crystal grains, each growing lines at the ice's own 60° angles, a frosted body that blurs
// what is behind it, feathery tips at the frontier and facets that glint as a light sweeps past. Snow at
// three depths (far small flakes behind the jelly, mid flakes and a few large soft near ones in front),
// cold mist sinking off the bell and pooling at the bottom, and pale blue light on the jelly's edges.
// kit.js says what paint() can call.
export const RAMP = 'aura-frost-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#dcf6ff', '#86d3f4', '#245f92'];

export const PAINT = /* glsl */`
// thin bright lines where noise crosses its middle (a frond's spine)
// (two octaves: one alone has flat patches near its middle that would fill in as slabs)
float ridge(vec2 p) { return 1.0 - abs((noise(p) * 0.6 + noise(p * 2.03 + 5.1) * 0.4) * 2.0 - 1.0); }

// the nearest cell point: xy its offset from p (in cells), zw the cell's id
vec4 nearest(vec2 p) {
  vec2 i = floor(p), f = fract(p), best = vec2(8.0), id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), o = g + 0.15 + 0.7 * hash2(i + g) - f;
    if (dot(o, o) < dot(best, best)) { best = o; id = i + g; }
  }
  return vec4(-best, id);
}
// the two nearest cells' ids (xy nearest, zw next); seam_ is how far p is from the edge between them
float seam_;
vec4 grains(vec2 p) {
  vec2 i = floor(p), f = fract(p), a = vec2(0.0), b = vec2(0.0);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), o = g + 0.15 + 0.7 * hash2(i + g) - f;
    float d = length(o);
    if (d < d1) { d2 = d1; b = a; d1 = d; a = i + g; } else if (d < d2) { d2 = d; b = i + g; }
  }
  seam_ = 0.5 * (d2 - d1);
  return vec4(a, b);
}
// a grain's crystal angle: toward the middle of the card, give or take (grains are 1/4 of the card)
float angle(vec2 id) {
  vec2 in_ = vec2(0.5) - (id + 0.5) / 4.0;
  return atan(in_.y, in_.x) + (hash(id) - 0.5) * 0.9;
}

// crystal lines at scale sc: long thin lines at angle a and at a plus and minus 60 degrees (the ice's
// own angles), bent a little, broken where noise thins them. 0 .. 1 on a line
float lattice(vec2 uv, float sc, float a, float sharp, float seed) {
  vec2 p = uv * sc;
  float v = 0.0;
  for (int k = 0; k < 3; k++) {
    float b = a + float(k) * 1.0472;
    vec2 d = vec2(cos(b), sin(b));
    float along = dot(p, d), across = dot(p, vec2(-d.y, d.x));
    float l = pow(ridge(vec2(along * 0.16, across) + seed + float(k) * 7.3), sharp);
    v = max(v, l * smoothstep(0.25, 0.6, noise(vec2(along * 0.5, across * 0.2) + seed + float(k) * 3.1)));
  }
  return v;
}

// the frost on the glass at uv. x: its body (0 clear .. 1 thick), y: its crystal lines, z: its glint
vec3 frost(vec2 uv, float t) {
  vec2 e = min(uv, 1.0 - uv);                            // how far from the nearest side, each way
  float edge = min(e.x, e.y);
  float corner = 1.0 - smoothstep(0.0, 0.55, length(e));  // 1 in a corner, 0 half the card away
  float grow = 0.93 + 0.07 * sin(t * 0.35);               // it creeps in and draws back, slowly
  float wob = fbm(uv * 2.6 + 3.1, 3) - 0.5;
  float reach = (0.008 + 0.36 * pow(corner, 2.5)) * grow + wob * (0.05 + 0.13 * corner) + (noise(uv * 1.7 + 8.0) - 0.5) * 0.16 * corner;
  float body = cut(reach - edge, 0.0, 0.05 + 0.05 * corner);
  float tips = cut(reach * 1.7 + 0.035 - edge, 0.0, 0.08);   // the big fronds reach furthest
  if (tips <= 0.0) return vec3(0.0);
  float mid = cut(reach * 1.25 + 0.015 - edge, 0.0, 0.06);
  // crystal grains, each growing its lines at its own angle (mostly in toward the middle of the card);
  // where two grains meet their lines cross-fade over a short seam
  vec2 w = uv + (vec2(noise(uv * 6.0), noise(uv * 6.0 + 5.2)) - 0.5) * 0.06;
  vec4 g1 = grains(w * 4.0);
  float a = angle(g1.xy), big = lattice(w, 9.0, a, 10.0, hash(g1.xy) * 30.0);
  big = mix(lattice(w, 9.0, angle(g1.zw), 10.0, hash(g1.zw) * 30.0), big, 0.5 + 0.5 * smoothstep(0.0, 0.12, seam_));
  float med = lattice(w, 21.0, a + 0.5, 12.0, 11.0);
  float fine = lattice(w, 46.0, a + 0.2, 8.0, 23.0);
  float lines = max(big * tips, max(med * 0.75 * mid, fine * 0.5 * body));
  // facets catch a light sweeping slowly across the card
  vec4 f = nearest(uv * 30.0);
  float face = hash(f.zw), sweep = t * 0.8 - uv.x * 3.0 + uv.y * 2.0;
  float catchLight = pow(max(0.0, cos(face * 6.2832 - sweep)), 12.0) * step(0.5, face);
  float g = catchLight * glint(f.xy, 0.45) * max(body * 0.6, lines);
  return vec3(body, lines, g);
}

// a layer of snowflakes: how much flake is at uv. sc: flakes across the card, sz: their size in cells,
// soft: their edge (near flakes are big and out of focus)
float snow(vec2 uv, float t, float sc, float fall, float sz, float soft, float seed, float few) {
  vec2 g = vec2(uv.x * sc + sin(t * 0.6 + uv.y * 4.0 + seed) * 0.35, uv.y * sc + t * fall + seed * 3.7);
  vec2 id = floor(g), f = fract(g);
  if (hash(id + seed) > few) return 0.0;
  vec2 at = 0.3 + 0.4 * hash2(id + seed + 2.3);
  float d = length(f - at);
  return 1.0 - smoothstep(sz * (1.0 - soft), sz, d);
}

vec3 paint(vec2 uv) {
  float t = uTime, s = uStrength;
  vec3 cold = uRamp[2], pale = uRamp[1];
  // cold water: a pale light from above
  vec3 c = water(uv);
  c = mix(c, c * vec3(0.75, 0.95, 1.2), 0.6 * s);
  c += cold * 0.05 * smoothstep(0.3, 1.0, uv.y) * s;
  // far snow, small and dim, behind the jelly
  c = mix(c, pale * 0.55, snow(uv, t, 26.0, 0.9, 0.12, 0.5, 1.0, 0.35) * 0.55 * s);
  // the frost, seen first so the jelly behind it can be blurred by it
  vec3 fr = frost(uv, t) * s;
  // the jelly, seen through frosted glass where frost covers it (bent and softened)
  vec2 at = bend(uv, (vec2(noise(uv * 60.0), noise(uv * 60.0 + 9.0)) - 0.5) * 0.02 * fr.x);
  vec4 p = portrait(at);
  vec4 j = jelly(at);
  c = c * (1.0 - min(p.a, j.x)) + p.rgb;
  // the cold lights the jelly: its light turns toward ice, a pale rim from above left, a glint on the bell
  vec3 icy = pale / max(pale.b, 1e-3);
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(c, min(lum, 2.0) * icy * 0.85, j.x * 0.25 * s);
  float r = rim(at, vec2(-0.6, 0.8), 0.02);
  c += mix(cold, pale, 0.6) * r * (0.75 + 0.15 * sin(t * 1.3)) * s;
  float spec = pow(max(0.0, dot(normalize(j.zw + 1e-4), normalize(vec2(-0.5, 0.85)))), 10.0) * j.x * step(0.45, uv.y);
  c += pale * spec * 0.35 * s;
  // mist sinking off the bell: wisps from under its rim, spreading and thinning as they fall
  float fall = clamp((0.5 - uv.y) / 0.32, 0.0, 1.0);
  float wide = 1.0 - smoothstep(0.16 + 0.14 * fall, 0.24 + 0.22 * fall, abs(uv.x - 0.5));
  float m = fbm(uv * vec2(6.0, 3.0) + vec2(sin(t * 0.3) * 0.3, t * 0.4), 4);
  float mist = cut(m, 0.5, 0.25) * wide * smoothstep(0.0, 0.15, fall) * (1.0 - fall);
  // and pooling low across the bottom of the card
  float pool = cut(fbm(uv * vec2(3.0, 6.0) + vec2(t * 0.12, 0.0), 4) - uv.y * 2.4, 0.05, 0.35);
  c = mix(c, pale * 0.95, (mist * 0.35 + pool * 0.3) * s);
  // mid snow, crisp and small, in front
  c = mix(c, pale * 1.1, snow(uv, t * 1.1, 14.0, 1.2, 0.09, 0.35, 5.0, 0.3) * 0.8 * s);
  // the frost on the glass: a frosted body that blurs and pales what's behind, crystal lines, glints
  float grainy = 0.75 + 0.5 * fbm(uv * 48.0, 3);
  c = mix(c, mix(cold, pale, 0.7) * 0.8, fr.x * 0.32 * grainy);
  c = mix(c, mix(pale, uRamp[0], 0.5) * 1.15, min(fr.y, 1.0) * 0.9);
  c += uRamp[0] * fr.z * 4.0;
  // a few big soft near flakes, out of focus, drifting across the front
  c = mix(c, pale * 0.9, snow(uv, t * 0.8, 4.0, 0.25, 0.22, 0.85, 9.0, 0.3) * 0.24 * s);
  return c;
}
`;
