// Stories: how a floor vent looks (src/vent-air.js): a grille and visible air, never a column of light.
// Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, V, fresh, ok, record, step, story, tp } from './kit.js';

const air = () => G().traversal.air;
// the scene drawn once into a tiny target, as the frame story does; returns the draws the vents' group added
function ventDraws() {
  const { GAME, APT, traversal } = G(), R = APT.renderer, was = R.getRenderTarget(), t = new THREE.WebGLRenderTarget(4, 4);
  const count = () => { R.info.reset(); R.render(APT.scene, APT.camera); return R.info.render.calls; };
  GAME.step(1 / 60);
  try {
    R.setRenderTarget(t);
    R.info.autoReset = false;
    const withVents = count();
    traversal.group.visible = false;
    const without = count();
    traversal.group.visible = true;
    return { withVents, without, added: withVents - without };
  } finally { R.info.autoReset = true; R.setRenderTarget(was); t.dispose(); }
}

story('vents/no-column-of-light', {
  about: 'No vent draws a column of light: nothing in a vent\'s group is additive, a tube, or taller than 2 cm as a solid, so the old pale-blue cylinder cannot come back.',
  setup() { fresh({ elites: false }); },
  play() {
    const bad = [];
    G().traversal.group.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return;
      const m = o.material, g = o.geometry;
      if (m.blending === THREE.AdditiveBlending) bad.push('additive');
      if (/Cylinder|Cone|Tube/.test(g.type)) bad.push(g.type);
      if (o.isMesh && !m.isShaderMaterial) { g.computeBoundingBox(); if (g.boundingBox.max.y - g.boundingBox.min.y > 0.02) bad.push('tall solid'); }
    });
    return ok(G().traversal.group.children.length > 0 && !bad.length, { bad });
  },
});

story('vents/air-draws-in-four', {
  about: 'All of an act\'s vents together add four draws (grille, ribbons, wisps, dust), whatever the vent count.',
  setup() { fresh({ elites: false }); },
  play() {
    const d = ventDraws();
    return ok(G().traversal.vents.length > 1 && G().traversal.group.children.length === 4 && d.added <= 4, { vents: G().traversal.vents.length, ...d });
  },
});

story('vents/air-uploads-nothing', {
  about: 'Over 120 frames the vents upload no buffer and build no shader: only the clock moves.',
  setup() { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0.8); },
  play() {
    const { APT, traversal } = G(), R = APT.renderer;
    const versions = () => traversal.group.children.flatMap((o) => Object.values(o.geometry.attributes).map((a) => a.version)).join();
    step(10);
    const before = versions(), programs = R.info.programs.length, t0 = air().look.uniforms.uTime.value;
    step(120);
    return ok(versions() === before && R.info.programs.length === programs && air().look.uniforms.uTime.value > t0, { programs, before });
  },
});

story('vents/moved-vent-moves-its-air', {
  about: 'Moving a vent (the layout editor) moves its grille, ribbons, wisps and dust with it, and moving it back puts them back.',
  setup() { fresh({ elites: false }); },
  play() {
    const { traversal } = G(), v = traversal.vents[0], at = [...v.at], land = [...v.land];
    const x = () => traversal.air.parts.map((o) => {   // (the ribbons and wisps keep where they stand in `base`)
      const a = o.geometry.attributes.base || o.geometry.attributes.position;
      let m = -Infinity;
      for (let i = 0; i < a.count; i++) m = Math.max(m, a.getX(i));
      return +m.toFixed(2);
    });
    const before = x();
    traversal.placeVent(0, [at[0] + 50, at[1], at[2]], [land[0] + 50, land[1], land[2]]);
    const moved = x();
    traversal.placeVent(0, at, land);
    const back = x();
    return ok(moved.every((m, i) => m > at[0] + 49) && back.every((b, i) => Math.abs(b - before[i]) < 0.01), { before, moved, back });
  },
});

story('vents/low-draws-no-dust-and-calm-stills-ribbons', {
  about: 'Low graphics draws no dust motes (still built, nothing drawn); Reduce effects hangs the ribbons still and slows the streaks.',
  setup() { fresh({ elites: false }); },
  play() {
    const a = air(), U = a.look.uniforms, mark = U.uTime.value;
    a.update(1, { low: true });
    const low = a.motes.geometry.drawRange.count, lowDt = U.uTime.value - mark;
    a.update(1, { low: false, calm: true });
    const calm = U.uCalm.value, calmDt = U.uTime.value - mark - lowDt, dust = a.motes.geometry.drawRange.count;
    a.update(0, {});
    return ok(low === 0 && dust > 1000 && calm === 1 && U.uCalm.value === 0 && calmDt < lowDt * 0.5, { low, dust, calm, lowDt, calmDt });
  },
});

