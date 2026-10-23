import { juice } from '../juice.js';
import { G, fresh, offs, ok, step, story } from './kit.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function setup() { fresh({ bubbles: false, lash: false, elites: false }); G().hud.resetHealth(); }

story('hud/player-health-damage-and-trail', {
  about: 'Player HP drops immediately, rapid hits share one number, and quiet regeneration preserves the bounded damage trail; other HP bars stay unchanged.',
  setup,
  async play() {
    const { hud: h } = G(), N = h.hpNodes;
    h.setBoss('Test', 0.7); h.setElite('Test', 0.6);
    const boss = h.$('.boss').innerHTML, elite = h.$('.elite').innerHTML;
    h.setHealth(100, 100); h.setHealth(80, 100);
    const timer = h.hpTrailTimer;
    h.setHealth(65, 100);
    const immediate = N['hp-fill'].style.transform === 'scaleX(0.65)' && N['hp-fill'].style.transitionDuration === '0ms';
    const combined = N['hp-delta'].textContent === '−35' && h.hpGroup.total === 35;
    h.setHealth(65.1, 100, { heal: false });
    const retained = timer === h.hpTrailTimer && h.hpTrailFrac === 1;
    await wait(h.hpLook.hold + 30);
    const drained = !h.hpTrailTimer && Math.abs(h.hpTrailFrac - 0.651) < 1e-6;
    const untouched = h.$('.boss').innerHTML === boss && h.$('.elite').innerHTML === elite;
    return ok(immediate && combined && retained && drained && untouched, { immediate, combined, retained, drained, untouched });
  },
});

story('hud/player-health-phone-layout', {
  about: 'The player health label, liquid edge and single damage number fit the phone HUD without changing the boss or elite bars.',
  phone: true,
  setup,
  play() {
    const { hud: h } = G();
    h.setHealth(100, 100); h.setHealth(70, 100);
    const bar = h.hpNodes['player-health'].getBoundingClientRect(), number = h.hpNodes['hp-delta'].getBoundingClientRect();
    return ok(bar.left >= 0 && number.right <= innerWidth && h.hpNodes.moist.clientHeight >= 15 && number.width > 0,
      { bar: [bar.x, bar.y, bar.width, bar.height], number: [number.x, number.y, number.width, number.height], screen: [innerWidth, innerHeight] });
  },
});

story('hud/player-health-healing-and-regen', {
  about: 'Regeneration remains quiet, deliberate healing has a grouped positive number, overheal adds no feedback, and the real run forwards the distinction.',
  setup,
  play() {
    const { hud: h, run } = G(), N = h.hpNodes;
    run.health = 10; run.stats.regen = 1; run.refreshHud();
    step(10);
    const quiet = run.health > 10 && N['hp-delta'].hidden;
    run.heal(5); run.refreshHud();
    const pickup = !N['hp-delta'].hidden && N['hp-delta'].classList.contains('heal') && h.hpGroup.total === 5;
    run.refreshHud();
    const smooth = N['hp-fill'].style.transitionDuration === h.hpLook.recoil + 'ms';
    run.heal(1000); run.refreshHud();
    const actual = h.hpGroup.total, at = h.hpLastHeal;
    run.heal(1000); run.refreshHud();
    const overheal = h.hpGroup.total === actual && h.hpLastHeal === at && run.health === run.S.health;
    return ok(quiet && pickup && smooth && overheal, { quiet, pickup, smooth, overheal, actual });
  },
});

story('hud/player-health-reset-and-capacity', {
  about: 'Starting a run or changing capacity clears old feedback instead of inventing damage/healing; a subsequent hit still exposes the correct recent-health segment.',
  setup,
  async play() {
    const { hud: h, run } = G(), N = h.hpNodes;
    h.setHealth(100, 100); h.setHealth(20, 100);
    h.setHealth(40, 200);
    const capacity = N['hp-delta'].hidden && !h.hpTrailTimer && N['hp-fill'].style.transform === 'scaleX(0.2)';
    run.start(); run.refreshHud();
    await wait(h.hpLook.hold + 30);
    const reset = N['hp-delta'].hidden && !h.hpTrailTimer && N['hp-fill'].style.transform === 'scaleX(1)' && h.hpTrailFrac === 1;
    h.setHealth(50, 100); // capacity change: initialize quietly
    h.setHealth(90, 100, { heal: false }); h.setHealth(80, 100);
    const recent = h.hpTrailFrac === 0.9;
    return ok(capacity && reset && recent, { capacity, reset, recent });
  },
});

story('hud/player-health-reduce-effects', {
  about: 'Reduce Effects removes player HP wobble/pulsing while retaining true HP, the loss number, trail and low-health icon.',
  setup,
  play() {
    const { hud: h } = G(), N = h.hpNodes, before = juice.calm, had = document.body.classList.contains('calm');
    juice.calm = true; document.body.classList.add('calm');
    offs.push(() => { juice.calm = before; document.body.classList.toggle('calm', had); });
    h.setHealth(100, 100); h.setHealth(20, 100);
    const motion = Object.values(h.hpAnimations).some(a => a.playState === 'running');
    const pulse = getComputedStyle(N.moist).animationName;
    const info = N['hp-fill'].style.transform === 'scaleX(0.2)' && !N['hp-delta'].hidden && getComputedStyle(h.$('.hp-warning')).display !== 'none';
    const semantic = N['player-health'].getAttribute('aria-valuenow') === '20' && N['player-health'].getAttribute('aria-valuemax') === '100';
    return ok(!motion && pulse === 'none' && info && semantic, { motion, pulse, info, semantic });
  },
});

story('hud/scales-with-the-window', {
  about: 'The HUD grows and shrinks with the window: one zoom from the window against the base size (look.css --hud-base-*), within --hud-scale-min/max, and the minimap is drawn at its zoomed size so it stays sharp; phones (body.touch) keep their own layout at 1.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { hud } = G(), want = Math.round(Math.min(1.75, Math.max(0.85, Math.min(innerWidth / 1600, innerHeight / 900))) * 100) / 100;
    hud.fit(); step(2);
    const scale = hud.scale, zoom = +(hud.el.style.zoom || 1), map = hud.$('.map');
    const sharp = Math.abs(map.width - Math.round(map.clientWidth * scale * Math.min(3, devicePixelRatio || 1))) <= 1;
    document.body.classList.add('touch'); hud.fit();
    const phone = hud.scale === 1 && !hud.el.style.zoom;
    document.body.classList.remove('touch'); hud.fit();
    return ok(scale === want && zoom === scale && sharp && phone, { scale, want, zoom, map: [map.width, map.clientWidth], phone, window: [innerWidth, innerHeight] });
  },
});
