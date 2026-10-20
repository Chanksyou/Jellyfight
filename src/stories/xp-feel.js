import { juice } from '../juice.js';
import { sfx } from '../sfx.js';
import { G, near, ok, phone, record, setupFight, step, story, stub } from './kit.js';

const setup = () => { setupFight({ bubbles: false, lash: false }); step(120); };

story('pickups/xp-gold-palette', {
  about: 'Both XP sizes and their collection flash use gold; Health crumbs keep their peach color.',
  setup,
  play() {
    const { xpDrops, run, fx } = G(), flashes = [];
    xpDrops.drop(near(0.3, 0, 0), 1, 6);
    const small = xpDrops.list.find(d => !d.big), big = xpDrops.list.find(d => d.big);
    const colors = [small.m.material.color, small.m.material.emissive, big.m.material.color, big.m.material.emissive].map(c => c.getHexString());
    stub(xpDrops, 'update', () => 1);
    stub(fx.glow, 'emit', (_pos, color) => flashes.push(color.getHexString()));
    step(1);
    const crumb = run.crumbs.mat.color.getHexString();
    return ok(colors.join() === 'ffd25a,e8a21b,ffe27a,ffc43a' && flashes.includes('ffe27a') && crumb === 'ffb47a', { colors, flashes, crumb });
  },
});

story('pickups/xp-elastic-path-keeps-timing', {
  about: 'The XP bend and stretch are visual only: each logical position, collection frame and total matches the original straight magnet movement.',
  setup,
  play() {
    const { xpDrops, player } = G(), target = player.position.clone().setY(player.position.y + 0.04);
    xpDrops.drop(target.clone().add({ x: 0.08, y: 0, z: 0 }), 1, 12);
    const refs = xpDrops.list.map(d => ({ source: d, pos: d.pos.clone(), t: 0, value: d.value, done: false }));
    let got = 0, expected = 0, same = true, curved = false, stretched = false;
    for (let frame = 0; frame < 120; frame++) {
      let want = 0;
      for (const r of refs) {
        if (r.done) continue;
        r.t += 1 / 60; const dist = r.pos.distanceTo(target);
        r.pos.addScaledVector(target.clone().sub(r.pos).normalize(), Math.min(dist, (0.25 + r.t * 0.4) / 60));
        if (dist < 0.012) { want += r.value; r.done = true; }
      }
      const collected = xpDrops.update(1 / 60, target);
      got += collected; expected += want; same &&= collected === want;
      same &&= refs.every(r => r.source.pos.distanceToSquared(r.pos) < 1e-20);
      for (const d of xpDrops.list) {
        curved ||= d.m.position.distanceTo(d.pos) > 0.0001;
        stretched ||= d.m.scale.y > d.m.scale.x;
      }
    }
    return ok(same && curved && stretched && got === 12 && expected === got && !xpDrops.list.length, { same, curved, stretched, got, expected });
  },
});

story('pickups/xp-chime-chain-and-reset', {
  about: 'Collection has its own bounded ascending chime chain, grouped glow and HUD pulses; a gap and a restart reset it without changing XP awards.',
  setup,
  play() {
    const { run, xpDrops, fx, hud } = G(), sounds = [], events = record('xp_collected');
    let amount = 1, glows = 0;
    stub(xpDrops, 'update', () => amount);
    stub(sfx, 'xp', (chain, big) => sounds.push({ chain, big }));
    stub(fx.glow, 'emit', () => glows++);
    const purse = run.purse; juice.combo = 99;
    step(120);
    const total = run.purse - purse, bounded = sounds.length <= 27 && sounds.length > 10 && glows === sounds.length && events.length === sounds.length;
    const rising = sounds[0].chain === 0 && sounds.some(s => s.chain === 10) && sounds.every(s => s.chain <= 10);
    amount = 0; step(50); amount = 5; step(1);
    const reset = sounds.at(-1).chain === 0 && sounds.at(-1).big && run.purse - purse === 125;
    run.start();
    return ok(total === 120 && bounded && rising && reset && run.xpChain === 0 && !hud.xpAnimation,
      { total, bounded, rising, reset, sounds: sounds.length, glows });
  },
});

story('pickups/xp-crowd-and-reduced-effects', {
  about: 'A large vacuum keeps the existing 220-drop cap and exact XP; reduced effects removes bend, stretch and HUD bounce while Health crumbs retain their original look.',
  setup,
  play() {
    const { run, xpDrops, hud, player } = G(), calm = juice.calm;
    try {
      juice.calm = true;
      const target = player.position.clone().setY(player.position.y + 0.04), at = target.clone(); at.x += 0.3;
      xpDrops.drop(at, 1, 1200); const cap = xpDrops.list.length;
      let got = 0, quiet = true;
      for (let i = 0; i < 240; i++) {
        xpDrops.magnetAll = true; got += xpDrops.update(1 / 60, target);
        quiet &&= xpDrops.list.every(d => d.m.position.equals(d.pos) && d.m.scale.x === d.m.scale.y);
      }
      hud.pulseXp(5);
      run.crumbs.drop(target.clone().add({ x: 0.05, y: 0, z: 0 }), 1); run.crumbs.update(1 / 60, target);
      const crumb = run.crumbs.list[0], unchanged = crumb.m.position.equals(crumb.pos) && crumb.m.scale.x === crumb.m.scale.y;
      return ok(cap === 220 && got === 1200 && quiet && !hud.xpAnimation && unchanged, { cap, got, quiet, unchanged });
    } finally { juice.calm = calm; }
  },
});

phone('xp-feedback', {
  about: 'XP feedback fits the phone HUD, exposes its actual progress and adds a bounded pulse without moving the health bar or adding numbers over the jelly.',
  setup,
  play() {
    const { hud, run, xpDrops } = G();
    xpDrops.drop(near(0.04, 0, 0.04), 1, 5); step(40);
    const bar = hud.$('.xp'), r = bar.getBoundingClientRect();
    const accessible = bar.getAttribute('role') === 'progressbar' && Number(bar.getAttribute('aria-valuenow')) === run.xp;
    const animated = !!hud.xpAnimation && hud.xpAnimation.effect.getTiming().duration === 180;
    return ok(accessible && animated && r.left >= 0 && r.right <= innerWidth && !xpDrops.list.length, { accessible, animated, width: r.width, left: xpDrops.list.length });
  },
});
