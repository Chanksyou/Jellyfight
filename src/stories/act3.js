// Stories: act 3: the bedroom and the Great White One (played in a page opened on act 3). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { CONTENT } from '../content.js';
import { LOOK } from '../look.js';
import { STAGES, nav } from '../stages.js';
import { STAGE3 } from '../stage3.js';
import { unlock as unlockAudio, audio, sfx } from '../sfx.js';
import { juice } from '../juice.js';
import { ATTACKS as SHARK_ATTACKS } from '../shark.js';
import { buildShark } from '../shark-model.js';
import { G, JUMP_FEET, V, act3, bossHits, cameraStory, cameraTour, everyAttack, fresh, heartFrame, holdJelly, near, ok, offs, sharkFight, pothosFloor, r3, record, shownWarnings, sim, spawn, spy, step, stripLine, stub, tp, volumePairs } from './kit.js';

// --- act 3: the bedroom (stage3.js). These play in a page opened on act 3, carrying a level-10
act3('carries-the-run', {
  about: 'Act 3 starts in the bedroom with what act 2 left you: level, Treasures, evolutions and the score so far.',
  setup() { fresh(); },
  play() {
    const { run, player } = G();
    const inBedroom = run.stage.rooms.includes('Bedroom') && run.inStage(player.position.x, player.position.z);
    return ok(run.stage.id === 3 && run.level === 10 && run.owned.has('candle') && run.owned.has('battery') && run.evolved.length === 2 && run.score() >= 12000 && inBedroom,
      { act: run.stage.id, level: run.level, owned: [...run.owned], evolved: run.evolved, score: run.score(), at: r3(player.position) });
  },
});
act3('night-dragonflies-mantises-then-nests', {
  about: 'The act 3 night: dragonflies from the start, praying mantises from 0:45, and from 1:30 two wasp nests at two of the spots the act lists (none before). Only act 3\'s Bugs come.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies } = G();
    const pool = new Set(CONTENT.waves.bugs.filter((b) => b.act === 3).map((b) => b.id));
    // a stretch of the night held at time t: what comes (killed as it comes, so the cap never stops it)
    const during = (t, frames) => {
      const seen = new Set();
      step(frames, () => {
        run.t = t;
        for (const e of enemies.list) if (!e.dead && !e.proxy) { seen.add(e.type); if (e.type !== 'nest') enemies.kill(e, true); }
      });
      return seen;
    };
    const early = during(10, 900), later = during(70, 2400);
    const nestsBefore = enemies.list.filter((e) => !e.dead && e.type === 'nest').length;
    run.t = 89.5;
    step(60);
    const nests = enemies.list.filter((e) => !e.dead && e.type === 'nest');
    const listed = nests.every((n) => STAGE3.nests.spots.includes(n.spot)) && new Set(nests.map((n) => n.spot)).size === nests.length;
    const stray = [...early, ...later].filter((t) => !pool.has(t) && t !== 'nest');
    return ok([...early].join() === 'dragonfly' && later.has('mantis') && later.has('dragonfly') && !nestsBefore && !early.has('nest') && !later.has('nest') && nests.length === 2 && listed && !stray.length,
      { early: [...early], later: [...later], nestsBefore, nests: nests.map((n) => n.spot?.on), stray });
  },
});
act3('stag-beetles-from-1-00', {
  about: 'A roll favoring the last eligible bug cannot spawn a stag beetle before 1:00, but spawns one at exactly 1:00.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => .999999);
    stub(run, 'spawnPoint', () => player.position.clone()); // eligibility is separate from scenery placement
    const during = t => {
      enemies.clear(); run.t = t; run.spawnAcc = 1; run.spawnWaves(0);
      return enemies.list.filter(e => e.type === 'beetle').length;
    };
    const before = during(59.999), after = during(60);
    return ok(!before && after > 0, { before, after });
  },
});
act3('stag-beetle-with-sound', {
  about: 'The stag beetle\'s charge, shot and hit play their sounds on live audio without an error (a sound called without its length once threw in real play).',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(1.0, 0.05, 8.85, 0); },
  async play() {
    unlockAudio();
    await new Promise((r) => setTimeout(r, 200));
    fresh({ hurt: true, elites: false, bubbles: false, lash: false });
    tp(1.0, 0.05, 8.85, 0);
    const e = spawn('beetle', near(0.4, 0)), log = record('damage_taken');
    e.shotCd = 0.2;
    let charged = false;
    step(60 * 5, () => { if (e.state === 'charge') charged = true; return log.some((d) => d.source === 'beetle'); });
    const hit = log.find((d) => d.source === 'beetle');
    return ok(!!audio() && charged && hit?.amount > 0, { audio: !!audio(), charged, hit: hit?.amount });
  },
});
act3('act-3-is-tougher', {
  about: 'Act 3 is scaled for a level-10 jelly: its Bugs have 3x the health, hits on you do 2x, and each kill drops 1.4x the XP.',
  setup() { fresh({ hurt: true, elites: false }); },
  play() {
    const { run, enemies, xpDrops } = G(), stage = run.stage;
    const fly = enemies.spawn('dragonfly', near(0.5, 0), stage.toughness);
    const bugX = fly.maxHp / fly.T.hp;
    run.iFrames = 0;
    const m0 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'test' });
    const took = m0 - run.health;
    let dropped = 0;
    stub(xpDrops, 'drop', (p, v, n) => { dropped += v * n; });
    run.onKill({ pos: near(0.1, 0), r: 0.01, xp: 5 });
    return ok(bugX === 3 && Math.abs(took - 4) < 0.01 && dropped === 7, { bugX, took: +took.toFixed(2), dropped });
  },
});
act3('treasure-spots', {
  about: 'Treasures can turn up all over the bedroom (the floor, the bed, the dresser), each on a real surface you can reach.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.spots.length >= 8 && !run.spotRejects.length && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])),
      { kept: run.spots.length, rejects: run.spotRejects });
  },
});
for (const v of STAGE3.vents) {
  act3(`vent-to-${v.to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the ${v.name.toLowerCase()} flings you onto ${v.to}.`,
    setup() { fresh({ elites: false }); tp(v.at[0], 0.05, v.at[2], 0); },
    play() {
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}

act3('shark-wakes-when-time-runs-out', {
  about:'The bed arena now spawns the rigged Great White One, clears the elites and shows its Health bar.',
  setup(){fresh({elites:false});},
  play(){const {run,menus,player}=G();run.t=run.duration-.05;step(360,()=>{if(menus.open)document.querySelector('.jf-card')?.click();return run.phase==='boss'&&run.boss?.rise>=1;});const B=run.boss,A=run.stage.boss;
    return ok(B?.kind==='shark'&&B.model.rig.jaw&&run.bossWalls.every(m=>m.visible)&&player.position.y>.55&&B.position.x>A.arenaMin[0]&&B.position.z<A.arenaMax[2]&&/GREAT WHITE ONE/i.test(document.querySelector('#hud .boss')?.textContent),{kind:B?.kind,hp:B?.hp});},
});
act3('shark-arena-stops-at-the-pillows',{
  about:'The force field closes right along the front of the pillows: the two pillows and the bolster behind them are outside the fight, and nothing inside it stands more than the folded quilt\'s 4-5 cm edge above the sheet, so the shark can reach every part of it.',
  setup(){sharkFight();},
  play(){const {run,APT}=G(),B=run.boss,A=run.stage.boss,box=new THREE.Box3();
    let pillowFront=Infinity;APT.scene.traverse(o=>{if(o.isMesh&&/pillow/i.test(o.name)&&o.position){box.setFromObject(o);if(box.max.x>A.arenaMin[0]&&box.min.x<A.arenaMax[0]&&box.min.z>9&&box.min.z<11.3)pillowFront=Math.min(pillowFront,box.min.z);}});
    const head=run.bossWalls.map(m=>m.position.z).reduce((a,b)=>Math.max(a,b),0);
    const ys=[];for(let x=A.arenaMin[0]+.03;x<A.arenaMax[0];x+=.1)for(let z=A.arenaMin[2]+.03;z<A.arenaMax[2];z+=.1)ys.push(B.floorAt(V(x,0,z)));
    const rise=Math.max(...ys)-Math.min(...ys);
    return ok(pillowFront>=A.arenaMax[2]-.005&&Math.abs(head-pillowFront)<.05&&rise<.06,{pillowFront:+pillowFront.toFixed(3),head:+head.toFixed(3),edge:A.arenaMax[2],rise:+rise.toFixed(3)});},
});
act3('shark-arrival-raises-the-barrier-then-floods-the-bed',{
  about:'The bed barrier rises first, the shark surfaces through the quilt, then a 1 cm sheet spreads before attacks begin.',setup(){fresh({bubbles:false,lash:false,elites:false});},
  play(){const {run}=G();run.startBossIntro();step(180,()=>run.phase==='boss'&&run.boss);const B=run.boss,fields=run.bossWalls.map(m=>m.userData.field);holdJelly();
    step(30);const barrier=fields.every(f=>f.scale.y>0&&f.scale.y<1)&&B.rise===0&&B.flooded===0;
    step(50);const emerging=B.rise>0&&B.rise<1&&B.flooded===0&&fields.every(f=>f.scale.y===1);
    step(80);const flooding=B.rise===1&&B.flooded>0&&B.flooded<1&&B.phase==='rest';
    step(120,()=>B.ready);const depth=B.water.geometry.parameters.height*B.water.scale.y;
    return ok(barrier&&emerging&&flooding&&B.ready&&Math.abs(depth-.01)<1e-6&&Math.abs(B.water.position.y+.005-B.waterFloor-.01)<1e-6,{barrier,emerging,flooding,ready:B.ready,depth});},
});
act3('shark-water-slows-grounded-feet-by-15-percent',{
  about:'Only feet touching the flooded bed receive 15% slow; jumping, below-bed positions and leaving the arena do not.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly(),log=record('status_applied');B.elapsed=-1e6;P.position.set(B.water.position.x,B.waterFloor+.003,B.water.position.z);P.grounded=true;
    B.update(1/60,P);const wet=log.filter(e=>e.targetId===PLAYER&&e.status==='slow');log.length=0;
    P.grounded=false;P.position.y=B.waterFloor+.2;B.update(1/60,P);P.grounded=true;P.position.y=B.waterFloor-.3;B.update(1/60,P);P.position.set(B.arena.arenaMax[0]+.2,B.waterFloor+.003,B.water.position.z);B.update(1/60,P);
    return ok(wet.length===1&&wet[0].strength===.15&&wet[0].duration===1/60&&!log.some(e=>e.targetId===PLAYER&&e.status==='slow'),{wet,unwanted:log.length});},
});
act3('shark-pools-are-murky-and-the-fish-stay-visible',{
  about:'Piranha pools have subdued brown rippling water and a faint honest boundary instead of a luminous orange fill.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();B.pool(P.position);B.hazards(.02,P);const p=B.pools[0],U=p.surface.material.uniforms;
    return ok(U.uMurky.value===1&&U.uTime.value>0&&p.floor.material.opacity<=.12&&p.volume.material.opacity<=.12&&B.fish.count===5&&p.surface.position.y<P.position.y+.018,{murky:U.uMurky.value,warning:p.floor.material.opacity,fish:B.fish.count});},
});
act3('shark-jaws-and-fins-are-articulated',{
  about:'The connected chin rotates around its cheek hinge, the head leads, and the fins and tail have independent poses.',setup(){},
  play(){const B=sharkFight(),R=B.model.rig;B.model.pose({gape:.8,headTurn:.2,left:.8,right:-.3,tailSwing:.4});B.holder.updateMatrixWorld(true);
    return ok(R.jaw.rotation.x===.8&&R.spine[4].rotation.y!==0&&R.eyes.parent===R.head.parent&&R.fins[0].rotation.y!==R.fins[1].rotation.y&&R.tail.rotation.y===.4&&R.jaw.position.z<R.head.geometry.boundingSphere.center.z+1,{jaw:R.jaw.rotation.x,tail:R.tail.rotation.y});},
});
for(const attack of [...new Set([...SHARK_ATTACKS.calm,...SHARK_ATTACKS.angry])])act3('shark-'+attack+'-warning-and-recovery',{
  about:`${attack} has a floor warning and matching finite volume, animates, then returns to a recovery window.`,setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();if(attack==='tornado')B.hp=B.maxHp*.84;B.begin(attack);step(8);
    const W=B.warning,paired=!!W&&W.floor.material.progress>0&&W.floor.material.progress===W.volume.material.progress;
    let hidden=false,air=false,moving=false;const first=B.position.clone();
    step(60*18,()=>{hidden ||= !B.model.visible&&B.fin.visible;air ||= B.lift>.1;moving ||= B.position.distanceTo(first)>.02;return B.phase==='rest';});
    return ok(paired&&B.phase==='rest'&&!B.warning&&B.model.visible&&!B.fin.visible&&(!['dive','burrowBite','maelstrom','tornado'].includes(attack)||hidden)&&(!['leap','dive','maelstrom','tornado'].includes(attack)||air),{paired,phase:B.phase,hidden,air,moving,player:r3(P.position)});},
});
act3('shark-flexible-rig-is-independent-and-normalized',{
  about:'Twelve joints bend the spine, fin elbows and tail; each clone has its own skeleton with normalized weights.',setup(){},
  play(){const B=sharkFight({hurt:false}),other=buildShark();let joints=0,valid=true;B.model.traverse(m=>{if(!m.isSkinnedMesh)return;joints+=m.skeleton.bones.length;
      const w=m.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)valid&&=Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5;
    });B.model.pose({coil:1,time:1,tailSwing:.4,left:.8});other.pose({time:0});
    const independent=B.model.rig.spine[2]!==other.rig.spine[2]&&B.model.rig.spine[2].rotation.y!==other.rig.spine[2].rotation.y;
    return ok(joints===12&&valid&&independent&&B.model.rig.fins[0].skeleton.bones[1].rotation.z!==0,{joints,valid,independent});},
});
act3('shark-walk-has-overlapping-body-and-fin-motion',{
  about:'Walking alternates fin steps and elbow bends while the spine and tail follow through continuously.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();B.recover();B.elapsed=-1e6;P.position.copy(B.position).add(V(0,0,-1));let span=0,last=B.model.rig.spine[2].rotation.y,maxStep=0;
    for(let i=0;i<45;i++){B.update(1/60,P);const n=B.model.rig.spine[2].rotation.y;span+=Math.abs(n-last);last=n;maxStep=Math.max(maxStep,Math.abs(B.model.rig.fins[0].rotation.y-B.model.rig.fins[1].rotation.y));}
    return ok(span>.01&&maxStep>.3&&Number.isFinite(B.model.rig.tail.skeleton.bones[2].rotation.y),{span,maxStep});},
});
for(const attack of ['dive','burrowBite','maelstrom','tornado'])act3(`shark-${attack}-emerges-through-the-floor`,{
  about:'The snout emerges before the body; buried geometry is clipped and the partially emerged boss stays shielded until the existing impact frame.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();B.begin(attack);B.phase='eruption';B.visualTilt=-.4-Math.sin(.15*Math.PI)*.9;const counts=[];let total=0;
    for(const fraction of [.36,.68,.99]){B.elapsed=B.skill().tell*fraction;B.update(.001,P);B.holder.updateMatrixWorld(true);let above=0;total=0;const p=V(0,0,0);
      B.model.traverse(m=>{if(!m.isMesh)return;m.skeleton?.update();for(let i=0;i<m.geometry.attributes.position.count;i+=37){m.getVertexPosition(i,p);p.applyMatrix4(m.matrixWorld);above+=p.y>B.floor+.002?1:0;total++;}});counts.push(above);
    }
    const hp=B.hp;B.damage(1);const shielded=B.shielded&&B.hp===hp,plane=B.model.rig.clipPlane;
    return ok(counts[0]===0&&counts[1]>0&&counts[1]<counts[2]&&shielded&&G().APT.renderer.localClippingEnabled&&Math.abs(plane.constant+B.floor)<1e-6,{counts,total,shielded});},
});
act3('shark-bite-hits-on-jaw-closure',{
  about:'The bite lunges and closes its jaw on the damage frame; a confirmed melee hit marks Prey and triggers frenzy.',setup(){},
  play(){const B=sharkFight(),P=holdJelly(),{run}=G();B.begin('bite');P.position.copy(B.warning.at);run.iFrames=0;const hits=record('player_hurt');let gape=null,lunge=0;
    step(120,()=>{lunge=Math.max(lunge,B.position.distanceTo(B.start));if(hits.some(h=>h.from==='shark-bite')){gape=B.model.rig.jaw.rotation.x;return true;}});
    return ok(gape!==null&&gape<.15&&lunge>.02&&B.prey>0&&B.frenzy>0&&B.bleed>0,{gape,lunge,prey:B.prey,frenzy:B.frenzy});},
});
act3('shark-blocked-bite-does-not-mark-prey',{
  about:'Invulnerability and dodged damage do not grant the shark Prey, bleed, or a frenzy.',setup(){},
  play(){const B=sharkFight(),P=holdJelly(),{run}=G();run.iFrames=99;const at=P.position.clone(),hit=B.hit(P,at,.2,.2,3,true);
    return ok(!hit&&!B.prey&&!B.bleed&&!B.frenzy,{hit,prey:B.prey,frenzy:B.frenzy});},
});
act3('shark-combo-has-three-separate-beats',{
  about:'Bite, fin swipe and tail sweep each have their own anticipation and active pose.',setup(){},
  play(){const B=sharkFight({hurt:false});holdJelly();B.begin('combo');const beats=new Set();step(360,()=>{if(B.phase==='active')beats.add(B.beat);return B.phase==='rest';});return ok([...beats].join()==='0,1,2',{beats:[...beats]});},
});
act3('shark-dive-erupts-four-times',{
  about:'A dive shows only the fin while tracking, shields the submerged body, erupts four times and leaves four pools.',setup(){},
  play(){const B=sharkFight({hurt:false});holdJelly();const pools=spy(B,'pool');B.begin('dive');let concealed=false,shielded=false;
    step(60*16,()=>{if(B.fin.visible){concealed ||= !B.model.visible;shielded ||= B.shielded;}return B.phase==='rest';});
    return ok(pools.length===4&&concealed&&shielded&&B.repeats===4,{pools:pools.length,concealed,shielded,repeats:B.repeats});},
});
act3('shark-tornado-unlocks-at-85-percent',{
  about:'The three tornadoes are absent from the calm rotation and unlock at 85% Health; their fish are bounded.',setup(){},
  play(){const B=sharkFight({hurt:false});holdJelly();B.hp=B.maxHp*.851;const before=B.angry;B.hp=B.maxHp*.85;const after=B.angry;B.begin('tornado');
    step(600,()=>B.tornadoes.length===3);const count=B.tornadoes.length;step(120);
    return ok(!before&&after&&!SHARK_ATTACKS.calm.includes('tornado')&&SHARK_ATTACKS.angry.includes('tornado')&&count===3&&B.shots.length<=12,{before,after,count,shots:B.shots.length});},
});
act3('shark-the-jelly-never-leaves-the-arena',{
  about:'During the fight the jelly stays on the bed: shoved hard at each wall and into each corner (where two walls meet it once squeezed out and fell to the floor), or jumping high at them, it never ends up outside the arena or below the mattress (run.js keepInArena).',
  setup(){},
  play(){const B=sharkFight(),{run,player:P}=G(),A=run.stage.boss;stub(B,'update',()=>({push:null}));run.health=run.stats.health=1e9;
    const pushes={west:[-.85,9.8,-1,0],east:[.64,9.8,1,0],foot:[-.1,9.17,0,-1],head:[-.1,10.38,0,1],cornerNW:[-.88,10.42,-.7,.7],cornerNE:[.68,10.42,.7,.7],cornerSW:[-.88,9.12,-.7,-.7],cornerSE:[.68,9.12,.7,-.7]};
    const worst={};let out=-9,low=9;
    for(const [name,[x,z,dx,dz]] of Object.entries(pushes))for(const jump of [false,true]){
      P.spawn(V(x,.7,z));P.snapToGround();let o=-9;
      step(90,()=>{P.velocity.x=dx*3;P.velocity.z=dz*3;if(jump&&P.grounded)P.velocity.y=1.2;const p=P.position;o=Math.max(o,p.x-A.arenaMax[0],A.arenaMin[0]-p.x,p.z-A.arenaMax[2],A.arenaMin[2]-p.z);low=Math.min(low,p.y);});
      worst[name+(jump?'+jump':'')]=+o.toFixed(3);out=Math.max(out,o);}
    return ok(out<=0&&low>A.arenaMin[1]-.05,{out:+out.toFixed(3),low:+low.toFixed(3),worst});},
});
act3('shark-fish-circles-hurt-and-slow',{
  about:'A fish circle is wider than it was (17 cm round), and standing in one both drains Health (`dmg` a second) and slows you 30% (content/bosses.kdl pools); step out and the slow wears off.',setup(){},
  play(){const B=sharkFight(),P=holdJelly(),{run}=G(),sk=CONTENT.bosses.shark.skills.pools;B.elapsed=-1e6;
    const at=P.position.clone();B.pool(at);const r=B.pools[0].r;let hp=run.health;
    B.hazards(.1,P);const hurt=hp-run.health,slowed=run.slowHardT>0&&run.slowK===sk.slow;
    P.position.x+=r+.1;step(30);const freed=!(run.slowHardT>0);
    return ok(r===sk.radius&&r>=.17&&sk.slow===.3&&sk.dmg>=3&&hurt>0&&slowed&&freed,{r,hurt:+hurt.toFixed(3),slowK:run.slowK,slowed,freed});},
});
act3('shark-attacks-have-their-own-sounds',{
  about:'Each kind of shark attack plays its own sound: a swish as a bite or leap starts, its jaws chomping, a heavy slam where it lands or erupts, a gulp as it dives, a rising rumble before an eruption, the tornadoes howling, fish flicked out and slapping down.',setup(){},
  play(){const B=sharkFight(),P=holdJelly(),{run}=G();run.health=run.stats.health=1e6;
    const names=['sharkChomp','sharkSwish','sharkSlam','sharkDive','sharkRumble','sharkTornado','sharkFish'],heard={};for(const k of names)heard[k]=spy(sfx,k);
    for(const name of ['bite','leap','dive','tornado']){B.recover();B.stunT=0;B.begin(name,P);step(60*8,()=>B.phase==='rest');B.elapsed=-1e6;}
    step(60*3);
    const counts=Object.fromEntries(names.map(k=>[k,heard[k].length])),landed=heard.sharkFish.some(([l])=>l),flung=heard.sharkFish.some(([l])=>!l);
    return ok(names.every(k=>counts[k]>0)&&landed&&flung,{counts,landed,flung});},
});
act3('shark-pools-are-bounded-expire-and-can-be-jumped',{
  about:'Pools never exceed six, have visible fish, cannot hurt below the bed, can be jumped, and disappear after their lifetime.',setup(){},
  play(){const B=sharkFight(),P=holdJelly(),{run}=G();B.elapsed=-1e6;const at=P.position.clone();for(let i=0;i<10;i++)B.pool(at);const cap=B.pools.length;
    P.position.y=at.y+.3;let hp=run.health;B.hazards(.2,P);const jumped=run.health===hp;
    P.position.y=at.y-.4;B.hazards(.2,P);const below=run.health===hp;
    P.position.copy(at);B.hazards(.2,P);const hurts=run.health<hp,fish=B.fish.count;B.hazards(25,P);
    return ok(cap===6&&jumped&&below&&hurts&&fish>0&&!B.pools.length,{cap,jumped,below,hurts,fish});},
});
act3('shark-prey-tightens-fin-pursuit',{
  about:'Prey speeds the burrowed fin; the whole model stays hidden until the eruption is telegraphed.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();B.begin('dive');B.release(P);const at=B.position.clone();B.heading=Math.atan2(P.position.x-at.x,P.position.z-at.z);const heading=B.heading;
    for(let i=0;i<12;i++)B.update(1/60,P);const calm=B.position.distanceTo(at);B.position.copy(at);B.heading=heading;B.elapsed=0;B.prey=6;
    for(let i=0;i<12;i++)B.update(1/60,P);const marked=B.position.distanceTo(at);return ok(marked>calm*1.2&&B.shielded&&!B.model.visible,{calm,marked});},
});
act3('shark-stun-stops-movement-and-frenzy',{
  about:'A stun interrupts the current attack, holds the shark still and ends its frenzy.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly(),{enemies}=G();B.frenzy=3;B.begin('leap');const proxy=enemies.list.find(e=>e.proxy===B);bus.emit('status_applied',{targetId:proxy.id,status:'stun',duration:1});const at=B.position.clone();
    for(let i=0;i<30;i++)B.update(1/60,P);return ok(B.position.distanceTo(at)<1e-6&&!B.frenzy&&B.phase==='rest'&&B.stunT>0,{moved:B.position.distanceTo(at),frenzy:B.frenzy,stun:B.stunT});},
});
act3('shark-bounds-and-disposal',{
  about:'Moving states stay inside the bed with room for the whole model, and clearing the boss removes all hazards.',setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly();B.begin('dive');P.position.set(20,B.floor,20);let outside=false;
    step(600,()=>{const A=B.arena;outside ||= B.position.x<A.arenaMin[0]+B.bound-.001||B.position.x>A.arenaMax[0]-B.bound+.001||B.position.z<A.arenaMin[2]+B.bound-.001||B.position.z>A.arenaMax[2]-B.bound+.001;});
    B.pool(B.position);B.launchTornadoes();B.recover();B.damage(B.hp+1);return ok(!outside&&B.dying&&!B.pools.length&&!B.tornadoes.length&&!B.warning,{outside,dying:B.dying});},
});
for(const source of ['bite','eruption','pool','tornado','fish','bleed'])for(const response of ['kill','stun'])act3(`shark-retaliation-${source}-${response}`,{
  about:`Synchronous ${response} retaliation during ${source} stops the attack safely; lethal retaliation clears every hazard.`,setup(){},
  play(){const B=sharkFight({hurt:false}),P=holdJelly(),{enemies}=G();B.elapsed=-1e6;
    if(source==='bite'){B.begin('bite');P.position.copy(B.warning.at);B.release(P);B.elapsed=B.skill().active*.4;}
    if(source==='eruption'){B.begin('dive');B.phase='eruption';B.elapsed=B.skill().tell;B.target.copy(P.position);}
    if(source==='pool')for(let i=0;i<3;i++)B.pool(P.position);
    if(source==='tornado'){B.position.copy(P.position);B.launchTornadoes();}
    if(source==='fish')for(let i=0;i<3;i++){B.fishShot(P.position,0);const s=B.shots.at(-1);s.to.copy(P.position);s.t=B.def.skills.tornado.flight;}
    if(source==='bleed')B.bleed=1;
    let answered=false;offs.push(bus.on('damage_taken',e=>{if(answered||e.targetId!==PLAYER||e.source!=='boss')return;answered=true;
      if(response==='kill')B.damage(B.hp+1);else bus.emit('status_applied',{targetId:enemies.list.find(e=>e.proxy===B).id,status:'stun',duration:1});
    }));
    B.update(.01,P);
    const stopped=response==='kill'?B.dying&&!B.pools.length&&!B.tornadoes.length&&!B.shots.length&&!B.warning:B.stunT>0&&B.phase==='rest'&&!B.warning;
    return ok(answered&&stopped,{answered,stopped,phase:B.phase,pools:B.pools.length,shots:B.shots.length});},
});
act3('shark-health-as-the-clogs',{
  about:'The replacement preserves Act 3 boss Health scaling.',setup(){},play(){const B=sharkFight();return ok(B.maxHp===CONTENT.bosses.shark.hp*STAGES[2].bossHp,{hp:B.hp});},
});
act3('shark-fight-camera',{
  about:'The fight view uses finite pitch and distance and keeps the boss and jelly in the viewport.',setup(){},play(){const B=sharkFight({hurt:false});B.elapsed=-1e6;step(180);const {tpc}=G(),view=heartFrame(B);return ok(Number.isFinite(tpc.viewPitch)&&Number.isFinite(tpc.currentDistance)&&view.good,{view,pitch:tpc.viewPitch,distance:tpc.currentDistance});},
});
act3('attacks-every-warning-has-volume',{
  about:'Every shark, Alligator, Bull and Coffer attack has its required paired warning; all attack materials are warmed.',setup(){fresh({bubbles:false,lash:false});},play(){return everyAttack(3);},
});

