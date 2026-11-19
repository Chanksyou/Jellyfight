// Act 1's Elites (Controller, Mug, Kettle) play recorded sounds layered over their synthesized ones
// (docs/agents/sound.md, packs elite-controller / elite-mug / elite-kettle).
import { sfx, unlock as unlockAudio, loadPack, cueLog } from '../sfx.js';
import { G, V, fresh, holdJelly, ok, record, startCoffeeLob, startController, startKettle, step, story, stub, theKettle } from './kit.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PACKS = ['elite-controller', 'elite-mug', 'elite-kettle'];

story('sound/act-1-elites-have-a-recorded-sound-for-every-role', {
  about: "Every recorded role of the Controller, Mug and Kettle plays its take when its cue is called; beating an Elite plays its own breaking sound (the Controller's, Mug's, Kettle's) while any other Elite keeps the plain boom.",
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
    // beating an Elite: its own sound, else the boom
    stub(run, 'dropTreasure', () => {}); stub(run, 'earn', () => {}); stub(run, 'found', () => {}); stub(run, 'eliteTreasure', () => {});
    run.dev = true;
    const down = {};
    for (const kind of ['controller', 'mug', 'kettle', 'bowl']) {
      const log = cueLog(() => 0);
      run.eliteDefeated({ kind, name: kind, spec: { kind, area: 'test' }, base: V(3.2, 0, 3), r: 0.04 });
      cueLog(null);
      down[kind] = { own: log.some((c) => c.cue === `${kind}Down`), recorded: log.some((c) => c.cue === `${kind}-down` && c.recorded), boom: log.some((c) => c.cue === 'boom') };
      await wait(350);
    }
    const downs = ['controller', 'mug', 'kettle'].every((k) => down[k].own && down[k].recorded) && !down.bowl.own && down.bowl.boom;
    return ok(loaded.every(Boolean) && !missing.length && downs, { loaded, missing, down });
  },
});

story('sound/controller-hit-sound-plays-only-on-a-real-hit', {
  about: "The Controller's barrage clicks on the frame each symbol goes off, and its hit thud plays on that same frame only for the symbol that really hits the jelly: a jelly standing in a symbol hears one thud, a jelly jumping clear hears none.",
  setup() { startController(0, { hurt: true }); },
  async play() {
    unlockAudio();
    const loaded = await loadPack('elite-controller');
    await wait(2000);
    const { run } = G(), E = run.elites, e = E.list.find((x) => x.kind === 'controller'), player = holdJelly(), hits = record('damage_taken');
    let frame = 0;
    const log = cueLog(() => frame);
    const play = () => {   // one whole barrage: from its windup to the Controller idle again
      let began = false;
      for (let i = 0; i < 600; i++) { step(1); frame++; began ||= e.state === 'windup'; if (began && e.state === 'idle') return; }
    };
    // standing in the first symbol
    play();
    const standing = { hit: log.filter((c) => c.cue === 'controller-hit' && c.recorded).length, hurt: hits.filter((d) => d.source === 'controller').length };
    await wait(1500);   // the steps ran faster than the clock: let those takes ring out so the next barrage has voices
    // up and out of every symbol
    e.next = 0; e.cool = 0; player.position.y += 0.3; player.grounded = false;
    const before = log.filter((c) => c.cue === 'controller-hit').length;
    play();
    cueLog(null);
    const clicks = log.filter((c) => c.cue === 'controller-click' && c.recorded), fires = log.filter((c) => c.cue === 'controllerFire');
    const hit = log.find((c) => c.cue === 'controller-hit' && c.recorded), contact = log.filter((c) => c.cue === 'controllerHit');
    const together = clicks.length === 8 && fires.length === 8 && clicks.every((c, i) => c.frame === fires[i].frame);
    const sameFrame = hit && contact[0] && hit.frame === contact[0].frame && fires.some((f) => f.frame === hit.frame);
    const missed = log.filter((c) => c.cue === 'controller-hit').length === before;
    return ok(loaded && standing.hit === 1 && standing.hurt === 1 && together && sameFrame && missed, { loaded, standing, clicks: clicks.length, fires: fires.length, together, sameFrame, missed });
  },
});

// one whole attack of an Elite, from it leaving idle to its being idle again
function wholeAttack(e, frame) {
  let began = false;
  for (let i = 0; i < 900; i++) { step(1); frame.n++; began ||= e.state !== 'idle'; if (began && e.state === 'idle') return; }
}

story('sound/mug-and-kettle-attacks-play-their-recordings', {
  about: "A real Mug coffee throw plays its slosh and its splash take, and a real Kettle steam ball plays its charge whistle and blast take, then its lid pop and boiling drop take; each recorded take comes with the synthesized cue on the same frame.",
  setup() { startKettle(0); },
  async play() {
    unlockAudio();
    const loaded = await Promise.all(['elite-mug', 'elite-kettle'].map(loadPack));
    await wait(2000);
    const frame = { n: 0 }, log = cueLog(() => frame.n), seen = (cue, recorded = true) => log.filter((c) => c.cue === cue && !!c.recorded === recorded).length;
    holdJelly();
    const k = theKettle();
    wholeAttack(k, frame);                       // the steam ball
    const ball = { charge: seen('kettle-charge'), blast: seen('kettle-blast') };
    await wait(1500);
    k.next = 1; k.cool = 0;
    wholeAttack(k, frame);                       // the boil-dry: its lid pops and drops land
    const boil = { pop: seen('kettle-pop'), drop: seen('kettle-drop') };
    await wait(1500);
    startCoffeeLob();
    const mug = G().run.elites.list.find((x) => x.kind === 'mug');
    holdJelly();
    wholeAttack(mug, frame);
    cueLog(null);
    const throwing = { lob: seen('mug-lob'), splash: seen('mug-splash') };
    const paired = ['kettle-charge', 'kettle-blast', 'kettle-pop', 'kettle-drop', 'mug-lob', 'mug-splash'].every((role) => {
      const cue = { 'kettle-charge': 'kettleCharge', 'kettle-blast': 'kettleBlast', 'kettle-pop': 'kettlePop', 'kettle-drop': 'kettleDrop', 'mug-lob': 'mugLob', 'mug-splash': 'mugSplash' }[role];
      return log.filter((c) => c.cue === role).every((c) => log.some((d) => d.cue === cue && d.frame === c.frame));
    });
    return ok(loaded.every(Boolean) && ball.charge >= 1 && ball.blast >= 1 && boil.pop >= 1 && boil.drop >= 1 && throwing.lob >= 1 && throwing.splash >= 1 && paired, { loaded, ball, boil, throwing, paired });
  },
});
