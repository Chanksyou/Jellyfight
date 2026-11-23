// Ambient life (src/ambient.js): plants sway and glasses shiver in the room's shared shader patch.
import * as THREE from 'three';
import { G, V, fresh, tp, step, ok, stub, story } from './kit.js';
import { GLOW_KIND } from '../treasure-glow.js';
import { juice } from '../juice.js';

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
function shot(piece, { time, gust = 0, calm = false, hem = false }) {
  const { APT, ambient, statics } = G(), R = APT.renderer, u = ambient.uniforms;
  const box = new THREE.Box3().setFromObject(piece), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const cam = target.cam ||= new THREE.PerspectiveCamera(40, 1, 0.01, 10);
  if (hem) {   // a hanging seen edge-on at its hem (along its long side), so a ripple across it shows sideways
    const s = box.getSize(new THREE.Vector3()), long = s.x > s.z ? V(1, 0, 0) : V(0, 0, 1);
    c.y = box.min.y + 0.1;
    cam.position.copy(c).addScaledVector(long, 0.55).add(V(0, 0.1, 0)); cam.far = 4;
  } else cam.position.copy(c).add(V(0.7, 0.35, 0.7).multiplyScalar(size));
  cam.lookAt(c); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  ambient.calm = () => calm;
  ambient.update(0, V(99, 0, 99), 0);   // (the jelly far off: only the gust set below)
  u.ambientTime.value = time;
  u.ambientGust.value.forEach((g) => g.set(0, 0, 0, 0));
  u.ambientGust.value[1].set(c.x + (hem ? 0 : 0.05), c.y, c.z + (hem ? 0.05 : 0), gust);
  const was = [statics.camera, R.getRenderTarget()];
  statics.camera = cam; statics.at.pos.x = Infinity; statics.sync();   // the batches culled for this camera
  target.rt ||= new THREE.WebGLRenderTarget(192, 192);
  const px = new Uint8Array(192 * 192 * 4);
  try { R.setRenderTarget(target.rt); R.render(APT.scene, cam); R.readRenderTargetPixels(target.rt, 0, 0, 192, 192, px); }
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

// ---- cloth: curtains and shades (A2)
const hangs = (name) => G().ambient.pieces.filter((p) => p.userData.ambient === 'cloth' && baseName(p.name) === name);
const clothOf = (p) => { const out = []; p.traverse((o) => { const a = o.isMesh && o.geometry.attributes.ambient; if (a) out.push(a); }); return out; };
// every hanging: its vertices move toward the hem and never at the rail, and no batch is split by the mark
function clothMarks(name) {
  const pieces = hangs(name), bad = [];
  let hem = 0, rail = 0;
  for (const p of pieces) for (const a of clothOf(p)) for (let i = 0; i < a.count; i++) {
    const y = a.getY(i);
    if (y > 0 || a.getX(i) !== 0) bad.push(p.name);
    if (y < -0.95) hem++;
    if (y === 0) rail++;
  }
  return { pieces: pieces.length, hem, rail, bad: bad.length };
}
const hangStory = (id, about, name, act) => story(id, {
  about, act,
  setup() { fresh({ elites: false }); },
  play() {
    const m = clothMarks(name), { statics } = G(), by = new Map();
    for (const b of statics.batches) { const k = b.batch.material.uuid; (by.get(k) || by.set(k, new Set()).get(k)).add(!!b.batch.geometry.attributes.ambient); }
    const mixed = [...by.values()].filter((s) => s.size > 1).length;
    return ok(m.pieces > 0 && m.hem > 0 && m.rail > 0 && !m.bad && !mixed, { ...m, mixed });
  },
});
hangStory('ambient/curtains-hang-from-the-rail-act-2', 'The shower curtain is pinned at its rod and free at the hem; the mark splits no batch.', 'Shower_curtain', 2);
hangStory('ambient/curtains-hang-from-the-rail-act-3', 'The sheer curtains are pinned at their rail and free at the hem; the mark splits no batch.', 'Sheer_curtain', 3);
hangStory('ambient/roller-shades-hang-from-the-rail', "The roller shades (act 1, and act 4 is the same room) swing from their rail; the mark splits no batch.", 'Roller_shade');
hangStory('ambient/act4-shades-match-act1', "Act 4 is act 1's room: its roller shades swing the same way.", 'Roller_shade', 4);

story('ambient/curtain-ripples-billows-and-holds-still-when-calm', {
  about: 'The shower curtain ripples a little on its own and billows out of the way when the jelly passes it; with Reduce effects on it holds its rest pose.',
  act: 2,
  setup() { fresh({ elites: false }); step(2); },
  play() {
    const { ambient } = G(), curtain = hangs('Shower_curtain')[0];
    if (!curtain) return ok(false, { curtain: 'not marked' });
    const calm = ambient.calm;
    try {
      const a = shot(curtain, { time: 1, hem: true }), idle = moved(a, shot(curtain, { time: 2.6, hem: true }));
      const gusted = moved(a, shot(curtain, { time: 1, gust: 1, hem: true }));
      const held = moved(shot(curtain, { time: 1, calm: true, hem: true }), shot(curtain, { time: 2.6, gust: 1, calm: true, hem: true }));
      return ok(idle > 0 && gusted > 0 && held === 0, { idle, gusted, held });
    } finally { ambient.calm = calm; }
  },
});

story('ambient/clog-fight-curtain-still-faint-and-moving', {
  about: "The Clog's see-through shower curtain keeps its ripple when the fight fades it: the faint copy runs the same shader.",
  act: 2,
  setup() { fresh({ elites: false }); },
  play() {
    const curtain = hangs('Shower_curtain')[0];
    if (!curtain) return ok(false, { curtain: 'not marked' });
    const mats = []; curtain.traverse((o) => o.isMesh && o.geometry.attributes.ambient && mats.push(o.material));
    return ok(mats.length > 0 && mats.every((m) => m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && m.defaultAttributeValues?.ambient), { patched: mats.length });
  },
});

// --- Dendi asleep in his box by the cat scratcher (acts 1 and 4; cat.js addDendi, a stage's `cat`)
const BOX = [4.155, 0.006, 4.53];
const drawn = (n) => { for (let i = 0; i < n; i++) { G().GAME.step(1 / 60); G().GAME.render(); } };
const calls = () => { const R = G().APT.renderer; R.info.reset(); R.info.autoReset = false; G().GAME.render(); const c = R.info.render.calls; R.info.autoReset = true; return c; };
function asleepInBox() {
  const d = G().dendi;
  let solid = 0; d.group.traverse((o) => { if (o.isMesh && !o.userData.noCollide) solid++; });
  const at = d.group.position.toArray().every((v, i) => Math.abs(v - BOX[i]) < 1e-3);
  return ok(d.asleep && d.group.visible && d.state() === 'sleep' && at && d.atHome() && solid === 0,
    { asleep: d.asleep, visible: d.group.visible, state: d.state(), at: d.group.position.toArray(), solid });
}
story('ambient/dendi-sleeps-in-his-box', {
  about: 'In act 1 Dendi sleeps in his cardboard box by the cat scratcher all night: shown, in the sleep pose, and nothing he is made of is solid.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() { step(30); return asleepInBox(); },
});
story('ambient/dendi-sleeps-in-act-4-too', {
  about: 'Act 4 is act 1\'s room at dawn: Dendi is still asleep in the same box.',
  act: 4,
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() { step(30); return asleepInBox(); },
});
story('ambient/dendi-breathes-in-view-and-costs-nothing-out-of-it', {
  about: 'Seen, Dendi\'s sides rise and fall (his bones are posed a few times a second); turned away from, his bones are not touched and he adds no draw. Reduce effects holds him in one pose.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); stub(juice, 'calm', false); },
  play() {
    const { dendi: d, tpc } = G(), spine = () => d.bones.spine.quaternion.clone();
    const look = (yaw, x = 3.95, z = 4.05) => { tp(x, 0, z, yaw); tpc.yaw = yaw; tpc.snapTo(G().player.position); drawn(10); };
    // in view: he moves, and costs his draws
    look(Math.PI);
    const a = spine(); drawn(40); const breathes = a.angleTo(spine()) > 1e-4;
    const withCat = calls(); d.group.visible = false; const without = calls(); d.group.visible = true;
    // out of view: no posing, no draw
    look(0, 3.5, 3.0);
    const b = spine(); drawn(60); const still = b.angleTo(spine()) < 1e-9;
    const awayWith = calls(); d.group.visible = false; const awayWithout = calls(); d.group.visible = true;
    // Reduce effects: one pose, held
    look(Math.PI);
    juice.calm = true; drawn(5);
    const c = spine(); drawn(40); const calm = c.angleTo(spine()) < 1e-9;
    juice.calm = false;
    return ok(breathes && still && awayWith === awayWithout && withCat > without && calm,
      { breathes, still, drawsInView: withCat - without, drawsAway: awayWith - awayWithout, calm });
  },
});

// --- Rain on the windows: act 1 only (rain.js, a stage's `rain`)
const rainyPanes = () => { const out = []; G().APT.root.traverse((o) => { if (o.isMesh && o.material?.userData?.rain) out.push(o); }); return out; };
const cityHaze = () => { let h = null; G().APT.scene?.traverse?.((o) => { if (o.name === 'Skyline') h = o.material; }); return h; };
story('ambient/rain-only-in-act-1', {
  about: 'Act 1\'s window glass carries the rain (on the panes\' own material: no new mesh, so no draw is added) and its room tone has the rain layers; act 4 is the same room at dawn and stays dry.',
  setup() { fresh({ elites: false }); },
  async play() {
    const panes = rainyPanes(), { BEDS, ONCE } = await import('../ambience.js');
    const own = panes.every((p) => p.parent?.name === 'Shell' && p.material.transparent);
    const sound = BEDS[1].length > BEDS[4].length && ONCE[1].some((e) => e.name === 'far-thunder') && !ONCE[4].some((e) => e.name === 'far-thunder');
    return ok(panes.length >= 2 && own && sound, { panes: panes.map((p) => p.name), own, sound });
  },
});
story('ambient/act4-glass-is-dry', {
  about: 'Act 4 is act 1\'s room at dawn: no rain on its glass.',
  act: 4,
  setup() { fresh({ elites: false }); },
  play() { const panes = rainyPanes(); return ok(!panes.length, { panes: panes.length }); },
});
story('ambient/rain-adds-no-draws', {
  about: 'The rain costs no draw call: the same view draws exactly as many calls with the drops painted as with the glass clear.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const panes = rainyPanes(), { tpc } = G();
    tp(3.4, 0, 0.9, 0); tpc.yaw = 0; tpc.snapTo(G().player.position); drawn(10);
    const wet = calls(), u = panes[0]?.material.userData.rain, was = u?.rainTint.value.w;
    if (u) u.rainTint.value.w = 0;
    const dry = calls();
    if (u) u.rainTint.value.w = was;
    return ok(panes.length > 0 && wet === dry, { wet, dry });
  },
});

