// Act 4 environment only: no campaign or boss rules are introduced.
import * as THREE from 'three';
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
