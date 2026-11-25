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
import { batcher, updateShown } from './batch.js';
import { hitSpot } from './collision.js';
import { LOOK } from './look.js';

const IDLE = { speed: 0, walkSpeed: 1, vy: 0 };

// Frame time: clamps long frames, and slows the world to a crawl during hit-stop (and to juice.slow's speed)
export class Clock {
  constructor({ maxDt = 0.05, hitStopScale = 0.05 } = {}) {
    this.maxDt = maxDt;
    this.hitStopScale = hitStopScale;
    this.last = performance.now();
  }
  tick(now) {
    const dt = Math.min(this.maxDt, (now - this.last) / 1000);
    this.last = now;
    const slow = juice.stop > 0 ? this.hitStopScale : juice.slowT > 0 ? juice.slowK : 1;
    juice.stop = Math.max(0, juice.stop - dt);
    juice.slowT = Math.max(0, juice.slowT - dt);
    juice.scale = slow;   // what this frame's time was scaled by (effects that keep real time read it)
    return dt * slow;
  }
}

// The run itself: movement, attacks, enemies, pickups. Frozen while any menu is up.
export class GameplaySystem {
  constructor({ state, run, menuOpen }) { Object.assign(this, { state, run, menuOpen }); }
  update(dt) {
    if (this.state.mode === 'play' && !this.menuOpen()) this.run.update(dt);
    else this.run.bubbles?.silenceAttacks?.();
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
  update(dt) {
    if (this.state.mode !== 'play') return;
    this.touch.show(this.isTouch && !this.menuOpen());
    this.touch.setAction(this.run.touchAction);
    this.touch.update(dt);
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
      this.tpc.holdFades = !!this.player.flight;   // a vent ride (camera.js)
      this.tpc.update(dt, this.input.consumeMouse(), this.player.position);
      this.gfx.focus = this.camera.position.distanceTo(this.player.position) + 0.005;
    }
    this.camera.position.add(juice.offset(this.shake));
  }

  orbit(dt) {
    if (!this.drag) this.spin += dt * 0.35;
    const p = this.player.position, size = this.state.look.size;
    const d = LOOK.num(innerWidth > 640 ? 'creator-camera-distance' : 'creator-camera-distance-narrow', innerWidth > 640 ? 0.22 : 0.26) * size, fy = this.playerHeight * 0.55 * size;
    const yaw = this.player.facing + this.spin;
    this.camera.position.set(p.x + Math.sin(yaw) * d, p.y + fy + 0.02, p.z + Math.cos(yaw) * d);
    this.camera.lookAt(p.x, p.y + fy, p.z);
    this.gfx.focus = d;
  }
}

// a soft round shadow: dark in the middle, gone at the edge (one small picture, shared)
let softDisc = null;
function softShadow() {
  if (softDisc) return softDisc;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, '#fff'); r.addColorStop(0.45, '#bbb'); r.addColorStop(1, '#000');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  softDisc = new THREE.CanvasTexture(c);
  return softDisc;
}

