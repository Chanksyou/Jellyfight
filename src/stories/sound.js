// Sound packs (src/sfx.js, docs/agents/sound.md): recorded takes by role, their synthesized fallbacks,
// when they download, and the cue log later stories use to say which cue played on which frame.
import { sfx, unlock as unlockAudio, loadPack, sample, cueLog, audio } from '../sfx.js';
import { G, V, ok, roachAt, setupFight, startVacuum, story, stub, withElement } from './kit.js';
import { STAGES } from '../stages.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let copies = 0;
// a sfx.js of its own, never unlocked: what a page that hasn't had its first tap yet has
const freshSfx = () => import(`../sfx.js?copy=${++copies}`);
const packList = () => fetch('/assets/audio/packs.json').then((r) => r.json());
// count the audio files fetched (and optionally answer some with a 404)
function watchFetch(missing = () => false) {
  const got = [], real = window.fetch.bind(window);
  stub(window, 'fetch', (url, ...rest) => {
    const u = String(url);
    if (u.includes('/assets/audio/')) got.push(u.replace(/.*\/assets\/audio\//, ''));
    return missing(u) ? Promise.resolve(new Response('', { status: 404 })) : real(url, ...rest);
  });
  return got;
}

story('sound/nothing-downloads-before-sound-is-on', {
  about: 'No audio file downloads before the first tap turns sound on, nor while sound is muted; turning it on downloads the packs the run wants (here the Lightning Jelly\'s).',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), got = watchFetch();
    S.wantPacks('act 1', 'jelly lightning');
    await wait(50);
    const beforeTap = got.length;
    S.setMuted(true); S.unlock();
    await wait(100);
    const whileMuted = got.length;
    S.setMuted(false);
    const loaded = await S.loadPack('lightning');
    const after = [...got];
    await S.audio()?.ctx.close();
    return ok(beforeTap === 0 && whileMuted === 0 && loaded && after.includes('packs.json') && after.includes('lightning.mp3'), { beforeTap, whileMuted, loaded, after });
  },
});

story('sound/a-missing-pack-plays-the-synthesized-sound', {
  about: 'A sound pack that fails to download (a 404) leaves its roles on their synthesized sounds: a lightning hit still sounds, synthesized, and no recorded take plays.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx();
    watchFetch((u) => u.endsWith('/lightning.mp3'));
    S.unlock();
    const loaded = await S.loadPack('lightning'), { ctx } = S.audio();
    let synth = 0;
    const osc = ctx.createOscillator.bind(ctx);
    stub(ctx, 'createOscillator', () => { synth++; return osc(); });
    const log = S.cueLog(() => 0);
    S.sfx.elementHit('lightning');
    S.cueLog(null);
    await ctx.close();
    return ok(!loaded && synth > 0 && log.some((c) => c.cue === 'elementHit') && !log.some((c) => c.recorded), { loaded, synth, log });
  },
});

story('sound/mixes-30-ms-ahead-so-a-busy-moment-does-not-crackle', {
  about: 'The audio context is made with a 30 ms latency hint instead of the smallest buffer, so a busy moment on the audio thread has room before it reaches the speakers (a missed buffer is the crackle).',
  setup() { setupFight(); },
  async play() {
    const asked = [], Real = window.AudioContext;
    stub(window, 'AudioContext', class extends Real { constructor(o) { asked.push(o); super(o); } });
    const S = await freshSfx();
    S.unlock();
    const ctx = S.audio()?.ctx, hint = asked[0]?.latencyHint;
    await ctx?.close();
    return ok(asked.length === 1 && hint === 0.03 && S.AUDIO_AHEAD === 0.03, { asked, baseLatency: ctx?.baseLatency });
  },
});

