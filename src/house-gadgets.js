// Treasure gadgets with a body of their own (gadgets.js owns one of these): the Fly Swatter that
// slaps down on a bug, Bath Bombs lobbed onto a crowd that erupt into a foam geyser, Ice Cube
// puddles bugs skid on, and the Disco Ball's spotlight. Timed ones are TIMED_WORDS (swatter, geyser,
// puddle) fired through Gadgets.fire; the spotlight is mods.spotlight. Systems talk through the bus.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bus } from './events.js';
import { LOOK } from './look.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { glowPool } from './treasure-glow.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const SWING = 0.12, FLIGHT = 0.3, GRAVITY = 1.0;   // enemies.js moveGround: bugs fall at 1 m/s²

export class HouseGadgets {
  constructor(g) {
    this.g = g; this.enemies = g.enemies; this.fx = g.fx; this.looks = g.looks;
    const group = this.group = g.group;
    // Fly Swatter: a thickened grip, tapered shaft, neck collar and rounded mesh head; it swings down about the grip
    const sw = LOOK.color('gadget-swatter', '#4fb8ff');
    const head = new THREE.MeshStandardMaterial({ color: sw, emissive: sw, emissiveIntensity: 0.25, roughness: 0.6 });
    const handle = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 });
    this.swatter = new THREE.Group();
    this.swatArm = new THREE.Group(); this.swatter.add(this.swatArm);
    this.swatArm.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0032, 0.022, 8).rotateX(Math.PI / 2).translate(0, 0, 0.011), head));
    this.swatArm.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0018, 0.052, 8).rotateX(Math.PI / 2).translate(0, 0, 0.045), handle));
    this.swatArm.add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.0022, 0.008, 8).rotateX(Math.PI / 2).translate(0, 0, 0.071), head));
    const face = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.0022, 0.04, 2, 0.001).translate(0, 0, 0.092), head);
    face.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.0024, 0.036, 6, 1, 6).translate(0, 0, 0.092), new THREE.MeshBasicMaterial({ color: 0x1d4f7a, wireframe: true })));   // the mesh of holes
    this.swatArm.add(face);
    this.swatter.visible = false; group.add(this.swatter);
    // Bath Bomb: a pressed fizzy sphere with an equatorial mold seam, and a soft floor disc showing where the foam will reach
    const pink = LOOK.color('bath-foam', '#ff9ad8');
    this.bombMat = new THREE.MeshStandardMaterial({ color: pink, emissive: pink, emissiveIntensity: 0.5, roughness: 0.9 });
    const bombPts = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      const seam = i === 6 ? 1.12 : 1;   // raised mold seam around the equator
      bombPts.push(new THREE.Vector2(Math.cos(a) * 0.007 * seam, Math.sin(a) * 0.007));
    }
    this.bombGeo = new THREE.LatheGeometry(bombPts, 16);
    this.bombPool = Array.from({ length: 3 }, () => {
      const m = new THREE.Mesh(this.bombGeo, this.bombMat), disc = glowPool('fizz', pink);
      m.visible = disc.visible = false; group.add(m, disc);
      return { m, disc };
    });
    // Ice Cube: a beveled little cube that cracks apart as it melts into a wet puddle
    const wet = LOOK.color('treasure-iceCube', '#7cc8ff');
    this.cubeMat = new THREE.MeshStandardMaterial({ color: 0xeaf8ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 });
    const cubeGeo = new RoundedBoxGeometry(0.014, 0.014, 0.014, 2, 0.0022).translate(0, 0.007, 0);
    this.puddlePool = Array.from({ length: 4 }, () => {
      const disc = glowPool('wet', wet);
      const cube = new THREE.Mesh(cubeGeo, this.cubeMat);
      disc.visible = cube.visible = false; group.add(disc, cube);
      return { disc, cube };
    });
    // Disco Ball: a mirror ball over you and a cone of coloured light down onto its pick
    const disco = LOOK.color('treasure-discoBall', '#d8beff');
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.009, 1), new THREE.MeshStandardMaterial({ color: 0xdfe6ef, metalness: 0.9, roughness: 0.15, flatShading: true, emissive: disco, emissiveIntensity: 0.25 }));
    this.ball.visible = false; group.add(this.ball);
    this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 1, 1, 20, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: disco, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending }));
    this.spotPool = glowPool('spot', disco);
    this.cone.visible = this.spotPool.visible = false; group.add(this.cone, this.spotPool);
    this.disco = new THREE.Color(disco); this.pink = new THREE.Color(pink); this.wet = new THREE.Color(wet); this.sw = new THREE.Color(sw);
    this.reset();
  }

  reset() {
    this.swat = null; this.swatter.visible = false;
    this.bombs = []; for (const b of this.bombPool) b.m.visible = b.disc.visible = false;
    this.puddles = []; for (const p of this.puddlePool) p.disc.visible = p.cube.visible = false;
    this.wetNow = false;
    this.spot = null; this.ball.visible = this.cone.visible = this.spotPool.visible = false;
  }

  // shown for a frame at load so their shaders compile up front (Gadgets.warm); before any run starts
  warm(on, at) {
    const meshes = [this.swatter, this.bombPool[0].m, this.bombPool[0].disc, this.puddlePool[0].disc, this.puddlePool[0].cube, this.ball, this.cone, this.spotPool];
    for (const m of meshes) { m.visible = on; if (on) m.position.copy(at); }
  }

  // a timed effect going off (Gadgets.fire hands these over)
  fire(ef, ctx) {
    const { feet, center } = ctx, g = this.g, E = this.enemies;
    if (ef.kind === 'swatter') {
      const near = g.near(center, ef.range), fly = near.find((e) => e.T?.fly && !e.proxy), e = fly || near[0];
      if (!e) return;
      const at = E.center(e, _a), from = _b.copy(at).sub(center).setY(0);
      if (from.lengthSq() < 1e-8) from.set(0, 0, 1);
      from.normalize();
      // the grip sits back toward you, so the head lands flat on top of the bug
      this.swatter.position.copy(at).addScaledVector(from, -0.09).setY(at.y + (e.T?.fly ? 0 : e.r));
      this.swatter.rotation.set(0, Math.atan2(from.x, from.z), 0);
      this.swatter.scale.setScalar(1); this.swatter.visible = true;
      this.swat = { e, t: 0, mult: fly ? ef.mult : ef.plain, stun: ef.stun, hit: false, power: ctx.power };
      ctx.pulse?.(0.15);
    } else if (ef.kind === 'geyser') {
      // the biggest crowd: the bug with the most others within `radius` of it
      const near = g.near(center, ef.range);
      if (!near.length) return;
      let best = near[0], most = -1;
      for (const e of near) { let n = 0; for (const o of near) if (E.center(o, _a).distanceTo(E.center(e, _b)) <= ef.radius) n++; if (n > most) { most = n; best = e; } }
      const slot = this.bombPool.find((b) => !b.m.visible);
      if (!slot) return;
      const to = new THREE.Vector3(best.pos.x, E.floorBelow(best.pos, best.pos.y + 0.05), best.pos.z);
      slot.m.position.copy(center); slot.m.visible = true;
      slot.disc.position.copy(to).setY(to.y + 0.002); slot.disc.scale.setScalar(ef.radius); slot.disc.visible = false;
      this.bombs.push({ ...slot, from: center.clone(), to, t: 0, ef, power: ctx.power, fizzing: false });
      sfx.bombLob(); ctx.pulse?.(0.2);
    } else if (ef.kind === 'puddle') {
      if (this.puddles.length >= Math.min(ef.most, this.puddlePool.length)) { const old = this.puddles.shift(); old.disc.visible = old.cube.visible = false; }
      const slot = this.puddlePool.find((p) => !p.disc.visible);
      slot.disc.position.copy(feet).setY(feet.y + 0.0015); slot.disc.scale.setScalar(0.001); slot.disc.visible = true;
      slot.cube.position.copy(feet); slot.cube.scale.setScalar(1); slot.cube.rotation.y = Math.random() * Math.PI; slot.cube.visible = true;
      slot.disc.material.uniforms.uRipple.value.z = -1;
      this.puddles.push({ ...slot, r: ef.radius, t: 0, last: ef.last, skid: ef.skid, slipped: new Set() });
      sfx.iceDrop(); ctx.pulse?.(0.12);
    }
  }

  update(dt, ctx) {
    const { mods: M, feet, center } = ctx, g = this.g, E = this.enemies, fx = this.fx, quiet = this.looks.quiet;
    // the swatter: up, then down flat on the bug; the hit lands as it does
    const S = this.swat;
    if (S) {
      S.t += dt;
      const u = Math.min(1, S.t / SWING);
      this.swatArm.rotation.x = -1.35 * (1 - u * u);
      if (!S.hit && u >= 1) {
        S.hit = true;
        if (!S.e.dead) {
          const at = E.center(S.e, _a);
          bus.emit('damage_taken', { targetId: S.e.id, amount: S.power * S.mult, color: '#bfe8ff', source: 'swatter' });
          bus.emit('status_applied', { targetId: S.e.id, status: 'stun', duration: S.stun });
          this.looks.contact(at, this.sw, Math.max(0.012, S.e.r));
          fx.puff(_b.set(at.x, S.e.pos.y + 0.003, at.z), 0xd8d0c8, 0.02, 0.3);
          fx.number(_b.set(at.x, at.y + S.e.r + 0.01, at.z), 'SWAT', '#bfe8ff', 12);
        }
        sfx.swat(); if (!quiet) juice.feel('hit-big'); ctx.pulse?.(0.3);
      }
      if (S.t > SWING + 0.25) { this.swatter.scale.setScalar(Math.max(0.001, 1 - (S.t - SWING - 0.25) / 0.12)); }
      if (S.t > SWING + 0.37) { this.swat = null; this.swatter.visible = false; }
    }

    // bath bombs: lobbed in an arc, fizz on the floor (the disc filling to the foam's reach), then erupt
    for (const b of this.bombs) {
      b.t += dt;
      if (b.t < FLIGHT) {
        const u = b.t / FLIGHT;
        b.m.position.lerpVectors(b.from, b.to, u).y += Math.sin(u * Math.PI) * 0.06 + (1 - u) * 0 + 0.007;
        continue;
      }
      if (!b.fizzing) { b.fizzing = true; b.m.position.copy(b.to).setY(b.to.y + 0.007); b.disc.visible = true; sfx.bombFizz(); }
      const k = Math.min(1, (b.t - FLIGHT) / b.ef.fuse), u = b.disc.material.uniforms;
      u.uCharge.value = k; u.uOpacity.value = 0.6 + 0.4 * k; if (!quiet) u.uTime.value += dt;
      b.m.scale.setScalar(quiet ? 1 : 1 - 0.4 * k + 0.08 * Math.sin(b.t * 40));
      if (!quiet && Math.random() < 0.5) this.looks.pop(_a.copy(b.m.position).add(_b.set((Math.random() - 0.5) * 0.01, 0.006, (Math.random() - 0.5) * 0.01)), this.pink);
      if (k < 1) continue;
      const ef = b.ef, air = 2 * ef.lift / GRAVITY;
      for (const e of g.near(b.to, ef.radius)) {
        bus.emit('damage_taken', { targetId: e.id, amount: b.power * ef.dmg, color: '#ff9ad8', source: 'geyser' });
        if (!e.proxy) {
          bus.emit('knockback', { targetId: e.id, dir: _a.copy(e.pos).sub(b.to).setY(0).normalize(), force: 0.01, lift: ef.lift });
          bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: air });
        }
        this.looks.contact(E.center(e, _a), this.pink, Math.max(0.008, e.r * 0.7));
      }
      this.looks.geyser(b.to, ef.radius);
      sfx.geyser(); if (!quiet) juice.feel('impact'); ctx.pulse?.(0.25);
      b.m.visible = b.disc.visible = false; b.m.scale.setScalar(1); b.done = true;
    }
    this.bombs = this.bombs.filter((b) => !b.done);

    // puddles: the cube melts as the puddle spreads; a bug walking on skids and is Stunned (once a puddle)
    this.wetNow = false;
    for (const p of this.puddles) {
      p.t += dt;
      const grow = Math.min(1, p.t / 0.4), fade = Math.min(1, (p.last - p.t) / 0.6);
      p.disc.scale.setScalar(p.r * (0.3 + 0.7 * grow));
      const u = p.disc.material.uniforms, rip = u.uRipple.value;
      if (!quiet) u.uTime.value += dt;
      if (rip.z >= 0) rip.z = rip.z + dt > 0.6 ? -1 : rip.z + dt;
      if (p.cube.visible && grow >= 1 && !fx.low()) fx.ice.shatter(_a.copy(p.cube.position).setY(p.cube.position.y + 0.004), quiet ? 3 : 6, 0.003, 0.25, p.cube.position.y);   // the last of the cube cracks apart
      p.cube.visible = grow < 1; p.cube.scale.set(1 - grow * 0.8, 1 - grow, 1 - grow * 0.8);
      p.disc.scale.multiplyScalar(Math.max(0.001, fade));
      const at = p.disc.position;
      if (Math.hypot(feet.x - at.x, feet.z - at.z) <= p.r && Math.abs(feet.y - at.y) < 0.05) this.wetNow = true;
      for (const e of g.near(at, p.r, { proxies: false })) {
        if (e.T?.fly || p.slipped.has(e) || Math.abs(e.pos.y - at.y) > 0.05) continue;
        p.slipped.add(e);
        const dir = _a.set(e.vel?.x || 0, 0, e.vel?.z || 0);
        if (dir.lengthSq() < 1e-8) dir.copy(e.pos).sub(at).setY(0);
        bus.emit('knockback', { targetId: e.id, dir: dir.normalize(), force: 0.03 });
        bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: p.skid });
        this.looks.streak(_b.copy(e.pos).setY(at.y + 0.002), _a.copy(e.pos).addScaledVector(dir, 0.03).setY(at.y + 0.002), this.wet, 0.002, 0.3);
        const sc = p.disc.scale.x || 1; p.disc.material.uniforms.uRipple.value.set((e.pos.x - at.x) / sc, (e.pos.z - at.z) / sc, 0);   // a ripple where it skids
        sfx.skid();
      }
      if (p.t >= p.last) { p.disc.visible = p.cube.visible = false; p.done = true; }
    }
    this.puddles = this.puddles.filter((p) => !p.done);

    // the spotlight: a mirror ball over you; every `every` s it picks the toughest bug in range for `time` s
    const L = M.spotlight;
    this.ball.visible = !!L;
    if (!L) { this.spot = null; this.cone.visible = this.spotPool.visible = false; return; }
    const C = g.companions;
    this.ball.position.copy(center).y += 0.07;
    if (!quiet) this.ball.rotation.y += dt * (1.5 + 9 * C.kick);   // spins up as it picks
    if (g.every('spotlight', dt, L.every, 0.5)) {
      const hp = (e) => (e.proxy ? 1e9 + (e.proxy.hp || 0) : e.hp), found = g.near(center, L.range).sort((a, b) => hp(b) - hp(a));
      if (found[0]) {
        this.spot = { e: found[0], t: L.time };
        bus.emit('status_applied', { targetId: found[0].id, status: 'spot', duration: L.time, more: L.more });
        sfx.disco(); ctx.pulse?.(0.2); C.picked();
      }
    }
    const P = this.spot;
    C.disco(feet, P && !P.e.dead ? P.e : null, dt, ctx.beat);
    if (P) { P.t -= dt; if (P.t <= 0 || P.e.dead) this.spot = null; }
    this.cone.visible = this.spotPool.visible = !!this.spot;
    if (this.spot) {
      const e = this.spot.e, c = E.center(e, _a), floor = e.proxy ? c.y - (e.r || 0.05) : e.pos.y;
      const top = this.ball.position, h = Math.max(0.01, top.y - floor), wide = Math.max(0.012, (e.r || 0.03) * 1.2);
      this.cone.position.copy(top);
      this.cone.quaternion.setFromUnitVectors(UP, _b.set(top.x - c.x, h, top.z - c.z).normalize());
      this.cone.scale.set(wide, _b.set(top.x - c.x, h, top.z - c.z).length(), wide);
      this.spotPool.position.set(c.x, floor + 0.003, c.z); this.spotPool.scale.setScalar(wide);
      const u = this.spotPool.material.uniforms;
      u.uOpacity.value = 0.8 + (quiet ? 0 : 0.2 * Math.sin(this.g.clock * 9)); if (!quiet) u.uTime.value += dt;
      if (!quiet && Math.random() < dt * 8) this.looks.echo(_b.set(c.x, floor + 0.004, c.z), wide * 0.8);
    }
  }
}
