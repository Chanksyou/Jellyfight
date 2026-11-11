// Adornments: the extra pieces an evolution adds to the jelly (the adorn word, content/evolutions.kdl).
// The body, colours and face the player made stay exactly as they are. Box Jelly strengthens
// the existing tentacles; other pieces are a few procedural meshes, built the first time they're
// needed and hidden when the run doesn't have it.
//
//   venom-tips  Box Jelly: thickens and brightens the jelly's existing tentacles
//   sail        Man o' War: a translucent crest on the bell, and the orbiting polyps (polyps word)
//   halo        Immortal Jelly: a gold ring over the bell, dim once its rebirth is spent
//   moon-ring   Moon Jelly: a pale ring round the bell that flares on every pulse
//   mane        Lion's Mane: a fringe of fine glowing hair round the rim
//   fronds      Upside-down Jelly: fronds that grow out on the floor while you're rooted
//   ember       the Fire jelly type: a flickering ember inside the bell, tentacle tips glowing like
//               coals, sparks drifting up off them
//   barbs       the Tentacle jelly type: its tentacles longer and thicker, with barbs along them
//   toxin       the Poison jelly type: a pale green core in the bell with toxic bubbles rising off it, a
//               drop swelling on every tentacle tip and falling, green drips running off the rim
// (a jelly type's look is its adorn= in content/jellies.kdl: run.typeAdorn)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';
import { batcher } from './batch.js';

const glowMat = (name, fallback, opts = {}) => {
  const c = new THREE.Color(LOOK.color(name, fallback));
  return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.4, ...opts });
};

export class Adornments {
  // batch: where batched pieces register (the game's batcher; the pick screen's portraits draw in a scene of their own and pass a stand-in)
  constructor(scene, player, cfg, { batch = batcher } = {}) {
    this.batch = batch;
    this.scene = scene;
    this.player = player;
    this.h = cfg.height;              // the jelly's height: pieces are placed in shares of it
    this.body = new THREE.Group();    // pieces that move with the jelly
    this.body.name = 'Adornments';
    player.mesh.add(this.body);
    this.free = new THREE.Group();    // pieces in the room (the polyps)
    scene.add(this.free);
    this.pieces = {};
    this.t = 0;
    this._v = new THREE.Vector3();
  }

  piece(kind) {
    if (this.pieces[kind]) return this.pieces[kind];
    const P = this[`make_${kind.replace(/-/g, '_')}`]();
    this.pieces[kind] = P;
    (P.free ? this.free : this.body).add(P.group);
    return P;
  }

  // run: the Run (its mods, timers and bubbles)
  update(dt, run) {
    this.t += dt;
    const want = new Set(run.mods.adorn);
    for (const k of run.typeAdorn || []) want.add(k);
    const venom = want.delete('venom-tips');
    const rig = this.player.avatar?.tentacles;
    if (rig) { rig.venom = venom; rig.barbed = want.has('barbs'); }
    for (const k of want) this.piece(k).group.visible = true;
    for (const [k, P] of Object.entries(this.pieces)) {
      P.group.visible = want.has(k);
      if (P.group.visible) P.tick(dt, run);
    }
    // the polyps go with the sail, wherever the polyps word puts them
    const Pl = run.mods.polyps, polyps = this.piece('polyps');
    polyps.group.visible = !!Pl;
    if (Pl) polyps.tick(dt, run);
  }

  // The portrait and shader warmup enumerate all adornments; this one styles the existing rig.
  make_venom_tips() { return { group: new THREE.Group(), tick() {} }; }

