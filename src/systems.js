// The per-frame systems main.js runs in order. Each one owns one job and decides for itself
// whether it has anything to do in the current mode, so the frame loop stays a flat list of
// update calls. Shared state they read:
//   state.mode   'play' | 'creator' | 'layout'
//   state.look   the jelly's current look (size scales the creator camera and the shadow)
//   state.layout the dev layout editor, once it's been opened
//   state.debug  F3 overlay on/off
//   menuOpen()   true while the pause menu, a pick, the creator or the layout editor is up
import * as THREE from 'three';
import { juice } from './juice.js';
import { batcher } from './batch.js';
import { LOOK } from './look.js';

const IDLE = { speed: 0, walkSpeed: 1, vy: 0 };

// Frame time: clamps long frames, and slows the world to a crawl during hit-stop
export class Clock {
  constructor({ maxDt = 0.05, hitStopScale = 0.05 } = {}) {
    this.maxDt = maxDt;
    this.hitStopScale = hitStopScale;
    this.last = performance.now();
  }
  tick(now) {
    const dt = Math.min(this.maxDt, (now - this.last) / 1000);
    this.last = now;
    const slow = juice.stop > 0 ? this.hitStopScale : 1;
    juice.stop = Math.max(0, juice.stop - dt);
    return dt * slow;
  }
}

// The run itself: movement, attacks, enemies, pickups. Frozen while any menu is up.
export class GameplaySystem {
  constructor({ state, run, menuOpen }) { Object.assign(this, { state, run, menuOpen }); }
  update(dt) {
    if (this.state.mode === 'play' && !this.menuOpen()) this.run.update(dt);
  }
}

// The dev layout editor's own drag and orbit controls
export class LayoutSystem {
  constructor({ state }) { this.state = state; }
  update(dt) {
    if (this.state.mode === 'layout') this.state.layout.update(dt);
  }
}

// On-screen controls: shown only while playing, with the context button for the moment
export class TouchSystem {
  constructor({ state, touch, run, menuOpen, isTouch }) { Object.assign(this, { state, touch, run, menuOpen, isTouch }); }
  update() {
    if (this.state.mode !== 'play') return;
    this.touch.show(this.isTouch && !this.menuOpen());
    this.touch.setAction(this.run.touchAction);
  }
}

// The jelly keeps breathing while nothing drives it: in the creator and behind a menu.
// (While playing, the run animates it.)
export class AvatarSystem {
  constructor({ state, player, menuOpen }) { Object.assign(this, { state, player, menuOpen }); }
  update(dt) {
    const { mode } = this.state;
    if (mode === 'creator') this.player.avatar.update(dt, { ...IDLE, grounded: true });
    else if (mode === 'play' && this.menuOpen()) this.player.avatar.update(dt, { ...IDLE, grounded: this.player.grounded });
  }
}

// Drops button presses nobody used this frame, so a tap behind a menu doesn't fire later
export class InputSystem {
  constructor({ state, input, menuOpen }) { Object.assign(this, { state, input, menuOpen }); }
  update() {
    if (this.state.mode !== 'play') return;
    if (this.menuOpen()) { this.input.consumeJump(); this.input.consumeInteract(); }
    this.input.consumeReset();
  }
}

// Where the camera is and what's in focus: third person while playing, a slow orbit in the
// creator, the editor's own view in layout mode. Screen shake goes on last.
export class CameraSystem {
  constructor({ state, camera, tpc, input, player, gfx, playerHeight, dom }) {
    Object.assign(this, { state, camera, tpc, input, player, gfx, playerHeight });
    this.spin = 0.6;
    this.drag = null;
    this.shake = new THREE.Vector3();
    dom.addEventListener('pointerdown', (e) => { if (this.state.mode === 'creator') this.drag = { x: e.clientX }; });
    addEventListener('pointermove', (e) => { if (!this.drag) return; this.spin -= (e.clientX - this.drag.x) * 0.01; this.drag.x = e.clientX; });
    addEventListener('pointerup', () => { this.drag = null; });
    addEventListener('resize', () => { if (this.state.mode === 'creator') this.setCreatorView(); });
  }

  // leave room for the creator's panel: beside the jelly on wide screens, under it on narrow ones
  setCreatorView() {
    const w = innerWidth, h = innerHeight, wide = w > 640;
    this.camera.setViewOffset(w, h, wide ? Math.min(360, w) / 2 : 0, wide ? 0 : h * 0.29, w, h);
  }
  clearCreatorView() { this.camera.clearViewOffset(); }

  update(dt) {
    const { mode } = this.state;
    if (mode === 'layout') this.gfx.focus = this.state.layout.dist;
    else if (mode === 'creator') this.orbit(dt);
    else {
      this.tpc.update(dt, this.input.consumeMouse(), this.player.position);
      this.gfx.focus = this.camera.position.distanceTo(this.player.position) + 0.005;
    }
    this.camera.position.add(juice.offset(this.shake));
  }

