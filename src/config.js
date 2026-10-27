import { LOOK } from './look.js';

const JELLY = LOOK.num('jelly-scale', 1);   // content/look.css

// All distances are in METERS. The apartment is built at real-world scale,
// and the player is a ~9 cm tall critter living inside it.
export const CONFIG = {
  player: {
    radius: 0.0306 * JELLY,   // collision radius (3.06 cm at --jelly-scale 1)
    height: 0.08925 * JELLY,  // collision height (8.9 cm)
    walkSpeed: 0.42,     // m/s at 100% Pulse
    // a landed hit shoves you away from what hit you: 0.08 m/s + 0.07 per point of damage, up to 0.6
    // (about 1 cm for a 1-damage bite, 3 cm for a 6-damage dive); movement damps it in a moment
    hitPush: { base: 0.08, perDamage: 0.07, max: 0.6 },
    jumpHeight: 0.2,     // 20 cm at 100% Jump height: clears the bathroom sink bowl (17.5 cm deep) with room to spare
    gravity: 1.0,        // very low: a jump hangs in the air for about a second
    maxFall: 1.1,        // terminal fall speed, so long drops stay gentle
    stepHeight: 0.013,   // ledges lower than this (rugs, mats, the tub's floor panel) are walked up automatically
    groundAccel: 15,
    airAccel: 6,         // floaty jumps need good air control
    turnSpeed: 12,
    climbSpeed: 0.3,     // m/s up fabric
    airJumpMul: 0.85,    // a mid-air jump is a bit weaker than one from the ground
    // jump feel (platformer conventions: Mario's heavier fall, Celeste's buffer and coyote time)
    coyoteTime: 0.1,     // s after walking off an edge that a jump still works
    jumpBuffer: 0.12,    // s before landing that a jump press still counts (it jumps on touchdown)
    jumpCut: 3,          // gravity x this while rising after jump is let go: a tap is a short hop, a hold the full height
    fallGravity: 1.7,    // gravity x this on the way down: a snappier arc, still floaty
    apexHang: 0.55,      // gravity x this near the top of a held jump (|vy| under apexBand): a beat of hang time
    apexBand: 0.12,      // m/s
  },
  camera: {
    distance: LOOK.num('camera-distance', 0.9),   // how far from the player the camera sits
    pitch: LOOK.num('camera-tilt', 1.05),         // starting tilt (~60 degrees down): mostly top-down, still behind the player
    minDistance: 0.2,
    maxDistance: 0.9,
    height: 0.051,       // look-at point above the player's feet
    minPitch: 0.45,      // never lower than ~26 degrees, so the floor around you stays in view
    maxPitch: 1.3,       // never fully overhead (~75 degrees)
    seeThrough: true,    // what blocks the view (over the jelly, or between it and the camera) fades out
    clearRadius: 0.015,  // what comes this close to the camera's line of sight fades too, so walls don't slice the frame edge
    sensitivity: 0.0025,
    fov: 60,
    near: 0.002,         // tiny near plane so walls don't vanish when the camera is close
    far: 60,
  },
};
