// Shared real-game runner for clear.mjs and matchup.mjs. JSONL stdout, progress on stderr.
import { execFileSync } from 'node:child_process';
import { start, openGame, ROOT } from './lib.mjs';
import { options, estimate } from './balance-core.mjs';

export async function runEncounters(tool) {
  const opts = options(process.argv.slice(2), tool);
  if (process.env.TRIES && !process.argv.some(a => a.startsWith('--seed') || a.startsWith('--runs='))) {
    const n = Number(process.env.TRIES);
    if (!Number.isInteger(n) || n < 1 || n > 10000) throw Error('TRIES must be a positive integer');
    opts.seeds = Array.from({ length: n }, (_, i) => (opts.seed + i) >>> 0);
  }
  if (opts.help) {
    console.log(`${tool}.mjs [id-filter[,id-filter]] [${tool === 'matchup' ? '0/N] [' : ''}--seed=N | --seeds=N,N] [--runs=N] [--styles=stationary,ranged,close,rooting] [--build=id,id@3,evo:id] [--add=id | --synergy=id+id]\nBUGS=roach,ants selects enemies. Outputs paired clear (30 s limit) and mortal damage/survival probes (10 s limit).`);
    return;
  }
  const env = await start();
  let page;
  try {
    const opened = await openGame(env, { viewport: { width: 800, height: 500 }, seed: opts.seed }); page = opened.page;
    await page.evaluate(() => APT.renderer.setAnimationLoop(null));
    const manifest = await page.evaluate(async opts => {
      const B = await import('/tests/balance-browser.mjs'), { CONTENT } = await import('/src/content.js');
      B.resolveBuild(opts.build);
      return { items: B.items(), bugs: Object.keys(CONTENT.enemies) };
    }, opts);
    const bugs = process.env.BUGS ? process.env.BUGS.split(',') : tool === 'clear' ? ['roach'] : manifest.bugs;
    if (!bugs.length || bugs.some(b => !manifest.bugs.includes(b))) throw Error(`Unknown BUGS: ${bugs.join(',')}`);
    const custom = opts.add.length || opts.synergy.length;
    const selected = custom ? [{ id: 'custom', name: 'custom build' }] : manifest.items.filter(i => opts.filter.split(',').some(f => i.id.toLowerCase().includes(f.toLowerCase())));
    const items = selected.filter((_, i) => i % opts.shards === opts.shard);
    if (!items.length) throw Error('No matching items; check the filter/shard');
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
    const dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: ROOT }).toString().trim();
    emit({ type: 'metadata', tool, revision, dirty, ...opts, bugs, limits: 'Mortal probes; damage excludes overkill and includes armor/marks/shields. Stationary remains the default. One RNG stream; seed pairing does not lock changed versions to identical events.' });
    const cache = new Map();
    for (const item of items) {
      const arms = await page.evaluate(async ({ opts, item, custom }) => {
        const B = await import('/tests/balance-browser.mjs');
        if (custom) return B.comparisons(opts.build, opts.add, opts.synergy);
        if (item.kind !== 'card' && B.resolveBuild([...opts.build, item.id]).join(',') === B.resolveBuild(opts.build).join(',')) return [];
        return item.kind === 'card'
          ? [{ arm: 'base', build: B.resolveBuild(opts.build) }, { arm: 'added', build: B.resolveBuild(opts.build), card: item }]
          : B.comparisons(opts.build, [item.id]);
      }, { opts, item, custom });
      if (!arms.length) { emit({ type: 'skipped', itemId: item.id, reason: 'Already present at this level in the base build' }); continue; }
      for (const style of opts.styles) for (const enemy of bugs) for (const mode of tool === 'clear' ? ['range', 'swarm'] : ['big', 'clump']) for (const probe of [false, true]) {
        const rows = [];
        for (const seed of opts.seeds) for (const arm of arms) {
          const config = { seed, style, build: arm.build, item: arm.card, type: enemy, mode, probe };
          const key = JSON.stringify(config);
          let result = cache.get(key);
          if (!result) {
            result = await page.evaluate(async config => (await import('/tests/balance-browser.mjs')).encounter(config), config);
            if (arm.arm === 'base') cache.set(key, result);
          }
          const row = { type: 'encounter', tool, itemId: item.id, style, seed, arm: arm.arm, build: arm.build, card: arm.card,
            enemy, mode, probe, ...result };
          rows.push(row); emit(row);
        }
        const base = rows.filter(r => r.arm === 'base');
        for (const arm of arms.filter(a => a.arm !== 'base')) {
          const changed = rows.filter(r => r.arm === arm.arm);
          const differences = key => changed.map((r, i) => r[key] - base[i][key]);
          const complete = changed.flatMap((r, i) => r.outcome === 'cleared' && base[i].outcome === 'cleared' ? [r.elapsed - base[i].elapsed] : []);
          emit({ type: 'paired', tool, itemId: item.id, style, arm: arm.arm, enemy, mode, probe,
            damagePerSecondDifference: estimate(differences('dps')), healthLostDifference: estimate(differences('healthLost')),
            shieldAbsorbedDifference: estimate(differences('shieldAbsorbed')), completedClearSecondsDifference: estimate(complete),
            baseOutcomes: counts(base), changedOutcomes: counts(changed),
            warning: 'Deaths/timeouts are separate outcomes. Compare exposure before interpreting damage or Health differences.' });
        }
        if (opts.synergy.length) {
          const values = opts.seeds.map(seed => {
            const get = arm => rows.find(r => r.seed === seed && r.arm === arm).dps;
            return get('AB') - get('A') - get('B') + get('base');
          });
          emit({ type: 'interaction', tool, style, enemy, mode, probe, metric: 'dps', additiveInteraction: estimate(values) });
        }
      }
      console.error(`${item.name}: complete`);
    }
    if (opened.errors.length) throw Error(opened.errors.join('\n'));
  } finally { await page?.close(); await env.close(); }
}
const emit = value => console.log(JSON.stringify(value));
const counts = rows => rows.reduce((out, r) => { out[r.outcome] = (out[r.outcome] || 0) + 1; return out; }, {});
