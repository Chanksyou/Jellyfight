// Act 2's Elites (Soap Dispenser, Wall Clock, Cream Whipper) play recorded sounds layered over their
// synthesized ones (docs/agents/sound.md, packs elite-soap / elite-clock / elite-whipper).
import { sfx, unlock as unlockAudio, loadPack, cueLog, deepen, calm } from '../sfx.js';
import { G, V, act2, fresh, hallClock, holdJelly, ok, startBalloon, startClock, startPiping, startSoap, step, stub, whipper } from './kit.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PACKS = ['elite-soap', 'elite-clock', 'elite-whipper'];

act2('sound/act-2-elites-have-a-recorded-sound-for-every-role', {
  about: "Every recorded role of the Soap Dispenser, Wall Clock and Cream Whipper plays its take when its cue is called; beating one of them plays its own breaking sound (the dispenser's, the clock's, the whipper's) while another Elite keeps the plain boom; the cream piping's hiss has no balloon in it.",
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  async play() {
    unlockAudio();
    const loaded = await Promise.all(PACKS.map(loadPack)), packs = await (await fetch('/assets/audio/packs.json')).json();
    await wait(2000);   // every recorded voice from earlier stories has rung out
    const missing = [], { run } = G();
    for (const name of PACKS) for (const [role, r] of Object.entries(packs[name].roles)) {
      const log = cueLog(() => 0);
      sfx[r.cue[0]](...r.cue.slice(1));
      cueLog(null);
      if (!log.some((c) => c.cue === role && c.recorded)) missing.push(role);
      await wait(350);   // past the repeat gaps, and the last take has mostly rung out
    }
    // the piping's hiss is the same method with no rubber in it
    const hiss = cueLog(() => 0);
    sfx.balloonFill(0.8, false);
    cueLog(null);
    const quiet = !hiss.some((c) => c.cue === 'balloon-fill');
    // beating an Elite: its own sound, else the boom
    stub(run, 'dropTreasure', () => {}); stub(run, 'earn', () => {}); stub(run, 'found', () => {}); stub(run, 'eliteTreasure', () => {});
    run.dev = true;
    const down = {};
    for (const kind of ['soap', 'clock', 'whipper', 'bowl']) {
      const log = cueLog(() => 0);
      run.eliteDefeated({ kind, name: kind, spec: { kind, area: 'test' }, base: V(3.2, 0, 3), r: 0.04 });
      cueLog(null);
      down[kind] = { own: log.some((c) => c.cue === `${kind}Down`), recorded: log.some((c) => c.cue === `${kind}-down` && c.recorded), boom: log.some((c) => c.cue === 'boom') };
      await wait(350);
    }
    const downs = ['soap', 'clock', 'whipper'].every((k) => down[k].own && down[k].recorded) && !down.bowl.own && down.bowl.boom;
    return ok(loaded.every(Boolean) && !missing.length && quiet && downs, { loaded, missing, quiet, down });
  },
});

// one whole attack of an Elite, from it leaving idle to its being idle again
function wholeAttack(e, frame) {
  let began = false;
  for (let i = 0; i < 900; i++) { step(1); frame.n++; began ||= e.state !== 'idle'; if (began && e.state === 'idle') return; }
}

