// The Encore's visual model only: no targeting, damage, hitboxes or combat clock.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { LOOK } from './look.js';
import { coil, snap, settle, heavy } from './attack-motion.js';

// The DJs' moves (perform). A move is two poses, its wind-up and its accent, each twelve angles in
// radians, offsets from the rest pose: torso pitch (+ bows forward) and turn (+ towards the centre),
// helmet pitch and turn, then the outer arm's and the inner arm's x (- raises it forward and up), y
// (+ swings it outwards) and z (+ tips it outwards), then the outer and inner leg's pitch (- swings it
// forward and up; legs show only off the booth); each DJ mirrors them. A list shorter than twelve
// reads the rest as 0. Its timing, in beats:
// lead (it starts this long before the accent), strike (the swing from wind-up to accent), sustain
// (the accent held), release (the way back) and spin (radians: the outer arm circles once a beat
// through the wind-up). All in content/look.css as --encore-dance-<move>, -<move>-wind, -<move>-hit.
export const MOVES=['circle','sweep','point','clap','throw','crank','hands-up','fist-pump','flinch','bow','vault','land','slam','conduct','push'];
const J=12,YAW=[1,3,5,8];
let MOVE=null,K=null;
function moves(){
  if(MOVE)return MOVE;
  const n=(name,d)=>LOOK.num('encore-dance-'+name,d),pose=name=>{const v=LOOK.list('encore-dance-'+name,[]).map(Number);return Float32Array.from({length:J},(_,i)=>Number.isFinite(v[i])?v[i]:0);};
  K={over:n('over',.12),hold:n('hold',.35),shake:n('shake',.5),bounces:n('bounces',2),damp:n('damp',2),blend:n('blend',.25)};
  MOVE={};
  for(const m of MOVES){const t=LOOK.list('encore-dance-'+m,[]).map(Number),g=(i,d)=>Number.isFinite(t[i])?t[i]:d;MOVE[m]={lead:Math.max(g(0,1),g(1,.5)),strike:Math.max(.01,g(1,.5)),sustain:g(2,0),release:Math.max(.01,g(3,1)),spin:g(4,0),W:pose(m+'-wind'),A:pose(m+'-hit')};}
  return MOVE;
}
// a move's offsets `u` beats from its accent into `out`; returns its weight, how far it has taken over
// from the arm pump (as fast as it winds up, given back as it releases)
function shape(M,u,quiet,dir,sustain,out){
  const s=M.strike,L=M.lead,over=quiet?0:K.over;
  let w=1;
  if(u<-L||u>=sustain+M.release){out.fill(0);return 0;}
  if(u<-s){
    const k=(u+L)/Math.max(.01,L-s),c=coil(k,K.hold,over),e=Math.sin(Math.PI*Math.min(1,k))*M.spin,a=u*Math.PI*2;
    for(let i=0;i<J;i++)out[i]=M.W[i]*c;
    out[4]+=e*(Math.cos(a)-1);out[6]+=e*Math.sin(a);   // the circle: it never reaches past the swing
    w=Math.min(1,c);
  }else if(u<0){
    const n=snap((u+s)/s,over);for(let i=0;i<J;i++)out[i]=M.W[i]+(M.A[i]-M.W[i])*n;
    if(L<=s)w=Math.min(1,n);   // no wind-up (a flinch): it takes over with the swing
  }else{
    const d=quiet||u>=K.shake?0:settle(u/K.shake,K.bounces,K.damp),k=(u-sustain)/M.release,r=u<sustain?1:quiet?heavy(k):settle(k,K.bounces,K.damp);
    for(let i=0;i<J;i++)out[i]=M.A[i]*r+over*(M.A[i]-M.W[i])*d;
    if(u>=sustain)w=1-k;
  }
  if(dir!==1)for(const i of YAW)out[i]*=dir;
  return w;
}

