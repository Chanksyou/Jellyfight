// Stories: the behaviour words, and the guards on content and vocabulary. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus, PLAYER } from '../events.js';
import { ENEMY_WORDS } from '../words.js';
import { CONTENT, compileEnemies } from '../content.js';
import { TREASURES, STAT_INFO, EVOLUTIONS } from '../stats.js';
import { parse } from '../kdl.js';
import { LOOK } from '../look.js';
import { sfx, unlock as unlockAudio, audio } from '../sfx.js';
import { juice } from '../juice.js';
import { SPECIES, buildCharacter, normalizeLook, bellFront, bellHalfWidth } from '../character.js';
import { bellFlex } from '../bell-flex.js';
import { TeleMaterial } from '../vfx.js';
import { buildNest, buildWasp, NEST } from '../critters.js';
import { applyState } from '../cat.js';
import { G, STORIES, V, offs, fresh, holdJelly, near, ok, record, shownWarnings, sim, spawn, spy, step, story, stub, tp, volumePairs, warningsAt } from './kit.js';

// --- the vocabulary: one story per behaviour word (src/words.js), proving what it does
story('words/chase', {
  about: 'chase: a cockroach walks straight at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('roach', near(0.35, 0)); },
  play() { const e = G().enemies.list[0], d0 = e.pos.distanceTo(G().player.position); step(60); const d1 = e.pos.distanceTo(G().player.position); return ok(d0 - d1 > 0.2, { before: +d0.toFixed(3), after: +d1.toFixed(3) }); },
});
story('words/spit-pin', {
  about: 'spit shot="pin": the ant stands still, braces and coils back (no aim line), throws its pushpin spinning at you (it costs you Health), and a new pin appears in its jaws.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', near(0.4, 0)); },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    run.iFrames = 0;
    let stood = true, aimed = false, spun = 0, held = null, gone = false;
    step(60 * 8, () => {
      if (e.aimT > 0) { aimed = true; if (e.aimT < e.aimMax * 0.5 && Math.hypot(e.vel.x, e.vel.z) > 0.03) stood = false; }   // (it eases to a stop)
      const s = enemies.shots.find((q) => q.roll);
      if (s) {
        spun = Math.max(spun, Math.abs(s.m.rotation.z));
        held ||= e.root.getObjectsByProperty('geometry', s.m.geometry).find((m) => m !== s.m)?.parent;   // the pin in its jaws
        if (held && held.scale.x < 0.01) gone = true;
      }
      return log.some((d) => d.source === 'pin');
    });
    const hit = log.find((d) => d.source === 'pin');
    step(45);
    const back = held?.scale.x;
    return ok(aimed && stood && spun > 0.3 && hit?.amount === 2 && gone && Math.abs(back - 1) < 0.01, { aimed, stood, spun: +spun.toFixed(2), hit: hit?.amount, gone, back });
  },
});
story('words/spit-pin-readable', {
  about: 'An ant that has locked its aim shows a dotted glow line from its jaws to where the pin will fly (none before the lock); the thrown pin is drawn bigger than the one in its jaws and keeps its hit size.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', near(0.4, 0)); },
  play() {
    const { enemies } = G(), e = enemies.list[0], hold = enemies.fx.glow.hold.bind(enemies.fx.glow);
    let early = 0, locked = 0, lastLen = 0;
    enemies.fx.glow.hold = (p, ...a) => { if (e.aimT > 0 && e.aimAt) { if (e.aimT > e.aimMax * 0.5) early++; else locked++; } hold(p, ...a); };
    let big = null;
    try {
      step(60 * 8, () => { const s = enemies.shots.find((q) => q.roll); if (s) { big = s.m.scale.x / e.r; return true; } return false; });
    } finally { enemies.fx.glow.hold = hold; }
    return ok(locked >= 5 && big > 1.3 && big < 2.2, { locked, early, big: big && +big.toFixed(2) });
  },
});
story('words/spit-pin-sticks', {
  about: 'A pushpin that misses sticks in the scenery for a moment (harmless), then goes.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { enemies, player } = G(), log = record('damage_taken');
    const e = spawn('ants', near(0.4, 0), { still: true });
    enemies.spit(e, near(0, 0, -0.2), { speed: 0.8, life: 1, dmg: 2, shot: 'pin', height: -0.4 });   // straight down into the floor in front of it
    const s = enemies.shots.at(-1);
    let stuckAt = null;
    step(60 * 2, () => { if (s.stuckT > 0) stuckAt = s.m.position.clone(); return !!stuckAt; });
    step(30);
    const still = stuckAt && s.m.position.distanceTo(stuckAt) < 1e-6 && enemies.shots.includes(s);
    step(60 * 2.5);
    return ok(stuckAt && still && !enemies.shots.includes(s) && !log.some((d) => d.source === 'pin'), { stuck: !!stuckAt, still, gone: !enemies.shots.includes(s), y: stuckAt && +(stuckAt.y - player.position.y).toFixed(3) });
  },
});
story('words/spit-pin-after-clear', {
  about: 'A pin that was stuck in the scenery when the bugs were cleared is not born stuck when its pooled shot is thrown again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { enemies } = G(), e = spawn('ants', near(0.4, 0), { still: true });
    enemies.spit(e, near(0, 0, -0.2), { speed: 0.8, life: 1, dmg: 2, shot: 'pin', height: -0.4 });
    const first = enemies.shots.at(-1);
    step(60 * 2, () => first.stuckT > 0);
    enemies.clear();
    const again = spawn('ants', near(0.4, 0), { still: true });
    enemies.spit(again, near(0, 0, 0.05), { speed: 0.8, life: 1, dmg: 2, shot: 'pin', height: 0 });
    return ok(enemies.shots.at(-1).stuckT === 0, { stuck: enemies.shots.at(-1).stuckT });
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
  about: 'The millipede curls into a ball (hits on it do 75% less while curled), revs up spinning while its lane lights up (dimmed, no glare) on the floor, then rolls into you for 5. Once it uncurls it can be hurt again.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('millipede', near(0, -0.32)); e.ballCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    const seen = new Set();
    let warned = false, armored = null, spun = 0, hit = null, glow = 0;
    step(60 * 6, () => {
      seen.add(e.state);
      if (e.state === 'spin' && enemies.chargeMarks.some((m) => m.visible)) warned = true;
      for (const m of enemies.chargeMarks) if (m.visible) glow = Math.max(glow, m.material.opacity);
      if (e.state === 'spin' && armored === null) { const hp = e.hp; enemies.applyDamage(e, 20); armored = Math.abs(hp - e.hp - 5) < 1e-6; }   // 20 hits for 5
      spun = Math.max(spun, e.spinA || 0);
      hit = hit || log.find((d) => d.source === 'millipede' && d.amount === 5);   // ball-charge damage 5 since v144
      return hit && e.state === 'rest';
    });
    const hp = e.hp;
    enemies.applyDamage(e, 10);
    const hurtAfter = e.hp === hp - 10;
    const dim = glow > 0.2 && glow <= LOOK.num('charge-warning-opacity', 0.3) + LOOK.num('charge-warning-pulse', 0.06) + 1e-6;   // readable, but no glare (look.css)
    return ok(['curl', 'spin', 'dash'].every((s) => seen.has(s)) && warned && dim && armored && spun > 5 && hit && hurtAfter,
      { states: [...seen], warned, glow: +glow.toFixed(2), armored, spun: +spun.toFixed(1), hit: hit?.amount, hurtAfter });
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
      if (e.state === 'aim') { if (Math.abs(e.pos.y - 0.76 * e.r - enemies.floorBelow(e.pos, NaN)) < 0.02) landedLow = true; if (e.shellK === 1) raised = true; if (enemies.lockMarks.some((m) => m.visible)) reticle = true; }
      if (enemies.missiles.length) launched = true;
      hit = log.find((d) => d.source === 'missile');
      return !!hit;
    });
    return ok(flewHigh && landedLow && raised && reticle && launched && hit?.amount === 5, { states: [...seen], flewHigh, landedLow, raised, reticle, launched, hit: hit?.amount });   // sortie damage 5 since v144
  },
});
story('enemies/dragonfly-model', {
  about: 'The dragonfly (act 3) is about 3 radii long and 4 across its four wings, which beat as it flies about you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.25, 0, 0.1)); e.beamCd = e.whirlCd = 99; },
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
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.7, 0, 0.1)); e.beamCd = e.whirlCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], pc = player.position, start = e.pos.distanceTo(pc);
    stub(player.avatar, 'update', () => {}); // cosmetic blink timing must not choose the dragonfly's random path
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
story('words/charge-beam-sound', {
  about: 'The dragonfly\'s charge hum stays low (no tone above 600 Hz) and a swarm can\'t stack it into noise: at most 3 hum at once, and a slot frees when one is cut off.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  async play() {
    unlockAudio();
    await new Promise((r) => setTimeout(r, 200));
    const { ctx } = audio() || {};
    if (!ctx || ctx.state !== 'running') return ok(false, { audio: ctx?.state ?? 'none' });
    let top = 0;
    const make = ctx.createOscillator;
    ctx.createOscillator = function () {
      const o = make.call(this), ramp = o.frequency.exponentialRampToValueAtTime.bind(o.frequency);
      o.frequency.exponentialRampToValueAtTime = (f, t) => { top = Math.max(top, f); return ramp(f, t); };
      return o;
    };
    const hums = Array.from({ length: 6 }, () => sfx.beamCharge(1));
    ctx.createOscillator = make;
    const playing = hums.filter(Boolean).length;
    hums[0]?.();
    const again = sfx.beamCharge(1);
    for (const h of [...hums, again]) h?.();
    return ok(playing === 3 && !!again && top > 0 && top <= 600, { playing, again: !!again, top: Math.round(top) });
  },
});
const S2 = new THREE.Vector3();
story('words/charge-beam', {
  about: 'Within reach the dragonfly faces you and holds dead still for half a second with only a building whine for a warning (nothing on screen), then its beam hits you instantly: 3 damage.',
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
      if (enemies.pokeMarks.some((m) => m.visible) || enemies.chargeMarks.some((m) => m.visible)) shown = true;
      return log.some((d) => d.source === 'dragonfly');
    });
    delete enemies.beamCharge;
    const hit = log.find((d) => d.source === 'dragonfly'), secs = frames / 60;
    return ok(whined === 0.5 && hit?.amount === 3 && held < 0.001 && !shown && secs > 0.4 && secs < 0.6, { whined, hit: hit?.amount, held: +held.toFixed(4), shown, secs: +secs.toFixed(2) });
  },
});
story('enemies/dragonfly-beam-dodge', {
  about: 'The dragonfly\'s beam goes the way it faced when it began to charge: moving off that line during the charge makes it miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.3, 0, 0.08)); e.beamCd = 0; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 3, () => e.state === 'charge');
    const charged = e.state === 'charge';
    step(15);
    const side = V(-e.beamDir.z, 0, e.beamDir.x).normalize(), P = player.position;
    tp(P.x + side.x * 0.2, P.y, P.z + side.z * 0.2);
    let fired = false;
    step(60 * 1.5, () => { if (e.state === 'rest') fired = true; return fired; });
    const hit = log.some((d) => d.source === 'dragonfly');
    return ok(charged && fired && !hit, { charged, fired, hit });
  },
});
story('words/evade', {
  about: 'Hit the dragonfly and it darts away in a random direction, but only once every 5 s: a second hit soon after doesn\'t move it.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.35, 0, 0.08), { hp: 999 }); e.beamCd = e.whirlCd = 99; },
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
    step(15);
    bus.emit('damage_taken', { targetId: e.id, amount: 1 });
    step(5);
    const broke = e.state === 'approach';
    e.beamCd = e.whirlCd = 99;
    step(60 * 2.5);
    const hit = log.some((d) => d.source === 'dragonfly' && d.amount === 3);   // the beam (not a brush against it as it dodges)
    return ok(charged && broke && !hit, { charged, broke, hit });
  },
});
story('words/whirlwind', {
  about: 'The dragonfly holds still while a whirlwind of spinning blades grows in front of its head, then flings it at the jelly: a slow Shot that sucks the jelly toward it as it comes (the jelly drifts in with no input), and hits for 2.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.4, 0, 0.06)); e.beamCd = 99; e.whirlCd = 0; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken'), P = player.position;
    step(60 * 3, () => e.state === 'whirl');
    const at = e.pos.clone(), grew = [];
    let moved = 0;
    step(60 * 2, () => { if (e.state === 'whirl') { grew.push(e.whirlK); moved = Math.max(moved, e.pos.distanceTo(at)); } return e.state !== 'whirl'; });
    const flung = enemies.whirls?.filter((w) => w.live && !w.held).length || 0;
    const start = P.clone(), to = e.pos.clone().sub(P).setY(0).normalize();
    let pulled = 0, sucking = false;
    step(60 * 3, () => {
      if (enemies.pull) sucking = true;
      if (!log.some((d) => d.source === 'dragonfly')) pulled = P.clone().sub(start).setY(0).dot(to);
      return log.some((d) => d.source === 'dragonfly');
    });
    const hit = log.find((d) => d.source === 'dragonfly');
    const growing = grew.length > 20 && grew[0] < 0.1 && grew[grew.length - 1] > 0.9 && grew.every((k, i) => !i || k >= grew[i - 1]);
    return ok(growing && moved < 0.005 && flung === 1 && sucking && pulled > 0.005 && hit?.amount === 2, { growing, moved: +moved.toFixed(4), flung, sucking, pulled: +pulled.toFixed(3), hit: hit?.amount });
  },
});
story('enemies/dragonfly-whirlwind-dodge', {
  about: 'The whirlwind\'s aim locks part way through the wind-up: stepping well aside after that, it flies past and breaks up on whatever it meets, the jelly unhurt; a dodge (hitting the dragonfly) during the wind-up breaks it apart before it\'s flung.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('dragonfly', near(0.4, 0, 0.06), { hp: 999 }); e.beamCd = 99; e.whirlCd = 0; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken'), P = player.position;
    step(60 * 3, () => e.state === 'whirl');
    step(60 * 2, () => e.whirlK > 0.65);
    const to = e.pos.clone().sub(P).setY(0).normalize();
    tp(P.x - to.z * 0.2, P.y, P.z + to.x * 0.2);
    holdJelly();
    let fired = false;
    step(60 * 4, () => { const live = enemies.whirls.some((w) => w.live && !w.held); if (live) fired = true; return fired && !live; });
    const dodged = fired && !log.some((d) => d.source === 'dragonfly');
    e.whirlCd = 0; e.evadeCd = 0;
    step(60 * 3, () => e.state === 'whirl');
    step(10);
    bus.emit('damage_taken', { targetId: e.id, amount: 1 });
    step(5);
    const broke = e.state === 'approach' && !enemies.whirls.some((w) => w.live);
    return ok(dodged && broke, { fired, dodged, broke });
  },
});
story('words/swat', {
  about: 'Up close the mantis rears up with its forelegs raised (nothing shows on the floor), then lunges and snaps them shut: 4 damage if you\'re in front of it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('mantis', near(0.12, 0)); e.swatCd = 0.3; },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    let reared = false, marked = false;
    step(60 * 4, () => {
      if (e.state === 'windup' && !reared) {
        reared = true;                                   // anything drawn on the floor near it? (a Warning is a TeleMaterial)
        e.root.parent.traverse((o) => { if (o.visible && o.material instanceof TeleMaterial && o.position.distanceTo(e.pos) < 0.5) marked = true; });
      }
      return log.some((d) => d.source === 'mantis' && d.amount === 4);
    });
    const hit = log.find((d) => d.source === 'mantis' && d.amount === 4);
    return ok(reared && !marked && hit?.amount === 4, { reared, marked, hit: hit?.amount });
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
        tp(P.x + e.swatDir.x * 0.35, P.y, P.z + e.swatDir.z * 0.35);
        moved = true;
      }
      if (e.state === 'swat' && !swatted) { swatted = true; gap = Math.hypot(player.position.x - e.pos.x, player.position.z - e.pos.z); }
      return swatted && e.state === 'rest';
    });
    const hit = log.some((d) => d.source === 'mantis' && d.amount === 4);
    return ok(moved && swatted && !hit, { moved, swatted, hit, gap: +gap.toFixed(3) });
  },
});
// --- the stag beetle (act 3): a tank over twice the jelly's size that charges an electric ball between its mandibles
const beetleAt = (d = 0.4) => { const e = spawn('beetle', near(d, 0)); e.shotCd = 0.2; return e; };
story('enemies/stag-beetle-model', {
  about: 'The stag beetle (act 3) is over twice the jelly\'s size: its body 2.25x as wide, and as long (mandibles to wing tips) as two and a quarter jellies are tall. It walks on six legs that move as it comes.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); beetleAt(0.6).shotCd = 99; },
  play() {
    const { enemies } = G(), e = enemies.list[0], box = new THREE.Box3(), size = new THREE.Vector3();
    const legs = () => { const out = []; e.mesh.traverse((o) => { if (o.name === 'leg') out.push(o.rotation.y); }); return out; };
    const before = legs();
    step(60);
    const moved = legs().some((a, i) => Math.abs(a - before[i]) > 0.05);
    const q = e.root.quaternion.clone();
    e.root.quaternion.identity(); e.root.updateMatrixWorld(true);
    box.setFromObject(e.mesh).getSize(size);
    e.root.quaternion.copy(q); e.root.updateMatrixWorld(true);
    const wide = e.r / CONFIG.player.radius, long = size.z / CONFIG.player.height;
    return ok(Math.abs(wide - 2.25) < 0.12 && long > 2 && long < 2.7 && before.length === 6 && moved, { wide: +wide.toFixed(2), long: +long.toFixed(2), legs: before.length, moved });
  },
});
story('words/charge-shot', {
  about: 'Within reach the stag beetle stops, turns to you and charges a ball between its mandibles for 2 s (it grows as it charges), then fires it at your middle: a Shot that hits a jelly standing still for 5.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); beetleAt(); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 3, () => e.state === 'charge');
    const at = e.pos.clone(), grew = [];
    let frames = 0, moved = 0;
    step(60 * 3, () => {
      if (e.state === 'charge') { frames++; grew.push(e.ballK); moved = Math.max(moved, e.pos.distanceTo(at)); }
      return e.state !== 'charge';
    });
    const flying = enemies.sparkShots.length;
    step(60, () => log.some((d) => d.source === 'beetle'));
    const hit = log.find((d) => d.source === 'beetle'), secs = frames / 60;
    const growing = grew.length > 10 && grew[0] < 0.2 && grew[grew.length - 1] > 0.9 && grew.every((k, i) => !i || k >= grew[i - 1]);
    return ok(secs > 1.9 && secs < 2.1 && moved < 0.005 && growing && flying === 1 && hit?.amount === 5, { secs: +secs.toFixed(2), moved: +moved.toFixed(4), growing, flying, hit: hit?.amount });
  },
});
story('enemies/stag-beetle-shot-dodge', {
  about: 'The stag beetle\'s aim locks part way through its charge: stepping aside after that, the ball flies past and bursts on whatever it meets, and the jelly is not hurt.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); beetleAt(); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 3, () => e.state === 'charge');
    const charged = e.state === 'charge';
    step(60 * 3, () => e.aimLocked);
    const side = V(-e.shotDir.z, 0, e.shotDir.x).normalize(), P = player.position;
    tp(P.x + side.x * 0.12, P.y, P.z + side.z * 0.12);
    let fired = false;
    step(60 * 3, () => { if (enemies.sparkShots.length) fired = true; return fired && !enemies.sparkShots.length; });
    const hit = log.some((d) => d.source === 'beetle');
    return ok(charged && fired && !enemies.sparkShots.length && !hit, { charged, fired, hit });
  },
});
story('words/charge-shot-blast', {
  about: 'The stag beetle\'s ball explodes where it lands, a Blast round it: one bursting on the floor 5 cm beside the jelly still hurts it for 3 and shoves it away; one bursting 15 cm away does nothing to it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); beetleAt().shotCd = 99; },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], P = player.position, out = {};
    const props = { speed: 1.2, dmg: 3, size: 0.019, blast: 0.07, knock: 0.6, life: 1.2 };
    for (const off of [0.05, 0.15]) {
      tp(3.2, 0.05, 3.0, 0); step(5);
      const hurt = record('damage_taken'), shove = record('knockback');
      const to = e.pos.clone().sub(P).setY(0).normalize(), side = V(-to.z, 0, to.x);
      enemies.sparkShot(e, V(P.x + side.x * off, P.y, P.z + side.z * off), props);
      step(60 * 2, () => !enemies.sparkShots.length);
      out[off] = { hurt: hurt.find((d) => d.source === 'beetle')?.amount || 0, shoved: shove.some((k) => k.targetId === PLAYER) };
    }
    return ok(out[0.05].hurt === 3 && out[0.05].shoved && !out[0.15].hurt && !out[0.15].shoved, out);
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
  about: 'The mantis\'s carcass twitches while a dimmed circle fills round its rear end, then the worm bursts out of the tip of its abdomen: 5 damage if you\'re inside the circle.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0.3, 0)); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(1);
    const out = e.emergeAt, round = Math.hypot(out.x - e.pos.x, out.z - e.pos.z) > e.r;   // it comes out away from the middle (the rear end)
    tp(out.x, player.position.y, out.z);                                                   // stand right where it comes out
    let warned = false, glow = 0, frames = 1;
    step(60 * 3, () => {
      frames++;
      if (e.state === 'emerge' && enemies.burstMarks.some((m) => m.visible)) warned = true;
      for (const m of enemies.burstMarks) if (m.visible) glow = Math.max(glow, m.material.opacity);
      return log.some((d) => d.source === 'worm' && d.amount === 5);
    });
    const hit = log.find((d) => d.source === 'worm' && d.amount === 5), secs = frames / 60;
    const dim = glow > 0.2 && glow <= LOOK.num('burst-warning-opacity', 0.3) + LOOK.num('burst-warning-pulse', 0.06) + 1e-6;   // readable, but no glare (look.css)
    return ok(round && warned && dim && hit?.amount === 5 && secs > 1.45 && secs < 1.6, { round, warned, glow: +glow.toFixed(2), hit: hit?.amount, secs: +secs.toFixed(2) });
  },
});
story('enemies/worm-burst-clear', {
  about: 'Standing outside the circle when the worm bursts out of the mantis\'s carcass, you\'re not hurt.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('worm', near(0, -0.55)); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 1.8);
    return ok(e.state !== 'emerge' && !log.some((d) => d.source === 'worm' && d.amount === 5), { state: e.state, hits: log.length });
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
  about: 'Every 4 s a wasp crawls out of the entrance at the bottom of its nest.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('nest', near(0.6, 0, 0.25)); },
  play() {
    const { enemies } = G(), nest = enemies.list[0];
    const out = [], real = enemies.hatch;                 // every wasp it sends out (one may sting you and be gone)
    enemies.hatch = function (n, w) { if (n === nest) out.push({ w, at: w.pos.distanceTo(n.emergeAt), below: w.pos.y < n.pos.y }); return real.call(this, n, w); };
    step(Math.round(60 * 3.9));
    const early = out.length;
    step(Math.round(60 * 0.2));
    const first = out[0], at = first?.at, below = first?.below;
    step(60 * 4);
    const later = out.length;
    delete enemies.hatch;
    return ok(early === 0 && first && at < 0.02 && below && later === 2, { early, out: !!first, at: at && +at.toFixed(3), below, later });
  },
});
story('enemies/nest-brood-limit', {
  about: 'A nest stops sending out wasps while nine of its own are still alive.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('nest', near(0.6, 0, 0.25)); e.broodT = 0.1; },
  play() {
    const { enemies } = G(), nest = enemies.list[0];
    for (let i = 0; i < 9; i++) { const w = spawn('wasp', near(-0.6, 0, 0.1 + i * 0.03), { still: true }); w.motherId = nest.id; }
    step(60 * 6);
    const n = enemies.list.filter((x) => !x.dead && x.motherId === nest.id).length;
    return ok(n === 9, { wasps: n });
  },
});
story('words/dive', {
  about: 'A wasp rears with a rising buzz, then nosedives at you: the sting does 4, and the wasp dies doing it (no XP for you).',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('wasp', near(0.22, 0, 0.1)); e.diveCd = 0; },
  play() {
    const { enemies, xpDrops } = G(), e = enemies.list[0], log = record('damage_taken'), deaths = record('enemy_killed');
    const drops = xpDrops.list.length;
    let reared = false, dived = false;
    step(60 * 4, () => {
      if (e.state === 'windup') reared = true;
      if (e.state === 'dive') dived = true;
      return log.some((d) => d.source === 'wasp' && d.amount === 4);
    });
    const hit = log.find((d) => d.source === 'wasp' && d.amount === 4);
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
    const stung = log.some((d) => d.source === 'wasp' && d.amount === 4);
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
  about: 'hover: a wasp circles about 20 cm from you, above your head.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('wasp', near(0.4, 0, 0.1)); e.diveCd = 99; },
  play() {
    const e = G().enemies.list[0], pc = () => G().player.position.clone().setY(G().player.position.y + CONFIG.player.height * 0.5);
    step(60 * 4);
    const flat = Math.hypot(e.pos.x - pc().x, e.pos.z - pc().z), above = e.pos.y - pc().y;
    return ok(Math.abs(flat - 0.2) < 0.06 && above > 0.03, { flat: +flat.toFixed(3), above: +above.toFixed(3) });
  },
});
story('words/spit', {
  about: 'spit: an ant braces, coils back and throws its pin; the shot costs you health.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('ants', near(0, -0.3)); },
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
  about: 'spit: the aim locks halfway through the wind-up, so stepping aside after it locks dodges the pin.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('ants', near(0, -0.3)); e.shootT = 1; },
  play() {
    const { run, enemies } = G(), e = enemies.list[0], P = G().player.position;
    run.iFrames = 0;
    const m0 = run.health;
    let shot = false;
    // wait until the aim has locked, then slip 8 cm to the side
    step(90, () => e.aimT > 0 && e.aimT < e.aimMax * 0.4);
    tp(P.x + 0.08, P.y, P.z);
    step(90, () => { if (enemies.shots.length) shot = true; });
    return ok(shot && run.health === m0, { shot, lost: m0 - run.health });
  },
});
story('words/bite', {
  about: 'bite: a mosquito up close stops and draws back, darts in and bites you, then bounces off.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(G().run, 'contactDamage', () => {}); spawn('mosquito', near(0, -0.18, 0.05)).biteCd = 0.3; },
  play() {
    const { run } = G(), e = G().enemies.list[0], seen = new Set(), log = [];
    offs.push(bus.on('damage_taken', (d) => { if (d.targetId === PLAYER) log.push(d); }));
    run.iFrames = 0;
    let at = null;
    step(60 * 6, () => { seen.add(e.state); if (at == null && log.some((d) => d.source === 'mosquito')) at = e.pos.distanceTo(jellyMid()); return at != null && seen.has('rest'); });
    step(15);
    const after = e.pos.distanceTo(jellyMid()), bit = log.find((d) => d.source === 'mosquito');
    return ok(['windup', 'dart', 'rest'].every((st) => seen.has(st)) && bit?.contact && after > at, { states: [...seen], bit: !!bit, at: at && +at.toFixed(3), after: +after.toFixed(3) });
  },
});
story('words/bite-dodge', {
  about: 'bite: the mosquito locks its aim halfway through drawing back, so moving off after that makes it miss.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(G().run, 'contactDamage', () => {}); spawn('mosquito', near(0, -0.2, 0.05)).biteCd = 0.3; },
  play() {
    const { run } = G(), e = G().enemies.list[0], P = G().player.position, log = [];
    offs.push(bus.on('damage_taken', (d) => { if (d.targetId === PLAYER) log.push(d.source); }));
    run.iFrames = 0;
    step(60 * 4, () => e.state === 'windup' && e.stateT < 0.1);
    tp(P.x + 0.12, P.y, P.z);
    let darted = false;
    step(60, () => { if (e.state === 'dart') darted = true; return darted && e.state === 'rest'; });
    return ok(darted && !log.includes('mosquito'), { darted, hits: log });
  },
});
story('words/on-beat', {
  about: 'on-beat every=4: a mosquito keeping time pumps on every beat of the song, and its bite only starts on the bar (every 4th beat), however long its cooldown has been ready.',
  setup() {
    const { run } = G();
    fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(run, 'contactDamage', () => {});
    const T = compileEnemies(parse('enemy "beat-mosquito" name="Mosquito" hp=40 r=0.05 dmg=1 xp=3 model="mosquito" {\n    zip distance=0.15 above=0.05 speed=0.9 length=0.07 pause=0.08\n    on-beat every=4\n    bite range=0.25 every=1.6 windup=0.35 speed=1.4 reach=0.35 dmg=1 rest=0.5\n}', 'test.kdl'), 'test.kdl')['beat-mosquito'];
    stub(CONTENT.enemies, 'beat-mosquito', T);
    stub(run, 'song', null); run.beat = 1.3;   // the run's own beat count, a little past a bar
    spawn('beat-mosquito', near(0, -0.18, 0.05)).biteCd = 0;
  },
  play() {
    const { run } = G(), e = G().enemies.list[0], starts = [];
    let was = e.state, pulses = 0, big = 0;
    step(60 * 10, () => {
      if (e.state === 'windup' && was !== 'windup') starts.push(+run.beat.toFixed(3));
      was = e.state;
      if (e.beatPulse === 1) pulses++;
      big = Math.max(big, e.mesh.scale.x / (e.baseScale * e.spawnT));
      return starts.length >= 2;
    });
    const onBar = starts.length >= 2 && starts.every((b) => b % 4 < 0.1);
    return ok(onBar && starts[0] >= 4 && pulses >= 4 && big > 1.05, { starts, pulses, pumped: +big.toFixed(3) });
  },
});
story('words/bleeds', {
  about: 'bleeds: a mosquito\'s bite that lands makes you bleed 1 Health a second for 3 s, and a second bite stacks another on top.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('mosquito', near(0.4, 0, 0.1), { still: true }).hold = true; },
  play() {
    const e = G().enemies.list[0];
    let bled = 0;
    offs.push(bus.on('damage_taken', (d) => { if (d.targetId === PLAYER && d.source === 'bleed') bled += d.amount; }));
    bus.emit('player_hurt', { amount: 1, from: e.id });          // its hit lands
    step(60);
    const one = bled;
    bus.emit('player_hurt', { amount: 1, from: e.id });          // a second one while the first still runs
    step(60);
    const two = bled - one;
    step(60 * 3);
    const total = bled, drips = G().run.bleeds.length;
    return ok(Math.abs(one - 1) < 0.05 && Math.abs(two - 2) < 0.05 && Math.abs(total - 6) < 0.05 && drips === 0, { one: +one.toFixed(3), two: +two.toFixed(3), total: +total.toFixed(3), left: drips });
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
    const ok1 = ['approach', 'crouch', 'leap', 'rest'].every((s) => seen.has(s)) && top > 0.15 && mark && m0 - run.health === 5;   // leap damage 5 since v291
    return ok(ok1, { states: [...seen], height: +top.toFixed(3), mark, lost: m0 - run.health });
  },
});
story('words/rolls', {
  about: 'rolls: a hair tangle tumbles along the floor as it comes at you.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); spawn('hair', near(0.4, 0)); },
  play() { const e = G().enemies.list[0], a = e.mesh.rotation.x; step(30); return ok(Math.abs(e.mesh.rotation.x - a) > 1, { turned: +(e.mesh.rotation.x - a).toFixed(2) }); },
});
// --- how the bugs' attacks feel (docs/agents/attack-feel.md, src/stories/attack-audit.js): the
// feedback each one makes when it really lands, checked by spying on the sounds and effects
function feelSpy() {
  const log = { sfx: [], impact: [], splat: 0, burst: 0 };
  for (const [k, f] of Object.entries(sfx)) if (typeof f === 'function') stub(sfx, k, function (...a) { log.sfx.push(k); return f.apply(this, a); });
  const { fx } = G();
  for (const k of ['splat', 'burst']) { const f = fx[k]; stub(fx, k, function (...a) { log[k]++; return f.apply(this, a); }); }
  const imp = fx.impact;
  stub(fx, 'impact', function (p, ...a) { log.impact.push(p.clone()); return imp.call(this, p, ...a); });
  return log;
}
const jellyMid = () => { const P = G().player.position; return P.clone().setY(P.y + CONFIG.player.height * 0.5); };
// steps until `source` really hurts the jelly; then: which voices played, whether an impact flashed
// within 5 cm of it, splats made, and how squashed its bug was the moment its hit landed
function feelOfHit(source, secs = 6, amount = null, log = feelSpy()) {
  const { enemies } = G(), e = enemies.list[0];
  let recoil = 0, landed = null, pending = null;
  // (run.js answers damage_taken before this listener, so a hit that lands has its player_hurt first)
  offs.push(bus.on('player_hurt', (h) => { pending = h; }));
  offs.push(bus.on('damage_taken', (d) => {
    if (d.targetId !== PLAYER) return;
    if (!landed && pending && d.source === source && (amount == null || d.amount === amount)) { landed = pending; recoil = e.recoil || 0; }
    pending = null;
  }));
  step(60 * secs, () => landed);
  const mid = jellyMid(), near = log.impact.some((p) => p.distanceTo(mid) < 0.05);
  return { landed: !!landed, contact: !!landed?.contact, near, recoil: +recoil.toFixed(2), splats: log.splat, voices: [...new Set(log.sfx)], e };
}
const played = (r, ...v) => v.every((n) => r.voices.includes(n));
const feelStory = (word, about, setup, check) => story(`words/${word}-feel`, { about, setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); setup(); }, play: check });
const hitFelt = (r, ...voices) => ok(r.landed && r.recoil > 0.5 && r.splats >= 1 && played(r, 'bugHit', ...voices), { ...r, e: undefined });

