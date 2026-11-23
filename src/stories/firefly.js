// Stories: the firefly (act 4) and its `lob`. Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { G, fresh, near, night4, ok, record, spawn, step, stub, tp, story } from './kit.js';

// the firefly's lob, as content/enemies.kdl gives it (for pools thrown straight in, below)
const LOB = { flight: 1.2, peak: 0.2, radius: 0.14, dmg: 2, drain: 1, last: 10, most: 12 };
const pools = () => G().enemies.glowPools;
const throwAt = (to, from = to.clone().setY(to.y + 0.15)) => pools().throw(from, to, LOB, -1, 'firefly');
const drained = (log) => log.filter((d) => d.source === 'firefly' && d.drain).reduce((s, d) => s + d.amount, 0);
const settle = () => { const { run } = G(); stub(run, 'song', null); run.beat = 1.3; };

night4('firefly-flies', {
  about: 'A firefly flies low: it drifts 8 to 28 cm above you about 22 cm from you, bobbing up and down, and now and then hangs still in the air.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); spawn('firefly', near(0.25, 0, 0.4)).lobCd = 1e9; },
  play() {
    const e = G().enemies.list[0], P = G().player.position;
    step(60 * 2);
    let lo = 9, hi = -9, still = 0, flat = 0, n = 0;
    step(60 * 10, () => {
      const h = e.pos.y - P.y;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      if (e.vel.length() < 0.012) still++;
      flat += Math.hypot(e.pos.x - P.x, e.pos.z - P.z); n++;
    });
    flat /= n;
    return ok(lo > 0.08 && hi < 0.28 && hi - lo > 0.06 && still > 20 && Math.abs(flat - 0.22) < 0.06 && e.T.fly, { lo: +lo.toFixed(3), hi: +hi.toFixed(3), stillFrames: still, flat: +flat.toFixed(3) });
  },
});

night4('firefly-lamp-flashes-every-4-beats', {
  about: 'A flying firefly\'s lamp swells and fades once every 4 beats of the song (1.875 s at 128 bpm), brightest just after the bar, dull in between; its wing covers stay raised and its hind wings beat.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); spawn('firefly', near(0.22, 0, 0.17)).lobCd = 1e9; },
  play() {
    const { run } = G(), e = G().enemies.list[0], lamp = e.mesh.getObjectByName('firefly-lamp'), wing = e.mesh.getObjectByName('firefly-wing').children[0];
    const lum = () => { const c = lamp.userData.color; return c.r + c.g + c.b; };
    step(30);
    let was = false, low = 9, high = 0, beats0 = run.beat, flaps = new Set();
    const flashes = [];
    step(60 * 8, () => {
      const L = lum(), on = L > 1.5;
      low = Math.min(low, L); high = Math.max(high, L);
      if (on && !was) flashes.push(+(run.beat % 4).toFixed(2));
      was = on;
      flaps.add(Math.round(wing.rotation.z * 10));
    });
    const bars = (run.beat - beats0) / 4, cover = e.mesh.getObjectByName('firefly-cover');
    return ok(Math.abs(flashes.length - bars) <= 1 && flashes.every((b) => b < 0.3) && high > 2.5 && low < high / 4 && Math.abs(cover.rotation.x) > 0.4 && flaps.size > 8,
      { flashes, bars: +bars.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), coverUp: +cover.rotation.x.toFixed(2), flapSpread: flaps.size });
  },
});

story('words/lob', {
  about: 'lob: on a blink a firefly turns its tail to you, lifts it and lobs a glowing Shot in a high arc from its tail; a Warning circle and dome fill together at where you stood, full the moment it lands there as a Blast that hits you for 3, and a glowing pool is left behind.',
  act: 4,
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); spawn('firefly', near(0.25, 0, 0.4)).lobCd = 0; },
  play() {
    const { run } = G(), e = G().enemies.list[0], P = G().player.position, log = record('damage_taken');
    let wound = null, L = null, tail = null, at = null, peak = 0, fill = [], landK = null;
    step(60 * 6, () => {
      if (e.state === 'windup' && wound == null) wound = +run.beat.toFixed(3);
      if (!L && pools().lobs.length) {
        L = pools().lobs[0];
        const yaw = e.root.rotation.y, away = Math.atan2(e.pos.x - P.x, e.pos.z - P.z);
        tail = Math.abs(Math.atan2(Math.sin(yaw - away), Math.cos(yaw - away)));   // facing away from you: its tail to you
        at = Math.hypot(L.to.x - P.x, L.to.z - P.z);
        tp(P.x + 0.3, P.y, P.z);                                                     // step out of it, so the Blast misses
      }
      if (L && !L.done) {
        peak = Math.max(peak, L.m.position.y - Math.max(L.from.y, L.to.y));
        const f = L.mark.floor.material.progress, v = L.mark.vol.material.progress;
        fill.push(+(f - v).toFixed(6));
        landK = f;
        if (!L.mark.floor.parent || !L.mark.vol.parent) fill.push(9);
      }
      return L?.done;
    });
    const missed = !log.some((d) => d.source === 'firefly' && !d.drain);
    // and once more, standing still: it lands on you
    const e2 = spawn('firefly', near(-0.25, 0, 0.4)); e2.lobCd = 0; e.lobCd = 1e9;
    step(60 * 6, () => log.some((d) => d.source === 'firefly' && !d.drain));
    const hit = log.find((d) => d.source === 'firefly' && !d.drain);
    return ok(wound != null && wound % 2 < 0.1 && tail < 0.3 && at < 0.01 && peak > 0.09 && fill.every((x) => x === 0) && landK > 0.97 && missed && hit?.amount === 3 && pools().pools.length >= 1,
      { wound, tail: tail && +tail.toFixed(2), at: at && +at.toFixed(4), peak: +peak.toFixed(3), landK, missed, hit: hit?.amount, pools: pools().pools.length });
  },
});