// ---- light on the floor, the idle screen and a living city (A3)
const pools = () => G().APT.root.children.filter((o) => o.name.startsWith('Floor light'));
const tvScreen = () => { let m; G().APT.scene.traverse((o) => { if (o.name === 'TV screen') m = o; }); return m; };

story('ambient/floor-pools-are-one-soft-draw-each', {
  about: "Act 1's TV and monitor pools are one draw each (twice over when the frame draws the room for its AO and its picture), soft (the Treasure glow's soft kind: no ring, fading to nothing at the edge, dimmer than the jelly's glow), no light, and they drift in colour but hold a steady one under Reduce effects.",
  setup() { fresh({ elites: false }); tp(1.6, 0.05, 3.4, Math.PI); step(2); },
  play() {
    const { ambient, floorLight } = G(), found = pools(), was = found.map((p) => p.visible);
    if (found.length !== 2 || !floorLight) return ok(false, { pools: found.length });
    const soft = found.every((p) => !p.isLight && p.material.uniforms.uKind.value === GLOW_KIND.soft && p.material.uniforms.uOpacity.value <= 0.4);
    const calm = ambient.calm, colour = (t) => { ambient.uniforms.ambientTime.value = t; floorLight.update(); return found[0].material.uniforms.uColor.value.getHex(); };
    let moves, still;
    try {
      moves = colour(0) !== colour(9);
      ambient.calm = () => true;
      still = colour(0) === colour(9);
    } finally { ambient.calm = calm; }
    found.forEach((p) => (p.visible = false));
    drawn(2);
    const without = calls();
    found.forEach((p, i) => (p.visible = was[i]));
    const delta = calls() - without;
    return ok(soft && moves && still && delta <= found.length * 2, { soft, moves, still, delta });
  },
});

