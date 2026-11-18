// The dev panel: one sheet of dev tools in four groups (Play, Tune, Build, Check), opened by the Dev
// button once the password has unlocked it (main.js). The last group you used stays open next time.
const GROUP_KEY = 'jellyrun.dev-group';
const GROUPS = [
  ['play', 'Play', [['boss', '👹 Fight boss'], ['duel', '🐞 1 on 1'], ['arena4', 'Act 4 preview']]],
  ['tune', 'Tune', [['kit', '🧪 Test kit'], ['tuner', '⚖️ Tuner']]],
  ['build', 'Build', [['layout', '🛠 Layout']]],
  ['check', 'Check', [['diag', '🩺 Diagnostics']]],
];
const PASSES = [['ao', 'AO'], ['bloom', 'Bloom'], ['lamps', 'Lamps']];   // costly parts of drawing, switched off to feel what they cost on a phone

export function devSheetHtml(icon) {
  const pane = ([id, , tools]) => `<div class="dev-pane" data-pane="${id}" hidden>${tools.map(([act, text]) => `<button class="ui-btn" data-act="${act}">${text}</button>`).join('')}${id === 'check'
    ? PASSES.map(([p, label]) => `<div class="set-row"><span class="ui-label">${label}</span><div class="ui-seg" role="group" aria-label="${label}">${[['on', 'On'], ['off', 'Off']].map(([v, t]) => `<button type="button" data-pass="${p}" data-on="${v}" aria-pressed="false">${t}</button>`).join('')}</div></div>`).join('') : ''}</div>`;
  return `<section class="ui-sheet menu-dev" role="dialog" aria-modal="true" aria-label="Dev tools" hidden>
  <div class="ui-header"><h2>Dev tools</h2><button class="ui-btn ui-btn--icon" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>
  <div class="ui-seg" role="group" aria-label="Group">${GROUPS.map(([id, label]) => `<button type="button" data-group="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
  ${GROUPS.map(pane).join('')}
</section>`;
}

// `h` is what main.js lends: overlay, run, play, endContinue, kit, tuner, openLayout, enableDebug,
// openSheet, and the drawing passes (passOn(name), togglePass(name))
export function initDevPanel(sheet, h) {
  const { overlay, run } = h;
  const showGroup = (id) => {
    for (const b of sheet.querySelectorAll('[data-group]')) b.setAttribute('aria-pressed', String(b.dataset.group === id));
    for (const p of sheet.querySelectorAll('.dev-pane')) p.hidden = p.dataset.pane !== id;
    try { localStorage.setItem(GROUP_KEY, id); } catch {}
  };
  const syncPasses = () => { for (const b of sheet.querySelectorAll('[data-pass]')) b.setAttribute('aria-pressed', String(h.passOn(b.dataset.pass) === (b.dataset.on === 'on'))); };
  let last = GROUPS[0][0];
  try { last = localStorage.getItem(GROUP_KEY) || last; } catch {}
  showGroup(GROUPS.some(([id]) => id === last) ? last : GROUPS[0][0]);
  syncPasses();
  const back = () => { overlay.hidden = false; h.openSheet('dev'); };   // the pause menu hides the sheet; Back brings it back
  const picker = (title, text, picks, start) => {
    overlay.hidden = true;
    run.ui.message(title, text, [], [...picks.map((p) => ({ label: p.name, onClick: () => { start(p); h.play(); } })), { label: 'Back', go: true, onClick: back }]);
  };
  const toTool = (show) => { overlay.hidden = true; show(run, { onPlay: () => { h.play(); h.endContinue(); }, onBack: back }); };
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.group) showGroup(b.dataset.group);
    else if (b.dataset.pass) { if (h.passOn(b.dataset.pass) !== (b.dataset.on === 'on')) h.togglePass(b.dataset.pass); syncPasses(); }
    else if (b.dataset.act === 'layout') h.openLayout();
    else if (b.dataset.act === 'arena4') location.href = '?arena=act4';
    else if (b.dataset.act === 'duel') picker('🐞 1 on 1 (dev)', 'Pick an enemy to face alone: a fresh run with nothing else in it. It comes back after you beat it.', run.duelChoices(), (p) => run.startDuel(p));
    else if (b.dataset.act === 'boss') picker('👹 Fight boss (dev)', 'Pick a boss: a fresh run straight to its intro. A boss from another act reloads the game into that act first.', run.bossChoices(), (p) => run.startBossFight(p));
    else if (b.dataset.act === 'kit') toTool((r, o) => h.kit.show(r, o));    // try any treasure or evolution on this run (test-kit.js)
    else if (b.dataset.act === 'tuner') toTool((r, o) => h.tuner.show(r, o));  // edit bug and treasure numbers, live (balance-editor.js)
    else if (b.dataset.act === 'diag') { h.enableDebug(); b.disabled = true; b.textContent = '🩺 Diagnostics on'; }
  });
}
