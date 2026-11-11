import { buildLadybug, buildMissile } from '../critters.js';
import { ModelPool } from '../model-pool.js';
import * as THREE from 'three';
import { World } from '../collision.js';
import { hostile } from '../vfx.js';
import { Batcher } from '../batch.js';
import { G, V, act2, fresh, give, ok, roachAt, setupFight, spawn, step, story, stub } from './kit.js';

story('collision/scenery-grid-refreshes-before-focus-early-return', {
  about: 'A static apartment prop crossing cells is reindexed on the next focus tick even while the jelly stands still; newly loaded scenery joins immediately.',
  setup() {},
  play() {
    const group = new THREE.Group(), geo = new THREE.BoxGeometry(.02,.4,.3), mat = new THREE.MeshBasicMaterial();
    const wall = new THREE.Mesh(geo,mat); wall.position.set(-.7,.2,-.1); group.add(wall);
    const world = new World(group,{staticScene:true}), hit = {normal:V(),point:V()}, p=V(-1,.2,-.1), d=V(.5,0,0);
    world.focus(V(),1); const before=world.sweepSphere(p,d,.02,hit);
    wall.position.x=-1.7; wall.updateMatrixWorld(true); world.focus(V(),.001);
    const moved=world.sweepSphere(V(-2,.2,-.1),d,.02,hit), old=world.sweepSphere(p,d,.02,hit);
    const added=new THREE.Mesh(geo,mat); added.position.set(3,.2,0); group.add(added); world.addObjects([added]);
    const loaded=world.sweepSphere(V(2.7,.2,0),d,.02,hit);
    geo.dispose(); mat.dispose();
    return ok(before && moved && !old && loaded,{before,moved,old,loaded});
  },
});

story('collision/scenery-grid-matches-full-sweep', {
  about: 'The scenery grid matches the original all-collider sweep on long diagonals, negative cells and body edges, while rejecting distant scenery before triangle tests.',
  setup() {},
  play() {
    const group=new THREE.Group(), geo=new THREE.BoxGeometry(.04,.6,.4), mat=new THREE.MeshBasicMaterial();
    for(let x=-10;x<=10;x++) for(let z=-8;z<=8;z++) {
      const mesh=new THREE.Mesh(geo,mat); mesh.position.set(x*.7,.3,z*.7); group.add(mesh);
    }
    const world=new World(group,{staticScene:true}), hit={point:V(),normal:V()}, full=world.colliders.map((_,i)=>i);
    const query=world.sweepNearby, result=[]; let pruned=false;
    for(const [at,delta,r] of [[[-.33,.2,-.33],[.8,0,.7],.04],[[-2.2,.2,-2.2],[4.5,0,4.4],.08],[[.15,.2,.23],[-.6,0,0],.05],[[.15,1,.23],[0,-2,0],.05],[[-100,.2,-100],[200,0,200],.05]]) {
      const yes=world.sweepSphere(V(...at),V(...delta),r,hit), distance=hit.distance, normal=hit.normal.clone();
      pruned ||= world.sweepCandidates.length < full.length/4;
      world.sweepNearby=()=>full;
      const all=world.sweepSphere(V(...at),V(...delta),r,hit); world.sweepNearby=query;
      result.push(yes===all && (!yes || Math.abs(distance-hit.distance)<1e-7 && normal.distanceTo(hit.normal)<1e-7));
    }
    geo.dispose();mat.dispose();
    return ok(pruned && result.every(Boolean),{pruned,result,colliders:full.length});
  },
});

