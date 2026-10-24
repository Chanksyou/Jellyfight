// Original procedural BLÅHAJ-style plush, using ZoeSmile's Sketchfab model as a visual reference:
// https://sketchfab.com/3d-models/blahaj-plush-27af14d4c2434442b3b6a969bff8d394
// Metres, nose toward +z, belly resting at y=0. Two opaque draws; no fur shells or lights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ellipsoid = (x, y, z, rx, ry, rz) => new THREE.SphereGeometry(1, 28, 20).scale(rx, ry, rz).translate(x, y, z);

function tint(geometry, color) {
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    color(p.getX(i), p.getY(i), p.getZ(i), c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// A stuffed fin: rounded outline, two convex fabric panels meeting at the perimeter.
function fin(points, normal, thickness) {
  const edge = new THREE.CatmullRomCurve3(points.map(p => V(...p)), true, 'centripetal');
  const N = 48, R = 8, centre = points.reduce((c, p) => c.add(V(...p)), V(0, 0, 0)).multiplyScalar(1 / points.length);
  const positions = [], uv = [], indices = [];
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    for (let r = 0; r <= R; r++) for (let i = 0; i <= N; i++) {
      const t = r / R, p = edge.getPoint(i / N).lerp(centre, 1 - t);
      p.addScaledVector(normal, side * thickness * Math.cos(t * Math.PI / 2));
      positions.push(p.x, p.y, p.z); uv.push(i / N, t);
      if (r < R && i < N) {
        const a = base + r * (N + 1) + i, b = a + N + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  // Orient both panels outward independently of the outline's winding.
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const side = i < n.count / 2 ? -1 : 1;
    if ((n.getX(i) * normal.x + n.getY(i) * normal.y + n.getZ(i) * normal.z) * side < 0) {
      n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    }
  }
  // Back-face culling uses winding, not normals; match each panel to its outward normals.
  const p = g.attributes.position, a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(p, indices[i]); b.fromBufferAttribute(p, indices[i + 1]); c.fromBufferAttribute(p, indices[i + 2]);
    if (b.sub(a).cross(c.sub(a)).dot(V(n.getX(indices[i]), n.getY(indices[i]), n.getZ(indices[i]))) < 0) {
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
  }
  g.setIndex(indices);
  return g;
}

function fabricGrain() {
  const S = 128, pixels = new Uint8Array(S * S * 4);
  let seed = 73;
  for (let i = 0; i < S * S; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 112 + (seed >>> 27);
    pixels.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(pixels, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 5); t.needsUpdate = true;
  return t;
}

export function buildShark() {
  const blue = new THREE.Color(LOOK.color('shark-blue', '#506f83'));
  const cream = new THREE.Color(LOOK.color('shark-belly', '#e7e3d6'));
  const pink = new THREE.Color(LOOK.color('shark-mouth', '#bc7c83'));
  const dark = new THREE.Color(LOOK.color('shark-eye', '#181d23'));
  const seam = blue.clone().multiplyScalar(0.64);
  const solid = color => (x, y, z, out) => out.copy(color);
  const cloth = [], eyes = [];
  const paint = (x, y, z, out) => {
    const belly = 1 - THREE.MathUtils.smoothstep(y, 0.065, 0.09);
    return out.copy(blue).lerp(cream, belly);
  };
  // A single continuous body, softly squashed underneath and tapering into the tail stock.
  // z, half-width, half-height, centre height; the nose is deliberately blunt.
  const profile = new THREE.CatmullRomCurve3([
    V(-0.49, 0.005, 0.009), V(-0.39, 0.034, 0.04), V(-0.25, 0.082, 0.071),
    V(-0.08, 0.135, 0.114), V(0.10, 0.157, 0.139), V(0.25, 0.139, 0.12),
    V(0.36, 0.101, 0.087), V(0.425, 0.06, 0.052), V(0.452, 0.001, 0.001),
  ]);
  const pos = [], uv = [], index = [], rings = 96, sides = 64;
  for (let r = 0; r <= rings; r++) {
    const p = profile.getPoint(r / rings), cy = .045 + .10 * THREE.MathUtils.smoothstep(p.x,-.4,.1) + .012 * THREE.MathUtils.smoothstep(p.x,.25,.45);
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2;
      pos.push(Math.sin(a) * p.y, Math.max(0.004, cy + Math.cos(a) * p.z), p.x);
      uv.push(i / sides, r / rings);
      if (r < rings && i < sides) {
        const k = r * (sides + 1) + i, j = k + sides + 1;
        index.push(k, j, k + 1, j, j + 1, k + 1);
      }
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(index); body.computeVertexNormals(); cloth.push(tint(body, paint));
  // Swept dorsal, paired flippers, small pelvic fins and the tall asymmetric tail.
  cloth.push(tint(fin([[0,.21,.12],[0,.42,.015],[0,.43,-.025],[0,.25,-.11],[0,.17,-.19]], V(1,0,0), .022), solid(blue)));
  for (const s of [-1, 1]) {
    cloth.push(tint(fin([[s*.105,.09,.20],[s*.20,.035,.13],[s*.36,.012,-.04],[s*.32,.012,-.10],[s*.12,.048,-.015]], V(0,1,0), .018), solid(blue)));
    cloth.push(tint(fin([[s*.059,.05,-.23],[s*.14,.013,-.33],[s*.115,.015,-.37],[s*.035,.04,-.32]], V(0,1,0), .009), solid(blue)));
  }
  cloth.push(tint(fin([[0,.07,-.41],[0,.25,-.55],[0,.26,-.59],[0,.08,-.57],[0,.016,-.65],[0,.003,-.60],[0,.012,-.49]], V(1,0,0), .016), solid(blue)));
  // Lower jaw and pink inset under the overhanging nose; mouth corners wrap toward the cheeks.
  cloth.push(tint(ellipsoid(0,.059,.345,.106,.035,.092), solid(cream)));
  const mouth = new THREE.SphereGeometry(1, 48, 24).scale(.106,.027,.012).translate(0,.101,.413);
  cloth.push(tint(mouth, solid(pink)));
  const lip = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2;
    lip.push(V(Math.cos(a)*.106, .101+Math.sin(a)*.027, .415));
  }
  cloth.push(tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip), 64, .0018, 5, true), solid(cream)));
  // Flat triangular fabric teeth, with a little thickness so they read from below too.
  for (const row of [-1, 1]) for (let i = -4; i <= 4; i++) {
    const x = i * .019, edge = Math.sqrt(1-(x/.107)**2), y = .101 + row*.023*edge;
    const shape = new THREE.Shape();
    shape.moveTo(x-.008,y); shape.lineTo(x+.008,y); shape.lineTo(x,y-row*.013); shape.closePath();
    cloth.push(tint(new THREE.ExtrudeGeometry(shape,{depth:.002,bevelEnabled:false}).translate(0,0,.427),solid(cream)));
  }
  for (const s of [-1, 1]) {
    // Embroidered eye patches sit flush to the side of the snout, facing slightly forward.
    const eye = ellipsoid(0,0,0,.004,.013,.015).rotateY(s * -.38).translate(s*.126,.167,.276);
    eyes.push(tint(eye, solid(dark)));
    eyes.push(tint(ellipsoid(s*.130,.171,.281,.002,.003,.003),solid(cream)));
    // Three short, stitched gill arcs behind each eye.
    for (let k=0;k<3;k++) {
      const z=.195-k*.027;
      const pts=[V(s*.145,.17,z),V(s*.152,.14,z-.004),V(s*.143,.115,z-.011)];
      cloth.push(tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.0012,5),solid(seam)));
    }
  }
  // The sewn centre line continues over the tail; subtle, not a hard cartoon outline.
  const stitch = [V(0,.247,.24),V(0,.285,.10),V(0,.24,-.08),V(0,.15,-.25),V(0,.086,-.38)];
  cloth.push(tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stitch),64,.0008,5),solid(seam)));
  const group = new THREE.Group(); group.name = 'Blahaj plush';
  const merge = parts => {
    const flat = parts.map(g => g.index ? g.toNonIndexed() : g);
    const result = mergeGeometries(flat);
    for (const g of new Set([...parts,...flat])) g.dispose();
    result.computeBoundingSphere(); return result;
  };
  const mat = new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.96,metalness:0,
    sheen:.35,sheenRoughness:.9,sheenColor:blue,bumpMap:fabricGrain(),bumpScale:LOOK.num('shark-grain',.0003)});
  group.add(new THREE.Mesh(merge(cloth),mat),new THREE.Mesh(merge(eyes),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85})));
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.noCollide = true; } });
  return group;
}

export function addShark(scene, world, { at, face, length }) {
  const shark = buildShark();
  shark.scale.setScalar(length / 1.102); shark.rotation.y = face; shark.position.fromArray(at);
  // Seat the broad belly on the highest surface beneath it.
  for (const dx of [-.28, 0, .28]) for (const dz of [-.08, 0, .08]) {
    const origin = V(at[0]+dx,at[1]+.5,at[2]+dz), hit = world.castAll(origin,V(0,-1,0),.65);
    if (hit) shark.position.y = Math.max(shark.position.y,hit.point.y+.002);
  }
  scene.add(shark);
  shark.updateMatrixWorld(true);
  shark.traverse(o => { if (o.isMesh) o.userData.noCollide = false; });
  world.addObjects([shark]); // the same geometry blocks movement and fades for the camera
  return shark;
}
