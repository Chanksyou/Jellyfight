// Bubbles: the jelly's main attack. It blows a steady stream of small bubbles at the nearest
// enemy (blows per second = fire rate). With more than one bubble, each blow is that many
// bubbles side by side, leaving at the same moment and flying parallel (every bubble a little
// weaker: stats.js bubbleShare). Bubbles drift toward their target (steering a
// little, so they mostly land), pop on the first enemy they touch for damage plus a small
// splash, and pop harmlessly on walls or when they run out of range. Treasures hook in here.
//
// Element treasures are attacks of their own (elementVolley): each element you own fires its own
// projectile on its own timer, at the nearest enemy, separate from the bubbles:
//   fire (Birthday Candle)   a fireball: sets enemies burning; burning enemies that die set their
//                            neighbors alight. Fire on a frozen enemy shatters it: 3x (a
//                            status-damage every run has: words.js SHATTER, enemies.js).
//   lightning (AA Battery)   ball lightning: each pop chains a bolt to 3 more enemies, stunning them.
//   ice (Freezer Pack)       an ice shard: chills and slows; repeated hits refresh the slow.
//   acid (Nail Polish)       an acid glob: leaves a bubbling puddle that eats at enemies and softens
//                            them (they take 30% more damage while in it).
//   wind (Paper Fan)         a fast crescent wind blade that hits across its whole width, pierces
//                            once more and blasts what it hits away.
//   glitter (Glitter)        a glitter bomb: a splash over twice as wide and much harder.
//   poison (the Poison jelly type's attack only, in place of acid): a blob that hits the first bug,
//                            then bursts in a sphere that does no damage but adds a Poison stack to
//                            every bug in it (poisoned: stacks, each a share of Attack damage a second).
// Each element's numbers (rate, damage, burn, chain…) come from mods.element (ELEMENT_BASE in
// words.js, raised by its upgrade treasures), and scale with your stats: Attack damage, Fire rate,
// Range, Attack size and extra Attacks all apply to them as they do to bubbles.
// Effect damage scales with "power" (attack damage x 4.5); ELEMENT says each element's share of it.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { LOOK } from './look.js';
import { juice } from './juice.js';
import { bus } from './events.js';
import { batcher } from './batch.js';
import { FRIENDLY } from './vfx.js';
import { bubbleShare, BASE_STATS, knockFor } from './stats.js';
import { elementParams } from './words.js';
import { BubbleLooks, WIND_ARC, AcidMaterial } from './bubble-looks.js';

const SPEED = 0.57;          // m/s: faster than you swim (0.42), slow enough to see them in the air
const RADIUS = 0.0065;       // m, at attack size 1
const SPLASH = 0.026;        // m, splash radius at attack size 1

export const ELEMENTS = [
  { id: 'fire', color: 0xff8a3a, text: '#ffa65a' },
  { id: 'lightning', color: 0xfff06a, text: '#fff27a' },
  { id: 'ice', color: 0x9fe8ff, text: '#bff4ff' },
  { id: 'acid', color: 0x8aff5a, text: '#a8ff7a' },
  { id: 'wind', color: 0xeef2ff, text: '#ffffff' },
  { id: 'glitter', color: 0xff9ae8, text: '#ffb0f0' },
  { id: 'poison', color: 0x4ff0a0, text: '#9dffc8' },   // a cool friendly green, never the Clog's violet acid
];
const EL = Object.fromEntries(ELEMENTS.map((e) => [e.id, { ...e, glow: new THREE.Color(e.color) }]));
const GOLD = new THREE.Color(0xffd86a);
const _down = new THREE.Vector3(0, -1, 0);
const _zero = new THREE.Vector3();
const _up = new THREE.Vector3(0, 0.1, 0);      // Poison Rain: blobs start this far above their bug
const _yAxis = new THREE.Vector3(0, 1, 0), _upDir = _yAxis;
const V3 = new THREE.Vector3();   // scratch: where a pop's splat lands
const SCORCH = LOOK.color('lightning-scorch', '#2a2620');   // the mark lightning leaves on the floor
const STRIKE = LOOK.color('lightning-strike', '#fff27a');   // the ring where a charged strike lands
// share of power each element deals (see the top of the file)
export const ELEMENT = {
  burn: 0.17,       // fire: damage a second while burning (3 s)
  bolt: 0.09,       // lightning: each arc
  puddle: 0.012,    // acid: each tick of the puddle (every 0.5 s, halved)
  glitter: 0.4 / 4.5,    // glitter: the wide splash
  poison: 0.2 / 4.5,     // poison: each stack, a second (20% of Attack damage)
};

// where in an element's timer its energy starts gathering at the bell (the last fifth)
const GATHER = 0.8;
// your starting Fire rate: element attacks fire faster as yours goes up
const BASE_FIRE_RATE = BASE_STATS.fireRate;

export class Bubbles {
  constructor(scene, enemies, fx, world) {
    Object.assign(this, { scene, enemies, fx, world });
    enemies.statuses.burning = (e) => { const f = this.burning.get(e); return f?.t > 0 ? f.n : 0; };   // its Burn stacks (status-damage & co.: words.js STATUSES)
    enemies.statuses.poisoned = (e) => { const f = this.poisoned.get(e); return f?.t > 0 ? f.n : 0; };  // its Poison stacks
    this.list = [];
    this.pool = [];
    this.statePool = [];
    this._dir = new THREE.Vector3();   // scratch for fly(): no garbage per bubble per frame
    this.grace = 0.03;                 // run.js: the jelly's radius
    this._c = new THREE.Vector3();
    this._ic = new THREE.Vector3();    // scratch for inRange(): its own, since callers pass it centers held in _c
    this._t = new THREE.Vector3();     // scratch for touches()
    this.timer = 0;
    this.elTimers = {};               // each element attack's own firing timer
    this.volleys = 0;
    this.bolts = 0;                   // lightning shots fired (nth-attack bolt counts them)
    this.charge = null;               // a charged-shot ready to spend (run.js sets it): { chain, strike, dmg }
    this.onCharged = null;            // called with it when the next lightning shot spends it
    this.hit = 1;                      // a jelly type's hit= (update): its attack's damage share
    this.geo = new THREE.SphereGeometry(1, 20, 14);
    const film = (tint, glow) => new THREE.MeshPhysicalMaterial({
      color: tint, transparent: true, opacity: 0.6, roughness: 0.02, metalness: 0, clearcoat: 1,
      iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [150, 600],
      emissive: glow, emissiveIntensity: 0.6, depthWrite: false,
    });
    this.mat = film(0xcfeeff, 0x4aa8ff);
    this.looks = new BubbleLooks(scene, fx);   // the element projectiles
    this.clock = 0;
    this.burning = new Map();          // enemy -> seconds of fire left
    this.frostbitten = new Map();      // enemy -> { dps, t }: Chill that hurts (element-up ice frostbite)
    this.poisoned = new Map();         // enemy -> its Poison: { t, n stacks, dps a stack, ep }
    this.dotT = 0;                     // the 0.5 s beat percent-dot and spread-on-touch go on
    this.puddles = [];
    this.puddlePool = [];
    this.acidMat = new AcidMaterial();   // each puddle a copy (its own uniforms, the same program: no shader to build in a fight)
    this.puddleGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    this.shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.goldMat = film(0xffe8a0, 0xffb020);
    this.onBlow = null;       // () => void, e.g. the bell's squeeze
    this.windCharge = null;
    this.friendly = FRIENDLY();
  }

