// Ambient life (src/ambient.js): plants sway and glasses shiver in the room's shared shader patch.
import * as THREE from 'three';
import { G, V, fresh, tp, step, ok, stub, story } from './kit.js';

// the plants every act-1 room has (act 4 is the same room: the same list)
const ACT1_PLANTS = ['Aloe', 'Monstera', 'Pilea', 'Pothos', 'Rubber_plant', 'Snake_plant', 'Tall_snake_plant'];
const marked = (kind) => G().ambient.pieces.filter((p) => p.userData.ambient === kind);
const baseName = (n) => n.replace(/(\.\d+|_\d+)+$/, '');

// how the marks sit: plants move above the pot only, glasses all over, and no batch is split by them
function marks() {
  const { statics } = G(), out = { plants: [], glasses: marked('rattle').length, still: [], mixed: [] };
  for (const p of marked('sway')) {
    let top = 0, pot = 0;
    p.traverse((o) => {
      const a = o.isMesh && o.geometry.attributes.ambient;
      if (!a) return;
      let most = 0;
      for (let i = 0; i < a.count; i++) most = Math.max(most, a.getX(i));
      top = Math.max(top, most);
      if (most === 0) pot++;
    });
    out.plants.push(baseName(p.name));
    if (top < 0.5) out.still.push(p.name);
  }
  // a material drawn in a batch with the mark and in another without it would have cost a draw
  const by = new Map();
  for (const b of statics.batches) {
    const k = b.batch.material.uuid, has = !!b.batch.geometry.attributes.ambient;
    if (!by.has(k)) by.set(k, new Set());
    by.get(k).add(has);
  }
  for (const [k, s] of by) if (s.size > 1) out.mixed.push(k);
  return out;
}

story('ambient/plants-and-glasses-are-marked', {
  about: 'Every act-1 plant sways above its pot and the glassware can shiver; the marks never split a furniture batch, so no draw is added.',
  setup() { fresh({ elites: false }); },
  play() {
    const m = marks(), missing = ACT1_PLANTS.filter((n) => !m.plants.includes(n));
    return ok(!missing.length && m.glasses >= 5 && !m.still.length && !m.mixed.length, { ...m, plants: m.plants.length, missing });
  },
});

story('ambient/act4-sways-like-act1', {
  about: "Act 4 is act 1's room at dawn: the same plants sway and the same glasses shiver, and no batch is split.",
  act: 4,
  setup() { fresh({ elites: false }); },
  play() {
    const m = marks(), missing = ACT1_PLANTS.filter((n) => !m.plants.includes(n));
    return ok(!missing.length && m.glasses >= 5 && !m.still.length && !m.mixed.length, { ...m, plants: m.plants.length, missing });
  },
});

// The room drawn small from a camera on a plant, with the clock and the gusts set by hand
const target = {};
function shot(piece, { time, gust = 0, calm = false }) {
  const { APT, ambient, statics } = G(), R = APT.renderer, u = ambient.uniforms;
  const box = new THREE.Box3().setFromObject(piece), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const cam = target.cam ||= new THREE.PerspectiveCamera(40, 1, 0.01, 10);
  cam.position.copy(c).add(V(0.7, 0.35, 0.7).multiplyScalar(size)); cam.lookAt(c); cam.updateMatrixWorld();
  ambient.calm = () => calm;
  ambient.update(0, V(99, 0, 99), 0);   // (the jelly far off: only the gust set below)
  u.ambientTime.value = time;
  u.ambientGust.value.forEach((g) => g.set(0, 0, 0, 0));
  u.ambientGust.value[1].set(c.x + 0.05, c.y, c.z, gust);
  const was = [statics.camera, R.getRenderTarget()];
  statics.camera = cam; statics.at.pos.x = Infinity; statics.sync();   // the batches culled for this camera
  target.rt ||= new THREE.WebGLRenderTarget(96, 96);
  const px = new Uint8Array(96 * 96 * 4);
  try { R.setRenderTarget(target.rt); R.render(APT.scene, cam); R.readRenderTargetPixels(target.rt, 0, 0, 96, 96, px); }
  finally { statics.camera = was[0]; statics.at.pos.x = Infinity; R.setRenderTarget(was[1]); }
  return px;
}
const moved = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++; return n; };

story('ambient/plants-answer-a-gust', {
  about: 'A Monstera sways a little on its own and bends away from a gust; with Reduce effects on it holds its rest pose, gust or not, and nothing is uploaded for it.',
  setup() { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0.8); step(2); },
  play() {
    const { ambient } = G(), plant = marked('sway').find((p) => baseName(p.name) === 'Monstera');
    if (!plant) return ok(false, { plant: 'no Monstera marked' });
    const calm = ambient.calm, versions = () => ambient.pieces.flatMap((p) => { const v = []; p.traverse((o) => o.isMesh && o.geometry.attributes.ambient && v.push(o.geometry.attributes.ambient.version)); return v; }).join();
    const v0 = versions();
    try {
      const a = shot(plant, { time: 1 }), idle = moved(a, shot(plant, { time: 2.6 }));
      const gusted = moved(a, shot(plant, { time: 1, gust: 1 }));
      const r = shot(plant, { time: 1, calm: true }), held = moved(r, shot(plant, { time: 2.6, gust: 1, calm: true }));
      step(60);
      const uploads = v0 === versions() ? 0 : 1;
      return ok(idle > 0 && gusted > 0 && held === 0 && uploads === 0, { idle, gusted, held, uploads });
    } finally { ambient.calm = calm; }
  },
});

story('ambient/hits-and-the-jelly-make-gusts', {
  about: "The jelly moving is a gust round itself and still is none; a big hit landing (a Boss slam) is a gust that dies away, a small one isn't.",
  setup() { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0.8); step(2); },
  play() {
    const { ambient, fx, player } = G(), g = ambient.uniforms.ambientGust.value;
    stub(player, 'update', () => {});
    player.velocity.set(0, 0, 0); step(1);
    const still = g[0].w;
    player.velocity.set(0.8, 0, 0); step(1);
    const moving = g[0].w, near = Math.hypot(g[0].x - player.position.x, g[0].y - player.position.y, g[0].z - player.position.z) < 1e-6;
    g.forEach((x, i) => i && (x.w = 0));
    fx.impact(player.position.clone(), 0xffffff, 0.01, 0);
    const small = Math.max(g[1].w, g[2].w, g[3].w);
    fx.impact(player.position.clone(), 0xffffff, 0.08, 0);
    const big = Math.max(g[1].w, g[2].w, g[3].w);
    step(60);
    const later = Math.max(g[1].w, g[2].w, g[3].w);
    return ok(still === 0 && moving > 0.9 && near && small === 0 && big > 0.9 && later === 0, { still, moving, near, small, big, later });
  },
});
