// The balance bot: an autopilot plays whole nights headlessly and reports how far it gets and
// what hurt it. Use it before and after a change that could make the game harder or easier,
// and report the numbers instead of guessing.
//
//   node tests/balance.mjs          5 nights
//   node tests/balance.mjs 10       10 nights
//
// The bot is simple on purpose: it keeps away from bugs, elites and spit, goes for Moon Drops when it's
// safe, takes the first card or treasure it's offered, and hops when it gets stuck. A real
// player does better; compare runs of the bot with each other, not with people.
import { start, openGame } from './lib.mjs';

const RUNS = Number(process.argv[2]) || 5;
const env = await start();
const { page, errors } = await openGame(env, { viewport: { width: 800, height: 500 } });

const results = [];
for (let n = 0; n < RUNS; n++) {
  await page.evaluate(async () => {
    const { bus, PLAYER } = await import('/src/events.js');
    document.getElementById('g-over').hidden = true;
    menus.close();
    run.start();
    // what hurt the jelly: moisture actually lost each frame, credited to whatever hit it that
    // frame (the bus tags every hit with its source; touching bugs report every frame, and the
    // invincibility window ignores most of those, so counting reports would overcount)
    window.__bot?.off?.();
    const B = window.__bot = { hurt: {}, src: null, last: null, prev: null };
    B.off = bus.on('damage_taken', (d) => { if (d.targetId === PLAYER) B.src = d.source; });
  });
  // play in chunks so the page stays responsive; stop at the end of the night or 10 minutes in
  for (let chunk = 0; chunk < 60; chunk++) {
    const phase = await page.evaluate(() => {
      const B = window.__bot, P = player.position;
      for (let i = 0; i < 600; i++) {
        if (['dead', 'won', 'metamorph'].includes(run.phase)) return run.phase;
        // take the first card, or a dialog's main button
        if (menus.open) document.querySelector('.jf-modal .jf-card, .jf-modal button.go, .jf-modal button')?.click();
        document.getElementById('g-over').hidden = true;   // desktop pauses when the mouse isn't locked after a pick: a player would click Play
        // steer: away from everything close (closer = stronger), else toward a Moon Drop or the middle
        let fx = 0, fz = 0;
        const push = (x, z, w) => { const dx = P.x - x, dz = P.z - z, d = Math.max(0.03, Math.hypot(dx, dz)); if (d < 0.45) { fx += dx / d * w / (d * d); fz += dz / d * w / (d * d); } };
        for (const e of enemies.list) if (!e.dead) { const c = enemies.center(e); push(c.x, c.z, e.proxy ? 3 : 1); }   // elites count for more
        for (const s of enemies.shots) push(s.m.position.x, s.m.position.z, 0.5);
        if (run.boss && !run.boss.dead) { const c = run.boss.center(); push(c.x, c.z, 4); }
        let tx, tz;
        if (Math.hypot(fx, fz) > 1e-6) { tx = fx; tz = fz; const k = 0.02 / (Math.hypot(fx, fz)); tx += (3.2 - P.x) * k * 40; tz += (3.0 - P.z) * k * 40; }
        else if (moon.active) { tx = moon.position.x - P.x; tz = moon.position.z - P.z; }
        else { tx = 3.2 - P.x + Math.sin(run.t * 0.3) * 0.3; tz = 3.0 - P.z + Math.cos(run.t * 0.23) * 0.3; }
        if (Math.hypot(tx, tz) > 0.01) { tpc.yaw = Math.atan2(-tx, -tz); input.keys = new Set(['KeyW']); } else input.keys = new Set();
        // hop when stuck against furniture
        if (i % 30 === 0) { if (B.prev && P.distanceTo(B.prev) < 0.01 && input.keys.size) input.jumpQueued = true; B.prev = P.clone(); }
        const m0 = run.moisture;
        B.src = null;
        GAME.step(1 / 60);
        if (run.moisture < m0 && B.src) { B.hurt[B.src] = (B.hurt[B.src] || 0) + (m0 - run.moisture); B.last = B.src; }
      }
      if (run.t > 600) return 'timeout';
      // nothing moved for a whole chunk: something is holding the game (report it, don't hang)
      if (B.lastT === run.t) return 'stalled: ' + JSON.stringify({ menu: menus.open, overlay: !document.getElementById('g-over').hidden, picked: run.startPicked, text: document.body.innerText.slice(0, 200) });
      B.lastT = run.t;
      return run.phase;
    });
    if (phase.startsWith('stalled')) { console.log('    ' + phase); break; }
    if (['dead', 'won', 'metamorph', 'timeout'].includes(phase)) break;
  }
  const r = await page.evaluate(() => {
    input.keys = new Set();
    const B = window.__bot;
    return {
      outcome: run.phase === 'dead' ? 'died' : run.phase === 'won' || run.phase === 'metamorph' ? 'beat the boss' : run.phase === 'boss' ? 'still fighting the boss at 10:00' : run.phase,
      at: +run.t.toFixed(0), level: run.level, kills: run.kills, treasures: run.owned.size,
      killedBy: run.phase === 'dead' ? B.last : null,
      hurt: Object.fromEntries(Object.entries(B.hurt).map(([k, v]) => [k, +v.toFixed(1)]).sort((a, b) => b[1] - a[1])),
    };
  });
  results.push(r);
  console.log(`night ${n + 1}: ${r.outcome} at ${Math.floor(r.at / 60)}:${String(r.at % 60).padStart(2, '0')}, level ${r.level}, ${r.kills} kills, ${r.treasures} treasures${r.killedBy ? `, finished by ${r.killedBy}` : ''}\n    hurt by ${JSON.stringify(r.hurt)}`);
}

const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const hurt = {};
for (const r of results) for (const [k, v] of Object.entries(r.hurt)) hurt[k] = (hurt[k] || 0) + v;
const total = Object.values(hurt).reduce((a, b) => a + b, 0) || 1;
console.log(`\n${RUNS} nights: ${results.filter((r) => r.outcome === 'beat the boss').length} beat the boss, ${results.filter((r) => r.outcome === 'died').length} died`);
console.log(`median: survived to ${med(results.map((r) => r.at))} s, level ${med(results.map((r) => r.level))}, ${med(results.map((r) => r.kills))} kills`);
console.log('moisture lost, by source: ' + Object.entries(hurt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(100 * v / total)}%`).join(', '));
if (errors.length) console.log('page errors: ' + errors.slice(0, 3).join(' | '));
await env.close();
