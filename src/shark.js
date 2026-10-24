// Act 3's moving plush shark. Damage/state numbers live in content/bosses.kdl.
// The quilt is its sea: only a dorsal fin remains above it during a dive.
import * as THREE from 'three';
import { buildShark } from './shark-model.js';
import { sharkWaterMaterial } from './shark-water.js';
import { CONTENT } from './content.js';
import { LOOK } from './look.js';
import { bus, PLAYER } from './events.js';
import { hostile, arcHits } from './vfx.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { IS_TOUCH } from './touch.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const ease=x=>THREE.MathUtils.smoothstep(x,0,1);
export const ATTACKS={calm:['bite','leap','combo','spin','rear','dive','burrowBite','maelstrom'],angry:['bite','combo','dive','tornado','leap','spin','maelstrom','burrowBite','rear'],always:['pools']};
let SHARED_HAZARDS=null;
function hazardAssets(color){
  if(SHARED_HAZARDS)return SHARED_HAZARDS;
  const paint=(geo,hex)=>{const c=new THREE.Color(hex),a=[];for(let i=0;i<geo.attributes.position.count;i++)a.push(c.r,c.g,c.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return geo.toNonIndexed();};
  const fishParts=[paint(new THREE.SphereGeometry(1,10,6).scale(.018,.009,.006),LOOK.color('shark-fish','#ffb15e')),
    paint(new THREE.ConeGeometry(.009,.018,3).scale(1,1,.4).rotateZ(Math.PI/2).translate(-.023,0,0),LOOK.color('shark-fish','#ffb15e'))];
  for(const s of [-1,1])fishParts.push(paint(new THREE.SphereGeometry(.0018,6,4).translate(.011,.003,s*.0055),'#171921'));
  const fishGeo=mergeGeometries(fishParts);fishParts.forEach(g=>g.dispose());
  const fishMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,emissive:color,emissiveIntensity:.12});
  const spiral=[];for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*10,r=.095*(1-t)+.02;spiral.push(V(Math.cos(a)*r,t*.28,Math.sin(a)*r));}
  const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral),120,.007,6);
  const funnel=new THREE.CylinderGeometry(.025,.10,.28,24,1,true).translate(0,.14,0);
  const tubeFlat=tube.toNonIndexed(),funnelFlat=funnel.toNonIndexed(),tornadoGeo=mergeGeometries([tubeFlat,funnelFlat]);
  tube.dispose();funnel.dispose();tubeFlat.dispose();funnelFlat.dispose();
  const tornadoMat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.3,roughness:.7,side:THREE.DoubleSide});
  return SHARED_HAZARDS={fishGeo,fishMat,tornadoGeo,tornadoMat};
}

