// The matchup test: every treasure, level-up card and evolution against every bug, two ways.
//   big    one bug with 10x its health, chasing the jelly from 30 cm
//   clump  ten of them in a clump, chasing from 30 cm
// The jelly stands still and can't die (hits still land and are counted). Per item, bug and case:
//   clear  seconds to kill them all (30 s if it can't)
//   dps    damage a second to bugs that can't die (10 s)
//   taken  Health the jelly lost in those 10 s
// Prints a JSON line per item to stdout (collect with > file), progress to stderr.
//
//   node tests/matchup.mjs              everything
//   node tests/matchup.mjs lemon        just items whose id contains "lemon" (or "lemon,pin": either)
//   BUGS=roach node tests/matchup.mjs   just against cockroaches
import { start, openGame } from './lib.mjs';

const only = (process.argv[2] || '').toLowerCase();
const [shard, shards] = (process.argv[3] || '0/1').split('/').map(Number);   // run every Nth item: 0/4, 1/4…
const TRIES = +(process.env.TRIES || 2);
const env = await start();
const { page, errors } = await openGame(env, { viewport: { width: 800, height: 500 } });

const { items, bugs } = await page.evaluate(async () => {
  const { CONTENT } = await import('/src/content.js');
  // the Epic card of each stat (src/stats.js CARD_VALUES, which isn't exported)
  const CARD_VALUES = { bubbles: { amounts: [1] }, range: { amounts: [25], pct: true }, bubbleDamage: { amounts: [3] }, fireRate: { amounts: [25], pct: true }, health: { amounts: [9] }, moveSpeed: { amounts: [20], pct: true }, regen: { amounts: [0.75] }, dodge: { amounts: [15] }, luck: { amounts: [30] }, bubbleSize: { amounts: [30], pct: true } };
  const items = [{ kind: 'none', id: 'none', name: '(nothing)' }];
  for (const t of CONTENT.treasures) {
    const n = t.levels?.length || 1;
    items.push({ kind: 'treasure', id: t.id, name: `${t.icon} ${t.name}`, copies: 1, needs: t.needs || null, rarity: t.rarity });
    if (n > 1) items.push({ kind: 'treasure', id: t.id + '@L' + n, tid: t.id, name: `${t.icon} ${t.name} L${n}`, copies: n, needs: t.needs || null, rarity: t.rarity });
  }
  for (const [stat, v] of Object.entries(CARD_VALUES)) {
    const amount = v.amounts[v.amounts.length - 1];
    items.push({ kind: 'card', id: 'card:' + stat, name: `card +${amount}${v.pct ? '%' : ''} ${stat} (epic)`, stat, amount });
  }
  for (const e of CONTENT.evolutions) items.push({ kind: 'evolution', id: 'evo:' + e.id, eid: e.id, name: `${e.icon} ${e.name}` });
  const bugs = Object.keys(CONTENT.enemies);
  return { items, bugs };
});
const BUGS = process.env.BUGS ? process.env.BUGS.split(',') : bugs;   // BUGS=roach: just those
console.error(`bugs: ${BUGS.join(', ')}; items: ${items.length}`);

for (const it of items.filter((i) => i.kind === 'none' || only.split(',').some((o) => i.id.toLowerCase().includes(o))).filter((_, n) => n % shards === shard)) {
  const t0 = Date.now();
  const res = await page.evaluate(async ({ it, BUGS, TRIES }) => {
    const { fresh, tp } = await import('/src/stories.js');
    const { bus } = await import('/src/events.js');
    const { applyCard } = await import('/src/stats.js');
    const setup = () => {
      fresh({ elites: false, hurt: true });
      tp(3.2, 0.05, 3.0, 0);
      run.devGod = true;
      if (it.kind === 'treasure') {
        if (it.needs) run.owned.add(it.needs);
        for (let k = 0; k < it.copies; k++) run.owned.add(it.tid || it.id);
      } else if (it.kind === 'card') applyCard(run.stats, { stat: it.stat, amount: it.amount });
      else if (it.kind === 'evolution') run.evolved.push(it.eid);
      run.health = run.S.health;
    };
    const spawn = (type, big, hp) => {
      const P = player.position, out = [];
      const n = big ? 1 : 10;
      for (let k = 0; k < n; k++) {
        const a = k * 2.4, d = k === 0 ? 0 : 0.012 + (k % 3) * 0.011;
        const e = enemies.spawn(type, P.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, -0.3 + Math.sin(a) * d)), big ? 10 : 1);
        e.spawnT = 1;
        if (hp) e.hp = e.maxHp = hp;
        out.push(e);
      }
      return out;
    };
    const out = {};
    for (const type of BUGS) for (const big of [true, false]) {
      let clear = 0, dmg = 0, taken = 0;
      for (let k = 0; k < TRIES; k++) {
        setup();
        const es = spawn(type, big);
        let i = 0;
        for (; i < 60 * 30 && es.some((e) => !e.dead); i++) GAME.step(1 / 60);
        clear += i / 60;
        setup();
        const imm = spawn(type, big, 1e7), ids = new Set(imm.map((e) => e.id));
        let sum = 0, hurt = 0;
        const off = bus.on('enemy_hit', (d) => { if (ids.has(d.targetId)) sum += d.amount; });   // what landed (after marks and armour)
        const orig = run.hurt.bind(run);
        run.hurt = (a, s) => { if (!(run.polypT > 0)) hurt += a; const r = orig(a, s); run.health = run.S.health; return r; };
        for (let j = 0; j < 600; j++) GAME.step(1 / 60);
        run.hurt = orig;
        off();
        dmg += sum; taken += hurt;
      }
      out[`${type}/${big ? 'big' : 'clump'}`] = { clear: +(clear / TRIES).toFixed(2), dps: +(dmg / TRIES / 10).toFixed(1), taken: +(taken / TRIES).toFixed(1) };
    }
    enemies.clear();
    return out;
  }, { it, BUGS, TRIES });
  console.log(JSON.stringify({ ...it, res }));
  console.error(`${it.name.padEnd(36)} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
if (errors.length) console.error('page errors: ' + errors.slice(0, 3).join(' | '));
await env.close();
