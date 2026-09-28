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

// Open the page with #debug for a live readout. The counter ticks on a timer, so if the
// picture freezes but the counter keeps going, the page is alive and only drawing stopped.
// Also switchable from the pause menu (the Claude app can drop the #debug part of a link).
let debugOn = false;
export function enableDebug() {
  if (debugOn) return;
  debugOn = true;
  let frames = 0, last = performance.now(), beats = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { frames++; last = performance.now(); cb(t); });
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);z-index:99;'
    + 'background:#000a;color:#9f9;font:11px ui-monospace,Menlo,monospace;padding:3px 8px;border-radius:6px;pointer-events:none;white-space:nowrap';
  const attach = () => { if (!box.isConnected) document.body.appendChild(box); };
  if (document.body) attach(); else addEventListener('DOMContentLoaded', attach);
  setInterval(() => {
    beats++;
    const r = window.APT?.renderer;
    const since = Math.round(performance.now() - last);
    box.textContent = `alive ${beats} | ${frames * 2} fps | last frame ${since} ms ago | dpr ${r ? r.getPixelRatio().toFixed(2) : '-'}`
      + ` | draws ${r ? r.info.render.calls : '-'} | logdepth ${r ? r.capabilities.logarithmicDepthBuffer : '-'}`;
    box.style.color = since > 1000 ? '#f99' : '#9f9';
    frames = 0;
  }, 500);
}
if (location.hash.includes('debug')) enableDebug();
