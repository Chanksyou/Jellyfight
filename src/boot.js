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
// The camera sits 2 mm from walls, which a normal depth buffer can't resolve (walls flicker).
// A reversed depth buffer can, at no cost, on any GPU with EXT_clip_control (Safari 17.4+ on
// iPhone, desktop Chrome). Without it: desktop uses log depth (slower, it turns off early depth
// tests) and phones a bigger near plane (main.js). Asked on a spare canvas, since a renderer
// can't switch afterwards.
const clipControl = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2')?.getExtension('EXT_clip_control'); } catch { return false; }
})();
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
  reversedDepthBuffer: clipControl, logarithmicDepthBuffer: !clipControl && !IS_TOUCH,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true; // the shark crosses the quilt through its own floor plane
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

// The loading screen stays up until the game is ready to play, saying what it's doing. Loading
// blocks the page for seconds at a time (building the rooms, the graphics), so each step waits for
// the screen to show it first; the swimming jelly (index.html) moves on its own meanwhile.
const bar = document.querySelector('#loading .bar i'), said = document.querySelector('#loading p');
const shown = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r)); setTimeout(r, 100); });   // (a hidden tab draws no frames)
window.JF_LOAD = {
  steps: [],
  // f: how far along the whole load is, 0 to 1
  at(f, text) {
    bar.style.transform = `scaleX(${f})`;
    if (text && said.textContent !== text) { said.textContent = text; this.steps.push([text, f]); }
    else if (this.steps.length) this.steps.at(-1)[1] = f;
  },
  step(f, text) { this.at(f, text); return shown(); },
};
const loading = window.JF_LOAD;
loading.steps.push([said.textContent, 0]);
try {
  if(new URLSearchParams(location.search).get('arena')==='act4'){
    await loadLook();
    const {startAct4Preview}=await import('./act4-preview.js');
    await startAct4Preview({scene,renderer,camera});
  }else if(currentStage().arena){
  // an act played in a built arena, not the apartment (act 4's concert): no rooms to load, and its
  // own lights as tuned (no apartment light scaling)
  await loadLook();
  const {buildAct4}=await import('./act4-arena.js'), stage=currentStage(), arena=buildAct4(scene);
  window.APT = { root: arena.root, plan: stage.plan, arena, doors: {}, scene, renderer, camera, lights: { rescan() {} }, load: async () => [] };
  await loadContent();
  await loading.step(0.55, 'Building the stage…');
  await (await import('./main.js')).ready;
  }else{
  // only the rooms this act is played in (apartment.js; stages.js picks the act)
  const apt = await loadApartment(scene, renderer, (f) => loading.at(0.45 * f, f >= 1 ? 'Unpacking the apartment…' : undefined), currentStage().parts);
  const lights = scaleLightsOnRender(renderer, scene);
  window.APT = Object.assign(apt, { scene, renderer, camera, lights });
  await loadLook();                 // content/look.css: colours and render numbers
  await loadContent();              // content/*.kdl: the bugs and the waves
  await loading.step(0.55, 'Building the rooms…');
  await (await import('./main.js')).ready;   // main.js: the game, then its graphics prepared (warmUp)
  }
  document.getElementById('loading').classList.add('gone');
} catch (e) {
  reportError(e, 'loading');
  said.textContent = 'Something went wrong while loading. Details below.';
}
