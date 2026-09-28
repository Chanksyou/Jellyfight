// Jelly Fight game layer. The apartment page (index.html) builds the scene and
// runs the render loop; while GAME.active is true it calls GAME.step(dt) and
// GAME.render() instead of driving its own camera. G flips back to the original viewer.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World } from './collision.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { Input } from './input.js';
import { Graphics, QUALITY } from './graphics.js';
import { buildCharacter, normalizeLook } from './character.js';
import { Creator } from './creator.js';
import { Hud } from './hud.js';
import { addFloorDetail } from './detail.js';

const APT = window.APT;
const { scene, renderer, camera } = APT;

// Living room floor, between the sofa and the coffee table
const SPAWN = new THREE.Vector3(2.4, 0.05, 3.3);
const LOOK_KEY = 'jellyfight.look';
const MAX_HP = 10;              // 2 per heart
const SAFE_FALL = 0.7;          // meters you can drop without getting hurt
const SPRINT_SECONDS = 3.5;     // full stamina lasts this long
const REST_SECONDS = 2.5;       // time to refill from empty

// --- Saved character ------------------------------------------------------------
let savedLook = null;
try { savedLook = JSON.parse(localStorage.getItem(LOOK_KEY)); } catch {}
let look = normalizeLook(savedLook);

// --- UI -------------------------------------------------------------------------
const ui = document.createElement('div');
ui.id = 'game-ui';
ui.innerHTML = `
<style>
  #game-ui { display: none; }
  body.game #game-ui { display: block; }
  #g-over { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(10,12,20,.55); color: #fff;
    text-align: center; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; z-index: 10; }
  #g-over[hidden] { display: none; }
  #g-over h1 { margin: 0 0 4px; font-size: 46px; letter-spacing: -.01em; text-shadow: 0 3px 12px #0008; }
  #g-over .play { margin: 14px auto 18px; font: 600 18px system-ui, sans-serif; background: #ffd23a; color: #1d1a12; border: 0;
    border-radius: 14px; padding: 12px 34px; cursor: pointer; }
  #g-over .row { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  #g-over .row button { font: 14px system-ui, sans-serif; color: #fff; background: #ffffff1a; border: 1px solid #ffffff30;
    border-radius: 10px; padding: 8px 14px; cursor: pointer; }
  #g-over .row button.on { background: #fff; color: #111; }
  #g-over .keys { margin-top: 14px; opacity: .8; font-size: 13.5px; line-height: 2; }
  #g-over kbd { background: #fff2; border: 1px solid #fff4; border-radius: 4px; padding: 1px 6px; font-size: 12.5px; }
</style>
<div id="g-over"><div>
  <h1>Jelly Fight</h1>
  <button class="play">Play</button>
  <div class="row"><button data-act="creator">🎨 Edit character</button><button data-act="viewer">🏠 Apartment viewer</button></div>
  <div class="row" id="g-quality"></div>
  <div class="keys">
    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp; <kbd>Mouse</kbd> look &nbsp; <kbd>Space</kbd> jump &nbsp; <kbd>Shift</kbd> sprint<br>
    <kbd>Wheel</kbd> zoom &nbsp; <kbd>R</kbd> respawn &nbsp; <kbd>C</kbd> character &nbsp; <kbd>Esc</kbd> pause &nbsp; <kbd>G</kbd> viewer &nbsp; <kbd>F3</kbd> debug
  </div>
</div></div>`;
document.body.appendChild(ui);
const overlay = ui.querySelector('#g-over');
const qualityRow = ui.querySelector('#g-quality');

const hud = new Hud(APT.plan);
hud.mount(ui);
const creator = new Creator({
  onChange: (l) => applyLook(l, true),
  onDone: (l) => { saveLook(l); closeCreator(); },
});
creator.mount(ui);

