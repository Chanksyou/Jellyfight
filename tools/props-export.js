// Bakes the prop library (content/props.kdl) out of the apartment's own plant builders: each prop
// is built alone at the origin (pot on y=0), then its pieces are merged into at most two meshes,
// "solid" (pot, soil, stems) and "leaf" (the instanced foliage, double sided), coloured per vertex,
// so a prop costs two draw calls and a library of them one small file (assets/props.glb).
// Runs inside tools/apartment-source.html, whose builders (rubber, snake, monstera, pot, rosette …)
// are in the page's window.APT.kit; tools/props.mjs calls window.exportProps(specs).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// source= in content/props.kdl names one of these. Each draws one plant at the origin, at the size
// it has in the living room (size=1 in the layout). The room has no builder for a spider plant, a
// loose aloe or a potted pothos (those hang from the ceiling or sit on shelves), so these three
// are drawn here from the same helpers.
const BUILD = (kit) => {
  const { rubber, snake, monstera, pot, rosette, bush, leaf, mat, V, E, rr, rnd } = kit;
  return {
    rubber: () => rubber(0, 0, 0, 1.7, mat.potGray),
    snake: () => snake(0, 0, 0, 1.3, mat.potGray),
    monstera: () => monstera(0, 0),
    aloe: () => {
      const top = pot(0, 0, 0, 0.1, 0.13, mat.potTerra);
      rosette(0, top, 0, 20, 0.34, 0.035, 'aloe', 0.2, 1.1);
    },
    pothos: () => {
      const top = pot(0, 0, 0, 0.12, 0.16, mat.potWhite);
      bush(0, top, 0, 0.13, 24, 'leafMid', null);
      for (let v = 0; v < 9; v++) {
        const a = (v / 9) * 6.28 + rr(-0.3, 0.3);
        let px = Math.cos(a) * 0.1, pz = Math.sin(a) * 0.1, py = top;
        for (let i = 0, n = 2 + (rnd() * 3 | 0); i < n; i++) {   // vines drape down the pot, never below its foot
          py -= 0.026; px += Math.cos(a) * 0.02; pz += Math.sin(a) * 0.02;
          leaf('oval', rnd() < 0.5 ? 'leafMid' : 'pothos', V(px, py, pz), E(rr(-1, 1), rnd() * 6.28, rr(-1, 1)), V(0.04, 0.007, 0.03), null);
        }
      }
    },
    spider: () => {
      const top = pot(0, 0, 0, 0.1, 0.14, mat.potWhite);
      rosette(0, top, 0, 34, 0.34, 0.016, 'leafLight', 0.5, 1.25, null);
      rosette(0, top, 0, 14, 0.3, 0.014, 'pothos', 0.9, 1.35, null);
    },
  };
};

// the apartment's leaves are 14x9 spheres: fine in a room of instances, too many triangles for one prop
const LOW_LEAF = new THREE.SphereGeometry(1, 8, 5);

function build(source) {
  const kit = window.APT.kit, scene = window.APT.scene, { LEAF, GEO, buildLeaves } = kit;
  const make = BUILD(kit)[source];
  if (!make) throw new Error(`props: no builder called "${source}" in tools/props-export.js`);
  const before = new Set(scene.children), saved = { ...LEAF }, oval = GEO.oval;
  for (const k in LEAF) delete LEAF[k];
  GEO.oval = LOW_LEAF;
  kit.seed(20260918);   // the same plant every bake
  try {
    make();
    buildLeaves();
  } finally {
    GEO.oval = oval;
    for (const k in LEAF) delete LEAF[k];
    Object.assign(LEAF, saved);
  }
  const made = scene.children.filter((o) => !before.has(o));
  scene.updateMatrixWorld(true);
  const parts = { solid: [], leaf: [] }, m4 = new THREE.Matrix4();
  const add = (kind, geo, matrix, color) => {
    const g = geo.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    g.applyMatrix4(matrix);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < rgb.length; i += 3) { rgb[i] = color.r; rgb[i + 1] = color.g; rgb[i + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts[kind].push(g);
  };
  for (const o of made) o.traverse((m) => {
    if (m.isInstancedMesh) {
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, m4); add('leaf', m.geometry, m4.clone().premultiply(m.matrixWorld), m.material.color); }
    } else if (m.isMesh) add('solid', m.geometry, m.matrixWorld, m.material.color);
  });
  for (const o of made) scene.remove(o);
  return parts;
}

export async function exportProps(specs) {
  const solid = new THREE.MeshStandardMaterial({ name: 'prop-solid', vertexColors: true, roughness: 0.65, metalness: 0 });
  const leafM = new THREE.MeshStandardMaterial({ name: 'prop-leaf', vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
  const root = new THREE.Group();
  for (const { id, source } of specs) {
    const parts = build(source), g = new THREE.Group();
    g.name = id;
    for (const [kind, material] of [['solid', solid], ['leaf', leafM]]) {
      if (!parts[kind].length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(parts[kind]), material);
      mesh.name = id + '-' + kind;
      g.add(mesh);
    }
    root.add(g);
  }
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  let bin = '';
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