feelStory('contact', 'A cockroach biting the jelly: a flash where they touch, the roach squashes with the bite, drops of jelly splat on the floor, a crunch and a wet slap. Blocked by i-frames, none of it happens.',
  () => spawn('roach', near(0.15, 0)),
  () => {
    const { run } = G();
    const spy = feelSpy();
    run.iFrames = 9;                                     // first: touching while it can't hurt
    step(60);
    const quiet = !spy.sfx.includes('bugHit') && !G().enemies.list[0].recoil;
    spy.sfx.length = spy.impact.length = spy.splat = 0;
    run.iFrames = 0;
    const r = feelOfHit('roach', 3, null, spy);
    return ok(quiet && r.contact && r.near && r.recoil > 0.5 && r.splats >= 1 && played(r, 'bugHit'), { quiet, ...r, e: undefined });
  });
feelStory('spit-pin', 'An ant\'s pushpin leaves its jaws with a whoosh (the ant lunges) and lands on the jelly with a flash, a wet slap and drops splatting.',
  () => spawn('ants', near(0.35, 0)),
  () => { G().run.iFrames = 0; const r = feelOfHit('pin', 10); return ok(r.near && hitFelt(r, 'spit').ok, { ...r, e: undefined }); });
feelStory('leap', 'A lanternfly springs off with a flick of wings and slams down on the jelly with a thud: a scuff in the dust and the jelly\'s drops are left on the floor, and it squashes.',
  () => { spawn('lanternfly', near(0, -0.45)).leapCd = 0; },
  () => { const r = feelOfHit('lanternfly', 8); return ok(r.splats >= 2 && hitFelt(r, 'leapJump', 'leapSlam').ok, { ...r, e: undefined }); });
