// Stories: the plain bubble's look (src/bubble-film.js, bubbles.js mesh). Its drawn size is a look only
// (--bubble-draw), all plain, golden and trap bubbles share one soap film and one draw, and the film's rim
// carries its shape on Low graphics, over a dark floor and a bright one.
import * as THREE from 'three';
import { G, V, ok, record, spawn, step, story, stub, fresh, tp } from './kit.js';

const quiet = () => { fresh({ elites: false, lash: false }); tp(3.2, 0.05, 3.0, 0); stub(G().run.bubbles, 'volley', () => false); };
const bell = () => { const { player, run } = G(); return player.position.clone().setY(player.position.y + run.cfg.height * 0.75); };

story('attack/bubble-draw-size-leaves-hits-alone', {
  about: 'How big a plain bubble is drawn (--bubble-draw) changes nothing it does: blown at a still roach at draw 1 and at draw 2, it hits on the same frame for the same damage, and only the drawn scale doubles.',
  setup() { quiet(); },
  play() {
    const { run, enemies } = G(), B = run.bubbles, was = B.draw;
    const shot = (draw) => {
      enemies.clear(); B.reset(); B.draw = draw;
      const e = spawn('roach', G().player.position.clone().add(V(0, 0, -0.2)), { still: true, hp: 9999 });
      const hits = record('damage_taken'), b = B.blow(bell(), e, { size: run.S.bubbleSize, dmg: run.S.bubbleDamage, pierce: 1 });
      b.wobble = 0;   // its bob's phase is a roll: the same for both
      let scale = 0;
      const frame = step(120, () => { if (!b.done) scale = b.m.scale.z; return hits.some((h) => h.source === 'bubble'); });
      return { frame, dmg: hits.find((h) => h.source === 'bubble')?.amount, scale: +(scale / b.r).toFixed(3) };
    };
    try {
      const one = shot(1), two = shot(2);
      return ok(one.frame < 120 && one.frame === two.frame && one.dmg === two.dmg && Math.abs(one.scale - 1) < 0.03 && Math.abs(two.scale - 2) < 0.06, { one, two });
    } finally { B.draw = was; }
  },
});

story('attack/bubbles-share-one-draw', {
  about: 'A plain, a golden and a trap bubble in the air together are one instanced draw of one soap-film material, with no highlight sphere of their own (it was up to six).',
  setup() { quiet(); },
  play() {
    const { run, batcher } = G(), B = run.bubbles, at = bell().add(V(0, 0, -0.15));
    B.blow(at, null, { size: 1, dmg: 1, pierce: 1, dir: V(0, 0, -1), speed: 0.001 });
    B.blow(at.clone().add(V(0.03, 0, 0)), null, { size: 1, dmg: 1, pierce: 1, dir: V(0, 0, -1), speed: 0.001, golden: true });
    B.trapBug(spawn('roach', at.clone().add(V(-0.06, -0.03, 0)), { still: true, hp: 9999 }), 2);
    step(2);
    batcher.sync();
    const film = batcher.all.filter((g) => g.n && (g.src === B.mat || g.geo === B.geo));
    const kids = B.list.concat(B.traps).every((b) => !b.m.children.length);
    return ok(film.length === 1 && film[0].n === 3 && film[0].src === B.mat && kids, { groups: film.length, n: film[0]?.n, kids });
  },
});

story('attack/bubble-rim-shows-on-low', {
  readback: true,   // reads the picture back, so tests/run.mjs plays it before the stories that queue frames
  about: 'On Low graphics (no bloom) a plain bubble is still a bubble: over a black board and a white one, its rim changes the picture much more than its clear middle does.',
  setup() { quiet(); step(2); },
  async play() {
    const { gfx, APT, run, batcher } = G(), { camera, scene } = APT, gl = APT.renderer.getContext(), was = gfx.choice, px = new Uint8Array(4), B = run.bubbles;
    const fwd = camera.getWorldDirection(V(0, 0, 0)), right = V(0, 0, 0).setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const P = camera.position.clone().addScaledVector(fwd, 0.12), R = 0.012;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial());
    board.position.copy(P).addScaledVector(fwd, 0.04); board.lookAt(camera.position); scene.add(board);
    const m = B.mesh(); m.position.copy(P); m.scale.setScalar(R);
    const at = (p) => {   // the screen's brightness at a world point (a 3x3 average)
      batcher.sync(); gfx.render();
      const s = p.clone().project(camera), x = Math.round((s.x + 1) / 2 * gl.drawingBufferWidth), y = Math.round((s.y + 1) / 2 * gl.drawingBufferHeight);
      let sum = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { gl.readPixels(x + i, y + j, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
      return sum / 9;
    };
    const rimAt = P.clone().addScaledVector(right, R * 0.93);
    const change = (p) => { m.visible = true; const on = at(p); m.visible = false; const off = at(p); return Math.abs(on - off); };
    try {
      gfx.setQuality('low'); await gfx.ready;
      const look = (color) => { board.material.color.set(color); return { mid: +change(P).toFixed(1), rim: +change(rimAt).toFixed(1) }; };
      const dark = look(0x000000), bright = look(0xffffff);
      const good = (r) => r.rim > 24 && r.rim > r.mid * 2.5;
      return ok(good(dark) && good(bright), { dark, bright });
    } finally {
      scene.remove(board); board.geometry.dispose(); board.material.dispose();
      m.visible = false; B.pool.push(m);
      gfx.setQuality(was); await gfx.ready;
    }
  },
});
