// Stories: the event bus, the boss (Vacuum), modes. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { STAGES } from '../stages.js';
import { hostile } from '../vfx.js';
import { ATTACKS } from '../vacuum.js';
import { juice } from '../juice.js';
import { CONFIG } from '../config.js';
import { sfx, unlock as unlockAudio } from '../sfx.js';
import { ELEMENTS_IDS, G, JUMP_FEET, V, againVacuum, bossHits, feelVoices, fresh, holdJelly, ok, r3, record, restore, shownWarnings, sim, spawn, startVacuum, step, story, stub, tp } from './kit.js';

// --- the event bus: what hits, kills, freezes and rewards do
story('events/player-hit-feedback', {
  about: 'Landed hits nudge the jelly away (on the next frame, by CONFIG.player.hitPush for the damage) with a light shake; invulnerability and drains add no nudge, and Reduce effects disables shake only.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3, 0); spawn('roach', G().player.position.clone().add(V(0.2, 0, 0)), { still: true }); },
  play() {
    const { run, player, enemies } = G(), H = CONFIG.player.hitPush, push = H.base + H.perDamage;
    run.S.dodge = 0; run.iFrames = 0;
    stub(juice, 'calm', false); stub(juice, 'trauma', 0);
    const shoves = record('knockback'), mine = () => shoves.filter((k) => k.targetId === PLAYER);
    const hit = { targetId: PLAYER, amount: 1, source: 'story', from: enemies.list[0].id };
    bus.emit('damage_taken', hit);
    const shake = Math.abs(juice.trauma - 0.22) < 1e-8;
    step(1);
    const k = mine()[0], directed = mine().length === 1 && Math.abs(k.force - push) < 1e-8 && Math.abs(k.dir.x + 1) < 1e-8 && Math.abs(k.dir.z) < 1e-8;
    bus.emit('damage_taken', hit);
    bus.emit('damage_taken', { ...hit, drain: true });
    step(1);
    const noRepeat = mine().length === 1 && juice.trauma <= 0.22 + 1e-8;   // no second nudge or shake (the first shake fades)
    run.iFrames = 0; player.facing = 0;
    juice.calm = true; juice.trauma = 0;
    bus.emit('damage_taken', { ...hit, from: null });
    step(1);
    const f = mine()[1], fallback = mine().length === 2 && Math.abs(f.dir.z + 1) < 1e-8;
    return ok(directed && shake && noRepeat && fallback && juice.trauma === 0, { directed, shake, noRepeat, fallback, calmShake: juice.trauma });
  },
});
story('events/kill-drops-xp', {
  about: 'Bubbles kill a roach: it bursts, counts as a kill and drops XP.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const P = G().player.position; spawn('roach', P.clone().add(V(0, 0, -0.18)), { still: true }); },
  play() {
    const { run, enemies, xpDrops } = G();
    const e = enemies.list[0], k0 = run.kills;
    step(300, () => e.dead);
    return ok(e.dead && run.kills === k0 + 1 && xpDrops.list.length > 0 && !enemies.byId.has(e.id), { dead: e.dead, xp: xpDrops.list.length });
  },
});
story('events/ice-refreshes-slow-without-freezing', {
  about: 'Ice slows on the first hit and refreshes the slow on repeated hits without freezing.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', G().player.position.clone().add(V(0.3, 0, 0.3))); },
  play() {
    const e = G().enemies.list[0];
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    const once = e.slowT;
    e.slowT = 0.5;
    bus.emit('status_applied', { targetId: e.id, status: 'chill', duration: 2 });
    return ok(once === 2 && e.slowT === 2 && !(e.freezeT > 0), { afterOne: once, afterTwo: e.slowT, frozen: e.freezeT || 0 });
  },
});
story('events/iframes-and-drain', {
  about: 'A second hit inside the invincibility window does nothing; ongoing drain (puddles) still does.',
  setup() { fresh({ hurt: true, elites: false }); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m1 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 3, source: 'story' });
    const m2 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story', drain: true });
    return ok(m1 === m0 - 3 && m2 === m1 && run.health === m2 - 1, { m0, m1, m2, m3: run.health });
  },
});
story('events/elite-defeat-leaves-a-treasure', {
  about: 'Beating an elite leaves a treasure (a golden chest) on its high ground, not a pick right away.',
  setup() { fresh(); },
  play() {
    const { run, enemies, menus } = G();
    const mug = run.elites.list.find((e) => e.kind === 'mug'), entry = enemies.list.find((e) => e.proxy === mug);
    bus.emit('damage_taken', { targetId: entry.id, amount: 9999, source: 'story' });
    step(5);
    const pick = menus.open, chest = run.roomTreasures.find((t) => t.active && !t.timed);
    const near = chest && Math.hypot(chest.pos.x - mug.base.x, chest.pos.z - mug.base.z) < 0.05 && Math.abs(chest.pos.y - mug.base.y) < 0.05;
    return ok(mug.dead && !pick && near, { dead: mug.dead, pick, chest: chest && r3(chest.pos), base: r3(mug.base) });
  },
});

// --- the boss
story('boss/vacuum-arena-and-kill', {
  about: 'The Vacuum fight: low walls keep you in front of the kitchen, and it can be beaten.',
  setup() { fresh({ bubbles: true }); G().run.startBossIntro(); },
  play() {
    const { run, menus } = G();
    step(180);
    const phase = run.phase;
    const esc = sim(4, ['KeyD']).pos;
    const A = run.stage.boss;
    const inside = esc[0] > A.arenaMin[0] - 0.1 && esc[0] < A.arenaMax[0] + 0.1 && esc[2] > A.arenaMin[2] - 0.1 && esc[2] < A.arenaMax[2] + 0.1;
    run.stats.tentacleDamage = 60; run.stats.tentacles = 4;
    step(60 * 40, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.boss.dead; });
    return ok(phase === 'boss' && inside && run.boss.dead, { phase, esc, dead: run.boss.dead });
  },
});

