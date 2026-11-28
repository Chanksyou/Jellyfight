// Makes the renderer, and says why when the browser won't give a WebGL context.
// A context can be refused for what we ask of it (a high-performance GPU the browser won't hand
// over, a multisampled or reversed depth buffer) or because the browser has no GPU drawing at
// all (hardware acceleration off, a blocklisted driver; Chrome no longer falls back to software).
// So: ask for everything, then ask for less, and only then give up with a message that says what to try.

// What to ask for, most wanted first. `want` is the full set; each step drops one thing.
export function contextAttempts(want) {
  const steps = [want];
  const { powerPreference, ...noPower } = want;
  if (powerPreference) steps.push(noPower);
  if (want.reversedDepthBuffer || want.logarithmicDepthBuffer) steps.push({ ...noPower, reversedDepthBuffer: false, logarithmicDepthBuffer: false });
  if (want.antialias) steps.push({ ...noPower, reversedDepthBuffer: false, logarithmicDepthBuffer: false, antialias: false });
  return steps;
}

// make(options) returns a renderer or throws. Returns { renderer, tried } (`tried` is how many asks failed first).
export function createWithFallback(make, want) {
  let last;
  const steps = contextAttempts(want);
  for (let i = 0; i < steps.length; i++) {
    try { return { renderer: make(steps[i]), tried: i }; } catch (e) { last = e; }
  }
  throw last;
}

// Replaces the loading screen's line with what the player can do about it.
export function showNoGraphics(error) {
  const said = document.querySelector('#loading p');
  const ua = navigator.userAgent;
  const hint = /Firefox/.test(ua) ? 'In Firefox, check Settings > General > Performance > "Use recommended performance settings" and "Use hardware acceleration when available".'
    : /Edg\//.test(ua) ? 'In Edge, open Settings, search "hardware acceleration", turn it on, then restart Edge.'
    : /Chrome|CriOS/.test(ua) ? 'In Chrome, open Settings > System, turn on "Use graphics acceleration when available", then relaunch. You can check chrome://gpu.'
    : 'Turn on hardware (graphics) acceleration in your browser settings, then restart it.';
  const text = `Jelly Run can't start because this browser isn't giving it graphics (WebGL). ${hint} Updating your graphics driver or trying another browser also helps.`;
  if (said) { said.textContent = text; said.style.maxWidth = '34em'; said.style.userSelect = 'text'; }
  const bar = document.querySelector('#loading .bar'); if (bar) bar.hidden = true;
  console.error('WebGL context failed:', error);
}
