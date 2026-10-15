// Stories: the behaviour words, and the guards on content and vocabulary. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus, PLAYER } from '../events.js';
import { ENEMY_WORDS } from '../words.js';
import { CONTENT, compileEnemies } from '../content.js';
import { TREASURES, STAT_INFO, EVOLUTIONS } from '../stats.js';
import { parse } from '../kdl.js';
import { LOOK } from '../look.js';
import { SPECIES, buildCharacter, normalizeLook } from '../character.js';
import { TeleMaterial } from '../vfx.js';
import { buildNest, buildWasp, NEST } from '../critters.js';
import { applyState } from '../cat.js';
import { G, STORIES, V, fresh, holdJelly, near, ok, pothosFloor, record, shownWarnings, sim, spawn, step, story, stub, tp, volumePairs, warningsAt } from './kit.js';

// --- the vocabulary: one story per behaviour word (src/words.js), proving what it does
story('words/chase', {
  about: 'chase: a cockroach walks straight at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0.35, 0)); },
  play() { const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position); step(60); const d1 = e.pos.distanceTo(G().player.position); return ok(d0 - d1 > 0.2, { before: +d0.toFixed(3), after: +d1.toFixed(3) }); },
});
story('words/curl-dash', {
  about: 'curl-dash: an ant squad stops, curls into a ball, and rolls at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', near(0.25, 0)); },
  play() {
    const e = G().enemies.list[0], seen = new Set();
    let dashSpeed = 0;
    step(60 * 6, () => { seen.add(e.state); if (e.state === 'dash') dashSpeed = Math.max(dashSpeed, Math.hypot(e.vel.x, e.vel.z)); return seen.has('rest'); });
    return ok(seen.has('windup') && seen.has('dash') && dashSpeed > 0.5, { states: [...seen], dashSpeed: +dashSpeed.toFixed(2) });
  },
});
story('enemies/spider-web-ball', {
  about: 'The house spider walks on alternating sets of legs, rears up to aim, and lobs a web ball that arcs (rising, then falling) onto you: it stings and slows you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('spider', near(0, -0.85)); e.shootT = 99; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0];
    const log = record('damage_taken');
    // walking: its legs move (the model animates with its speed)
    step(40);
    const moved = e.pos.distanceTo(G().player.position) < 0.78;
    e.shootT = 0.7;
    let reared = false, ys = [], hit = null, slowed = 0;
    step(60 * 4, () => {
      if (e.aimT > 0) reared = true;
      const s = enemies.shots.find((q) => q.web);
      if (s) ys.push(s.m.position.y);
      e.pos.copy(near(0, -0.6));                     // hold it at range so it shoots
      hit = log.find((d) => d.source === 'web');
      if (hit) slowed = run.slowT;
      return !!hit;
    });
    const peak = Math.max(...ys), arcs = ys.length > 3 && peak > ys[0] + 0.005 && ys[ys.length - 1] < peak;
    return ok(moved && reared && arcs && hit && hit.amount === 3 && slowed > 1, { moved, reared, arcs, peak: +peak.toFixed(3), hit: hit?.amount, slowed: +slowed.toFixed(2) });   // spit damage 3 since v144 (this story predates it)
  },
});
story('words/poke', {
  about: 'The house fly buzzes in beside you, rubs its front legs and draws back while a short line on the floor marks its strike, then pokes you with its straw of a mouth: 4 damage.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('housefly', near(0.2, 0, 0.03)); e.pokeCd = 0.8; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let warned = false, out = 0, hit = null, closest = 9;
    step(60 * 5, () => {
      if (e.state === 'windup' && enemies.pokeMarks.some((m) => m.visible)) warned = true;
      if (e.state === 'poke') out = Math.max(out, e.pokeK);
      closest = Math.min(closest, e.pos.distanceTo(player.position.clone().setY(player.position.y + CONFIG.player.height * 0.5)));
      hit = log.find((d) => d.source === 'housefly' && d.amount === 4);   // poke damage 4 since the v144 batch (this story predates it)
      return !!hit;
    });
    return ok(warned && out === 1 && hit && closest > 0.06, { warned, out, hit: hit?.amount, closest: +closest.toFixed(3) });
  },
});
story('enemies/housefly-poke-dodge', {
  about: 'Backing out of the fly\'s reach once its aim locks makes the poke miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('housefly', near(0.2, 0, 0.03)); e.pokeCd = 0.8; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, poked = false;
    step(60 * 5, () => {
      if (!moved && e.state === 'windup' && e.faceLock) {
        // step straight back from it, out of reach
        const d = player.position.clone().sub(e.pos).setY(0).normalize(), P = player.position;
        tp(P.x + d.x * 0.12, P.y, P.z + d.z * 0.12);
        moved = true;
      }
      if (e.state === 'poke') poked = true;
      return poked && e.state === 'rest';
    });
    const pokes = log.filter((d) => d.amount === 3);
    return ok(moved && poked && !pokes.length, { moved, poked, hits: log.map((d) => d.amount) });
  },
});
story('enemies/spider-keeps-its-distance', {
  about: 'Left to itself, the house spider stalks to about 30 cm from you and stays there (backing off if you close in), lobbing webs from range instead of walking into you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('spider', near(0, -0.55)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let launched = 0, was = 0, closest = 9;
    step(60 * 10, (i) => {
      const n = enemies.shots.filter((q) => q.web).length;
      if (n > was) launched++;
      was = n;
      if (i > 120) closest = Math.min(closest, Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z));
    });
    // walk up to it: it backs away
    const before = Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z);
    tp(e.pos.x + (player.position.x - e.pos.x) * 0.4, player.position.y, e.pos.z + (player.position.z - e.pos.z) * 0.4);
    const p0 = e.pos.clone(), toMe = player.position.clone().sub(e.pos).setY(0).normalize();
    step(30);
    const backed = e.pos.clone().sub(p0).setY(0).dot(toMe) < -0.01;
    const webs = log.filter((d) => d.source === 'web').length, bumps = log.filter((d) => d.source === 'spider').length;
    return ok(closest > 0.4 && launched >= 2 && webs >= 1 && !bumps && backed, { closest: +closest.toFixed(3), launched, webs, bumps, backed, before: +before.toFixed(3) });
  },
});
story('words/ball-charge', {
  about: 'The millipede curls into a ball (hits on it do 75% less while curled), revs up spinning while its lane lights up on the floor, then rolls into you for 5. Once it uncurls it can be hurt again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let warned = false, armored = null, spun = 0, hit = null;
    step(60 * 6, () => {
      seen.add(e.state);
      if (e.state === 'spin' && enemies.chargeMarks.some((m) => m.visible)) warned = true;
      if (e.state === 'spin' && armored === null) { const hp = e.hp; enemies.applyDamage(e, 20); armored = Math.abs(hp - e.hp - 5) < 1e-6; }   // 20 hits for 5
      spun = Math.max(spun, e.spinA || 0);
      hit = hit || log.find((d) => d.source === 'millipede' && d.amount === 5);   // ball-charge damage 5 since v144
      return hit && e.state === 'rest';
    });
    const hp = e.hp;
    enemies.applyDamage(e, 10);
    const hurtAfter = e.hp === hp - 10;
    return ok(['curl', 'spin', 'dash'].every((s) => seen.has(s)) && warned && armored && spun > 5 && hit && hurtAfter,
      { states: [...seen], warned, armored, spun: +spun.toFixed(1), hit: hit?.amount, hurtAfter });
  },
});
story('enemies/millipede-dodge', {
  about: 'Stepping out of the millipede\'s lane once its aim locks makes it roll past you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, rolled = false;
    step(60 * 6, () => {
      if (!moved && e.state === 'spin' && e.stateT < (e.spinMax || 0.9) * 0.4) {
        const d = e.dashDir, P = player.position;
        tp(P.x - d.z * 0.16, P.y, P.z + d.x * 0.16);
        moved = true;
      }
      if (e.state === 'dash') rolled = true;
      return rolled && e.state === 'rest';
    });
    const rolls = log.filter((d) => d.amount === 4);
    return ok(moved && rolled && !rolls.length, { moved, rolled, hits: log.map((d) => d.amount) });
  },
});
story('enemies/millipede-slithers', {
  about: 'The millipede snakes toward you from side to side, its body following the path its head took.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.9)); e.ballCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    const start = e.pos.clone(), path = [];
    step(60 * 2.5, () => { path.push(e.pos.clone()); });
    // sideways wander from the straight line toward you
    const dir = player.position.clone().sub(start).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const offs = path.map((p) => p.clone().sub(start).dot(side)), weave = Math.max(...offs) - Math.min(...offs);
    // the tail lies back along the path, a body length behind the head
    e.root.updateMatrixWorld(true);
    const tail = e.mesh.children[0].children.at(-1).getWorldPosition(new THREE.Vector3());
    const behind = tail.distanceTo(e.pos), along = path.some((p) => p.distanceTo(tail) < 0.06);
    return ok(weave > 0.02 && behind > 0.15 && along, { weave: +weave.toFixed(3), behind: +behind.toFixed(3), along });
  },
});
story('enemies/millipede-never-overlaps', {
  about: 'However you dart round behind it, the millipede\'s body never folds through itself: it swings round in arcs and its rings keep apart.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.5)); e.ballCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    const segs = e.mesh.children[0].children, wide = 0.92 * e.r, v = new THREE.Vector3(), pts = segs.map(() => new THREE.Vector3());
    let worst = 9, at = 0;
    step(60 * 6, (i) => {
      // keep darting round behind it, so it has to turn right round to follow
      if (i % 50 === 0) {
        const c = e.pos, side = (i / 50) % 2 ? 1 : -1;
        tp(c.x - Math.sin(e.root.rotation.y) * 0.2 + Math.cos(e.root.rotation.y) * 0.06 * side, player.position.y, c.z - Math.cos(e.root.rotation.y) * 0.2 - Math.sin(e.root.rotation.y) * 0.06 * side);
      }
      if (i < 30) return;
      e.root.updateMatrixWorld(true);
      segs.forEach((s, k) => s.getWorldPosition(pts[k]));
      for (let a2 = 0; a2 < pts.length; a2++) for (let b = a2 + 3; b < pts.length; b++) {
        const d = v.copy(pts[a2]).sub(pts[b]).setY(0).length();
        if (d < worst) { worst = d; at = i; }
      }
    });
    return ok(worst > wide * 0.75, { worst: +worst.toFixed(4), wide: +wide.toFixed(4), frame: at });
  },
});
story('bubbles/never-linger', {
  about: 'With six bubbles a blow, the outside ones (aimed to the side of the target) fly on past and pop at the end of their range: none slow down and hang in the air.',
  setup() { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); G().run.stats.bubbles = 6; const e = spawn('roach', near(0, -0.25), { still: true, hp: 1e6 }); },
  play() {
    const { run } = G();
    let oldest = 0, slowest = 9, blown = 0;
    step(60 * 6, () => {
      for (const b of run.bubbles.list) { oldest = Math.max(oldest, b.t); if (b.t > 0.1) slowest = Math.min(slowest, b.vel.length()); }
      blown = Math.max(blown, run.bubbles.list.length);
    });
    return ok(blown >= 6 && oldest < 1.5 && slowest > 0.2, { blown, oldest: +oldest.toFixed(2), slowest: +slowest.toFixed(3) });
  },
});
story('words/sortie', {
  about: 'The ladybug flies round you, lands, lifts its red carapace and locks on (a red reticle closing in round you), then fires a homing missile that hits you for 5.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 1.2; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let flewHigh = false, landedLow = false, raised = false, reticle = false, launched = false, hit = null;
    step(60 * 8, () => {
      seen.add(e.state);
      if (e.state === 'approach' && e.pos.y > player.position.y + 0.07) flewHigh = true;
      if (e.state === 'aim') { if (Math.abs(e.pos.y - 0.76 * e.r - player.position.y) < 0.02) landedLow = true; if (e.shellK === 1) raised = true; if (enemies.lockMarks.some((m) => m.visible)) reticle = true; }
      if (enemies.missiles.length) launched = true;
      hit = log.find((d) => d.source === 'missile');
      return !!hit;
    });
    return ok(flewHigh && landedLow && raised && reticle && launched && hit?.amount === 5, { states: [...seen], flewHigh, landedLow, raised, reticle, launched, hit: hit?.amount });   // sortie damage 5 since v144
  },
});
story('enemies/dragonfly-model', {
  about: 'The dragonfly (act 3) is about 3 radii long and 4 across its four wings, which beat as it flies about you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.25, 0, 0.1)); e.beamCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], box = new THREE.Box3(), size = new THREE.Vector3();
    let tall = 9, high = 0, close = 9;
    const measure = () => {        // its size facing +z, in radius units
      const q = e.root.quaternion.clone(), mq = e.mesh.quaternion.clone();
      e.root.quaternion.identity(); e.mesh.quaternion.identity(); e.root.updateMatrixWorld(true);
      box.setFromObject(e.mesh).getSize(size).divideScalar(e.mesh.scale.x);
      e.root.quaternion.copy(q); e.mesh.quaternion.copy(mq); e.root.updateMatrixWorld(true);
      return size;
    };
    step(60 * 2, () => {
      const y = measure().y;
      tall = Math.min(tall, y); high = Math.max(high, y);
      close = Math.min(close, e.pos.distanceTo(player.position));
    });
    const long = measure().z, span = size.x;
    return ok(long > 2.6 && long < 3.8 && span > 3.4 && span < 4.6 && high - tall > 0.3 && close < 0.4, { long: +long.toFixed(2), span: +span.toFixed(2), flap: +(high - tall).toFixed(2), close: +close.toFixed(2) });
  },
});
// the dragonfly's darts: each time it sets off (zipLeft goes up from 0), the way it went
const darts = (e, secs, each) => {
  const out = [];
  let was = 0;
  step(60 * secs, () => { if (e.zipLeft > 0 && was <= 0) out.push(e.zipDir.clone()); was = e.zipLeft; each?.(); });
  return out;
};
story('words/zip', {
  about: 'The dragonfly closes in by darting: it hangs still, then zips a short way in a new direction each time (sideways, up, down, even back), not straight at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.7, 0, 0.1)); e.beamCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], pc = player.position, start = e.pos.distanceTo(pc);
    let still = 0, frames = 0, notAtYou = 0, n = 0, closest = start;
    const d = darts(e, 6, () => {
      frames++;
      closest = Math.min(closest, e.pos.distanceTo(pc));
      if (e.vel.length() < 0.05) still++;
      if (e.zipLeft > 0 && e.zipDir.dot(S2.copy(pc).sub(e.pos).setY(0).normalize()) < 0.7) notAtYou++;
      if (e.zipLeft > 0) n++;
    });
    let turn = 0;
    for (let i = 1; i < d.length; i++) turn += d[i].angleTo(d[i - 1]);
    turn /= Math.max(1, d.length - 1);
    // it closes in (by zigzags, so how close it is at any one moment varies: the closest it came)
    return ok(d.length >= 8 && turn > 0.6 && notAtYou >= n / 3 && still / frames > 0.25 && closest < start - 0.25, { darts: d.length, turn: +turn.toFixed(2), notAtYou: +(notAtYou / Math.max(1, n)).toFixed(2), still: +(still / frames).toFixed(2), start: +start.toFixed(2), closest: +closest.toFixed(2) });
  },
});
const S2 = new THREE.Vector3();
story('words/charge-beam', {
  about: 'Within reach the dragonfly faces you and holds dead still for 2 s with only a building whine for a warning (nothing on screen), then its beam hits you instantly: 3 damage.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.3, 0, 0.08)); e.beamCd = 0; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    let whined = 0;
    const real = enemies.beamCharge;
    enemies.beamCharge = function (x, dur) { whined = dur; return real.call(this, x, dur); };
    step(60 * 3, () => e.state === 'charge');
    const at = e.pos.clone();
    let held = 0, shown = false, frames = 0;
    step(60 * 3, () => {
      frames++;
      held = Math.max(held, e.pos.distanceTo(at));
      if (enemies.aimBeams.some((b) => b.visible) || enemies.pokeMarks.some((m) => m.visible) || enemies.chargeMarks.some((m) => m.visible)) shown = true;
      return log.some((d) => d.source === 'dragonfly');
    });
    delete enemies.beamCharge;
    const hit = log.find((d) => d.source === 'dragonfly'), secs = frames / 60;
    return ok(whined === 2 && hit?.amount === 3 && held < 0.001 && !shown && secs > 1.9 && secs < 2.1, { whined, hit: hit?.amount, held: +held.toFixed(4), shown, secs: +secs.toFixed(2) });
  },
});
story('enemies/dragonfly-beam-dodge', {
  about: 'The dragonfly\'s beam goes the way it faced when it began to charge: moving off that line during the charge makes it miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.3, 0, 0.08)); e.beamCd = 0; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 3, () => e.state === 'charge');
    const charged = e.state === 'charge';
    step(60);
    const side = V(-e.beamDir.z, 0, e.beamDir.x).normalize(), P = player.position;
    tp(P.x + side.x * 0.1, P.y, P.z + side.z * 0.1);
    let fired = false;
    step(60 * 1.5, () => { if (e.state === 'rest') fired = true; return fired; });
    const hit = log.some((d) => d.source === 'dragonfly');
    return ok(charged && fired && !hit, { charged, fired, hit });
  },
});
story('words/evade', {
  about: 'Hit the dragonfly and it darts away in a random direction, but only once every 5 s: a second hit soon after doesn\'t move it.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.35, 0, 0.08), { hp: 999 }); e.beamCd = 99; },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    const hitAndWatch = () => {
      e.zipT = 99; e.zipLeft = 0;                              // hanging still, so any move is the dodge
      step(10);
      const at = e.pos.clone();
      bus.emit('damage_taken', { targetId: e.id, amount: 1 });
      step(Math.round(60 * 0.3));
      return e.pos.distanceTo(at);
    };
    const first = hitAndWatch();
    step(60);
    const second = hitAndWatch();
    step(60 * 4);
    const third = hitAndWatch();
    return ok(first > 0.15 && second < 0.01 && third > 0.15, { first: +first.toFixed(3), second: +second.toFixed(3), third: +third.toFixed(3) });
  },
});
story('enemies/dragonfly-dodge-breaks-charge', {
  about: 'Hitting a charging dragonfly makes it dodge, and the dodge breaks off its charge: no beam.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.3, 0, 0.08), { hp: 999 }); e.beamCd = 0; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 3, () => e.state === 'charge');
    const charged = e.state === 'charge';
    step(30);
    bus.emit('damage_taken', { targetId: e.id, amount: 1 });
    step(5);
    const broke = e.state === 'approach';
    e.beamCd = 99;
    step(60 * 2.5);
    const hit = log.some((d) => d.source === 'dragonfly' && d.amount === 3);   // the beam (not a brush against it as it dodges)
    return ok(charged && broke && !hit, { charged, broke, hit });
  },
});
story('words/swat', {
  about: 'Up close the mantis rears up with its forelegs raised (nothing shows on the floor), then lunges and snaps them shut: 3 damage if you\'re in front of it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mantis', near(0.12, 0)); e.swatCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    let reared = false, marked = false;
    step(60 * 4, () => {
      if (e.state === 'windup' && !reared) {
        reared = true;                                   // anything drawn on the floor near it? (a Warning is a TeleMaterial)
        e.root.parent.traverse((o) => { if (o.visible && o.material instanceof TeleMaterial && o.position.distanceTo(e.pos) < 0.5) marked = true; });
      }
      return log.some((d) => d.source === 'mantis' && d.amount === 3);
    });
    const hit = log.find((d) => d.source === 'mantis' && d.amount === 3);
    return ok(reared && !marked && hit?.amount === 3, { reared, marked, hit: hit?.amount });
  },
});
story('enemies/mantis-swat-dodge', {
  about: 'Backing out of the mantis\'s reach once its aim locks makes the swat miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mantis', near(0.12, 0)); e.swatCd = 0.3; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, swatted = false, gap = 0;
    step(60 * 4, () => {
      if (!moved && e.state === 'windup' && e.stateT < e.swatMax * 0.4) {
        const P = player.position;
        tp(P.x + e.swatDir.x * 0.2, P.y, P.z + e.swatDir.z * 0.2);
        moved = true;
      }
      if (e.state === 'swat' && !swatted) { swatted = true; gap = Math.hypot(player.position.x - e.pos.x, player.position.z - e.pos.z); }
      return swatted && e.state === 'rest';
    });
    const hit = log.some((d) => d.source === 'mantis' && d.amount === 3);
    return ok(moved && swatted && !hit, { moved, swatted, hit, gap: +gap.toFixed(3) });
  },
});
story('words/hatch', {
  about: 'When the mantis dies, the worm that was inside it takes its place: where it fell, facing the same way, the mantis gone.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mantis', near(0.4, 0), { still: true }); },
  play() {
    const { enemies } = G(), m = enemies.list[0];
    step(10);
    m.root.rotation.y = 1.1;
    const at = m.pos.clone();
    bus.emit('damage_taken', { targetId: m.id, amount: 9999 });
    const w = enemies.list.find((x) => x.type === 'worm' && !x.dead);
    return ok(m.dead && w && w.pos.distanceTo(at) < 1e-6 && Math.abs(w.root.rotation.y - 1.1) < 1e-6 && w.state === 'emerge', { dead: m.dead, worm: !!w, state: w?.state });
  },
});
story('words/burst', {
  about: 'The mantis\'s carcass twitches while a circle fills round its rear end, then the worm bursts out of the tip of its abdomen: 2 damage if you\'re inside the circle.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0.3, 0)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(1);
    const out = e.emergeAt, round = Math.hypot(out.x - e.pos.x, out.z - e.pos.z) > e.r;   // it comes out away from the middle (the rear end)
    tp(out.x, player.position.y, out.z);                                                   // stand right where it comes out
    let warned = false, frames = 1;
    step(60 * 2, () => {
      frames++;
      if (e.state === 'emerge' && enemies.burstMarks.some((m) => m.visible)) warned = true;
      return log.some((d) => d.source === 'worm' && d.amount === 2);
    });
    const hit = log.find((d) => d.source === 'worm' && d.amount === 2), secs = frames / 60;
    return ok(round && warned && hit?.amount === 2 && secs > 0.85 && secs < 1, { round, warned, hit: hit?.amount, secs: +secs.toFixed(2) });
  },
});
story('enemies/worm-burst-clear', {
  about: 'Standing outside the circle when the worm bursts out of the mantis\'s carcass, you\'re not hurt.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0, -0.15)); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 1.3);
    return ok(e.state !== 'emerge' && !log.some((d) => d.source === 'worm' && d.amount === 2), { state: e.state, hits: log.length });
  },
});
story('words/rooted', {
  about: 'The worm can\'t leave the mantis\'s body: it doesn\'t walk, turn or get knocked back, however you move round it.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0.4, 0)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    step(60 * 1.2);
    const at = e.pos.clone(), yaw = e.root.rotation.y;
    bus.emit('knockback', { targetId: e.id, dir: V(1, 0, 0), force: 0.1 });
    const P = player.position;
    tp(P.x - 0.3, P.y, P.z + 0.3);
    step(60 * 2);
    const moved = e.pos.distanceTo(at), turned = Math.abs(e.root.rotation.y - yaw);
    return ok(moved < 1e-3 && turned < 1e-6, { moved: +moved.toFixed(4), turned: +turned.toFixed(4) });
  },
});
story('words/whip', {
  about: 'Out of the mantis\'s carcass, the worm rears up and back while a line on the floor shows where it will strike, then cracks down along it like a whip: 3 damage.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0.18, 0)); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    let warned = false;
    step(60 * 5, () => {
      if (e.state === 'windup' && enemies.whipMarks.some((m) => m.visible)) warned = true;
      return log.some((d) => d.source === 'worm' && d.amount === 3);
    });
    const hit = log.find((d) => d.source === 'worm' && d.amount === 3);
    return ok(warned && hit?.amount === 3, { warned, hit: hit?.amount });
  },
});
story('enemies/worm-whip-dodge', {
  about: 'Stepping off the worm\'s line once its aim locks makes the whip miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0.18, 0)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    let moved = false, cracked = false;
    step(60 * 5, () => {
      if (!moved && e.state === 'windup' && e.stateT < e.whipMax * 0.4) {
        const P = player.position;
        tp(P.x - e.whipDir.z * 0.08, P.y, P.z + e.whipDir.x * 0.08);
        moved = true;
      }
      if (e.state === 'down') cracked = true;
      return cracked;
    });
    const hit = log.some((d) => d.source === 'worm' && d.amount === 3);
    return ok(moved && cracked && !hit, { moved, cracked, hit });
  },
});
// the wasp and its nest (models only for now: act 3): shown hanging and hovering in front of you
let waspShow = null;
story('models/wasp-and-nest', {
  about: 'The wasp nest is about four times as tall as the wasp is long, scaled the same, and the wasp flies beside it with its wings a blur.',
  setup() {
    fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0);
    if (waspShow) for (const m of waspShow.group.children.slice()) m.parent.remove(m);
    const r = 0.03, group = waspShow?.group || new THREE.Group(), nest = buildNest(), wasp = buildWasp();
    group.add(nest.body, wasp.body);
    nest.body.scale.setScalar(r); nest.body.position.copy(near(0, -0.45, 0.4 - NEST.height / 2 * r));   // hanging in front of you, its top 40 cm up
    wasp.body.scale.setScalar(r); wasp.body.position.copy(near(0.2, -0.42, 0.25));
    G().enemies.scene.add(group);
    waspShow = { group, nest, wasp, r };
  },
  play() {
    const { nest, wasp, r } = waspShow, box = new THREE.Box3(), size = new THREE.Vector3();
    nest.body.updateMatrixWorld(true);
    const tall = box.setFromObject(nest.body).getSize(size).y / r;
    let low = 9, high = -9;
    for (let i = 0; i < 30; i++) {
      wasp.anim(1 / 60, { phase: 0 });
      wasp.body.updateMatrixWorld(true);
      box.setFromObject(wasp.body).getSize(size);
      low = Math.min(low, size.x); high = Math.max(high, size.x);
    }
    const q = wasp.body.quaternion.clone(); wasp.body.quaternion.identity(); wasp.body.updateMatrixWorld(true);
    const long = new THREE.Box3().setFromObject(wasp.body).getSize(size).z / r;
    wasp.body.quaternion.copy(q);
    const ratio = tall / long;
    waspShow.group.removeFromParent();                   // gone again, so later stories don't draw (and compile) them
    return ok(Math.abs(tall - NEST.height) < 0.3 && ratio > 3.6 && ratio < 4.4 && high - low > 0.001, { tall: +tall.toFixed(2), long: +long.toFixed(2), ratio: +ratio.toFixed(2), flaps: high - low > 0.001 });
  },
});
story('models/dendi-the-cat', {
  about: 'Dendi the cat is never seen during a run: he exists hidden — a skinned tabby (26 bones) with working poses — and only the boss finish brings him out, then hides him again.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const d = window.dendi;
    if (!d) return ok(false, { dendi: null });
    const bones = d.mesh.skeleton.bones.length;
    const hiddenAtBoot = !d.group.visible;
    // posing: loaf and curious hold measurably different neck angles
    applyState(d, 'loaf', 1); const loafQ = d.bones.neck.quaternion.clone();
    applyState(d, 'curious', 1); const curQ = d.bones.neck.quaternion.clone();
    const poses = loafQ.angleTo(curQ) > 0.05;
    // nothing he is made of is solid
    let solid = 0; d.group.traverse((o) => { if (o.isMesh && !o.userData.noCollide) solid++; });
    // the scene's entrances and exits: placeForSmack shows him poised,
    // beginSmack starts the chop, endScene hides him again
    d.placeForSmack(new THREE.Vector3(1, 0, 1), 0);
    const shown = d.group.visible && d.tick(0.05, null) === 'curious';
    d.beginSmack();
    const smacked = d.tick(0.05, null) === 'smack';
    d.endScene();
    return ok(bones >= 26 && hiddenAtBoot && poses && shown && smacked && solid === 0 && !d.group.visible,
      { bones, hiddenAtBoot, poses, shown, smacked, solid, goneAfter: !d.group.visible });
  },
});
story('words/hangs', {
  about: 'A wasp nest stays exactly where it was put, however you move round it or knock it: it doesn\'t fall, turn or slide, and hits anywhere on it count.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('nest', near(0.4, 0, 0.25)); e.broodT = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0];
    step(5);
    const at = e.pos.clone(), yaw = e.root.rotation.y;
    bus.emit('knockback', { targetId: e.id, dir: V(1, 0, 0), force: 0.1 });
    const P = player.position;
    tp(P.x - 0.3, P.y, P.z + 0.3);
    step(60 * 2);
    const moved = e.pos.distanceTo(at), turned = Math.abs(e.root.rotation.y - yaw), size = e.hitR;
    return ok(moved < 1e-6 && turned < 1e-6 && Math.abs(size - 0.13) < 1e-6, { moved, turned, size });
  },
});
story('words/brood', {
  about: 'Every 5 s a wasp crawls out of the entrance at the bottom of its nest.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('nest', near(0.6, 0, 0.25)); },
  play() {
    const { enemies } = G(), nest = enemies.list[0];
    const out = [], real = enemies.hatch;                 // every wasp it sends out (one may sting you and be gone)
    enemies.hatch = function (n, w) { if (n === nest) out.push({ w, at: w.pos.distanceTo(n.emergeAt), below: w.pos.y < n.pos.y }); return real.call(this, n, w); };
    step(Math.round(60 * 4.9));
    const early = out.length;
    step(Math.round(60 * 0.2));
    const first = out[0], at = first?.at, below = first?.below;
    step(60 * 5);
    const later = out.length;
    delete enemies.hatch;
    return ok(early === 0 && first && at < 0.02 && below && later === 2, { early, out: !!first, at: at && +at.toFixed(3), below, later });
  },
});
story('enemies/nest-brood-limit', {
  about: 'A nest stops sending out wasps while six of its own are still alive.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('nest', near(0.6, 0, 0.25)); e.broodT = 0.1; },
  play() {
    const { enemies } = G(), nest = enemies.list[0];
    for (let i = 0; i < 6; i++) { const w = spawn('wasp', near(-0.6, 0, 0.1 + i * 0.03), { still: true }); w.motherId = nest.id; }
    step(60 * 6);
    const n = enemies.list.filter((x) => !x.dead && x.motherId === nest.id).length;
    return ok(n === 6, { wasps: n });
  },
});
story('words/dive', {
  about: 'A wasp rears with a rising buzz, then nosedives at you: the sting does 6, and the wasp dies doing it (no XP for you).',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('wasp', near(0.22, 0, 0.1)); e.diveCd = 0; },
  play() {
    const { enemies, xpDrops } = G(), e = enemies.list[0], log = record('damage_taken'), deaths = record('enemy_killed');
    const drops = xpDrops.list.length;
    let reared = false, dived = false;
    step(60 * 4, () => {
      if (e.state === 'windup') reared = true;
      if (e.state === 'dive') dived = true;
      return log.some((d) => d.source === 'wasp' && d.amount === 6);
    });
    const hit = log.find((d) => d.source === 'wasp' && d.amount === 6);
    step(5);
    return ok(reared && dived && hit && e.dead && deaths[0]?.silent && xpDrops.list.length === drops, { reared, dived, hit: hit?.amount, dead: e.dead, drops: xpDrops.list.length - drops });
  },
});
story('enemies/wasp-dive-dodge', {
  about: 'A wasp dives at where you were when it set off: moving off that line makes it shoot past, and it pulls up and keeps circling.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('wasp', near(0.25, 0, 0.1)); e.diveCd = 0; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 4, () => e.state === 'dive');
    const dived = e.state === 'dive';
    const side = V(-e.diveDir.z, 0, e.diveDir.x).normalize(), P = player.position;
    tp(P.x + side.x * 0.15, P.y, P.z + side.z * 0.15);
    step(60 * 1.5);
    const stung = log.some((d) => d.source === 'wasp' && d.amount === 6);
    return ok(dived && !stung && !e.dead && e.state !== 'dive', { dived, stung, dead: e.dead, state: e.state });
  },
});
story('enemies/wasp-no-xp', {
  about: 'Wasps are worth no XP: popping one drops nothing.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('wasp', near(0.5, 0, 0.1), { still: true }); },
  play() {
    const { enemies, xpDrops, run } = G(), e = enemies.list[0], drops = xpDrops.list.length, kills = run.kills;
    bus.emit('damage_taken', { targetId: e.id, amount: 999 });
    step(5);
    return ok(e.dead && xpDrops.list.length === drops && run.kills === kills + 1, { dead: e.dead, drops: xpDrops.list.length - drops, kills: run.kills - kills });
  },
});
story('enemies/ladybug-missile-glows', {
  about: 'A missile in flight glows orange at its tail and red at its seeker: every glow it adds has a real colour (no black blobs).',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies, fx } = G(), bad = [];
    const hold = fx.glow.hold.bind(fx.glow);
    stub(fx.glow, 'hold', (p, c, ...r) => { if (!c || !c.isColor) bad.push(String(c)); return hold(p, c, ...r); });
    let flew = false;
    step(60 * 5, () => { if (enemies.missiles.some((m) => m.state === 'home')) flew = true; return flew && bad.length > 0; });
    return ok(flew && !bad.length, { flew, bad: bad.slice(0, 3) });
  },
});
story('enemies/ladybug-missile-runs-out', {
  about: 'A homing missile hunts you for 4 s; if it hasn\'t caught you by then it sputters out, falls to the floor and fizzles away.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies } = G(), log = record('damage_taken');
    let m = null, sputterAt = null, minY = 9, down = false, gone = false;
    step(60 * 14, () => {
      if (!m && enemies.missiles.length) { m = enemies.missiles[0]; m.speed = 0.04; }   // too slow to ever catch you
      if (m) {
        if (m.state === 'sputter' && sputterAt === null) sputterAt = m.t;
        if (m.state === 'sputter') minY = Math.min(minY, m.m.position.y);
        if (m.state === 'down') down = true;
        if (down && !enemies.missiles.includes(m)) gone = true;
      }
      return gone;
    });
    return ok(m && Math.abs(sputterAt - 4) < 0.05 && down && gone && !log.some((d) => d.source === 'missile'), { sputterAt: sputterAt && +sputterAt.toFixed(2), down, gone, hits: log.map((d) => d.source) });
  },
});
story('enemies/ladybug-missile-can-be-shaken', {
  about: 'The missile can only turn so fast: swimming hard across its path makes it overshoot.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ladybug', near(0.3, 0, 0.12)); e.stateT = 0.3; },
  play() {
    const { enemies, player } = G(), log = record('damage_taken');
    let m = null, dodged = false;
    step(60 * 12, (i) => {
      if (!m && enemies.missiles.length) m = enemies.missiles[0];
      if (m && m.state === 'home' && !dodged && m.m.position.distanceTo(player.position) < 0.12) {
        // sidestep hard, square to its flight
        const d = m.vel.clone().setY(0).normalize(), P = player.position;
        tp(P.x - d.z * 0.12, P.y, P.z + d.x * 0.12);
        dodged = true;
      }
      return m && !enemies.missiles.includes(m);
    });
    return ok(dodged && !log.some((d) => d.source === 'missile'), { dodged, hits: log.map((d) => d.source) });
  },
});
story('words/hover', {
  about: 'hover: a mosquito circles about 20 cm from you, above your head.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mosquito', near(0.4, 0, 0.1)); e.shootT = 99; },
  play() {
    const e = G().enemies.list[0], pc = () => G().player.position.clone().setY(G().player.position.y + CONFIG.player.height * 0.5);
    step(60 * 4);
    const flat = Math.hypot(e.pos.x - pc().x, e.pos.z - pc().z), above = e.pos.y - pc().y;
    return ok(Math.abs(flat - 0.2) < 0.06 && above > 0.03, { flat: +flat.toFixed(3), above: +above.toFixed(3) });
  },
});
story('words/spit', {
  about: 'spit: a mosquito dips its nose and spits; the shot costs you health.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mosquito', near(0, -0.15, 0.1)); },
  play() {
    const { run } = G();
    run.iFrames = 0;
    const m0 = run.health, e = G().enemies.list[0];
    let aimed = false;
    step(60 * 10, () => { if (e.aimT > 0) aimed = true; return run.health < m0; });
    return ok(aimed && run.health < m0, { aimed, lost: +(m0 - run.health).toFixed(2) });
  },
});
story('words/spit-dodge', {
  about: 'spit: the laser flies down its aiming line, so stepping off the line after it locks on dodges it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mosquito', near(0, -0.2, 0.1)); e.shootT = 0.6; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], P = G().player.position;
    run.iFrames = 0;
    const m0 = run.health;
    let shot = false;
    // wait until the aim has locked, then slip 6 cm to the side
    step(60, () => e.aimT > 0 && e.aimT < 0.2);
    tp(P.x + 0.06, P.y, P.z);
    step(90, () => { if (enemies.shots.length) shot = true; });
    return ok(shot && run.health === m0, { shot, lost: m0 - run.health });
  },
});
story('words/leap', {
  about: 'leap: a lanternfly crawls up, crouches over a marked landing spot, springs high and slams down on you.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('lanternfly', near(0, -0.45)); e.leapCd = 0; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], y0 = e.pos.y;
    run.iFrames = 0;
    const m0 = run.health, seen = new Set();
    let top = 0, mark = null;
    step(60 * 8, () => {
      seen.add(e.state);
      if (e.state === 'leap') top = Math.max(top, e.pos.y - y0);
      if (e.state === 'crouch' && enemies.leapMarks[0]?.visible) mark = true;
      return run.health < m0;
    });
    const ok1 = ['approach', 'crouch', 'leap', 'rest'].every((s) => seen.has(s)) && top > 0.15 && mark && m0 - run.health === 4;   // leap damage 4 since v144
    return ok(ok1, { states: [...seen], height: +top.toFixed(3), mark, lost: m0 - run.health });
  },
});
story('words/rolls', {
  about: 'rolls: a hair tangle tumbles along the floor as it comes at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('hair', near(0.4, 0)); },
  play() { const e = G().enemies.list[0], a = e.mesh.rotation.x; step(30); return ok(Math.abs(e.mesh.rotation.x - a) > 1, { turned: +(e.mesh.rotation.x - a).toFixed(2) }); },
});
story('words/drops', {
  about: 'An Aerial root drops from above onto a circle on the floor near you: the circle and the dome of space over it fill together as it falls, it lands right there as they fill (about 1 s), and both go.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('root', near(0.15, 0)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], spot = near(0.15, 0), floor = player.position.y;
    step(1);
    const high = e.pos.y - floor;
    const pair = () => volumePairs().find(([v, f]) => f && Math.hypot(v.position.x - spot.x, v.position.z - spot.z) < 0.01);
    step(10);
    const p1 = pair(), was = p1?.[0].material.progress;
    step(20);
    const p2 = pair(), filling = !!(p1 && p2 && p2[0].material.progress > was && p2[0].material.progress === p2[1].material.progress);
    let frames = 31;
    step(60 * 2, () => { frames++; return e.state !== 'drop'; });
    const secs = frames / 60, landed = Math.hypot(e.pos.x - spot.x, e.pos.z - spot.z) < 0.01 && Math.abs(e.pos.y - floor) < 0.01;
    step(2);
    const w = shownWarnings(), gone = !w.floor.length && !w.volume.length;
    return ok(high > 0.3 && filling && landed && secs > 0.9 && secs < 1.15 && gone, { high: +high.toFixed(2), filling, landed, secs: +secs.toFixed(2), gone });
  },
});
story('words/holds', {
  about: 'An Aerial root that reaches you holds on for 3 s: you swim at half speed and lose a little Health (1 a second, no flinch), then it withers away, worth no XP, and you swim at full speed again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { enemies, player } = G(), home = player.position.clone();
    const swim = () => { tp(home.x, home.y, home.z, 0); step(5); const p0 = player.position.clone(); sim(0.5, ['KeyW']); return Math.hypot(player.position.x - p0.x, player.position.z - p0.z); };
    const free = swim();
    tp(home.x, home.y, home.z, 0);
    const e = spawn('root', near(0, 0)), hurt = record('damage_taken'), kills = record('enemy_killed');
    step(60 * 2, () => e.state === 'hold');
    const grabbed = e.state === 'hold', t0 = G().run.t;
    const held = swim();
    step(60 * 4, () => e.dead);
    const secs = G().run.t - t0, lost = hurt.filter((d) => d.source === 'root').reduce((s, d) => s + d.amount, 0);
    const drained = hurt.filter((d) => d.source === 'root').every((d) => d.drain);
    step(30);
    const after = swim(), spent = kills.find((k) => k.targetId === e.id);
    return ok(grabbed && Math.abs(held / free - 0.5) < 0.08 && after / free > 0.92 && Math.abs(secs - 3) < 0.15 && lost >= 2.5 && lost <= 3.5 && drained && spent?.silent,
      { free: +free.toFixed(3), held: +held.toFixed(3), after: +after.toFixed(3), secs: +secs.toFixed(2), lost, drained, silent: spent?.silent });
  },
});

