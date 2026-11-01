// The moments the game hands you something: a level-up's ding and cards, an end screen's tally,
// a golden award's reveal, a boss cleared (ui.js, hud.js, run.js).
import { FEATS_KEY, PEARLS_KEY } from '../cosmetics.js';
import { DEATH_HINTS } from '../first-run.js';
import { juice } from '../juice.js';
import { bus, PLAYER } from '../events.js';
import { G, V, fresh, ok, phone, step, story, stub } from './kit.js';

const modal = () => document.querySelector('.jf-modal');
function withEmpty(keys, fn) {
  const saved = keys.map((k) => localStorage.getItem(k));
  try { keys.forEach((k) => localStorage.removeItem(k)); return fn(); }
  finally { keys.forEach((k, i) => (saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]))); }
}

story('payoff/level-up-dings-then-deals-like-a-pick', {
  about: 'A level-up lands first (the level badge pops, a gold ring leaves the jelly), then its cards deal in after a beat wearing their rarity, and a pick leaves like a treasure pick: the won card pulses, the others burn away, its icon flies to the badge, and the screen closes a moment later.',
  setup() { fresh({ elites: false, levels: true }); },
  play() {
    const { run, menus } = G();
    run.pendingLevels = 1;
    run.levelUp();
    const dinged = document.querySelector('#hud .lvl').classList.contains('ding') && !!document.querySelector('.jf-ding-ring');
    const cards = [...modal().querySelectorAll('.jf-level .jf-pick .jf-card')];
    const delays = cards.map((c) => parseFloat(c.style.getPropertyValue('--d')));
    const tinted = cards.every((c) => c.style.getPropertyValue('--tint'));
    cards[0].click();
    const won = cards[0].classList.contains('jf-won') && cards.slice(1).every((c) => c.classList.contains('jf-burn'));
    const lingers = menus.open && menus.closing;
    step(50);
    const closed = !menus.open;
    return ok(dinged && delays[0] >= 300 && delays[1] > delays[0] && tinted && won && lingers && closed, { dinged, delays, tinted, won, lingers, closed });
  },
});

story('payoff/end-screen-counts-up', {
  about: 'The end screen tallies: its rows arrive one by one and the Score, the Pearls going into your bank and each score part count up, while what the screen says is the final number all along; a tap on the screen skips to the end.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FEATS_KEY, PEARLS_KEY], () => {
      stub(run, 'board', null); stub(run, 'jellyFace', null);   // (no portraits: they're slow to draw here)
      run.kills = 40; run.t = 200; run.phase = 'dead';
      run.endRun('You dried out', 'dead', 'Try again');
      const score = modal().querySelector('.jf-score .jf-count');
      const counting = score.classList.contains('run') && score.dataset.shown === '0';
      const says = modal().innerText.includes(run.score().toLocaleString());     // the real number, not the one counting
      const staggered = parseFloat(modal().querySelectorAll('.jf-stats > *')[2].style.getPropertyValue('--d')) > 0;
      step(20);
      const midway = +score.dataset.shown.replace(/,/g, '');
      step(60);
      const done = !modal().querySelector('.jf-count.run') && score.dataset.shown === run.score().toLocaleString();
      menus.close();
      run.endRun('You dried out', 'dead', 'Try again');
      modal().firstElementChild.click();                    // a tap on the screen, not a button
      step(1);
      const skipped = !modal().querySelector('.jf-count.run');
      menus.close();
      return ok(counting && says && staggered && midway > 0 && midway < run.score() && done && skipped, { counting, says, staggered, midway, score: run.score(), done, skipped });
    });
  },
});

