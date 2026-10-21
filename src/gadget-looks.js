// Cosmetic geometry for treasure gadgets. No combat targeting, timers or damage live here.
import * as THREE from 'three';
import { LOOK } from './look.js';
import { juice } from './juice.js';

const UP = new THREE.Vector3(0,1,0), delta = new THREE.Vector3();
export class GadgetLooks {
  constructor(fx) {
    this.fx=fx;
    const coil=[];
    for(let i=0;i<=72;i++){const t=i/72,a=t*Math.PI*10;coil.push(new THREE.Vector3(Math.cos(a),t*4,Math.sin(a)));}
    this.geo={arc:new THREE.RingGeometry(.96,1,48,1,0,Math.PI*1.8).rotateX(-Math.PI/2),
      rod:new THREE.CylinderGeometry(1,1,1,6), needle:new THREE.ConeGeometry(1,1,5), stud:new THREE.CylinderGeometry(1,1,1,8),
      spring:new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil),72,.12,5,false)};
    this.mat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    this.mat.userData.perInstance=true;
    this.pools=Object.fromEntries(Object.keys(this.geo).map(k=>[k,[]]));
    this.caps={arc:LOOK.num('gadget-arcs',16),rod:LOOK.num('gadget-streaks',64),needle:LOOK.num('gadget-needles',32),stud:LOOK.num('gadget-studs',24),spring:2};
    this.color=new THREE.Color(LOOK.color('gadget-friendly','#a6f6ed'));
  }
  get quiet(){return juice.calm||this.fx.reducedMotion.matches;}
  take(kind,at,color,life) {
    const pool=this.pools[kind];let p=pool.find(p=>!p.alive);
    if(!p){if(pool.length>=this.caps[kind])return null;
      p={m:this.fx.piece(this.geo[kind],this.mat),v:new THREE.Vector3(),size:new THREE.Vector3()};pool.push(p);}
    Object.assign(p,{alive:true,t:0,life,kind,floor:at.y});p.v.set(0,0,0);
    const m=p.m;m.position.copy(at);m.quaternion.identity();m.scale.setScalar(1);m.visible=true;
    m.userData.color.set(color);m.userData.opacity=this.quiet?.45:.85;
    return p;
  }
  warm(on,at) {
    if(on)for(const kind of Object.keys(this.geo)){const p=this.take(kind,at,this.color,1);if(p)p.m.scale.setScalar(.001);}
    else this.reset();
  }
  reset(){for(const pool of Object.values(this.pools))for(const p of pool){p.alive=false;p.m.visible=false;}}
  update(dt){
    for(const pool of Object.values(this.pools))for(const p of pool)if(p.alive){
      p.t+=dt;const u=Math.min(1,p.t/p.life),m=p.m;
      if(u>=1){p.alive=false;m.visible=false;continue;}
      m.userData.opacity=(this.quiet?.4:.85)*(1-u)*(1-u);
      if(p.kind==='arc'){
        const wave=this.quiet?1:1+Math.sin(p.t*55)*.025*(1-u);
        m.scale.set(p.size.x*wave,1,p.size.z/wave);m.rotation.y+=dt*(this.quiet?0:1.5);
      }else if(p.kind==='stud'){
        m.position.addScaledVector(p.v,dt);p.v.y-=dt*LOOK.num('gadget-debris-gravity',1.2);
        if(m.position.y<p.floor){m.position.y=p.floor;p.v.y=Math.abs(p.v.y)*.25;p.v.x*=.7;p.v.z*=.7;}
        if(!this.quiet){m.rotation.x+=dt*7;m.rotation.z+=dt*5;}
      }else if(p.kind==='spring'){
        m.scale.set(p.size.x*(1-u*.4),p.size.y*(1-u*.8),p.size.z*(1-u*.4));
        if(!this.quiet){m.position.y+=dt*.015;m.rotation.y+=dt*5;}
      }
    }
  }
  arc(at,radius,color=this.color,life=LOOK.num('gadget-pulse-life',.4)){
    const p=this.take('arc',at,color,life);if(!p)return;
    p.size.set(radius,1,radius);p.m.scale.copy(p.size);return p.m;
  }
  streak(from,to,color=this.color,width=LOOK.num('gadget-streak-width',.0012),life=.16,kind='rod'){
    delta.copy(to).sub(from);const n=delta.length();if(n<1e-6)return;
    const p=this.take(kind,from,color,life);if(!p)return;
    p.m.position.lerp(to,.5);p.m.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/n));p.m.scale.set(width,n,width);
  }
  contact(at,color=this.color,size=.012){
    if(!color.isColor)color=new THREE.Color(color);
    this.fx.glow.emit(at,color,size*2,size*.3,.14,this.quiet?.35:.7);
    this.arc(at,size,color,.18);
  }
  studs(at,color,count=6){
    for(let i=0;i<(this.quiet?Math.min(2,count):count);i++){
      const p=this.take('stud',at,color,LOOK.num('gadget-debris-life',.65));if(!p)break;
      const a=i*2.39996;p.m.scale.set(.0025,.003,.0025);
      p.v.set(Math.cos(a)*.07,.12+(i%3)*.025,Math.sin(a)*.07);p.floor=at.y-.005;
    }
  }
  spring(at){
    const p=this.take('spring',at,this.color,LOOK.num('gadget-mouse-after',.24));if(!p)return;
    p.size.setScalar(LOOK.num('gadget-spring-size',.003));p.m.scale.copy(p.size);
  }
}