// --- the Pothos's Cuttings and Sap sprouts (act 3's boss drops them; they're bugs like any other)
story('words/becomes', {
  about: 'A Cutting left alone: a floor circle round it fills like a countdown over about 6 s, and when it fills a Sap sprout takes its place where it stood.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('cutting', near(0.2, 0)); },
  play() {
    const { enemies } = G(), c = enemies.list[0];
    step(3);
    const at = c.pos.clone();
    let frames = 3, mid = null, sprout = null, warned = false;
    step(60 * 8, () => {
      frames++;
      const w = pothosFloor();
      if (w.length && Math.hypot(w[0].position.x - at.x, w[0].position.z - at.z) < 0.01) warned = true;
      if (frames === 180) mid = w[0]?.material.progress;
      sprout = enemies.list.find((x) => x.type === 'sprout' && !x.dead);
      return sprout;
    });
    const secs = frames / 60, where = sprout ? Math.hypot(sprout.pos.x - at.x, sprout.pos.z - at.z) : null;
    return ok(warned && mid > 0.4 && mid < 0.6 && sprout && c.dead && secs > 5.8 && secs < 6.3 && where < 0.005,
      { warned, mid: mid && +mid.toFixed(2), secs: +secs.toFixed(2), sprout: !!sprout, cutting: c.dead ? 'gone' : 'still there', where });
  },
});
story('enemies/cutting-killed-in-time-never-sprouts', {
  about: 'A Cutting killed within its countdown does nothing more: no Sap sprout comes, and its Warning goes with it.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('cutting', near(0.2, 0)); },
  play() {
    const { enemies } = G(), c = enemies.list[0];
    step(60 * 3);
    const shown = pothosFloor().length;
    bus.emit('damage_taken', { targetId: c.id, amount: 9999 });
    step(60 * 5);
    const sprouts = enemies.list.filter((x) => x.type === 'sprout' && !x.dead).length;
    return ok(shown === 1 && c.dead && !sprouts && !pothosFloor().length, { shown, dead: c.dead, sprouts, after: pothosFloor().length });
  },
});
// a Sap sprout near the jelly, held still, and the first glob it lobs
function sapLob() {
  fresh({ hurt: true, elites: false, bubbles: false, lash: false });
  tp(3.2, 0.05, 3.0, 0);
  holdJelly();
  spawn('sprout', near(0.25, 0));
}
const firstSap = () => { step(60 * 6, () => G().enemies.lobs.length > 0); return G().enemies.lobs[0]; };
const shownAt = (to) => { const w = warningsAt(to); return { floor: w.floor?.visible ? w.floor : null, volume: w.volume?.visible ? w.volume : null }; };
story('words/lob', {
  about: 'A Sap sprout lobs sap at you: its Warning is a floor circle where you stand with a dome over it, filling together while the glob flies; it lands as a Blast that hits a jelly inside, and both go.',
  setup() { sapLob(); },
  play() {
    const log = record('damage_taken'), b = firstSap(), to = b?.to.clone();
    if (!b) return ok(false, { lobbed: false });
    step(10);
    const w1 = shownAt(to), p1 = [w1.floor?.material.progress, w1.volume?.material.progress];
    step(10);
    const w2 = shownAt(to), p2 = [w2.floor?.material.progress, w2.volume?.material.progress];
    const together = w1.floor && w1.volume && Math.abs(p1[0] - p1[1]) < 1e-6 && Math.abs(p2[0] - p2[1]) < 1e-6 && p2[0] > p1[0];
    step(60 * 2, () => b.done);
    const hit = log.find((d) => d.source === 'sprout'), after = shownAt(to);
    return ok(together && hit && !after.floor && !after.volume, { p1, p2, hit: hit?.amount, after: { floor: !!after.floor, volume: !!after.volume } });
  },
});
story('enemies/sap-jump-clears', {
  about: 'A jelly in the air over the circle when the sap lands is clear of the Blast.',
  setup() { sapLob(); },
  play() {
    const { player } = G(), log = record('damage_taken'), b = firstSap();
    if (!b) return ok(false, { lobbed: false });
    step(60 * 2, () => b.k > 0.9);
    player.position.y += 0.1; player.grounded = false;      // jumped as it comes down
    step(60 * 2, () => b.done);
    const hit = log.some((d) => d.source === 'sprout');
    return ok(b.done && !hit, { landed: b.done, hit });
  },
});
story('enemies/sap-puddle-slows', {
  about: 'Where sap lands it leaves a sticky puddle (a floor hazard, no volume): a jelly standing in it is slowed, one just beside it isn\'t.',
  setup() { sapLob(); },
  play() {
    const { player, enemies } = G(), b = firstSap();
    if (!b) return ok(false, { lobbed: false });
    const to = b.to.clone(), slows = record('status_applied');
    step(60 * 2, () => b.done);
    step(20);
    const inside = slows.filter((s) => s.targetId === PLAYER && s.status === 'slow').length;
    const pud = enemies.puddles.find((p) => Math.hypot(p.m.position.x - to.x, p.m.position.z - to.z) < 0.01);
    const vol = shownWarnings().volume.length;
    player.position.set(to.x + (pud?.r || 0.05) + 0.04, player.position.y, to.z);
    slows.length = 0;
    step(20);
    const beside = slows.filter((s) => s.targetId === PLAYER && s.status === 'slow').length;
    return ok(pud && inside > 0 && beside === 0 && vol === 0, { puddle: !!pud, inside, beside, vol });
  },
});