story('ambient/act4-keeps-the-tv-for-the-concert', {
  about: "Act 4 has only the monitor's pool and a TV with no screensaver (the concert dressing owns it); act 1's TV has one.",
  act: 4,
  setup() { fresh({ elites: false }); },
  play() {
    const tv = tvScreen();
    return ok(pools().length === 1 && tv && tv.material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile, { pools: pools().length, tv: !!tv });
  },
});

story('ambient/tv-shows-a-screensaver', {
  about: "Act 1's wall TV is no longer a black panel: it draws slow drifting colours of its own (and the same draw as before).",
  setup() { fresh({ elites: false }); },
  play() {
    const tv = tvScreen();
    return ok(tv && tv.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && tv.material.type === 'MeshStandardMaterial', { tv: !!tv });
  },
});

story('ambient/night-light-pool-in-act-3', {
  about: "Act 3's night light has its own soft pool on the floor that drifts between pink and amber; act 3 has no TV pools.",
  act: 3,
  setup() { fresh({ elites: false }); },
  play() {
    const { floorLight, ambient } = G(), found = pools();
    if (found.length !== 1 || found[0].name !== 'Floor light night') return ok(false, { names: found.map((p) => p.name) });
    const colour = (t) => { ambient.uniforms.ambientTime.value = t; floorLight.update(); return found[0].material.uniforms.uColor.value.getHex(); };
    return ok(colour(0) !== colour(40), { a: colour(0), b: colour(40) });
  },
});