story('sound/wobbling-sounds-fade-out-without-a-pop', {
  about: "The sounds with a wobble in their loudness (the Vacuum's suck and brushes, the millipede's rev) end in silence: the wobble fades with the sound instead of playing on after it and being cut off with a pop.",
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), R = 16000, tails = {};
    for (const [name, play] of Object.entries({
      vacSuction: (s) => s.vacSuction(1.5), vacBrushes: (s) => s.vacBrushes(1.2),
      milliRev: (s) => s.milliRev(1),
    })) {
      const oc = new OfflineAudioContext(1, R * 2.5, R), { when } = S.preview(oc, oc.destination);
      when(0.05); play(S.sfx);
      const d = (await oc.startRendering()).getChannelData(0);
      let peak = 0, end = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); peak = Math.max(peak, a); if (a > 1e-5) end = i; }
      let tail = 0;
      for (let i = end - R * 0.003; i <= end; i++) tail = Math.max(tail, Math.abs(d[i]));
      tails[name] = +(tail / peak).toFixed(4);   // the loudest of its last 3 ms, against its peak: a pop is a sound cut off loud
    }
    return ok(Object.values(tails).every((k) => k < 0.05), { tails });
  },
});

story('sound/every-role-has-a-synthesized-sound', {
  about: 'Every recorded role in assets/audio/packs.json has a synthesized sound behind it: with no pack loaded, its cue (the sfx call that plays it) still makes sound.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), packs = await packList();
    const oc = new OfflineAudioContext(1, 48000, 48000), dest = oc.createGain();
    dest.connect(oc.destination);
    const { when } = S.preview(oc, dest);
    let made = 0;
    for (const k of ['createOscillator', 'createBufferSource']) { const real = oc[k].bind(oc); oc[k] = () => { made++; return real(); }; }
    const silent = [];
    let t = 0;
    for (const P of Object.values(packs)) for (const [role, r] of Object.entries(P.roles)) {
      when(t += 0.5); made = 0;
      S.sfx[r.cue[0]](...r.cue.slice(1));
      if (!made) silent.push(role);
    }
    const roles = Object.values(packs).flatMap((P) => Object.keys(P.roles));
    return ok(roles.length > 0 && !silent.length, { roles, silent });
  },
});

story('sound/cue-log-says-which-cue-played-on-which-frame', {
  about: 'The cue log notes every sfx call and every recorded take with the frame it came on: a lightning shot\'s launch and its recorded launch take on the frame it leaves, its hit and recorded hit take on the frame it lands.',
  setup() { setupFight({ bubbles: false, lash: false }); roachAt(0, -0.18); },
  async play() {
    unlockAudio();
    const loaded = await loadPack('lightning');
    await wait(400);   // past the repeat gaps of earlier stories' sounds
    const { run, player } = G(), B = run.bubbles;
    withElement('lightning');
    let frame = 0;
    const log = cueLog(() => frame);
    B.elementVolley('lightning', run.mods.element.lightning, player.position.clone().add(V(0, 0.06, 0)), run.S, run.mods);
    for (frame = 1; frame < 90 && B.list.length; frame++) { B.fly(1 / 60, run.S, run.mods); B.effects(1 / 60, run.S); }
    cueLog(null);
    const at = (cue, recorded) => log.find((c) => c.cue === cue && !!c.recorded === recorded)?.frame;
    const f = { launch: at('elementLaunch', false), launchTake: at('lightning-launch', true), hit: at('elementHit', false), hitTake: at('lightning-hit', true) };
    return ok(loaded && f.launch === 0 && f.launchTake === 0 && f.hit > 0 && f.hitTake === f.hit, { loaded, ...f });
  },
});

story('sound/takes-line-up-by-their-peak-and-danger-keeps-two-voices', {
  about: 'A recorded take asked to peak at a moment starts early by its measured peak, so its peak lands on it; ordinary sounds use at most 6 of the 8 recorded voices, and the last 2 are kept for hostile build-ups and hits on the jelly.',
  setup() { setupFight(); },
  async play() {
    unlockAudio();
    const loaded = await loadPack('lightning'), { ctx } = audio(), packs = await packList();
    await wait(2000);   // every recorded voice from earlier stories has rung out
    const started = [], make = ctx.createBufferSource.bind(ctx);
    stub(ctx, 'createBufferSource', () => {
      const s = make(), start = s.start.bind(s);
      s.start = (when, from, len) => { if (s.buffer?.duration > 5) started.push({ when, from, rate: s.playbackRate.value }); return start(when, from, len); };   // the pack's takes, not synthesized noise
      return s;
    });
    const peakAt = ctx.currentTime + 0.5;
    sample('lightning-hit', { peakAt });
    const first = started[0], take = packs.lightning.roles['lightning-hit'].takes.find((t) => Math.abs(t.start - first?.from) < 0.06);
    const lands = first && take ? +(first.when + take.peak / first.rate - peakAt).toFixed(4) : null;
    for (let i = 0; i < 10; i++) sample('lightning-chain');
    const ordinary = started.length;
    for (let i = 0; i < 5; i++) sample('lightning-chain', { urgent: true });
    const all = started.length;
    return ok(loaded && lands !== null && Math.abs(lands) < 0.002 && ordinary === 6 && all === 8, { loaded, lands, ordinary, all });
  },
});

