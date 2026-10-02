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
import { Enemies, TYPES, FLASH } from './enemies.js';
import { Boss } from './boss.js';
import { Vacuum } from './vacuum.js';
import { juice } from './juice.js';
import { applyLayout, applyVentLayout, LayoutEditor, movables, visibleBox } from './layout.js';
import { unlock as unlockAudio, setMuted, isMuted } from './sfx.js';
import { reportError, enableDebug } from './errors.js';
import { wireFeedback } from './feedback.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { Clock, GameplaySystem, LayoutSystem, TouchSystem, AvatarSystem, InputSystem, CameraSystem, ShadowSystem, HudSystem, DebugSystem, RenderSystem } from './systems.js';

const BUILD = 'v57';   // shown in the pause menu so we know which version a phone is running
window.JF_BUILD = BUILD;
import { Lash } from './combat.js';
import { Dew, MoonDrop } from './pickups.js';
import { Fx } from './fx.js';
import { UI } from './ui.js';
import { Run } from './run.js';
import { TouchControls, IS_TOUCH } from './touch.js';

const APT = window.APT;
const { scene, renderer, camera } = APT;
batcher.scene = scene;
const stage = STAGE1;
const LOOK_KEY = 'jellyfight.look.v2';   // v2: the fluorescent jelly is the new default

// --- Saved character (the creator is optional, under C) ----------------------------
let savedLook = null;
try { savedLook = JSON.parse(localStorage.getItem(LOOK_KEY)); } catch {}

// What the frame systems share (systems.js)
const state = { mode: 'play', look: normalizeLook(savedLook), layout: null, debug: false };

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
  <div class="row"><button data-act="restart">↺ Restart stage</button><button data-act="creator">🎨 Look</button><button data-act="diag">🩺 Diagnostics</button><button data-act="sound">🔊 Sound on</button><button data-act="layout">🛠 Layout (dev)</button></div>
  <div class="row" id="g-quality"></div>
  <div class="keys touch-only">
    Left thumb: move &nbsp;·&nbsp; right thumb: drag to look<br>
    ⤴ jump, tap again in the air to double jump (hold it to climb fabric)<br>
    You blow bubbles at enemies on your own, and your tentacles sting anything that gets close. Each 🌙 Moon Drop gives a treasure; the 4th summons the boss, and after 5 minutes it comes anyway. Floor vents fling you up onto furniture.
    <div class="rotate">Tip: turn your phone sideways.</div>
  </div>
  <div class="keys desk-only">
    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp; <kbd>Mouse</kbd> look &nbsp; <kbd>Space</kbd> jump · again in the air to double jump · hold to climb fabric<br>
    You blow bubbles at enemies on your own, and your tentacles sting anything that gets close. Each 🌙 Moon Drop gives a treasure; the 4th summons the boss, and after 5 minutes it comes anyway. Floor vents fling you up onto furniture.<br>
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
wireFeedback(fx);
const menus = new UI(ui);
const creator = new Creator({
  onChange: (l) => applyLook(l, true),
  onDone: (l) => { saveLook(l); closeCreator(); },
});
creator.mount(ui);

// --- World --------------------------------------------------------------------------
applyLayout(APT.root);                 // your saved furniture edits (dev layout editor)
// Night: the room is lit by its own lamps (warm pools, dark corners). The image-based fill the
// apartment ships with brightened everything to daylight, so it's turned almost all the way
// down; a faint warm haze gives the far side of the room some depth.
scene.environmentIntensity = LOOK.num('night-fill', 0.12);
scene.background = new THREE.Color(LOOK.color('night-sky', '#05060c'));
scene.fog = new THREE.FogExp2(LOOK.color('haze-color', '#0c0604'), LOOK.num('haze', 0.14));
prepareApartment(APT, stage);
const world = new World(scene);
addStageWalls(world, stage);
// fine close-up texture on the stage's surfaces (walls sit on the room outlines, so look around them)
addSurfaceDetail(world.colliders, {
  inside: (c) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dz]) => plan.some(([, poly]) => inPoly(c.x + dx, c.z + dz, poly))),
});

applyVentLayout(stage.vents);          // vents moved in the layout editor (baked, then your own)
const traversal = new Traversal(scene, stage);
// furniture footprints for the minimap: things standing in the stage's rooms (not hanging decor)
function mapFurniture() {
  const out = [], bx = new THREE.Box3(), c = new THREE.Vector3();
  for (const { node } of movables(APT.root)) {
    if (!node.visible) continue;
    visibleBox(node, bx);
    if (bx.isEmpty() || bx.min.y > 1.2) continue;
    const w = bx.max.x - bx.min.x, d = bx.max.z - bx.min.z;
    if (w * d < 0.012 || w > 3 || d > 3) continue;
    bx.getCenter(c);
    if (!plan.some(([, poly]) => inPoly(c.x, c.z, poly))) continue;
    out.push({ x0: bx.min.x, z0: bx.min.z, x1: bx.max.x, z1: bx.max.z, top: bx.max.y });
  }
  hud.setFurniture(out);
}
mapFurniture();
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
  state.look = normalizeLook(l);
  player.setAvatar(buildCharacter(state.look, CONFIG.player.height));
  if (hop) player.avatar.land(1.2);
}
function saveLook(l) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch {}
}
applyLook(state.look);