feelStory('bite', 'A mosquito\'s bite: a whine climbing as it draws back, a zip as it darts, a red flash and a prick where it meets the jelly, the mosquito squashes, the jelly\'s drops splat, and it starts to bleed.',
  () => { stub(G().run, 'contactDamage', () => {}); spawn('mosquito', near(0, -0.18, 0.05)).biteCd = 0.3; },   // (its touch alone would keep the jelly's i-frames up)
  () => { G().run.iFrames = 0; const r = feelOfHit('mosquito', 6); const bleeding = G().run.bleeds.length > 0; return ok(r.contact && r.near && bleeding && hitFelt(r, 'biteWind', 'biteGo', 'bite').ok, { ...r, bleeding, e: undefined }); });
feelStory('poke', 'A house fly\'s poke lands with a jab and a wet slap: it squashes, the jelly\'s drops splat.',
  () => { stub(G().run, 'contactDamage', () => {}); spawn('housefly', near(0.2, 0, 0.03)).pokeCd = 0.8; },   // (it hovers close enough to touch, which would keep the jelly's i-frames up)
  () => { const r = feelOfHit('housefly', 5, 4); return hitFelt(r, 'flyPoke'); });
feelStory('ball-charge', 'A millipede\'s ball rolling into the jelly flashes in its amber where they meet, squashes, and leaves the jelly\'s drops on the floor with a crunch and a slap.',
  () => { spawn('millipede', near(0, -0.32)).ballCd = 0.3; },
  () => { const r = feelOfHit('millipede', 6, 5); return ok(r.contact && r.near && hitFelt(r, 'milliRoll').ok, { ...r, e: undefined }); });