story('sound/jelly-core-sounds-play-recorded-and-the-vacuum-shield-does-not', {
  about: 'With the core pack in, the bubble\'s blow, pop (small and big), hit, a crit, a small and a large bug dying, a jump, a land, hurt and the jelly\'s Shield (up, hit, break) each play a recorded take; the Vacuum\'s Shield and a bug\'s own pop stay synthesized.',
  setup() { setupFight(); },
  async play() {
    unlockAudio();
    const loaded = await loadPack('core'), packs = await packList();
    await wait(400);   // past the repeat gaps of earlier stories' sounds
    const calls = [['blow'], ['hit'], ['pop', false], ['pop', true], ['crit'], ['kill', 1], ['kill', 1.6], ['jump'], ['land', 0.5], ['hurt'], ['shieldReady'], ['shieldHit', true], ['shieldBreak', true]];
    const played = [];
    for (const [cue, ...args] of calls) {
      const log = cueLog(() => 0);
      sfx[cue](...args);
      cueLog(null);
      played.push(log.filter((c) => c.recorded).map((c) => c.cue).join());
      await wait(130);   // past the 90 to 150 ms repeat gaps, and the voices
    }
    const log = cueLog(() => 0);
    sfx.shieldHit();   // the Vacuum's Shield
    sfx.shieldBreak();
    cueLog(null);
    await wait(40);
    const own = cueLog(() => 0);
    sfx.pop(false, true);   // the Bull's little bulls: a bug's own pop
    cueLog(null);
    const vacuum = log.filter((c) => c.recorded).length + own.filter((c) => c.recorded).length;
    const want = ['bubble-blow', 'bubble-hit', 'bubble-pop', 'bubble-pop-big', 'crit', 'kill', 'kill-big', 'jump', 'land', 'hurt', 'shield-up', 'shield-hit', 'shield-break'];
    const jump = packs.core.roles.jump.vol;
    return ok(loaded && played.join('|') === want.join('|') && vacuum === 0 && jump <= 0.1, { loaded, played, vacuum, jump });
  },
});

story('sound/everyday-sounds-leave-voices-for-the-rarer-ones', {
  about: 'The sounds that come in swarms (bubble pop, hit, kill, blow) play at most 2 takes each and never take the last 2 ordinary voices: with a swarm sounding, a lightning chain still gets its voice.',
  setup() { setupFight(); },
  async play() {
    unlockAudio();
    const loaded = (await loadPack('core')) && (await loadPack('lightning')), { ctx } = audio();
    await wait(2000);   // every recorded voice from earlier stories has rung out
    const started = [], make = ctx.createBufferSource.bind(ctx);
    stub(ctx, 'createBufferSource', () => {
      const s = make(), start = s.start.bind(s);
      s.start = (...a) => { if (s.buffer?.duration > 5) started.push(1); return start(...a); };   // the packs' takes, not synthesized noise
      return s;
    });
    const every = { soft: true, max: 2 };
    for (let i = 0; i < 3; i++) for (const role of ['bubble-pop', 'bubble-hit', 'kill']) sample(role, every);
    const swarm = started.length;
    sample('lightning-chain');
    return ok(loaded && swarm === 4 && started.length === 5, { loaded, swarm, after: started.length });
  },
});