story('boss/vacuum-lanternfly-shield', {
  about: 'The Vacuum launches 4 lanternflies and is immune until they are all dead, then can be hurt again.',
  setup() { fresh({ bubbles: false, lash: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    V.state = 'flies'; V.stateT = 1.0; V.prevT = 1.0;
    step(60);
    const flies = V.guards.length, airborne = V.guards.filter((e) => e.airborne).length;
    const hp0 = V.hp;
    bus.emit('damage_taken', { targetId: enemies.list.find((e) => e.proxy === V).id, amount: 50, source: 'test' });
    const immune = V.hp === hp0 && V.shielded;
    step(60);
    const landed = V.guards.every((e) => !e.airborne);
    for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
    step(5);
    const down = !V.shielded;
    V.damage(50);
    return ok(flies === 4 && airborne === 4 && immune && landed && down && V.hp === hp0 - 50, { flies, airborne, immune, landed, down, hp: V.hp, hp0 });
  },
});

story('boss/vacuum-force-field-shows-and-holds-its-bugs', {
  about: "The Vacuum's arena force field is drawn while the fight is on (the shark's stays hidden), and the cockroaches it dumps with its back to a wall land inside the field, not in or behind it, then come out for the jelly.",
  setup() { startVacuum('charge'); },
  play() {
    const { run, enemies } = G(), A = run.stage.boss, B = run.boss;
    const fields = run.bossWalls.map((m) => m.userData.field);
    const drawn = fields.filter((f) => f.visible).length;
    const out = {};
    for (const [wall, x, z, heading] of [['west', A.arenaMin[0] + B.r, 3.2, Math.PI / 2], ['north', 3.6, A.arenaMin[2] + B.r, 0], ['corner', A.arenaMin[0] + B.r, A.arenaMin[2] + B.r, Math.PI / 4]]) {
      enemies.clear();
      B.position.set(x, B.position.y, z); B.heading = heading; B.holder.rotation.y = heading;
      B.state = 'dump'; B.stateT = 0.62; B.prevT = 0.62;
      step(2);
      const roaches = enemies.list.filter((e) => !e.proxy && !e.dead);
      const from = roaches.map((e) => e.pos.clone());
      B.state = 'chase'; B.stateT = 99; B.position.set(4.1, B.position.y, 4.1);   // out of their way
      step(120);
      const inside = roaches.every((e) => e.pos.x >= A.arenaMin[0] + e.r - 1e-3 && e.pos.z >= A.arenaMin[2] + e.r - 1e-3);
      const moved = roaches.every((e, i) => e.pos.distanceTo(from[i]) > 0.05);
      out[wall] = { n: roaches.length, inside, moved };
    }
    const held = Object.values(out).every((w) => w.n >= 3 && w.inside && w.moved);
    return ok(drawn > 0 && fields.every((f) => !f.userData.hidden) && held, { drawn, out });
  },
});

story('boss/vacuum-enrages-at-half', {
  about: 'Below half health the Vacuum enrages: it stops and shudders for a moment (ENRAGED!), then does everything twice as fast.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run } = G();
    step(180);
    const V = run.boss;
    const calm = V.pace;
    V.hp = V.maxHp * 0.49;
    step(2);
    const enraging = V.enrageT > 0, still = V.pace === 1;
    const at = V.holder.position.clone();
    step(30);
    const stood = V.holder.position.distanceTo(at) < 1e-6;
    step(90);                                       // the enrage is over
    V.state = 'chase'; V.stateT = 2.6;
    step(30);                                       // half a second of real time
    const used = 2.6 - V.stateT;                    // a calm Vacuum would use 0.5 s of its chase
    return ok(calm === 1 && enraging && still && stood && V.pace === 2 && used > 0.9 && used < 1.1, { calm, enraging, stood, pace: V.pace, used: +used.toFixed(2) });
  },
});

story('boss/vacuum-two-shields-max', {
  about: 'The Vacuum raises its lanternfly shield twice a fight at most.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, enemies } = G();
    step(180);
    const V = run.boss;
    let flies = 0;
    for (let k = 0; k < 12; k++) {                  // plenty of picks: the flies come up every 5th normally
      for (const e of [...V.guards]) enemies.applyDamage(e, 1e4);
      step(2);
      V.pick();
      if (V.state === 'flies') { flies++; V.launch(); }
    }
    return ok(V.shields === 2 && flies === 2, { shields: V.shields, flies });
  },
});

