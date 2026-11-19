// Stories: act 4's concert dressing and the stage door moment (concert-dressing.js, stage4.js `dressing`).
import * as THREE from 'three';
import { STAGE4 } from '../stage4.js';
import { juice } from '../juice.js';
import { G, fresh, night4, ok, step, tp } from './kit.js';

const lightCount = (scene) => { let n = 0; scene.traverse((o) => { if (o.isLight) n++; }); return n; };
const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

night4('the-room-is-dressed-as-a-show-and-nothing-is-in-the-way', {
  about: 'The wristband barrier and the console cables are one flat mesh of a few thousand triangles (the console\'s glow plate the one other draw), lying within centimetres of the floor with no collider; no vent landing, chest spot, Elite stand or vent floor spot has dressing on it, and it sits behind where the sun stops.',
  setup() { fresh(); },
  play() {
    const { run } = G(), D = run.dress, m = D.mesh, g = D.glow;
    step(2);
    if (!m || !g) return ok(false, { built: !!m });
    const pos = m.geometry.attributes.position, n = tris(m) + tris(g);
    let maxY = 0, minZ = 9, near = 0; const hit = new Set();
    const taken = [...STAGE4.vents.map((v) => v.at), ...STAGE4.spots.map((s) => s.at)].filter((a) => a && a[1] < 0.05);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      maxY = Math.max(maxY, y);
      if (z < STAGE4.dressing.wristbands.z - 0.05 && z > STAGE4.sun.to) minZ = Math.min(minZ, z);
      if (taken.some((a) => Math.hypot(a[0] - x, a[2] - z) < 0.12)) { near++; hit.add(taken.findIndex((a) => Math.hypot(a[0] - x, a[2] - z) < 0.12)); }
    }
    const solid = run.world.colliders.includes(m) || run.world.colliders.includes(g);
    const behindSun = pos.count > 0 && Array.from({ length: pos.count }, (_, i) => pos.getZ(i)).filter((z) => z > STAGE4.sun.to).length > pos.count * 0.5;
    return ok(m.visible && g.visible && m.userData.noCollide && !solid && n < 15000 && n > 200 && maxY < 0.05 && near === 0 && behindSun && g.material.opacity === 0 && g.position.y > STAGE4.stageDoor.min[1] && g.position.y < 0.75,
      { glowY: g.position.y, tris: n, maxY, near, hit: [...hit].map((i) => taken[i]), solid, behindSun, glow: g.material.opacity });
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
