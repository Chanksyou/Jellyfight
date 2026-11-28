// Stories: Treasures that got a body of their own so they stop looking like others (src/house-gadgets.js):
// the Fly Swatter, Bath Bomb geyser, Ice Cube puddle, Disco Ball spotlight, the Whale's spout on
// landing and the Night-Light's safe glow. Shared helpers are in ./kit.js.
import { bus } from '../events.js';
import { G, dmgBy, give, near, ok, record, roachAt, setupFight, spawn, spy, step, story } from './kit.js';

story('treasures/swatter', {
  about: 'swatter (Fly Swatter, every 6 s): the swatter slaps the nearest flying bug (a mosquito, though a roach is nearer) for 3x Attack damage and Stuns it 1 s; with no flyer close it swats the nearest bug for 2x. The swatter shows before the hit lands.',
  setup() { setupFight({ bubbles: false, lash: false }); give('flySwatter'); roachAt(0.06, 0); spawn('mosquito', near(-0.15, 0, 0.05), { still: true, hp: 9999 }); },
  play() {
    const { run, enemies } = G(), [roach, mosq] = enemies.list, log = record('damage_taken'), st = record('status_applied'), H = run.gadgets.house;
    let shown = false;
    step(60 * 7, () => { shown ||= H.swatter.visible && !dmgBy(log, 'swatter').length; return dmgBy(log, 'swatter').length > 0; });
    const first = dmgBy(log, 'swatter')[0], stun = st.find((s) => s.targetId === mosq.id && s.status === 'stun');
    mosq.hp = 0; mosq.dead = true;   // the flyer gone: the next swat takes the roach
    step(60 * 7, () => dmgBy(log, 'swatter').length > 1);
    const second = dmgBy(log, 'swatter')[1];
    return ok(shown && first?.targetId === mosq.id && Math.abs(first.amount - run.power * 3) < 1e-6 && stun?.duration === 1
      && second?.targetId === roach.id && Math.abs(second.amount - run.power * 2) < 1e-6,
      { shown, first: first && [first.targetId === mosq.id ? 'mosquito' : 'roach', first.amount], second: second && [second.targetId === roach.id ? 'roach' : '?', second.amount], power: run.power, stun });
  },
});

story('treasures/geyser', {
  about: 'geyser (Bath Bomb, every 6 s): a bath bomb is lobbed onto the biggest crowd (three bugs together, not the lone one nearer), fizzes for 0.6 s showing its reach, then erupts: each bug in it takes 3.6x Attack damage (2x power), is thrown up off the floor and Stunned until it lands; the lone bug is untouched.',
  setup() { setupFight({ bubbles: false, lash: false }); give('bathBomb'); roachAt(0.1, 0); for (const [x, z] of [[-0.25, 0], [-0.27, 0.03], [-0.23, -0.03]]) roachAt(x, z); },
  play() {
    const { run, enemies } = G(), [lone, ...crowd] = enemies.list, log = record('damage_taken'), H = run.gadgets.house;
    const floor = crowd[0].pos.y;
    let lobbed = 0, disc = false;
    step(60 * 8, () => { if (H.bombs.length) { lobbed = 1; disc ||= H.bombs[0].disc.visible; } return dmgBy(log, 'geyser').length > 0; });
    const hits = dmgBy(log, 'geyser'), ids = hits.map((d) => d.targetId);
    let peak = 0; step(20, () => { peak = Math.max(peak, crowd[0].pos.y - floor); });
    return ok(lobbed && disc && hits.length === 3 && crowd.every((e) => ids.includes(e.id)) && !ids.includes(lone.id) && hits.every((d) => Math.abs(d.amount - run.power * 2) < 1e-6) && peak > 0.02 && crowd[0].stunT > 0,
      { lobbed, disc, hits: hits.length, lone: ids.includes(lone.id), peak: +peak.toFixed(3), stun: crowd[0].stunT });
  },
});