story('engine/elite-effect-pools-reuse-and-reset', {
  about: 'Warning meshes, volumes and hazard edges plateau after repeated clear/restart cycles, retaining their prepared materials and resetting all animated state.',
  setup() {fresh({bubbles:false,lash:false});},
  play() {
    const {run,APT}=G(), E=run.elites, e=E.list[0], at=e.base.clone(), scale=V(.1,.06,.1);
    let first, counts, reset=true, simultaneous=true, disposed=0;
    for(let i=0;i<6;i++) {
      const f=E.mark(e,E.flat,E.T.red,at,scale), other=E.mark(e,E.flat,E.T.red,at,scale);
      const vol=E.volume(hostile('controller'),'dome',at,.1);e.tele.push(vol);
      simultaneous &&= f!==other;
      reset &&= f.material.progress===0 && f.material.opacity===1 && f.rotation.order==='XYZ' && f.rotation.x===0 && vol.material.progress===0 && vol.material.opacity===1 && vol.rotation.z===0;
      if(!first) {first={f,vol}; f.material.addEventListener('dispose',()=>disposed++);vol.material.addEventListener('dispose',()=>disposed++);}
      else reset &&= f===first.f && vol===first.vol;
      f.material.progress=1;f.material.opacity=.1;f.rotation.order='YXZ';f.rotation.x=1;
      vol.material.progress=1;vol.material.opacity=.1;vol.rotation.z=1;
      E.puddle(at);E.slick(at);e.clearTele();E.clear();
      const now=[E.warningPool.length,E.volumePool.length,E.puddleMeshes.length,E.slickMeshes.length];
      if(!counts) counts=now;else reset &&= now.every((n,k)=>n===counts[k]);
    }
    return ok(reset && simultaneous && disposed===0 && first.f.material!==E.T.red,{reset,simultaneous,disposed,counts});
  },
});

act2('elite-balloon-and-wreath-pools', {
  about: 'A second simultaneous balloon/wreath gets its own mesh; detached copies are reused with fresh colors, glow, scale and rotation.',
  setup() {fresh({bubbles:false,lash:false});},
  play() {
    const E=G().run.elites, source=E.list.find(e=>e.kind==='clock').model.wreath;
    const a=E.balloon(0x9900ff);E.scene.add(a.group); const b=E.balloon(0xff0099);E.scene.add(b.group);
    const w=E.wreath(source);E.scene.add(w);const w2=E.wreath(source);E.scene.add(w2);
    a.group.scale.setScalar(9);a.group.rotation.x=9;a.mat.emissiveIntensity=8;
    a.group.removeFromParent();const again=E.balloon(0x6600ff);
    const yes=again===a && b!==a && w!==w2 && again.group.scale.x===1 && again.group.rotation.x===0 && again.mat.emissiveIntensity===.25 && again.mat.color.getHex()===0x6600ff;
    b.group.removeFromParent();w.removeFromParent();w2.removeFromParent();
    return ok(yes,{reused:again===a,balloons:E.balloonPool.length,wreaths:E.wreathPool.length});
  },
});

story('engine/batcher-releases-inactive-model-references', {
  about: 'A detached model leaves no stale mesh references in its batch while its reusable GPU buffers remain available.',
  setup() {},
  play() {
    const scene=new THREE.Scene(), b=new Batcher(scene), geo=new THREE.BoxGeometry(), mat=new THREE.MeshBasicMaterial();
    const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);b.track(mesh);b.sync();
    const g=b.group(geo,mat), gpu=g.mesh;mesh.removeFromParent();b.sync();
    const yes=g.list.length===0 && g.mesh===gpu && gpu.count===0 && !b.roots.has(mesh);
    gpu.dispose();geo.dispose();mat.dispose();
    return ok(yes,{references:g.list.length,reused:g.mesh===gpu});
  },
});

story('engine/story-randomness-is-scoped', {
  about: 'A story replays the same random sequence regardless of preceding stories, and restores the surrounding generator after success or failure.',
  setup() {},
  async play() {
    const {runStory,STORIES}=await import('../stories.js'), name='seed-probe', original=Math.random;
    try {
      STORIES[name]={setup(){},play(){return ok(true,{rolls:Array.from({length:8},()=>Math.random())});}};
      const a=await runStory(name,42), b=await runStory(name,43), c=await runStory(name,42);
      const same=JSON.stringify(a.info)===JSON.stringify(c.info), different=JSON.stringify(a.info)!==JSON.stringify(b.info);
      STORIES[name].setup=()=>{throw new Error('intentional seed probe');}; const failed=await runStory(name,42);
      return ok(same && different && !failed.ok && Math.random===original,{same,different,restored:Math.random===original});
    } finally {delete STORIES[name];}
  },
});

