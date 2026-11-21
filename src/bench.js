// The phone bench: index.html?bench, opened on a real phone, plays this act's busiest moments and shows
// the device's own frame numbers, with no reading of screens. Acts 3 and 4 have their own links:
// ?bench&act=3, ?bench&act=4, ?bench&act=4&scene=2 (the Encore's arena). Loaded only for that link.
//
// After one tap (a browser needs a gesture, and it lifts the iOS 30 fps limit on a frame), each moment
// is set up the way tools/perf-phone.mjs sets it up (the shared table in src/bench-moments.js), settles
// for 2 s and is measured for 8 s with the camera turning once round the jelly. The bench draws every
// frame itself: the game's frame cap and the governor are left out (their state untouched), and the
// pixel ratio is held at the top of its range. Then the busiest moment plays again once per switch:
// bloom off, pixel ratio 1.0, lamps off, AO off, and Low. A bench is not a run: it's a dev run that
// never reaches the leaderboard or the run log, earns nothing and keeps nothing.
import * as K from './stories/kit.js';
import { MOMENTS, PAGES, busiest, pageFor } from './bench-moments.js';
import { experimentQuery, experimentWords } from './experiments.js';
import { currentAct, currentScene, goToAct, nav } from './stages.js';

const G = window;
const SETTLE = 2, SECS = 8;
const median = (a, k = 0.5) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(k * s.length))].toFixed(2); };
const share = (a, ms) => (a.length ? +(a.filter((x) => x > ms).length / a.length).toFixed(3) : null);
const page = () => pageFor(currentAct(), currentScene());

// The busiest moment once more with one thing changed. apply() returns false where it can't apply
// (Low has no bloom; a screen whose top ratio is already 1); undo() puts it back.
const SWITCHES = [
  { name: 'bloom off', apply: () => !!G.gfx.composer && (G.gfx.toggle('bloom'), true), undo: () => G.gfx.toggle('bloom') },
  { name: 'pixel ratio 1.0', apply: (top) => top > 1 && (ratio(1), true), undo: (top) => ratio(top) },
  // the light count changes, so every lit shader rebuilds: built now, not in the measured frames
  { name: 'lamps off', apply: () => (G.GAME.toggleLamps(), G.GAME.compile(), true), undo: () => { G.GAME.toggleLamps(); G.GAME.compile(); } },
  { name: 'AO off', apply: () => G.gfx.quality !== 'low' && (G.gfx.toggle('ao'), true), undo: () => G.gfx.toggle('ao') },
  // a tier switch builds the other shaders behind a card (main.js retier); the moment waits for it
  { name: 'Low', apply: async () => { if (G.gfx.quality === 'low') return false; low.was = G.gfx.quality; G.gfx.setTier('low'); await G.gfx.ready; return true; },
    undo: async () => { G.gfx.setTier(low.was); await G.gfx.ready; } },
];
const low = { was: null };
function ratio(r) { G.APT.renderer.setPixelRatio(r); G.gfx.resize(); }

// GPU time of each frame's drawing, where the browser offers it (never on an iPhone). A query's answer
// comes frames later; one the GPU marks disjoint (a clock change, a context switch) is thrown away.
function gpuTimer(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  const waiting = [];
  let q = null;
  return {
    begin() { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); },
    end(into) { gl.endQuery(ext.TIME_ELAPSED_EXT); waiting.push([q, into]); q = null; },
    abort() { if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); gl.deleteQuery(q); q = null; } },   // a frame that threw mid-draw
    poll() {
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (waiting.length && (disjoint || gl.getQueryParameter(waiting[0][0], gl.QUERY_RESULT_AVAILABLE))) {
        const [done, into] = waiting.shift();
        if (!disjoint && into) into.push(gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(done);
      }
    },
    dispose() { for (const [w] of waiting.splice(0)) gl.deleteQuery(w); },
  };
}

