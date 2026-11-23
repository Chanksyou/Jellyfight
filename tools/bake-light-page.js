// Runs inside the game page (tools/bake-light.mjs opens it): writes this act as played for Blender
// (tools/bake-light.py), and lays out the picture Blender bakes the room's shell into.
//  - The act as played: the layout is applied, hidden pieces are out, glass and see-through cards are
//    out (light passes), each piece keeps its colour and texture (so bounce light takes the right colour).
//  - The shell (walls, floors and ceilings: userData.structural, never the doors, which swing) is cut into
//    flat planes, one per direction a face looks and its place along that axis to the centimetre. Each
//    plane gets a rectangle in one picture, at its own texel size. The game finds a point's texel from its
//    world position and face direction alone (src/baked-light.js), so the shell needs no second UV set.
// Blender's axes: three (x, y, z) -> Blender (x, -z, y), in metres.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { bakeFingerprint } from '../src/baked-light.js';
import { BAKE_LIGHTS } from '../src/bake-lights.js';
import { BAKED_LAYOUT } from '../src/layout-baked.js';

const RES = { floor: 0.01, wall: 0.02, ceiling: 0.04 };   // metres a texel
const PAD = 3, MAX_W = 4096;                               // texels round each plane (Blender's bake margin fills them); the picture's width
// the plane axes for a face looking along axis a: [along, up] (the picture's u and v)
export const PLANE_AXES = [[2, 1], [0, 2], [0, 1]];