story('sound/rewards-play-recorded-before-a-run-starts', {
  about: 'The rewards pack loads with sound itself (no run needed): the menu tap and pick, a pickup, the chest, level-up, reveal by tier, award and buying each play a recorded take instead of the synthesized sound, and the XP take plays faster the longer the chain.',
  setup() { setupFight(); },
  async play() {
    unlockAudio();
    const S = await freshSfx();
    S.unlock();
    const loaded = await S.wantPacks();   // no act or type tag: only the 'unlock' packs
    const { ctx } = S.audio(), packs = await packList();
    await wait(50);
    const rates = [], make = ctx.createBufferSource.bind(ctx);
    stub(ctx, 'createBufferSource', () => {
      const s = make(), start = s.start.bind(s);
      s.start = (...a) => { if (s.buffer?.duration > 5) rates.push(s.playbackRate.value); return start(...a); };
      return s;
    });
    const log = S.cueLog(() => 0), roles = Object.keys(packs.rewards.roles);
    await wait(100);
    // at most 6 recorded voices at once, so the sounds go in groups, each left to ring out
    const play = (...calls) => calls.forEach(([name, ...args]) => S.sfx[name](...args));
    play(['tap'], ['pick'], ['treasure'], ['levelUp'], ['chestCreak', 0]);
    await wait(1500);
    play(['chestPop', 1], ['buy'], ['reveal', 0], ['reveal', 1], ['reveal', 2]);
    await wait(1600);
    play(['reveal', 3], ['award']);
    rates.length = 0;
    S.sfx.xp(0); await wait(60); S.sfx.xp(8);
    S.cueLog(null);
    const played = new Set(log.filter((c) => c.recorded).map((c) => c.cue)), missing = roles.filter((r) => r !== 'xp-pickup' && !played.has(r));
    await ctx.close();
    return ok(loaded && !missing.length && played.has('xp-pickup') && rates.length === 2 && rates[1] > rates[0] * 2, { loaded, missing, rates });
  },
});

story('sound/effects-sit-a-fifth-quieter-than-the-music', {
  about: 'Sound effects play through their own bus at 0.8 into the master the music shares, so effects are 20% quieter and the music is untouched; muting still silences both.',
  setup() { setupFight(); },
  async play() {
    const edges = [], real = AudioNode.prototype.connect;
    stub(AudioNode.prototype, 'connect', function (dest, ...rest) { edges.push([this, dest]); return real.call(this, dest, ...rest); });
    const S = await freshSfx();
    S.unlock();
    const A = S.audio();
    const bus = edges.find(([, d]) => d === A.master)?.[0];   // the node feeding master: the effects' bus
    edges.length = 0;
    S.sfx.pop(false, true);
    S.sfx.hurt();
    const toBus = edges.filter(([, d]) => d === bus).length, toMaster = edges.filter(([, d]) => d === A.master).length;
    const level = bus?.gain.value, masterGain = A.master.gain.value;
    S.setMuted(true);
    const muted = A.master.gain.value;
    S.setMuted(false);
    return ok(Math.abs(level - 0.8) < 1e-6 && toBus > 0 && toMaster === 0 && Math.abs(masterGain - 0.55) < 1e-6 && muted === 0, { level, toBus, toMaster, masterGain, muted });
  },
});

story('sound/the-encore-moves-each-make-their-own-sound', {
  about: 'Each synthesized cue of the Encore\'s new moves (record scratch, throw, stick and shatter, floor slam, flame jet, wall swell and crack, bow exhale, crowd cheer, vault whoosh, landing thud, crowd rise, wall shove) makes sound, with the audio running.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx();
    const oc = new OfflineAudioContext(1, 48000, 48000), dest = oc.createGain();
    dest.connect(oc.destination);
    const { when } = S.preview(oc, dest);
    let made = 0;
    for (const k of ['createOscillator', 'createBufferSource']) { const real = oc[k].bind(oc); oc[k] = () => { made++; return real(); }; }
    const cues = ['recordScratch', 'recordThrow', 'recordStick', 'recordShatter', 'floorSlam', 'flameJet', 'wallSwell', 'wallShield', 'bowExhale', 'crowdCheer', 'vaultWhoosh', 'landThud', 'crowdRise', 'wallShove'], made_ = {};
    let t = 0;
    for (const c of cues) { when(t += 0.5); made = 0; S.sfx[c](); made_[c] = made; }
    const silent = cues.filter((c) => !made_[c]);
    return ok(!silent.length, { made: made_, silent });
  },
});

