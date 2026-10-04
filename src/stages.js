// The acts, in order, and which one this page plays. Moving on to the next act carries the run
// over (level, stats, treasures, score) in sessionStorage and reloads the page into it, so
// every system is built for that act's rooms from the start (src/run.js nextAct).
import { STAGE1 } from './stage1.js';
import { STAGE2 } from './stage2.js';

export const STAGES = [STAGE1, STAGE2];
const KEY = 'jellyfight.act';

// The act's state lives in sessionStorage, or in window.name where storage is blocked (a
// sandboxed frame): both survive a reload in the same tab and end with it
function load() {
  try { const v = sessionStorage.getItem(KEY); if (v) return JSON.parse(v); } catch {}
  try { const v = JSON.parse(window.name || '{}'); if (v && v[KEY]) return v[KEY]; } catch {}
  return null;
}
function save(v) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); return; } catch {}
  try { window.name = JSON.stringify({ [KEY]: v }); } catch {}
}

// The act to play now (1-based), and what the run brought with it from the act before (or null)
export function currentAct() { return Math.min(STAGES.length, Math.max(1, +(load()?.act) || 1)); }
export const currentStage = () => STAGES[currentAct() - 1];
export const carried = () => load()?.carry || null;

// Go to an act (with the run's carry, or none for a fresh run) and reload into it. `then`: what
// to do once it's loaded (the dev 1 on 1 picker: { duel: name }), read once with pendingAction()
export function goToAct(act, carry = null, then = null) {
  save({ act, carry, then });
  location.reload();
}
// the same, without using it up (main.js shows a different loading screen for { continue: true })
export const peekAction = () => load()?.then || null;
export function pendingAction() {
  const v = load();
  if (!v?.then) return null;
  save({ ...v, then: null });
  return v.then;
}