const run = new Run({
  scene, stage, plan, world, player, cfg: CONFIG.player, enemies, lash, dew, moon,
  traversal, hud, ui: menus, fx, tpc, input, setNight: () => {}, touch: IS_TOUCH, apartment: APT.root,
});

// Desktop plays with the mouse locked to the game; phones use on-screen controls
if (IS_TOUCH) {
  document.body.classList.add('touch');
  tpc.distance = LOOK.num('camera-distance-phone', 0.52);   // phone screens are small: sit a bit closer
}
input.touchOnly = IS_TOUCH;
function play() {
  unlockAudio();
  if (!IS_TOUCH) { renderer.domElement.requestPointerLock(); return; }
  overlay.hidden = true;
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) {
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}
function pause() {
  if (menus.open || state.mode !== 'play') return;
  overlay.hidden = false;
}
const touch = new TouchControls(input, { onPause: pause });
touch.mount(ui);
run.onResume = () => { if (!IS_TOUCH) renderer.domElement.requestPointerLock(); };

// --- Modes: 'play' (paused while a menu is up), 'creator' and 'layout' --------------
const menuOpen = () => !overlay.hidden || menus.open || state.mode === 'creator' || state.mode === 'layout';

// --- Frame systems, in the order they run (systems.js) ---------------------------------
const camSys = new CameraSystem({ state, camera, tpc, input, player, gfx, playerHeight: CONFIG.player.height, dom: renderer.domElement });
const systems = {
  traversal,
  fx,
  layout: new LayoutSystem({ state }),
  touch: new TouchSystem({ state, touch, run, menuOpen, isTouch: IS_TOUCH }),
  gameplay: new GameplaySystem({ state, run, menuOpen }),
  avatar: new AvatarSystem({ state, player, menuOpen }),
  input: new InputSystem({ state, input, menuOpen }),
  camera: camSys,
  shadow: new ShadowSystem({ state, scene, world, player, cfg: CONFIG.player }),
  hud: new HudSystem({ state, hud, player, tpc, run }),
  debug: new DebugSystem({ state, hud, player, run, enemies, dew, gfx }),
  render: new RenderSystem({ gfx }),
};

// Dev layout editor: move the furniture around (layout.js)
let layoutChanged = false;
function openLayout() {
  const layout = state.layout ||= new LayoutEditor({ root: APT.root, camera, dom: renderer.domElement, world, scene, traversal });
  window.layout = layout;
  layout.onChange = () => { layoutChanged = true; world._focusAge = Infinity; };
  layout.onDone = closeLayout;
  layoutChanged = false;
  state.mode = 'layout';
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = true;
  hud.el.hidden = true;
  touch.show(false);
  layout.target.copy(player.position);
  layout.open();
}
function closeLayout() {
  state.layout.close();
  state.mode = 'play';
  input.enabled = true;
  hud.el.hidden = false;
  // things placed on furniture need checking again (Moon Drop spots, the player's footing)
  if (layoutChanged) { run.dropSpots = null; run.start(); mapFurniture(); }
  tpc.snapTo(player.position);
  overlay.hidden = false;
}

function openCreator() {
  state.mode = 'creator';
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = true;
  hud.el.hidden = true;
  creator.open(state.look);
  camSys.setCreatorView();
}
function closeCreator() {
  state.mode = 'play';
  input.enabled = true;
  creator.close();
  hud.el.hidden = false;
  camSys.clearCreatorView();
  tpc.snapTo(player.position);
  overlay.hidden = false;
}

// --- The frame loop -------------------------------------------------------------------
// Log depth lets the camera sit 2 mm from a wall without flicker. Phones don't use it
// (too slow on their GPUs), so they get a 5 mm near plane instead.
camera.near = renderer.capabilities.logarithmicDepthBuffer ? CONFIG.camera.near : 0.005;
camera.updateProjectionMatrix();
document.body.classList.add('game');
// Bring in more of the apartment (a later act's rooms: stage.parts, apartment.js) and make it
// part of the world: solid, with the layout editor's edits applied, on the minimap
async function loadRooms(parts, onProgress) {
  const added = await APT.load(parts, onProgress);
  if (!added.length) return added;
  applyLayout(APT.root);
  world.addObjects(added);
  mapFurniture();
  return added;
}

