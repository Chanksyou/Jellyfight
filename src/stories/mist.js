// The ground mist (src/mist.js): a low uneven fog in the room's shared shader, and a little of it on the jelly and the bugs.
import { G, V, r3, fresh, tp, step, spawn, near, ok, story, stub, offs } from './kit.js';
import { bus } from '../events.js';
import { juice } from '../juice.js';
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

// How much mist shows at each world point on screen: the colour it adds over the same frame with none (5x5 pixels round each)
function mistShown(points) {
  const { APT, gfx } = G(), gl = APT.renderer.getContext(), U = MIST.uniforms, max = U.mistMax.value, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const shot = () => { G().batcher.sync(); gfx.render(); const a = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const on = shot(); U.mistMax.value = 0; const off = shot(); U.mistMax.value = max;
  return points.map((p) => {
    const q = p.clone().project(APT.camera), cx = Math.round((q.x + 1) / 2 * W), cy = Math.round((q.y + 1) / 2 * H);
    let n = 0;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) { const i = (y * W + x) * 4; n += Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]); }
    return n;
  });
}
// the same with nothing parting it (the jelly, its trail, the vents, the hits), then put back
function unparted(points) {
  const U = MIST.uniforms, keep = [U.mistJk.value.x, ...U.mistTrail.value.map((t) => t.w), ...U.mistHoles.value.map((h) => h.w)];
  U.mistJk.value.x = 0; U.mistTrail.value.forEach((t) => { t.w = 0; }); U.mistHoles.value.forEach((h) => { h.w = 0; });
  const n = mistShown(points);
  U.mistJk.value.x = keep[0]; U.mistTrail.value.forEach((t, i) => { t.w = keep[1 + i]; }); U.mistHoles.value.forEach((h, i) => { h.w = keep[1 + U.mistTrail.value.length + i]; });
  return n;
}
// the jelly held still (or swum by `move`), and out of the picture so the floor under it shows
function hideJelly(move) {
  const { player } = G();
  stub(player, 'update', (dt) => { if (move) move(dt); else player.velocity.set(0, 0, 0); });
  player.avatar.root.visible = false;
  offs.push(() => { player.avatar.root.visible = true; });
}

story('mist/parts-round-the-jelly-and-fills-back-in', {
  readback: true,   // reads the picture back, so tests/run.mjs plays it before the stories that queue frames
  about: 'The mist is thinner where the jelly is than with nothing parting it, and no thinner 60 cm off; a spot the jelly swam through is thinner just after and back to full once --mist-part-refill has passed; a big hit punches a hole too. None of it builds a shader in play.',
  setup() { fresh({ elites: false, lash: false, bubbles: false }); tp(3.2, 0.05, 3.0, 0); },
  async play() {
    const { player, APT } = G(), P = player.position, programs = () => APT.renderer.info.programs.length, U = MIST.uniforms, k = U.mistK.value;
    U.mistK.value = 2 * k;   // thick, so what is measured doesn't hang on how thick --mist is tuned
    offs.push(() => { U.mistK.value = k; });
    let goal = null;
    hideJelly((dt) => { if (goal) { const d = goal.clone().sub(P); d.y = 0; const s = Math.min(d.length(), 0.7 * dt); if (s > 1e-6) d.setLength(s); P.add(d); player.velocity.copy(d).divideScalar(dt); } else player.velocity.set(0, 0, 0); });
    step(20);
    const built = programs(), here = V(P.x, 0, P.z), off = V(P.x - 0.6, 0, P.z);
    const [atJ, atF] = mistShown([here, off]), [atJ0, atF0] = unparted([here, off]);
    // swim 50 cm to the left; the middle of that path, right after
    const from = P.clone(), mid = V(P.x - 0.25, 0, P.z);
    goal = V(P.x - 0.5, P.y, P.z);
    step(50);
    goal = null;
    const [trail] = mistShown([mid]), [trail0] = unparted([mid]);
    step(Math.round((MIST.part.refill + 0.4) * 60));
    const [filled] = mistShown([mid]), [filled0] = unparted([mid]);
    // a big hit 40 cm in front of the jelly
    const hit = V(P.x + 0.1, 0, P.z - 0.4);
    bus.emit('impact', { pos: hit, size: 0.1 });
    step(2);
    const [holed] = mistShown([hit]), [holed0] = unparted([hit]);
    const info = { atJ, atJ0, atF, atF0, trail, trail0, filled, filled0, holed, holed0, from: r3(from), built: programs() - built };
    return ok(atJ0 > 100 && atJ < atJ0 * 0.5 && Math.abs(atF - atF0) <= atF0 * 0.1 + 30 && trail < trail0 * 0.75
      && Math.abs(filled - filled0) <= filled0 * 0.1 + 30 && holed < holed0 * 0.6 && info.built === 0, info);
  },
});

story('mist/curls-hold-still-in-reduce-effects', {
  about: 'Reduce effects keeps the jelly\'s parting but turns the curls off (the vortex pairs and the flow round it), and the drift with them; turning it off brings the curls back.',
  setup() { fresh({ elites: false }); },
  play() {
    const U = MIST.uniforms, was = juice.calm;
    juice.calm = true; step(2);
    const calm = { curl: U.mistCurl.value, part: U.mistJk.value.x };
    juice.calm = false; step(2);
    const moving = { curl: U.mistCurl.value, part: U.mistJk.value.x };
    juice.calm = was;
    return ok(calm.curl === 0 && calm.part > 0 && moving.curl > 0 && moving.part > 0, { calm, moving });
  },
});

story('mist/vents-thin-it-and-a-ride-pushes-it-out', {
  about: 'The three vents nearest the jelly thin the mist over themselves; the one ridden pushes it further out for the gust, and vents off in a Boss fight stop thinning it.',
  setup() { fresh({ elites: false }); tp(1.85, 0.05, 2.0, 0); },
  play() {
    const { traversal } = G(), U = MIST.uniforms, holes = U.mistHoles.value;
    step(2);
    const v = traversal.vents.reduce((a, b) => (Math.hypot(a.x - 1.85, a.z - 2) < Math.hypot(b.x - 1.85, b.z - 2) ? a : b));
    const first = holes.slice(0, 3).map((h) => [h.x, h.y, h.z, h.w].map((n) => +n.toFixed(3)));
    const r = holes[0].z;
    bus.emit('vent_ride', { vent: v });
    step(2);
    const riding = { r: holes[0].z, w: holes[0].w };
    traversal.bossMode = true;
    step(90);
    const off = holes[0].w;
    traversal.bossMode = false;
    return ok(holes[0].x === v.x && first[0][3] > 0 && first[1][3] > 0 && first[2][3] > 0 && riding.r > r && riding.w >= first[0][3] && off === 0,
      { vent: v.name, first, riding, off });
  },
});
