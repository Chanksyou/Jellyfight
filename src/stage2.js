// Stage 2: Ephyra. The hallway and the bathroom, 2 am to 4 am. Reached by beating stage 1's boss
// (the run carries on: your level, stats and treasures come with you).
// All positions are world meters (x, y, z); y is the surface height, measured from the
// apartment model. Surfaces are re-found at runtime with a downward ray, so small
// errors in y are fine.
//
// Rough layout (x runs west to east, z from the living room toward the bedroom):
//   hallway x 1.76-3.59, z 4.85-9.0 (its west wall steps in to x 2.52 by the coat closet, z < 6.03)
//   bathroom x 0.06-1.6, z 5.08-7.9: vanity and sink at the north end (z 5.3-5.7), the toilet
//     by the west wall (x 0.5, z 5.6), the tub along the south wall (z 7.22-7.84)
//   laundry closet x 3.59-4.48, z 4.89-5.81 (off the hall's east wall), coat closet x 1.6-2.52,
//     z 4.85-6.03 (off its west wall): both doors left ajar to peek in, but walled off
//   sideboard on the hall's east wall (x 3.27, z 6.3-7.1, top 0.8), bench on its west (x 2.08, z 7.4)
import { HALL_CLOCK } from './stage1.js';

export const STAGE2 = {
  id: 2,
  name: 'Ephyra',
  subtitle: 'Hallway & bathroom',
  rooms: ['Hallway', 'Bathroom'],
  parts: ['act1', 'act2'],           // apartment files to load (apartment.js): act 2 adds the bathroom and closets
  evolve: 'Your ephyra grows into a young <b>Medusa</b>.',   // the metamorphosis after the Clog
  start: [2.75, 0, 6.6],             // the middle of the hall
  duration: 260,                      // seconds until the boss comes (4:20)
  clock: [120, 240],                  // in-game minutes after midnight: 2:00 AM -> 4:00 AM
  details: 'bathroom',                // the tub dressed after the real one (bathroom.js)
  // you arrive levelled up with act 1's treasures, so everything here is tougher and hits harder:
  // `toughness` the regular bugs' health (they toughen further with the hour), `eliteHp` and
  // `bossHp` the elites' and the Clog's, `power` every hit you take (run.js)
  toughness: 2,
  eliteHp: 1.8,
  bossHp: 1.6,
  power: 1.5,
  // a little fewer bugs than act 1's waves (spawn rate and how many at once), each dropping a
  // little more XP (run.js spawnWaves, onKill)
  bugs: 0.85,
  xpMult: 1.2,

  // Things the player shouldn't bump into or can pass through
  noCollide: ['Shower curtain'],      // you slip behind the curtain after climbing it
  hide: ['Ornate wall clock', 'Bathtub_3'],   // the detailed clock replaces the simple one; Bathtub_3 is a green see-through blob in the tub (the boss arena)
  decor: [HALL_CLOCK],                // it still hangs there when it isn't fighting (a 1 on 1 with another elite)
  fade: { 'Shower curtain': 0.5 },    // make it see-through so the camera can look into the tub
  // the closets are left ajar (a fraction of fully open) so you can peek in; a wall keeps you out
  doors: { bath: 'open', laundry: 0.3, coat: 0.3, bedroom: 'closed', front: 'closed' },
  walls: [
    // where the hallway opens into the living room: you can look back, not go back
    { min: [2.45, 0, 4.83], max: [3.65, 2.7, 4.87] },
    // the closets: an invisible wall across each doorway (like act 1's wall into the hall)
    { min: [3.57, 0, 4.85], max: [3.61, 2.7, 5.85] },    // laundry closet, off the hall's east wall
    { min: [2.5, 0, 4.85], max: [2.54, 2.7, 6.05] },     // coat closet, off its west wall
    // a safety floor just under the real one: door thresholds have gaps you could fall into
    { min: [0, -0.05, 4.8], max: [4.55, 0, 9.05] },
  ],

  // Floor vents: step on one and the air blows you up in an arc that lands on `land` (positions
  // placed in the layout editor)
  vents: [
    { name: 'Vanity toe-kick vent', at: [1.517, 0.004, 5.599], radius: 0.045, land: [1.5, 0.881, 5.52], to: 'the vanity' },   // beside the sink, not in it
    { name: 'Bathroom vent by the toilet', at: [0.795, 0.004, 5.663], radius: 0.04, land: [0.5, 0.49, 5.58], to: 'the toilet lid' },
    { name: 'Hall vent by the sideboard', at: [3.018, 0, 6.627], radius: 0.045, land: [3.27, 0.8, 6.8], to: 'the sideboard' },
    { name: 'Hall vent by the bench', at: [2.215, 0, 7.361], radius: 0.04, land: [2.08, 0.46, 7.39], to: 'the bench' },
    { name: 'Hall vent by the recycling bin', at: [3.203, 0, 5.779], radius: 0.04, land: [3.39, 0.696, 5.92], to: 'the recycling bin' },
  ],

  // Fabric you can climb: hold jump inside the box
  climbs: [
    { name: 'Drawstring bag', min: [0.2, 0, 7.0], max: [0.42, 0.83, 7.2] },
    { name: 'Shower curtain', min: [0.12, 0, 6.99], max: [0.8, 0.62, 7.27], boss: false },   // the open bathroom door covers the rest of the tub
  ],

  // Where treasures can turn up. At the start of each run the game keeps only spots that
  // are open: nothing overhead, nothing crowding them, flat ground (see Run.openSpot), and
  // moves any on a vent's landing point over.
  spots: [
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
  ],

  // Treasures in the room, as in stage 1
  treasures: { at: [15, 60, 105, 165, 225], stay: 22 },   // five a run: treasures stay a little rare; 22 s to reach each

  // High-ground elites (elites.js): the soap dispenser on the vanity, by the tap (the vanity vent
  // lands you beside it)
  elites: [
    { kind: 'soap', at: [1.53, 0.88, 5.18], hide: 'Soap dispenser', area: 'vanity' },
    HALL_CLOCK,                       // the ornate clock over the cubby bench: the bench vent lands you below it
    // the cream whipper and its N2O cylinder, tucked into the hall's far corner beside the front door
    { kind: 'whipper', at: [3.5, 0.002, 8.82], area: 'front door', stand: [3.15, 0.02, 8.5] },
  ],

  // The boss arena: the bathtub. You're carried in when the timer runs out.
  boss: {
    name: 'The Clog',
    kind: 'hair',
    intro: 'The Clog rises from the drain!',
    arenaMin: [0.14, 0.15, 7.22],
    arenaMax: [1.5, 0.6, 7.84],
    playerStart: [1.2, 0.15, 7.53],
    drain: [0.3, 0.15, 7.53],
  },
};
