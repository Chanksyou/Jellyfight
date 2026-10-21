// Procedural concert arena. Static merged scenery, two tile draws, no per-tile lights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOOK } from './look.js';
import { buildEncoreBoss } from './encore-model.js';
import { STAGE4 } from './stage4.js';

export function buildAct4(scene){
  const root=new THREE.Group();root.name='Act 4 concert arena';scene.add(root);
  const ownedGeo=new Set(),ownedMat=new Set(),textures=[];
  const geo=g=>(ownedGeo.add(g),g),mat=m=>(ownedMat.add(m),m);
  const ink=LOOK.color('arena-metal','#10131d'),amber=LOOK.color('arena-amber','#ff6810'),blue=LOOK.color('arena-blue','#9bbcff');
  const dark=mat(new THREE.MeshStandardMaterial({color:ink,roughness:.5,metalness:.55}));
  const edge=mat(new THREE.MeshBasicMaterial({color:amber,toneMapped:false}));
  const cool=mat(new THREE.MeshBasicMaterial({color:blue,toneMapped:false}));
  const steel=mat(new THREE.MeshStandardMaterial({color:LOOK.color('arena-steel','#273044'),roughness:.48,metalness:.7}));
  const batches=new Map();
  function put(g,m,x,y,z,scale=[1,1,1],rot=[0,0,0]){
    const o=new THREE.Object3D();o.position.set(x,y,z);o.scale.set(...scale);o.rotation.set(...rot);o.updateMatrix();
    const copy=g.clone().applyMatrix4(o.matrix);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(copy);
  }
  const box=geo(new THREE.BoxGeometry(1,1,1)),rod=geo(new THREE.CylinderGeometry(1,1,1,5));
  const a=new THREE.Vector3(),b=new THREE.Vector3(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  function bar(from,to,r,m){a.fromArray(from);b.fromArray(to).sub(a);q.setFromUnitVectors(up,b.clone().normalize());const e=new THREE.Euler().setFromQuaternion(q);put(rod,m,...a.addScaledVector(b,.5).toArray(),[r,b.length(),r],e.toArray().slice(0,3));}
  const {tiles:n,tileSize:s}=STAGE4,span=n*s,half=span/2;
  const floorMat=mat(new THREE.MeshStandardMaterial({color:LOOK.color('arena-floor','#202738'),roughness:LOOK.num('arena-floor-roughness',.34),metalness:.5}));
  const tileGeo=geo(new THREE.BoxGeometry(s-.0015,.006,s-.0015));
  const floor=new THREE.InstancedMesh(tileGeo,floorMat,n*n);floor.name='144 dark floor tiles';floor.userData.noCollide=true;root.add(floor);
  const glowGeo=geo(new THREE.PlaneGeometry(s-.003,s-.003).rotateX(-Math.PI/2));
  const tileCanvas=document.createElement('canvas');tileCanvas.width=tileCanvas.height=64;
  const tc=tileCanvas.getContext('2d'),tg=tc.createRadialGradient(32,32,1,32,32,44);
  tg.addColorStop(0,'#ffffffbb');tg.addColorStop(.75,'#ffffff55');tg.addColorStop(1,'#ffffffdd');tc.fillStyle=tg;tc.fillRect(0,0,64,64);
  tc.strokeStyle='#ffffffaa';tc.lineWidth=1;tc.strokeRect(1,1,62,62);
  const tileTexture=new THREE.CanvasTexture(tileCanvas);textures.push(tileTexture);
  const glowMat=mat(new THREE.MeshBasicMaterial({map:tileTexture,color:0xffffff,transparent:true,opacity:LOOK.num('arena-tile-glow',.72),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const tiles=new THREE.InstancedMesh(glowGeo,glowMat,n*n);tiles.name='Individually addressable tile light';tiles.userData.noCollide=true;root.add(tiles);
  const transform=new THREE.Matrix4(),black=new THREE.Color(0),tint=new THREE.Color();
  for(let row=0;row<n;row++)for(let col=0;col<n;col++){
    const i=row*n+col,x=(col+.5)*s-half,z=(row+.5)*s-half;
    transform.makeTranslation(x,-.003,z);floor.setMatrixAt(i,transform);
    transform.makeTranslation(x,.0005,z);tiles.setMatrixAt(i,transform);tiles.setColorAt(i,black);
  }
  floor.instanceMatrix.needsUpdate=tiles.instanceMatrix.needsUpdate=true;
  // One continuous collision surface; grout never catches tiny feet.
  const solids=[];
  function solid(name,x,y,z,w,h,d){const m=new THREE.Mesh(box,dark);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);root.add(m);solids.push(m);return m;}
  const continuous=solid('Continuous arena floor',0,-.02,0,span+.06,.04,span+.06);
  continuous.material=mat(new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));continuous.userData.noCollide=true;
  put(box,dark,0,-.01,0,[span+.06,.01,span+.06]);
  for(const side of [-1,1]){
    solid('Side arena boundary',side*(half+.025),.0125,0,.04,.035,span+.1);
    solid('End arena boundary',0,.0125,side*(half+.025),span+.1,.035,.04);
  }
  // Invisible collision extends above jump height; the low rails keep the concert sightline open.
  const fenceMat=mat(new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));
  for(const side of [-1,1])for(const axis of ['x','z']){
    const m=new THREE.Mesh(box,fenceMat);m.name='Jump-safe arena boundary';m.userData.noCollide=true;
    m.position.set(axis==='x'?side*(half+.025):0,.7,axis==='z'?side*(half+.025):0);
    m.scale.set(axis==='x'?.04:span+.1,1.4,axis==='z'?.04:span+.1);root.add(m);solids.push(m);
  }
  // Amber perimeter footlights and handrails, with a dark service apron beyond them.
  for(const side of [-1,1]){
    put(box,edge,side*(half+.004),.027,0,[.005,.005,span]);
    put(box,edge,0,.027,side*(half+.004),[span,.005,.005]);
    for(let i=0;i<=8;i++){
      const u=-half+i*span/8;
      put(box,steel,side*(half+.035),.085,u,[.005,.11,.005]);
      put(box,steel,u,.085,side*(half+.035),[.005,.11,.005]);
    }
    for(const y of [.075,.14]){
      put(box,steel,side*(half+.035),y,0,[.006,.006,span]);
      put(box,steel,0,y,side*(half+.035),[span,.006,.006]);
    }
  }
  // Rear riser supports the visual boss model; combat and collision remain separate.
  solid('Rear stage riser',0,.035,-.43,.63,.07,.42);
  for(const z of [-.20,-.18]){put(box,dark,0,.012,z,[.64,.024,.025]);put(box,edge,0,.025,z+.009,[.62,.002,.002]);}
  put(box,edge,0,.071,-.219,[.62,.002,.003]);
  // Four suspended line arrays, with visible segmented cabinets and cone faces.
  const cone=geo(new THREE.CylinderGeometry(1,1,.08,12).rotateX(Math.PI/2));
  for(const x of [-.64,.64])for(const z of [-.53,.53]){
    for(const dx of [-.025,.025])bar([x+dx,.18,z],[x+dx,.86,z],.003,steel);
    for(let k=0;k<5;k++){
      const y=.47+k*.045,xx=x+(x>0?-1:1)*(4-k)*.004;
      put(box,dark,xx,y,z,[.065,.042,.092]);
      put(cone,steel,xx+(x>0?-.034:.034),y,z,[.028,.028,.028],[0,Math.PI/2,0]);
      for(const dz of [-.044,.044])put(box,edge,xx+(x>0?-.034:.034),y,z+dz,[.002,.034,.002]);
    }
  }
  // Overhead truss frame, braces and lamp cans. Geometry only, no individual light sources.
  for(const x of [-.79,.79])for(const z of [-.79,.79]){
    for(const dx of [-.015,.015])for(const dz of [-.015,.015])bar([x+dx,0,z+dz],[x+dx,.92,z+dz],.003,steel);
    for(let i=0;i<5;i++)bar([x-.015,i*.18,z-.015],[x+.015,(i+1)*.18,z+.015],.002,steel);
  }
  for(const side of [-1,1])for(const y of [.88,.92]){
    bar([-.79,y,side*.79],[.79,y,side*.79],.004,steel);
    bar([side*.79,y,-.79],[side*.79,y,.79],.004,steel);
  }
  for(const x of [-.58,-.28,.28,.58]){
    put(box,dark,x,.86,-.72,[.035,.035,.045]);put(box,cool,x,.839,-.712,[.022,.002,.025]);
  }
  // Reusable soft light pools fake spill/reflection instead of planar reflections or tile lights.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
  const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#ffffff55');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);textures.push(texture);
  const poolMat=mat(new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:LOOK.num('arena-spill-opacity',.24),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const poolGeo=geo(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2));
  const pools=new THREE.InstancedMesh(poolGeo,poolMat,12);pools.userData.noCollide=true;root.add(pools);
  const temp=new THREE.Object3D();
  for(let i=0;i<12;i++){
    const side=i<6?-1:1,u=((i%6)+.5)/6*span-half;
    put(box,steel,side*(half-.01),.032,u,[.018,.015,.018]);put(rod,edge,side*(half-.01),.042,u,[.006,.003,.006]);
    temp.position.set(side*(half-.06),.001,u);temp.scale.set(.4,1,.23);temp.updateMatrix();pools.setMatrixAt(i,temp.matrix);pools.setColorAt(i,new THREE.Color(i%3===0?blue:amber));
  }
  // One baked spill texture gives the dark floor broad warm reflections without reflection passes.
  const spillCanvas=document.createElement('canvas');spillCanvas.width=spillCanvas.height=512;
  const sc=spillCanvas.getContext('2d');sc.fillStyle='#000';sc.fillRect(0,0,512,512);
  function spill(x,z,w,h,color){sc.save();sc.translate(x,z);sc.scale(w,h);const grad=sc.createRadialGradient(0,0,0,0,0,1);grad.addColorStop(0,color);grad.addColorStop(1,'#0000');sc.fillStyle=grad;sc.fillRect(-1,-1,2,2);sc.restore();}
  sc.globalCompositeOperation='screen';
  for(const x of [18,494])for(const z of [70,180,300,430])spill(x,z,95,45,'#ff5400bb');
  for(const x of [150,360])spill(x,85,75,200,'#ff650099');
  spill(265,320,150,170,'#2e68c65a');
  const pixels=sc.getImageData(0,0,512,512);for(let i=0;i<pixels.data.length;i+=4){const k=.65+.35*((Math.sin(i*12.3)*43758.5)%1+1)/2;for(let c=0;c<3;c++)pixels.data[i+c]*=k;}sc.putImageData(pixels,0,0);
  const spillTexture=new THREE.CanvasTexture(spillCanvas);textures.push(spillTexture);
  const spillMat=mat(new THREE.MeshBasicMaterial({map:spillTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:LOOK.num('arena-reflection-opacity',.65),toneMapped:false}));
  const reflection=new THREE.Mesh(geo(new THREE.PlaneGeometry(span,span).rotateX(-Math.PI/2)),spillMat);reflection.position.y=.0003;reflection.userData.noCollide=true;root.add(reflection);
  // Faint translucent shafts, fixed in place: four low-poly draws merged into one.
  const beamMat=mat(new THREE.MeshBasicMaterial({color:blue,transparent:true,opacity:LOOK.num('arena-beam-opacity',.035),depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  const beamGeo=geo(new THREE.ConeGeometry(.13,.7,12,1,true));
  for(const x of [-.58,-.28,.28,.58])put(beamGeo,beamMat,x,.49,-.4,[1,1,1],[-.4,0,0]);
  for(const [material,list]of batches){const merged=geo(mergeGeometries(list));list.forEach(g=>g.dispose());const m=new THREE.Mesh(merged,material);m.userData.noCollide=true;root.add(m);}
  const boss=buildEncoreBoss();boss.root.position.set(0,.07,-.43);root.add(boss.root);
  const fill=new THREE.HemisphereLight(0x8aa9ec,0x191017,LOOK.num('arena-fill',.75));
  const key=new THREE.DirectionalLight(0xffc589,LOOK.num('arena-key',1.15));key.position.set(-.4,1,.5);root.add(fill,key);
  function setTile(row,col,color=null,strength=1){
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||col<0||row>=n||col>=n||!Number.isFinite(strength))return false;
    tint.set(color??0).multiplyScalar(THREE.MathUtils.clamp(strength,0,1));tiles.setColorAt(row*n+col,tint);tiles.instanceColor.needsUpdate=true;return true;
  }
  function clearTiles(){for(let row=0;row<n;row++)for(let col=0;col<n;col++)setTile(row,col);}
  return {root,floor,tiles,solids,span,setTile,clearTiles,boss,
    dispose(){boss.dispose();root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});ownedGeo.forEach(g=>g.dispose());ownedMat.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
