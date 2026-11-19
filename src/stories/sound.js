// Sound packs (src/sfx.js, docs/agents/sound.md): recorded takes by role, their synthesized fallbacks,
// when they download, and the cue log later stories use to say which cue played on which frame.
import { sfx, unlock as unlockAudio, loadPack, sample, cueLog, audio } from '../sfx.js';
import { G, V, ok, roachAt, setupFight, story, stub, withElement } from './kit.js';

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