// The city's own windows and beacons are worked out in the skyline's shader from the room's one clock (ambient.js).
// A picture of it is not taken here: drawing the skyline into a target of its own recompiled its heavy shader and took
// minutes under CI's software renderer. What is checked is what the shader is given.
story('ambient/city-twinkles-at-night', {
  about: "The city outside runs on the room's one clock: its windows switch and its beacons blink while that clock runs, and with Reduce effects it is held (the clock's \"on\" is 0), so the city keeps the picture it was painted with.",
  setup() { fresh({ elites: false }); },
  play() {
    const { ambient, APT } = G(), calm = ambient.calm, sky = APT.scene.getObjectByName('Skyline');
    const mat = sky?.material, U = ambient.uniforms;
    if (!mat) return ok(false, { sky: false });
    try {
      ambient.calm = () => false; ambient.update(0.5, V(99, 0, 99), 0);
      const on = U.ambientOn.value, t0 = U.ambientTime.value; ambient.update(0.5, V(99, 0, 99), 0);
      const runs = on === 1 && U.ambientTime.value > t0;
      ambient.calm = () => true; ambient.update(0.5, V(99, 0, 99), 0);
      const held = U.ambientOn.value === 0;
      const patched = mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && /ambientOn/.test(String(mat.onBeforeCompile));
      return ok(runs && held && patched, { runs, held, patched });
    } finally { ambient.calm = calm; ambient.update(0, V(99, 0, 99), 0); }
  },
});

// ---- the powered apartment (A4): status lights and smoke (src/powered.js)
const poweredParts = () => G().powered?.parts || [];
const lightCount = () => G().powered?.lights?.geometry.attributes.position.count ?? 0;