story('payoff/golden-award-is-revealed', {
  about: 'A golden award earned in a run gets its own reveal over the end screen before the tally runs: your jelly wearing it, its name and what earned it, Wear it now (which puts it on) and Continue; the end screen still lists it.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FEATS_KEY], () => {
      stub(run, 'board', null);
      const worn = [];
      stub(run, 'onWear', (key, id) => worn.push(`${key}:${id}`));
      run.awardsBefore = [];
      localStorage.setItem(FEATS_KEY, JSON.stringify({ kills: 1000 }));     // the Golden laurel's 1,000 bugs
      run.phase = 'dead';
      run.endRun('You dried out', 'dead', 'Try again');
      const el = document.querySelector('.jf-award'), text = el?.innerText || '';
      const shown = /Golden award unlocked/i.test(text) && /Golden laurel/.test(text) && /Clear 1,000 bugs/.test(text) && /^data:image/.test(el?.querySelector('img')?.src || '');
      const listed = /Unlocked\s*Golden laurel/.test(modal().innerText);
      step(30);
      const held = !!modal().querySelector('.jf-count.run');                // the tally waits for it
      el.querySelector('[data-wear]').click();
      for (let i = 0; i < 20 && document.querySelector('.jf-award'); i++) document.querySelector('.jf-award [data-next]').click();   // (other awards may come too)
      const gone = !document.querySelector('.jf-award');
      step(90);
      const tallied = !modal().querySelector('.jf-count.run');
      menus.close();
      return ok(shown && listed && held && worn[0] === 'top:laurel' && gone && tallied, { shown, listed, held, worn, gone, tallied, text: text.slice(0, 120) });
    });
  },
});

story('payoff/boss-cleared-stamps-in', {
  about: 'Beating a boss slows the game for a moment after its hit-stop, and "… is cleared!" stamps in big and gold with a shake.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G();
    return withEmpty([FEATS_KEY, PEARLS_KEY], () => {
      stub(run, 'boss', { center: () => V(0, 0, 0) }); stub(run, 'fx', { puff() {} }); stub(run, 'later', () => {});
      juice.slowT = 0;
      run.onBossDead();
      const toast = document.querySelector('#hud .toast');
      const stamped = toast.classList.contains('stamp') && toast.classList.contains('on') && /is cleared!/.test(toast.textContent);
      const slowed = juice.slowT > 0 && juice.slowK < 1, shook = juice.trauma > 0;
      juice.slowT = 0;
      return ok(stamped && slowed && shook, { stamped, slowed, shook, slowT: juice.slowT, text: toast.textContent });
    });
  },
});

phone('no-thumb-controls-over-the-ending', {
  about: 'On a phone the joystick, jump and pause buttons hide while the jelly swims home after a win, and come back for the next run.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), touch = () => document.getElementById('touch');
    step(2);
    const before = !touch().hidden;
    run.victory.begin(() => {});
    step(2);
    const hidden = touch().hidden;
    run.victory.cancel();
    step(2);
    const back = !touch().hidden;
    return ok(before && hidden && back, { before, hidden, back });
  },
});

story('payoff/death-hint-acts-1-and-2', {
  about: 'Dying in act 1 or 2 shows one hint for new players in its own bubble, picked from the list; a win or a death in act 3 shows none.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    stub(run, 'board', null); stub(run, 'jellyFace', null);
    const end = (act, phase) => {
      stub(run, 'stage', { ...run.stage, id: act });
      run.phase = phase;
      run.endRun('You dried out', 'dead', 'Try again');
      const hints = [...modal().querySelectorAll('.jf-hint')].map((h) => h.textContent.replace('💡', '').trim());
      menus.close();
      return hints;
    };
    const act1 = end(1, 'dead'), act2 = end(2, 'dead'), act3 = end(3, 'dead'), won = end(1, 'won');
    const known = [...act1, ...act2].every((h) => DEATH_HINTS.includes(h));
    return ok(act1.length === 1 && act2.length === 1 && known && !act3.length && !won.length, { act1, act2, act3, won });
  },
});

