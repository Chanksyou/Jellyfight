// Measures the game's busiest moments on the phone page (844x390, touch), for the
// jelly-phone-performance workflow (.claude/skills/jelly-phone-performance/SKILL.md):
// draw calls and triangles across all passes (gfx.frameInfo), shader programs (at startup and any
// built during the moment), lights, the JS time a frame's game step and render call take under a 4x
// CPU slowdown, what the frames allocate (V8 sampling heap profiler, collected objects included),
// how often a frame uploads to the GPU (texSubImage2D, texImage2D, bufferSubData, bufferData: median
// calls a frame) and a count of the scene (materials by type, see-through ones, batches, lights,
// textures). With --profile, a CDP CPU profile of the same frames: the 30 functions with the most
// self time and the time by file, in ms a frame.
//
//   node tools/perf-phone.mjs                       every act, Medium and Low
//   node tools/perf-phone.mjs --tiers=medium        one tier
//   node tools/perf-phone.mjs --only=night4,arena   some pages (act1, act3, night4, arena)
//   node tools/perf-phone.mjs --profile             also profile the CPU (top 30 functions, time by file)
//   node tools/perf-phone.mjs --overdraw            instead of the timings: layers drawn per pixel (src/overdraw.js) at each moment and the heaviest stacks of see-through marks (STACKS)
//   node tools/perf-phone.mjs --json=out.json       also write everything as JSON (counts, uploads, scene, profile)
//
// Headless Chromium draws with SwiftShader (software WebGL): counts are real, times are not a
// phone's. A phone's own frame times come from the phone bench (index.html?bench, src/bench.js), which
// plays the same moments (src/bench-moments.js).
import fs from 'node:fs';
import { start, openGame } from '../tests/lib.mjs';
import { PAGES, MOMENTS, STACKS } from '../src/bench-moments.js';

const args = process.argv.slice(2), arg = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const TIERS = arg('tiers', 'medium,low').split(','), ONLY = arg('only', '').split(',').filter(Boolean), JSON_OUT = arg('json', '');
const FRAMES = +arg('frames', 240), THROTTLE = +arg('throttle', 4), PROFILE = args.includes('--profile'), OVERDRAW = args.includes('--overdraw');

// The moments, and the pages they play in, are shared with the phone bench (src/bench-moments.js): each
// sets its moment up in the page with the story kit; the frames after it are measured.

// Counts what the scene holds, from what the camera could draw (shown, on its layers).
function census() {
  const r = APT.renderer, gl = r.getContext(), types = {}, lights = {}, seen = new Set(), texSeen = new Set();
  let shown = 0, transparent = 0, doubleSidedTwoPass = 0, batches = 0, batchInstances = 0, instanced = 0, texBytes = 0;
  const on = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  APT.scene.traverse((o) => {
    if (o.isLight) { if (on(o)) lights[o.type] = (lights[o.type] || 0) + 1; return; }
    if (!(o.isMesh || o.isPoints || o.isLine) || !on(o) || !o.layers.test(APT.camera.layers)) return;
    shown++;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      types[m.type] = (types[m.type] || 0) + 1;
      seen.add(m);
      if (m.transparent) { transparent++; if (m.side === THREE.DoubleSide && !m.forceSinglePass) doubleSidedTwoPass++; }
      for (const k in m) {
        const t = m[k];
        if (t && t.isTexture && t.image && !texSeen.has(t)) { texSeen.add(t); texBytes += (t.image.width || 0) * (t.image.height || 0) * (t.image.depth || 1) * 4 * (t.generateMipmaps ? 1.33 : 1); }
      }
    }
    if (o.isBatchedMesh) { batches++; batchInstances += o.instanceCount; }
    if (o.isInstancedMesh) instanced++;
  });
  return {
    shownObjects: shown, materialsByType: types, uniqueMaterials: seen.size, transparent, doubleSidedWithoutSinglePass: doubleSidedTwoPass,
    batches, batchInstances, instanced, lights, textures: texSeen.size, textureMBEstimate: +(texBytes / 1048576).toFixed(1),
    multiDraw: !!gl.getExtension('WEBGL_multi_draw'), pixelRatio: r.getPixelRatio(), canvas: [r.domElement.width, r.domElement.height],
  };
}

