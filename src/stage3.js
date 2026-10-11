// Stage 3: the bedroom. Not playable yet (it isn't in STAGES, src/stages.js): this is act 3's data
// as it's being built. All positions are world meters (x, y, z); y is the height.
//
// Rough layout (x runs west to east, z from the hallway toward the back wall):
//   bedroom x -1.9 to 1.6, z 8.06 to 11.21; the hallway door is in its east wall (x 1.6, z 8.1-9)
//   (as laid out in the game: src/layout-baked.js moves some things from where the model has them)
//   bed x -0.93 to 0.72, z 9.1 to 11.3 (its frame 0.34 high, the mattress to 0.6-0.85), headboard
//     on the back wall; the bassinet beside it on the west (x -1.48 to -0.95, z 9.87 to 10.86)
//   vanity desk in the north-west corner (x -1.89 to -1.43, z 8.4 to 9.34, top 0.78)
//   nightstand in the south-west corner (x -1.47 to -1.09, z 10.87 to 11.21), air purifier by the
//     west wall (x -1.6, z 9.8), floor mirror against the back wall (x 0.82 to 1.34, z 10.92 to 11.12)
//   closet doors in the east wall (x 1.56, z 9.46 to 10.27); a dresser and a diaper pail along the
//     north wall (z 8.4 to 8.6)
export const STAGE3 = {
  id: 3,
  name: 'Bedroom',
  rooms: ['Bedroom'],
  parts: ['act1', 'act3'],

  // Wasp nests (content/enemies.kdl "nest"): each run, `count` of these spots get one. A spot is
  // where the nest's flat top meets a wall or the side of furniture (`at`), and the way out from
  // that surface (`out`, x and z); the nest hangs from there with its side against it, low enough
  // that you can hit it from the floor. The story nests/bedroom-spots checks every one.
  nests: {
    count: 2,
    spots: [
      { on: 'the east side of the bed', at: [0.72, 0.55, 9.6], out: [1, 0] },
      { on: 'the west side of the bed', at: [-0.92, 0.55, 9.4], out: [-1, 0] },
      { on: 'the foot of the bed', at: [-0.1, 0.55, 9.1], out: [0, -1] },
      { on: 'the closet doors', at: [1.56, 0.45, 9.9], out: [-1, 0] },
      { on: 'the east wall by the closet', at: [1.59, 0.42, 10.6], out: [-1, 0] },
      { on: 'the front of the floor mirror', at: [1.08, 0.5, 10.95], out: [0, -1] },
    ],
  },
};
