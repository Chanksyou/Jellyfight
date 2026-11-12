// Stories: on a phone (played in a page that looks like a phone). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { G, firstMinute, fresh, bossFrame, ok, phone, sharkFight, step, tp } from './kit.js';

phone('held-stick-survives-treasure-pick', {
  about: 'A thumb held on the joystick keeps its gesture through a treasure pick. Gameplay pauses for the cards, then movement resumes without lifting; releasing during the pick stops movement. Pause still clears controls.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run, input } = G(), el = document.querySelector('#touch');
    const capture = el.setPointerCapture;
    el.setPointerCapture = () => {};
    const at = (type) => el.dispatchEvent(new PointerEvent(type, { pointerId: 71, clientX: 40, clientY: type === 'pointerdown' ? 300 : 240, bubbles: true }));
    step(1); at('pointerdown'); at('pointermove');
    run.pickTreasure();
    const before = run.t;
    step(2);
    const held = !el.hidden && input.moveAxes().y > .9 && run.t === before;
    run.ui.modal.querySelector('.jf-card').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', isPrimary: false, bubbles: true }));
    step(50);
    const resumed = !run.ui.open && input.moveAxes().y > .9 && run.t > before;
    run.pickTreasure(); step(1); at('pointerup');
    run.ui.modal.querySelector('.jf-card').click(); step(50);
    const released = input.moveAxes().y === 0;
    at('pointerdown'); at('pointermove');
    document.querySelector('#g-over').hidden = false; step(1);
    const paused = el.hidden && input.moveAxes().y === 0;
    document.querySelector('#g-over').hidden = true;
    el.setPointerCapture = capture;
    return ok(held && resumed && released && paused, { held, resumed, released, paused });
  },
});

phone('double-taps-cannot-zoom-the-page', {
  about: 'Browser zoom stays blocked during two-thumb play and in the pause menu; single-touch buttons and menu scrolling stay native, and the home menu retains deliberate pinch zoom.',
  setup() { fresh({ elites: false }); },
  play() {
    step(1);
    const action = (el) => getComputedStyle(el).touchAction;
    const root = document.documentElement, overlay = document.getElementById('g-over');
    const nativeTouchBlocked = (el, count = 1) => !el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true,
      touches: Array.from({ length: count }, (_, i) => new Touch({ identifier: i, target: el, clientX: 20 + i * 30, clientY: 20 })) }));
    const surface = document.getElementById('touch');
    const playing = action(root), canvas = action(document.getElementById('c')), controls = action(surface), blocked = nativeTouchBlocked(surface);
    overlay.hidden = false; step(1);
    const menu = action(overlay), menuBlocked = nativeTouchBlocked(overlay), pinchBlocked = nativeTouchBlocked(overlay, 2);
    overlay.classList.add('menu-home');
    const home = action(overlay), homeBlocked = nativeTouchBlocked(overlay, 2);
    overlay.classList.remove('menu-home');
    overlay.hidden = true; step(1);
    const resumed = action(root), resumedBlocked = nativeTouchBlocked(surface);
    return ok(playing === 'none' && menu === 'pan-y' && home === 'auto' && resumed === 'none' && canvas === 'none' && controls === 'none' && blocked && !menuBlocked && pinchBlocked && !homeBlocked && resumedBlocked,
      { playing, menu, home, resumed, canvas, controls, blocked, menuBlocked, pinchBlocked, homeBlocked, resumedBlocked });
  },
});

phone('camera-starts-at-0-6-metres', {
  about: 'Phones start at 0.595 m (15% closer than 0.7); desktop starts at 0.765 m and the outer zoom limit stays 0.9 m.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc } = G();
    step(1);
    return ok(tpc.distance === 0.595 && tpc.currentDistance === 0.595 && tpc.cfg.distance === 0.765 && tpc.cfg.maxDistance === 0.9, { distance: tpc.distance, rendered: tpc.currentDistance, desktop: tpc.cfg.distance, max: tpc.cfg.maxDistance });
  },
});

