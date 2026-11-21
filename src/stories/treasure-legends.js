// The looks of Snooze Button, Newton's Cradle and Bloody Fangs (src/treasure-legends.js): Treasure juice J4.
// Looks only: every story here also checks the numbers stayed what they were.
import { bus } from '../events.js';
import { juice } from '../juice.js';
import { G, give, holdJelly, ok, roachAt, setupFight, step, story, stub } from './kit.js';

function ready(...ids) { setupFight({ hurt: true, bubbles: false, lash: false }); give(...ids); holdJelly(); G().run.S.dodge = 0; step(2); }
const texts = () => { const out = []; stub(G().fx, 'number', (pos, text) => { out.push(text); return null; }); return out; };

story('treasure-legends/snooze-rings-the-clock', {
  about: 'Snooze Button saving you: an alarm clock rings over the jelly, a "Zzz", the world slows for a moment and the colour drains, then all of it comes back. Still half your Health, the same toast; nothing new is built on the screen.',
  setup() { ready('snooze'); },
  play() {
    const { run, GAME, APT } = G(), L = run.gadgets.legends, said = texts();
    GAME.render(); const programs = APT.renderer.info.programs.length;
    run.health = 1; run.hurt(2);
    const saved = run.saved && run.health === run.S.health * 0.5, slowed = juice.slowT > 0 && juice.slowK < 1;
    step(6); GAME.render();
    const ringing = L.clock.visible, grey = juice.grey, built = APT.renderer.info.programs.length - programs;
    juice.slowT = juice.stop = 0; step(90);
    return ok(saved && slowed && ringing && grey > 0.5 && said.includes('Zzz') && !L.clock.visible && juice.grey === 0 && built === 0,
      { saved, slowed, ringing, grey: +grey.toFixed(2), said, after: L.clock.visible, built });
  },
});

story('treasure-legends/snooze-calm-keeps-the-clock', {
  about: 'With Reduce effects on, Snooze Button still shows the clock (standing still) and its toast, but no slow motion, no shake, no colour drain.',
  setup() { ready('snooze'); juice.calm = true; },
  play() {
    const { run } = G(), L = run.gadgets.legends;
    try {
      run.health = 1; run.hurt(2); step(6);
      const clock = L.clock.visible, slow = juice.slowT, grey = juice.grey, shake = juice.trauma;
      return ok(run.saved && clock && slow === 0 && grey === 0 && L.clock.userData.hammer.rotation.z === 0, { clock, slow, grey, shake });
    } finally { juice.calm = false; }
  },
});

story('treasure-legends/cradle-ball-carries-each-pass', {
  about: 'Newton\'s Cradle: a steel ball leaves the bug a killing hit finished and lands on the next as its leftover does (the same damage as ever); the same ball goes on down a row, a "×3" on the last of three passes, and the last bug swings back from it. Then the ball drops and fades.',
  setup() { ready(); G().run.owned.add('newtonsCradle'); G().run.enemies.mods = G().run.mods; },
  play() {
    const { run, enemies } = G(), L = run.gadgets.legends, said = texts();
    const row = [0, 1, 2, 3, 4].map((i) => roachAt(0.3 + i * 0.1, 0, { still: true, hp: i === 4 ? 100 : 1 }));
    bus.emit('damage_taken', { targetId: row[0].id, amount: 50, source: 'bubble' });
    const flying = L.balls.filter((m) => m.visible).length;
    let landed = null;
    const off = bus.on('enemy_hit', (h) => { if (h.targetId === row[3].id && h.feedback?.pass) landed = enemies.center(row[3]).distanceTo(L.balls.find((m) => m.visible).position); });
    step(30); off();
    const used = L.balls.filter((m) => m.visible).length, swung = row[4].hp === 100 && row.slice(0, 4).every((e) => e.dead);
    const leftover = enemies.list.includes(row[4]);
    step(90);
    return ok(flying === 1 && used === 1 && landed !== null && landed < 0.01 && said.includes('×3') && swung && leftover && L.balls.every((m) => !m.visible),
      { flying, used, landed, said, swung });
  },
});

story('treasure-legends/cradle-swing-never-moves-the-bug', {
  about: 'The bug a Cradle ball lands on swings away and back, its body only: its place (e.pos) never moves and its body is back where it was once the swing is over.',
  setup() { ready(); G().run.owned.add('newtonsCradle'); G().run.enemies.mods = G().run.mods; },
  play() {
    const { enemies } = G(), a = roachAt(0.3, 0, { still: true, hp: 1 }), b = roachAt(0.4, 0, { still: true, hp: 100 });
    const at = b.pos.clone(), rest = b.mesh.position.clone();
    bus.emit('damage_taken', { targetId: a.id, amount: 10, source: 'bubble' });
    let most = 0;
    for (let i = 0; i < 40; i++) { step(1); most = Math.max(most, b.mesh.position.distanceTo(rest)); }
    return ok(b.hp === 91 && most > b.r * 0.2 && b.pos.distanceTo(at) < 1e-9 && b.mesh.position.distanceTo(rest) < 1e-9, { hp: b.hp, most: +most.toFixed(4), moved: b.pos.distanceTo(at) });
  },
});

story('treasure-legends/fangs-worn-and-beating', {
  about: 'Bloody Fangs: the jelly wears two fangs under the front of its rim; while Health seeps away (still 1 a second) a heartbeat once a second rings a small red glow round the bell and the Health bar\'s rim beats; when it stops seeping the bar stops.',
  setup() { ready('bloodyFangs'); },
  play() {
    const { run, fx, player, document } = G(), bar = document.querySelector('#hud .player-health');
    run.health = 10;
    const fangs = run.adorn.piece('fangs');
    let rings = 0; const emit = fx.glow.emit.bind(fx.glow);
    stub(fx.glow, 'emit', (...a) => { if (a[1] === run.gadgets.legends.bleed) rings++; return emit(...a); });
    step(130);
    const lost = 10 - run.health, worn = fangs.group.visible, draining = bar.classList.contains('draining');
    const [f0, f1] = fangs.group.children, under = f0.position.y < player.position.y + run.cfg.height && Math.abs(f0.position.distanceTo(f1.position)) > 0;
    run.health = 1; step(3);
    const stopped = !bar.classList.contains('draining');
    return ok(Math.abs(lost - 130 / 60) < 0.05 && worn && draining && rings >= 16 && under && stopped, { lost: +lost.toFixed(3), worn, draining, rings, stopped });
  },
});
