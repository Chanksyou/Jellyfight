// Stories: the camera. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { G, cameraSpots, cameraStory, fresh, ok, step, story, tp } from './kit.js';

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