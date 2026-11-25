// The ground mist (src/mist.js): a low uneven fog in the room's shared shader, and a little of it on the jelly and the bugs.
import { G, fresh, tp, step, spawn, near, ok, story } from './kit.js';
import { MIST, updateMist } from '../mist.js';

// how many pixels differ between two renders of the same frame, one after `change`
function changedPixels(change, undo) {
  const { APT, gfx } = G(), gl = APT.renderer.getContext();
  const shot = () => { G().batcher.sync(); gfx.render(); const a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const A = shot(); change(); const B = shot(); undo();
  let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 6) n++;
  return n;
}

story('mist/lies-on-the-floor-and-zero-is-none', {
  readback: true,   // reads the picture back, so tests/run.mjs plays it before the stories that queue frames
  about: 'The ground mist changes the room\'s picture (the floor reads mistier than with it capped at nothing); --mist at 0 (or ?mist=0) draws none of it; and neither is a new shader in play, only a number.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(2.4, 0.05, 2.6, 0.8); step(10); },
  async play() {
    const U = MIST.uniforms, k = U.mistK.value, max = U.mistMax.value;
    G().batcher.sync(); G().gfx.render();
    const programs = G().APT.renderer.info.programs.length;
    const shown = changedPixels(() => { U.mistMax.value = 0; }, () => { U.mistMax.value = max; });
    U.mistK.value = 0;
    const same = changedPixels(() => { U.mistMax.value = 0; }, () => { U.mistMax.value = max; });
    U.mistK.value = k;
    const built = G().APT.renderer.info.programs.length - programs;
    return ok(k > 0 && shown > 2000 && same === 0 && built === 0, { thickness: k, shown, same, built });
  },
});

story('mist/the-patches-hold-still-in-reduce-effects', {
  about: 'The mist\'s patches drift with a clock; Reduce effects holds the clock still (the mist itself stays).',
  setup() { fresh({ elites: false }); },
  play() {
    const t = MIST.uniforms.mistT, from = t.value;
    updateMist(1, true);
    const held = t.value === from;
    updateMist(1, false);
    return ok(held && t.value !== from && MIST.uniforms.mistK.value > 0, { from, now: t.value });
  },
});

story('mist/the-jelly-and-bugs-sit-in-it-a-little', {
  readback: true,   // reads the picture back, so tests/run.mjs plays it before the stories that queue frames
  about: 'The jelly and the bugs take the mist at --mist-actors of its strength through the baked-light tint (no extra shader), so they sit in the fog and stay readable; turning it to nothing changes how they are drawn.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(2.6, 0.05, 2.6, 0.8); },
  async play() {
    for (let i = 0; i < 4; i++) spawn('roach', near(0.2 + i * 0.06, 0.12), { still: true });
    step(10);
    const U = MIST.uniforms, share = U.mistActors.value, built = G().APT.renderer.info.programs.length;
    const mats = [];
    G().player.avatar.root.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { if (m.isMeshStandardMaterial) mats.push(m); }); });
    G().batcher.sync(); G().gfx.render();
    const reads = mats.every((m) => { const p = G().APT.renderer.properties.get(m).currentProgram; return !!p && 'mistActors' in p.getUniforms().map; });
    const changed = changedPixels(() => { U.mistActors.value = 1; U.mistK.value *= 6; }, () => { U.mistActors.value = share; U.mistK.value /= 6; });
    return ok(share > 0 && share < 1 && mats.length > 0 && reads && changed > 50, { share, jelly: mats.length, reads, changed, built });
  },
});
