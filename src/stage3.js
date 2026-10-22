// Stage 3: Medusa. The bedroom, 4 am to 6 am. Reached by beating stage 2's boss (the run carries
// on, as into act 2). Beating its boss, the Pothos, carries the run on into act 4, the Encore's
// concert (stage4.js).
// All positions are world meters (x, y, z); y is the height.
//
// Rough layout (x runs west to east, z from the hallway toward the back wall):
//   bedroom x -1.9 to 1.6, z 8.06 to 11.21; the hallway door is in its east wall (x 1.6, z 8.1-9)
//   (as laid out in the game: src/layout-baked.js moves some things from where the model has them)
//   bed x -0.93 to 0.72, z 9.1 to 11.3 (its frame 0.34 high, the mattress to 0.6-0.85), headboard
//     on the back wall; the bassinet beside it on the west (x -1.48 to -0.95, z 9.87 to 10.86)
//   vanity desk in the north-west corner (x -1.89 to -1.43, z 8.4 to 9.34, top 0.78): its back half
//     and west side cluttered (acrylic bins, a drawer tower, the wavy lamp on a jewelry box), open
//     along the front (x -1.62 to -1.43) and across the middle (z 8.8 to 9.04)
//   nightstand in the south-west corner (x -1.47 to -1.09, z 10.87 to 11.21), air purifier by the
//     west wall (x -1.6, z 9.8), floor mirror against the back wall (x 0.82 to 1.34, z 10.92 to 11.12)
//   closet doors in the east wall (x 1.56, z 9.46 to 10.27); a dresser with a changing pad on top
//     (the changing table: x -1.01 to -0.25, z 8.13 to 8.6, top 1.146) and a diaper pail along the north wall
export const STAGE3 = {
  id: 3,
  name: 'Medusa',
  subtitle: 'Bedroom',
  rooms: ['Bedroom'],
  parts: ['act1', 'act3'],           // apartment files to load (apartment.js): act 3 adds the bedroom
  evolve: 'Your ephyra grows into a full-grown <b>Medusa</b>.',   // the metamorphosis after the Pothos
  start: [1.0, 0, 8.85],             // open floor between the foot of the bed and the dresser
  duration: 260,                      // seconds until the boss comes (4:20)
  clock: [240, 360],                  // in-game minutes after midnight: 4:00 AM -> 6:00 AM
  // tougher again than act 2 (stage2.js says what each one is): 3x the bugs' health, 2x every hit
  // you take, 1.4x the XP
  toughness: 3,
  eliteHp: 2.4,                       // the Alligator's, the Bull's and the Coffer's Health: 500 x 2.4 = 1200
  bossHp: 1.6,                        // the Pothos's Health as the Clog's: 1500 x 1.6 = 2400
  power: 2,
  bugs: 0.85,
  xpMult: 1.4,

  // Wasp nests (content/enemies.kdl "nest"): from `from` seconds into the night (1:30), `count` of
  // these spots get one (run.js spawnNests). A spot is
  // where the nest's flat top meets a wall or the side of furniture (`at`), and the way out from
  // that surface (`out`, x and z); the nest hangs from there with its side against it, low enough
  // that you can hit it from the floor. The story nests/bedroom-spots checks every one.
  nests: {
    count: 2,
    from: 90,
    spots: [
      { on: 'the east side of the bed', at: [0.72, 0.55, 9.6], out: [1, 0] },
      { on: 'the west side of the bed', at: [-0.92, 0.55, 9.4], out: [-1, 0] },
      { on: 'the foot of the bed', at: [-0.1, 0.55, 9.1], out: [0, -1] },
      { on: 'the closet doors', at: [1.56, 0.45, 9.9], out: [-1, 0] },
      { on: 'the east wall by the closet', at: [1.59, 0.42, 10.6], out: [-1, 0] },
      { on: 'the front of the floor mirror', at: [1.08, 0.5, 10.95], out: [0, -1] },
    ],
  },

  // the shelf pothos over the bed comes alive as the boss (pothos.js), and the plushies sit where
  // its pot stands: both gone for the whole act. The plant's leaves are instances of two of the
  // model's shared leaf meshes (Shell_114/115: plants elsewhere use them too), so only the ones
  // under the shelf go; its trailing strands are parts of the shelf (Floating_shelf_3-5)
  // Vanity_desk_22 is the inlaid wooden box on the vanity desk: the Coffer takes its place
  hide: ['Ornate wall clock', 'Pothos', 'Pothos_planter', 'Plush_crocodile', 'Yellow_plush', 'Red_plush', 'Vanity_desk_22',
    'Floating_shelf_3', 'Floating_shelf_4', 'Floating_shelf_5',
    { name: 'Shell_114', within: [[-1.6, 0.9, 10.8], [0.3, 1.85, 11.21]] }, { name: 'Shell_115', within: [[-1.6, 0.9, 10.8], [0.3, 1.85, 11.21]] }],
  noCollide: [],
  fade: {},
  doors: { bath: 'closed', laundry: 'closed', coat: 'closed', bedroom: 'closed', front: 'closed' },
  walls: [
    // a safety floor just under the real one
    { min: [-1.95, -0.05, 8.0], max: [1.65, 0, 11.25] },
  ],

  // Floor vents: step on one and the air blows you up in an arc that lands on `land`
  vents: [
    { name: 'Bedroom vent by the bed', at: [1.1, 0.002, 9.4], radius: 0.045, land: [0.45, 0.641, 9.45], to: 'the bed' },
    { name: 'Bedroom vent by the dresser', at: [-0.6, 0.002, 8.85], radius: 0.045, land: [-0.55, 1.146, 8.3], to: 'the dresser' },
    // round the bassinet to the back of the nightstand, behind the humidifier
    { name: 'Bedroom vent by the vanity', at: [-1.3, 0.002, 9.6], radius: 0.04, land: [-1.52, 0.78, 9.2], to: 'the vanity desk' },
    { name: 'Bedroom vent by the air purifier', at: [-1.65, 0.002, 10.4], radius: 0.04, land: [-1.28, 0.66, 11.17], to: 'the nightstand' },
  ],
  // Fabric you can climb (none here yet)
  climbs: [],

  // Where treasures can turn up (only the open ones are kept: Run.openSpot)
  spots: [
    { area: 'Bedroom', at: [1.0, 0, 8.85], label: 'by the door' },
    { area: 'Bedroom', at: [1.1, 0, 9.9], label: 'by the closet' },
    { area: 'Bedroom', at: [1.1, 0, 10.6], label: 'by the floor mirror' },
    { area: 'Bedroom', at: [-0.2, 0, 8.8], label: 'in front of the diaper pail' },
    { area: 'Bedroom', at: [-1.2, 0, 9.5], label: 'between the vanity and the bassinet' },
    { area: 'Bedroom', at: [-1.65, 0, 9.4], label: 'by the air purifier' },
    { area: 'Bedroom', at: [0.3, 0.641, 9.4], label: 'foot of the bed' },
    { area: 'Bedroom', at: [0.4, 0.641, 9.9], label: 'middle of the bed' },
    { area: 'Bedroom', at: [-0.6, 0.641, 9.6], label: 'the bed, by the bassinet' },
    { area: 'Bedroom', at: [-0.5, 1.146, 8.25], label: 'the dresser' },
  ],
  treasures: { at: [15, 60, 105, 165, 225], stay: 22 },   // as in acts 1 and 2

  // The act's Elites (elites.js): the plush alligator, resting on the pillows at the head of the bed
  // in the gap between them, facing the foot of the bed (`face`; the real plush, out on the
  // mattress, is hidden above). It sleeps until you're on the bed (`wake`: the top of the bed) and
  // settles back when you leave; `stand` is where a 1 on 1 with it puts you. The Pothos's pot
  // takes this spot in the boss fight: elites are cleared at its intro
  elites: [
    { kind: 'croc', at: [-0.105, 0.65, 10.12],   // clear of the pillows (z 10.48 up) even as it turns round (about 33 cm each way)
      face: Math.PI, area: 'bed', wake: { min: [-0.97, 0.55, 9.05], max: [0.76, 1.3, 11.3] }, stand: [-0.1, 0.65, 9.75] },
    // the plush bull on the changing table: the dresser on the north wall (Dresser_and_changing_station,
    // x -1.01 to -0.25, z 8.13 to 8.6), its pad 1.146 up. It sits at the west end of the pad, facing
    // the room; the vent by the dresser lands you 27 cm east of it. Awake while you're on the table top
    { kind: 'bull', at: [-0.82, 1.146, 8.36], face: 0.3, area: 'changing table', wake: { min: [-1.02, 1.1, 8.12], max: [-0.24, 1.7, 8.62] }, stand: [-0.5, 1.146, 8.36] },
    // the Latticework Coffer on the vanity desk, where its inlaid wooden box sat (hidden above), at
    // the back of the desk's open front strip, facing down it (south); the vent by the vanity lands
    // you 70 cm in front of it. Awake while you're on the desk top (its jewels rain anywhere in `wake`)
    { kind: 'coffer', at: [-1.545, 0.78, 8.51], face: 0, area: 'vanity desk', wake: { min: [-1.89, 0.74, 8.4], max: [-1.19, 1.4, 9.34] }, stand: [-1.52, 0.78, 9.0] },
  ],

  // The boss arena: the top of the bed. You're carried up when the timer runs out; the Pothos
  // rises in its pot on the pillows at the head of the bed (`pot`).
  boss: {
    name: 'The Pothos',
    kind: 'pothos',
    intro: 'The Pothos wakes!',
    arenaMin: [-0.95, 0.6, 9.07],
    arenaMax: [0.74, 1.3, 11.3],
    playerStart: [-0.1, 0.7, 9.4],
    // between the two pillows, where the plush crocodile sat: the pot stands on the mattress in the
    // gap between them, nestled in (pothos.js seats it on the lowest surface under its base; y is
    // only where it looks down from)
    pot: [-0.15, 0.795, 10.82],
    // round the top of the bed (only there in the fight), a little below the mattress so there's no gap
    walls: [
      { min: [-0.99, 0.55, 9.03], max: [-0.95, 1.3, 11.34] },   // west, by the bassinet
      { min: [0.74, 0.55, 9.03], max: [0.78, 1.3, 11.34] },     // east
      { min: [-0.99, 0.55, 9.03], max: [0.78, 1.3, 9.07] },     // the foot
      { min: [-0.99, 0.55, 11.3], max: [0.78, 1.3, 11.34] },    // the headboard
    ],
  },
};
