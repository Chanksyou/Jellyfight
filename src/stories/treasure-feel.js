// Six treasure signatures, exercised through their real gadget effects and damage bus.
import { CONFIG } from '../config.js';
import { juice } from '../juice.js';
import { G, V, give, holdJelly, ok, record, roachAt, setupFight, step, story, stub } from './kit.js';

const six=['toyMouse','marble','legoBrick','guitarPick','magnifier','cactus'];
function ready(...ids){setupFight({bubbles:false,lash:false});give(...ids);holdJelly();}
function context(){const {player,run}=G();return {mods:run.mods,feet:player.position,center:player.position.clone().setY(player.position.y+CONFIG.player.height*.5),facing:player.facing,power:run.power};}
function effect(kind,look){return G().run.mods.timed.flatMap(t=>t.effects).find(e=>e.kind===kind&&(!look||e.look===look));}
const alive=L=>Object.values(L.pools).flat().filter(p=>p.alive);

story('treasure-feel/mouse-contact-and-recovery',{
  about:'The big mouse scurries, slams once for 8x your power with a ring to its splash edge, compresses at contact and leaves a short spring afterimage without delaying the next timer.',
  setup(){ready('toyMouse');roachAt(.25,0);},
  play(){const {run}=G(),g=run.gadgets,log=record('damage_taken');let prepared=false;step(500,()=>{prepared ||= g.mouseReady.visible;return g.mouseRun;});step(3);
    const animated=g.mouse.visible&&g.mouseTail.rotation.y!==0&&g.mouseKey.rotation.z!==0;
    step(500,()=>log.some(d=>d.source==='toy-mouse'));step(1);
    const hits=log.filter(d=>d.source==='toy-mouse'),after=g.mouse.visible&&g.mouseNose.scale.z<1&&g.looks.pools.spring.some(p=>p.alive);
    step(30);return ok(prepared&&animated&&after&&hits.length===1&&hits[0].amount===run.power*run.mods.mouse.dmg&&!g.mouse.visible,{prepared,animated,after,hits:hits.map(d=>d.amount),hidden:!g.mouse.visible});},
});
story('treasure-feel/marble-roll-bounce-and-one-hit',{
  about:'The marble has a turning swirl and bounded trail, preserves speed/reflection and damages each bug once.',
  setup(){ready('marble');},
  play(){const {run}=G(),g=run.gadgets,c=context(),ef=effect('marble'),log=record('damage_taken');g.fire(ef,c);const b=g.marbles[0],start=b.m.position.clone();
    const e=roachAt(0,0);e.pos.copy(b.m.position).addScaledVector(b.dir,.04);
    stub(g.world,'cast',()=>null);g.update(1/60,c);
    const distance=b.m.position.distanceTo(start),roll=b.m.children.length===3&&b.m.quaternion.w<1;
    for(let i=0;i<8;i++){g.animate(1/60);g.update(1/60,c);}
    const hits=log.filter(d=>d.source==='marble'),before=b.dir.clone();
    stub(g.world,'cast',()=>({normal:before.clone().negate(),point:b.m.position.clone().addScaledVector(before,.02)}));
    g.update(1/60,c);const reflected=b.dir.dot(before)<-.999;
    return ok(roll&&Math.abs(distance-ef.speed/60)<1e-6&&reflected&&hits.filter(d=>d.targetId===e.id).length===1&&g.looks.pools.rod.some(p=>p.alive),{roll,distance,reflected,hits:hits.length});},
});
story('treasure-feel/brick-drop-does-not-delay-activation',{
  about:'A new brick is active during its cosmetic bounce, retains its ground collision position, bursts for the original damage and reuses its mesh.',
  setup(){ready('legoBrick');},
  play(){const {run}=G(),g=run.gadgets,c=context(),ef=effect('brick'),log=record('damage_taken');g.fire(ef,c);const b=g.bricks[0],at=b.m.position.clone();
    const e=roachAt(0,0);e.pos.copy(at);g.update(1/60,c);
    const hits=log.filter(d=>d.source==='brick'),hit=hits.length===1&&hits[0].amount===c.power*ef.dmg;
    const grounded=b.m.position.equals(at),studs=g.looks.pools.stud.some(p=>p.alive);
    g.fire(ef,c);const reused=g.bricks[0].m===b.m&&g.bricks[0].age===0;
    return ok(hit&&grounded&&studs&&reused,{hit,grounded,studs,reused});},
});
story('treasure-feel/chord-prepares-and-shows-full-area',{
  about:'The Guitar Pick prepares in its existing timer, releases three oscillating full-radius arcs and retains the original damage and shove.',
  setup(){ready('guitarPick');roachAt(.06,0);roachAt(.5,0);},
  play(){const {run}=G(),g=run.gadgets,ef=effect('ring','chord'),log=record('damage_taken');step(200,()=>g.chordReady.visible);const prepared=g.chordReady.visible;
    step(80,()=>log.some(d=>d.source==='ring'));const hits=log.filter(d=>d.source==='ring');
    const arcs=g.looks.pools.arc.filter(p=>p.alive&&Math.abs(p.size.x-ef.radius)<1e-6);
    return ok(prepared&&hits.length===1&&hits[0].amount===run.power*ef.dmg&&arcs.length===1&&!g.chordReady.visible,{prepared,hits:hits.map(d=>d.amount),fullAreaArcs:arcs.length});},
});
story('treasure-feel/focus-follows-confirmed-target-and-ticks',{
  about:'The moonlight focus follows the nearest bug, contracts on each unchanged damage tick and clears when its target disappears.',
  setup(){ready('magnifier');roachAt(.1,0);roachAt(.25,0);},
  play(){const {run,enemies}=G(),g=run.gadgets,log=record('damage_taken');step(60);const hits=log.filter(d=>d.source==='beam');
    const target=enemies.list[0],focused=g.focus.visible&&g.focusTarget===target&&g.focus.position.distanceTo(enemies.center(target))<target.r;
    const count=hits.length,values=hits.every(d=>Math.abs(d.amount-run.power*run.mods.beam.dmg)<1e-8&&d.targetId===target.id);
    enemies.clear();step(1);return ok(focused&&count>=3&&count<=4&&values&&!g.focus.visible&&!g.beam.visible,{focused,count,values,hidden:!g.focus.visible});},
});
story('treasure-feel/needles-only-connect-to-affected-bugs',{
  about:'Cactus needles connect the actual source and affected bugs, skip out-of-range targets and retain radius, damage and cooldown.',
  setup(){ready('cactus');roachAt(.1,0);roachAt(-.12,.05);roachAt(.6,0);},
  play(){const {run}=G(),g=run.gadgets,c=context(),ef=run.mods.onHurt[0].effects[0],log=record('damage_taken');
    run.hit(1);const hits=log.filter(d=>d.source==='ring'),lines=g.looks.pools.needle.filter(p=>p.alive&&p.m.scale.y>.03);
    run.iFrames=0;run.hit(1);const count=log.filter(d=>d.source==='ring').length;
    return ok(ef.look==='needles'&&hits.length===2&&lines.length===2&&count===2&&hits.every(d=>d.amount===c.power*ef.dmg),{look:ef.look,hits:hits.length,lines:lines.length,count});},
});
story('treasure-feel/quiet-pools-and-suspended-combat-cleanup',{
  about:'OS reduced motion suppresses arc wobble and trails; visual lifetimes still end during polyp/ceremony suspension and reset clears every pooled piece.',
  setup(){ready();},
  play(){const {run,fx}=G(),g=run.gadgets,L=g.looks,c=context();stub(fx,'reducedMotion',{matches:true});
    g.warm(true,c.feet);g.animate(2,false);const heldWarm=alive(L).length===Object.keys(L.geo).length&&alive(L).every(p=>p.m.visible);g.warm(false);
    const m=L.arc(c.feet,.1);L.studs(c.feet,L.color);const spin=m.rotation.y;
    g.animate(.05);const quiet=L.quiet&&m.rotation.y===spin;
    run.polypT=2;step(65);const expired=alive(L).length===0;
    for(let i=0;i<300;i++){L.arc(c.feet,.1);L.streak(c.center,c.center.clone().add(V(.1,0,0)));L.studs(c.feet,L.color);}
    const capped=Object.entries(L.pools).every(([kind,p])=>p.length<=L.caps[kind]);g.reset();
    const cleared=!alive(L).length&&!g.focus.visible&&!g.mouse.visible;
    run.polypT=0;give('toyMouse');roachAt(.15,0);g.t.mouse=0;const hits=record('damage_taken');juice.trauma=0;
    step(200,()=>hits.some(d=>d.source==='toy-mouse'));const noShake=hits.some(d=>d.source==='toy-mouse')&&juice.trauma===0;g.reset();
    return ok(heldWarm&&quiet&&expired&&capped&&cleared&&noShake,{heldWarm,quiet,expired,capped,cleared,noShake,counts:Object.fromEntries(Object.entries(L.pools).map(([k,p])=>[k,p.length]))});},
});
story('treasure-feel/prepared-shaders-and-reusable-bodies',{
  about:'Six combined treasures compile no gameplay shaders; repeated resets reuse body meshes and clear all transient cosmetics.',
  setup(){ready(...six);for(let i=0;i<8;i++)roachAt(Math.cos(i)*.15,Math.sin(i)*.15);},
  play(){const {run,APT,GAME}=G(),g=run.gadgets,c=context();GAME.render();const programs=APT.renderer.info.programs.length;
    for(const T of run.mods.timed)for(const ef of T.effects)g.fire(ef,c);g.fire(run.mods.onHurt[0].effects[0],c);step(30);GAME.render();
    const shaders=APT.renderer.info.programs.length-programs,brickGeo=g.brickPool[0].userData.body.children[0].geometry,marbleGeo=g.marblePool[0].children[0].geometry;
    g.reset();const lengths=[g.brickPool.length,g.marblePool.length];
    for(let i=0;i<10;i++){g.fire(effect('brick'),c);g.fire(effect('marble'),c);g.reset();}
    const reused=g.brickPool.length===lengths[0]&&g.marblePool.length===lengths[1]&&g.brickPool.every(m=>m.userData.body.children[0].geometry===brickGeo)&&g.marblePool.every(m=>m.children[0].geometry===marbleGeo);
    return ok(shaders===0&&reused&&!alive(g.looks).length,{shaders,reused,pools:[g.brickPool.length,g.marblePool.length]});},
});
