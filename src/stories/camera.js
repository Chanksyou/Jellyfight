// Stories: the camera. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, V, cameraSpots, cameraStory, fresh, ok, startVacuum, step, story, stub, tp } from './kit.js';

story('camera/desktop-starts-15-percent-closer', {
  about: 'Desktop gameplay starts at 0.765 m, 15% inside the 0.9 m outer limit; the wheel zooms in, and out only as far as that limit.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, player } = G(), start = tpc.distance;
    try {
      const mouse = { x: 0, y: 0, wheel: -1 };
      tpc.update(1 / 60, mouse, player.position);
      const zoomedIn = tpc.distance < start;
      mouse.wheel = 100;
      tpc.update(1 / 60, mouse, player.position);
      return ok(start === 0.765 && tpc.cfg.maxDistance === 0.9 && zoomedIn && tpc.distance === tpc.cfg.maxDistance,
        { start, max: tpc.cfg.maxDistance, zoomedIn, end: tpc.distance });
    } finally { tpc.distance = start; }
  },
});

// --- the camera (camera.js): up against walls and furniture it looks over them instead of
story('camera/fixed-view-fades-what-blocks', cameraStory([], 'Media_console_6'));
story('camera/fade-disposes-its-clones', {
  about: 'When whatever the camera faded comes back into the clear, the mesh gets its own material back and the see-through clones the fade made are disposed (nothing else holds them, so keeping them would leak a material per fade).',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, run } = G(), spots = cameraSpots([]);
    const p = spots[spots.length - 1];   // just off a wall: something fades there at some heading
    let mesh = null, f = null;
    for (let k = 0; k < 16 && !f; k++) { tp(p[0], p[1], p[2], (k * Math.PI) / 8); step(12); if (tpc._fades.size) [mesh, f] = [...tpc._fades][0]; }
    if (!f) return ok(false, { faded: false });
    let disposed = 0;
    for (const c of [].concat(f.see)) c.addEventListener('dispose', () => disposed++);
    const st = run.stage.start;
    tp(st[0], 0.05, st[2], 0); step(90);
    return ok(mesh.material === f.mats && !tpc._fades.has(mesh) && disposed === [].concat(f.see).length, { disposed, clones: [].concat(f.see).length, restored: mesh.material === f.mats });
  },
});
story('camera/see-through-is-cheap-to-draw', {
  about: 'A faded piece of lit furniture is drawn with a plain diffuse copy of its material (same colour, texture and baked corner shadows), in one pass, and High\'s AO doesn\'t draw it a second time; once it\'s clear it is its own solid self again. A see-through sofa back used to cost a fifth of the frame.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, run } = G();
    let mesh = null, f = null;
    for (const p of cameraSpots([])) for (let k = 0; k < 8 && !f; k++) {
      tp(p[0], p[1], p[2], (k * Math.PI) / 4); step(12);
      [mesh, f] = [...tpc._fades].find(([, x]) => !Array.isArray(x.mats) && x.mats.isMeshStandardMaterial) || [];
    }
    if (!f) return ok(false, { faded: false });
    const own = f.mats, see = f.see;
    const cheap = see.isMeshLambertMaterial && see.forceSinglePass && see.transparent && !see.depthWrite && see.map === own.map && see.color.equals(own.color) && see.side === own.side && see.onBeforeCompile === own.onBeforeCompile;
    const once = mesh.userData.treatAsOpaque === true;
    const st = run.stage.start;
    tp(st[0], 0.05, st[2], 0); step(90);
    const back = mesh.material === own && !tpc._fades.has(mesh) && !('treatAsOpaque' in mesh.userData);
    return ok(cheap && once && back, { mesh: mesh.name, see: see.type, single: see.forceSinglePass, once, back });
  },
});
story('camera/see-through-holds-and-clears-clutter', {
  about: 'What the camera sees through stays faded for a moment after it\'s clear (no flicker as the rays sweep a shelf of cups). Furniture and walls fade to see-through; a small prop (under 15 cm across) the jelly-to-camera ray hits fades only part way (never gone), and one a ray only grazes stays solid, on its own material. Everything that faded comes back on its own materials.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, APT } = G(), scene = APT.scene;
    const make = (s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial()); scene.add(m); m.updateMatrixWorld(true); return m; };
    const cup = make(0.06), grazed = make(0.06), cabinet = make(0.6), mats = [cup.material, cabinet.material, grazed.material];
    stub(tpc, 'findOver', () => {});                       // this story says what's in the way
    try {
      tpc.over.clear(); tpc.solid.clear(); tpc.partly.clear();
      tpc.over.add(cup); tpc.over.add(grazed); tpc.over.add(cabinet); tpc.partly.add(cup); tpc.solid.add(grazed);
      for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
      const cupK = tpc._fades.get(cup).k, cabK = tpc._fades.get(cabinet).k;
      const solid = !tpc._fades.has(grazed) && grazed.material === mats[2];
      tpc.over.clear(); tpc.solid.clear(); tpc.partly.clear();
      for (let i = 0; i < 15; i++) tpc.fade(1 / 60);       // 0.25 s after it's clear: still faded
      const held = Math.abs(tpc._fades.get(cup).k - 0.5) < 0.05 && tpc._fades.get(cabinet).k < 0.3;
      for (let i = 0; i < 90; i++) tpc.fade(1 / 60);
      const back = !tpc._fades.has(cup) && !tpc._fades.has(cabinet) && cup.material === mats[0] && cabinet.material === mats[1];
      return ok(Math.abs(cupK - 0.5) < 0.02 && Math.abs(cabK - 0.22) < 0.02 && solid && held && back, { cupK: +cupK.toFixed(3), cabK: +cabK.toFixed(3), solid, held, back });
    } finally { scene.remove(cup, grazed, cabinet); for (const m of [cup, grazed, cabinet]) m.geometry.dispose(); }
  },
});