// --- 3D attacks: the Vacuum's charge is a lane as tall as it is (8 cm: jump it), its brush sweeps
story('boss/dendi-finishes-the-vacuum', {
  about: 'At 0 hp the Vacuum is doomed, not dead: the screen fades, Dendi appears beside it in view of the camera, and his smack is what kills it — then the usual cleared flow runs.',
  setup() { startVacuum('charge'); },
  play() {
    const { run } = G(), B = run.boss, d = window.dendi;
    B.damage(99999);
    const doomed = B.dying && !B.dead;
    let smacked = false, catNear = false, onScreen = false;
    const v = new THREE.Vector3();
    step(60 * 10, () => {
      if (d.state() === 'smack') smacked = true;
      // the camera shows him: his middle inside the frame while he smacks (it once kept the player's angle and left him off-screen)
      if (smacked && d.group.visible) { d.group.getWorldPosition(v); v.y += 0.15; v.project(G().APT.camera); if (Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1) onScreen = true; }
      if (B.dead && !catNear) {
        const c = B.center(), gp = d.group.position;
        catNear = Math.hypot(gp.x - c.x, gp.z - c.z) < B.r + 0.45;
      }
      return B.dead && run.bossWon;
    });
    return ok(doomed && smacked && catNear && onScreen && run.bossWon && !d.group.visible,
      { doomed, smacked, catNear, onScreen, won: run.bossWon, goneAfter: !d.group.visible });
  },
});
story('boss/finish-walk-impact-and-return', {
  about: 'The seven-second finish walks Dendi in, holds gameplay, kills exactly on his paw strike, then restores the player/camera/HUD under a second fade before awarding the win.',
  setup() { startVacuum('charge'); stub(juice,'calm',false); },
  play() {
    const {run,player,tpc,hud,input}=G(), B=run.boss, d=G().dendi;
    const at=player.position.clone(), yaw=tpc.yaw, t=run.t, die=B.die;
    let calls=0, walkAt=null, walked=0, deadAt=0, withheld=false, frozen=true, locked=true, cameraYaw;
    stub(B,'die',function(){calls++;return die.call(this);});
    B.damage(99999);
    let elapsed=0;
    step(60*10,()=>{
      elapsed+=1/60;
      frozen &&= Math.abs(run.t-t)<.04;
      if(d.state()==='walk') {
        walkAt ||= d.group.position.clone(); walked=Math.max(walked,walkAt.distanceTo(d.group.position));
        if(cameraYaw===undefined) cameraYaw=tpc.yaw;else locked &&= Math.abs(tpc.yaw-cameraYaw)<1e-6;
        input.mouseDX=200;
      }
      if(B.dead && !deadAt) {deadAt=elapsed;withheld=!run.bossWon;}
      return run.bossWon;
    });
    const fade=document.querySelector('.boss-fade');
    return ok(run.bossWon && calls===1 && walked>.05 && deadAt>3 && withheld && frozen && locked && elapsed>6 && elapsed<9
      && player.position.distanceTo(at)<1e-6 && tpc.yaw===yaw && !hud.el.hidden && !d.group.visible && Number(fade.style.opacity)===0,
      {calls,walked,deadAt,withheld,frozen,locked,elapsed,returned:player.position.distanceTo(at),yaw:tpc.yaw,hidden:hud.el.hidden});
  },
});
story('boss/finish-reduced-effects', {
  about: 'Reduce Effects keeps a short static cat finish, one confirmed kill, no shake, and a clean return in under three seconds.',
  setup() { startVacuum('charge'); stub(juice,'calm',true); juice.trauma=0; },
  play() {
    const {run,hud}=G(), d=G().dendi;run.boss.damage(99999);
    let walked=false, elapsed=0;
    step(240,()=>{elapsed+=1/60;walked ||= d.state()==='walk';return run.bossWon;});
    return ok(run.bossWon && !walked && elapsed<3 && juice.trauma===0 && !d.group.visible && !hud.el.hidden,{won:run.bossWon,walked,elapsed,trauma:juice.trauma});
  },
});
story('boss/finish-cancels-on-restart', {
  about: 'Restarting during the approach clears the cat, fade and HUD state without restoring the old scene over the new run.',
  setup() { startVacuum('charge'); stub(juice,'calm',false); },
  play() {
    const {run,player,hud,tpc}=G();run.boss.damage(99999);step(100);
    fresh({elites:false});const at=player.position.clone(), yaw=tpc.yaw;step(2);
    return ok(!G().dendi.group.visible && Number(document.querySelector('.boss-fade').style.opacity)===0 && !hud.el.hidden && !run.bossWon && player.position.distanceTo(at)<.01 && tpc.yaw===yaw,
      {cat:G().dendi.group.visible,fade:document.querySelector('.boss-fade').style.opacity,hud:hud.el.hidden,moved:player.position.distanceTo(at)});
  },
});
story('boss/finish-pauses-before-contact', {
  about: 'Pausing while the paw rises freezes the cat and kill together, discards camera drag, and resumes to exactly one finishing contact.',
  setup() { startVacuum('charge'); stub(juice,'calm',false); },
  play() {
    const {run,input,tpc}=G(), d=G().dendi, B=run.boss, overlay=document.querySelector('#g-over');
    B.damage(99999);step(360,()=>d.state()==='smack');step(5);
    const paw=d.bones.legFR0.quaternion.clone(), yaw=tpc.yaw;
    overlay.hidden=false;input.mouseDX=300;step(120);
    const held=paw.angleTo(d.bones.legFR0.quaternion)<1e-6 && !B.dead && tpc.yaw===yaw;
    overlay.hidden=true;step(600,()=>run.bossWon);
    return ok(held && run.bossWon && !d.group.visible,{held,won:run.bossWon});
  },
});
story('boss/finish-respects-os-reduced-motion', {
  about: 'The operating system reduced-motion preference also selects the short static finish without camera shake, even if Effects full was saved.',
  setup() { startVacuum('charge'); stub(juice,'calm',false); stub(G().fx,'reducedMotion',{matches:true}); juice.trauma=0; },
  play() {
    const {run}=G();run.boss.damage(99999);let frames=0,walked=false;
    step(240,()=>{frames++;walked ||= G().dendi.state()==='walk';return run.bossWon;});
    return ok(run.bossWon && frames<180 && !walked && juice.trauma===0,{won:run.bossWon,frames,walked,trauma:juice.trauma});
  },
});
story('boss/finish-layered-sound', {
  about: 'The walking steps, paw whoosh and one finishing thump execute on live Web Audio with the boss finish.',
  setup() { startVacuum('charge'); stub(juice,'calm',false); },
  async play() {
    unlockAudio();await new Promise(r=>setTimeout(r,200));
    const calls={catStep:0,catWind:0,catImpact:0};
    for(const name of Object.keys(calls)){const real=sfx[name];stub(sfx,name,()=>{calls[name]++;real();});}
    const {run}=G();run.boss.damage(99999);step(600,()=>run.bossWon);
    return ok(run.bossWon && calls.catStep>0 && calls.catWind===1 && calls.catImpact===1,calls);
  },
});
story('boss/vacuum-charge-warning-is-a-lane', {
  about: "The charge's Warning is its floor strip with a lane volume over it as tall as the Vacuum (8 cm), filling together; both go when it rams.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, floorY = B.position.y;
    step(20);
    const w1 = shownWarnings(), strip = w1.floor[0], lane = w1.volume[0], p1 = [strip?.material.progress, lane?.material.progress];
    step(20);
    const p2 = [strip?.material.progress, lane?.material.progress];
    let shape = {};
    if (strip && lane) {
      const s = new THREE.Box3().setFromObject(strip), l = new THREE.Box3().setFromObject(lane);
      const same = (a, b) => Math.abs(a - b) < 0.005;
      shape = { tall: +(l.max.y - floorY).toFixed(3), onFloor: l.min.y > floorY - 0.005, over: same(s.min.x, l.min.x) && same(s.max.x, l.max.x) && same(s.min.z, l.min.z) && same(s.max.z, l.max.z) };
      shape.ok = Math.abs(shape.tall - 0.08) < 0.003 && shape.onFloor && shape.over;
    }
    step(60, () => B.locked);
    const w3 = shownWarnings(), gone = B.locked && !w3.floor.includes(strip) && !w3.volume.includes(lane);
    const filling = !!(strip && lane) && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[1] > p1[1];
    return ok(filling && shape.ok && gone, { p1, p2, shape, gone, floors: w1.floor.length, volumes: w1.volume.length });
  },
});
story('boss/vacuum-charge-jumped-clear', {
  about: "A jelly standing in the charge's lane is hit (4) when the Vacuum gets there; one in the air above it (feet 12 cm up, over an 8 cm Vacuum) isn't, by the lane or the bump, as it rams underneath.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'charge');
      step(120, () => B.locked);
      if (jump) { player.position.y = B.position.y + JUMP_FEET; player.grounded = false; }
      const h0 = hits.length, from = B.position.clone();
      step(120, () => B.state !== 'charge');
      const passed = B.position.distanceTo(from) > from.distanceTo(player.position);   // it rammed on past the jelly
      out[jump ? 'jumping' : 'standing'] = { hits: hits.slice(h0).map((h) => h.amount), passed };
    }
    const pass = out.standing.hits[0] === 4 && out.jumping.hits.length === 0 && out.jumping.passed;
    return ok(pass, out);
  },
});
story('boss/vacuum-charge-just-cleared-no-bump', {
  about: "The charge's lane (8 cm) is its hit while it rams: a jelly in the air with its feet 9 cm up, just over the lane, isn't hit by the lane or by bumping into it as it rams underneath.",
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits();
    againVacuum(B, 'charge');
    step(120, () => B.locked);
    player.position.y = B.position.y + 0.09; player.grounded = false;
    const from = B.position.clone();
    step(120, () => B.state !== 'charge');
    const passed = B.position.distanceTo(from) > from.distanceTo(player.position);
    const got = hits.map((h) => h.amount);
    return ok(passed && !got.length, { passed, hits: got });
  },
});
story('boss/vacuum-brushes-sweep-a-low-wall', {
  about: "Each brush sweep shows as a low wall (2 cm) spreading out round the Vacuum to its reach (27 cm), in its hostile colour, then gone.",
  setup() { startVacuum('brushes'); },
  play() {
    const B = G().run.boss;
    holdJelly(); againVacuum(B, 'brushes', 0.4);
    const seen = [];
    step(120, () => {
      const v = shownWarnings().volume[0];
      if (v) { const b = new THREE.Box3().setFromObject(v); seen.push({ r: (b.max.x - b.min.x) / 2, tall: b.max.y - B.position.y, low: b.min.y - B.position.y, color: v.material.uniforms.uColor.value.getHex() }); }
      return B.state !== 'brushes';
    });
    const after = shownWarnings().volume.length;
    const walls = seen.length > 0 && seen.every((w) => Math.abs(w.tall - 0.02) < 0.002 && Math.abs(w.low) < 0.002 && w.color === hostile('vacuum').getHex());
    const spreads = seen.length > 2 && seen[1].r > seen[0].r && Math.abs(Math.max(...seen.map((w) => w.r)) - 0.27) < 0.01;
    return ok(walls && spreads && after === 0, { frames: seen.length, first: seen[0] && +seen[0].r.toFixed(3), widest: seen.length && +Math.max(...seen.map((w) => w.r)).toFixed(3), walls, after });
  },
});
story('boss/vacuum-brushes-jumped-clear', {
  about: "A jelly standing in a brush sweep's reach is hit by both sweeps (3 each); one in the air above it (feet 5 cm up, over a 2 cm wall) isn't.",
  setup() { startVacuum('brushes'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'brushes', 0.26);
      if (jump) { player.position.y = B.position.y + 0.05; player.grounded = false; }
      const h0 = hits.length;
      step(120, () => B.state !== 'brushes');
      out[jump ? 'jumping' : 'standing'] = hits.slice(h0).map((h) => h.amount).filter((n) => n === 3).length;   // a sweep's hit (the bump is 2)
    }
    return ok(out.standing === 2 && out.jumping === 0, out);
  },
});
story('boss/vacuum-spin-low-and-high', {
  about: "The spin's dust clumps are Shots alternating floor level (4.5 cm) and jump height (16 cm): the low ones pass under a jumping jelly and the high ones over a grounded one (each hits the jelly that doesn't dodge it, 3).",
  setup() { startVacuum('spin'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), out = {};
    for (const jump of [false, true]) {
      againVacuum(B, 'spin', 0.45);
      B.stateT = 1.0;
      if (jump) { player.position.y = B.position.y + JUMP_FEET; player.grounded = false; }
      const h0 = hits.length, seen = new Set(), heights = [];
      // keep it facing the jelly as each clump flies, so every one comes straight at it
      const aim = () => { B.heading = Math.atan2(player.position.x - B.position.x, player.position.z - B.position.z) - 9 / 60; };
      aim();
      step(200, () => {
        for (const s of B.shots) if (!seen.has(s)) { seen.add(s); heights.push(s.m.position.y - B.position.y); }
        if (B.state === 'spin') aim();
        return B.state !== 'spin' && !B.shots.length;
      });
      const low = heights.filter((h) => h < 0.07).length, high = heights.length - low;
      const alternate = heights.every((h, i) => i === 0 || (h < 0.07) !== (heights[i - 1] < 0.07));
      out[jump ? 'jumping' : 'grounded'] = { low, high, alternate, hits: hits.slice(h0).map((h) => h.amount) };
    }
    const g = out.grounded, j = out.jumping, spin = (r) => r.hits.filter((n) => n === 3).length, clean = (r) => r.hits.every((n) => n === 2 || n === 3);   // 3s are the clumps; a 2 is a bump (at spin speed 0.9 for 3 s the Vacuum drives the last stretch into you)
    const pass = g.low > 0 && g.high > 0 && j.low > 0 && j.high > 0 && g.alternate && j.alternate && clean(g) && clean(j)
      && spin(g) === g.low && spin(j) === j.high;   // grounded: only the low clumps hit; jumping: only the high ones
    return ok(pass, out);
  },
});
for (const attack of ['charge', 'brushes', 'spin']) {
  story(`boss/vacuum-${attack}-builds-no-shader`, {
    about: `Starting the Vacuum's ${attack} builds no new shader: its Warning, volume and Shots were built behind Play.`,
    setup() { startVacuum(attack); },
    play() {
      const { APT, batcher } = G(), B = G().run.boss, programs = APT.renderer.info.programs.length;
      holdJelly(); againVacuum(B, attack, 0.4);
      const showing = () => (attack === 'spin' ? B.shots.length > 1 : shownWarnings().volume.length > 0);
      step(120, showing);
      const shown = showing();
      batcher.sync(); G().GAME.compile();
      const newShaders = APT.renderer.info.programs.length - programs;
      return ok(shown && newShaders === 0, { shown, newShaders });
    },
  });
}

