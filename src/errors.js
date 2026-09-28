// Shows problems on screen instead of failing silently. On a phone there's no console,
// so anything that goes wrong (a script error, the GPU resetting) gets a small panel
// that can be screenshotted.
const seen = new Set();
let panel = null;

function show(msg) {
  if (seen.has(msg) || seen.size > 6) return;
  seen.add(msg);
  if (!panel) {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#2a0d12ee;color:#ffd9dc;border:1px solid #ff6b7a;'
      + 'border-radius:10px;padding:8px 12px;font:12px/1.4 ui-monospace,Menlo,monospace;max-height:40vh;overflow:auto;white-space:pre-wrap;word-break:break-word';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'float:right;border:0;background:none;color:inherit;font-size:16px;cursor:pointer';
    close.onclick = () => { panel.remove(); panel = null; seen.clear(); };
    panel.appendChild(close);
    document.body.appendChild(panel);
  }
  const line = document.createElement('div');
  line.textContent = '⚠ ' + msg;
  panel.appendChild(line);
}

export function reportError(e, where = '') {
  const err = e?.error || e?.reason || e;
  const stack = (err?.stack || '').split('\n').slice(0, 3).join(' | ');
  show(`${where ? where + ': ' : ''}${err?.message || err}${stack ? '\n   ' + stack : ''}`);
}

export function watchCanvas(canvas) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    show('The graphics chip reset (WebGL context lost). Usually this means it ran out of memory or a frame took too long. Try Low graphics, or reload.');
  });
}

addEventListener('error', (e) => reportError(e));
addEventListener('unhandledrejection', (e) => reportError(e, 'async'));
window._jfError = reportError;
