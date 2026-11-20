// The pick screen's live card (pick-screen.js): the player's own jelly as a type, wearing its look,
// firing its real main attack at a bug, over and over. Nothing here draws an attack of its own: it
// runs the game's attack systems (Bubbles for bubbles and every Element shot, Lash for the Tentacle
// jelly) with their own Fx in a little scene of their own, so a type's attack shows here as soon as
// it works in play (a P8 type needs nothing added). Its hits land on three stand-in roaches with a
// roach's Health, so the card shows how long they take to kill and how the attack spreads (a Burn
// lighting the next, three tentacles at once); they die the game's way (feedback.js showKill) and
// come back. No event reaches the game, no sound plays, no shake.
//
// It films the attack on a little stage (pick-stage.js: lights, reflections, floor, backdrop) into
// its own sharp picture (half-float, smoothed edges), with the game's bloom and tone mapping
// (graphics.js; no bloom on Low graphics). Its Fx is the one `showcase` Fx (fx.js): effects may
// spend more here than in play.
//
// Phones first: one preview at a time (the centre card), built the first time it's asked for, drawn
// by the game's own renderer and copied straight to the card's canvas (no second WebGL context, no
// pixel read back), at --preview-fps, only while the pick screen is open; its pictures are freed
// when the screen closes.
import * as THREE from 'three';
import { CONTENT } from './content.js';
import { CONFIG } from './config.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { bus } from './events.js';
import { hushed } from './sfx.js';
import { Batcher, batchingInto } from './batch.js';
import { Fx } from './fx.js';
import { Bubbles } from './bubbles.js';
import { Lash } from './combat.js';
import { FLASH } from './enemies.js';
import { showKill } from './feedback.js';
import { buildRoach } from './critters.js';
import { buildCharacter } from './character.js';
import { Adornments } from './adornments.js';
import { jellyStats } from './jelly-types.js';
import { newMods } from './words.js';
import { PickStage } from './pick-stage.js';
import { drawToCard } from './pick-auras/painter.js';
import { MipBloomPass, BloomOutputPass } from './graphics.js';

const H = CONFIG.player.height;
const _at = new THREE.Vector3(), _rim = new THREE.Vector3(), _way = new THREE.Vector3();
const QUAD = new THREE.PlaneGeometry(2, 2).deleteAttribute('normal');   // (stands in for the passes' own quads while their shaders are built: no normals, as theirs)
const IDLE = { speed: 0, walkSpeed: 1, grounded: true, vy: 0, swim: 0 };
// where the three roaches stand: [metres from the jelly, radians round from straight ahead]. The
// Tentacle jelly's all inside its 11 cm reach (its 3 tentacles take them all at once); a shot's
// further off and one behind the other, nearest first, so each shot has a way to fly
const SPOTS = {
  melee: [[0.11, -0.95], [0.125, 0], [0.11, 0.95]],
  ranged: [[0.13, -0.3], [0.17, 0.28], [0.21, -0.06]],
};

// what the attacks' events do to the stand-in roaches: a hit flashes it white, squashes it and takes
// its Health; a shove pushes it back, and it walks back to its spot
function onBug(P, type, p) {
  const bug = P.enemies.list.find((b) => b.id === p?.targetId);
  if (!bug || bug.dead) return;
  if (type === 'knockback' && p.dir) bug.push.addScaledVector(p.dir, Math.min(0.03, p.force || 0));
  if (type === 'status_applied' && p.status === 'chill') bug.chillT = Math.max(bug.chillT || 0, p.duration || 0);   // (roachFrame shows it)
  if (type !== 'damage_taken') return;
  P.stage.flash(P.enemies.center(bug, _at));   // the attack's light flares at the hit
  bug.flashT = LOOK.num('hit-flash', 0.07); bug.pop = 1;
  if (p.feedback?.element) bug.lastElement = p.feedback.element;
  if (p.feedback?.dir) bug.lastDir = p.feedback.dir;
  if ((bug.hp -= p.amount) > 0) return;
  bug.dead = true;
  P.scene.remove(bug.root);
  showKill(P.fx, (id) => (P.bubbles.burning.get(bug)?.t > 0 && id === bug.id), {
    targetId: bug.id, type: 'roach', pos: P.enemies.center(bug), floor: 0, r: bug.r, element: bug.lastElement, dir: bug.lastDir, body: bug.root });
}

