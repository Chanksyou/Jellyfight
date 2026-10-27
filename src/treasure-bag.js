// The pause menu's list of what you carry: every treasure and evolution you have, with its icon,
// name, copies or level, what it does, and for those that grow during the run (grow-on-kills, per)
// what they have given you so far and how near the next step is. It only reads the run's own
// counters (Run.growCount/growTotal, Run.perSource): nothing here changes them.
import { TREASURES, EVOLUTIONS, STAT_INFO, xpToNext } from './stats.js';
import { esc } from './leaderboard.js';

const statName = (k) => (k === 'health' ? 'max Health' : STAT_INFO[k]?.name || k);
const num = (v) => `${+v.toFixed(2)}`;
const plus = (v, pct, stat) => `+${num(v)}${pct ? '%' : ''} ${statName(stat)}`;
const bugs = (n) => `${n} ${n === 1 ? 'bug' : 'bugs'}`;
const PER_FROM = {
  'max-health': (n) => `from ${Math.round(n)} max Health`,
  'move-speed-bonus': (n) => `from +${Math.round(n)}% Move speed`,
  levels: (n) => `from ${n} ${n === 1 ? 'Level' : 'Levels'} gained`,
  chests: (n) => `from ${n} ${n === 1 ? 'treasure' : 'treasures'} found`,
};

// lines for what `id` has grown this run: { text, k } (k: 0..1 toward the next step, for a bar)
function growing(run, id) {
  const M = run.mods, out = [];
  const G = M.growth.filter((g) => g.owner === id);
  if (G.length) {
    const g0 = G[0], total = G.reduce((s, g) => s + (run.growTotal[g.key] || 0), 0);
    const live = G.filter((g) => g.cap == null || (run.growTotal[g.key] || 0) < g.cap);
    if (g0.cap != null) {
      const most = g0.cap * G.length;
      out.push({ text: `+${num(total)} / ${plus(most, g0.percent, g0.stat)}${live.length ? '' : ' (max)'}`, k: total / most });
    } else {
      out.push({ text: `So far: ${plus(total, g0.percent, g0.stat)}` });
      // copies count their own kills: the one nearest its next step
      const g = live.reduce((a, b) => ((run.growCount[b.key] || 0) > (run.growCount[a.key] || 0) ? b : a));
      const have = run.growCount[g.key] || 0;
      out.push({ text: `Next ${plus(g.amount, g.percent, g.stat)} in ${bugs(g.kills - have)}`, k: have / g.kills });
    }
  }
  const P = M.per.filter((c) => c.owner === id);
  if (P.length) {
    const c = P[0], S = run.S, src = run.perSource(c.of, S), each = c.amount * P.length;
    out.push({ text: `Now: ${plus((src / c.every) * each, c.percent, c.stat)}, ${PER_FROM[c.of](src)}` });
    if (c.of === 'levels') { const need = xpToNext(run.level); out.push({ text: `Next ${plus(each, c.percent, c.stat)} at Level ${run.level + 1}: ${Math.max(0, Math.ceil(need - run.xp))} XP to go`, k: run.xp / need }); }
    if (c.of === 'chests') out.push({ text: `Next ${plus(each, c.percent, c.stat)} with the next treasure you open` });
  }
  const cd = run.cooldowns()[id];
  if (cd?.spent) out.push({ text: 'Already used' });
  return out;
}

// what the pause menu lists, evolutions first (as the HUD shows them)
export function bagRows(run) {
  const rows = [];
  for (const id of run.evolved || []) {
    const e = EVOLUTIONS.find((x) => x.id === id);
    if (e) rows.push({ id, icon: e.icon, name: e.name, tag: 'Evolution', text: e.text, lines: growing(run, id) });
  }
  for (const id of run.owned) {
    const t = TREASURES.find((x) => x.id === id);
    if (!t) continue;
    const n = run.owned.count(id), top = t.levels.length, lines = growing(run, id);
    let tag = n > 1 ? `×${n}` : '', text = t.text;
    if (top > 1) {
      const at = Math.min(n, top);
      tag = `Level ${at}${at === top ? ' (max)' : ''}`;
      text = t.levelText[at - 1];
      if (at < top) lines.push({ text: `Next level: ${t.levelText[at]}`, dim: true });
    }
    rows.push({ id, icon: t.icon, name: t.name, tag, text, lines });
  }
  return rows;
}

export function bagHtml(run) {
  const rows = bagRows(run);
  if (!rows.length) return '';
  return `<h2>Your treasures</h2><div class="list">${rows.map((r) => `<div class="t" data-id="${esc(r.id)}"><b class="i">${r.icon}</b><div>`
    + `<div class="n">${esc(r.name)}${r.tag ? ` <span class="tag">${esc(r.tag)}</span>` : ''}</div><p>${esc(r.text)}</p>`
    + r.lines.map((l) => `<div class="g${l.dim ? ' dim' : ''}">${esc(l.text)}${l.k != null ? `<i style="--k:${Math.max(0, Math.min(1, l.k)).toFixed(3)}"></i>` : ''}</div>`).join('')
    + '</div></div>').join('')}</div>`;
}
