// Runs the apartment app (tools/apartment-source.html) just far enough to build its scene,
// so tools/exporter.js can bake the static space into assets/apartment.glb.
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

T.ColorManagement.enabled = false;   // the apartment converts its own colors from sRGB
window.THREE = { ...T, OrbitControls };
const script = document.createElement('script');
script.textContent = document.getElementById('apartment-src').textContent;
document.body.appendChild(script);
const { exportApartment } = await import('./exporter.js');
window.exportApartment = exportApartment;
window.EXPORT_READY = !!window.APT;
