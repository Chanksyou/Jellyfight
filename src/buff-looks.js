// Signs for the Treasures that change numbers and nothing else (J5 of the Treasure juice plan).
// Every sign is read from what the run is doing, never from a Treasure id:
//   a live stack-buff (run.buffs): a wisp round the bell in its stat's colour, the shots glow in it (bubbles.js `buffTint`,
//     the lash trace in combat.js), a quick bell pulse for a Fire rate buff
//   a `while "airborne"` that holds: pale wisps and wind lines off the bell
//   the Shield full with shield-full-damage: shield.js brightens the rim and puffs when the first chip lands
//   a kill that heals (heal-on-kill): one green glow flies from the bug to the bell
//   `enemy_sliced` (execute): a slash across the bug and two halves sliding apart
//   `bonus_damage` (fresh-damage, elite-damage): a heavier flash and a thud
//   a hit-less cut (hit-less): a silver fleck and a tink
// Phone budget: no meshes, no lights, no material; glow points (one draw) and the gadget kit's pooled pieces. Low graphics
// drops the wisps and wind; Reduce effects keeps the shot tint and drops the pulses, drift and wind.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { bus } from './events.js';
import { sfx } from './sfx.js';

const FLIES = 6;   // Baby Bottle: sips in the air at once
const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const color = (key, fallback) => new THREE.Color(LOOK.color(key, fallback));

export class BuffLooks {
  constructor(run) {
    this.run = run;
    this.signs = [];          // the stats (and 'air') whose sign is on right now, for the stories
    this.tint = null;         // the Color the shots and the lash glow in while a buff is on
    this.cols = { air: color('buff-air', '#dff6ff'), fireRate: color('buff-fireRate', '#ffe2a8'), moveSpeed: color('buff-moveSpeed', '#b9ffd6'), other: color('buff-other', '#d8f3ff') };
    this.heal = color('buff-heal', '#b8ffc8');
    this.silver = color('buff-silver', '#e4f0ff');
    this.half = color('buff-slice-half', '#e8d9c0');
    this.flies = Array.from({ length: FLIES }, () => ({ t: -1, from: new THREE.Vector3() }));
    this.wispT = this.windT = this.pulseT = 0;
    bus.on('enemy_sliced', ({ pos, r }) => this.slice(pos, r));
    bus.on('bonus_damage', ({ pos, r }) => this.bonus(pos, r));
  }

  get quiet() { return this.run.gadgets.looks.quiet; }
  get low() { return this.run.fx.low(); }

  update(dt) {
    const run = this.run, P = run.player, signs = this.signs;
    signs.length = 0;
    const live = run.phase === 'explore' || run.phase === 'boss';
    if (live) {
      for (const b of run.mods.buffs) if (run.buffs[b.key]?.n && !signs.includes(b.stat)) signs.push(b.stat);
      if (!P.grounded && !P.climbing && run.mods.whiles.some((c) => c.when === 'airborne')) signs.push('air');
    }
    this.tint = signs.length ? this.cols[signs[0]] || this.cols.other : null;
    run.bubbles.buffTint = run.lash.buffTint = this.tint;
    const quiet = this.quiet, size = run.cfg.height;
    if (signs.length && !this.low) {
      if ((this.wispT -= dt) <= 0) {
        this.wispT = LOOK.num('buff-wisp-gap', 0.16);
        for (const s of signs) {
          const a = Math.random() * Math.PI * 2, r = run.cfg.radius * 0.8;
          _p.set(P.position.x + Math.cos(a) * r, P.position.y + size * (0.55 + Math.random() * 0.4), P.position.z + Math.sin(a) * r);
          _v.set(0, quiet ? 0 : size * 0.5, 0);
          run.fx.glow.emit(_p, this.cols[s] || this.cols.other, size * 0.4, size * 0.12, 0.6, 0.9, _v);
        }
      }
      if (!quiet && signs.includes('air') && (this.windT -= dt) <= 0) {
        this.windT = LOOK.num('buff-wind-gap', 0.09);
        _p.set(P.position.x, P.position.y + size * 0.6, P.position.z);
        run.fx.wind.streaks(_p, _v.set(0, P.velocity.y > 0 ? -1 : 1, 0), 1, 0.5, size * 0.8);
      }
    }
    if (!quiet && signs.includes('fireRate') && (this.pulseT -= dt) <= 0) { this.pulseT = LOOK.num('buff-pulse-gap', 0.45); P.avatar?.pulse(0.12); }
    for (const f of this.flies) {
      if (f.t < 0) continue;
      f.t += dt;
      const u = f.t / LOOK.num('buff-sip-time', 0.25);
      if (u >= 1) { f.t = -1; continue; }
      _p.set(P.position.x, P.position.y + size * 0.6, P.position.z).sub(f.from).multiplyScalar(u).add(f.from);
      run.fx.glow.hold(_p, this.heal, size * 0.16, 0.9);
    }
  }

  // Baby Bottle: a kill that really healed. `at` is where the bug fell.
  sip(at) {
    const f = this.flies.find((x) => x.t < 0);
    if (f) { f.t = 0; f.from.copy(at); }
  }

  // Pizza Cutter: a bright slash across the bug, and two halves sliding apart
  slice(pos, r) {
    const L = this.run.gadgets.looks, fx = this.run.fx;
    _a.set(pos.x - r * 1.6, pos.y + r, pos.z); _b.set(pos.x + r * 1.6, pos.y - r, pos.z);
    L.streak(_a, _b, L.mist, LOOK.num('buff-slash-width', 0.002), 0.1);
    const slide = this.quiet ? 0 : r * 3;
    for (const k of [-1, 1]) fx.glow.emit(_p.set(pos.x, pos.y + k * r * 0.4, pos.z), this.half, r * 2.2, r * 1.4, 0.35, 0.8, _v.set(k * slide, k * slide * 0.3, 0));
  }

  // Rolling Pin / Can Opener: a flat, heavy flash where the extra damage landed
  bonus(pos, r) {
    this.run.gadgets.looks.contact(pos, this.cols.fireRate, Math.max(0.014, r * 0.9));
    sfx.bonusThud();
  }

  // Thimble: it soaked part of a hit
  tink() {
    const P = this.run.player.position;
    this.run.gadgets.looks.studs(_p.set(P.x, P.y + this.run.cfg.height * 0.7, P.z), this.silver, 3);
    sfx.thimbleTink();
  }
}
