// Stories: the shadows take the room's light (systems.js ShadowSystem, shadows plan S3). Each reads the shadows'
// own draw back from straight above (ink, below) and compares where its ink falls with where the light comes from.
import * as THREE from 'three';
import { G, V, fresh, near, night4, ok, spawn, step, story, tp } from './kit.js';

// The shadows' draw alone, seen from straight above over (x, z) at height y, `half` m each way, 64 px: how much ink
// (alpha) there is, its centre, and where its darkest pixel is. Nothing else in the room is drawn.
export function ink(x, z, y, half) {
  const { APT, shadows: S } = G(), r = APT.renderer, N = 64, mesh = S.bugs, parent = mesh.parent;
  const scene = new THREE.Scene(); scene.fog = APT.scene.fog;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 6);
  cam.position.set(x, y + 3, z); cam.up.set(0, 0, -1); cam.lookAt(x, y, z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(N, N), px = new Uint8Array(N * N * 4), prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  scene.add(mesh);
  try { r.setRenderTarget(rt); r.setClearColor(0, 0); r.clear(); r.render(scene, cam); r.readRenderTargetPixels(rt, 0, 0, N, N, px); }
  finally { r.setRenderTarget(prev); r.setClearColor(cc, ca); parent.add(mesh); rt.dispose(); }
  let sum = 0, sx = 0, sz = 0, peak = -1, at = null;
  for (let row = 0; row < N; row++) for (let c = 0; c < N; c++) {
    const a = px[(row * N + c) * 4 + 3] / 255, wx = x - half + (c + 0.5) / N * 2 * half, wz = z + half - (row + 0.5) / N * 2 * half;
    sum += a; sx += a * wx; sz += a * wz;
    if (a > peak) { peak = a; at = { x: wx, z: wz }; }
  }
  return { sum, cx: sum ? sx / sum : x, cz: sum ? sz / sum : z, peak, px: at.x, pz: at.z };
}

// how far the shadow of a bug standing at `at` moves when `knob` (a function that turns a light off and back on) is
// on: the ink's centre with it, less without it, and the darkest pixel's distance from the bug, with it
function lean(e, half, off) {
  const on = ink(e.pos.x, e.pos.z, e.pos.y, half), back = off(), without = ink(e.pos.x, e.pos.z, e.pos.y, half);
  back();
  return { dx: on.cx - without.cx, dz: on.cz - without.cz, core: Math.hypot(on.px - e.pos.x, on.pz - e.pos.z) };
}
const U = () => G().shadows.u;
const noGrid = () => { const u = U(), g = u.lbGridGain.value; u.lbGridGain.value = 0; return () => { u.lbGridGain.value = g; }; };
const noPush = () => { const u = U(), p = u.jellyPush.value; u.jellyPush.value = 0; return () => { u.jellyPush.value = p; }; };
const cosOf = (ax, az, bx, bz) => (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1);
const r3 = (n) => +n.toFixed(3);

const LAMP = [3.04, 0.77];   // act 1's low lamp by the lounge chair, lit into the baked light grid
story('engine/shadows-lean-away-from-the-lamp', {
  about: 'A bug\'s shadow leans away from where the room\'s light comes from (the baked light grid where it stands, the light the furniture takes): round act 1\'s low lamp it falls on the far side of the bug from the lamp, and its darkest part stays under the bug.',
  readback: true,   // reads the shadows' draw back, so tests/run.mjs plays it before the stories that queue frames
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const got = [];
    for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0.25, 0.25], [-0.25, 0.25]]) {
      fresh({ elites: false, bubbles: false, lash: false });
      tp(LAMP[0] + dx * 2.5, 0.05, LAMP[1] + dz * 2.5 + 0.3, 0);
      const e = spawn('beetle', V(LAMP[0] + dx, 0.05, LAMP[1] + dz), { still: true });
      step(5);
      const back = noPush(), l = lean(e, 0.15, noGrid); back();
      got.push({ at: [dx, dz], moved: r3(Math.hypot(l.dx, l.dz)), cos: +cosOf(l.dx, l.dz, dx, dz).toFixed(2), core: r3(l.core / e.r) });
    }
    return ok(got.every((g) => g.moved > 0.003 && g.cos > 0.5 && g.core < 1), { got });
  },
});

story('engine/bugs-shadow-away-from-the-jelly', {
  about: 'The jelly\'s glow pushes a nearby bug\'s shadow away from the jelly; a bug past the glow\'s reach (--jelly-light-reach) is not pushed.',
  readback: true,   // reads the shadows' draw back, so tests/run.mjs plays it before the stories that queue frames
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    fresh({ elites: false, bubbles: false, lash: false });
    tp(2.4, 0.05, 2.6, 0);
    const e = spawn('beetle', near(0.2, 0.05), { still: true }), far = spawn('beetle', near(-0.6, 0.1), { still: true });
    step(5);
    const P = G().player.position, a = lean(e, 0.15, noPush), b = lean(far, 0.15, noPush);
    const cos = cosOf(a.dx, a.dz, e.pos.x - P.x, e.pos.z - P.z), pushed = Math.hypot(a.dx, a.dz), farMoved = Math.hypot(b.dx, b.dz);
    return ok(pushed > 0.005 && cos > 0.8 && farMoved < 0.001, { pushed: r3(pushed), cos: +cos.toFixed(2), farMoved: r3(farMoved) });
  },
});

// act 4: the same spot by the lounge chair in the shade at 6 am and in the sun at 8 am, and one still in the shade at 8 am
night4('shadows-lengthen-with-the-dawn', {
  about: 'In act 4 the sun takes over the shadows on its side of the line as the day comes: at 8 am a bug in the sun has a long shadow pointing away from the window\'s sun, far longer than the same spot\'s at 6 am (still in the shade) and than a bug\'s in the shade at 8 am; its darkest part stays under the bug.',
  readback: true,   // reads the shadows' draw back, so tests/run.mjs plays it before the stories that queue frames
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run } = G(), u = U();
    const noLight = () => { const g = u.lbGridGain.value, k = u.sunK.value; u.lbGridGain.value = 0; u.sunK.value = 0; return () => { u.lbGridGain.value = g; u.sunK.value = k; }; };
    const at = (late, x, z) => {
      fresh({ elites: false, bubbles: false, lash: false });
      tp(x - 0.5, 0.05, z, 0); run.t = run.duration * late; step(2);
      const e = spawn('beetle', V(x, 0.05, z), { still: true });
      step(5);
      const back = noPush(), l = lean(e, 0.2, noLight); back();
      return { moved: Math.hypot(l.dx, l.dz), dx: l.dx, dz: l.dz, core: l.core / e.r, sunK: u.sunK.value, inSun: z < u.sunLine.value };
    };
    const dawn = at(0, 2.4, 2.6), day = at(1, 2.4, 2.6), shade = at(1, 3.2, 3.7);
    const s = u.sunDir.value, cos = cosOf(day.dx, day.dz, -s.x, -s.z);
    const pass = day.inSun && !dawn.inSun && !shade.inSun && day.moved > 0.02 && day.moved > 3 * dawn.moved && day.moved > 2 * shade.moved && cos > 0.9 && day.core < 1;
    return ok(pass, { dawn: r3(dawn.moved), day: r3(day.moved), shade: r3(shade.moved), cos: +cos.toFixed(2), core: r3(day.core), sunK: r3(day.sunK) });
  },
});
