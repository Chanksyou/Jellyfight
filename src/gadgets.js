// The treasure effects that act on their own: timed effects (an `every N { … }` block of ring,
// zap, brick, marble, xp) and always-on ones (orbit-lights, beam, aura). Which ones run,
// and their numbers, come from the run's combined treasure effects (mods; see words.js and
// content/treasures.kdl): nothing here knows a treasure by name.
import * as THREE from 'three';
import { bus } from './events.js';
import { LOOK } from './look.js';
import { GadgetLooks } from './gadget-looks.js';
import { sfx } from './sfx.js';
import { juice } from './juice.js';
import { batcher } from './batch.js';
import { knockFor } from './stats.js';

const _to = new THREE.Vector3(), _cone = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Gadgets {
  constructor(scene, enemies, fx, world) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = fx;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'Gadgets';
    scene.add(this.group);
    batcher.track(this.group);
    this.looks = new GadgetLooks(fx);
    this.brickPool = []; this.marblePool = [];

    const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });
    // Fairy Lights: three warm bulbs that circle you
    this.bulbs = [0xffd27a, 0xff9ad8, 0x9fe2ff, 0xffd27a, 0xff9ad8, 0x9fe2ff].map((c) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), glow(c, 2.4));
      const core=new THREE.Mesh(new THREE.SphereGeometry(.0022,8,6),new THREE.MeshBasicMaterial({color:0xe8ffff}));m.add(core);
      m.visible = false;
      this.group.add(m);
      return m;
    });
    // Magnifying Glass: a beam of focused moonlight on its target
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.012, 0.5, 12, 1, true).translate(0, 0.25, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.beam.visible = false;
    this.group.add(this.beam);
    const focusColor=LOOK.color('gadget-focus','#c6f6ff');
    this.beam.material.color.set(focusColor);
    const focusMat=new THREE.MeshBasicMaterial({color:focusColor,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});
    this.focus=new THREE.Group();
    this.focusRing=new THREE.Mesh(new THREE.RingGeometry(.8,1,32).rotateX(-Math.PI/2),focusMat);
    this.focusCore=new THREE.Mesh(new THREE.CircleGeometry(1,24).rotateX(-Math.PI/2),focusMat);
    this.focus.add(this.focusRing,this.focusCore);this.group.add(this.focus);this.focus.visible=false;
    this.chordReady=new THREE.Mesh(this.looks.geo.arc,focusMat);this.group.add(this.chordReady);this.chordReady.visible=false;
    this.bathReady=new THREE.Group();this.group.add(this.bathReady);
    const beadGeo=new THREE.SphereGeometry(LOOK.num('gadget-bath-bead',.003),10,6);
    for(let i=0;i<8;i++)this.bathReady.add(new THREE.Mesh(beadGeo,focusMat));
    this.mirrorReady=new THREE.Mesh(new THREE.TorusGeometry(LOOK.num('gadget-mirror-radius',.035),.0008,4,32,Math.PI*1.35),focusMat);
    this.mirrorSheen=new THREE.Mesh(this.mirrorReady.geometry,focusMat);
    this.group.add(this.mirrorReady,this.mirrorSheen);
    // Hand Mirror: shards of mirror circle you while it's ready; a faceted mirror shell holds while it's active
    const silver=LOOK.color('gadget-silver','#d3eaff');
    const shardMat=new THREE.MeshBasicMaterial({color:silver,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const shardGeo=new THREE.OctahedronGeometry(LOOK.num('gadget-mirror-shard',.0045)).scale(1,1.6,.35);
    this.mirrorShards=new THREE.Group();
    for(let i=0;i<6;i++)this.mirrorShards.add(new THREE.Mesh(shardGeo,shardMat));
    this.mirrorShell=new THREE.Group();
    this.mirrorShell.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:silver,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})),
      new THREE.Mesh(new THREE.IcosahedronGeometry(1.01,1),new THREE.MeshBasicMaterial({color:silver,wireframe:true,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})));
    this.group.add(this.mirrorShards,this.mirrorShell);this.mirrorPop=0;
    // Glow Stick: a green glow on the floor around you
    this.aura = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x6aff8a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.auraLip=new THREE.Mesh(this.looks.geo.arc,focusMat);this.aura.add(this.auraLip);this.auraLip.scale.setScalar(.99);
    this.aura.visible = false;
    this.group.add(this.aura);
    // Lego bricks and marbles
    this.brickGeo = new THREE.BoxGeometry(0.02, 0.012, 0.01).translate(0, 0.006, 0);
    this.studGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.003, 10).translate(0, 0.0135, 0);
    this.brickMats = [0xd8342a, 0x2a6ad8, 0xf2c81a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
    const mc = LOOK.color('marble', '#6affd2');   // bright and glowing, so it reads against any floor
    this.marbleMat = new THREE.MeshPhysicalMaterial({ color: mc, roughness: 0.05, clearcoat: 1, emissive: mc, emissiveIntensity: 0.9 });
    this.marbleGeo = new THREE.SphereGeometry(0.007, 16, 12);
    this.swirlGeo = new THREE.TorusGeometry(.0067,.00065,5,24,Math.PI*1.6);
    this.swirlMat = new THREE.MeshBasicMaterial({color:LOOK.color('gadget-marble-swirl','#247e90')});
    // Cat Toy Mouse: a little grey wind-up mouse with pink ears, a tail and a brass key
    const grey = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.8 }), pink = new THREE.MeshStandardMaterial({ color: 0xf2a0b0, roughness: 0.6 });
    grey.emissive.set(LOOK.color('gadget-mouse-rim','#386d79'));grey.emissiveIntensity=.3;
    const brass = new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.3, metalness: 0.6 });
    const mouse = this.mouse = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.008, 14, 10), grey); body.scale.set(0.8, 0.7, 1.3); body.position.y = 0.006; mouse.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 6), pink); nose.position.set(0, 0.006, 0.0105); mouse.add(nose);
    for (const x of [-0.0045, 0.0045]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(0.003, 12), pink); ear.position.set(x, 0.0115, 0.004); mouse.add(ear); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0004, 0.014, 6).rotateX(Math.PI / 2), pink); tail.position.set(0, 0.004, -0.017); mouse.add(tail);
    this.mouseBody=body;this.mouseNose=nose;this.mouseTail=tail;
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.0025, 0.0007, 6, 12), brass); key.position.set(0, 0.0135, -0.003); mouse.add(key);
    this.mouseKey = key;
    this.mouseReady=key.clone();this.mouseReady.visible=false;this.group.add(this.mouseReady);
    mouse.visible = false;
    this.group.add(mouse);
    this.reset();
  }

  reset() {
    this.warming=false;
    this.bathReady.visible=this.mirrorReady.visible=this.mirrorSheen.visible=this.mirrorShards.visible=this.mirrorShell.visible=false;this.mirrorPop=0;this.steamOn=false;
    this.looks.reset();
    this.focus.visible=this.chordReady.visible=false;this.focusTarget=null;this.focusAge=this.focusKick=this.mouseAfter=0;
    this.t = {};
    this.clouds = []; this.whirls = []; this.heals = new Map(); this.clock = 0;
    for (const b of this.bricks || []) this.group.remove(b.m);
    for (const m of this.marbles || []) { this.group.remove(m.m); m.hit.clear(); }
    for (const o of this.orbs || []) this.fx.free(o.m);
    this.bricks = [];
    this.marbles = [];
    this.orbs = [];                  // balls of lightning drifting about (the orb word)
    this.orbit = 0;
    this.mouseRun = null;
    this.mouse.visible = false;
    this.mouseReady.visible=false;
    this.bulbs.forEach((b) => { b.visible = false; });
    this.beam.visible = this.aura.visible = false;
  }

  // Show everything for a frame so its shaders get compiled up front (main.js warmUp)
  warm(on, at) {
    this.warming=on;
    this.looks.warm(on,at);
    this.focus.visible=this.chordReady.visible=on;
    this.mouseReady.visible=on;
    for(const m of [this.bathReady,this.mirrorReady,this.mirrorSheen,this.mirrorShards,this.mirrorShell]){m.visible=on;if(on)m.position.copy(at);}
    this.bulbs.forEach((b) => { b.visible = on; });
    this.beam.visible = this.aura.visible = this.mouse.visible = on;
    if (on) {
      this.mouse.position.copy(at);
      this.bulbs.forEach((b) => b.position.copy(at));
      this.beam.position.copy(at);
      this.aura.position.copy(at);
      this.focus.position.copy(at);this.chordReady.position.copy(at);
      this.mouseReady.position.copy(at);
      const brick=this.brickMesh(),marble=this.marbleMesh();
      brick.position.copy(at);marble.position.copy(at);this.group.add(brick,marble);
      this._warm = [this.brickMats.map((m) => new THREE.Mesh(this.brickGeo, m)), new THREE.Mesh(this.marbleGeo, this.marbleMat),
        brick,marble].flat();
      this._warm.forEach((m) => { m.position.copy(at); this.group.add(m); });
    } else {
      (this._warm || []).forEach((m) => this.group.remove(m));
    }
  }

  mirrorState(at,ready,active,dt=1/60){
    this.mirrorReady.visible=!!ready&&!active;this.mirrorSheen.visible=!!active;
    this.mirrorReady.position.copy(at);this.mirrorSheen.position.copy(at);
    this.mirrorReady.rotation.set(.35,this.looks.quiet?0:this.orbit||0,.4);
    this.mirrorSheen.rotation.set(-.35,-(this.looks.quiet?0:this.orbit||0),-.4);
    // ready: six shards circle you, a glint running round them; active: the shell, popping in, the shards spinning on it
    const o=this.looks.quiet?0:this.orbit||0,R=LOOK.num('gadget-mirror-orbit',.05),shell=LOOK.num('gadget-mirror-shell',.055);
    this.mirrorShards.visible=!!ready||!!active;this.mirrorShell.visible=!!active;
    this.mirrorShards.position.copy(at);this.mirrorShell.position.copy(at);
    this.mirrorShards.children.forEach((m,i)=>{
      const a=(active?o*2.5:o*.6)+i/6*Math.PI*2,r=active?shell:R,glint=Math.max(0,Math.cos(o*1.4-i/6*Math.PI*2));
      m.position.set(Math.cos(a)*r,(active?0:.006)*Math.sin(o*2+i),Math.sin(a)*r);m.rotation.set(0,-a,0);
      m.scale.setScalar(active?1.2:1+glint**8*.8);
    });
    if(active){
      this.mirrorPop=Math.max(0,this.mirrorPop-dt);const u=this.mirrorPop/.15;   // 0.15 s pop: in big, settles
      this.mirrorShell.scale.setScalar(shell*(1+.35*u*u));this.mirrorShell.rotation.y=o*.8;
      this.mirrorShell.children[0].material.opacity=.14+.25*u;
    }
  }

  // Hand Mirror going off: a flash, mirror splinters thrown out and a ring to the shockwave's edge
  mirrorBurst(at,feet,radius){
    this.mirrorPop=.15;
    this.looks.contact(at,this.looks.silver,.04);this.fx.impact(at,this.looks.silver.getHex(),.03,12);
    if(radius){this.fx.ring(feet.clone().setY(feet.y+.004),this.looks.silver.getHex(),radius,.45);this.looks.arc(feet.clone().setY(feet.y+.006),radius*.7,this.looks.silver,.3);}
    this.looks.salt(at,.05);this.looks.salt(at,.03);
    if(!this.looks.quiet)juice.feel('impact');
  }

  brickMesh() {
    let g=this.brickPool.find(g=>!g.parent);
    if(g)return g;
    g=new THREE.Group();const body=new THREE.Group();g.add(body);g.userData.body=body;
    const mat=this.brickMats[this.brickPool.length%this.brickMats.length];
    body.add(new THREE.Mesh(this.brickGeo,mat));
    for(const x of [-.005,.005]){const stud=new THREE.Mesh(this.studGeo,mat);stud.position.x=x;body.add(stud);}
    this.brickPool.push(g);return g;
  }

  marbleMesh() {
    let g=this.marblePool.find(g=>!g.parent);
    if(g)return g;
    g=new THREE.Group();g.add(new THREE.Mesh(this.marbleGeo,this.marbleMat));
    for(const a of [0,Math.PI/2]){const s=new THREE.Mesh(this.swirlGeo,this.swirlMat);s.rotation.set(a,.4,a);g.add(s);}
    this.marblePool.push(g);return g;
  }

  every(id, dt, period, first = period * 0.6) {
    this.t[id] = (this.t[id] ?? first) - dt;
    if (this.t[id] > 0) return false;
    this.t[id] += period;
    return true;
  }

  near(center, radius, { proxies = true } = {}) {
    const E = this.enemies, out = [], c = new THREE.Vector3();
    for (const e of E.list) {
      if (e.dead || (!proxies && e.proxy) || e.proxy?.immune) continue;
      const d = E.center(e, c).distanceTo(center) - e.r;
      if (d <= radius) out.push([d, e]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  // Uses the ordinary Fx clock, including when combat stops for menus or a boss ceremony.
  animate(dt, active = true) {
    if(this.warming)return;   // loader animations must not expire the meshes before compilation finishes
    this.looks.update(dt);
    this.mouseAfter=Math.max(0,this.mouseAfter-dt);
    if(!active){this.bathReady.visible=this.mirrorReady.visible=this.mirrorSheen.visible=this.mirrorShards.visible=this.mirrorShell.visible=false;this.focus.visible=this.chordReady.visible=this.mouseReady.visible=this.mouse.visible=this.beam.visible=false;return;}
    if(!this.mouseRun&&this.mouseAfter>0){
      const k=this.mouseAfter/LOOK.num('gadget-mouse-after',.24),z=this.mouseSize||1;
      this.mouse.scale.set(z*(1+.2*k),z*(1-.35*k),z*(1-.2*k));this.mouseNose.scale.set(1,1,.5);this.mouse.visible=true;
      if(!this.looks.quiet)this.mouse.position.addScaledVector(_to.set(Math.sin(this.mouse.rotation.y),0,Math.cos(this.mouse.rotation.y)),dt*.025);
    }else if(!this.mouseRun)this.mouse.visible=false;
  }

  // ctx: { mods, feet: Vector3, center: Vector3, facing, power (your bubbles' power), dropXp(xp) }
  update(dt, ctx) {
    const { mods: M, feet, center, power } = ctx;
    const E = this.enemies, fx = this.fx;
    this.clock = (this.clock || 0) + dt;
    this.tickClouds(dt);
    this.tickWhirls(dt);
    this.chordReady.visible=this.bathReady.visible=false;
    this.mirrorState(center,!!M.reflect&&ctx.mirrorReady,!!M.reflect&&ctx.mirrorActive,dt);

    // a low-health boost (while "low-health"): steam pours off you while it holds, a burst of it as it starts
    if(ctx.steaming&&!this.steamOn){this.looks.steam(center,true);sfx.gadgetFizz();ctx.pulse?.(.35);}
    this.steamOn=!!ctx.steaming;
    if(this.steamOn&&(this.steamT=(this.steamT??0)-dt)<=0){this.steamT=LOOK.num('gadget-steam-gap',.12);this.looks.steam(center);}

    // timed effects: every N s, do what's in the block
    for (const T of M.timed) {
      if (this.every(T.key, dt, T.every, T.first)) for (const ef of T.effects) this.fire(ef, ctx);
      else for(const ef of T.effects) {
        if(ef.kind==='bubble-ring'&&this.t[T.key]<LOOK.num('gadget-bath-prepare',.3)){
          this.bathReady.visible=true;this.bathReady.position.copy(center);
          const r=.026+.018*this.t[T.key]/LOOK.num('gadget-bath-prepare',.3);
          this.bathReady.children.forEach((m,i)=>{const a=i/8*Math.PI*2;m.position.set(Math.cos(a)*r,0,Math.sin(a)*r);});
        }
        if(ef.kind==='orb'&&this.t[T.key]<LOOK.num('gadget-orb-prepare',.4))this.bubbles?.looks.gather('lightning',center,1-this.t[T.key]/LOOK.num('gadget-orb-prepare',.4),1);   // static gathering at the bell
        if(ef.kind==='cone'&&this.t[T.key]<LOOK.num('gadget-cone-prepare',.35))this.bubbles?.looks.gather('fire',center,1-this.t[T.key]/LOOK.num('gadget-cone-prepare',.35),1);   // flame gathering at the bell
        if(ef.look==='puff'&&this.t[T.key]<LOOK.num('gadget-fizz-prepare',.3)){this.chordReady.visible=true;this.chordReady.position.copy(center);this.chordReady.scale.setScalar(.022);}
        if(ef.look==='chord'&&this.t[T.key]<LOOK.num('gadget-chord-prepare',.25)) {
          this.chordReady.visible=true;this.chordReady.position.copy(feet).y+=.004;
          this.chordReady.scale.setScalar(ef.radius*(.25+.35*(1-this.t[T.key]/LOOK.num('gadget-chord-prepare',.25))));
        }
      }
    }

    // orbit-lights: bulbs circle you and sting whatever they brush
    const O = M.orbit, n = O ? Math.min(O.count, this.bulbs.length) : 0;
    this.orbit += dt * 3.2;
    this.bulbs.forEach((b, i) => {
      b.visible = i < n;
      if (i >= n) return;
      const a = this.orbit + (i / n) * Math.PI * 2;
      b.position.set(center.x + Math.cos(a) * O.radius, center.y + Math.sin(this.orbit * 2 + i) * 0.006, center.z + Math.sin(a) * O.radius);
      for (const e of this.near(b.position, 0.008)) {
        if ((e.fairyT || 0) > 0) continue;
        e.fairyT = 0.4;
        this.looks.contact(E.center(e),this.looks.color,.007);sfx.gadgetFairy();ctx.pulse?.(.06);
        bus.emit('damage_taken', { targetId: e.id, amount: power * O.dmg, color: '#ffe7a8', source: 'orbit-lights' });
      }
    });
    if (n) for (const e of E.list) if (e.fairyT > 0) e.fairyT -= dt;

    // beam: focused moonlight burns the nearest enemy
    this.beam.visible = false;
    this.focus.visible=false;this.focusKick=Math.max(0,this.focusKick-dt*8);
    const Bm = M.beam;
    if (Bm) {
      const e = this.near(center, Bm.range)[0];
      if (e) {
        const c = E.center(e);
        if(this.focusTarget!==e){this.focusTarget=e;this.focusAge=0;sfx.gadgetFocus(true);}
        this.focusAge+=dt;
        this.focus.visible=true;this.focus.position.copy(c).y+=e.r*.55;
        const r=Math.max(.006,e.r*.7),settle=Math.exp(-this.focusAge*12);
        this.focusRing.scale.setScalar(r*(1+settle*.7-this.focusKick*.2));
        this.focusCore.scale.setScalar(r*(.24+this.focusKick*.14));
        this.beam.visible = true;
        this.beam.position.copy(c).setY(c.y - e.r * 0.5);
        this.beam.scale.y=LOOK.num('gadget-focus-height',.22)/.5;
        this.beam.material.opacity = LOOK.num('gadget-focus-opacity',.12) + .02*Math.sin(this.orbit*3);
        if (this.every('beam', dt, Bm.tick)) {
          this.focusKick=1;sfx.gadgetFocus();ctx.pulse?.(.08);
          bus.emit('damage_taken', { targetId: e.id, amount: power * Bm.dmg, color: '#ffd27a', source: 'beam', feedback:{tick:true} });
          fx.impact(c, 0xfff0a0, Math.max(0.006, e.r * 0.7), 4);   // every burn shows where it lands
          if (Math.random() < 0.4) fx.puff(c, 0x8a8078, 0.006, 0.4);
        }
      }
    }
    if(!this.focus.visible){this.focusTarget=null;this.focusAge=0;}

    // aura: a soft glow around you that stings anything inside it
    const A = M.aura;
    this.aura.visible = !!A;
    if (A) {
      this.aura.position.copy(feet).setY(feet.y + 0.002);
      this.aura.scale.setScalar(A.radius);
      if (this.every('aura', dt, A.tick)) {this.looks.arc(feet.clone().setY(feet.y+.003),A.radius,this.looks.color,.18);for (const e of this.near(center, A.radius)) {this.looks.contact(E.center(e),this.looks.color,.005);sfx.gadgetAura();bus.emit('damage_taken', { targetId: e.id, amount: power * A.dmg, color: '#8aff9f', source: 'aura' });}}
    }

    // touch-sting (Lion's Mane): whatever touches you gets stung
    const Tc = M.touch;
    if (Tc && this.every('touch', dt, Tc.every)) for (const e of this.near(center, (ctx.radius || 0.03) + Tc.reach)) {
      bus.emit('damage_taken', { targetId: e.id, amount: power * Tc.dmg, color: '#ffc8e6', source: 'touch' });
      fx.puff(E.center(e), 0xffc2e6, 0.006, 0.2);
    }

    // touch-zap (Static Skin): a bug touching you is zapped and Stunned, once every `each` s per bug
    const Tz = M.touchZap;
    if (Tz && this.every('touchZap', dt, 0.1)) for (const e of this.near(center, (ctx.radius || 0.03) + Tz.reach)) {
      if (this.clock < (e.zappedAt ?? -1e9) + Tz.each) continue;
      e.zappedAt = this.clock;
      this.bubbles?.zap(center, E.center(e), 0);
      bus.emit('damage_taken', { targetId: e.id, amount: power * Tz.dmg, color: '#fff27a', source: 'touch' });
      bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: Tz.stun });
      ctx.pulse?.(0.2);
    }

    // orb (Ball Lightning): each ball drifts on, zapping every bug it passes once
    for (const o of this.orbs) {
      o.t -= dt;
      const step = o.speed * dt;
      if (this.world.cast(o.m.position, o.dir, step + 0.004)) o.t = 0;
      o.m.position.addScaledVector(o.dir, step);
      this.fx.orbTick(o.m, dt);
      for (const e of this.near(o.m.position, o.radius)) {
        if (o.hit.has(e)) continue;
        o.hit.add(e);
        this.bubbles?.zap(o.m.position, E.center(e), o.hit.size - 1);
        fx.splat(_to.set(e.pos.x, E.floorBelow(e.pos, e.pos.y), e.pos.z), LOOK.color('lightning-scorch', '#2a2620'), 0.008, 'scorch');   // a scorch under it (harmless, fades)
        bus.emit('damage_taken', { targetId: e.id, amount: power * o.dmg, color: '#fff27a', source: 'lightning' });
      }
      if (o.t <= 0) { fx.impact(o.m.position, o.m.userData.orb.c, 0.012, 6); sfx.elementHit('lightning'); fx.free(o.m); o.hit.clear(); }
    }
    this.orbs = this.orbs.filter((o) => o.t > 0);

    // toy-mouse: now and then it scurries to the nearest enemy and slams into it
    const Mo = M.mouse;
    this.mouseReady.visible=false;
    if(Mo&&!this.mouseRun&&(this.t.mouse??Mo.every*.6)>0&&(this.t.mouse??Mo.every*.6)<LOOK.num('gadget-mouse-prepare',.25)){
      this.mouseReady.visible=true;this.mouseReady.position.copy(center).y+=.035;
      if(!this.looks.quiet)this.mouseReady.rotation.z+=dt*18;
      ctx.pulse?.(.08);
    }
    if (!Mo) { this.mouse.visible = false; this.mouseRun = null; }
    else {
      if (!this.mouseRun && this.every('mouse', dt, Mo.every)) {
        const prey = this.near(center, 1.2, { proxies: false })[0];
        if (prey) {
          this.mouseRun = { prey, t: 0 };
          const a = Math.random() * Math.PI * 2;
          this.mouse.position.set(feet.x + Math.cos(a) * 0.06, feet.y, feet.z + Math.sin(a) * 0.06);   // it winds up beside you
          this.mouse.visible = true;
          this.mouseSize = Mo.size; this.mouse.scale.setScalar(Mo.size);this.mouseNose.scale.setScalar(1);this.mouse.rotation.set(0,0,0);
          this.mouseAfter=0;sfx.gadgetMouse('wind');ctx.pulse?.(.2);
        }
      }
      const run = this.mouseRun;
      if (run) {
        this.mouse.visible=true;
        run.t += dt;
        if (run.prey?.dead) run.prey = this.near(this.mouse.position, 0.6, { proxies: false })[0] || null;
        const to = run.prey ? _to.copy(run.prey.pos) : null;
        if (!to || run.t > 4) { this.mouseRun = null; this.mouse.visible = false; }
        else {
          const m = this.mouse.position, d = Math.hypot(to.x - m.x, to.z - m.z), step = Math.min(d, Mo.speed * dt);
          if (d > 1e-6) { m.x += (to.x - m.x) / d * step; m.z += (to.z - m.z) / d * step; this.mouse.rotation.y = Math.atan2(to.x - m.x, to.z - m.z); }
          m.y += (to.y - m.y) * Math.min(1, dt * 10);
          this.mouseKey.rotation.z += dt * 18;                    // the key winds down as it runs
          const scurry=this.looks.quiet?0:Math.sin(run.t*LOOK.num('gadget-mouse-scurry',50));
          this.mouse.rotation.z=scurry*.09;this.mouseBody.position.y=.006+Math.abs(scurry)*.0015;
          if(Mo.splash&&!this.looks.quiet&&(this.mouseDust=(this.mouseDust??0)-dt)<=0){this.mouseDust=.09;fx.puff(m.clone().setY(m.y+.003),0xd8d0c8,.004*Mo.size,.4);}   // a big mouse kicks up dust
          this.mouseTail.rotation.y=scurry*.28;
          if(Math.floor(run.t*5)!==Math.floor((run.t-dt)*5))sfx.gadgetMouse('run');
          if (d < 0.012 * Mo.size + run.prey.r) {
            fx.puff(m.clone().setY(m.y + 0.008), 0xd8d0c8, 0.02 * Mo.size, 0.3);
            // the slam: the prey, and with splash everything close to the mouse
            const hit = Mo.splash ? this.near(m, Mo.splash, { proxies: false }) : [run.prey];
            if (!hit.includes(run.prey)) hit.push(run.prey);
            for (const e of hit) {
              bus.emit('damage_taken', { targetId: e.id, amount: power * Mo.dmg, color: '#ffe7a8', source: 'toy-mouse' });
              if (Mo.push) bus.emit('knockback', { targetId: e.id, dir: e.pos.clone().sub(m).setY(0).normalize(), force: Mo.push });
              this.looks.contact(E.center(e),this.looks.color,Math.max(.012,e.r*.7));
            }
            this.looks.spring(m);
            if (Mo.splash) { fx.ring(m.clone().setY(m.y + 0.004), this.looks.color.getHex(), Mo.splash, 0.45); this.looks.studs(m.clone().setY(m.y + 0.01), this.looks.color, 8); }
            this.looks.arc(m,.025*Mo.size,this.looks.color,.22);sfx.gadgetMouse(Mo.splash?'slam':'hit');if(!this.looks.quiet)juice.feel(Mo.splash?'impact':'hit-big');ctx.pulse?.(.35);
            this.mouse.scale.set(1.2*Mo.size,.65*Mo.size,.8*Mo.size);this.mouseNose.scale.set(1,1,.5);
            this.mouseRun = null; this.mouseAfter=LOOK.num('gadget-mouse-after',.24);
          }
        }
      }
    }

    // bricks on the floor: the first walking enemy to step on one takes the hit
    for (const b of this.bricks) {
      b.t -= dt;
      b.age+=dt;const body=b.m.userData.body;
      const drop=LOOK.num('gadget-brick-drop',.16),u=Math.min(1,b.age/drop);
      body.position.y=this.looks.quiet?0:LOOK.num('gadget-brick-lift',.02)*(1-u)*(1-u)+Math.sin(Math.max(0,u-.65)/.35*Math.PI)*.002;
      body.rotation.z=this.looks.quiet?0:(1-u)*.1;
      body.scale.set(1,this.looks.quiet?1:1+.035*Math.sin(b.age*3),1);
      const hit = this.near(b.m.position, 0.012 * b.size, { proxies: false }).find((e) => !e.T.fly);
      if (hit) {
        const hurt = b.burst ? this.near(b.m.position, b.burst, { proxies: false }) : [hit];
        for (const e of hurt) bus.emit('damage_taken', { targetId: e.id, amount: power * b.dmg, color: '#ff8a6a', source: 'brick' });
        fx.puff(b.m.position, this.looks.color.getHex(), 0.02 * b.size, 0.3);
        if (b.burst) this.looks.arc(b.m.position.clone().setY(b.m.position.y + 0.003), b.burst, this.looks.color, .35);
        this.looks.studs(b.m.position,this.looks.color);sfx.gadgetBrick(true);ctx.pulse?.(.2);
        for(const e of hurt)this.looks.contact(E.center(e),this.looks.color,.009);
        b.t = 0;
      }
      if (b.t <= 0) this.group.remove(b.m);
    }
    this.bricks = this.bricks.filter((b) => b.t > 0);

    // marbles rolling: bounce off walls, bowl through enemies
    for (const mb of this.marbles) {
      mb.t -= dt;
      const step = mb.speed * dt;
      const R = 0.007 * mb.size, wall = this.world.cast(mb.m.position, mb.dir, step + R);
      if (wall) {
        const nrm = wall.normal.clone().setY(0).normalize(); mb.dir.addScaledVector(nrm, -2 * mb.dir.dot(nrm)).normalize();
        this.looks.contact(wall.point||mb.m.position,this.looks.color,R*.5);sfx.gadgetMarble('wall');
      }
      const previous=_to.copy(mb.m.position);
      mb.m.position.addScaledVector(mb.dir, step);
      mb.m.rotateOnAxis(new THREE.Vector3(mb.dir.z, 0, -mb.dir.x), step / R);
      mb.trailT-=dt;
      if(mb.trailT<=0){mb.trailT=LOOK.num('gadget-marble-trail-gap',.045);
        if(!this.looks.quiet)this.looks.streak(mb.trailAt,mb.m.position,this.looks.color,LOOK.num('gadget-marble-trail-width',.0014),.2);
        mb.trailAt.copy(mb.m.position);sfx.gadgetMarble('roll');}
      for (const e of this.near(mb.m.position, R + 0.001)) {
        if (mb.hit.has(e)) continue;
        mb.hit.add(e);
        bus.emit('damage_taken', { targetId: e.id, amount: power * mb.dmg, color: '#9fd8ff', source: 'marble' });
        const at=E.center(e);this.looks.contact(at,this.looks.color,R*.6);
        this.looks.streak(previous,at,this.looks.color,.002,.15);sfx.gadgetMarble('hit');ctx.pulse?.(.15);
      }
      if (mb.t <= 0) { this.group.remove(mb.m); mb.hit.clear(); }
    }
    this.marbles = this.marbles.filter((mb) => mb.t > 0);
  }

  // one timed effect going off (TIMED_WORDS in words.js)
  fire(ef, ctx) {
    const { feet, center, power } = ctx;
    const E = this.enemies, fx = this.fx;
    if (ef.kind === 'ring') {
      const col = new THREE.Color(ef.color);
      if (ef.look === 'puff') {this.looks.fizzBurst(feet.clone().setY(feet.y+.004),ef.radius);sfx.gadgetFizz();ctx.pulse?.(.25);}
      else if(ef.look==='chord'){
        for(let i=0;i<3;i++)this.looks.arc(feet.clone().setY(feet.y+.004+i*.002),ef.radius*(1-i*.035),col,ef.show);
        sfx.gadgetChord();ctx.pulse?.(.3);
      }else if(ef.look==='needles'){
        this.looks.arc(feet.clone().setY(feet.y+.004),.025,col,.18);sfx.gadgetNeedles();ctx.pulse?.(.25);
      }
      else fx.ring(feet.clone().setY(feet.y + 0.004), col.getHex(), ef.radius, ef.show);
      for (const e of this.near(center, ef.radius, { proxies: ef.elites })) {
        if(ef.look==='chord'||ef.look==='needles'||ef.look==='puff'){
          const at=E.center(e);
          this.looks.contact(at,col,Math.max(.006,e.r*.6));
          if(ef.look==='needles')this.looks.streak(center,at,col,LOOK.num('gadget-needle-width',.0013),LOOK.num('gadget-needle-life',.16),'needle');
          else this.looks.streak(at.clone().add(new THREE.Vector3(-.009,.004,0)),at.clone().add(new THREE.Vector3(.009,.004,0)),col,.001,.18);
        }
        if (ef.dmg) bus.emit('damage_taken', { targetId: e.id, amount: power * ef.dmg, color: ef.color, source: 'ring' });
        if (ef.push) bus.emit('knockback', { targetId: e.id, dir: e.pos.clone().sub(feet).setY(0).normalize(), force: ef.push });
        if (ef.freeze) bus.emit('status_applied', { targetId: e.id, status: 'freeze', duration: ef.freeze });
        if (ef.slow) bus.emit('status_applied', { targetId: e.id, status: 'slow', duration: ef.slow });
        if (ef.chill) bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: ef.chill });
      }
    } else if (ef.kind === 'zap') {
      const hp = (e) => (e.proxy ? 1e9 : e.hp), found = this.near(center, ef.range);
      if (ef.target === 'toughest') found.sort((a, b) => hp(b) - hp(a));   // (the sort is stable: the nearest of equals first)
      for (const e of found.slice(0, ef.count)) {
        const to = E.center(e);
        if (ef.look === 'bolt') { this.bubbles?.zap(center, to, 0); ctx.pulse?.(.2); }
        else { this.looks.signal(center,to);sfx.gadgetRemote();ctx.pulse?.(.12); }
        bus.emit('damage_taken', { targetId: e.id, amount: power * ef.dmg, color: ef.look === 'bolt' ? '#fff27a' : '#9fd8ff', source: ef.look === 'bolt' ? 'lightning' : 'zap' });
      }
    } else if (ef.kind === 'shards') {
      const shard = new THREE.Color(LOOK.color('ice-shard', '#cfefff'));
      for (const e of this.near(center, ef.range).slice(0, ef.count)) {
        const to = E.center(e);
        this.looks.streak(center, to, shard, LOOK.num('ice-shard-streak', 0.0016), 0.2, 'needle');
        fx.impact(to, shard.getHex(), e.r * 0.5, 6);
        fx.ice.shatter(to, 3, e.r * 0.25, 0.4, e.pos.y);
        bus.emit('damage_taken', { targetId: e.id, amount: power * ef.dmg, color: '#bff4ff', source: 'shards' });
        bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: ef.chill });
      }
      sfx.iceShatter(false);
    } else if (ef.kind === 'orb') {
      const near = this.near(center, 0.45)[0], dir = (near ? E.center(near, _cone).sub(center) : _cone.set(Math.sin(ctx.facing), 0, Math.cos(ctx.facing))).setY(0);
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      const m = fx.orb(LOOK.color('ball-lightning', '#ffe45c'), LOOK.num('ball-lightning-size', 0.0065));
      m.position.copy(center);
      this.orbs.push({ m, dir: dir.clone().normalize(), t: ef.life, speed: ef.speed, radius: ef.radius, dmg: ef.dmg, hit: new Set() });
      this.bubbles?.looks.launch('lightning', center, 1); sfx.elementLaunch('lightning'); ctx.pulse?.(0.3);
    } else if (ef.kind === 'brick') {
      const g = this.brickMesh();
      g.position.copy(feet);
      g.rotation.y = Math.random() * Math.PI;
      g.scale.setScalar(ef.size);
      g.userData.body.position.set(0,0,0);g.userData.body.rotation.set(0,0,0);g.userData.body.scale.setScalar(1);
      this.group.add(g);
      this.bricks.push(Object.assign(g.userData.state ||= {}, { m: g, t: ef.last, age:0, dmg: ef.dmg, size: ef.size, burst: ef.burst }));
      sfx.gadgetBrick();ctx.pulse?.(.15);
      while (this.bricks.length > ef.most) this.group.remove(this.bricks.shift().m);
    } else if (ef.kind === 'marble') {
      const m = this.marbleMesh();m.rotation.set(0,0,0);
      m.scale.setScalar(ef.size);
      m.position.copy(feet).setY(feet.y + 0.007 * ef.size);
      this.group.add(m);
      const state = m.userData.state ||= { dir: new THREE.Vector3(), hit: new Set(), trailAt: new THREE.Vector3() };
      state.dir.set(Math.sin(ctx.facing), 0, Math.cos(ctx.facing)); state.hit.clear(); state.trailAt.copy(m.position);
      this.marbles.push(Object.assign(state, { m, t: ef.life, speed: ef.speed, dmg: ef.dmg, size: ef.size, trailT:0 }));
      sfx.gadgetMarble('launch');ctx.pulse?.(.2);
    } else if (ef.kind === 'lash') {
      if (ef.all) ctx.lashAll?.(ef.dmg);
      else {
        const e = ctx.from != null && this.near(center, ef.range).find((x) => x.id === ctx.from);
        if (e) ctx.lash?.(e, ef.dmg);
      }
    } else if (ef.kind === 'grab') {
      if (ctx.grab?.(ef)) ctx.pulse?.(0.3);
    } else if (ef.kind === 'reach-flare') {
      // the tentacles flare out: a ring on the floor out to the new reach, the bell swelling
      const r = ctx.flare?.(ef.mult);
      if (r) { fx.ring(feet.clone().setY(feet.y + 0.004), new THREE.Color(LOOK.color('lash-trace', '#2ee9ff')).getHex(), r, 0.4); sfx.lashDraw(); ctx.pulse?.(0.3); }
    } else if (ef.kind === 'ink') {
      ctx.ink?.(ef);
      this.inkSquirt(feet, center, ef.radius);
      sfx.inkSquirt();
      ctx.pulse?.(0.3);
    } else if (ef.kind === 'dash') {
      ctx.dash?.(ef.speed, ef.time);
    } else if (ef.kind === 'bubble-ring') {
      ctx.bubbleRing?.(ef.count, ef.dmg);
    } else if (ef.kind === 'xp') {
      ctx.dropXp?.(ef.xp);
    } else if (ef.kind === 'cone') this.cone(ef, ctx);
    else if (ef.kind === 'cloud') this.cloud(ef, ctx);
    else if (ef.kind === 'pass-stacks') this.passStacks(ef, ctx);
    else if (ef.kind === 'heal') {
      // at most `most` a second: the times this one healed in the last second
      const times = (this.heals ||= new Map()).get(ef)?.filter((at) => this.clock - at < 1) || [];
      if (times.length < ef.most && ctx.heal) { times.push(this.clock); ctx.heal(ef.health); }
      this.heals.set(ef, times);
    } else if (ef.kind === 'blob') ctx.blob?.(ef);
    else if (ef.kind === 'whirl') this.whirl(ef, ctx);
  }

  // cloud (Toxic Cloud): gas hangs where it went off; every 0.5 s each bug inside gets a Poison stack
  // (pw: Attack damage x 4.5, from power = Attack damage x 1.8). It shows exactly as big and as long as it works
  cloud(ef, { center, power, mods }) {
    (this.clouds ||= []).push({ at: center.clone(), r: ef.radius, t: ef.time, life: ef.time, tick: 0, pw: this.bubbles?.poisonPw ?? power * 2.5, ep: this.bubbles?.mainParams('poison', mods) });
    this.bubbles?.looks.poisonBurst(center, ef.radius);
    sfx.elementHit('poison');
  }
  tickClouds(dt) {
    if (!this.clouds?.length) return;
    const B = this.bubbles, P = B?.looks.pz, c = _to;
    for (const C of this.clouds) {
      C.t -= dt;
      if (P && Math.random() < dt * 10) {   // the gas churning inside its real edge, thinning as it ends
        _cone.randomDirection().multiplyScalar(C.r * 0.7 * Math.random()).add(C.at);
        this.fx.glow.emit(_cone, Math.random() < 0.5 ? P.gas : P.blob, C.r * 0.35, C.r * 0.6, 0.5, 0.3 * Math.min(1, C.t / 0.6));
      }
      if ((C.tick -= dt) > 0) continue;
      C.tick = 0.5;
      for (const e of this.near(C.at, C.r)) if (B && !e.dead) B.poison(e, C.pw, C.ep);
    }
    this.clouds = this.clouds.filter((C) => C.t > 0);
  }

  // whirl (Cyclone): a whirlwind rises at the nearest bug within range and holds for its time, pulling every bug in it to
  // its middle. Nothing in range, nothing rises
  whirl(ef, { center, pulse }) {
    const E = this.enemies, e = this.near(center, ef.range, { proxies: false })[0];
    if (!e) return;
    const at = E.center(e, _to).clone();
    at.y = e.pos.y;
    (this.whirls ||= []).push({ at, r: ef.radius, t: ef.time, life: ef.time, pull: ef.pull, swirl: 0, streak: 0, turn: Math.random() * 6 });
    this.fx.ring(at.clone().setY(at.y + 0.003), 0xffffff, ef.radius, 0.35);
    this.fx.wind.swirl(at, ef.radius);
    sfx.windLaunch(); pulse?.(0.25);
  }
  tickWhirls(dt) {
    if (!this.whirls?.length) return;
    const W = this.fx.wind;
    for (const w of this.whirls) {
      w.t -= dt;
      w.turn += dt * 7;
      if ((w.swirl -= dt) <= 0) { w.swirl = 0.22; W.swirl(w.at, w.r); }
      if ((w.streak -= dt) <= 0) {   // air racing round its edge, a few streaks at a time
        w.streak = 0.06;
        for (let k = 0; k < 2; k++) {
          const a = w.turn + k * Math.PI;
          _to.set(w.at.x + Math.cos(a) * w.r * 0.9, w.at.y + w.r * (0.2 + 0.5 * Math.random()), w.at.z + Math.sin(a) * w.r * 0.9);
          _cone.set(-Math.sin(a), 0, Math.cos(a));
          W.streaks(_to, _cone, 1, 0.5, w.r * 0.8);
        }
      }
      for (const e of this.near(w.at, w.r, { proxies: false })) {
        _cone.set(w.at.x - e.pos.x, 0, w.at.z - e.pos.z);
        const d = _cone.length();
        if (d > 0.006) bus.emit('knockback', { targetId: e.id, dir: _cone.divideScalar(d), force: Math.min(d - 0.004, w.pull * dt) });
      }
    }
    this.whirls = this.whirls.filter((w) => w.t > 0);
  }

  // pass-stacks (Burst Sac): the dead bug's stacks pass to every bug round it
  passStacks(ef, { center, power, mods, statuses }) {
    const n = statuses?.[ef.status] || 0, B = this.bubbles;
    if (!n || !B) return;
    B.looks.poisonBurst(center, ef.radius);
    sfx.elementHit('poison');
    for (const e of this.near(center, ef.radius)) if (!e.dead) B.poison(e, B.poisonPw ?? power * 2.5, B.mainParams('poison', mods), n);
  }

  // The Ink Cloud's squirt (Ink Cloud): a billow of near-black blue blobs bursting out round the bell and
  // hanging in the water, drops flung out, and stains on the floor under it. Opaque, not glowing: ink
  inkSquirt(feet, center, radius) {
    const fx = this.fx, ink = new THREE.Color(LOOK.color('ink-cloud', '#0b0a22')), edge = new THREE.Color(LOOK.color('ink-edge', '#26205a'));
    for (let i = 0; i < 22; i++) {   // overlapping blobs, so they run together into one cloud
      const a = Math.random() * Math.PI * 2, d = radius * 0.6 * Math.sqrt(Math.random());
      fx.puff(_to.set(center.x + Math.cos(a) * d, center.y + (Math.random() - 0.4) * 0.03, center.z + Math.sin(a) * d), (i % 7 ? ink : edge).getHex(), 0.026 + Math.random() * 0.02, 1 + Math.random() * 0.8, 0.92);
    }
    fx.burst(center, [ink.getHex(), edge.getHex()], 10, 0.004, 0.3, feet.y);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, d = radius * 0.8 * Math.random();
      fx.splat(_to.set(feet.x + Math.cos(a) * d, feet.y, feet.z + Math.sin(a) * d), ink.getHex(), 0.012 + Math.random() * 0.02, 'ink');
    }
  }

  // cone (Fire Breath): a flame cone toward the nearest bug in reach, or the way you face; everything
  // inside is hit and set alight with your Fire attack's Burn (bubbles.js ignite)
  cone(ef, { center, power, facing, mods, pulse }) {
    const E = this.enemies, B = this.bubbles, F = B?.looks, near = this.near(center, ef.range);
    const dir = (near[0] ? E.center(near[0], _cone).sub(center) : _cone.set(Math.sin(facing), 0, Math.cos(facing))).setY(0);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize();
    const half = ef.angle * Math.PI / 360, cos = Math.cos(half);
    // release: a flash at the bell and the flame licking out along the cone (the whoosh, squeeze and shake only on a hit, below)
    F?.fireLaunch(center, 0.012);
    for (let i = 1; i <= 4; i++) for (let j = -1; j <= 1; j++) F?.fireBurn(_to.copy(dir).applyAxisAngle(UP, j * half * 0.75).multiplyScalar(ef.range * i / 4).add(center), 0.008 + 0.005 * i);
    let hit = 0;
    for (const e of near) {
      const at = E.center(e), to = at.clone().sub(center).setY(0), l = to.length();
      if (l > 1e-6 && to.dot(dir) / l < cos) continue;
      hit++;
      F?.fireHit(at, e.r, dir);
      bus.emit('damage_taken', { targetId: e.id, amount: power * ef.dmg, color: '#ffa65a', source: 'cone', feedback: { element: 'fire', dir: dir.clone() } });
      if (!e.T?.fly && !e.dead) bus.emit('knockback', { targetId: e.id, dir: dir.clone(), force: knockFor(power * ef.dmg) });
      if (!e.dead) B?.ignite(e, power * 2.5, mods?.element?.fire);   // power is Attack damage x 1.8; Burn's is x 4.5
    }
    if (hit) { sfx.fireLaunch(1.4); sfx.fire(1.2); pulse?.(0.3); juice.feel('hit'); }   // feedback follows a hit: an empty cone only flickers
  }
}
