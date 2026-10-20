import { CONTENT } from '../content.js';
import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { G, evolve, near, ok, record, setupFight, spawn, step, story, stub } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); step(120); };
function begin(id, done = () => {}) {
  const { run } = G(), before = run.mods;
  evolve(id); run.phase = 'metamorph';
  run.evolutionReveal.begin(CONTENT.evolutions.find(e => e.id === id), before, done);
  return run.evolutionReveal;
}

story('attack/tentacle-coil-snap-and-contact', {
  about: 'The tentacle coils, accelerates to the original 70 ms contact, squashes its tip and retracts. One hit retains the original damage and adds a short wet trace, droplets and layered sound.',
  setup,
  play() {
    const { run, player, fx } = G(), L = run.lash;
    const e = spawn('roach', near(0, -0.07), { still: true, hp: 100 });
    const from = near(0, 0, 0.04), log = record('damage_taken');
    let draws = 0, releases = 0, contacts = 0;
    stub(sfx, 'lashDraw', () => draws++); stub(sfx, 'lashRelease', () => releases++); stub(sfx, 'sting', () => contacts++);
    L.strike(from, e, 4, run.mods.hits.tentacles);
    const s = L.strikes[0], T = s.rig.list[s.tent];
    L.animate(0.012, from); const coil = T.k < 0;
    L.animate(0.03, from); const snap = T.k > 0 && T.k < 1 && !log.length;
    L.animate(0.027, from); const notEarly = !log.length;
    L.animate(0.0011, from);
    player.avatar.update(1 / 120, { speed: 0, vy: 0 });
    const squash = T.tip.scale.x > T.tip.scale.y;
    const hits = log.filter(d => d.source === 'tentacle');
    const aftermath = fx.splats.some(p => p.alive);
    L.animate(0.2, from);
    return ok(coil && snap && notEarly && squash && aftermath && hits.length === 1 && hits[0].amount === 4 && draws === 1 && releases === 1 && contacts === 1 && !L.strikes.length && !T.aim,
      { coil, snap, notEarly, squash, aftermath, hits: hits.length, draws, releases, contacts, released: !T.aim });
  },
});

story('attack/tentacle-miss-has-no-hit-feedback', {
  about: 'A target killed or shielded before the 70 ms contact produces no slap, impact, residue or damage.',
  setup,
  play() {
    const { run, fx } = G(), L = run.lash, log = record('damage_taken');
    let impacts = 0, contacts = 0;
    stub(fx, 'impact', () => impacts++); stub(sfx, 'sting', () => contacts++);
    const e = spawn('roach', near(0, -0.07), { still: true, hp: 100 });
    const from = near(0, 0, 0.04);
    L.strike(from, e, 4, run.mods.hits.tentacles); e.dead = true; L.animate(0.08, from);
    const shield = spawn('roach', near(0.03, -0.07), { still: true, hp: 100 });
    L.strike(from, shield, 4, run.mods.hits.tentacles); shield.proxy = { shielded: true }; L.animate(0.08, from);
    return ok(!log.length && !impacts && !contacts && !fx.splats.some(s => s.alive), { damage: log.length, impacts, contacts });
  },
});

story('evolutions/reveal-before-next-reward', {
  about: 'Choosing an evolution pauses on its portrait, applies the choice once, then automatically offers the Legendary reward once.',
  setup,
  play() {
    const { run, menus } = G(); let rewards = 0;
    stub(run, 'pickLegendary', () => rewards++);
    run.metamorph(); menus.modal.querySelector('.jf-card').click();
    const R = run.evolutionReveal, held = R.active && menus.open && rewards === 0 && run.phase === 'metamorph';
    const t = run.t, health = run.health; step(30);
    const paused = run.t === t && run.health === health;
    step(80); R.finish();
    return ok(held && paused && rewards === 1 && run.evolved.length === 1 && !R.active && !document.body.classList.contains('evolution-presenting'),
      { held, paused, rewards, evolved: run.evolved.length });
  },
});