// --- guards: the vocabulary stays complete, and content mistakes are caught
// The words GLOSSARY.md retires (its _Avoid_ lists) stay out of what players read: content names and
// texts, stat names, cards and evolutions, and the prose strings the HUD, menus and run show.
story('vocabulary/no-retired-words', {
  about: 'No word GLOSSARY.md lists under _Avoid_ shows up in what players read (content, stats, cards, evolutions, and the HUD, menu and run text).',
  setup() {},
  async play() {
    const get = async (f) => (await fetch(f)).text();
    const avoid = [...(await get('/GLOSSARY.md')).matchAll(/^_Avoid_:(.*)$/gm)]
      .flatMap((m) => m[1].replace(/\([^)]*\)/g, '').split(',')).map((w) => w.trim()).filter(Boolean);
    const texts = [];
    for (const t of TREASURES) texts.push([`treasure ${t.id}`, [t.name, t.text, ...(t.levelText || [])].join(' · ')]);
    for (const [id, e] of Object.entries(CONTENT.enemies)) texts.push([`enemy ${id}`, e.name]);
    for (const [k, v] of Object.entries(STAT_INFO)) texts.push([`stat ${k}`, v.name]);
    for (const e of EVOLUTIONS) texts.push([`evolution ${e.id}`, `${e.name} · ${e.text}`]);
    // prose in the code players read: quoted strings with a space in them, comments stripped
    for (const f of ['run.js', 'hud.js', 'ui.js', 'main.js', 'stats.js', 'first-run.js']) {
      const src = (await get(`/src/${f}`)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
      // one line at a time; a string that reads as prose (words and spaces, no code or CSS in it)
      for (const line of src.split('\n')) for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
        const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '');
        if (/[A-Za-z]{3,} [A-Za-z]{2,}/.test(text) && !/[;{}=]|=>|<style|\.jf-|#[a-z-]+ \{/.test(text)) texts.push([`src/${f}`, text]);
      }
    }
    const hits = [];
    for (const w of avoid) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      for (const [where, text] of texts) if (re.test(text)) hits.push(`${w} in ${where}: "${text.slice(0, 70)}"`);
    }
    return ok(avoid.length > 10 && !hits.length, { avoid: avoid.length, hits: hits.slice(0, 12) });
  },
});
story('vocabulary/every-word-documented-used-and-proven', {
  about: 'Every behaviour word has a description, is used by some bug, and has a words/ story.',
  setup() {},
  play() {
    const used = new Set(Object.values(CONTENT.enemies).flatMap((T) => T.vocabulary));
    const problems = [];
    for (const [w, def] of Object.entries(ENEMY_WORDS)) {
      if (!def.doc) problems.push(`${w}: no doc`);
      if (!used.has(w)) problems.push(`${w}: no bug uses it`);
      if (!STORIES['words/' + w]) problems.push(`${w}: no words/${w} story`);
    }
    return ok(!problems.length, { problems });
  },
});
story('content/mistakes-are-caught', {
  about: 'A typo in a .kdl file stops loading with a message naming the file, line and problem.',
  setup() {},
  play() {
    const tryIt = (src) => { try { compileEnemies(parse(src, 'test.kdl'), 'test.kdl'); return null; } catch (e) { return e.message; } };
    const unknown = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    lurk 3\n}');
    const badArgs = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    chase\n}');
    const badProp = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    chase 0.3\n    curl-dash wndup=1\n}');
    const noMove = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    rolls\n}');
    const good = /test\.kdl:2: unknown word "lurk"/.test(unknown) && /"chase" takes speed/.test(badArgs) && /no setting "wndup"/.test(badProp) && /no way to move/.test(noMove);
    return ok(good, { unknown, badArgs, badProp, noMove });
  },
});
story('look/every-species-builds', {
  about: 'Every jellyfish species builds a model with hunting tentacles for the Lash, and old saved looks become jellyfish.',
  setup() {},
  play() {
    const built = {};
    for (const id of Object.keys(SPECIES)) {
      const c = buildCharacter({ body: id }, 0.09);
      let meshes = 0;
      c.root.traverse((o) => { if (o.isMesh) meshes++; });
      built[id] = { meshes, tentacles: c.tentacles?.count };
      c.dispose();
    }
    const old = [normalizeLook({ body: 'jellyfish' }).body, normalizeLook({ body: 'blob', feet: true }).body, 'feet' in normalizeLook({ feet: true })];
    const good = Object.values(built).every((b) => b.meshes > 10 && b.tentacles >= 6) && old[0] === 'nettle' && old[1] === 'nettle' && old[2] === false;
    return ok(good, { built, old });
  },
});
story('look/tokens-reach-the-game', {
  about: 'Values in content/look.css are what the game uses.',
  setup() {},
  play() {
    const s = G().APT.scene;
    return ok(LOOK.has('night-fill') && s.environmentIntensity === LOOK.num('night-fill') && s.fog.density === LOOK.num('haze'), { fill: s.environmentIntensity, haze: s.fog.density });
  },
});
