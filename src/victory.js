// The run's ending, after the last act's boss: "You won!" over the sea, where the
// player's own jelly (a copy of it and its adornments, like the evolution reveal's) swims home up close,
// pulsing up and away from the camera through rising bubbles, beside a panel with the run's numbers. Continue goes on to the score
// (run.js endRun: post it if it makes the top 10); the sea stays behind that until a new run starts.
import * as THREE from 'three';
import { UnderwaterBackdrop } from './main-menu.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { freezeBell } from './bell-flex.js';
import { sfx } from './sfx.js';
import { esc } from './leaderboard.js';
import { icon } from './icons.js';

const BUBBLES = 14;
// the words beside the jelly: a kit panel (the run's numbers, Continue) on the right of a wide screen, at the foot of a tall one
const CSS = `
.jf-victory { position: fixed; inset: 0; z-index: 31; display: flex; align-items: center; justify-content: flex-end; box-sizing: border-box; pointer-events: none; text-align: center; color: var(--ui-ink); font-family: var(--ui-font-text);
  padding: max(var(--ui-space-4), env(safe-area-inset-top)) max(var(--ui-space-5), env(safe-area-inset-right)) max(var(--ui-space-4), env(safe-area-inset-bottom)) max(var(--ui-space-5), env(safe-area-inset-left)); }
.jf-win { width: min(380px, 100%); max-height: 100%; overflow-y: auto; display: grid; justify-items: center; gap: var(--ui-space-3); }
.jf-win h1 { display: flex; align-items: center; gap: var(--ui-space-3); margin: 0; font: 600 calc(var(--ui-size-title) * 1.4)/1.1 var(--ui-font-display); }
.jf-win h1 .ui-icon { width: 1.1em; height: 1.1em; color: var(--ui-gold); }
.jf-win p { margin: 0; color: var(--ui-ink-dim); font-size: var(--ui-size-body); text-wrap: balance; }
.jf-win-nums { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--ui-space-2); width: 100%; }
.jf-win-nums b { font: 600 var(--ui-size-heading)/1.1 var(--ui-font-display); color: var(--ui-gold); font-variant-numeric: tabular-nums; }
.jf-win .ui-btn { pointer-events: auto; }
.jf-win .ui-btn[hidden] { display: none; }
@media (max-aspect-ratio: 5/4) { .jf-victory { align-items: flex-end; justify-content: center; } .jf-win { width: min(420px, 100%); } }
@media (max-height: 520px) { .jf-win { gap: var(--ui-space-2); } .jf-win-nums { grid-template-columns: repeat(4, 1fr); } .jf-win-nums .ui-tile { min-width: 0; padding: var(--ui-space-1); } }
`;

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
    const live = [], copied = [];
    source.traverse((o) => live.push(o)); clone.traverse((o) => copied.push(o));
    copied.forEach((o, i) => {
      o.layers.set(30);
      if (o.isMesh && !Array.isArray(o.material)) o.material = freezeBell(live[i].material);   // the bell's riders are frozen: so is its bend
    });
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
    const t = R.t, treasures = [...R.owned].reduce((n, id) => n + R.owned.count(id), 0);
    const nums = [[`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, 'Time'], [R.level, 'Level'], [R.kills.toLocaleString(), 'Bugs'], [treasures, 'Treasures']];
    this.el.innerHTML = `<style>${CSS}</style>
    <section class="ui-panel jf-win ui-pop" aria-label="Run won"><h1>${icon('trophy')} You won!</h1><p>${esc(S.won || 'The apartment is yours.')}</p>
      <div class="jf-win-nums">${nums.map(([v, label]) => `<span class="ui-tile"><b>${v}</b>${label}</span>`).join('')}</div>
      <button type="button" class="ui-btn ui-btn--primary ui-enter" hidden>Continue</button></section>`;
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
    // it swims home up close: drifting up and away into the sea, pulsing its bell and swaying
    const go = this.reduced ? 0 : t, k = 1 - Math.exp(-go * 0.25);
    this.body.position.set(Math.sin(go * 0.7) * h * 0.2 * k, h * 0.9 * k, -h * 1.6 * k);
    const pulse = this.reduced ? 0 : Math.sin(go * 4.2);
    this.body.scale.set(1 - pulse * 0.08, 1 + pulse * 0.12, 1 - pulse * 0.08);
    this.body.rotation.set(-0.35 * k, Math.sin(go * 0.5) * 0.3, Math.sin(go * 0.9) * 0.12);
    this.jelly.position.copy(P);
    for (const b of this.bubbles) {                                           // bubbles rising past it, looping
      const u = b.userData; u.y += (this.reduced ? 0 : dt) * u.v;
      if (u.y > h * 7) u.y = -h * 1;
      b.position.set(u.x, u.y, u.z - h * 3 * k); b.scale.setScalar(u.s);
    }
    // the camera holds, looking up after it; the jelly sits beside the words (left of them on a wide screen, above them on a tall one)
    const distance = h * LOOK.num('victory-camera-distance', 1.35), w = innerWidth, ht = innerHeight, wide = w > ht * 1.25;
    const x = wide ? LOOK.num('victory-jelly-x', 0.3) : 0.5, y = wide ? 0.5 : LOOK.num('victory-jelly-y-tall', 0.32);
    this.camera.position.set(P.x, P.y + h * 0.9, P.z + distance);
    this.camera.lookAt(P.x, P.y + h * (0.55 + 0.5 * k), P.z - h * 1.2 * k);
    this.camera.setViewOffset(w, ht, (0.5 - x) * w, (0.5 - y) * ht, w, ht);
    R.gfx.focus = distance + h * 1.6 * k;
    this.water.update(dt, this.jelly, this.reduced);
  }

  cancel() {
    if (this.active) {
      this.water.hide();
      this.camera.clearViewOffset();
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
