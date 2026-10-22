// A little picture of a jelly from its look (character.js), for the leaderboard: each player's own
// customized jelly next to their score. Drawn once per look with the game's renderer into a small
// target off screen, then kept as an image (cached by the look), so a board of ten costs ten small
// renders the first time it opens and nothing after. Its own tiny scene and lights: it is only ever
// drawn behind a menu, never during play.
import * as THREE from 'three';
import { buildCharacter, normalizeLook } from './character.js';
import { LOOK } from './look.js';

const SIZE = 128;
const cache = new Map();
let kit = null;

// the scene, camera, lights and target, made the first time a portrait is asked for
function setup() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#b4dfed', '#254156', 2.2));
  const key = new THREE.DirectionalLight('#b8e8f0', 2.5); key.position.set(-1, 2, 1.5);
  const rim = new THREE.DirectionalLight('#a3f5d5', 2); rim.position.set(1, 0.5, -1);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  return { scene, camera, target, canvas, ctx: canvas.getContext('2d'), pixels: new Uint16Array(SIZE * SIZE * 4), image: new ImageData(SIZE, SIZE) };
}

// the screen's ACES tone mapping and sRGB encoding (a render target gets neither), one channel triple
const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
function toScreen(r, g, b, exposure, out, i) {
  r *= exposure / 0.6; g *= exposure / 0.6; b *= exposure / 0.6;
  const ar = fit(0.59719 * r + 0.35458 * g + 0.04823 * b), ag = fit(0.076 * r + 0.90834 * g + 0.01566 * b), ab = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
  const clamp = (v) => Math.min(1, Math.max(0, v));
  out[i] = srgb(clamp(1.60475 * ar - 0.53108 * ag - 0.07367 * ab));
  out[i + 1] = srgb(clamp(-0.10208 * ar + 1.10813 * ag - 0.00605 * ab));
  out[i + 2] = srgb(clamp(-0.00327 * ar - 0.07276 * ag + 1.07602 * ab));
}

// A data URL of `look`'s jelly, three-quarter on, in a disc of the menu's deep water (the board shows
// it round); null if it can't be drawn
export function jellyPortrait(renderer, look) {
  const id = JSON.stringify(normalizeLook(look));
  if (cache.has(id)) return cache.get(id);
  let url = null;
  try {
    kit ||= setup();
    const { scene, camera, target, canvas, ctx, pixels, image } = kit;
    const avatar = buildCharacter(look, 0.09);
    avatar.update?.(0, { speed: 0, walkSpeed: 1, grounded: true, vy: 0, swim: 0 });
    avatar.root.rotation.y = -0.5;
    scene.add(avatar.root);
    const box = new THREE.Box3().setFromObject(avatar.root), mid = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    camera.position.set(mid.x, mid.y + r * 0.35, mid.z + r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.62);   // close: the bell and the tops of its arms fill the disc
    camera.lookAt(mid);
    const was = renderer.getRenderTarget(), clear = renderer.getClearAlpha(), color = renderer.getClearColor(new THREE.Color());
    // the menu's deep water behind it (linear here: it's encoded back on the way out)
    renderer.setRenderTarget(target); renderer.setClearColor(new THREE.Color(LOOK.color('menu-water-deep', '#06162e')).convertSRGBToLinear(), 1);
    renderer.clear(); renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
    renderer.setRenderTarget(was); renderer.setClearColor(color, clear);
    scene.remove(avatar.root); avatar.dispose?.();
    const half = THREE.DataUtils.fromHalfFloat, d = image.data, exposure = LOOK.num('portrait-exposure', renderer.toneMappingExposure || 1);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const s = ((SIZE - 1 - y) * SIZE + x) * 4, o = (y * SIZE + x) * 4;     // the target reads bottom row first
      toScreen(half(pixels[s]), half(pixels[s + 1]), half(pixels[s + 2]), exposure, d, o);
      d[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    url = canvas.toDataURL('image/png');
  } catch { url = null; }
  cache.set(id, url);
  return url;
}
