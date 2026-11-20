// The moments the game hands you something: a level-up's ding and cards, an end screen's tally,
// a golden award's reveal, a boss cleared (ui.js, hud.js, run.js).
import { FEATS_KEY, PEARLS_KEY } from '../cosmetics.js';
import { DEATH_HINTS, TYPE_HINTS } from '../first-run.js';
import { juice } from '../juice.js';
import { LOOK } from '../look.js';
import { bus, PLAYER } from '../events.js';
import { TREASURES, treasureTier } from '../stats.js';
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
    const rank = (c) => ['', 'common', 'rare', 'epic', 'legendary'].indexOf(c.dataset.rarity);
    const byDelay = cards.map((c, i) => [delays[i], rank(c)]).sort((a, b) => a[0] - b[0]), order = byDelay.map((d) => d[0]);
    const tinted = cards.every((c) => c.style.getPropertyValue('--tint'));
    cards[0].click();
    const won = cards[0].classList.contains('jf-won') && cards.slice(1).every((c) => c.classList.contains('jf-burn'));
    const lingers = menus.open && menus.closing;
    step(50);
    const closed = !menus.open;
    const dealt = order[0] >= 300 && new Set(delays).size === delays.length && order[order.length - 1] - order[0] < 400 && byDelay.every((d, i) => !i || d[1] >= byDelay[i - 1][1]);   // after the beat, one by one, inside 400 ms, the rarest last
    return ok(dinged && dealt && tinted && won && lingers && closed, { dinged, delays, dealt, tinted, won, lingers, closed });
  },
});

story('payoff/every-pick-is-the-one-kit-card', {
  about: 'A Treasure pick, a level-up and an Attack upgrade all deal the kit\'s .ui-card: icon, name, a rarity label that says the tier in words (an Attack upgrade says so instead), body text with every number, percentage and unit in a <b> (and nothing in the text taken as HTML), and the New! and count badges together in the top corner.',
  setup() { fresh({ elites: false, levels: true }); },
  play() {
    const { run, menus } = G(), t = TREASURES.find((x) => x.rarity === 'rare') || TREASURES[0];
    const cards = () => [...modal().querySelectorAll('.jf-pick .ui-card')];
    const body = (c) => c.querySelector('.ui-card-body');
    // a Treasure pick: the number highlight, the text kept as text, the badges in one place
    run.offer('Pick', '', [{ ...t, text: 'Fire 40% faster for 8 s, reach +22 cm, ×3 <i>hits</i>', fresh: true, delta: 'Lv 1 → Lv 2' }].map((c) => ({ ...c, tier: treasureTier(c) })));
    const [c] = cards(), tierName = treasureTier(t).name;
    const parts = {
      kit: c.classList.contains('jf-card') && !!c.querySelector('.ui-card-icon') && !!c.querySelector('.ui-card-name') && !!body(c),
      rarity: c.dataset.rarity === tierName.toLowerCase() && c.querySelector('.ui-card-rarity').textContent === tierName,
      numbers: [...body(c).querySelectorAll('b')].map((b) => b.textContent).join('|'),
      asText: !body(c).querySelector('i') && body(c).textContent.includes('<i>hits</i>'),
      badges: [...c.querySelectorAll('.jf-badges .jf-new, .jf-badges .ui-card-count')].map((b) => b.textContent).join('|'),
    };
    c.click(); step(60);
    // a level-up: the same card, its "now" line highlighted
    run.pendingLevels = 1; run.levelUp();
    const lv = cards(), levelUp = lv.length > 1 && lv.every((x) => x.classList.contains('ui-card') && x.querySelector('.ui-card-rarity') && x.querySelector('.ui-card-name b') && body(x).querySelector('b'));
    lv[0].click(); step(60);
    // an Attack upgrade: no rarity, so its label says what it is and the frame is mint
    run.ui.choose('Upgrade', '', [{ icon: '⚔️', name: 'Wider', text: 'Reach 12 cm more', tier: { name: 'Attack upgrade' } }], () => {});
    const [u] = cards(), upgrade = u.querySelector('.ui-card-rarity').textContent === 'Attack upgrade' && u.style.getPropertyValue('--rarity') === 'var(--ui-mint)' && body(u).querySelector('b')?.textContent === '12 cm';
    u.click(); step(60);
    return ok(parts.kit && parts.rarity && parts.numbers === '40%|8 s|+22 cm|×3' && parts.asText && parts.badges === 'New!|Lv 1 → Lv 2' && levelUp && upgrade && !menus.open, { parts, levelUp, upgrade });
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

story('payoff/picked-treasure-flies-to-its-row-slot', {
  about: 'Picking a Treasure flies its icon into its slot in the HUD\'s Treasure row: one element moved by transform alone along a curve, measured once as it is picked. The new slot stays empty until the icon lands, then pops; Reduce effects skip the flight.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run } = G(), row = run.hud.$('.items'), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelectorAll('.jf-flyer').forEach((e) => e.remove());   // (an earlier story's, still flying)
    const was = new Set(run.owned);
    run.pickTreasure();
    const cards = [...modal().querySelectorAll('.jf-pick .jf-card')];
    cards[0].click();
    const flyer = document.querySelector('.jf-flyer'), anim = flyer?.getAnimations()[0];
    const frames = anim?.effect.getKeyframes() || [], props = new Set(frames.flatMap((f) => Object.keys(f)).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)));
    const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(frames.at(-1)?.transform || '') || [];
    const cx = +x + flyer.offsetWidth / 2, cy = +y + flyer.offsetHeight / 2, box = row.getBoundingClientRect();   // where the last frame centres it
    const atRow = cx > box.left - 40 && cx < box.right + 40 && cy > box.top - 40 && cy < box.bottom + 40;   // (the row, one slot's room round it)
    const curved = frames.length >= 4;
    run.refreshHud();                                     // the HUD draws the new Treasure (on the next frame, in play)
    await wait(0);                                        // (the HUD's new slot is held empty a microtask later)
    const id = [...run.owned].find((t) => !was.has(t)), slot = row.querySelector(`[data-id="${id}"]`);
    const empty = slot?.classList.contains('jf-landing') && getComputedStyle(slot).opacity === '0';
    anim?.finish();
    const landing = () => slot?.isConnected && slot.classList.contains('jf-landing');
    for (let i = 0; i < 40 && landing(); i++) await wait(25);   // (its finish event comes with the next frame, later on a busy runner)
    const landed = !slot?.isConnected || (!slot.classList.contains('jf-landing') && slot.classList.contains('pop'));
    const gone = !document.querySelector('.jf-flyer');
    step(50);
    // Reduce effects: no flight at all
    document.body.classList.add('calm');
    try { run.pickTreasure(); [...modal().querySelectorAll('.jf-pick .jf-card')][0].click(); } finally { document.body.classList.remove('calm'); }
    const calmFlight = !!document.querySelector('.jf-flyer');
    step(5);
    return ok(!!anim && [...props].join() === 'transform' && atRow && curved && empty && landed && gone && !calmFlight, { props: [...props], atRow, curved, empty, landed, gone, calmFlight, to: [cx, cy], box: [box.left, box.top, box.right, box.bottom] });
  },
});

