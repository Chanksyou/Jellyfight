// Menu presentation must never move the actual player or replay when resuming a run.
import { story, G, fresh, ok, step, stub } from './kit.js';

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
