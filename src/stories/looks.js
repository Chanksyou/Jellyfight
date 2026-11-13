// Stories: the Look screen's jelly parts. Every bell shows its arms, the second color lights the rim
// and the tentacle tips, the tentacles keep their color, and every arm style, tentacle style, bell
// pattern and new bell (character.js OPTIONS, SPECIES) builds into something you can see.
import * as THREE from 'three';
import { SPECIES, OPTIONS, buildCharacter } from '../character.js';
import { LOOK } from '../look.js';
import { ok, story } from './kit.js';

const ACC = '#ff00ff', idle = { speed: 0, walkSpeed: 1, grounded: true, vy: 0 };
const build = (look) => { const c = buildCharacter({ accent: ACC, ...look }, 1); c.update(1 / 60, idle); c.root.updateMatrixWorld(true); return c; };
// the arms: everything drawn in the arm material (the second color, unmixed)
const armsOf = (c) => { const out = []; c.root.traverse((o) => { if (o.isMesh && o.material.side === THREE.DoubleSide && o.material.color?.equals(new THREE.Color(ACC))) out.push(o); }); return out; };
// a mesh's vertices, summed, to tell two shapes apart
const shape = (list) => list.reduce((a, o) => { const p = o.geometry.attributes.position.array; let s = 0; for (let i = 0; i < p.length; i++) s += Math.abs(p[i]) * (1 + (i % 7)); return a + s; }, 0);

story('look/arms-show-on-every-jelly', {
  about: 'Every bell has at least four oral arms, and they hang below the rim and its fringe, so they show from the side.',
  setup() {},
  play() {
    const bad = [], seen = {};
    for (const [id, sp] of Object.entries(SPECIES)) {
      const c = build({ body: id }), arms = armsOf(c), bell = c.root.getObjectByName('Face').parent;
      const rimY = bell.getWorldPosition(new THREE.Vector3()).y, fringe = sp.fringe ? sp.fringe[2] : 0;
      const low = Math.min(...arms.map((o) => new THREE.Box3().setFromObject(o).min.y));
      seen[id] = { arms: arms.length, below: +(rimY - fringe - low).toFixed(3) };
      if (arms.length < 4 || rimY - fringe - low < 0.1) bad.push(id);
      c.dispose();
    }
    return ok(!bad.length, { bad, seen });
  },
});

story('look/second-color-lights-rim-and-tips', {
  about: 'The second color (the arms) also lights the rim and every tentacle tip, while the tentacles glow in the bell color without bleaching to white.',
  setup() {},
  play() {
    const c = build({ body: 'nettle', color: '#2050ff' }), rig = c.tentacles;
    const trim = new THREE.Color(ACC);
    let rim = false;
    c.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.material.emissive?.equals(trim)) rim = true; });
    const tips = rig.list.every((T) => T.tipMat !== T.mat && T.tipMat.color.equals(trim));
    const own = rig.list.every((T) => T.mat.color.equals(new THREE.Color('#2050ff')) && T.baseGlow === LOOK.num('jelly-tentacle-glow', 0.75) * 1 && T.baseGlow < 1.3);
    // a Lash still burns the whole tentacle, tip included, and the tip comes back to its color
    rig.aim(0, c.root.localToWorld(new THREE.Vector3(0, 0.2, 2)), 1);
    c.update(1 / 60, idle);
    const strike = rig.list[0].tipMat.emissive.equals(rig.list[0].mat.emissive);
    rig.aim(0, null);
    c.update(1 / 60, idle);
    const back = rig.list[0].tipMat.emissive.equals(rig.list[0].tipEmissive);
    c.dispose();
    return ok(rim && tips && own && strike && back, { rim, tips, own, strike, back });
  },
});

story('look/arm-and-tentacle-styles', {
  about: 'Every arm style and tentacle style changes the jelly: pom-poms end in a puff, ribbons are flat, beads bulge, curls wind, and the reach stays the same.',
  setup() {},
  play() {
    const arms = {}, tents = {};
    for (const [id] of OPTIONS.arms) { const c = build({ body: 'nettle', arms: id }), a = armsOf(c); arms[id] = { n: a.length, shape: shape(a) }; c.dispose(); }
    for (const [id] of OPTIONS.tentacles) {
      const c = build({ body: 'nettle', tentacles: id }), rig = c.tentacles;
      for (let i = 0; i < 30; i++) c.update(1 / 60, idle);
      tents[id] = { shape: shape(rig.list.map((T) => T.mesh)), length: rig.length };
      c.dispose();
    }
    const n = SPECIES.nettle.arms.n;
    const armsOk = arms.pompoms.n === 2 * n && ['curly', 'streamers', 'pompoms'].every((k) => Math.abs(arms[k].shape - arms.frilly.shape) > 1e-3);
    const tentsOk = ['curly', 'beaded', 'ribbon'].every((k) => Math.abs(tents[k].shape - tents.straight.shape) > 1e-3) && Object.values(tents).every((t) => t.length === tents.straight.length);
    return ok(armsOk && tentsOk, { arms, tents });
  },
});

story('look/every-pattern-paints-the-bell', {
  about: 'Every bell pattern paints something different on the inner bell.',
  setup() {},
  play() {
    const sums = {};
    for (const [id] of OPTIONS.pattern) {
      const c = build({ body: 'nettle', pattern: id });
      let canvas = null;
      c.root.traverse((o) => { if (!canvas && o.isMesh && o.material.emissiveMap?.image) canvas = o.material.emissiveMap.image; });
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7;
      sums[id] = s;
      c.dispose();
    }
    const distinct = new Set(Object.values(sums)).size === OPTIONS.pattern.length;
    return ok(distinct, { sums });
  },
});

story('look/new-bells', {
  about: 'The Gem bell is cut into flat facets and the Comb Jelly\'s rainbow rows ripple down it as it swims.',
  setup() {},
  play() {
    const g = build({ body: 'gem' });
    let faceted = false;
    g.root.traverse((o) => { if (o.isMesh && !o.geometry.index && o.geometry.attributes.position.count === 6 * 4 * 6) faceted = true; });
    g.dispose();
    const c = build({ body: 'comb' });
    let rows = null;
    c.root.traverse((o) => { if (o.isMesh && o.material.blending === THREE.AdditiveBlending && o.material.map?.wrapT === THREE.RepeatWrapping) rows = o.material.map; });
    const before = rows?.offset.y;
    c.update(0.5, idle);
    const ripples = !!rows && rows.offset.y !== before;
    c.dispose();
    return ok(faceted && ripples, { faceted, ripples });
  },
});
