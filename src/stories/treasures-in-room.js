// Stories: golden chests in the room. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { G, V, fresh, near, ok, r3, step, story, stub, tp } from './kit.js';

// --- treasures in the room: golden chests, on a schedule (each somewhere else, for a limited
// time) and where elites fall (for good)
const waiting = (timed) => G().run.roomTreasures.filter((t) => t.active && (timed === undefined || t.timed === timed));
story('treasures/appear-on-schedule', {
  about: 'Treasures turn up in the room at 0:15, 1:00, 1:45, 2:45 and 3:45, each somewhere else, and fade after 22 s if nobody takes them.',
  setup() { fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G(), seen = [], spots = new Set();
    let gone = 0;
    stub(run.hud, 'toast', (text) => { if (/faded/.test(text)) gone++; });
    const wasActive = { v: false };
    for (let i = 0; i < 60 * 240; i++) {
      G().GAME.step(1 / 60);
      const t = waiting(true)[0];
      if (t && !wasActive.v) { seen.push(Math.round(run.t)); spots.add(t.spot.label); }
      wasActive.v = !!t;
    }
    const want = [15, 60, 105, 165, 225];
    return ok(seen.length === 5 && seen.every((t, k) => Math.abs(t - want[k]) <= 1) && gone >= 4 && spots.size >= 4, { seen, gone, spots: [...spots] });
  },
});
story('treasures/elite-chest-never-inside-furniture', {
  about: 'An elite bug beaten under furniture (a covered spot) leaves its chest on the nearest open spot instead: nothing over it or crowding it, easy to touch.',
  setup() { fresh({ treasures: false, elites: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies } = G();
    stub(run.hud, 'toast', () => {});
    // find a covered spot on the floor nearby (under a table, the sofa…)
    let at = null;
    for (let x = 1; x <= 5 && !at; x += 0.1) for (let z = 1.5; z <= 5 && !at; z += 0.1) {
      const r = run.openSpot([x, 0.02, z]);
      if (!r.ok && r.why === 'covered overhead') { const h = run.world.castAll(V(x, 0.15, z), V(0, -1, 0), 0.4); if (h && h.point.y < 0.02) at = V(x, h.point.y, z); }
    }
    const bug = enemies.spawn('roach', at, 1, true); bug.spawnT = 1; bug.hold = true;
    enemies.kill(bug);
    step(2);
    const t = waiting(false)[0], open = t && run.openSpot([t.pos.x, t.pos.y, t.pos.z]).ok, d = t && Math.hypot(t.pos.x - at.x, t.pos.z - at.z);
    return ok(!!at && open && d < 0.5, { at: at && r3(at), chest: t && r3(t.pos), open, moved: d && +d.toFixed(2) });
  },
});
story('treasures/touch-the-chest', {
  about: 'A treasure waits in the room as a small golden chest (no beam of light): touching it in time offers a treasure pick, and it goes away.',
  setup() { fresh({ elites: false, treasures: true }); tp(3.2, 0.05, 3.0, 0); G().run.t = 14.9; },
  play() {
    const { run } = G();
    step(30, () => waiting(true).length);
    const t = waiting(true)[0], p = t.pos.clone();
    const size = new THREE.Box3().setFromObject(t.chest).getSize(V(0, 0, 0));
    const small = size.y < 0.05 && size.x < 0.06;            // a chest, not a tall beam
    let offered = false, tiers = [];
    stub(run.ui, 'choose', (tt, s, list) => { offered = true; tiers = list.map((c) => c.rarity); });
    tp(p.x, p.y + 0.01, p.z);
    step(50, () => offered);   // the chest strains, pops and sits open (~0.6 s) before the pick
    const roomTiers = tiers.length === 3 && tiers.every((r) => ['common', 'rare', 'epic', 'legendary'].includes(r));
    return ok(offered && !t.active && small && roomTiers, { offered, small, tiers, size: r3(size), at: r3(p) });
  },
});
story('treasures/elites-leave-a-chest', {
  about: 'A beaten elite (an elite bug, or one on its high ground) leaves a golden chest near where it fell, on an open spot, with no pick right away and no bonus health; the chest waits for good, and touching it offers the pick.',
  setup() { fresh({ treasures: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run, enemies } = G();
    let picks = 0, tiers = [];
    stub(run.ui, 'choose', (t, s, list) => { picks++; tiers.push(...list.map((c) => c.rarity)); });
    stub(run.hud, 'toast', () => {});
    const h0 = run.health = 20;
    // an elite bug, 25 cm away
    const bug = enemies.spawn('roach', near(0.25, 0), 1, true); bug.spawnT = 1; bug.hold = true;
    enemies.kill(bug);
    step(2);
    // near where it fell, on an open spot (nothing over or around it)
    const open = (t) => run.openSpot([t.pos.x, t.pos.y, t.pos.z]).ok;
    const fromBug = waiting(false)[0], bugSpot = fromBug && Math.hypot(fromBug.pos.x - bug.pos.x, fromBug.pos.z - bug.pos.z) < 0.5 && open(fromBug);
    // a high-ground elite
    const E = run.elites.alive[0];
    run.eliteDefeated(E);
    const fromElite = waiting(false).find((t) => t !== fromBug), eliteSpot = fromElite && fromElite.pos.distanceTo(E.base) < 0.5 && open(fromElite);
    const noPickYet = picks === 0, noHeal = run.health === h0;
    step(60 * 60);                                          // a minute later, both still wait
    const stayed = waiting(false).length === 2;
    tp(fromBug.pos.x, fromBug.pos.y + 0.01, fromBug.pos.z); step(110, () => picks);   // an Elite's chest builds and sits open (~1.25 s) before its pick
    const eliteTiers = tiers.length === 3 && tiers.every((r) => ['common', 'rare', 'epic', 'legendary'].includes(r));
    return ok(bugSpot && eliteSpot && noPickYet && noHeal && stayed && picks === 1 && !fromBug.active && eliteTiers,
      { bugSpot, eliteSpot, noPickYet, noHeal, stayed, picks, tiers, health: run.health });
  },
});
story('treasures/chest-glow-is-neutral-until-opening', {
  about: 'Room and elite chests glow neutral gold, with a matching timer ring, because no minimum rarity is guaranteed.',
  setup() { fresh({ elites: false, treasures: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G();
    const room = run.placeTreasure(V(3.0, 0.05, 2.6), 22);
    const elite = run.placeTreasure(V(3.4, 0.05, 3.4), Infinity);
    const hex = (c) => '#' + c.getHexString();
    return ok(hex(room.tierColor) === '#ffc93a' && hex(elite.tierColor) === '#ffc93a'
      && hex(room.ring.material.uniforms.uColor.value) === '#ffc93a',
      { roomGlow: hex(room.tierColor), eliteGlow: hex(elite.tierColor), ring: hex(room.ring.material.uniforms.uColor.value) });
  },
});
story('treasures/chest-opens-with-a-snap', {
  about: 'Touching a chest doesn\'t open it at once: it strains (shaking, squashing), its lid pops, and then it sits open and glowing for a beat before the pick is offered — without the beat the pick screen covers the pop\'s own frame. An Elite\'s chest builds for most of a second; a room chest is a quick snap.',
  setup() { fresh({ elites: false, treasures: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { run } = G();
    let offered = 0;
    stub(run.ui, 'choose', () => { offered++; });
    const open = (stay) => {
      step(5);                                            // settle onto the floor first
      const P = run.player.position.clone();
      const t = run.placeTreasure(V(P.x, P.y, P.z), stay);
      tp(P.x, P.y + 0.01, P.z);
      let frames = 0, strained = false, lid = 0, lidAt = 0;
      while (!offered && frames < 140) {
        G().GAME.step(1 / 60); frames++;
        if (t.opening !== null) strained = true;
        lid = Math.min(lid, t.lidPivot.rotation.x);
        if (!lidAt && lid < -1.5) lidAt = frames;
      }
      const done = offered === 1 && !t.active; offered = 0;
      return { frames, strained, lid: +lid.toFixed(2), seenOpenFor: frames - lidAt, done };
    };
    const room = open(22);
    const elite = open(Infinity);
    return ok(room.done && elite.done && room.frames >= 30 && room.frames <= 46 && elite.frames >= 68 && elite.frames <= 88
      && room.lid < -1.2 && elite.lid < -1.2 && elite.strained && room.seenOpenFor >= 15 && elite.seenOpenFor >= 15, { room, elite });
  },
});
