import { bus } from '../events.js';
import { CONFIG } from '../config.js';
import { G, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';
const six=['discoBall','bubbleBath','cottonBall','bathSalt','rubberDuck','handMirror'];
const alive=L=>Object.values(L.pools).flat().filter(p=>p.alive);
function ready(...ids){setupFight({hurt:true,bubbles:false,lash:false});give(...ids);holdJelly();G().run.S.dodge=0;}
function center(){const {player}=G();return player.position.clone().setY(player.position.y+CONFIG.player.height*.5);}

story('treasure-feel-more/bath-prepares-without-delaying-eight-bubbles',{
  setup(){ready('bubbleBath');},
  play(){const {run}=G(),g=run.gadgets;let prepared=false;step(181,()=>{prepared ||= g.bathReady.visible;return run.bubbles.list.length;});
    const b=run.bubbles.list,dirs=b.map(b=>Math.atan2(b.vel.z,b.vel.x)).sort((a,b)=>a-b);
    const spaced=dirs.length===8&&dirs.slice(1).every((a,i)=>Math.abs(a-dirs[i]-Math.PI/4)<1e-6);
    return ok(prepared&&spaced&&!g.bathReady.visible&&b.every(b=>b.dmg===run.S.bubbleDamage*run.mods.timed[0].effects[0].dmg),{prepared,count:b.length,spaced,hidden:!g.bathReady.visible});},
});
story('treasure-feel-more/disco-one-echo-and-no-miss-contact',{
  setup(){ready('discoBall');roachAt(.08,0);roachAt(.15,0);},
  play(){const {run,enemies}=G(),B=run.bubbles,L=run.gadgets.looks,[a,b]=enemies.list;const source=B.blow(center(),a,{size:1,dmg:10,pierce:1});source.hit.add(a);source.m.position.copy(enemies.center(a));B.pop(source,a,run.S,run.mods);
    const child=B.list.find(b=>b.child),spawn=!!child&&child.dmg===4&&child.target===b&&alive(L).some(p=>p.kind==='crystal');
    L.reset();if(child){child.m.position.copy(enemies.center(b));child.hit.add(b);B.pop(child,b,run.S,run.mods);}
    const hit=alive(L).some(p=>p.kind==='crystal'),count=B.list.filter(b=>b.child).length;L.reset();const miss=B.blow(center(),a,{size:1,dmg:10,pierce:1,child:true});B.pop(miss,null,run.S,run.mods);
    return ok(spawn&&hit&&count===1&&!alive(L).length,{spawn,hit,count,missQuiet:!alive(L).length});},
});
story('treasure-feel-more/cotton-full-area-and-original-sphere',{
  setup(){ready('cottonBall');roachAt(.06,0);roachAt(.5,0);},
  play(){const {run,enemies,player}=G(),L=run.gadgets.looks,[a,b]=enemies.list,Q=run.mods.landingShockwave,log=record('damage_taken');b.pos.copy(player.position);b.pos.y+=Q.radius+.1;
    run.shockwave(player.position.clone(),Q.radius,run.power*Q.dmg,0xffffff);const hits=log.filter(d=>d.source==='shockwave');
    return ok(hits.length===1&&hits[0].targetId===a.id&&hits[0].amount===run.power*Q.dmg&&L.pools.foam.some(p=>p.alive)&&L.pools.arc.some(p=>p.alive&&p.size.x===Q.radius),{hits:hits.map(d=>d.targetId),foam:L.pools.foam.length});},
});
story('treasure-feel-more/salt-queued-chain-and-real-neighbor-contact',{
  setup(){ready('bathSalt');roachAt(.1,0);roachAt(.125,0);roachAt(.6,0);},
  play(){const {run,enemies}=G(),L=run.gadgets.looks,[a,b]=enemies.list,log=record('damage_taken');
    // Kill through the bus so onKill retains its ordinary deferred queue.
    bus.emit('damage_taken',{targetId:a.id,amount:99999,source:'story'});
    const queued=run.bursts.length===1&&log.filter(d=>d.source==='burst').length===0;
    step(1);const hits=log.filter(d=>d.source==='burst');
    return ok(queued&&hits.length===1&&hits[0].targetId===b.id&&hits[0].amount===run.power*run.mods.burstOnKill.dmg&&L.pools.crystal.some(p=>p.alive),{queued,hits:hits.map(d=>d.targetId),crystals:L.pools.crystal.length});},
});
story('treasure-feel-more/duck-cooldown-and-confirmed-recoil',{
  setup(){ready('rubberDuck');roachAt(.05,0);roachAt(.5,0);},
  play(){const {run}=G(),L=run.gadgets.looks,log=record('damage_taken');run.iFrames=0;run.hit(1);const first=log.filter(d=>d.source==='squeak'),lines=L.pools.rod.filter(p=>p.alive).length;run.iFrames=0;run.hit(1);
    return ok(first.length===1&&first[0].amount===run.mods.squeaks[0].dmg&&lines===1&&log.filter(d=>d.source==='squeak').length===1,{hits:first.length,lines,total:log.filter(d=>d.source==='squeak').length});},
});
story('treasure-feel-more/mirror-ready-block-attacker-and-expiry',{
  setup(){ready('handMirror');roachAt(.2,0);},
  play(){const {run,enemies}=G(),g=run.gadgets,log=record('damage_taken');step(1);const ready=g.mirrorReady.visible,shards=g.mirrorShards.visible,hp=run.health;run.iFrames=0;run.hit(3,enemies.list[0].id);
    const block=run.health===hp&&g.mirrorSheen.visible&&g.mirrorShell.visible&&!g.mirrorReady.visible&&log.some(d=>d.source==='reflect'&&d.amount===run.power*run.mods.reflect.dmg)&&g.looks.pools.rod.some(p=>p.alive);
    step(65);const expired=!g.mirrorSheen.visible&&!g.mirrorShell.visible&&!g.mirrorReady.visible;run.reflectAt=run.t;run.iFrames=0;g.looks.reset();run.hit(2);
    const environmental=run.health===hp&&!g.looks.pools.rod.some(p=>p.alive)&&log.filter(d=>d.source==='reflect').length===1;
    g.animate(1,false);const hidden=!g.mirrorSheen.visible&&!g.mirrorShards.visible&&!g.mirrorShell.visible;g.reset();return ok(ready&&shards&&block&&expired&&environmental&&hidden,{ready,shards,block,expired,environmental,hidden});},
});
story('treasure-feel-more/prepared-capped-quiet-and-reset',{
  setup(){ready(...six);roachAt(.06,0);},
  play(){const {run,GAME,APT,fx}=G(),g=run.gadgets,L=g.looks;GAME.render();const n=APT.renderer.info.programs.length;
    run.bubbles.ring(center(),8,1,run.S,run.mods);run.shockwave(G().player.position.clone(),.2,5,0xffffff);run.burst(center());run.hit(1,G().enemies.list[0].id);step(3);GAME.render();const shaders=APT.renderer.info.programs.length-n;
    stub(fx,'reducedMotion',{matches:true});L.reset();L.squeak(center(),.1);L.salt(center(),.03);g.orbit=1;g.mirrorState(center(),false,true);const q=g.mirrorSheen.quaternion.clone();g.orbit=2;g.mirrorState(center(),false,true);const quiet=q.equals(g.mirrorSheen.quaternion)&&L.pools.arc.filter(p=>p.alive).length===2&&L.pools.crystal.filter(p=>p.alive).length===2;
    for(let i=0;i<80;i++){L.salt(center(),.03);L.cushion(center(),.2);L.echo(center(),.01);}const capped=Object.entries(L.pools).every(([k,p])=>p.length<=L.caps[k]);
    g.animate(2,false);const expired=!alive(L).length;g.reset();return ok(shaders===0&&quiet&&capped&&expired&&!g.bathReady.visible&&!g.mirrorReady.visible,{shaders,quiet,capped,expired});},
});


