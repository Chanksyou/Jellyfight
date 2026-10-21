// Act 4 environment only: no campaign or boss rules are introduced.
import * as THREE from 'three';
import { buildEncoreBoss } from '../encore-model.js';
import { buildAct4 } from '../act4-arena.js';
import { STAGE4 } from '../stage4.js';
import { World } from '../collision.js';
import { CONFIG } from '../config.js';
import { Player } from '../player.js';
import { story, ok, V } from './kit.js';
function make(){const scene=new THREE.Scene(),arena=buildAct4(scene),world=new World(scene,{staticScene:true});for(const m of arena.solids)if(m.userData.noCollide)world.addCollider(m,false);world.focus(V(0,0,0),1);return{scene,arena,world};}
story('arena4/tile-addressing-and-clear',{
 setup(){},
 play(){const {arena,scene}=make();try{const a=new THREE.Color(),b=new THREE.Color();arena.setTile(3,5,'#1e9cfa',.5);arena.tiles.getColorAt(3*12+5,a);arena.tiles.getColorAt(0,b);const valid=a.b>0&&b.getHex()===0,invalid=!arena.setTile(-1,0,'red')&&!arena.setTile(12,0,'red')&&!arena.setTile(0,0,'red',NaN);arena.clearTiles();let cleared=true;for(let i=0;i<144;i++){arena.tiles.getColorAt(i,a);cleared&&=a.getHex()===0;}return ok(valid&&invalid&&cleared&&scene.children.length===1,{valid,invalid,cleared});}finally{arena.dispose();}},
});
story('arena4/continuous-floor-and-jump-safe-boundary',{
 setup(){},
 play(){const {arena,world}=make();try{let floor=true;for(const x of [-.65,0,.12,.65])for(const z of [-.65,0,.12,.65]){const h=world.cast(V(x,.01,z),V(0,-1,0),.05);floor&&=!!h&&Math.abs(h.point.y)<.002;}const wall=world.cast(V(.6,.32,0),V(1,0,0),.3);return ok(floor&&!!wall&&arena.span/ (CONFIG.player.radius*2)>20,{floor,wall:!!wall,span:arena.span});}finally{arena.dispose();}},
});
story('arena4/tile-switch-keeps-light-count-and-geometry',{
 setup(){},
 play(){const {arena}=make();try{const counts=()=>{let lights=0,meshes=0;arena.root.traverse(o=>{if(o.isLight)lights++;if(o.isMesh)meshes++;});return{lights,meshes};},before=counts();for(let i=0;i<500;i++)arena.setTile(i%12,(i*7)%12,'#b344ef');const after=counts();return ok(before.lights===2&&after.lights===2&&before.meshes===after.meshes&&arena.floor.count===144&&arena.tiles.count===144,{before,after});}finally{arena.dispose();}},
});
story('arena4/removed-preview-disposes-owned-resources',{
 setup(){},
 play(){const {arena,scene}=make();let disposed=0;arena.floor.geometry.addEventListener('dispose',()=>disposed++);arena.tiles.material.addEventListener('dispose',()=>disposed++);arena.dispose();return ok(scene.children.length===0&&disposed===2,{children:scene.children.length,disposed});},
});
story('arena4/walking-jumps-stay-on-floor-and-inside-rails',{
 setup(){},
 play(){const {arena,world,scene}=make();try{const p=new Player(world,CONFIG.player);scene.add(p.mesh);p.spawn(V(.45,.01,.48));p.snapToGround();let frame=0;const input={moveAxes:()=>({x:0,y:1}),consumeJump:()=>frame%65===0,jumpHeld:false};let above=true;for(frame=0;frame<240;frame++){world.focus(p.position,1/60);p.update(1/60,input,0);above&&=p.position.y>=-.001;}return ok(above&&p.position.z>=-.72&&p.position.z<-.5,{above,feet:p.position.toArray()});}finally{arena.dispose();}},
});

