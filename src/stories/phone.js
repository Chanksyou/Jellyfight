// Stories: on a phone (played in a page that looks like a phone). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { G, firstMinute, fresh, bossFrame, ok, phone, sharkFight, step, tp } from './kit.js';

phone('camera-starts-at-0-7-metres', {
  about: 'Phones start at 0.7 m; desktop still starts at 0.9 m and the outer zoom limit stays 0.9 m.',
  setup() { fresh({ elites: false }); },
  play() {
    const { tpc } = G();
    step(1);
    return ok(tpc.distance === 0.7 && tpc.currentDistance === 0.7 && tpc.cfg.distance === 0.9 && tpc.cfg.maxDistance === 0.9, { distance: tpc.distance, rendered: tpc.currentDistance, desktop: tpc.cfg.distance, max: tpc.cfg.maxDistance });
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
  about: 'A player\'s first minute on a phone plays in the same order as on desktop: moving only, the Health hint, the first card, the Element pick, then the first Treasure with the minimap.',
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