// --- Attack Feel (docs/agents/attack-feel.md): each Vacuum attack completes the chain on a real hit
const alive = (pool) => pool.filter((x) => x.alive).length;
story('boss/vacuum-charge-feel', {
  about: 'The ram is released on one frame (it rears, a flash at its bumper, dust behind, a clunk under the roar); hitting the jelly flashes where it struck with a thwack and the big impact shake, and it rears back; it stops with a crunch and leaves a fading scuff.',
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, hits = bossHits(), { feels, n } = feelVoices('vacRam', 'vacSmack');
    holdJelly(); againVacuum(B, 'charge');
    step(120, () => B.locked);
    const released = B.kick > 0.7 && n.vacRam.length === 1;
    step(120, () => hits.length > 0);
    const struck = hits[0]?.amount === 4 && n.vacSmack.length === 1 && feels.includes('impact-big') && B.kick > 0.8;
    step(120, () => B.state !== 'charge');
    const scuff = alive(G().fx.splats);
    return ok(released && struck && scuff >= 1, { released, struck, smacks: n.vacSmack.length, feels: [...new Set(feels)], scuff });
  },
});
story('boss/vacuum-brushes-feel', {
  about: 'Each brush sweep jolts the Vacuum, flicks grit out that leaves fading dust round it, and where the low wall catches the jelly a flash there with the impact shake; the sweep sound is pitch-varied with grit pattering.',
  setup() { startVacuum('brushes'); },
  play() {
    const B = G().run.boss, hits = bossHits(), { feels, n } = feelVoices('vacSweep');
    holdJelly(); againVacuum(B, 'brushes', 0.26);
    let kick = 0;
    step(120, () => { kick = Math.max(kick, B.kick); return B.state !== 'brushes'; });
    const dust = alive(G().fx.splats), sweeps = hits.filter((h) => h.amount === 3).length;
    return ok(n.vacSweep.length === 2 && sweeps === 2 && feels.includes('impact') && kick > 0.3 && dust >= 4, { sweeps, sounds: n.vacSweep.length, feels: [...new Set(feels)], kick: +kick.toFixed(2), dust });
  },
});
story('boss/vacuum-spin-feel', {
  about: 'Each dust clump is spat out with a puff of light and a jolt of the spinning Vacuum; one bursting on the jelly thumps and shakes the screen (feel impact), and every clump that bursts leaves grit and a speck of dust on the floor.',
  setup() { startVacuum('spin'); },
  play() {
    const B = G().run.boss, player = holdJelly(), hits = bossHits(), { feels, n } = feelVoices('vacClump');
    againVacuum(B, 'spin', 0.45); B.stateT = 1.0;
    const aim = () => { B.heading = Math.atan2(player.position.x - B.position.x, player.position.z - B.position.z) - 9 / 60; };
    aim();
    let kick = 0;
    step(200, () => { kick = Math.max(kick, B.kick); if (B.state === 'spin') aim(); return B.state !== 'spin' && !B.shots.length; });
    const dust = alive(G().fx.splats), clumps = hits.filter((h) => h.amount === 3).length;
    return ok(clumps >= 1 && n.vacClump.includes(true) && feels.includes('impact') && kick > 0.2 && dust >= 2, { clumps, sounds: n.vacClump.length, feels: [...new Set(feels)], kick: +kick.toFixed(2), dust });
  },
});
story('boss/vacuum-suction-feel', {
  about: 'Suction starts on one frame (its motor kicks, a flash at its intake, a puff out of the bin) and it shudders while it pulls (not with Reduce effects); a jelly caught in its mouth grinds with sparks, a crunch and a light shake a few times a second; when it stops a fading ring of dust is left round it.',
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, drains = record('damage_taken'), { feels, n } = feelVoices('vacGrind');
    const player = holdJelly(); againVacuum(B, 'charge', B.r + 0.02);
    B.next = ATTACKS.calm.indexOf('suction'); B.pick();
    let kick = 0, shook = 0;
    step(30, () => { kick = Math.max(kick, B.kick); shook = Math.max(shook, Math.abs(B.body.position.x)); });
    const caught = drains.some((d) => d.source === 'boss' && d.drain) && n.vacGrind.length >= 2 && feels.includes('hit');
    stub(juice, 'calm', true); step(2);
    const calmStill = B.body.position.x === 0 && B.body.position.z === 0;
    player.position.z += 1;   // out of its mouth for the rest
    step(400, () => B.state !== 'suction');
    const dust = alive(G().fx.splats);
    return ok(kick > 0.5 && shook > 0 && caught && calmStill && dust >= 1, { kick: +kick.toFixed(2), shook: +shook.toFixed(4), caught, grinds: n.vacGrind.length, calmStill, dust });
  },
});
story('boss/vacuum-flies-feel', {
  about: 'Launching the lanternflies, the Vacuum heaves (rears and squashes) with a flash at its bin and a shake (feel impact), pitch-varied pops and a whoosh as they fly.',
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, { feels, n } = feelVoices('vacFliesLaunch');
    holdJelly(); againVacuum(B, 'charge');
    B.next = ATTACKS.calm.indexOf('flies'); B.pick();
    step(120, () => B.guards.length > 0);
    return ok(B.state === 'flies' && B.guards.length === 4 && B.kick > 0.8 && n.vacFliesLaunch.length === 1 && feels.includes('impact'), { guards: B.guards.length, kick: +B.kick.toFixed(2), feels: [...new Set(feels)] });
  },
});
story('boss/vacuum-dump-feel', {
  about: 'Before a dump the bin rattles (a rattle sound, the Vacuum shuddering); on the drop it squats with a clunk and a light shake, and leaves a fading pile of dust where the bin emptied.',
  setup() { startVacuum('charge'); },
  play() {
    const B = G().run.boss, { feels, n } = feelVoices('vacDumpWind', 'vacDump');
    holdJelly(); againVacuum(B, 'charge', 0.5);
    B.next = ATTACKS.calm.indexOf('dump'); B.pick();
    let shook = 0;
    step(60, () => { shook = Math.max(shook, Math.abs(B.body.position.x)); return n.vacDump.length > 0; });
    const dropped = B.kick > 0.6 && feels.includes('hit') && alive(G().fx.splats) >= 1;
    return ok(n.vacDumpWind.length === 1 && shook > 0 && dropped, { wind: n.vacDumpWind.length, shook: +shook.toFixed(4), dropped, kick: +B.kick.toFixed(2) });
  },
});

