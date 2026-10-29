import * as THREE from 'three';
import { World } from '../collision.js';
import { hostile } from '../vfx.js';
import { Batcher } from '../batch.js';
import { G, V, act2, fresh, ok, story } from './kit.js';

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
