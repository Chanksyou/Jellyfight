// Elite attacks start only on their own furniture/floor, even when the player is nearby below it.
import { CONFIG } from '../config.js';
import { ATTACKS } from '../elites.js';
import { VolumeMaterial } from '../vfx.js';
import { G, V, act2, act3, fresh, holdJelly, ok, step, story, tp } from './kit.js';

const cases = [
  [story, 'controller', [1.62,.66,4.47]], [story, 'mug', [.62,.83,2.95]],
  [story, 'kettle', [4.5,.96,3.45]], [act2, 'soap', [1.5,.93,5.47]],
  [act2, 'clock', [2,.5,7.42]], [act2, 'whipper', [3.25,.02,8.6]],
  [act3, 'croc', [-.1,.75,10.2]], [act3, 'bull', [-.6,1.2,8.36]],
  [act3, 'coffer', [-1.52,.83,8.8]],
];
function prepare(kind, at, attack) {
  fresh({ bubbles:false, lash:false }); tp(...at,0);
  const E=G().run.elites, e=E.list.find(e=>e.kind===kind), player=holdJelly();
  e.cool=99; e.hp=e.maxHp*.4;
  step(100); e.cool=0; e.next=attack;
  return {E,e,player};
}
for (const [register,kind,at] of cases) register(`${register===story?'elites/':''}platform-${kind}`, {
  about:`The ${kind} starts on its platform, stops unfinished attacks when the jelly leaves, and can start again on return. Nearby feet below or beyond the platform do not wake it.`,
  setup(){ prepare(kind,at,0); },
  play(){
    const result=[];
    for(let attack=0;attack<ATTACKS[kind].length;attack++) {
      const {E,e,player}=prepare(kind,at,attack), home=player.position.clone(), W=e.spec.wake;
      step(400,()=>e.state==='windup'); step(3);
      const started=e.state==='windup' && e.attack===attack;
      player.position.y=W.min[1]-.1; step(1);
      // Jewels that left the lid are already airborne and finish at their fixed landing spots.
      const airborne=kind==='coffer'&&attack===2&&e.gems?.length;
      const canceled=airborne ? e.gems.every(g=>g.out) : e.state==='idle'&&!e.tele.length;
      const pose=kind==='clock'?!e.spin:kind==='soap'?e.model.head.position.y===e.model.headY&&e.model.stem.scale.y===1:kind==='kettle'?e.model.lid.position.y===.112:true;
      step(300); const next=e.next; step(120);
      const below=!e.awake&&e.state==='idle'&&e.next===next;
      player.position.copy(home); player.position.x=W.max[0]+.02;
      step(200); const beside=!e.awake&&e.next===next;
      player.position.copy(home); e.cool=0; e.next=attack;
      step(400,()=>e.state==='windup');
      const reentered=e.state==='windup'&&e.attack===attack;
      // Jumping above the same platform still counts as being in the fight.
      const jump=E.onPlatform(e,home.clone().setY(home.y+.2));
      result.push({attack,started,canceled,pose,below,beside,reentered,jump});
    }
    return ok(result.every(r=>r.started&&r.canceled&&r.pose&&r.below&&r.beside&&r.reentered&&r.jump),result);
  },
});

story('elites/platform-released-coffee-keeps-flying', {
  about:'Leaving the desk cancels the rest of a coffee volley while an already released lob travels to its original warning and lands normally.',
  setup(){ prepare('mug',cases[1][2],0); },
  play(){
    const {run,player}=G(), E=run.elites, e=E.list.find(e=>e.kind==='mug');
    step(400,()=>E.blobs.length); const b=E.blobs[0];
    if(!b)return ok(false,{launched:false});
    const at=b.m.position.clone(); player.position.y=0;
    step(3); const flying=E.blobs.includes(b)&&b.m.position.distanceTo(at)>.001&&e.state==='idle';
    step(180); return ok(flying&&!E.blobs.includes(b)&&E.puddles.length>0&&e.next===1,{flying,landed:!E.blobs.includes(b),puddles:E.puddles.length,next:e.next});
  },
});
story('elites/platform-sight-and-ground-targets', {
  about:'A nearby elite cannot start through an obstruction; every fixed Controller symbol stays inside the console even when the jelly is near its edge.',
  setup(){ prepare('controller',cases[0][2],0); },
  play(){
    const {run,player}=G(), E=run.elites,e=E.list.find(e=>e.kind==='controller'),W=e.spec.wake;
    // Report an obstruction through the world query; verify eligibility actually uses its result.
    const original=E.world.castAll, pc=player.position.clone().setY(player.position.y+CONFIG.player.height/2);
    const from=e.model.muzzle.clone().applyAxisAngle(V(0,1,0),e.holder.rotation.y).add(e.base), delta=pc.clone().sub(from), far=delta.length();
    E.world.castAll=()=>({distance:far/2});
    let hidden; try {step(30);hidden=e.state==='idle'&&e.next===0;} finally{E.world.castAll=original;}
    player.position.set(1.62,player.position.y,W.min[2]+.02); e.cool=0;
    step(400,()=>e.tele.length===8);
    const R=e.def.skills.barrage.radius, spots=e.tele.filter(m=>m.material instanceof VolumeMaterial);
    const bounded=spots.length===4&&spots.every(p=>p.position.x>=W.min[0]+R-1e-6&&p.position.x<=W.max[0]-R+1e-6&&p.position.z>=W.min[2]+R-1e-6&&p.position.z<=W.max[2]-R+1e-6);
    return ok(hidden&&bounded,{hidden,bounded,spots:spots.map(p=>p.position.toArray())});
  },
});



for (const [kind,attack,array] of [['clock',1,'thrown'],['whipper',0,'balloons'],['soap',1,'soapBubbles'],['croc',0,'blobs'],['bull',1,'bullets'],['bull',2,'minis']]) {
  const [register,,at]=cases.find(c=>c[1]===kind);
  register(`platform-released-${kind}-${array}`, {
    about:`The ${kind}'s released ${array} continue after the jelly leaves; no fresh attack starts from its platform.`,
    setup(){ prepare(kind,at,attack); },
    play(){
      const {run,player}=G(), E=run.elites,e=E.list.find(e=>e.kind===kind);
      const launched=b=>array==='blobs'?b.t>=b.wait:array==='minis'?b.state==='charge':true;
      step(600,()=>E[array].some(launched)); const b=E[array].find(launched);
      if(!b)return ok(false,{launched:false});
      const at=b.m.position.clone(), next=e.next; player.position.y=e.spec.wake.min[1]-.1;
      step(1); const kept=E[array].includes(b)&&b.m.parent&&b.m.position.distanceTo(at)>1e-6;
      step(600);
      return ok(!!kept&&!E[array].includes(b)&&e.next===next,{kept:!!kept,finished:!E[array].includes(b),next:e.next,expected:next});
    },
  });
}
