// Jelly Fight: wires the game together on top of the baked apartment (src/boot.js loads it).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World } from './collision.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { Input } from './input.js';
import { Graphics, CHOICES } from './graphics.js';
import { FramePacer, FrameGovernor } from './pacing.js';
import { LightSlots } from './light-slots.js';
import { recoverGpu } from './gpu-recovery.js';
import { buildCharacter, normalizeLook } from './character.js';
import { TestKit } from './test-kit.js';
import { BalanceEditor } from './balance-editor.js';
import { Creator } from './creator.js';
import { MainMenu } from './main-menu.js';
import { ADORNMENTS } from './words.js';
import { Hud, inPoly } from './hud.js';
import { addSurfaceDetail } from './detail.js';
import { STAGES, currentStage, currentAct, carried, forgetRun, goToAct, keptRun, pendingAction, peekAction } from './stages.js';
import { prepareApartment, addStageWalls, Traversal, meshesNamed } from './traversal.js';
import { updateForceFields } from './forcefield.js';
import { addBathroomDetails } from './bathroom.js';
import { dressSet } from './set-dressing.js';
import { addDendi } from './cat.js';
import { Enemies, TYPES, FLASH } from './enemies.js';
import { juice } from './juice.js';
import { applyLayout, applyVentLayout, LayoutEditor, movables, visibleBox } from './layout.js';
import { unlock as unlockAudio, setMuted, isMuted, audio, sfx } from './sfx.js';
import { Music } from './music.js';
import { SongTrack, TRACKS } from './song-track.js';
import { jellyPortrait } from './jelly-portrait.js';
import { Leaderboard } from './leaderboard.js';
import { reportError, enableDebug } from './errors.js';
import { wireFeedback } from './feedback.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';
import { Clock, GameplaySystem, LayoutSystem, TouchSystem, AvatarSystem, InputSystem, CameraSystem, ShadowSystem, HudSystem, DebugSystem, RenderSystem } from './systems.js';

const BUILD = 'v332';   // shown in the corner of the main screen, so you can tell which version is running
window.JF_BUILD = BUILD;
import { Lash } from './combat.js';
import { XpDrops } from './pickups.js';
import { Fx } from './fx.js';
import { UI } from './ui.js';
import { Run, makeBoss } from './run.js';
import { bagHtml } from './treasure-bag.js';
import { TouchControls, IS_TOUCH } from './touch.js';