night4('firefly-lobs-on-the-bar', {
  about: 'A firefly\'s lamp blinks on every beat; its lob only winds up on a blink (every second beat), about every 4 s.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); settle(); spawn('firefly', near(0.25, 0, 0.4)).lobCd = 0; },
  play() {
    const { run } = G(), e = G().enemies.list[0], starts = [];
    let was = e.state, pulses = 0;
    step(60 * 14, () => {
      if (e.beatPulse === 1) pulses++;
      if (e.state === 'windup' && was !== 'windup') starts.push({ beat: +run.beat.toFixed(3), t: +run.t.toFixed(2) });
      was = e.state;
      return starts.length >= 2;
    });
    const gap = starts.length >= 2 ? starts[1].t - starts[0].t : 0;
    return ok(starts.length >= 2 && starts.every((s) => s.beat % 2 < 0.1) && gap >= 4 && gap < 7 && pulses >= 12 && !e.dead, { starts, gap: +gap.toFixed(2), pulses });
  },
});

night4('firefly-pool-lasts-10s', {
  about: 'A firefly\'s pool drains 1 Health a second (before the act\'s power) while you stand in it, nothing while you jump over it, and is gone 10 s after it landed.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const { player } = G(), P = player.position, log = record('damage_taken');
    throwAt(P.clone());
    step(60 * 2, () => pools().pools.length);
    let age = 0;
    const t0 = log.length;
    age += step(60);
    const standing = drained(log.slice(t0));
    const t1 = log.length;
    G().input.jumpQueued = true;                                         // a jump over it
    let air = 0;
    age += step(60, () => { if (!player.grounded) air++; return air > 5 && player.grounded; });
    const jumping = drained(log.slice(t1, -1));
    age += step(60 * 9.5 - age);
    const at9 = pools().pools.filter((D) => D.live).length;
    step(60 * 0.7);
    const at10 = pools().pools.length;
    return ok(Math.abs(standing - 1) < 0.05 && air > 5 && jumping === 0 && at9 === 1 && at10 === 0, { standing: +standing.toFixed(3), airFrames: air, jumping, at9, at10 });
  },
});

night4('firefly-pools-stack', {
  about: 'Two firefly pools on top of each other drain twice as fast as one.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const P = G().player.position, log = record('damage_taken');
    throwAt(P.clone()); throwAt(P.clone().add({ x: 0.05, y: 0, z: 0 }));
    step(60 * 1.3, () => pools().pools.length === 2);
    const t0 = log.length;
    step(60);
    const both = drained(log.slice(t0));
    return ok(Math.abs(both - 2) < 0.08 && Math.abs(pools().drainAt(P) - 2) < 1e-9, { both: +both.toFixed(3) });
  },
});

night4('firefly-pool-cap', {
  about: 'At most 12 firefly pools glow at once: a 13th makes the oldest fade, and it stops draining at once.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); },
  play() {
    const P = G().player.position;
    for (let i = 0; i < 13; i++) { throwAt(P.clone().add({ x: 0.4 + (i % 4) * 0.3, y: 0, z: -0.5 + Math.floor(i / 4) * 0.3 })); step(2); }
    step(60 * 1.4, () => !pools().lobs.length);
    const all = pools().pools, first = all[0], live = all.filter((D) => D.live).length, old = first.live;
    step(30);
    return ok(live === 12 && !old && !pools().pools.includes(first) && pools().pools.length === 12 && pools().drainAt(first.at) === 0,
      { live, oldestLive: old, after: pools().pools.length });
  },
});

night4('firefly-from-the-start', {
  about: 'Act 4\'s night opens with fireflies, at 0:00: a roll favouring the last eligible bug spawns one, and no dragonfly stand-in is left.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies, player } = G();
    stub(Math, 'random', () => 0.999999);
    stub(run, 'spawnPoint', () => player.position.clone());
    enemies.clear(); run.t = 0; run.spawnAcc = 1; run.spawnWaves(0);
    const types = new Set(enemies.list.map((e) => e.type));
    return ok(types.has('firefly') && !types.has('dragonfly'), { types: [...types] });
  },
});