act2('sound/act-2-elite-attacks-play-their-recordings', {
  about: "A real Soap Dispenser bubble trap and bubble ring (and the bubbles popping), Wall Clock sweep, wreath and chime, and Cream Whipper balloon (let go, then burst) and cream piping (spray, then a bead hitting the still jelly) each play their recorded take on the same frame as the synthesized cue.",
  setup() { startSoap(0); },
  async play() {
    unlockAudio();
    const loaded = await Promise.all(PACKS.map(loadPack));
    await wait(2000);
    const frame = { n: 0 }, log = cueLog(() => frame.n), seen = (cue, recorded = true) => log.filter((c) => c.cue === cue && !!c.recorded === recorded).length;
    holdJelly();
    const soap = G().run.elites.alive.find((e) => e.kind === 'soap');
    wholeAttack(soap, frame);                    // the bubble trap: pumped up and let go
    const trap = { pump: seen('soap-pump'), foam: seen('soap-bubbles') };
    await wait(1500);
    soap.next = 1; soap.cool = 0;
    wholeAttack(soap, frame);                    // the bubble ring
    const ring = { foam: seen('soap-bubbles') };
    step(600, () => !G().run.elites.soapBubbles.length); frame.n += 60;   // the ring drifts out and its bubbles pop
    ring.pops = seen('soap-bubble-pop');
    await wait(1500);
    startClock(0);
    holdJelly();
    const clock = hallClock();
    clock.next = 0; clock.cool = 0;
    wholeAttack(clock, frame);                   // the sweeping hand
    const sweep = { sweep: seen('clock-sweep'), strike: seen('clock-strike') };
    await wait(1500);
    clock.next = 1; clock.cool = 0;
    wholeAttack(clock, frame);                   // Victory's wreath
    const wreath = { whirr: seen('wreath-whirr') };
    await wait(1500);
    clock.next = 2; clock.cool = 0;
    wholeAttack(clock, frame);                   // telling the time: the chime
    const chime = { chime: seen('clock-chime') };
    await wait(1500);
    startBalloon();
    holdJelly();
    const w = whipper();
    wholeAttack(w, frame);                       // a balloon filled and let go
    for (let i = 0; i < 400 && !seen('balloon-pop'); i++) { step(1); frame.n++; }   // and its fuse burning down
    await wait(1500);
    startPiping();
    holdJelly();
    wholeAttack(whipper(), frame);               // the cream piped over the still jelly
    cueLog(null);
    const cream = { spray: seen('cream-spray'), splat: seen('cream-splat') };
    const balloon = { fill: seen('balloon-fill'), loose: seen('balloon-loose'), pop: seen('balloon-pop') };
    const paired = [['soap-pump', 'soapPump'], ['soap-bubbles', 'soapBubbles'], ['clock-sweep', 'clockSweep'], ['clock-strike', 'clockStrike'], ['balloon-fill', 'balloonFill'], ['balloon-loose', 'balloonLoose'], ['balloon-pop', 'balloonPop'], ['wreath-whirr', 'wreathWhirr'], ['clock-chime', 'clockChime'], ['cream-spray', 'creamSpray'], ['cream-splat', 'creamSplat']]
      .every(([role, cue]) => log.some((c) => c.cue === role) && log.filter((c) => c.cue === role).every((c) => log.some((d) => d.cue === cue && d.frame === c.frame)));
    return ok(loaded.every(Boolean) && trap.pump >= 1 && trap.foam >= 1 && ring.foam > trap.foam && sweep.sweep >= 1 && sweep.strike >= 1 && balloon.fill >= 1 && balloon.loose >= 1 && balloon.pop >= 1 && ring.pops >= 1 && wreath.whirr >= 1 && chime.chime >= 1 && cream.spray >= 1 && cream.splat >= 1 && paired, { loaded, trap, ring, sweep, wreath, chime, balloon, cream, paired });
  },
});

act2('sound/cream-whipper-deep-sound-slows-recordings', {
  about: "While the Cream Whipper's balloon has the world sounding deep, a recorded take plays slower and lower than normal (at about 0.6 of its speed), and again at normal speed once the deep sound is let go.",
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  async play() {
    unlockAudio();
    const loaded = await loadPack('elite-whipper');
    await wait(2000);
    const made = [], create = BaseAudioContext.prototype.createBufferSource;
    BaseAudioContext.prototype.createBufferSource = function () { const s = create.call(this); made.push(s); return s; };
    // the recording is the source playing the whole pack's buffer (seconds long); the synthesized sound's sources have tiny buffers
    const speedOfNext = async () => { made.length = 0; sfx.balloonPop(); await wait(30); const rec = made.find((s) => s.buffer?.duration > 3); return rec ? rec.playbackRate.value : null; };
    try {
      const normal = await speedOfNext();
      await wait(600);
      deepen(2, 1);
      await wait(400);                           // the quick dive down is over
      const deep = await speedOfNext();
      await wait(600);
      calm();
      const back = await speedOfNext();
      return ok(loaded && normal > 0.9 && deep < 0.7 && deep > 0.5 && back > 0.9, { loaded, normal, deep, back });
    } finally { BaseAudioContext.prototype.createBufferSource = create; calm(); }
  },
});
