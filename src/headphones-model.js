// The Headphones (act 4's kitchen-counter Elite, elites.js kind 'headphones'), after the real pair on
// its stand there: black over-ear headphones with pale grey cushions. Come alive, they stand on the
// counter on their two ear cups, swivelled flat to face forward like a pair of speakers, the band
// arching over them. Built in meters facing +z, the cups' feet on y = 0, life size (21 cm across,
// 18 cm tall). It wakes with angry eyes on the band's padding.
//
// Two vertex-coloured materials (the black plastic, the grey cushions and padding) and, in each cup,
// its speaker glowing (unlit, opacity 0 until it plays; the elite sets its colour: white for a shove
// wave, its hostile colour for a bass Shot): five meshes and the eyes. The elite pumps each cup
// (`cups[i]`, rest at `cupAt[i]`) as it plays; `mouths[i]` is the middle of that cup's speaker.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angryEyes } from './enemies.js';

const BLACK = 0x17171b, BLACK_EDGE = 0x34343c, GREY = 0xcacaca, GREY_DARK = 0x8e8e94, CLOTH = 0x2a2a30;
export const HEADPHONES = { CUP_R: 0.045, CUP_D: 0.032, APART: 0.078, CUP_Y: 0.047, BAND_R: 0.09, BAND_T: 0.009 };
const _c = new THREE.Color(), _d = new THREE.Color();

// paint each vertex of a geometry by its position
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function buildHeadphones() {
  const g = new THREE.Group(), { CUP_R, CUP_D, APART, CUP_Y, BAND_R, BAND_T } = HEADPHONES;
  const plastic = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  const soft = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glowMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  // one cup, its speaker facing +z: the black shell (a rounded puck, its back edge lighter where the
  // light catches it), the grey cushion ring round the front, the dark speaker cloth inside it
  const shell = paint(new THREE.CylinderGeometry(CUP_R, CUP_R * 0.92, CUP_D, 32, 1).rotateX(Math.PI / 2), (x, y, z, o) => {
    o.setHex(BLACK).lerp(_d.setHex(BLACK_EDGE), THREE.MathUtils.smoothstep(Math.hypot(x, y) / CUP_R, 0.8, 1) * 0.6);
  });
  const cushion = paint(new THREE.TorusGeometry(CUP_R * 0.78, CUP_R * 0.24, 10, 32).translate(0, 0, CUP_D / 2 + CUP_R * 0.12), (x, y, z, o) => {
    o.setHex(GREY).lerp(_d.setHex(GREY_DARK), THREE.MathUtils.smoothstep(Math.hypot(x, y) / CUP_R, 0.7, 0.55) * 0.5);
  });
  const cloth = new THREE.CircleGeometry(CUP_R * 0.6, 24).translate(0, 0, CUP_D / 2 + 0.001);
  const cupGeo = mergeGeometries([shell, paint(cloth, (x, y, z, o) => o.setHex(CLOTH))]);
  const glowGeo = new THREE.CircleGeometry(CUP_R * 0.6, 24).translate(0, 0, CUP_D / 2 + 0.003);
  const cups = [], glows = [], cupAt = [], mouths = [];
  for (const side of [-1, 1]) {
    const cup = new THREE.Group();
    cup.position.set(side * APART, CUP_Y, 0);
    cup.add(new THREE.Mesh(cupGeo, plastic), new THREE.Mesh(cushion, soft));
    const glow = new THREE.Mesh(glowGeo, glowMat());
    glow.renderOrder = 2;
    cup.add(glow);
    g.add(cup);
    cups.push(cup); glows.push(glow); cupAt.push(cup.position.clone());
    mouths.push(new THREE.Vector3(side * APART, CUP_Y, CUP_D / 2 + CUP_R * 0.3));
  }

  // the band: an arch from one cup's top to the other's (the yokes are its ends), black outside, its
  // grey padding along the underside of the top
  const arch = new THREE.TorusGeometry(BAND_R, BAND_T, 8, 40, Math.PI).translate(0, CUP_Y + CUP_R * 0.5, -CUP_D * 0.2);
  const pad = new THREE.TorusGeometry(BAND_R - BAND_T * 1.2, BAND_T * 0.9, 8, 24, Math.PI * 0.5).rotateZ(Math.PI * 0.25).translate(0, CUP_Y + CUP_R * 0.5, -CUP_D * 0.2);
  const band = new THREE.Mesh(mergeGeometries([paint(arch, (x, y, z, o) => o.setHex(BLACK)), paint(pad, (x, y, z, o) => o.setHex(GREY))]), plastic);
  g.add(band);

  // angry eyes on the padding at the top of the band, looking forward
  const eyes = angryEyes({ y: 0, z: 0, size: 0.34, gap: 0.46 }), face = new THREE.Group();   // (the elite blinks `eyes` by its scale.y, so the sizing is on `face`)
  face.scale.setScalar(0.05);
  face.position.set(0, CUP_Y + CUP_R * 0.5 + BAND_R * 0.9, -CUP_D * 0.2 + BAND_T * 1.4);
  face.add(eyes);
  g.add(face);

  return { group: g, band, cups, cupAt, glows, mouths, eyes };
}