story('treasures/puddle', {
  about: 'puddle (Ice Cube, every 6 s): an ice cube melts into a puddle at your feet; a bug walking onto it skids and is Stunned 0.5 s (once a puddle); you swim 25% faster while on it (while "wet") and not off it. No frost, no slow.',
  setup() { setupFight({ bubbles: false, lash: false }); give('iceCube'); },
  play() {
    const { run, enemies, player } = G(), H = run.gadgets.house, st = record('status_applied'), speed0 = run.S.moveSpeed;
    step(60 * 6, () => H.puddles.length > 0);
    step(30);   // spread out
    const wet = H.wetNow, wetSpeed = run.S.moveSpeed;
    const bug = spawn('roach', near(0.05, 0), { hp: 9999 });   // a walker on the puddle
    step(10);
    const stuns = st.filter((s) => s.targetId === bug.id && s.status === 'stun');
    step(60);
    const once = st.filter((s) => s.targetId === bug.id && s.status === 'stun').length;
    player.position.x += 0.5; step(2);
    const dry = !H.wetNow && Math.abs(run.S.moveSpeed - speed0) < 1e-6;
    const frosty = st.some((s) => s.status === 'slow' || s.status === 'chill');
    return ok(wet && Math.abs(wetSpeed - speed0 * 1.25) < 1e-6 && stuns.length === 1 && stuns[0].duration === 0.5 && once === 1 && dry && !frosty && enemies.list.length === 1,
      { wet, speed0, wetSpeed, stuns: stuns.length, once, dry, frosty });
  },
});

story('treasures/spotlight', {
  about: 'spotlight (Disco Ball): the spotlight picks the toughest bug close by (the 500-Health one, not the nearer 50) and for 4 s everything you do hurts it twice as much; the other bug takes plain damage. Once the tough one is out of range the next pick is the other bug, and the first takes plain damage again.',
  setup() { setupFight({ bubbles: false, lash: false }); give('discoBall'); roachAt(0.06, 0, { still: true, hp: 50 }); roachAt(-0.2, 0, { still: true, hp: 500 }); },
  play() {
    const { run, enemies } = G(), [weak, tough] = enemies.list, H = run.gadgets.house;
    step(60, () => !!H.spot);
    const picked = H.spot?.e === tough, cone = H.cone.visible;
    const hit = (e) => { const hp = e.hp; bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'story' }); return hp - e.hp; };
    const lit = hit(tough), plain = hit(weak);
    tough.pos.x += 1;   // out of the spotlight's reach
    step(60 * 4.2);
    const after = hit(tough);
    const next = H.spot?.e === weak;
    return ok(picked && cone && next && Math.abs(lit - 20) < 1e-6 && Math.abs(plain - 10) < 1e-6 && Math.abs(after - 10) < 1e-6, { picked, cone, next, lit, plain, after });
  },
});

story('treasures/land-heal', {
  about: 'land-heal (Whale Bath Toy): landing from a jump spouts water and gives back 1.5 Health, at most once every 4 s; standing still heals nothing.',
  setup() { setupFight({ bubbles: false, lash: false }); give('whale'); G().run.health = 10; },
  play() {
    const { run, player } = G(), spouts = spy(run.gadgets.looks, 'spout');
    step(60 * 3);
    const still = run.health;
    player.onLand(0.1); const one = run.health;
    player.onLand(0.1); const soon = run.health;
    step(60 * 4.1); player.onLand(0.1); const later = run.health;
    player.onLand(0.01);   // a step down, not a jump
    return ok(still === 10 && one === 11.5 && soon === 11.5 && later === 13 && spouts.length === 2, { still, one, soon, later, spouts: spouts.length });
  },
});

story('treasures/night-light-safe', {
  about: 'night-light safe=#true (Night-Light): a Level-up plugs in a night-light; a roach chasing you stops at the edge of its glow and doesn\'t come in, and you get no stat from standing in it.',
  setup() { setupFight({ lash: false, bubbles: false, levels: true }); give('nightLight'); },
  play() {
    const { run, player } = G(), rate0 = run.S.fireRate, regen0 = run.S.regen;
    run.pendingLevels = 1; run.levelUp(); run.ui.close();
    step(2);
    const lamp = run.gadgets.lamps[0].g.position, r = run.gadgets.lamps[0].r;
    const bug = spawn('roach', near(0.6, 0), { hp: 9999 });
    let closest = 9;
    step(60 * 5, () => { closest = Math.min(closest, Math.hypot(bug.pos.x - lamp.x, bug.pos.z - lamp.z)); });
    return ok(closest >= r + bug.r - 0.005 && closest < r + bug.r + 0.03 && run.S.fireRate === rate0 && run.S.regen === regen0 && run.gadgets.lit,
      { closest: +closest.toFixed(3), r, rate: run.S.fireRate, rate0, player: player.position.x });
  },
});