  make_flaming_feet() {
    const group = new THREE.Group(), feet = [], geo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const points = geo.attributes.position;
    for (let i = 0; i < points.count; i++) points.setX(i, points.getX(i) + 0.32 * points.getY(i) ** 2);
    const flame = new THREE.MeshBasicMaterial({ color: LOOK.color('cinder-flame', '#55caff'), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
    const core = new THREE.MeshBasicMaterial({ color: LOOK.color('cinder-core', '#e6fcff'), depthWrite: false, toneMapped: false });
    for (let i = 0; i < 8; i++) {
      const foot = new THREE.Group(), outer = new THREE.Mesh(geo, flame), inner = new THREE.Mesh(geo, core), lick = new THREE.Mesh(geo, flame);
      lick.scale.set(0.6, 0.7, 0.6); lick.position.x = -0.5; lick.rotation.y = Math.PI;
      inner.scale.set(0.5, 0.65, 0.5); foot.add(outer, inner, lick); group.add(foot); feet.push(foot);
    }
    batcher.track(group);
    return { group, free: true, tick: (dt, run) => {
      const rig = this.player.avatar?.tentacles;
      feet.forEach((foot, i) => {
        foot.visible = !!rig?.list[i] && !['dead', 'won'].includes(run.phase) && !(run.polypT > 0);
        if (!foot.visible) return;
        rig.list[i].tip.getWorldPosition(foot.position);
        foot.position.y = Math.max(foot.position.y, this.player.position.y + 0.002);
        const flicker = 0.85 + Math.sin(this.t * 19 + i * 2.7) * 0.15;
        foot.scale.set(LOOK.num('cinder-foot-width', 0.0045), LOOK.num('cinder-foot-height', 0.018) * flicker, LOOK.num('cinder-foot-width', 0.0045));
        foot.rotation.z = Math.sin(this.t * 11 + i) * 0.16;
      });
    } };
  }

  // Fire jelly: an ember glowing in the bell (an emissive ball, not a light), a coal on every
  // tentacle tip, and sparks drifting up off them and fading
  make_ember() {
    const group = new THREE.Group(), h = this.h;
    const coreMat = glowMat('ember-core', '#ff7a1a', { emissiveIntensity: 2.2, transparent: true, opacity: 0.85, depthWrite: false });
    const coalMat = glowMat('ember-coal', '#ff5a14', { emissiveIntensity: 2.4 });
    const sparkMat = new THREE.MeshBasicMaterial({ color: LOOK.color('ember-spark', '#ffc26a'), toneMapped: false });
    const ball = new THREE.SphereGeometry(1, 10, 8);
    const core = new THREE.Mesh(ball, coreMat);
    group.add(core);
    const coals = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ball, coalMat); group.add(m); return m; });
    const sparks = Array.from({ length: LOOK.num('ember-sparks', 10) }, () => { const m = new THREE.Mesh(ball, sparkMat); m.visible = false; m.userData.t = 0; group.add(m); return m; });
    this.batch.track(group);
    let next = 0;
    const glowCol = coreMat.color.clone(), coalCol = coalMat.color.clone(), sparkCol = sparkMat.color.clone();
    return { group, free: true, tick: (dt, run) => {
      const G = run.fx?.glow;   // a soft glow (vfx.js, one batched draw) so the ember reads through the bell and on Low
      const rig = this.player.avatar?.tentacles, unit = rig?.unit || 1, on = !!rig && !['dead', 'won'].includes(run.phase) && !(run.polypT > 0);
      const flick = 0.8 + Math.sin(this.t * 13) * 0.12 + Math.sin(this.t * 31) * 0.08;
      // the core: in the middle of the bell, which the rig hangs from (model units: the bell's rim at 0.56)
      core.visible = on;
      if (on) {
        rig.parent.localToWorld(core.position.set(0, LOOK.num('ember-core-y', 0.86), 0));
        core.scale.setScalar(h * LOOK.num('ember-core-size', 0.1) * (0.92 + flick * 0.1));
        coreMat.emissiveIntensity = 2.2 * flick;
        G?.hold(core.position, glowCol, h * LOOK.num('ember-glow-size', 0.6) * flick, 0.55 * flick);
      }
      coals.forEach((m, i) => {
        m.visible = on && !!rig.list[i];
        if (!m.visible) return;
        rig.list[i].tip.getWorldPosition(m.position);
        m.scale.setScalar(rig.thick * unit * LOOK.num('ember-coal-size', 1) * (0.9 + Math.sin(this.t * 17 + i * 2.1) * 0.1));
        G?.hold(m.position, coalCol, m.scale.x * 5, 0.6);
      });
      // a spark leaves a tip now and then, drifts up and dies out
      if (on && (next -= dt) <= 0) {
        next = LOOK.num('ember-spark-every', 0.09);
        const m = sparks.find((x) => !x.visible), T = rig.list[Math.floor(Math.random() * rig.list.length)];
        if (m && T) { T.tip.getWorldPosition(m.position); Object.assign(m.userData, { t: 0, dx: (Math.random() - 0.5) * 0.02, dz: (Math.random() - 0.5) * 0.02 }); m.visible = true; }
      }
      const life = LOOK.num('ember-spark-life', 0.8), rise = LOOK.num('ember-spark-rise', 0.05), size = LOOK.num('ember-spark-size', 0.0022);
      for (const m of sparks) {
        if (!m.visible) continue;
        const u = (m.userData.t += dt) / life;
        if (u >= 1 || !on) { m.visible = false; continue; }
        m.position.x += m.userData.dx * dt; m.position.z += m.userData.dz * dt; m.position.y += rise / life * dt;
        m.scale.setScalar(size * (1 - u));
        G?.hold(m.position, sparkCol, size * 4 * (1 - u), 0.7 * (1 - u));
      }
    } };
  }

  // Tentacle jelly: the rig itself is drawn longer and thicker (rig.barbed, set in update), and
  // backward-hooked barbs sit along every tentacle so the type reads from far away
  make_barbs() {
    const group = new THREE.Group(), per = 3;
    const mat = glowMat('barb', '#f4e9ff', { emissiveIntensity: 0.9 });
    const geo = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
    const barbs = Array.from({ length: 8 * per }, () => { const m = new THREE.Mesh(geo, mat); group.add(m); return m; });
    this.batch.track(group);
    const d = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    return { group, free: true, tick: (dt, run) => {
      const rig = this.player.avatar?.tentacles, on = !!rig && !['dead', 'won'].includes(run.phase) && !(run.polypT > 0);
      if (on) rig.parent.getWorldQuaternion(q);
      const unit = rig?.unit || 1, size = LOOK.num('barb-size', 3);
      barbs.forEach((m, k) => {
        const T = on && rig.list[Math.floor(k / per)];
        m.visible = !!T;
        if (!T) return;
        const n = T.pts.length - 1, j = Math.round((0.35 + 0.22 * (k % per)) * n);
        rig.parent.localToWorld(m.position.copy(T.pts[j]));
        // hooked back up the tentacle, out from it
        d.copy(T.pts[j - 1]).sub(T.pts[j + 1]).normalize().multiplyScalar(0.7).addScaledVector(T.out, 1).normalize().applyQuaternion(q);
        m.quaternion.setFromUnitVectors(Y, d);
        const r = rig.thick * rig.barbThick * (1 - 0.72 * j / n) * unit;
        m.scale.set(r, r * size, r);
      });
    } };
  }

  // Poison jelly: a pale green core in the bell (emissive, not a light) with bubbles rising off it,
  // a drop swelling on each tentacle tip until it falls, and drips running off the rim (the tentacles'
  // roots). Everything moves with the jelly but the falling drops, which keep falling where they let go
  make_toxin() {
    const group = new THREE.Group(), h = this.h, L = (k, f) => LOOK.num('toxin-' + k, f);
    const coreMat = glowMat('toxin-core', '#9effc8', { emissiveIntensity: 1.8, transparent: true, opacity: 0.8, depthWrite: false });
    const dropMat = glowMat('toxin-drop', '#3ee68c', { emissiveIntensity: 1.6 });
    const bubMat = new THREE.MeshBasicMaterial({ color: LOOK.color('toxin-bubble', '#d6ffe9'), toneMapped: false });
    const ball = new THREE.SphereGeometry(1, 10, 8);
    const core = new THREE.Mesh(ball, coreMat);
    group.add(core);
    const make = (mat, n) => Array.from({ length: n }, () => { const m = new THREE.Mesh(ball, mat); m.visible = false; m.userData.t = 0; group.add(m); return m; });
    const bubbles = make(bubMat, L('bubbles', 8)), tips = make(dropMat, 8), drips = make(dropMat, L('drips', 6));
    this.batch.track(group);
    const glowCol = coreMat.color.clone(), dropCol = dropMat.color.clone();
    let nextBub = 0, nextDrip = 0;
    // a falling drop: down at gravity (slowed by the water), gone at the floor
    const fall = (m, dt, floor, G) => {
      m.userData.vy -= L('drop-gravity', 1.2) * dt;
      m.position.y += m.userData.vy * dt;
      if (m.position.y <= floor) { m.visible = false; return false; }
      G?.hold(m.position, dropCol, m.scale.x * 4, 0.5);
      return true;
    };
    return { group, free: true, tick: (dt, run) => {
      const G = run.fx?.glow;
      const rig = this.player.avatar?.tentacles, unit = rig?.unit || 1, on = !!rig && !['dead', 'won'].includes(run.phase) && !(run.polypT > 0);
      const floor = this.player.position.y, pulse = 0.9 + Math.sin(this.t * 4) * 0.1;
      core.visible = on;
      if (on) {
        rig.parent.localToWorld(core.position.set(0, L('core-y', 0.8), 0));
        core.scale.setScalar(h * L('core-size', 0.13) * pulse);
        G?.hold(core.position, glowCol, h * L('glow-size', 0.7) * pulse, 0.5);
      }
      // bubbles well up off the core and rise inside the bell, swelling and popping
      if (on && (nextBub -= dt) <= 0) {
        nextBub = L('bubble-every', 0.14);
        const m = bubbles.find((x) => !x.visible);
        if (m) { Object.assign(m.userData, { t: 0, x: (Math.random() - 0.5) * 0.25, z: (Math.random() - 0.5) * 0.25 }); m.visible = true; }
      }
      const life = L('bubble-life', 0.9);
      for (const m of bubbles) {
        if (!m.visible) continue;
        const u = (m.userData.t += dt) / life;
        if (u >= 1 || !on) { m.visible = false; continue; }
        rig.parent.localToWorld(m.position.set(m.userData.x * (1 - u * 0.5), L('core-y', 0.8) + L('bubble-rise', 0.22) * u, m.userData.z * (1 - u * 0.5)));
        m.scale.setScalar(h * L('bubble-size', 0.025) * Math.sin(u * Math.PI));
      }
      // a drop on every tip: it swells for a while, then lets go and falls
      tips.forEach((m, i) => {
        const T = on && rig.list[i], U = m.userData;
        if (U.falling) { if (!fall(m, dt, floor, G)) U.falling = false; return; }
        m.visible = !!T;
        if (!T) return;
        U.hang ??= L('drop-hang', 0.9) * (0.6 + Math.random() * 0.8);
        const u = Math.min(1, (U.t += dt) / U.hang), r = rig.thick * unit * L('drop-size', 1.3) * (0.3 + 0.7 * u);
        T.tip.getWorldPosition(m.position); m.position.y -= r * 0.8;
        m.scale.set(r, r * (1 + 0.4 * u), r);
        if (u >= 1) { U.falling = true; U.vy = 0; U.t = 0; U.hang = null; }
      });
      // now and then a drip runs off the rim and falls
      if (on && (nextDrip -= dt) <= 0) {
        nextDrip = L('drip-every', 0.35);
        const m = drips.find((x) => !x.visible), T = rig.list[Math.floor(Math.random() * rig.list.length)];
        if (m && T?.pts?.length) { rig.parent.localToWorld(m.position.copy(T.pts[0])); m.scale.setScalar(rig.thick * unit * L('drop-size', 1.3) * 0.7); m.userData.vy = 0; m.visible = true; }
      }
      for (const m of drips) if (m.visible) fall(m, dt, floor, G);
    } };
  }

  make_rebound_bands() {
    const group = new THREE.Group(), h = this.h;
    const mat = glowMat('rebound', '#9bfff2');
    for (let i = 0; i < 2; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(h * (0.25 + i * 0.08), h * LOOK.num('rebound-band-width', 0.013), 5, 36, Math.PI * 1.5), mat);
      band.rotation.x = Math.PI / 2; band.rotation.z = i * Math.PI;
      band.position.y = h * (0.8 - i * 0.15); group.add(band);
    }
    let reveal = null;
    return { group, reveal: u => { reveal = u; }, tick: (dt, run) => {
      const returning = reveal === null ? run.bubbles.list.some(b => b.returning) : reveal > 0.65;
      group.rotation.y += dt * (returning ? -2 : 2);
      group.scale.setScalar(1 + Math.sin(this.t * 5) * 0.04);
    } };
  }

  make_mirage_rim() {
    const group = new THREE.Group(), h = this.h;
    const mat = glowMat('mirage', '#bcecff');
    const accent = new THREE.Color(LOOK.color('mirage-accent', '#cebfff'));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.29, h * 0.012, 5, 48), mat);
    ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.6; group.add(ring);
    const base = mat.color.clone();
    return { group, tick: (dt, run) => {
      mat.color.copy(base).lerp(accent, 0.5 + Math.sin(this.t * 2) * 0.5);
      mat.emissive.copy(mat.color);
      ring.scale.setScalar(1 + (run.mirage.left > 0 ? 0.08 : 0));
    } };
  }

  // Man o' War: a translucent sail-crest standing on the bell
  make_sail() {
    const group = new THREE.Group(), h = this.h;
    const mat = glowMat('sail', '#9fb6ff', { transparent: true, opacity: 0.6, emissiveIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
    const s = new THREE.Shape();
    s.moveTo(-1, 0); s.bezierCurveTo(-0.9, 0.9, -0.2, 1.2, 0.3, 0.9); s.bezierCurveTo(0.7, 0.7, 0.9, 0.5, 1, 0); s.lineTo(-1, 0);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(s, 12), mat);
    sail.scale.set(h * 0.2, h * 0.22, 1);   // across the bell, so the camera behind you sees it
    sail.position.y = h * 0.93;         // standing on top of the bell
    group.add(sail);
    return { group, tick: () => { sail.rotation.z = Math.sin(this.t * 2) * 0.08; sail.rotation.x = -0.25; } };
  }

  // the polyps word's helpers: little glowing buds circling where bubbles.js shoots from
  make_polyps() {
    const group = new THREE.Group(), mat = glowMat('sail', '#9fb6ff', { emissiveIntensity: 1.8 });
    const geo = mergeGeometries([new THREE.SphereGeometry(0.0055, 10, 8), new THREE.ConeGeometry(0.0035, 0.009, 8).translate(0, -0.0075, 0)]);
    const buds = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(geo, mat); group.add(m); return m; });
    return {
      group, free: true,
      tick: (dt, run) => {
        const Pl = run.mods.polyps, B = run.bubbles;
        buds.forEach((m, i) => {
          m.visible = i < Pl.count && !!B.origin;
          if (m.visible) B.polypPos(i, Pl.count, B.origin, m.position);
        });
      },
    };
  }

  // Immortal Jelly: a gold ring over the bell; once the rebirth is spent this act it goes dim
  make_halo() {
    const group = new THREE.Group(), h = this.h, mat = glowMat('halo', '#ffd27a', { emissiveIntensity: 2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.2, h * 0.018, 8, 40), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h * 1.12;
    group.add(ring);
    return { group, tick: (dt, run) => {
      ring.position.y = h * (Math.max(1.12, (this.player.avatar?.hatTop || 0) + 0.07) + Math.sin(this.t * 2) * 0.03);   // over the hat, if it's a tall one
      mat.emissiveIntensity = run.rebornThisAct ? 0.25 : 2;
      mat.opacity = run.rebornThisAct ? 0.4 : 1;
      mat.transparent = run.rebornThisAct;
    } };
  }

  // Moon Jelly: a pale ring round the bell, flaring out on each pulse (the dash)
  make_moon_ring() {
    const group = new THREE.Group(), h = this.h;
    const mat = glowMat('moon-ring', '#dff4ff', { transparent: true, opacity: 0.7, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.34, h * 0.014, 6, 48), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h * 0.45;
    group.add(ring);
    return { group, tick: (dt, run) => {
      const k = run.dashT > 0 ? 1 : 0;
      ring.scale.setScalar(1 + k * 0.35 + Math.sin(this.t * 3) * 0.03);
      mat.emissiveIntensity = 1 + k * 2.5;
    } };
  }

  // Lion's Mane: a fringe of fine glowing hair round the rim, in one mesh
  make_mane() {
    const group = new THREE.Group(), h = this.h, mat = glowMat('mane', '#ffb46a', { emissiveIntensity: 2 });
    const parts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, len = h * (0.32 + (i % 3) * 0.08);
      const g = new THREE.CylinderGeometry(h * 0.012, h * 0.003, len, 4).translate(0, -len / 2, 0);
      g.rotateX(0.6 + (i % 2) * 0.25);                    // splayed out from the rim
      g.rotateY(-a + Math.PI / 2);
      g.translate(Math.cos(a) * h * 0.36, h * 0.5, Math.sin(a) * h * 0.36);
      parts.push(g);
    }
    const mane = new THREE.Mesh(mergeGeometries(parts), mat);
    group.add(mane);
    return { group, tick: () => { mane.rotation.y = Math.sin(this.t * 1.5) * 0.05; mane.scale.y = 1 + Math.sin(this.t * 4) * 0.04; } };
  }

  // Upside-down Jelly: fronds on the floor round you that grow out while you're rooted
  make_fronds() {
    const group = new THREE.Group(), h = this.h, mat = glowMat('fronds', '#6affc0', { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, emissiveIntensity: 1 });
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.5, 0.4, 0, 1); leaf.quadraticCurveTo(-0.5, 0.4, 0, 0);
    const parts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const g = new THREE.ShapeGeometry(leaf, 6).scale(h * 0.12, h * 0.3, 1).rotateX(-Math.PI / 2).rotateY(-a - Math.PI / 2);
      g.translate(Math.cos(a) * h * 0.3, 0.002, Math.sin(a) * h * 0.3);
      parts.push(g);
    }
    const fronds = new THREE.Mesh(mergeGeometries(parts), mat);
    group.add(fronds);
    let grow = 0;
    return { group, tick: (dt, run) => {
      grow += ((run.stillT >= 1 ? 1 : 0) - grow) * Math.min(1, dt * 6);
      fronds.visible = grow > 0.02;
      fronds.scale.setScalar(Math.max(0.01, grow));
      fronds.rotation.y += dt * 0.3;
    } };
  }
}