story('evolutions/reveal-every-choice-and-skip', {
  about: 'Every evolution reveals its own appearance on the selected jelly; skip restores the camera and layers, never fires an attack and never changes the chosen look.',
  setup,
  play() {
    const { run, player, tpc, menus } = G(), checked = [];
    for (const evo of CONTENT.evolutions) {
      setup(); const source = player.avatar, look = JSON.stringify(source.look), mask = tpc.camera.layers.mask;
      const position = tpc.camera.position.clone(), size = source.root.scale.clone(); let done = 0;
      const R = begin(evo.id, () => done++), health = run.health;
      step(65);
      const visible = R.growing.every(g => g.visible) && R.body.visible;
      const special = run.mods.decoy ? !!R.ghost?.visible && run.mirage.left === 0 : true;
      menus.modal.querySelector('button').click(); R.finish();
      checked.push({ id: evo.id, visible, special, done, same: player.avatar === source && JSON.stringify(source.look) === look && source.root.scale.equals(size),
        restored: tpc.camera.layers.mask === mask && tpc.camera.position.distanceTo(position) < 1e-8, safe: health === run.health && !run.bubbles.list.length && !run.lash.strikes.length });
    }
    return ok(checked.every(x => x.visible && x.special && x.done === 1 && x.same && x.restored && x.safe), { checked });
  },
});

story('evolutions/reveal-cancel-and-reduced-effects', {
  about: 'Reduce Effects uses a brief static reveal. Replacing a dialog or restarting cancels the old portrait without advancing its reward.',
  setup,
  play() {
    const { run, menus } = G(), wasCalm = juice.calm;
    let done = 0;
    try {
      juice.calm = true; const R = begin('rebound', () => done++); step(1);
      const staticView = !R.shell.visible && R.avatar.scale.equals(G().player.avatar.root.scale);
      step(20); const quick = done === 1 && !R.active;
      setup(); juice.calm = false; begin('aegis', () => done++);
      menus.message('Replacement', '', [], [{ label: 'OK', onClick() {} }]); step(1);
      const replacement = !R.active && menus.modal.textContent.includes('Replacement') && !menus.modal.classList.contains('jf-evolution');
      setup(); begin('mirage', () => done++); run.start(); step(120);
      return ok(staticView && quick && replacement && done === 1 && !R.active && !R.portrait, { staticView, quick, replacement, done, cleared: !R.portrait });
    } finally { juice.calm = wasCalm; }
  },
});

story('evolutions/reveal-ready-on-low', {
  about: 'The portrait and cocoon compile behind Play. Starting and ending a reveal on Low adds no shader and leaves no portrait objects.',
  setup,
  play() {
    const { run, APT, GAME, gfx } = G(), quality = gfx.quality;
    try {
      gfx.setTier('low'); GAME.render(); const before = APT.renderer.info.programs.length;
      const R = begin('manOWar'); step(60); GAME.render();
      const prepared = APT.renderer.info.programs.length === before;
      R.finish(); GAME.render();
      return ok(prepared && !R.portrait && !R.shell.visible && !R.water.mesh.visible,
        { prepared, before, after: APT.renderer.info.programs.length });
    } finally { gfx.setTier(quality); }
  },
});

story('phone/evolution-reveal', {
  about: 'The evolution portrait fits a phone, keeps the skip control reachable, and shows the selected jelly species.',
  setup,
  play() {
    const { run, menus, player } = G(), R = begin('mirage'); step(55);
    const button = menus.modal.querySelector('button').getBoundingClientRect();
    const fits = button.left >= 0 && button.right <= innerWidth && button.bottom <= innerHeight && button.height >= 40;
    const ownLook = R.avatar.geometry === undefined && R.body.getObjectByName('Face') && !!player.avatar.look;
    menus.modal.querySelector('button').click();
    return ok(fits && ownLook && !R.active, { fits, button: [button.x, button.y, button.width, button.height], ownLook: !!ownLook });
  },
});
