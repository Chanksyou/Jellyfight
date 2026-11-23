// Stories: how a floor vent looks (src/vent-air.js): a grille and visible air, never a column of light.
// Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, fresh, ok, step, story, tp } from './kit.js';

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
