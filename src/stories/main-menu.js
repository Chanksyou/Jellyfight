// Menu presentation must never move the actual player or replay when resuming a run.
import { story, phone, G, fresh, ok, step, stub, give } from './kit.js';
import { isMuted, setMuted } from '../sfx.js';
import { SPECIES } from '../character.js';
import { moveSaves, forwardFor, takeSaves, HOME } from '../rename.js';

const gameplaySummary = {
  about: 'How to play starts closed, toggles the gameplay summary before Play, fits its text column, and hides when paused.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    try {
      menu.show(); over.hidden = false; step(1);
      const summary = over.querySelector('.menu-loop'), play = over.querySelector('.play');
      const help = summary.closest('details'), toggle = help.querySelector('summary');
      const icon = toggle.querySelector('.menu-help-icon');
      const closed = !help.open && !summary.checkVisibility() && toggle.textContent.trim() === 'How to play' && icon?.getAttribute('aria-hidden') === 'true';
      toggle.click();
      const text = summary.textContent;
      const loop = ['dodge', 'automatically', 'XP', 'upgrades', 'Treasures', 'countdown', 'Boss', 'next act'].every(word => text.includes(word));
      const r = summary.getBoundingClientRect(), button = play.getBoundingClientRect();
      const fits = r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= button.top && summary.scrollWidth <= summary.clientWidth;
      toggle.click();
      const toggles = !help.open && !summary.checkVisibility();
      over.classList.remove('menu-home');
      const paused = getComputedStyle(help).display === 'none';
      return ok(closed && loop && fits && toggles && paused, { closed, loop, fits, toggles, paused });
    } finally {
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
};
story('menu/gameplay-summary', gameplaySummary);
story('menu/portrait-gameplay-summary', { ...gameplaySummary, portrait: true });
phone('gameplay-summary', gameplaySummary);

story('menu/portrait-controls-centered', {
  about: 'In a tall desktop window, the title, Play button, and the row of tiles share the viewport center.',
  portrait: true,
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    try {
      menu.show(); over.hidden = false; step(1);
      const center = selector => { const r = over.querySelector(selector).getBoundingClientRect(); return r.x + r.width / 2; };
      const centers = ['h1', '.play', '.menu-tiles'].map(center);
      return ok(innerWidth < innerHeight && centers.every(x => Math.abs(x - innerWidth / 2) < 1), { width: innerWidth, centers });
    } finally {
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
});

story('menu/underwater-restoration', {
  about: 'The underwater title shows the jelly and its lights, excludes apartment scenery, freezes water under Reduce Effects, and restores render layers when Play finishes.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu, player, APT } = G();
    menu.restore();
    const mask = menu.camera.layers.mask, avatarMask = player.avatar.root.layers.mask;
    stub(menu, 'calm', () => true);
    try {
      menu.show(); menu.overlay.hidden = false; step(1);
      const time = menu.water.material.uniforms.time.value;
      const portrait = menu.camera.layers.test(player.avatar.root.layers) && !menu.camera.layers.test(APT.root.layers);
      step(30);
      const frozen = menu.water.material.uniforms.time.value === time;
      menu.launch();
      const restored = menu.camera.layers.mask === mask && player.avatar.root.layers.mask === avatarMask;
      return ok(portrait && frozen && restored, { portrait, frozen, restored });
    } finally {
      menu.restore(); menu.home = false; menu.overlay.classList.remove('menu-home'); menu.overlay.hidden = true;
    }
  },
});

