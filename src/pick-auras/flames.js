// Fire's side card (aura="flames"): the jelly stands in a fire. One turbulent body of flame rolls up
// from the bottom of the card and climbs both sides, its shape torn by noise rising at three scales,
// so tips break off into loose licks and nothing repeats; hot veins and darker pockets churn inside
// it. One layer burns behind the jelly, a lower one in front of the tentacles that hang back. The
// fire lights the jelly hard from below and the sides (its light recoloured warm, a flickering orange
// rim on every edge facing a flame), hot air bends the jelly above it, embers rise with short trails
// and thin dark smoke drifts up behind. kit.js says what paint() can call.
export const RAMP = 'aura-flames-ramp';
export const RAMP_FALLBACK = ['#fff6dc', '#ffc85a', '#ff6a1f', '#8a1a0a'];

export const PAINT = /* glsl */`
// how far the fire climbs at x: low under the jelly, high up both sides
float reach(float x, float tall) { float s = abs(x - 0.5) * 2.0; return tall * (0.13 + 0.62 * pow(s, 2.2)); }

// the fire at uv: x how much flame (> 0 inside, ~1 in its heart), y the fine noise inside it (veins)
vec2 fireAt(vec2 uv, float t, float seed, float tall) {
  // the air rolls: the whole field is pushed about by slow noise rising with it
  vec2 p = uv * vec2(3.0, 1.8) - vec2(0.0, t * 1.1);
  vec2 w = vec2(fbm(p + seed, 3), fbm(p + vec2(5.2, 1.3) + seed, 3)) - 0.5;
  vec2 q = uv + w * vec2(0.09, 0.05) * (0.4 + uv.y);
  // (stretched up and rising fast, so the noise reads as tongues, not blobs)
  float body = fbm(vec2(q.x * 8.0 + seed, q.y * 2.0 - t * 2.3), 4);             // big tongues
  float tear = fbm(vec2(q.x * 24.0 - seed, q.y * 6.0 - t * 4.6), 2);            // torn edges, loose licks
  float h = reach(q.x, tall);
  float f = (1.0 - q.y / h) * 1.05 + (body - 0.5) * 2.1 + (tear - 0.5) * 0.8;
  f *= smoothstep(-0.02, 0.06, uv.y + 0.05);                                    // (rooted below the card)
  float vein = noise(vec2(q.x * 9.0 + seed, q.y * 2.5 - t * 4.3));
  return vec2(f, vein);
}
// a flame's light (rgb, linear) and cover (a): thin deep-red edges, an orange body with hot yellow
// veins and darker pockets, a white heart low down
vec4 fire(vec2 f, float pocket) {
  float k = smoothstep(0.0, 1.9, f.x);
  float a = smoothstep(0.0, 0.045, f.x) * (0.3 + 0.7 * smoothstep(0.0, 0.3, k));   // (thin edges let the dark through)
  k += smoothstep(0.55, 0.95, f.y) * 0.35 * smoothstep(0.08, 0.5, f.x);         // streaks run hotter
  k -= (1.0 - pocket) * 0.45 * smoothstep(0.1, 0.6, f.x);                         // pockets run cooler
  vec3 col = ramp(k) * (0.5 + 1.1 * smoothstep(0.5, 1.0, k));
  return vec4(col, a);
}

vec3 paint(vec2 uv) {
  float t = uTime;
  float side = abs(uv.x - 0.5) * 2.0;
  float flick = 0.75 + 0.5 * noise(vec2(t * 6.0, 3.0)) * noise(vec2(t * 2.3, 8.0) + 1.0);
  // the fire's light where it reaches: strongest low and up the sides, wavering as tongues rise
  float sway = fbm(vec2(uv.x * 2.5, t * 1.7), 2);
  float light = pow(max(1.0 - uv.y * (0.95 - 0.25 * side), 0.0), 1.6) * (0.65 + 0.7 * sway) * flick;
  vec3 warm = uRamp[1] / max(uRamp[1].r, 1e-3);

  // -- behind: dark water warmed by the fire, thin dark smoke drifting up
  vec3 c = water(uv) * 0.7;
  c = mix(c, uRamp[3] * 0.05, 0.55 * uStrength);
  c += uRamp[2] * light * light * 0.22 * uStrength;
  float s = fbm(uv * vec2(3.0, 2.0) - vec2(t * 0.06, t * 0.28), 3);
  float sa = cut(s, 0.48, 0.25) * smoothstep(0.45, 0.95, uv.y) * smoothstep(0.15, 0.6, side);
  c = mix(c, vec3(0.004, 0.002, 0.002), sa * 0.55 * uStrength);
  float pocket = fbm(uv * vec2(14.0, 5.0) - vec2(0.0, t * 3.0), 2);
  vec4 back = fire(fireAt(uv, t, 0.0, 1.0), pocket);
  c = c * (1.0 - back.a * 0.8 * uStrength) + back.rgb * back.a * uStrength;   // (fire is light: it mostly adds)

  // -- the jelly, seen through hot air rising off the flames
  float heat = (1.0 - smoothstep(0.15, 0.9, uv.y)) * uStrength;
  vec2 hv = vec2(noise(uv * vec2(14.0, 6.0) - vec2(0.0, t * 3.0)), noise(uv * vec2(14.0, 6.0) + vec2(7.3, -t * 3.0))) - 0.5;
  vec2 at = bend(uv, hv * vec2(0.022, 0.008) * heat);
  vec4 p = portrait(at);
  vec4 j = jelly(at);
  // (the jelly glows: its light is recoloured toward the fire's rather than tinted, which a glow shrugs off;
  // its teal glow round it too)
  // (the portrait is HDR, several times white: capped, or tone mapping washes the warm light out to white)
  float lum = min(dot(p.rgb, vec3(0.3, 0.5, 0.2)), 1.3);
  vec2 toward = normalize(vec2(sign(uv.x - 0.5), -0.6));                     // the nearest flames: below and out to its side
  float facing = 0.65 + 0.35 * max(0.0, dot(j.zw, toward));
  float lit = clamp(light * facing * 1.6 + 0.3, 0.0, 0.9) * uStrength;
  float hi = max(p.r, max(p.g, p.b)), sat = (hi - min(p.r, min(p.g, p.b))) / max(hi, 1e-3);
  float tinted = mix(0.05, 1.0, smoothstep(0.45, 0.7, sat));
  lit *= tinted;                              // (white eyes and glints stay white, lit only a little)
  vec3 jl = mix(p.rgb, lum * (0.3 + 1.1 * light * facing) * warm, lit);
  jl = mix(jl, lum * 0.45 * warm, (1.0 - max(j.x, smoothstep(0.3, 0.9, p.a))) * 0.85 * uStrength);   // its glow round it, warmed (not its eyes)
  c = c * (1.0 - min(p.a, j.x)) + jl;
  // a hot rim on every edge that faces a flame, flickering with it
  // (only the outline: the kit's rim() also lights whole faces turned toward it, which turns the eyes beige)
  float r = j.x * (1.0 - jelly(at + toward * 0.016).x) * 0.9 + j.x * (1.0 - jelly(at - vec2(0.0, 0.012)).x) * 0.6;
  float face = max(0.0, dot(j.zw, toward));
  r += j.x * face * face * 0.6 * smoothstep(0.45, 0.7, sat);                                           // and the faces turned to the fire (not its eyes)
  c += mix(uRamp[1], uRamp[0], 0.3) * r * (0.6 + 2.4 * light) * uStrength;

  // -- in front: a lower fire lapping over the tentacles that hang back (not those nearer than them)
  float hidden = j.x * (1.0 - smoothstep(0.42, 0.58, j.y));
  vec4 front = fire(fireAt(uv + vec2(0.17, 0.0), t * 1.08, 4.7, 0.6), pocket);
  front.a *= (1.0 - hidden) * 0.9 * uStrength;
  c = c * (1.0 - front.a * 0.8) + front.rgb * front.a;

  // embers rising off it with short trails, three sizes
  for (int k = 0; k < 3; k++) {
    if (float(k) >= uLayers) break;
    float fk = float(k), sc = 7.0 + 5.0 * fk;
    vec2 g = vec2(uv.x * sc, uv.y * sc * 0.5 - t * (0.85 + 0.35 * fk) - fk * 3.1);
    vec2 id = floor(g), f = fract(g);
    float rr = hash(id + fk * 13.7);
    if (rr < 0.8) continue;
    vec2 at2 = vec2(0.25 + 0.5 * hash(id + 3.1) + 0.12 * sin(t * 2.3 + rr * 40.0), 0.3 + 0.5 * hash(id + 5.7));
    vec2 d = (f - at2) * vec2(1.0, 2.0);                       // in cell widths (a cell is twice as tall as wide)
    float tail = clamp(d.y, -0.25, 0.0), dist = length(vec2(d.x, d.y - tail));
    float e = ((1.0 - smoothstep(0.0, 0.06, dist)) + 0.3 * (1.0 - smoothstep(0.0, 0.2, dist))) * (1.0 + tail / 0.25 * 0.9);
    float life = (1.0 - smoothstep(0.35, 0.95, uv.y)) * smoothstep(0.0, 0.08, uv.y) * (0.5 + 0.5 * sin(t * 9.0 + rr * 60.0));
    c += ramp(0.4 + 0.4 * rr) * e * life * uStrength;
  }
  return c;
}
`;