story('encore/model-silhouette-detail-and-budget',{
 setup(){},
 play(){const boss=buildEncoreBoss();try{boss.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(boss.root),size=bounds.getSize(V(0,0,0));let triangles=0,meshes=0,lights=0,decorative=true;const mats=new Set();boss.root.traverse(o=>{if(o.isLight)lights++;if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;decorative&&=!!o.userData.noCollide;mats.add(o.material);}});return ok(boss.heads.length===2&&boss.hands.length===4&&size.x>.84&&size.x<.91&&bounds.min.y>=-.073&&bounds.max.y>.35&&bounds.max.y<.39&&lights===0&&decorative&&triangles<100000&&meshes<60&&mats.size<20,{size:size.toArray(),minY:bounds.min.y,maxY:bounds.max.y,triangles,meshes,lights,materials:mats.size,decorative});}finally{boss.dispose();}},
});
story('encore/idle-quiet-and-stable-resources',{
 setup(){},
 play(){const boss=buildEncoreBoss();try{let count=0;boss.root.traverse(()=>count++);const first=boss.heads[0].quaternion.clone();boss.update(.5);const moves=!first.equals(boss.heads[0].quaternion);boss.update(.1,true);const quiet=boss.heads.map(h=>h.quaternion.clone());for(let i=0;i<2000;i++)boss.update(1/60,true);let after=0;boss.root.traverse(()=>after++);const held=boss.heads.every((h,i)=>h.quaternion.equals(quiet[i]))&&boss.hands.every(h=>h.rotation.x===0);return ok(moves&&held&&after===count,{moves,held,before:count,after});}finally{boss.dispose();}},
});
story('encore/owned-resources-dispose-independently',{
 setup(){},
 play(){const scene=new THREE.Scene(),a=buildEncoreBoss(),b=buildEncoreBoss();scene.add(a.root,b.root);const geos=new Set(),mats=new Set(),maps=new Set();a.root.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material);if(o.material.matcap)maps.add(o.material.matcap);if(o.material.bumpMap)maps.add(o.material.bumpMap);}});let disposed=0;for(const r of [...geos,...mats,...maps])r.addEventListener('dispose',()=>disposed++);a.dispose();b.update(1/60);const independent=b.root.parent===scene&&maps.size===3&&disposed===geos.size+mats.size+maps.size;const remaining=scene.children.length;b.dispose();return ok(independent&&remaining===1&&scene.children.length===0,{independent,remaining,disposed,expected:geos.size+mats.size+maps.size});},
});

story('encore/lighting-parts-and-triangle-addressing',{
 setup(){},
 play(){const boss=buildEncoreBoss();try{const layer=boss.root.getObjectByName('Encore attack lighting'),colors=layer.geometry.attributes.color;const lit=i=>colors.getX(i*3)+colors.getY(i*3)+colors.getZ(i*3)>0;const dark=()=>Array.from(colors.array).every(v=>v===0);const off=dark();boss.setLighting('leftWing','#ff0000',1);const left=lit(144)&&!lit(145)&&!lit(0);boss.setLighting('rightWing','#00ff00',.5);const right=colors.getY(145*3)>0&&!lit(0);boss.setLighting('pyramid','#0000ff');const pyramid=Array.from({length:144},(_,i)=>colors.getZ(i*3)>0).every(Boolean);boss.clearLighting();boss.setTriangle(7,'#ff0000',.5);const one=Array.from({length:146},(_,i)=>lit(i)=== (i===7)).every(Boolean),half=colors.getX(21);boss.setTriangle(7,'#ff0000',1);const scales=Math.abs(colors.getX(21)-half*2)<.00001;boss.clearLighting();return ok(boss.triangleCount===146&&off&&left&&right&&pyramid&&one&&scales&&dark(),{count:boss.triangleCount,off,left,right,pyramid,one,scales});}finally{boss.dispose();}},
});
story('encore/lighting-rejects-invalid-and-clamps-strength',{
 setup(){},
 play(){const boss=buildEncoreBoss();try{const colors=boss.root.getObjectByName('Encore attack lighting').geometry.attributes.color;boss.setLighting('all','#ff0000',1);const before=colors.array.slice();const invalid=[boss.setLighting('missing'),boss.setLighting('all',0,NaN),boss.setTriangle(-1),boss.setTriangle(146),boss.setTriangle(.5),boss.setTriangle(0,0,Infinity)].every(v=>v===false),untouched=before.every((v,i)=>v===colors.array[i]);boss.setLighting('all','#ff0000',20);const clamped=before.every((v,i)=>v===colors.array[i]);boss.setLighting('all','#ff0000',-2);const off=colors.array.every(v=>v===0);return ok(invalid&&untouched&&clamped&&off,{invalid,untouched,clamped,off});}finally{boss.dispose();}},
});
story('encore/lighting-reuses-resources-and-isolates-instances',{
 setup(){},
 play(){const a=buildEncoreBoss(),b=buildEncoreBoss();try{const layer=a.root.getObjectByName('Encore attack lighting'),geometry=layer.geometry,material=layer.material,array=geometry.attributes.color.array;let nodes=0;a.root.traverse(()=>nodes++);for(let i=0;i<1000;i++){a.setLighting('all','#ff5500',(i%100)/100);a.setTriangle(i%a.triangleCount,'#ff0000');}let after=0,lights=0;a.root.traverse(o=>{after++;if(o.isLight)lights++;});const separate=b.root.getObjectByName('Encore attack lighting').geometry.attributes.color.array.every(v=>v===0);return ok(nodes===after&&lights===0&&layer.geometry===geometry&&layer.material===material&&geometry.attributes.color.array===array&&separate,{nodes,after,lights,separate});}finally{a.dispose();b.dispose();}},
});
