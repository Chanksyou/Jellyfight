// The run's ending, after the last act's boss: "Congratulations, you won!" over the sea, where the
// player's own jelly (a copy of it and its adornments, like the evolution reveal's) swims away home,
// pulsing up and away from the camera through rising bubbles. Continue goes on to the score
// (run.js endRun: post it if it makes the top 10); the sea stays behind that until a new run starts.
import * as THREE from 'three';
import { UnderwaterBackdrop } from './main-menu.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { esc } from './leaderboard.js';

const BUBBLES = 14;

export class Victory {
  constructor(run) {
    this.run = run;
    this.camera = run.tpc.camera;
    this.water = new UnderwaterBackdrop(run.scene, this.camera);
    this.active = false;
    this.bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
    this.bubbleMat = new THREE.MeshBasicMaterial({ color: LOOK.color('victory-bubble', '#bff4ff'), transparent: true, opacity: 0.35, depthWrite: false });
  }

  // the jelly (and what it wears) copied into the sea, alone
  copy(source) {
    const clone = source.clone(true);
    clone.traverse((o) => o.layers.set(30));
    return clone;
  }

  begin(done) {
    this.cancel();
    const R = this.run, P = R.player.position, h = R.cfg.height;
    this.active = true; this.t = 0; this.runId = R.runId; this.done = done; this.continued = false;
    this.reduced = juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.saved = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), focus: R.gfx.focus, hud: R.hud.el.hidden };
    R.hud.el.hidden = true;   // just the jelly and the sea
    this.from = P.clone(); this.h = h;
    this.jelly = new THREE.Group();
    this.body = this.copy(R.player.mesh);
    this.jelly.add(this.body);
    if (R.adorn?.free) this.jelly.add(this.copy(R.adorn.free));
    this.bubbles = Array.from({ length: BUBBLES }, (_, k) => {
      const b = new THREE.Mesh(this.bubbleGeo, this.bubbleMat); b.layers.set(30);
      b.userData = { x: (Math.random() - 0.5) * h * 6, z: (Math.random() - 0.5) * h * 3, y: Math.random() * h * 6, s: h * (0.04 + Math.random() * 0.07), v: h * (0.6 + Math.random() * 0.8) };
      this.jelly.add(b);
      return b;
    });
    R.scene.add(this.jelly);
    // the words over it, and Continue once it has had a moment
    const S = R.stage;
    this.el = document.createElement('div');
    this.el.className = 'jf-victory';
    this.el.innerHTML = `<style>
      .jf-victory { position: fixed; inset: 0; z-index: 31; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 9vh 16px 8vh; pointer-events: none; color: #fff; text-align: center; font-family: system-ui, sans-serif; }
      .jf-victory h1 { margin: 0; font-size: clamp(34px, 7vw, 64px); letter-spacing: -.01em; text-shadow: 0 4px 24px #0009; animation: jf-win-in .9s cubic-bezier(.2, 1.4, .4, 1) both; }
      .jf-victory p { margin: 10px 0 0; font-size: clamp(15px, 2.4vw, 20px); opacity: .9; text-shadow: 0 2px 8px #000a; animation: jf-win-fade 1.2s .5s both; }
      .jf-victory button { pointer-events: auto; font: 700 17px system-ui, sans-serif; border: 0; border-radius: 14px; padding: 13px 28px; background: #ffd23a; color: #1d1a12; cursor: pointer; animation: jf-win-fade .6s both; }
      .jf-victory button[hidden] { display: none; }
      @keyframes jf-win-in { from { opacity: 0; transform: scale(.6) translateY(-20px); } }
      @keyframes jf-win-fade { from { opacity: 0; transform: translateY(8px); } }
      @media (prefers-reduced-motion: reduce) { .jf-victory h1, .jf-victory p, .jf-victory button { animation: none; } }
    </style>
    <div><h1>🏆 Congratulations!</h1><p><b>You won!</b> ${esc(S.won || 'The apartment is yours.')}</p><p>Your jelly swims home to the sea.</p></div>
    <button type="button" hidden>Continue</button>`;
    this.button = this.el.querySelector('button');
    this.button.onclick = () => this.next();
    this.keys = (e) => { if (e.code === 'Enter' || e.code === 'Space') { if (!this.button.hidden) this.next(); } };
    addEventListener('keydown', this.keys);
    document.body.appendChild(this.el);
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.treasure(); sfx.evolutionBloom?.();
    this.frame(0);
  }

  // Continue: the words go, the score comes up (the sea stays behind it)
  next() {
    if (this.continued) return;
    this.continued = true;
    this.el?.remove(); this.el = null;
    removeEventListener('keydown', this.keys);
    this.done?.();
  }

  update(dt) {
    if (!this.active) return;
    if (this.run.runId !== this.runId) { this.cancel(); return; }
    this.t += dt;
    if (this.button?.hidden && this.t > LOOK.num('victory-continue-after', this.reduced ? 0.3 : 1.6)) this.button.hidden = false;
    this.frame(dt);
  }

  frame(dt) {
    const R = this.run, h = this.h, P = this.from, t = this.t;
    // it swims away: up and off into the sea, pulsing its bell, swaying, getting smaller in the distance
    const go = this.reduced ? 0 : t, k = 1 - Math.exp(-go * 0.25);
    this.body.position.set(Math.sin(go * 0.7) * h * 0.4 * k, h * 3.2 * k, -h * 9 * k);
    const pulse = this.reduced ? 0 : Math.sin(go * 4.2);
    this.body.scale.set(1 - pulse * 0.08, 1 + pulse * 0.12, 1 - pulse * 0.08);
    this.body.rotation.set(-0.35 * k, Math.sin(go * 0.5) * 0.3, Math.sin(go * 0.9) * 0.12);
    this.jelly.position.copy(P);
    for (const b of this.bubbles) {                                           // bubbles rising past it, looping
      const u = b.userData; u.y += (this.reduced ? 0 : dt) * u.v;
      if (u.y > h * 7) u.y = -h * 1;
      b.position.set(u.x, u.y, u.z - h * 3 * k); b.scale.setScalar(u.s);
    }
    // the camera holds, looking up after it
    const distance = h * 3.2;
    this.camera.clearViewOffset();
    this.camera.position.set(P.x, P.y + h * 0.9, P.z + distance);
    this.camera.lookAt(P.x, P.y + h * (0.5 + 1.6 * k), P.z - h * 4 * k);
    R.gfx.focus = distance + h * 6 * k;
    this.water.update(dt, this.jelly, this.reduced);
  }

  cancel() {
    if (this.active) {
      this.water.hide();
      this.camera.position.copy(this.saved.position); this.camera.quaternion.copy(this.saved.quaternion);
      this.run.gfx.focus = this.saved.focus;
      this.run.hud.el.hidden = this.saved.hud;
    }
    this.el?.remove(); this.el = null;
    if (this.keys) removeEventListener('keydown', this.keys);
    if (this.jelly) this.run.scene.remove(this.jelly);
    this.jelly = this.body = null; this.bubbles = null;
    this.active = false; this.done = null;
  }
}