story('modes/quick-restart-after-death', {
  about: 'Starting a new run right after dying: the old run\'s death screen (it comes 0.7 s after) doesn\'t land on the new run.',
  setup() { fresh({ bubbles: false, lash: false }); },
  async play() {
    const { run, menus } = G();
    run.die();
    run.start();                                   // straight away, before the death screen
    run.startPicked = true;
    await new Promise((r) => setTimeout(r, 1000));
    const stale = /dried out/.test(document.querySelector('.jf-modal')?.innerText || '');
    const t0 = run.t;
    step(60);
    const runs = run.phase === 'explore' && run.t > t0;
    menus.close();
    return ok(!stale && runs, { stale, phase: run.phase, runs });
  },
});

story('boss/a-level-up-after-the-boss-is-never-swept-away', {
  about: 'Beating the boss, its XP often levels you up: that pick stays open as long as you like, and the metamorphosis comes after it, never in its place.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false, levels: true }); },
  async play() {
    const { run } = G();
    const modal = () => document.querySelector('.jf-modal');
    run.pendingLevels = 1;
    run.levelUp();                                                    // the level-up the boss's XP brought
    const levelUp = modal().querySelector('h2')?.textContent;
    run.later(() => run.metamorph(), 0);                              // onBossDead's metamorphosis comes due
    await new Promise((r) => setTimeout(r, 2600));                    // a slow pick: well past the 2.2 s
    const still = modal().querySelector('h2')?.textContent;
    modal().querySelector('.jf-card').click();                        // take a card
    await new Promise((r) => setTimeout(r, 400));
    const after = modal().querySelector('h2')?.textContent;
    G().menus.close();
    return ok(still === levelUp && run.phase === 'metamorph' && /Metamorphosis/.test(after), { levelUp, still, after, phase: run.phase });
  },
});

