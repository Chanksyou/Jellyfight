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
  about: 'What the camera sees through stays faded for a moment after it\'s clear (no flicker as the rays sweep past). Furniture larger than twice the jelly fades to see-through; small props (at most twice the jelly\'s height) stay completely solid on their own materials. Everything that faded comes back on its own materials.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, APT } = G(), scene = APT.scene;
    const make = (s, y = 0.3) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial()); m.position.y = y; scene.add(m); m.updateMatrixWorld(true); return m; };
    const cup = make(0.06), small = make(0.16), cabinet = make(0.6), mats = [cup.material, small.material, cabinet.material];
    stub(tpc, 'findOver', () => {});                       // this story says what's in the way
    try {
      tpc.over.clear(); tpc.solid.clear();
      tpc.over.add(cup); tpc.over.add(small); tpc.over.add(cabinet);
      for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
      const cabK = tpc._fades.get(cabinet).k;
      const smallSolid = !tpc._fades.has(cup) && cup.material === mats[0] && !tpc._fades.has(small) && small.material === mats[1];
      tpc.over.clear(); tpc.solid.clear();
      for (let i = 0; i < 15; i++) tpc.fade(1 / 60);       // 0.25 s after it's clear: still faded
      const held = tpc._fades.get(cabinet).k < 0.3;
      for (let i = 0; i < 90; i++) tpc.fade(1 / 60);
      const back = !tpc._fades.has(cabinet) && cabinet.material === mats[2];
      return ok(Math.abs(cabK - 0.22) < 0.02 && smallSolid && held && back, { cabK: +cabK.toFixed(3), smallSolid, held, back });
    } finally { scene.remove(cup, small, cabinet); for (const m of [cup, small, cabinet]) m.geometry.dispose(); }
  },
});

// A prop for the real rays: a box on `at` metres along the line from the jelly to the camera
// (`side` m to its right, `up` above it), in the collision world until `done()` hides it.
function propOnTheLine(at, side = 0, size = 0.06, up = 0) {
  const { tpc, world, APT } = G(), scene = APT.scene;
  const dir = V(0, 0, 0).subVectors(tpc.camera.position, tpc._jelly).normalize(), right = V(Math.cos(tpc.yaw), 0, -Math.sin(tpc.yaw));
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial());
  m.rotation.y = tpc.yaw;   // square to the line, so `side` is how far its edge is from it
  m.position.copy(tpc._jelly).addScaledVector(dir, at).addScaledVector(right, side); m.position.y += up;
  scene.add(m); m.updateMatrixWorld(true); world.addCollider(m, false);
  // the world has no way to drop a collider (its sweep grid is indexed by position in the list): hiding it takes it out of every ray and sweep
  return { m, done() { m.visible = false; scene.remove(m); } };
}
const settle = () => { const s = G().run.stage.start; tp(s[0], 0.05, s[2], 0.6); step(30); };

story('camera/grazed-small-prop-stays-solid', {
  about: 'Items no larger than twice the jelly\'s height (~18 cm) stay completely solid on their own materials whether squarely between the jelly and the camera or grazed by an edge ray; a larger item (> 2x jelly) on the line fades out and comes back solid once clear.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G();
    settle();
    const cup = propOnTheLine(0.25, 0, 0.06), grazed = propOnTheLine(0.55, 0.035, 0.16), big = propOnTheLine(0.4, 0, 0.22);
    const own = [cup.m.material, grazed.m.material, big.m.material];
    try {
      let lowest = 1;
      for (let i = 0; i < 90; i++) { step(1); const f = tpc._fades.get(big.m); if (f) lowest = Math.min(lowest, f.k); }
      const classed = tpc.solid.has(cup.m) && tpc.solid.has(grazed.m) && tpc.over.has(big.m) && !tpc.solid.has(big.m);
      const smallSolid = !tpc._fades.has(cup.m) && cup.m.material === own[0] && !tpc._fades.has(grazed.m) && grazed.m.material === own[1];
      cup.done(); grazed.done(); big.done(); step(90);
      return ok(classed && smallSolid && lowest > 0.2 && lowest < 0.26 && big.m.material === own[2] && !tpc._fades.size, { classed, smallSolid, lowest: +lowest.toFixed(3), fades: tpc._fades.size });
    } finally { cup.done(); grazed.done(); big.done(); }
  },
});

