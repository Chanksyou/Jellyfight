import { LOOK } from './look.js';

const JELLY = LOOK.num('jelly-scale', 1);   // content/look.css

// All distances are in METERS. The apartment is built at real-world scale,
// and the player is a ~9 cm tall critter living inside it.
export const CONFIG = {
  player: {
    radius: 0.0306 * JELLY,   // collision radius (3.06 cm at --jelly-scale 1)
    height: 0.08925 * JELLY,  // collision height (8.9 cm)
    walkSpeed: 0.42,     // m/s at 100% Pulse
    jumpHeight: 0.2,     // 20 cm at 100% Bounce: clears the bathroom sink bowl (17.5 cm deep) with room to spare
    gravity: 1.0,        // very low: a jump hangs in the air for about a second
    maxFall: 1.1,        // terminal fall speed, so long drops stay gentle
    stepHeight: 0.013,   // ledges lower than this (rugs, mats, the tub's floor panel) are walked up automatically
    groundAccel: 15,
    airAccel: 6,         // floaty jumps need good air control
    turnSpeed: 12,
    climbSpeed: 0.3,     // m/s up fabric
    airJumpMul: 0.85,    // a mid-air jump is a bit weaker than one from the ground
  },
  camera: {
    distance: LOOK.num('camera-distance', 0.68),   // how far from the player the camera sits
    pitch: LOOK.num('camera-tilt', 1.05),         // starting tilt (~60 degrees down): mostly top-down, still behind the player
    minDistance: 0.2,
    maxDistance: 0.9,
    height: 0.051,       // look-at point above the player's feet
    minPitch: 0.45,      // never lower than ~26 degrees, so the floor around you stays in view
    maxPitch: 1.3,       // never fully overhead (~75 degrees)
    minClear: 0.3,       // against a wall it tilts up toward top-down rather than closer than this
    autoLift: LOOK.num('camera-lift', 0),         // radians it may tilt up on its own to look over a wall (0 = never)
    seeThrough: true,    // furniture the jelly is under fades out instead of blocking the view
    clearRadius: 0.015,  // keeps this much room around the camera so walls don't slice the frame edge
    lookAhead: 0.06,     // starts tilting up (or gliding in) when a wall comes this close, before it blocks the view
    pullSpeed: 2.5,      // m/s: how fast it glides in toward a wall that's coming near
    sensitivity: 0.0025,
    fov: 60,
    near: 0.002,         // tiny near plane so walls don't vanish when the camera is close
    far: 60,
  },
};