export function buildEncoreBoss(){
  const root=new THREE.Group();root.name='The Encore · pyramid and helmeted duo';root.userData.noCollide=true;
  const geometries=new Set(),materials=new Set(),textures=new Set(),groups=new Map(),heads=[],hands=[],rigs=[];
  const geo=g=>(geometries.add(g),g),mat=m=>(materials.add(m),m);
  const blue=LOOK.color('encore-blue','#9bbaff'),amber=LOOK.color('encore-amber','#ff8c25');
  const suit=mat(new THREE.MeshStandardMaterial({color:LOOK.color('encore-suit','#151c2a'),roughness:.64,metalness:.12}));
  const leather=mat(new THREE.MeshStandardMaterial({color:LOOK.color('encore-leather','#273143'),roughness:.4,metalness:.25}));
  const panel=mat(new THREE.MeshStandardMaterial({color:LOOK.color('encore-panel','#10182a'),roughness:.37,metalness:.48}));
  const steel=mat(new THREE.MeshStandardMaterial({color:0x45546b,roughness:.37,metalness:.65}));
  const visor=mat(new THREE.MeshStandardMaterial({color:0x02050c,roughness:.13,metalness:.35}));
  const bronze=mat(new THREE.MeshStandardMaterial({color:0x715b40,roughness:.42,metalness:.65}));
  const seam=mat(new THREE.MeshBasicMaterial({color:0x52617c}));
  const ice=mat(new THREE.MeshBasicMaterial({color:blue,toneMapped:false}));
  const warm=mat(new THREE.MeshBasicMaterial({color:amber,toneMapped:false}));
  const halo=mat(new THREE.MeshBasicMaterial({color:blue,transparent:true,opacity:LOOK.num('encore-halo-opacity',.11),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const warmHalo=mat(halo.clone());warmHalo.color.set(amber);
  function chrome(gold){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
    const g=c.createLinearGradient(15,0,115,128);
    const colors=gold?['#0c0601','#372006','#bd8c32','#1c1205','#815515','#080402']:['#020511','#14243e','#94b0d5','#0b1325','#526c94','#020612'];
    colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));c.fillStyle=g;c.fillRect(0,0,128,128);
    c.strokeStyle=gold?'#fff1b9':'#eefaff';c.lineWidth=3;c.beginPath();c.ellipse(57,43,44,34,-.45,Math.PI*.95,Math.PI*1.8);c.stroke();
    c.strokeStyle=gold?'#c0833b':'#627caa';c.lineWidth=3;c.beginPath();c.moveTo(17,105);c.lineTo(105,85);c.stroke();
    const t=new THREE.CanvasTexture(canvas);textures.add(t);return mat(new THREE.MeshMatcapMaterial({matcap:t,color:0xffffff}));
  }
  const silver=chrome(false),gold=chrome(true);
  // Shared fine leather grain: one small bump map, prepared once and reused by both suits.
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
  const gc=grainCanvas.getContext('2d'),image=gc.createImageData(128,128);
  for(let i=0;i<image.data.length;i+=4){const v=110+Math.sin(i*1.37)*Math.sin(i*.073)*36;image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}
  gc.putImageData(image,0,0);const grain=new THREE.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(5,5);textures.add(grain);
  for(const m of [suit,leather]){m.bumpMap=grain;m.bumpScale=LOOK.num('encore-leather-grain',.00012);}

  const box=geo(new RoundedBoxGeometry(1,1,1,2,.08));
  const ball=geo(new THREE.SphereGeometry(1,20,14));
  const cylinder=geo(new THREE.CylinderGeometry(1,1,1,12));
  const disc=geo(new THREE.CylinderGeometry(1,1,1,24));
  const rod=geo(new THREE.CylinderGeometry(1,1,1,6));
  const up=new THREE.Vector3(0,1,0),tmp=new THREE.Object3D(),_to=new THREE.Vector3();
  function put(g,m,at,scale=[1,1,1],rot=[0,0,0],parent=root){
    tmp.position.fromArray(at);tmp.scale.fromArray(scale);tmp.rotation.set(...rot);tmp.updateMatrix();
    const copy=g.clone().applyMatrix4(tmp.matrix);let byMat=groups.get(parent);if(!byMat){byMat=new Map();groups.set(parent,byMat);}if(!byMat.has(m))byMat.set(m,[]);byMat.get(m).push(copy);
  }
  function bar(a,b,r,m,parent=root){
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.sub(A),q=new THREE.Quaternion().setFromUnitVectors(up,d.clone().normalize());
    const e=new THREE.Euler().setFromQuaternion(q);put(rod,m,A.addScaledVector(d,.5).toArray(),[r,d.length(),r],[e.x,e.y,e.z],parent);
  }
  function led(a,b,m=ice,r=LOOK.num('encore-led-width',.00075),parent=root){
    bar(a,b,r,m,parent);bar(a,b,r*2.8,m===warm?warmHalo:halo,parent);
  }
  function path(points,r,m,parent=root){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    put(geo(new THREE.TubeGeometry(curve,Math.max(12,points.length*5),r,6,false)),m,[0,0,0],[1,1,1],[0,0,0],parent);
  }
  // One always-prepared additive layer; future attacks only change vertex colors.
  const litPositions=[],litPanels=[],lightColor=new THREE.Color();
  function lightTriangle(points,part){
    const normal=new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).normalize();
    // Wings face forward; pyramid faces already have outward winding.
    if(part!=='pyramid'&&normal.z<0)normal.negate();
    const start=litPositions.length/3;
    for(const p of points)litPositions.push(p.x+normal.x*.00025,p.y+normal.y*.00025,p.z+normal.z*.00025);
    litPanels.push({part,start});
  }
  // Truncated pyramid: independently inset triangular metal plates under the luminous lattice.
  const w0=.286,w1=.156,d0=.17,d1=.078,y0=.012,y1=.18;
  const faces=[[[ -w0,y0,d0],[w0,y0,d0],[w1,y1,d1],[-w1,y1,d1]],
    [[w0,y0,d0],[w0,y0,-d0],[w1,y1,-d1],[w1,y1,d1]],
    [[w0,y0,-d0],[-w0,y0,-d0],[-w1,y1,-d1],[w1,y1,-d1]],
    [[-w0,y0,-d0],[-w0,y0,d0],[-w1,y1,d1],[-w1,y1,-d1]]];
  function facePoint(face,u,v){const a=new THREE.Vector3(...face[0]).lerp(new THREE.Vector3(...face[1]),u),b=new THREE.Vector3(...face[3]).lerp(new THREE.Vector3(...face[2]),u);return a.lerp(b,v);}
  const segments=new Set();
  function uniqueLed(a,b){const key=[a.toArray().map(n=>n.toFixed(5)).join(),b.toArray().map(n=>n.toFixed(5)).join()].sort().join('|');if(!segments.has(key)){segments.add(key);led(a.toArray(),b.toArray());}}
  for(const [f,face]of faces.entries()){
    const cols=f%2?3:6,rows=4;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const p=[facePoint(face,c/cols,r/rows),facePoint(face,(c+1)/cols,r/rows),facePoint(face,(c+1)/cols,(r+1)/rows),facePoint(face,c/cols,(r+1)/rows)];
      const tris=[[0,1,2],[0,2,3]];
      for(const tri of tris){const center=new THREE.Vector3();tri.forEach(i=>center.add(p[i]));center.multiplyScalar(1/3);const verts=tri.map(i=>p[i].clone().lerp(center,.022));
        const g=new THREE.BufferGeometry().setFromPoints(verts);g.setIndex([0,1,2]);g.computeVertexNormals();put(geo(g),panel,[0,0,0]);lightTriangle(verts,'pyramid');
        for(let i=0;i<3;i++)uniqueLed(p[tri[i]],p[tri[(i+1)%3]]);
      }
    }
  }
  // Stepped black plinth, glowing amber edge rails and machined top lip.
  for(let i=0;i<3;i++){
    const w=.63-i*.018,d=.39-i*.018,y=-.008+i*.007;
    put(box,panel,[0,y,0],[w,.012,d]);
    led([-w/2,y+.006,d/2],[w/2,y+.006,d/2],warm,.0013);
    for(const side of [-1,1])led([side*w/2,y+.006,-d/2],[side*w/2,y+.006,d/2],warm,.001);
  }
  put(box,steel,[0,y1+.002,0],[.331,.012,.177]);put(box,panel,[0,y1+.009,0],[.321,.008,.168]);
  led([-.161,y1+.005,.087],[.161,y1+.005,.087],ice,.0011);
  // Two braced triangular wings: cool raked outer edge and a warm vertical inner edge.
  for(const side of [-1,1]){
    const A=[side*.43,0,-.13],B=[side*.17,.355,-.13],C=[side*.17,0,-.13];
    const tri=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...A),new THREE.Vector3(...B),new THREE.Vector3(...C)]);tri.setIndex(side<0?[0,2,1]:[0,1,2]);tri.computeVertexNormals();
    const wing=mat(new THREE.MeshStandardMaterial({color:0x131e30,transparent:true,opacity:.5,roughness:.65,metalness:.2,side:THREE.DoubleSide,depthWrite:false}));put(geo(tri),wing,[0,0,0]);lightTriangle([A,B,C].map(p=>new THREE.Vector3(...p)),side<0?'leftWing':'rightWing');
    const v=(a,b,t)=>new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),t).toArray();
    for(const edge of [[A,B],[B,C],[C,A]])bar(...edge,.0032,steel);
    const front=p=>[p[0],p[1],p[2]+.004];
    led(front(A),front(B),ice,.0013);led(front(B),front(C),warm,.0014);led(front(C),front(A),warm,.0009);
    for(let k=1;k<7;k++){
      const t=k/7,P=v(A,B,t),Q=v(C,B,t);bar(P,Q,.00065,bronze);
      const R=v(C,B,(k-1)/7);bar(P,R,.00055,bronze);
      if(k<6)bar(P,v(C,B,(k+1)/7),.00055,bronze);
    }
    put(box,panel,[side*.35,-.036,-.13],[.18,.07,.11]);led([side*.43,0,-.08],[side*.27,0,-.08],warm,.0012);
    for(const x of [.18,.42])put(disc,steel,[side*x,.008,-.13],[.006,.007,.006]);
  }
  // DJ console: twin decks, jog wheels, mixer strips, screws, sockets and cabling.
  const deckY=y1+.016;
  for(const side of [-1,1]){
    put(box,visor,[side*.103,deckY,0],[.096,.009,.132]);
    put(disc,steel,[side*.103,deckY+.007,.018],[.029,.004,.029]);
    put(disc,visor,[side*.103,deckY+.01,.018],[.025,.003,.025]);
    const ring=geo(new THREE.TorusGeometry(.027,.00065,5,36).rotateX(Math.PI/2));put(ring,side<0?ice:warm,[side*.103,deckY+.01,.018]);
    for(let k=0;k<12;k++){const a=k/12*Math.PI*2;put(box,steel,[side*.103+Math.cos(a)*.018,deckY+.012,.018+Math.sin(a)*.018],[.002,.0008,.001]);}
    put(box,visor,[side*.103,deckY+.005,-.04],[.036,.0008,.016]);
    for(let k=0;k<24;k++){const x=side*.103-.016+k*.0013,z=-.04+Math.sin(k*1.7)*Math.sin(k*.6)*.004;put(box,side<0?ice:warm,[x,deckY+.0056,z],[.0009,.0006,.001]);}
    for(let k=0;k<3;k++)put(disc,steel,[side*.126+k*.018,deckY+.005,.055],[.003,.003,.003]);
  }
  put(box,visor,[0,deckY,0],[.086,.011,.133]);
  for(let c=0;c<5;c++)for(let r=0;r<4;r++){
    const x=(c-2)*.014,z=-.045+r*.018;put(cylinder,steel,[x,deckY+.009,z],[.003,.006,.003]);
    put(box,c%2?warm:ice,[x,deckY+.013,z+.0004],[.0007,.0005,.002]);
  }
  for(let c=0;c<5;c++){
    const x=(c-2)*.014;put(box,steel,[x,deckY+.006,.036],[.001,.001,.03]);put(box,leather,[x,deckY+.009,.029+c*.002],[.008,.004,.004]);
  }
  for(const x of [-.15,.15])for(const z of [-.072,.072])put(disc,steel,[x,deckY+.002,z],[.0015,.001,.0015]);
  for(let k=0;k<4;k++)path([[.05+k*.012,.188,-.075],[.05+k*.012,.17,-.11],[.11+k*.014,.07,-.17],[.16+k*.012,0,-.17]],.0009,visor);
  // Fitted full-body performers, each a rig of separately merged parts (perform, update): the body on
  // its feet, the torso pivoting at the hips (the legs ride along, hidden in the pyramid), the helmet,
  // and two arms pivoting at the shoulders with their gloves merged in (a glove is an empty anchor).
  function performer(side){
    const color=side<0?ice:warm,metal=side<0?silver:gold;
    const body=new THREE.Group();body.name=side<0?'Silver performer':'Gold performer';body.position.set(side*.083,0,-.075);body.rotation.y=-side*.18;root.add(body);
    const torso=new THREE.Group();torso.name='Torso';torso.position.y=.16;torso.rotation.order='YXZ';body.add(torso);
    const fig=new THREE.Group();fig.position.y=-.16;torso.add(fig);
    const rig={side,body,torso,head:null,outer:null,inner:null,outerLeg:null,innerLeg:null,move:null,at:0,dir:1,sustain:0,fadeAt:null,w:0,from:0,now:new Float32Array(J),was:new Float32Array(J),raise:0,beat:null,look:null,arm:'outer',
      rest:body.position.clone(),restYaw:body.rotation.y,out:false,trip:null,yaw:0,facing:null};rigs.push(rig);
    // Two legs, each its own part pivoting at the hip (two materials: they show only off the booth;
    // in it they stand hidden in the pyramid, as they always have)
    for(const x of [-.017,.017]){
      const hip=[x*.8,.156,0],leg=new THREE.Group(),at=p=>[p[0]-hip[0],p[1]-hip[1],p[2]-hip[2]],outer=Math.sign(x)===side;
      leg.name=outer?'Outer leg':'Inner leg';leg.position.fromArray(hip);leg.visible=false;body.add(leg);rig[outer?'outerLeg':'innerLeg']=leg;
      put(box,visor,at([x,.011,.009]),[.025,.019,.048],[0,0,0],leg);put(box,visor,at([x,.004,.01]),[.026,.004,.049],[0,0,0],leg);
      bar(at([x,.025,0]),at([x*.85,.09,-.005]),.012,suit,leg);bar(at([x*.85,.09,-.005]),[0,0,0],.014,suit,leg);
      path([[x-.009,.032,.01],[x-.009,.088,.008],[x-.009,.145,.012]].map(at),.00055,suit,leg);
    }
    put(ball,suit,[0,.161,0],[.033,.025,.022],[0,0,0],fig);
    put(box,visor,[0,.165,.018],[.055,.009,.005],[0,0,0],fig);put(box,steel,[0,.165,.021],[.008,.007,.002],[0,0,0],fig);
    put(ball,suit,[0,.201,.004],[.038,.045,.025],[.12,0,0],fig);
    put(ball,leather,[0,.231,.005],[.042,.014,.027],[0,0,0],fig);
    put(cylinder,visor,[0,.246,.009],[.012,.019,.012],[0,0,0],fig);
    // Lapels, zipper, collar seam and restrained segmented costume piping.
    for(const x of [-1,1]){
      bar([x*.022,.233,.027],[x*.008,.197,.029],.002,leather,fig);
      path([[x*.035,.22,.014],[x*.028,.191,.021],[x*.025,.169,.017]],.0006,seam,fig);
      led([x*.029,.231,.022],[x*.017,.228,.028],color,.00045,fig);
    }
    bar([0,.175,.027],[0,.222,.031],.0005,steel,fig);
    for(let k=0;k<5;k++)put(box,steel,[.002,.181+k*.007,.028],[.001,.001,.0015],[0,0,0],fig);
    const head=new THREE.Group();head.name='Helmet';head.position.set(0,.273,.014);head.rotation.y=-side*.52;fig.add(head);heads.push({head,side});rig.head=head;
    put(ball,metal,[0,.003,0],[.027,.034,.027],[0,0,0],head);
    put(ball,metal,[0,-.018,.003],[.023,.016,.022],[0,0,0],head);
    // Curved dark visor patch follows the helmet, rather than floating in front of it.
    const vg=geo(new THREE.SphereGeometry(1,28,16,Math.PI*.09,Math.PI*.82,Math.PI*.25,Math.PI*.51));
    put(vg,visor,[0,.004,.0005],[.0274,.0338,.0274],[0,0,0],head);
    const visorRim=[];for(let i=0;i<=20;i++){const a=-1.05+i/20*2.1;visorRim.push([Math.sin(a)*.0266,.014,Math.cos(a)*.0273]);}
    path(visorRim,.0008,color,head);
    for(const x of [-1,1]){
      put(disc,visor,[x*.027,.002,-.001],[.010,.006,.010],[0,0,Math.PI/2],head);
      const earRing=geo(new THREE.TorusGeometry(.008,.0007,6,24));put(earRing,color,[x*.030,.002,-.001],[1,1,1],[0,Math.PI/2,0],head);
      put(disc,metal,[x*.031,.002,-.001],[.005,.001,.005],[0,0,Math.PI/2],head);
      path([[x*.023,.014,.014],[x*.023,-.013,.007],[x*.014,-.025,.018]],.00065,color,head);
    }
    if(side<0){
      path([[-.022,.023,-.012],[-.012,.035,.009],[.009,.035,.011],[.023,.02,-.002]],.00075,color,head);
      for(let k=0;k<3;k++)bar([-.009,-.018+k*.003,.0255-k*.0006],[.009,-.018+k*.003,.0255-k*.0006],.00035,steel,head);
    }else{
      const chin=[];for(let i=0;i<=20;i++){const x=-.018+i*.0018,z=.003+.022*Math.sqrt(1-(x/.023)**2-.25**2);chin.push([x,-.022,z+.0005]);}path(chin,.0006,color,head);
      path([[0,.035,-.012],[0,.037,0],[0,.03,.02]],.00065,metal,head);
    }
    // Two bent arms finish in articulated gloves poised over the controls, each its own part pivoting
    // at the shoulder; the outer one is thrown up and pumped on the beat (dance).
    for(const arm of [-1,1]){
      const shoulder=[arm*.04,.227,.008],outer=arm===side;
      const part=new THREE.Group();part.name=outer?'Outer arm':'Inner arm';part.position.fromArray(shoulder);fig.add(part);rig[outer?'outer':'inner']=part;
      const at=p=>[p[0]-shoulder[0],p[1]-shoulder[1],p[2]-shoulder[2]];
      const S=at(shoulder),elbow=at([arm*.055,.218,.035]),wrist=at([arm*.034,.214,.09]),w=p=>[p[0]+wrist[0],p[1]+wrist[1],p[2]+wrist[2]];
      put(ball,leather,S,[.014,.015,.014],[0,0,0],part);bar(S,elbow,.012,suit,part);put(ball,leather,elbow,[.013,.011,.012],[0,0,0],part);bar(elbow,wrist,.0105,suit,part);
      path([[arm*.05,.219,.028],[arm*.054,.207,.042],[arm*.038,.195,.078]].map(at),.0005,seam,part);
      for(let fold=0;fold<3;fold++)path([[arm*.047,.211-fold*.003,.043+fold*.006],[arm*.056,.212-fold*.003,.047+fold*.006],[arm*.06,.208-fold*.003,.049+fold*.006]].map(at),.00045,leather,part);
      put(cylinder,steel,wrist,[.011,.004,.011],[Math.PI/2,0,0],part);
      const hand=new THREE.Group();hand.name='Gloved hand';hand.position.fromArray(wrist);part.add(hand);hands.push(hand);
      put(ball,leather,w([0,-.001,.008]),[.009,.005,.012],[0,0,0],part);
      for(let finger=0;finger<4;finger++){
        const x=(finger-1.5)*.004,z=.017+(finger===1?.003:0);bar(w([x,-.001,.009]),w([x,-.004,z]),.0016,leather,part);bar(w([x,-.004,z]),w([x,-.006,z+.005]),.0014,leather,part);
        put(ball,steel,w([x,.003,.013]),[.0014,.0006,.0015],[0,0,0],part);
      }
      bar(w([arm*.006,-.001,.002]),w([arm*.012,-.004,.011]),.002,leather,part);
    }
  }
  performer(-1);performer(1);
  // Merge by material within each animated part. Nothing is allocated by the idle clock.
  for(const [parent,byMat]of groups)for(const [material,list]of byMat){
    const converted=list.map(g=>{const n=g.index?g.toNonIndexed():g;const attributes=n.attributes;for(const key of Object.keys(attributes))if(!['position','normal','uv'].includes(key))n.deleteAttribute(key);if(!n.attributes.uv)n.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));return n;});
    const merged=geo(mergeGeometries(converted));converted.forEach(g=>g.dispose());list.forEach(g=>g.dispose());const m=new THREE.Mesh(merged,material);m.userData.noCollide=true;parent.add(m);
  }
  const lightGeometry=geo(new THREE.BufferGeometry());
  lightGeometry.setAttribute('position',new THREE.Float32BufferAttribute(litPositions,3));
  const lightColors=new THREE.Float32BufferAttribute(new Float32Array(litPositions.length),3);lightColors.setUsage(THREE.DynamicDrawUsage);lightGeometry.setAttribute('color',lightColors);
  const lightMaterial=mat(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,fog:false}));
  const lightMesh=new THREE.Mesh(lightGeometry,lightMaterial);lightMesh.name='Encore attack lighting';lightMesh.renderOrder=1;lightMesh.userData.noCollide=true;root.add(lightMesh);
  const charge=LOOK.color('encore-charge','#ff5935'),gain=LOOK.num('encore-charge-brightness',.8);
  function paint(panel,color,strength){
    lightColor.set(color).multiplyScalar(THREE.MathUtils.clamp(strength,0,1)*gain);
    for(let v=panel.start;v<panel.start+3;v++)lightColors.setXYZ(v,lightColor.r,lightColor.g,lightColor.b);
    lightColors.needsUpdate=true;
  }
  // Part names and triangle order are stable; reset before switching attack patterns.
  function setLighting(part,color=charge,strength=1){
    if(!['all','pyramid','leftWing','rightWing'].includes(part)||!Number.isFinite(strength))return false;
    for(const panel of litPanels)if(part==='all'||part===panel.part)paint(panel,color,strength);return true;
  }
  function setTriangle(index,color=charge,strength=1){
    if(!Number.isInteger(index)||index<0||index>=litPanels.length||!Number.isFinite(strength))return false;
    paint(litPanels[index],color,strength);return true;
  }
  // Low-poly closed collision hulls reuse the model dimensions; LEDs and fingers stay decorative.
  const hulls=[geo(new ConvexGeometry(faces.flat().map(p=>new THREE.Vector3(...p))))];
  function collisionBox(x,y,z,w,h,d){const g=new THREE.BoxGeometry(w,h,d).translate(x,y,z);hulls.push(geo(g));}
  collisionBox(0,0,0,.63,.028,.39);collisionBox(0,.187,0,.331,.022,.177);
  for(const side of [-1,1]){
    const points=[];for(const z of [-.135,-.125])for(const p of [[side*.43,0],[side*.17,.355],[side*.17,0]])points.push(new THREE.Vector3(p[0],p[1],z));
    hulls.push(geo(new ConvexGeometry(points)));collisionBox(side*.35,-.036,-.13,.18,.07,.11);
  }
  const collisionParts=hulls.map(g=>{const n=g.index?geo(g.toNonIndexed()):g;n.deleteAttribute('uv');return n;}),collisionGeometry=geo(mergeGeometries(collisionParts));
  let time=0;
  // The arm pump: dance('silver' | 'gold', beat) each frame throws that performer's outer arm up and
  // pumps it, down on every beat; dance(who, null) lets it ease back to the decks.
  const rigOf=who=>rigs.find(r=>r.side===(who==='silver'?-1:who==='gold'?1:0));
  const raised=LOOK.num('encore-dance-raise',1.35),pump=LOOK.num('encore-dance-pump',.32);
  const vaultHeight=LOOK.num('encore-vault-height',.26),turnRate=LOOK.num('encore-turn-rate',6);
  // Off the booth (travel): a DJ's body leaves the booth's group for the arena's (the booth's parent),
  // so the booth's beat pump, hit squash and shudder no longer move him; home puts him back at rest.
  const homeAt=(r,out)=>out.copy(r.rest).applyQuaternion(root.quaternion).add(root.position);
  const homeYaw=r=>r.restYaw+root.rotation.y;
  function leave(r){if(r.out)return;homeAt(r,r.body.position);r.yaw=homeYaw(r);r.body.rotation.y=r.yaw;root.parent.add(r.body);r.out=true;r.outerLeg.visible=r.innerLeg.visible=true;}
  function home(r){r.trip=null;r.facing=null;if(!r.out)return;root.add(r.body);r.body.position.copy(r.rest);r.body.rotation.y=r.restYaw;r.out=false;r.outerLeg.visible=r.innerLeg.visible=false;}
  const turnTo=(r,yaw,dt)=>{const d=Math.atan2(Math.sin(yaw-r.yaw),Math.cos(yaw-r.yaw)),c=turnRate*dt;r.yaw+=Math.max(-c,Math.min(c,d));};
  // each frame: where a travelling DJ is (u 0..1 along his arc, by the beat or the clock), and his facing
  function fly(r,dt,beat){
    const T=r.trip,b=r.body.position;
    let moving=false;
    if(T&&!T.done){
      const u=T.secs?(time-T.t0)/T.secs:beat===null?null:(beat-T.t0)/(T.t1-T.t0);   // (no beat: he waits where he is)
      if(u!==null&&u<0&&T.set){home(r);return;}   // the song rewound past his take-off: back in the booth
      if(u!==null&&u>=0){
        moving=true;
        if(!r.out)leave(r);
        if(!T.set){T.set=true;T.from.copy(b);}   // he takes off from wherever he stands
        if(T.home)homeAt(r,T.to);
        const k=Math.min(1,u);b.lerpVectors(T.from,T.to,k);b.y+=4*T.h*k*(1-k);
        const dx=T.to.x-T.from.x,dz=T.to.z-T.from.z,end=T.home?homeYaw(r):r.facing?Math.atan2(r.facing[0]-b.x,r.facing[1]-b.z):null;
        turnTo(r,k<.5||end===null?(Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):r.yaw):end,dt);   // faces the way he goes, then where he lands facing
        if(u>=1){if(T.home)home(r);else T.done=true;}   // (kept, so asking again for it changes nothing)
      }
    }
    if(!moving&&r.out&&r.facing)turnTo(r,Math.atan2(r.facing[0]-b.x,r.facing[1]-b.z),dt);
    if(r.out)r.body.rotation.y=r.yaw;
  }
  moves();
  return {root,collisionGeometry,setLighting,setTriangle,clearLighting:()=>setLighting('all',0,0),triangleCount:litPanels.length,heads:heads.map(h=>h.head),hands,arms:rigs.map(r=>r.outer),
    rigs:{silver:rigOf('silver'),gold:rigOf('gold')},
    dance(who,beat){const d=rigOf(who);if(!d||(beat!==null&&!Number.isFinite(beat)))return false;d.beat=beat;return true;},
    // perform(who, move, beat0, dir = 1, sustain): play a move (MOVES) so its accent lands on beat0, over
    // the dance; dir -1 mirrors its turns (a sweep the other way); sustain (beats) overrides how long the
    // accent holds (a bow); look (radians, 0 = straight down the floor, + towards +x) turns his
    // helmet to face that way as the move takes over (the arc's gap). perform(who, null) eases back. The pose is a function of the beat (update);
    // asking for the same move on the same beat again changes nothing, and a song rewind drops it.
    // arm 'inner' plays the move with his other arm (a conduct for the far lanes); dir still only mirrors turns.
    perform(who,move,beat0,dir=1,sustain,look=null,arm='outer'){
      const r=rigOf(who);if(!r||(move!==null&&(!MOVES.includes(move)||!Number.isFinite(beat0))))return false;
      if(move&&r.move===MOVE[move]&&r.at===beat0&&r.arm===(arm==='inner'?'inner':'outer'))return true;   // asked again (each frame): it plays on
      r.was.set(r.now);r.from=r.w;r.fadeAt=null;r.move=move&&MOVE[move];r.at=beat0;r.dir=dir<0?-1:1;r.sustain=Number.isFinite(sustain)?Math.max(0,sustain):r.move?.sustain??0;r.look=Number.isFinite(look)?look:null;r.arm=arm==='inner'?'inner':'outer';return true;
    },
    // travel(who, to, takeOff, land, height): he leaves where he stands on beat takeOff and lands on beat
    // land at `to` ([x, y, z] in the arena, the booth's parent; or 'home', back in the booth at rest), in
    // an arc `height` m over the straight line (--encore-vault-height), a function of the beat. On the
    // clock instead: travel(who, to, {secs, height}) (a knock-back, a rewind's hop home). Asking again for
    // the same trip changes nothing. Off the booth he faces the way he goes, then face()'s point.
    travel(who,to,takeOff,land,height=vaultHeight){
      const r=rigOf(who),clock=takeOff!==null&&typeof takeOff==='object',goHome=to==='home';
      if(!r||!root.parent||(!goHome&&!(Array.isArray(to)&&to.length===3&&to.every(Number.isFinite))))return false;
      if(clock){height=takeOff.height??vaultHeight;if(!(takeOff.secs>0))return false;}
      else if(!Number.isFinite(takeOff)||!Number.isFinite(land)||land<=takeOff)return false;
      const T=r.trip;
      const same=T&&T.home===goHome&&(goHome||T.to.equals(_to.fromArray(to)));
      if(same&&(clock?T.secs===takeOff.secs:!T.secs&&T.t0===takeOff&&T.t1===land))return true;   // asked again (each frame)
      if(goHome&&!r.out){r.trip=null;return true;}   // he is home already (a trip out not yet begun is called off)
      r.trip={home:goHome,to:goHome?new THREE.Vector3():new THREE.Vector3().fromArray(to),from:new THREE.Vector3(),set:false,h:Number.isFinite(height)?height:vaultHeight,
        t0:clock?time:takeOff,t1:clock?null:land,secs:clock?takeOff.secs:0};
      return true;
    },
    // face(who, [x, z]): off the booth, he turns to that point (--encore-turn-rate, radians a second); null: holds his facing
    face(who,point){const r=rigOf(who);if(!r||(point!==null&&!(Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))))return false;r.facing=point?(r.facing||[0,0]):null;if(point){r.facing[0]=point[0];r.facing[1]=point[1];}return true;},
    // is he off the booth (travelling or standing on the floor)?
    out(who){return !!rigOf(who)?.out;},
    // each frame; beat: the song's (null: no move plays, each eases back)
    update(dt,quiet=false,beat=null){time+=dt;
      for(const r of rigs){
        const {side,head,torso,outer,inner,now}=r;
        let w=0;
        if(r.move&&beat!==null&&r.fadeAt!==null&&beat<r.fadeAt)r.move=null;   // the song rewound: the move is gone
        if(r.move&&beat!==null){
          w=shape(r.move,beat-r.at,quiet,r.dir,r.sustain,now);
          if(r.arm==='inner')for(let i=4;i<7;i++){const t=now[i];now[i]=now[i+3];now[i+3]=t;}   // the other arm plays it
          if(r.fadeAt===null)r.fadeAt=beat;
          const f=Math.min(1,Math.max(0,(beat-r.fadeAt)/K.blend));   // from whatever it was doing
          if(f<1){for(let i=0;i<J;i++)now[i]=r.was[i]+(now[i]-r.was[i])*f;w=r.from+(w-r.from)*f;}
          if(beat-r.at>=r.sustain+r.move.release)r.move=null;
        }else{const e=Math.max(0,1-dt*8);for(let i=0;i<J;i++)now[i]*=e;w=r.w*e;r.fadeAt=null;r.was.set(now);r.from=w;}
        r.w=w;
        r.raise+=((r.beat===null?0:1)-r.raise)*Math.min(1,dt*8);
        const bob=r.beat===null||quiet?0:-Math.cos(r.beat*Math.PI*2);
        torso.rotation.x=now[0];torso.rotation.y=-side*now[1];
        head.rotation.y=-side*.52+(quiet?0:Math.sin(time*.65+side)*.07)-side*now[3];head.rotation.x=(quiet?0:.04+Math.sin(time*.9+side)*.025)+now[2];
        if(r.look!==null)head.rotation.y+=Math.max(-1.5,Math.min(1.5,r.look+side*.7))*w;   // faces it (the body already turns -side*.18, the helmet -side*.52)
        outer.rotation.x=-r.raise*(raised+pump*bob)*(1-w)+now[4];outer.rotation.y=side*now[5];outer.rotation.z=side*.25*r.raise*(1-w)+side*now[6];
        inner.rotation.x=now[7];inner.rotation.y=-side*now[8];inner.rotation.z=-side*now[9];
        r.outerLeg.rotation.x=now[10];r.innerLeg.rotation.x=now[11];
        fly(r,dt,beat);
      }},
    dispose(){for(const r of rigs)home(r);root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
