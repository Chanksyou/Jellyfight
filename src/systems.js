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
import { ShadowShapes } from './shadow-shapes.js';

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

// The shadows' one shader: each instance is a square on the surface below its caster, showing that caster's cell of
// the shapes picture (shadow-shapes.js), sharp on the ground and softer the higher it is, faded into the room's haze
const SHADOW_VERT = /* glsl */`
attribute vec4 look;   // its cell's corner in the picture (xy), how dark (z), how soft (w)
attribute float crop;  // how much of its cell the circle covers (the shape's own reach)
varying vec2 vUv;
varying vec3 vLook;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = look.xy + (position.xz * crop * 0.5 + 0.5) * ${(1 / 8).toFixed(4)};
  vLook = vec3(look.zw, length(position.xz) * crop);
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SHADOW_FRAG = /* glsl */`
uniform sampler2D atlas;
uniform float core;
varying vec2 vUv;
varying vec3 vLook;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 s = texture2D(atlas, vUv).rg;
  float a = mix(s.r, s.g, vLook.y) * vLook.x * (1.0 - core * min(1.0, vLook.z));   // a little darker toward its middle
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      a *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

// what an Elite's or a boss's shadow is drawn from: its model, not its holder (which carries its health bar)
const bodyOf = (o) => o.model?.group || o.body || (o.model?.isObject3D ? o.model : null);
const shapeKey = (o) => `proxy:${o.kind ?? o.constructor.name}`;