story('ambient/status-lights-and-smoke-are-one-draw-each', {
  about: "Act 1's little lights (the PC and the console) are one Points draw and its two smoke threads one more (drawn twice over when the frame draws the room for its AO and its picture); neither adds a light.",
  setup() { fresh({ elites: false }); tp(1.5, 0.05, 3.5, Math.PI); step(2); },
  play() {
    const { powered, APT } = G(), parts = poweredParts();
    if (!powered?.lights || !powered.smoke) return ok(false, { parts: parts.length });
    let lights = 0; APT.scene.traverse((o) => { if (o.isLight) lights++; });
    const was = parts.map((p) => p.visible);
    drawn(2);
    const withAll = calls();
    parts.forEach((p) => (p.visible = false));
    const without = calls();
    parts.forEach((p, i) => (p.visible = was[i]));
    const delta = withAll - without;
    return ok(lightCount() === 3 && delta > 0 && delta <= parts.length * 2 && parts.every((p) => p.parent === APT.root), { lights: lightCount(), delta, parts: parts.length, inRoom: parts.every((p) => p.parent === APT.root) });
  },
});

story('ambient/smoke-is-the-vent-wisp-shader-in-grey', {
  about: 'The smoke is the vents\' own wisp shader (no new program), grey-white and drawn with normal blending, never additive; Low draws none of it.',
  setup() { fresh({ elites: false }); },
  play() {
    const { powered, traversal } = G(), wisp = traversal.air.parts[2].material, m = powered?.smoke?.material;
    if (!m) return ok(false, { smoke: false });
    const c = m.uniforms.uColor.value, same = m.vertexShader === wisp.vertexShader && m.fragmentShader === wisp.fragmentShader;
    const plain = m.blending === THREE.NormalBlending && c.r > 0.7 && Math.abs(c.r - c.g) < 0.05 && Math.abs(c.g - c.b) < 0.08;
    const low = powered.low; let dropped, kept;
    try { powered.low = () => true; powered.update(0.016); dropped = !powered.smoke.visible; powered.low = () => false; powered.update(0.016); kept = powered.smoke.visible; } finally { powered.low = low; }
    return ok(same && plain && dropped && kept, { same, plain, dropped, kept });
  },
});

story('ambient/status-lights-blink-and-hold-steady-when-calm', {
  about: 'The lights run on the clock (the blink, the breath and the flicker are worked out in their shader); under Reduce effects every light stays on and nothing blinks.',
  setup() { fresh({ elites: false }); },
  play() {
    const { powered } = G(), u = powered?.lights?.material.uniforms;
    if (!u) return ok(false, { lights: false });
    const calm = powered.calm; let moving, held, calmFlag;
    try {
      powered.calm = () => false; powered.update(0.5); const a = u.uTime.value; powered.update(0.5); moving = u.uTime.value > a && u.uCalm.value === 0;
      powered.calm = () => true; powered.update(0.5); held = u.uTime.value === 0; calmFlag = u.uCalm.value === 1;
    } finally { powered.calm = calm; }
    const pats = [...powered.lights.geometry.attributes.pat.array].filter((_, i) => i % 4 === 0), period = [...powered.lights.geometry.attributes.pat.array].filter((_, i) => i % 4 === 1);
    return ok(moving && held && calmFlag && new Set(pats).size >= 2 && period.every((p) => 600 % p === 0), { moving, held, calmFlag, patterns: [...new Set(pats)], period });
  },
});

story('ambient/act4-has-the-same-lights-and-smoke', {
  about: 'Act 4 is act 1\'s room: it has the same status lights and the same two smoke threads.',
  act: 4,
  setup() { fresh({ elites: false }); },
  play() { return ok(lightCount() === 3 && !!G().powered?.smoke, { lights: lightCount(), smoke: !!G().powered?.smoke }); },
});

story('ambient/act2-has-smoke-only', {
  about: "Act 2's bathroom has the candle's and the oil burner's curls and steam over the tub, and no status lights.",
  act: 2,
  setup() { fresh({ elites: false }); },
  play() { return ok(!G().powered?.lights && !!G().powered?.smoke, { lights: !!G().powered?.lights, smoke: !!G().powered?.smoke }); },
});

story('ambient/act3-has-a-light-and-a-plume', {
  about: "Act 3's bedroom has the air purifier's light and the humidifier's plume, and nothing for the sleeping baby.",
  act: 3,
  setup() { fresh({ elites: false }); },
  play() { return ok(lightCount() === 1 && !!G().powered?.smoke, { lights: lightCount(), smoke: !!G().powered?.smoke }); },
});