story('sound/reward-spin-sounds', {
  about: 'The reward spin sounds: the lever clunk, one ticking voice for the whole roll (a dense schedule is thinned and never one node per cell; [] silences it), and a reel thunk for every rarity, each audible.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), R = 16000, out = {};
    const render = async (name, play) => {
      const oc = new OfflineAudioContext(1, R * 2, R), { when } = S.preview(oc, oc.destination);
      const make = oc.createBufferSource.bind(oc);
      let sources = 0;
      stub(oc, 'createBufferSource', () => { sources++; return make(); });
      when(0.05); play(S.sfx);
      const d = (await oc.startRendering()).getChannelData(0);
      let peak = 0, late = 0, fast = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); peak = Math.max(peak, a); if (i > R * 1.2) late = Math.max(late, a); if (i > R * 0.3 && i < R * 0.8) fast = Math.max(fast, a); }
      out[name] = { peak: +peak.toFixed(3), sources, late: +late.toFixed(4), fast: +fast.toFixed(4) };
    };
    const dense = Array.from({ length: 200 }, (_, i) => 0.1 + i * 0.004), slow = [1.3, 1.5];
    await render('lever', (s) => s.spinLever());
    await render('ticks', (s) => s.spinTick([dense, slow]));
    await render('cancelled', (s) => { s.spinTick([dense, slow]); s.spinTick([]); });
    for (let t = 0; t < 4; t++) await render(`stop${t}`, (s) => s.spinStop(t));
    const o = out;
    return ok(o.lever.peak > 0.01 && o.ticks.peak > 0.01 && o.ticks.sources === 1 && o.ticks.late > 0.002 && o.ticks.fast > 0.005
      && o.cancelled.peak < 0.002 && [0, 1, 2, 3].every((t) => o[`stop${t}`].peak > 0.01), out);
  },
});

// ---- Room tone (src/ambience.js) ------------------------------------------------------------
const ROOM = { off: false, boss: false, intensity: 0, paused: false, dawn: 0 };
async function renderBed(act, state = {}, secs = 5) {
  const { Ambience } = await import('../ambience.js'), R = 16000, oc = new OfflineAudioContext(1, R * secs, R);
  const A = new Ambience(oc, oc.destination);
  A.update(0, { ...ROOM, act, ...state }, { x: 3, z: 3, rx: 1, rz: 0 });
  const d = (await oc.startRendering()).getChannelData(0), from = R * 2;
  let sum = 0, peak = 0, cross = 0, bad = 0;
  for (let i = from; i < d.length; i++) { const a = d[i]; if (!Number.isFinite(a)) bad++; sum += a * a; peak = Math.max(peak, Math.abs(a)); if (i > from && (a >= 0) !== (d[i - 1] >= 0)) cross++; }
  return { rms: Math.sqrt(sum / (d.length - from)), peak, zcr: cross / (d.length - from), bad, layers: A.layers.length };
}

story('sound/ambience-has-a-bed-per-act', {
  about: 'Each act\'s room has its own quiet, steady bed: audible, never loud, never NaN, and acts 2 and 3 sound unlike act 1 (a deep fridge hum, tile-room air, a humidifier\'s high hiss). Act 4 is act 1\'s room, so it plays act 1\'s bed, without act 1\'s rain.',
  setup() { setupFight(); },
  async play() {
    const { BEDS } = await import('../ambience.js'), beds = [];
    for (const act of [1, 2, 3, 4]) beds.push(await renderBed(act));
    const [a1, a2, a3, a4] = beds, same = BEDS[4].every((l) => BEDS[1].includes(l)) && BEDS[1].length === BEDS[4].length + 2;   // act 1 adds its rain
    const heard = beds.every((b) => b.rms > 0.002 && b.peak < 0.35 && !b.bad && b.layers > 0);
    const apart = Math.abs(a2.zcr - a1.zcr) > 0.004 && Math.abs(a3.zcr - a1.zcr) > 0.002 && Math.abs(a3.zcr - a2.zcr) > 0.002;
    return ok(heard && apart && same && Math.abs(a4.rms - a1.rms) < a1.rms * 0.35, { beds: beds.map((b) => ({ rms: +b.rms.toFixed(4), peak: +b.peak.toFixed(3), zcr: +b.zcr.toFixed(3), layers: b.layers })), same });
  },
});