  reset() {
    this.silenceAttacks();
    this.list.forEach((b) => this.release(b, true));
    this.list = [];
    this.burning.clear();
    this.frostbitten.clear();
    this.poisoned.clear();
    this.looks.clearBolts();
    this.puddles.forEach((p) => { this.scene.remove(p.m); this.puddlePool.push(p.m); });
    this.puddles = [];
    this.timer = 0;
    this.elTimers = {};
    this.volleys = 0;
    this.bolts = 0;
    this.charge = null;
  }

  cancelWind() {
    if (!this.windCharge) return;
    this.windCharge.stop?.(); this.windCharge = null; this.elTimers.wind = 1;
  }

  silenceAttacks() {
    this.cancelWind();
    sfx.stopFire();
    for (const b of this.list) { b.stopFireAudio?.(true); b.stopFireAudio = null; }
  }

  release(b, immediate = false) {
    b.stopFireAudio?.(immediate); b.stopFireAudio = null;
    if (b.m.userData.look) this.looks.release(b.m);
    else { b.m.visible = false; this.pool.push(b.m); }
    b.target = null; b.hit.clear(); b.elems.clear();
    if (this.statePool.length < 256) this.statePool.push(b);
  }

  mesh(mat) {
    let m = this.pool.pop();
    if (!m) {
      m = new THREE.Mesh(this.geo, mat);
      const glint = new THREE.Mesh(this.geo, this.shine);     // the white highlight that says "bubble"
      glint.scale.setScalar(0.22);
      glint.position.set(-0.4, 0.45, 0.4);
      m.add(glint);
      batcher.track(m);                // drawn instanced, glint and all (batch.js)
    }
    if (!m.parent) this.scene.add(m);
    m.material = mat;
    m.visible = true;
    return m;
  }

  inRange(origin, range, exclude) {
    const E = this.enemies, c = this._ic, es = [], ds = [];
    for (const e of E.list) {
      if (e.dead || exclude?.has(e) || e.proxy?.immune) continue;   // a boss that can't be hurt right now isn't worth a bubble
      const d = E.center(e, c).distanceTo(origin) - e.r;
      if (d <= range) { es.push(e); ds.push(d); }
    }
    // nearest first, but an armoured bug (a curled millipede: hits do 75% less) only once nothing
    // unarmoured is in range — same rule as the tentacles (combat.js inReach)
    return es.map((e, i) => i).sort((a, b) => (es[a].armor ? 1 : 0) - (es[b].armor ? 1 : 0) || ds[a] - ds[b]).map((i) => es[i]);
  }

  // origin: where bubbles leave the bell. mods: the combined effects of your treasures (words.js)
  // paused: a polyp (rebirth) doesn't shoot; what's already flying carries on
  // attack: a jelly type's one attack (jelly-types.js jellyAttack: { kind, hit }), or null for
  // today's run (bubbles and every Element owned). Bubbles blow only for kind 'bubble'; an Element
  // kind fires only that Element, as the main attack (mainParams); 'tentacle' fires nothing here.
  update(dt, origin, stats, mods, paused = false, attack = null) {
    this.origin = origin;              // where the polyps (adornments.js) circle
    const main = attack && EL[attack.kind] ? attack.kind : null;
    this.hit = attack?.hit ?? 1;
    const ids = attack ? (main ? [main] : []) : this.elements(mods);
    if (this.windCharge && !ids.includes('wind')) this.cancelWind();
    if (paused) { this.cancelWind(); this.fly(dt, stats, mods); this.effects(dt, stats, mods); return; }
    // one blow at a time: a faster fire rate = a faster stream
    if (!attack || attack.kind === 'bubble') this.timer += dt * stats.fireRate;
    if (this.timer >= 1) {
      if (this.volley(origin, stats, mods)) this.timer -= 1;
      else this.timer = 1;            // ready, waiting for something in range
      this.timer = Math.min(this.timer, 1);
    }
    // each element you own fires on its own timer, at its own rate (scaled by your Fire rate)
    for (const id of ids) {
      const P = main ? this.mainParams(id, mods) : mods.element[id];
      if (!P) continue;
      let t = (this.elTimers[id] ??= Math.random() * 0.5) + dt * P.rate * stats.fireRate / BASE_FIRE_RATE;
      if (id === 'wind') {
        if (!this.windCharge && t >= 1 && this.inRange(origin, stats.range * P.range).length) {
          const duration = Math.min(P.windup, 0.65 * BASE_FIRE_RATE / (P.rate * stats.fireRate));
          this.windCharge = { t: 0, duration, stop: sfx.windCharge(duration) };
          t -= 1;
        }
        if (this.windCharge) {
          const charge = this.windCharge;
          charge.t += dt;
          const progress = Math.min(1, charge.t / charge.duration);
          this.looks.windGather(origin, progress, stats.bubbleSize);
          this.onWindCharge?.(progress);
          if (progress >= 1) {
            charge.stop?.(); this.windCharge = null;
            if (this.elementVolley(id, P, origin, stats, mods)) {
              this.onWindRelease?.(); sfx.windLaunch(); juice.feel('hit');
              this.looks.windRelease(origin, stats.bubbleSize, this.list[this.list.length - 1]?.vel);
            } else t = 1;
          }
        }
      } else {
        // anticipation: energy gathers at the bell over the last fifth of its timer, while it has
        // something to shoot at (no added delay: the shot leaves when the timer would fire it anyway)
        if (t >= GATHER && this.inRange(origin, stats.range * P.range).length) this.looks.gather(id, origin, Math.min(1, (t - GATHER) / (1 - GATHER)), stats.bubbleSize);
        if (t >= 1) t = this.elementVolley(id, P, origin, stats, mods) ? t - 1 : 1;
      }
      this.elTimers[id] = Math.min(t, 1);
    }
    this.fly(dt, stats, mods);
    this.effects(dt, stats, mods);
  }

  // the elements you own, in the order of ELEMENTS
  elements(mods) { return ELEMENTS.filter((e) => mods.elements.has(e.id)).map((e) => e.id); }

  // An Element as a jelly type's main attack: its numbers (with any upgrades), but fired at your
  // full Fire rate (rate = BASE_FIRE_RATE, so the timer runs at stats.fireRate) and hitting for
  // the type's hit= share of Attack damage in place of its own dmg. Kept until the mods change.
  mainParams(id, mods) {
    const M = this._main;
    if (M?.id === id && M.mods === mods && M.hit === this.hit) return M.P;
    const P = { ...(mods.element[id] || elementParams(id)), rate: BASE_FIRE_RATE, dmg: this.hit };
    this._main = { id, mods, hit: this.hit, P };
    return P;
  }