// A prop for the real rays: a box on `at` metres along the line from the jelly to the camera
// (`side` m to its right, `up` above it), in the collision world until `done()`.
function propOnTheLine(at, side = 0, size = 0.06, up = 0) {
  const { tpc, world, APT } = G(), scene = APT.scene;
  const dir = V(0, 0, 0).subVectors(tpc.camera.position, tpc._jelly).normalize(), right = V(Math.cos(tpc.yaw), 0, -Math.sin(tpc.yaw));
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial());
  m.rotation.y = tpc.yaw;   // square to the line, so `side` is how far its edge is from it
  m.position.copy(tpc._jelly).addScaledVector(dir, at).addScaledVector(right, side); m.position.y += up;
  scene.add(m); m.updateMatrixWorld(true); world.addCollider(m, false);
  return { m, done() { scene.remove(m); const i = world.colliders.indexOf(m); if (i >= 0) { world.colliders.splice(i, 1); world.spheres.splice(i, 1); world.sweepBounds.splice(i, 1); world.dynamicColliders = world.dynamicColliders.filter((j) => j !== i).map((j) => (j > i ? j - 1 : j)); world._focusAge = Infinity; } m.geometry.dispose(); m.material.dispose(); } };
}
const settle = () => { const s = G().run.stage.start; tp(s[0], 0.05, s[2], 0.6); step(30); };

story('camera/grazed-small-prop-stays-solid', {
  about: 'A cup the camera\'s edge rays only brush past stays solid, whole and on its own material; a cup squarely between the jelly and the camera goes part way see-through (never fully gone), and is solid again once it\'s clear.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G();
    settle();
    const direct = propOnTheLine(0.3), grazed = propOnTheLine(0.6, 0.035), own = [direct.m.material, grazed.m.material];
    try {
      let lowest = 1;
      for (let i = 0; i < 90; i++) { step(1); const f = tpc._fades.get(direct.m); if (f) lowest = Math.min(lowest, f.k); }
      const classed = tpc.partly.has(direct.m) && tpc.solid.has(grazed.m) && tpc.over.has(grazed.m);
      const grazedSolid = !tpc._fades.has(grazed.m) && grazed.m.material === own[1];
      direct.done(); grazed.done(); step(90);
      return ok(classed && grazedSolid && lowest > 0.45 && lowest < 0.55 && direct.m.material === own[0] && !tpc._fades.size, { classed, grazedSolid, lowest: +lowest.toFixed(3), fades: tpc._fades.size });
    } finally { direct.done(); grazed.done(); }
  },
});

story('camera/direct-blocker-found-before-the-up-ray-skips-it', {
  about: 'A cup right over the jelly is found by both the ray straight up and the ray to the camera; the jelly-to-camera ray looks first, so the cup still counts as a direct blocker (part way see-through) rather than being skipped as already found.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G();
    settle();
    const cup = propOnTheLine(0, 0, 0.08, 0.05);   // 8 cm wide, floating just over the jelly's head: both the up ray and the ray to the camera go through it
    try {
      step(60);
      const f = tpc._fades.get(cup.m);
      return ok(tpc.partly.has(cup.m) && f && Math.abs(f.k - 0.5) < 0.02, { direct: tpc.partly.has(cup.m), k: f && +f.k.toFixed(3) });
    } finally { cup.done(); }
  },
});

