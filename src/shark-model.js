// Original procedural BLÅHAJ-style plush, using ZoeSmile's Sketchfab model as a visual reference:
// https://sketchfab.com/3d-models/blahaj-plush-27af14d4c2434442b3b6a969bff8d394
// Metres, nose toward +z. Separate head, hinged chin, fins and tail support the boss's poses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { LOOK } from './look.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const NECK_WEIGHTS=[0,0,.1,.3,.6];
const ellipsoid = (x, y, z, rx, ry, rz) => new THREE.SphereGeometry(1, 28, 20).scale(rx, ry, rz).translate(x, y, z);
let SHARED=null; // retain geometry/materials between main.js's shader warmup and the real fight
function riggedClone(template){
  const group=cloneSkeleton(template),parts=Array.from({length:7},(_,i)=>group.getObjectByName('shark-part-'+i));
  const [trunk,head,jaw,eyes,leftFin,rightFin,tail]=parts;
  const spine=trunk.skeleton.bones,flippers=[leftFin,rightFin];
  group.rig={trunk,head,jaw,eyes,fins:flippers,tail,spine,mat:trunk.material,clipPlane:trunk.material.clippingPlanes[0]};
  group.pose=({gape=0,headTurn=0,tailSwing=0,left=0,right=0,breath=0,finLift=0,coil=0,roll=0,stretch=0,time=0,energy=1,squint=0}={})=>{
    // The neck carries the complete head so turning cannot split the skull seam.
    head.rotation.set(0,0,0);eyes.rotation.copy(head.rotation);jaw.rotation.set(gape,0,0);
    const blinkPhase=(time+1.7)%4.2,blink=time>0&&blinkPhase<.14?Math.sin(blinkPhase/.14*Math.PI):0;
    eyes.scale.y=Math.max(.15,1-blink*.85-squint*.35);
    leftFin.rotation.set(left*.25,left,-finLift-Math.abs(left)*.3);
    rightFin.rotation.set(right*.25,right,finLift+Math.abs(right)*.3);
    for(let i=0;i<spine.length;i++){
      const wave=Math.sin(time*3-i*.7)*.025*energy;
      spine[i].rotation.set(coil*(i-2)*.055-(i===4?coil*.12:0), wave+headTurn*NECK_WEIGHTS[i]+tailSwing*(2-i)*.05,roll*.16);
    }
    flippers.forEach((f,i)=>{f.skeleton.bones[1].rotation.z=(i?1:-1)*(Math.abs(i?right:left)*.4+finLift*.35);});
    tail.skeleton.bones[1].rotation.set(coil*.18,Math.sin(time*3-.9)*.15*energy+tailSwing*.35,0);
    tail.skeleton.bones[2].rotation.y=Math.sin(time*3-1.6)*.18*energy+tailSwing*.2;
    tail.rotation.y=tailSwing;group.scale.y=group.scale.x*(1+breath*.025);
    trunk.scale.y=1; // the whole rig breathes together so the neck seam stays closed
    group.scale.y*=1+stretch*.12;group.scale.z=group.scale.x*(1-stretch*.06);
  };
  group.pose();return group;
}