const APT = window.APT;
const { scene, renderer, camera } = APT;
batcher.scene = scene;
const stage = currentStage();          // act 1, or a later act the run moved on to (stages.js)
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
  /* the main screen (and the pause menu) shows just itself: the HUD waits behind it */
  #g-over:not([hidden]) ~ #hud { visibility: hidden; }
  #g-over h1 { margin: 0 0 4px; font-size: 46px; letter-spacing: -.01em; text-shadow: 0 3px 12px #0008; }
  #g-over .tag { margin: 0; opacity: .85; }
  /* the version, always in the corner of the main screen (and the act's loading screen) */
  #g-over .ver { position: absolute; right: calc(env(safe-area-inset-right, 0px) + 12px); bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    font: 600 13px system-ui, sans-serif; color: #fff; background: #0008; border: 1px solid #ffffff33; border-radius: 8px; padding: 4px 9px; }
  #g-over .play { margin: 16px auto 18px; font: 600 18px system-ui, sans-serif; background: #ffd23a; color: #1d1a12; border: 0;
    border-radius: 14px; padding: 12px 34px; cursor: pointer; }
  #g-over .resume[hidden] { display: none; }
  #g-over .play:disabled { opacity: .6; cursor: progress; }
  #g-over .row { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  #g-over .row button { font: 14px system-ui, sans-serif; color: #fff; background: #ffffff1a; border: 1px solid #ffffff30;
    border-radius: 10px; padding: 8px 14px; cursor: pointer; }
  #g-over .row button.on { background: #fff; color: #111; }
  #g-over .tag { margin-bottom: 4px; }
  /* graphics: a small segmented switch, quieter than the main buttons */
  #g-quality { gap: 0 !important; margin-top: 10px !important; font: 12px system-ui, sans-serif; opacity: .85; }
  #g-quality span { margin-right: 8px; }
  #g-quality button { border-radius: 0 !important; padding: 5px 12px !important; font-size: 12px !important; margin: 0 -1px 0 0; }
  #g-quality button:first-of-type { border-radius: 8px 0 0 8px !important; }
  #g-quality button:last-of-type { border-radius: 0 8px 8px 0 !important; }
  /* dev tools: one 🔒 Dev button; the password opens the rest */
  #g-over .dev-lock, #g-over .dev-tools { display: none; }
  #g-over.dev-ask .dev-lock { display: flex; }
  #g-over.dev-open .dev-tools { display: flex; }
  #g-over.dev-open .dev-btn { display: none; }
  #g-over .dev-lock input { font: 14px system-ui, sans-serif; width: 140px; padding: 7px 10px; border-radius: 10px; border: 1px solid #ffffff40; background: #0006; color: #fff; }
  #g-over .dev-lock input.wrong { border-color: #ff6b6b; }
  #g-over .dev-tools button { font-size: 13px !important; padding: 6px 11px !important; background: #ffffff10 !important; }
  /* the pause menu's list of what you carry (treasure-bag.js) */
  #g-over .g-bag { max-width: 880px; margin: 14px auto 0; text-align: left; }
  #g-over .g-bag:empty, #g-over.menu-home .g-bag, #g-over.cont .g-bag { display: none; }
  #g-over .g-bag h2 { margin: 0 0 8px; text-align: center; font: 700 16px system-ui, sans-serif; }
  #g-over .g-bag .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px; }
  #g-over .g-bag .t { display: flex; gap: 9px; align-items: flex-start; background: #000a; border: 1px solid #ffffff22; border-radius: 10px; padding: 7px 10px; }
  #g-over .g-bag .i { font-size: 22px; line-height: 1.1; }
  #g-over .g-bag .t > div { min-width: 0; flex: 1; }
  #g-over .g-bag .n { font: 600 14px system-ui, sans-serif; }
  #g-over .g-bag .tag { font-weight: 500; font-size: 11.5px; background: #ffffff24; border-radius: 6px; padding: 1px 6px; margin-left: 2px; }
  #g-over .g-bag p { margin: 2px 0 0; font-size: 12.5px; line-height: 1.35; opacity: .82; }
  #g-over .g-bag .g { margin-top: 4px; font-size: 12.5px; color: #c6ffb0; }
  #g-over .g-bag .g.dim { color: #fff; opacity: .55; }
  #g-over .g-bag .g i { display: block; height: 5px; margin-top: 3px; border-radius: 3px; background: #ffffff22; overflow: hidden; }
  #g-over .g-bag .g i::after { content: ''; display: block; height: 100%; width: calc(var(--k) * 100%); background: #7dff9a; }
  #g-over .keys { margin-top: 14px; opacity: .6; font-size: 12.5px; line-height: 1.9; }
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
  /* iPhones can't go full screen from the page: point them at Add to Home Screen (manifest.webmanifest) */
  #g-over .home-tip { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 6px 6px 12px; border-radius: 10px; background: #000a; border: 1px solid #ffffff2a; color: #fff; opacity: 1; font-size: 13px; line-height: 1.3; }
  #g-over .home-tip[hidden] { display: none; }
  #g-over .home-tip svg { width: 15px; height: 18px; vertical-align: -3px; }
  #g-over .home-tip button { background: none !important; border: 0 !important; color: #fff; opacity: .6; font-size: 18px !important; padding: 0 6px !important; margin: 0 !important; line-height: 1; }
  /* phones play sideways only: held upright, the game is covered until it's turned (iOS can't lock orientation) */
  #g-turn { display: none; position: fixed; inset: 0; z-index: 100; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    background: #041329; color: #fff; font: 600 19px system-ui, -apple-system, sans-serif; text-align: center; padding: 24px; }
  #g-turn .ph { width: 44px; height: 76px; border: 4px solid #fff; border-radius: 10px; animation: g-turn 2.4s ease-in-out infinite; }
  #g-turn p { margin: 0; opacity: .85; font-weight: 500; font-size: 15px; }
  @keyframes g-turn { 0%, 25% { transform: rotate(0); } 55%, 100% { transform: rotate(-90deg); } }
  @media (prefers-reduced-motion: reduce) { #g-turn .ph { animation: none; transform: rotate(-90deg); } }
  @media (orientation: portrait) and (max-width: 600px) { body.touch #g-turn { display: flex; } }
  /* straight on from the act before: no menu, just the act's name while it loads */
  #g-over .cont-note { display: none; margin: 0; opacity: .85; }
  #g-over.cont .cont-note { display: block; }
  #g-over.cont .tag, #g-over.cont .row, #g-over.cont .keys { display: none !important; }
</style>
<div id="g-over"><div>
  <h1>Jelly Fight</h1>
  <div class="ver" title="The game's version: check it matches the latest update">Version ${BUILD.replace(/^v/, '')}<span id="g-fps"></span></div>
  <p class="cont-note"></p>
  <button class="resume" hidden></button>
  <button class="play">Play</button>
  <div class="row"><button data-act="creator">Change your look</button><button data-act="sound">🔊 Sound on</button><button data-act="music">🎵 Music on</button><button data-act="board">🏆 Leaderboard</button><button data-act="book">📖 Treasure book</button><button data-act="dev" class="dev-btn">🔒 Dev</button></div>
  <div class="row dev-lock"><input type="password" name="dev-pass" placeholder="Dev password" autocomplete="off"><button data-act="dev-unlock">Unlock</button></div>
  <div class="row dev-tools"><button data-act="layout">🛠 Layout</button><button data-act="arena4">Act 4 preview</button><button data-act="boss">👹 Fight boss</button><button data-act="duel">🐞 1 on 1</button><button data-act="kit">🧪 Test kit</button><button data-act="tuner">⚖️ Tuner</button><button data-act="diag">🩺 Diagnostics</button></div>
  <div class="row" id="g-quality"></div>
  <div class="g-bag"></div>
  <div class="keys touch-only">
    Left thumb move &nbsp;·&nbsp; right thumb look &nbsp;·&nbsp; ⤴ jump
    <div><div class="home-tip" hidden><span>Full screen: tap Share <svg viewBox="0 0 15 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1v11M3.5 5l4-4 4 4M5 8H1.5v9h12V8H10"/></svg> then <b>Add to Home Screen</b></span><button data-act="home-tip" aria-label="Hide this tip">×</button></div></div>
  </div>
  <div class="keys desk-only">
    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp; <kbd>Mouse</kbd> look &nbsp; <kbd>Space</kbd> jump &nbsp; <kbd>Esc</kbd> pause
  </div>
</div></div>
<div id="g-turn" role="alert"><div class="ph"></div>Turn your phone sideways<p>Jelly Fight plays in landscape</p></div>`;
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
  onPreview: (l) => showLook(l, true),   // a locked option tried on: drawn, never state.look
});
creator.mount(ui);

// --- World --------------------------------------------------------------------------
const ARENA = APT.arena || null;       // an act in a built arena (act 4's concert: boot.js), not the apartment
if (!ARENA) applyLayout(APT.root, currentAct());   // your saved furniture edits for this act (dev layout editor)
// Night: the room is lit by its own lamps (warm pools, dark corners). The image-based fill the
// apartment ships with brightened everything to daylight, so it's turned almost all the way
// down; a faint warm haze gives the far side of the room some depth.
scene.environmentIntensity = LOOK.num('night-fill', 0.12);
scene.background = new THREE.Color(LOOK.color(ARENA ? 'arena-background' : 'night-sky', ARENA ? '#030611' : '#05060c'));
scene.fog = ARENA ? new THREE.FogExp2(LOOK.color('arena-background', '#030611'), LOOK.num('arena-haze', 0.3))
  : new THREE.FogExp2(LOOK.color('haze-color', '#0c0604'), LOOK.num('haze', 0.14));
if (!ARENA) dressSet(scene, APT.root);   // detailed TV / soundbar / shower curtain replace the flat baked ones
prepareApartment(APT, stage);
const world = new World(scene, { staticScene: true });
// the arena's invisible solids (its continuous floor, the jump-safe rails, the Encore's stage) collide
if (ARENA) for (const m of ARENA.solids) if (m.userData.noCollide) world.addCollider(m, false);
addStageWalls(world, stage, scene);
if (stage.details === 'bathroom') {   // after the collision world: decoration only
  addBathroomDetails(scene);
  const wide = stage.boss.set?.stretch?.[0]?.z[1];
  if (wide) addBathroomDetails(scene, wide).visible = false;   // the widened tub's, shown for the fight (boss-set.js)
}
// Dendi the cat (src/cat.js): never seen during a run — he exists, hidden,
// purely to show up for the boss finish (see the scene below), then he's
// gone again. Both boss stages get one; a stage with no boss needs none.
const dendi = addDendi(scene, new THREE.Vector3(), 0, { hidden: true });   // hidden until he finishes a boss
// fine close-up texture on the stage's surfaces (walls sit on the room outlines, so look around them)
if (!ARENA) addSurfaceDetail(world.colliders, {
  inside: (c) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dz]) => plan.some(([, poly]) => inPoly(c.x + dx, c.z + dz, poly))),
});

applyVentLayout(stage.vents, currentAct());   // vents moved in the layout editor (baked, then your own)
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
if (!ARENA) mapFurniture();
const input = new Input(renderer.domElement);
const player = new Player(world, CONFIG.player);
scene.add(player.mesh);
const tpc = new ThirdPersonCamera(camera, world, CONFIG.camera);
const gfx = new Graphics(renderer, scene, camera, IS_TOUCH ? 'medium' : 'high');   // phones start on Medium so Low is a choice, not a default
// Phones light the room with a few shared lights instead of every lamp (light-slots.js). Made
// before the shaders are built (warmUp) so they're built for this light count, once.
const slotCount = ARENA ? 0 : IS_TOUCH ? LOOK.num('phone-lights', 6) : LOOK.num('desktop-lights', 0);   // the arena has no lamps
const lightSlots = slotCount > 0 ? new LightSlots(scene, slotCount, { fade: LOOK.num('light-fade', 0.5), reach: LOOK.num('light-reach', 1.5) }) : null;
if (lightSlots) APT.lights.rescan();
const enemies = new Enemies(scene, world, fx);
const lash = new Lash(scene, enemies, fx);
lash.getRig = () => player.avatar?.tentacles || null;
const xpDrops = new XpDrops(scene, world);

function showLook(l, hop) {
  player.setAvatar(buildCharacter(normalizeLook(l), CONFIG.player.height));
  if (hop) player.avatar.land(1.2);
}
function applyLook(l, hop) {
  state.look = normalizeLook(l);
  showLook(state.look, hop);
}
function saveLook(l) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch {}
}
applyLook(state.look);

// A song with a recording (song-track.js TRACKS: the Encore's) plays that, loaded once audio starts,
// and the synthesized one only if the file won't load; its beat is what a boss on the beat reads (`song`)
const tracks = {};
function trackFor(name) {
  const A = audio(), T = TRACKS[name];
  if (!A || !T) return null;
  if (!tracks[name]) { const t = tracks[name] = { track: new SongTrack(A.ctx, A.master, T), state: 'loading' }; t.track.load().then((ok) => { t.state = ok ? 'ready' : 'failed'; }); }
  return tracks[name];
}
// the run's song as a beat source (encore.js): its beat, null while it loads (the fight waits), or
// undefined with no music (the boss keeps its own time); only a recording knows its breakdown and drop
const song = {
  playing: null,
  beat() { const t = this.playing; if (!t) return undefined; if (t.state === 'loading') return null; return t.state === 'ready' ? (t.track.beatNow() ?? null) : music?.beatNow() ?? undefined; },
  quiet(b) { return this.playing?.state === 'ready' && this.playing.track.quiet(b); },
  drop(b) { return this.playing?.state === 'ready' && this.playing.track.drop(b); },
};
const run = new Run({
  scene, stage, plan, world, player, cfg: CONFIG.player, enemies, lash, xpDrops, gfx,
  traversal, hud, ui: menus, fx, tpc, input, setNight: () => {}, touch: IS_TOUCH, apartment: APT.root,
  carry: carried(),                    // a later act: the run so far (stages.js)
  arena: ARENA, song,                  // act 4's built arena and the song its boss plays to (encore.js)
});
wireFeedback(fx, targetId => {
  for (const [enemy, burn] of run.bubbles.burning) if (enemy.id === targetId && burn.t > 0) return true;
  return false;
});

// The leaderboard (leaderboard.js): runs post their score when they end; the pause menu shows it
const board = new Leaderboard();
run.board = board;
// whenever the pause menu opens, it lists what you carry as it stands (treasure-bag.js)
const bag = overlay.querySelector('.g-bag');
new MutationObserver(() => { if (!overlay.hidden) bag.innerHTML = bagHtml(run); }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
// the end-of-run screen's 🏠 Main menu: back to act 1's menu (a later act reloads into act 1)
run.onMainMenu = () => {
  if (currentAct() > 1) { goToAct(1); return; }
  run.start();
  mainMenu.show();
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = false;
};
run.playerBody = () => state.look.body;
addEventListener('pagehide', () => run.flushFeats());   // a run left mid-way still counts the bugs it cleared (cosmetics.js)
run.playerLook = () => state.look;
run.onWear = (key, id) => { applyLook({ ...state.look, [key]: id }); saveLook(state.look); };   // an award's reveal: Wear it now
run.jellyFace = (look) => jellyPortrait(renderer, look);   // each player's jelly by their score (leaderboard, jelly-portrait.js)

// Desktop plays with the mouse locked to the game; phones use on-screen controls
if (IS_TOUCH) {
  document.body.classList.add('touch');
  tpc.distance = LOOK.num('camera-distance-phone', 0.7);
}
input.touchOnly = IS_TOUCH;
function play() {
  unlockAudio();
  if (!IS_TOUCH) { renderer.domElement.requestPointerLock(); return; }
  overlay.hidden = true;
  mainMenu.launch();
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) {
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}
function pause() {
  if (menus.open || state.mode !== 'play') return;
  mainMenu.cancelLaunch();
  overlay.hidden = false;
}
const touch = new TouchControls(input, { onPause: pause });
touch.mount(ui);
// on an iPhone in the browser (not already opened from the home screen), say how to play full screen
const homeTip = overlay.querySelector('.home-tip'), HOME_TIP_KEY = 'jellyfight.homeTip';
let homeTipOff = false; try { homeTipOff = localStorage.getItem(HOME_TIP_KEY) === 'off'; } catch {}
homeTip.hidden = !/iPhone|iPod/.test(navigator.userAgent) || navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || homeTipOff;
// held upright mid-run: pause under the turn-sideways cover, so nothing hits the jelly unseen
const upright = matchMedia('(orientation: portrait) and (max-width: 600px)');
if (IS_TOUCH) upright.addEventListener('change', () => { if (upright.matches) pause(); });
window.upright = upright;   // stories turn the phone (phone/held-upright-pauses-under-the-cover)
run.onResume = () => { if (!IS_TOUCH) renderer.domElement.requestPointerLock(); };

// --- Modes: 'play' (paused while a menu is up), 'creator' and 'layout' --------------
const mainMenu = new MainMenu({ overlay, player, camera, gfx, scene, height: CONFIG.player.height, calm: () => juice.calm, board,
  onPoke: () => { unlockAudio(); sfx.pop(); },
});
board.onChange = () => mainMenu.refreshGreeting();
if (stage.id !== 1 || peekAction()?.continue || peekAction()?.duel || peekAction()?.boss || peekAction()?.layout) {
  mainMenu.home = false; overlay.classList.remove('menu-home');
}
let bossScene = null;
const menuOpen = () => !!bossScene || mainMenu.launching || !overlay.hidden || menus.open || kit.open || tuner.open || state.mode === 'creator' || state.mode === 'layout';

// --- Frame systems, in the order they run (systems.js) ---------------------------------
const camSys = new CameraSystem({ state, camera, tpc, input, player, gfx, playerHeight: CONFIG.player.height, dom: renderer.domElement });
const systems = {
  traversal,
  fx,
  layout: new LayoutSystem({ state }),
  touch: new TouchSystem({ state, touch, run, menuOpen: () => menuOpen() || run.victory.active, isTouch: IS_TOUCH }),   // no thumb controls over the ending
  gameplay: new GameplaySystem({ state, run, menuOpen }),
  avatar: new AvatarSystem({ state, player, menuOpen }),
  input: new InputSystem({ state, input, menuOpen }),
  camera: camSys,
  shadow: new ShadowSystem({ state, scene, world, player, cfg: CONFIG.player }),
  hud: new HudSystem({ state, hud, player, tpc, run }),
  debug: new DebugSystem({ state, hud, player, run, enemies, xpDrops, gfx, extra: () => pacingReadout() }),
  render: new RenderSystem({ gfx }),
};

// Dev layout editor: move the furniture around (layout.js)
let layoutChanged = false;
function openLayout() {
  const layout = state.layout ||= new LayoutEditor({ root: APT.root, camera, dom: renderer.domElement, world, scene, traversal, act: currentAct(), acts: STAGES.filter((s) => !s.arena).map((s) => s.id),   // (a built arena, act 4, has no furniture to lay out)
    onAct: (n) => goToAct(n, null, { layout: true }) });
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
  // things placed on furniture need checking again (treasure spots, the player's footing)
  if (layoutChanged) { run.spots = null; run.start(); mapFurniture(); }
  tpc.snapTo(player.position);
  overlay.hidden = false;
}

function openCreator() {
  mainMenu.restore();
  state.mode = 'creator';
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = true;
  hud.el.hidden = true;
  creator.open(state.look);
  camSys.setCreatorView();
}
function closeCreator() {
  mainMenu.restore();
  state.mode = 'play';
  input.enabled = true;
  creator.close();
  hud.el.hidden = false;
  camSys.clearCreatorView();
  tpc.snapTo(player.position);
  overlay.hidden = false;
}

// --- The frame loop -------------------------------------------------------------------
// Reversed or log depth lets the camera sit 2 mm from a wall without flicker (boot.js). A phone
// without reversed depth gets a 5 mm near plane instead.
const deepDepth = renderer.capabilities.reversedDepthBuffer || renderer.capabilities.logarithmicDepthBuffer;
camera.near = deepDepth ? CONFIG.camera.near : 0.005;
camera.updateProjectionMatrix();
document.body.classList.add('game');
// Bring in more of the apartment (a later act's rooms: stage.parts, apartment.js) and make it
// part of the world: solid, with the layout editor's edits applied, on the minimap
async function loadRooms(parts, onProgress) {
  const added = await APT.load(parts, onProgress);
  if (!added.length) return added;
  lightSlots?.rescan();               // the new rooms' lamps share the same slots
  applyLayout(APT.root, currentAct());
  world.addObjects(added);
  mapFurniture();
  // the new rooms' see-through copies and GPU uploads, as warmUp does for the first ones
  const box = new THREE.Box3();
  added.forEach((o) => box.expandByObject(o));
  const seeThrough = tpc.seeThroughWarmers(box);
  seeThrough.forEach((m) => scene.add(m));
  try { await prepareGraphics(nextTask); uploadAll(); } catch (e) { reportError(e, 'preparing graphics'); }
  seeThrough.forEach((m) => scene.remove(m));   // not disposed: that would throw the built shaders away
  return added;
}

// The soundtrack (music.js): which song and how intense comes from the run; muffled behind menus.
// It starts once audio is unlocked (the Play button), and the 🎵 button turns it off.
const MUSIC_KEY = 'jellyfight.music';
let music = null, musicOn = true;
try { musicOn = localStorage.getItem(MUSIC_KEY) !== 'off'; } catch {}
// Reduce effects: no screen shake, a softer hurt glow (juice.calm). Follows the device's own
// reduced-motion setting; there's no button for it (the Graphics row is the one visual setting).
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function setCalm(on) {
  juice.calm = on;
  if (on) juice.trauma = 0;
  document.body.classList.toggle('calm', on);
}
setCalm(reducedMotion.matches);
reducedMotion.addEventListener?.('change', (e) => setCalm(e.matches));
try { localStorage.removeItem('jellyfight.effects'); } catch {}   // the old button's pick
function updateMusic(dt) {
  if (!music) { const A = audio(); if (!A) return; music = new Music(A.ctx, A.master); }
  const st = musicOn ? run.musicState() : { song: null, intensity: 0 };
  if (stage.arena) for (const name in TRACKS) trackFor(name);   // start loading the act's recording early
  const rec = st.song ? trackFor(st.song) : null;
  for (const name in tracks) if (tracks[name] !== rec) tracks[name].track.stop();
  song.playing = rec;
  if (rec?.state === 'ready') rec.track.play();
  rec?.track.duck(menuOpen() || run.paused);
  music.play(rec && rec.state !== 'failed' ? null : st.song);
  music.duck(menuOpen() || run.paused);
  music.suck(!!st.suck);              // the Vacuum sucking drags the music through a dub filter
  music.update(dt, st.intensity);
}

// --- The boss finish --------------------------------------------------------
// Gameplay holds while Dendi approaches, winds up and finishes the doomed boss.
// Both camera cuts happen under black; rewards wait until the return fade ends.
const blackout = document.createElement('div');
blackout.className = 'boss-fade';
blackout.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:60;';
document.body.appendChild(blackout);
const sceneRay = new THREE.Raycaster();
function startBossScene(boss) {
  const short = juice.calm || fx.reducedMotion.matches, scale = short ? .35 : 1;
  bossScene = {
    boss, t: 0, phase: 'out', smacked: false, short,
    fade: LOOK.num('cat-scene-fade', .55) * scale,
    walk: short ? 0 : LOOK.num('cat-scene-walk', 1.8),
    watch: LOOK.num('cat-scene-watch', .7) * scale,
    strike: short ? .25 : LOOK.num('cat-scene-strike', .5),
    aftermath: LOOK.num('cat-scene-aftermath', 1.8) * scale,
    playerAt: player.position.clone(), yaw: tpc.yaw, view: tpc.fight, hudHidden: hud.el.hidden,
  };
  hud.el.hidden = true;
  run.bubbles.silenceAttacks();
  music?.duck(true);
}
function restoreBossView(S) {
  dendi.endScene();
  player.position.copy(S.playerAt); player.mesh.position.copy(S.playerAt);
  tpc.yaw = S.yaw; tpc.fight = S.view; tpc.snapTo(player.position);
}
function stepBossScene(dt) {
  const S = bossScene;
  if (run.boss !== S.boss || run.phase !== 'boss') {
    // A restart owns its new player/camera transform; never restore the old run over it.
    blackout.style.opacity = '0'; dendi.endScene(); hud.el.hidden = state.mode === 'creator' || S.hudHidden; bossScene = null; return;
  }
  input.consumeMouse();
  if (!overlay.hidden || run.paused || state.mode !== 'play') return;
  juice.update(dt);
  S.t += dt;
  const B = S.boss;
  const next = phase => { S.phase = phase; S.t = 0; };
  if (S.phase === 'out') blackout.style.opacity = String(Math.min(1, S.t / S.fade));
  if (S.phase === 'out' && S.t >= S.fade) {
    // behind the black: the cat beside the boss, on the side the jelly was on
    const c = B.center(), hp = B.holder.position;
    const dir = new THREE.Vector3(player.position.x - c.x, 0, player.position.z - c.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
    const catPos = new THREE.Vector3(c.x + dir.x * (B.r + 0.16), B.floor ?? hp.y, c.z + dir.z * (B.r + 0.16));
    // A short surface-checked path fits the tub and bed too: no walking through walls or off edges.
    const down = new THREE.Vector3(0,-1,0), ground = world.castAll(catPos.clone().add(new THREE.Vector3(0,.3,0)),down,.6);
    if (ground && ground.normal?.y > .55) catPos.y = ground.point.y + .002;
    const from = catPos.clone(), at = catPos.clone(), path = [catPos.clone()], hit = {normal:new THREE.Vector3(),point:new THREE.Vector3()};
    if (!S.short) for (let distance = .025; distance <= LOOK.num('cat-scene-approach', .45); distance += .025) {
      at.copy(catPos).addScaledVector(dir, distance);
      const floor = world.castAll(at.clone().setY(from.y+.2), down, .4);
      if (!floor || floor.normal?.y < .55 || Math.abs(floor.point.y-from.y) > .08) break;
      at.y = floor.point.y + .002;
      if (world.sweepSphere(from.clone().add(new THREE.Vector3(0,.15,0)), at.clone().sub(from), .1, hit)) break;
      from.copy(at); path.unshift(at.clone());
    }
    S.catFrom = from; S.catTo = catPos; S.catPath = path;
    dendi.placeForSmack(catPos, Math.atan2(c.x - catPos.x, c.z - catPos.z));
    dendi.group.position.copy(from);
    // the jelly in front of the pair and the camera behind it, side-on, so the cat and the boss stand left and
    // right in the frame (the player's own camera angle left him off-screen or showed only his back). Of a few
    // angles round the pair, the first whose jelly and camera are both inside the arena with nothing of the
    // apartment between them (a camera outside the arena ends up in a wall)
    const A = B.arena, mid = new THREE.Vector3((c.x + catPos.x) / 2, player.position.y, (c.z + catPos.z) / 2);
    const far = LOOK.num('cat-scene-distance', 1.2);
    const inside = (x, z, m = 0) => !A.arenaMin || (x > A.arenaMin[0] - m && x < A.arenaMax[0] + m && z > A.arenaMin[2] - m && z < A.arenaMax[2] + m);
    const side = Math.atan2(dir.z, -dir.x);
    let view = null;
    // (lower first; a small arena like the bathtub only fits a camera looking down into it)
    for (const tilt of [LOOK.num('cat-scene-tilt', 0.6), 1.0, 1.3]) for (const turn of view ? [] : [0, Math.PI, 0.5, -0.5, Math.PI + 0.5, Math.PI - 0.5, 1, -1]) {
      const yaw = side + turn, sx = Math.sin(yaw), sz = Math.cos(yaw), back = Math.cos(tilt) * far;
      const jx = mid.x + sx * 0.3, jz = mid.z + sz * 0.3;
      if (!inside(jx, jz) || !inside(jx + sx * back, jz + sz * back, 0.1)) continue;
      sceneRay.set(new THREE.Vector3(jx, mid.y + tpc.cfg.height, jz), new THREE.Vector3(sx * Math.cos(tilt), Math.sin(tilt), sz * Math.cos(tilt))); sceneRay.far = far;
      if (sceneRay.intersectObject(APT.root, true).some((h) => h.object.visible && h.object.isMesh)) continue;
      view = { yaw, tilt, x: jx, z: jz }; break;
    }
    view ||= { yaw: side, tilt: 1.3, x: mid.x + Math.sin(side) * 0.3, z: mid.z + Math.cos(side) * 0.3 };
    player.position.set(view.x, player.position.y, view.z);
    player.mesh.position.copy(player.position);   // (gameplay, which moves the model with it, waits during the scene)
    tpc.yaw = view.yaw;
    // pulled back to fit a 26 cm cat and the boss: a fight view (camera.js), handed back after
    tpc.fight = { distance: far, pitch: view.tilt, ahead: 0 };
    tpc.fightK = 1;
    tpc.snapTo(player.position);
    next('in');
  } else if (S.phase === 'in') {
    blackout.style.opacity = String(Math.max(0, 1-S.t/S.fade));
    if (S.t >= S.fade) {
      if (S.walk && S.catPath.length > 1) { dendi.approach(S.catPath,S.walk); S.footstep = 0; next('walk'); }
      else next('watch');
    }
  } else if (S.phase === 'walk') {
    const step = Math.floor(S.t / .3125);
    if (step > S.footstep) { S.footstep = step; sfx.catStep(); }
    if (S.t >= S.walk) next('watch');
  } else if (S.phase === 'watch' && S.t >= S.watch) {
    dendi.beginSmack(.25 / S.strike); sfx.catWind(); next('smack');
  } else if (S.phase === 'smack') {
    if (!S.smacked && S.t >= S.strike) {
      B.die(); S.smacked = true;
      if (!S.short) { juice.feel('boss-kill'); juice.slow(...LOOK.list('boss-kill-slow', [0.7, 0.25]).map(Number)); }
      sfx.catImpact();
      const c = dendi.bones.legFR2.getWorldPosition(new THREE.Vector3()), color = LOOK.color('cat-scene-impact-color', '#fff0c9');
      fx.impact(c,color,LOOK.num('cat-scene-impact-size',.045),S.short ? 3 : 12);
      fx.burst(c,[color,LOOK.color('cat-scene-debris-color','#6a6057')],S.short ? 3 : 12,.005,.25,S.catTo.y);
    }
    if (S.t >= S.strike + S.aftermath) next('exit');
  } else if (S.phase === 'exit') {
    blackout.style.opacity = String(Math.min(1,S.t/S.fade));
    if (S.t >= S.fade) { restoreBossView(S); next('return'); }
  } else if (S.phase === 'return') {
    blackout.style.opacity = String(Math.max(0,1-S.t/S.fade));
    if (S.t >= S.fade) {
      hud.el.hidden = S.hudHidden; bossScene = null;
      run.onBossDead({ impact: false });
    }
  }
  B.update(dt, player);              // attack-free waiting and the boss's death animation only
}

// A boss's own cut scene (encore.js at half Health: its booth shorts out). While the boss has a
// `cut` ({ t, length, from, to, look }), gameplay holds, the HUD hides and the camera eases from `from`
// to `to` looking at `look`; the boss plays the scene in its own update. Then back to the fight's view
let bossCut = null;
function stepBossCut(dt) {
  const B = run.boss, C = B?.cut;
  if (!C || run.phase !== 'boss' || !bossCut) {
    if (bossCut) { hud.el.hidden = bossCut.hudHidden; tpc.snapTo(player.position); bossCut = null; }
    return false;
  }
  input.consumeMouse();
  if (!overlay.hidden || run.paused || state.mode !== 'play') return true;
  juice.update(dt);
  B.update(dt, player);
  return true;
}
// (after the follow camera's own update, which this frame's shot replaces)
function frameBossCut() {
  const C = bossCut && run.boss?.cut;
  if (!C) return;
  const k = Math.min(1, C.t / C.length), e = k * k * (3 - 2 * k);
  camera.position.lerpVectors(C.from, C.to, e).add(juice.offset(cutShake));
  camera.lookAt(C.look);
  gfx.focus = camera.position.distanceTo(C.look);
}
const cutShake = new THREE.Vector3();

const GAME = {
  loadRooms,
  step(dt) {
    updateMusic(dt);
    systems.traversal.update(dt);
    systems.fx.update(dt);
    run.gadgets.animate(dt,!bossScene && state.mode==='play' && !run.polypT && (run.phase==='explore'||run.phase==='boss'));
    systems.layout.update(dt);
    systems.touch.update(dt);
    if (!bossScene && !bossCut && run.phase === 'boss' && run.boss?.cut) { bossCut = { hudHidden: hud.el.hidden }; hud.el.hidden = true; }
    if (bossScene) stepBossScene(dt); else if (!(bossCut && stepBossCut(dt))) systems.gameplay.update(dt);
    menus.tick(dt);          // the pick screen's outro runs on this clock
    if (!bossScene && run.phase === 'boss' && run.boss?.dying && !run.boss.dead) {
      if (dendi) startBossScene(run.boss); else run.boss.die();   // a stage with no cat: it just dies
    }
    dendi?.tick(bossScene && (!overlay.hidden || run.paused || state.mode !== 'play') ? 0 : dt, player.position);
    updateForceFields(player.position, camera.position,dt);   // (where the camera was last frame)
    systems.avatar.update(dt);
    systems.input.update(dt);
    systems.camera.update(dt);
    frameBossCut();
    mainMenu.update(dt, !overlay.hidden && state.mode === 'play', state.mode === 'creator');
    run.evolutionReveal.update(dt);   // the portrait animates while gameplay and menus hold the run still
    run.victory.update(dt);           // the ending: the jelly swimming home to the sea
    lightSlots?.update(dt, player.position);
    systems.shadow.update(dt);
    systems.hud.update(dt);
    systems.debug.update(dt);
  },
  render() { systems.render.update(); },
  // build what the scene needs for the graphics in use (stories count new shaders with it)
  compile() { const was = renderer.getRenderTarget(); renderer.setRenderTarget(drawnInto()); try { return renderer.compile(scene, camera, scene); } finally { renderer.setRenderTarget(was); } },
};
window.GAME = GAME;
window.mainMenu = mainMenu;

// --- Menus + keys ---------------------------------------------------------------
function renderQuality() {
  qualityRow.innerHTML = '<span>Graphics</span>' + CHOICES.map((q) => `<button data-q="${q}" class="${gfx.choice === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('');
}
renderQuality();
overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  sfx.tap();
  if (b.classList.contains('resume')) { const k = keptRun(); if (k) goToAct(k.act, k.carry, { continue: true }); }
  else if (b.classList.contains('play')) { if (stage.id === 1) { forgetRun(); showKept(); } play(); endContinue(); }
  else if (b.dataset.q) { gfx.setQuality(b.dataset.q); renderQuality(); }
  else if (b.dataset.act === 'dev') { overlay.classList.add('dev-ask'); overlay.querySelector('[name="dev-pass"]').focus(); }
  else if (b.dataset.act === 'dev-unlock') unlockDev();
  else if (b.dataset.act === 'home-tip') { homeTip.hidden = true; try { localStorage.setItem(HOME_TIP_KEY, 'off'); } catch {} }
  else if (b.dataset.act === 'creator') openCreator();
  else if (b.dataset.act === 'layout') openLayout();
  else if (b.dataset.act === 'arena4') location.href='?arena=act4';
  else if (b.dataset.act === 'duel') {   // dev: a fresh run with just the one enemy you pick
    overlay.hidden = true;
    const picks = run.duelChoices();
    run.ui.message('🐞 1 on 1 (dev)', 'Pick an enemy to face alone: a fresh run with nothing else in it. It comes back after you beat it.', [],
      [...picks.map((p) => ({ label: p.name, onClick: () => { run.startDuel(p); play(); } })), { label: 'Back', go: true, onClick: () => { overlay.hidden = false; } }]);
  }
  else if (b.dataset.act === 'kit') {    // dev: try any treasure or evolution on this run (test-kit.js)
    overlay.hidden = true;
    kit.show(run, { onPlay: () => { play(); endContinue(); }, onBack: () => { overlay.hidden = false; } });
  }
  else if (b.dataset.act === 'tuner') {    // dev: edit bug and treasure numbers, live (balance-editor.js)
    overlay.hidden = true;
    tuner.show(run, { onPlay: () => { play(); endContinue(); }, onBack: () => { overlay.hidden = false; } });
  }
  else if (b.dataset.act === 'boss') {   // dev: a fresh run straight to the boss you pick (level 1, no treasures)
    overlay.hidden = true;
    const picks = run.bossChoices();
    run.ui.message('👹 Fight boss (dev)', 'Pick a boss: a fresh run straight to its intro. A boss from another act reloads the game into that act first.', [],
      [...picks.map((p) => ({ label: p.name, onClick: () => { run.startBossFight(p); play(); } })), { label: 'Back', go: true, onClick: () => { overlay.hidden = false; } }]);
  }
  else if (b.dataset.act === 'sound') { unlockAudio(); setMuted(!isMuted()); b.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on'; }
  else if (b.dataset.act === 'music') {
    unlockAudio();
    musicOn = !musicOn;
    try { localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch {}
    b.textContent = musicOn ? '🎵 Music on' : '🎵 Music off';
  }
  else if (b.dataset.act === 'board') { overlay.hidden = true; run.showBoard(() => { overlay.hidden = false; }); }
  else if (b.dataset.act === 'book') { overlay.hidden = true; run.showBook(() => { overlay.hidden = false; }); }
  else if (b.dataset.act === 'diag') { enableDebug(); b.disabled = true; b.textContent = '🩺 Diagnostics on'; }
});
const kit = new TestKit(document.body);
const tuner = new BalanceEditor(document.body);
window.kit = kit;       // stories drive them (dev/test-kit, dev/balance-editor)
window.tuner = tuner;
window.dendi = dendi;   // stories check on the cat (models/dendi-*)
// Dev tools (layout editor, boss and 1-on-1 fights, test kit, the other act, diagnostics) wait behind one
// 🔒 Dev button and a password. It only keeps them out of players' way: it's in the page's source.
const DEV_PASS = 'chan', DEV_KEY = 'jellyfight.dev';
function unlockDev() {
  const box = overlay.querySelector('[name="dev-pass"]');
  if (box.value.trim().toLowerCase() !== DEV_PASS) { box.value = ''; box.classList.add('wrong'); box.placeholder = 'Wrong password'; box.focus(); return; }
  overlay.classList.remove('dev-ask');
  overlay.classList.add('dev-open');
  try { sessionStorage.setItem(DEV_KEY, '1'); } catch {}
}
overlay.querySelector('[name="dev-pass"]').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlockDev(); });
try { if (sessionStorage.getItem(DEV_KEY)) overlay.classList.add('dev-open'); } catch {}   // still open after a reload into the other act
document.addEventListener('pointerlockchange', () => {
  if (state.mode !== 'play' || IS_TOUCH) return;
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.hidden = locked || menus.open || run.phase === 'dead' || run.phase === 'won';   // a finished run shows its end screen, not the pause menu
  if (locked) mainMenu.launch();
  else mainMenu.cancelLaunch();
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
let warming = true;   // no frames drawn meanwhile: a frame would build every program it sees at once
async function warmUp() {
  playBtn.disabled = true;
  playBtn.textContent = 'Loading…';
  const P = player.position;
  const kinds = Object.keys(TYPES), temp = [...kinds, kinds[0], kinds[0]].map((t, i) => {   // every bug, and two more to wear the hit flash and the acid melt
    const e = enemies.spawn(t, P.clone().add(new THREE.Vector3(0.03 * i, 0.01, 0.06)));
    e.mesh.scale.setScalar(e.baseScale);
    e.face.scale.setScalar(e.baseScale);
    return e;
  });
  xpDrops.drop(P.clone(), 1, 1);
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
  run.energyShield.group.visible = true;                 // prepare the shell before any evolution is chosen
  run.energyShield.group.scale.setScalar(0.001);
  run.mirage.prepare(); run.mirage.group.visible = true;
  run.fireTrail.warm(true, P.clone().setY(P.y + 0.002));
  const warmAdorn = ADORNMENTS.map(k => run.adorn.piece(k).group);
  warmAdorn.forEach(g => { g.visible = true; });
  run.evolutionReveal.warm(true);
  run.elites.warm(true, P.clone().setY(P.y + 0.03));
  run.roomTreasures[0].show(P.clone(), 22);                // a treasure's chest and its timer ring
  const warmBubbles = [run.bubbles.mesh(run.bubbles.mat), run.bubbles.mesh(run.bubbles.goldMat)];
  warmBubbles.forEach((m) => { m.position.copy(P).setY(P.y + 0.03); m.scale.setScalar(0.01); });
  const warmLooks = run.bubbles.looks.warm(P.clone().setY(P.y + 0.03));   // every element projectile
  const warmFx = [new THREE.Mesh(run.bubbles.puddleGeo, run.bubbles.acidMat), new THREE.Line(new THREE.BufferGeometry().setFromPoints([P, P.clone().setY(P.y + 0.05)]), run.bubbles.zapMat)];
  warmFx.forEach((m) => { m.position.copy(P); scene.add(m); });
  temp[0].markT = temp[0].freezeT = 1;          // Sticky Note and Ice Cube looks
  enemies.markLook(temp[0], 0);
  temp[2].slowT = temp[2].chillT = 1;           // the slow ring and a chilled bug's ice crown
  enemies.markLook(temp[2], 0);
  temp.at(-2).mesh.traverse((o) => { if (o.isMesh) o.material = FLASH; });   // the hit flash, instanced
  temp.at(-1).mesh.traverse((o) => { if (o.isMesh) o.material = fx.acid.gooMat; });   // an acid-finished bug melting (acid-looks.js)
  const warmBoss = makeBoss(stage.boss, scene, enemies, fx, world, { arena: ARENA, toughness: stage.toughness });   // this act's boss
  warmBoss.warm?.(true);                         // (and what only shows mid-fight: the Clog's acid)
  const spit = new THREE.Mesh(enemies.shotGeo, enemies.shotMat);
  spit.position.copy(P).setY(P.y + 0.03);
  scene.add(spit);
  batcher.sync();                                // build the instanced batches so they compile too
  // furniture the camera sees through, as the see-through copies it will swap in (camera.js)
  // (and what the boss fight keeps faint though it doesn't collide: the Clog's shower curtain)
  const seeThrough = tpc.seeThroughWarmers(null, (stage.boss.seeThrough || []).flatMap((n) => meshesNamed(scene, n)));
  seeThrough.forEach((m) => scene.add(m));
  shelve();
  try {
    await prepareGraphics((f) => JF_LOAD.step(0.65 + 0.3 * f, 'Preparing the graphics…'));
    await JF_LOAD.step(0.97, 'Almost ready…');
    uploadAll(true);
  } catch (e) {
    reportError(e, 'preparing graphics');
  }
  seeThrough.forEach((m) => scene.remove(m));   // not disposed: that would throw the built shaders away
  run.gadgets.warm(false);
  run.energyShield.update(0);
  run.mirage.group.visible = false;
  run.fireTrail.warm(false);
  run.evolutionReveal.warm(false);
  warmAdorn.forEach(g => { g.visible = false; });
  run.elites.warm(false);
  run.roomTreasures[0].hide();
  warmBubbles.forEach((m) => { m.visible = false; run.bubbles.pool.push(m); });
  warmLooks.forEach((m) => run.bubbles.looks.release(m));
  warmFx.forEach((m) => scene.remove(m));
  warmBoss.dispose();
  scene.remove(flash);
  scene.remove(spit);
  temp.forEach((e) => enemies.kill(e, true));
  enemies.list = enemies.list.filter((e) => !temp.includes(e));   // keep the elites run.start() registered
  xpDrops.clear();
  fx.clear();
  tentacles.forEach((m) => { m.visible = false; m.material = lash.mat; lash.pool.push(m); });
  playBtn.disabled = false;
  playBtn.textContent = 'Play';
  warming = false;
}

// renderer.compileAsync, a few programs at a time: the GPU builds them all in the background, and
// each is waited for in turn (getUniforms waits for its build), handing the page back every 40 ms
// so the loading screen moves and says how far along it is. Where the browser lacks
// KHR_parallel_shader_compile that wait is the build itself, which compileAsync would leave to the
// first frame, all at once.
// Only for what is drawn: Low draws to the screen (tone mapped), Medium/High into the composer's
// render target (linear, no tone mapping), and each needs its own program for every material.
// Switching between them in the pause menu prepares the other set then (retier), from the scene
// and the shelf of what warmUp showed.
async function prepareGraphics(progress) {
  const programs = new Set(), was = renderer.getRenderTarget(), layers = camera.layers.mask;
  try {
    camera.layers.enable(0);   // as uploadAll draws it: the home portrait may have isolated its own layer
    renderer.setRenderTarget(drawnInto());
    for (const root of [scene, shelf]) for (const m of renderer.compile(root, camera, scene)) programs.add(renderer.properties.get(m).currentProgram);
  } finally {
    renderer.setRenderTarget(was);
    camera.layers.mask = layers;
  }
  const waiting = [...programs], total = waiting.length || 1;
  while (waiting.length) {
    const until = performance.now() + 40;
    while (waiting.length && performance.now() < until) {
      const program = waiting[0];
      if (program && !program.isReady()) break;   // still building: look again next time
      program?.getUniforms();
      waiting.shift();
    }
    await progress(1 - waiting.length / total);
  }
}

const nextTask = () => new Promise((r) => setTimeout(r));
const tiny = new THREE.WebGLRenderTarget(4, 4);   // stands in for the composer's: the same shaders
const drawnInto = () => (gfx.composer ? tiny : null);

// One stand-in per material and kind of mesh warmUp showed, kept so the other graphics set can be
// prepared after those things have left the scene (a bug type, the boss, an evolution's look).
const shelf = new THREE.Group();
function shelve() {
  const seen = new Set();
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || o.isBatchedMesh) return;
    const g = o.geometry, shape = g ? [Object.keys(g.attributes), Object.keys(g.morphAttributes), g.attributes.color?.itemSize] : '';
    for (const m of [].concat(o.material || [])) {
      const key = `${m.uuid}|${o.type}|${!!o.instanceColor}|${!!o.morphTexture}|${shape}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let p;
      if (o.isInstancedMesh) {
        p = new THREE.InstancedMesh(g, m, 1);
        if (o.instanceColor) p.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
        p.morphTexture = o.morphTexture;
      } else if (o.isSkinnedMesh) { p = new THREE.SkinnedMesh(g, m); p.bind(o.skeleton, o.bindMatrix); }
      else if (o.isSprite) p = new THREE.Sprite(m);
      else p = new (o.isPoints ? THREE.Points : o.isLineSegments ? THREE.LineSegments : o.isLineLoop ? THREE.LineLoop : o.isLine ? THREE.Line : THREE.Mesh)(g, m);
      shelf.add(p);
    }
  });
}

// Graphics switched between Low and Medium/High: build the other set behind the menu before play goes on
let playLabel = null, retiers = 0;
gfx.onRetarget = () => {
  if (!retiers++) playLabel = playBtn.textContent;
  warming = true;
  playBtn.disabled = true;
  playBtn.textContent = 'Preparing graphics…';
  gfx.ready = (gfx.ready || Promise.resolve()).then(retier);
};
async function retier() {
  warming = true;
  try {
    await prepareGraphics(nextTask);
    uploadAll(true);
  } catch (e) {
    reportError(e, 'preparing graphics');
  }
  if (--retiers) return;   // another switch is queued behind this one
  playBtn.disabled = false;
  playBtn.textContent = playLabel;
  warming = false;
}

// Put every texture and mesh on the GPU now. Otherwise each goes up the first time it comes into
// view, and a turn of the camera that brings in a corner of the room stalls a phone for a frame.
function uploadAll(gamePasses = false) {
  const cameraMask = camera.layers.mask;
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const k in m) if (m[k]?.isTexture) renderer.initTexture(m[k]);
  });
  const culled = [];
  scene.traverse((o) => { if (o.isMesh && o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
  const was = renderer.getRenderTarget();
  try {
    if (gamePasses) camera.layers.enable(0);   // the home portrait may already have isolated its own layer
    renderer.setRenderTarget(drawnInto());   // Low: the screen, under the loading screen or menu
    renderer.render(scene, camera);
    if (gamePasses && gfx.composer) { renderer.setRenderTarget(was); gfx.render(); }   // and the composer's own passes (AO, bloom), not at the first frame
  } finally {
    renderer.setRenderTarget(was);
    culled.forEach((o) => { o.frustumCulled = true; });
    camera.layers.mask = cameraMask;
  }
}

overlay.hidden = false;
// On from the act before (run.actComplete): no main menu, just the act's name while it loads,
// then straight into it. Phones start on their own; desktop needs one click to lock the mouse.
const continuing = !!peekAction()?.continue && !!carried();
const titleEl = overlay.querySelector('h1');
if (continuing) {
  overlay.classList.add('cont');
  titleEl.textContent = `Act ${stage.id}`;
  overlay.querySelector('.cont-note').textContent = stage.subtitle;
}
// a run kept from a closed tab (stages.js): the act 1 menu offers to pick it up at the act it reached
function showKept() {
  const k = stage.id === 1 && !continuing ? keptRun() : null, btn = overlay.querySelector('.resume');
  btn.hidden = !k;
  if (k) btn.innerHTML = `Continue act ${k.act}<small>${STAGES[k.act - 1].subtitle} · Level ${k.carry.level} · Score ${(+k.carry.score || 0).toLocaleString()}</small>`;
}
showKept();
GAME.showKept = showKept;
function endContinue() {
  if (!overlay.classList.contains('cont')) return;
  overlay.classList.remove('cont');
  titleEl.textContent = 'Jelly Fight';
}
// Stories (src/stories.js, areas in src/stories/): index.html?story=<name> opens one live; index.html?stories lists them
const storyParams = new URLSearchParams(location.search);
export const ready = warmUp().then(() => {
  // the dev 1 on 1 picker reloaded into this act to fight an elite here: set that fight up
  const then = pendingAction();
  if (then?.continue && continuing) {
    if (IS_TOUCH) {
      play();
      endContinue();
      // the reload lost the tap that allowed sound: the next touch turns it back on
      addEventListener('pointerdown', () => unlockAudio(), { once: true, capture: true });
    } else playBtn.textContent = 'Click to dive in';
  }
  if (then?.duel) { const pick = run.duelChoices().find((p) => p.name === then.duel); if (pick) run.startDuel(pick); }
  if (then?.boss) { const pick = run.bossChoices().find((p) => p.name === then.boss); if (pick) run.startBossFight(pick); }
  if (then?.layout) openLayout();   // the layout editor's act buttons reload into the act with it open
  if (!storyParams.has('story') && !storyParams.has('stories')) return;
  import('./stories.js').then((S) => (storyParams.has('story') ? S.mount(storyParams.get('story')) : S.list()));
});

// How often and how sharp (pacing.js): phones cap at 60 fps (a 120 Hz Pixel would otherwise do
// twice the GPU work), everything draws slowly behind a menu, and the governor lowers the pixel
// ratio when frames run long and raises it back with headroom.
const pacer = new FramePacer({ fps: IS_TOUCH ? LOOK.num('phone-fps', 60) : LOOK.num('desktop-fps', 0), menuFps: LOOK.num('menu-fps', 20) });
const maxRatio = Math.min(devicePixelRatio || 1, IS_TOUCH ? LOOK.num('phone-pixel-ratio', 1.5) : LOOK.num('desktop-pixel-ratio', 2));
const governor = new FrameGovernor({
  fps: pacer.fps || 60, scale: maxRatio, max: maxRatio, min: Math.min(maxRatio, LOOK.num('min-pixel-ratio', 1)),
});
renderer.setPixelRatio(maxRatio);
gfx.resize();
function adapt(ms) {
  const c = governor.sample(ms);
  if (c?.scale) { renderer.setPixelRatio(c.scale); gfx.resize(); }
}
function pacingReadout() {
  const g = governor, last = g.log[g.log.length - 1];
  return `${gfx.quality} | cap ${pacer.fps || 'none'} | aim ${(1000 / g.target).toFixed(0)} fps`
    + (lightSlots ? ` | lamps ${lightSlots.lit().length}/${lightSlots.lamps.length}` : '')
    + (last ? ` | last: ${last.why} ${last.scale}` : '');
}
window.pacing = { pacer, governor, lightSlots };

// The graphics chip resetting (iOS backgrounding, out of GPU memory): pause, rebuild, resume
const gpu = recoverGpu({ renderer, scene, camera, gfx, prepare: () => prepareGraphics(nextTask), pause: () => { if (document.pointerLockElement) document.exitPointerLock(); pause(); } });
// iOS can lose the context while the page is hidden without telling the page: check on return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) run.bubbles.silenceAttacks();
  if (!document.hidden && renderer.getContext().isContextLost() && !gpu.lost) {
    renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  }
});

const clock = new Clock();
let lastFrame = 0;
// One animation frame. The governor's pixel-ratio change goes in before the frame is drawn:
// resizing the canvas clears it, so a change made after drawing showed as a whole black frame.
GAME.frame = (now) => {
  if (warming) return;
  const covered = !overlay.hidden || menus.open || kit.open;
  if (!pacer.due(now, covered)) return;
  const ms = now - lastFrame;
  lastFrame = now;
  const dt = clock.tick(now);
  try {
    if (!covered && state.mode === 'play' && !run.paused) adapt(ms);
    GAME.step(dt);
    GAME.render();
  } catch (e) {
    reportError(e, 'frame');
  }
};
renderer.setAnimationLoop((now) => GAME.frame(now));

// Handy for poking at things from the browser console
Object.assign(window, { batcher, THREE, player, world, tpc, input, gfx, hud, run, enemies, lash, xpDrops, traversal, menus, fx, gpu, kit });
