import { LOOK } from './look.js';

const JELLY = LOOK.num('jelly-scale', 1);   // content/look.css

// All distances are in METERS. The apartment is built at real-world scale,
// and the player is a ~9 cm tall critter living inside it.
export const CONFIG = {
  player: {
    radius: 0.0306 * JELLY,   // collision radius (3.06 cm at --jelly-scale 1)
    height: 0.08925 * JELLY,  // collision height (8.9 cm)
    walkSpeed: 0.42,     // m/s at 100% Pulse
    jumpHeight: 0.13,    // 13 cm at 100% Bounce (~1.5x body height)
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
    distance: LOOK.num('camera-distance', 0.6),   // how far from the player the camera sits
    pitch: LOOK.num('camera-tilt', 0.9),          // starting tilt (~52 degrees down): mostly top-down, still behind the player
    minDistance: 0.2,
    maxDistance: 0.9,
    height: 0.051,       // look-at point above the player's feet
    minPitch: 0.45,      // never lower than ~26 degrees, so the floor around you stays in view
    maxPitch: 1.3,       // never fully overhead (~75 degrees)
    sensitivity: 0.0025,
    fov: 60,
    near: 0.002,         // tiny near plane so walls don't vanish when the camera is close
    far: 60,
  },
};