story('sound/ambience-ducks-in-a-fight', {
  about: 'The bed steps back as bugs close in, further under a Boss fight and while paused, and is silent in the Encore\'s arena; in a real Vacuum fight the run asks for the Boss level.',
  setup() { setupFight(); },
  async play() {
    const { ambienceLevel } = await import('../ambience.js');
    const calm = ambienceLevel({ ...ROOM, intensity: 0.1 }), busy = ambienceLevel({ ...ROOM, intensity: 0.9 }), boss = ambienceLevel({ ...ROOM, boss: true });
    const paused = ambienceLevel({ ...ROOM, paused: true }), arena = ambienceLevel({ ...ROOM, off: true });
    const explore = G().run.ambienceState().boss;
    startVacuum('charge');
    const inFight = { ...G().run.ambienceState() };
    return ok(calm === 1 && busy < 0.6 && boss < busy && paused < calm && arena === 0 && explore === false && inFight.boss && ambienceLevel(inFight) === boss, { calm, busy, boss, paused, arena, inFight });
  },
});

story('sound/ambience-is-silent-in-the-encore', {
  about: 'In act 4\'s concert arena (the Encore plays only its recording) the run asks for no room tone, and a bed that was playing fades out and is put away, so it costs no audio work.',
  setup() { setupFight(); },
  async play() {
    const { Ambience } = await import('../ambience.js'), { run } = G(), real = run.stage, arena = STAGES[3].stageDoor.to;
    run.stage = arena; const off = run.ambienceState().off, id = run.ambienceState().act; run.stage = real;
    const oc = new OfflineAudioContext(1, 16000, 16000), A = new Ambience(oc, oc.destination), L = { x: 0, z: 0, rx: 1, rz: 0 };
    A.update(0.1, { ...ROOM, act: 4 }, L);
    const playing = A.layers.length;
    for (let i = 0; i < 40; i++) A.update(0.1, { ...ROOM, act: 4, off: true }, L);
    return ok(off && id === 4 && playing > 0 && A.layers.length === 0 && A.act === 0 && A.level === 0, { off, playing, left: A.layers.length });
  },
});

story('sound/ambience-respects-the-sound-setting', {
  about: 'Muting sound (or the Sound setting off) silences the room tone and puts its layers away; unmuting brings the bed back. It plays into the master, so the Sound setting is its volume.',
  setup() { setupFight(); },
  async play() {
    const { Ambience } = await import('../ambience.js'), oc = new OfflineAudioContext(1, 16000, 16000), master = oc.createGain();
    const A = new Ambience(oc, master);
    const L = { x: 0, z: 0, rx: 1, rz: 0 }, S = { ...ROOM, act: 1 };
    A.update(0.1, S, L, false); const on = A.level > 0 && A.layers.length > 0;
    for (let i = 0; i < 40; i++) A.update(0.1, S, L, true);
    const muted = A.level === 0 && A.layers.length === 0;
    A.update(0.1, S, L, false);
    return ok(on && muted && A.level > 0 && A.layers.length > 0, { on, muted, back: A.layers.length });
  },
});

story('sound/ambience-one-shots-sit-in-the-room', {
  about: 'A one-shot is placed where its piece is: the tub\'s drip is heard (and on the right side) when the jelly is in the bathroom, and makes no sound at all from the far end of the apartment; a wind chime in act 1 does the same. Act 4\'s birds are silent at night and certain by the end of the dawn.',
  setup() { setupFight(); },
  async play() {
    const { Ambience, ONCE } = await import('../ambience.js'), oc = new OfflineAudioContext(1, 16000, 16000);
    const A = new Ambience(oc, oc.destination);
    A.setAct(2);
    const near = A.once('tub-drip', { x: 0.2, z: 7.3, rx: 1, rz: 0 }), right = A.fired.at(-1)?.pan;
    const far = A.once('tub-drip', { x: 3, z: 1.5, rx: 1, rz: 0 });
    const osc = oc.createOscillator.bind(oc); let made = 0; stub(oc, 'createOscillator', () => { made++; return osc(); });
    A.once('tub-drip', { x: 3, z: 1.5, rx: 1, rz: 0 });
    const birds = ONCE[4].find((e) => e.name === 'dawn-birds');
    return ok(near && right > 0.1 && !far && made === 0 && birds.when({ dawn: 0.1 }) === 0 && birds.when({ dawn: 1 }) === 1 && ONCE[1].some((e) => e.name === 'wind-chime') && !ONCE[1].some((e) => e.name === 'dawn-birds'), { near, right, far, made });
  },
});