story('camera/direct-blocker-found-before-the-up-ray-skips-it', {
  about: 'A blocker larger than twice the jelly right over its head is found and faded out cleanly.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G();
    settle();
    const box = propOnTheLine(0, 0, 0.22, 0.15);   // 22 cm wide, floating over the jelly's head
    try {
      step(60);
      const f = tpc._fades.get(box.m);
      return ok(tpc.over.has(box.m) && !tpc.solid.has(box.m) && f && Math.abs(f.k - 0.22) < 0.03, { over: tpc.over.has(box.m), k: f && +f.k.toFixed(3) });
    } finally { box.done(); }
  },
});

story('camera/direct-ray-starts-at-the-jelly-not-the-focus', {
  about: 'In a jump the camera\'s focus lags the jelly; the jelly-to-camera ray starts at the jelly itself, so a blocker on the jelly\'s own line to the camera is found even while the focus is off to one side.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, player, world } = G();
    settle();
    const up = player.position.clone(); up.y += 0.25;        // the jelly leaps; the focus has only started to follow
    tpc.update(1 / 60, { x: 0, y: 0, wheel: 0 }, up);
    const lag = tpc.focus.distanceTo(tpc._jelly);
    const box = propOnTheLine(0.3, 0, 0.22);
    box.m.scale.set(1, 0.25, 0.25); box.m.updateMatrixWorld(true);   // 22 cm wide (> 2x jelly) but 5.5x5.5 cm in cross-section, so the lagged focus ray passes under it
    try {
      world.focus(up, 1); tpc.findOver(tpc.camera.position);   // look again from this very pose
      const fromFocus = tpc.world.cast(tpc.focus, V(0, 0, 0).subVectors(tpc.camera.position, tpc.focus).normalize(), 1, null)?.mesh === box.m;
      return ok(lag > 0.05 && tpc.over.has(box.m) && !tpc.solid.has(box.m) && !fromFocus, { lag: +lag.toFixed(3), over: tpc.over.has(box.m), fromFocus });
    } finally { box.done(); tpc.snapTo(player.position); }
  },
});

story('camera/tea-shelf-sweep-stays-calm', {
  about: 'Standing on the tea shelves in the act 1 kitchen and turning the camera all the way round in 4 s, small cups and teapots (at most twice the jelly\'s height) stay completely solid and never flicker.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc } = G(), box = new THREE.Box3(), sz = new THREE.Vector3(), minFade = tpc.cfg.minFadeSize;
    tp(4.7, 1.55, 1.8, 0); step(30);
    let smallFaded = 0;
    for (let i = 0; i < 240; i++) {
      tpc.yaw += (Math.PI * 2) / 240; step(1);
      for (const m of tpc._fades.keys()) {
        if (m.isInstancedMesh || !m.geometry) continue;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).getSize(sz);
        if (Math.max(sz.x, sz.y, sz.z) <= minFade) smallFaded++;
      }
    }
    return ok(smallFaded === 0, { smallFaded });
  },
});

story('camera/flat-floor-and-play-gym-stay-solid', {
  about: 'Flat items lying on the floor (Kitchen mat, pet floor mat, rugs) and the entire Baby play gym (mat, arches and hanging toys) never fade for the camera, without making the camera dolly round them; an elevated thin board like a tabletop still fades.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, APT } = G(), scene = APT.scene;
    const parts = [], missing = [];
    for (const name of ['Baby_play_gym', 'Kitchen_mat']) {
      const g = scene.getObjectByName(name);
      if (!g) { missing.push(name); continue; }
      g.traverse((o) => { if (o.isMesh) parts.push(o); });
    }
    const pet = scene.getObjectByName('Pet_corner');
    const box = new THREE.Box3();
    let petFlat = 0;
    if (pet) pet.traverse((o) => { if (o.isMesh && box.setFromObject(o).max.y <= 0.05) { parts.push(o); petFlat++; } });
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshStandardMaterial());
    rug.position.set(0, 0.01, 0); scene.add(rug); rug.updateMatrixWorld(true);
    const tabletop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshStandardMaterial());
    tabletop.position.set(0, 0.4, 0); scene.add(tabletop); tabletop.updateMatrixWorld(true);
    const mats = [...parts, rug].map((m) => m.material);
    stub(tpc, 'findOver', () => {});
    try {
      tpc.over.clear(); tpc.solid.clear();
      for (const m of [...parts, rug, tabletop]) tpc.over.add(m);
      for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
      const stayedSolid = [...parts, rug].every((m, i) => !tpc._fades.has(m) && m.material === mats[i]);
      const noDolly = parts.every((m) => !m.userData.noCameraFade);
      const topFaded = tpc._fades.has(tabletop) && Math.abs(tpc._fades.get(tabletop).k - 0.22) < 0.02;
      tpc.over.clear();
      for (let i = 0; i < 90; i++) tpc.fade(1 / 60);
      return ok(!missing.length && parts.length >= 7 && petFlat >= 1 && stayedSolid && noDolly && topFaded && !tpc._fades.size,
        { missing, parts: parts.length, petFlat, stayedSolid, noDolly, topFaded });
    } finally { scene.remove(rug, tabletop); rug.geometry.dispose(); tabletop.geometry.dispose(); }
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

