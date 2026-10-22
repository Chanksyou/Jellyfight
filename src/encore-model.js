// The Encore's visual model only: no targeting, damage, hitboxes or combat clock.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LOOK } from './look.js';

export function buildEncoreBoss(){
  const root=new THREE.Group();root.name='The Encore · pyramid and helmeted duo';root.userData.noCollide=true;
  const geometries=new Set(),materials=new Set(),textures=new Set(),groups=new Map(),heads=[],hands=[],dancers=[];
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
  const up=new THREE.Vector3(0,1,0),tmp=new THREE.Object3D();
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
  // Fitted full-body performers, with separately merged heads and hand rigs for idle motion.
  function performer(side){
    const color=side<0?ice:warm,metal=side<0?silver:gold;
    const body=new THREE.Group();body.name=side<0?'Silver performer':'Gold performer';body.position.set(side*.083,0,-.075);body.rotation.y=-side*.18;root.add(body);
    for(const x of [-.017,.017]){
      put(box,visor,[x,.011,.009],[.025,.019,.048],[0,0,0],body);put(box,steel,[x,.004,.01],[.026,.004,.049],[0,0,0],body);
      bar([x,.025,0],[x*.85,.09,-.005],.012,suit,body);bar([x*.85,.09,-.005],[x*.8,.156,0],.014,suit,body);
      path([[x-.009,.032,.01],[x-.009,.088,.008],[x-.009,.145,.012]],.00055,seam,body);
    }
    put(ball,suit,[0,.161,0],[.033,.025,.022],[0,0,0],body);
    put(box,visor,[0,.165,.018],[.055,.009,.005],[0,0,0],body);put(box,steel,[0,.165,.021],[.008,.007,.002],[0,0,0],body);
    put(ball,suit,[0,.201,.004],[.038,.045,.025],[.12,0,0],body);
    put(ball,leather,[0,.231,.005],[.042,.014,.027],[0,0,0],body);
    put(cylinder,visor,[0,.246,.009],[.012,.019,.012],[0,0,0],body);
    // Lapels, zipper, collar seam and restrained segmented costume piping.
    for(const x of [-1,1]){
      bar([x*.022,.233,.027],[x*.008,.197,.029],.002,leather,body);
      path([[x*.035,.22,.014],[x*.028,.191,.021],[x*.025,.169,.017]],.0006,seam,body);
      led([x*.029,.231,.022],[x*.017,.228,.028],color,.00045,body);
    }
    bar([0,.175,.027],[0,.222,.031],.0005,steel,body);
    for(let k=0;k<5;k++)put(box,steel,[.002,.181+k*.007,.028],[.001,.001,.0015],[0,0,0],body);
    const head=new THREE.Group();head.name='Helmet';head.position.set(0,.273,.014);head.rotation.y=-side*.52;body.add(head);heads.push({head,side});
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
    // Two bent arms finish in articulated gloves poised over the controls. The outer arm is its own
    // part, pivoting at the shoulder, so it can be thrown up and pumped on the beat (dance).
    for(const arm of [-1,1]){
      const shoulder=[arm*.04,.227,.008],outer=arm===side;
      const part=outer?new THREE.Group():body;if(outer){part.name='Dancing arm';part.position.fromArray(shoulder);body.add(part);dancers.push({arm:part,side,raise:0,beat:null});}
      const at=p=>outer?[p[0]-shoulder[0],p[1]-shoulder[1],p[2]-shoulder[2]]:p;
      const S=at(shoulder),elbow=at([arm*.055,.218,.035]),wrist=at([arm*.034,.214,.09]);
      put(ball,leather,S,[.014,.015,.014],[0,0,0],part);bar(S,elbow,.012,suit,part);put(ball,leather,elbow,[.013,.011,.012],[0,0,0],part);bar(elbow,wrist,.0105,suit,part);
      path([[arm*.05,.219,.028],[arm*.054,.207,.042],[arm*.038,.195,.078]].map(at),.0005,seam,part);
      for(let fold=0;fold<3;fold++)path([[arm*.047,.211-fold*.003,.043+fold*.006],[arm*.056,.212-fold*.003,.047+fold*.006],[arm*.06,.208-fold*.003,.049+fold*.006]].map(at),.00045,leather,part);
      put(cylinder,steel,wrist,[.011,.004,.011],[Math.PI/2,0,0],part);
      const hand=new THREE.Group();hand.name='Gloved hand';hand.position.fromArray(wrist);part.add(hand);hands.push({hand,phase:side+arm});
      put(ball,leather,[0,-.001,.008],[.009,.005,.012],[0,0,0],hand);
      for(let finger=0;finger<4;finger++){
        const x=(finger-1.5)*.004,z=.017+(finger===1?.003:0);bar([x,-.001,.009],[x,-.004,z],.0016,leather,hand);bar([x,-.004,z],[x,-.006,z+.005],.0014,leather,hand);
        put(ball,steel,[x,.003,.013],[.0014,.0006,.0015],[0,0,0],hand);
      }
      bar([arm*.006,-.001,.002],[arm*.012,-.004,.011],.002,leather,hand);
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
  let time=0;
  // The DJ move: dance('silver' | 'gold', beat) each frame throws that performer's outer arm up and
  // pumps it, down on every beat; dance(who, null) lets it ease back to the decks.
  const dancer=who=>dancers.find(d=>d.side===(who==='silver'?-1:who==='gold'?1:0));
  const raised=LOOK.num('encore-dance-raise',1.35),pump=LOOK.num('encore-dance-pump',.32);
  return {root,setLighting,setTriangle,clearLighting:()=>setLighting('all',0,0),triangleCount:litPanels.length,heads:heads.map(h=>h.head),hands:hands.map(h=>h.hand),arms:dancers.map(d=>d.arm),
    dance(who,beat){const d=dancer(who);if(!d||(beat!==null&&!Number.isFinite(beat)))return false;d.beat=beat;return true;},
    update(dt,quiet=false){time+=dt;for(const {head,side}of heads){head.rotation.y=-side*.52+(quiet?0:Math.sin(time*.65+side)*.07);head.rotation.x=quiet?0:.04+Math.sin(time*.9+side)*.025;}for(const {hand,phase}of hands)hand.rotation.x=quiet?0:Math.sin(time*1.6+phase)*.045;
      for(const d of dancers){d.raise+=((d.beat===null?0:1)-d.raise)*Math.min(1,dt*8);const bob=d.beat===null||quiet?0:-Math.cos(d.beat*Math.PI*2);d.arm.rotation.x=-d.raise*(raised+pump*bob);d.arm.rotation.z=d.side*.25*d.raise;}},
    dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
