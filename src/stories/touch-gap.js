// Touch damage (run.js hit, contactDamage; turrets.js hurt, touches; cfg.touchGap in config.js): each bug (or
// Boss) can hurt the jelly, or a Jelly Mould's little jelly, by touching it at most once a second, two bugs touching at once both land, and other hits keep
// the shared 0.25 s no-hurt time.
import { PLAYER, bus } from '../events.js';
import { G, V, holdJelly, near, ok, record, setupFight, spawn, step, story } from './kit.js';

story('touch/each-bug-hurts-by-touch-once-a-second', {
  about: 'Two Cockroaches stand touching a still jelly for 2.5 s (no Dodge): both touches land on the first frame, and each bug hurts again only a second later, 3 times each in all. Two hits that are not touches, 0.1 s apart, still land only once.',
  setup() {},
  play() {
    setupFight({ hurt: true, bubbles: false, lash: false }); holdJelly();
    const { run, player } = G();
    run.S.dodge = 0; run.health = 1e6; run.iFrames = 0;
    const P = player.position;
    const bugs = [V(P.x + 0.05, P.y + 0.01, P.z), V(P.x - 0.05, P.y + 0.01, P.z)].map((at) => spawn('roach', at, { still: true, hp: 1e7 }));
    const hurt = record('player_hurt'), at = [];
    step(150, (f) => { while (at.length < hurt.length) at.push(f / 60); });
    const per = bugs.map((e) => at.filter((_, i) => hurt[i].from === e.id));
    const firstTogether = per.every((t) => t[0] != null && t[0] === per[0][0]);
    const gaps = per.flatMap((t) => t.slice(1).map((x, i) => x - t[i]));
    for (const e of bugs) G().enemies.kill(e, true);
    // two hits that aren't touches, 0.1 s apart: the shared no-hurt time still holds the second
    run.iFrames = 0; const plain = record('player_hurt');
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' }); step(6);
    bus.emit('damage_taken', { targetId: PLAYER, amount: 1, source: 'story' }); step(1);
    return ok(firstTogether && per.every((t) => t.length === 3) && gaps.every((g) => g >= 0.98 && g <= 1.05) && plain.length === 1,
      { hitsPerBug: per.map((t) => t.length), firstTogether, gaps: gaps.map((g) => +g.toFixed(3)), plainHits: plain.length });
  },
});

story('touch/each-bug-hurts-a-little-jelly-by-touch-once-a-second', {
  about: 'Two Cockroaches stand touching a Jelly Mould\'s little jelly for 2.5 s: both touches land on the first frame, then again each second, 3 times in all (6 touches), never in between.',
  setup() {},
  play() {
    setupFight({ hurt: true, types: 'summoner', lash: false }); holdJelly();
    const { run } = G();
    run.turrets.place(near(0.4, 0), { time: 30, health: 999, dmg: 0, most: 4 });
    const T = run.turrets.list.at(-1), c = T.center;
    const bugs = [V(c.x + 0.04, T.position.y + 0.01, c.z), V(c.x - 0.04, T.position.y + 0.01, c.z)].map((at) => spawn('roach', at, { still: true, hp: 1e7 }));
    const one = bugs[0].T.dmg * (run.stage.power || 1), drops = [];
    let was = T.health;
    step(150, (f) => { if (T.health < was - 1e-9) drops.push([f / 60, +((was - T.health) / one).toFixed(2)]); was = T.health; });
    for (const e of bugs) G().enemies.kill(e, true);
    const gaps = drops.slice(1).map((d, i) => d[0] - drops[i][0]);
    return ok(drops.length === 3 && drops.every((d) => d[1] === 2) && gaps.every((g) => g >= 0.98 && g <= 1.05), { drops, gaps: gaps.map((g) => +g.toFixed(3)) });
  },
});