story('payoff/death-numbers-wait-for-the-sag', {
  about: 'On a death the jelly sags into its puddle in `death-dry-time` (0.8 s), fast at first and settling with no overshoot, and the end screen\'s numbers wait for it: its rows start arriving only once it has settled.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run } = G(), D = run.driedOut;
    try {
      run.devRun(); run.phase = 'dead'; D.begin();
      run.endRun('You dried out', 'Back to a polyp. Another run awaits.', 'Try again');
      const rows = [...modal().querySelectorAll('.jf-stats > b')].map((b) => parseFloat(b.style.getPropertyValue('--d')));
      const dry = LOOK.num('death-dry-time', 0.8) * 1000, flat = LOOK.num('death-jelly-flat', 0.35);
      const sag = (t) => { D.t = t; D.frame(0); return D.body.scale.y; };
      const ys = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.2].map(sag);
      const settled = Math.abs(ys[5] - flat) < 0.001 && Math.abs(ys[6] - flat) < 0.001, falling = ys.every((y, i) => !i || y <= ys[i - 1] + 1e-9);   // no overshoot: it never drops under its puddle or comes back up
      const fastFirst = ys[2] < (1 + flat) / 2;   // half the sag is done within a quarter of it
      const waits = rows.length > 1 && rows[0] >= dry - 1 && rows.every((d, i) => !i || d > rows[i - 1]);
      return ok(dry <= 900 && settled && falling && fastFirst && waits, { dry, ys, rows });
    } finally { run.ui.close(); run.start(); }
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
      const turns = getComputedStyle(el.querySelector('.face'), '::before').animationIterationCount;   // the gold rays turn twice, then rest
      step(30);
      const held = !!modal().querySelector('.jf-count.run');                // the tally waits for it
      el.querySelector('[data-wear]').click();
      for (let i = 0; i < 20 && document.querySelector('.jf-award'); i++) document.querySelector('.jf-award [data-next]').click();   // (other awards may come too)
      const gone = !document.querySelector('.jf-award');
      step(90);
      const tallied = !modal().querySelector('.jf-count.run');
      menus.close();
      return ok(shown && listed && held && turns === '2' && worn[0] === 'top:laurel' && gone && tallied, { shown, listed, held, turns, worn, gone, tallied, text: text.slice(0, 120) });
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
      const hints = [...modal().querySelectorAll('.jf-hint')].map((h) => h.textContent.trim());
      menus.close();
      return hints;
    };
    const act1 = end(1, 'dead'), act2 = end(2, 'dead'), act3 = end(3, 'dead'), won = end(1, 'won');
    const known = [...act1, ...act2].every((h) => DEATH_HINTS.includes(h) || TYPE_HINTS.includes(h));
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
    stub(run, 'telemetryDisabled', false);   // exercise collection explicitly; ordinary story URLs never upload
    step(1 / 60);                           // a real attempt begins with gameplay, not the loading/menu state
    rows.length = 0;                        // the assertions below concern its final act summary
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