const inPoly = (x, z, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const solid = (m) => m && m.visible !== false && !m.transparent && !(m.transmission > 0);

// A lamp in the game's legacy units (intensity I, cutoff distance D, decay) as a Blender light in watts:
// they give the same light at half the lamp's reach, where legacy = I * 0.5^decay and Cycles' point
// light gives P / (4 pi^2 d^2) per unit of albedo. So P = pi^2 * D^2 * I * 2^-decay. Past that, the
// light falls off as real light does (inverse square), not at the legacy cutoff.
export const lampWatts = (I, D, decay) => Math.PI * Math.PI * D * D * I * Math.pow(2, -decay);
const toB = (v) => [+v.x.toFixed(4), +(-v.z).toFixed(4), +v.y.toFixed(4)];
const arrB = ([x, y, z]) => toB({ x, y, z });

export async function exportAct(stageId) {
  const { APT } = window, root = APT.root;
  root.updateMatrixWorld(true);
  APT.scene.updateMatrixWorld(true);

  // the rooms this act plays in (as tools/bake-ao-page.js), a little past their walls
  const region = new THREE.Box3(), v = new THREE.Vector3();
  for (const part of APT.loaded) for (const room of APT.meta.acts[part] || []) {
    for (const [x, z] of APT.plan.find(([name]) => name === room)?.[1] || []) region.expandByPoint(v.set(x, 0, z));
  }
  region.min.y = -0.5; region.max.y = 4;
  region.expandByVector(v.set(0.35, 0, 0.35));

  // the lamps, before anything else: pieces right round a lamp are its fixture (its shade, its bulb), which
  // shouldn't shadow its own light
  const lamps = [];
  APT.scene.traverse((o) => {
    if (o.userData.slot || !(o.isPointLight && o.userData.lamp || o.isSpotLight)) return;   // not the phone's slot copies, not the jelly's glow
    lamps.push(o);
  });
  const lampAt = lamps.map((L) => L.getWorldPosition(new THREE.Vector3()));

  const mats = new Map();       // source material -> its export copy (shell pieces get their own)
  const groups = new Map();     // export material -> { pos: [], uv: [], uv1: [] | null }
  const copyOf = (m, kind) => {
    const key = m.uuid + kind;
    if (mats.has(key)) return mats.get(key);
    const c = new THREE.MeshStandardMaterial({ color: m.color ? m.color.clone() : 0x999999, roughness: 1, metalness: 0, side: THREE.FrontSide });
    if (m.map?.image) c.map = m.map;
    c.name = `${kind}:${m.name || 'm'}:${mats.size}`;
    mats.set(key, c);
    return c;
  };
  const add = (mat, tri, uvs, shellUV) => {
    let g = groups.get(mat);
    if (!g) groups.set(mat, (g = { pos: [], uv: [], uv1: shellUV ? [] : null }));
    for (const p of tri) g.pos.push(p.x, p.y, p.z);
    for (const t of uvs) g.uv.push(t.x, t.y);
    if (shellUV) for (const t of shellUV) g.uv1.push(t[0], t[1]);
  };

  // pass 1: every solid triangle in world space; shell triangles looking straight along an axis are kept to lay out
  const shellTris = [];
  const m4 = new THREE.Matrix4(), box = new THREE.Box3(), size = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  let triangles = 0, fixtures = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.isBatchedMesh || !shown(o)) return;
    const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
    const list = [].concat(o.material), parts = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    const count = o.isInstancedMesh ? o.count : 1;
    const shell = o.userData.structural && !o.name.startsWith('door-') && !/door/i.test(o.parent?.name || '');
    for (let q = 0; q < count; q++) {
      if (o.isInstancedMesh) o.getMatrixAt(q, m4).premultiply(o.matrixWorld); else m4.copy(o.matrixWorld);
      if (!g.boundingBox) g.computeBoundingBox();
      box.copy(g.boundingBox).applyMatrix4(m4);
      const fixture = !shell && box.getSize(size).length() < 1.2 && lampAt.some((p) => box.distanceToPoint(p) < 0.12);
      if (fixture) fixtures++;
      for (const part of parts) {
        const sm = list[part.materialIndex];
        if (!solid(sm)) continue;
        for (let i = part.start; i < part.start + part.count; i += 3) {
          const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
          A.fromBufferAttribute(pos, ia).applyMatrix4(m4); B.fromBufferAttribute(pos, ib).applyMatrix4(m4); C.fromBufferAttribute(pos, ic).applyMatrix4(m4);
          const uvs = [ia, ib, ic].map((k) => (uv ? new THREE.Vector2().fromBufferAttribute(uv, k) : new THREE.Vector2()));
          triangles++;
          if (shell) {
            n.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A));
            const area = n.length();
            if (area > 1e-10) {
              n.divideScalar(area);
              const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].findIndex((c) => c > 0.999);
              const mid = e1.copy(A).add(B).add(C).divideScalar(3);
              // only faces looking into a room, inside its walls (not the walls' outsides, nor the top of the ceiling)
              const front = e2.copy(mid).addScaledVector(n, 0.05);
              if (a >= 0 && region.containsPoint(mid) && front.y > 0 && !(a === 1 && (n.y > 0) === (mid.y > 1.5)) && APT.plan.some(([, poly]) => inPoly(front.x, front.z, poly))) {
                const sign = n.getComponent(a) > 0 ? 0 : 1, o6 = a * 2 + sign;
                shellTris.push({ o6, a, k: Math.round(mid.getComponent(a) * 100), tri: [A.clone(), B.clone(), C.clone()], uvs, mat: copyOf(sm, 'shell') });
                continue;
              }
            }
          }
          add(copyOf(sm, fixture ? 'fixture' : 'solid'), [A.clone(), B.clone(), C.clone()], uvs, null);
        }
      }
    }
  });

  // pass 2: the planes, each a rectangle in the picture
  const planes = new Map();
  for (const t of shellTris) {
    const key = t.o6 * 100000 + t.k;
    let p = planes.get(key);
    if (!p) planes.set(key, (p = { o: t.o6, k: t.k, a: t.a, lo: [Infinity, Infinity], hi: [-Infinity, -Infinity], res: t.a === 1 ? (t.o6 === 2 ? RES.floor : RES.ceiling) : RES.wall }));
    const [ua, va] = PLANE_AXES[t.a];
    for (const P of t.tri) {
      p.lo[0] = Math.min(p.lo[0], P.getComponent(ua)); p.hi[0] = Math.max(p.hi[0], P.getComponent(ua));
      p.lo[1] = Math.min(p.lo[1], P.getComponent(va)); p.hi[1] = Math.max(p.hi[1], P.getComponent(va));
    }
    t.plane = p;
  }
  const list = [...planes.values()];
  for (const p of list) { p.w = Math.ceil((p.hi[0] - p.lo[0]) / p.res) + 1 + PAD * 2; p.h = Math.ceil((p.hi[1] - p.lo[1]) / p.res) + 1 + PAD * 2; }
  // shelf packing, tallest first
  list.sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, shelf = 0, W = 0;
  for (const p of list) {
    if (p.w > MAX_W) throw new Error(`plane ${p.o}/${p.k} is ${p.w} texels wide`);
    if (x + p.w > MAX_W) { x = 0; y += shelf; shelf = 0; }
    p.u0 = x + PAD; p.v0 = y + PAD; x += p.w; shelf = Math.max(shelf, p.h); W = Math.max(W, x);
  }
  const H = y + shelf;
  // texel coordinates of a world point on a plane: (along - lo) / res + u0 (the picture's top row is v = 0)
  for (const t of shellTris) {
    const p = t.plane, [ua, va] = PLANE_AXES[t.a];
    const uv1 = t.tri.map((P) => [((P.getComponent(ua) - p.lo[0]) / p.res + p.u0) / W, ((P.getComponent(va) - p.lo[1]) / p.res + p.v0) / H]);
    add(t.mat, t.tri, t.uvs, uv1);
  }

  // the export scene: one mesh per material
  const scene = new THREE.Scene();
  for (const [mat, g] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    if (g.uv1) geo.setAttribute('uv1', new THREE.Float32BufferAttribute(g.uv1, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = mat.name;
    scene.add(mesh);
  }
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, maxTextureSize: 256 });

  // the light list: the act's lamps as played, then the lights only the bake has (src/bake-lights.js)
  const lights = lamps.map((L, i) => {
    const p = lampAt[i], out = { kind: L.isSpotLight ? 'spot' : 'point', at: toB(p), color: L.color.toArray().map((c) => +c.toFixed(4)), watts: +lampWatts(L.intensity, L.distance || 4, L.decay || 2).toFixed(3), radius: 0.03, set: 'lamps' };
    if (L.isSpotLight) { const t = L.target.getWorldPosition(new THREE.Vector3()); out.to = toB(t); out.angle = L.angle; out.blend = L.penumbra; }
    return out;
  });
  const own = BAKE_LIGHTS[stageId] || {};
  return {
    glb: new Uint8Array(glb),
    meta: {
      stage: stageId, parts: [...APT.loaded], atlas: [W, H], made: await bakeFingerprint(stageId, [...APT.loaded], BAKED_LAYOUT[stageId]),
      planes: list.map((p) => ({ o: p.o, k: p.k, res: p.res, lo: p.lo.map((c) => +c.toFixed(4)), u0: p.u0, v0: p.v0, w: p.w - PAD * 2, h: p.h - PAD * 2 })),
    },
    scene: { lamps: lights, extra: (own.lights || []).map((L) => ({ ...L, ...(L.at && { at: arrB(L.at) }), ...(L.to && { to: arrB(L.to) }), ...(L.dir && { dir: arrB(L.dir) }) })), sets: own.sets || ['lamps'], exposure: own.exposure ?? 1, samples: own.samples },
    stats: { triangles, shell: shellTris.length, planes: list.length, fixtures, materials: groups.size },
  };
}