story('camera/kitchen-in-the-way-tilts-and-clears', {
  about: 'With the camera on the far side of the kitchen counters, the view tilts steeper and the lens stays in front of them (they never fade); in the open it is the player\'s own tilt again.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, player, world } = G(), base = tpc.pitch;
    const lensInFront = () => {
      const jelly = V(player.position.x, player.position.y + tpc.cfg.height, player.position.z), to = tpc.camera.position.clone().sub(jelly), far = to.length();
      const h = world.cast(jelly, to.multiplyScalar(1 / far), far, null, 2);
      return !h || !h.mesh.userData.noCameraFade;
    };
    tp(4.2, 0, 3.2, Math.PI / 2);   // the counters sit between this jelly and a camera that has swung east
    step(60);
    const tilted = tpc.lift > 0.9 && tpc.viewPitch > base + 0.15, clear = lensInFront(), pulled = tpc.pull > 0;
    tp(3.0, 0, 3.2, Math.PI / 2);   // out in the open, same view
    step(60);
    const back = tpc.lift === 0 && Math.abs(tpc.viewPitch - base) < 1e-6;
    return ok(tilted && clear && back, { tilted, clear, pulled, lift: +tpc.lift.toFixed(3), back });
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

// --- the walls, floors and ceilings (userData.structural: tools/exporter.js) never fade, and the camera keeps inside them
const structuralMeshes = () => { const out = []; G().APT.scene.traverse((o) => { if (o.isMesh && o.userData.structural) out.push(o); }); return out; };
// the camera's view as asked for: where the focus, the yaw and the tilt put the lens at full distance
const askedFor = (tpc, out) => out.copy(tpc.focus).addScaledVector(tpc.dirAt(tpc.viewPitch, new THREE.Vector3()), tpc.currentDistance);

story('camera/shell-never-fades', {
  about: 'Walls, floors, ceilings, window glass and door leaves of the apartment are marked structural when it is baked: the camera never fades them, even blocking the view, and builds no see-through copy of them ahead of time. Furniture beside them still fades.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc } = G(), shell = structuralMeshes(), box = new THREE.Box3(), size = new THREE.Vector3();
    const tall = shell.filter((m) => m.name.startsWith('Shell') && box.setFromObject(m).getSize(size).y > 2).length;
    const doors = shell.filter((m) => m.parent?.name.startsWith('door-')).length;
    const withTag = tpc.seeThroughWarmers().length;
    for (const m of shell) m.userData.structural = false;
    const withoutTag = tpc.seeThroughWarmers().length;     // what the warm-up would build if they could fade
    for (const m of shell) m.userData.structural = true;
    const piece = G().APT.scene.getObjectByName('Media_console_6');
    tpc.over.clear();
    for (const m of [...shell, piece]) tpc.over.add(m);
    for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
    const faded = shell.filter((m) => tpc._fades.has(m)).length, furniture = tpc._fades.has(piece);
    tpc.over.clear();
    for (let i = 0; i < 90; i++) tpc.fade(1 / 60);
    return ok(shell.length >= 60 && tall >= 10 && doors >= 5 && withoutTag - withTag >= 4 && faded === 0 && furniture && !tpc._fades.size,
      { structural: shell.length, tall, doors, warmed: withTag, wouldWarm: withoutTag, faded, furniture, left: tpc._fades.size });
  },
});

story('camera/front-doorway-has-a-floor', {
  about: 'The front doorway is floored across the wall\'s thickness, under the door, with a piece that seals the rooms: a camera low in the hall\'s corner sees floor there, never the night outside.',
  setup() { fresh({ elites: false }); },
  play() {
    const shell = structuralMeshes(), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), hits = [], missing = [];
    ray.far = 0.1;
    for (let x = 3.6; x <= 3.72; x += 0.03) for (let z = 8.1; z <= 8.92; z += 0.1) {
      ray.set(new THREE.Vector3(x, 0.05, z), down);
      hits.length = 0;
      for (const m of shell) THREE.Mesh.prototype.raycast.call(m, ray, hits);   // the triangles themselves, facing up
      if (!hits.length) missing.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return ok(!missing.length, { missing: missing.slice(0, 6) });
  },
});

story('camera/stays-inside-the-shell', {
  about: 'Hugging every wall of the living room and hallway at every heading (the jelly 4 and 10 cm off it), the camera keeps the yaw and tilt asked for and comes in along that view just far enough that, with 4 cm for the near plane and combat shake, no wall, floor or ceiling is between it and the jelly; only when that would be closer than 16 cm does it stop there (a lens that close sits at most 4 cm into a 14 cm wall, looking away from it). Out in the room it sits at full distance.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, world, APT } = G(), cam = tpc.camera.position, c = tpc.cfg, shake = 0.012, want = askedFor(tpc, new THREE.Vector3());
    const stats = { views: 0, pulled: 0, free: 0, notFull: 0, crossed: 0, tilt: 0, bound: 0, deepest: 0, shaken: 0 };
    const toCam = new THREE.Vector3(), turned = new THREE.Vector3();
    for (const [room, P] of APT.plan.filter(([n]) => n === 'Living room' || n === 'Hallway')) {
      for (let e = 0; e < P.length; e++) {
        const [ax, az] = P[e], [bx, bz] = P[(e + 1) % P.length], L = Math.hypot(bx - ax, bz - az);
        for (const inset of [0.04, 0.1]) for (let t = 0.15; t < L - 0.1; t += 0.4) {
          let nx = -(bz - az) / L, nz = (bx - ax) / L;
          const px = ax + ((bx - ax) * t) / L, pz = az + ((bz - az) * t) / L;
          if (!APT.plan.some(([n, Q]) => { let c2 = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { if ((Q[i][1] > pz + nz * inset) !== (Q[j][1] > pz + nz * inset) && px + nx * inset < ((Q[j][0] - Q[i][0]) * (pz + nz * inset - Q[i][1])) / (Q[j][1] - Q[i][1]) + Q[i][0]) c2 = !c2; } return n === room && c2; })) { nx = -nx; nz = -nz; }
          for (let k = 0; k < 8; k += 2) {
            tp(px + nx * inset, 0.05, pz + nz * inset, (k * Math.PI) / 4); step(8);
            const dist = cam.distanceTo(tpc.focus), yaw = tpc.yaw;
            stats.views++;
            toCam.subVectors(cam, tpc.focus).normalize();
            if (toCam.angleTo(tpc.dirAt(tpc.viewPitch, turned)) > 1e-4 || tpc.yaw !== yaw) stats.tilt++;   // never turned
            const hit = world.cast(tpc.focus, toCam, 2, null, true);
            if (tpc.pull > 1e-3) stats.pulled++; else { stats.free++; if (Math.abs(dist - tpc.currentDistance) > 1e-3) stats.notFull++; }
            if (dist > c.clearMin + 1e-3) {
              // free to choose its distance: the lens, the shake and the near plane all stay in front of the wall
              for (const [sx, sy, sz] of [[0, 0, 0], [1, 1, 1], [-1, 1, -1], [1, -1, 1], [-1, -1, -1]]) {
                const end = cam.clone().add(new THREE.Vector3(sx, sy, sz).multiplyScalar(shake));
                const to = end.clone().sub(tpc.focus), len = to.length(), h = world.cast(tpc.focus, to.normalize(), len, null, true);
                if (h) { stats.shaken++; stats.deepest = Math.max(stats.deepest, len - h.distance); }
              }
              if (hit && hit.distance < dist) { stats.crossed++; }
            } else if (hit) stats.bound = Math.max(stats.bound, dist - hit.distance);   // stopped at the least it comes in: how far into the wall
          }
        }
      }
    }
    return ok(stats.views > 150 && stats.pulled > 20 && stats.free > 20 && stats.notFull === 0 && stats.tilt === 0 && stats.crossed === 0 && stats.shaken === 0 && stats.bound <= c.clearMin / 2 + 1e-3,
      { ...stats, bound: +stats.bound.toFixed(3), deepest: +stats.deepest.toFixed(3), clearMin: c.clearMin, want: want.toArray().map((v) => +v.toFixed(2)) });
  },
});