story('camera/direct-ray-starts-at-the-jelly-not-the-focus', {
  about: 'In a jump the camera\'s focus lags the jelly; the jelly-to-camera ray starts at the jelly itself, so a cup on the jelly\'s own line to the camera is a direct blocker even while the focus is off to one side.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, player, world } = G();
    settle();
    const up = player.position.clone(); up.y += 0.25;        // the jelly leaps; the focus has only started to follow
    tpc.update(1 / 60, { x: 0, y: 0, wheel: 0 }, up);
    const lag = tpc.focus.distanceTo(tpc._jelly);
    const cup = propOnTheLine(0.3);
    try {
      world.focus(up, 1); tpc.findOver(tpc.camera.position);   // look again from this very pose
      const fromFocus = tpc.world.cast(tpc.focus, V(0, 0, 0).subVectors(tpc.camera.position, tpc.focus).normalize(), 1, null)?.mesh === cup.m;
      return ok(lag > 0.05 && tpc.partly.has(cup.m) && !fromFocus, { lag: +lag.toFixed(3), direct: tpc.partly.has(cup.m), fromFocus });
    } finally { cup.done(); tpc.snapTo(player.position); }
  },
});

story('camera/tea-shelf-sweep-stays-calm', {
  about: 'Standing on the tea shelves in the act 1 kitchen and turning the camera all the way round in 4 s, the cups and teapots stay on screen (none fades below half), and they don\'t flicker in and out (v264\'s calm: at most 8 quick reversals among them), with only a few of them see-through at once.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G(), sph = new THREE.Sphere(), last = new Map();
    tp(4.7, 1.55, 1.8, 0); step(30);
    let reversals = 0, lowest = 1, most = 0;
    for (let i = 0; i < 240; i++) {
      tpc.yaw += (Math.PI * 2) / 240; step(1);
      let now = 0;
      for (const [m, f] of tpc._fades) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        if (sph.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld).radius * 2 >= 0.15) continue;
        now++; lowest = Math.min(lowest, f.k);
        const L = last.get(m);
        if (!L) { last.set(m, { k: f.k, dir: 0, at: i }); continue; }
        const d = f.k - L.k;
        if (Math.abs(d) > 1e-3) { const dir = Math.sign(d); if (L.dir && dir !== L.dir && i - L.at < 10) reversals++; L.dir = dir; L.at = i; L.k = f.k; }
      }
      most = Math.max(most, now);
    }
    return ok(lowest > 0.45 && reversals <= 8 && most <= 8, { lowest: +lowest.toFixed(3), reversals, most });
  },
});

story('camera/kitchen-counter-stays-opaque', {
  about: 'The counter, stove, cookware and countertop clutter have no transparent materials and never fade when blocking the camera; other furniture still fades.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, APT } = G(), parts = [], groups = ['Kitchen', 'Gas_range', 'Range_controls', 'Saute_pan', 'Saucepan', 'Water_filter_pitcher', 'Oils_and_grinders', 'Blender', 'Kettle', 'Spice_carousel', 'Cutting_board', 'Glass_dish', 'Dish_cloth'];
    const missing = [];
    for (const name of groups) {
      const group = APT.scene.getObjectByName(name);
      if (!group) { missing.push(name); continue; }
      group.traverse((o) => { if (o.isMesh) parts.push(o); });
    }
    const mats = parts.map((m) => m.material);
    tpc.over.clear();
    for (const m of parts) tpc.over.add(m);
    for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
    const faded = parts.filter((m, i) => tpc._fades.has(m) || m.material !== mats[i]).length;
    const transparent = parts.filter((m) => [].concat(m.material).some((mat) => mat.transparent || mat.opacity !== 1 || mat.transmission > 0)).length;
    tpc.over.clear();
    return ok(missing.length === 0 && parts.length > 0 && faded === 0 && transparent === 0,
      { missing, parts: parts.length, faded, transparent });
  },
});

for(const [ending,onPhone] of [['victory',false],['death',false],['restart',false],['victory',true]])story((onPhone?'phone/':'camera/')+'vacuum-kitchen-transparent-only-during-fight-'+ending,{
  phone:onPhone,
  about:'Cabinets, stove and every kitchen fixture stay faint throughout the Vacuum fight, even off the camera rays; their original opaque materials and collision return after '+ending+'.',
  setup(){fresh({elites:false});},
  play(){const {APT,tpc,run,world}=G(),parts=[];APT.scene.traverse(m=>{if(m.isMesh&&m.userData.noCameraFade)parts.push(m);});
    const before=parts.map(m=>({material:m.material,visible:m.visible,collides:world.colliders.includes(m)})),programs=APT.renderer.info.programs.length;
    startVacuum('charge');step(60);const missed=parts.filter(m=>!tpc.keep.has(m)||![].concat(m.material).every(mat=>mat.transparent&&mat.opacity<=.16));
    G().batcher.sync();G().GAME.compile();const newShaders=APT.renderer.info.programs.length-programs;
    if(ending==='victory')run.onBossDead({impact:false});else if(ending==='death')run.die();else fresh({elites:false});
    const restored=parts.every((m,i)=>m.material===before[i].material&&m.visible===before[i].visible&&world.colliders.includes(m)===before[i].collides&&!tpc.keep.has(m));
    return ok(parts.length>0&&!missed.length&&restored&&newShaders===0,{parts:parts.length,missed:missed.slice(0,6).map(m=>m.name),restored,newShaders});},
});
