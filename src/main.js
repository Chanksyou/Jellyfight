// Jelly Run: wires the game together on top of the baked apartment (src/boot.js loads it).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World } from './collision.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { Input } from './input.js';
import { Graphics, CHOICES, GRADE } from './graphics.js';
import { FramePacer, FrameGovernor } from './pacing.js';
import { LightSlots } from './light-slots.js';
import { EXPERIMENTS } from './experiments.js';
import { setLite, liteOn } from './lite-materials.js';
import { recoverGpu } from './gpu-recovery.js';
import { buildCharacter, normalizeLook, drawnBigger } from './character.js';
import { TestKit } from './test-kit.js';
import { BalanceEditor } from './balance-editor.js';
import { Creator } from './creator.js';
import { MainMenu } from './main-menu.js';
import { ADORNMENTS } from './words.js';
import { Hud, inPoly } from './hud.js';
import { addSurfaceDetail } from './detail.js';
import { STAGES, currentStage, carried, forgetRun, goToAct, keptRun, pendingAction, peekAction, stageOf } from './stages.js';
import { prepareApartment, addStageWalls, Traversal, meshesNamed } from './traversal.js';
import { updateForceFields } from './forcefield.js';
import { addBathroomDetails } from './bathroom.js';
import { dressSet } from './set-dressing.js';
import { addDendi } from './cat.js';
import { Enemies, TYPES, FLASH } from './enemies.js';
import { juice } from './juice.js';
import { addSkyline } from './skyline.js';
import { applyLayout, applyVentLayout, LayoutEditor } from './layout.js';
import { unlock as unlockAudio, unlockOnGesture, setMuted, isMuted, audio, sfx } from './sfx.js';
import { Music } from './music.js';
import { Ambience } from './ambience.js';
import { SongTrack, TRACKS, fetchTrack } from './song-track.js';
import { jellyPortrait } from './jelly-portrait.js';
import { AuraPainter } from './pick-auras/painter.js';
import { Leaderboard } from './leaderboard.js';
import { reportError, enableDebug } from './errors.js';
import { shadeWithBakedAO } from './baked-ao.js';
import { BAKED_LIGHT, followGlow, setBakedLight } from './baked-light.js';
import { mapPieces } from './piece-light.js';
import { wireFeedback } from './feedback.js';
import { batcher, HIDDEN } from './batch.js';
import { StaticBatches, freeze } from './static-batch.js';
import { LOOK } from './look.js';
import { AirLight } from './air-light.js';
import { Clock, GameplaySystem, LayoutSystem, TouchSystem, AvatarSystem, InputSystem, CameraSystem, ShadowSystem, HudSystem, DebugSystem, RenderSystem } from './systems.js';

const BUILD = 'v648';   // shown in the corner of the main screen, so you can tell which version is running
window.JF_BUILD = BUILD;
import { Lash } from './combat.js';
import { XpDrops } from './pickups.js';
import { Fx } from './fx.js';
import { UI } from './ui.js';
import { Run, makeBoss, DEV_KEY } from './run.js';
import { devSheetHtml, initDevPanel } from './dev-panel.js';
import { TYPE_PICK } from './jelly-types.js';
import { TypePicker } from './pick-screen.js';
import { AttackPreview } from './attack-preview.js';
import { picksType } from './first-run.js';
import { CONTENT } from './content.js';
import { bagHtml } from './treasure-bag.js';
import { summaryHtml } from './pause-summary.js';
import { icon } from './icons.js';
import { easyChosen, chooseEasy } from './easy.js';
import { FieldPerf } from './field-perf.js';
import { Ambient } from './ambient.js';
import { TouchControls, IS_TOUCH } from './touch.js';