story('camera/eases-back-out-after-a-wall', {
  about: 'Backed against a wall the camera comes in at once; turning away so the wall is clear, it stays in for 0.1 s, then eases most of the way back out in about 0.25 s, never closer to the wall than its clearance on any frame, and it is at full distance after that.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, world } = G(), cam = tpc.camera.position, none = { x: 0, y: 0, wheel: 0 }, toCam = new THREE.Vector3(), c = tpc.cfg;
    tp(2.0, 0.05, 0.8, 0); step(10);                       // the window wall: yaw 0 puts the camera on the far side of it
    let yaw = tpc.yaw, towards = null;
    for (let k = 0; k < 16 && !towards; k++) { tpc.yaw = (k * Math.PI) / 8; step(6); if (tpc.pull > 0.2) towards = tpc.yaw; }
    if (towards === null) return ok(false, { pull: tpc.pull });
    const pulled = tpc.pull, atOnce = tpc.currentDistance - cam.distanceTo(tpc.focus);
    tpc.yaw = towards + Math.PI;                           // looking back the other way: the wall is clear
    const log = [], inside = [];
    for (let i = 0; i < 90; i++) {
      tpc.update(1 / 60, none, G().player.position);
      log.push(tpc.pull);
      toCam.subVectors(cam, tpc.focus); const len = toCam.length(), h = world.cast(tpc.focus, toCam.normalize(), len, null, true);
      if (h && h.distance < len) inside.push(i);
    }
    const f = (s) => log[Math.round(s * 60) - 1];
    return ok(Math.abs(atOnce - pulled) < 1e-3 && f(0.08) > pulled * 0.99 && f(0.1 + 0.25) < pulled * 0.2 && f(1.4) < 1e-3 && !inside.length,
      { pulled: +pulled.toFixed(3), at80ms: +f(0.08).toFixed(3), at350ms: +f(0.35).toFixed(3), at1400ms: +f(1.4).toFixed(4), inside });
  },
});

