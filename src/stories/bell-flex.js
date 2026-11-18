// Stories: the bell bends like a real jelly's (bell-flex.js). The crown stays nearly still while the
// rim squeezes in, and the bend runs down from the crown, so the rim's squeeze comes a moment later.
import { SPECIES, buildCharacter } from '../character.js';
import { bellFlex } from '../bell-flex.js';
import { ok, story } from './kit.js';

story('motion/rim-leads-crown', {
  about: 'Through a power stroke every species\' rim pulls in at least 3 times as far as its crown, and reaches its narrowest after the crown does.',
  setup() {},
  play() {
    const bad = [], seen = {}, f = { k: 1, dy: 0 };
    for (const body of Object.keys(SPECIES)) {
      const c = buildCharacter({ body }, 1);
      let rim = { k: 1, at: 0 }, crown = { k: 1, at: 0 };
      for (let i = 0; i <= 60; i++) {            // the power stroke (swim 0 to 0.3) and a little after
        const swim = i / 150;
        c.update(1 / 60, { speed: 0.35, walkSpeed: 0.35, grounded: true, vy: 0, swim });
        if (bellFlex(0, c.bend, f).k < rim.k) rim = { k: f.k, at: swim };
        if (bellFlex(c.crownH * 0.9, c.bend, f).k < crown.k) crown = { k: f.k, at: swim };
      }
      const ratio = (1 - rim.k) / Math.max(1e-6, 1 - crown.k);
      seen[body] = { ratio: +ratio.toFixed(1), rimAt: +rim.at.toFixed(3), crownAt: +crown.at.toFixed(3) };
      if (!(ratio >= 3 && rim.at > crown.at && rim.k < 0.85)) bad.push(body);
      c.dispose();
    }
    return ok(!bad.length, { bad, seen });
  },
});
