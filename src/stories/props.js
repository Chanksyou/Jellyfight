// Stories: the prop library (content/props.kdl, src/props.js, assets/props.glb baked by tools/props.mjs).
import * as THREE from 'three';
import { parse } from '../kdl.js';
import { CONTENT, compileProps } from '../content.js';
import { loadProps } from '../props.js';
import { ok, story } from './kit.js';

const TRIANGLES = 8000;   // per prop: the leaves are most of it, and a prop is drawn in every room it's added to
const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

story('props/every-prop-loads', {
  about: 'Each prop in content/props.kdl loads from assets/props.glb as one group named by its id: standing on y=0, in one connected piece (its pot and leaves touch), no lights, at most 2 materials, under the triangle cap, plain float positions for collision.',
  setup() {},
  async play() {
    const ids = CONTENT.props.map((p) => p.id), got = await loadProps(ids), bad = [], report = {};
    for (const id of ids) {
      const t = got[id], meshes = [], lights = [], mats = new Set(), box = new THREE.Box3();
      if (!t) { bad.push(`${id}: missing`); continue; }
      t.updateWorldMatrix(true, true);
      t.traverse((o) => { if (o.isMesh) meshes.push(o); if (o.isLight) lights.push(o); });
      const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m));
      boxes.forEach((b) => box.union(b));
      meshes.forEach((m) => [].concat(m.material).forEach((x) => mats.add(x)));
      const t3 = meshes.reduce((n, m) => n + tris(m), 0), size = box.getSize(new THREE.Vector3());
      report[id] = { tris: t3, mats: mats.size, h: +size.y.toFixed(2) };
      const why = [];
      if (t.name !== id) why.push('name');
      if (!meshes.length) why.push('no meshes');
      if (lights.length) why.push('has lights');
      if (mats.size > 2) why.push(`${mats.size} materials`);
      if (t3 > TRIANGLES) why.push(`${t3} triangles`);
      if (Math.abs(box.min.y) > 0.01) why.push(`stands at y=${box.min.y.toFixed(3)}`);
      if (size.y < 0.1 || size.y > 2.5) why.push(`${size.y.toFixed(2)} m tall`);
      if (!boxes.every((b, i) => boxes.some((c, j) => i !== j && b.intersectsBox(c)) || boxes.length === 1)) why.push('pieces apart');
      if (!meshes.every((m) => m.geometry.attributes.position.array instanceof Float32Array)) why.push('packed positions');
      if (why.length) bad.push(`${id}: ${why.join(', ')}`);
    }
    return ok(!bad.length && ids.length >= 6, { bad, report });
  },
});

story('props/the-file-comes-down-only-when-asked', {
  about: 'Importing the library downloads nothing: assets/props.glb(.gz) is fetched by the first loadProps call, once, and a second call (any other prop) reuses it, so an act that adds no prop never pays for it.',
  setup() {},
  async play() {
    const asked = [], real = window.fetch;
    window.fetch = (u, ...a) => { asked.push(String(u)); return real.call(window, u, ...a); };
    try {
      const lib = await import('../props.js?fresh');   // its own copy of the module: nothing cached yet
      const before = asked.filter((u) => /props/.test(u)).length;
      await lib.loadProps([CONTENT.props[0].id]);
      const first = asked.filter((u) => /props/.test(u)).length;
      await lib.loadProps([CONTENT.props[1].id]);
      const second = asked.filter((u) => /props/.test(u)).length;
      return ok(before === 0 && first === 1 && second === 1, { before, first, second });
    } finally { window.fetch = real; }
  },
});

story('content/props-library-is-checked', {
  about: 'content/props.kdl names every prop once, with a label, a size from 0.5 to 2 and where it stands; a duplicate id, a missing label, a size out of range or an unknown stick= stops loading with the line named.',
  setup() {},
  play() {
    const fails = (kdl) => { try { compileProps(parse(kdl, 'props.kdl'), 'props.kdl'); return null; } catch (e) { return e.message; } };
    const good = 'prop "fern" source="fern" label="Fern" size=1 stick="surface"\n';
    const cases = {
      good: fails(good),
      twice: fails(good + good),
      noLabel: fails('prop "fern" source="fern" size=1 stick="surface"'),
      tooBig: fails('prop "fern" source="fern" label="Fern" size=3 stick="surface"'),
      hangs: fails('prop "fern" source="fern" label="Fern" size=1 stick="ceiling"'),
      badId: fails('prop "rubber-plant" source="fern" label="Fern" size=1 stick="surface"'),
    };
    const named = Object.entries(cases).filter(([k, m]) => k !== 'good').every(([, m]) => /props\.kdl:\d+/.test(m));
    return ok(cases.good === null && named, cases);
  },
});