story('boss/legendary-reward', {
  about: 'The Boss reward: after the metamorphosis, a Legendary pick of three with at least one element you don\'t have yet, then the act is complete.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); },
  play() {
    const { run } = G();
    run.owned.add('candle');
    const modal = () => document.querySelector('.jf-modal');
    run.metamorph();
    const first = modal().querySelector('h2')?.textContent;
    modal().querySelector('.jf-card').click();                        // an evolution
    modal().querySelector('.jf-evolution-footer button').click();      // skip its transformation
    const second = modal().querySelector('h2')?.textContent;
    const offered = [...modal().querySelectorAll('.jf-card .big')].map((n) => n.textContent);
    const tiers = [...modal().querySelectorAll('.jf-card .rar')].map((n) => n.textContent);
    modal().querySelector('.jf-card').click();                        // a Legendary
    const third = modal().querySelector('h2')?.textContent;
    G().menus.close();
    // the rule over many rolls: Legendary only, never one you own, always an element while any are left
    const els = ['battery', 'freezerPack', 'nailPolish', 'paperFan', 'glitter'];
    for (const id of els) run.owned.delete(id);                       // back to owning just fire
    let bad = 0, rolls = 0, lastOnly = 0;
    stub(run.ui, 'choose', (t, s, list) => {
      rolls++;
      if (list.some((c) => c.rarity !== 'legendary' || run.owned.has(c.id)) || !list.some((c) => ELEMENTS_IDS.includes(c.id))) bad++;
    });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});
    let treasures = 0;
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => !ELEMENTS_IDS.includes(c.id))) treasures++; });
    for (let i = 0; i < 100; i++) run.pickLegendary('', '', () => {});   // Legendary treasures turn up too (Hand Mirror, Snooze Button)
    for (const id of els.slice(0, 4)) run.owned.add(id);              // one element left
    stub(run.ui, 'choose', (t, s, list) => { if (list.some((c) => c.id === 'glitter')) lastOnly++; else bad++; });
    for (let i = 0; i < 50; i++) run.pickLegendary('', '', () => {});
    restore();
    return ok(/Metamorphosis/.test(first) && /Legendary/.test(second) && offered.length === 3 && !offered.includes('Birthday Candle')
      && tiers.every((t) => t === 'Legendary') && /Act 1 complete/.test(third) && !bad && rolls === 100 && lastOnly === 50 && treasures > 30,
      { first, second, offered, tiers, third, bad, rolls, lastOnly, treasures });
  },
});