story('engine/loading-screen-says-each-step', {
  about: 'The loading screen stays up until Play works, steps through what it is doing with its bar only moving forward and the graphics step reaching the end, and its jelly swims on its own (a compositor animation).',
  setup() {},
  play() {
    const steps = window.JF_LOAD.steps, el = document.getElementById('loading'), fs = steps.map(([, f]) => f);
    const forward = fs.every((f, i) => !i || f >= fs[i - 1]);
    const graphics = steps.find(([t]) => t === 'Preparing the graphics…')?.[1] ?? 0;
    const swims = document.querySelector('#loading .jelly').getAnimations().length > 0;
    const play = document.querySelector('#g-over .play');
    return ok(el.classList.contains('gone') && !play.disabled && forward && graphics > 0.94 && steps.length >= 4 && swims, { steps, swims });
  },
});

story('engine/game-downloads-in-parallel', {
  about: 'The apartment comes down as its gzipped copy, and the game\'s modules (preloaded by index.html) are already on their way before that download finishes.',
  setup() {},
  play() {
    const res = performance.getEntriesByType('resource'), find = (re) => res.find((r) => re.test(r.name));
    const gz = find(/apartment-act1\.glb\.gz$/), plain = find(/apartment-act1\.glb$/), main = find(/\/src\/main\.js$/);
    const preloaded = document.querySelectorAll('link[rel=modulepreload]').length;
    return ok(gz && !plain && main && main.startTime < gz.responseEnd && preloaded > 50, { gz: !!gz, plain: !!plain, mainAt: main?.startTime, gzEnd: gz?.responseEnd, preloaded });
  },
});


story('engine/combat-pools-reset-and-preserve-identities', {
  about: 'Reused enemies retain fresh identities and clean model poses; bubbles reuse state without old targets, hit history, or rebound flags.',
  setup() { fresh({bubbles:false,lash:false,elites:false}); },
  play() {
    const {enemies:E,run}=G(), B=run.bubbles, at=V(0,.1,0);
    stub(E,'models',new ModelPool());
    const a=E.spawn('roach',at), root=a.root;let part;
    a.mesh.traverse(o=>{if(o.isMesh && !part)part=o;});const material=part.material;
    a.anim(1,a); root.rotation.z=2; part.material=E.fx.fireAshMat;
    E.kill(a,true);
    const b=E.spawn('roach',at);
    const identity=a!==b && a.dead && a.id!==b.id && b.root===root && b.root.rotation.z===0 && part.material===material && b.hp===b.maxHp;
    const shot=B.blow(at,b,{size:1,dmg:1,pierce:1});shot.hit.add(b);shot.returning=true;shot.done=true;
    B.reset();
    const next=B.blow(at,b,{size:1,dmg:1,pierce:1});
    const reset=next===shot && next.hit.size===0 && !next.returning && !next.done && next.target===b;
    return ok(identity && reset,{identity,reset});
  },
});

story('engine/combat-pools-wait-for-detached-fragments', {
  about: 'A death body or detached shell still in the scene cannot be reused; detached fragments return to their original parent and pose.',
  setup() {fresh({bubbles:false,lash:false,elites:false});},
  play() {
    const {enemies:E}=G(), at=V(0,.1,0), a=E.spawn('ladybug',at), part=a.deathParts[0], parent=part.parent;
    E.kill(a,true);E.scene.attach(part);
    const b=E.spawn('ladybug',at), held=b.root!==a.root;
    part.removeFromParent();part.scale.setScalar(.001);
    const c=E.spawn('ladybug',at), restored=c.root===a.root && part.parent===parent && part.scale.x===1;
    return ok(held && restored,{held,restored});
  },
});