story('payoff/beta-feedback-bubble', {
  about: 'The death and win screens carry a beta bubble in the corner; it opens a box where the player types feedback, Send hands the text with the run (build, act, score, device) to the game site, a thank-you follows, and Back returns to the end screen. Without the game site there is no bubble.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, menus } = G(), sent = [];
    stub(run, 'jellyFace', null);
    stub(run.board, 'web', true);
    stub(run.board, 'feedback', async (note) => { sent.push(note); return { sent: true }; });
    const bubble = () => modal().querySelector('.jf-beta');
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const end = (phase) => { run.phase = phase; run.endRun(phase === 'dead' ? 'You dried out' : 'You won', '', 'Try again'); };
    end('won');
    const onWin = bubble()?.textContent.includes('Jelly Run is still in beta');
    menus.close();
    end('dead');
    const onDeath = !!bubble(), corner = bubble() && getComputedStyle(bubble()).position === 'fixed';
    bubble().click();
    const box = modal().querySelector('textarea.jf-feedback');
    box.value = 'The Mug fight felt great';
    [...modal().querySelectorAll('button')].find((b) => b.textContent.includes('Send')).click();
    await tick(); await tick();
    const thanks = modal().querySelector('h2').textContent.includes('Message received');
    [...modal().querySelectorAll('button')].find((b) => b.textContent === 'Back').click();
    const backToEnd = modal().querySelector('h2').textContent === 'You dried out' && !!bubble();
    menus.close();
    stub(run.board, 'web', false);
    end('dead');
    const offSite = !bubble();
    menus.close();
    const note = sent[0] || {};
    return ok(onWin && onDeath && corner && thanks && backToEnd && offSite && sent.length === 1 && note.text === 'The Mug fight felt great' && note.act === run.stage.id && ['phone', 'desktop'].includes(note.device),
      { onWin, onDeath, corner, thanks, backToEnd, offSite, sent });
  },
});

story('payoff/run-log-saves-each-act', {
  about: 'Each act that ends (a death, a win, or moving on to the next act) sends one row to the owner\'s run log on the game site, with the Health each source took, the treasures held and the same run id across acts; nothing is shown in the game and a dev run sends nothing.',
  setup() { fresh({ elites: false, hurt: true }); },
  play() {
    const { run, menus } = G(), rows = [];
    stub(run, 'jellyFace', null);
    stub(run.board, 'web', true);
    stub(run.board, 'saveRun', (row) => rows.push(row));
    stub(run.board, 'post', async () => ({ posted: false, why: 'error' }));
    bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'story', drain: true });   // a drain: no dodge, no i-frames
    run.phase = 'dead';
    run.endRun('You dried out', '', 'Try again');
    menus.close();
    const [r] = rows;
    const died = rows.length === 1 && r.outcome === 'died' && r.act === run.stage.id && r.run === run.logId && r.lost.story > 0 && Array.isArray(r.treasures) && 'bossLeft' in r;
    const carried = run.carryOver().logId === run.logId;
    stub(run, 'dev', true);
    run.endRun('You dried out', '', 'Try again');
    menus.close();
    const devSilent = rows.length === 1;
    return ok(died && carried && devSilent, { rows, carried, devSilent });
  },
});

story('payoff/death-screen-dried-jelly', {
  about: 'Behind the death screen your own jelly lies dried out on cracked land, alone: it slumps into a flat puddle with its tentacles splayed out across the mud, and fades to a dull husk with its glow gone, the hud steps aside, and a new run puts the world, the camera and the hud back.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), camera = run.tpc.camera, scene = run.scene;
    const D = run.driedOut, mask = camera.layers.mask, hud = run.hud.el.hidden;
    stub(juice, 'calm', false);
    D.begin();
    step(120);
    const J = D.jelly, alone = camera.layers.mask === 1 << 30 && J.parent === scene;
    const rig = run.player.avatar.tentacles, splayed = D.splat.children.length === rig.list.length && rig.list.every((T) => !D.body.getObjectByProperty('geometry', T.mesh.geometry)?.visible);
    const flat = D.body.scale.y < 0.5 && splayed, veiled = document.body.classList.contains('dried-out') && run.hud.el.hidden;
    const glowing = D.mats.filter((m) => m.userData.from.emissive?.getHex());
    const dull = glowing.every((m) => m.emissive.getHex() !== m.userData.from.emissive.getHex());
    const own = D.mats.every((m) => !run.player.mesh.getObjectByProperty('material', m));   // the real jelly keeps its look
    run.start();
    const back = !D.active && !J.parent && camera.layers.mask === mask && run.hud.el.hidden === hud && !document.body.classList.contains('dried-out');
    return ok(alone && flat && veiled && dull && own && back, { alone, flat, veiled, dull, glowing: glowing.length, own, back });
  },
});
