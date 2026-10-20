// One reusable, harmless copy of the player's own jelly. Only bug aim uses it; collisions stay real.
import * as THREE from 'three';
import { buildCharacter } from './character.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';

export class Mirage {
  constructor(run) {
    this.run = run;
    this.group = new THREE.Group();
    this.group.name = 'Mirage'; this.group.visible = false;
    run.scene.add(this.group);
    this.position = this.group.position;
    this.center = new THREE.Vector3();
    this.materials = [];
    this.reset();
  }
  prepare() {
    const avatar = this.run.player.avatar;
    if (!avatar || this.source === avatar) return;
    this.source = avatar;
    const lookKey = JSON.stringify(avatar.look);
    if (this.avatar && this.lookKey === lookKey) return;
    this.lookKey = lookKey;
    if (this.avatar) { this.group.remove(this.avatar.root); this.avatar.dispose(); }
    this.avatar = buildCharacter(avatar.look, this.run.cfg.height);
    this.group.add(this.avatar.root);
    this.materials = [];
    const seen = new Set();
    this.avatar.root.traverse(o => {
      if (!o.isMesh && !o.isSprite) return;
      o.castShadow = false; o.receiveShadow = false;
      for (const m of [].concat(o.material)) {
        if (seen.has(m)) continue;
        seen.add(m); this.materials.push(m);
        m.transparent = true; m.depthWrite = false;
        m.opacity = LOOK.num('mirage-opacity', 0.38);
        m.color?.lerp(new THREE.Color(LOOK.color('mirage', '#bcecff')), 0.6);
        m.emissive?.set(LOOK.color('mirage', '#bcecff'));
        if (m.emissive) m.emissiveIntensity = LOOK.num('mirage-glow', 1.1);
      }
    });
    this.avatar.update(0, { speed: 0, vy: 0 });
  }
  reset() { this.wait = 0; this.left = 0; this.group.visible = false; this.last = null; }
  get target() { return this.left > 0 && this.group.visible ? this : null; }
  update(dt) {
    const R = this.run, Q = R.mods.decoy;
    if (!Q || !['explore', 'boss'].includes(R.phase) || R.polypT > 0) { this.left = 0; this.group.visible = false; this.last = null; return; }
    if (dt <= 0) return;
    this.prepare();
    const P = R.player.position;
    const moving = this.last && P.distanceToSquared(this.last) > 1e-8 && !R.player.flight;
    (this.last ||= new THREE.Vector3()).copy(P);
    if (this.left > 0) {
      this.left = Math.max(0, this.left - dt);
      this.avatar?.update(dt, { speed: 0, vy: 0 });
      const fade = Math.min(1, this.left / 0.6);
      for (const m of this.materials) m.opacity = LOOK.num('mirage-opacity', 0.38) * fade;
      this.group.visible = this.left > 0;
    }
    if (moving) this.wait += dt;
    if (this.wait < Q.every) return;
    this.wait = 0; this.left = Q.time; this.range = Q.range;
    this.position.copy(P); this.center.copy(P).y += R.cfg.height * 0.5;
    this.group.rotation.y = R.player.facing;
    this.group.visible = true;
    for (const m of this.materials) m.opacity = LOOK.num('mirage-opacity', 0.38);
    R.player.avatar?.pulse(0.8);
    R.fx.ring(this.center, R.friendly, R.cfg.radius * 1.3, 0.4);
    sfx.mirage();
  }
}