story('payoff/act-complete-celebrates', {
  about: 'An act complete is a celebration: a gold stamp beside the "Act N complete" heading, a kit tile for each Treasure taken (×N when taken again) with the time, Level and bugs as chips, the score parts counting up under "Score so far", and one gold button on to the next act.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FEATS_KEY, PEARLS_KEY], () => {
      run.owned.add('bobbyPin'); run.owned.add('rubberDuck'); run.owned.add('rubberDuck');
      run.kills = 12; run.t = 125; run.level = 4;
      run.actComplete({ id: 2, subtitle: 'the bathroom' });
      const m = modal(), heading = m.querySelector('h2'), tiles = [...m.querySelectorAll('.jf-tiles .ui-tile')];
      const stamped = !!heading.querySelector('.jf-stamp svg') && /^Act 1 complete$/.test(heading.textContent.trim());
      const taken = tiles.length === 2 && tiles.some((t) => /×2/.test(t.textContent)) && tiles.every((t) => t.getAttribute('aria-label'));
      const chips = [...m.querySelectorAll('.jf-chips .ui-chip')].map((c) => c.textContent.trim()).join('|');
      const parts = /Score so far/.test(m.innerText) && /Bugs cleared/.test(m.innerText) && m.querySelectorAll('.jf-stats .jf-count').length > 2;
      const buttons = [...m.querySelectorAll('.btns button')], one = buttons.length === 1 && buttons[0].classList.contains('ui-btn--primary') && /On to act 2/.test(buttons[0].textContent);
      menus.close();
      return ok(stamped && taken && chips === '2:05|Level 4|12 bugs' && parts && one, { stamped, taken, chips, parts, one });
    });
  },
});

phone('death-screen-fits-a-phone-and-reads-on-the-sand', {
  about: 'On a phone held sideways, the death screen is a dark kit panel (so its words read over the pale sand) whose buttons are all on screen without scrolling: one gold Try again, and every other button a kit button with an icon.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    return withEmpty([FEATS_KEY, PEARLS_KEY], () => {
      stub(run, 'jellyFace', null);
      stub(run, 'board', { status: 'online', web: false, mine: null, localBest: null, keepBest: () => true, qualifies: () => false, cutoff: () => 1e6, note: () => '' });
      run.t = 200; run.phase = 'dead';
      run.driedOut.begin();
      run.endRun('You dried out', 'Back to a polyp.', 'Try again');
      step(30);
      const panel = modal().querySelector('.ui-panel'), bg = getComputedStyle(panel).backgroundColor.match(/[\d.]+/g).map(Number);
      const dark = (bg[3] ?? 1) >= 0.85 && Math.max(bg[0], bg[1], bg[2]) < 90;
      const buttons = [...modal().querySelectorAll('.btns button')], seen = buttons.every((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
      const gold = buttons.filter((b) => b.classList.contains('ui-btn--primary')), one = gold.length === 1 && /Try again/.test(gold[0].textContent);
      const icons = buttons.filter((b) => !gold.includes(b)).every((b) => b.querySelector('svg.ui-icon'));
      menus.close(); run.start();
      return ok(dark && seen && one && icons && buttons.length > 1, { bg, seen, one, icons, buttons: buttons.map((b) => b.textContent.trim()) });
    });
  },
});

story('payoff/win-panel-shows-the-run', {
  about: 'The win screen is a kit panel beside the jelly up close: a trophy icon (no emoji) and "You won!", the run\'s time, Level, bugs and Treasures, and a gold Continue that comes after a moment and brings up the score.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus } = G();
    run.kills = 30; run.t = 61; run.level = 5;
    let went = false;
    run.victory.begin(() => { went = true; });
    const el = document.querySelector('.jf-victory'), panel = el.querySelector('.ui-panel'), button = el.querySelector('button');
    const icon = !!panel.querySelector('h1 svg') && !/🏆/.test(el.innerText);
    const nums = [...panel.querySelectorAll('.ui-tile')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()).join('|');
    const waits = button.hidden;
    step(120);
    const gold = !button.hidden && button.classList.contains('ui-btn--primary');
    button.click();
    const closed = went && !document.querySelector('.jf-victory');
    run.victory.cancel(); menus.close();
    return ok(icon && /^1:01 Time\|5 Level\|30 Bugs\|\d+ Treasures$/.test(nums) && waits && gold && closed, { icon, nums, waits, gold, closed });
  },
});
