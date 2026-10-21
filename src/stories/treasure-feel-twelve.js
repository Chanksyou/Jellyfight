import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';
const ids=['bobbyPin','goldRing','reedStick','stickyNote','penSpring','bathBomb','remote','fairyLights','glowStick','staticBalloon','thumbtack','snooze'];
function ready(...ids){setupFight({hurt:true,bubbles:false,lash:false});give(...ids);holdJelly();G().run.S.dodge=0;}
function ctx(){const {run,player}=G();return {mods:run.mods,feet:player.position,center:player.position.clone().setY(player.position.y+.045),power:run.power,pulse:k=>player.avatar.pulse(k)};}
function ef(kind){return G().run.mods.timed.flatMap(t=>t.effects).find(e=>e.kind===kind);}
const active=(L,k)=>L.pools[k].filter(p=>p.alive);
for(const [id,key,n]of [['goldRing','golden',10],['reedStick','giant',6]])story('treasure-feel-twelve/'+key+'-volley-rule',{
 setup(){ready(id);roachAt(.15,0);},
 play(){const {run}=G(),B=run.bubbles,L=run.gadgets.looks,c=ctx();for(let i=0;i<n;i++)B.volley(c.center,run.S,run.mods);const special=B.list.filter(b=>key==='golden'?b.golden:b.big),value=key==='golden'?special[0]?.golden===5:special[0]?.speed===B.list[0].speed*.6;return ok(special.length===1&&value&&active(L,'arc').length>0,{special:special.length,value});},
});
for(const [id,kind]of [['bobbyPin','pierce'],['stickyNote','mark'],['thumbtack','pin']])story('treasure-feel-twelve/'+kind+'-confirmed-contact',{
 setup(){ready(id);roachAt(.1,0);},
 play(){const {run,enemies}=G(),B=run.bubbles,L=run.gadgets.looks,e=enemies.list[0],log=record('damage_taken');stub(Math,'random',()=>0);B.strike(B.blow(ctx().center,e,{size:1,dmg:1,pierce:kind==='pierce'?3:1}),e,run.mods);const marked=kind==='pierce'?active(L,'needle').length===1:kind==='mark'?e.markT===3&&active(L,'tag').length===1:e.stunT===.8&&active(L,'needle').some(p=>p.follow===e);step(190);return ok(marked&&log.some(d=>d.source==='bubble')&&!active(L,kind==='mark'?'tag':'needle').length&&L.pools.needle.every(p=>!p.follow),{marked});},
});
story('treasure-feel-twelve/air-jump-only-on-real-extra-jump',{
 setup(){setupFight({bubbles:false,lash:false});give('penSpring');},
 play(){const {player,input,run}=G();player.position.y+=.1;player.grounded=false;player.coyote=0;player.airJumps=1;player.maxAirJumps=1;input.jumpQueued=true;step(1);const used=player.airJumps===0&&active(run.gadgets.looks,'spring').length===1&&player.velocity.y>0;step(20);return ok(used&&!active(run.gadgets.looks,'spring').length,{used});},
});
story('treasure-feel-twelve/fizz-prepares-original-damage',{
 setup(){ready('bathBomb');roachAt(.05,0);roachAt(.4,0);},
 play(){const {run}=G(),g=run.gadgets,log=record('damage_taken');let prepared=false;step(365,()=>{prepared ||= g.chordReady.visible;return log.some(d=>d.source==='ring');});const hits=log.filter(d=>d.source==='ring');return ok(prepared&&hits.length===1&&hits[0].amount===run.power*2&&active(g.looks,'foam').length>0,{prepared,hits:hits.length});},
});
story('treasure-feel-twelve/remote-three-confirmed-connections',{
 setup(){ready('remote');for(const x of [.08,.15,.22,.3])roachAt(x,0);},
 play(){const {run}=G(),g=run.gadgets,log=record('damage_taken');g.fire(ef('zap'),ctx());const hits=log.filter(d=>d.source==='zap');return ok(hits.length===3&&hits.every(d=>d.amount===run.power*2)&&active(g.looks,'rod').length===12,{hits:hits.length,streaks:active(g.looks,'rod').length});},
});
story('treasure-feel-twelve/fairy-retains-per-enemy-gap',{
 setup(){ready('fairyLights');},
 play(){const {run}=G(),g=run.gadgets,c=ctx(),e=roachAt(.1,0);g.update(0,c);e.pos.copy(g.bulbs[0].position);e.fairyT=0;const log=record('damage_taken');g.update(0,c);g.update(0,c);const hits=log.filter(d=>d.source==='orbit-lights');return ok(hits.length===1&&hits[0].amount===run.power*2&&g.bulbs[0].children.length===1&&active(g.looks,'arc').length>0,{hits:hits.length});},
});
story('treasure-feel-twelve/aura-keeps-tick-damage-radius',{
 setup(){ready('glowStick');roachAt(.05,0);roachAt(.4,0);},
 play(){const {run}=G(),g=run.gadgets,log=record('damage_taken');g.t.aura=0;g.update(1/60,ctx());const hits=log.filter(d=>d.source==='aura');return ok(hits.length===1&&hits[0].amount===run.power*.15&&g.auraLip.visible&&Math.abs(g.aura.scale.x-.15)<.001&&active(g.looks,'arc').length>0,{hits:hits.length,radius:g.aura.scale.x});},
});
story('treasure-feel-twelve/static-only-actual-proc-target',{
 setup(){ready('staticBalloon');roachAt(.08,0);roachAt(.16,0);},
 play(){const {run,enemies}=G(),[a,b]=enemies.list,B=run.bubbles,L=run.gadgets.looks,q=B.blow(ctx().center,a,{size:1,dmg:1,pierce:1});q.hit.add(a);q.m.position.copy(enemies.center(a));stub(Math,'random',()=>0);B.pop(q,a,run.S,run.mods);return ok(b.stunT===.5&&!a.stunT&&active(L,'rod').length===4,{targetStun:b.stunT,rods:active(L,'rod').length});},
});
story('treasure-feel-twelve/snooze-once-original-health',{
 setup(){ready('snooze');},
 play(){const {run}=G(),L=run.gadgets.looks;run.health=1;run.hurt(2);const saved=run.saved&&run.health===run.S.health*.5&&active(L,'rod').length===2;run.iFrames=0;run.hurt(1000);return ok(saved&&run.phase==='dead',{saved,phase:run.phase});},
});
story('treasure-feel-twelve/prepared-quiet-bounded',{
 setup(){ready(...ids);roachAt(.07,0);},
 play(){const {run,GAME,APT,fx}=G(),g=run.gadgets,L=g.looks,c=ctx();GAME.render();const n=APT.renderer.info.programs.length;g.fire(ef('ring'),c);g.fire(ef('zap'),c);g.t.aura=0;g.update(1/60,c);L.stamp(c.center,.01);L.spring(c.feet);L.snooze(c.feet);run.bubbles.volley(c.center,run.S,run.mods);step(2);GAME.render();const shaders=APT.renderer.info.programs.length-n;stub(fx,'reducedMotion',{matches:true});L.reset();L.fizzBurst(c.feet,.1);const quiet=active(L,'foam').length===3;for(let i=0;i<100;i++){L.stamp(c.center,.02);L.signal(c.center,c.center.clone().addScalar(.1));}const capped=Object.entries(L.pools).every(([k,p])=>p.length<=L.caps[k]);g.reset();return ok(shaders===0&&quiet&&capped&&Object.values(L.pools).flat().every(p=>!p.alive&&!p.follow),{shaders,quiet,capped});},
});
