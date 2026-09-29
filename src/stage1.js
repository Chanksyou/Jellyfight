// Stage 1: Polyp. The living room and its kitchen strip, midnight to 2 am.
// All positions are world meters (x, y, z); y is the surface height, measured from the
// apartment model. Surfaces are re-found at runtime with a downward ray, so small
// errors in y are fine.
//
// Rough layout (x runs from the desk wall to the kitchen, z from the window to the TV wall):
//   sofa x 0.5-2.9, z 1.0-2.6 (seat 0.51)   coffee table x 1.5-2.8, z 2.45-3.15 (top 0.46)
//   lounge chair x 2.9-3.5, z 1.1-1.9 (0.43) standing desk x 0.1-0.8, z 2.5-3.8 (0.78)
//   media console x 0.9-2.4, z 4.35-4.8 (0.6) kitchen counters x 4.35-5.0 (0.94, under cabinets)
export const STAGE1 = {
  id: 1,
  name: 'Polyp',
  subtitle: 'Living room',
  rooms: ['Living room'],
  start: [3.2, 0, 3.0],               // open floor between the coffee table and the kitchen
  duration: 120,                      // seconds until the boss comes, Moon Drops or not
  clock: [0, 120],                    // in-game minutes after midnight: 12:00 AM -> 2:00 AM

  noCollide: [],
  fade: {},
  doors: { bath: 'closed', laundry: 'closed', coat: 'closed', bedroom: 'closed', front: 'closed' },
  walls: [
    // where the living room opens into the hallway
    { min: [2.45, 0, 4.83], max: [3.65, 2.7, 4.87] },
    // a safety floor just under the real one
    { min: [0, -0.05, 0], max: [5.0, 0, 4.9] },
  ],

  // Floor vents: step on one and the air blows you up in an arc that lands on `land`
  vents: [
    { name: 'Vent by the sofa', at: [1.0, 0, 2.6], radius: 0.045, land: [1.35, 0.511, 2.15], to: 'the sofa' },
    { name: 'Vent by the coffee table', at: [3.0, 0, 2.8], radius: 0.045, land: [2.6, 0.46, 3.0], to: 'the coffee table' },
    { name: 'Vent by the TV', at: [1.0, 0, 4.05], radius: 0.045, land: [1.0, 0.603, 4.45], to: 'the media console' },
    { name: 'Vent by the desk', at: [1.2, 0, 2.95], radius: 0.04, land: [0.6, 0.775, 3.2], to: 'the desk' },
    { name: 'Vent by the lounge chair', at: [3.2, 0, 2.3], radius: 0.045, land: [3.2, 0.435, 1.5], to: 'the lounge chair' },
  ],

  // Fabric you can climb: hold jump inside the box
  climbs: [
    { name: 'Corduroy sofa', min: [0.8, 0, 2.28], max: [2.4, 0.5, 2.45] },   // the front of the seat
  ],

  // Possible Moon Drop spots. One is active at a time; each of the first three gives a
  // treasure, the fourth summons the boss. At the start of each run the game keeps only
  // spots that are open: nothing overhead, nothing crowding them, flat ground (Run.openSpot).
  drops: [
    { area: 'Floor', at: [3.2, 0, 3.0], label: 'middle of the room' },
    { area: 'Floor', at: [3.4, 0, 2.2], label: 'by the lounge chair' },
    { area: 'Floor', at: [1.15, 0, 3.5], label: 'by the desk' },
    { area: 'Floor', at: [1.6, 0.015, 0.5], label: 'by the window' },
    { area: 'Kitchen', at: [4.15, 0.013, 2.6], label: 'on the kitchen mat' },
    { area: 'Kitchen', at: [3.8, 0, 3.5], label: 'kitchen floor' },
    { area: 'Floor', at: [2.2, 0.01, 3.45], label: 'by the play gym' },
    { area: 'Floor', at: [3.3, 0, 4.2], label: 'by the cat scratcher' },
    { area: 'Sofa', at: [1.6, 0.508, 2.18], label: 'sofa seat' },
    { area: 'Sofa', at: [2.4, 0.508, 1.95], label: 'sofa, by the blue pillow' },
    { area: 'Furniture', at: [3.2, 0.435, 1.5], label: 'lounge chair' },
    { area: 'Furniture', at: [0.6, 0.775, 3.2], label: 'standing desk' },
    { area: 'Furniture', at: [2.6, 0.46, 3.0], label: 'coffee table' },
    { area: 'Furniture', at: [1.0, 0.603, 4.45], label: 'media console' },
  ],

  // The boss: a crowned dust king that rises from a dust pile on the open floor. While it's
  // up, low invisible walls (`walls`) keep the fight in front of the kitchen.
  boss: {
    name: 'The Dust King',
    kind: 'dust',                     // see boss.js
    intro: 'The Dust King rises from the dust pile!',
    arenaMin: [2.9, 0, 2.0],
    arenaMax: [4.3, 0.6, 4.3],
    playerStart: [3.1, 0, 3.9],
    drain: [3.6, 0, 3.1],             // the dust pile it rises from and inhales toward
    walls: [
      { min: [2.85, 0, 1.95], max: [2.9, 0.6, 4.35] },
      { min: [4.3, 0, 1.95], max: [4.35, 0.6, 4.35] },
      { min: [2.85, 0, 1.95], max: [4.35, 0.6, 2.0] },
      { min: [2.85, 0, 4.3], max: [4.35, 0.6, 4.35] },
    ],
  },
};
