// Stories: the bell bends like a real jelly's (bell-flex.js). The crown stays nearly still while the
// rim squeezes in, and the bend runs down from the crown, so the rim's squeeze comes a moment later.
import * as THREE from 'three';
import { SPECIES, buildCharacter } from '../character.js';
import { bellFlex, freezeBell } from '../bell-flex.js';
import { ok, story } from './kit.js';

story('motion/rim-leads-crown', {
  about: 'Through a power stroke every species\' rim pulls in at least 3 times as far as its crown, and reaches its narrowest after the crown does.',
  setup() {},
  play() {
    const bad = [], seen = {}, f = { k: 1, dy: 0 };
    for (const body of Object.keys(SPECIES)) {
      const c = buildCharacter({ body }, 1);
      let rim = { k: 1, at: 0 }, crown = { k: 1, at: 0 };
      for (let i = 0; i <= 60; i++) {            // the power stroke (swim 0 to 0.3) and a little after
        const swim = i / 150;
        c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim });
        if (bellFlex(0, c.bend, f).k < rim.k) rim = { k: f.k, at: swim };
        if (bellFlex(c.crownH * 0.9, c.bend, f).k < crown.k) crown = { k: f.k, at: swim };
      }
      const ratio = (1 - rim.k) / Math.max(1e-6, 1 - crown.k);
      seen[body] = { ratio: +ratio.toFixed(1), rimAt: +rim.at.toFixed(3), crownAt: +crown.at.toFixed(3) };
      if (!(ratio >= 3 && rim.at > crown.at && rim.k < 0.85)) bad.push(body);
      c.dispose();
    }
    return ok(!bad.length, { bad, seen });
  },
});

story('motion/roots-hang-from-the-rim', {
  about: 'Through a power stroke every species\' tentacle roots pull in with the rim (within 0.08 of its radius scale) and drop with it, and a copy frozen mid-stroke keeps its bend.',
  setup() {},
  play() {
    const bad = [], seen = {}, f = { k: 1, dy: 0 };
    for (const body of Object.keys(SPECIES)) {
      const c = buildCharacter({ body }, 1), T = c.tentacles.list[0], r0 = Math.hypot(T.anchor.x, T.anchor.z);
      let low = 1, off = 0, drop = 0;
      for (let i = 0; i <= 60; i++) {
        c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim: i / 150 });
        const p = T.pts[0];
        low = Math.min(low, Math.hypot(p.x, p.z) / r0);
        off = Math.max(off, Math.abs(Math.hypot(p.x, p.z) / r0 - bellFlex(0, c.bend, f).k) * (i > 30 ? 0 : 1));   // (the roots follow the rim while it pulls in; later it lags back)
        drop = Math.max(drop, T.anchor.y - p.y);
      }
      seen[body] = { low: +low.toFixed(2), drop: +drop.toFixed(3) };
      // a Lash mid-stroke keeps its root on the rim
      c.tentacles.aim(0, c.root.localToWorld(new THREE.Vector3(0.3, 0.3, 0)), 0.8);
      c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim: 0.15 });
      const q = T.pts[0], rimK = bellFlex(0, c.bend, f).k, lash = Math.abs(Math.hypot(q.x, q.z) / r0 - rimK);
      c.tentacles.aim(0, null);
      if (lash > 0.08) bad.push(body + ' (lash root)');
      if (!(low < 0.85 && off < 0.08 && drop > 0.01)) bad.push(body);
      c.dispose();
    }
    return ok(!bad.length, { bad, seen });
  },
});

story('motion/frozen-copy-keeps-its-bend', {
  about: 'A copy of the jelly made mid-stroke (the victory scene, the death splay) keeps its bell\'s bend while the live jelly moves on.',
  setup() {},
  play() {
    const c = buildCharacter({ body: 'nettle' }, 1);
    for (let i = 0; i < 20; i++) c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim: i / 150 });
    const live = [];
    c.root.traverse((o) => { if (o.isMesh && o.material.customProgramCacheKey?.() === 'bell-flex') live.push(o.material); });
    if (!live.length) return ok(false, { why: 'no patched bell material' });
    const copy = freezeBell(live[0], live[0].clone()), before = bellFlex(0, c.bend, { k: 1, dy: 0 }).k;
    for (let i = 20; i < 60; i++) c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim: i / 150 });
    const moved = bellFlex(0, c.bend, { k: 1, dy: 0 }).k;
    const dummy = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>' };
    copy.onBeforeCompile(dummy);
    const kept = dummy.uniforms.bellFlex.value;
    c.dispose();
    return ok(Math.abs(moved - before) > 0.02 && Math.abs(kept.x - c.bend.x) > 0.01, { before, moved, kept: kept.toArray() });
  },
});