const GAME = {
  loadRooms,
  step(dt) {
    systems.traversal.update(dt);
    systems.fx.update(dt);
    systems.layout.update(dt);
    systems.touch.update(dt);
    systems.gameplay.update(dt);
    systems.avatar.update(dt);
    systems.input.update(dt);
    systems.camera.update(dt);
    systems.shadow.update(dt);
    systems.hud.update(dt);
    systems.debug.update(dt);
  },
  render() { systems.render.update(); },
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
  else if (b.dataset.act === 'layout') openLayout();
  else if (b.dataset.act === 'sound') { unlockAudio(); setMuted(!isMuted()); b.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on'; }
  else if (b.dataset.act === 'diag') { enableDebug(); b.disabled = true; b.textContent = '🩺 Diagnostics on'; }
});
document.addEventListener('pointerlockchange', () => {
  if (state.mode !== 'play' || IS_TOUCH) return;
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.hidden = locked || menus.open;
});
addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest?.('input, textarea, select')) return;
  if (e.code === 'KeyC' && state.mode === 'play' && !menus.open && !overlay.hidden) openCreator();
  else if (e.code === 'Escape' && state.mode === 'creator') { saveLook(state.look); closeCreator(); }
  if (e.code === 'KeyM') setMuted(!isMuted());
  if (e.code === 'F3') { e.preventDefault(); state.debug = !state.debug; hud.setDebug(''); }
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
  fx.ring(P.clone(), 0xffffff, 0.05, 1);
  fx.burst(P.clone().setY(P.y + 0.02), ['#ffffff'], 2);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.005), FLASH);
  flash.position.copy(P).setY(P.y + 0.02);
  scene.add(flash);
  run.gadgets.warm(true, P.clone().setY(P.y + 0.02));
  run.elites.warm(true, P.clone().setY(P.y + 0.03));
  const warmBubbles = [run.bubbles.mesh(run.bubbles.mat), run.bubbles.mesh(run.bubbles.goldMat)];
  warmBubbles.forEach((m) => { m.position.copy(P).setY(P.y + 0.03); m.scale.setScalar(0.01); });
  const warmFx = [new THREE.Mesh(run.bubbles.puddleGeo, run.bubbles.acidMat), new THREE.Line(new THREE.BufferGeometry().setFromPoints([P, P.clone().setY(P.y + 0.05)]), run.bubbles.zapMat)];
  warmFx.forEach((m) => { m.position.copy(P); scene.add(m); });
  temp[0].markT = temp[0].freezeT = 1;          // Sticky Note and Ice Cube looks
  enemies.markLook(temp[0], 0);
  temp[1].mesh.traverse((o) => { if (o.isMesh) o.material = FLASH; });   // the hit flash, instanced
  const clog = stage.boss.kind === 'vacuum' ? new Vacuum(scene, enemies, fx, stage.boss, world) : new Boss(scene, enemies, fx, stage.boss);
  const spit = new THREE.Mesh(enemies.shotGeo, enemies.shotMat);
  spit.position.copy(P).setY(P.y + 0.03);
  scene.add(spit);
  batcher.sync();                                // build the instanced batches so they compile too
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    reportError(e, 'preparing graphics');
  }
  run.gadgets.warm(false);
  run.elites.warm(false);
  warmBubbles.forEach((m) => { m.visible = false; run.bubbles.pool.push(m); });
  warmFx.forEach((m) => scene.remove(m));
  clog.dispose();
  scene.remove(flash);
  scene.remove(spit);
  temp.forEach((e) => enemies.kill(e, true));
  enemies.list = enemies.list.filter((e) => !temp.includes(e));   // keep the elites run.start() registered
  dew.clear();
  moon.hide();
  fx.clear();
  tentacles.forEach((m) => { m.visible = false; m.material = lash.mat; lash.pool.push(m); });
  playBtn.disabled = false;
  playBtn.textContent = 'Play';
}

overlay.hidden = false;
// Stories (stories.js): index.html?story=<name> opens one live; index.html?stories lists them
const storyParams = new URLSearchParams(location.search);
warmUp().then(() => {
  if (!storyParams.has('story') && !storyParams.has('stories')) return;
  import('./stories.js').then((S) => (storyParams.has('story') ? S.mount(storyParams.get('story')) : S.list()));
});

const clock = new Clock();
renderer.setAnimationLoop((now) => {
  const dt = clock.tick(now);
  try {
    GAME.step(dt);
    GAME.render();
  } catch (e) {
    reportError(e, 'frame');
  }
});

// Handy for poking at things from the browser console
Object.assign(window, { batcher, THREE, player, world, tpc, input, gfx, hud, run, enemies, lash, dew, moon, traversal, menus, fx });
