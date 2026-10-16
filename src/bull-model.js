// The red plush bull on the changing table (act 3's second Elite, elites.js kind 'bull'), after the
// owner's photo: soft red minky, upright, a chunky rounded body that is head and body in one; a big
// cream oval muzzle with two small orange triangle nostrils and an orange smirk; half-lidded side-eye
// (white eyes, black pupils looking off to one side, black lids); two short cream felt horns bent
// outward; red cup-shaped ears sticking out sideways; a maroon oval belly patch; stubby arms and
// legs with maroon paw ends; a red string loop on top and a dark red curl on the forehead.
// Built in meters facing +z, feet on y = 0, about 40 cm tall to the horn tips (it reads from the
// game camera beside a 9 cm jelly). Every part shares ONE vertex-coloured plush material: the body
// (with everything that never moves) is one mesh, the eyes one (eyes.scale.y closes them while it
// sleeps) and each horn its own on a pivot at its root, in a copy of that material that can glow
// (horns.scale swells them for its rush): four draw calls. buildMiniBull() is the same bull, low
// poly and merged into one geometry, jelly-sized: the little bulls it summons.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RED = 0xc4121a, RED_DARK = 0xa00e14, MAROON = 0x6a1618, CREAM = 0xf4d6b8, HORN = 0xf0c4a0, ORANGE = 0xe8701e, WHITE = 0xfbfaf4, BLACK = 0x141012, CURL = 0x8e1418;
const _c = new THREE.Color(), _a = new THREE.Color();

// a part ready to merge: non-indexed, with a colour per vertex from `paint(x, y, z, out)`
function part(geo, paint) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { paint(p.getX(i), p.getY(i), p.getZ(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const solid = (hex) => (x, y, z, out) => out.setHex(hex);
// the minky's nap: red, a little lighter and darker in soft patches
const minky = (x, y, z, out) => out.setHex(RED).lerp(_a.setHex(RED_DARK), 0.3 + 0.3 * Math.sin(x * 90 + y * 70) * Math.sin(z * 80 + y * 40));
// red above `at` (m), maroon below it: the paws and hooves
const paw = (at) => (x, y, z, out) => (y < at ? out.setHex(MAROON) : minky(x, y, z, out));
const ellipsoid = (rx, ry, rz, x, y, z, seg = 18) => new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))).scale(rx, ry, rz).translate(x, y, z);
const capsule = (r, len, seg) => new THREE.CapsuleGeometry(r, len, Math.max(2, seg >> 2), seg);

// body: the chunky upright box (head and body in one, a little wider at the head)
const BODY = { w: 0.19, h: 0.29, d: 0.13, y: 0.055, r: 0.055 };
export const BULL = { height: 0.4, top: BODY.y + BODY.h, front: BODY.d / 2, halfW: BODY.w / 2 };

