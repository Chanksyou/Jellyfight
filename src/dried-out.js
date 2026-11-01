// Behind the death screen: the player's own jelly (a copy of it and what it wears, like the win
// screen's) lying dried out on cracked dry land under a dusty sun, the title screen's look gone dry.
// It slumps into a flat puddle with its tentacles splayed out across the mud, and fades to a dull
// husk over its first moment, then holds still until a new run starts.
import * as THREE from 'three';
import { UnderwaterBackdrop } from './main-menu.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const ease = (u) => u * u * (3 - 2 * u);

export class DriedOut {
  constructor(run) {
    this.run = run;
    this.camera = run.tpc.camera;
    this.land = new UnderwaterBackdrop(run.scene, this.camera, 'death-land');
    this.active = false;
    this.husk = new THREE.Color();
  }

  // the jelly (and what it wears) copied onto the land, alone, with materials of its own to dry out
  copy(source) {
    const clone = source.clone(true);
    // the tentacles move by rewriting geometry shared with the real ones: hide them, the splat draws its own
    const live = [], copied = [], hide = new Set((this.run.player.avatar?.tentacles?.list || []).flatMap((T) => [T.mesh, T.tip]));
    source.traverse((o) => live.push(o)); clone.traverse((o) => copied.push(o));
    live.forEach((o, i) => { if (hide.has(o)) copied[i].visible = false; });
    clone.traverse((o) => {
      o.layers.set(30);
      if (o.isSprite) o.visible = false;   // its halo: the glow is gone
      if (!o.isMesh || !o.material) return;
      const dry = (m) => {
        const c = m.clone();
        c.userData.from = { color: m.color?.clone(), emissive: m.emissive?.clone(), opacity: m.opacity };
        this.mats.push(c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(dry) : dry(o.material);
    });
    return clone;
  }

  begin() {
    this.cancel();
    const R = this.run;
    this.active = true; this.t = 0; this.runId = R.runId; this.mats = [];
    this.reduced = juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.saved = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), focus: R.gfx.focus, hud: R.hud.el.hidden };
    R.hud.el.hidden = true;   // just the jelly and the land
    this.at = R.player.position.clone(); this.h = R.cfg.height;
    this.husk.set(LOOK.color('death-husk', '#d8b98c'));
    this.jelly = new THREE.Group();
    this.body = this.copy(R.player.mesh);
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);   // (the real one stands where the jelly is)
    this.jelly.add(this.body);
    this.jelly.add(this.splat = this.splayed());
    R.scene.add(this.jelly);
    document.body.classList.add('dried-out');   // a lighter veil over the land (look.css)
    this.frame(0);
  }

  // the hunting tentacles laid out flat on the mud from under the rim, each in its own lazy wave
  splayed() {
    const A = this.run.player.avatar, rig = A?.tentacles, group = new THREE.Group();
    if (!rig) return group;
    const unit = this.h * (A.look?.size || 1), spread = 1 + LOOK.num('death-jelly-spread', 0.35);
    rig.list.forEach((T, i) => {
      const mat = T.mat.clone(); mat.emissiveIntensity = T.baseGlow;   // (as it rests, not mid-strike)
      mat.userData.from = { color: T.mat.color.clone(), emissive: T.baseEmissive.clone(), opacity: T.mat.opacity };
      this.mats.push(mat);
      const a = T.angle, r0 = Math.hypot(T.anchor.x, T.anchor.z) * unit * spread * 0.9, L = rig.length * unit * 0.8, w = rig.thick * unit * 1.2;
      const pts = Array.from({ length: 9 }, (_, k) => {
        const s = k / 8, b = a + Math.sin(s * 5 + i * 2.3) * 0.28 * s + (i % 2 ? 0.2 : -0.2) * s * s;   // curling as it goes
        const r = r0 + s * L;
        return new THREE.Vector3(Math.sin(b) * r, w, Math.cos(b) * r);
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, w, 5), mat);
      tube.layers.set(30);
      group.add(tube);
    });
    return group;
  }

  update(dt) {
    if (!this.active) return;
    if (this.run.runId !== this.runId) { this.cancel(); return; }
    this.t += dt;
    this.frame(dt);
  }

  frame(dt) {
    const h = this.h, P = this.at, J = this.jelly;
    const u = this.reduced ? 1 : ease(Math.min(1, this.t / LOOK.num('death-dry-time', 1.6)));
    // it slumps into a flat puddle, and its tentacles spread out across the mud around it
    const flat = LOOK.num('death-jelly-flat', 0.35), spread = LOOK.num('death-jelly-spread', 0.35);
    this.body.scale.set(1 + spread * u, 1 - (1 - flat) * u, 1 + spread * u);
    this.splat.scale.set(0.3 + 0.7 * u, 1, 0.3 + 0.7 * u);
    J.rotation.y = LOOK.num('death-jelly-yaw', 0.3);
    J.position.copy(P);
    // and dries: its colours fade to a dull husk, its glow goes out
    const fade = LOOK.num('death-husk-mix', 0.75) * u, dim = 1 - 0.9 * u;
    for (const m of this.mats) {
      const f = m.userData.from;
      if (f.color) m.color.copy(f.color).lerp(this.husk, fade);
      if (f.emissive) m.emissive.copy(f.emissive).multiplyScalar(dim);
      m.opacity = f.opacity * (1 - 0.15 * u);
    }
    // the camera looks down on it from above, a step away; it lies low on the screen, off to the side on a wide one
    const w = innerWidth, ht = innerHeight, wide = w > ht, d = h * LOOK.num('death-camera-distance', 2.6);
    this.camera.position.set(P.x, P.y + d * 0.7, P.z + d);
    this.camera.lookAt(P.x, P.y, P.z);
    // (a phone on its side: the end screen fills its height, so it lies in the margin past the words)
    const short = ht < 500 ? '-short' : '';
    const x = wide ? LOOK.num(`death-jelly-x${short}`, 0.8) : 0.5, y = LOOK.num(`death-jelly-y${short}`, 0.9);
    this.camera.setViewOffset(w, ht, (0.5 - x) * w, (0.5 - y) * ht, w, ht);
    this.run.gfx.focus = d;
    this.land.update(dt, J, this.reduced);
  }

  cancel() {
    if (this.active) {
      this.land.hide();
      this.camera.clearViewOffset();
      this.camera.position.copy(this.saved.position); this.camera.quaternion.copy(this.saved.quaternion);
      this.run.gfx.focus = this.saved.focus;
      this.run.hud.el.hidden = this.saved.hud;
      document.body.classList.remove('dried-out');
    }
    if (this.jelly) this.run.scene.remove(this.jelly);
    this.splat?.children.forEach((m) => m.geometry.dispose());
    for (const m of this.mats || []) m.dispose();
    this.jelly = this.body = this.splat = null; this.mats = null;
    this.active = false;
  }
}
