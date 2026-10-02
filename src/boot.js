// Sets up three.js, loads the baked apartment, then starts the game.
import { reportError, watchCanvas } from './errors.js';
import * as THREE from 'three';
import { patchLegacyFalloff, scaleLightsOnRender } from './legacy-lighting.js';
import { loadApartment } from './apartment.js';
import { IS_TOUCH } from './touch.js';
import { loadLook } from './look.js';
import { loadContent } from './content.js';
import { currentStage } from './stages.js';

// The apartment's colors and lights were authored for three.js r128 conventions
THREE.ColorManagement.enabled = false;
patchLegacyFalloff(THREE);

const canvas = document.getElementById('c');
// Log depth lets the camera sit 2 mm from a wall without flicker, but it's too slow for
// phone GPUs, which get a slightly bigger near plane instead (see main.js).
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: !IS_TOUCH });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
watchCanvas(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.002, 200);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const bar = document.querySelector('#loading .bar i');
try {
  // only the rooms this act is played in (apartment.js; stages.js picks the act)
  const apt = await loadApartment(scene, renderer, (f) => { bar.style.width = `${Math.round(f * 100)}%`; }, currentStage().parts);
  const lights = scaleLightsOnRender(renderer, scene);
  window.APT = Object.assign(apt, { scene, renderer, camera, lights });
  await loadLook();                 // content/look.css: colours and render numbers
  await loadContent();              // content/*.kdl: the bugs and the waves
  await import('./main.js');
  document.getElementById('loading').classList.add('gone');
} catch (e) {
  reportError(e, 'loading');
  document.querySelector('#loading p').textContent = 'Something went wrong while loading. Details below.';
}