story('vents/air-rests-where-it-blows', {
  about: 'Every vent piece\'s own shape (what the Overdraw view and any plain material draw, without the moving shader) stands over a vent, never at the room\'s origin, so the overdraw count sees the air where it is.',
  setup() { fresh({ elites: false }); },
  play() {
    const { traversal } = G(), far = [];
    for (const o of traversal.air.parts) {
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const near = traversal.vents.some((v) => Math.hypot(p.getX(i) - v.x, p.getZ(i) - v.z) < v.radius * 2 && p.getY(i) >= v.y - 0.01 && p.getY(i) <= v.land[1] + 0.05);
        if (!near) { far.push(`${o.type} ${i}: ${p.getX(i).toFixed(2)}, ${p.getY(i).toFixed(2)}, ${p.getZ(i).toFixed(2)}`); break; }
      }
    }
    return ok(traversal.air.parts.length === 4 && !far.length, { far });
  },
});

// the heat shimmer's bend map, read back: how many of its pixels bend the picture
function bentPixels(gfx) {
  const m = gfx.shimmer.map, px = new Uint16Array(m.width * m.height * 4);
  G().APT.renderer.readRenderTargetPixels(m, 0, 0, m.width, m.height, px);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if ((px[i] & 0x7fff) || (px[i + 1] & 0x7fff)) n++;
  return n;
}
story('vents/shimmer-bends-only-when-asked', {
  about: 'Heat shimmer is an experiment (?shimmer=1): without it the game builds no bend map; with it, on Medium or High, a vent in view bends some of the picture, nothing bends with Reduce effects, and Low has no bend map at all.',
  setup() { fresh({ elites: false }); },
  play() {
    const { gfx, traversal, tpc, GAME } = G(), v = traversal.vents[0], was = gfx.quality, off = !gfx.shimmer;
    tp(v.x + 0.25, v.y, v.z + 0.25);
    try {
      gfx.heat = traversal.air.heatScene;
      gfx.setTier(was === 'low' ? 'medium' : was);
      let bent = 0;
      for (let i = 0; i < 4 && !bent; i++) { tpc.yaw = (i * Math.PI) / 2; step(4); GAME.render(); bent = bentPixels(gfx); }
      traversal.air.update(0, { calm: true }); GAME.render();
      const calm = bentPixels(gfx);
      traversal.air.update(0, {});
      gfx.setTier('low');
      const low = gfx.shimmer;
      return ok(off && bent > 20 && calm === 0 && !low, { off, bent, calm, low: !!low });
    } finally { gfx.heat = null; gfx.setTier(was); }
  },
});

story('vents/ride-gusts-then-settles', {
  about: 'Stepping on a vent sends one vent_ride; that vent\'s air gusts (streaks faster, ribbons pulled straight) for --vent-gust-hold s, eases back to calm after, and the jelly still lands where the vent sends it.',
  setup() { fresh({ elites: false }); const v = G().traversal.vents[0]; tp(v.x, v.y + 0.05, v.z, 0); },
  play() {
    const { player, traversal } = G(), v = traversal.vents[0], U = air().look.uniforms, rides = record('vent_ride');
    step(60, () => !!player.flight);
    const at = [+U.uGust.value.x.toFixed(3), +U.uGust.value.y.toFixed(3)], start = U.uGust.value.w;
    step(12);                                                   // 0.2 s: still at full
    const held = U.uGust.value.w, clock = U.uGustClock.value;
    step(120);                                                  // 2 s: settled, and landed
    const after = U.uGust.value.w, p = player.position, [lx, ly, lz] = v.land;
    const landed = Math.hypot(p.x - lx, p.z - lz) < 0.08 && Math.abs(p.y - ly) < 0.06;
    return ok(rides.length === 1 && rides[0].vent === v && Math.abs(at[0] - v.x) < 1e-3 && Math.abs(at[1] - v.z) < 1e-3
      && start === 1 && held === 1 && clock > 0 && after === 0 && landed, { rides: rides.length, at, start, held, clock, after, landed });
  },
});

story('vents/air-stops-in-a-boss-fight', {
  about: 'With vents off in a Boss fight the air stops over --vent-off-time s (streaks and dust fade, ribbons lie limp) and its hiss goes quiet; with vents back on it starts again the same way.',
  setup() { fresh({ elites: false }); },
  play() {
    const { traversal } = G(), U = air().look.uniforms, v = traversal.vents[0], on = V(v.x, v.y, v.z);
    const nearOn = traversal.near(on);
    traversal.bossMode = true;
    step(6); const fading = U.uFlow.value;
    step(30); const off = U.uFlow.value, nearOff = traversal.near(on);
    traversal.bossMode = false;
    step(36); const back = U.uFlow.value;
    return ok(nearOn === 1 && fading > 0 && fading < 1 && off === 0 && nearOff === 0 && back === 1, { nearOn, fading, off, nearOff, back });
  },
});
