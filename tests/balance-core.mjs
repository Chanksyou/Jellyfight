// Pure policy and reporting shared by the browser runners and their unit tests.
export const STYLES = ['ranged', 'close', 'rooting', 'stationary'];

export function options(args, tool = 'balance') {
  const out = { runs: tool === 'balance' ? 5 : tool === 'clear' ? 3 : 2, seed: 20261020,
    styles: tool === 'balance' ? ['ranged', 'close', 'rooting'] : ['stationary'],
    build: [], add: [], prefer: [], synergy: [], act: 1, seconds: 600, actOnly: false, filter: '', shard: 0, shards: 1 };
  let positional = 0;
  const list = s => s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
  const integer = (s, min, max, name) => {
    const n = Number(s);
    if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n < min || n > max) throw Error(`Invalid ${name}: ${s}`);
    return n;
  };
  for (const arg of args) {
    if (arg === '--help') { out.help = true; continue; }
    if (arg === '--act-only') {
      if (tool !== 'balance') throw Error('--act-only belongs to balance.mjs');
      out.actOnly = true; continue;
    }
    if (!arg.startsWith('--')) {
      if (tool === 'balance' && positional++ === 0) out.runs = integer(arg, 1, 10000, 'runs');
      else if (tool !== 'balance' && positional++ === 0) out.filter = arg;
      else if (tool === 'matchup' && positional === 2 && /^\d+\/\d+$/.test(arg)) {
        [out.shard, out.shards] = arg.split('/').map(Number);
      } else throw Error(`Unexpected argument: ${arg}`);
      continue;
    }
    const at = arg.indexOf('='), key = arg.slice(2, at), value = arg.slice(at + 1);
    if (at < 0) throw Error(`Expected --option=value: ${arg}`);
    if (tool !== 'balance' && ['act', 'seconds', 'prefer'].includes(key)) throw Error(`--${key} belongs to balance.mjs`);
    if (key === 'seed') out.seed = integer(value, 0, 0xffffffff, key);
    else if (key === 'seeds') out.seeds = list(value).map(s => integer(s, 0, 0xffffffff, key));
    else if (key === 'runs') out.runs = integer(value, 1, 10000, key);
    else if (key === 'seconds') out.seconds = integer(value, 1, 3600, key);
    else if (key === 'act') out.act = integer(value, 1, 4, key);
    else if (key === 'styles' || key === 'style') out.styles = list(value);
    else if (['build', 'add', 'prefer'].includes(key)) out[key] = list(value);
    else if (key === 'synergy') out.synergy = value.split('+').filter(Boolean);
    else throw Error(`Unknown option: ${arg}`);
  }
  if (!out.styles.length || out.styles.some(s => !STYLES.includes(s))) throw Error(`Styles: ${STYLES.join(', ')}`);
  if (out.synergy.length && out.synergy.length !== 2) throw Error('Use --synergy=itemA+itemB');
  if (out.synergy.length && out.add.length) throw Error('Choose --add or --synergy, not both');
  if (out.shards < 1 || out.shard < 0 || out.shard >= out.shards) throw Error('Invalid shard: use 0/N through (N-1)/N');
  out.seeds ??= Array.from({ length: out.runs }, (_, i) => (out.seed + i) >>> 0);
  if (!out.seeds.length || new Set(out.seeds).size !== out.seeds.length) throw Error('Seeds must be nonempty and unique');
  if (new Set(out.styles).size !== out.styles.length) throw Error('Styles must be unique');
  return out;
}

export function movement(style, { x, z, nearest, shots = [], target, range = 0.3, reach = 0.083, retreat = false }) {
  if (!STYLES.includes(style)) throw Error(`Unknown style: ${style}`);
  if (style === 'stationary') return { x: 0, z: 0, retreat: false };
  let dx = 0, dz = 0;
  const distance = nearest ? Math.hypot(nearest.x - x, nearest.z - z) : Infinity;
  const edge = distance - (nearest?.r || 0);
  const dangerShot = shots.some(s => Math.hypot(s.x - x, s.z - z) < 0.09);
  const fleeing = style === 'rooting' && (dangerShot || edge < 0.065 || (retreat && edge < 0.16));
  if (nearest) {
    const desired = style === 'close' ? Math.max(0.04, reach * 0.7) : Math.max(0.12, range * 0.75);
    const sign = fleeing || edge < desired * 0.75 ? -1 : edge > desired ? 1 : 0;
    if (style !== 'rooting' || fleeing || edge > range * 0.9) {
      dx = (nearest.x - x) / Math.max(0.01, distance) * sign;
      dz = (nearest.z - z) / Math.max(0.01, distance) * sign;
      if (style === 'ranged' && !sign) { dx = -(nearest.z - z) / distance; dz = (nearest.x - x) / distance; }
    }
  } else if (target) { dx = target.x - x; dz = target.z - z; }
  for (const s of shots) {
    const a = x - s.x, b = z - s.z, d = Math.hypot(a, b);
    if (d < 0.14) { dx += a / Math.max(0.01, d) * 2; dz += b / Math.max(0.01, d) * 2; }
  }
  const n = Math.hypot(dx, dz);
  return { x: n > 0.001 ? dx / n : 0, z: n > 0.001 ? dz / n : 0, retreat: fleeing };
}

export function choose(choices, style, prefer, random) {
  if (!choices.length) throw Error('Cannot choose from no cards');
  const weights = { ranged: { bubbleDamage: 4, fireRate: 4, range: 3, moveSpeed: 2 },
    close: { health: 4, regen: 3, dodge: 3, moveSpeed: 2 }, rooting: { fireRate: 4, health: 3, regen: 3, bubbleDamage: 2 } };
  const score = c => {
    const at = prefer.indexOf(c.id || c.stat);
    return at >= 0 ? 10000 - at : (weights[style]?.[c.stat] || 0);
  };
  const best = Math.max(...choices.map(score)), indices = choices.map((c, i) => score(c) === best ? i : -1).filter(i => i >= 0);
  return indices[Math.floor(random() * indices.length)];
}

export const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function estimate(xs) {
  const avg = mean(xs);
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - avg) ** 2, 0) / (xs.length - 1)) : null;
  return { n: xs.length, mean: avg, sd, se: sd == null ? null : sd / Math.sqrt(xs.length) };
}

export function winInterval(wins, n) {
  if (!n) return null;
  const z = 1.959963984540054, p = wins / n, den = 1 + z * z / n;
  const mid = (p + z * z / (2 * n)) / den, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return { wins, n, rate: p, lower95: Math.max(0, mid - half), upper95: Math.min(1, mid + half) };
}

// Pair only identical scenarios/seeds/styles. Exposure differs after a death: do not call this causal attribution.
export function paired(rows, metric, arm = 'added', control = 'base') {
  const controls = new Map(rows.filter(r => r.arm === control).map(r => [`${r.style}/${r.seed}`, r]));
  return estimate(rows.filter(r => r.arm === arm && controls.has(`${r.style}/${r.seed}`))
    .map(r => metric(r) - metric(controls.get(`${r.style}/${r.seed}`))));
}
