// Act 3's moving plush shark. Damage/state numbers live in content/bosses.kdl.
// The quilt is its sea: only a dorsal fin remains above it during a dive.
import * as THREE from 'three';
import { buildShark, ghostly } from './shark-model.js';
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
// its size: the model's scale, and K, the body's other measures against the size it was built at (0.60)
const SIZE=.45,K=SIZE/.60;
export const ATTACKS={calm:['bite','leap','combo','spin','rear','dive','burrowBite','maelstrom'],angry:['bite','combo','dive','tornado','leap','spin','maelstrom','burrowBite','rear'],always:['pools']};
let SHARED_HAZARDS=null;
function hazardAssets(color){
  if(SHARED_HAZARDS)return SHARED_HAZARDS;
  const paint=(geo,hex)=>{const c=new THREE.Color(hex),a=[];for(let i=0;i<geo.attributes.position.count;i++)a.push(c.r,c.g,c.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return geo.toNonIndexed();};
  const body=LOOK.color('shark-fish-body','#6c8da6'),belly=LOOK.color('shark-fish-belly','#e6eef4'),fin=LOOK.color('shark-fish','#ff7b54');
  // Stylized predatory bait-fish: metallic blue-slate back, pale belly, coral-red dorsal/pectoral/forked-tail fins, fierce underbite & bright eyes
  const fishParts=[
    paint(new THREE.SphereGeometry(1,10,6).scale(.022,.011,.0075),body),                                              // sleek upper body
    paint(new THREE.SphereGeometry(1,8,5).scale(.019,.007,.0065).translate(.001,-.0045,0),belly),                     // pale metallic belly
    paint(new THREE.ConeGeometry(.009,.020,4).scale(1.1,1,.3).rotateZ(.45).translate(-.002,.013,0),fin),              // spiky dorsal fin
    paint(new THREE.ConeGeometry(.008,.018,3).scale(1,1,.35).rotateZ(Math.PI/2+.38).translate(-.024,.005,0),fin),     // upper forked tail lobe
    paint(new THREE.ConeGeometry(.008,.018,3).scale(1,1,.35).rotateZ(Math.PI/2-.38).translate(-.024,-.005,0),fin),    // lower forked tail lobe
    paint(new THREE.BoxGeometry(.012,.004,.009).rotateZ(-.22).translate(.016,-.004,0),fin),                           // fierce underbite jaw
  ];
  for(const s of [-1,1]){
    fishParts.push(paint(new THREE.ConeGeometry(.005,.012,3).scale(1,1,.35).rotateX(s*1.2).translate(.004,-.004,s*.008),fin)); // pectoral fins
    fishParts.push(paint(new THREE.SphereGeometry(.0024,6,4).translate(.014,.0035,s*.0062),'#ffe67a'));               // bright predator eye
    fishParts.push(paint(new THREE.SphereGeometry(.0013,6,4).translate(.0155,.0038,s*.0072),'#101318'));              // pupil
  }
  const fishGeo=mergeGeometries(fishParts);fishParts.forEach(g=>g.dispose());
  const fishMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.22,emissive:color,emissiveIntensity:.18});
  const spiral=[];for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*10,r=.095*(1-t)+.02;spiral.push(V(Math.cos(a)*r,t*.28,Math.sin(a)*r));}
  const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral),120,.007,6);
  const funnel=new THREE.CylinderGeometry(.025,.10,.28,24,1,true).translate(0,.14,0);
  const tubeFlat=tube.toNonIndexed(),funnelFlat=funnel.toNonIndexed(),tornadoGeo=mergeGeometries([tubeFlat,funnelFlat]);
  tube.dispose();funnel.dispose();tubeFlat.dispose();funnelFlat.dispose();
  const tornadoMat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.55,side:THREE.DoubleSide});
  return SHARED_HAZARDS={fishGeo,fishMat,tornadoGeo,tornadoMat};
}

