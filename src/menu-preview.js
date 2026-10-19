// Isolated visual study: the production menu and avatar, with no run or apartment download.
import * as THREE from 'three';
import { buildCharacter, normalizeLook } from './character.js';
import { MainMenu } from './main-menu.js';
import { Creator } from './creator.js';
import { LOOK, loadLook } from './look.js';

await loadLook();
const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(LOOK.color('menu-water-deep', '#06162e'));
scene.add(new THREE.HemisphereLight('#b4dfed', '#254156', 2.2));
const lamp = new THREE.DirectionalLight('#b8e8f0', 2.5);
lamp.position.set(-1, 2, 1); scene.add(lamp);
const rim = new THREE.DirectionalLight('#a3f5d5', 2);
rim.position.set(1, 0.5, -1); scene.add(rim);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, 10);
const player = { position: new THREE.Vector3(), facing: 0, avatar: null };
let saved;
try { saved = JSON.parse(localStorage.getItem('jellyfight.look.v2')); } catch {}
let look = normalizeLook(saved);
function applyLook(next) {
  if (player.avatar) { scene.remove(player.avatar.root); player.avatar.dispose(); }
  look = normalizeLook(next);
  player.avatar = buildCharacter(look, 0.09);
  scene.add(player.avatar.root);
}
applyLook(look);
const overlay = document.querySelector('#g-over'), back = document.querySelector('#preview-back');
let muted = false, ctx, creating = false;
let calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
function plip() {
  if (muted) return;
  ctx ||= new (window.AudioContext || window.webkitAudioContext)(); ctx.resume();
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(410 + Math.random() * 70, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
  g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(t + 0.13);
}
function setCalm(on) {
  calm = on; document.body.classList.toggle('calm', on);
  overlay.querySelector('[data-act="effects"]').textContent = on ? '✨ Effects reduced' : '✨ Effects full';
}
setCalm(calm);
const menu = new MainMenu({ overlay, player, camera, scene, gfx: {}, height: 0.09, calm: () => calm, onPoke: plip });
const creator = new Creator({ onChange: applyLook, onDone: next => {
  applyLook(next); creating = false; creator.close(); overlay.hidden = false;
  try { localStorage.setItem('jellyfight.look.v2', JSON.stringify(look)); } catch {}
} });
creator.mount(document.body);
overlay.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('play')) { plip(); menu.launch(); if (!menu.launching) back.hidden = false; }
  if (b.dataset.act === 'creator') { menu.restore(); creating = true; overlay.hidden = true; creator.open(look); }
  if (b.dataset.act === 'effects') setCalm(!calm);
  if (b.dataset.act === 'sound') { muted = !muted; b.textContent = muted ? '🔇 Sound off' : '🔊 Sound on'; }
  if (b.dataset.act === 'board') { menu.restore(); overlay.hidden = true; back.hidden = false; }
  if (b.dataset.q) renderer.setPixelRatio(b.dataset.q === 'low' ? 1 : Math.min(devicePixelRatio, 2));
});
back.querySelector('button').onclick = () => { back.hidden = true; menu.show(); overlay.hidden = false; };
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  player.avatar.update(calm ? 0 : dt, { speed: 0, walkSpeed: 1, grounded: true, vy: 0 });
  camera.clearViewOffset();
  camera.position.set(0.18, 0.24, 0.38); camera.lookAt(0, 0.04, 0);
  const wasLaunching = menu.launching;
  if (creating) {
    const w = innerWidth, h = innerHeight;
    camera.position.set(0.06, 0.08, 0.25); camera.lookAt(0, 0.045, 0);
    camera.setViewOffset(w, h, w > 640 ? 170 : 0, w > 640 ? 0 : h * 0.29, w, h);
  } else menu.update(dt, !overlay.hidden);
  if (wasLaunching && !menu.launching) back.hidden = false;
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.menuPreview = { menu, player, camera, setCalm, renderer, creator, LOOK };