// --- World + player -------------------------------------------------------------
const world = new World(scene, { exclude: [APT.OUT] }); // the neighbourhood outside isn't walkable
const detailed = addFloorDetail(world.colliders);
const input = new Input(renderer.domElement);
const player = new Player(world, CONFIG.player);
scene.add(player.mesh);
const tpc = new ThirdPersonCamera(camera, world, CONFIG.camera);
const gfx = new Graphics(renderer, scene, camera);

function applyLook(l, hop) {
  look = normalizeLook(l);
  player.setAvatar(buildCharacter(look, CONFIG.player.height));
  hud.setName(look.name);
  if (hop) player.avatar.land(1.2);
}
function saveLook(l) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch {}
}
applyLook(look);

// Soft blob shadow under the player. The apartment only re-renders its shadow map
// when furniture moves, so the player can't rely on a real cast shadow.
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(CONFIG.player.radius * 1.1, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
);
blob.renderOrder = 1;
scene.add(blob);
const DOWN = new THREE.Vector3(0, -1, 0);
function updateBlob() {
  const o = player.position.clone();
  o.y += CONFIG.player.height * 0.5;
  const hit = world.cast(o, DOWN, 3);
  blob.visible = !!hit;
  if (!hit) return;
  const h = player.position.y - hit.point.y;
  blob.position.set(player.position.x, hit.point.y + 0.0008, player.position.z);
  blob.scale.setScalar(look.size * (1 + h * 4));
  blob.material.opacity = 0.35 / (1 + h * 20);
}

// --- Health + stamina -----------------------------------------------------------
const stats = { hp: MAX_HP, stamina: 1, tired: false };
player.onLand = (drop) => {
  if (drop <= SAFE_FALL) return;
  const dmg = 1 + Math.floor((drop - SAFE_FALL) / 0.3);
  stats.hp = Math.max(0, stats.hp - dmg);
  hud.toast(stats.hp ? 'Ouch!' : 'Splat!');
  if (!stats.hp) setTimeout(respawn, 900);
};
function updateStats(dt) {
  if (player.sprinting) stats.stamina = Math.max(0, stats.stamina - dt / SPRINT_SECONDS);
  else stats.stamina = Math.min(1, stats.stamina + dt / REST_SECONDS);
  if (stats.stamina <= 0) stats.tired = true;
  if (stats.tired && stats.stamina > 0.35) stats.tired = false;
  player.canSprint = !stats.tired;
  hud.setStamina(stats.stamina, stats.tired);
  hud.setHealth(stats.hp, MAX_HP);
}

function respawn() {
  world.focus(SPAWN, 1);
  player.spawn(SPAWN);
  player.snapToGround();
  tpc.snapTo(player.position);
  stats.hp = MAX_HP;
  stats.stamina = 1;
  hud.setHealth(stats.hp, MAX_HP);
}

// --- Modes: 'play' (paused while the menu is up) and 'creator' --------------------
let mode = 'play';
let spin = 0.6, drag = null;

function openCreator() {
  mode = 'creator';
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = true;
  hud.el.hidden = true;
  creator.open(look);
  setViewOffset();
}
function closeCreator() {
  mode = 'play';
  input.enabled = true;
  creator.close();
  hud.el.hidden = false;
  camera.clearViewOffset();
  tpc.snapTo(player.position);
  hud.toast(`Go, ${look.name}!`);
  overlay.hidden = false; // "Play" grabs the mouse; browsers need a click for that
}
// Shift the picture so the critter isn't hidden behind the creator panel
function setViewOffset() {
  const w = innerWidth, h = innerHeight;
  const wide = w > 640;
  camera.setViewOffset(w, h, wide ? Math.min(360, w) / 2 : 0, wide ? 0 : h * 0.29, w, h);
}
addEventListener('resize', () => { if (mode === 'creator') setViewOffset(); });

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode === 'creator') drag = { x: e.clientX };
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  spin -= (e.clientX - drag.x) * 0.01;
  drag.x = e.clientX;
});
addEventListener('pointerup', () => { drag = null; });