// Soft shadows under the player, the bugs, the Elites and the bosses. The game draws no real shadows (no shadow
// maps: too costly on phones with this many lamps), so these are what ground them on the baked floor. All of them
// are one instanced draw, each the shape of its own model seen from above (shadow-shapes.js, drawn at load), turned
// with it and as big as it really is, on the surface straight below it (--bug-shadow-*, --elite-shadow-*,
// --jelly-shadow*, --shadow-*); one in the air (a flyer, a thrown bug, the jelly in a jump) has a wider, fainter,
// softer one at the height of that surface, found by a few casts a frame in turn and remembered, so the cost stays
// the same however big the crowd.
export class ShadowSystem {
  constructor({ state, scene, world, player, cfg, enemies }) {
    Object.assign(this, { state, world, player, cfg, enemies });
    this.shapes = new ShadowShapes();
    this.jellyCell = this.shapes.put('jelly', (x, z) => {   // the bell, with a soft tail behind it where the tentacles trail
      const d = Math.hypot(x, z - 0.12), bell = d < 0.22 ? 1 - d * 0.6 : Math.max(0, 0.87 * (0.5 - d) / 0.28);
      const t = (-z + 0.1) / 0.85, w = 0.24 * (1 - t), tail = t > 0 && t < 1 ? 0.55 * (1 - t) * Math.max(0, 1 - Math.abs(x) / Math.max(0.01, w)) : 0;
      return Math.max(bell, tail);
    }, 1);
    this.jellyHalf = cfg.radius * 1.3 * LOOK.num('jelly-shadow-size', 1.7);
    this.blobOpacity = LOOK.num('jelly-shadow', 0.5);
    this.blobFloor = LOOK.num('jelly-shadow-floor', 0.22);   // the faintest it gets, high in a jump: it stays the landing cue
    this.jelly = { visible: false, opacity: 0, scale: 0 };   // what the jelly's shadow is this frame (stories read it)
    const MAX = 160;
    const geo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);   // round, sized to the shape's reach: no clear corners drawn
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('look', this.look);
    this.crop = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(1), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('crop', this.crop);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), atlas: { value: this.shapes.texture }, core: { value: LOOK.num('shadow-core', 0.3) } },
      vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false, fog: true,
    });
    this.bugs = new THREE.InstancedMesh(geo, mat, MAX);
    this.bugs.count = 0;
    this.bugs.frustumCulled = false;   // its instances are everywhere; it is one draw either way
    this.bugs.renderOrder = 1;         // under the Warning floor shapes (3)
    this.linkStep = Math.max(1, Math.round(LOOK.num('shadow-link-step', 2)));   // a chain (a millipede): a spot under every this many links
    this.linkSize = LOOK.num('shadow-link-size', 0.75);        // each spot's radius, in the bug's own radius
    this.linkDark = LOOK.num('shadow-link-dark', 0.8);         // and its darkness against a whole bug's (they overlap)
    this.softPerM = LOOK.num('shadow-soft-per-m', 6);          // softness (0 sharp, 1 the soft copy) per metre above its surface
    this.bugDark = LOOK.num('bug-shadow', 0.75);
    this.bugSize = LOOK.num('bug-shadow-size', 1);
    this.bugReach = LOOK.num('bug-shadow-reach', 1.6) ** 2;   // what the camera shows round the jelly: further out is layers for little
    this.eliteDark = LOOK.num('elite-shadow', 0.7);
    this.eliteSize = LOOK.num('elite-shadow-size', 1.15);
    this.eliteReach = LOOK.num('elite-shadow-reach', 1.4);   // an Elite's or boss's shadow is cut off this far out, in its radius (a cord, a handle: thin far bits cost layers for little)
    this.airWiden = LOOK.num('bug-shadow-air-widen', 3);       // per metre of height, as the jelly's
    this.airFade = LOOK.num('bug-shadow-air-fade', 6);         // darkness / (1 + this * height)
    this.airFloor = LOOK.num('bug-shadow-air-floor', 0.3);     // never fainter than this share of its grounded darkness
    this.airDrop = LOOK.num('bug-shadow-air-drop', 3);         // no surface within this far below: no shadow
    this.casts = LOOK.num('bug-shadow-casts', 6);              // casts a frame, for the ones in the air and the big ones
    this.castEvery = LOOK.num('bug-shadow-cast-every', 6);     // frames a found surface is trusted for
    this.under = new WeakMap();                                // enemy -> { y: the surface below it, at: the frame it was found, has }
    this.frame = 0;
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    scene.add(this.bugs);
    this.down = new THREE.Vector3(0, -1, 0);
    this.hit = hitSpot();
    this.hit2 = hitSpot();
    this.from = new THREE.Vector3();
    // the jelly is fluorescent: a small light of its own tints the floor and anything close
    this.glow = new THREE.PointLight(0x2ff0c4, LOOK.num('jelly-light', 0.9), LOOK.num('jelly-light-reach', 0.4), 2);
    this.glowHex = null;
    scene.add(this.glow);
  }
  // At load (main.js warmUp): draw every bug model the game has (enemies.looks, by model name) and each Elite and
  // boss given (their own models) from above into the shapes picture. Nothing is drawn after this.
  buildShapes(renderer, { looks, models, proxies }) {
    const S = this.shapes;
    for (const { name, r } of models) {
      if (S.has(`bug:${name}`) || !looks[name]) continue;
      const { body, face, anim, shadowPose, shadowLinks } = looks[name]();
      if (shadowLinks) continue;   // a chain's shadow is a spot under each link (bugShadows)
      body.scale.multiplyScalar(r); face.scale.multiplyScalar(r);   // at its real size, as its rig expects (a millipede's chain is in metres)
      const g = new THREE.Group().add(body, face);
      if (anim) {   // a few still frames, so its rig puts its legs where they stand (a fresh model's legs aren't placed yet)
        const e = { root: g, mesh: body, face, pos: g.position, vel: new THREE.Vector3(), phase: 0, atk: null, hold: false, state: 'approach', stateT: 0, firedT: 0, r, baseScale: body.scale.x, grounded: true, T: {} };
        try { for (let i = 0; i < 4; i++) anim(1 / 60, e); } catch { /* a rig that needs more of a real bug: its rest pose */ }
      }
      shadowPose?.();   // (critters.js: a flyer's wings spread, say)
      const cell = S.draw(renderer, `bug:${name}`, g);
      if (cell !== S.cell('disc')) cell.half /= r;   // in the bug's own radius, as e.r is
    }
    for (const o of proxies) { const b = o && bodyOf(o); if (b && !S.has(shapeKey(o))) S.draw(renderer, shapeKey(o), b); }
    S.finish();
  }
  update() {
    if (this.state.mode === 'layout') return;
    const P = this.player.position, J = this.jelly;
    this.glow.position.set(P.x, P.y + this.cfg.height * 0.65, P.z);
    if (this.glowHex !== this.state.look.color) { this.glowHex = this.state.look.color; this.glow.color.set(this.glowHex); }
    const hit = this.world.cast(this.from.copy(P).setY(P.y + this.cfg.height * 0.5), this.down, 3, null, false, this.hit);
    J.visible = !!hit;
    let n = 0;
    if (hit) {
      const h = Math.max(0, P.y - hit.point.y);
      J.scale = this.state.look.size * (1 + h * 4);
      J.opacity = Math.max(this.blobFloor, this.blobOpacity / (1 + h * 20));
      n = this.place(0, this.jellyCell, P.x, hit.point.y + 0.0008, P.z, this.player.facing, this.jellyHalf * J.scale, J.opacity, h);
    }
    this.bugShadows(n);
  }
  // instance i: `cell`'s shape at (x, y, z), turned to `yaw`, `half` wide each way, `dark` at its darkest, `h` above its surface
  place(i, cell, x, y, z, yaw, half, dark, h, reach = Infinity) {
    const c = Math.min(cell.crop ?? 1, reach / half), m = this._m.makeRotationY(yaw).scale(this._s.set(half * c, 1, half * c)).setPosition(x, y, z), L = this.look.array;
    this.crop.array[i] = c;
    this.bugs.setMatrixAt(i, m);
    L[i * 4] = cell.u; L[i * 4 + 1] = cell.v; L[i * 4 + 2] = dark; L[i * 4 + 3] = Math.min(1, h * this.softPerM);
    return i + 1;
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
  bugShadows(n) {
    const list = this.enemies?.list || [], inst = this.bugs, max = inst.instanceMatrix.count, P = this.player.position, S = this.shapes;
    const st = { left: this.casts };
    this.frame++;
    for (const e of list) {
      if (n >= max) break;
      if (e.dead || e.under) continue;
      const o = e.proxy, { x, y, z } = e.pos;
      let half, dark, grounded, yaw, cell;
      if (o) {   // an Elite or a boss: awake, on show and standing in the room (not hung on its wall, not a floating trap bubble)
        const hold = o.holder;
        if (!hold || !hold.visible || o.decor || (o.awake === false && o.state === 'idle') || (o.hangY != null && hold.position.y > (o.fightY ?? 0) + 0.03)) continue;
        const b = bodyOf(o), mine = b && S.has(shapeKey(o));
        cell = mine ? S.cell(shapeKey(o)) : S.cell('disc');
        if (mine) {   // as big and as turned as its model is now (it may still be growing in)
          const w = b.matrixWorld.elements;
          half = cell.half * Math.hypot(w[0], w[1], w[2]) * this.eliteSize; yaw = Math.atan2(w[8], w[10]);
        } else { half = e.r * 1.1 * this.eliteSize; yaw = 0; }
        dark = this.eliteDark; grounded = false;
      } else {
        if (!e.root.visible) continue;
        const dx = x - P.x, dz = z - P.z;
        if (dx * dx + dz * dz > this.bugReach) continue;
        cell = S.cell(`bug:${e.T.model || e.type}`);
        half = cell.half * e.r * this.bugSize * Math.min(1, e.mesh.scale.x / (e.baseScale || 1));   // grows in with the bug
        yaw = e.root.rotation.y; dark = this.bugDark;
        grounded = e.grounded;
      }
      const floor = this.below(e, x, y + (o ? 0.01 : 0), z, grounded, st);
      if (floor == null) continue;
      const h = Math.max(0, y - floor);   // how far above its surface: wider, fainter and softer, as the jelly's
      if (e.shadowLinks) {   // a body that bends (a millipede): a soft spot under every few links, as the chain lies now
        const L = e.shadowLinks, spot = e.r * this.linkSize * Math.min(1, e.mesh.scale.x / (e.baseScale || 1)), d = Math.max(dark * this.airFloor, dark / (1 + h * this.airFade)) * this.linkDark;
        const k0 = e.mesh.scale.x, c = Math.cos(yaw), sn = Math.sin(yaw);   // (from the links' own places this frame, not last frame's matrices)
        for (let k = 0; k < L.length && n < max; k += this.linkStep) { const l = L[k].position, lx = l.x * k0, lz = l.z * k0; n = this.place(n, S.cell('disc'), x + lx * c + lz * sn, floor + 0.0015, z - lx * sn + lz * c, 0, spot, d, h); }
        continue;
      }
      n = this.place(n, cell, x, floor + 0.0015, z, yaw, half * (1 + h * this.airWiden), Math.max(dark * this.airFloor, dark / (1 + h * this.airFade)), h, o ? e.r * this.eliteReach * (1 + h * this.airWiden) : Infinity);
    }
    inst.count = n;
    if (n) { inst.instanceMatrix.needsUpdate = true; this.look.needsUpdate = true; this.crop.needsUpdate = true; }
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
