// The real boss controller on a simple quilt, without loading the apartment.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Shark, ATTACKS } from './shark.js';
import { loadLook } from './look.js';
import { loadContent } from './content.js';
import { Fx } from './fx.js';
import { batcher } from './batch.js';
import { bus, PLAYER } from './events.js';
import { buildCharacter, normalizeLook } from './character.js';
import { unlock as unlockAudio } from './sfx.js';

const error=document.getElementById('error');
try{
  await loadLook();await loadContent();
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.localClippingEnabled=true;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e4e4df');batcher.scene=scene;
  const camera=new THREE.PerspectiveCamera(36,1,.01,20),controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.17,0);controls.enableDamping=true;controls.minDistance=.6;controls.maxDistance=6;
  const arena={name:'The Great White One',spawn:[0,0,.45],arenaMin:[-.85,-.045,-1.1],arenaMax:[.85,.65,1.1],playerStart:[0,0,-.65]};
  const world={castAll:(origin)=>({point:new THREE.Vector3(origin.x,0,origin.z),normal:new THREE.Vector3(0,1,0)})};
  const fx=new Fx(scene,camera),boss=new Shark(scene,{byId:new Map()},fx,arena,world);document.body.append(fx.layer);
  const avatar=buildCharacter(normalizeLook(null),.09);scene.add(avatar.root);
  const player={position:new THREE.Vector3(0,0,-.65),cfg:{radius:.025,height:.09}};
  const quilt=new THREE.Mesh(new THREE.BoxGeometry(1.7,.08,2.2,24,1,30),new THREE.MeshStandardMaterial({color:'#b7c3b1',roughness:1}));quilt.position.y=-.045;scene.add(quilt);
  const grid=new THREE.GridHelper(2.2,16,0x718277,0x9aaa9d);grid.position.y=.001;grid.scale.x=1.7/2.2;scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xffffff,0x64758b,2));const key=new THREE.DirectionalLight(0xfff7e9,3);key.position.set(-2,3,2);scene.add(key);const fill=new THREE.DirectionalLight(0xc1d9ef,1.5);fill.position.set(2,1,-2);scene.add(fill);
  camera.position.set(2.2,1.8,-2.8);controls.update();
  const select=document.getElementById('attack');for(const name of [...new Set([...ATTACKS.calm,...ATTACKS.angry])])select.add(new Option(name.replace('burrowBite','burrowed bite'),name));
  let paused=false,closeup=false,elapsed=0,previous=performance.now(),jumpT=0,hurt=0;
  const keys=new Set();addEventListener('keydown',e=>{if(e.target.closest('select,button,input'))return;if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!jumpT)jumpT=.001;});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
  document.getElementById('play-attack').onclick=()=>{closeup=false;boss.stunT=0;boss.recover();boss.clearHazards();boss.rise=1;boss.model.scale.setScalar(.6);if(select.value==='tornado')boss.hp=boss.maxHp*.84;boss.begin(select.value,player);};
  document.getElementById('pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume':'Pause';};
  const inspect=()=>{closeup=true;boss.recover();boss.heading=Math.PI;boss.holder.rotation.y=boss.heading;boss.stunT=1e9;boss.rise=1;boss.model.scale.setScalar(.6);};
  document.getElementById('side').onclick=()=>{inspect();controls.target.copy(boss.center());camera.position.copy(controls.target).add(new THREE.Vector3(1,.5,-1.1));controls.update();};
  document.getElementById('face').onclick=()=>{inspect();boss.heading=Math.PI;boss.holder.rotation.y=boss.heading;controls.target.copy(boss.center()).add(new THREE.Vector3(0,0,-.1));camera.position.copy(controls.target).add(new THREE.Vector3(.12,.04,-.75));controls.update();};
  document.getElementById('belly').onclick=()=>{inspect();controls.target.copy(boss.center());camera.position.copy(controls.target).add(new THREE.Vector3(.8,-.1,-.9));controls.update();};
  document.getElementById('wide').onclick=()=>{closeup=false;boss.stunT=0;boss.elapsed=0;controls.target.set(0,.17,0);camera.position.set(2.2,1.8,-2.8);controls.update();};
  document.getElementById('frenzy').onclick=()=>{boss.frenzy=boss.frenzy>0?0:60;};
  document.getElementById('sound').onclick=()=>unlockAudio();
  document.getElementById('bedroom').onclick=()=>{sessionStorage.setItem('jellyfight.act',JSON.stringify({act:3,then:{boss:'The Great White One'}}));location.href='./index.html';};
  bus.on('damage_taken',e=>{if(e.targetId!==PLAYER)return;hurt=.2;if(!e.drain)bus.emit('player_hurt',{amount:e.amount,from:e.from});});
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.04,(now-previous)/1000);previous=now;
    if(!paused){
      elapsed+=dt;const speed=.27*dt;player.position.x+=((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0))*speed;player.position.z+=((keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0))*speed;
      player.position.x=THREE.MathUtils.clamp(player.position.x,-.8,.8);player.position.z=THREE.MathUtils.clamp(player.position.z,-1.05,1.05);
      if(jumpT){jumpT+=dt;player.position.y=Math.sin(Math.min(1,jumpT/.65)*Math.PI)*.2;if(jumpT>=.65){jumpT=0;player.position.y=0;}}
      boss.update(dt,player);if(closeup)boss.model.pose({gape:.18+.32*(.5+.5*Math.sin(elapsed*1.5)),tailSwing:Math.sin(elapsed*2)*.14,breath:Math.sin(elapsed*2),time:elapsed,left:Math.sin(elapsed*2)*.12,right:-Math.sin(elapsed*2)*.12});
      avatar.root.position.copy(player.position);avatar.update(dt,{speed:0,walkSpeed:1,grounded:!jumpT,vy:0});fx.update(dt);hurt=Math.max(0,hurt-dt);avatar.root.scale.setScalar(hurt?1.06:1);
    }
    controls.update();batcher.sync();renderer.render(scene,camera);
    document.getElementById('stats').textContent=`${boss.state} / ${boss.phase} · ${boss.frenzy>0?'Feeding frenzy · ':''}${Math.round(boss.hp/boss.maxHp*100)}% Health · ${boss.pools.length}/6 pools · ${boss.tornadoes.length} tornadoes · ${renderer.info.render.calls} draws`;
  });
  window.sharkPreview={boss,player,fx,renderer,scene,camera};
}catch(e){error.hidden=false;error.textContent='Could not open boss preview: '+e.message;console.error(e);}