story('boss/xp-comes-to-you', {
  about: 'Once a boss is beaten, all the XP around the arena (its own and its summons\') flies to you, and any still on its way counts when the metamorphosis opens.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, xpDrops } = G();
    step(180);
    const A = run.stage.boss;
    for (let k = 0; k < 6; k++) xpDrops.drop(V(A.arenaMin[0] + 0.1 + k * 0.2, 0.02, A.arenaMax[2] - 0.1), 1, 3);   // XP from summons, far from you
    const before = run.purse;
    run.boss.hp = 0; run.boss.dead = true;
    step(90);
    const flewIn = run.purse - before;
    const leftWhenDone = xpDrops.list.length;
    return ok(flewIn >= 18 + 30 - 5 && leftWhenDone === 0, { flewIn, leftWhenDone });
  },
});

story('boss/ends-after-a-quick-restart', {
  about: 'A run restarted in the moment between a boss falling and the metamorphosis (dying to a stray shot, then Try again): the next boss still ends when it\'s beaten.',
  setup() { fresh({ bubbles: false, lash: false, hurt: false }); G().run.startBossIntro(); },
  play() {
    const { run, menus } = G();
    step(180);
    run.boss.hp = 0; run.boss.dead = true;
    step(2);                                       // the boss is down; its metamorphosis is 2.2 s away
    const first = run.bossWon;
    run.start(); run.startPicked = true;           // restarted before it comes
    run.startBossIntro();
    step(180);
    const second = run.phase === 'boss' && !run.bossWon;
    run.boss.hp = 0; run.boss.dead = true;
    step(2);
    menus.close();
    return ok(first && second && run.bossWon, { first, second, wonAgain: run.bossWon });
  },
});

story('modes/dev-fight-boss', {
  about: 'The pause menu\'s Fight boss (dev) button opens the boss picker; picking this act\'s boss starts a fresh run that goes straight to it.',
  setup() { fresh(); },
  play() {
    const { run, menus } = G();
    document.getElementById('g-over').hidden = false;
    document.querySelector('#g-over [data-act="boss"]').click();
    [...document.querySelectorAll('.btns button')].find((b) => b.textContent === 'The Vacuum (boss, act 1)')?.click();
    document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
    step(240, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss'; });
    return ok(run.phase === 'boss' && !!run.boss && run.t < 10, { phase: run.phase, t: run.t });
  },
});

story('elites/hud-health-bar', {
  about: 'While an elite fights you, its name and health show on the HUD under the clock (and drop as you hit it); walk away and the bar goes. Its own bar over it turns from green toward red.',
  setup() { fresh({ bubbles: false, lash: false }); tp(0.66, 0.78, 2.95, 0); },
  play() {
    const { run } = G(), mug = run.elites.list.find((e) => e.kind === 'mug');
    const bar = () => document.querySelector('#hud .elite');
    step(20);
    const shown = !bar().hidden && /MUG/.test(bar().innerText);
    const full = bar().querySelector('i').style.transform;
    const green = mug.fill.material.color.g > mug.fill.material.color.r;
    mug.hp = mug.maxHp * 0.3;
    step(2);
    const after = bar().querySelector('i').style.transform, red = mug.fill.material.color.r > mug.fill.material.color.g;
    tp(4.5, 0.05, 0.5, 0);   // beyond every act-1 elite's expanded wake distance
    step(20);
    const gone = bar().hidden;
    return ok(shown && full === 'scaleX(1)' && /scaleX\(0\.3/.test(after) && green && red && gone, { shown, full, after, green, red, gone });
  },
});

story('elites/tougher-and-quicker', {
  about: 'Elites have their file Health in act 1 (the Mug: 250) and recover at normal speed: a 1.2 s rest has 0.2 s left after 1 s.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() {
    const { run } = G(), mug = run.elites.list.find((e) => e.kind === 'mug');
    const hp = mug?.maxHp === Math.round(250 * (run.elites.hpScale || 1));
    mug.cool = 1.2;
    step(60);
    return ok(hp && Math.abs(mug.cool - 0.2) < 0.03, { maxHp: mug?.maxHp, cool: +mug.cool.toFixed(3) });
  },
});
story('elites/hall-clock-hangs-in-act-1', {
  about: 'In act 1 the detailed hall clock hangs over the cubby bench as a plain clock (you can see down the hall), in place of the apartment\'s simple one.',
  setup() { fresh(); },
  play() {
    const { run } = G(), c = run.elites.decor.find((d) => d.kind === 'clock');
    let oldShown = false; G().APT.root.traverse((o) => { if (/^Ornate_wall_clock/.test(o.name) && o.isMesh && o.visible) oldShown = true; });
    return ok(c && !oldShown && Math.abs(c.holder.position.y - 1.12) < 0.02 && !run.elites.list.some((e) => e.kind === 'clock'), { clock: !!c, oldShown, y: c && +c.holder.position.y.toFixed(3) });
  },
});
story('modes/dev-one-on-one', {
  about: 'The pause menu\'s 1 on 1 (dev) button lists every enemy; picking one starts a run with just it (it comes back after you clear it), and an elite puts you on its high ground.',
  setup() { fresh(); },
  play() {
    const { run, enemies } = G();
    const pickFrom = (name) => {
      document.getElementById('g-over').hidden = false;
      document.querySelector('#g-over [data-act="duel"]').click();
      const btn = [...document.querySelectorAll('.btns button')].find((b) => b.textContent === name);
      btn?.click();
      document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
      return !!btn;
    };
    const listed = pickFrom('House fly');
    stub(run, 'hurt', () => {}); stub(run.bubbles, 'update', () => {}); stub(run.lash, 'update', () => {});
    step(60 * 4);
    const bugs = () => enemies.list.filter((e) => !e.dead && !e.proxy);
    const alone = bugs().length === 1 && bugs()[0].type === 'housefly';
    enemies.applyDamage(bugs()[0], 1e4);
    step(30);
    const gone = bugs().length === 0;
    step(90);
    const back = bugs().length === 1 && bugs()[0].type === 'housefly';
    const all = ['The Controller', 'The Mug', 'The Kettle', 'The Soap Dispenser', 'The Wall Clock', 'The Cream Whipper'].every((n) => run.duelChoices().some((p) => p.name.startsWith(n + ' (elite')));
    const elite = pickFrom('The Mug (elite, act 1)');
    step(30);
    const mug = run.elites.alive.length === 1 && run.elites.alive[0].spec.kind === 'mug' && G().player.position.y > 0.6 && bugs().length === 0;
    return ok(listed && alone && gone && back && elite && mug && all, { listed, alone, gone, back, elite, mug, all, y: +G().player.position.y.toFixed(2) });
  },
});
story('modes/dev-fight-boss-picker', {
  about: 'The pause menu\'s Fight boss (dev) button lists every act\'s boss; picking one starts a fresh run straight at its intro (a boss from another act reloads into that act first).',
  setup() { fresh(); },
  play() {
    const { run } = G();
    // every act with a boss offers it, labelled with its act
    const picks = run.bossChoices();
    const listed = STAGES.filter((st) => st.boss).every((st) => picks.some((p) => p.act === st.id && p.name === `${st.boss.name} (boss, act ${st.id})`));
    // open the picker and choose this act's boss
    document.getElementById('g-over').hidden = false;
    document.querySelector('#g-over [data-act="boss"]').click();
    const btn = [...document.querySelectorAll('.btns button')].find((b) => b.textContent === 'The Vacuum (boss, act 1)');
    btn?.click();
    document.getElementById('g-over').hidden = true;   // desktop closes the menu once the mouse locks (not in a headless browser)
    const intro = run.phase === 'intro';
    step(240);
    return ok(listed && !!btn && intro && !!run.boss, { listed, btn: !!btn, intro, boss: !!run.boss, phase: run.phase });
  },
});

story('treasures/spots-not-on-vent-landings', {
  about: 'No treasure spot sits on a vent\'s landing point: the ones that did moved over, onto the same surface.',
  setup() { fresh(); },
  play() {
    const { run, traversal } = G();
    const lands = traversal.vents.map((v) => v.land);
    const bad = run.spots.filter((sp) => lands.some((L) => Math.hypot(L[0] - sp.at[0], L[2] - sp.at[2]) < 0.13 && Math.abs(L[1] - sp.y) < 0.08)).map((sp) => sp.label);
    const moved = run.spots.filter((sp) => { const o = run.stage.spots.find((q) => q.label === sp.label); return o && (o.at[0] !== sp.at[0] || o.at[2] !== sp.at[2]); })
      .map((sp) => `${sp.label} ${sp.at.map((v) => v.toFixed(2)).join(',')}`);
    return ok(!bad.length && moved.length >= 4 && run.spots.length >= 12 && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])), { bad, moved, kept: run.spots.length, rejects: run.spotRejects });
  },
});

