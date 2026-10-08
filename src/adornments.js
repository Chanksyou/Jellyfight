// Adornments: the extra pieces an evolution adds to the jelly (the adorn word, content/evolutions.kdl).
// They sit on top of the player's own jelly, never change it: the body, colours and face the player
// made stay exactly as they are. Each piece is a few procedural meshes, built the first time it's
// needed and hidden when the run doesn't have it.
//
//   venom-tips  Box Jelly: four long glowing venom strands trailing from the rim
//   sail        Man o' War: a translucent crest on the bell, and the orbiting polyps (polyps word)
//   halo        Immortal Jelly: a gold ring over the bell, dim once its rebirth is spent
//   moon-ring   Moon Jelly: a pale ring round the bell that flares on every pulse
//   mane        Lion's Mane: a fringe of fine glowing hair round the rim
//   fronds      Upside-down Jelly: fronds that grow out on the floor while you're rooted
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';

const glowMat = (name, fallback, opts = {}) => {
  const c = new THREE.Color(LOOK.color(name, fallback));
  return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.4, ...opts });
};

export class Adornments {
  constructor(scene, player, cfg) {
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
    const P = this[`make_${kind.replace(/-/g, '_')}`]();   // venom-tips -> make_venom_tips
    this.pieces[kind] = P;
    (P.free ? this.free : this.body).add(P.group);
    return P;
  }

  // run: the Run (its mods, timers and bubbles)
  update(dt, run) {
    this.t += dt;
    const want = new Set(run.mods.adorn);
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

  make_venom_tips() { return this.make_strands('venom', '#8dff5a', 4, 0.1, 0.0024, 0.9); }

  // long thin glowing strands hanging from the rim, swaying
  make_strands(token, fallback, n, len, thick, droop) {
    const group = new THREE.Group(), mat = glowMat(token, fallback, { emissiveIntensity: 2.4 }), h = this.h, strands = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      // down and out from the rim (local +x points away from the bell), curling at the end
      const curve = new THREE.CatmullRomCurve3([0, 0.3, 0.65, 1].map((k) => new THREE.Vector3(k * len * 0.55 * droop, -k * len * 0.8, Math.sin(k * 3) * len * 0.12)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, thick, 5), mat);
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * h * 0.34, h * 0.42, Math.sin(a) * h * 0.34);   // just outside the rim
      pivot.rotation.order = 'YXZ';
      pivot.rotation.y = -a;
      pivot.add(m);
      group.add(pivot);
      strands.push({ pivot, a });
    }
    return { group, tick: () => { for (const S of strands) { S.pivot.rotation.x = Math.sin(this.t * 3 + S.a * 2) * 0.25; S.pivot.rotation.z = Math.cos(this.t * 2.3 + S.a) * 0.2; } } };
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
      ring.position.y = h * (1.12 + Math.sin(this.t * 2) * 0.03);
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
