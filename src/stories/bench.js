// Stories: the phone bench (src/bench.js, index.html?bench). It plays this act's moments in real frames,
// replays the busiest once per switch and ends on a results card, and leaves the game as it found it.
// Here each moment is cut to a fraction of a second: these prove the bench works, not how fast anything is.
import * as THREE from 'three';
import { G, offs, ok, story } from './kit.js';
import { runBench, showResults, sendable } from '../bench.js';
import { MOMENTS } from '../bench-moments.js';
import { EXPERIMENTS, readExperiments, experimentQuery } from '../experiments.js';
import { LOOK } from '../look.js';
import { loadN8AO, Graphics } from '../graphics.js';

const SHORT = { settle: 0.05, secs: 0.25 };

story('bench/runs-to-its-results', {
  phone: true,
  about: 'The phone bench plays act 1\'s quiet room, crowd and Vacuum fight in real frames, then the crowd again with bloom off, pixel ratio 1.0, lamps off, AO off and on Low, and ends on a results card with a row for each and the results ready to copy.',
  setup() {},
  async play() {
    const res = await runBench(SHORT);
    const el = showResults(res);
    offs.push(() => el.remove());
    const measured = res.moments.filter((m) => !m.skipped);
    const sane = measured.every((m) => m.frames > 0 && m.ms > 0 && m.stepMs >= 0 && m.renderMs > 0 && m.draws > 0 && m.tris > 0);
    const names = res.moments.map((m) => m.name);
    const want = [...Object.keys(MOMENTS.act1), ...['bloom off', 'pixel ratio 1.0', 'lamps off', 'AO off', 'Low'].map((s) => `bugs + Controller, ${s}`)];
    const lowRow = res.moments.find((m) => m.name.endsWith(', Low'));
    const e = res.env;
    const envOk = e.build === G().JF_BUILD && e.raf.fps > 0 && typeof e.gpu === 'string' && typeof e.multiDraw === 'boolean' && /offered/.test(e.gpuTime);
    const rows = el.querySelectorAll('tbody tr').length;
    const json = JSON.parse(JSON.stringify(res)).moments.length === res.moments.length;
    return ok(sane && want.every((n, i) => names[i] === n) && lowRow?.tier === 'low' && G().gfx.quality === 'medium' && envOk && rows === res.moments.length && json,
      { names, skipped: res.moments.filter((m) => m.skipped).map((m) => m.name), low: lowRow?.tier, tierAfter: G().gfx.quality, env: { ...e, ua: e.ua.slice(0, 40) }, rows, first: measured[0] });
  },
});

story('bench/leaves-no-trace', {
  phone: true,
  about: 'A phone bench is not a run: it queues no run summary, posts no score, keeps nothing on the device, and puts back the frame cap, the governor, the pixel ratio, the graphics tier and its passes, the lamps and the game\'s own frame loop.',
  setup() {},
  async play() {
    const { GAME, APT, gfx, pacing, run } = G(), R = APT.renderer;
    const queued = () => JSON.stringify([...(G().run.board?.runLog?.pending || [])]);   // run summaries waiting to be sent (run-log.js)
    const q0 = queued();
    const store = JSON.stringify({ ...localStorage }), frame = GAME.frame, sample = pacing.governor.sample;
    const before = { fps: pacing.pacer.fps, scale: pacing.governor.scale, target: pacing.governor.target, ratio: R.getPixelRatio(), tier: gfx.quality, off: [...gfx.off], lamps: litLamps() };
    await runBench({ ...SHORT, only: ['bugs + Controller'], switches: ['bloom off', 'pixel ratio 1.0', 'lamps off', 'AO off'] });
    const after = { fps: pacing.pacer.fps, scale: pacing.governor.scale, target: pacing.governor.target, ratio: R.getPixelRatio(), tier: gfx.quality, off: [...gfx.off], lamps: litLamps() };
    const same = JSON.stringify(before) === JSON.stringify(after);
    const kept = JSON.stringify({ ...localStorage }) === store;
    const loop = GAME.frame === frame && pacing.governor.sample === sample;
    const nothingQueued = queued() === q0;
    return ok(same && kept && loop && nothingQueued && run.dev, { before, after, nothingQueued, dev: run.dev, kept, loop });
  },
});
function litLamps() { let n = 0; G().APT.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; }

story('bench/never-sends-from-a-story', {
  phone: true,
  about: 'A bench results card opened from a story URL has no Send button (the card shows it on a real `?bench` link only), so a test never fills the developer\'s results table.',
  setup() {},
  play() {
    const el = showResults({ env: { build: 'v0', act: 1 }, moments: [{ name: 'quiet room', frames: 10, ms: 16.7 }] });
    offs.push(() => el.remove());
    const has = (k) => !!el.querySelector(`[data-bench=${k}]`);   // the test runner's own page has no ?story, so it shows Send
    const rule = !sendable('?story=bench/x') && !sendable('?stories') && sendable('?bench&act=3') && sendable('');
    return ok(has('copy') && has('back') && has('send') && rule, { copy: has('copy'), back: has('back'), send: has('send'), rule });
  },
});