// Runs a second sample of frames (the game has moved on a few seconds from the first, so uploads, profile and scene describe a slightly later state) with the GL upload calls wrapped (and the CPU profiler on, with --profile).
async function uploadsAndProfile(page, cdp) {
  await page.evaluate(() => {
    const gl = APT.renderer.getContext(), c = window.__uploads = { names: ['texSubImage2D', 'texImage2D', 'bufferSubData', 'bufferData'], frame: {}, perFrame: {} };
    for (const n of c.names) {
      c.frame[n] = 0; c.perFrame[n] = [];
      const orig = gl[n].bind(gl);
      gl[n] = (...a) => { c.frame[n]++; return orig(...a); };
    }
    window.__flushUploads = () => { for (const n of c.names) { c.perFrame[n].push(c.frame[n]); c.frame[n] = 0; } };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const uploads = await page.evaluate((N) => {
    const yaw0 = tpc.yaw, gl = APT.renderer.getContext(), c = window.__uploads, out = {};
    try {
      for (let i = 0; i < N; i++) { tpc.yaw = yaw0 + (i / N) * Math.PI * 2; GAME.step(1 / 60); GAME.render(); window.__flushUploads(); }
      for (const n of c.names) {
        const s = [...c.perFrame[n]].sort((a, b) => a - b);
        out[n] = { median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
      }
    } finally {
      for (const n of c.names) delete gl[n];   // the prototype's own method again
      delete window.__uploads; delete window.__flushUploads;
    }
    return out;
  }, FRAMES);
  let profile = null;
  if (PROFILE) {
    const p = (await cdp.send('Profiler.stop')).profile;
    await cdp.send('Profiler.disable');
    const nodes = new Map(p.nodes.map((n) => [n.id, n])), self = new Map(), files = new Map();
    let software = 0;   // (program) is the time the software GL spends drawing, (idle) and (root) are not work: neither is a phone's, so they stay out of the table
    for (let i = 0; i < p.samples.length; i++) {
      const f = nodes.get(p.samples[i]).callFrame;
      if (/^\((program|idle|root)\)$/.test(f.functionName)) { if (f.functionName === '(program)') software += p.timeDeltas[i] / 1000 / FRAMES; continue; }
      const file = f.url.replace(/^.*\/src\//, 'src/').replace(/^.*\/vendor\//, 'vendor/').replace(/^.*\/(three\.[\w.]+\.js)/, '$1') || '(native)';
      const k = `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`, dt = p.timeDeltas[i] / 1000 / FRAMES;
      self.set(k, (self.get(k) || 0) + dt); files.set(file, (files.get(file) || 0) + dt);
    }
    const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ at: k, msPerFrame: +v.toFixed(2) }));
    profile = { totalMsPerFrame: +[...files.values()].reduce((a, b) => a + b, 0).toFixed(2), nativeNonScriptMsPerFrame: +software.toFixed(1), topFunctions: top(self, 30), byFile: top(files, 20) };
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { uploads, profile };
}

async function measure(env, pageKey, tier) {
  const { page } = await openGame(env, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ...PAGES[pageKey], seed: 1 });
  // the tier is a stored choice (graphics.js); switching rebuilds behind the menu, so store it and reload
  await page.evaluate((t) => localStorage.setItem('jellyrun.graphics', t), tier);
  await page.reload();
  await page.waitForFunction(() => window.GAME && window.run && document.querySelector('#g-over .play') && !document.querySelector('#g-over .play').disabled, null, { timeout: 300000 });
  await page.evaluate(async () => { APT.renderer.setAnimationLoop(null); await (window.gfx.ready || Promise.resolve()); });
  const cdp = await page.context().newCDPSession(page);
  const base = await page.evaluate(async () => {
    window.K = await import('/src/stories/kit.js'); window.NAV = (await import('/src/stages.js')).nav; window.BM = await import('/src/bench-moments.js');
    const lights = []; APT.scene.traverse((o) => { if (o.isLight) lights.push(o.type); });
    return { tier: gfx.quality, programs: APT.renderer.info.programs.length, lights: lights.length, pointLights: lights.filter((t) => t === 'PointLight').length, phone: matchMedia('(pointer: coarse)').matches };
  });
  const out = { page: pageKey, tier, ...base, moments: {} };
  if (OVERDRAW) {
    // layers a pixel gets (overdraw.js): all pieces, and the see-through ones alone (what the fight adds to the room)
    const moments = { ...MOMENTS[pageKey], ...STACKS[pageKey] };
    for (const name of Object.keys(moments)) {
      out.moments[name] = await page.evaluate(async ([p, n]) => {
        const { measureOverdraw } = await import('/src/overdraw.js');
        const all = window.BM.STACKS[p]?.[n] || window.BM.MOMENTS[p][n];
        all({ K, G: window, nav: NAV }); K.step(30); GAME.render();
        const R = APT.renderer, args = [R, APT.scene, APT.camera], yaw0 = tpc.yaw, rows = { all: [], seeThrough: [] };
        for (let i = 0; i < 4; i++) { tpc.yaw = yaw0 + i * Math.PI / 2; K.step(6); GAME.render(); rows.all.push(measureOverdraw(...args)); rows.seeThrough.push(measureOverdraw(...args, { seeThrough: true, room: APT.arena ? null : APT.root })); }
        const worst = (a, k) => a.reduce((m, x) => (x[k] > m ? x[k] : m), 0), mean = (a, k) => +(a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
        const sum = (a) => ({ avg: mean(a, 'avg'), worst: worst(a, 'worst'), p99: worst(a, 'p99'), covered: mean(a, 'covered') });
        return { all: sum(rows.all), seeThrough: sum(rows.seeThrough) };
      }, [pageKey, name]);
      const m = out.moments[name];
      console.log(`${pageKey} | ${name}: all avg ${m.all.avg} worst ${m.all.worst} p99 ${m.all.p99} | see-through avg ${m.seeThrough.avg} worst ${m.seeThrough.worst} p99 ${m.seeThrough.p99} covered ${m.seeThrough.covered}`);
    }
    await page.close();
    return out;
  }
  for (const name of Object.keys(MOMENTS[pageKey])) {
    const pre = await page.evaluate(([p, n]) => {
      BM.MOMENTS[p][n]({ K, G: window, nav: NAV });
      K.step(30); GAME.render();
      return APT.renderer.info.programs.length;
    }, [pageKey, name]);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const m = await page.evaluate((N) => {
      const calls = [], tris = [], stepMs = [], renderMs = [], P = APT.renderer.info.programs.length, yaw0 = tpc.yaw;
      for (let i = 0; i < N; i++) {
        tpc.yaw = yaw0 + (i / N) * Math.PI * 2;   // turn the camera once round over the sample: the busiest view counts
        const t0 = performance.now(); GAME.step(1 / 60); const t1 = performance.now(); GAME.render(); const t2 = performance.now();
        stepMs.push(t1 - t0); renderMs.push(t2 - t1); calls.push(gfx.frameInfo.calls); tris.push(gfx.frameInfo.triangles);
      }
      const lights = []; APT.scene.traverse((o) => { if (o.isLight) lights.push(o); });
      const q = (a, k) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(k * s.length))].toFixed(2); };
      return {
        calls: { median: q(calls, 0.5), max: Math.max(...calls) }, triangles: { median: q(tris, 0.5), max: Math.max(...tris) },
        stepMs: { median: q(stepMs, 0.5), p95: q(stepMs, 0.95), max: +Math.max(...stepMs).toFixed(1) },
        renderCallMs: { median: q(renderMs, 0.5), p95: q(renderMs, 0.95) },
        programsBuiltDuring: APT.renderer.info.programs.length - P, lights: lights.length,
        bugs: enemies.list.filter((e) => !e.dead).length, newest: APT.renderer.info.programs.slice(P).map((p) => p.name || p.cacheKey.slice(0, 60)),
      };
    }, FRAMES);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // allocation sites: self bytes per frame, by function and line
    const sites = new Map(); let total = 0;
    const walk = (n) => { if (n.selfSize) { const f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/src\//, 'src/').replace(/^.*\/three\.\w+\.js/, 'three')}:${f.lineNumber + 1}`; sites.set(k, (sites.get(k) || 0) + n.selfSize); total += n.selfSize; } n.children.forEach(walk); };
    walk(profile.head);
    m.allocKBPerFrame = +(total / FRAMES / 1024).toFixed(1);
    m.topAlloc = [...sites].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${(v / FRAMES / 1024).toFixed(2)} KB/f ${k}`);
    m.programsBuiltInSetup = pre - base.programs;
    const extra = await uploadsAndProfile(page, cdp);
    m.uploadsPerFrame = extra.uploads;
    if (extra.profile) m.profile = extra.profile;
    m.scene = await page.evaluate(`(${census})()`);
    out.moments[name] = m;
    console.log(`${pageKey} ${tier} | ${name}: draws ${m.calls.median}/${m.calls.max}, tris ${m.triangles.max}, step ${m.stepMs.median}/${m.stepMs.p95} ms, alloc ${m.allocKBPerFrame} KB/f, programs +${m.programsBuiltInSetup} setup +${m.programsBuiltDuring} during, lights ${m.lights}`);
    const u = m.uploadsPerFrame, sc = m.scene;
    console.log(`  uploads/frame (median): texSub ${u.texSubImage2D.median}, tex ${u.texImage2D.median}, bufSub ${u.bufferSubData.median}, buf ${u.bufferData.median} | scene: ${sc.shownObjects} shown, ${sc.uniqueMaterials} materials, ${sc.transparent} see-through (${sc.doubleSidedWithoutSinglePass} two-pass), ${sc.batches} batches/${sc.batchInstances} pieces, ~${sc.textureMBEstimate} MB textures`);
    if (m.profile) {
      console.log(`  CPU profile at ${THROTTLE}x, ms a frame: ${m.profile.totalMsPerFrame} of script and calls (${m.profile.nativeNonScriptMsPerFrame} of native non-script time, mostly software GL, left out). Top functions:`);
      for (const f of m.profile.topFunctions) console.log(`    ${String(f.msPerFrame).padStart(6)}  ${f.at}`);
      console.log('  By file: ' + m.profile.byFile.map((f) => `${f.at} ${f.msPerFrame}`).join(', '));
    }
  }
  await page.close();
  return out;
}

const env = await start(), results = [];
try {
  for (const tier of TIERS) for (const p of Object.keys(PAGES)) {
    if (ONLY.length && !ONLY.includes(p)) continue;
    const r = await measure(env, p, tier);
    console.log(`${p} ${tier}: startup programs ${r.programs}, lights ${r.lights} (${r.pointLights} point), tier ${r.tier}, phone ${r.phone}`);
    results.push(r);
  }
} finally { await env.close(); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