// run fn as part of the preview: its meshes drawn by the preview's batcher, its events kept to the
// stand-in roaches, its sounds and screen shake not reaching the game
function quietly(P, fn) {
  const emit = bus.emit, { trauma, stop, slowT, slowK } = juice;
  bus.emit = (type, p) => onBug(P, type, p);
  try { return batchingInto(P.batch, () => hushed(fn)); }
  finally { bus.emit = emit; Object.assign(juice, { trauma, stop, slowT, slowK }); }
}

export class AttackPreview {
  // tier(): the graphics tier ('low' draws no bloom)
  constructor(renderer, tier = () => 'medium') {
    this.renderer = renderer;
    this.tier = tier;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tp-live';
    this.canvas.hidden = true;
    this.ctx = this.canvas.getContext('2d');
    this.id = null; this.lookKey = null; this.wait = 0; this.on = false;
    this.built = new Map();   // type -> its shaders are built (warm): false while they're building
  }

  // the scene, its lights, its own Fx, attack systems and the bug: made the first time
  setup() {
    const scene = new THREE.Scene();
    const stage = new PickStage(scene, this.renderer);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.005, 5);
    const batch = new Batcher(scene);
    // the floor is the only thing to hit (a bubble that misses pops on it, as on a real floor)
    const hit = { point: new THREE.Vector3(), distance: 0 };
    const world = {
      cast(o, d, len) {
        if (d.y >= 0 || o.y + d.y * len > 0) return null;
        hit.distance = -o.y / d.y; hit.point.copy(o).addScaledVector(d, hit.distance);
        return hit;
      },
      castAll(o, d, len) { return this.cast(o, d, len); },
    };
    const enemies = {
      list: [], statuses: {},
      center: (e, out = new THREE.Vector3()) => out.copy(e.pos).setY(e.pos.y + e.r),
      floorBelow: () => 0,
      statusMore: () => 1,
      swatShots() {},   // (Badminton Racket: no Shots in a preview)
    };
    const P = this.P = { scene, camera, batch, world, enemies, stage, deadT: 0 };
    quietly(P, () => {
      P.fx = new Fx(scene, camera);
      P.fx.showcase = true;
      P.bubbles = new Bubbles(scene, enemies, P.fx, world);
      P.bubbles.grace = CONFIG.player.radius;
      P.lash = new Lash(scene, enemies, P.fx);
    });
    // the bell squeezes as it blows (run.js), and the attack's light flares at its mouth
    const mouth = (k) => stage.flash(_at.copy(P.player.position).setY(H * 0.75), k);
    P.bubbles.onBlow = () => { P.avatar?.pulse?.(0.6); mouth(0.6); };
    P.bubbles.onElementRelease = () => { P.avatar?.pulse?.(0.75); mouth(1); };
    P.lash.onLash = () => { P.avatar?.pulse?.(0.3); mouth(0.5); };
    P.lash.getRig = () => P.avatar?.tentacles || null;
  }

  // Start showing type `id` as the player's jelly (`look`) in `host` (the centre card's portrait frame)
  show(id, look, host) {
    try {
      if (!this.P) this.setup();
      const P = this.P, J = CONTENT.jellies[id], key = JSON.stringify(look);
      if (host && this.canvas.parentNode !== host) host.appendChild(this.canvas);
      const px = Math.round((host?.clientWidth || 160) * Math.min(devicePixelRatio || 1, 2));
      if (this.canvas.width !== px) this.canvas.width = this.canvas.height = px;
      if (id !== this.id || key !== this.lookKey) {
        this.clearJelly();
        this.id = id; this.lookKey = key;
        const own = LOOK.color(`type-${id}`, '#8fd9ff');
        P.stage.setType(own, LOOK.color(`preview-grade-${id}`, '#ffffff'));
        const avatar = P.avatar = buildCharacter(look, H);
        avatar.update?.(0, IDLE);
        P.scene.add(avatar.root);
        P.player = { mesh: avatar.root, avatar, position: avatar.root.position };
        P.worn = quietly(P, () => new Adornments(P.scene, P.player, { height: H }, { batch: P.batch }));
        P.play = { phase: 'explore', polypT: 0, fx: P.fx, mods: { adorn: [], polyps: null }, typeAdorn: J.adorn ? [J.adorn] : [] };
        P.attack = { kind: J.attack, hit: J.hit };
        const s = jellyStats(id);
        P.stats = s;
        // the Tentacle jelly's lash is its attack (run.js tentacleStats, with no Treasures)
        P.lashStats = { tentacles: s.bubbles, reach: s.reach, tentacleDamage: s.bubbleDamage * J.hit, tentacleSpeed: s.fireRate };
        P.mods = newMods();
      }
      this.reset();
      this.on = true;
      return true;
    } catch (e) {
      console.warn('attack preview', e);
      this.hide();
      return false;
    }
  }

  // A fresh roach (its own model: a dead one's body may still be busy dying) standing at `home`, facing the jelly
  roach(i, home) {
    const P = this.P, T = CONTENT.enemies.roach, look = buildRoach();
    const bug = { id: `preview-roach-${i}`, type: 'roach', T: { fly: false, words: [] }, r: T.r, hp: T.hp, dead: false, home,
      push: new THREE.Vector3(), vel: new THREE.Vector3(), flashT: 0, pop: 0, root: new THREE.Group(), mesh: look.body, anim: look.anim };
    look.body.scale.multiplyScalar(bug.r);
    bug.root.add(look.body);
    bug.pos = bug.root.position.copy(home);
    bug.root.rotation.y = Math.atan2(-home.x, -home.z);
    P.scene.add(bug.root);
    P.batch.track(bug.root);
    return bug;
  }

  // everything back to the start: three roaches in their spots, nothing in the air, the first shot soon
  reset() {
    const P = this.P;
    quietly(P, () => { P.bubbles.reset(); P.lash.reset(); P.fx.glow.clear(); });
    for (const b of P.enemies.list) P.scene.remove(b.root);
    // the jelly in the middle facing +x, the roaches in front of it
    P.avatar.root.position.set(0, 0, 0);
    P.avatar.root.rotation.y = Math.PI / 2;
    const spots = SPOTS[P.attack.kind === 'tentacle' ? 'melee' : 'ranged'], mid = new THREE.Vector3();
    P.enemies.list = spots.map(([d, a], i) => this.roach(i, new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)));
    for (const b of P.enemies.list) mid.add(b.home);
    mid.multiplyScalar(LOOK.num('preview-camera-lean', 0.6) / spots.length).setY(H * 0.3);   // between the jelly and its roaches, nearer the jelly
    P.deadT = 0;
    P.stage.place(mid);
    for (let i = 0; i < 20; i++) quietly(P, () => P.avatar.update?.(0.05, IDLE));   // its tentacles settle before the first frame
    // the camera in front and to the jelly's side, a little above: the jelly near and big, the roaches further off
    this.view = { mid, d: LOOK.num('preview-camera-distance', 0.6) * Math.max(0.8, Math.max(...spots.map(([far]) => far)) / 0.21), t: 0 };   // closer in on a close fight
    this.aim(0);
    this.wait = 0;
  }

  // the camera, drifting a few degrees round its spot (still with Reduce effects)
  aim(dt) {
    const V = this.view, C = this.P.camera, drift = juice.calm ? 0 : LOOK.num('preview-camera-drift', 0.06);
    V.t += dt;
    const yaw = LOOK.num('preview-camera-angle', 0.4) + drift * Math.sin(V.t * 0.17), up = LOOK.num('preview-camera-up', 0.45) + drift * 0.4 * Math.sin(V.t * 0.11 + 1);
    C.position.set(V.mid.x - Math.sin(yaw) * Math.cos(up) * V.d, V.mid.y + Math.sin(up) * V.d, V.mid.z + Math.cos(yaw) * Math.cos(up) * V.d);
    C.lookAt(V.mid);
  }

  clearJelly() {
    const P = this.P;
    if (!P?.avatar) return;
    P.scene.remove(P.avatar.root, P.worn.free);
    P.worn.free.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    P.avatar.dispose?.();
    P.avatar = P.worn = null;
  }

  hide() {
    this.on = false;
    this.canvas.hidden = true;
    if (this.P) quietly(this.P, () => { this.P.bubbles.reset(); this.P.lash.reset(); });
  }

  // the pick screen closed: free the stage's pictures on the GPU (they're made again on the next show)
  release() {
    this.hide();
    this.film_?.rt.dispose();
    this.film_?.bloom.down.forEach((t) => t.dispose());
    this.P?.stage.unreflect();
  }

  // A type's first showing: play a few seconds unseen so its shots, hits and deaths are all in the
  // scene, then build their shaders off the main thread where the browser can (compileAsync), and
  // only draw once they're ready: no stall on a phone as the first shot flies. The still portrait
  // shows until then.
  warm(id) {
    const P = this.P, R = this.renderer, was = R.getRenderTarget(), F = this.film(this.canvas.width);
    this.built.set(id, false);
    const quads = (mats) => { const s = new THREE.Scene(); for (const m of mats) s.add(new THREE.Mesh(QUAD, m)); return s; };
    F.out.prepare(R);
    const builds = [];
    // the scene and the bloom for the stage's own picture (a half-float target takes other shaders
    // than the screen): every half second of the fight (shots, hits, bodies flying apart come and go)
    // and again fresh (by then the first roaches have died and left the scene); then the pass that
    // puts it on the screen
    const scene = (...more) => {
      P.batch.sync();
      try { R.setRenderTarget(F.rt); builds.push(R.compileAsync?.(P.scene, P.camera), ...more.map((s) => R.compileAsync?.(s, P.camera))); } finally { R.setRenderTarget(was); }
    };
    scene(quads([F.bloom.bright, F.bloom.halve, F.bloom.widen]));
    for (let i = 1; i <= 75; i++) { this.simulate(1 / 30); if (i % 15 === 0) scene(); }
    this.reset();
    scene();
    try { R.setRenderTarget(null); builds.push(R.compileAsync?.(quads([F.out.material]), P.camera)); } finally { R.setRenderTarget(was); }
    const done = () => this.built.set(id, true);
    Promise.all(builds).then(done, done);
  }

  // One frame of the preview (dt: seconds since the last call). It draws at --preview-fps at most;
  // false if it can't draw (the pick screen then keeps its still portrait)
  step(dt) {
    if (!this.on) return false;
    try {
      // the graphics chip was reset (gpu-recovery.js): the still portrait shows, and once it's back the
      // reflections are drawn and the shaders built again before the next frame
      if (this.renderer.getContext().isContextLost?.()) { this.built.clear(); this.P.stage.unreflect(); this.canvas.hidden = true; return false; }
      if (!this.P.stage.env) this.P.stage.reflect(this.renderer);
      if (!this.built.has(this.id)) this.warm(this.id);
      if (!this.built.get(this.id)) return true;
      this.wait += dt;
      if (this.wait < 1 / LOOK.num('preview-fps', 30)) return true;
      const t = Math.min(0.05, this.wait);
      this.wait = 0;
      this.simulate(t);
      this.draw();
      this.canvas.hidden = false;
      return true;
    } catch (e) {
      console.warn('attack preview', e);
      this.hide();
      return false;
    }
  }

  simulate(dt) {
    const P = this.P, A = P.attack, av = P.avatar;
    quietly(P, () => {
      av.update?.(dt, IDLE);
      P.scene.updateMatrixWorld();
      P.worn.update(dt, P.play);
      const feet = av.root.position;
      P.bubbles.update(dt, new THREE.Vector3(feet.x, feet.y + H * 0.75, feet.z), P.stats, P.mods, false, A);
      const origin = new THREE.Vector3(feet.x, feet.y + H * 0.45, feet.z);
      if (A.kind === 'tentacle') P.lash.update(dt, origin, P.lashStats, P.mods.hits.tentacles, { nth: P.mods.nth, stingCount: P.mods.stingCount });
      else P.lash.animate(dt, origin);
      P.stage.frame(dt, P);
      P.fx.update(dt);
    });
    this.aim(dt);
    for (const bug of P.enemies.list) if (!bug.dead) this.roachFrame(bug, dt);
    // all three down: a beat to see the last one go, then they're back
    if (P.enemies.list.every((b) => b.dead) && (P.deadT += dt) >= LOOK.num('preview-respawn', 1.2)) this.reset();
  }

  // a roach: shoved back by a hit, it walks back to its spot; flashes white and squashes as it's hit (enemies.js)
  roachFrame(bug, dt) {
    const before = bug.vel.copy(bug.pos), shove = Math.min(1, dt * 12);
    bug.pos.addScaledVector(bug.push, shove).lerp(bug.home, 1 - Math.exp(-dt * 2.5));
    bug.push.multiplyScalar(1 - shove);
    bug.vel.subVectors(bug.pos, before).divideScalar(dt);   // its legs walk with it (critters.js)
    bug.pop = Math.max(0, bug.pop - dt * 6);
    bug.mesh.scale.setScalar(bug.r * (1 + bug.pop * 0.35));
    bug.flashT = Math.max(0, bug.flashT - dt);
    const on = bug.flashT > 0;
    if (on !== !!bug.flashing) {
      bug.flashing = on;
      bug.mesh.traverse((o) => { if (!o.isMesh) return; if (on) { o.userData.mat = o.material; o.material = FLASH; } else if (o.userData.mat) o.material = o.userData.mat; });
    }
    bug.anim?.(dt, bug);
    if ((bug.chillT = Math.max(0, (bug.chillT || 0) - dt)) > 0) this.chilled(bug, dt);
  }

  // a Chilled roach: rime glinting on its back and its breath steaming cold toward the jelly
  chilled(bug, dt) {
    const G = this.P.fx.glow, c = this.P.enemies.center(bug, _at), r = bug.r;
    const rime = this.rime ||= new THREE.Color(LOOK.color('ice-shard', '#cfefff')), breath = this.breath ||= new THREE.Color(LOOK.color('ice-frost', '#9fe4ff'));
    if (Math.random() < dt * 45) G.emit(_rim.copy(c).add(_way.randomDirection().multiplyScalar(r * 0.9)).setY(c.y + r * (0.2 + Math.random() * 0.5)), rime, r * 0.28, 0, 0.2, 1.4);
    if (Math.random() < dt * 10) {
      const head = _way.subVectors(this.P.player.position, bug.pos).setY(0).normalize();
      G.emit(_rim.copy(c).addScaledVector(head, r * 1.1), breath, r * 0.3, r * 1.1, 0.8, 0.8, head.multiplyScalar(0.025).setY(0.006), 0);
    }
  }

  // the stage's picture `px` square: a half-float target with smoothed edges (4x MSAA), its bloom
  // (graphics.js, half resolution), and the pass that adds the bloom and tone maps it for the screen
  film(px) {
    const F = this.film_ ||= (() => {
      const bloom = new MipBloomPass(LOOK.num('preview-bloom', 0.22), LOOK.num('preview-bloom-threshold', 1.1));
      const out = new BloomOutputPass(bloom);
      out.renderToScreen = true;
      return { rt: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }), bloom, out };
    })();
    if (F.rt.width !== px) { F.rt.setSize(px, px); F.bloom.setSize(px, px); }
    return F;
  }

  // film the stage into its picture, bloom it (not on Low), tone map it into a corner of the game's
  // canvas, copy that onto the card's canvas, and put the renderer back
  draw() {
    const R = this.renderer, P = this.P, gl = R.domElement, size = this.canvas.width;
    const px = Math.min(gl.width, gl.height, Math.round(size * LOOK.num('preview-supersample', 1)));
    const F = this.film(px);
    P.batch.sync();
    // glows are sized in metres: pixels a metre at 1 m for this little view, not the screen's (vfx.js)
    P.fx.glow.mat.uniforms.uScale.value = px / (2 * Math.tan(THREE.MathUtils.degToRad(P.camera.fov) / 2));
    F.bloom.enabled = this.tier() !== 'low';
    drawToCard(R, this.ctx, px, size, (corner) => {
      R.setClearColor(0x000000, 1);
      R.setRenderTarget(F.rt);
      R.render(P.scene, P.camera);
      if (F.bloom.enabled) F.bloom.render(R, null, F.rt);
      corner();
      F.out.render(R, null, F.rt);
    });
  }
}
