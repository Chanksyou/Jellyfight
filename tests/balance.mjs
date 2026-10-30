// Seeded campaigns through the real four-act game. JSONL stdout; progress on stderr.
import { execFileSync } from 'node:child_process';
import { start, openGame, ROOT } from './lib.mjs';
import { options, estimate, winInterval, paired } from './balance-core.mjs';

const opts = options(process.argv.slice(2));
if (opts.help) {
  console.log('balance.mjs [runs=5] [--seed=N | --seeds=N,N] [--styles=ranged,close,rooting] [--build=id,id@3,evo:id] [--add=id | --synergy=id+id] [--prefer=id,stat] [--act=1..4] [--seconds=600] [--act-only]\nJSONL output. --seconds limits each act, including menus/cutscenes. Later-act starts use a synthetic preset; act 1 campaigns carry earned progress.');
  process.exit(0);
}
// Explicit later-act fixtures matching tests/run.mjs, NOT earned campaign progress.
const CARRY = {
  2: { score: 5000, level: 6, xp: 0, purse: 4, stats: { health: 130 }, owned: [['candle', 1]], grown: 0, growCount: 0 },
  3: { score: 12000, level: 10, xp: 0, purse: 6, stats: { health: 160 }, owned: [['candle', 1], ['battery', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown'] },
  4: { score: 24000, level: 15, xp: 0, purse: 8, stats: { health: 200 }, owned: [['candle', 1], ['battery', 1]], grown: 0, growCount: 0, evolved: ['manOWar', 'upsideDown', 'cinder'] },
};
const emit = value => console.log(JSON.stringify(value));
const env = await start(), rows = [];
let page;
try {
  let opened = await openGame(env, { viewport: { width: 800, height: 500 }, seed: opts.seed,
    ...(opts.act > 1 && { act: { act: opts.act, carry: CARRY[opts.act] } }) });
  page = opened.page;
  const arms = await page.evaluate(async o => (await import('/tests/balance-browser.mjs')).comparisons(o.build, o.add, o.synergy), opts);
  const validPrefer = await page.evaluate(async () => {
    const { CONTENT } = await import('/src/content.js');
    return [...CONTENT.treasures.map(t => t.id), ...CONTENT.evolutions.map(e => e.id), ...Object.keys(CONTENT.levelups.cards)];
  });
  for (const id of opts.prefer) if (!validPrefer.includes(id)) throw Error(`Unknown preferred choice: ${id}`);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  const dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: ROOT }).toString().trim();
  emit({ type: 'metadata', tool: 'balance', revision, dirty, ...opts, arms, syntheticStart: opts.act > 1,
    limits: 'Scripted bots, no pathfinding or human reaction model; one RNG stream per act. A changed version can consume randomness differently.' });
  let first = true;
  for (const style of opts.styles) for (const seed of opts.seeds) for (const arm of arms) {
    let carry = opts.act > 1 ? CARRY[opts.act] : null, act = opts.act;
    const acts = [];
    while (true) {
      if (!first) {
        await page.close();
        opened = await openGame(env, { viewport: { width: 800, height: 500 }, seed,
          ...(act > 1 && { act: { act, carry } }) });
        page = opened.page;
      }
      first = false;
      await page.evaluate(async config => (await import('/tests/balance-browser.mjs')).startAct(config),
        { ...opts, seed, style, build: arm.build, initial: acts.length === 0 });
      let result;
      do { result = await page.evaluate(async () => (await import('/tests/balance-browser.mjs')).chunk()); }
      while (result.outcome === 'running');
      if (opened.errors.length) throw Error(opened.errors.join('\n'));
      acts.push(result);
      console.error(`seed ${seed} ${style} ${arm.arm}: act ${act} ${result.outcome}, level ${result.level}, Health ${result.health.toFixed(1)}`);
      if (result.outcome !== 'next-act') break;
      if (result.transition?.act !== act + 1 || !result.transition.carry) throw Error('Invalid act transition');
      carry = result.transition.carry; act++;
    }
    const last = acts.at(-1), total = key => acts.reduce((s, a) => s + a[key], 0);
    const row = { type: 'run', style, seed, arm: arm.arm, build: arm.build, outcome: last.outcome,
      actsBeaten: acts.filter(a => a.bossBeaten).length, elapsed: total('elapsed'), level: last.level, killedBy: last.killedBy,
      kills: total('kills'), damage: total('damage'), healthLost: total('healthLost'), shieldAbsorbed: total('shieldAbsorbed'),
      healed: total('healed'), revivalHealing: total('revivalHealing'), revivals: total('revivals'), deathSaves: total('deathSaves'), acts };
    rows.push(row); emit(row);
  }
  for (const style of opts.styles) {
    const group = rows.filter(r => r.style === style);
    for (const arm of arms) {
      const rs = group.filter(r => r.arm === arm.arm);
      emit({ type: 'summary', style, arm: arm.arm, completion: winInterval(rs.filter(r => ['won', 'beat-boss'].includes(r.outcome)).length, rs.length),
        elapsed: estimate(rs.map(r => r.elapsed)), actsBeaten: estimate(rs.map(r => r.actsBeaten)), healthLost: estimate(rs.map(r => r.healthLost)) });
      if (arm.arm !== 'base') emit({ type: 'paired', style, arm: arm.arm, control: 'base',
        actsBeatenDifference: paired(group, r => r.actsBeaten, arm.arm), healthLostDifference: paired(group, r => r.healthLost, arm.arm),
        warning: 'Health loss is exposure-dependent; compare act outcomes and durations too.' });
    }
    if (opts.synergy.length) {
      const differences = opts.seeds.map(seed => {
        const get = arm => group.find(r => r.seed === seed && r.arm === arm).actsBeaten;
        return get('AB') - get('A') - get('B') + get('base');
      });
      emit({ type: 'interaction', style, metric: 'actsBeaten', additiveInteraction: estimate(differences), warning: 'Screening signal, not proof of causal synergy or human viability.' });
    }
  }
} finally { await page?.close(); await env.close(); }
