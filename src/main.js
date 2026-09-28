// Jelly Fight: wires the game together on top of the baked apartment (src/boot.js loads it).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World } from './collision.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { Input } from './input.js';
import { Graphics, QUALITY } from './graphics.js';
import { buildCharacter, normalizeLook } from './character.js';
import { Creator } from './creator.js';
import { Hud, inPoly } from './hud.js';
import { addSurfaceDetail } from './detail.js';
import { STAGE1 } from './stage1.js';
import { prepareApartment, addStageWalls, Traversal } from './traversal.js';
import { Enemies, TYPES } from './enemies.js';
import { Clog } from './boss.js';
import { reportError, enableDebug } from './errors.js';

const BUILD = 'v11';   // shown in the pause menu so we know which version a phone is running
window.JF_BUILD = BUILD;
import { Lash } from './combat.js';
import { Dew, MoonDrop } from './pickups.js';
import { Fx } from './fx.js';
import { UI } from './ui.js';
import { Run } from './run.js';
import { TouchControls, IS_TOUCH } from './touch.js';

const APT = window.APT;
const { scene, renderer, camera } = APT;
const stage = STAGE1;
const LOOK_KEY = 'jellyfight.look';

// --- Saved character (the creator is optional, under C) ----------------------------
let savedLook = null;
try { savedLook = JSON.parse(localStorage.getItem(LOOK_KEY)); } catch {}
let look = normalizeLook(savedLook);

