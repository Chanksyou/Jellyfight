// A walking bug faces the way it goes, and the jelly once it is in reach (enemies.js update).
import { G, V, holdJelly, ok, setupFight, spawn, step, story, tp } from './kit.js';

const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const facing = (e) => e.root.rotation.y;

story('bugs/face-the-way-they-walk', {
  about: 'A Stag beetle (it turns at 1.5 radians a second) walking away from where the jelly just was swings round slowly, and while it does its body points along its walk, not at the jelly.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G(), P = G().player.position;
    tp(3.2, 0.05, 3.0, 0); step(20); holdJelly();
    const b = spawn('beetle', V(P.x + 1, P.y + 0.01, P.z), { hp: 1e7 });
    step(40);
    tp(P.x + 2, P.y, P.z, 0); holdJelly();   // the jelly is now straight behind it
    let worst = 0, seen = 0;
    step(30, () => {
      const vx = b.vel.x, vz = b.vel.z;
      if (Math.hypot(vx, vz) < 0.01) return;
      const toJelly = Math.atan2(G().player.position.x - b.pos.x, G().player.position.z - b.pos.z);
      const ofWalk = angle(facing(b), Math.atan2(vx, vz)), ofJelly = angle(facing(b), toJelly);
      if (ofJelly > 0.8) { seen++; worst = Math.max(worst, ofWalk); }
    });
    enemies.kill(b, true);
    return ok(seen >= 3 && worst < 0.9, { seen, worst: +worst.toFixed(2) });
  },
});

story('bugs/face-the-jelly-to-attack', {
  about: 'A Cockroach that has reached the jelly is facing it.',
  setup() { setupFight({ bubbles: false, lash: false }); },
  play() {
    const { enemies } = G(), P = G().player.position;
    tp(3.2, 0.05, 3.0, 0); step(20); holdJelly();
    const r = spawn('roach', V(P.x - 0.5, P.y + 0.01, P.z + 0.2), { hp: 1e7 });
    r.root.rotation.y = 2.5;   // facing well away, so only turning to the jelly can fix it
    step(5 * 60, () => Math.hypot(r.pos.x - P.x, r.pos.z - P.z) < 0.09);
    const toJelly = Math.atan2(P.x - r.pos.x, P.z - r.pos.z), off = angle(facing(r), toJelly);
    enemies.kill(r, true);
    return ok(off < 0.3, { off: +off.toFixed(2), state: r.state, d: +Math.hypot(r.pos.x - P.x, r.pos.z - P.z).toFixed(3), rad: G().enemies.playerRadius, rr: r.r, reach: r.T.reach });
  },
});
