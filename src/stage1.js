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
  duration: 120,                      // seconds until the boss comes, Moon Drops or not
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

  // Floor vents: step on one and the air blows you up in an arc that lands on `land`
  vents: [
    { name: 'Vanity toe-kick vent', at: [1.3, 0.012, 5.67], radius: 0.045, land: [1.5, 0.881, 5.52], to: 'the vanity' },   // beside the sink, not in it
    { name: 'Hall vent by the sideboard', at: [2.98, 0, 6.95], radius: 0.045, land: [3.27, 0.8, 6.8], to: 'the sideboard' },
    { name: 'Hall vent by the bench', at: [2.26, 0, 7.4], radius: 0.04, land: [2.08, 0.46, 7.39], to: 'the bench' },
  ],

  // Fabric you can climb: hold Space inside the box
  climbs: [
    { name: 'Drawstring bag', min: [0.2, 0, 7.0], max: [0.42, 0.83, 7.2] },
    { name: 'Shower curtain', min: [0.12, 0, 6.99], max: [0.8, 0.62, 7.27], boss: false },   // the open bathroom door covers the rest of the tub
    { name: 'Chenille duster', min: [3.84, 0, 4.84], max: [4.22, 1.8, 5.2] },
  ],

  // Possible Moon Drop spots. One is active at a time; each of the first three gives a
  // treasure, the fourth summons the boss. At the start of each run the game
  // keeps only spots that are open: nothing overhead, nothing crowding them, flat ground
  // (see Run.openSpot), so a drop is never tucked under or between things.
  drops: [
    { area: 'Bathroom', at: [1.0, 0.004, 6.8], label: 'bath mat' },
    { area: 'Bathroom', at: [1.25, 0.025, 5.95], label: 'duck rug' },
    { area: 'Bathroom', at: [0.75, 0.004, 6.35], label: 'bathroom floor' },
    { area: 'Bathroom', at: [1.5, 0.88, 5.52], label: 'vanity top' },
    { area: 'Bathroom', at: [1.29, 0.705, 5.37], label: 'in the sink' },
    { area: 'Bathroom', at: [0.5, 0.49, 5.58], label: 'toilet lid' },
    { area: 'Hallway', at: [2.4, 0, 7.9], label: 'hall runner' },
    { area: 'Hallway', at: [2.75, 0, 6.6], label: 'middle of the hall' },
    { area: 'Hallway', at: [3.0, 0, 5.35], label: 'hall by the closets' },
    { area: 'Hallway', at: [2.9, 0, 8.4], label: 'end of the hall' },
    { area: 'Hallway', at: [3.27, 0.8, 6.4], label: 'sideboard' },
    { area: 'Hallway', at: [3.27, 0.8, 7.05], label: 'sideboard, by the carved bear' },
    { area: 'Hallway', at: [1.97, 0.46, 7.38], label: 'bench' },
    { area: 'Hallway', at: [3.39, 0.696, 5.92], label: 'recycling bin lid' },
    { area: 'Laundry closet', at: [3.95, 1.7, 5.45], label: 'top of the dryer' },
  ],


  // The boss arena: the bathtub. Moonlight carries you in once all 3 drops are collected.
  boss: {
    name: 'The Clog',
    arenaMin: [0.14, 0.15, 7.22],
    arenaMax: [1.5, 0.6, 7.84],
    playerStart: [1.2, 0.15, 7.53],
    drain: [0.3, 0.15, 7.53],
  },
};