export class Shark {
  constructor(scene,enemies,fx,arena,world){
    Object.assign(this,{scene,enemies,fx,arena,world});
    this.kind='shark';this.def=CONTENT.bosses.shark;this.hp=this.maxHp=this.def.hp;
    this.r=.19;this.bound=.39;this.rise=0;this.t=0;this.next=0;this.heading=Math.PI;
    this.dead=false;this.dying=false;this.frenzy=0;this.prey=0;this.bleed=0;this.bleedFx=0;
    this.state='idle';this.stateT=1;this.elapsed=0;this.phase='rest';this.beat=0;this.repeats=0;this.lift=0;this.groundT=0;
    this.gait=0;this.sway=0;this.settle=0;this.walkBlend=0;this.visualTilt=-1.1;this.visualRoll=0;
    this.holder=new THREE.Group();this.model=buildShark();this.model.scale.setScalar(.60);
    this.model.position.y=-.45;this.model.rotation.x=-1.1; // submerged even on the creation frame
    this.holder.add(this.model);this.holder.position.fromArray(arena.spawn);scene.add(this.holder);
    this.floor=this.floorAt(this.holder.position);this.holder.position.y=this.floor;
    this.model.rig.clipPlane.constant=-this.floor;
    this.arrivalT=0;this.flooded=0;
    const A=arena,arrival=this.def.skills.arrival,width=A.arenaMax[0]-A.arenaMin[0],length=A.arenaMax[2]-A.arenaMin[2];
    this.waterFloor=this.floorAt(V(this.position.x,0,A.arenaMin[2]+.3))-.003;
    this.water=new THREE.Mesh(new THREE.BoxGeometry(width,arrival.depth,length),sharkWaterMaterial());
    this.water.position.set((A.arenaMin[0]+A.arenaMax[0])/2,this.waterFloor,(A.arenaMin[2]+A.arenaMax[2])/2);
    this.water.userData.noCollide=true;this.water.name='Shark bed water';this.water.renderOrder=2;scene.add(this.water);
    const U=this.water.material.uniforms;U.uCenter.value.set(this.water.position.x,this.water.position.z);U.uExtent.value.set(width/2,length/2);U.uSource.value.set(this.position.x,this.position.z);U.uFill.value=0;
    U.uReach.value=Math.hypot(Math.max(this.position.x-A.arenaMin[0],A.arenaMax[0]-this.position.x),Math.max(this.position.z-A.arenaMin[2],A.arenaMax[2]-this.position.z))+.04;
    this.start=V();this.target=V();this.warning=null;this.pools=[];this.tornadoes=[];this.shots=[];
    this.color=hostile('shark');this.dust=new THREE.Color(LOOK.color('shark-dust','#d6c5a7'));
    this.camera={distance:LOOK.num(IS_TOUCH?'shark-camera-distance-phone':'shark-camera-distance',IS_TOUCH?1.25:1.1),pitch:LOOK.num(IS_TOUCH?'shark-camera-tilt-phone':'shark-camera-tilt',IS_TOUCH ? .62 : .88),ahead:IS_TOUCH?1.4:1};
    this.cameraBase={distance:this.camera.distance,pitch:this.camera.pitch};this.cameraAir=IS_TOUCH?LOOK.num('shark-camera-air-room-phone',3):0;
    // A separate inexpensive fin proxy is visible while the full model is beneath the quilt.
    this.fin=new THREE.Mesh(new THREE.ConeGeometry(.065,.15,3).scale(.18,1,1),this.model.rig.mat);
    this.fin.geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(this.fin.geometry.attributes.position.count).fill([.23,.38,.48]).flat(),3));
    this.fin.userData.noCollide=true;this.fin.visible=false;scene.add(this.fin);
    this.circleGeo=new THREE.CircleGeometry(1,48).rotateX(-Math.PI/2);
    Object.assign(this,hazardAssets(this.color));
    this.fish=new THREE.InstancedMesh(this.fishGeo,this.fishMat,72);this.fish.count=0;this.fish.userData.noCollide=true;this.fish.frustumCulled=false;scene.add(this.fish);
    this._matrix=new THREE.Matrix4();this._quat=new THREE.Quaternion();this._pos=V();this._scale=V(1,1,1);this._up=V(0,1,0);this._front=V();this._move=V();
    this.off=bus.on('player_hurt',e=>{
      if(this.dead||this.dying||!['shark-bite','shark-melee','shark-impact'].includes(e.from))return;
      this.confirmed=true;if(e.from==='shark-impact')return;
      const sk=this.def.skills;
      if(!this.prey)this.fx.number(this.player.position.clone().add(V(0,.12,0)),'PREY',this.color,14);
      this.prey=sk.scent.time;this.bleed=sk.scent.bleed;
      if(e.from==='shark-bite'&&!this.stunT){if(!this.frenzy)this.fx.number(this.center(),'FEEDING FRENZY',this.color,15);this.frenzy=sk.frenzy.time;this.fx.ring(this.center(),this.color,.24,.4);}
    });
    this.stunT=0;
    this.offStatus=bus.on('status_applied',e=>{
      if(enemies.byId.get(e.targetId)?.proxy!==this||!['stun','pin','freeze'].includes(e.status))return;
      this.stunT=Math.max(this.stunT,e.duration||.5);this.frenzy=0;this.recover();
    });
    this.tornadoVisuals=Array.from({length:3},()=>{const m=new THREE.Mesh(this.tornadoGeo,this.tornadoMat);m.position.copy(this.position);m.scale.setScalar(.001);m.userData.noCollide=true;scene.add(m);return m;});
    this.warn(this.position,.1,.1); // include the warning material in main.js's existing shader warmup
    this.fish.count=1;this._matrix.makeTranslation(this.position.x,this.position.y,this.position.z);this.fish.setMatrixAt(0,this._matrix);this.fish.instanceMatrix.needsUpdate=true;
  }
  get position(){return this.holder.position;}
  get angry(){return this.hp<=this.maxHp*this.def.skills.tornado.at;}
  get ready(){const a=this.def.skills.arrival;return this.arrivalT>=a.barrier+a.breach+a.flood;}
  get shielded(){return !this.model.visible||this.phase==='eruption'||this.rise<1;}
  get buried(){return ['dive','burrowBite','maelstrom','tornado'].includes(this.state)&&this.phase==='track';}
  center(out=V()){return out.copy(this.position).addScaledVector(this._front.set(Math.sin(this.heading),0,Math.cos(this.heading)),.09).setY(this.position.y+.23+this.lift-(this.crouch||0));}
  floorAt(p){
    // Surface casts happen at destinations, not in every animation frame.
    const hit=this.world?.castAll(V(p.x,this.arena.arenaMax[1]+.25,p.z),V(0,-1,0),1.2);
    return hit?.normal?.y>.5?hit.point.y+.003:this.arena.arenaMin[1]+.045;
  }
  clampIn(p,margin=this.bound){
    p.x=clamp(p.x,this.arena.arenaMin[0]+margin,this.arena.arenaMax[0]-margin);
    p.z=clamp(p.z,this.arena.arenaMin[2]+margin,this.arena.arenaMax[2]-margin);return p;
  }
  damage(amount,color='#fff',feedback={}){
    if(this.dead||this.dying||this.rise<1||this.shielded)return;
    this.hp=Math.max(0,this.hp-amount);this.hitPop=.14;
    this.fx.number(this.center().add(V(0,.08,0)),amount,color,18,feedback);
    if(!this.hp){this.dying=true;this.clearHazards();this.clearWarning();this.state='idle';this.phase='rest';}
  }
  die(){if(this.dying){this.dead=true;this.dying=false;this.clearHazards();this.clearWarning();juice.feel('boss-kill');}}
  warn(at,r,height=.12){
    this.clearWarning();
    const floor=new THREE.Mesh(this.circleGeo,this.fx.tele(this.color,'circle'));
    floor.position.copy(at).add(V(0,.004,0));floor.scale.setScalar(r);floor.renderOrder=3;this.scene.add(floor);
    const volume=this.fx.volume(this.color,'disc',at,V(r,height,r));
    this.warning={floor,volume,at:at.clone(),r,height};
  }
  clearWarning(){if(!this.warning)return;for(const m of [this.warning.floor,this.warning.volume]){this.scene.remove(m);m.material.dispose();}this.warning=null;}
  burst(at,r,heavy=false){
    this.settle=1;
    this.fx.impact(at,this.color,r*.25,heavy?18:10);this.fx.ring(at,this.color,r,.4);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;this.fx.puff(at.clone().add(V(Math.sin(a)*r*.5,.025,Math.cos(a)*r*.5)),this.dust,.028,.5);}
    this.fx.splat(at,this.dust,r*.7);juice.feel(heavy?'impact-big':'impact');sfx.crocThump(heavy?1.3:.8);
  }
  begin(name,player=this.player){
    if(!player||this.dead||this.dying)return;
    this.state=name;this.phase='windup';this.elapsed=0;this.beat=0;this.repeats=0;this.lift=0;
    this.aim(player);this.prepare(player);sfx.whiz();
  }
  aim(player){this.aimHeading=Math.atan2(player.position.x-this.position.x,player.position.z-this.position.z);}
  skill(){return this.def.skills[this.state];}
  prepare(player){
    const sk=this.skill();this.start.copy(this.position);
    if(['leap','dive','burrowBite','maelstrom','tornado'].includes(this.state)){
      this.target.copy(player.position);this.clampIn(this.target);this.target.y=this.floorAt(this.target);
      this.warn(this.target,sk.radius,sk.height);
    }else{
      const forward=['bite','rear'].includes(this.state)||(this.state==='combo'&&this.beat===0);
      this.target.copy(this.position).addScaledVector(V(Math.sin(this.aimHeading),0,Math.cos(this.aimHeading)),forward?sk.reach:0);
      this.clampIn(this.target,.05);this.target.y=this.floor;
      this.warn(this.target,forward?sk.radius:(sk.sweep??sk.radius),sk.height);
    }
  }
  hit(player,at,r,height,amount,bite=false,melee=true){
    const p=player.position;
    if(Math.hypot(p.x-at.x,p.z-at.z)>r+player.cfg.radius||p.y>=at.y+height||p.y+player.cfg.height<=at.y)return false;
    this.confirmed=false;
    bus.emit('damage_taken',{targetId:PLAYER,amount:amount*(this.frenzy>0?this.def.skills.frenzy.damage:1),source:'boss',from:bite?'shark-bite':melee?'shark-melee':'shark-impact'});
    if(!this.confirmed||this.dead||this.dying||this.stunT>0)return false;
    const dir=V(p.x-at.x,0,p.z-at.z);if(dir.lengthSq()<1e-6)dir.set(0,0,1);
    bus.emit('knockback',{targetId:PLAYER,dir:dir.normalize(),force:this.def.skills.motion.knock,launch:.08});
    this.fx.impact(p.clone().add(V(0,.04,0)),this.color,.035,12);return true;
  }
  release(player){
    const sk=this.skill();this.phase='active';this.elapsed=0;this.heading=this.aimHeading;this.struck=false;this.lastSpinProgress=0;
    if(['bite','rear','combo','spin'].includes(this.state)){
      this.fx.impact(this.center(),this.color,.035,6);sfx.whiz();
    }else if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){
      this.phase='track';this.elapsed=0;this.clearWarning();this.model.visible=false;this.fin.visible=true;
      if(this.state==='maelstrom')this.pool(this.position,this.def.skills.maelstrom.radius,true);
    }else {sfx.whiz();this.fx.puff(this.position,this.dust,.08,.4);}
  }
  pool(at,r=this.def.skills.pools.radius,slow=false){
    const sk=this.def.skills.pools;
    if(this.pools.length>=sk.max)this.removePool(this.pools.shift());
    const floor=new THREE.Mesh(this.circleGeo,this.fx.tele(this.color,'circle'));
    floor.position.copy(at).setY(at.y+.005);floor.scale.setScalar(r);floor.material.progress=1;floor.renderOrder=3;this.scene.add(floor);
    floor.material.opacity=LOOK.num('shark-pool-warning-opacity',.09);
    floor.material.uniforms.uColor.value.set(LOOK.color('shark-pool-boundary','#8b6841'));
    const volume=this.fx.volume(this.color,'disc',at,V(r,sk.height,r));volume.material.progress=1;
    volume.material.opacity=LOOK.num('shark-pool-warning-opacity',.09);
    volume.material.uniforms.uColor.value.set(LOOK.color('shark-pool-boundary','#8b6841'));
    const surface=new THREE.Mesh(this.circleGeo,sharkWaterMaterial().clone()),U=surface.material.uniforms;
    surface.position.copy(at).setY(at.y+.011);surface.scale.setScalar(r);surface.renderOrder=2;surface.userData.noCollide=true;this.scene.add(surface);
    U.uMurky.value=1;U.uCircular.value=1;U.uCenter.value.set(at.x,at.z);U.uExtent.value.set(r,r);U.uSource.value.set(at.x,at.z);U.uReach.value=r+.025;U.uFill.value=1;U.uWake.value=0;
    this.pools.push({at:at.clone(),r,floor,volume,surface,life:slow?this.def.skills.maelstrom.life:sk.life,slow,age:0});
    this.fx.impact(at,this.color,.04,8);sfx.mugSplash();
  }
  removePool(p){for(const m of [p.floor,p.volume,p.surface]){this.scene.remove(m);m.material.dispose();}}
  launchTornadoes(){
    const sk=this.def.skills.tornado;
    for(let i=0;i<3;i++){
      const m=this.tornadoVisuals[i];m.visible=true;m.scale.setScalar(1);m.position.copy(this.position);
      const a=i*Math.PI*2/3+this.heading;
      this.tornadoes.push({m,dir:V(Math.sin(a),0,Math.cos(a)),life:sk.life,fishT:.4,age:0});
    }
  }
  fishShot(from,angle){
    if(this.shots.length>=12)return;
    const to=this.clampIn(from.clone().add(V(Math.sin(angle)*.45,0,Math.cos(angle)*.45)),.08);to.y=this.floorAt(to);
    const m=this.fx.orb(this.color,.012);m.position.copy(from);this.shots.push({m,from:from.clone(),to,t:0});
    this.fx.impact(from,this.color,.02,5);sfx.clogSpit();
  }
  hazards(dt,player){
    const sk=this.def.skills.pools, T=this.def.skills.tornado;let fish=0;
    const drawFish=(p,a,scale=1)=>{
      if(fish>=72)return;this._quat.setFromAxisAngle(this._up,a);this._scale.setScalar(scale);
      this._matrix.compose(p,this._quat,this._scale);this.fish.setMatrixAt(fish++,this._matrix);
    };
    for(let i=this.pools.length-1;i>=0;i--){
      const p=this.pools[i];p.life-=dt;p.age+=dt;p.floor.material.time=this.t;
      p.surface.material.uniforms.uTime.value=this.t;
      if(p.life<=0){this.removePool(p);this.pools.splice(i,1);continue;}
      if(Math.hypot(player.position.x-p.at.x,player.position.z-p.at.z)<p.r+player.cfg.radius&&player.position.y<p.at.y+sk.height&&player.position.y+player.cfg.height>p.at.y){
        if(p.slow)bus.emit('status_applied',{targetId:PLAYER,status:'slow',duration:.15});
        else bus.emit('damage_taken',{targetId:PLAYER,amount:sk.dmg*dt,source:'boss',drain:true});
        if(this.dead||this.dying)return;
      }
      for(let k=0;k<5;k++){const a=this.t*(k%2?2:-2)+k*2.4;this._pos.set(Math.sin(a)*p.r*.65,.018+Math.abs(Math.sin(this.t*5+k))*.024,Math.cos(a)*p.r*.65).add(p.at);drawFish(this._pos,-a,1);}
    }
    for(let i=this.tornadoes.length-1;i>=0;i--){
      const q=this.tornadoes[i];q.life-=dt;q.age+=dt;q.m.rotation.y+=dt*8;
      q.m.position.addScaledVector(q.dir,T.travel*dt);this.clampIn(q.m.position,.10);
      if(q.life<=0){q.m.visible=false;this.tornadoes.splice(i,1);continue;}
      this.hitTornado(q,dt,player);
      if(this.dead||this.dying)return;
      if((q.fishT-=dt)<=0){q.fishT=T.fishEvery;this.fishShot(q.m.position.clone().add(V(0,.17,0)),q.age*3+i*2);}
      for(let k=0;k<4;k++){const a=this.t*7+k*1.57;this._pos.set(Math.sin(a)*.06,.04+k*.055,Math.cos(a)*.06).add(q.m.position);drawFish(this._pos,-a,1.1);}
    }
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i];s.t+=dt;const t=clamp(s.t/T.flight,0,1);
      s.m.position.lerpVectors(s.from,s.to,t).y+=Math.sin(t*Math.PI)*.20;this.fx.orbTick(s.m,dt);
      drawFish(s.m.position,this.t*8,1.4);
      if(t>=1){this.burst(s.to,.08);this.hit(player,s.to,.08,.10,T.fishDmg,false,false);if(this.dead||this.dying)return;this.pool(s.to);this.fx.free(s.m);this.shots.splice(i,1);}
    }
    this.fish.count=fish;this.fish.instanceMatrix.needsUpdate=true;
  }
  hitTornado(q,dt,player){
    if(Math.hypot(player.position.x-q.m.position.x,player.position.z-q.m.position.z)<.10+player.cfg.radius&&player.position.y<q.m.position.y+.28&&player.position.y+player.cfg.height>q.m.position.y)
      bus.emit('damage_taken',{targetId:PLAYER,amount:this.def.skills.tornado.dmg*dt,source:'boss',drain:true});
  }
  clearHazards(){
    for(const p of this.pools)this.removePool(p);this.pools.length=0;
    for(const q of this.tornadoes)q.m.visible=false;this.tornadoes.length=0;
    for(const s of this.shots)this.fx.free(s.m);this.shots.length=0;this.fish.count=0;
  }
  recover(){this.clearWarning();this.phase='rest';this.elapsed=0;this.model.visible=true;this.fin.visible=false;this.lift=0;this.crouch=0;this.model.position.y=.15;this.model.rotation.x=-.4;}
  updateWater(dt,player){
    const a=this.def.skills.arrival,U=this.water.material.uniforms;
    this.flooded=clamp((this.arrivalT-a.barrier-a.breach)/a.flood,0,1);
    if(this.flooded>0&&!this.floodAnnounced){this.floodAnnounced=true;this.fx.ring(this.position,U.uFoam.value,.25,.7);sfx.mugSplash();}
    U.uFill.value=this.flooded;U.uTime.value=this.t;U.uPlayer.value.set(player.position.x,player.position.z);U.uWake.value=clamp((player.speed||0)/.2,0,1);
    this.water.scale.y=Math.max(.001,this.flooded);this.water.position.y=this.waterFloor+a.depth*this.flooded/2;
    this.water.visible=!this.dead&&!this.dying;
    const p=player.position,A=this.arena;
    if(this.flooded>0&&!this.dead&&!this.dying&&player.grounded!==false&&p.x>A.arenaMin[0]&&p.x<A.arenaMax[0]&&p.z>A.arenaMin[2]&&p.z<A.arenaMax[2]&&p.y>=this.waterFloor-.01&&p.y<this.waterFloor+a.depth+.005&&Math.hypot(p.x-U.uSource.value.x,p.z-U.uSource.value.y)<U.uReach.value*this.flooded)
      bus.emit('status_applied',{targetId:PLAYER,status:'slow',strength:a.slow,duration:dt});
  }
  update(dt,player){
    this.player=player;this.t+=dt;this.lift ||=0;
    this.arrivalT+=dt;this.updateWater(dt,player);
    if(this.dead){this.model.rotation.z=mix(this.model.rotation.z,-1.4,1-Math.exp(-5*dt));this.holder.position.y-=dt*.025;return{push:null};}
    const arrival=this.def.skills.arrival;
    this.rise=clamp((this.arrivalT-arrival.barrier)/arrival.breach,0,1);
    this.hitPop=Math.max(0,(this.hitPop||0)-dt);this.frenzy=Math.max(0,this.frenzy-dt);this.prey=Math.max(0,this.prey-dt);
    if(this.dying){this.model.visible=true;this.fin.visible=false;this.lift=0;this.model.position.y=.15;this.model.rotation.x=-.4;this.model.pose({gape:.5,tailSwing:Math.sin(this.t*2)*.07});return{push:null};}
    if(this.bleed>0){this.bleed=Math.max(0,this.bleed-dt);bus.emit('damage_taken',{targetId:PLAYER,amount:this.def.skills.scent.dmg*dt,source:'boss',drain:true});
      if(this.dead||this.dying)return{push:null};
      if((this.bleedFx-=dt)<=0){this.bleedFx=.22;this.fx.puff(player.position.clone().add(V(0,.04,0)),this.color,.009,.3);}}
    const rate=this.frenzy>0?this.def.skills.frenzy.tempo:1;
    this.stunT=Math.max(0,this.stunT-dt);if(!this.stunT)this.elapsed+=dt*rate;this.hazards(dt,player);
    if(this.dead||this.dying)return{push:null};
    if(this.stunT>0){this.model.pose({gape:.1});return{push:null};}
    let gape=.06,tailSwing=Math.sin(this.t*(this.frenzy?9:4))*.18,left=0,right=0,tilt=-.4,coil=0,stretch=0,roll=0,squint=this.hitPop>0?.8:0;this.crouch=0;
    const turn=Math.atan2(player.position.x-this.position.x,player.position.z-this.position.z);
    const delta=Math.atan2(Math.sin(turn-this.heading),Math.cos(turn-this.heading));
    const headTurn=clamp(delta,-.25,.25);
    this.settle=Math.max(0,this.settle-dt*3.5);
    this.sway=mix(this.sway,clamp(delta,-1,1),1-Math.exp(-6*dt));
    const walking=this.phase==='rest'&&this.position.distanceTo(player.position)>.42;
    this.walkBlend=mix(this.walkBlend,walking?1:0,1-Math.exp(-8*dt));
    this.gait+=dt*mix(2,7*rate,this.walkBlend);
    const stride=Math.sin(this.gait),strideBack=Math.sin(this.gait-Math.PI);
    left=stride*mix(.045,.3,this.walkBlend);right=strideBack*mix(.045,.3,this.walkBlend);
    tailSwing+=this.sway*.35;roll=this.sway*.08+stride*.045*this.walkBlend+Math.sin(this.t*1.3)*.015;
    coil=this.settle*.6;stretch=-this.settle*.65;
    this.lift=Math.abs(stride)*.009*this.walkBlend;
    if(!this.ready){
      this.clearWarning();for(const m of this.tornadoVisuals)m.visible=false;this.model.scale.setScalar(.60);
      gape=Math.sin(this.rise*Math.PI)*.8;this.lift=mix(-.60,0,ease(this.rise));tilt=mix(-1.1,-.4,ease(this.rise));this.elapsed=0;
      if(this.rise>0&&this.rise<1&&(this.wakeT=(this.wakeT||0)-dt)<=0){this.wakeT=.08;this.fx.puff(this.position,this.dust,.04,.4);}
    }
    else if(this.phase==='rest'){
      this.heading+=clamp(delta,-dt*2,dt*2);
      if(this.position.distanceTo(player.position)>.42){this.position.x+=Math.sin(this.heading)*this.def.skills.motion.speed*dt*rate;this.position.z+=Math.cos(this.heading)*this.def.skills.motion.speed*dt*rate;this.clampIn(this.position);}
      if(!this.stunT&&this.elapsed>(this.state==='tornado'?this.def.skills.motion.punish:this.def.skills.motion.rest)){
        const names=this.angry?ATTACKS.angry:ATTACKS.calm;let name=names[this.next++%names.length];
        const dist=this.position.distanceTo(player.position);
        if(Math.abs(delta)>2&&name==='bite')name='rear';else if(dist>.65&&name==='bite')name='leap';
        this.begin(name,player);
      }
    }else if(this.phase==='windup'){
      const sk=this.skill(), progress=clamp(this.elapsed/sk.windup,0,1);
      const difference=Math.atan2(Math.sin(this.aimHeading-this.heading),Math.cos(this.aimHeading-this.heading));
      this.heading+=clamp(difference,-dt*4,dt*4);gape=ease(progress)*.85;tilt-=Math.sin(progress*Math.PI)*.17;
      coil=ease(progress);tailSwing-=Math.sin(progress*Math.PI)*.35;stretch=-Math.sin(progress*Math.PI)*.4;
      squint=ease(progress)*.7;
      if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){tilt+=ease(progress)*1.1;this.lift=-ease(progress)*.60;left=right=-ease(progress)*.4;}
      else if(this.state==='leap'){this.crouch=ease(progress)*.035;left=right=-ease(progress)*.5;}
      if(this.state==='combo'&&this.beat===1)left=-ease(progress)*1.1;
      if(this.state==='spin'||(this.state==='combo'&&this.beat===2)){roll=-Math.sin(progress*Math.PI)*.16;coil=ease(progress)*1.5;}
      if(this.warning){this.warning.floor.material.progress=this.warning.volume.material.progress=progress;this.warning.floor.material.time=this.t;}
      if(progress>=1)this.release(player);
    }else if(this.phase==='track'){
      const sk=this.skill(), scent=this.prey>0?this.def.skills.scent.speed:1;
      const direction=this._move.set(player.position.x-this.position.x,0,player.position.z-this.position.z), distance=direction.length();
      const aim=Math.atan2(direction.x,direction.z),change=Math.atan2(Math.sin(aim-this.heading),Math.cos(aim-this.heading));
      this.heading+=clamp(change,-dt*2*scent,dt*2*scent);
      if(distance>.01)this.position.addScaledVector(V(Math.sin(this.heading),0,Math.cos(this.heading)),Math.min(distance,sk.speed*dt*scent*rate));
      this.clampIn(this.position);
      this.fin.position.copy(this.position).setY(this.floor+.055);this.fin.rotation.y=this.heading;
      if((this.wakeT=(this.wakeT||0)-dt)<=0){this.wakeT=.08;this.fx.puff(this.fin.position,this.dust,.015,.25);}
      if(this.elapsed>=sk.track){
        this.target.copy(this.position);this.target.y=this.floorAt(this.target);this.floor=this.target.y;
        this.warn(this.target,sk.radius,sk.height);this.phase='eruption';this.elapsed=0;sfx.whiz();
      }
    }else if(this.phase==='eruption'){
      const sk=this.skill(), t=clamp(this.elapsed/sk.tell,0,1);
      this.warning.floor.material.progress=this.warning.volume.material.progress=t;
      // The floor clips the buried portion; reveal the snout before the shoulders and tail.
      const emerge=ease(clamp((t-.35)/.65,0,1));
      this.model.visible=emerge>0;this.fin.visible=emerge<.25;
      this.lift=mix(-.60,sk.apex*.45,emerge);tilt=-.4-Math.sin(.15*Math.PI)*.9;gape=.9*emerge;
      coil=-emerge*.6;left=right=-emerge*.6;stretch=emerge*.5;
      if(emerge>0&&emerge<1&&(this.wakeT-=dt)<=0){this.wakeT=.07;this.fx.puff(this.position,this.dust,.035,.3);}
      if(t>=1){this.phase='active';this.elapsed=0;this.start.copy(this.position);this.start.y=this.floor;this.model.visible=true;this.fin.visible=false;this.clearWarning();
        this.lift=sk.apex*.45;gape=.9;
        this.burst(this.target,sk.radius,true);this.hit(player,this.target,sk.radius,sk.height,sk.dmg,this.state==='burrowBite',false);
        if(this.dead||this.dying||this.phase!=='active')return{push:null};
        this.pool(this.target);if(this.state==='tornado')this.launchTornadoes();
        if(this.state==='maelstrom'||this.state==='tornado'){
          if(this.state==='maelstrom'){this.target.copy(player.position);this.clampIn(this.target);this.target.y=this.floorAt(this.target);}
          this.warn(this.target,sk.radius,sk.height);
        }}
    }else if(this.phase==='active'){
      const sk=this.skill(), p=clamp(this.elapsed/sk.active,0,1);
      gape=Math.max(.04,(1-p)*.9);tailSwing+=Math.sin(p*Math.PI)*.8;
      stretch=Math.sin(p*Math.PI)*.65;coil=-Math.sin(p*Math.PI)*.7;
      squint=-Math.sin(p*Math.PI)*.4;
      if(['bite','rear','combo','spin'].includes(this.state)){
        const bite=this.state==='bite'||this.state==='rear'||(this.state==='combo'&&this.beat===0);
        const sweep=this.state==='spin'||(this.state==='combo'&&this.beat===2);
        if(bite){gape=.9*Math.max(0,1-p/.33);this.crouch=Math.sin(Math.min(1,p/.66)*Math.PI)*.16;tilt+=this.crouch*2.5;this.position.copy(this.start).addScaledVector(V(Math.sin(this.heading),0,Math.cos(this.heading)),Math.sin(p*Math.PI)*.10);this.clampIn(this.position);}
        const contact=sweep?arcHits(this.warning.at,.08,this.warning.r,this.aimHeading+this.lastSpinProgress*Math.PI*2+Math.PI,this.aimHeading+p*Math.PI*2+Math.PI,this.warning.height,player.position,player.cfg):p>=(bite ? .33 : .5);
        if(!this.struck&&contact){
          // Damage callbacks can synchronously kill or stun the attacker.
          const warning=this.warning;this.struck=true;this.hit(player,warning.at,warning.r,warning.height,sk.dmg,bite);
          if(this.dead||this.dying||this.phase!=='active')return{push:null};
          this.burst(warning.at,warning.r);if(bite)sfx.cofferChomp();else sfx.wind();
          if(!sweep)this.clearWarning();
        }
        this.lastSpinProgress=p;
      }
      if(this.state==='leap'){
        this.position.lerpVectors(this.start,this.target,ease(p));this.floor=mix(this.start.y,this.target.y,p);this.lift=Math.sin(p*Math.PI)*sk.apex;tilt=-.4+Math.sin(p*Math.PI)*.8;
        left=right=-Math.sin(p*Math.PI)*.8;tailSwing*=.45;coil=Math.sin(p*Math.PI)*1.2;stretch=Math.sin(p*Math.PI);
        if(p>=1){this.burst(this.target,sk.radius,true);this.hit(player,this.target,sk.radius,sk.height,sk.dmg,false,false);if(this.dead||this.dying||this.phase!=='active')return{push:null};this.clearWarning();}
      }else if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){
        if(this.state==='maelstrom'){this.position.lerpVectors(this.start,this.target,ease(p));this.floor=mix(this.start.y,this.target.y,p);}
        if(this.warning)this.warning.floor.material.progress=this.warning.volume.material.progress=p;
        this.lift=Math.sin((.15+p*.85)*Math.PI)*sk.apex;tilt=-.4-Math.sin((.15+p*.85)*Math.PI)*.9;gape=.9*Math.sin((.15+p*.85)*Math.PI);
        coil=-Math.sin((.2+p*.8)*Math.PI)*1.1;stretch=Math.sin((.15+p*.85)*Math.PI);left=right=-Math.sin((.3+p*.7)*Math.PI)*.75;
        gape=.9*Math.sin((.5+p*.5)*Math.PI);
        if(this.state==='dive'&&this.repeats<sk.count-1){const sink=ease(clamp((p-.65)/.35,0,1));tilt+=sink*1.2;this.lift-=sink*.60;}
        if(p>=1){this.burst(this.position,sk.radius,true);
          if(this.state==='tornado'||this.state==='maelstrom')this.hit(player,this.position,sk.radius,sk.height,sk.dmg,false,false);
          if(this.dead||this.dying||this.phase!=='active')return{push:null};}
      }else if(this.state==='spin'||(this.state==='combo'&&this.beat===2)){this.heading=this.aimHeading+p*Math.PI*2;roll=Math.sin(p*Math.PI)*.18;coil=Math.sin(p*Math.PI)*1.3;}
      else if(this.state==='combo'&&this.beat===1){left=Math.sin(p*Math.PI)*1.5;right=-Math.sin(p*Math.PI)*.35;roll=-Math.sin(p*Math.PI)*.14;}
      else this.lift=Math.sin(p*Math.PI)*.035;
      if(p>=1){
        if(this.state==='combo'&&this.beat<2){this.beat++;this.phase='windup';this.elapsed=0;this.aim(player);this.prepare(player);}
        else if(this.state==='dive'&&++this.repeats<sk.count){this.phase='track';this.elapsed=0;this.model.visible=false;this.fin.visible=true;}
        else this.recover();
      }
    }
    if(this.phase!=='active'&&(this.groundT-=dt)<=0){this.groundT=.15;this.floor=this.floorAt(this.position);}
    this.position.y=this.floor;this.holder.rotation.y=this.heading;
    this.model.rig.clipPlane.constant=-this.floor;
    const blend=1-Math.exp(-16*dt);
    this.visualTilt=mix(this.visualTilt,tilt,blend);this.visualRoll=mix(this.visualRoll,roll,blend);
    // The jaw remains frame-exact; only secondary body motion eases between poses.
    this.model.position.y=.15+this.lift-this.crouch;this.model.rotation.set(this.visualTilt,0,this.visualRoll);
    this.model.pose({gape,headTurn,tailSwing,left,right,finLift:this.crouch*5,breath:Math.sin(this.t*2),coil,roll,stretch,time:this.t,energy:this.frenzy>0?1.6:1,squint});
    const air=Math.max(0,this.lift);this.camera.distance=this.cameraBase.distance+air*this.cameraAir;this.camera.pitch=this.cameraBase.pitch+Math.min(.3,air*this.cameraAir*.27);
    this.model.rig.mat.emissive.copy(this.color).multiplyScalar(this.hitPop>0?.5:(this.frenzy>0?.13:0));
    bus.emit('boss_health',{name:this.arena.name,hp:this.hp,maxHp:this.maxHp,shielded:this.shielded,shieldText:'BENEATH THE QUILT'});
    return{push:null};
  }
  dispose(){
    this.off();this.offStatus();this.clearWarning();this.clearHazards();this.scene.remove(this.holder,this.fin,this.fish,this.water,...this.tornadoVisuals);
    // Shark model geometry/materials are shared with the warmed template and stay alive.
    this.fin.geometry.dispose();this.circleGeo.dispose();this.fish.dispose(); // hazard geometry/materials stay warmed too
    this.water.geometry.dispose();
    this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
  }
}