const APT = window.APT;
const { scene, renderer, camera } = APT;
batcher.scene = scene;
const stage = currentStage();          // act 1, or a later act the run moved on to (stages.js)
const LOOK_KEY = 'jellyrun.look.v2';   // v2: the fluorescent jelly is the new default

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
  #g-over { position: fixed; inset: 0; display: grid; place-items: center; background: var(--ui-scrim, #0b1622b8); color: var(--ui-ink, #e8f4f8);
    text-align: center; font-family: var(--ui-font-text, system-ui, sans-serif); z-index: 10; }
  #g-over[hidden], #g-over [hidden] { display: none !important; }
  /* Pausing keeps browser zoom blocked, while the Treasure bag can still scroll. */
  #g-over:not(.menu-home) { touch-action: pan-y; }
  /* the main screen (and the pause menu) shows just itself: the HUD waits behind it */
  #g-over:not([hidden]) ~ #hud { visibility: hidden; }
  #g-over > .menu-col { box-sizing: border-box; width: min(100%, 880px); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-3);
    padding: max(var(--ui-space-3), env(safe-area-inset-top)) max(var(--ui-space-4), env(safe-area-inset-right)) max(var(--ui-space-3), env(safe-area-inset-bottom)) max(var(--ui-space-4), env(safe-area-inset-left)); }
  #g-over > .menu-col > * { flex-shrink: 0; }   /* a tall menu scrolls; it never squeezes its pieces */
  /* what shows when: the title (home, or launching into the run) and the act's loading screen, or the pause menu (look.css has the title's layout) */
  #g-over:is(.menu-home, .menu-launching, .cont) .pause-only { display: none; }
  #g-over:not(.menu-home):not(.menu-launching) .home-only { display: none; }
  #g-over:not(:is(.menu-home, .menu-launching, .cont)) .title-only { display: none; }
  /* the version, in the corner of the title (and the act's loading screen) */
  #g-over .ver { position: absolute; right: max(12px, env(safe-area-inset-right)); bottom: max(10px, env(safe-area-inset-bottom)); margin: 0;
    font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); color: var(--ui-ink); text-shadow: 0 1px 6px var(--ui-shade); }
  #g-over .cont-note { margin: 0; color: var(--ui-ink-dim); font: 400 var(--ui-size-heading)/1.3 var(--ui-font-text); }
  #g-over:not(.cont) .cont-note { display: none; }
  /* the pause menu */
  #g-over .pause-title { margin: 0; }
  #g-over .pause-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-3); }
  #g-over .pause-resume { min-width: 200px; min-height: 56px; }
  #g-over .pause-summary { width: 100%; max-width: 560px; display: grid; gap: var(--ui-space-3); text-align: left; }
  #g-over .ps-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--ui-space-2) var(--ui-space-3); }
  #g-over .ps-hp { flex: 1 1 200px; display: grid; gap: var(--ui-space-1); }
  #g-over .ps-row .ui-chip { min-height: 32px; font-size: var(--ui-size-body); }
  #g-over .ps-items { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); }
  #g-over .ps-item { position: relative; display: grid; place-items: center; width: 36px; height: 36px; font-size: 22px; background: var(--ui-glass); border-radius: var(--ui-radius-s); }
  #g-over .ps-item sub { position: absolute; right: 2px; bottom: 0; font: 700 var(--ui-size-label)/1 var(--ui-font-text); text-shadow: 0 1px 2px var(--ui-shade); }
  /* the pause menu's list of what you carry (treasure-bag.js) */
  #g-over .g-bag { width: 100%; text-align: left; }
  #g-over .g-bag:empty, #g-over:is(.menu-home, .menu-launching, .cont) .g-bag { display: none; }
  #g-over .g-bag h2 { margin: 0 0 var(--ui-space-2); text-align: center; font: 500 var(--ui-size-heading)/1.1 var(--ui-font-display); }
  #g-over .g-bag .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--ui-space-2); }
  #g-over .g-bag .t { display: flex; gap: var(--ui-space-3); align-items: flex-start; background: var(--ui-panel); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-m); padding: var(--ui-space-2) var(--ui-space-3); }
  #g-over .g-bag .i { font-size: 24px; font-weight: 400; line-height: 1.1; }
  #g-over .g-bag .t > div { min-width: 0; flex: 1; }
  #g-over .g-bag .n { font: 600 var(--ui-size-body)/1.3 var(--ui-font-text); }
  #g-over .g-bag .tag { margin-left: var(--ui-space-1); padding: 1px 8px; border-radius: var(--ui-radius-pill); background: var(--ui-glass); font: 600 var(--ui-size-label)/1.4 var(--ui-font-text); }
  #g-over .g-bag p { margin: 2px 0 0; font: 400 var(--ui-size-label)/1.4 var(--ui-font-text); color: var(--ui-ink-dim); }
  #g-over .g-bag .g { margin-top: var(--ui-space-1); font: 400 var(--ui-size-label)/1.4 var(--ui-font-text); color: var(--ui-mint); }
  #g-over .g-bag .g.dim { color: var(--ui-ink-dim); }
  #g-over .g-bag .g i { display: block; height: 5px; margin-top: 3px; border-radius: 3px; background: var(--ui-shade); overflow: hidden; }
  #g-over .g-bag .g i::after { content: ''; display: block; height: 100%; width: calc(var(--k) * 100%); background: var(--ui-mint); }
  #g-over .keys { color: var(--ui-ink-dim); font-size: var(--ui-size-label); line-height: 1.9; }
  #g-over kbd { background: var(--ui-glass); border: 1px solid var(--ui-line); border-radius: 4px; padding: 1px 6px; font: inherit; }
  #g-over .touch-only { display: none; }
  body.touch #g-over .touch-only { display: block; }
  body.touch #g-over .desk-only { display: none; }
  /* iPhones can't go full screen from the page: point them at Add to Home Screen (manifest.webmanifest) */
  #g-over .home-tip { display: flex; align-items: center; gap: var(--ui-space-2); padding: 0 0 0 var(--ui-space-3); border-radius: var(--ui-radius-m); background: var(--ui-panel); border: 1px solid var(--ui-line); font: 400 var(--ui-size-label)/1.3 var(--ui-font-text); }
  #g-over.cont .home-tip { display: none; }
  #g-over .home-tip svg { width: 15px; height: 18px; vertical-align: -3px; }
  #g-over .home-tip button { min-width: var(--ui-target); min-height: var(--ui-target); background: none; border: 0; color: var(--ui-ink-dim); font-size: 20px; cursor: pointer; }
  /* Settings (and the Trophies chooser): sheets inside the menu, over its own scrim */
  #g-over .ui-sheet { text-align: left; }
  #g-over .set-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: var(--ui-space-3) var(--ui-space-5); }
  #g-over .set-row { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); }
  #g-over .set-row .ui-label { color: var(--ui-ink); }
  #g-over .set-easy { grid-column: 1 / -1; }
  #g-over .set-easy p { margin: var(--ui-space-1) 0 0; color: var(--ui-ink-dim); }
  #g-over .set-ver { margin: var(--ui-space-3) 0 0; text-align: center; color: var(--ui-ink-dim); font: 600 var(--ui-size-label)/1.3 var(--ui-font-text); }
  #g-over .trophy-btns { display: grid; gap: var(--ui-space-2); }
  #g-over .trophy-btns .ui-btn { justify-content: flex-start; min-height: 56px; }
  #g-over .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); justify-content: center; align-items: center; margin-top: var(--ui-space-3); }
  /* dev tools: one Dev button; the password opens the rest */
  #g-over .dev-lock, #g-over .dev-btn, #g-over #g-fps { display: none; }
  #g-over.dev-reveal .dev-btn { display: inline-flex; }   /* tapping the version 5 times */
  #g-over.dev-open #g-fps { display: inline; }
  #g-over.dev-ask .dev-lock { display: flex; }
  #g-over.dev-open .dev-btn { display: inline-flex; }
  #g-over.dev-open .dev-lock { display: none; }
  #g-over .menu-dev .ui-seg[aria-label="Group"] { display: flex; }
  #g-over .menu-dev .ui-seg[aria-label="Group"] > button { flex: 1; }
  #g-over .dev-pane { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--ui-space-3); margin-top: var(--ui-space-3); }
  #g-over .dev-pane[hidden] { display: none; }
  #g-over .dev-lock input { font: var(--ui-size-body) var(--ui-font-text); width: 150px; min-height: var(--ui-target); box-sizing: border-box; padding: 0 var(--ui-space-3); border-radius: var(--ui-radius-s); border: 1px solid var(--ui-line); background: var(--ui-shade); color: var(--ui-ink); }
  #g-over .dev-lock input.wrong { border-color: var(--ui-boss); }
  /* phones play sideways only: held upright, the game is covered until it's turned (iOS can't lock orientation) */
  #g-turn { display: none; position: fixed; inset: 0; z-index: 100; flex-direction: column; align-items: center; justify-content: center; gap: var(--ui-space-3);
    background: var(--ui-deep, #0b1622); color: var(--ui-ink); padding: var(--ui-space-5); text-align: center; }
  #g-turn p { margin: 0; }
  #g-turn .ui-text { color: var(--ui-ink-dim); }
  #g-turn .ph { width: 44px; height: 76px; margin-bottom: var(--ui-space-2); box-sizing: border-box; border: 4px solid var(--ui-mint); border-radius: 10px; animation: g-turn 2.8s var(--ui-ease-float) infinite; }
  @keyframes g-turn { 0%, 25% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
  /* reduced motion: the phone is already on its side and only fades */
  @keyframes g-turn-fade { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) { #g-turn .ph { transform: rotate(-90deg); animation: g-turn-fade 2.4s var(--ui-ease-float) infinite; } }
  body.calm #g-turn .ph { transform: rotate(-90deg); animation: g-turn-fade 2.4s var(--ui-ease-float) infinite; }
  body.upright #g-turn { display: flex; }
</style>
<div id="g-over"><div class="menu-col">
  <h1 class="ui-display title-only">Jelly Run</h1>
  <h2 class="ui-title pause-title pause-only">Paused</h2>
  <p class="cont-note"></p>
  <details class="menu-help home-only">
    <summary class="ui-btn ui-btn--ghost"><span class="menu-help-icon" aria-hidden="true">${icon('info')}</span>How to play</summary>
    <p class="menu-loop ui-text">Move and dodge while your jelly attacks automatically. Collect XP to level up, choose upgrades, and find treasures. Survive the countdown, beat the boss, and grow into the next act.</p>
  </details>
  <button class="resume ui-btn ui-btn--primary" hidden></button>
  <button class="play ui-btn ui-btn--primary title-only">Play</button>
  <div class="menu-tiles home-only">
    <button class="ui-tile" data-act="book">${icon('book')}Treasure book</button>
    <button class="ui-tile" data-act="trophies">${icon('trophy')}Trophies</button>
    <button class="ui-tile" data-act="creator">${icon('palette')}Change your look</button>
  </div>
  <div class="pause-actions pause-only">
    <button class="ui-btn ui-btn--primary pause-resume">${icon('play')}Resume</button>
    <button class="ui-btn" data-act="settings">${icon('gear')}Settings</button>
    <button class="ui-btn" data-act="main-menu">${icon('home')}Main menu</button>
  </div>
  <section class="pause-summary ui-panel pause-only"></section>
  <div class="home-tip" hidden><span>Full screen: tap Share <svg viewBox="0 0 15 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1v11M3.5 5l4-4 4 4M5 8H1.5v9h12V8H10"/></svg> then <b>Add to Home Screen</b></span><button data-act="home-tip" aria-label="Hide this tip">×</button></div>
  <div class="g-bag"></div>
  <div class="keys pause-only">
    <div class="touch-only">Left thumb move &nbsp;·&nbsp; right thumb look &nbsp;·&nbsp; jump button</div>
    <div class="desk-only"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp; <kbd>Mouse</kbd> look &nbsp; <kbd>Space</kbd> jump &nbsp; <kbd>Esc</kbd> pause</div>
  </div>
</div>
<div class="ver title-only" title="The game's version: check it matches the latest update">Version ${BUILD.replace(/^v/, '')}</div>
<button class="ui-btn ui-btn--icon menu-gear home-only" data-act="settings" aria-label="Settings">${icon('gear')}</button>
<div class="ui-scrim" hidden></div>
<section class="ui-sheet menu-settings" role="dialog" aria-modal="true" aria-label="Settings" hidden>
  <div class="ui-header"><h2>Settings</h2><button class="ui-btn ui-btn--icon" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>
  <div class="set-grid"></div>
  <button class="ui-btn" data-act="install" hidden>${icon('install')}Install app</button>
  <div class="row dev-lock"><input type="password" name="dev-pass" placeholder="Dev password" autocomplete="off"><button class="ui-btn" data-act="dev-unlock">Unlock</button></div>
  <div class="row"><button class="ui-btn ui-btn--ghost dev-btn" data-act="dev">${icon('lock')}Dev</button></div>
  <p class="set-ver">Version ${BUILD.replace(/^v/, '')}<span id="g-fps"></span></p>
</section>
${devSheetHtml(icon)}
<section class="ui-sheet menu-trophies" role="dialog" aria-modal="true" aria-label="Trophies" hidden>
  <div class="ui-header"><h2>Trophies</h2><button class="ui-btn ui-btn--icon" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>
  <div class="trophy-btns"><button class="ui-btn" data-act="achievements">${icon('medal')}Achievements</button><button class="ui-btn" data-act="board">${icon('trophy')}Leaderboard</button></div>
</section></div>
<div id="g-turn" role="alert"><div class="ph"></div><p class="ui-title">Turn your phone sideways</p><p class="ui-text">Jelly Run plays in landscape</p></div>`;
document.body.appendChild(ui);
const overlay = ui.querySelector('#g-over');
// a phone's frame-rate cap: look.css's default (30, cool) unless the player picked the other in the menu
const FPS_STORE = 'jellyrun.fps', FPS_CHOICES = [30, 60];
let phoneFps = LOOK.num('phone-fps', 30);
try { const f = +localStorage.getItem(FPS_STORE); if (FPS_CHOICES.includes(f)) phoneFps = f; } catch {}
// Settings' Text size (Normal or Large): ui-kit.css scales every kit size on html[data-text-size="large"]
const TEXT_KEY = 'jellyrun.textSize';
let textSize = 'normal';
try { if (localStorage.getItem(TEXT_KEY) === 'large') textSize = 'large'; } catch {}
document.documentElement.dataset.textSize = textSize;

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
// the jelly type pick screen (pick-screen.js), shown by the title's Play while jelly types are switched on
const picker = new TypePicker({ calm: () => juice.calm, look: () => state.look, portrait: (id, turn) => jellyPortrait(renderer, state.look, { turn, room: LOOK.num('pick-portrait-room', 1.3) }), live: new AttackPreview(renderer, () => gfx.quality) });
picker.mount(ui);

// --- World --------------------------------------------------------------------------
const ARENA = APT.arena || null;       // an act in a built arena (act 4's concert: boot.js), not the apartment
if (!ARENA) await applyLayout(APT.root, stage.id);   // your saved furniture edits for this act (dev layout editor), copies and props too
// Night: the room is lit by its own lamps (warm pools, dark corners). The image-based fill the
// apartment ships with brightened everything to daylight, so it's turned almost all the way
// down; a faint warm haze gives the far side of the room some depth.
// Each act can set its own mood: `--<name>-act<n>` in look.css wins over `--<name>` (the fill, the sky, the haze
// and the colour grade).
const actNum = (n, d) => LOOK.num(`${n}-act${stage.id}`, LOOK.num(n, d));
const actColor = (n, d) => LOOK.color(`${n}-act${stage.id}`, LOOK.color(n, d));
scene.environmentIntensity = actNum('night-fill', 0.12);
scene.background = new THREE.Color(ARENA ? LOOK.color('arena-background', '#030611') : actColor('night-sky', '#05060c'));
scene.fog = ARENA ? new THREE.FogExp2(LOOK.color('arena-background', '#030611'), LOOK.num('arena-haze', 0.3))
  : new THREE.FogExp2(actColor('haze-color', '#0c0604'), actNum('haze', 0.14));
if (!ARENA) { GRADE.gain.set(actColor('grade-gain', '#ffffff')); GRADE.lift.set(actColor('grade-lift', '#000000')); GRADE.sat = actNum('grade-sat', 1); }
// A stage with a `sky` (act 4's dawn) reads `--<sky>-*` from look.css instead of the night's values: each
// at the night's first clock minute, and `-late` at its last. setNight (below) moves them along.
const SKY = !ARENA && stage.sky || null;
const SKY_STEP = { fill: 0, haze: 0, sky: new THREE.Color(), hazeColor: new THREE.Color() };
function skyNow(t) {
  const mix = (n, d) => LOOK.num(`${SKY}-${n}`, d) + (LOOK.num(`${SKY}-${n}-late`, d) - LOOK.num(`${SKY}-${n}`, d)) * t;
  const tint = (out, n) => out.set(LOOK.color(`${SKY}-${n}`, '#000000')).lerp(new THREE.Color(LOOK.color(`${SKY}-${n}-late`, '#000000')), t);
  SKY_STEP.fill = mix('fill', 0.12); SKY_STEP.haze = mix('haze', 0.14);
  BAKED_LIGHT.uniforms.lbDayK.value = mix('daylight', 0);   // act 4's baked daylight picture (baked-light.js)
  tint(SKY_STEP.sky, 'sky'); tint(SKY_STEP.hazeColor, 'haze-color');
  scene.environmentIntensity = SKY_STEP.fill;
  scene.background.copy(SKY_STEP.sky);
  scene.fog.density = SKY_STEP.haze; scene.fog.color.copy(SKY_STEP.hazeColor);
}
if (!ARENA) dressSet(scene, APT.root);   // detailed TV / soundbar / shower curtain replace the flat baked ones
prepareApartment(APT, stage);
if (!ARENA) APT.lightMapped = mapPieces(APT.root, APT.bakedLight && BAKED_LIGHT.meta);   // the big pieces' own light maps (piece-light.js), before the collision world and the batches take their vertices
const world = new World(scene, { staticScene: true });
// the arena's invisible solids (its continuous floor, the jump-safe rails, the Encore's stage) collide
if (ARENA) for (const m of ARENA.solids) if (m.userData.noCollide) world.addCollider(m, false);
addStageWalls(world, stage, scene);
if (stage.details === 'bathroom') {   // after the collision world: decoration only
  addBathroomDetails(scene);
  const wide = stage.boss.set?.stretch?.[0]?.z[1];
  if (wide) addBathroomDetails(scene, wide).visible = false;   // the widened tub's, shown for the fight (boss-set.js)
}
// Dendi the cat (src/cat.js): he shows up for the boss finish (see the scene below), then goes
// back. A stage with a `cat` (acts 1 and 4: his box by the scratcher) has him asleep there all
// night; elsewhere, and with ?ambient=0, he waits hidden.
const catHome = !ARENA && EXPERIMENTS.ambient !== 0 ? stage.cat : null;
const dendi = addDendi(scene, catHome ? new THREE.Vector3(...catHome.at) : new THREE.Vector3(), catHome?.yaw || 0,
  { hidden: !catHome, asleep: !!catHome, calm: () => juice.calm || fx.reducedMotion.matches });
// fine close-up texture on the stage's surfaces (walls sit on the room outlines, so look around them)
if (!ARENA) addSurfaceDetail(world.colliders, {
  inside: (c) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dz]) => plan.some(([, poly]) => inPoly(c.x + dx, c.z + dz, poly))),
});
if (APT.bakedAO || APT.bakedLight || stage.sun) shadeWithBakedAO(APT.root);   // corners shadowed from the bake (baked-ao.js): Low and Medium skip N8AO; the patch also lights a stage's sun and the shell's baked light (baked-light.js)
const statics = new StaticBatches(scene, camera);   // the furniture drawn a material at a time (static-batch.js)
const ambient = new Ambient(() => juice.calm);   // plants that sway, glasses that shiver (ambient.js): marked before the batches copy their vertices
if (!ARENA) { ambient.mark(APT.root); statics.add(APT.root); freeze(APT.root); }   // the furniture holds still: no matrix work each frame (movers call markMoved)
const cityTime = APT.skylineAtlas && addSkyline(scene, [1.5, 5.5], APT.skylineAtlas);
function setNight(minutes) {
  cityTime?.(minutes);
  if (SKY) skyNow(THREE.MathUtils.clamp((minutes - stage.clock[0]) / (stage.clock[1] - stage.clock[0]), 0, 1));
}
setNight(stage.clock[0]);

applyVentLayout(stage.vents, stage.id);   // vents moved in the layout editor (baked, then your own)
const traversal = new Traversal(scene, stage);
const input = new Input(renderer.domElement);
const player = new Player(world, CONFIG.player);
scene.add(player.mesh);
const tpc = new ThirdPersonCamera(camera, world, CONFIG.camera);
const gfx = new Graphics(renderer, scene, camera, IS_TOUCH ? 'medium' : 'high', !!APT.bakedAO, EXPERIMENTS.shimmer ? traversal.air.heatScene : null);   // phones start on Medium so Low is a choice, not a default
fx.low = () => gfx.quality === 'low';
picker.painter = new AuraPainter(renderer, () => gfx.quality);   // the pick screen's side cards drawn in shaders
// Phones light the room with a few shared lights instead of every lamp (light-slots.js). Made
// before the shaders are built (warmUp) so they're built for this light count, once.
const slotCount = ARENA ? 0 : IS_TOUCH ? (EXPERIMENTS.lights ?? LOOK.num('phone-lights', 6)) : LOOK.num('desktop-lights', 0);   // the arena has no lamps
const lightSlots = slotCount > 0 ? new LightSlots(scene, slotCount, { fade: LOOK.num('light-fade', 0.5), reach: LOOK.num('light-reach', 1.5) }) : null;
if (lightSlots) APT.lights.rescan();
const air = ARENA ? null : new AirLight(scene, stage, { low: () => gfx.quality === 'low', calm: () => juice.calm });   // lamp halos and dust in the light (air-light.js)
window.air = air;
const enemies = new Enemies(scene, world, fx);
const lash = new Lash(scene, enemies, fx);
lash.getRig = () => player.avatar?.tentacles || null;
const xpDrops = new XpDrops(scene, world);

function showLook(l, hop) {
  player.setAvatar(drawnBigger(buildCharacter(normalizeLook(l), CONFIG.player.height)));
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

// A song with a recording (song-track.js TRACKS: the Encore's) only ever plays that recording, loaded once
// audio starts (silent if the file won't load: Chan wants no other track there); its beat is what a boss on
// the beat reads (`song`)
const tracks = {};
if (stage.arena) for (const name in TRACKS) fetchTrack(TRACKS[name]).catch(() => {});   // the file downloads while the act loads
// It loads once sound is on: a phone reloaded into the arena makes its audio before the tap that turns it
// on, and decoding into that silent context could hang (song-track.js `wait` tries it again).
function trackFor(name) {
  const A = audio(), T = TRACKS[name];
  if (!A || !T || (!tracks[name] && A.ctx.state !== 'running')) return null;
  if (!tracks[name]) { const t = tracks[name] = { track: new SongTrack(A.ctx, A.master, T), state: 'loading' }; t.track.load().then((ok) => { t.state = ok ? 'ready' : 'failed'; }); }
  return tracks[name];
}
// The run's beat source: loading or unavailable audio lets the boss (and the run) keep its own time.
// With no recording playing, it is the synthesized song's (act 4's "Sunrise Set").
// Only a recording knows its breakdown and drop.
const song = {
  playing: null,
  beat() { if (audio()?.ctx.state !== 'running') return undefined; const t = this.playing; if (!t) return music?.beatNow() ?? undefined; if (t.state === 'loading') return null; return t.state === 'ready' ? (t.track.beatNow() ?? null) : undefined; },
  quiet(b) { return this.playing?.state === 'ready' && this.playing.track.quiet(b); },
  drop(b) { return this.playing?.state === 'ready' && this.playing.track.drop(b); },
};
const run = new Run({
  scene, stage, plan, world, player, cfg: CONFIG.player, enemies, lash, xpDrops, gfx,
  traversal, hud, ui: menus, fx, tpc, input, setNight, touch: IS_TOUCH, apartment: APT.root,
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
run.telemetryDisabled = ['story', 'stories', 'bench'].some((k) => new URLSearchParams(location.search).has(k));
addEventListener('online', () => { void board.runLog?.flush(); });
const bag = overlay.querySelector('.g-bag');
// the end-of-run screen's 🏠 Main menu: back to act 1's menu (a later act reloads into act 1)
run.onMainMenu = () => {
  if (stage.id > 1) { goToAct(1); return; }
  run.start();
  mainMenu.show();
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = false;
};
run.playerBody = () => state.look.body;
addEventListener('pagehide', () => { run.flushFeats(); run.recordRun('in-progress'); run.keepProgress(); });   // a reload comes back to this act as it stands
run.playerLook = () => state.look;
run.onWear = (key, id) => { applyLook({ ...state.look, [key]: id }); saveLook(state.look); };   // an award's reveal: Wear it now
run.jellyFace = (look) => jellyPortrait(renderer, look);   // each player's jelly by their score (leaderboard, jelly-portrait.js)

// Desktop plays with the mouse locked to the game; phones use on-screen controls
if (IS_TOUCH) {
  document.body.classList.add('touch');
  tpc.distance = LOOK.num('camera-distance-phone', 0.595);
}
input.touchOnly = IS_TOUCH;
// Chrome refuses a lock asked for too soon after the last one (a rejected promise); the next click asks again
const lockPointer = () => renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
function play() {
  unlockAudio();
  if (!IS_TOUCH) { lockPointer(); return; }
  overlay.hidden = true;
  mainMenu.launch();
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) {
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}
// The title's Play. With jelly types switched on a returning player picks one first (pick-screen.js); a
// first-time player never does (first-run.js): their run is Normal. Pausing mid-run and Play resumes as before.
function startRun() {
  const begin = () => { if (stage.id === 1) { forgetRun(); showKept(); } play(); endContinue(); };
  if (stage.id !== 1 || !mainMenu.home) return begin();
  const choose = (id) => { TYPE_PICK.start = id; if (run.jelly !== id) { forgetRun(); showKept(); run.start(); } begin(); };
  if (!picksType()) choose('normal');
  else picker.open({ start: TYPE_PICK.start, onPlay: choose, onBack: () => {} });
}
// the end screen's Try again: a returning player picks a type again (true: the screen took it over)
run.pickType = () => {
  if (!picksType()) { TYPE_PICK.start = 'normal'; return false; }   // a first-time player's run is Normal
  picker.open({ start: TYPE_PICK.start, onPlay: (id) => { TYPE_PICK.start = id; run.start(); run.resume(); } });
  return true;
};
function pause() {
  if (menus.open || state.mode !== 'play') return;
  mainMenu.cancelLaunch();
  overlay.hidden = false;
}
// As on the gameplay controls, cancel native two-thumb gestures on iOS.
// Keep single touches native so menu buttons and scrolling continue to work.
overlay.addEventListener('touchstart', (e) => {
  if (!overlay.classList.contains('menu-home') && e.touches.length > 1 && e.cancelable) e.preventDefault();
}, { passive: false });
const touch = new TouchControls(input, { onPause: pause });
touch.mount(ui);
// on an iPhone in the browser (not already opened from the home screen), say how to play full screen
const homeTip = overlay.querySelector('.home-tip'), HOME_TIP_KEY = 'jellyrun.homeTip';
let homeTipOff = false; try { homeTipOff = localStorage.getItem(HOME_TIP_KEY) === 'off'; } catch {}
homeTip.hidden = !/iPhone|iPod/.test(navigator.userAgent) || navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || homeTipOff;
// where the browser can install the game as an app (Chrome, Edge: manifest.webmanifest), offer it on the title screen too;
// Chrome's own install bar still shows, and the button goes once the game is installed or the offer is used
const installBtn = overlay.querySelector('[data-act="install"]');
let installOffer = null;
addEventListener('beforeinstallprompt', (e) => { installOffer = e; installBtn.hidden = false; });
addEventListener('appinstalled', () => { installOffer = null; installBtn.hidden = true; });
// held upright: the turn-sideways cover goes over everything and the run holds still under it, so nothing
// hits the jelly unseen. A phone is a touch screen whose short side is under 600 px, read from the screen,
// not the page: iOS can keep the page at its landscape width after the phone turns back upright.
const portrait = matchMedia('(orientation: portrait)');
const upright = {
  test: null,   // stories hold the phone one way or the other (phone/held-upright-...)
  get matches() {
    if (this.test !== null) return this.test;
    const type = screen.orientation?.type;
    return IS_TOUCH && Math.min(screen.width, screen.height) < 600 && (type ? type.startsWith('portrait') : portrait.matches);
  },
  on: false,     // as last read: the frame loop asks every frame
  update() {
    if (this.matches === this.on) return;
    document.body.classList.toggle('upright', this.on = !this.on);
    if (this.on) pause();
  },
};
document.body.classList.toggle('upright', upright.on = upright.matches);   // the title is already up
const turned = () => upright.update();
screen.orientation?.addEventListener?.('change', turned);
portrait.addEventListener('change', turned);
addEventListener('resize', turned);
window.upright = upright;
run.onResume = () => { if (!IS_TOUCH) lockPointer(); };

// --- Modes: 'play' (paused while a menu is up), 'creator' and 'layout' --------------
const mainMenu = new MainMenu({ overlay, player, camera, gfx, scene, height: CONFIG.player.height, calm: () => juice.calm, board,
  onPoke: () => { unlockAudio(); sfx.pop(); },
});
board.onChange = () => mainMenu.refreshGreeting();
if (stage.id !== 1 || peekAction()?.continue || peekAction()?.duel || peekAction()?.roam || peekAction()?.boss || peekAction()?.layout) {
  mainMenu.home = false; overlay.classList.remove('menu-home');
}
let bossScene = null;
const controlsCovered = () => upright.on || picker.isOpen || !!bossScene || mainMenu.launching || !overlay.hidden || kit.open || tuner.open || state.mode === 'creator' || state.mode === 'layout';
const menuOpen = () => controlsCovered() || menus.open;

// --- Frame systems, in the order they run (systems.js) ---------------------------------
const camSys = new CameraSystem({ state, camera, tpc, input, player, gfx, playerHeight: CONFIG.player.height, dom: renderer.domElement });
const systems = {
  traversal,
  fx,
  layout: new LayoutSystem({ state }),
  // Keep captured thumbs alive beneath pick cards; gameplay still pauses until the cards close.
  touch: new TouchSystem({ state, touch, run, menuOpen: () => controlsCovered() || (menus.open && !menus.picking) || run.victory.active, isTouch: IS_TOUCH }),
  gameplay: new GameplaySystem({ state, run, menuOpen }),
  avatar: new AvatarSystem({ state, player, menuOpen }),
  input: new InputSystem({ state, input, menuOpen }),
  camera: camSys,
  shadow: new ShadowSystem({ state, scene, world, player, cfg: CONFIG.player, enemies }),
  hud: new HudSystem({ state, hud, player, tpc, run }),
  debug: new DebugSystem({ state, hud, player, run, enemies, xpDrops, gfx, extra: () => pacingReadout() }),
  render: new RenderSystem({ gfx, statics }),
};

followGlow(systems.shadow.glow);   // the jelly's glow stays live on the baked shell (baked-light.js)

// Dev layout editor: move the furniture around (layout.js)
let layoutChanged = false;
function openLayout() {
  run.disqualifyChallenges();
  const layout = state.layout ||= new LayoutEditor({ root: APT.root, camera, dom: renderer.domElement, world, statics, scene, traversal, act: stage.id, acts: STAGES.filter((s) => !s.arena).map((s) => s.id),   // (act 4: its room; the arena behind its stage door is built, with no furniture)
    onAct: (n) => goToAct(n, null, { layout: true }) });
  window.layout = layout;
  layout.onChange = () => { layoutChanged = true; world._focusAge = Infinity; };
  layout.onDone = closeLayout;
  layoutChanged = false;
  tpc.unfadeAll();   // what the camera saw through is solid again while you edit (and a copy takes its own material)
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
  if (layoutChanged) { run.spots = null; run.start(); }
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
  touch.show(false);   // no thumb ring over the creator
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
  air?.rescan();                      // and glow
  const made = await applyLayout(APT.root, stage.id);   // (and copies of the new rooms' furniture)
  APT.lightMapped += mapPieces(APT.root, APT.bakedLight && BAKED_LIGHT.meta);
  world.addObjects([...added, ...made]);
  [...added, ...made].forEach((o) => { ambient.mark(o); statics.add(o); });
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
const MUSIC_KEY = 'jellyrun.music';
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
try { localStorage.removeItem('jellyrun.effects'); } catch {}   // the old button's pick
function updateMusic(dt) {
  if (!music) { const A = audio(); if (!A) return; music = new Music(A.ctx, A.master); }
  const st = musicOn ? run.musicState() : { song: null, intensity: 0 };
  if (stage.arena) for (const name in TRACKS) trackFor(name);   // start decoding the act's recording early
  const rec = st.song ? trackFor(st.song) : null;
  for (const name in tracks) if (tracks[name] !== rec) tracks[name].track.stop();
  song.playing = rec;
  if (rec?.state === 'ready') rec.track.play();
  rec?.track.duck(menuOpen() || run.paused);
  music.play(TRACKS[st.song] ? null : st.song);   // a recorded song is never swapped for a synthesized one
  music.duck(menuOpen() || run.paused);
  music.suck(!!st.suck);              // the Vacuum sucking drags the music through a dub filter
  music.update(dt, st.intensity);
}

// The room tone (ambience.js): the act's bed and a few one-shots near their pieces, under the music. It plays through
// the master like every effect, so the Sound setting is its volume, and it stops in the Encore's arena.
let ambience = null;
const ambListener = { x: 0, z: 0, rx: 1, rz: 0 };
function updateAmbience(dt) {
  if (!ambience) { const A = audio(); if (!A) return; ambience = new Ambience(A.ctx, A.master); window.ambience = ambience; }
  ambListener.x = player.position.x; ambListener.z = player.position.z;
  ambListener.rx = Math.cos(tpc.yaw); ambListener.rz = -Math.sin(tpc.yaw);   // the camera's right, along the floor
  ambience.update(dt, run.ambienceState(), ambListener, isMuted());
}

// --- The boss finish --------------------------------------------------------
// Gameplay holds while Dendi approaches, winds up and finishes the doomed boss.
// Both camera cuts happen under black; rewards wait until the return fade ends.
const blackout = document.createElement('div');
blackout.className = 'boss-fade';
blackout.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:60;';
document.body.appendChild(blackout);
const sceneRay = new THREE.Raycaster();
sceneRay.layers.enable(HIDDEN);   // the apartment's batched pieces (static-batch.js)
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
    updateAmbience(dt);
    systems.traversal.update(dt, { pixelRatio: renderer.getPixelRatio(), low: gfx.quality === 'low', calm: juice.calm });
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
    run.driedOut.update(dt);          // behind the death screen: the jelly dried out on the land
    lightSlots?.update(dt, player.position);
    ambient.update(dt, player.position, player.velocity.length());
    systems.shadow.update(dt);
    air?.update(dt, renderer, camera);
    systems.hud.update(dt);
    systems.debug.update(dt);
  },
  render() { systems.render.update(); },
  // build what the scene needs for the graphics in use (stories count new shaders with it)
  compile() { const was = renderer.getRenderTarget(); renderer.setRenderTarget(drawnInto()); try { return renderer.compile(scene, camera, scene); } finally { renderer.setRenderTarget(was); } },
};
window.GAME = GAME;
window.mainMenu = mainMenu;
window.picker = picker;
GAME.startRun = startRun;

// --- Menus + keys ---------------------------------------------------------------
// Settings: each row is a segmented choice (kit .ui-seg); syncSettings shows what is on now
const settingsGrid = overlay.querySelector('.set-grid');
const segRow = (label, attr, choices) => `<div class="set-row"><span class="ui-label">${label}</span><div class="ui-seg" role="group" aria-label="${label}">${choices.map(([v, text]) => `<button type="button" ${attr}="${v}" aria-pressed="false">${text}</button>`).join('')}</div></div>`;
settingsGrid.innerHTML = segRow('Sound', 'data-sound', [['on', 'On'], ['off', 'Off']]) + segRow('Music', 'data-music', [['on', 'On'], ['off', 'Off']])
  + segRow('Graphics', 'data-q', CHOICES.map((q) => [q, q[0].toUpperCase() + q.slice(1)])) + (IS_TOUCH ? segRow('Frame rate', 'data-fps', FPS_CHOICES.map((f) => [f, f])) : '')
  + segRow('Text size', 'data-text', [['normal', 'Normal'], ['large', 'Large']])
  + `<div class="set-easy">${segRow('Easy mode', 'data-easy', [['off', 'Off'], ['on', 'On']])}<p class="ui-text">From your next run: twice the damage you deal, half the damage you take, half the Pearls, and no leaderboard score.</p></div>`;
function syncSettings() {
  const now = { sound: isMuted() ? 'off' : 'on', music: musicOn ? 'on' : 'off', q: gfx.choice, fps: String(phoneFps), text: textSize, easy: easyChosen() ? 'on' : 'off' };
  for (const b of settingsGrid.querySelectorAll('button')) { const [k, v] = Object.entries(b.dataset)[0]; b.setAttribute('aria-pressed', String(now[k] === v)); }
}
syncSettings();
// the sheets over the menu (Settings, Trophies), under one scrim
const scrim = overlay.querySelector('.ui-scrim'), sheets = { settings: overlay.querySelector('.menu-settings'), trophies: overlay.querySelector('.menu-trophies'), dev: overlay.querySelector('.menu-dev') };
function openSheet(name) {
  for (const [k, el] of Object.entries(sheets)) { el.hidden = k !== name; el.classList.toggle('ui-enter', k === name); }
  scrim.hidden = !name; scrim.classList.toggle('ui-enter', !!name);
  if (name === 'settings') syncSettings();
  sheets[name]?.querySelector('button')?.focus({ preventScroll: true });
}
scrim.addEventListener('click', () => openSheet(null));
// the pause menu's Main menu leaves the run: it asks to be tapped twice
const leaveBtn = overlay.querySelector('[data-act="main-menu"]');
function askLeave(on) { leaveBtn.dataset.sure = on ? '1' : ''; leaveBtn.lastChild.textContent = on ? 'Leave this run? Tap again' : 'Main menu'; }
// whenever the pause menu opens, it sums up the run and lists what you carry as it stands (pause-summary.js, treasure-bag.js)
const summary = overlay.querySelector('.pause-summary');
new MutationObserver(() => {
  if (overlay.hidden) { openSheet(null); askLeave(false); return; }
  bag.innerHTML = bagHtml(run); summary.innerHTML = summaryHtml(run); showKept();
}).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  sfx.tap();
  if (b.classList.contains('resume')) { const k = keptRun(); if (k) goToAct(k.act, k.carry, { continue: true }, k.scene); }
  else if (b.classList.contains('play') || b.classList.contains('pause-resume')) startRun();
  else if (b.dataset.q) { gfx.setQuality(b.dataset.q); field.reset(); syncSettings(); }
  else if (b.dataset.fps) { setFps(+b.dataset.fps); syncSettings(); }
  else if (b.dataset.sound) { unlockAudio(); setMuted(b.dataset.sound === 'off'); syncSettings(); }
  else if (b.dataset.music) {
    unlockAudio();
    musicOn = b.dataset.music === 'on';
    try { localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch {}
    syncSettings();
  }
  else if (b.dataset.easy) { chooseEasy(b.dataset.easy === 'on'); syncSettings(); }
  else if (b.dataset.text) {
    textSize = b.dataset.text;
    document.documentElement.dataset.textSize = textSize;
    try { localStorage.setItem(TEXT_KEY, textSize); } catch {}
    syncSettings();
  }
  else if (b.dataset.act === 'settings') openSheet('settings');
  else if (b.dataset.act === 'trophies') openSheet('trophies');
  else if (b.dataset.act === 'sheet-close') openSheet(null);
  else if (b.dataset.act === 'main-menu') {
    if (leaveBtn.dataset.sure) { askLeave(false); run.onMainMenu(); } else { askLeave(true); setTimeout(() => askLeave(false), 4000); }
  }
  else if (b.dataset.act === 'dev') {
    if (overlay.classList.contains('dev-open')) openSheet('dev');
    else { overlay.classList.add('dev-ask'); overlay.querySelector('[name="dev-pass"]').focus(); }
  }
  else if (b.dataset.act === 'dev-unlock') unlockDev();
  else if (b.dataset.act === 'install') { installOffer?.prompt(); installOffer = null; installBtn.hidden = true; }
  else if (b.dataset.act === 'home-tip') { homeTip.hidden = true; try { localStorage.setItem(HOME_TIP_KEY, 'off'); } catch {} }
  else if (b.dataset.act === 'creator') openCreator();
  else if (b.dataset.act === 'board') { openSheet(null); overlay.hidden = true; run.showBoard(() => { overlay.hidden = false; }); }
  else if (b.dataset.act === 'achievements') { openSheet(null); overlay.hidden = true; run.showAchievements(() => { overlay.hidden = false; }); }
  else if (b.dataset.act === 'book') { overlay.hidden = true; run.showBook(() => { overlay.hidden = false; }); }
});
// dev: every lamp (a phone's shared light slots) dark or lit again. The light count changes, so
// every lit shader rebuilds once: a stall a player never sees, since it's only here.
let lampsOn = true;
function toggleLamps() {
  lampsOn = !lampsOn;
  scene.traverse((o) => { if (o.isPointLight && (lightSlots ? o.userData.slot : o.userData.lamp)) o.visible = lampsOn; });
  if (air) air.on = lampsOn;
  return lampsOn;
}
GAME.toggleLamps = toggleLamps;   // the phone bench's lamps-off replay (bench.js)
const kit = new TestKit(document.body);
const tuner = new BalanceEditor(document.body);
initDevPanel(sheets.dev, {
  overlay, run, kit, tuner, openSheet, play, endContinue, openLayout, enableDebug,
  passOn: (pass) => (pass === 'lamps' ? lampsOn : pass === 'bake' ? BAKED_LIGHT.on : pass === 'overdraw' ? gfx.overdraw : !gfx.off.has(pass)),
  togglePass: (pass) => (pass === 'lamps' ? toggleLamps() : pass === 'bake' ? setBakedLight(!BAKED_LIGHT.on) : pass === 'overdraw' ? (gfx.overdraw = !gfx.overdraw) : gfx.toggle(pass)),
});
window.kit = kit;       // stories drive them (dev/test-kit, dev/balance-editor)
window.tuner = tuner;
window.dendi = dendi;   // stories check on the cat (models/dendi-*)
// Dev tools (layout editor, boss and 1-on-1 fights, test kit, the other act, diagnostics) wait behind one
// 🔒 Dev button. The Worker checks the password (its DEV_PASSWORD secret), so it isn't in the page's source.
// On a plain local file server (no Worker) any password opens them.
// Unlocking makes every run in this tab a dev run (run.js devSession): it never reaches the leaderboard or run log.
async function unlockDev() {
  const box = overlay.querySelector('[name="dev-pass"]'), pass = box.value.trim();
  let open = false;
  try {
    const r = await fetch('api/dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass }) });
    const a = await r.json();
    open = !!a.open;
    if (a.why === 'slow') { box.value = ''; box.placeholder = 'Wait 3 seconds, then try again'; return; }
    if (a.why === 'unset') { box.value = ''; box.classList.add('wrong'); box.placeholder = 'No dev password set on the server'; return; }
  } catch {   // no Worker answering: only your own computer's file server opens without one
    open = ['localhost', '127.0.0.1'].includes(location.hostname);
  }
  if (!open) { box.value = ''; box.classList.add('wrong'); box.placeholder = 'Wrong password'; box.focus(); return; }
  overlay.classList.remove('dev-ask');
  overlay.classList.add('dev-open');
  try { sessionStorage.setItem(DEV_KEY, '1'); } catch {}
  run.devRun();   // the run in progress stops counting too
  openSheet('dev');
}
// Players never see the Dev button: five quick taps on the version bring it up (the fps readout shows once unlocked)
let verTaps = 0, verTimer = 0;
for (const ver of overlay.querySelectorAll('.ver, .set-ver')) ver.addEventListener('click', () => {
  clearTimeout(verTimer); verTimer = setTimeout(() => { verTaps = 0; }, 1500);
  if (++verTaps >= 5) overlay.classList.add('dev-reveal');
});
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
  if (e.code === 'Escape' && !scrim.hidden) { openSheet(null); return; }
  if (e.code === 'KeyC' && state.mode === 'play' && !menus.open && !overlay.hidden) openCreator();
  else if (e.code === 'Escape' && state.mode === 'creator') { saveLook(state.look); closeCreator(); }
  if (e.code === 'KeyM') { setMuted(!isMuted()); syncSettings(); }
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
  fx.splat(P.clone(), 0xffffff, 0.01, 'ink');   // the floor marks' painted sheet (every shape shares its shader)
  fx.smoke(P.clone().setY(P.y + 0.02));          // a moth's black smoke (its own shader: the jelly shows through it)
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.005), FLASH);
  flash.position.copy(P).setY(P.y + 0.02);
  scene.add(flash);
  run.gadgets.warm(true, P.clone().setY(P.y + 0.02));
  run.shield.group.visible = true;                       // prepare the Shield's shell before anything gives one
  run.shield.group.scale.setScalar(0.001);
  run.mirage.prepare(); run.mirage.group.visible = true;
  run.fireTrail.warm(true, P.clone().setY(P.y + 0.002));
  enemies.glowPools.warm(true, P.clone().setY(P.y + 0.002));   // a firefly's glowing pool and its Warning
  const warmAdorn = ADORNMENTS.map(k => run.adorn.piece(k).group);
  warmAdorn.forEach(g => { g.visible = true; });
  run.evolutionReveal.warm(true);
  run.elites.warm(true, P.clone().setY(P.y + 0.03));
  run.roomTreasures[0].show(P.clone(), 22);                // a treasure's chest and its timer ring
  const warmBubbles = [run.bubbles.mesh(run.bubbles.mat), run.bubbles.mesh(run.bubbles.goldMat)];
  warmBubbles.forEach((m) => { m.position.copy(P).setY(P.y + 0.03); m.scale.setScalar(0.01); });
  const warmLooks = run.bubbles.looks.warm(P.clone().setY(P.y + 0.03));   // every element projectile
  const warmFx = [new THREE.Mesh(run.bubbles.puddleGeo, run.bubbles.acidMat)];
  warmFx.forEach((m) => { m.position.copy(P); scene.add(m); });
  temp[0].markT = temp[0].freezeT = 1;          // Sticky Note and Ice Cube looks
  enemies.markLook(temp[0], 0);
  temp[2].slowT = temp[2].chillT = 1;           // the slow ring and a chilled bug's ice crown
  enemies.markLook(temp[2], 0);
  temp.at(-2).mesh.traverse((o) => { if (o.isMesh) o.material = FLASH; });   // the hit flash, instanced
  temp.at(-1).mesh.traverse((o) => { if (o.isMesh) o.material = fx.acid.gooMat; });   // an acid-finished bug melting (acid-looks.js)
  // this act's boss (not in a scene before its stage door: the boss is through it, in the next scene's page)
  const warmBoss = stage.stageDoor ? null : makeBoss(stage.boss, scene, enemies, fx, world, { arena: ARENA, toughness: stage.toughness });
  warmBoss?.warm?.(true);                         // (and what only shows mid-fight: the Clog's acid)
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
  run.shield.update(0);
  run.mirage.group.visible = false;
  run.fireTrail.warm(false);
  enemies.glowPools.warm(false);
  run.evolutionReveal.warm(false);
  warmAdorn.forEach(g => { g.visible = false; });
  run.elites.warm(false);
  run.roomTreasures[0].hide();
  warmBubbles.forEach((m) => { m.visible = false; run.bubbles.pool.push(m); });
  warmLooks.forEach((m) => run.bubbles.looks.release(m));
  warmFx.forEach((m) => scene.remove(m));
  // (its materials stay: disposing them would throw away the shaders just built, and act 4's arena
  // starts its real Encore at once, which then built them mid-fight)
  const disposeMaterial = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = () => {};
  try { warmBoss?.dispose(); } finally { THREE.Material.prototype.dispose = disposeMaterial; }
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
  const lite = gfx.quality === 'low' || EXPERIMENTS.lite === 1;   // Low's plain materials (lite-materials.js)
  if (lite !== liteOn()) tpc.unfadeAll();   // a fade puts back the material it took, from the other set
  setLite(lite, { scene, shelf, apartment: APT.root, batches: statics.batches });
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
    camera.layers.enable(HIDDEN);   // and the batched pieces' own meshes, drawn by themselves when the camera fades one (static-batch.js)
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
  if (k) btn.innerHTML = `Continue act ${k.act}<small>${stageOf(k.act, k.scene).subtitle} · Level ${k.carry.mid?.now.level ?? k.carry.level} · Score ${(+(k.carry.mid?.now.score ?? k.carry.score) || 0).toLocaleString()}</small>`;
}
showKept();
GAME.showKept = showKept;
function endContinue() {
  if (!overlay.classList.contains('cont')) return;
  overlay.classList.remove('cont');
  titleEl.textContent = 'Jelly Run';
}
// Stories (src/stories.js, areas in src/stories/): index.html?story=<name> opens one live; index.html?stories lists them
const storyParams = new URLSearchParams(location.search);
export const ready = warmUp().then(() => {
  field.loadMs = performance.now();   // since navigation start: how long until Play worked
  // the dev 1 on 1 picker reloaded into this act to fight an elite here: set that fight up
  const then = pendingAction();
  if (then?.continue && continuing) {
    if (IS_TOUCH) {
      play();
      endContinue();
      unlockOnGesture();   // the reload lost the tap that allowed sound: the next touch turns it back on
    } else playBtn.textContent = 'Click to dive in';
  }
  if (then?.duel) { const pick = run.duelChoices().find((p) => p.name === then.duel); if (pick) run.startDuel(pick); }
  if (then?.roam) { const pick = run.roamChoices().find((p) => p.name === then.roam); if (pick) run.startRoam(pick); }
  if (then?.boss) { const pick = run.bossChoices().find((p) => p.name === then.boss); if (pick) run.startBossFight(pick); }
  if (then?.layout) openLayout();   // the layout editor's act buttons reload into the act with it open
  if (storyParams.has('bench')) { import('./bench.js').then((B) => B.offer()); return; }   // index.html?bench: the phone bench
  if (!storyParams.has('story') && !storyParams.has('stories')) return;
  import('./stories.js').then((S) => (storyParams.has('story') ? S.mount(storyParams.get('story')) : S.list()));
});

// How often and how sharp (pacing.js): phones cap at 30 fps by default (a phone that keeps up at 60
// runs its graphics chip flat out, heats up, then throttles itself; the pause menu offers 60),
// everything draws slowly behind a menu, and the governor lowers the pixel ratio when frames run
// long and raises it back with headroom.
const pacer = new FramePacer({ fps: IS_TOUCH ? phoneFps : LOOK.num('desktop-fps', 0), menuFps: LOOK.num('menu-fps', 20) });
// ?msaa=2|4 (src/experiments.js) trades pixels for smooth edges: a phone then draws at most --msaa-pixel-ratio
const maxRatio = Math.min(devicePixelRatio || 1, IS_TOUCH ? LOOK.num('phone-pixel-ratio', 1.5) : LOOK.num('desktop-pixel-ratio', 2),
  IS_TOUCH && EXPERIMENTS.msaa ? LOOK.num('msaa-pixel-ratio', 1.25) : Infinity);
const governor = new FrameGovernor({
  fps: pacer.fps || 60, scale: maxRatio, max: maxRatio, min: Math.min(maxRatio, LOOK.num('min-pixel-ratio', 1)),
});
renderer.setPixelRatio(maxRatio);
gfx.resize();
// the player's frame-rate pick (phones only): the governor now aims for it
function setFps(f) {
  phoneFps = pacer.fps = f;
  field.reset();
  governor.base = governor.target = 1000 / f;
  try { localStorage.setItem(FPS_STORE, String(f)); } catch {}
}
const field = new FieldPerf();
function adapt(ms) {
  const c = governor.sample(ms);
  if (c?.scale) { renderer.setPixelRatio(c.scale); gfx.resize(); }
  field.sample(ms, governor.base, governor.scale);
}
// what the run log sends with each act summary (run.js recordRun): frame numbers and the Settings picks, nothing else
run.fieldReset = () => field.reset();
run.fieldNumbers = () => ({
  perf: field.summary({ tier: gfx.quality, cap: pacer.fps || 0, dpr: Math.round(devicePixelRatio * 100) / 100, w: innerWidth, h: innerHeight, lost: gpu.restores }),
  settings: { graphics: gfx.choice, fps: IS_TOUCH ? phoneFps : 0, text: textSize, easy: easyChosen(), music: musicOn, sound: !isMuted(), calm: juice.calm, calmOs: reducedMotion.matches },
});
function pacingReadout() {
  const g = governor, last = g.log[g.log.length - 1];
  return `${gfx.quality} | cap ${pacer.fps || 'none'} | aim ${(1000 / g.target).toFixed(0)} fps`
    + (lightSlots ? ` | lamps ${lightSlots.lit().length}/${lightSlots.lamps.length}` : '')
    + (last ? ` | last: ${last.why} ${last.scale}` : '');
}
window.pacing = { pacer, governor, lightSlots, field };

// The graphics chip resetting (iOS backgrounding, out of GPU memory): pause, rebuild, resume
const gpu = recoverGpu({ renderer, scene, camera, gfx, prepare: () => prepareGraphics(nextTask), pause: () => { if (document.pointerLockElement) document.exitPointerLock(); pause(); } });
// iOS can lose the context while the page is hidden without telling the page: check on return
// and leaving the game (another tab or app, the phone locked) pauses it, so nothing hits the jelly unseen
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    run.recordRun('in-progress');
    run.keepProgress();   // a phone may drop the page while it's away
    run.bubbles.silenceAttacks();
    if (run.phase !== 'dead' && run.phase !== 'won') pause();   // a finished run keeps its end screen
  }
  if (!document.hidden && renderer.getContext().isContextLost() && !gpu.lost) {
    renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  }
  if (!document.hidden) void board.runLog?.flush();
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
    if (!picker.isOpen) GAME.render();   // the pick screen covers the whole game: only its own pictures draw
  } catch (e) {
    reportError(e, 'frame');
  }
};
renderer.setAnimationLoop((now) => GAME.frame(now));

// Handy for poking at things from the browser console
Object.assign(window, { batcher, statics, ambient, THREE, touch, player, world, tpc, input, gfx, hud, run, enemies, lash, shadows: systems.shadow, xpDrops, traversal, menus, fx, gpu, kit });
