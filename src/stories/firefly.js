// Stories: the firefly (act 4). Shared helpers are in ./kit.js; src/stories.js imports this file in order.
import { G, fresh, near, night4, ok, record, spawn, step, stub, tp } from './kit.js';

const lampOf = (e) => { let m = null; e.root.traverse((o) => { if (o.isMesh && o.userData.color && o.material.userData.perInstance) m = o; }); return m; };
const glow = (e) => { const c = lampOf(e).userData.color; return c.r + c.g + c.b; };

night4('firefly-blinks-then-darts', {
  about: 'A firefly drifts near you with its lamp blinking on every beat of the song; its dart only starts on the fourth blink (the bar), with at least three blinks between darts, and it bites for 2.',
  setup() { fresh({ hurt: true, elites: false, bubbles: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(G().run, 'song', null); G().run.beat = 1.3; spawn('firefly', near(0.2, 0, 0.1)).biteCd = 0; },
  play() {
    const { run } = G(), e = G().enemies.list[0], log = record('damage_taken');
    let was = e.state, up = false, blinks = 0;
    const starts = [], between = [];
    step(60 * 14, () => {
      const hot = glow(e) > 1.5;
      if (hot && !up && e.state !== 'windup' && e.state !== 'dart') blinks++;
      up = hot;
      if (e.state === 'windup' && was !== 'windup') { starts.push(+run.beat.toFixed(3)); between.push(blinks); blinks = 0; }
      was = e.state;
      return starts.length >= 3;
    });
    const bites = log.filter((d) => d.source === 'firefly' && d.amount === 2).length;
    const onBar = starts.length >= 2 && starts.every((b) => b % 4 < 0.1);
    return ok(onBar && between.slice(1).every((n) => n >= 3) && bites >= 1 && !e.dead, { starts, blinksBefore: between, bites });
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
