// The lights only the bake has, per act (tools/bake-light.mjs bakes them into the shell with Blender,
// src/baked-light.js shows them). The act's own lamps come from the apartment as played and are baked too,
// in watts (tools/bake-light-page.js lampWatts says the conversion); these are added on top.
// Positions and directions are the game's (x, y, z), metres. A light shines into one set: `lamps` (the
// act's night light) or `day` (act 4's daylight, a second picture faded in by the dawn clock, --dawn-daylight).
//   point / spot: at, watts (spot: to, angle in radians, blend 0-1)
//   area: a soft rectangle at `at` facing `dir`, size [width, height] m, watts (a window's glow from outside)
//   sun: a direction `dir` it shines along, strength (W/m2), soft (degrees across)
// exposure scales the whole picture: each matches its act's shell to its live lamps, act 3 a touch over (tools/light-shots.mjs --shell); samples: Cycles' (256 default).
// Changing anything here means baking again (story engine/baked-light-is-current).
const cityGlow = (set, color, watts) => [
  // the living room's three windows, seen from outside: the city's glow (or the morning sky) coming in
  { kind: 'area', set, at: [1.1, 1.75, -0.35], dir: [0, -0.15, 1], size: [1.7, 1.3], color, watts },
  { kind: 'area', set, at: [2.88, 1.75, -0.35], dir: [0, -0.15, 1], size: [1.45, 1.3], color, watts },
  { kind: 'area', set, at: [-0.35, 1.75, 3.12], dir: [1, -0.15, 0], size: [1.45, 1.3], color, watts },
];

export const BAKE_LIGHTS = {
  1: {
    sets: ['lamps'],
    exposure: 0.2,
    lights: cityGlow('lamps', [0.38, 0.52, 1], 14),                                                              // a stronger cool city glow at the windows
  },
  2: {
    sets: ['lamps'],
    exposure: 0.23,
    lights: [
      ...cityGlow('lamps', [0.42, 0.55, 1], 6),
      { kind: 'point', set: 'lamps', at: [0.83, 2.45, 6.5], color: [0.75, 0.88, 1], watts: 14, radius: 0.05 },   // the bathroom's cool ceiling bulb
      { kind: 'point', set: 'lamps', at: [4.03, 2.3, 5.35], color: [0.75, 0.86, 1], watts: 5, radius: 0.04 },    // a bare bulb in the laundry closet
    ],
  },
  3: {
    sets: ['lamps'],
    exposure: 0.26,
    lights: [
      ...cityGlow('lamps', [0.42, 0.55, 1], 6),
      { kind: 'sun', set: 'lamps', dir: [1, -0.42, 0.12], color: [0.55, 0.72, 1], strength: 2.2, soft: 2.5 },    // the moon, low in the west, through the bedroom's sheer curtains
    ],
  },
  4: {
    sets: ['lamps', 'day'],
    exposure: 0.2,
    lights: [
      ...cityGlow('day', [0.7, 0.82, 1], 70),                                                                      // the morning sky in the windows
      { kind: 'sun', set: 'day', dir: [0.3, -0.32, 1], color: [1, 0.72, 0.45], strength: 4, soft: 1.5 },            // the low sun, in through the window wall
    ],
  },
};
