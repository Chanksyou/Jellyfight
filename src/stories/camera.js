// Stories: the camera. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, cameraSpots, cameraStory, fresh, ok, startVacuum, step, story, stub, tp } from './kit.js';

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
story('camera/see-through-holds-and-clears-clutter', {
  about: 'What the camera sees through stays faded for a moment after it\'s clear (no flicker as the rays sweep a shelf of cups), and small clutter (under 15 cm across) fades right out rather than to see-through, while furniture and walls fade to see-through as before. Both come back on their own materials.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { tpc, APT } = G(), scene = APT.scene;
    const make = (s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial()); scene.add(m); m.updateMatrixWorld(true); return m; };
    const cup = make(0.06), cabinet = make(0.6), mats = [cup.material, cabinet.material];
    stub(tpc, 'findOver', () => {});                       // this story says what's in the way
    try {
      tpc.over.clear(); tpc.over.add(cup); tpc.over.add(cabinet);
      for (let i = 0; i < 60; i++) tpc.fade(1 / 60);
      const cupK = tpc._fades.get(cup).k, cabK = tpc._fades.get(cabinet).k;
      tpc.over.clear();
      for (let i = 0; i < 15; i++) tpc.fade(1 / 60);       // 0.25 s after it's clear: still faded
      const held = tpc._fades.get(cup).k < 0.05 && tpc._fades.get(cabinet).k < 0.3;
      for (let i = 0; i < 90; i++) tpc.fade(1 / 60);
      const back = !tpc._fades.has(cup) && !tpc._fades.has(cabinet) && cup.material === mats[0] && cabinet.material === mats[1];
      return ok(cupK < 0.02 && Math.abs(cabK - 0.22) < 0.02 && held && back, { cupK: +cupK.toFixed(3), cabK: +cabK.toFixed(3), held, back });
    } finally { scene.remove(cup, cabinet); cup.geometry.dispose(); cabinet.geometry.dispose(); }
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
