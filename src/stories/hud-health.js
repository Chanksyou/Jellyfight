import { juice } from '../juice.js';
import { G, fresh, offs, ok, roachAt, step, story } from './kit.js';

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

story('hud/minimap-marks-what-matters', {
  about: 'The minimap is a glass disc of room outlines that marks only what is worth going to, each in its own shape and the kit\'s colour: a chest (gold square), an Elite (hot diamond), the boss (hot dot), the way out (mint door). Bugs get no dots.',
  setup() { fresh({ elites: false }); },
  play() {
    const { hud, run, player } = G(), P = player.position, c = hud.map, g = c.getContext('2d');
    roachAt(0.2, -0.2); roachAt(-0.2, -0.3); step(2);
    const kinds = run.markers().map((m) => m.kind);
    hud.showMap(true);
    // pixels of exactly a mark's colour (marks are drawn solid), with and without that mark
    const count = (hex, markers) => {
      hud.update(P, 0, 0, markers);
      const [r, gr, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), d = g.getImageData(0, 0, c.width, c.width).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < 6 && Math.abs(d[i + 1] - gr) < 6 && Math.abs(d[i + 2] - b) < 6 && d[i + 3] > 250) n++;
      return n;
    };
    const drawn = Object.fromEntries(['treasure', 'elite', 'boss', 'exit'].map((kind) => {
      const hex = hud.mapLook[kind];
      return [kind, count(hex, [{ kind, x: P.x + 0.3, y: P.y, z: P.z - 0.3 }]) - count(hex, [])];
    }));
    const noBugs = !kinds.includes('enemy') && kinds.every((k) => ['treasure', 'elite', 'boss', 'exit'].includes(k));
    return ok(noBugs && Object.values(drawn).every((n) => n > 20) && drawn.boss !== drawn.elite, { kinds, drawn });
  },
});

story('hud/minimap-redraws-on-its-own-clock', {
  about: 'The minimap repaints at --map-fps, not every frame, but at once when a mark appears, moves or goes, and when it is shown or the window changes size; its canvas never draws past --map-max-dpr.',
  setup() { fresh({ elites: false }); },
  play() {
    const { hud, player } = G(), P = player.position, c = hud.map;
    hud.showMap(false); hud.showMap(true);
    let draws = 0; const was = hud.ctx.clearRect; hud.ctx.clearRect = function (...a) { draws++; return was.apply(this, a); };
    const frame = (markers = []) => hud.update(P, 0, 0, markers);
    try {
      frame(); const first = draws;                                                    // shown: drawn at once
      for (let i = 0; i < 20; i++) frame();                                            // the same instant: no repaint
      const held = draws - first;
      hud.mapAt -= 1000;                                                               // the clock runs out
      frame(); const ticked = draws - first - held;
      frame([{ kind: 'treasure', x: P.x + 0.3, y: P.y, z: P.z }]); const marked = draws - first - held - ticked;   // a mark appeared: at once
      frame([{ kind: 'treasure', x: P.x + 0.3, y: P.y, z: P.z }]); const same = draws - first - held - ticked - marked;
      frame([{ kind: 'treasure', x: P.x + 0.4, y: P.y, z: P.z }]); const moved = draws - first - held - ticked - marked - same;
      const before = draws; hud.fit(); frame(); const resized = draws - before;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const css = c.clientWidth * (hud.scale || 1), sharp = c.width <= Math.round(css * dpr) + 1;
      return ok(first === 1 && held === 0 && ticked === 1 && marked === 1 && same === 0 && moved === 1 && resized === 1 && sharp, { first, held, ticked, marked, same, moved, resized, size: [c.width, css] });
    } finally { hud.ctx.clearRect = was; }
  },
});

story('hud/reads-on-any-floor', {
  phone: true,
  about: 'On a phone the HUD\'s small words are at least 12 px (the night\'s time and boss, the Health number, a Treasure\'s count) and wear a dark outline; damage numbers are outlined too, the toast is the kit\'s toast, and the jump button is mint glass with the jump icon.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { hud, touch } = G();
    hud.setStage('12:01 AM · The Vacuum'); hud.setHealth(40, 50);
    hud.setItems([{ id: 'story', icon: '🍋<sub>×2</sub>', name: 'Lemon Slice', text: '' }]);
    hud.toast('A treasure chest appeared');
    const px = (sel) => parseFloat(getComputedStyle(hud.$(sel)).fontSize), outlined = (sel) => getComputedStyle(hud.$(sel)).textShadow !== 'none';
    const sizes = { stage: px('.stage'), health: px('.hpn'), count: px('.items sub') };
    const outline = outlined('.stage') && outlined('.hpn') && outlined('.clock');
    const layer = getComputedStyle(G().run.fx.layer), numbers = parseFloat(layer.getPropertyValue('-webkit-text-stroke-width')) >= 2 && layer.getPropertyValue('paint-order').startsWith('stroke');
    const toast = hud.$('.toast').classList.contains('ui-toast');
    const jump = touch.jumpBtn.querySelector('use')?.getAttribute('href') === '#ui-i-jump' && getComputedStyle(touch.jumpBtn).borderTopColor !== 'rgba(0, 0, 0, 0)';
    return ok(Object.values(sizes).every((s) => s >= 12) && outline && numbers && toast && jump, { sizes, outline, numbers, toast, jump });
  },
});

story('hud/motion-squash-pop-and-refill', {
  about: 'The HUD moves only by transform and opacity: a hit squashes the Health bar flat (scaleY) and it settles back, the liquid edge rides a track moved by translateX, a Treasure new to the row pops in while one taken again only bumps its count, and a level-up empties the XP bar quickly before it refills.',
  setup,
  async play() {
    const { hud: h } = G(), N = h.hpNodes;
    h.setHealth(100, 100); h.setHealth(60, 100);
    const kick = h.hpAnimations.kick, frames = kick?.effect.getKeyframes() || [];
    const squash = frames.length === 2 && /^scaleY\(0\.\d+\)$/.test(frames[0].transform) && frames.every((f) => Object.keys(f).every((k) => ['transform', 'offset', 'computedOffset', 'easing', 'composite'].includes(k)));
    const edge = N['hp-edge-track'].style.transform === 'translateX(60%)' && !N['hp-edge'].style.left;
    const T = (id, n) => ({ id, icon: n > 1 ? `🍋<sub>×${n}</sub>` : '🍋', name: id, text: '' });
    h.cache.items = undefined; h.itemCounts = undefined;
    h.setItems([T('a', 1)]);
    const first = !h.$('.items .pop');                                   // a row's first fill doesn't pop
    h.setItems([T('a', 1), T('b', 1)]);
    const popped = h.$('.items [data-id="b"]').classList.contains('pop') && !h.$('.items [data-id="a"]').classList.contains('pop');
    h.setItems([T('a', 2), T('b', 1)]);
    const bumped = !!h.$('.items [data-id="a"] sub.bump') && !h.$('.items [data-id="a"]').classList.contains('pop');
    const fill = h.$('.xp i');
    h.setXp(3, 90, 100); h.setXp(4, 10, 120);
    const emptied = fill.style.transform === 'scaleX(0)';
    await new Promise((r) => setTimeout(r, h.ui.fast + 40));
    const refilled = !h.xpRefill && !fill.style.transition && Math.abs(parseFloat(fill.style.transform.slice(7)) - h.xpFrac) < 1e-4;   // (the running game may have moved XP on meanwhile)
    return ok(squash && edge && first && popped && bumped && emptied && refilled, { squash, edge, first, popped, bumped, emptied, refilled });
  },
});