// Smooth weights between neighbouring joints, as in the cat's procedural rig.
function skin(mesh,points,axis='z',direction=1){
  const geometry=mesh.geometry,p=geometry.attributes.position,indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
  const coordinates=points.map(v=>v[axis]*direction);
  for(let i=0;i<p.count;i++){
    const v=p.getComponent(i,axis==='z'?2:1)*direction;let b=0;
    while(b<points.length-2&&v>coordinates[b+1])b++;
    const t=THREE.MathUtils.smoothstep(v,coordinates[b],coordinates[b+1]);
    indices[i*4]=b;indices[i*4+1]=b+1;weights[i*4]=1-t;weights[i*4+1]=t;
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const rigged=new THREE.SkinnedMesh(geometry,mesh.material);rigged.position.copy(mesh.position);mesh.parent.add(rigged);mesh.removeFromParent();
  const bones=points.map((p,i)=>{const bone=new THREE.Bone();bone.position.copy(p);if(i)bone.position.sub(points[i-1]);return bone;});
  for(let i=1;i<bones.length;i++)bones[i-1].add(bones[i]);rigged.add(bones[0]);rigged.updateMatrixWorld(true);rigged.bind(new THREE.Skeleton(bones));rigged.frustumCulled=false;
  return rigged;
}

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
  if(SHARED)return riggedClone(SHARED);
  const blue = new THREE.Color(LOOK.color('shark-blue', '#506f83'));
  const cream = new THREE.Color(LOOK.color('shark-belly', '#e7e3d6'));
  const pink = new THREE.Color(LOOK.color('shark-mouth', '#bc7c83'));
  const dark = new THREE.Color(LOOK.color('shark-eye', '#181d23'));
  const seam = blue.clone().multiplyScalar(0.64);
  const solid = color => (x, y, z, out) => out.copy(color);
  const cloth = [], head = [], jaw = [], eyes = [], flippers = [[], []], tail = [];
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
  const pos = [], uv = [], index = [], headIndex = [], tailIndex=[], rings = 96, sides = 64;
  for (let r = 0; r <= rings; r++) {
    const p = profile.getPoint(r / rings), cy = .045 + .10 * THREE.MathUtils.smoothstep(p.x,-.4,.1) + .012 * THREE.MathUtils.smoothstep(p.x,.25,.45);
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2;
      pos.push(Math.sin(a) * p.y, Math.max(0.004, cy + Math.cos(a) * p.z), p.x);
      uv.push(i / sides, r / rings);
      if (r < rings && i < sides) {
        const k = r * (sides + 1) + i, j = k + sides + 1;
        (p.x > .23 ? headIndex : p.x<-.25?tailIndex:index).push(k, j, k + 1, j, j + 1, k + 1);
      }
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex([...index,...headIndex,...tailIndex]);tint(body,paint);
  const bodyPos=body.attributes.position;
  for(let i=0;i<bodyPos.count;i++){
    const floorY=THREE.MathUtils.lerp(.004,.128,THREE.MathUtils.smoothstep(bodyPos.getZ(i),.08,.23));
    bodyPos.setY(i,Math.max(bodyPos.getY(i),floorY));
  }
  tint(body,paint);body.computeVertexNormals();
  const skull=body.clone(); skull.setIndex(headIndex); head.push(skull);
  const stock=body.clone();stock.setIndex(tailIndex);tail.push(stock);
  body.setIndex(index); cloth.push(body);
  cloth.push(tint(ellipsoid(0,.067,-.25,.083,.072,.035),paint)); // soft overlap conceals the tail joint
  // Swept dorsal, paired flippers, small pelvic fins and the tall asymmetric tail.
  cloth.push(tint(fin([[0,.21,.12],[0,.42,.015],[0,.43,-.025],[0,.25,-.11],[0,.17,-.19]], V(1,0,0), .022), solid(blue)));
  for (const s of [-1, 1]) {
    flippers[s<0?0:1].push(tint(fin([[s*.105,.09,.20],[s*.18,-.10,.18],[s*.29,-.23,.015],[s*.28,-.23,-.055],[s*.12,.02,-.015]], V(0,0,1), .035), solid(blue)));
    tail.push(tint(fin([[s*.059,.05,-.23],[s*.14,.013,-.33],[s*.115,.015,-.37],[s*.035,.04,-.32]], V(0,1,0), .009), solid(blue)));
  }
  tail.push(tint(fin([[0,.07,-.41],[0,.25,-.55],[0,.26,-.59],[0,.08,-.57],[0,.016,-.65],[0,.003,-.60],[0,.012,-.49]], V(1,0,0), .016), solid(blue)));
  // A broad chin joining the cheek hinges, with horizontal mouth floor and roof.
  // The old front-facing pink oval was a plate floating in front of a closed snout.
  const jawOutline=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return[Math.sin(a)*.12,.101,.328+Math.cos(a)*.11];});
  const chinLens=fin(jawOutline,V(0,1,0),.036),chinPos=chinLens.attributes.position;
  for(let i=0;i<chinPos.count;i++)if(chinPos.getY(i)>.101)chinPos.setY(i,.106);
  chinLens.computeVertexNormals();jaw.push(tint(chinLens,solid(cream)));
  jaw.push(tint(ellipsoid(0,.106,.328,.105,.003,.096),solid(pink)));
  jaw.push(tint(ellipsoid(0,.109,.318,.050,.002,.063), solid(pink.clone().multiplyScalar(.83))));
  head.push(tint(ellipsoid(0,.124,.324,.103,.004,.100), solid(pink)));
  head.push(tint(ellipsoid(0,.12,.245,.105,.038,.012), solid(pink.clone().multiplyScalar(.45))));
  // Flat triangular fabric teeth, with a little thickness so they read from below too.
  for (const row of [-1, 1]) for (let i = -4; i <= 4; i++) {
    const x = i * .021, y = row>0?.125:.109;
    const shape = new THREE.Shape();
    shape.moveTo(x-.008,y); shape.lineTo(x+.008,y); shape.lineTo(x,y-row*.013); shape.closePath();
    (row>0?head:jaw).push(tint(new THREE.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:false}).translate(0,0,.431-.13*(x/.12)**2),solid(cream)));
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
  const stitches=[[],[]];
  for(let i=6;i<=76;i+=3){const p=profile.getPoint(i/96);if(p.x>.23)continue;const cy=.045+.10*THREE.MathUtils.smoothstep(p.x,-.4,.1)+.012*THREE.MathUtils.smoothstep(p.x,.25,.45);stitches[p.x<-.25?1:0].push(V(0,cy+p.z+.0006,p.x));}
  for(let i=0;i<2;i++)if(stitches[i].length>1)(i?tail:cloth).push(tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stitches[i]),64,.0008,5),solid(seam)));
  const group = new THREE.Group(); group.name = 'Blahaj shark boss';
  const merge = parts => {
    const flat = parts.map(g => g.index ? g.toNonIndexed() : g);
    const result = mergeGeometries(flat);
    for (const g of new Set([...parts,...flat])) g.dispose();
    result.computeBoundingSphere(); return result;
  };
  const floorPlane=new THREE.Plane(V(0,1,0),1000);
  const mat = new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.96,metalness:0,clippingPlanes:[floorPlane],clipShadows:true,
    sheen:.35,sheenRoughness:.9,sheenColor:blue,side:THREE.DoubleSide,bumpMap:fabricGrain(),bumpScale:LOOK.num('shark-grain',.0003)});
  const piece=(parts,pivot,parent=group,material=mat)=>{
    for(const g of parts)g.translate(-pivot.x,-pivot.y,-pivot.z);
    const mesh=new THREE.Mesh(merge(parts),material);mesh.position.copy(pivot);parent.add(mesh);return mesh;
  };
  const trunk=skin(piece(cloth,V(0,0,0)),[-.25,-.12,.04,.16,.23].map(z=>V(0,.10,z)));
  const skullMesh=piece(head,V(0,.15,.23));
  const chin=piece(jaw,V(0,.10,.235));
  const eyeMesh=piece(eyes,V(0,.15,.23),group,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,clippingPlanes:[floorPlane],clipShadows:true}));
  const fins=flippers.map((parts,i)=>skin(piece(parts,V(i? .115:-.115,.08,.12)),[V(0,0,0),V(i?.08:-.08,-.16,-.05)],'y',-1));
  const tailMesh=skin(piece(tail,V(0,.067,-.25)),[V(0,0,0),V(0,0,-.18),V(0,0,-.35)],'z',-1);
  group.updateMatrixWorld(true);
  for(const m of [skullMesh,chin,eyeMesh])trunk.skeleton.bones[4].attach(m);
  for(const m of fins)trunk.skeleton.bones[2].attach(m);
  trunk.skeleton.bones[0].attach(tailMesh);
  group.updateMatrixWorld(true);
  // Rebind moved skin roots in their final attachment space.
  for(const m of [...fins,tailMesh])m.bind(m.skeleton);
  [trunk,skullMesh,chin,eyeMesh,...fins,tailMesh].forEach((m,i)=>m.name='shark-part-'+i);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.noCollide = true; } });
  SHARED=group;return riggedClone(SHARED);
}