story('engine/hostile-projectile-pools-reuse-after-clear', {
  about: 'Pins, webs and missiles reuse models across clears and restore scale, visibility and rotation.',
  setup(){fresh({bubbles:false,lash:false,elites:false});},
  play(){
    const E=G().enemies, at=V(0,.1,0), e=E.spawn('roach',at), p={speed:1,life:1,dmg:1,shot:'web'};
    E.spit(e,V(0,.1,1),p);const web=E.shots[0].m;web.scale.setScalar(5);E.clear();
    const next=E.spawn('roach',at);E.spit(next,V(0,.1,1),p);
    const reused=E.shots[0].m===web && web.scale.x===1;
    const lady=E.spawn('ladybug',at), config={fuel:1,rocket:1,turn:1,dmg:1};E.launchMissile(lady,config);
    const missile=E.missiles[0].m;missile.scale.setScalar(.001);E.clear();
    E.launchMissile(E.spawn('ladybug',at),config);
    const same=E.missiles[0].m===missile && missile.scale.x===1;
    E.boom(E.missiles[0],V(10,10,10),.01);E.missiles=[];
    E.launchMissile(E.spawn('ladybug',at),config);
    return ok(reused && same && E.missiles[0].m===missile,{web:reused,missile:same,explosion:E.missiles[0].m===missile});
  },
});


story('engine/combat-pools-retain-burning-death-ownership', {
  about: 'Burning corpses are claimed before another same-type spawn and remain owned across enemy clears.',
  setup(){fresh({bubbles:false,lash:false,elites:false});},
  play(){
    const {enemies:E,run,fx}=G(), B=run.bubbles, at=V(0,.1,0), a=E.spawn('roach',at);
    B.ignite(a,1);E.kill(a);
    const b=E.spawn('roach',at), held=b.root!==a.root;
    E.clear();const c=E.spawn('roach',at);fx.clear();
    const alive=c.root.parent===E.scene;
    B.effects(0,run.S);
    return ok(held && alive && c.root.parent===E.scene,{held,alive});
  },
});


story('engine/combat-pools-reuse-lash-and-trap-state', {
  about: 'Tentacles and traps reuse state without released flags or old hit history.',
  setup(){fresh({bubbles:false,lash:false,elites:false});},
  play(){
    const {enemies:E,run}=G(), at=V(0,.1,0), e=E.spawn('roach',at), L=run.lash;
    L.strike(at,e,1,{});const strike=L.strikes[0];strike.released=true;strike.landed=true;L.reset();L.strike(at,e,1,{});
    const lash=L.strikes[0]===strike && !strike.released && !strike.landed && strike.target===e;
    L.reset();give('marble','legoBrick');const g=run.gadgets, c={center:at,feet:at,facing:0,power:run.power,mods:run.mods};
    const effects=run.mods.timed.flatMap(t=>t.effects), marble=effects.find(e=>e.kind==='marble'), brick=effects.find(e=>e.kind==='brick');
    g.fire(marble,c);g.fire(brick,c);const mb=g.marbles[0], br=g.bricks[0];mb.hit.add(e);g.reset();
    const released=mb.hit.size===0;g.fire(marble,c);g.fire(brick,c);
    const traps=released && g.marbles[0]===mb && mb.hit.size===0 && mb.trailT===0 && g.bricks[0]===br && br.age===0;
    return ok(lash && traps,{lash,traps});
  },
});


story('engine/combat-pools-bound-retained-models', {
  about: 'An oversized wave still spawns every model but retains at most 128 per kind for reuse.',
  setup(){},
  play(){
    const pool=new ModelPool(), records=[];
    for(let i=0;i<130;i++)records.push(pool.take('test',()=>({root:new THREE.Group()})));
    const distinct=new Set(records.map(p=>p.root)).size===130;
    records.forEach(p=>pool.release(p));const reused=pool.take('test',()=>{throw new Error('expected reuse');});
    return ok(distinct && pool.entries.length===128 && reused===records[0],{distinct,retained:pool.entries.length});
  },
});