feelStory('charge-beam', 'A dragonfly\'s beam hitting the jelly: a flash on it, the dragonfly rocks back, a crack with a sizzle and the jelly\'s drops splat.',
  () => { spawn('dragonfly', near(0.3, 0, 0.08)).beamCd = 0; },
  () => { const r = feelOfHit('dragonfly', 4); return ok(r.near && hitFelt(r, 'beamFire').ok, { ...r, e: undefined }); });
feelStory('whirlwind', 'A dragonfly\'s whirlwind: a whirr rising as it grows, a flash and a whoosh as it\'s flung (the dragonfly rocks back), then a flash and a gusty thump on the jelly, which is shoved on; the jelly\'s drops splat.',
  () => { const e = spawn('dragonfly', near(0.3, 0, 0.06)); e.beamCd = 99; e.whirlCd = 0; },
  () => { const r = feelOfHit('dragonfly', 5, 2); return ok(r.near && hitFelt(r, 'whirlCharge', 'whirlFling', 'whirlEnd').ok, { ...r, e: undefined }); });
feelStory('swat', 'A mantis\'s swat landing: a flash on the jelly, a snap and a wet slap, the mantis squashes, the jelly\'s drops splat.',
  () => { stub(G().run, 'contactDamage', () => {}); spawn('mantis', near(0.12, 0)).swatCd = 0.3; },   // (its touch alone, contact-feel, would keep the jelly's i-frames up)
  () => { const r = feelOfHit('mantis', 8, 4); return ok(r.near && hitFelt(r, 'mantisSwat').ok, { ...r, e: undefined }); });
