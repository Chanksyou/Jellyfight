// The Mushroom Pillow (act 4's sofa Elite, elites.js kind 'pillow'), after the real prop on the
// sofa seat: a plush toadstool, a fat cream stem and a round red cap dotted with cream spots, its
// underside cream too. Built in meters facing +z, the stem's foot on y = 0, at the prop's size (38 cm
// across the cap, 44 cm tall; the elite shows it smaller, at KINDS scale, so it fits the game camera).
// It wakes with angry eyes on the stem's front.
//
// Two vertex-coloured plush materials (stem, cap), its cream spots, and the same spots glowing over
// them (unlit, in its hostile colour, opacity 0 until it gathers spores): four meshes and the eyes.
// The elite squashes `cap` (rest height `capY`) as it breathes in and puffs; nothing allocates per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes } from './enemies.js';

const STEM = 0xe0d6c2, STEM_DARK = 0xb8aa92, RED = 0xc8312b, RED_DARK = 0x8e1c18, SPOT = 0xf4ecdc, GILL = 0xe8dcc6;
export const PILLOW = { STEM_R: 0.12, STEM_H: 0.25, CAP_R: 0.19, CAP_H: 0.133, CAP_Y: 0.31, UNDER: 0.6 };
const _c = new THREE.Color(), _d = new THREE.Color();

// the cream spots on the cap, as directions from its middle (upper half, spread round)
const SPOTS = [[0, 1, 0, 0.3], [0.62, 0.62, 0.2, 0.26], [-0.55, 0.6, 0.45, 0.24], [0.1, 0.55, -0.75, 0.25], [-0.7, 0.45, -0.35, 0.22],
  [0.82, 0.25, -0.45, 0.2], [0.35, 0.3, 0.86, 0.22], [-0.9, 0.2, 0.2, 0.2], [-0.25, 0.25, -0.92, 0.19], [0.92, 0.18, 0.25, 0.17], [-0.42, 0.2, 0.86, 0.17]]
  .map(([x, y, z, r]) => ({ d: new THREE.Vector3(x, y, z).normalize(), r }));

// paint each vertex of a geometry by its position
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function buildPillow() {
  const g = new THREE.Group(), { STEM_R, STEM_H, CAP_R, CAP_H, CAP_Y, UNDER } = PILLOW;
  const plush = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, ...o });

  // the stem: a fat, soft cylinder, rounded at its foot, a seam round its middle
  const prof = [[0, 0], [0.8, 0], [0.95, 0.04], [1, 0.14], [1, 0.5], [0.97, 0.8], [0.9, 1]].map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r * STEM_R), y * STEM_H));
  const stemGeo = paint(new THREE.LatheGeometry(prof, 32), (x, y, z, o) => {
    const seam = 1 - THREE.MathUtils.smoothstep(Math.abs(y - STEM_H * 0.45), 0, 0.004);
    o.setHex(STEM).lerp(_d.setHex(STEM_DARK), Math.max(seam * 0.7, 0.35 * (1 - y / 0.04)));
  });
  const stem = new THREE.Mesh(stemGeo, plush({}));
  g.add(stem);

  // the cap: a round dome, its underside flattened and cream, red on top, darker where it meets
  // the underside
  const capGeo = new THREE.SphereGeometry(1, 40, 24), p = capGeo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * UNDER);
  capGeo.computeVertexNormals();
  paint(capGeo, (x, y, z, o) => {
    if (y < -0.02) return o.setHex(GILL).lerp(_d.setHex(STEM_DARK), 0.3 * (1 - Math.hypot(x, z)));
    o.setHex(RED).lerp(_d.setHex(RED_DARK), 0.4 * (1 - THREE.MathUtils.smoothstep(y, 0, 0.25)));
  });
  capGeo.scale(CAP_R, CAP_H, CAP_R);
  const cap = new THREE.Mesh(capGeo, plush({}));
  cap.position.y = CAP_Y;
  g.add(cap);

  // its cream spots, little round patches sewn on the cap, and the same patches glowing just over
  // them (the elite sets their colour and opacity); they ride on the cap, so they squash with it
  const spotGeo = (lift) => {
    const discs = SPOTS.map((s) => {
      const n = s.d, at = new THREE.Vector3(n.x * CAP_R, n.y * CAP_H, n.z * CAP_R).multiplyScalar(lift);
      const normal = new THREE.Vector3(n.x / CAP_R, n.y / CAP_H, n.z / CAP_R).normalize();
      return new THREE.CircleGeometry(s.r * CAP_R * 0.95, 16).lookAt(normal).translate(at.x, at.y, at.z);
    });
    const merged = mergeGeometries(discs);
    discs.forEach((d) => d.dispose());
    return merged;
  };
  const spots = new THREE.Mesh(spotGeo(1.006), new THREE.MeshStandardMaterial({ color: SPOT, roughness: 0.95 }));
  cap.add(spots);
  const glow = new THREE.Mesh(spotGeo(1.014), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  glow.renderOrder = 2;
  cap.add(glow);

  // angry eyes on the stem's front, under the cap
  const eyes = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.46 });
  eyes.scale.setScalar(0.07);
  eyes.position.set(0, STEM_H * 0.52, STEM_R * 0.93);
  g.add(eyes);

  return { group: g, stem, cap, glow, eyes, capY: CAP_Y };
}