// the browser's own frame cadence for a second, with the game not drawing: a Low Power Mode or
// framed-page cap of 30 shows here
const cadence = (ms = 1000) => new Promise((done) => {
  const gaps = []; let last = null, t0 = null;
  const tick = (now) => { if (last !== null) gaps.push(now - last); last = now; t0 ??= now; if (now - t0 >= ms) done({ ms: median(gaps), fps: gaps.length ? Math.round(1000 / median(gaps)) : null }); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

async function environment(R, timer) {
  const gl = R.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
  let framed = true; try { framed = top !== self; } catch {}
  return {
    build: G.JF_BUILD, act: currentAct(), scene: currentScene(), ua: navigator.userAgent, dpr: devicePixelRatio, screen: `${screen.width}x${screen.height}`,
    cores: navigator.hardwareConcurrency || null, memory: navigator.deviceMemory ?? null,
    gpu: (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER), multiDraw: !!gl.getExtension('WEBGL_multi_draw'),
    gpuTime: timer ? 'offered' : 'not offered', tier: G.gfx.quality, framed, raf: await cadence(), experiments: experimentWords(), lights: G.pacing?.lightSlots?.count ?? 0,
  };
}

// Play one moment for settle + secs seconds of real frames and report the measured part
async function measure(name, setup, { settle, secs, timer }) {
  try { setup({ K, G, nav }); } catch (e) { return { name, error: String(e?.message || e) }; }
  G.run.devRun();
  const R = G.APT.renderer, f = [], stepMs = [], renderMs = [], calls = [], tris = [], gpu = [];
  const yaw0 = G.tpc.yaw;
  let t0 = null, last = null, hidden = false;
  const away = () => { hidden = true; };
  document.addEventListener('visibilitychange', away);
  let error = null;
  await new Promise((done) => {
    const tick = (now) => { try { frame(now); } catch (e) { error = String(e?.message || e); timer?.abort(); done(); } };   // a frame that throws ends the moment, not the bench
    const frame = (now) => {
      t0 ??= now;
      const t = (now - t0) / 1000, on = t >= settle;
      if (on && last !== null) f.push(now - last);
      const dt = last === null ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      if (on) G.tpc.yaw = yaw0 + ((t - settle) / secs) * Math.PI * 2;   // the camera turns once round: the busiest view counts
      const a = performance.now(); G.GAME.step(dt);
      const b = performance.now(); timer?.begin(); G.GAME.render(); timer?.end(on ? gpu : null);
      const c = performance.now();
      if (on) { stepMs.push(b - a); renderMs.push(c - b); calls.push(G.gfx.frameInfo.calls); tris.push(G.gfx.frameInfo.triangles); }
      timer?.poll();
      if (t >= settle + secs) done(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  document.removeEventListener('visibilitychange', away);
  const canvas = R.domElement;
  return {
    name, frames: f.length, ms: median(f), p95: median(f, 0.95), over33: share(f, 33.4), over50: share(f, 50),
    stepMs: median(stepMs), stepP95: median(stepMs, 0.95), renderMs: median(renderMs), renderP95: median(renderMs, 0.95),
    gpuMs: median(gpu), gpuP95: median(gpu, 0.95), gpuFrames: gpu.length,
    draws: median(calls), drawsMax: calls.length ? Math.max(...calls) : null, tris: median(tris), trisMax: tris.length ? Math.max(...tris) : null,
    canvas: `${canvas.width}x${canvas.height}`, ratio: R.getPixelRatio(), tier: G.gfx.quality, ...(hidden ? { interrupted: true } : {}), ...(error ? { error } : {}),
  };
}

// Run the bench in this page: every moment of its act, then the busiest once per switch. Options make
// it short for stories (settle, secs, only: moment names, switches: switch names).
export async function runBench({ settle = SETTLE, secs = SECS, only = null, switches = SWITCHES.map((s) => s.name), status = () => {} } = {}) {
  const { GAME, APT, pacing } = G, R = APT.renderer, p = page();
  const realFrame = GAME.frame, was = R.getPixelRatio(), top = pacing.governor.max, keep = Object.getOwnPropertyDescriptor(G.run, 'keepProgress');
  GAME.frame = () => {};   // the bench draws every frame itself: no cap, no governor
  G.run.keepProgress = () => {};   // a moment's setup steps before devRun(): its carried run must never overwrite a kept one (stages.js keepAct)
  const timer = gpuTimer(R.getContext());
  const names = Object.keys(MOMENTS[p]).filter((n) => !only || only.includes(n)), sw = SWITCHES.filter((s) => switches.includes(s.name));
  const total = names.length + sw.length, out = { env: null, moments: [] };
  try {
    ratio(top);
    out.env = await environment(R, timer);
    for (const n of names) { status(`${out.moments.length + 1} of ${total}: ${n}`); out.moments.push(await measure(n, MOMENTS[p][n], { settle, secs, timer })); }
    const b = busiest(p);
    for (const s of sw) {
      const label = `${b}, ${s.name}`;
      status(`${out.moments.length + 1} of ${total}: ${label}${s.name === 'Low' ? ' (switching…)' : ''}`);
      let on = false;
      try {
        on = await s.apply(top);
        out.moments.push(on ? { ...(await measure(b, MOMENTS[p][b], { settle, secs, timer })), name: label } : { name: label, skipped: true });
      } finally { if (on) await s.undo(top); }
    }
  } finally {
    K.restore();
    timer?.dispose();
    ratio(was);
    GAME.frame = realFrame;
    if (keep) Object.defineProperty(G.run, 'keepProgress', keep); else delete G.run.keepProgress;
  }
  return out;
}

// --- the cards ---------------------------------------------------------------------------------
function card(html) {
  const el = document.createElement('div');
  el.className = 'jf-bench';
  el.innerHTML = `<style>
  .jf-bench { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left)); background: var(--ui-scrim); box-sizing: border-box; }
  .jf-bench .ui-panel { width: min(880px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; display: grid; gap: var(--ui-space-2, 8px); }
  .jf-bench .ui-header, .jf-bench p { margin: 0; }
  .jf-bench .ui-header { flex-wrap: wrap; gap: 8px; }
  .jf-bench .acts { display: flex; flex-wrap: wrap; gap: 8px; }
  .jf-bench .wide { overflow-x: auto; }
  .jf-bench table { border-collapse: collapse; font: 400 var(--ui-size-label, 12px)/1.3 var(--ui-font-text); white-space: nowrap; }
  .jf-bench th, .jf-bench td { padding: 4px 8px; text-align: right; border-bottom: 1px solid var(--ui-line); }
  .jf-bench th:first-child, .jf-bench td:first-child { text-align: left; }
  .jf-bench textarea { width: 100%; height: 120px; font: 400 12px/1.3 monospace; }
  </style><section class="ui-panel" role="dialog" aria-label="Phone bench">${html}</section>`;
  document.body.appendChild(el);
  return el;
}
const leave = () => { nav.reload = () => location.replace(location.pathname); goToAct(1); };   // back to act 1's menu, without ?bench
const LINKS = [['Act 1', '', 'act1'], ['Act 3', '&act=3', 'act3'], ['Act 4', '&act=4', 'night4'], ['Encore', '&act=4&scene=2', 'arena']];

// a story page never sends (it has no Worker to answer, and no business filling the table)
export const sendable = (search = location.search) => !['story', 'stories'].some((k) => new URLSearchParams(search).has(k));

// The results: a small table, Copy results (JSON), Send and Back to the game
export function showResults(res) {
  const e = res.env || {}, c = (v, k = 1) => (v === null || v === undefined ? '–' : (+v).toFixed(k)), pct = (v) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`);
  const rows = res.moments.map((m) => (m.skipped ? `<tr><td>${m.name}</td><td colspan="8">doesn't apply here</td></tr>`
    : m.error && !m.frames ? `<tr><td>${m.name}</td><td colspan="8">stopped: ${m.error.replace(/[<&]/g, '')}</td></tr>`
    : `<tr><td>${m.name}${m.interrupted ? ' (interrupted)' : ''}</td><td>${c(m.ms)}</td><td>${c(m.p95)}</td><td>${pct(m.over33)}</td><td>${pct(m.over50)}</td><td>${c(m.stepMs)}</td><td>${c(m.renderMs)}</td><td>${c(m.gpuMs)}</td><td>${m.draws ?? '–'}</td></tr>`)).join('');
  const el = card(`<div class="ui-header"><h2 class="ui-title">Phone bench</h2>
    <div class="acts"><button class="ui-btn ui-btn--primary" data-bench="copy">Copy results</button>${sendable() ? '<button class="ui-btn" data-bench="send">Send to the developer</button>' : ''}<button class="ui-btn" data-bench="back">Back to the game</button></div></div>
    <p class="ui-text" data-bench="note">Copy the results and paste them in a message.</p>
    <p class="ui-label" style="text-transform:none">${e.build || ''} · act ${e.act || 1}${e.scene === 2 ? ' arena' : ''} · ${e.tier || ''} · ${e.screen || ''} at ${e.dpr || ''}x · browser frames ${e.raf ? `${e.raf.fps} a second` : '–'} · GPU time ${e.gpuTime || '–'} · lamp slots ${e.lights ?? '–'}${e.experiments ? ` · ${e.experiments}` : ''}</p>
    <div class="wide"><table><thead><tr><th>Moment</th><th>Frame ms</th><th>p95</th><th>&gt;33 ms</th><th>&gt;50 ms</th><th>Step ms</th><th>Draw ms</th><th>GPU ms</th><th>Draws</th></tr></thead><tbody>${rows}</tbody></table></div>
`);
  const json = JSON.stringify(res);
  el.querySelector('[data-bench=copy]').onclick = async () => {
    const note = el.querySelector('[data-bench=note]');
    try { await navigator.clipboard.writeText(json); note.textContent = 'Copied.'; }
    catch {   // no clipboard (an old browser, a framed page): select the text to copy by hand
      note.innerHTML = '<textarea readonly aria-label="Results"></textarea>';
      const box = note.querySelector('textarea'); box.value = json; box.focus(); box.select();
    }
  };
  const send = el.querySelector('[data-bench=send]');
  if (send) send.onclick = async () => {   // frame times and device details only: what the card shows, nothing typed, no location
    const note = el.querySelector('[data-bench=note]');
    send.disabled = true;
    try {
      const r = await fetch('api/perf', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ build: e.build, device: matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop', bench: res }) });
      note.textContent = r.ok ? 'Sent. Thank you!' : r.status === 429 ? 'Please wait a moment before sending again.' : 'Couldn\'t send it. Copy the results instead.';
      send.disabled = r.ok;
    } catch { note.textContent = 'Couldn\'t send it. Copy the results instead.'; send.disabled = false; }
  };
  el.querySelector('[data-bench=back]').onclick = leave;
  return el;
}

// index.html?bench: open the act the link names, then wait for a tap on Start
export function offer() {
  const q = new URLSearchParams(location.search), want = PAGES[pageFor(+q.get('act') || 1, +q.get('scene') || 1)].act || { act: 1 };
  if (want.act !== currentAct() || (want.scene || 1) !== currentScene()) return goToAct(want.act, want.carry || null, null, want.scene || 1);
  G.run.devRun();
  G.run.keepProgress = () => {};   // this page's carried run (acts 3, 4) is the bench's, never one to keep; Back reloads
  const p = page(), n = Object.keys(MOMENTS[p]).length + SWITCHES.length, mins = Math.ceil((n * (SETTLE + SECS) + 20) / 60);
  const el = card(`<div class="ui-header"><h2 class="ui-title">Phone bench</h2></div>
    <p class="ui-text">Plays ${n} moments of this act for about ${SETTLE + SECS} seconds each and shows how fast this device draws them. About ${mins} minutes.
    Keep the screen on and stay in the game. Nothing here counts as a run.</p>
    <div class="acts">${LINKS.map(([t, s, k]) => `<a class="ui-btn${k === p ? '' : ' ui-btn--ghost'}" href="?bench${s}${experimentQuery()}"${k === p ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</div>
    <div class="acts"><button class="ui-btn ui-btn--primary" data-bench="start">Start</button><button class="ui-btn" data-bench="back">Back to the game</button></div>`);
  el.querySelector('[data-bench=back]').onclick = leave;
  el.querySelector('[data-bench=start]').onclick = async () => {
    el.remove();
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cssText = 'position:fixed;top:max(8px, env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:80;pointer-events:none';
    document.body.appendChild(chip);
    let res;
    try { res = await runBench({ status: (s) => { chip.textContent = `Measuring ${s}`; } }); } finally { chip.remove(); }
    document.getElementById('g-over').hidden = false;   // the game holds still behind the results (as behind the pause menu)
    showResults(res);
  };
}
