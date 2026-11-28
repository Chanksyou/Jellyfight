// Boss finish cinema overlay: letterbox framing and phone-legible celebratory callouts.
// Styles and motion tokens live in content/look.css (.boss-stage, --ui-*).

export function createBossBanner() {
  const existing = document.querySelector('.boss-stage');
  if (existing) existing.remove();

  const stage = document.createElement('div');
  stage.className = 'boss-stage';
  stage.setAttribute('aria-live', 'polite');

  const topBar = document.createElement('div');
  topBar.className = 'boss-bar top';
  topBar.setAttribute('aria-hidden', 'true');

  const bottomBar = document.createElement('div');
  bottomBar.className = 'boss-bar bottom';
  bottomBar.setAttribute('aria-hidden', 'true');

  const callout = document.createElement('div');
  callout.className = 'boss-callout';
  callout.hidden = true;

  const title = document.createElement('div');
  title.className = 'boss-callout-title';

  const sub = document.createElement('div');
  sub.className = 'boss-callout-sub';

  callout.append(title, sub);
  stage.append(topBar, bottomBar, callout);
  document.body.append(stage);

  function syncCalm(calm) {
    if (calm !== undefined) stage.classList.toggle('calm', Boolean(calm));
  }

  function showCallout(kind, heading, subtitle, calm) {
    syncCalm(calm);
    callout.classList.remove('show', 'break', 'victory');
    title.textContent = heading;
    sub.textContent = subtitle;
    callout.hidden = false;
    void callout.offsetWidth;
    callout.classList.add('show', kind);
  }

  return {
    showBreak(bossName, calm) {
      showCallout('break', 'BOSS BROKEN!', "Dendi's turn", calm);
    },

    showVictory(bossName, calm) {
      const label = bossName ? `${bossName} beaten!` : 'Boss beaten!';
      showCallout('victory', label, '', calm);
    },

    setLetterbox(on, calm) {
      syncCalm(calm);
      stage.classList.toggle('letterbox', Boolean(on));
    },

    clear() {
      stage.classList.remove('letterbox', 'calm');
      callout.classList.remove('show', 'break', 'victory');
      callout.hidden = true;
      title.textContent = '';
      sub.textContent = '';
    },
  };
}