  volley(origin, stats, mods) {
    const near = this.inRange(origin, stats.range);
    if (!near.length) return false;
    const target = near[0];
    this.volleys++;
    const n = this.volleys;
    const B = mods.bubbles;
    const golden = B.golden && n % B.golden.every === 0 ? B.golden.mult : 0;   // golden: its damage multiplier
    const size = stats.bubbleSize, elems = [], tint = null;   // bubbles are plain: elements fire their own shots
    // `bubbles` of them side by side, across the line to the target, all leaving now
    const count = Math.max(1, Math.round(stats.bubbles)), dmg = stats.bubbleDamage * bubbleShare(count) * this.hit;   // hit: a jelly type's (Normal's 1)
    const spread = (Math.random() - 0.5) * 0.12, gap = Math.max(0.014, RADIUS * size * 2.6);
    const dir = this.enemies.center(target).sub(origin).setY(0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    const across = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const pierce = B.pierce + Math.round(stats.pierce || 0);
    const big = this.nth(mods, n);   // nth-attack: this blow is a big one instead
    for (let k = 0; k < count; k++) {
      const off = across.clone().multiplyScalar((k - (count - 1) / 2) * gap);
      this.blow(origin.clone().add(off), target, big ? { size: size * big.size, dmg: dmg * big.dmg, golden, elems, tint, pierce: pierce + big.pierce, speed: big.speed, spread, off, big: true }
        : { size, dmg, golden, elems, tint, pierce, spread, off });
    }
    // polyps (Man o' War): each blows one of the same at the enemy nearest it
    this.forPolyps(mods, origin, stats.range, (from, t, k) => this.blow(from, t, { size: size * 0.75, dmg: dmg * k, golden, elems, tint, pierce }));
    // Reed Stick: every 6th bubble is a giant, slow one
    const G = B.giant;
    if (G && n % G.every === 0) this.blow(origin, target, { size: size * G.size, dmg: stats.bubbleDamage * G.dmg, golden, elems, tint, pierce: 1, speed: G.speed, big: true });
    this.onBlow?.();
    return true;
  }

  // nth-attack (words.js): what the n-th attack becomes, the words of `kind` (big, a bubble's; bolt, a
  // lightning shot's) of every nth-attack it falls on multiplied together; null for an ordinary one
  nth(mods, n, kind = 'big') {
    let out = null;
    for (const N of mods.nth) {
      if (N.random ? Math.random() >= 1 / N.every : n % N.every !== 0) continue;
      for (const ef of N.effects) {
        if (ef.kind !== kind) continue;   // sweep is a lash's
        out ||= { dmg: 1, size: 1, speed: 1, pierce: 0, reach: 1 };
        out.dmg *= ef.dmg; out.size *= ef.size; out.speed *= ef.speed ?? 1; out.pierce += ef.pierce ?? 0; out.reach *= ef.reach ?? 1;
      }
    }
    return out;
  }

  // One shot of an element attack: `count` of its projectiles side by side (your extra Attacks
  // plus its own), at the nearest enemy in its range
  elementVolley(id, P, origin, stats, mods) {
    const near = this.inRange(origin, stats.range * P.range);
    if (!near.length) return false;
    const target = near[0];
    const n = Math.max(1, Math.round(stats.bubbles)), count = n + Math.round(P.count), each = stats.bubbleDamage * bubbleShare(n);
    const dir = this.enemies.center(target).sub(origin).setY(0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    const across = new THREE.Vector3(-dir.z, 0, dir.x).normalize(), gap = Math.max(0.016, RADIUS * stats.bubbleSize * 3);
    const spread = (Math.random() - 0.5) * 0.12;
    // a lightning shot can be a big bolt (nth-attack) and can spend a charge (charged-shot): it arcs
    // harder, farther or to more bugs, or strikes everything round where it lands
    let ep = P, size = stats.bubbleSize, big = null, strike = null;
    if (id === 'lightning') {
      big = this.nth(mods, ++this.bolts, 'bolt');
      const C = this.charge;
      if (big || C) {
        ep = { ...P, bolt: P.bolt * (big?.dmg ?? 1), chainRange: P.chainRange * (big?.reach ?? 1), chain: P.chain + (C?.chain ?? 0) };
        size *= big?.size ?? 1;
      }
      if (C) { if (C.strike) strike = { strike: C.strike, dmg: C.dmg }; this.charge = null; this.onCharged?.(C); }   // (a copy: run.js reuses C)
    }
    for (let k = 0; k < count; k++) {
      const off = across.clone().multiplyScalar((k - (count - 1) / 2) * gap);
      this.blow(origin.clone().add(off), target, { size, dmg: each * P.dmg, pw: each * 4.5, elems: [id], tint: id, ep, pierce: 1 + P.pierce, speed: P.speed, range: stats.range * P.range, spread, off, big: !!big, strike });
    }
    this.forPolyps(mods, origin, stats.range * P.range, (from, t, k) => this.blow(from, t, { size: stats.bubbleSize * 0.75, dmg: each * P.dmg * k, pw: each * 4.5 * k, elems: [id], tint: id, ep: P, pierce: 1 + P.pierce, speed: P.speed, range: stats.range * P.range }));
    // release, on the frame the shots leave: the bell squeezes and a flash and launch sound in the
    // element's look (fire's own launch is per fireball, in blow; wind has its own windup and release)
    if (id !== 'wind') {
      this.onElementRelease?.(id);
      if (id !== 'fire') { this.looks.launch(id, origin, stats.bubbleSize); sfx.elementLaunch(id); }
    }
    return true;
  }

  // Where polyp i of n circles (polyps word): around the bell, a little above it
  polypPos(i, n, origin, out = new THREE.Vector3()) {
    const a = this.clock * 1.8 + (i / n) * Math.PI * 2;
    return out.set(origin.x + Math.cos(a) * 0.055, origin.y + 0.012 + Math.sin(this.clock * 3 + i) * 0.004, origin.z + Math.sin(a) * 0.055);
  }
  // each polyp, with the enemy nearest it in `range` and its share of the damage
  forPolyps(mods, origin, range, shoot) {
    const Pl = mods.polyps;
    if (!Pl) return;
    for (let i = 0; i < Pl.count; i++) {
      const from = this.polypPos(i, Pl.count, origin), t = this.inRange(from, range)[0];
      if (t) shoot(from, t, Pl.dmg);
    }
  }

  // bubble-ring: `count` bubbles at once, evenly around you, flying straight out
  ring(origin, count, dmg, stats, mods) {
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      const a = a0 + (k / count) * Math.PI * 2;
      const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
      this.blow(origin, null, { size: stats.bubbleSize, dmg, pierce: mods.bubbles.pierce, dir });
      this.treasureLooks?.streak(origin,origin.clone().addScaledVector(dir,.035),this.treasureLooks.color,.0009,.16);
    }
    this.treasureLooks?.arc(origin,.035,this.treasureLooks.color,.22);sfx.gadgetBath();
    this.onBlow?.();
  }

  blow(origin, target, o) {
    const m = !o.golden && o.tint ? this.looks.get(o.tint) : this.mesh(o.golden ? this.goldMat : this.mat);
    m.position.copy(origin);
    const dir = o.dir ? o.dir.clone().normalize() : this.enemies.center(target).add(o.off || _zero).sub(origin).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const b = this.statePool.pop() || {};
    const hit = b.hit || new Set(), elems = b.elems || new Set();
    for (const key of Object.keys(b)) delete b[key];
    for (const el of o.elems || []) elems.add(el);
    Object.assign(b, {
      m, target, r: RADIUS * o.size, dmg: o.dmg, pw: o.pw ?? o.dmg * 4.5, golden: o.golden, ep: o.ep || null, range: o.range || 0,
      pierce: o.pierce, hit, splashed: false, travel: 0, t: 0, big: !!o.big, child: !!o.child, wobble: Math.random() * 6, strike: o.strike || null,
      elems, tint: o.tint, trailT: 0,
      off: o.off || null,               // its place beside the others in its blow: it aims that far to the side of the target
    });
    // a wind blade (bubble-looks.js) hits across its whole arc: this far to each side of its middle
    b.side = o.tint === 'wind' ? b.r * 1.3 * WIND_ARC : 0;
    b.speed = SPEED * (o.speed || 1);
    b.vel = dir.multiplyScalar(b.speed);
    b.homing = true;
    m.scale.setScalar(0.001);
    this.list.push(b);
    if(!o.tint&&(o.golden||o.big)){
      const L=this.treasureLooks;if(L)L.arc(origin,b.r*(o.big?1.4:1.1),o.golden?L.gold:L.silver,.2);
      sfx.gadgetBubble(o.big?'giant':'gold');
    }
    if (o.tint === 'fire') {
      b.fireWeight = Math.min(1.6, Math.sqrt(o.size) * (1 + Math.max(0, (o.ep?.burn ?? 1) - 1) * 0.2 + Math.min(3, o.ep?.count ?? 0) * 0.12));
      this.looks.fireLaunch(origin, b.r); b.stopFireAudio = sfx.fireLaunch(b.fireWeight);
    }
    return b;
  }

  fly(dt, stats, mods) {
    this.clock += dt;
    this.looks.frame();
    const E = this.enemies, c = this._c;
    const maxTravel = stats.range * 1.4;
    for (const b of this.list) {
      b.t += dt;
      if (b.rebound === undefined) b.rebound = !!mods.rebound && !b.tint;
      if (b.rebound && b.returning && this.origin) {
        const d = c.copy(this.origin).sub(b.m.position), distance = d.length();
        if (distance < b.r + b.speed * dt) { this.fx.puff(b.m.position, this.friendly, b.r, 0.15); b.done = true; continue; }
        b.vel.copy(d).setLength(b.speed);
      }
      // steer gently toward the target while it lives, until the bubble has hit it (a piercing
      // bubble then flies straight on instead of turning back to it). Once it reaches its aim point
      // or flies past it, it stops steering and carries straight on: an outside bubble aims to the
      // side of the target, and circling back to that point it used to slow to a stop and hang
      // there for good. Steering only turns it: it keeps its speed.
      if (b.homing && b.target && !b.target.dead && !b.hit.has(b.target)) {
        E.center(b.target, c);
        if (b.off) c.add(b.off);                                       // side by side: keep its lane
        const to = c.sub(b.m.position), d = to.length();
        if (d < b.r * 2 || to.dot(b.vel) <= 0) b.homing = false;
        else b.vel.lerp(to.multiplyScalar(b.speed / d), 1 - Math.exp(-3 * dt)).setLength(b.speed);
      }
      const step = b.vel.length() * dt;
      // walls only count once the bubble has left the jelly's own body: blown from the top of the
      // bell while you're pressed under or against something, it would otherwise pop at once
      if (b.travel > this.grace && (this.world.cast(b.m.position, this._dir.copy(b.vel).normalize(), step + b.r) || this.blocked(b.m.position, this._dir, step + b.r, b.r))) {
        if (b.rebound && !b.returning) this.turn(b);
        else this.pop(b, null, stats, mods);
        continue;
      }
      b.m.position.addScaledVector(b.vel, dt);
      b.m.position.y += Math.sin(b.t * 9 + b.wobble) * 0.004 * dt * 10;
      b.travel += step;
      if(b.child&&this.treasureLooks&&(b.echoTrailT=(b.echoTrailT??0)-dt)<=0){
        b.echoTrailT=LOOK.num('gadget-echo-trail-gap',.055);
        this.treasureLooks.arc(b.m.position,b.r*1.1,this.treasureLooks.disco,.12);
        if(!this.treasureLooks.quiet)this.treasureLooks.streak(b.m.position.clone().addScaledVector(b.vel,-.045),b.m.position,this.treasureLooks.disco,.0008,.14);
      }
      if (b.rebound && b.returning && (b.trailT -= dt) <= 0) {
        b.trailT = LOOK.num('rebound-trail-interval', 0.055);
        this.fx.ring(b.m.position, this.friendly, b.r * 1.4, 0.16);
      }
      if (b.m.userData.look) this.looks.update(b, dt, this.clock);   // an element projectile: its own look and particles
      else {
        // friendly fire glows cool (vfx.js): a soft halo in the bubble's colour, never an enemy's
        this.fx.glow.hold(b.m.position, b.golden ? GOLD : this.friendly, b.r * (b.big ? 6 : 5), b.golden ? 0.55 : 0.4);
        const grow = Math.min(1, b.t * 8);
        b.m.scale.set(b.r * grow * (1 + Math.sin(b.t * 14) * 0.06), b.r * grow * (1 - Math.sin(b.t * 14) * 0.06), b.r * grow);
      }
      if(!b.tint&&(b.big||b.golden)&&(b.signatureT=(b.signatureT??0)-dt)<=0){
        b.signatureT=LOOK.num('gadget-special-trail-gap',.1);
        const L=this.treasureLooks;if(L)L.arc(b.m.position,b.r*1.05,b.golden?L.gold:L.silver,.16);
      }
      // touching an enemy?
      for (const e of E.list) {
        if (b.rebound && b.hit.size >= b.pierce) break;
        if (e.dead || b.hit.has(e)) continue;
        if (this.touches(b, E.center(e, c), e.hitR || e.r)) {   // hitR: a millipede's ball
          b.hit.add(e);
          const chilled = b.ep?.chillPierce && e.chillT > 0;   // Icicle Lance: a shard flies through a bug that was already Chilled
          this.strike(b, e, mods);
          if (chilled) b.free = (b.free || 0) + 1;
          if (b.ep?.grow) b.r *= 1 + b.ep.grow;                // Snowball
          if (b.rebound) { this.pop(b, e, stats, mods, true); continue; }
          if (b.hit.size - (b.free || 0) >= b.pierce) { this.pop(b, e, stats, mods); break; }
          if (b.hit.size === 1) this.splash(b);   // a piercing bubble splashes where it first hits, then flies on
        }
      }
      const reach = b.range ? b.range * 1.4 : maxTravel;
      if (!b.done && b.rebound && !b.returning && b.travel > reach) this.turn(b);
      if (!b.done && (b.rebound ? b.t > reach / b.speed * 3 + 1 : b.travel > reach || b.t > reach / b.speed + 0.5)) this.pop(b, null, stats, mods);
    }
    this.looks.tickBolts(dt);
    this.looks.endFrame();
    const done = this.list.filter((b) => b.done);
    done.forEach((b) => this.release(b));
    if (done.length) this.list = this.list.filter((b) => !b.done);
  }

  turn(b) {
    b.returning = true; b.homing = false; b.hit.clear();
    b.vel.negate(); b.trailT = 0;
    this.fx.ring(b.m.position, this.friendly, b.r * 2, 0.2);
    sfx.rebound();
  }

  // Something that isn't the room's but stops bubbles all the same: a boss's body that can't be
  // hurt, whatever has a blocks(pos, dir, len, r)
  blocked(pos, dir, len, r) {
    for (const e of this.enemies.list) if (!e.dead && e.proxy?.blocks?.(pos, dir, len, r)) return true;
    return false;
  }

  // A plain bubble is a ball; a wind blade hits across b.side on either side of its middle.
  touches(b, c, er) {
    const p = b.m.position;
    if (!b.side) return c.distanceTo(p) < er + b.r;
    const d = this._t.copy(c).sub(p), v = b.vel, s = v.length();
    const along = (d.x * v.x + d.y * v.y + d.z * v.z) / s;
    const across = Math.sqrt(Math.max(0, d.lengthSq() - along * along));
    return Math.abs(along) < er + b.r && across < er + b.side;
  }

  // damage one enemy
  strike(b, e, mods) {
    if(!b.tint&&b.pierce>1){
      const L=this.treasureLooks,at=this.enemies.center(e);
      L?.streak(at.clone().addScaledVector(b.vel,-.025),at.clone().addScaledVector(b.vel,.025),L.silver,.001,.16,'needle');
      sfx.gadgetBubble('pierce');
    }
    const H = mods.hits.bubbles;
    let dmg = b.dmg * (b.golden || 1), color = b.golden ? '#ffd23a' : '#bfe8ff', crit = false;
    if (H.crit && Math.random() < H.crit.chance) {
      dmg *= H.crit.mult; color = '#e6fbff';
      crit = true;
      this.fx.crit(this.enemies.center(e), e.r); sfx.crit();
      if (H.pin) bus.emit('status_applied', { targetId: e.id, status: 'pin', duration: H.pin });   // pin-on-crit
    }
    if (H.mark) bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: H.mark, more: H.markMore });
    const el = b.elems, c = this.enemies.center(e), dir = b.vel.clone().setY(0).normalize();
    const slide = mods.slideOnHit.find((S) => this.enemies.statuses[S.status](e));   // Avalanche: a hit on a bug that has the status sends it sliding
    if (el.has('fire')) {
      const was = this.burning.get(e)?.t > 0;
      this.ignite(e, b.pw, b.ep);
      if (was && mods.refreshAll.includes('burning')) this.refreshBurns(e);   // refresh-all (Flare Up)
      if (!was) this.enemies.freshBurn = e;   // this hit lit it: status-damage doesn't count it as a hit on a Burning bug
      b.stopFireAudio?.();
      this.looks.fireHit(c, b.r, b.vel);
      sfx.fire(b.fireWeight);
    }
    if (el.has('ice') && !e.proxy) {
      this.fx.puff(c, 0xdff8ff, e.r * 1.6, 0.4);
      const t = b.ep?.chill ?? 2;
      if (e.slowT > 0) dmg *= b.ep?.slowedMul ?? 1;      // Freezer Burn rewards follow-up hits
      const was = e.chillT > 0;
      bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: t });
      if (b.ep?.frostbite) this.frostbitten.set(e, { dps: dmg * b.ep.frostbite, t: t + 0.01, tick: this.frostbitten.get(e)?.tick ?? 0.5 });   // Frostbite (a re-hit keeps the beat running)
      const F = mods.chillFreeze;                         // Permafrost: hits in a row on a Chilled bug freeze it
      if (F) {
        e.chillHits = (was ? e.chillHits || 0 : 0) + 1;
        if (e.chillHits >= F.hits) {
          e.chillHits = 0;
          bus.emit('status_applied', { targetId: e.id, status: 'freeze', duration: F.time });
          bus.emit('enemy_frozen', { targetId: e.id, pos: c.clone(), r: e.r });
        }
      }
    }
    if (el.has('wind') && !e.proxy) {
      sfx.wind();
      this.fx.ring(c.clone().setY(c.y - e.r), 0xffffff, e.r * 2.5, 0.25);
      // the gust buffets it: air streaming past, a little whirlwind round it, dust blown off its feet
      const W = this.fx.wind;
      W.streaks(c, dir, 5, 1.1, e.r * 3.5);
      W.swirl(c.clone().setY(c.y - e.r * 0.7), e.r * 1.6);
      if (!e.T.fly) W.debris(c.clone().setY(e.pos.y + 0.002), dir, 5, 0.3, e.pos.y);
    }
    if (b.tint && color === '#bfe8ff') color = EL[b.tint].text;
    // a shove in the direction the bubble was going: the harder the hit, the further
    if (!e.T.fly && !el.has('wind')) bus.emit('knockback', { targetId: e.id, dir, force: knockFor(dmg * this.enemies.statusMore(e, b.tint || 'bubble')) });   // status-damage lands harder, shoves further
    bus.emit('damage_taken', { targetId: e.id, amount: dmg, color, source: 'bubble', sound: el.has('fire') ? 'fireball' : undefined, feedback: { crit, element: b.tint, dir } });
    this.enemies.freshBurn = null;
    if (slide && !e.dead && !e.proxy) this.slide(e, dir, slide);
    if (el.has('wind') && !e.proxy && !e.dead) bus.emit('knockback', {
      targetId: e.id, dir, force: 0.07 * (b.ep?.push ?? 1) + (!e.T.fly ? knockFor(dmg) : 0),
      collisionDamage: dmg * (b.ep?.collision ?? 1),
    });
  }

  // slide-on-hit: the bug is shoved `distance` along the hit; whatever it slides into is Chilled
  slide(e, dir, S) {
    const E = this.enemies, from = e.pos.clone();
    E.push(e, dir, S.distance);
    const to = e.pos, seg = to.clone().sub(from).setY(0), len2 = seg.lengthSq();
    this.fx.ice.bloom(from, e.r * 3, 0.5);
    sfx.iceShatter(false);
    if (len2 < 1e-10) return;
    for (const n of E.list) {
      if (n === e || n.dead || n.proxy || Math.abs(n.pos.y - e.pos.y) > e.r + n.r) continue;
      const u = Math.max(0, Math.min(1, ((n.pos.x - from.x) * seg.x + (n.pos.z - from.z) * seg.z) / len2));
      if (Math.hypot(n.pos.x - (from.x + seg.x * u), n.pos.z - (from.z + seg.z * u)) > n.r + e.r) continue;
      bus.emit('status_applied', { targetId: n.id, status: 'chill', duration: S.chill });
      this.fx.puff(E.center(n), 0xdff8ff, n.r * 1.6, 0.4);
    }
  }

  // refresh-all: every Burn back to its full time, a flare on each one but the bug just hit
  refreshBurns(hit) {
    const c = this._t;
    for (const [e, f] of this.burning) {
      if (e.dead || f.t <= 0) continue;
      f.t = Math.max(f.t, f.ep?.burnTime ?? 3);
      if (e !== hit) this.looks.fireLaunch(this.enemies.center(e, c), e.r * 0.5);
    }
  }

  // Burning enemies, lightning arcs and acid puddles
  effects(dt, stats, mods) {
    const E = this.enemies, c = this._c;
    for (const [e, f] of this.frostbitten) {   // Frostbite: a Chilled bug takes a share of the hit that chilled it, every half second
      if (e.dead) { this.frostbitten.delete(e); continue; }
      if ((f.tick -= dt) <= 0) { f.tick = 0.5; bus.emit('damage_taken', { targetId: e.id, amount: f.dps * 0.5, color: '#bff4ff', source: 'ice', feedback: { tick: true } }); }
      if ((f.t -= dt) <= 0) this.frostbitten.delete(e);
    }
    for (const [e, f] of this.burning) {
      if (e.dead) {
        // burning things that die set their neighbors alight
        this.burning.delete(e);
        if (f.t > 0 && !e.fireDeathSilent) {
          this.looks.fireDeath(E.center(e, c), e.r);
          sfx.fireDeath();
        }
        if (!e.proxy) for (const n of this.inRange(E.center(e, c), f.ep?.spread ?? 0.06)) if (!this.burning.has(n)) { this.ignite(n, f.pw, f.ep); }
        continue;
      }
      f.t -= dt;
      f.age += dt;
      f.tick = (f.tick || 0) - dt;
      f.flame = (f.flame || 0) - dt;
      if (f.flame <= 0) {                 // licking flames
        f.flame = this.looks.fire.burnInterval;
        E.center(e, c);
        this.looks.fireBurn(c.add(this._t.set(0, e.r * 0.4, 0)), e.r);
      }
      if (f.tick <= 0) {
        // each stack burns; Burn damage (stat) and burn-ramp (how long it has burned) on top
        const R = mods?.burnRamp, ramp = R ? 1 + Math.min(R.most, R.step * f.age) : 1;
        f.tick = 0.5; sfx.fireBurn();
        bus.emit('damage_taken', { targetId: e.id, amount: f.dps * f.n * (stats?.burnDamage ?? 1) * ramp * 0.5, color: '#ffa65a', source: 'fire' });
      }
      if (f.t <= 0) this.burning.delete(e);
    }
    this.poisonTick(dt, mods);
    for (const p of this.puddles) {
      p.t -= dt;
      // it splats in (overshooting, then settling), then for its last 0.6 s shrinks, darkens and dries up
      const age = p.life - p.t, U = p.m.material.uniforms, spread = age < 0.25 ? Math.sin(Math.min(1, age / 0.18) * Math.PI / 2) * (1 + 0.15 * Math.sin(Math.min(1, age / 0.25) * Math.PI)) : 1;
      p.m.scale.setScalar(p.r * Math.max(0.05, spread));
      U.uTime.value += dt;
      U.uDry.value = Math.max(0, 1 - p.t / 0.6);
      U.uFade.value = Math.min(1, age * 8, p.t * 2.5);
      p.tick -= dt;
      this.looks.puddleLive(p.m.position, p.r * spread, dt, 1 - U.uDry.value * 0.8);   // blisters popping, fumes rising
      if (p.tick <= 0) {
        p.tick = 0.5;
        for (const e of E.list) {
          if (e.dead) continue;
          E.center(e, c);
          if (Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z) < p.r + e.r && Math.abs(c.y - e.r - p.m.position.y) < e.r + 0.03) {
            bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: 0.6, more: 0.3 });   // softened: +30% damage from everything
            bus.emit('damage_taken', { targetId: e.id, amount: p.dmg * 0.5, color: '#a8ff7a', source: 'acid' });
            this.looks.acidBite(this._t.copy(c).setY(c.y - e.r * 0.6), e.r); sfx.acidSizzle();
          }
        }
      }
      if (p.t <= 0) { this.scene.remove(p.m); this.puddlePool.push(p.m); }
    }
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }

  // Poisoned bugs: each stack ticks every 0.5 s; they bubble and drip green while it lasts. On the same
  // 0.5 s beat, percent-dot (Waste Away) and spread-on-touch (Contagion)
  poisonTick(dt, mods) {
    const E = this.enemies, c = this._c, every = this.looks.pz.every;
    for (const [e, f] of this.poisoned) {
      if (e.dead || (f.t -= dt) <= 0) { this.poisoned.delete(e); continue; }
      if ((f.tick -= dt) <= 0) {
        f.tick = 0.5; sfx.acidSizzle();
        bus.emit('damage_taken', { targetId: e.id, amount: f.dps * f.n * 0.5, color: '#9dffc8', source: 'poison' });
      }
      if ((f.drip -= dt) <= 0) { f.drip = every / Math.sqrt(f.n); E.center(e, c); this.looks.poisoned(c, e.r, e.T?.fly ? c.y - e.r * 4 : e.pos.y); }
    }
    if ((this.dotT -= dt) > 0) return;
    this.dotT = 0.5;
    for (const D of mods?.percentDots || []) for (const e of E.list) {
      if (e.dead || (e.proxy && e.boss && !D.boss) || !E.statuses[D.status](e)) continue;
      const max = e.proxy ? e.proxy.maxHp : e.maxHp;
      if (max > 0) bus.emit('damage_taken', { targetId: e.id, amount: max * D.share * 0.5, color: '#9dffc8', source: 'poison' });
    }
    if (mods?.spreadOnTouch.includes('poisoned')) {
      const fresh = [];
      for (const [e, f] of this.poisoned) {
        const at = E.center(e, this._t);
        for (const n of E.list) if (!n.dead && n !== e && !this.poisoned.has(n) && !fresh.includes(n) && E.center(n, c).distanceTo(at) < e.r + n.r + 0.004) fresh.push(n, f);
      }
      for (let i = 0; i < fresh.length; i += 2) { this.poison(fresh[i], fresh[i + 1].pw, fresh[i + 1].ep); this.looks.poisonBurst(E.center(fresh[i], c), fresh[i].r * 1.4); }
    }
  }

  // set an enemy burning: pw the power it was lit with, ep the fire attack's numbers. A re-hit
  // restarts the time and, up to ep.burnStacks, adds a stack (each burns as hard); age is how
  // long it has kept burning (burn-ramp), from when it was first lit
  ignite(e, pw, ep = null) {
    const had = this.burning.get(e), lit = had?.t > 0;
    const n = Math.min(Math.max(1, Math.round(ep?.burnStacks ?? 1)), lit ? had.n + 1 : 1);
    this.burning.set(e, { t: ep?.burnTime ?? 3, dps: pw * ELEMENT.burn * (ep?.burn ?? 1), pw, ep, tick: had?.tick ?? 0.25, flame: 0, n, age: lit ? had.age : 0 });
  }

  // a charged lightning shot lands: a ring out to `S.strike` and a bolt to every bug inside it
  // (except `skip`), `S.dmg` times the shot's damage each
  strikeAround(p, S, dmg, skip) {
    const E = this.enemies, c = this._c;
    this.fx.ring(V3.set(p.x, E.floorBelow(p, p.y - 0.03), p.z), STRIKE, S.strike, 0.35);
    juice.feel('hit-big'); sfx.lightningBig();
    let k = 0;
    for (const e of this.inRange(p, S.strike, skip)) {
      this.zap(p, E.center(e, c), k++);
      bus.emit('damage_taken', { targetId: e.id, amount: dmg * S.dmg, color: '#fff27a', source: 'lightning' });
    }
  }

  // a bolt jumping from one thing to the next (a chain's k-th jump: each one higher-pitched)
  zap(from, to, k = 0) {
    this.looks.strike(from, to);
    sfx.chainZap(k);
    this.fx.puff(to, 0xfff6a0, 0.012, 0.15);
  }

  // splash: a share of the damage to everything close by (Glitter: twice as wide, harder). Once a
  // bubble: where it pops, or where a piercing one first hits
  splash(b) {
    b.splashed = true;
    if (b.elems.has('poison')) { this.poisonBurst(b); return; }
    const p = b.m.position, glitter = b.elems.has('glitter');
    const splash = SPLASH * (b.r / RADIUS) * (glitter ? b.ep?.width ?? 2.2 : 1), E = this.enemies, c = this._c;
    let kills = 0;
    if (glitter) {
      // the bomb goes off: real glitter flakes thrown out to the splash's edge, fluttering down and
      // lying on the floor glinting, a bright pop at its heart and a second, wider ring of sparkle
      const floor = this.enemies.floorBelow(p, p.y - 0.03);
      this.fx.glitter.burst(p, Math.round(LOOK.num('glitter-burst-flakes', 46) * Math.min(2, splash / 0.05)), splash, floor);
      this.looks.glitterPop(p, splash);
      juice.feel('hit-big');
    }
    this.fx.ring(p.clone().setY(p.y - b.r), glitter ? 0xff9ae8 : b.tint ? EL[b.tint].color : 0xbfe8ff, splash, 0.3);
    for (const e of E.list) {
      if (e.dead || b.hit.has(e)) continue;
      if (E.center(e, c).distanceTo(p) >= splash + e.r) continue;
      if (glitter) this.looks.glittered(E.center(e, c), e.r);                                                               // sparkles stuck on everything it hits
      if (glitter && b.ep?.slow) bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: b.ep.slow });          // Glitter Glue
      if (b.ep?.frost && !e.proxy) bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: b.ep.chill });     // Snow Globe
      bus.emit('damage_taken', { targetId: e.id, amount: glitter ? b.pw * ELEMENT.glitter * (b.ep?.splash ?? 1) : b.dmg * (b.big ? 0.8 : 0.4), color: glitter ? '#ffb0f0' : '#bfe8ff', source: 'splash', feedback: { element: b.tint } });
      if (e.dead) kills++;
    }
    if (kills >= 3) bus.emit('big_splash', { pos: p, kills });   // stack-buff's big-splash
  }

  // the Poison blob bursts: a sphere round where it popped (flying bugs too) that does no damage but
  // gives every bug in it, the one it hit too, a Poison stack
  poisonBurst(b) {
    const p = b.m.position, E = this.enemies, c = this._c, r = SPLASH * (b.r / RADIUS) * (b.ep?.width ?? 1);
    this.poisonPw = b.pw;   // what a stack from Toxic Cloud or Burst Sac is worth: the blob's own (its share with more Attacks)
    this.looks.poisonBurst(p, r);
    for (const e of E.list) {
      if (e.dead || E.center(e, c).distanceTo(p) >= r + e.r) continue;
      this.poison(e, b.pw, b.ep);
    }
  }

  // give a bug `n` Poison stacks (up to ep.poisonStacks; each new one restarts the time). pw: the power it was
  // given with (Attack damage x 4.5), ep: the Poison attack's numbers
  poison(e, pw, ep = null, n = 1) {
    const had = this.poisoned.get(e), live = had?.t > 0, most = Math.max(1, Math.round(ep?.poisonStacks ?? 5));
    this.poisoned.set(e, { t: ep?.poisonTime ?? 5, n: Math.min(most, (live ? had.n : 0) + n), dps: pw * ELEMENT.poison * (ep?.poison ?? 1), pw, ep, tick: had?.tick ?? 0.25, drip: had?.drip ?? 0 });
  }

  // Poison Rain (the blob word): `count` of your Poison blobs fall from above on as many bugs within `range` of you
  rain(origin, count, range, stats, mods) {
    const P = this.mainParams('poison', mods), n = Math.max(1, Math.round(stats.bubbles)), each = stats.bubbleDamage * bubbleShare(n);
    const bugs = this.inRange(origin, range).slice(0, count);
    for (const e of bugs) {
      // from 10 cm above it, or under the furniture over it (a blob starting inside it would pop on it unburst)
      const c = this.enemies.center(e), hit = this.world.cast(c, _upDir, _up.y), r = RADIUS * stats.bubbleSize;
      const at = c.clone().setY(c.y + (hit ? Math.max(r * 2, hit.distance - r * 2) : _up.y));
      this.blow(at, e, { size: stats.bubbleSize, dmg: each * P.dmg, pw: each * 4.5, elems: ['poison'], tint: 'poison', ep: P, pierce: 1, speed: P.speed, range: 0.3 });
    }
    if (bugs.length) { this.looks.launch('poison', origin, stats.bubbleSize); sfx.elementLaunch('poison'); this.onElementRelease?.('poison'); }
    return bugs.length;
  }

  // split-on-hit: a shot that hit splits into smaller ones fanned out ahead, missing the bug it hit
  split(b, S) {
    const dir = this._dir.copy(b.vel).normalize(), rad = S.angle * Math.PI / 180;
    for (let k = 0; k < S.count; k++) {
      const a = S.count > 1 ? (k / (S.count - 1) - 0.5) * rad : 0;
      const half = this.blow(b.m.position, null, { size: b.r / RADIUS * 0.75, dmg: b.dmg * S.dmg, pw: b.pw, golden: b.golden, elems: [...b.elems], tint: b.tint, ep: b.ep, pierce: 1, speed: b.speed / SPEED, range: b.range, dir: dir.clone().applyAxisAngle(_yAxis, a) });
      half.split = true; half.homing = false;
      for (const e of b.hit) half.hit.add(e);
      half.pierce += b.hit.size;
    }
  }

  pop(b, hitEnemy, stats, mods, keep = false) {
    if (b.done) return;
    b.done = !keep;
    const p = b.m.position;
    const fire = b.tint === 'fire';
    if (!fire) this.fx.puff(p, b.golden ? 0xffe8a0 : 0xdff4ff, b.r * 2.2, 0.25);
    if (!hitEnemy) return;
    if (!fire) {
      this.fx.impact(p, b.golden ? GOLD : b.tint ? EL[b.tint].glow : this.friendly, b.r * (b.big ? 2.6 : 1.8), b.big ? 12 : 6);   // a cool flash and sparks
      // pop: a splash of droplets, a plip, a tiny kick
      this.fx.burst(p, b.tint ? ['#ffffff', '#' + EL[b.tint].color.toString(16).padStart(6, '0')] : ['#dff4ff', '#9fd8ff', '#ffffff'], b.big ? 10 : 4, b.r * 0.35, 0.25, p.y - 0.03);
      if (b.tint && b.tint !== 'wind') {   // each element lands its own way (ice: its shards skip off the floor under it)
        const floor = b.tint === 'ice' || b.tint === 'acid' || b.tint === 'poison' ? this.world.castAll(p.clone(), _down, 0.5)?.point.y ?? p.y - 0.05 : undefined;
        this.looks.contact(b.tint, p, b.r, floor); sfx.elementHit(b.tint);
      }
      else if (!b.elems.has('wind')) sfx.pop(b.big);
      // the wet mark it leaves on the floor, fading (only a plain bubble's: an Element's colour
      // on the floor would look like an acid puddle)
      if (!b.tint) this.fx.splat(V3.set(p.x, this.enemies.floorBelow(p, p.y - 0.03), p.z), b.golden ? 0xffe8a0 : null, b.r * (b.big ? 2.2 : 1.6));
    }
    juice.feel(b.big ? 'hit-big' : 'hit');
    const el = b.elems;
    if (!b.splashed) this.splash(b);
    const E = this.enemies, c = this._c;
    // Lightning: a bolt chains to 3 more enemies, stunning each
    if (b.elems.has('lightning')) {
      const ep = b.ep, range = ep?.chainRange ?? 0.16, skip = new Set(b.hit), hit = new Set(b.hit);
      let from = p.clone(), last = null, jumps = 0;
      this.fx.splat(V3.set(p.x, this.enemies.floorBelow(p, p.y - 0.03), p.z), SCORCH, b.r * 2.2, 'scorch');   // a scorch where it struck (harmless, fades)
      for (let k = 0, n = ep?.chain ?? 3; k < n; k++) {
        if (ep?.revisit && last) { skip.clear(); skip.add(last); }   // revisit: back to a bug already hit, just not the one it's on
        const near = this.inRange(from, range, ep?.revisit ? skip : hit);
        const e = (ep?.stunFirst && near.find((x) => x.stunT > 0)) || near[0];
        if (!e) break;
        hit.add(e); last = e; jumps++;
        const to = E.center(e, c).clone();
        this.zap(from, to, k);
        bus.emit('damage_taken', { targetId: e.id, amount: b.pw * ELEMENT.bolt * (ep?.bolt ?? 1) * (e.proxy ? ep?.eliteBolt ?? 1 : 1), color: '#fff27a', source: 'lightning' });
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: ep?.stun ?? 0.5 });
        from = to;
      }
      if (jumps >= 2) { juice.feel('hit-big'); sfx.lightningBig(); }      // a chain that really jumps lands harder
      // a charged shot (charged-shot): everything within its strike range is struck too
      if (b.strike) this.strikeAround(p, b.strike, b.dmg, b.hit);
    }
    // Acid: leave a puddle that eats at anything standing in it
    if (b.elems.has('acid') && this.puddles.length < (b.ep?.puddles ?? 6)) {
      const h = this.world.castAll(p.clone(), new THREE.Vector3(0, -1, 0), 0.4);
      const m = this.puddlePool.pop() || new THREE.Mesh(this.puddleGeo, this.acidMat.clone());   // pooled: a puddle's mesh and uniforms are reused
      m.material.uniforms.uTime.value = 0;
      m.material.uniforms.uSeed.value = Math.random() * 100;
      m.position.copy(h ? h.point : p).setY((h ? h.point.y : p.y) + 0.0015);
      m.rotation.y = Math.random() * 6.3;
      m.renderOrder = 2;
      this.scene.add(m);
      const life = b.ep?.puddleTime ?? 3.5, r = 0.05 * (b.r / RADIUS) * (b.ep?.puddleSize ?? 1);
      this.puddles.push(Object.assign(m.userData.puddleState ||= {}, { m, t: life, life, r, dmg: b.pw * ELEMENT.puddle * (b.ep?.puddleDmg ?? 1), tick: 0.25 }));
      this.looks.puddleSplat(m.position, r);
      this.fx.puff(p, 0x7aff4a, b.r * 2.5, 0.3);
    }
    // zap-on-pop: now and then the pop snaps static to enemies close by, stunning them
    const Z = mods.popZap;
    if (Z && Math.random() < Z.chance) {
      for (const e of this.inRange(p, Z.range, b.hit).slice(0, Z.count)) {
        E.center(e,c);
        if(this.treasureLooks){this.treasureLooks.signal(p,c,true);sfx.gadgetStatic();}else this.zap(p,c);
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: Z.stun });
        if (Z.dmg) bus.emit('damage_taken', { targetId: e.id, amount: b.pw * Z.dmg, color: '#cfe8ff', source: 'static' });
      }
    }
    if (mods.split && !b.split) this.split(b, mods.split);   // split-on-hit (Split Blob)
    if(b.child){this.treasureLooks?.echo(p,b.r);sfx.gadgetEcho(true);}
    // echo-bubble: the pop fires again at the next enemy close by (once), at a share of its damage
    // (it starts inside the enemy it popped on: it skips the ones its parent already hit)
    const echo = mods.bubbles.echo;
    if (echo && !b.child) {
      const next = this.inRange(p, 0.2, b.hit)[0];
      if (next) { const k = this.blow(p, next, { size: b.r / RADIUS, dmg: b.dmg * echo.dmg, golden: b.golden, pierce: 1 }); k.child = true; k.hit = new Set(b.hit); k.pierce += b.hit.size;this.treasureLooks?.echo(p,b.r);sfx.gadgetEcho(); }
    }
  }
}
