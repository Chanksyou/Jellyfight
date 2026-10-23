// Menu presentation must never move the actual player or replay when resuming a run.
import { story, phone, G, fresh, ok, step, stub } from './kit.js';
import { SPECIES } from '../character.js';

story('menu/portrait-controls-centered', {
  about: 'In a tall desktop window, the title, Play button, and customization button share the viewport center.',
  portrait: true,
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    try {
      menu.show(); over.hidden = false; step(1);
      const center = selector => { const r = over.querySelector(selector).getBoundingClientRect(); return r.x + r.width / 2; };
      const centers = ['h1', '.play', '.menu-jelly-caption button'].map(center);
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
  about: 'Change your look under the jelly opens customization without poking it; the old main-menu row control is hidden.',
  setup() { fresh({ elites: false }); },
  play() {
    const { mainMenu: menu } = G(), over = menu.overlay;
    let pokes = 0;
    stub(menu, 'onPoke', () => pokes++);
    try {
      menu.show(); over.hidden = false; step(1);
      const button = over.querySelector('.menu-jelly-caption [data-act="creator"]');
      const row = over.querySelector('.row [data-act="creator"]');
      const visible = button.getClientRects().length > 0 && getComputedStyle(row).display === 'none';
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
    const oldBody = player.avatar.look.body, checked = [];
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
      }
      calm = true; const held = water.material.uniforms.time.value; step(30);
      const frozen = water.material.uniforms.time.value === held;
      document.querySelector('#creator [data-act="done"]').click();
      const done = !water.mesh.visible && menu.camera.layers.mask === mask && player.avatar.root.layers.mask === 1;
      open(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      const escaped = !water.mesh.visible && menu.camera.layers.mask === mask && document.querySelector('#creator').hidden;
      return ok(shared && checked.every(Boolean) && frozen && done && escaped, { shared, checked, frozen, done, escaped });
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
    const keys = ['jellyfight.name', 'jellyfight.best', 'jellyfight.played'];
    const saved = keys.map((k) => [k, localStorage.getItem(k)]);
    try {
      localStorage.setItem('jellyfight.name', 'Marlin');
      localStorage.setItem('jellyfight.best', JSON.stringify({ score: 1234 }));
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