// --- Pause menu ---------------------------------------------------------------------
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
  #g-over .tag { margin: 0; opacity: .85; }
  #g-over .play { margin: 16px auto 18px; font: 600 18px system-ui, sans-serif; background: #ffd23a; color: #1d1a12; border: 0;
    border-radius: 14px; padding: 12px 34px; cursor: pointer; }
  #g-over .play:disabled { opacity: .6; cursor: progress; }
  #g-over .row { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  #g-over .row button { font: 14px system-ui, sans-serif; color: #fff; background: #ffffff1a; border: 1px solid #ffffff30;
    border-radius: 10px; padding: 8px 14px; cursor: pointer; }
  #g-over .row button.on { background: #fff; color: #111; }
  #g-over .keys { margin-top: 14px; opacity: .8; font-size: 13.5px; line-height: 2; }
  #g-over kbd { background: #fff2; border: 1px solid #fff4; border-radius: 4px; padding: 1px 6px; font-size: 12.5px; }
  #g-over > div { max-height: 100%; overflow-y: auto; padding: 12px 16px; box-sizing: border-box; }
  #g-over .touch-only { display: none; }
  body.touch #g-over .touch-only { display: block; }
  body.touch #g-over .desk-only, body.touch #g-over button.desk-only { display: none; }
  @media (max-height: 520px), (max-width: 600px) {
    #g-over h1 { font-size: 32px; }
    #g-over .tag { font-size: 13px; }
    #g-over .play { margin: 10px auto 10px; padding: 10px 30px; }
    #g-over .keys { margin-top: 6px; font-size: 12.5px; line-height: 1.7; }
  }
  @media (orientation: portrait) { body.touch #g-over .rotate { display: block; } }
  #g-over .rotate { display: none; margin-top: 8px; color: #ffd23a; font-size: 13px; }
</style>
<div id="g-over"><div>
  <h1>Jelly Fight</h1>
  <p class="tag">Grow from polyp to immortal jellyfish before the sun comes up. <small style="opacity:.6">${BUILD}</small></p>
  <button class="play">Play</button>
  <div class="row"><button data-act="restart">↺ Restart stage</button><button data-act="creator">🎨 Look</button><button data-act="diag">🩺 Diagnostics</button></div>
  <div class="row" id="g-quality"></div>
  <div class="keys touch-only">
    Left thumb: move &nbsp;·&nbsp; right thumb: drag to look<br>
    ⤴ jump, tap again in the air to double jump (hold it to climb fabric)<br>
    Your tentacles attack on their own. Each 🌙 Moon Drop gives a treasure; the 4th summons the boss, and after 2 minutes it comes anyway. Floor vents fling you up onto furniture.
    <div class="rotate">Tip: turn your phone sideways.</div>
  </div>
  <div class="keys desk-only">
    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp; <kbd>Mouse</kbd> look &nbsp; <kbd>Space</kbd> jump · again in the air to double jump · hold to climb fabric<br>
    Your tentacles attack on their own. Each 🌙 Moon Drop gives a treasure; the 4th summons the boss, and after 2 minutes it comes anyway. Floor vents fling you up onto furniture.<br>
    <kbd>Wheel</kbd> zoom &nbsp; <kbd>Esc</kbd> pause &nbsp; <kbd>F3</kbd> debug
  </div>
</div></div>`;
document.body.appendChild(ui);
const overlay = ui.querySelector('#g-over');
const qualityRow = ui.querySelector('#g-quality');

const plan = APT.plan.filter(([name]) => stage.rooms.includes(name));
const hud = new Hud(plan);
hud.mount(ui);
const fx = new Fx(scene, camera);
fx.mount(ui);
const menus = new UI(ui);
const creator = new Creator({
  onChange: (l) => applyLook(l, true),
  onDone: (l) => { saveLook(l); closeCreator(); },
});
creator.mount(ui);

// --- World --------------------------------------------------------------------------
prepareApartment(APT, stage);
const world = new World(scene);
addStageWalls(world, stage);
// fine close-up texture on the stage's surfaces (walls sit on the room outlines, so look around them)
addSurfaceDetail(world.colliders, {
  inside: (c) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dz]) => plan.some(([, poly]) => inPoly(c.x + dx, c.z + dz, poly))),
});

const traversal = new Traversal(scene, stage);
const input = new Input(renderer.domElement);
const player = new Player(world, CONFIG.player);
scene.add(player.mesh);
const tpc = new ThirdPersonCamera(camera, world, CONFIG.camera);
const gfx = new Graphics(renderer, scene, camera, IS_TOUCH ? 'low' : 'high');
const enemies = new Enemies(scene, world, fx);
const lash = new Lash(scene, enemies, fx);
lash.getRig = () => player.avatar?.tentacles || null;
const dew = new Dew(scene, world);
const moon = new MoonDrop(scene);

function applyLook(l, hop) {
  look = normalizeLook(l);
  player.setAvatar(buildCharacter(look, CONFIG.player.height));
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

const run = new Run({
  scene, stage, plan, world, player, cfg: CONFIG.player, enemies, lash, dew, moon,
  traversal, hud, ui: menus, fx, tpc, input, setNight: () => {}, touch: IS_TOUCH,
});

// Desktop plays with the mouse locked to the game; phones use on-screen controls
if (IS_TOUCH) {
  document.body.classList.add('touch');
  tpc.distance = 0.36;   // phone screens are small: sit a bit closer
}
input.touchOnly = IS_TOUCH;
function play() {
  if (!IS_TOUCH) { renderer.domElement.requestPointerLock(); return; }
  overlay.hidden = true;
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) {
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}
function pause() {
  if (menus.open || mode !== 'play') return;
  overlay.hidden = false;
}
const touch = new TouchControls(input, { onPause: pause });
touch.mount(ui);
run.onResume = () => { if (!IS_TOUCH) renderer.domElement.requestPointerLock(); };

// --- Modes: 'play' (paused while a menu is up) and 'creator' -----------------------
let mode = 'play';
let spin = 0.6, drag = null;
const menuOpen = () => !overlay.hidden || menus.open || mode === 'creator';

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
  overlay.hidden = false;
}
function setViewOffset() {
  const w = innerWidth, h = innerHeight, wide = w > 640;
  camera.setViewOffset(w, h, wide ? Math.min(360, w) / 2 : 0, wide ? 0 : h * 0.29, w, h);
}
addEventListener('resize', () => { if (mode === 'creator') setViewOffset(); });
renderer.domElement.addEventListener('pointerdown', (e) => { if (mode === 'creator') drag = { x: e.clientX }; });
addEventListener('pointermove', (e) => { if (!drag) return; spin -= (e.clientX - drag.x) * 0.01; drag.x = e.clientX; });
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

// --- The frame loop -------------------------------------------------------------------
// Log depth lets the camera sit 2 mm from a wall without flicker. Phones don't use it
// (too slow on their GPUs), so they get a 5 mm near plane instead.
camera.near = renderer.capabilities.logarithmicDepthBuffer ? CONFIG.camera.near : 0.005;
camera.updateProjectionMatrix();
document.body.classList.add('game');
let debug = false, fps = 0, fpsN = 0, fpsT = 0;
const GAME = {
  step(dt) {
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    traversal.update(dt);
    fx.update(dt);
    if (mode === 'creator') {
      player.avatar.update(dt, { speed: 0, walkSpeed: 1, grounded: true, vy: 0 });
      creatorCamera(dt);
      updateBlob();
      return;
    }
    touch.show(IS_TOUCH && !menuOpen());
    touch.setAction(run.touchAction);
    if (!menuOpen()) run.update(dt);
    else {
      input.consumeJump();
      input.consumeInteract();
      player.avatar.update(dt, { speed: 0, walkSpeed: 1, grounded: player.grounded, vy: 0 });
    }
    input.consumeReset();
    tpc.update(dt, input.consumeMouse(), player.position);
    gfx.focus = camera.position.distanceTo(player.position) + 0.005;
    updateBlob();
    hud.update(player.position, player.facing, tpc.yaw, run.markers());
    if (debug) {
      const p = player.position;
      hud.setDebug(`${fps} fps | x ${p.x.toFixed(2)} y ${(p.y * 100).toFixed(1)} cm z ${p.z.toFixed(2)} | ${run.phase} t=${run.t.toFixed(0)}s | ${enemies.alive} enemies | ${dew.list.length} dew | ${gfx.quality}`);
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
  if (b.classList.contains('play')) play();
  else if (b.dataset.q) { gfx.setQuality(b.dataset.q); renderQuality(); }
  else if (b.dataset.act === 'restart') { run.start(); play(); }
  else if (b.dataset.act === 'creator') openCreator();
  else if (b.dataset.act === 'diag') { enableDebug(); b.disabled = true; b.textContent = '🩺 Diagnostics on'; }
});
document.addEventListener('pointerlockchange', () => {
  if (mode !== 'play' || IS_TOUCH) return;
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.hidden = locked || menus.open;
});
addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest?.('input, textarea, select')) return;
  if (e.code === 'KeyC' && mode === 'play' && !menus.open && !overlay.hidden) openCreator();
  else if (e.code === 'Escape' && mode === 'creator') { saveLook(look); closeCreator(); }
  if (e.code === 'F3') { e.preventDefault(); debug = !debug; hud.setDebug(''); }
});

// Build every game material's GPU program now, behind the menu, instead of the moment each
// thing first appears. With the apartment's many lights these programs are big, and building
// several mid-game stalled phones for long enough that the browser reset the GPU.
const playBtn = overlay.querySelector('.play');
async function warmUp() {
  playBtn.disabled = true;
  playBtn.textContent = 'Loading…';
  const P = player.position;
  const temp = Object.keys(TYPES).map((t, i) => {
    const e = enemies.spawn(t, P.clone().add(new THREE.Vector3(0.03 * i, 0.01, 0.06)));
    e.mesh.scale.setScalar(e.baseScale);
    e.face.scale.setScalar(e.baseScale);
    return e;
  });
  dew.drop(P.clone(), 1, 1);
  moon.show({ at: [P.x, P.y, P.z] }, P.y);
  const tentacles = [lash.mesh(), lash.mesh()];
  tentacles[1].material = lash.goldMat;
  tentacles.forEach((m) => { m.position.copy(P); m.scale.set(0.002, 0.05, 0.002); });
  fx.puff(P.clone(), 0xffffff, 0.01, 1);
  const clog = new Clog(scene, enemies, fx, stage.boss);
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    reportError(e, 'preparing graphics');
  }
  clog.dispose();
  temp.forEach((e) => enemies.kill(e, true));
  enemies.clear();
  dew.clear();
  moon.hide();
  fx.clear();
  tentacles.forEach((m) => { m.visible = false; m.material = lash.mat; lash.pool.push(m); });
  playBtn.disabled = false;
  playBtn.textContent = 'Play';
}

overlay.hidden = false;
warmUp();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    GAME.step(dt);
    GAME.render();
  } catch (e) {
    reportError(e, 'frame');
  }
});

// Handy for poking at things from the browser console
Object.assign(window, { THREE, player, world, tpc, input, gfx, hud, run, enemies, lash, dew, moon, traversal, menus });