export class Shark {
  // ctx.illusion: this is the see-through copy the shark summons at half Health (summon()): it has no
  // Health, isn't an enemy (nothing aims at it, attacks pass through it) and only attacks
  constructor(scene,enemies,fx,arena,world,ctx={}){
    Object.assign(this,{scene,enemies,fx,arena,world});
    this.illusion=!!ctx.illusion;
    this.kind='shark';this.def=CONTENT.bosses.shark;this.hp=this.maxHp=this.def.hp;
    this.r=.19*K;this.bound=.39*K;this.rise=0;this.t=0;this.next=0;this.heading=Math.PI;
    this.dead=false;this.dying=false;this.frenzy=0;this.prey=0;this.bleed=0;this.bleedFx=0;
    this.state='idle';this.stateT=1;this.elapsed=0;this.phase='rest';this.beat=0;this.repeats=0;this.lift=0;this.groundT=0;
    this.gait=0;this.sway=0;this.settle=0;this.walkBlend=0;this.visualTilt=-1.1;this.visualRoll=0;
    // 2nd-order plush bounce, head-kick & flinch springs (zero allocations per frame)
    this.squash=0;this.squashV=0;this.flinch=0;this.flinchV=0;this.headKick=0;this.headKickV=0;this.poolFxT=0;
    this.holder=new THREE.Group();this.model=buildShark();if(this.illusion)ghostly(this.model,LOOK.num('shark-illusion-opacity',.35));this.model.scale.setScalar(SIZE);
    this.model.position.y=-.45;this.model.rotation.x=-1.1; // submerged even on the creation frame
    this.holder.add(this.model);this.holder.position.fromArray(arena.spawn);scene.add(this.holder);
    this.floor=this.floorAt(this.holder.position);this.holder.position.y=this.floor;
    this.model.rig.clipPlane.constant=-this.floor;
    this.arrivalT=0;this.flooded=0;
    const A=arena,arrival=this.def.skills.arrival,width=A.arenaMax[0]-A.arenaMin[0],length=A.arenaMax[2]-A.arenaMin[2];
    if(!this.illusion){   // the illusion floods nothing: the real shark's sea is already there
    this.waterFloor=this.floorAt(V(this.position.x,0,A.arenaMin[2]+.3))-.003;
    this.water=new THREE.Mesh(new THREE.BoxGeometry(width,arrival.depth,length),sharkWaterMaterial());
    this.water.position.set((A.arenaMin[0]+A.arenaMax[0])/2,this.waterFloor,(A.arenaMin[2]+A.arenaMax[2])/2);
    this.water.userData.noCollide=true;this.water.name='Shark bed water';this.water.renderOrder=2;scene.add(this.water);
    const U=this.water.material.uniforms;U.uCenter.value.set(this.water.position.x,this.water.position.z);U.uExtent.value.set(width/2,length/2);U.uSource.value.set(this.position.x,this.position.z);U.uFill.value=0;
    U.uReach.value=Math.hypot(Math.max(this.position.x-A.arenaMin[0],A.arenaMax[0]-this.position.x),Math.max(this.position.z-A.arenaMin[2],A.arenaMax[2]-this.position.z))+.04;
    }
    this.start=V();this.target=V();this.warning=null;this.pools=[];this.tornadoes=[];this.shots=[];
    this.color=hostile('shark');this.dust=new THREE.Color(LOOK.color('shark-dust','#d6c5a7'));
    // the fight view: the Vacuum's high angle, aimed a little ahead so the jelly sits just below the middle with the shark in front
    const ph=IS_TOUCH?'-phone':'';this.camera={distance:LOOK.num('shark-camera-distance'+ph,IS_TOUCH?.85:1.15),pitch:LOOK.num('shark-camera-tilt'+ph,IS_TOUCH?.95:.98),ahead:LOOK.num('shark-camera-ahead'+ph,IS_TOUCH?.3:.25)};
    this.cameraBase={distance:this.camera.distance,pitch:this.camera.pitch};this.cameraAir=IS_TOUCH?LOOK.num('shark-camera-air-room-phone',.6):0;this.cameraAirView=0;
    // A separate inexpensive fin proxy is visible while the full model is beneath the quilt.
    this.fin=new THREE.Mesh(new THREE.ConeGeometry(.065*K,.15*K,3).scale(.18,1,1),this.model.rig.mat);
    this.fin.geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(this.fin.geometry.attributes.position.count).fill([.23,.38,.48]).flat(),3));
    this.fin.userData.noCollide=true;this.fin.visible=false;scene.add(this.fin);
    this.circleGeo=new THREE.CircleGeometry(1,48).rotateX(-Math.PI/2);
    Object.assign(this,hazardAssets(this.color));
    this.fish=new THREE.InstancedMesh(this.fishGeo,this.fishMat,96);this.fish.count=0;this.fish.userData.noCollide=true;this.fish.frustumCulled=false;scene.add(this.fish);
    this._matrix=new THREE.Matrix4();this._quat=new THREE.Quaternion();this._euler=new THREE.Euler(0,0,0,'YXZ');this._pos=V();this._scale=V(1,1,1);this._up=V(0,1,0);this._front=V();this._move=V();
    this.off=bus.on('player_hurt',e=>{
      // only a hit this shark is landing right now (hit()): the shark and its illusion each keep their own Prey and frenzy
      if(!this.striking||this.dead||this.dying||!['shark-bite','shark-melee','shark-impact'].includes(e.from))return;
      this.confirmed=true;if(e.from==='shark-impact')return;
      const sk=this.def.skills;
      if(!this.prey)this.fx.number(this.player.position.clone().add(V(0,.12,0)),'PREY',this.color,14);
      this.prey=sk.scent.time;this.bleed=sk.scent.bleed;
      if(e.from==='shark-bite'&&!this.stunT){if(!this.frenzy)this.fx.number(this.center(),'FEEDING FRENZY',this.color,15);this.frenzy=sk.frenzy.time;this.fx.ring(this.center(),this.color,.24,.4);}
    });
    this.stunT=0;
    this.offStatus=bus.on('status_applied',e=>{
      if(enemies.byId.get(e.targetId)?.proxy!==this||e.status!=='freeze')return;   // a freeze holds it; stuns don't (bosses can't be stunned)
      this.stunT=Math.max(this.stunT,e.duration||.5);this.frenzy=0;this.recover();
    });
    this.tornadoVisuals=Array.from({length:3},()=>{const m=new THREE.Mesh(this.tornadoGeo,this.tornadoMat);m.position.copy(this.position);m.scale.setScalar(.001);m.userData.noCollide=true;scene.add(m);return m;});
    this.glow=this.illusion?LOOK.num('shark-illusion-glow',.18):0;
    if(this.illusion){this.hp=0;this.holder.visible=false;this.summoned=false;return;}   // hidden until summon()
    this.warn(this.position,.1,.1); // include the warning material in main.js's existing shader warmup
    this.fish.count=1;this._matrix.makeTranslation(this.position.x,this.position.y,this.position.z);this.fish.setMatrixAt(0,this._matrix);this.fish.instanceMatrix.needsUpdate=true;
    this.ghost=new Shark(scene,enemies,fx,arena,world,{illusion:true});this.ghost.real=this;   // made now so its see-through shaders are built with the rest
  }
  warm(on){this.ghost.holder.visible=on;}   // main.js warmUp: show the illusion so its shaders are built before the fight
  // At half Health the illusion surfaces beside the jelly, a different attack next in its
  // list than the shark's and a longer rest between attacks, so the two drift apart instead of striking together.
  summon(player){
    const g=this.ghost,a=this.def.skills.arrival;
    // beside the jelly, square to the shark, so the fight camera (behind the jelly, facing the shark) sees both
    const d=this._move.subVectors(player.position,this.position).setY(0),n=Math.max(.45,d.length());if(d.lengthSq()<1e-6)d.set(0,0,1);
    d.normalize();g.position.copy(player.position).add(V(d.z*n,0,-d.x*n));g.clampIn(g.position);
    g.floor=g.floorAt(g.position);g.position.y=g.floor;g.model.rig.clipPlane.constant=-g.floor;
    g.heading=Math.atan2(player.position.x-g.position.x,player.position.z-g.position.z);
    g.arrivalT=a.barrier;g.next=this.next+Math.ceil(ATTACKS.angry.length/2);g.summoned=true;g.holder.visible=true;
    this.fx.number(g.position.clone().add(V(0,.3,0)),'ILLUSION',this.color,15);sfx.sharkRumble(a.breach);
  }
  vanish(){   // the real shark is beaten: its illusion goes with it, and so do its hazards
    const g=this.ghost;if(!g?.summoned||g.dead)return;
    g.dead=true;g.clearHazards();g.clearWarning();g.holder.visible=g.fin.visible=false;for(const m of g.tornadoVisuals)m.visible=false;
    for(let i=0;i<6;i++)this.fx.puff(g.position.clone().add(V(Math.sin(i)*.1,.05+i*.03,Math.cos(i)*.1)),this.dust,.04,.6);
  }
  get position(){return this.holder.position;}
  get angry(){return this.hp<=this.maxHp*this.def.skills.tornado.at;}
  get ready(){const a=this.def.skills.arrival;return this.arrivalT>=a.barrier+a.breach+a.flood;}
  get shielded(){return !this.model.visible||this.phase==='eruption'||this.rise<1;}
  get stompTop(){return this.position.y+.14+this.lift-(this.crouch||0);}   // its back, within a jump (stomp, Pogo Stick)
  get immune(){return this.dying||this.shielded;}   // damage() does nothing now: attacks shouldn't pick it
  get buried(){return ['dive','burrowBite','maelstrom','tornado'].includes(this.state)&&this.phase==='track';}
  center(out=V()){return out.copy(this.position).addScaledVector(this._front.set(Math.sin(this.heading),0,Math.cos(this.heading)),.09*K).setY(this.position.y+.23*K+this.lift-(this.crouch||0));}
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
    // reactive plush flinch: bouncy squish, head recoil & lateral roll kick
    this.squashV+=4.0;this.headKickV-=3.8;this.flinchV+=(Math.sin(this.t*41)>=0?1:-1)*4.2;
    this.fx.number(this.center().add(V(0,.08,0)),amount,color,18,feedback);
    if(!this.hp){this.dying=true;this.vanish();this.clearHazards();this.clearWarning();this.state='idle';this.phase='rest';}
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
    this.squash=Math.max(this.squash,heavy?.62:.38);this.squashV+=heavy?6.8:4.2;
    this.fx.impact(at,this.color,r*.25,heavy?18:10);this.fx.ring(at,this.color,r,.4);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;this.fx.puff(at.clone().add(V(Math.sin(a)*r*.5,.025,Math.cos(a)*r*.5)),this.dust,.028,.5);}
    this.fx.splat(at,this.dust,r*.7, 'dust');juice.feel(heavy?'impact-big':'impact');sfx.sharkSlam(heavy);
  }
  begin(name,player=this.player){
    if(!player||this.dead||this.dying)return;
    this.state=name;this.phase='windup';this.elapsed=0;this.beat=0;this.repeats=0;this.lift=0;
    this.aim(player);this.prepare(player);if(!['dive','burrowBite','maelstrom','tornado'].includes(name))sfx.sharkSwish(.5);
  }
  aim(player){this.aimHeading=Math.atan2(player.position.x-this.position.x,player.position.z-this.position.z);}
  skill(){return this.def.skills[this.state];}
  prepare(player){
    const sk=this.skill();this.start.copy(this.position);
    if(['leap','dive','burrowBite','maelstrom','tornado'].includes(this.state)){
      this.target.copy(player.position);this.clampIn(this.target);this.target.y=this.floorAt(this.target);
      // The landing keeps body clearance; its locked splash must still reach the aimed spot.
      const radius=this.state==='leap'?Math.max(sk.radius,Math.hypot(player.position.x-this.target.x,player.position.z-this.target.z)):sk.radius;
      this.warn(this.target,radius,sk.height);
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
    this.confirmed=false;this.striking=true;
    bus.emit('damage_taken',{targetId:PLAYER,amount:amount*(this.frenzy>0?this.def.skills.frenzy.damage:1),source:'boss',from:bite?'shark-bite':melee?'shark-melee':'shark-impact',at:this.illusion?this.center():undefined});
    this.striking=false;
    if(!this.confirmed||this.dead||this.dying||this.stunT>0)return false;
    const dir=V(p.x-at.x,0,p.z-at.z);if(dir.lengthSq()<1e-6)dir.set(0,0,1);
    bus.emit('knockback',{targetId:PLAYER,dir:dir.normalize(),force:this.def.skills.motion.knock,launch:.08});
    this.fx.impact(p.clone().add(V(0,.04,0)),this.color,.035,12);return true;
  }
  release(player){
    const sk=this.skill();this.phase='active';this.elapsed=0;this.heading=this.aimHeading;this.struck=false;this.lastSpinProgress=0;
    if(['bite','rear','combo','spin'].includes(this.state)){
      this.squashV-=4.5;this.fx.impact(this.center(),this.color,.035,6);sfx.sharkSwish();
    }else if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){
      this.phase='track';this.elapsed=0;this.clearWarning();this.model.visible=false;this.fin.visible=true;sfx.sharkDive();
      if(this.state==='maelstrom')this.pool(this.position,this.def.skills.maelstrom.radius,true);
    }else {this.squashV-=6.5;sfx.sharkSwish(1.4);this.fx.puff(this.position,this.dust,.08,.4);}
  }
  pool(at,r=this.def.skills.pools.radius,slow=false){
    const sk=this.def.skills.pools;
    if(this.pools.length>=sk.max)this.removePool(this.pools.shift());
    const boundCol=LOOK.color('shark-pool-boundary','#ff5a42'),baseOp=LOOK.num('shark-pool-warning-opacity',.24);
    const floor=new THREE.Mesh(this.circleGeo,this.fx.tele(this.color,'circle'));
    floor.position.copy(at).setY(at.y+.005);floor.scale.setScalar(r);floor.material.progress=1;floor.renderOrder=3;this.scene.add(floor);
    floor.material.opacity=baseOp;
    floor.material.uniforms.uColor.value.set(boundCol);
    const volume=this.fx.volume(this.color,'disc',at,V(r,sk.height,r));volume.material.progress=1;
    volume.material.opacity=baseOp*.75;
    volume.material.uniforms.uColor.value.set(boundCol);
    const surface=new THREE.Mesh(this.circleGeo,sharkWaterMaterial().clone()),U=surface.material.uniforms;
    surface.position.copy(at).setY(at.y+.012);surface.scale.setScalar(r);surface.renderOrder=2;surface.userData.noCollide=true;this.scene.add(surface);
    U.uMurky.value=1;U.uCircular.value=1;U.uCenter.value.set(at.x,at.z);U.uExtent.value.set(r,r);U.uSource.value.set(at.x,at.z);U.uReach.value=r+.025;U.uFill.value=1;U.uWake.value=0;
    this.pools.push({at:at.clone(),r,floor,volume,surface,life:slow?this.def.skills.maelstrom.life:sk.life,slow,age:0,baseOp});
    this.fx.impact(at,this.color,.045,10);this.fx.ring(at,this.color,r*.85,.35);sfx.sharkFish(true);
  }
  removePool(p){for(const m of [p.floor,p.volume,p.surface]){this.scene.remove(m);m.material.dispose();}}
  launchTornadoes(){
    const sk=this.def.skills.tornado;sfx.sharkTornado();
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
    this.fx.impact(from,this.color,.02,5);sfx.sharkFish();
  }
  hazards(dt,player){
    const sk=this.def.skills.pools, T=this.def.skills.tornado, calm=juice.calm;let fish=0;
    const drawFish=(p,yaw,pitch=0,roll=0,scale=1)=>{
      if(fish>=96)return;
      this._euler.set(pitch,yaw,roll);this._quat.setFromEuler(this._euler);this._scale.setScalar(scale);
      this._matrix.compose(p,this._quat,this._scale);this.fish.setMatrixAt(fish++,this._matrix);
    };
    this.poolFxT=Math.max(0,this.poolFxT-dt);
    for(let i=this.pools.length-1;i>=0;i--){
      const p=this.pools[i];p.life-=dt;p.age+=dt;p.floor.material.time=this.t;
      p.surface.material.uniforms.uTime.value=calm?0:this.t;
      if(p.life<=0){this.removePool(p);this.pools.splice(i,1);continue;}
      // spring pop-in & smooth shrink-out on the visual vortex sheet
      const pop=p.age<.22?Math.sin(clamp(p.age/.22,0,1)*Math.PI*.66)*1.12:1;
      const fade=clamp(p.life/.45,0,1);
      const vs=p.r*Math.min(1.08,pop)*(.25+.75*fade);
      p.surface.scale.setScalar(vs);
      const pulse=calm?1:.82+.22*Math.sin(this.t*6+i);
      p.floor.material.opacity=p.baseOp*pulse*fade;
      p.volume.material.opacity=p.baseOp*.75*pulse*fade;
      if(Math.hypot(player.position.x-p.at.x,player.position.z-p.at.z)<p.r+player.cfg.radius&&player.position.y<p.at.y+sk.height&&player.position.y+player.cfg.height>p.at.y){
        if(p.slow)bus.emit('status_applied',{targetId:PLAYER,status:'slow',duration:.15});
        else{bus.emit('status_applied',{targetId:PLAYER,status:'slow',strength:sk.slow,duration:.15});bus.emit('damage_taken',{targetId:PLAYER,amount:sk.dmg*dt,source:'boss',drain:true});}
        if(this.dead||this.dying)return;
      }
      // 8 predatory fish per pool: layered vortex rings, leaping breaches with pitch/bank, and thrashing tail wag
      const nFish=8;
      for(let k=0;k<nFish;k++){
        const ring=k%2?.76:.44, dir=k%2?1:-1;
        const speed=(k%2?3.2:4.4)*dir, a=this.t*speed+k*(Math.PI*2/nFish)+i*1.1;
        const cycle=(this.t*1.45+k*.37+i*.23)%1;
        // dramatic breaching leap out of the water every cycle
        const breach=cycle<.42?Math.sin((cycle/.42)*Math.PI):0;
        const breachSlope=cycle<.42?Math.cos((cycle/.42)*Math.PI):0;
        const y=.010+breach*.058+Math.sin(this.t*9+k)*.004;
        const rad=p.r*ring*(.88+.14*Math.sin(this.t*3.5+k));
        this._pos.set(Math.sin(a)*rad,y,Math.cos(a)*rad).add(p.at);
        const wag=calm?0:Math.sin(this.t*28+k*2.1)*.26;
        const yaw=(dir>0?-a:Math.PI-a)+wag;
        const pitch=calm?0:-breachSlope*.85;
        const roll=calm?0:dir*(.35+breach*.55);
        drawFish(this._pos,yaw,pitch,roll,(k%2?1.08:.92)*fade);
      }
      if(!calm&&this.poolFxT<=0&&Math.random()<.28){
        this.poolFxT=.14;
        const sa=Math.random()*Math.PI*2,sr=p.r*(.3+Math.random()*.55);
        this.fx.puff(this._pos.set(p.at.x+Math.sin(sa)*sr,p.at.y+.016,p.at.z+Math.cos(sa)*sr),this.color,.014,.28);
      }
    }
    for(let i=this.tornadoes.length-1;i>=0;i--){
      const q=this.tornadoes[i];q.life-=dt;q.age+=dt;q.m.rotation.y+=dt*10;
      const pulse=calm?1:1+Math.sin(this.t*12+i)*.1;
      q.m.scale.set(1/Math.sqrt(pulse),pulse,1/Math.sqrt(pulse));
      q.m.position.addScaledVector(q.dir,T.travel*dt);this.clampIn(q.m.position,.10);
      if(q.life<=0){q.m.visible=false;this.tornadoes.splice(i,1);continue;}
      this.hitTornado(q,dt,player);
      if(this.dead||this.dying)return;
      if((q.fishT-=dt)<=0){q.fishT=T.fishEvery;this.fishShot(q.m.position.clone().add(V(0,.17,0)),q.age*3+i*2);}
      for(let k=0;k<5;k++){
        const a=this.t*9+k*1.26, hY=.035+k*.052+Math.sin(this.t*8+k)*.012;
        this._pos.set(Math.sin(a)*(.045+k*.012),hY,Math.cos(a)*(.045+k*.012)).add(q.m.position);
        drawFish(this._pos,-a,-.25,.45,1.15);
      }
    }
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i];s.t+=dt;const t=clamp(s.t/T.flight,0,1);
      s.m.position.lerpVectors(s.from,s.to,t).y+=Math.sin(t*Math.PI)*.20;this.fx.orbTick(s.m,dt);
      const ang=Math.atan2(s.to.x-s.from.x,s.to.z-s.from.z);
      drawFish(s.m.position,ang,-Math.cos(t*Math.PI)*.95,Math.sin(this.t*26)*.65,1.45);
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
  recover(){this.clearWarning();this.phase='rest';this.elapsed=0;this.model.visible=true;this.fin.visible=false;this.lift=0;this.crouch=0;this.settle=Math.max(this.settle,.75);}
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
    this.arrivalT+=dt;if(!this.illusion)this.updateWater(dt,player);
    const G=this.ghost;
    if(G&&!G.summoned&&this.ready&&!this.dying&&!this.dead&&this.hp<=this.maxHp*this.def.skills.illusion.at)this.summon(player);
    if(G?.summoned&&!G.dead){G.update(dt,player);if(this.dead||this.dying)return{push:null};}
    const calm=juice.calm, h=Math.min(dt,.05);
    if(this.dead){
      this.model.rotation.z=mix(this.model.rotation.z,-1.55,1-Math.exp(-5*dt));
      this.model.pose({gape:.35,tailSwing:Math.sin(this.t*7)*.25*Math.exp(-this.t*.2),left:.5,right:-.4,size:SIZE});
      this.holder.position.y-=dt*.025;return{push:null};
    }
    const arrival=this.def.skills.arrival;
    this.rise=clamp((this.arrivalT-arrival.barrier)/arrival.breach,0,1);
    // Make room during anticipation, then hold that view through the jump.
    const room=this.ready&&this.phase!=='rest'?(this.skill()?.apex||0):0;
    this.cameraAirView=mix(this.cameraAirView,room,1-Math.exp(-6*dt));
    this.camera.distance=this.cameraBase.distance+this.cameraAirView*this.cameraAir;
    this.camera.pitch=this.cameraBase.pitch+Math.min(.3,this.cameraAirView*this.cameraAir*.27);
    this.hitPop=Math.max(0,(this.hitPop||0)-dt);this.frenzy=Math.max(0,this.frenzy-dt);this.prey=Math.max(0,this.prey-dt);
    if(this.dying){
      this.model.visible=true;this.fin.visible=false;this.lift=0;this.model.position.y=.15*K;this.model.rotation.x=-.4;
      const flop=calm?0:Math.sin(this.t*11);
      this.model.pose({gape:.65+Math.abs(flop)*.25,tailSwing:flop*.42,headRoll:flop*.18,left:flop*.35,right:-flop*.35,squint:-.5,time:this.t,size:SIZE});
      return{push:null};
    }
    if(this.bleed>0){this.bleed=Math.max(0,this.bleed-dt);bus.emit('damage_taken',{targetId:PLAYER,amount:this.def.skills.scent.dmg*dt,source:'boss',drain:true});
      if(this.dead||this.dying)return{push:null};
      if((this.bleedFx-=dt)<=0){this.bleedFx=.22;this.fx.puff(player.position.clone().add(V(0,.04,0)),this.color,.009,.3);}}
    const rate=this.frenzy>0?this.def.skills.frenzy.tempo:1;
    this.stunT=Math.max(0,this.stunT-dt);if(!this.stunT)this.elapsed+=dt*rate;this.hazards(dt,player);
    if(this.dead||this.dying)return{push:null};
    if(this.stunT>0){this.model.pose({gape:.1,squint:.8,size:SIZE});return{push:null};}

    // 2nd-order underdamped plush squash, head-kick & flinch springs
    const jK=LOOK.num('shark-motion-jiggle-k',130), jC=LOOK.num('shark-motion-jiggle-c',7.5);
    if(calm){
      this.squash*=Math.exp(-8*h);this.squashV=0;this.flinch=this.flinchV=this.headKick=this.headKickV=0;
    }else{
      this.squashV+=(-jK*this.squash-jC*this.squashV)*h;this.squash=clamp(this.squash+this.squashV*h,-.65,.85);
      this.flinchV+=(-140*this.flinch-11*this.flinchV)*h;this.flinch=clamp(this.flinch+this.flinchV*h,-.45,.45);
      this.headKickV+=(-150*this.headKick-12*this.headKickV)*h;this.headKick=clamp(this.headKick+this.headKickV*h,-.4,.4);
    }

    let gape=.08,tailSwing=Math.sin(this.t*(this.frenzy?10:4.6))*(this.frenzy?.34:.24),tailCurl=0;
    let left=0,right=0,finFlare=0,tilt=-.4,coil=0,stretch=0,roll=0,headPitch=0,headRoll=0;
    let squint=this.hitPop>0?.9:0;this.crouch=0;
    const turn=Math.atan2(player.position.x-this.position.x,player.position.z-this.position.z);
    const delta=Math.atan2(Math.sin(turn-this.heading),Math.cos(turn-this.heading));
    const headTurn=clamp(delta,-.38,.38);
    this.settle=Math.max(0,this.settle-dt*2.4);
    this.sway=mix(this.sway,clamp(delta,-1,1),1-Math.exp(-6*dt));
    const walking=this.phase==='rest'&&this.position.distanceTo(player.position)>.42;
    this.walkBlend=mix(this.walkBlend,walking?1:0,1-Math.exp(-8*dt));
    this.gait+=dt*mix(2.6,8.2*rate,this.walkBlend);
    const stride=Math.sin(this.gait),strideBack=Math.sin(this.gait-Math.PI);
    left=stride*mix(.12,.52,this.walkBlend);right=strideBack*mix(.12,.52,this.walkBlend);
    tailSwing+=this.sway*.52;
    roll=this.sway*.15+stride*.095*this.walkBlend+Math.sin(this.t*1.8)*.03;
    headPitch=Math.sin(this.t*2.4)*.05;
    coil=this.settle*.75;stretch=-this.settle*.55;
    this.lift=Math.abs(stride)*.015*this.walkBlend;

    if(!this.ready){
      this.clearWarning();for(const m of this.tornadoVisuals)m.visible=false;this.model.scale.setScalar(SIZE);
      const r=ease(this.rise);
      gape=Math.sin(this.rise*Math.PI)*1.05;headPitch=-Math.sin(this.rise*Math.PI)*.32;
      tailSwing=Math.sin(this.t*12)*.5*(1-r*.5);finFlare=Math.sin(this.rise*Math.PI)*.8;
      this.lift=mix(-.60,0,r);tilt=mix(-1.25,-.4,r);this.elapsed=0;
      if(this.rise>0&&this.rise<1&&(this.wakeT=(this.wakeT||0)-dt)<=0){this.wakeT=.07;this.fx.puff(this.position,this.dust,.045,.45);}
    }
    else if(this.phase==='rest'){
      this.heading+=clamp(delta,-dt*2,dt*2);
      if(this.illusion){   // the illusion keeps out of the shark's body, so the two never blur into one
        const apart=this.def.skills.illusion.apart,d=this._move.subVectors(this.position,this.real.position).setY(0),n=d.length();
        if(n>1e-4&&n<apart){this.position.addScaledVector(d,(apart-n)/n*Math.min(1,dt*4));this.clampIn(this.position);}
      }
      if(this.position.distanceTo(player.position)>.42){this.position.x+=Math.sin(this.heading)*this.def.skills.motion.speed*dt*rate;this.position.z+=Math.cos(this.heading)*this.def.skills.motion.speed*dt*rate;this.clampIn(this.position);}
      if(!this.stunT&&this.elapsed>(this.state==='tornado'?this.def.skills.motion.punish:this.illusion?this.def.skills.illusion.rest:this.def.skills.motion.rest)){
        const names=this.angry?ATTACKS.angry:ATTACKS.calm;let name=names[this.next++%names.length];
        const dist=this.position.distanceTo(player.position);
        if(Math.abs(delta)>2&&name==='bite')name='rear';else if(dist>.65&&name==='bite')name='leap';
        this.begin(name,player);
      }
    }else if(this.phase==='windup'){
      const sk=this.skill(), progress=clamp(this.elapsed/sk.windup,0,1), ep=ease(progress);
      const difference=Math.atan2(Math.sin(this.aimHeading-this.heading),Math.cos(this.aimHeading-this.heading));
      this.heading+=clamp(difference,-dt*4,dt*4);
      // Coiled anticipation: smooth pull-back, tense hold with quiver, wide-eyed lock snap at >0.86
      const hold=ease(clamp(progress/.72,0,1));
      const quiver=!calm&&progress>.62?Math.sin(this.t*46)*(progress-.62)*2.1:0;
      gape=hold*1.12;tilt-=Math.sin(hold*Math.PI*.85)*.30;
      headPitch=-hold*.34+quiver*.04;headRoll=quiver*.08;
      coil=hold*1.5;tailSwing=-Math.sin(hold*Math.PI*.85)*.6+quiver*.15;
      stretch=-Math.sin(hold*Math.PI*.85)*.55;finFlare=hold*.72;
      squint=progress>.86?-.65:hold*.85;
      if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){
        // Dramatic nose-dive arch with tail kicking high into the air before submerging
        tilt+=ep*1.35;headPitch=ep*.28;this.lift=-ep*.60;left=right=-ep*.75;tailCurl=ep*.8;
      }else if(this.state==='leap'){
        // Deep squashed plush crouch before torpedo launch
        this.crouch=hold*.06;this.squash=Math.max(this.squash,hold*.58);left=right=-hold*.85;finFlare=hold*.9;
      }else if(this.state==='combo'&&this.beat===1){
        // Huge right-banked Haymaker wind-back for left flipper slap
        left=-hold*1.5;right=hold*.48;roll=hold*.30;headRoll=-hold*.22;tailCurl=-hold*.85;
      }else if(this.state==='spin'||(this.state==='combo'&&this.beat===2)){
        // Tight counter-coil twisting back before the 360 whip-spin
        roll=-Math.sin(hold*Math.PI*.85)*.34;coil=hold*1.9;tailCurl=-hold*1.25;headRoll=hold*.24;
      }
      if(this.warning){this.warning.floor.material.progress=this.warning.volume.material.progress=progress;this.warning.floor.material.time=this.t;}
      if(progress>=1)this.release(player);
    }else if(this.phase==='track'){
      const sk=this.skill(), scent=this.prey>0?this.def.skills.scent.speed:1;
      const direction=this._move.set(player.position.x-this.position.x,0,player.position.z-this.position.z), distance=direction.length();
      const aim=Math.atan2(direction.x,direction.z),change=Math.atan2(Math.sin(aim-this.heading),Math.cos(aim-this.heading));
      this.heading+=clamp(change,-dt*2*scent,dt*2*scent);
      if(distance>.01)this.position.addScaledVector(V(Math.sin(this.heading),0,Math.cos(this.heading)),Math.min(distance,sk.speed*dt*scent*rate));
      this.clampIn(this.position);
      // Sinuous predator dorsal fin slicing through the water (sways, banks into turns & bobs)
      const finWave=calm?0:Math.sin(this.t*(scent>1?13:8.5));
      this.fin.position.copy(this.position).setY(this.floor+.055*K+finWave*.006);
      this.fin.rotation.set(calm?0:Math.cos(this.t*7)*.09,this.heading,calm?0:clamp(change*.5,-.35,.35)+finWave*.18);
      if((this.wakeT=(this.wakeT||0)-dt)<=0){this.wakeT=.065;this.fx.puff(this.fin.position,this.dust,.018,.28);}
      if(this.elapsed>=sk.track){
        this.target.copy(this.position);this.target.y=this.floorAt(this.target);this.floor=this.target.y;
        this.warn(this.target,sk.radius,sk.height);this.phase='eruption';this.elapsed=0;sfx.sharkRumble(sk.tell);
      }
    }else if(this.phase==='eruption'){
      const sk=this.skill(), t=clamp(this.elapsed/sk.tell,0,1);
      this.warning.floor.material.progress=this.warning.volume.material.progress=t;
      // The floor clips the buried portion; burst snout skyward with jaws wide and flippers flared.
      const emerge=ease(clamp((t-.35)/.65,0,1));
      this.model.visible=emerge>0;this.fin.visible=emerge<.25;
      this.lift=mix(-.60,sk.apex*.45,emerge);tilt=-.4-Math.sin(.15*Math.PI)*1.05;gape=1.15*emerge;
      headPitch=-emerge*.35;coil=-emerge*.95;left=right=-emerge*.85;finFlare=emerge*.95;stretch=emerge*.85;
      if(emerge>0&&emerge<1&&(this.wakeT-=dt)<=0){this.wakeT=.06;this.fx.puff(this.position,this.dust,.04,.35);}
      if(t>=1){this.phase='active';this.elapsed=0;this.start.copy(this.position);this.start.y=this.floor;this.model.visible=true;this.fin.visible=false;this.clearWarning();
        this.lift=sk.apex*.45;gape=1.15;this.squashV-=5;
        this.burst(this.target,sk.radius,true);this.hit(player,this.target,sk.radius,sk.height,sk.dmg,this.state==='burrowBite',false);
        if(this.dead||this.dying||this.phase!=='active')return{push:null};
        this.pool(this.target);if(this.state==='tornado')this.launchTornadoes();
        if(this.state==='maelstrom'||this.state==='tornado'){
          if(this.state==='maelstrom'){this.target.copy(player.position);this.clampIn(this.target);this.target.y=this.floorAt(this.target);}
          this.warn(this.target,sk.radius,sk.height);
        }}
    }else if(this.phase==='active'){
      const sk=this.skill(), p=clamp(this.elapsed/sk.active,0,1), sp=Math.sin(p*Math.PI);
      const spinU=ease(p);   // smooth shark-like S-curve acceleration into whip & weighted coast-out
      gape=Math.max(.04,(1-p)*1.05);tailSwing+=sp*1.15;
      stretch=sp*.85;coil=-sp*.95;squint=-sp*.55;finFlare=sp*.6;
      if(['bite','rear','combo','spin'].includes(this.state)){
        const bite=this.state==='bite'||this.state==='rear'||(this.state==='combo'&&this.beat===0);
        const sweep=this.state==='spin'||(this.state==='combo'&&this.beat===2);
        if(bite){
          // 3-beat predatory chomp: explosive lunge & jaw slam (0..0.28) -> clenched overshoot hold (0.28..0.52) -> smooth recoil settle (0.52..1)
          const snap=clamp(p/.28,0,1), rec=clamp((p-.28)/.72,0,1);
          gape=1.15*Math.max(0,1-snap*snap);
          const lungeCurve=p<.28?ease(snap):1-ease(clamp((p-.45)/.55,0,1));
          this.crouch=lungeCurve*.17;
          tilt+=this.crouch*2.8;
          headPitch=p<.28?-((1-snap)*.34):Math.sin(rec*Math.PI)*.34*(1-rec*.4);
          coil=p<.28?mix(1.1,-.9,snap):mix(-.9,.2,ease(rec));
          this.position.copy(this.start).addScaledVector(V(Math.sin(this.heading),0,Math.cos(this.heading)),lungeCurve*.11);this.clampIn(this.position);
        }
        const contact=sweep?arcHits(this.warning.at,.08,this.warning.r,this.aimHeading+this.lastSpinProgress*Math.PI*2+Math.PI,this.aimHeading+spinU*Math.PI*2+Math.PI,this.warning.height,player.position,player.cfg):p>=(bite ? .28 : .42);
        if(!this.struck&&contact){
          // Damage callbacks can synchronously kill or stun the attacker.
          const warning=this.warning;this.struck=true;this.hit(player,warning.at,warning.r,warning.height,sk.dmg,bite);
          if(this.dead||this.dying||this.phase!=='active')return{push:null};
          this.burst(warning.at,warning.r);if(bite){this.headKickV+=5.5;sfx.sharkChomp();}else sfx.sharkSwish(1.2);
          if(!sweep)this.clearWarning();
        }
        this.lastSpinProgress=spinU;
      }
      if(this.state==='leap'){
        // Torpedo nose-up launch -> buoyant apex -> nose-down predatory dive-bomb -> massive belly-flop splash!
        this.position.lerpVectors(this.start,this.target,ease(p));this.floor=mix(this.start.y,this.target.y,p);this.lift=sp*sk.apex;
        tilt=-.4+Math.cos(p*Math.PI)*-.85+.35;
        headPitch=Math.cos(p*Math.PI)*-.28;
        left=right=-sp*1.05;tailSwing*=.55;coil=sp*1.45;stretch=sp*1.1;finFlare=sp*.85;
        if(p>=1){const r=this.warning.r;this.burst(this.target,r,true);this.hit(player,this.target,r,sk.height,sk.dmg,false,false);if(this.dead||this.dying||this.phase!=='active')return{push:null};this.clearWarning();}
      }else if(['dive','burrowBite','maelstrom','tornado'].includes(this.state)){
        if(this.state==='maelstrom'){this.position.lerpVectors(this.start,this.target,ease(p));this.floor=mix(this.start.y,this.target.y,p);}
        if(this.warning)this.warning.floor.material.progress=this.warning.volume.material.progress=p;
        const arc=Math.sin((.15+p*.85)*Math.PI);
        this.lift=arc*sk.apex;tilt=-.4-arc*1.05+p*.65;
        headPitch=-arc*.28;coil=-Math.sin((.2+p*.8)*Math.PI)*1.35;stretch=arc*1.1;left=right=-Math.sin((.3+p*.7)*Math.PI)*.95;finFlare=arc*.9;
        gape=1.15*Math.sin((.5+p*.5)*Math.PI);
        if(this.state==='dive'&&this.repeats<sk.count-1){const sink=ease(clamp((p-.65)/.35,0,1));tilt+=sink*1.35;this.lift-=sink*.60;}
        if(p>=1){this.burst(this.position,sk.radius,true);
          if(this.state==='tornado'||this.state==='maelstrom')this.hit(player,this.position,sk.radius,sk.height,sk.dmg,false,false);
          if(this.dead||this.dying||this.phase!=='active')return{push:null};}
      }else if(this.state==='spin'||(this.state==='combo'&&this.beat===2)){
        this.heading=this.aimHeading+spinU*Math.PI*2;roll=sp*.38;coil=sp*1.65;tailCurl=sp*1.4;finFlare=sp*.9;
      }else if(this.state==='combo'&&this.beat===1){
        // Fast accelerating left-flipper Haymaker slap (0..0.42) + weighted follow-through decel (0.42..1)
        const swing=p<.42?ease(p/.42):1-ease(clamp((p-.55)/.45,0,1))*.85;
        left=mix(-1.2,1.85,swing);right=-swing*.55;roll=-swing*.34;headRoll=swing*.24;tailCurl=swing*.95;
      }else this.lift=sp*.045;
      if(p>=1){
        if(this.state==='combo'&&this.beat<2){this.beat++;this.phase='windup';this.elapsed=0;this.aim(player);this.prepare(player);}
        else if(this.state==='dive'&&++this.repeats<sk.count){this.phase='track';this.elapsed=0;this.model.visible=false;this.fin.visible=true;}
        else this.recover();
      }
    }
    if(this.phase!=='active'&&(this.groundT-=dt)<=0){this.groundT=.15;this.floor=this.floorAt(this.position);}
    this.position.y=this.floor;this.holder.rotation.y=this.heading;
    this.model.rig.clipPlane.constant=-this.floor;
    const blend=1-Math.exp(-12*dt);
    this.visualTilt=mix(this.visualTilt,tilt,blend);this.visualRoll=mix(this.visualRoll,roll+this.flinch,blend);
    // The jaw remains frame-exact; secondary body motion & plush springs ease smoothly between poses.
    this.model.position.y=.15*K+this.lift-this.crouch;this.model.rotation.set(this.visualTilt,0,this.visualRoll);
    this.model.pose({
      gape,headTurn,headPitch:headPitch+this.headKick,headRoll:headRoll+this.flinch*.6,
      tailSwing,tailCurl,left,right,finLift:this.crouch*5.5,finFlare,
      breath:calm?0:Math.sin(this.t*(this.frenzy?4.5:2.4)),coil,roll:roll+this.flinch*.5,
      stretch,squash:this.squash,time:calm?0:this.t,energy:calm?.4:(this.frenzy>0?1.85:1.15),squint,size:SIZE
    });
    this.model.rig.mat.emissive.copy(this.color).multiplyScalar(this.hitPop>0?.5:Math.max(this.glow,this.frenzy>0?.15:0));
    if(!this.illusion)bus.emit('boss_health',{name:this.arena.name,hp:this.hp,maxHp:this.maxHp,shielded:this.shielded,shieldText:'BENEATH THE QUILT'});
    return{push:null};
  }
  dispose(){
    this.ghost?.dispose();   // (its see-through materials stay alive like the shared ones: disposing them would drop the built shaders)
    this.off();this.offStatus();this.clearWarning();this.clearHazards();this.scene.remove(this.holder,this.fin,this.fish,this.water,...this.tornadoVisuals);
    // Shark model geometry/materials are shared with the warmed template and stay alive.
    this.fin.geometry.dispose();this.circleGeo.dispose();this.fish.dispose(); // hazard geometry/materials stay warmed too
    this.water?.geometry.dispose();
    this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
  }
}
