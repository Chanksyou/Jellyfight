// Shared procedural insect geometry and micro-surface normal maps for src/critters.js.
// Every geometry helper returns a non-indexed BufferGeometry with position, normal, uv and color
// attributes, guaranteed outward-facing CCW winding, so parts merge cleanly and stay 100%
// compatible with Batcher instancing (src/batch.js).
import * as THREE from 'three';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
}

// ------------------------------------------------------------------ lofted organic shells
// Loft a closed organic shell through an array of elliptical cross-sections along the Z axis.
// Each section: { z, y = 0, x = 0, rx, ry, top = 1, bot = 1, color = '#ffffff', ao = 1, uvScale = 1 }
//   top / bot: flatten (>0, <1) or arch (>1) the upper / lower half of the ellipse for realistic
//   insect dorsal shields (pronotum, elytra) and flatter ventral undersides.
//   ao: baked per-ring ambient occlusion multiplier (darkens inter-segmental seams for free).
export function loft(sections, radialSegs = 16, { capStart = true, capEnd = true, undersideAO = 0.25 } = {}) {
  const n = sections.length;
  const flip = sections[n - 1].z < sections[0].z;
  const ring = (s) => {
    const pts = [], c = new THREE.Color(s.color || '#ffffff'), ao = s.ao ?? 1;
    const x0 = s.x || 0, y0 = s.y || 0, top = s.top ?? 1, bot = s.bot ?? 1;
    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const yScale = sa >= 0 ? top : bot;
      const px = x0 + ca * s.rx;
      const py = y0 + sa * s.ry * yScale;
      const shade = ao * (1 - undersideAO * Math.max(0, -sa));
      pts.push({ x: px, y: py, z: s.z, u: j / radialSegs, r: c.r * shade, g: c.g * shade, b: c.b * shade });
    }
    return pts;
  };
  const rings = sections.map(ring);
  const zMin = Math.min(sections[0].z, sections[n - 1].z);
  const zSpan = Math.abs(sections[n - 1].z - sections[0].z) || 1;
  const pos = [], uv = [], col = [];
  const pushV = (p, v) => { pos.push(p.x, p.y, p.z); uv.push(p.u, v); col.push(p.r, p.g, p.b); };
  const tri = (a, va, b, vb, c, vc) => {
    if (flip) { pushV(a, va); pushV(c, vc); pushV(b, vb); }
    else { pushV(a, va); pushV(b, vb); pushV(c, vc); }
  };

  for (let i = 0; i < n - 1; i++) {
    const r0 = rings[i], r1 = rings[i + 1];
    const v0 = (sections[i].z - zMin) / zSpan, v1 = (sections[i + 1].z - zMin) / zSpan;
    for (let j = 0; j < radialSegs; j++) {
      const p00 = r0[j], p01 = r0[j + 1], p10 = r1[j], p11 = r1[j + 1];
      tri(p00, v0, p01, v0, p10, v1);
      tri(p01, v0, p11, v1, p10, v1);
    }
  }
  const cap = (s, r, isEnd) => {
    const c = new THREE.Color(s.color || '#ffffff'), ao = (s.ao ?? 1) * (1 - undersideAO * 0.25);
    const ctr = { x: s.x || 0, y: s.y || 0, z: s.z, u: 0.5, r: c.r * ao, g: c.g * ao, b: c.b * ao };
    const v = (s.z - zMin) / zSpan;
    for (let j = 0; j < radialSegs; j++) {
      if (isEnd) tri(ctr, v, r[j], v, r[j + 1], v);
      else tri(ctr, v, r[j + 1], v, r[j], v);
    }
  };
  if (capStart && (sections[0].rx > 1e-4 || sections[0].ry > 1e-4)) cap(sections[0], rings[0], false);
  if (capEnd && (sections[n - 1].rx > 1e-4 || sections[n - 1].ry > 1e-4)) cap(sections[n - 1], rings[n - 1], true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Segmented insect abdomen with real recessed inter-segmental grooves and darkened seam AO.
// spec: { z0, z1, y0, y1, rx, ry, rings, groove = 0.12, color, bandColor, top = 1, bot = 0.85, radial = 14 }
export function segmentedAbdomen({
  z0, z1, y0 = 0, y1 = 0, rx, ry, rings = 6, groove = 0.12,
  color = '#241008', bandColor = null, top = 1, bot = 0.82, radial = 14, arch = 0,
}) {
  const secs = [];
  const profile = (u) => Math.pow(Math.sin(Math.PI * Math.max(0.02, Math.min(0.98, u))), 0.62);
  const at = (u, pinch, col, ao) => {
    const p = profile(u) * (1 - pinch);
    const z = z0 + (z1 - z0) * u;
    const y = y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * arch;
    secs.push({ z, y, rx: Math.max(0.015, rx * p), ry: Math.max(0.015, ry * p), top, bot, color: col, ao });
  };
  at(0, 0.72, color, 0.78);
  for (let i = 0; i < rings; i++) {
    const c = bandColor && i % 2 === 1 ? bandColor : color;
    if (i > 0) at(i / rings, groove, color, 0.60);
    at((i + 0.45) / rings, 0, c, 1.0);
    at((i + 0.85) / rings, 0.02, c, 0.92);
  }
  at(1, 0.78, color, 0.78);
  return loft(secs, radial);
}

// Smooth tapered segmented limb (femur or tibia+tarsus) along a polyline of Vector3 points,
// with baked underside AO and clean UVs so it merges with lofted geometries.
export function taperedLimb(pts, radii, hex, sides = 7, undersideAO = 0.22) {
  const c = new THREE.Color(hex);
  const pos = [], uv = [], col = [];
  const dir = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), binorm = new THREE.Vector3();
  const rings = [];
  let totalLen = 0;
  const dists = [0];
  for (let i = 1; i < pts.length; i++) { totalLen += pts[i].distanceTo(pts[i - 1]); dists.push(totalLen); }
  totalLen ||= 1;

  for (let i = 0; i < pts.length; i++) {
    if (i === 0) dir.subVectors(pts[1], pts[0]).normalize();
    else if (i === pts.length - 1) dir.subVectors(pts[i], pts[i - 1]).normalize();
    else dir.subVectors(pts[i + 1], pts[i - 1]).normalize();
    up.set(0, 1, 0);
    if (Math.abs(dir.dot(up)) > 0.92) up.set(1, 0, 0);
    side.crossVectors(up, dir).normalize();
    binorm.crossVectors(dir, side).normalize();
    const r = radii[i], p = pts[i], ring = [];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = side.x * ca + binorm.x * sa, ny = side.y * ca + binorm.y * sa, nz = side.z * ca + binorm.z * sa;
      const shade = 1 - undersideAO * Math.max(0, -ny);
      ring.push({ x: p.x + nx * r, y: p.y + ny * r, z: p.z + nz * r, u: j / sides, r: c.r * shade, g: c.g * shade, b: c.b * shade });
    }
    rings.push(ring);
  }

  const pushV = (p, v) => { pos.push(p.x, p.y, p.z); uv.push(p.u, v); col.push(p.r, p.g, p.b); };
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i], r1 = rings[i + 1], v0 = dists[i] / totalLen, v1 = dists[i + 1] / totalLen;
    for (let j = 0; j < sides; j++) {
      pushV(r0[j], v0); pushV(r0[j + 1], v0); pushV(r1[j], v1);
      pushV(r0[j + 1], v0); pushV(r1[j + 1], v1); pushV(r1[j], v1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Ensure any Three.js primitive (Sphere, Cylinder, Tube) has non-indexed position, normal, uv and
// vertex colors so it merges cleanly with loft() and taperedLimb() geometries.
export function paintWithUV(geo, hex, undersideAO = 0.18) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const pos = geo.attributes.position, n = pos.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const norm = geo.attributes.normal;
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  const c = new THREE.Color(hex), a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const ny = norm ? norm.getY(k) : 0;
    const shade = 1 - undersideAO * Math.max(0, -ny);
    a[k * 3] = c.r * shade; a[k * 3 + 1] = c.g * shade; a[k * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// ------------------------------------------------------------------ procedural micro-surface normal maps
// Shared 128x128 tileable normal maps generated once on a 2D canvas (< 3 ms total).
// Kinds: 'chitin' (micro-punctures), 'striae' (elytra grooves), 'velvet' (organic fuzz),
// 'ommatidia' (hexagonal compound-eye microlenses).
const NORMAL_MAPS = {};
function heightToNormalCanvas(h, size, strength) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      d[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      d[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      d[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 2;
  return t;
}

export function bugNormalMap(kind, repeat = 3) {
  const key = `${kind}:${repeat}`;
  if (NORMAL_MAPS[key]) return NORMAL_MAPS[key];
  const S = 128, h = new Float32Array(S * S);
  const rnd = seeded(kind === 'chitin' ? 101 : kind === 'striae' ? 202 : kind === 'velvet' ? 303 : 404);
  if (kind === 'chitin') {
    for (let i = 0; i < S * S; i++) h[i] = 0.5 + (rnd() - 0.5) * 0.08;
    for (let k = 0; k < 220; k++) {
      const cx = rnd() * S, cy = rnd() * S, r = 1.4 + rnd() * 2.2, depth = 0.3 + rnd() * 0.35;
      const ri = Math.ceil(r);
      for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
        const d2 = (dx * dx + dy * dy) / (r * r);
        if (d2 < 1) { const idx = ((Math.floor(cy + dy) + S) % S) * S + ((Math.floor(cx + dx) + S) % S); h[idx] -= depth * (1 - d2) * (1 - d2); }
      }
    }
  } else if (kind === 'striae') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const groove = Math.pow(0.5 + 0.5 * Math.cos((x / S) * Math.PI * 2 * 14), 0.55);
      const pit = Math.sin((y / S) * Math.PI * 2 * 28 + (x & 3)) * 0.08;
      h[y * S + x] = groove * 0.72 + pit + (rnd() - 0.5) * 0.06;
    }
  } else if (kind === 'velvet') {
    for (let i = 0; i < S * S; i++) h[i] = rnd() * 0.45;
    for (let k = 0; k < 260; k++) {
      const x0 = rnd() * S, y0 = rnd() * S, len = 4 + rnd() * 5;
      for (let t = 0; t < len; t++) {
        const idx = ((Math.floor(y0 + t) + S) % S) * S + ((Math.floor(x0 + (rnd() - 0.5)) + S) % S);
        h[idx] += 0.35 * (1 - t / len);
      }
    }
  } else if (kind === 'ommatidia') {
    // Hexagonal microlens grid for compound eyes
    const cols = 16, rows = 14, dx = S / cols, dy = S / rows;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let best = 99;
      const gy = Math.floor(y / dy), gx = Math.floor(x / dx);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const r = gy + oy, cx = (gx + ox + (r & 1 ? 0.5 : 0)) * dx, cy = (r + 0.5) * dy;
        let ddx = x - cx, ddy = y - cy;
        if (ddx > S / 2) ddx -= S; else if (ddx < -S / 2) ddx += S;
        if (ddy > S / 2) ddy -= S; else if (ddy < -S / 2) ddy += S;
        const d = Math.hypot(ddx, ddy) / (dx * 0.55);
        if (d < best) best = d;
      }
      h[y * S + x] = Math.sqrt(Math.max(0, 1 - Math.min(1, best * best)));
    }
  }
  const tex = heightToNormalCanvas(h, S, kind === 'ommatidia' ? 2.4 : kind === 'striae' ? 1.5 : 1.1);
  tex.repeat.set(repeat, repeat);
  NORMAL_MAPS[key] = tex;
  return tex;
}

