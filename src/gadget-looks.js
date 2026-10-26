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
      crystal:new THREE.OctahedronGeometry(1), foam:new THREE.SphereGeometry(1,10,6), tag:new THREE.BoxGeometry(1,1,.06),
      spring:new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil),72,.12,5,false)};
    this.mat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    this.mat.userData.perInstance=true;
    this.pools=Object.fromEntries(Object.keys(this.geo).map(k=>[k,[]]));
    this.caps={arc:LOOK.num('gadget-arcs',16),rod:LOOK.num('gadget-streaks',64),needle:LOOK.num('gadget-needles',32),stud:LOOK.num('gadget-studs',24),spring:2,crystal:LOOK.num('gadget-crystals',32),foam:LOOK.num('gadget-foam',16),tag:LOOK.num('gadget-tags',24)};
    this.color=new THREE.Color(LOOK.color('gadget-friendly','#a6f6ed'));
    for(const [k,v] of Object.entries({mist:'#eef6ff',silver:'#d3eaff',cotton:'#e8e5ff',duck:'#a8e9ce',disco:'#d8beff',gold:'#f5e7a7',signalColor:'#a5e5ff',fizz:'#b7ffe4'}))this[k]=new THREE.Color(LOOK.color('gadget-'+(k==='signalColor'?'signal':k),v));
  }
  get quiet(){return juice.calm||this.fx.reducedMotion.matches;}
  take(kind,at,color,life) {
    const pool=this.pools[kind];let p=pool.find(p=>!p.alive);
    if(!p){if(pool.length>=this.caps[kind])return null;
      p={m:this.fx.piece(this.geo[kind],this.mat),v:new THREE.Vector3(),size:new THREE.Vector3()};pool.push(p);}
    Object.assign(p,{alive:true,t:0,life,kind,floor:at.y,alpha:.85,follow:null});p.v.set(0,0,0);
    const m=p.m;m.position.copy(at);m.quaternion.identity();m.scale.setScalar(1);m.visible=true;
    m.userData.color.set(color);m.userData.opacity=this.quiet?.45:.85;
    return p;
  }
  warm(on,at) {
    if(on)for(const kind of Object.keys(this.geo)){const p=this.take(kind,at,this.color,1);if(p)p.m.scale.setScalar(.001);}
    else this.reset();
  }
  reset(){for(const pool of Object.values(this.pools))for(const p of pool){p.alive=false;p.follow=null;p.m.visible=false;}}
  update(dt){
    for(const pool of Object.values(this.pools))for(const p of pool)if(p.alive){
      p.t+=dt;const u=Math.min(1,p.t/p.life),m=p.m;
      if(p.follow){const e=p.follow;if(e.dead||!e.root?.parent||e.stunT<=0){p.alive=false;p.follow=null;m.visible=false;continue;}m.position.copy(e.pos).y+=e.r*2.4;}
      if(u>=1){p.alive=false;p.follow=null;m.visible=false;continue;}
      m.userData.opacity=Math.min(p.alpha,this.quiet?.4:1)*(1-u)*(1-u);
      if(p.kind==='arc'){
        const wave=this.quiet?1:1+Math.sin(p.t*55)*.025*(1-u);
        m.scale.set(p.size.x*wave,1,p.size.z/wave);m.rotation.y+=dt*(this.quiet?0:1.5);
      }else if(p.kind==='stud'||p.kind==='crystal'){
        m.position.addScaledVector(p.v,dt);p.v.y-=dt*LOOK.num('gadget-debris-gravity',1.2);
        if(m.position.y<p.floor){m.position.y=p.floor;p.v.y=Math.abs(p.v.y)*.25;p.v.x*=.7;p.v.z*=.7;}
        if(!this.quiet){m.rotation.x+=dt*7;m.rotation.z+=dt*5;}
      }else if(p.kind==='tag'){
        if(!this.quiet){m.rotation.z=Math.sin(u*Math.PI)*.3;m.position.y+=dt*.01;}
      }else if(p.kind==='foam'){
        m.scale.copy(p.size).multiplyScalar(1+u*.3);m.position.y+=dt*(.012+p.v.y);
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
  // Instantaneous areas stay at full reach; the fading marks never sweep delayed damage.
  cushion(at,radius){
    const ring=this.arc(at.clone().add(new THREE.Vector3(0,.003,0)),radius,this.cotton,.3);
    if(ring){const p=this.pools.arc.find(p=>p.m===ring);p.alpha=.35;ring.userData.opacity=p.alpha;}
    for(let i=0;i<(this.quiet?2:5);i++){
      const a=i*2.39996,p=this.take('foam',at,this.cotton,LOOK.num('gadget-cotton-life',.32)+i*.025);if(!p)break;
      p.m.position.add(new THREE.Vector3(Math.cos(a)*radius*.35,.005,Math.sin(a)*radius*.35));
      p.size.set(radius*.22,.004,radius*.22);p.m.scale.copy(p.size);p.alpha=LOOK.num('gadget-cotton-opacity',.16);p.m.userData.opacity=p.alpha;
    }
  }
  squeak(at,radius){
    for(let i=0;i<(this.quiet?1:3);i++){
      const m=this.arc(at.clone().add(new THREE.Vector3(0,.003+i*.004,0)),radius*(1-i*.08),this.duck,.22+i*.045);
      if(m)m.rotation.y=i*2;
    }
  }
  salt(at,radius,prepare=false){
    if(!prepare)this.arc(at,radius,this.silver,.18);
    for(let i=0;i<(this.quiet?2:prepare?3:7);i++){
      const a=i*2.39996,p=this.take('crystal',at,this.silver,prepare?.12:LOOK.num('gadget-salt-life',.36));if(!p)break;
      p.m.position.add(new THREE.Vector3(Math.cos(a)*radius*.2,.002,Math.sin(a)*radius*.2));
      p.m.scale.setScalar(prepare?.002:.003);p.v.set(Math.cos(a)*.045,.06,Math.sin(a)*.045);
    }
  }
  echo(at,radius){
    for(let i=0;i<(this.quiet?1:3);i++){
      const p=this.take('crystal',at,this.disco,.18);if(!p)break;
      const a=i*Math.PI*2/3;p.m.position.x+=Math.cos(a)*radius;p.m.position.z+=Math.sin(a)*radius;
      p.m.scale.set(.0025,.004,.0025);p.v.set(Math.cos(a)*.025,.025,Math.sin(a)*.025);
    }
  }
  signal(from,to,staticPop=false){
    const color=staticPop?this.disco:this.signalColor,side=new THREE.Vector3().subVectors(to,from).cross(UP).normalize();
    let a=from.clone();
    for(let i=1;i<=4;i++){
      const b=from.clone().lerp(to,i/4);if(i<4)b.addScaledVector(side,(i%2?1:-1)*LOOK.num('gadget-signal-bend',.006));
      this.streak(a,b,color,i%2?.0013:.0008,.14);a=b;
    }
    this.contact(to,color,.009);
  }
  stamp(at,radius,pin=false,e=null,duration=.25){
    if(pin){
      const p=this.take('needle',at,this.silver,duration);if(!p)return;
      p.m.scale.set(.002,LOOK.num('gadget-pin-height',.014),.002);p.follow=e;
      this.arc(at,radius,this.silver,.2);
    }else{
      const p=this.take('tag',at,this.fizz,LOOK.num('gadget-tag-life',.25));if(!p)return;
      p.m.scale.set(.009,.011,.009);p.m.rotation.x=-.5;
    }
  }
  fizzBurst(at,radius){
    this.arc(at,radius,this.fizz,.3);
    for(let i=0;i<(this.quiet?3:8);i++){
      const a=i*2.39996,p=this.take('foam',at,this.fizz,.3);if(!p)break;
      p.m.position.add(new THREE.Vector3(Math.cos(a)*radius*.65,.008,Math.sin(a)*radius*.65));
      p.size.setScalar(.004);p.m.scale.copy(p.size);p.alpha=.35;p.m.userData.opacity=p.alpha;
    }
  }
  snooze(at){
    this.arc(at,.055,this.silver,.6);this.arc(at,.035,this.silver,.45);
    this.streak(at,at.clone().add(new THREE.Vector3(.02,0,0)),this.silver,.0018,.5);
    this.streak(at,at.clone().add(new THREE.Vector3(0,0,-.03)),this.silver,.0018,.5);
    this.salt(at,.03);
  }
  // Hot water: a wisp of steam rising off the jelly; burst=true when the boost starts (a ring and a cloud)
  steam(at,burst=false){
    if(burst)this.arc(at,LOOK.num('gadget-steam-ring',.06),this.mist,.4);
    for(let i=0;i<(burst?(this.quiet?3:8):1);i++){
      const a=Math.random()*Math.PI*2,r=burst?.025:.015,z=LOOK.num('gadget-steam-size',.01),p=this.take('foam',at,this.mist,LOOK.num('gadget-steam-life',.7));if(!p)break;
      p.m.position.add(new THREE.Vector3(Math.cos(a)*r,.015,Math.sin(a)*r));
      p.size.setScalar(burst?z*1.4:z);p.m.scale.copy(p.size);p.alpha=LOOK.num('gadget-steam-opacity',.3);p.m.userData.opacity=p.alpha;
      p.v.set(0,this.quiet?0:LOOK.num('gadget-steam-rise',.05),0);
    }
  }
  spring(at){
    const p=this.take('spring',at,this.color,LOOK.num('gadget-mouse-after',.24));if(!p)return;
    p.size.setScalar(LOOK.num('gadget-spring-size',.003));p.m.scale.copy(p.size);
  }
}
