// The clear test: how much each treasure adds to killing a pack. Ten cockroaches in a clump, and
// the jelly (standing still, unhurt) fights them with its starting stats plus one treasure (one copy).
// Two packs: one that stands 18 cm away in bubble range ("range"), and one that starts 30 cm away
// and swarms the jelly ("swarm"), so close-range treasures get their chance too.
// Numbers per treasure and pack, each the average of a few tries:
//   clear    seconds to kill all ten (real cockroach health; 30 s if it can't)
//   dmg      damage dealt to the pack in 10 s (cockroaches that can't die, so nothing runs out)
// Use it to rate treasures against each other: x times faster clearing than no treasure suggests
// a rarity (legendary 3.5x+, epic 2x+, rare 1.4x+, else common). Treasures that don't hurt
// anything (dodge, XP, regen…) show the same numbers as no treasure at all: rate those by how
// unique the effect is.
//
//   node tests/clear.mjs            every treasure
//   node tests/clear.mjs lemon      just the ones whose id contains "lemon"
import { start, openGame } from './lib.mjs';

const only = process.argv[2] || '';
const TRIES = 3;
const env = await start();
const { page, errors } = await openGame(env, { viewport: { width: 800, height: 500 } });

const all = await page.evaluate(async () => (await import('/src/content.js')).CONTENT.treasures.map((t) => ({ id: t.id, name: t.name, icon: t.icon })));
const list = [{ id: null, name: '(no treasure)', icon: '  ' }, ...all.filter((t) => t.id.toLowerCase().includes(only.toLowerCase()))];

const rows = [];
for (const t of list) {
  const r = {};
  for (const swarm of [false, true]) Object.assign(r, await page.evaluate(async ({ id, TRIES, swarm }) => {
    const { fresh, tp } = await import('/src/stories.js');
    const { bus, PLAYER } = await import('/src/events.js');
    const pack = (hp) => {
      // a clump of ten, 18 cm in front of the jelly, inside bubble range
      const P = player.position, out = [];
      for (let k = 0; k < 10; k++) {
        const a = k * 2.4, d = k === 0 ? 0 : 0.012 + (k % 3) * 0.011;
        const e = enemies.spawn('roach', P.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, (swarm ? -0.3 : -0.18) + Math.sin(a) * d)));
        e.spawnT = 1; e.hold = !swarm;
        if (hp) e.hp = e.maxHp = hp;
        out.push(e);
      }
      return out;
    };
    const setup = () => { fresh({ elites: false }); tp(3.2, 0.05, 3.0, 0); if (id) run.owned.add(id); };
    let clear = 0, dmg = 0;
    for (let k = 0; k < TRIES; k++) {
      setup();
      const es = pack();
      let i = 0;
      for (; i < 60 * 30 && es.some((e) => !e.dead); i++) GAME.step(1 / 60);
      clear += i / 60;
      setup();
      const big = pack(1e6), ids = new Set(big.map((e) => e.id));
      let sum = 0;
      const off = bus.on('damage_taken', (d) => { if (d.targetId !== PLAYER && ids.has(d.targetId)) sum += d.amount; });
      for (let j = 0; j < 600; j++) GAME.step(1 / 60);
      off();
      dmg += sum;
    }
    const k = swarm ? 'swarm' : 'range';
    return { [k + 'Clear']: +(clear / TRIES).toFixed(1), [k + 'Dmg']: Math.round(dmg / TRIES) };
  }, { id: t.id, TRIES, swarm }));
  rows.push({ ...t, ...r });
  console.log(`${t.icon} ${(t.name).padEnd(20)} range: clear ${String(r.rangeClear).padStart(5)} s, dmg ${String(r.rangeDmg).padStart(6)}   swarm: clear ${String(r.swarmClear).padStart(5)} s, dmg ${String(r.swarmDmg).padStart(6)}`);
}

const base = rows[0];
// clear strength: how many times faster a pack dies than with no treasure, on whichever pack suits
// the treasure better (a ranged treasure on the standing pack, a close one on the swarm)
const x = (r) => Math.max(base.rangeClear / r.rangeClear, base.swarmClear / r.swarmClear);
const dx = (r) => Math.max(r.rangeDmg / base.rangeDmg, r.swarmDmg / base.swarmDmg);
console.log(`\nby clear strength (x = times faster than no treasure: ${base.rangeClear} s at range, ${base.swarmClear} s swarmed):`);
const tier = (v) => (v >= 3.5 ? 'legendary' : v >= 2 ? 'epic' : v >= 1.4 ? 'rare' : 'common');
for (const r of [...rows.slice(1)].sort((a, b) => x(b) - x(a))) console.log(`  ${r.icon} ${r.name.padEnd(20)} x${x(r).toFixed(2)} clear   x${dx(r).toFixed(2)} damage   ${('(' + tier(x(r)) + ')').padEnd(12)} (range ${r.rangeClear} s, swarm ${r.swarmClear} s)`);
if (errors.length) console.log('page errors: ' + errors.slice(0, 3).join(' | '));
await env.close();