story('engine/ladybug-and-missile-batches-plateau', {
  about: 'Repeated ladybug spawns and missile launches reuse geometry and batches while their animated parts remain independent.',
  setup() {},
  play() {
    const scene = new THREE.Scene(), b = new Batcher(scene), counts = [];
    let independent = true, shared = true;
    const meshes = root => { const out = []; root.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
    try {
      for (let i = 0; i < 6; i++) {
        const a = buildLadybug(), other = buildLadybug(), shot = buildMissile(), loaded = buildMissile(1.25);
        const roots = [a.body, other.body, shot.group, loaded.group];
        const parts = meshes(a.body), peers = meshes(other.body);
        shared &&= parts.every((m, k) => m.geometry === peers[k].geometry && m !== peers[k]);
        other.body.updateMatrixWorld(true);
        const before = peers.map(m => m.matrixWorld.toArray());
        a.anim(0.1, { shellK: 1, flyK: 1, wingK: 1, phase: 0, state: 'aim' });
        other.body.updateMatrixWorld(true);
        independent &&= peers.every((m, k) => m.matrixWorld.toArray().every((n, j) => n === before[k][j]));
        shot.flame.visible = false;
        independent &&= loaded.flame.visible && shot.flame !== loaded.flame;
        roots.forEach(root => { root.traverse(o => { o.visible = true; }); scene.add(root); b.track(root); });
        b.sync();
        roots.forEach(root => root.removeFromParent()); b.sync();
        counts.push([...b.groups.values()].reduce((n, mats) => n + mats.size, 0));
        independent &&= b.roots.size === 0 && [...b.groups.values()].every(mats => [...mats.values()].every(g => g.list.length === 0 && g.mesh.count === 0));
      }
      return ok(shared && independent && counts.every(n => n === counts[0]), { shared, independent, counts });
    } finally {
      for (const mats of b.groups.values()) for (const g of mats.values()) g.mesh?.dispose();
    }
  },
});

story('engine/far-bugs-animate-at-half-rate', {
  about: 'A bug near the jelly and on screen animates every frame; one far away, or behind the camera, animates on alternate frames with both frames\' time, so its legs keep the same pace.',
  setup() { setupFight({ bubbles: false, lash: false, waves: false }); },
  play() {
    const { fx } = G(), cam = fx.camera;
    step(5);
    const behind = cam.position.clone().addScaledVector(cam.getWorldDirection(V()), -0.25).setY(G().player.position.y);
    const bugs = { near: roachAt(0.15, 0), far: roachAt(2.2, 0), behind: spawn('roach', behind, { still: true, hp: 9999 }) };
    const seen = {};
    for (const [k, e] of Object.entries(bugs)) { const a = e.anim; seen[k] = { calls: 0, t: 0 }; e.anim = (dt, x) => { seen[k].calls++; seen[k].t += dt; a(dt, x); }; }
    step(20);
    const half = (s) => s.calls >= 9 && s.calls <= 11 && Math.abs(s.t - 20 / 60) < 1.5 / 60;
    return ok(seen.near.calls === 20 && half(seen.far) && half(seen.behind), seen);
  },
});

story('engine/crowd-hits-keep-their-flash', {
  about: 'Past --fx-hits-per-frame hit effects in one frame, the rest keep only their flash (no sparks, no ring); the next frame has the full budget again.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() {
    const { fx } = G(), budget = fx.hitBudget, at = G().player.position.clone();
    fx.update(0);
    const glow0 = fx.glow.parts.length, rings0 = fx.rings.filter((r) => r.alive).length;
    for (let i = 0; i < budget + 4; i++) fx.impact(at, 0x9fe8ff, 0.02, 10);
    const glow = fx.glow.parts.length - glow0, rings = fx.rings.filter((r) => r.alive).length - rings0;
    fx.update(0);
    const g1 = fx.glow.parts.length; fx.impact(at, 0x9fe8ff, 0.02, 10);
    const fullAgain = fx.glow.parts.length - g1 === 11;
    return ok(glow === budget * 11 + 4 && rings === budget && fullAgain, { budget, glow, rings, fullAgain });
  },
});