story('engine/tentacles-swim-smoothly', {
  about: 'The jelly\'s tentacles are a simulated chain: swimming drags them out behind, and they move smoothly (no frame-to-frame jitter at the tips).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.0, 3.0, 0); },
  play() {
    const { input, player } = G();
    const rig = player.avatar.tentacles, tips = [];
    step(30);
    input.keys = new Set(['KeyW']);
    for (let i = 0; i < 120; i++) { step(1); tips.push(rig.list.map((T) => T.sim[T.sim.length - 1].clone())); }
    // trailing: the tips sit behind the roots, against the swim direction
    const back = rig.list.reduce((a, T) => a + T.sim[T.sim.length - 1].clone().sub(T.sim[0]).dot(player.velocity.clone().setY(0).normalize()), 0) / rig.list.length;
    input.keys = new Set();
    let jerk = 0, n = 0;
    for (let f = 2; f < tips.length; f++) for (let k = 0; k < tips[f].length; k++, n++) jerk += tips[f][k].clone().sub(tips[f - 1][k].clone().multiplyScalar(2)).add(tips[f - 2][k]).length();
    jerk /= n;
    return ok(jerk < 0.03 && back < -0.1, { jerk: +jerk.toFixed(4), back: +back.toFixed(3) });
  },
});

story('engine/music-renders-and-builds', {
  about: 'The soundtrack (music.js) plays every act\'s exploring song and the boss song, and more intensity brings in more layers (louder, busier).',
  setup() { fresh({ elites: false }); },
  async play() {
    const { Music } = await import('../music.js');
    const rms = async (song, I) => {
      const ctx = new OfflineAudioContext(1, 16000 * 4, 16000), m = new Music(ctx, ctx.destination);
      m.play(song, 0.05);
      m.I = I;
      m.schedule(4);
      const d = (await ctx.startRendering()).getChannelData(0);
      let sum = 0;
      for (let i = 16000; i < d.length; i++) sum += d[i] * d[i];
      return Math.sqrt(sum / (d.length - 16000));
    };
    const songs = {};
    for (const song of ['drift', 'tide', 'bloom']) songs[song] = { quiet: +(await rms(song, 0)).toFixed(4), loud: +(await rms(song, 1)).toFixed(4) };
    const boss = await rms('machinery', 0.9);
    const builds = Object.values(songs).every((r) => r.quiet > 0.002 && r.loud > r.quiet * 1.5);
    const st = G().run.musicState();
    return ok(builds && boss > 0.01 && st.song === 'drift', { ...songs, boss: +boss.toFixed(4), song: st.song });
  },
});

story('engine/each-act-has-its-own-music', {
  about: 'Exploring acts 1, 2 and 3 plays each act\'s own song (its stage\'s `music`): "Puddle Drift", "Ephyra Tide", "Medusa Bloom", three different songs that all exist.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { SONGS } = await import('../music.js');
    const { run } = G(), real = run.stage, played = [];
    try { for (const S of STAGES.slice(0, 3)) { run.stage = S; played.push(run.musicState().song); } } finally { run.stage = real; }
    const distinct = new Set(played).size === 3 && played.every((n) => SONGS[n]);
    return ok(distinct && played[0] === 'drift' && run.musicState().song === 'drift', { played, names: played.map((n) => SONGS[n]?.name) });
  },
});