story('bench/experiment-switches-read-once', {
  phone: true,
  about: 'The experiment links (?lights=3|4|6, ?rt=packed, ?msaa=0|2|4, ?lite=1, ?shimmer=1) are read once at boot: a good value is kept, a bad one is ignored, none given changes nothing, and the lamp slots on this phone are the --phone-lights number the page shipped with.',
  setup() {},
  async play() {
    const none = readExperiments('');
    const all = readExperiments('?lights=4&rt=packed&msaa=2&lite=1&shimmer=1');
    const bad = readExperiments('?lights=5&rt=half&msaa=8&lite=2&shimmer=yes');
    const absent = Object.values(none).every((v) => v === null) && experimentQuery(none) === '';
    const kept = all.lights === 4 && all.rt === 'packed' && all.msaa === 2 && all.lite === 1 && all.shimmer === 1 && experimentQuery(all) === '&lights=4&rt=packed&msaa=2&lite=1&shimmer=1';
    const ignored = Object.values(bad).every((v) => v === null);
    const slots = G().pacing.lightSlots?.count;
    const res = await runBench({ ...SHORT, only: ['quiet room'], switches: [] });
    return ok(absent && kept && ignored && slots === LOOK.num('phone-lights', 6) && res.env.lights === slots && res.env.experiments === '',
      { absent, kept, ignored, slots, env: res.env.lights, words: res.env.experiments });
  },
});

story('bench/packed-buffers-fall-back', {
  phone: true,
  about: 'With ?rt=packed the picture buffers and the bloom chain are R11G11B10 (32 bits a pixel instead of 64), built without a new shader in play; if the GPU can\'t draw to that format the half-float buffers stay; without the option nothing changes.',
  setup() {},
  play() {
    const gfx = G().gfx, R = G().APT.renderer, canPack = gfx.canPack;
    const types = () => [gfx.composer.renderTarget1.texture.type, gfx.composer.renderTarget2.texture.type, ...gfx.bloom.down.map((t) => t.texture.type)];
    const all = (t) => types().every((x) => x === t);
    offs.push(() => { EXPERIMENTS.rt = null; gfx.canPack = canPack; gfx.build(); });
    const HALF = THREE.HalfFloatType, PACKED = THREE.UnsignedInt101111Type;
    gfx.build();
    const plain = all(HALF) && gfx.bufferType === HALF;
    EXPERIMENTS.rt = 'packed';
    const target = R.getRenderTarget();
    const supported = canPack.call(gfx);
    const restored = R.getRenderTarget() === target;   // the probe leaves the renderer as it found it
    gfx.build();
    gfx.render();
    const programs = R.info.programs.length;
    gfx.render();
    const steady = R.info.programs.length === programs;
    const packed = !supported || (all(PACKED) && gfx.composer.renderTarget1.texture.format === THREE.RGBFormat);   // a GPU that can't pack keeps half floats (fellBack covers it)
    gfx.canPack = () => false;   // a GPU that fails the check
    gfx.build();
    gfx.render();
    const fellBack = all(HALF) && gfx.bufferType === HALF;
    return ok(plain && packed && steady && fellBack && restored, { plain, restored, supported, packed, steady, fellBack, types: types() });
  },
});

story('bench/msaa-smooths-edges-on-one-target', {
  phone: true,
  about: 'With ?msaa=4 the scene is drawn into one multisampled target (the other buffer stays plain), built without a new shader in play, and it still holds after many frames; without the option, or with msaa=0, no target has samples.',
  setup() {},
  async play() {
    await loadN8AO();
    const gfx = G().gfx, R = G().APT.renderer;
    const samples = () => [gfx.composer.renderTarget1.samples, gfx.composer.renderTarget2.samples];
    offs.push(() => { EXPERIMENTS.msaa = null; EXPERIMENTS.rt = null; gfx.build(); });
    EXPERIMENTS.msaa = null; gfx.build();
    const plain = samples().every((s) => s === 0) && gfx.msaa === 0;
    EXPERIMENTS.msaa = 0; gfx.build();
    const zero = samples().every((s) => s === 0);
    EXPERIMENTS.msaa = 4; gfx.build();
    gfx.render();
    const programs = R.info.programs.length;
    const first = gfx.composer.readBuffer;
    for (let i = 0; i < 4; i++) gfx.render();
    const steady = R.info.programs.length === programs && gfx.composer.readBuffer === first;   // the scene lands in the same target every frame
    const one = first.samples === 4 && samples().filter((s) => s === 4).length === 1;
    EXPERIMENTS.rt = 'packed'; gfx.build(); gfx.render();
    const both = samples().filter((s) => s === 4).length === 1;   // packed buffers or the half-float fallback, either way smoothed
    EXPERIMENTS.rt = null;
    const baked = gfx.baked; offs.push(() => { gfx.baked = baked; });
    gfx.baked = false; gfx.build(); gfx.render();   // a room without baked shadows: N8AO draws the scene into its own target
    const n8ao = !!gfx.ao && gfx.ao.beautyRenderTarget.samples === 4 && samples().every((s) => s === 0);
    return ok(plain && zero && one && steady && both && n8ao, { plain, zero, one, steady, both, n8ao, samples: samples(), type: gfx.bufferType });
  },
});

story('engine/n8ao-loads-only-when-wanted', {
  phone: true,
  about: 'N8AO is not in the page\'s first imports: a phone on Medium in a baked room builds without it (plain scene render) and High picks it up when it has loaded, rebuilding behind the menu; where the first picture needs it, it is loaded before the graphics are made.',
  setup() {},
  async play() {
    const gfx = G().gfx, was = gfx.choice;
    const medium = gfx.composer.passes[0].isRenderPass;
    const wants = [Graphics.wantsAO('medium', true), Graphics.wantsAO('medium', false), Graphics.wantsAO('high', true)];
    gfx.setQuality('high'); await gfx.ready;
    const high = !gfx.composer.passes[0].isRenderPass;
    gfx.setQuality(was); await gfx.ready;
    return ok(medium && high && wants.join() === 'false,true,true' && !document.querySelector('link[href*="n8ao"]'), { medium, high, wants });
  },
});