story('menu/change-your-look', {
  about: 'The Change your look tile on the title opens customization without poking the jelly.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    let pokes = 0;
    stub(menu, 'onPoke', () => pokes++);
    try {
      menu.show(); over.hidden = false; step(1);
      const button = over.querySelector('.menu-tiles [data-act="creator"]');
      const visible = button.getClientRects().length > 0;
      const label = button.textContent === 'Change your look';
      button.click();
      const opened = !document.querySelector('#creator').hidden && over.hidden;
      document.querySelector('#creator [data-act="done"]').click();
      return ok(visible && label && opened && pokes === 0, { visible, label, opened, pokes });
    } finally {
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
});

const customizeWater = {
  about: 'Customization reuses the home water and excludes apartment scenery. Every jelly rebuild remains visible; Reduce Effects freezes the water, and Done and Escape restore scene layers.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu, player, APT } = G(), over = menu.overlay;
    const oldBody = player.avatar.look.body, checked = [], distances = [];
    const position = player.position.clone();
    let calm = false;
    stub(menu, 'calm', () => calm);
    menu.restore(); const mask = menu.camera.layers.mask;
    const open = () => { over.hidden = false; over.querySelector('[data-act="creator"]').click(); step(1); };
    try {
      menu.show(); over.hidden = false; step(1);
      const water = menu.water, time = water.material.uniforms.time.value;
      open();
      const shared = menu.water === water && water.mesh.visible && water.material.uniforms.time.value > time;
      for (const body of Object.keys(SPECIES)) {
        document.querySelector(`#creator [data-k="body"][data-v="${body}"]`).click(); step(1);
        checked.push(menu.camera.layers.test(player.avatar.root.layers) && !menu.camera.layers.test(APT.root.layers));
        distances.push(Math.hypot(menu.camera.position.x - player.position.x, menu.camera.position.z - player.position.z) / player.avatar.look.size);
      }
      calm = true; const held = water.material.uniforms.time.value; step(30);
      const frozen = water.material.uniforms.time.value === held;
      document.querySelector('#creator [data-act="done"]').click();
      const done = !water.mesh.visible && menu.camera.layers.mask === mask && player.avatar.root.layers.mask === 1;
      open(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      const escaped = !water.mesh.visible && menu.camera.layers.mask === mask && document.querySelector('#creator').hidden;
      const enlarged = distances.every(d => d < 0.27) && player.position.equals(position);
      return ok(shared && checked.every(Boolean) && enlarged && frozen && done && escaped, { shared, checked, distances, enlarged, frozen, done, escaped });
    } finally {
      if (document.querySelector('#creator').hidden) open();
      document.querySelector(`#creator button[data-k="body"][data-v="${oldBody}"]`).click();
      document.querySelector('#creator [data-act="done"]').click();
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
};
story('menu/customize-underwater-background', customizeWater);
phone('customize-underwater-background', customizeWater);

story('menu/living-jelly', {
  about: 'Poking the title jelly stays bounded, changes no gameplay position, and returns its model and camera when Play finishes. Pause Play does not repeat the launch. Reduce Effects starts immediately.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu, player } = G(), over = menu.overlay;
    menu.restore();
    const position = player.position.clone(), root = player.avatar.root;
    const scale = root.scale.clone(), local = root.position.clone();
    let reduced = false;
    stub(menu, 'calm', () => reduced);
    stub(menu, 'onPoke', () => {});
    try {
      menu.show(); over.hidden = false; step(1);
      for (let i = 0; i < 100; i++) menu.poke();
      step(1);
      const bounded = root.scale.y >= scale.y * 0.8 && root.scale.y <= scale.y * 1.2;
      const notMoved = player.position.equals(position);
      menu.launch(); step(30);
      const restored = root.scale.equals(scale) && root.position.equals(local) && !menu.launching && over.hidden;
      over.hidden = false; menu.launch();
      const resume = !menu.launching && !menu.home;
      menu.show(); reduced = true; step(1); menu.poke(); step(1);
      const calm = root.scale.equals(scale) && root.position.equals(local);
      menu.launch();
      const immediate = !menu.launching && over.hidden;
      return ok(bounded && notMoved && restored && resume && calm && immediate, { bounded, notMoved, restored, resume, calm, immediate });
    } finally {
      menu.restore(); menu.cancelLaunch(); menu.home = false;
      over.classList.remove('menu-home'); over.hidden = true;
    }
  },
});

story('menu/welcomes-a-returning-player-by-name', {
  about: 'A returning player (a saved best) who has put a name on the board is greeted by it over their jelly: "Welcome back, <name>". A new player gets no greeting.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    const keys = ['jellyrun.name', 'jellyrun.best', 'jellyrun.played'];
    const saved = keys.map((k) => [k, localStorage.getItem(k)]);
    try {
      localStorage.setItem('jellyrun.name', 'Marlin');
      localStorage.setItem('jellyrun.best', JSON.stringify({ score: 1234 }));
      menu.show(); over.hidden = false; step(1);
      const el = over.querySelector('.menu-greet');
      const greeted = !!el && !el.hidden && el.textContent === 'Welcome back, Marlin';
      for (const k of keys) localStorage.removeItem(k);
      menu.show(); step(1);
      const ungreeted = el.hidden && el.textContent === '';
      return ok(greeted && ungreeted, { greeted, ungreeted, text: el.textContent });
    } finally {
      for (const [k, v] of saved) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
});

story('main-menu/no-pause-menu-behind-the-end-screen', {
  about: 'When a run ends (dying, or winning) the game lets go of the mouse; that must not open the pause menu (with its treasure list) behind the end screen. Mid-run, letting go of the mouse still opens it.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { run } = G(), overlay = document.getElementById('g-over'), unlock = () => document.dispatchEvent(new Event('pointerlockchange'));
    overlay.hidden = true; unlock();
    const midRun = !overlay.hidden;                       // paused, as before
    overlay.hidden = true; run.phase = 'dead'; unlock();
    const dead = overlay.hidden;
    run.phase = 'won'; unlock();
    const won = overlay.hidden;
    run.phase = 'explore';
    return ok(midRun && dead && won, { midRun, dead, won });
  },
});


story('menu/old-saves-move-to-the-new-name', {
  about: 'The game is called Jelly Run. Saves kept under its old name (jellyfight.*) move to jellyrun.* at startup, so a returning player keeps their best score and Pearls; a key already saved under the new name is kept.',
  setup() { fresh({ elites: false }); },
  play() {
    const keys = ['jellyfight.best', 'jellyfight.pearls', 'jellyrun.best', 'jellyrun.pearls'];
    const saved = keys.map((k) => [k, localStorage.getItem(k)]);
    try {
      localStorage.removeItem('jellyrun.best');
      localStorage.setItem('jellyfight.best', '{"score":4321}');
      localStorage.setItem('jellyfight.pearls', '7');
      localStorage.setItem('jellyrun.pearls', '9');
      moveSaves(localStorage);
      const best = localStorage.getItem('jellyrun.best'), pearls = localStorage.getItem('jellyrun.pearls');
      const gone = localStorage.getItem('jellyfight.best') === null && localStorage.getItem('jellyfight.pearls') === null;
      const { mainMenu: menu } = G(), over = menu.overlay;
      menu.show(); over.hidden = false; step(1);
      const heading = over.querySelector('h1').textContent;
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
      const named = document.title === 'Jelly Run' && heading === 'Jelly Run';
      return ok(best === '{"score":4321}' && pearls === '9' && gone && named, { best, pearls, gone, title: document.title, heading });
    } finally {
      for (const [k, v] of saved) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    }
  },
});

story('menu/old-address-hands-saves-to-jellyrun-org', {
  about: 'The game lives at jellyrun.org. The old Cloudflare address sends a player there with their saves in the link, and jellyrun.org keeps each save it does not already have; any other address (previews, claude.ai) stays put.',
  setup() { fresh({ elites: false }); },
  play() {
    const mem = (o = {}) => ({ ...o, getItem(k) { return k in this ? this[k] : null; }, setItem(k, v) { this[k] = String(v); } });
    const old = mem({ 'jellyrun.best': '{"score":4321}', 'jellyrun.pearls': '7', other: 'x' });
    Object.defineProperties(old, { getItem: { enumerable: false }, setItem: { enumerable: false } });
    const link = forwardFor('jelly-fight.nycjfc.workers.dev', old);
    const stays = forwardFor('claude-project-thread-x-jelly-fight.nycjfc.workers.dev', old) === null && forwardFor('jellyrun.org', old) === null;
    const fresh2 = mem({ 'jellyrun.pearls': '9' });
    Object.defineProperties(fresh2, { getItem: { enumerable: false }, setItem: { enumerable: false } });
    const took = takeSaves(link.slice(HOME.length), fresh2);
    const kept = fresh2['jellyrun.best'] === '{"score":4321}' && fresh2['jellyrun.pearls'] === '9' && !('other' in fresh2);
    const ignores = !takeSaves('', fresh2) && !takeSaves('#saves=%7Bbroken', fresh2);
    return ok(link.startsWith(HOME + '#saves=') && stays && took && kept && ignores, { link: link.slice(0, 60), stays, took, kept, ignores });
  },
});

story('menu/install-app-button', {
  about: 'The title screen shows "Install app" only once the browser offers to install the game; tapping it opens the browser\'s install prompt and the button goes, as it does when the game gets installed.',
  setup() {},
  play() {
    const btn = document.querySelector('#g-over [data-act="install"]'), before = btn.hidden;
    let asked = 0;
    const offer = new Event('beforeinstallprompt'); offer.prompt = () => asked++;
    dispatchEvent(offer);                                 // what Chrome sends when the game can be installed
    const offered = !btn.hidden;
    btn.click();
    const used = asked === 1 && btn.hidden;
    dispatchEvent(offer); dispatchEvent(new Event('appinstalled'));
    return ok(before && offered && used && btn.hidden, { before, offered, asked, hidden: btn.hidden });
  },
});

// --- Settings and the pause menu (UI overhaul M1)
const settingsSheet = {
  about: 'The gear on the title (the Settings button in the pause menu) opens Settings as a sheet over a scrim: Sound, Music, Graphics and Text size (and Frame rate on a phone) as choices that show what is on, and Sound and Music change it. Close, the scrim and Escape shut it. A phone\'s sheet rises from the bottom edge; a desktop\'s sits in the middle. Install app waits for the browser\'s offer.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu, gfx } = G(), over = menu.overlay, $ = (s) => over.querySelector(s), sheet = $('.menu-settings'), scrim = $('.ui-scrim');
    const phoneSized = matchMedia('(pointer: coarse)').matches;
    const pressed = (attr) => [...sheet.querySelectorAll(`[${attr}]`)].find((b) => b.getAttribute('aria-pressed') === 'true')?.getAttribute(attr);
    const wasMuted = isMuted(), wasMusic = localStorage.getItem('jellyrun.music');
    try {
      menu.show(); over.hidden = false; step(1);
      const shut = sheet.hidden && scrim.hidden;
      $('.menu-gear').click();
      for (const a of sheet.getAnimations()) a.finish();
      const r = sheet.getBoundingClientRect();
      const open = !sheet.hidden && !scrim.hidden && r.height > 0;
      const placed = phoneSized ? Math.abs(r.bottom - innerHeight) < 1 && r.width === innerWidth : Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) < 2 && r.width < innerWidth;
      const rows = [...sheet.querySelectorAll('.set-row .ui-label')].map((l) => l.textContent).join();
      const wanted = phoneSized ? 'Sound,Music,Graphics,Frame rate,Text size,Easy mode' : 'Sound,Music,Graphics,Text size,Easy mode';
      const shows = pressed('data-sound') === (wasMuted ? 'off' : 'on') && pressed('data-q') === gfx.choice && pressed('data-text') === 'normal';
      sheet.querySelector('[data-sound="off"]').click();
      const muted = isMuted() && pressed('data-sound') === 'off';
      sheet.querySelector('[data-sound="on"]').click();
      const unmuted = !isMuted() && pressed('data-sound') === 'on';
      sheet.querySelector('[data-music="off"]').click();
      const musicOff = localStorage.getItem('jellyrun.music') === 'off' && pressed('data-music') === 'off';
      sheet.querySelector('[data-music="on"]').click();
      const musicOn = localStorage.getItem('jellyrun.music') === 'on' && pressed('data-music') === 'on';
      const install = $('[data-act="install"]').hidden;
      const closes = [];
      sheet.querySelector('[data-act="sheet-close"]').click(); closes.push(sheet.hidden && scrim.hidden);
      $('.menu-gear').click(); scrim.click(); closes.push(sheet.hidden && scrim.hidden);
      $('.menu-gear').click(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); closes.push(sheet.hidden && scrim.hidden);
      // the pause menu's own Settings button opens the same sheet
      over.classList.remove('menu-home'); step(1);
      const gear = getComputedStyle($('.menu-gear')).display === 'none';
      $('.pause-actions [data-act="settings"]').click();
      const fromPause = !sheet.hidden;
      sheet.querySelector('[data-act="sheet-close"]').click();
      return ok(shut && open && placed && rows === wanted && shows && muted && unmuted && musicOff && musicOn && install && closes.every(Boolean) && gear && fromPause,
        { shut, open, placed, rows, shows, muted, unmuted, musicOff, musicOn, install, closes, gear, fromPause });
    } finally {
      setMuted(wasMuted);
      if (wasMusic === null) localStorage.removeItem('jellyrun.music'); else localStorage.setItem('jellyrun.music', wasMusic);
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
};
story('menu/settings-sheet', settingsSheet);
phone('settings-sheet', settingsSheet);

story('menu/text-size', {
  about: 'Settings\' Text size is Normal or Large: Large scales every kit size by 15% and is kept in this browser (jellyrun.textSize); Normal puts it back.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay, root = document.documentElement, was = localStorage.getItem('jellyrun.textSize');
    const probe = document.createElement('p'); probe.className = 'ui-text'; probe.textContent = 'size';
    try {
      document.body.appendChild(probe);
      menu.show(); over.hidden = false; over.querySelector('.menu-gear').click();
      const size = () => parseFloat(getComputedStyle(probe).fontSize), normal = size();
      over.querySelector('[data-text="large"]').click();
      const large = +(size() / normal).toFixed(2), kept = localStorage.getItem('jellyrun.textSize'), set = root.dataset.textSize;
      const pressed = over.querySelector('[data-text="large"]').getAttribute('aria-pressed') === 'true';
      over.querySelector('[data-text="normal"]').click();
      const back = size() === normal && localStorage.getItem('jellyrun.textSize') === 'normal' && root.dataset.textSize === 'normal';
      return ok(large === 1.15 && kept === 'large' && set === 'large' && pressed && back, { normal, large, kept, set, pressed, back });
    } finally {
      probe.remove(); root.dataset.textSize = 'normal';
      if (was === null) localStorage.removeItem('jellyrun.textSize'); else localStorage.setItem('jellyrun.textSize', was);
      over.querySelector('[data-act="sheet-close"]').click();
      menu.restore(); menu.home = false; over.classList.remove('menu-home'); over.hidden = true;
    }
  },
});

story('menu/pause-summary', {
  about: 'The pause menu is its own screen, not the title: a big Resume, Settings and Main menu, then a summary of the run (Health, Level, the time to the Boss, and each Treasure taken as an icon). The title\'s Play, tiles and gear are not there, and neither is the version. Main menu asks to be tapped twice before it leaves the run.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, mainMenu: menu } = G(), over = menu.overlay, $ = (s) => over.querySelector(s), shown = (s) => $(s).getClientRects().length > 0;
    give('lemon', 'lemon', 'trophy');
    run.health = Math.max(1, Math.round(run.S.health / 2));
    let left = 0;
    stub(run, 'onMainMenu', () => { left++; });
    over.classList.remove('menu-home'); over.hidden = false;
    await Promise.resolve();                              // the menu fills as it opens
    const pause = shown('.pause-resume') && shown('[data-act="main-menu"]') && shown('.pause-summary');
    const title = shown('.play') || shown('.menu-tiles') || shown('.menu-gear') || shown('.ver') || shown('h1');
    const text = $('.pause-summary').textContent;
    const health = text.includes(`${run.health} / ${Math.ceil(run.S.health)}`) && +$('.pause-summary .ui-bar').style.getPropertyValue('--value') > 0.4;
    const facts = text.includes('Level 1') && /Boss in \d+:\d\d/.test(text);
    const icons = $('.ps-items').querySelectorAll('.ps-item').length === 2 && $('.ps-items').textContent.includes('×2');
    const leave = $('[data-act="main-menu"]');
    leave.click();
    const asks = left === 0 && /Tap again/.test(leave.textContent);
    leave.click();
    const leaves = left === 1 && leave.textContent.trim() === 'Main menu';
    leave.click(); over.hidden = true; await Promise.resolve();
    const forgets = leave.textContent.trim() === 'Main menu';   // the question doesn't wait on the next pause
    return ok(pause && !title && health && facts && icons && asks && leaves && forgets, { pause, title, text, health, facts, icons, asks, leaves, forgets });
  },
});