phone('held-upright-pauses-under-the-cover', {
  about: 'Phones play sideways only: held sideways nothing covers the game; turned upright mid-run, the game pauses and the turn-your-phone cover sits over everything. Under the cover the run holds still even with the pause menu gone (a level-up was up when it turned), and turning back takes the cover away.',
  setup() { fresh({ elites: false }); },
  play() {
    const { upright, run } = G(), over = document.getElementById('g-over'), cover = document.getElementById('g-turn');
    step(5);
    const sideways = !upright.on && getComputedStyle(cover).display === 'none' && over.hidden;
    upright.test = true; upright.update();                // the phone turned upright
    const paused = !over.hidden, shown = getComputedStyle(cover).display === 'flex';
    const z = +getComputedStyle(cover).zIndex, onTop = [...document.querySelectorAll('body *')].every((el) => el === cover || !(+getComputedStyle(el).zIndex > z));
    over.hidden = true;                                   // no pause menu over it
    const t = run.t; step(30);
    const still = run.t === t;
    upright.test = false; upright.update();               // turned back sideways
    const cleared = getComputedStyle(cover).display === 'none';
    upright.test = null; upright.update();
    return ok(sideways && paused && shown && onTop && still && cleared, { sideways, paused, shown, onTop, z, still, cleared });
  },
});

phone('leaving-the-game-pauses-it', {
  about: 'Switching to another app or locking the phone mid-run pauses the game, so coming back shows the pause menu instead of a fight already underway.',
  setup() { fresh({ elites: false }); },
  play() {
    const over = document.getElementById('g-over');
    step(5);
    const playing = over.hidden;
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });   // the player left
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    const paused = !over.hidden;
    return ok(playing && paused, { playing, paused });
  },
});

phone('iphone-home-screen-tip-hides-for-good', {
  about: 'The Add to Home Screen tip is for iPhones only (this page is not one), and its × hides it and remembers that.',
  setup() {},
  play() {
    const tip = document.querySelector('#g-over .home-tip'), notIphone = tip.hidden;
    tip.hidden = false;                                   // as an iPhone would show it
    tip.querySelector('button').click();
    let kept = null; try { kept = localStorage.getItem('jellyrun.homeTip'); localStorage.removeItem('jellyrun.homeTip'); } catch {}
    return ok(notIphone && tip.hidden && kept === 'off', { notIphone, hidden: tip.hidden, kept });
  },
});

