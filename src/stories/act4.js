// Stories: act 4, the Encore's concert (stage4.js, act4-arena.js, encore.js). The run comes here
// after beating the shark (tests/run.mjs opens these on an act-4 page with that run's carry). There
// is no night: the fight starts straight away, and beating the Encore wins the run. Shared helpers
// are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { CONTENT } from '../content.js';
import { G, act4, encoreFight, everyAttack, fresh, ok, record, step, stub } from './kit.js';

act4('the-encore-fight-starts-straight-away', {
  about: 'Act 4 has no night to explore: the run goes straight into the Encore\'s fight in the concert arena (no "Time\'s up!"), with its Health bar up, its set playing and no bugs waiting.',
  setup() {},
  play() {
    const { run, hud } = G(), toasts = [];
    stub(hud, 'toast', (t) => toasts.push(t));
    const B = encoreFight();
    step(30);
    const health = CONTENT.bosses.encore.hp * (run.stage.bossHp ?? 1);
    return ok(run.stage.id === 4 && run.phase === 'boss' && B?.constructor.name === 'Encore' && B.hp === health && !toasts.some((t) => /Time's up/.test(t)) && B.beat > 0,
      { act: run.stage.id, phase: run.phase, boss: B?.constructor.name, hp: B?.hp, health, beat: B?.beat, toasts });
  },
});

act4('its-beetles-hold-up-a-force-field-until-they-die', {
  about: 'At bar 8 (beat 32) the Encore calls 2 stag beetles onto the floor (2 at a time, bosses.kdl `count`) and a bright blue force field rises over its whole booth: while either beetle lives your hits bounce off. Kill them and it takes damage again. 16 bars later (beat 96) it calls 2 more.',
  setup() {},
  play() {
    const B = encoreFight({ beat: 31.5 }), { enemies } = G(), count = CONTENT.bosses.encore.skills.beetles.count;
    step(60);
    const called = B.guards.length, beetles = B.guards.every((g) => g.type === 'beetle'), up = B.shielded && B.field.visible;
    // the dome stands out round the booth: past its sides, its front and its top (not hidden inside it)
    const box = new THREE.Box3().setFromObject(B.arenaView.boss.root), f = B.field, inside = (x, y, z) => ((x - f.position.x) / f.scale.x) ** 2 + ((y - f.position.y) / f.scale.y) ** 2 + ((z - f.position.z) / f.scale.z) ** 2 <= 1;
    const mx = (box.min.x + box.max.x) / 2, mz = (box.min.z + box.max.z) / 2, low = box.min.y + 0.01;
    const covers = inside(box.min.x, low, mz) && inside(box.max.x, low, mz) && inside(mx, low, box.max.z) && inside(mx, box.max.y, mz);   // its sides, its front and its top
    const hp0 = B.hp; B.damage(50);
    const bounced = B.hp === hp0;
    for (const g of [...B.guards]) enemies.kill(g);
    step(2);
    const down = !B.shielded && !B.field.visible;
    B.damage(50);
    const hurt = B.hp === hp0 - 50;
    B.clock = 95.5; step(60);
    const again = B.guards.length;
    return ok(count === 2 && called === count && beetles && up && covers && bounced && down && hurt && again === count, { count, called, beetles, up, covers, bounced, down, hurt, again });
  },
});

act4('at-half-health-its-booth-shorts-out', {
  about: 'Bring the Encore to half Health and its booth shorts out in a short cut scene: the game holds (the jelly stays put, the HUD hides, hits do nothing), the camera cuts in on the booth, and sparks and smoke burst out of it while its panels flicker. Then the fight plays on: it keeps sparking, and its disco ball comes down for good, striking every 4 beats.',
  setup() {},
  play() {
    const B = encoreFight({ beat: 10 }), { fx, player, hud, APT } = G(), camera = APT.camera;
    step(30);
    let sparks = 0;
    const impact = fx.impact;
    fx.impact = function (...a) { sparks++; return impact.apply(this, a); };
    try {
      B.damage(B.hp - B.maxHp * 0.49);
      step(2);
      const at = player.position.clone(), hp = B.hp, booth = B.booth.getCenter(new THREE.Vector3());
      const inCut = !!B.cut && B.broken && hud.el.hidden && camera.position.distanceTo(booth) < 1.1, cut = { on: !!B.cut, hud: hud.el.hidden, cam: +camera.position.distanceTo(booth).toFixed(2) };
      B.damage(100);
      const immune = B.hp === hp;
      let frames = step(60 * 6, () => !B.cut);
      step(2);
      const held = player.position.distanceTo(at) < 1e-6, during = sparks, back = !B.cut && !hud.el.hidden;
      // after: the disco ball down for good, striking every 4 beats; the booth still sparking
      let strikes = 0, up = 0;
      const strike = B.disco.strike;
      B.disco.strike = function (...a) { strikes++; return strike.apply(this, a); };
      sparks = 0;
      step(60 * 9, () => { if (B.disco.stayFrom != null && B.beat > B.disco.stayFrom && !B.disco.hanger.visible) up++; });
      B.disco.strike = strike;
      return ok(inCut && immune && held && during >= 8 && back && frames < 60 * 6 && B.disco.stayFrom != null && up === 0 && strikes >= 3 && sparks >= 2,
        { inCut, cut, immune, held, during, back, cutFrames: frames, stay: B.disco.stayFrom, up, strikes, after: sparks });
    } finally { fx.impact = impact; }
  },
});

act4('after-shorting-out-it-reboots-behind-its-force-field', {
  about: 'Once the short-out cut scene ends the Encore reboots behind its force field for 10 s (bosses.kdl meltdown `guard`): hits bounce off as SHIELDED, its Health bar counts the reboot down, and its set keeps playing; when the 10 s are up the field shatters and hits land again.',
  setup() {},
  play() {
    const B = encoreFight({ beat: 10 }), { run } = G(), bars = record('boss_health');
    step(30);
    B.damage(B.hp - B.maxHp * 0.49);
    step(60 * 6, () => !B.cut); step(2);
    const guard = B.guardT, hp = B.hp;
    B.damage(100);
    const blocked = B.hp === hp && B.shielded && B.field.visible;
    const text = bars.at(-1)?.shieldText || '';
    const beat0 = B.beat;
    step(60 * 5);
    const playing = B.beat > beat0 + 4 && B.shielded;           // its set plays on while it's shielded
    step(60 * 5.5);
    for (const g of [...B.guards]) G().enemies.kill(g, true);   // (its beetles come at bar 8: their shield is another story)
    step(2);
    B.damage(100);
    const lands = B.hp === hp - 100 && !B.shielded && B.guardT === 0;
    return ok(Math.abs(guard - (CONTENT.bosses.encore.skills.meltdown.guard ?? 10)) < 0.1 && blocked && /rebooting/.test(text) && playing && lands && run.phase === 'boss',
      { guard, blocked, text, playing, lands, hp: B.hp });
  },
});

act4('the-fight-opens-behind-its-force-field', {
  about: 'The Encore\'s fight opens with its force field up for 15 s (bosses.kdl start `guard`): hits bounce off, its Health bar reads "warming up" and counts down, and its set plays all the while; then the field shatters and hits land.',
  setup() {},
  play() {
    const B = encoreFight({ guard: true }), bars = record('boss_health');
    const guard = B.guardT, hp = B.hp;
    step(30);
    B.damage(100);
    const blocked = B.hp === hp && B.shielded && B.field.visible, text = bars.at(-1)?.shieldText || '';
    step(60 * (CONTENT.bosses.encore.skills.start.guard + 0.5));
    for (const g of [...B.guards]) G().enemies.kill(g, true);   // (no beetles before bar 8 anyway)
    step(2);
    B.damage(100);
    const lands = B.hp === hp - 100 && !B.shielded;
    return ok(Math.abs(guard - 15) < 0.1 && blocked && /warming up/.test(text) && B.beat > 20 && lands, { guard, blocked, text, beat: B.beat, lands });
  },
});

act4('beating-the-encore-plays-its-defeat', {
  about: 'At 0 Health the Encore goes down in its own scene: its set stops and the music cuts out, the camera pulls back on the stage (the HUD hidden, the game held, no more hits landing), explosions climb over the booth, its panels die and the DJs slump over their decks, one last blow-out, and only then is it beaten.',
  setup() {},
  play() {
    const B = encoreFight({ beat: 10 }), { run, hud, fx } = G(), M = B.arenaView.boss;
    step(20);
    let bursts = 0; const impact = fx.impact; fx.impact = function (...a) { bursts++; return impact.apply(this, a); };
    try {
      B.damage(B.hp + 1);
      step(3);
      const falling = !!B.falling && !!B.cut && !B.dead && hud.el.hidden && run.musicState().song === null;
      const hp = B.hp; B.damage(50); const immune = B.hp === hp;
      step(Math.round(60 * B.falling.length * 0.8));
      const slumped = M.heads.every((h) => h.rotation.x > 0.3), dark = !B.dead;
      step(60 * 2, () => B.dead);
      step(2);
      return ok(falling && immune && slumped && dark && B.dead && run.bossWon && bursts >= 6, { falling, immune, slumped, dark, dead: B.dead, won: run.bossWon, bursts });
    } finally { fx.impact = impact; }
  },
});

act4('winning-swims-the-jelly-home-then-the-score', {
  about: 'After the Encore\'s defeat the run is won with no more metamorphosis: "Congratulations! You won!" over the sea, where the player\'s own jelly swims away home; Continue (after a moment) brings up the score, with its name box and Submit because it makes the top 10, and it posts to the Leaderboard as a win.',
  setup() {},
  async play() {
    const B = encoreFight({ beat: 10 }), { run, menus, APT } = G();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const modal = () => document.querySelector('.jf-modal');
    let posted = null;
    stub(run, 'board', { status: 'online', mine: null, keepBest: () => false, qualifies: () => true, cutoff: () => 0, post: (e) => { posted = e; return Promise.resolve({ posted: true }); } });
    B.damage(B.hp + 1);
    step(60 * 6, () => run.bossWon);
    step(5);
    await wait(2500);
    const V = run.victory, banner = document.querySelector('.jf-victory')?.innerText || '';
    const sea = V.active && APT.camera.layers.mask === 1 << 30 && !modal()?.innerText.includes('Metamorphosis');
    const waits = !!document.querySelector('.jf-victory button')?.hidden;
    const startY = V.body.position.y;
    step(60 * 2);
    const swims = V.body.position.y > startY, ready = !document.querySelector('.jf-victory button').hidden;
    document.querySelector('.jf-victory button').click();
    const end = modal()?.innerText || '';
    const entry = !!modal()?.querySelector('input[name="player"]');
    [...modal().querySelectorAll('button')].find((b) => /Submit score/.test(b.textContent))?.click();
    await wait(50);
    menus.close();
    return ok(/Congratulations/.test(banner) && /You won/.test(banner) && /sea/.test(banner) && sea && waits && swims && ready && /brought the house down/.test(end) && entry && posted?.won,
      { banner: banner.slice(0, 120), sea, waits, swims, ready, end: end.slice(0, 120), entry, posted: !!posted });
  },
});

act4('a-score-off-the-top-10-is-not-entered', {
  about: 'A winning score that would not make the top 10 gets no name box or Submit on the end screen, just a line saying so (and what #10 has); one that would, gets them.',
  setup() {},
  async play() {
    fresh({ hurt: false });
    const { run, menus } = G(), modal = () => document.querySelector('.jf-modal');
    stub(run, 'board', { status: 'online', mine: null, keepBest: () => false, qualifies: () => false, cutoff: () => 99999, post: () => Promise.resolve({ posted: true }) });
    run.endRun('🏆 You won!', 'won', 'Play again');
    const low = modal()?.innerText || '', lowEntry = !!modal()?.querySelector('input[name="player"]'), lowSubmit = /Submit score/.test(low);
    menus.close();
    stub(run.board, 'qualifies', () => true);
    run.endRun('🏆 You won!', 'won', 'Play again');
    const highEntry = !!modal()?.querySelector('input[name="player"]');
    menus.close();
    return ok(!lowEntry && !lowSubmit && /not enough for the top 10/.test(low) && /99,999/.test(low) && highEntry, { lowEntry, lowSubmit, low: low.slice(0, 160), highEntry });
  },
});

act4('every-attack-is-listed', {
  about: 'Every Encore attack the game has is on the attack list (kit.js EVERY_ATTACK), and nothing listed is missing from the game.',
  setup() { encoreFight(); },
  play() { return everyAttack(4); },
});
