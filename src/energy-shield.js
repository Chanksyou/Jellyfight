// A rechargeable damage pool and its shell. Burst damage is flat, not bubble power.
import * as THREE from 'three';
import { bus } from './events.js';
import { LOOK } from './look.js';
import { knockFor } from './stats.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { VolumeMaterial } from './vfx.js';

export class EnergyShield {
  constructor(run) {
    this.run = run;
    this.color = LOOK.color('energy-shield', '#85eaff');
    this.group = new THREE.Group();
    this.group.name = 'EnergyShield';
    const material = new VolumeMaterial(this.color, 'sphere');
    material.progress = 1;
    material.uniforms.uHex.value = LOOK.num('energy-shield-hex', 65);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    this.group.add(this.shell);
    run.player.mesh.add(this.group);
    this.reset();
  }

  reset() {
    this.config = null;
    this.hp = this.cooldown = this.flash = 0;
    this.group.visible = false;
  }

  sync() {
    const config = this.run.mods.energyShield;
    if (!config) { this.reset(); return null; }
    if (!this.config) this.hp = config.capacity;
    this.config = config;
    this.hp = Math.min(this.hp, config.capacity);
    return config;
  }

  update(dt) {
    const config = this.sync();
    if (!config) return;
    this.flash = Math.max(0, this.flash - dt);
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.cooldown <= 1e-8) {
        this.cooldown = 0;
        this.hp = config.capacity;
        this.flash = 0.2;
        sfx.shieldReady();
      }
    }
    const h = this.run.cfg.height * (this.run.player.avatar?.root.scale.x || 1);
    this.group.position.y = h * 0.6 + 0.002;
    this.group.scale.set(h * 0.48, h * 0.6, h * 0.48);
    this.group.visible = this.hp > 0 && !['dead', 'won'].includes(this.run.phase);
    this.shell.material.opacity = LOOK.num('energy-shield-opacity', 0.45) * (0.4 + 0.6 * this.hp / config.capacity) + this.flash * 1.5;
  }

  absorb(amount, silent = false) {
    const config = this.sync();
    if (!config || this.hp <= 0 || amount <= 0) return amount;
    const blocked = Math.min(amount, this.hp);
    this.hp -= blocked;
    this.flash = 0.2;
    const run = this.run, at = run.player.position.clone().setY(run.player.position.y + run.cfg.height * 0.6);
    if (!silent) {
      run.fx.impact(at, this.color, 0.015, 6);
      run.fx.number(at, `-${+blocked.toFixed(1)} SHIELD`, this.color, 14);
      run.player.avatar?.pulse(0.3);
      sfx.shieldHit();
    }
    if (this.hp <= 1e-8) {
      this.hp = 0;
      this.cooldown = config.recharge;
      this.group.visible = false;
      run.fx.ring(run.player.position.clone().setY(run.player.position.y + 0.004), this.color, config.radius, 0.4);
      run.fx.puff(at, this.color, config.radius / 1.6, 0.3);   // puff expands to 1.6×: stop at the actual blast radius
      run.fx.burst(at, [this.color, '#ffffff'], 12, 0.003, 0.25, run.player.position.y);
      run.player.avatar?.pulse(1);
      juice.feel('impact');
      sfx.shieldBreak();
      for (const e of run.gadgets.near(at, config.radius)) {
        const hit = run.enemies.center(e);
        run.fx.impact(hit, this.color, 0.02, 8);
        bus.emit('damage_taken', { targetId: e.id, amount: config.dmg, color: this.color, source: 'energy-shield' });
        bus.emit('knockback', { targetId: e.id, dir: hit.clone().sub(at).setY(0).normalize(), force: knockFor(config.dmg) });
      }
    }
    return Math.max(0, amount - blocked);
  }
}