// Soft blob shadows under the player, the bugs, the Elites and the bosses. The game draws no real shadows (no shadow
// maps: too costly on phones with this many lamps), so these blobs are what ground them on the baked floor. The
// bugs', Elites' and bosses' are one instanced draw (--bug-shadow-*, --elite-shadow-*), each on the surface straight
// below it; one in the air (a flyer, a thrown bug) has a wider, fainter one at the height of that surface, found
// by a few casts a frame in turn and remembered, so the cost stays the same however big the crowd.
export class ShadowSystem {
  constructor({ state, scene, world, player, cfg, enemies }) {
    Object.assign(this, { state, world, player, cfg, enemies });
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(cfg.radius * 1.3, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softShadow(), transparent: true, opacity: LOOK.num('jelly-shadow', 0.5), depthWrite: false }),
    );
    this.blobOpacity = this.blob.material.opacity;
    this.blobFloor = LOOK.num('jelly-shadow-floor', 0.22);   // the faintest it gets, high in a jump: it stays the landing cue
    const MAX = 160;
    const geo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);   // round, not square: no see-through pixels past the shadow's edge
    this.shade = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(1), 1).setUsage(THREE.DynamicDrawUsage);   // how dark each one is
    geo.setAttribute('shade', this.shade);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softShadow(), transparent: true, opacity: 1, depthWrite: false });
    mat.onBeforeCompile = (sh) => {   // one program for every instance: its own darkness rides a per-instance number
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float shade;\nvarying float vShade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;').replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vShade;');
    };
    mat.customProgramCacheKey = () => 'cast-shadow';
    this.bugs = new THREE.InstancedMesh(geo, mat, MAX);
    this.bugs.count = 0;
    this.bugs.frustumCulled = false;   // its instances are everywhere; it is one draw either way
    this.bugs.renderOrder = 1;
    this.bugDark = LOOK.num('bug-shadow', 0.75);
    this.bugSize = LOOK.num('bug-shadow-size', 1.3);
    this.bugReach = LOOK.num('bug-shadow-reach', 1.6) ** 2;   // what the camera shows round the jelly: further out is layers for little
    this.eliteDark = LOOK.num('elite-shadow', 0.7);
    this.eliteSize = LOOK.num('elite-shadow-size', 1.1);
    this.airWiden = LOOK.num('bug-shadow-air-widen', 3);       // per metre of height, as the jelly's
    this.airFade = LOOK.num('bug-shadow-air-fade', 6);         // darkness / (1 + this * height)
    this.airFloor = LOOK.num('bug-shadow-air-floor', 0.3);     // never fainter than this share of its grounded darkness
    this.airDrop = LOOK.num('bug-shadow-air-drop', 3);         // no surface within this far below: no shadow
    this.casts = LOOK.num('bug-shadow-casts', 6);              // casts a frame, for the ones in the air and the big ones
    this.castEvery = LOOK.num('bug-shadow-cast-every', 6);     // frames a found surface is trusted for
    this.under = new WeakMap();                                // enemy -> { y: the surface below it, at: the frame it was found, has }
    this.frame = 0;
    this._m = new THREE.Matrix4();
    scene.add(this.bugs);
    this.blob.renderOrder = 1;
    scene.add(this.blob);
    this.down = new THREE.Vector3(0, -1, 0);
    this.hit = hitSpot();
    this.hit2 = hitSpot();
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
    const hit = this.world.cast(this.from.copy(P).setY(P.y + this.cfg.height * 0.5), this.down, 3, null, false, this.hit);
    blob.visible = !!hit;
    if (hit) {
      const h = P.y - hit.point.y;
      blob.position.set(P.x, hit.point.y + 0.0008, P.z);
      blob.scale.setScalar(this.state.look.size * (1 + h * 4));
      blob.material.opacity = Math.max(this.blobFloor, this.blobOpacity / (1 + h * 20));
    }
    this.bugShadows();
  }
  // the surface straight below `e` (its y; null: none in reach). On the ground it is where it stands; in the air it is cast for, at most
  // `casts` of them a frame, and trusted `castEvery` frames
  below(e, x, y, z, grounded, st) {
    let c = this.under.get(e);
    if (!c) this.under.set(e, c = { y: 0, at: -1e9, has: false });
    if (grounded) { c.y = y; c.at = this.frame; c.has = true; return y; }
    if (this.frame - c.at >= this.castEvery || (c.has && y < c.y - 0.01)) {   // time for a fresh look, or it dropped below what it was last over
      if (st.left <= 0) return c.has ? c.y : null;
      st.left--;
      const hit = this.world.cast(this.from.set(x, y, z), this.down, this.airDrop, null, false, this.hit2);
      c.at = this.frame; c.has = !!hit; if (hit) c.y = hit.point.y;
    }
    return c.has ? c.y : null;
  }
  bugShadows() {
    const list = this.enemies?.list || [], m = this._m, inst = this.bugs, max = inst.instanceMatrix.count, P = this.player.position, shade = this.shade.array;
    const st = { left: this.casts };
    this.frame++;
    let n = 0;
    for (const e of list) {
      if (n >= max) break;
      if (e.dead || e.under) continue;
      const o = e.proxy, { x, y, z } = e.pos;
      let s, dark, grounded;
      if (o) {   // an Elite or a boss: awake, on show and standing in the room (not hung on its wall, not a floating trap bubble)
        const hold = o.holder;
        if (!hold || !hold.visible || o.decor || (o.awake === false && o.state === 'idle') || (o.hangY != null && hold.position.y > (o.fightY ?? 0) + 0.03)) continue;
        s = e.r * this.eliteSize; dark = this.eliteDark; grounded = false;
      } else {
        if (!e.root.visible) continue;
        const dx = x - P.x, dz = z - P.z;
        if (dx * dx + dz * dz > this.bugReach) continue;
        s = e.r * this.bugSize * Math.min(1, e.mesh.scale.x / (e.baseScale || 1)); dark = this.bugDark;   // grows in with the bug
        grounded = e.grounded;
      }
      const floor = this.below(e, x, y + (o ? 0.01 : 0), z, grounded, st);
      if (floor == null) continue;
      const h = Math.max(0, y - floor);   // how far above its surface: wider and fainter, as the jelly's
      m.makeScale(s * (1 + h * this.airWiden), 1, s * (1 + h * this.airWiden)).setPosition(x, floor + 0.0015, z);
      shade[n] = Math.max(dark * this.airFloor, dark / (1 + h * this.airFade));
      inst.setMatrixAt(n++, m);
    }
    inst.count = n;
    if (n) { inst.instanceMatrix.needsUpdate = true; this.shade.needsUpdate = true; }
  }
}

