// The view from the 33rd floor: through every window you look out over the city and down on it, not
// at a flat dark wall. One unlit ring round the apartment, painted once on a small canvas (like
// canvas-decals): street lights spread far below the horizon, a few towers standing about as high
// as you, their windows lit. Never a light, one draw call. Numbers: content/look.css --skyline-*.
import * as THREE from 'three';
import { LOOK } from './look.js';

// its own little random stream, so painting the city never moves the game's rolls (stories replay seeds)
function stream(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function addSkyline(scene, centre) {
  const R = LOOK.num('skyline-radius', 90), up = LOOK.num('skyline-up', 25), down = LOOK.num('skyline-down', 100);   // metres: the ring's reach, above the horizon and below it (33 floors is about 100 m)
  const W = 1024, H = 512, horizon = H * up / (up + down);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), rnd = stream(33);
  const tower = LOOK.color('skyline-tower', '#080b16'), lit = LOOK.list('skyline-lights', ['#ffd9a0', '#ffb468', '#bcd6ff']), street = LOOK.color('skyline-street', '#ffa653');
  // far below: the grid of streets, dots thinning toward the horizon
  for (let i = 0, n = LOOK.num('skyline-street-dots', 2600); i < n; i++) {
    const depth = rnd() ** 0.6, y = horizon + 6 + depth * (H - horizon - 8), x = rnd() * W;
    g.globalAlpha = 0.25 + 0.6 * depth * rnd(); g.fillStyle = rnd() < 0.8 ? street : lit[2];
    const s = 1 + depth * 1.4; g.fillRect(Math.round(x), Math.round(y), s, s * 0.7);
  }
  // towers about as tall as the 33rd floor, with their windows lit
  g.globalAlpha = 1;
  for (let x = 0; x < W; x += 6 + rnd() * 26) {
    const w = 14 + rnd() * 30, top = horizon - (rnd() ** 2) * horizon * 0.5 + rnd() * 20, bot = horizon + 4 + rnd() * 30;
    g.fillStyle = tower; g.fillRect(x, top, w, bot - top);
    for (let wy = top + 4; wy < bot - 3; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 5) {
      if (rnd() < LOOK.num('skyline-window-chance', 0.22)) { g.globalAlpha = 0.5 + rnd() * 0.5; g.fillStyle = lit[(rnd() * lit.length) | 0]; g.fillRect(wx, wy, 2, 3); g.globalAlpha = 1; }
    }
  }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, up + down, 48, 1, true),
    new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
  mesh.position.set(centre[0], (up - down) / 2, centre[1]);   // the horizon at the floor's own height, give or take the camera's
  mesh.renderOrder = -10; mesh.name = 'Skyline'; mesh.userData.noCollide = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