// --- on a phone (tests/run.mjs plays these in a page that looks like a phone)
phone('shark-fight-keeps-the-boss-below-the-bar', {
  act: 3,
  about: 'On a phone (a short, wide screen) the shark fight view keeps the boss in frame below the boss bar and the toast that it wakes, with the jelly near the middle of the screen, not at its bottom edge.',
  setup() {},
  play() {
    const B = sharkFight();
    step(150);                                            // eased in
    const { tpc } = G(), view = bossFrame(B);
    return ok(view.good, { distance: +tpc.currentDistance.toFixed(3), pitch: +tpc.viewPitch.toFixed(3), ...view });
  },
});
phone('light-slots-follow-the-jelly', {
  about: 'A phone lights the room with 6 shared lights: the lamps lighting the jelly most fade into them as it swims across the room (and the far ones out), and no shader is rebuilt on the way.',
  setup() { fresh({ elites: false }); tp(4.2, 0.05, 3.5, 0); },
  play() {
    const { pacing, APT, GAME } = G(), S = pacing.lightSlots;
    const pointLights = () => { let n = 0; APT.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; };
    step(40); GAME.render();
    const best = () => [...S.lamps].sort((a, b) => b.score - a.score)[0].light;   // the lamp lighting the jelly most
    const east = best(), eastLit = S.lit().includes(east), eastSet = S.lit();
    const programs = APT.renderer.info.programs.length, lights = pointLights();
    const fading = [];
    for (let i = 0; i < 40; i++) {   // swim, not teleport: a few cm a frame
      G().player.position.x = 4.2 - (3.5 * i) / 40; G().player.position.z = 3.5 - (2.2 * i) / 40; GAME.step(1 / 60); }
    for (const s of S.slots) if (s.lamp && s.lamp.w > 0 && s.lamp.w < 1) fading.push(+s.lamp.w.toFixed(2));
    step(60); GAME.render();
    const west = best(), westLit = west !== east && S.lit().includes(west) && eastSet.some((l) => !S.lit().includes(l));
    // the light count never changed, so no shader was rebuilt for it (a rebuild would add ~100
    // programs; a new effect appearing on the way may add one)
    const same = APT.renderer.info.programs.length - programs < 5 && pointLights() === lights;
    return ok(S.slots.length === 6 && S.lit().length <= 6 && eastLit && westLit && fading.length > 0 && same,
      { slots: S.slots.length, lamps: S.lamps.length, lit: S.lit().length, eastLit, westLit, fading, programs, lights, nowPrograms: APT.renderer.info.programs.length });
  },
});
phone('glass-loses-its-clearcoat', {
  about: 'On a phone the apartment\'s glass (the coffee table and side table tops) is softened when the apartment loads: no clearcoat (a whole second specular lobe against every lamp) and roughness at least 0.15, look kept. Desktops keep the full glass.',
  setup() { fresh({ elites: false }); },
  play() {
    const { APT } = G();
    const softened = new Set();
    APT.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData?.softened) softened.add(m); });
    const mats = [...softened];
    return ok(mats.length >= 1 && mats.every((m) => m.clearcoat === 0 && m.roughness >= 0.15),
      { softened: mats.length, clearcoat: mats.map((m) => m.clearcoat), roughness: mats.map((m) => m.roughness) });
  },
});
phone('minimap-is-small', {
  about: 'On a phone the minimap is small (135 px across, a third of a landscape phone\'s height), tucked under the pause button on the right, and still drawn sharp; a desktop keeps its 285 px map.',
  setup() { fresh({ elites: false }); },
  play() {
    const { hud } = G(), map = hud.$('.map');
    hud.showMap(true); step(2);
    const r = map.getBoundingClientRect(), dpr = Math.min(3, devicePixelRatio || 1);
    const sharp = Math.abs(map.width - Math.round(map.clientWidth * dpr)) <= 1;
    document.body.classList.remove('touch');
    const desktop = map.clientWidth;
    document.body.classList.add('touch');
    return ok(r.width === 135 && r.height <= innerHeight * 0.36 && r.right <= innerWidth && sharp && desktop === 285,
      { size: [r.width, r.height], window: [innerWidth, innerHeight], sharp, canvas: map.width, desktop });
  },
});
phone('the-first-minute', {
  about: 'A player\'s first minute on a phone plays in the same order as on desktop: moving only, the Health hint, then the first Treasure with the minimap.',
  setup() {},
  play: firstMinute,
});
phone('graphics-reset-recovers', {
  about: 'When the graphics chip resets (iOS backgrounding), the game pauses with a note, rebuilds once the browser gives the GPU back, and draws again; no error panel.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { APT, GAME, gpu, gfx } = G();
    const ext = APT.renderer.getContext().getExtension('WEBGL_lose_context');
    const wait = (f, ms = 60000) => new Promise((res) => { const t0 = performance.now(); const tick = () => (f() || performance.now() - t0 > ms ? res(f()) : setTimeout(tick, 50)); tick(); });
    const before = gpu.restores;
    ext.loseContext();
    const lost = await wait(() => gpu.lost, 5000);
    const note = document.querySelector('.gpu-note'), noteShown = !note.hidden;
    const paused = !document.querySelector('#g-over').hidden;
    ext.restoreContext();
    const back = await wait(() => gpu.restores > before);
    document.querySelector('#g-over').hidden = true;
    step(5); GAME.render();
    const drew = gfx.frameInfo.calls > 0;
    const panel = [...document.querySelectorAll('.jf-keep')].some((e) => /⚠/.test(e.textContent));
    return ok(lost && noteShown && paused && back && note.hidden && drew && !panel, { lost, noteShown, paused, back, noteHidden: note.hidden, drew, calls: gfx.frameInfo.calls, panel });
  },
});