feelStory('burst', 'The worm bursting out under the jelly: a wet burst with bits pattering, a spatter left on the floor with the jelly\'s drops.',
  () => { const e = spawn('worm', near(0.3, 0)); step(1); tp(e.emergeAt.x, G().player.position.y, e.emergeAt.z); },
  () => { const r = feelOfHit('worm', 3, 5); return ok(r.splats >= 2 && hitFelt(r, 'wormBurst').ok, { ...r, e: undefined }); });
feelStory('whip', 'The worm\'s whip leaves with a whoosh and cracks down on the jelly: a flash on it, a scuff on the floor and the jelly\'s drops, a crack with dust pattering.',
  () => spawn('worm', near(0.18, 0)),
  () => { const r = feelOfHit('worm', 5, 3); return ok(r.near && r.splats >= 2 && hitFelt(r, 'whipLash', 'wormCrack').ok, { ...r, e: undefined }); });
feelStory('dive', 'A wasp sets off on its dive with a buzzing rip and stings the jelly: a flash, the sting and a wet slap, the wasp breaking up, the jelly\'s drops splatting.',
  () => { spawn('wasp', near(0.22, 0, 0.1)).diveCd = 0; },
  () => {
    const r = feelOfHit('wasp', 4, 4);
    return ok(r.near && r.e.dead && hitFelt(r, 'diveGo', 'waspSting').ok, { ...r, dead: r.e.dead, e: undefined });
  });
