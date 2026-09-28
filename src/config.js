// All distances are in METERS. The apartment is built at real-world scale,
// and the player is a ~3.5 cm tall critter living inside it.
export const CONFIG = {
  player: {
    radius: 0.012,       // collision radius (1.2 cm)
    height: 0.035,       // collision height (3.5 cm)
    walkSpeed: 0.28,     // m/s at 100% Pulse
    jumpHeight: 0.13,    // 13 cm at 100% Bounce (~3.7x body height)
    gravity: 1.0,        // very low: a jump hangs in the air for about a second
    maxFall: 1.1,        // terminal fall speed, so long drops stay gentle
    stepHeight: 0.013,   // ledges lower than this (rugs, mats, the tub's floor panel) are walked up automatically
    groundAccel: 15,
    airAccel: 6,         // floaty jumps need good air control
    turnSpeed: 12,
    climbSpeed: 0.2,     // m/s up fabric
    liftSpeed: 0.45,     // m/s up an updraft
  },
  camera: {
    distance: 0.34,      // how far behind the player the camera sits
    pitch: 0.55,         // starting tilt: high enough to see enemies coming
    minDistance: 0.05,
    maxDistance: 0.8,
    height: 0.03,        // look-at point above the player's feet
    minPitch: -0.6,
    maxPitch: 1.3,
    sensitivity: 0.0025,
    fov: 60,
    near: 0.002,         // tiny near plane so walls don't vanish when the camera is close
    far: 60,
  },
};
