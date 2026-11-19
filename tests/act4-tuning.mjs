// Act 4 quick encounter checks (no campaign bot): a synthetic end-of-act-3 build fights one Elite, the Encore or a bug pack.
//   node tests/act4-tuning.mjs elite:bowl,elite:pillow,elite:headphones,boss,pack4,pack3 [--seeds=1,2,3] [--types=normal,fire] [--styles=ranged,close] [--act=3]
// JSONL on stdout (one row a fight), progress on stderr. act 3 rows (elite:alligator, pack3, boss) are the reference.
import { start, openGame } from './lib.mjs';

const args = process.argv.slice(2), jobs = (args.find((a) => !a.startsWith('--')) || 'elite:bowl').split(',');
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).split(',').filter(Boolean).concat() || d;
const list = (k, d) => { const v = opt(k, d); return v.length ? v : d; };
const seeds = list('seeds', ['11', '12', '13']).map(Number), types = list('types', ['normal']), styles = list('styles', ['ranged']);
const CARRY = { score: 24000, level: 17, xp: 0, purse: 8, stats: {}, owned: [], grown: 0, growCount: 0 };
const PACKS = { pack4x: { act: 4, types: ['firefly', 'moth', 'cicada'], counts: [8, 6, 3] }, pack4: { act: 4, types: ['firefly', 'moth', 'cicada'], counts: [6, 4, 2] }, pack3: { act: 3, types: ['dragonfly', 'mantis', 'beetle'], counts: [6, 4, 2] } };
const ACT = { 'elite:bowl': 4, 'elite:pillow': 4, 'elite:headphones': 4, 'elite:croc': 3, 'elite:bull': 3, 'elite:coffer': 3, boss: 4 };
const env = await start();
try {
  for (const job of jobs) {
    const act = PACKS[job]?.act || (job.startsWith('boss') ? Number(list('act', ['4'])[0]) : ACT[job]);
    if (!act) throw Error(`unknown job ${job}`);
    const scene = job.startsWith('boss') && act === 4 ? 2 : 1;
    for (const jelly of types) for (const style of styles) for (const seed of seeds) {
      const { page, errors } = await openGame(env, { viewport: { width: 800, height: 500 }, seed, act: { act, scene, carry: CARRY } });
      try {
        const cfg = { seed, style, jelly, hop: job.endsWith('-hop') };
        const row = await page.evaluate(async ({ job, cfg, pack }) => {
          const B = await import('/tests/act4-browser.mjs');
          if (job.startsWith('elite:')) return B.elite({ ...cfg, kind: job.slice(6) });
          if (job.startsWith('boss')) return B.boss({ ...cfg, immortal: job === 'boss-god', seconds: 600 });
          return B.pack({ ...cfg, ...pack });
        }, { job, cfg, pack: PACKS[job] });
        if (errors.length) row.pageErrors = errors.slice(0, 3);
        console.log(JSON.stringify({ job, ...row }));
        console.error(`${job} ${jelly} ${style} ${seed}: ${row.outcome} ${row.elapsed?.toFixed(1)}s lost ${row.healthLost?.toFixed(0)}/${row.maxHealth}`);
      } finally { await page.close(); }
    }
  }
} finally { await env.close(); }
