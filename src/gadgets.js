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

const _to = new THREE.Vector3();

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
    this.bathReady.visible=this.mirrorReady.visible=this.mirrorSheen.visible=false;
    this.looks.reset();
    this.focus.visible=this.chordReady.visible=false;this.focusTarget=null;this.focusAge=this.focusKick=this.mouseAfter=0;
    this.t = {};
    for (const b of this.bricks || []) this.group.remove(b.m);
    for (const m of this.marbles || []) this.group.remove(m.m);
    this.bricks = [];
    this.marbles = [];
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
    for(const m of [this.bathReady,this.mirrorReady,this.mirrorSheen]){m.visible=on;if(on)m.position.copy(at);}
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

  mirrorState(at,ready,active){
    this.mirrorReady.visible=!!ready&&!active;this.mirrorSheen.visible=!!active;
    this.mirrorReady.position.copy(at);this.mirrorSheen.position.copy(at);
    this.mirrorReady.rotation.set(.35,this.looks.quiet?0:this.orbit||0,.4);
    this.mirrorSheen.rotation.set(-.35,-(this.looks.quiet?0:this.orbit||0),-.4);
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
      if (e.dead || (!proxies && e.proxy) || e.proxy?.shielded) continue;
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
    if(!active){this.bathReady.visible=this.mirrorReady.visible=this.mirrorSheen.visible=false;this.focus.visible=this.chordReady.visible=this.mouseReady.visible=this.mouse.visible=this.beam.visible=false;return;}
    if(!this.mouseRun&&this.mouseAfter>0){
      const k=this.mouseAfter/LOOK.num('gadget-mouse-after',.24);
      this.mouse.scale.set(1+.2*k,1-.35*k,1-.2*k);this.mouseNose.scale.set(1,1,.5);this.mouse.visible=true;
      if(!this.looks.quiet)this.mouse.position.addScaledVector(_to.set(Math.sin(this.mouse.rotation.y),0,Math.cos(this.mouse.rotation.y)),dt*.025);
    }else if(!this.mouseRun)this.mouse.visible=false;
  }

  // ctx: { mods, feet: Vector3, center: Vector3, facing, power (your bubbles' power), dropXp(xp) }
  update(dt, ctx) {
    const { mods: M, feet, center, power } = ctx;
    const E = this.enemies, fx = this.fx;
    this.chordReady.visible=this.bathReady.visible=false;
    this.mirrorState(center,!!M.reflect&&ctx.mirrorReady,!!M.reflect&&ctx.mirrorActive);

    // timed effects: every N s, do what's in the block
    for (const T of M.timed) {
      if (this.every(T.key, dt, T.every, T.first)) for (const ef of T.effects) this.fire(ef, ctx);
      else for(const ef of T.effects) {
        if(ef.kind==='bubble-ring'&&this.t[T.key]<LOOK.num('gadget-bath-prepare',.3)){
          this.bathReady.visible=true;this.bathReady.position.copy(center);
          const r=.026+.018*this.t[T.key]/LOOK.num('gadget-bath-prepare',.3);
          this.bathReady.children.forEach((m,i)=>{const a=i/8*Math.PI*2;m.position.set(Math.cos(a)*r,0,Math.sin(a)*r);});
        }
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

    // toy-mouse: now and then it scurries to the nearest enemy and hits it
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
          this.mouse.scale.setScalar(1);this.mouseNose.scale.setScalar(1);this.mouse.rotation.set(0,0,0);
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
          this.mouseTail.rotation.y=scurry*.28;
          if(Math.floor(run.t*5)!==Math.floor((run.t-dt)*5))sfx.gadgetMouse('run');
          if (d < 0.012 + run.prey.r) {
            fx.puff(m.clone().setY(m.y + 0.008), 0xd8d0c8, 0.02, 0.3);
            bus.emit('damage_taken', { targetId: run.prey.id, amount: Mo.dmg, color: '#ffe7a8', source: 'toy-mouse' });
            this.looks.contact(E.center(run.prey),this.looks.color,.018);this.looks.spring(m);
            this.looks.arc(m,.025,this.looks.color,.22);sfx.gadgetMouse('hit');if(!this.looks.quiet)juice.feel('hit-big');ctx.pulse?.(.35);
            this.mouse.scale.set(1.2,.65,.8);this.mouseNose.scale.set(1,1,.5);
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
      if (mb.t <= 0) this.group.remove(mb.m);
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
      }
    } else if (ef.kind === 'zap') {
      for (const e of this.near(center, ef.range).slice(0, ef.count)) {
        const to = E.center(e);
        this.looks.signal(center,to);sfx.gadgetRemote();ctx.pulse?.(.12);
        bus.emit('damage_taken', { targetId: e.id, amount: power * ef.dmg, color: '#9fd8ff', source: 'zap' });
      }
    } else if (ef.kind === 'brick') {
      const g = this.brickMesh();
      g.position.copy(feet);
      g.rotation.y = Math.random() * Math.PI;
      g.scale.setScalar(ef.size);
      g.userData.body.position.set(0,0,0);g.userData.body.rotation.set(0,0,0);g.userData.body.scale.setScalar(1);
      this.group.add(g);
      this.bricks.push({ m: g, t: ef.last, age:0, dmg: ef.dmg, size: ef.size, burst: ef.burst });
      sfx.gadgetBrick();ctx.pulse?.(.15);
      while (this.bricks.length > ef.most) this.group.remove(this.bricks.shift().m);
    } else if (ef.kind === 'marble') {
      const m = this.marbleMesh();m.rotation.set(0,0,0);
      m.scale.setScalar(ef.size);
      m.position.copy(feet).setY(feet.y + 0.007 * ef.size);
      this.group.add(m);
      this.marbles.push({ m, dir: new THREE.Vector3(Math.sin(ctx.facing), 0, Math.cos(ctx.facing)), t: ef.life, speed: ef.speed, dmg: ef.dmg, size: ef.size, hit: new Set(),trailT:0,trailAt:m.position.clone() });
      sfx.gadgetMarble('launch');ctx.pulse?.(.2);
    } else if (ef.kind === 'lash') {
      const e = ctx.from != null && this.near(center, ef.range).find((x) => x.id === ctx.from);
      if (e) ctx.lash?.(e, ef.dmg);
    } else if (ef.kind === 'dash') {
      ctx.dash?.(ef.speed, ef.time);
    } else if (ef.kind === 'bubble-ring') {
      ctx.bubbleRing?.(ef.count, ef.dmg);
    } else if (ef.kind === 'xp') {
      ctx.dropXp?.(ef.xp);
    }
  }
}
