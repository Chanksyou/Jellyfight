// The pause menu's summary of the run so far: Health, Level, the time to the boss (or stage door),
// and what you carry as icons. It only reads the run; treasure-bag.js lists what each one does.
import { bagRows } from './treasure-bag.js';
import { icon } from './icons.js';
import { esc } from './leaderboard.js';

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function summaryHtml(run) {
  const max = Math.ceil(run.S.health), hp = Math.max(0, Math.min(max, Math.ceil(run.health)));
  const exploring = run.phase === 'explore';
  const left = Math.max(0, Math.ceil(run.duration - run.t));
  const items = bagRows(run).map((r) => `<span class="ps-item" role="img" aria-label="${esc(r.name)}">${r.icon}${r.tag.startsWith('×') ? `<sub>${esc(r.tag)}</sub>` : ''}</span>`).join('');
  return `<div class="ps-row">
    <div class="ps-hp"><span class="ui-label">Health</span><div class="ui-bar ui-bar--tall" data-kind="health" style="--value:${(hp / max).toFixed(3)}"><i></i><span>${hp} / ${max}</span></div></div>
    <span class="ui-chip">${icon('star')}Level ${run.level}</span>
    ${exploring ? `<span class="ui-chip">${icon('clock')}${run.stage.stageDoor ? 'Stage door' : 'Boss'} in ${clock(left)}</span>` : ''}
  </div>${items ? `<div class="ps-items">${items}</div>` : ''}`;
}
