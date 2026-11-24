// Stories: act 4's concert dressing and the stage door moment (concert-dressing.js, stage4.js `dressing`).
import * as THREE from 'three';
import { STAGE4 } from '../stage4.js';
import { juice } from '../juice.js';
import { G, fresh, night4, ok, step, tp } from './kit.js';

const lightCount = (scene) => { let n = 0; scene.traverse((o) => { if (o.isLight) n++; }); return n; };

night4('the-room-is-dressed-as-a-show-and-nothing-is-in-the-way', {
  about: 'Act 4 has no wristband barrier or console cables on the floor; the one draw dressing adds is the console\'s glow plate (not drawn until the door moment lights it), flat on the console top with no collider.',
  setup() { fresh(); },
  play() {
    const { run } = G(), D = run.dress, g = D.glow;
    step(2);
    if (!g) return ok(false, { built: false });
    const solid = run.world.colliders.includes(g);
    return ok(!D.mesh && !STAGE4.dressing.wristbands && !STAGE4.dressing.cables && g.userData.noCollide && !solid && g.material.opacity === 0 && g.position.y > STAGE4.stageDoor.min[1] && g.position.y < 0.75,
      { glowY: g.position.y, solid, glow: g.material.opacity });
  },
});

night4('lit-props-flash-on-the-beat-without-adding-or-removing-a-light', {
  about: 'The LED cove strip, the Corner LED and the Spotlight floor lamp, and the TV, glow brighter on a beat than half a beat after it; the lights in the scene are the same count throughout; with Reduce effects they stay steady.',
  setup() { fresh(); },
  play() {
    const { run } = G(), D = run.dress, lights = lightCount(run.scene);
    const level = (beat) => { run.beat = beat; step(1); return [D.lamps.map((l) => l.m.emissiveIntensity / l.base), D.tv.m.emissiveIntensity]; };
    const on = level(8.001), off = level(8.5), calm = juice.calm;
    juice.calm = true;
    const still = level(8.001);
    juice.calm = calm;
    const lamps = D.lamps.length >= 3;
    return ok(lamps && on[0].every((v, i) => v > off[0][i] + 0.05) && on[1] > off[1] + 0.05 && still[0].every((v) => Math.abs(v - 1) < 1e-6) && lightCount(run.scene) === lights,
      { lamps: D.lamps.length, on, off, still, lights, after: lightCount(run.scene) });
  },
});

night4('the-stage-door-warms-up-for-a-few-beats-and-a-jump-skips-it', {
  about: 'At time-up the bugs go and the TV flares and the media console lights up for a few beats before the door opens (not at once); a jump skips what is left; with Reduce effects it is much shorter. Standing on the console meanwhile does not take you through.',
  setup() { fresh(); },
  play() {
    const { run, hud } = G();
    run.t = run.duration;
    step(2);
    const atStart = { door: run.doorOpen, warming: run.doorWarming, glow: run.dress.glow.material.opacity };
    step(60 * 2);
    const mid = { door: run.doorOpen, glow: run.dress.glow.material.opacity, tv: run.dress.tv.m.emissiveIntensity };
    tp(1.6, 0.62, 4.55); step(2);
    const early = run.phase;   // on the console, the door not open: still in the room
    tp(3.05, 0.01, 4.4); step(2);   // back off it (the open door takes you through)
    run.player.onJump();
    step(2);
    const skipped = run.doorOpen, glowOpen = run.dress.glow.material.opacity;
    return ok(!atStart.door && atStart.warming && mid.door === false && mid.glow > 0 && mid.tv > 0.35 && early === 'explore' && skipped && glowOpen > 0.4 && run.doorOpen,
      { atStart, mid, early, skipped, glowOpen });
  },
});

night4('with-reduce-effects-the-stage-door-moment-is-short', {
  about: 'Under Reduce effects the door warms up for a couple of beats instead of eight, and the glow stays steady.',
  setup() { fresh(); },
  play() {
    const { run } = G(), calm = juice.calm;
    juice.calm = true;
    run.t = run.duration;
    step(2);
    let frames = 0;
    while (!run.doorOpen && frames < 60 * 6) { step(1); frames++; }
    juice.calm = calm;
    return ok(run.doorOpen && frames > 30 && frames < 60 * 2.5, { frames });
  },
});
