// The Summoner's side card (aura="signal"): rings of light pinging out from the jelly like sonar, each one
// thin and bright at its front and fading as it widens, a few little glowing jellies bobbing in the water
// round it (its little jellies), and a cool rim on the jelly's upper edge. kit.js says what paint() can call.
export const RAMP = 'aura-signal-ramp';
export const RAMP_FALLBACK = ['#ffffff', '#c8f4ff', '#7fe0ff', '#5a3fb0'];

export const PAINT = /* glsl */`
// the pings: rings leaving the jelly's middle every few seconds, each a thin bright front that fades as it widens
float pings(vec2 uv, float t) {
  vec2 d = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.25);
  float L = length(d), v = 0.0;
  for (int i = 0; i < 3; i++) {
    float age = fract(t * 0.45 + float(i) / 3.0), r = 0.12 + age * 0.55;
    float front = 1.0 - smoothstep(0.0, 0.012 + age * 0.02, abs(L - r));
    float wob = 0.85 + 0.15 * noise(vec2(atan(d.y, d.x) * 3.0, t * 0.6 + float(i)));
    v += front * (1.0 - age) * (1.0 - age) * wob;
  }
  return v;
}
// a little jelly: a soft glowing dome bobbing at c, its rim brighter
float little(vec2 uv, vec2 c, float r) {
  vec2 d = (uv - c) / r;
  d.y = d.y > 0.0 ? d.y : d.y * 1.8;   // a flatter underside
  float L = length(d);
  return (1.0 - smoothstep(0.75, 1.0, L)) * (0.45 + 0.55 * smoothstep(0.4, 0.95, L));
}

vec3 paint(vec2 uv) {
  float t = uTime, s = uStrength;
  vec3 hot = uRamp[0], pale = uRamp[1], cyan = uRamp[2], deep = uRamp[3];
  vec3 c = water(uv);
  c += deep * 0.12 * fbm(uv * 3.0 + vec2(0.0, -t * 0.05), 3) * s;   // a violet haze in the deep water
  // the little jellies, behind the jelly, bobbing on their own beats
  float lj = 0.0;
  lj += little(uv, vec2(0.2, 0.3 + 0.015 * sin(t * 1.7)), 0.06);
  lj += little(uv, vec2(0.82, 0.36 + 0.015 * sin(t * 1.3 + 2.0)), 0.05);
  if (uLayers >= 3.0) lj += little(uv, vec2(0.7, 0.18 + 0.012 * sin(t * 2.1 + 4.0)), 0.04);
  c += mix(deep, cyan, 0.6) * lj * 0.9 * s;
  float p = pings(uv, t);
  c += mix(cyan, pale, 0.4) * p * 0.8 * s;
  vec4 pr = portrait(uv);
  vec4 j = jelly(uv);
  c = c * (1.0 - min(pr.a, j.x)) + pr.rgb;
  c += cyan * p * 0.25 * j.x * s;                           // the pings cross the jelly too, softer
  float r = rim(uv, vec2(0.0, 1.0), 0.02);
  c += mix(cyan, hot, 0.3) * r * (0.5 + 0.2 * sin(t * 2.2)) * s;
  return c;
}
`;