feelStory('sortie', 'A ladybug\'s missile goes off on the jelly with a varied boom and leaves a scorch on the floor that fades.',
  () => { spawn('ladybug', near(0.3, 0, 0.12)).stateT = 1.2; },
  () => {
    const log = feelSpy(), hits = record('damage_taken');
    step(60 * 8, () => hits.some((d) => d.source === 'missile'));
    const hit = hits.some((d) => d.source === 'missile'), voices = [...new Set(log.sfx)];
    return ok(hit && log.splat >= 1 && ['missileLaunch', 'missileBoom'].every((v) => voices.includes(v)), { hit, splats: log.splat, voices });
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
    for (const j of Object.values(CONTENT.jellies)) texts.push([`jelly ${j.id}`, `${j.name} · ${j.about}`]);
    for (const e of EVOLUTIONS) texts.push([`evolution ${e.id}`, `${e.name} · ${e.text}`]);
    // prose in the code players read: quoted strings with a space in them, comments stripped
    for (const f of ['run.js', 'hud.js', 'ui.js', 'main.js', 'stats.js', 'first-run.js', 'pick-screen.js', 'jelly-types.js']) {
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
// UI chrome uses the kit's icons, never an emoji (Treasures and stat icons keep theirs); dev tools are exempt.
story('vocabulary/no-emoji-in-ui-chrome', {
  about: 'No toast, screen title, button label or hint in the player-facing code starts with an emoji.',
  setup() {},
  async play() {
    const EMOJI = '[\\u{1F000}-\\u{1FFFF}\\u2600-\\u27BF\\u2B50]';
    const re = new RegExp(`(toast\\(|label: |title = |\\.message\\(|\\.choose\\(|\\.book\\(|pickTreasure\\(|pickLegendary\\(|eliteTreasure\\([^,]*,\\s*)[('"\`]${EMOJI}`, 'u');
    const hits = [];
    for (const f of ['run.js', 'hud.js', 'ui.js', 'leaderboard.js', 'sunrise.js', 'pick-screen.js', 'end-screen.js', 'creator.js']) {
      const src = await (await fetch(`/src/${f}`)).text();
      src.split('\n').forEach((line, i) => { if (re.test(line) && !/\(dev\)/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`); });
    }
    return ok(!hits.length, { hits });
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
    const badProp = tryIt('enemy "x" hp=1 r=0.01 dmg=1 xp=1 {\n    chase 0.3\n    spit wndup=1\n}');
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
story('look/face-fits-every-head', {
  about: 'Every expression stays inside its bell and follows its swimming pulse; sleepy lids have no glint.',
  setup() {},
  play() {
    const failures = [];
    for (const body of Object.keys(SPECIES)) for (const eyes of ['round', 'big', 'sleepy', 'angry', 'cyclops']) for (const mouth of ['smile', 'open', 'fangs', 'none']) {
      const c = buildCharacter({ body, eyes, mouth }, 1);
      const face = c.root.getObjectByName('Face'), bell = face.parent;
      c.pulse();
      c.update(1 / 60, { speed: 1, walkSpeed: 1, grounded: false, vy: 0 });
      c.root.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      const sp = SPECIES[body], top = sp.profile.at(-1)[1] * sp.R;
      let good = c.bend.x > 0.5;   // squeezing (bell-flex.js bends the bell, and the face with it)
      const f = { k: 1, dy: 0 };
      let closed = false, reopened = false;
      const check = () => face.traverse((o) => {
        if (!o.isMesh) return;
        const matrix = new THREE.Matrix4().multiplyMatrices(bell.matrixWorld.clone().invert(), o.matrixWorld);
        const positions = o.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          p.fromBufferAttribute(positions, i).applyMatrix4(matrix);
          let ry = p.y;   // where that point of the bell is at rest (the bend moves it down by dy(rest height))
          for (let n = 0; n < 40; n++) ry = p.y - bellFlex(ry, c.bend, f).dy;
          p.y = ry; p.x /= f.k; p.z /= f.k;
          const y = p.y / sp.R, upper = sp.profile.findIndex((v) => v[1] >= y);
          const [r0, y0] = sp.profile[Math.max(0, upper - 1)], [r1, y1] = sp.profile[Math.max(1, upper)];
          const radius = sp.R * (r0 + (r1 - r0) * (y - y0) / (y1 - y0));
          const edge = bellHalfWidth(sp, radius), surface = bellFront(sp, radius, p.x);
          good &&= Number.isFinite(p.z) && p.y > 0 && p.y < top && Math.abs(p.x) < edge && p.z > surface && p.z < surface + 0.03;
        }
      });
      check();
      for (let frame = 0; frame < 190 && !reopened; frame++) {
        const before = face.children[0].scale.y;
        c.update(1 / 60, { speed: 1, walkSpeed: 1, grounded: false, vy: 0 });
        if (face.children[0].scale.y !== before) {
          c.root.updateMatrixWorld(true);
          check();
          if (before === 1) closed = true;
          else reopened = closed;
        }
      }
      good &&= closed && reopened;
      if (eyes === 'sleepy') good &&= face.children.filter((o) => o.isGroup).every((eye) => eye.children.length === 5);
      if (!good) failures.push(`${body}/${eyes}/${mouth}`);
      c.dispose();
    }
    return ok(failures.length === 0, { variations: 120, failures });
  },
});
story('look/tokens-reach-the-game', {
  about: 'Values in content/look.css are what the game uses.',
  setup() {},
  play() {
    const s = G().APT.scene;
    return ok(LOOK.has('night-fill') && s.environmentIntensity === LOOK.num('night-fill') && s.fog.density === LOOK.num('haze') && !s.getObjectByName('Dawn window'), { fill: s.environmentIntensity, haze: s.fog.density });   // act 1 keeps the night: no dawn card
  },
});

story('words/leap-subtle-warning', {
  about: 'The lanternfly landing circle stays subtle through crouch and flight, while keeping the damage radius and countdown fill.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); const e = spawn('lanternfly', near(0, -.45)); e.leapCd = 0; },
  play() {
    const { enemies } = G(), e = enemies.list[0], samples = [];
    e.leapAt = e.pos.clone();
    for (const state of ['crouch', 'leap']) for (const k of [0, .5, 1]) {
      e.state = state; e.leapK = k;
      enemies.drawLeaps(k);
      const m = enemies.leapMarks[0];
      samples.push({ opacity: m.material.opacity, radius: m.scale.x, progress: m.material.progress, visible: m.visible });
    }
    e.state = 'rest'; enemies.drawLeaps(0);
    return ok(samples.every(s => s.visible && s.opacity >= .24 && s.opacity <= .28 + 1e-9 && s.radius === .2)
      && samples.map(s => s.progress).join() === '0,0.25,0.5,0.5,0.75,1' && !enemies.leapMarks[0].visible, { samples, hiddenAfter: !enemies.leapMarks[0].visible });
  },
});

// --- the cicada (act 4): a slow tank that digs in, trails you as a mound, locks and bursts up (a Blast that hurts and tosses)
// it starts at once (its cooldown is spent) and, with on-beat, on the next bar line
const cicadaAt = (d = 0.3) => { stub(G().run, 'song', null); const e = spawn('cicada', near(d, 0)); e.burrowCd = 0; return e; };   // (the run's own beat count: a song the speakers play, as an earlier story may have started one, keeps its own time)
story('words/burrow', {
  about: 'Within reach on the bar the cicada digs in (1 beat, still hittable) and goes under: it can\'t be hit or touched, a mound trails after you for 5 beats of the song, then locks and a circle and dome over the spot fill together for 2 beats; on that beat it bursts up as a Blast under the jelly that stood still (5 Health) and the Warning is gone.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.4); },
  play() {
    const { enemies, run } = G(), e = enemies.list[0], log = record('damage_taken'), shoves = record('knockback');
    step(60 * 8, () => e.state === 'dig');
    let dig = 0;
    while (e.state === 'dig' && dig < 120) { step(1); dig++; }
    const under = e.under && e.state === 'under';
    // the mound trails: a jelly that moves off finds it closer a moment later
    const P = G().player.position, off = P.clone(); tp(P.x + 0.5, P.y, P.z, 0);
    const d0 = e.pos.distanceTo(G().player.position); step(40); const d1 = e.pos.distanceTo(G().player.position);
    const trails = d1 < d0 - 0.05 && !e.burrowLocked && !enemies.burrowMarks.some((M) => M.floor.visible);
    step(60 * 8, () => e.burrowLocked);
    const lockedAt = e.pos.clone(), beatsAtLock = e.burrowBeats;
    step(8);
    const stays = e.pos.distanceTo(lockedAt) < 1e-4 && e.burrowAt.distanceTo(lockedAt) < 1e-4;
    let both = true, grew = true, last = 0, shown = 0;
    step(60 * 8, () => {
      if (e.under) {
        const M = enemies.burrowMarks[0];
        both = both && !!M && M.floor.visible && M.vol.visible && M.floor.material.progress === M.vol.material.progress && M.floor.scale.x === 0.15 && M.vol.scale.x === 0.15;
        if (M) { grew = grew && M.floor.material.progress >= last; last = M.floor.material.progress; shown++; }
      }
      return e.state === 'dazed';
    });
    const bursts = log.filter((d) => d.source === 'cicada' && d.amount === 5);
    const gone = !enemies.burrowMarks.some((M) => M.floor.visible || M.vol.visible);
    step(2);
    const beatF = 3600 / G().run.bpm;   // one beat in frames
    return ok(Math.abs(dig - beatF) < 3 && under && trails && beatsAtLock >= 5 && beatsAtLock < 5.6 && stays && both && grew && shown > 12 && e.state === 'dazed' && !e.under && bursts.length === 1 && gone,
      { dig, under, trails, beatsAtLock: +beatsAtLock.toFixed(2), stays, drift: [e.pos.distanceTo(lockedAt), e.burrowAt.distanceTo(lockedAt)], both, grew, shown, state: e.state, gone });
  },
});
story('words/burrow-hits', {
  about: 'If you are inside the circle when it bursts up you take 5 Health, are shoved away from its middle and tossed up.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken'), shoves = record('knockback');
    step(60 * 25, () => e.state === 'dazed');
    const hit = log.find((d) => d.source === 'cicada' && d.amount === 5), shove = shoves.find((k) => k.targetId === PLAYER && k.launch);
    return ok(!!hit && !!shove && shove.force === 1.5 && shove.launch === 0.5 && shove.tumble > 0 && Math.abs(shove.dir.length() - 1) < 1e-6 && shove.dir.y === 0, { hit: hit?.amount, shove: shove && { force: shove.force, launch: shove.launch } });
  },
});
story('words/burrow-throws-the-jelly-far', {
  about: 'A hit from the burst throws the jelly a long way: it flies and lands 0.8 to 1.6 m from the middle of the circle, with a freeze on the hit (the launched step), where it used to barely leave it.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], feels = spy(juice, 'feel');
    step(60 * 25, () => e.state === 'dazed');
    const at = e.burrowAt.clone(), launched = feels.some((a) => a[0] === 'launched');
    step(10);
    const up = !player.grounded;
    step(60 * 5, () => player.grounded && Math.hypot(player.velocity.x, player.velocity.z) < 0.02);
    const far = Math.hypot(player.position.x - at.x, player.position.z - at.z);
    return ok(launched && up && far >= 0.8 && far <= 1.6, { launched, up, far: +far.toFixed(2) });
  },
});
story('words/burrow-tumble-cant-be-steered', {
  about: 'Thrown by the burst, the jelly tumbles for 1 beat with almost no grip: the stick held against the throw barely slows it, and once the tumble is over the same stick takes the speed away.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies, player, run, input } = G(), e = enemies.list[0], shoves = record('knockback');
    step(60 * 25, () => e.state === 'dazed');
    const shove = shoves.find((k) => k.targetId === PLAYER && k.launch);
    if (!shove) return ok(false, { shove: null });
    const d = shove.dir, key = Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 'KeyA' : 'KeyD') : (d.z > 0 ? 'KeyW' : 'KeyS');   // the stick, held against the throw (yaw 0: W is -z, D is +x)
    const speed = () => d.x * player.velocity.x + d.z * player.velocity.z;   // along the throw
    const v0 = speed(), tumbling = run.tumbleT > 0, beat = 60 / run.bpm;
    input.keys = new Set([key]);
    step(Math.floor(60 * beat * 0.8));   // most of the tumble
    const vTumble = speed();
    step(Math.ceil(60 * beat * 0.4));    // past it
    const v1 = speed(); step(30); const vFree = speed();
    input.keys = new Set();
    return ok(Math.abs(shove.tumble - beat) < 1e-6 && tumbling && v0 > 0.9 && vTumble > 0.8 * v0 && vFree < 0.8 * v1, { tumble: shove.tumble, tumbling, v0: +v0.toFixed(2), vTumble: +vTumble.toFixed(2), v1: +v1.toFixed(2), vFree: +vFree.toFixed(2) });
  },
});
story('words/burrow-throw-shows-on-the-jelly', {
  about: 'Thrown by the burst, the jelly is squashed flat in the freeze, somersaults a whole turn about its middle while it tumbles and comes out of it upright, the camera falls a touch behind and then catches up, and it lands with a puff and a scuff. Under Reduce effects it neither spins nor leaves the camera behind.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies, player, run, tpc, fx } = G(), e = enemies.list[0], puffs = spy(fx, 'puff'), scuffs = spy(fx, 'splat');
    step(60 * 25, () => e.state === 'dazed');
    const squashed = player.avatar.squash.scale.y;
    let turned = 0, lagged = 0, behind = 0, landed = -1;
    const n0 = puffs.length;
    for (let i = 0; i < 60 && (run.tumbleT > 0 || landed < 0); i++) {
      step(1);
      turned = Math.max(turned, player.mesh.rotation.x); lagged = Math.max(lagged, tpc.lag || 0);
      behind = Math.max(behind, Math.hypot(tpc.focus.x - player.position.x, tpc.focus.z - player.position.z));
      if (landed < 0 && player.grounded) landed = i;
    }
    step(30);
    const upright = player.mesh.rotation.x === 0, caught = Math.hypot(tpc.focus.x - player.position.x, tpc.focus.z - player.position.z) < 0.02 && !tpc.lag;
    const puffed = puffs.slice(n0).some((a) => a[2] >= G().CONFIG?.player?.radius * 2 || a[2] > 0.04), scuffed = scuffs.some((a) => a[3] === 'dust');
    // Reduce effects: a fresh tumble shows no somersault and no camera lag
    const was = juice.calm; juice.calm = true;
    run.tumbleT = run.tumbleMax = 0.4; step(5);
    const calm = player.mesh.rotation.x === 0 && !tpc.lag;
    juice.calm = was; run.tumbleT = 0;
    return ok(squashed < 0.7 && turned > 2 && lagged > 0.5 && behind > 0.03 && landed >= 0 && upright && caught && puffed && scuffed && calm,
      { squashed: +squashed.toFixed(2), turned: +turned.toFixed(2), lagged, behind: +behind.toFixed(3), landed, upright, caught, puffed, scuffed, calm });
  },
});
story('words/burrow-bursts-on-the-downbeat', {
  about: 'Dig 1 beat, trail 5, Warning 2: the burst lands 8 beats after the dig starts (two bars), on a beat of the song.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.4); },
  play() {
    const { enemies, run } = G(), e = enemies.list[0];
    step(60 * 8, () => e.state === 'dig');
    const b0 = run.beat;
    step(60 * 25, () => e.state === 'dazed');
    const span = run.beat - b0, frac = Math.abs(run.beat - Math.round(run.beat));
    return ok(e.state === 'dazed' && Math.abs(span - 8) < 0.3, { span: +span.toFixed(2), frac: +frac.toFixed(2) });
  },
});
story('words/burrow-dodge', {
  about: 'Stepping off the circle once it has locked: the burst goes off without touching the jelly (no Health lost, no toss).',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies } = G(), e = enemies.list[0], log = record('damage_taken'), shoves = record('knockback');
    step(60 * 25, () => e.burrowLocked);
    const P = G().player.position;
    tp(P.x + 0.3, P.y, P.z, 0);
    step(60 * 8, () => e.state === 'dazed');
    return ok(e.state === 'dazed' && !log.some((d) => d.source === 'cicada' && d.amount === 5) && !shoves.some((k) => k.targetId === PLAYER && k.launch), { state: e.state });
  },
});
story('words/burrow-jump', {
  about: 'The burst is a half sphere 15 cm round: a jelly at the top of a jump over the circle when it bursts up is not hurt.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies, player } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 25, () => e.burrowLocked && e.burrowK > 0.85);
    const P = player.position;
    stub(player, 'update', () => {});   // hold it up there for the frame the burst lands
    player.position.set(P.x, P.y + 0.2, P.z); player.velocity.set(0, 0, 0);
    step(60 * 3, () => e.state === 'dazed');
    return ok(e.state === 'dazed' && !log.some((d) => d.source === 'cicada' && d.amount === 5), { state: e.state });
  },
});
story('words/burrow-untouchable', {
  about: 'Under the floor the cicada can\'t be hurt, frozen, stunned, shot or touched: a hit does nothing, your own attack passes over its mound and standing on it costs nothing; once it bursts up and stands dazed (4 beats) it can be hit again, then it walks.',
  setup() { fresh({ hurt: true, elites: false, bubbles: true, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies, run } = G(), e = enemies.list[0], log = record('damage_taken');
    step(60 * 8, () => e.under);
    log.length = 0;
    const hp = e.hp;
    bus.emit('damage_taken', { targetId: e.id, amount: 50, color: '#fff', source: 'story' });
    bus.emit('status_applied', { targetId: e.id, status: 'freeze', duration: 2 });
    bus.emit('status_applied', { targetId: e.id, status: 'stun', duration: 2 });
    step(60 * 2);
    const near = run.gadgets.near(e.pos, 0.3).includes(e);
    const unhurt = e.hp === hp && !(e.freezeT > 0) && !(e.stunT > 0) && !near && !log.some((d) => d.source === 'cicada' && d.contact) && e.under;
    step(60 * 8, () => e.state === 'dazed');
    const dazedAt = e.hp;
    step(90);
    const hittable = e.hp < dazedAt || e.dead;
    return ok(unhurt && hittable, { unhurt, hittable, hp, now: e.hp, dazedAt, frozen: e.freezeT, stunned: e.stunT, near, touched: log.filter((d) => d.source === 'cicada' && d.contact).length, under: e.under });
  },
});
story('words/burrow-dazed', {
  about: 'After it bursts up the cicada stands still for 4 beats, dazed, then walks again and can dig in once its 4 s are up.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.1); },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    step(60 * 25, () => e.state === 'dazed');
    const at = e.pos.clone();
    let frames = 0; step(60 * 4, () => { if (e.state === 'dazed') frames++; return e.state === 'approach'; });
    const moved = e.pos.distanceTo(at);
    const beatF = 3600 / G().run.bpm;
    return ok(Math.abs(frames - 4 * beatF) < 4 && moved < 0.01 && e.state === 'approach' && e.burrowCd > 3, { secs: +(frames / 60).toFixed(2), moved: +moved.toFixed(4), cd: +e.burrowCd.toFixed(2) });
  },
});
story('words/burrow-mound-is-dimmer-than-the-warning', {
  about: 'The mound that trails the jelly has a dim rim, dimmer than the locked circle, so the moment it locks (the moment to step off) stands out.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); cicadaAt(0.4); },
  play() {
    const { enemies } = G(), e = enemies.list[0];
    step(60 * 8, () => e.state === 'under');
    step(30);
    let rim = null;
    e.root.traverse((o) => { if (o.material && o.material.blending === 2 && o.material.opacity < 1 && !rim) rim = o.material; });
    const floor = LOOK.num('burrow-floor-opacity', 0.3);
    return ok(!!rim && e.under && !e.burrowLocked && rim.opacity <= floor, { under: e.under, locked: e.burrowLocked, rim: rim && rim.opacity, floor });
  },
});