// ------------------------------------------------------------------ hybrid hero-bug GLB loader
// Loads a compressed GLB created by `node tools/bug-import.mjs` into a { [partName]: { geometry, material } }
// map so critters.js can attach scanned rigid shells onto procedural pivots + GaitRig 2-bone IK legs while
// staying 100% instanced inside Batcher (src/batch.js). Cached per URL; returns null on missing asset.
const BUG_GLBS = new Map();
export function loadBugParts(url, { patchMaterial } = {}) {
  if (BUG_GLBS.has(url)) return BUG_GLBS.get(url);
  const p = (async () => {
    const [{ GLTFLoader }, { fetchModel, meshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('./apartment.js'),
    ]);
    const decoder = await meshoptDecoder();
    const buffer = await fetchModel(url, null, !!decoder);
    const loader = new GLTFLoader();
    if (decoder) loader.setMeshoptDecoder(decoder);
    const { scene } = await loader.parseAsync(buffer, '');
    const out = {};
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.parent?.name || o.name || 'shell';
      if (patchMaterial) patchMaterial(o.material);
      out[name] = { geometry: o.geometry, material: o.material };
    });
    return out;
  })().catch(() => { BUG_GLBS.delete(url); return null; });
  BUG_GLBS.set(url, p);
  return p;
}

