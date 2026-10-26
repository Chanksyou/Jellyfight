// Stories: the camera. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, cameraSpots, cameraStory, fresh, ok, step, story, stub, tp } from './kit.js';
import { CONFIG } from '../config.js';

// --- the camera (camera.js): up against walls and furniture it looks over them instead of
story('camera/fixed-view-fades-what-blocks', cameraStory([], 'Media_console_6'));
story('camera/starts-close-and-low', {
  about: 'A run starts with the camera close and low behind the jelly (about 26 degrees down, 50 cm back): the floor ahead runs out to the furniture, with the jelly near the middle of the screen. The player can still tilt it up and zoom out.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc, run } = G(), camera = tpc.camera, c = CONFIG.camera, was = [tpc.pitch, tpc.distance], s = run.stage.start;
    try {
      tpc.pitch = c.pitch; tpc.distance = c.distance;
      tp(s[0], 0.05, s[2], 0); step(30);
      const at = tpc.focus.clone().project(camera), up = camera.position.y - tpc.focus.y;
      return ok(Math.abs(c.pitch - 0.45) < 1e-6 && Math.abs(c.distance - 0.5) < 1e-6 && c.pitch >= c.minPitch && c.distance <= c.maxDistance && up < 0.25 && Math.abs(at.x) < 0.05 && Math.abs(at.y) < 0.2,
        { pitch: c.pitch, distance: c.distance, height: +up.toFixed(3), onScreen: [+at.x.toFixed(2), +at.y.toFixed(2)] });
    } finally { [tpc.pitch, tpc.distance] = was; }
  },
});
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