phone('text-cannot-be-selected', {
  about: 'A held or double tap on a phone never selects text or pops the copy bubble: the menus, the HUD and the page turn selection and the touch callout off, and only boxes you type in (the feedback box, a name) keep them.',
  setup() { fresh({ elites: false }); },
  play() {
    step(1);
    const css = (el) => { const s = getComputedStyle(el); return [s.userSelect || s.webkitUserSelect, s.webkitTouchCallout]; };
    const box = document.createElement('textarea'), field = document.createElement('input');
    document.querySelector('#g-over').append(box, field);
    const page = [document.body, document.querySelector('#g-over h1'), document.querySelector('#g-over .menu-loop'), document.querySelector('#hud') || document.body].map(css);
    const typing = [box, field].map(css);
    box.remove(); field.remove();
    const locked = page.every(([sel, callout]) => sel === 'none' && (callout === undefined || callout === 'none'));
    const typable = typing.every(([sel]) => sel !== 'none');
    return ok(locked && typable, { page, typing });
  },
});

phone('frame-rate-cool-by-default', {
  about: 'Phones draw at most 30 frames a second unless the player picks 60 under Frame rate in the menu (a phone that keeps up at 60 runs hot, then throttles); the pick is remembered and the sharpness governor aims for it.',
  setup() { fresh({ elites: false }); },
  play() {
    const { pacer, governor } = window.pacing;
    let stored = null; try { stored = localStorage.getItem('jellyrun.fps'); localStorage.removeItem('jellyrun.fps'); } catch {}
    const cool = pacer.fps === 30 || stored === '60';
    const btn = (f) => document.querySelector(`#g-quality [data-fps="${f}"]`);
    const offered = !!btn(30) && !!btn(60);
    btn(60)?.click();
    let kept = null; try { kept = localStorage.getItem('jellyrun.fps'); } catch {}
    const smooth = pacer.fps === 60 && Math.round(governor.target) === 17 && kept === '60' && btn(60)?.classList.contains('on');
    btn(30)?.click();
    const back = pacer.fps === 30 && Math.round(governor.target) === 33 && btn(30)?.classList.contains('on');
    try { if (stored) localStorage.setItem('jellyrun.fps', stored); else localStorage.removeItem('jellyrun.fps'); } catch {}
    if (stored) { pacer.fps = +stored; governor.base = governor.target = 1000 / +stored; }
    return ok(cool && offered && smooth && back, { cool, fps: pacer.fps, offered, smooth, back, kept });
  },
});

phone('camera-turn-hint-until-first-drag', {
  about: 'A phone that has never turned the camera shows a dashed hint on the right with a finger sweeping across it, and the camera turns along with its first two sweeps, ending where it started. A right-side drag hides it for good; an act that ends with no turn brings it back in the next act.',
  setup() { fresh({ elites: false }); },
  play() {
    const { touch, tpc } = G(), el = document.querySelector('#touch'), hint = el.querySelector('.turn');
    const was = localStorage.getItem('jellyrun.turned');
    const act = () => { touch.turnHint = null; step(1); return !hint.classList.contains('off'); };   // a new act's page
    localStorage.removeItem('jellyrun.turned');
    const newPlayer = act();
    const yaw0 = tpc.yaw; let swing = 0;
    step(60 * 5, () => { swing = Math.max(swing, Math.abs(tpc.yaw - yaw0)); });
    const demo = swing > 0.1, settled = Math.abs(tpc.yaw - yaw0) < 0.02;
    const y1 = tpc.yaw; step(60 * 6); const restStill = Math.abs(tpc.yaw - y1) < 1e-6;   // later loops: the finger only
    const capture = el.setPointerCapture; el.setPointerCapture = () => {};
    const x = innerWidth * 0.75, at = (type, dx) => el.dispatchEvent(new PointerEvent(type, { pointerId: 72, clientX: x + dx, clientY: 200, bubbles: true }));
    at('pointerdown', 0); at('pointermove', 20); at('pointermove', 60); at('pointerup', 60);
    el.setPointerCapture = capture;
    const hidden = hint.classList.contains('off') && localStorage.getItem('jellyrun.turned') === '1';
    const keptHidden = !act() && localStorage.getItem('jellyrun.turned') === 'act';   // turned last act: no hint, but this act checks
    const back = act();                                                              // that act ended with no turn
    if (was === null) localStorage.removeItem('jellyrun.turned'); else localStorage.setItem('jellyrun.turned', was);
    touch.setTurnHint(false);
    return ok(newPlayer && demo && settled && restStill && hidden && keptHidden && back,
      { newPlayer, swing: +swing.toFixed(3), settled, restStill, hidden, keptHidden, back });
  },
});