act3('dendi-finishes-the-shark', {
  about: 'At 0 Health the Great White One is doomed, not dead: its attacks stop, the screen fades, Dendi appears on the bed beside it in view of the camera, and his smack is what kills it.',
  setup() {},
  play() {
    const B = sharkFight(), { run } = G(), d = window.dendi;
    if (!d) return ok(false, { dendi: null });
    B.damage(B.hp + 1);
    const doomed = B.dying && !B.dead;
    let smacked = false, onBed = false, onScreen = false, attacks = 0;
    const v = new THREE.Vector3();
    step(60 * 10, () => {
      if (B.dying) attacks = Math.max(attacks, shownWarnings().floor.length);
      if (d.state() === 'smack') smacked = true;
      if (smacked && d.group.visible) {
        const gp = d.group.position; onBed = gp.y > 0.55 && Math.hypot(gp.x - B.position.x, gp.z - B.position.z) < 0.6;
        d.group.getWorldPosition(v); v.y += 0.15; v.project(G().APT.camera); if (Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1) onScreen = true;
      }
      return B.dead && run.bossWon;
    });
    return ok(doomed && attacks === 0 && smacked && onBed && onScreen && B.dead && !d.group.visible, { doomed, attacks, smacked, onBed, onScreen, dead: B.dead, goneAfter: !d.group.visible });
  },
});
act3('beating-the-shark-goes-on-to-act-4', {
  about: 'Beating the Great White One grows the jelly into a Medusa, then a Legendary pick to take into act 4, then "Act 3 complete" with the score so far and a button on to act 4, the Encore\'s concert (the run goes on: nothing posts to the Leaderboard yet).',
  setup() {},
  async play() {
    const B = sharkFight(), { run, menus } = G();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const modal = () => document.querySelector('.jf-modal');
    let posted = null;
    stub(run, 'board', { status: 'online', keepBest: () => false, post: (e) => { posted = e; return Promise.resolve({ posted: true }); } });
    B.damage(B.hp + 1);
    step(60 * 10, () => run.bossWon);                     // Dendi finishes it, then the run sees it beaten
    step(5);
    await wait(2400);                                     // the metamorphosis comes a moment after
    const grow = modal()?.innerText || '';
    modal()?.querySelector('.jf-card')?.click();          // the evolution
    run.evolutionReveal.finish();                        // skip its portrait
    const legendary = modal()?.innerText || '';
    modal()?.querySelector('.jf-card')?.click();          // a Legendary treasure
    const done = modal()?.innerText || '';
    const next = [...(modal()?.querySelectorAll('button') || [])].some((b) => /On to act 4/.test(b.textContent));
    menus.close();
    return ok(/Medusa/.test(grow) && /rest of the run/.test(grow) && /Legendary/.test(legendary) && /act 4/.test(legendary) && /Act 3 complete/.test(done) && next && !posted && run.evolved.length === 3,
      { grow: grow.slice(0, 200), legendary: legendary.slice(0, 120), done: done.slice(0, 160), next, posted });
  },
});
act3('dying-starts-over-in-act-1', {
  about: 'Dying in act 3 shows the usual death screen, and trying again starts a new run in act 1, with nothing carried.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, menus } = G();
    const was = sessionStorage.getItem('jellyfight.act');
    let reloaded = false;
    stub(nav, 'reload', () => { reloaded = true; });
    run.die();
    await new Promise((r) => setTimeout(r, 800));
    const modal = document.querySelector('.jf-modal'), text = modal?.innerText || '';
    [...(modal?.querySelectorAll('button') || [])].find((b) => /Try again/.test(b.textContent))?.click();
    const went = JSON.parse(sessionStorage.getItem('jellyfight.act') || 'null');
    sessionStorage.setItem('jellyfight.act', was);           // this page stays on act 3
    menus.close();
    return ok(/You dried out/.test(text) && reloaded && went?.act === 1 && !went.carry, { text: text.slice(0, 60), reloaded, went });
  },
});
act3('dragonfly-comes-down-from-the-bed', {
  about: 'A dragonfly up on the bed (64 cm up) comes down after a jelly on the floor beside it: within 6 s it zigzags down to the jelly\'s height. Its darts keep it between just off the floor and a little over you, and one that starts higher than that dives back down instead of climbing away.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(1.05, 0, 9.6, 0); holdJelly(); spawn('dragonfly', V(0.4, 0.75, 9.7), { hp: 9999 }).shotCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list.find((x) => x.type === 'dragonfly'), start = e.pos.y;
    e.beamCd = 99;
    let low = 9;
    step(60 * 6, () => { low = Math.min(low, e.pos.y); });
    const above = +(e.pos.y - player.position.y).toFixed(2);
    return ok(start > 0.6 && above < 0.25 && low < 0.3, { start: +start.toFixed(2), end: +e.pos.y.toFixed(2), above, lowest: +low.toFixed(2) });
  },
});


act3('big-bug-kill-ring-is-small-and-tinted', {
  about: 'A big bug dying (a stag beetle, 9 cm round) leaves a ring on the floor at most 8 cm round in a soft blue, not a pure white one three times its size (28 cm) round the jelly.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(1.0, 0, 8.85, 0); spawn('beetle', near(0.25, 0), { still: true }); },
  play() {
    const { enemies, fx } = G(), e = enemies.list.find((x) => x.type === 'beetle'), rings = [];
    const ring = fx.ring.bind(fx); stub(fx, 'ring', (pos, color, radius, life) => { rings.push({ radius, color: new THREE.Color(color).getHexString() }); return ring(pos, color, radius, life); });
    bus.emit('damage_taken', { targetId: e.id, amount: 1e6, source: 'bubble' });
    step(2);
    const biggest = rings.reduce((a, b) => (b.radius > (a?.radius ?? 0) ? b : a), null);
    return ok(e.dead && biggest && biggest.radius <= 0.08 + 1e-9 && biggest.color !== 'ffffff', { dead: e.dead, rings });
  },
});
