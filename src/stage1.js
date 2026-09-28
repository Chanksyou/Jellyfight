// Stage 1: Polyp. Bathroom, hallway and the two hall closets, midnight to 2 am.
// All positions are world meters (x, y, z); y is the surface height, measured from the
// apartment model. Surfaces are re-found at runtime with a downward ray, so small
// errors in y are fine.
export const STAGE1 = {
  id: 1,
  name: 'Polyp',
  subtitle: 'Bathroom & hallway',
  rooms: ['Bathroom', 'Hallway', 'Laundry closet', 'Coat closet'],
  start: [1.0, 0.004, 6.8],          // bath mat
  duration: 360,                      // seconds of night before The Dry sets in
  clock: [0, 120],                    // in-game minutes after midnight: 12:00 AM -> 2:00 AM

  // Things the player shouldn't bump into or can pass through
  noCollide: ['Shower curtain'],      // you slip behind the curtain after climbing it
  fade: { 'Shower curtain': 0.5 },    // make it see-through so the camera can look into the tub
  doors: { bath: 'open', laundry: 'open', coat: 'open', bedroom: 'closed', front: 'closed' },
  walls: [
    // where the hallway opens into the living room
    { min: [2.45, 0, 4.83], max: [3.65, 2.7, 4.87] },
    // a safety floor just under the real one: door thresholds have gaps you could fall into
    { min: [0, -0.05, 4.8], max: [4.55, 0, 9.05] },
  ],

  // Updrafts from floor vents: stand on one and it carries you up to `top`
  vents: [
    { name: 'Vanity toe-kick vent', at: [1.3, 0.012, 5.67], radius: 0.045, top: 0.97 },
    { name: 'Hall vent by the sideboard', at: [2.98, 0, 6.95], radius: 0.045, top: 0.9 },
    { name: 'Hall vent by the bench', at: [2.26, 0, 7.4], radius: 0.04, top: 0.56 },
  ],

  // Fabric you can climb: hold Space inside the box
  climbs: [
    { name: 'Drawstring bag', min: [0.2, 0, 7.0], max: [0.42, 0.83, 7.2] },
    { name: 'Shower curtain', min: [0.12, 0, 6.99], max: [1.54, 0.62, 7.27], boss: false },
    { name: 'Chenille duster', min: [3.84, 0, 4.84], max: [4.22, 1.8, 5.2] },
  ],

  // Possible Moon Drop spots. One is active at a time.
  drops: [
    { area: 'Bathroom', at: [1.0, 0.004, 6.8], label: 'bath mat' },
    { area: 'Bathroom', at: [1.25, 0.025, 5.9], label: 'duck rug' },
    { area: 'Bathroom', at: [1.35, 0.88, 5.4], label: 'vanity top' },
    { area: 'Bathroom', at: [0.45, 0.803, 5.22], label: 'toilet tank' },
    { area: 'Bathroom', at: [0.32, 0.803, 6.6], label: 'bathroom shelf' },
    { area: 'Bathroom', at: [0.9, 0.15, 7.55], label: 'in the tub' },
    { area: 'Hallway', at: [2.4, 0, 7.9], label: 'hall runner' },
    { area: 'Hallway', at: [3.0, 0, 5.3], label: 'hall by the closets' },
    { area: 'Hallway', at: [3.32, 0.8, 7.75], label: 'sideboard' },
    { area: 'Hallway', at: [1.98, 0.46, 7.5], label: 'bench' },
    { area: 'Laundry closet', at: [3.8, 0.007, 4.95], label: 'laundry closet floor' },
    { area: 'Laundry closet', at: [3.95, 1.7, 5.45], label: 'top of the dryer' },
    { area: 'Coat closet', at: [2.05, 0.01, 5.6], label: 'under the coats' },
  ],

  // Possible treasure spots; a few are used each run
  treasures: [
    { at: [0.2, 0.004, 5.95] },   // beside the toilet
    { at: [1.45, 0.004, 7.0] },   // bath mat corner
    { at: [1.08, 0.88, 5.45] },   // vanity top by the oil burner
    { at: [1.9, 0.003, 6.85] },   // hall, beside the bench
    { at: [3.32, 0.8, 6.0] },     // sideboard, north end
    { at: [3.72, 0.007, 5.0] },   // laundry closet floor
    { at: [1.95, 0.01, 5.3] },    // coat closet floor
    { at: [2.6, 0, 8.55] },       // hall, far end
  ],
  treasureCount: 5,

  // The boss arena: the bathtub. Moonlight carries you in once all 3 drops are collected.
  boss: {
    name: 'The Clog',
    arenaMin: [0.14, 0.15, 7.22],
    arenaMax: [1.5, 0.6, 7.84],
    playerStart: [1.2, 0.15, 7.53],
    drain: [0.3, 0.15, 7.53],
  },
};