function creatorCamera(dt) {
  if (!drag) spin += dt * 0.35;
  const p = player.position;
  const d = 0.12 * look.size, fy = CONFIG.player.height * 0.55 * look.size;
  const yaw = player.facing + spin;
  camera.position.set(p.x + Math.sin(yaw) * d, p.y + fy + 0.02, p.z + Math.cos(yaw) * d);
  camera.lookAt(p.x, p.y + fy, p.z);
  gfx.focus = d;
}

// --- Game mode on/off -------------------------------------------------------------
const saved = { near: camera.near };
let debug = false;
const GAME = {
  active: false,
  start() {
    this.active = true;
    APT.enterGame();
    document.body.classList.add('game');
    player.mesh.visible = blob.visible = true;
    camera.near = CONFIG.camera.near;
    camera.updateProjectionMatrix();
    if (mode === 'creator') setViewOffset();
    overlay.hidden = mode === 'creator' || document.pointerLockElement === renderer.domElement;
  },
  stop() {
    this.active = false;
    document.body.classList.remove('game');
    player.mesh.visible = blob.visible = false;
    if (document.pointerLockElement) document.exitPointerLock();
    camera.clearViewOffset();
    camera.near = saved.near;
    camera.updateProjectionMatrix();
    APT.exitGame();
  },
  step(dt) {
    if (mode === 'creator') {
      player.avatar.update(dt, { speed: 0, walkSpeed: 1, grounded: true, vy: 0 });
      creatorCamera(dt);
      updateBlob();
      return;
    }
    const paused = !overlay.hidden;
    if (!paused) {
      if (input.consumeReset() || player.position.y < -1) respawn();
      world.focus(player.position, dt);
      player.update(dt, input, tpc.yaw);
      updateStats(dt);
    } else {
      input.consumeReset();
      input.consumeJump();
      player.avatar.update(dt, { speed: 0, walkSpeed: 1, grounded: player.grounded, vy: 0 });
    }
    tpc.update(dt, input.consumeMouse(), player.position);
    gfx.focus = camera.position.distanceTo(player.position) + 0.005;
    updateBlob();
    hud.update(player.position, player.facing, tpc.yaw);
    if (debug) {
      const p = player.position;
      hud.setDebug(`x ${p.x.toFixed(2)}  y ${(p.y * 100).toFixed(1)} cm  z ${p.z.toFixed(2)}  |  ${player.grounded ? 'grounded' : 'airborne'}  |  ${gfx.quality}  |  ${world.nearby.length} nearby  |  ${detailed} detailed`);
    }
  },
  render() { gfx.render(); },
};
window.GAME = GAME;

// --- Menus + keys ---------------------------------------------------------------
function renderQuality() {
  qualityRow.innerHTML = 'Graphics: ' + QUALITY.map((q) => `<button data-q="${q}" class="${gfx.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('');
}
renderQuality();
overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('play')) renderer.domElement.requestPointerLock();
  else if (b.dataset.q) { gfx.setQuality(b.dataset.q); renderQuality(); }
  else if (b.dataset.act === 'creator') openCreator();
  else if (b.dataset.act === 'viewer') GAME.stop();
});
document.addEventListener('pointerlockchange', () => {
  if (GAME.active && mode === 'play') overlay.hidden = document.pointerLockElement === renderer.domElement;
});
addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest?.('input, textarea, select')) return;
  if (e.code === 'KeyG' && mode === 'play') GAME.active ? GAME.stop() : GAME.start();
  if (!GAME.active) return;
  if (e.code === 'KeyC' && mode === 'play') openCreator();
  else if (e.code === 'Escape' && mode === 'creator') { saveLook(look); closeCreator(); }
  if (e.code === 'F3') { e.preventDefault(); debug = !debug; hud.setDebug(''); }
});

respawn();
GAME.start();
hud.update(player.position, player.facing, tpc.yaw);
if (!savedLook) openCreator(); // first visit: make a character before playing

// Handy for poking at things from the browser console
Object.assign(window, { player, world, tpc, input, gfx, hud, creator });