// Health, clock, minimap and markers
export class HudSystem {
  constructor({ state, hud, player, tpc, run }) { Object.assign(this, { state, hud, player, tpc, run }); }
  update() {
    if (this.state.mode === 'play') this.hud.update(this.player.position, this.player.facing, this.tpc.yaw, this.run.markers());
  }
}

// FPS counter and the F3 readout
export class DebugSystem {
  constructor({ state, hud, player, run, enemies, xpDrops, gfx, extra = () => '' }) {
    Object.assign(this, { state, hud, player, run, enemies, xpDrops, gfx, extra });
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
    this.hud.setDebug(`${this.fps} fps | x ${p.x.toFixed(2)} y ${(p.y * 100).toFixed(1)} cm z ${p.z.toFixed(2)} | ${run.phase} t=${run.t.toFixed(0)}s | ${this.enemies.alive} enemies | ${this.xpDrops.list.length} XP | ${this.gfx.quality}\n`
      + `${f.calls} draws | ${(f.triangles / 1000).toFixed(0)}k tris | ${r.info.programs.length} shaders | ${m.geometries} geo ${m.textures} tex | dpr ${r.getPixelRatio().toFixed(2)} ${c.width}x${c.height}\n${this.extra()}`);
  }
}

// Draws the frame: first gathers the small moving things into instanced batches (batch.js)
export class RenderSystem {
  constructor({ gfx, statics }) { this.gfx = gfx; this.statics = statics; }
  update() {
    const scene = batcher.scene;
    if (!scene) { batcher.sync(); this.statics?.sync(); this.gfx.render(); return; }
    updateShown(scene);                       // the frame's matrices, once: the batches read them and the renderer doesn't walk the scene again
    scene.matrixWorldAutoUpdate = false;
    try { batcher.sync(true); this.statics?.sync(); this.gfx.render(); } finally { scene.matrixWorldAutoUpdate = true; }
  }
}