story('sound/vent-gust-and-hum', {
  about: 'A vent ride\'s gust is heard; the vent hiss is one looped voice, heard while it is called every frame near a vent and silent half a second after the calls stop (a pause); far from every vent it makes no voice at all.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), R = 16000;
    const render = async (play) => {
      const oc = new OfflineAudioContext(1, R * 2, R), { when } = S.preview(oc, oc.destination), make = oc.createBufferSource.bind(oc);
      let sources = 0;
      stub(oc, 'createBufferSource', () => { sources++; return make(); });
      play(S.sfx, when);
      const d = (await oc.startRendering()).getChannelData(0), loud = (a, b) => { let m = 0; for (let i = a * R; i < b * R; i++) m = Math.max(m, Math.abs(d[i])); return +m.toFixed(4); };
      return { sources, early: loud(0.15, 0.5), late: loud(1.4, 2) };
    };
    const gust = await render((s, when) => { when(0.05); s.ventGust(); });
    const hum = await render((s, when) => { for (let t = 0.05; t < 0.6; t += 1 / 60) { when(t); s.ventHum(1); } });
    const far = await render((s, when) => { for (let t = 0.05; t < 0.6; t += 1 / 60) { when(t); s.ventHum(0); } });
    return ok(gust.early > 0.01 && hum.sources === 1 && hum.early > 0.002 && hum.late < 0.0005 && far.sources === 0, { gust, hum, far });
  },
});

story('sound/burrow-builds-and-bursts', {
  about: 'The cicada\'s burrow is heard: the inhale climbs to its end and stops there, the burst is much louder than the trail\'s thump and still has its shriek (high energy) after the thud, the jelly\'s throw and landing sound, and a hush leaves 0.4 s later silent.',
  setup() { setupFight(); },
  async play() {
    const S = await freshSfx(), R = 16000;
    const render = async (play) => {
      const oc = new OfflineAudioContext(1, R * 3, R), { when } = S.preview(oc, oc.destination);
      play(S.sfx, when);
      const d = (await oc.startRendering()).getChannelData(0);
      const loud = (a, b) => { let m = 0; for (let i = Math.floor(a * R); i < b * R; i++) m = Math.max(m, Math.abs(d[i])); return +m.toFixed(4); };
      return { loud, peak: loud(0, 3) };
    };
    const heave = await render((s, when) => { when(0.05); s.burrowHeave(1); });
    const swell = await render((s, when) => { when(0.05); s.burrowSwell(0.5); });
    const burst = await render((s, when) => { when(0.05); s.burrowBurst(); });
    const lock = await render((s, when) => { when(0.05); s.burrowLock(); });
    const hit = await render((s, when) => { when(0.05); s.burrowHit(); });
    const thrown = await render((s, when) => { when(0.05); s.thrown(1); });
    const land = await render((s, when) => { when(0.05); s.thrownLand(); });
    const r = { heave: heave.peak, swellEarly: swell.loud(0.05, 0.2), swellLate: swell.loud(0.4, 0.55), swellAfter: swell.loud(0.7, 1), burst: burst.peak, shriek: burst.loud(0.25, 0.6), lockAfter: lock.loud(0.4, 1), hit: hit.peak, thrown: thrown.peak, land: land.peak };
    return ok(r.swellLate > r.swellEarly * 1.5 && r.swellAfter < 0.003 && r.burst > r.heave * 1.5 && r.shriek > 0.01 && r.lockAfter < 0.003 && r.hit > 0.05 && r.thrown > 0.01 && r.land > 0.05, r);
  },
});
