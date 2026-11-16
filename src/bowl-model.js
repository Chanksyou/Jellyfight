// The Singing Bowl (act 4's first Elite, elites.js kind 'bowl'), after the real prop on the lounge
// chair: a hammered bronze bowl, dark with gold bands round its rim and its belly, sitting in a round
// golden-yellow cushion, its dark wooden striker leaning on it. Built in meters facing +z, the
// cushion's foot on y = 0, life size: the bowl 12 cm across and 6 cm deep (the elite shows it at
// KINDS scale). It wakes with angry eyes on the bowl's front.
//
// Three vertex-coloured materials (bronze, cushion, wood) and the song glowing inside the bowl
// (unlit, in its hostile colour): four meshes and the eyes. The elite moves the striker with
// pose(): `orbit` turns it round the bowl, `striker` tips it at the rim; nothing allocates per frame.
import * as THREE from 'three';
import { angryEyes } from './enemies.js';

const BRONZE = 0x4a3418, BRONZE_DARK = 0x3d2a10, GOLD = 0xcba24b, CUSHION = 0xe8b42a, CUSHION_DARK = 0xbd870b, WOOD = 0x411a08, WOOD_END = 0x6a3818;
export const BOWL = { R: 0.06, H: 0.06, SEAT: 0.047, CUSHION_R: 0.066, CUSHION_H: 0.024, STRIKER: 0.118 };
const _c = new THREE.Color(), _d = new THREE.Color();

// paint each vertex of a geometry by its position
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function buildBowl() {
  const g = new THREE.Group(), { R, H, SEAT, CUSHION_R, CUSHION_H, STRIKER } = BOWL;
  const vc = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });

  // the cushion: a squashed round pillow, a darker seam round its middle
  const cushion = paint(new THREE.SphereGeometry(1, 28, 14).scale(CUSHION_R, CUSHION_H, CUSHION_R).translate(0, CUSHION_H, 0), (x, y, z, o) => {
    const seam = 1 - THREE.MathUtils.smoothstep(Math.abs(y - CUSHION_H), 0, 0.004);
    o.setHex(CUSHION).lerp(_d.setHex(CUSHION_DARK), Math.max(seam * 0.8, 0.25 * (1 - y / CUSHION_H)));
  });
  g.add(new THREE.Mesh(cushion, vc({ roughness: 0.75 })));

  // the bowl: the prop's lathe profile (rim at the top, round belly), a thin wall turned back in at
  // the lip so it reads open; dark hammered bronze with gold bands at the rim and round the belly
  const OUT = [[1, 0.5], [0.98, 0.3], [0.92, 0.12], [0.83, -0.06], [0.71, -0.21], [0.56, -0.33], [0.38, -0.42], [0.2, -0.48], [0, -0.5]];
  const lip = 0.06, pts = [
    ...OUT.map(([r, y]) => [r * (1 - lip), y + 0.02]).reverse().filter(([, y]) => y < 0.5),   // inside, from the bottom up
    [1 - lip / 2, 0.52],                                                                       // the lip
    ...OUT,                                                                                    // outside, rim down
  ].map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r * R), SEAT + (y + 0.5) * H));
  const bowl = paint(new THREE.LatheGeometry(pts, 40), (x, y, z, o) => {
    const h = (y - SEAT) / H, a = Math.atan2(x, z);
    const band = h > 0.86 || (h > 0.52 && h < 0.6) ? 1 : 0;
    o.setHex(BRONZE).lerp(_d.setHex(BRONZE_DARK), 0.5 + 0.5 * Math.sin(a * 23) * Math.sin(h * 40));   // hammer marks
    if (band) o.setHex(GOLD).lerp(_d.setHex(BRONZE), 0.25 * (0.5 + 0.5 * Math.sin(a * 60)));        // the etched gold bands
  });
  const body = new THREE.Mesh(bowl, vc({ metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
  g.add(body);

  // its song, glowing in the bowl: a disc just under the rim (the elite sets its colour and opacity)
  const song = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  song.position.y = SEAT + H * 0.82;
  song.renderOrder = 2;
  g.add(song);

  // the striker: a dark wooden rod, its pivot at the handle end; `orbit` turns it round the bowl
  const orbit = new THREE.Group(), striker = new THREE.Group();
  const rod = paint(new THREE.CylinderGeometry(0.0072, 0.0078, STRIKER, 10).translate(0, STRIKER / 2, 0), (x, y, z, o) => o.setHex(WOOD).lerp(_d.setHex(WOOD_END), y > STRIKER - 0.012 ? 0.6 : 0));
  striker.add(new THREE.Mesh(rod, vc({ roughness: 0.6 })));
  orbit.add(striker);
  g.add(orbit);

  // angry eyes on the bowl's front
  const eyes = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.42 }), face = new THREE.Group();   // (the elite blinks `eyes` by its scale.y, so the sizing is on `face`: it stretched them 30 times tall)
  face.scale.setScalar(0.034);
  face.position.set(0, SEAT + H * 0.55, R * 0.86);
  face.add(eyes);
  g.add(face);

  // where the striker is: `at` 'rest' (leaning on the bowl's back), 'strike' (k: 0 raised over the
  // right side of the rim, 1 on it), 'sing' (held to the rim, round at `turn` rad)
  const pose = (at, k = 0, turn = 0) => {
    if (at === 'strike') { orbit.rotation.y = 0; striker.position.set(0.15, 0.04, 0); striker.rotation.set(0, 0, THREE.MathUtils.lerp(-0.25, 0.97, k)); }
    else { orbit.rotation.y = at === 'sing' ? turn : -2.2; striker.position.set(0.115, 0, 0); striker.rotation.set(0, 0, 0.51); }
  };
  pose('rest');
  return { group: g, body, song, orbit, striker, eyes, pose };
}
