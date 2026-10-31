// The jelly's Shield (GLOSSARY): a pool on top of Health, as big as the Shield stat. Damage takes
// it first; once the jelly has taken no damage for SHIELD_WAIT s it refills, empty to full in
// SHIELD_FILL s (stats.js; shield-recharge treasures shorten both). A faint hex shell round the jelly
// shows it, filling from the floor up while it recharges.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { VolumeMaterial } from './vfx.js';
import { bus } from './events.js';
import { juice } from './juice.js';
import { SHIELD_FILL, SHIELD_WAIT, knockFor } from './stats.js';

export class Shield {
  constructor(run) {
    this.run = run;
    this.color = LOOK.color('shield', '#b8e6ff');
    this.group = new THREE.Group();
    this.group.name = 'Shield';
    const material = new VolumeMaterial(this.color, 'sphere');   // the Warnings' shader: nothing new to build
    material.uniforms.uHex.value = LOOK.num('shield-hex', 80);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    this.group.add(this.shell);
    run.player.mesh.add(this.group);
    this.reset();
  }

  reset() {
    this.hp = this.max = this.calm = this.flash = 0;
    this.charging = false;
    this.state = null;   // what just happened, for the HUD bar: 'broken', 'charging', 'full' (cleared once read)
    this.group.visible = false;
  }

  get full() { return this.max > 0 && this.hp >= this.max - 1e-6; }
  get wait() { return Math.max(0, SHIELD_WAIT - this.run.mods.shield.sooner); }
  get fill() { return SHIELD_FILL / (1 + this.run.mods.shield.faster); }

  update(dt) {
    const run = this.run, max = run.S.shield;
    if (max > this.max) this.hp += max - this.max;   // new Shield (a card, a treasure) arrives charged
    this.max = max; this.hp = Math.min(this.hp, max);
    this.flash = Math.max(0, this.flash - dt);
    this.calm += dt;
    if (max > 0 && this.hp < max && this.calm >= this.wait) {
      if (!this.charging) { this.charging = true; this.state = 'charging'; sfx.shieldCharge(); }
      this.hp = Math.min(max, this.hp + max / this.fill * dt);
      if (this.hp >= max) { this.charging = false; this.state = 'full'; this.flash = 0.35; sfx.shieldReady(); }
    }
    const h = run.cfg.height * (run.player.avatar?.root.scale.x || 1);
    this.group.position.y = h * 0.6 + 0.002;
    this.group.scale.set(h * 0.5, h * 0.62, h * 0.5);   // a touch outside Aegis's shell, so both read
    this.group.visible = this.hp > 0 && !['dead', 'won'].includes(run.phase);
    const m = this.shell.material;
    m.progress = max > 0 ? this.hp / max : 0;
    m.opacity = LOOK.num('shield-opacity', 0.22) + this.flash * 1.6;
  }

  // Damage through the Shield first; what's left goes to Health. Any damage restarts the wait.
  absorb(amount, silent = false) {
    if (amount <= 0) return amount;
    this.calm = 0;
    if (this.charging) this.charging = false;
    if (this.hp <= 0) return amount;
    const blocked = Math.min(amount, this.hp), run = this.run;
    this.hp -= blocked;
    const at = run.player.position.clone().setY(run.player.position.y + run.cfg.height * 0.6);
    if (!silent) { run.fx.impact(at, this.color, 0.01, 4); sfx.shieldHit(); }
    if (this.hp <= 1e-8) {
      this.hp = 0;
      this.state = 'broken';
      run.fx.burst(at, [this.color, '#ffffff'], 10, 0.0025, 0.22, run.player.position.y);   // the shell shatters
      const bursts = run.mods.shield.bursts;
      for (const B of bursts) this.burst(at, B.radius, B.flat ? B.dmg : B.dmg * run.S.bubbleDamage);
      if (!bursts.length) sfx.shieldBreak();
    }
    return amount - blocked;
  }

  // shield-burst: the breaking shell blasts outward; the ring and puff show the real `radius`,
  // every enemy inside takes `dmg` and is shoved
  burst(at, radius, dmg) {
    const run = this.run, color = this.color;
    run.fx.ring(run.player.position.clone().setY(run.player.position.y + 0.004), color, radius, 0.4);
    run.fx.puff(at, color, radius / 1.6, 0.3);   // puff expands to 1.6×: stop at the actual blast radius
    run.fx.burst(at, [color, '#ffffff'], 12, 0.003, 0.25, run.player.position.y);
    run.player.avatar?.pulse(1);
    juice.feel('impact');
    sfx.shieldBreak();
    for (const e of run.gadgets.near(at, radius)) {
      const hit = run.enemies.center(e);
      run.fx.impact(hit, color, 0.02, 8);
      bus.emit('damage_taken', { targetId: e.id, amount: dmg, color, source: 'shield-burst' });
      bus.emit('knockback', { targetId: e.id, dir: hit.clone().sub(at).setY(0).normalize(), force: knockFor(dmg) });
    }
  }
}