story('camera/front-door-keeps-the-camera-in', {
  about: 'At the hallway\'s end, with the jelly\'s back to the front door, the camera comes in instead of going out through the shut door into the corridor: door leaves are part of the shell.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, world, APT } = G(), cam = tpc.camera.position, front = APT.doors.front?.node;
    if (!front) return ok(false, { door: false });
    const at = front.getWorldPosition(new THREE.Vector3());
    const worst = { before: 0, after: 0 }, tried = [];
    for (let k = 0; k < 16; k++) {
      tp(at.x - 0.2, 0.05, at.z, (k * Math.PI) / 8); step(10);
      const away = cam.x - tpc.focus.x;   // the door is on +x of the jelly
      tried.push(+(cam.x - at.x).toFixed(3));
      worst.after = Math.max(worst.after, cam.x - at.x);
    }
    // the same views with the clearance off: the camera ends outside the door (what the shell prevents)
    const margin = tpc.cfg.clearMargin; tpc.cfg.clearMargin = 0;
    try {
      for (let k = 0; k < 16; k++) { tp(at.x - 0.2, 0.05, at.z, (k * Math.PI) / 8); step(10); worst.before = Math.max(worst.before, cam.x - at.x); }
    } finally { tpc.cfg.clearMargin = margin; }
    return ok(worst.before > 0.1 && worst.after < 0.05, { door: at.toArray().map((v) => +v.toFixed(2)), outsideWithout: +worst.before.toFixed(3), outsideWith: +worst.after.toFixed(3) });
  },
});
