// Loads three.js, runs the apartment (a classic script kept as-is in #apartment-src), then starts the game.
import { reportError, watchCanvas } from './errors.js';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { patchLegacyFalloff, scaleLightsOnRender } from './legacy-lighting.js';

// The apartment converts its own colors from sRGB (its C() helper), the way r128 worked.
T.ColorManagement.enabled = false;
patchLegacyFalloff(T);
window.THREE = { ...T, OrbitControls };

const script = document.createElement('script');
script.textContent = document.getElementById('apartment-src').textContent;
document.body.appendChild(script);

if (!window.APT) {
  const msg = document.getElementById('loading');
  if (msg) msg.textContent = 'The apartment failed to load. Check the browser console.';
  throw new Error('Apartment script failed (window.APT missing)');
}
scaleLightsOnRender(window.APT.renderer, window.APT.scene);
watchCanvas(window.APT.renderer.domElement);
try {
  await import('./main.js');
} catch (e) {
  reportError(e, 'starting the game');
}