  orbit(dt) {
    if (!this.drag) this.spin += dt * 0.35;
    const p = this.player.position, size = this.state.look.size;
    const d = 0.3 * size, fy = this.playerHeight * 0.55 * size;
    const yaw = this.player.facing + this.spin;
    this.camera.position.set(p.x + Math.sin(yaw) * d, p.y + fy + 0.02, p.z + Math.cos(yaw) * d);
    this.camera.lookAt(p.x, p.y + fy, p.z);
    this.gfx.focus = d;
  }
}

// Soft blob shadow under the player. The game draws no real shadows (no shadow maps: too costly
// on phones with this many lamps), so this blob is what grounds the jelly.
export class ShadowSystem {
  constructor({ state, scene, world, player, cfg }) {
    Object.assign(this, { state, world, player, cfg });
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(cfg.radius * 1.1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.blob.renderOrder = 1;
    scene.add(this.blob);
    this.down = new THREE.Vector3(0, -1, 0);
    this.from = new THREE.Vector3();
    // the jelly is fluorescent: a small light of its own tints the floor and anything close
    this.glow = new THREE.PointLight(0x2ff0c4, LOOK.num('jelly-light', 0.9), LOOK.num('jelly-light-reach', 0.4), 2);
    this.glowHex = null;
    scene.add(this.glow);
  }
  update() {
    if (this.state.mode === 'layout') return;
    const P = this.player.position, blob = this.blob;
    this.glow.position.set(P.x, P.y + this.cfg.height * 0.65, P.z);
    if (this.glowHex !== this.state.look.color) { this.glowHex = this.state.look.color; this.glow.color.set(this.glowHex); }
    const hit = this.world.cast(this.from.copy(P).setY(P.y + this.cfg.height * 0.5), this.down, 3);
    blob.visible = !!hit;
    if (!hit) return;
    const h = P.y - hit.point.y;
    blob.position.set(P.x, hit.point.y + 0.0008, P.z);
    blob.scale.setScalar(this.state.look.size * (1 + h * 4));
    blob.material.opacity = 0.35 / (1 + h * 20);
  }
}

// Moisture, clock, minimap and markers
export class HudSystem {
  constructor({ state, hud, player, tpc, run }) { Object.assign(this, { state, hud, player, tpc, run }); }
  update() {
    if (this.state.mode === 'play') this.hud.update(this.player.position, this.player.facing, this.tpc.yaw, this.run.markers());
  }
}

// FPS counter and the F3 readout
export class DebugSystem {
  constructor({ state, hud, player, run, enemies, dew, gfx, extra = () => '' }) {
    Object.assign(this, { state, hud, player, run, enemies, dew, gfx, extra });
    this.fps = 0; this.frames = 0; this.since = performance.now();
    this.playFps = 0;   // the last reading while actually playing, shown next to the build in the pause menu
  }
  update() {
    // real time, not dt: dt is capped (Clock.maxDt), so it would hide a slow phone
    this.frames++;
    const now = performance.now(), secs = (now - this.since) / 1000;
    if (secs > 0.5) {
      this.fps = Math.round(this.frames / secs); this.frames = 0; this.since = now;
      if (this.state.mode === 'play' && !this.run.paused && document.getElementById('g-over')?.hidden) this.playFps = this.fps;
      const tag = document.getElementById('g-fps');
      if (tag && this.playFps) tag.textContent = ` · ${this.playFps} fps`;
    }
    if (!this.state.debug || this.state.mode !== 'play') return;
    const p = this.player.position, run = this.run;
    const r = this.gfx.renderer, f = this.gfx.frameInfo, m = r.info.memory, c = r.domElement;
    this.hud.setDebug(`${this.fps} fps | x ${p.x.toFixed(2)} y ${(p.y * 100).toFixed(1)} cm z ${p.z.toFixed(2)} | ${run.phase} t=${run.t.toFixed(0)}s | ${this.enemies.alive} enemies | ${this.dew.list.length} dew | ${this.gfx.quality}\n`
      + `${f.calls} draws | ${(f.triangles / 1000).toFixed(0)}k tris | ${r.info.programs.length} shaders | ${m.geometries} geo ${m.textures} tex | dpr ${r.getPixelRatio().toFixed(2)} ${c.width}x${c.height}\n${this.extra()}`);
  }
}

// Draws the frame: first gathers the small moving things into instanced batches (batch.js)
export class RenderSystem {
  constructor({ gfx }) { this.gfx = gfx; }
  update() {
    batcher.sync();
    this.gfx.render();
  }
}
