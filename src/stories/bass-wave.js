// Stories: act 4's bass wave (bass-wave.js, STAGE4.bass), in the living room at dawn. Every 16 bars of
// the song, on the bar, the Soundbar sends one low wave from the TV wall to the window wall. The beat is
// the run's own count here (the song is taken away, so a story that unlocked sound doesn't set the pace).
import { PLAYER } from '../events.js';
import { STAGE4 } from '../stage4.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { G, act4, encoreFight, everyAttack, fresh, night4, ok, record, spy, step, stub, tp } from './kit.js';

const OPEN = [3.2, 0, 3.0];         // open floor in the middle of the room (act 1's spot), shaded early in the night
const TABLE = [2.6, 0.5, 3.0];      // the coffee table top (0.46), where its vent lands you
// the beat clock is the run's own, and the next wave is a bar and a bit away
const ready = (lead = 4.5) => { const { run } = G(); stub(run, 'song', null); run.beat = run.bass.next - lead; return run.bass; };
const bassHits = (log) => log.filter((d) => d.source === 'bass' && d.targetId === PLAYER);

night4('the-bass-wave-goes-off-on-the-bar', {
  about: 'Every 16 bars (64 beats: 30 s at 128 BPM) the Soundbar sends its wave on the bar line. Over the bar before, its Warning (a floor strip along the TV wall and the hex volume over it, in --hostile-bass) fills together to the moment it goes; a beat ahead a sub drop plays; on the bar the room thumps (feel bass) and the wave rolls toward the window. A jelly on the floor in its way is hit once, for 4 (8 Health with act 4\'s power), from the bass. No light is added and no shader is built.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(...OPEN); },
  play() {
    const { run, APT, batcher, GAME } = G(), B = ready(), hits = record('damage_taken'), feels = spy(juice, 'feel'), drops = spy(sfx, 'bassDrop');
    const lights = []; APT.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    batcher.sync(); GAME.compile();
    const programs = APT.renderer.info.programs.length;
    const at = B.next, every = STAGE4.bass.every * 4;
    let warnFrom = null, dropAt = null, wentAt = null, filling = true, paired = true, last = -1;
    step(60 * 8, () => {
      if (B.state === 'warn') {
        warnFrom ??= run.beat;
        const p = B.mat.progress;
        if (p < last) filling = false;
        if (p !== B.vol.material.progress || B.strip.position.z !== B.vol.position.z || !B.strip.visible || !B.vol.visible) paired = false;
        last = p;
      }
      if (dropAt == null && drops.length) dropAt = run.beat;
      if (wentAt == null && B.state === 'wave') wentAt = run.beat;
      return wentAt != null && B.state === 'idle';
    });
    batcher.sync(); GAME.compile();
    const newShaders = APT.renderer.info.programs.length - programs, after = []; APT.scene.traverse((o) => { if (o.isLight) after.push(o); });
    const bass = bassHits(hits);
    return ok(at % every === 0 && warnFrom >= at - 4 && warnFrom < at - 3.9 && filling && paired && dropAt >= at - 1 && dropAt < at - 0.9
      && wentAt >= at && wentAt < at + 0.1 && feels.some(([k]) => k === 'bass') && bass.length === 1 && bass[0].amount === STAGE4.bass.dmg
      && run.lost.bass === 8 && !B.strip.visible && !B.vol.visible && B.next === at + every && newShaders === 0 && after.length === lights.length,
    { at, warnFrom, dropAt, wentAt, filling, paired, hits: bass.map((d) => d.amount), lostBass: run.lost.bass, next: B.next, newShaders, lights: [lights.length, after.length] });
  },
});

night4('a-menu-over-the-warning-drops-that-wave', {
  about: 'A menu (a level-up, the pause) holds the run while the song plays on: if it ate the end of a Warning, that wave doesn\'t go off unwarned when play comes back; the next one comes on the next 16-bar line.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(...OPEN); },
  play() {
    const { run } = G(), B = ready(2), feels = spy(juice, 'feel'), went = spy(sfx, 'bassWave'), at = B.next;
    step(10);
    const warned = B.state === 'warn';
    run.beat += 8;                 // the menu: eight beats pass at once
    step(30);
    return ok(warned && B.state === 'idle' && !went.length && !feels.some(([k]) => k === 'bass') && B.next === at + STAGE4.bass.every * 4, { warned, state: B.state, went: went.length, next: B.next });
  },
});

night4('a-jump-clears-the-bass-wave', {
  about: 'Jumping as the wave reaches you clears it: its top is 5 cm, and a jump\'s feet are well above that as it passes. The same wave hits a jelly that stays down.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(...OPEN); },
  play() {
    const { run, input, player } = G(), out = {};
    for (const jump of [true, false]) {
      tp(...OPEN); run.iFrames = 0;
      const B = ready(1), hits = record('damage_taken');
      let jumped = false, over = null;
      step(60 * 7, () => {
        // jump as its front comes within 25 cm
        if (jump && !jumped && B.state === 'wave' && B.z - STAGE4.bass.width - player.position.z < 0.25) { jumped = true; input.jumpQueued = true; }
        if (B.state === 'wave' && over == null && B.z - STAGE4.bass.width < player.position.z) over = +player.position.y.toFixed(3);   // its front passing under the jelly
        return B.state === 'wave' && B.z < player.position.z - 0.3;
      });
      out[jump ? 'jump' : 'down'] = { hits: bassHits(hits).length, feetAsItPassed: over };
    }
    return ok(out.jump.hits === 0 && out.jump.feetAsItPassed > STAGE4.bass.height && out.down.hits === 1, out);
  },
});

night4('furniture-is-above-the-bass-wave', {
  about: 'On a furniture top (the coffee table, 46 cm up) the wave passes underneath: no hit.',
  setup() { fresh({ hurt: true, bubbles: false, lash: false }); tp(...TABLE); },
  play() {
    const { run, player } = G(), B = ready(1), hits = record('damage_taken');
    run.iFrames = 0;
    const y = player.position.y;
    step(60 * 7, () => B.state === 'wave' && B.z < player.position.z - 0.3);
    return ok(y > 0.4 && B.state === 'wave' && bassHits(hits).length === 0, { y: +y.toFixed(3), state: B.state, hits: bassHits(hits).length });
  },
});

night4('every-room-attack-warns', {
  about: 'Every attack in the living room has its Warning (kit.js EVERY_ATTACK, act 4 scene 1): the bass wave\'s floor strip with its volume over it, filling together, no shader built, both gone after.',
  setup() { fresh({ bubbles: false, lash: false }); tp(...OPEN); },
  play() { return everyAttack(4); },
});

act4('the-arena-has-no-bass-wave', {
  about: 'The Encore\'s arena (the act\'s second scene) has no bass wave: the stage has no bass block, nothing is built, and stepping over the 16-bar line sends nothing.',
  setup() { encoreFight(); },
  play() {
    const { run } = G(), hits = record('damage_taken');
    stub(run, 'song', null); run.beat = 60;
    step(60 * 6);
    return ok(!run.stage.bass && !run.bass.B && !run.bass.strip && run.beat > 64 && bassHits(hits).length === 0, { bass: !!run.stage.bass, built: !!run.bass.strip, beat: run.beat });
  },
});
