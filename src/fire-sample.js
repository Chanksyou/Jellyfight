// A focused audition of the real fire attack, using the game's renderer pieces and audio.
import * as THREE from 'three';
import { buildCharacter, DEFAULT_LOOK } from './character.js';
import { Bubbles } from './bubbles.js';
import { Fx } from './fx.js';
import { batcher } from './batch.js';
import { loadLook } from './look.js';
import { newMods, elementParams } from './words.js';
import { BASE_STATS } from './stats.js';
import { bus } from './events.js';
import { sfx, unlock, setMuted, isMuted } from './sfx.js';

await loadLook();
const stage = document.querySelector('#stage');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 10);
camera.position.set(0.23, 0.33, 0.56);
camera.lookAt(0, 0.035, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
stage.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'A glowing jelly firing at three training bugs');
window.APT = { renderer }; // Fx uses the game's drawing-buffer size for world-sized particles.
batcher.scene = scene;
scene.add(new THREE.HemisphereLight(0xc0e9ff, 0x28313d, 2.6));
const key = new THREE.DirectionalLight(0xffdda8, 3);
key.position.set(-0.3, 0.6, 0.4); scene.add(key);
const rim = new THREE.DirectionalLight(0x53c9ff, 2);
rim.position.set(0.2, 0.3, -0.5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.016, 80), new THREE.MeshStandardMaterial({ color: 0x192632, roughness: 0.65, metalness: 0.3 }));
ground.position.y = -0.01; scene.add(ground);
const grid = new THREE.GridHelper(0.6, 12, 0x3b4b57, 0x283a45);
grid.position.y = -0.001; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
const jelly = buildCharacter({ ...DEFAULT_LOOK, color: '#64e6da', accent: '#418dff', eyes: 'big' }, 0.095);
jelly.root.position.set(-0.16, 0.012, 0.02); jelly.root.rotation.y = Math.PI / 2; scene.add(jelly.root);
const fx = new Fx(scene, camera);
const origin = new THREE.Vector3(-0.155, 0.082, 0.02);
const targets = [];
for (let k = 0; k < 3; k++) {
  const root = new THREE.Group();
  root.position.set(0.1 + k * 0.049, 0.018, (k - 1) * 0.043);
  const material = new THREE.MeshStandardMaterial({ color: 0x50647a, roughness: 0.4, metalness: 0.3, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
  body.scale.set(0.023, 0.016, 0.031); root.add(body);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), material);
  face.position.set(-0.026, 0, 0); root.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffc674 });
  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0023, 8, 6), eyeMat);
    eye.position.set(-0.032, 0.003, sign * 0.005); root.add(eye);
    for (let n = 0; n < 3; n++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.025, 4), material);
      leg.position.set(-0.013 + n * 0.013, -0.006, sign * 0.024); leg.rotation.x = sign * 1.2; root.add(leg);
    }
  }
  scene.add(root);
  targets.push({ id: `sample-${k}`, r: 0.025, hp: 35, maxHp: 35, dead: false, T: { fly: false }, position: root.position, root, body, material, flash: 0, freezeT: 0 });
}
const enemies = { list: targets, center(e, out = new THREE.Vector3()) { return out.copy(e.position).addScaledVector(THREE.Object3D.DEFAULT_UP, 0.012); } };
const shots = new Bubbles(scene, enemies, fx, { cast: () => null, castAll: () => null });
const stats = { ...BASE_STATS }, mods = newMods();
mods.elements.add('fire'); mods.element.fire = elementParams('fire');
let mode = 'single', elapsed = 0, nextCast = 1, lastCast = -10, auto = matchMedia('(prefers-reduced-motion: reduce)').matches ? false : true;
setMuted(true);
document.querySelector('#loop').checked = auto;

function reset() {
  shots.reset(); fx.clear();
  for (const e of targets) { e.hp = e.maxHp; e.dead = false; e.flash = 0; }
}
function cast() {
  if (elapsed - lastCast < 1 / mods.element.fire.rate) return false;
  reset();
  shots.elementVolley('fire', mods.element.fire, origin, stats, mods);
  jelly.pulse(0.65);
  lastCast = elapsed; nextCast = elapsed + (mode === 'volley' ? 6.2 : 4.2);
  return true;
}
bus.on('damage_taken', ({ targetId, amount, source }) => {
  const e = targets.find(e => e.id === targetId);
  if (!e || e.dead) return;
  e.hp = Math.max(0, e.hp - amount); e.flash = source === 'fire' ? 0.25 : 1;
  if (source === 'bubble') sfx.hit();
  if (e.hp === 0) { e.dead = true; fx.burst(e.position, ['#ffc363', '#ff7c32'], 6, 0.002, 0.08, 0); }
});
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  mods.element.fire = { ...elementParams('fire'), ...(mode === 'volley' ? { count: 1, burn: 1.5, burnTime: 5 } : {}) };
  document.querySelector('#cast').textContent = mode === 'volley' ? 'Cast the fire volley ↗' : 'Cast a fireball ↗';
  lastCast = -10; cast();
}));
document.querySelector('#cast').addEventListener('click', () => { unlock(); cast(); });
document.querySelector('#sound').addEventListener('click', () => {
  unlock(); setMuted(!isMuted());
  const on = !isMuted(), button = document.querySelector('#sound');
  button.textContent = on ? 'Sound on · Mute' : 'Enable sound'; button.setAttribute('aria-pressed', String(on));
  if (on) { lastCast = -10; cast(); }
});
document.querySelector('#loop').addEventListener('change', e => { auto = e.target.checked; nextCast = elapsed + 0.2; });
const observer = new ResizeObserver(() => {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
});
observer.observe(stage);
document.querySelector('#status').hidden = true; document.querySelector('#cast').disabled = false;
let previous = performance.now();
const idle = { speed: 0, vy: 0, grounded: false };
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.04); previous = now;
  if (!document.hidden) {
    elapsed += dt;
    if (auto && elapsed >= nextCast) cast();
    jelly.update(dt, idle); shots.fly(dt, stats, mods); shots.effects(dt, stats); fx.update(dt);
    for (const e of targets) {
      e.flash = Math.max(0, e.flash - dt * 6);
      e.material.emissive.setRGB(e.flash * 0.8, e.flash * 0.22, e.flash * 0.03);
      e.body.scale.y = 0.016 * (1 - e.flash * 0.12);
      e.root.visible = !e.dead;
    }
    batcher.sync(); renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Small inspection surface for the local preview's checks and capture, like GAME in main.js.
window.fireSample = { cast, reset, shots, fx, renderer, get state() { return { mode, audioMuted: isMuted(), projectiles: shots.list.length, particles: fx.glow.parts.length, drawCalls: renderer.info.render.calls, burning: shots.burning.size }; } };