// every part of the bull: `lo` builds it low poly (the minis). Returns { body, eyes, horns } as
// lists of parts in the bull's own frame (horns: one list per horn, in the horn's frame, with its root)
function parts(lo = false) {
  const S = lo ? 8 : 20, F = BODY.d / 2;
  const body = [];
  const box = new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, lo ? 2 : 5, BODY.r).translate(0, BODY.y + BODY.h / 2, 0);
  { // wider at the head than at the hips: scale x by height
    const p = box.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (0.9 + 0.12 * (y - BODY.y) / BODY.h)); }
  }
  body.push(part(box, minky));
  // the maroon belly patch, a soft oval proud of the front
  body.push(part(ellipsoid(0.058, 0.075, 0.014, 0, 0.15, F - 0.004, S), solid(MAROON)));
  // the cream muzzle and its two orange triangle nostrils and the smirk
  const mY = 0.262;
  body.push(part(ellipsoid(0.05, 0.034, 0.016, 0, mY, F - 0.002, S), solid(CREAM)));
  if (!lo) {
    for (const s of [-1, 1]) body.push(part(new THREE.ConeGeometry(0.0075, 0.012, 3).rotateZ(Math.PI).scale(1, 1, 0.3).rotateZ(s * 0.35).translate(s * 0.017, mY + 0.01, F + 0.013), solid(ORANGE)));
    body.push(part(new THREE.TorusGeometry(0.013, 0.0022, 4, 10, 1.7).rotateZ(Math.PI + 0.55).translate(0.012, mY - 0.002, F + 0.013), solid(ORANGE)));   // the smirk, off to one side
    // the dark red curl on the forehead
    body.push(part(new THREE.TorusGeometry(0.011, 0.0018, 4, 14, Math.PI * 1.5).rotateZ(0.6).translate(0, 0.33, F - 0.005), solid(CURL)));
    body.push(part(new THREE.TorusGeometry(0.005, 0.0016, 4, 10, Math.PI * 1.4).rotateZ(-1.8).translate(0.006, 0.333, F - 0.003), solid(CURL)));
    // the red string loop on top
    body.push(part(new THREE.TorusGeometry(0.014, 0.0018, 4, 14).scale(0.7, 1.2, 1).translate(0, BULL.top + 0.012, 0), solid(0xe0201e)));
  }
  // the half-lidded side-eye: black lids over the tops of the eyes (part of the body: they stay put)
  const eY = 0.305;
  for (const s of [-1, 1]) {
    body.push(part(new THREE.BoxGeometry(0.052, 0.0035, 0.01).rotateZ(-s * 0.08).translate(s * 0.047, eY + 0.003, F + 0.003), solid(BLACK)));   // the lid's black edge
    body.push(part(new THREE.BoxGeometry(0.054, 0.008, 0.009).rotateZ(-s * 0.08).translate(s * 0.047, eY + 0.0085, F + 0.002), minky));          // the lid, over the top half of the eye
  }
  // the red cup ears sticking out sideways, darker inside
  for (const s of [-1, 1]) {
    body.push(part(ellipsoid(0.034, 0.024, 0.012, 0, 0, 0, S).rotateZ(s * 0.35).translate(s * (BODY.w / 2 + 0.03), 0.315, -0.005), minky));
    body.push(part(ellipsoid(0.026, 0.017, 0.006, 0, 0, 0, S).rotateZ(s * 0.35).translate(s * (BODY.w / 2 + 0.032), 0.316, 0.004), solid(RED_DARK)));
  }
  // stubby arms hanging at the sides, maroon paws; stubby legs, maroon hooves
  for (const s of [-1, 1]) {
    body.push(part(capsule(0.03, 0.13, S).rotateZ(s * 0.18).translate(s * (BODY.w / 2 + 0.012), 0.165, 0.005), paw(0.12)));
    body.push(part(capsule(0.034, 0.04, S).translate(s * 0.05, 0.05, 0.004), paw(0.035)));
  }
  // the eyes: whites with black pupils looking off to one side (a separate list: scale.y closes them)
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(part(ellipsoid(0.024, 0.01, 0.006, s * 0.047, 0, 0, S), solid(WHITE)));
    eyes.push(part(ellipsoid(0.0075, 0.0072, 0.004, s * 0.047 + 0.012, -0.001, 0.004, S), solid(BLACK)));
  }
  // the horns: short cream felt, going up from the top of the head and bending outward
  const horns = [-1, 1].map((s) => {
    const g = [part(new THREE.CylinderGeometry(0.009, 0.013, 0.03, lo ? 6 : 10).translate(0, 0.015, 0), solid(HORN)),
      part(new THREE.CylinderGeometry(0.0075, 0.009, 0.026, lo ? 6 : 10).translate(0, 0.013, 0).rotateZ(-s * 1.1).translate(0, 0.028, 0), solid(HORN))];
    return { s, parts: g, root: new THREE.Vector3(s * 0.05, BULL.top - 0.008, -0.004) };
  });
  return { body, eyes, eY, F, horns };
}

export function buildBull() {
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.92, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a8a) });
  const hornMat = mat.clone();                       // the same program, its own emissive: the horns glow as they swell
  hornMat.emissive = new THREE.Color(0x000000);
  const g = new THREE.Group();
  const P = parts();
  const body = new THREE.Mesh(mergeGeometries(P.body), mat);
  g.add(body);
  const eyes = new THREE.Mesh(mergeGeometries(P.eyes), mat);
  eyes.position.set(0, P.eY, P.F + 0.001);
  g.add(eyes);
  const horns = P.horns.map((h) => {
    const m = new THREE.Mesh(mergeGeometries(h.parts), hornMat);
    m.position.copy(h.root);
    m.rotation.z = -h.s * 0.25;
    g.add(m);
    return m;
  });
  return { group: g, body, eyes, horns, mat, hornMat };
}

// the little bulls it summons: one merged low-poly geometry, `tall` m high (a jelly's height),
// standing on y = 0 facing +z
export function buildMiniBull(tall = 0.09) {
  const P = parts(true);
  const geos = [...P.body, ...P.eyes.map((e) => e.translate(0, P.eY, P.F + 0.001))];
  for (const h of P.horns) for (const p of h.parts) geos.push(p.rotateZ(-h.s * 0.25).translate(h.root.x, h.root.y, h.root.z));
  return mergeGeometries(geos).scale(tall / BULL.height, tall / BULL.height, tall / BULL.height);
}
