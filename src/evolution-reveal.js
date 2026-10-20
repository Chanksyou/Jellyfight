// A brief portrait of the selected jelly. Copies share its geometry/materials; gameplay stays frozen.
import * as THREE from 'three';
import { UnderwaterBackdrop } from './main-menu.js';
import { VolumeMaterial } from './vfx.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';

export class EvolutionReveal {
  constructor(run) {
    this.run = run;
    this.camera = run.tpc.camera;
    this.water = new UnderwaterBackdrop(run.scene, this.camera);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new VolumeMaterial(LOOK.color('friendly', '#5ff0ff'), 'sphere'));
    this.shell.visible = false; run.scene.add(this.shell);
    this.pairs = []; this.active = false;
    this.squeezeScale = new THREE.Vector3();
  }

  copy(source) {
    const clone = source.clone(true), originals = [], copies = [];
    source.traverse(o => originals.push(o)); clone.traverse(o => copies.push(o));
    originals.forEach((o, i) => this.pairs.push([o, copies[i]]));
    clone.traverse(o => o.layers.set(30));
    return clone;
  }

  capture() {
    this.portrait = new THREE.Group();
    this.body = this.copy(this.run.player.mesh);
    this.portrait.add(this.body, this.copy(this.run.adorn.free));
    this.run.scene.add(this.portrait);
  }

  begin(evo, before, done) {
    this.cancel();
    const R = this.run;
    this.active = true; this.elapsed = 0; this.done = done; this.runId = R.runId;
    this.reduced = juice.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.duration = LOOK.num(this.reduced ? 'evolution-reveal-calm-time' : 'evolution-reveal-time', this.reduced ? 0.2 : 1.6);
    this.saved = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), view: this.camera.view ? { ...this.camera.view } : null, focus: R.gfx.focus };
    R.adorn.update(0, R);
    this.newPieces = R.mods.adorn.filter(k => !before.adorn.includes(k)).map(k => R.adorn.piece(k));
    if (R.mods.energyShield && !before.energyShield) R.energyShield.update(0);
    this.capture();
    this.growing = this.newPieces.map(p => this.pairs.find(([source]) => source === p.group)?.[1]).filter(Boolean);
    if (R.mods.polyps && !before.polyps) this.growing.push(this.pairs.find(([source]) => source === R.adorn.piece('polyps').group)[1]);
    if (R.mods.energyShield && !before.energyShield) this.growing.push(this.pairs.find(([source]) => source === R.energyShield.group)[1]);
    if (R.mods.decoy && !before.decoy) {
      R.mirage.prepare();
      this.ghost = new THREE.Group(); this.ghost.add(this.copy(R.mirage.avatar.root)); this.portrait.add(this.ghost);
    }
    this.avatar = this.pairs.find(([source]) => source === R.player.avatar.root)?.[1];
    this.generation = R.ui.evolution(evo, () => this.finish());
    document.body.classList.add('evolution-presenting');
    sfx.evolutionGather();
    this.frame(0);
  }

  update(dt) {
    if (!this.active) return;
    if (this.run.runId !== this.runId || this.run.ui._gen !== this.generation) { this.cancel(); return; }
    this.elapsed += dt;
    const u = Math.min(1, this.elapsed / this.duration);
    if (!this.bloomed && u >= 0.45) { this.bloomed = true; this.run.player.avatar?.pulse(0.85); sfx.evolutionBloom(); }
    this.frame(u, dt);
    if (u >= 1) this.finish();
  }

  frame(u, dt = 0) {
    const R = this.run, P = R.player.position, h = R.cfg.height;
    this.newPieces.forEach(p => p.reveal?.(u));
    R.adorn.update(dt, R);
    for (const [source, clone] of this.pairs) {
      clone.position.copy(source.position); clone.quaternion.copy(source.quaternion); clone.scale.copy(source.scale); clone.visible = source.visible;
    }
    const bloom = this.reduced ? 1 : THREE.MathUtils.smoothstep(u, 0.42, 0.78);
    for (const g of this.growing) { g.visible = bloom > 0; g.scale.multiplyScalar(Math.max(0.001, bloom)); }
    if (this.avatar && !this.reduced) {
      const squeeze = u < 0.45 ? Math.sin(u / 0.45 * Math.PI / 2) : Math.exp(-(u - 0.45) * 10) * Math.cos((u - 0.45) * 20);
      this.avatar.scale.multiply(this.squeezeScale.set(1 - squeeze * 0.14, 1 + squeeze * 0.18, 1 - squeeze * 0.14));
    }
    if (this.ghost) {
      this.ghost.visible = u > 0.5 && u < 0.96;
      this.ghost.position.copy(P);
      this.ghost.position.x -= Math.cos(R.player.facing) * h * bloom * 0.8;
      this.ghost.position.z += Math.sin(R.player.facing) * h * bloom * 0.8;
      this.ghost.rotation.y = R.player.facing;
      this.ghost.scale.setScalar(Math.max(0.001, bloom));
    }
    this.shell.visible = !this.reduced && u < 0.8;
    this.shell.layers.set(30);
    this.shell.position.copy(P).y += h * 0.57;
    this.shell.scale.set(h * (0.4 + bloom * 0.2), h * (0.58 + bloom * 0.2), h * (0.4 + bloom * 0.2));
    this.shell.material.progress = Math.min(1, u / 0.45);
    this.shell.material.opacity = u < 0.45 ? 0.2 + u * 0.3 : 0.35 * (1 - bloom);
    const distance = h * LOOK.num(innerWidth < innerHeight ? 'evolution-camera-distance-portrait' : 'evolution-camera-distance', innerWidth < innerHeight ? 4.2 : 3.1);
    const yaw = R.player.facing + 0.15;
    this.camera.clearViewOffset();
    this.camera.position.set(P.x + Math.sin(yaw) * distance, P.y + h * 0.72, P.z + Math.cos(yaw) * distance);
    this.camera.lookAt(P.x, P.y + h * 0.52, P.z);
    R.gfx.focus = distance;
    this.water.update(dt, this.portrait, this.reduced);
  }

  finish() {
    if (!this.active) return;
    const done = this.done;
    this.cancel(); done?.();
  }

  cancel() {
    if (this.active) {
      if (this.run.ui._gen === this.generation) this.run.ui.close();
      this.newPieces?.forEach(p => p.reveal?.(null));
      this.water.hide();
      this.camera.position.copy(this.saved.position); this.camera.quaternion.copy(this.saved.quaternion);
      this.camera.clearViewOffset();
      const v = this.saved.view;
      if (v?.enabled) this.camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
      this.run.gfx.focus = this.saved.focus;
    }
    this.run.scene.remove(this.portrait);
    this.portrait = this.ghost = null; this.pairs.length = 0;
    this.shell.visible = false; this.active = this.bloomed = false; this.done = null;
    document.body.classList.remove('evolution-presenting');
    this.run.ui.modal.classList.remove('jf-evolution');
  }

  warm(on) {
    if (on) {
      this.capture(); this.portrait.traverse(o => { o.visible = true; o.layers.set(0); });
      this.shell.visible = this.water.mesh.visible = true;
      this.shell.layers.set(0); this.water.mesh.layers.set(0);
    } else {
      this.run.scene.remove(this.portrait); this.portrait = null; this.pairs.length = 0;
      this.shell.visible = this.water.mesh.visible = false;
      this.water.mesh.layers.set(30);
    }
  }
}
