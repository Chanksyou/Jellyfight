// Stories: act 3: the bedroom and the Pothos (played in a page opened on act 3). Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import * as THREE from 'three';
import { bus, PLAYER } from '../events.js';
import { CONTENT } from '../content.js';
import { LOOK } from '../look.js';
import { STAGES, nav } from '../stages.js';
import { STAGE3 } from '../stage3.js';
import { G, JUMP_FEET, V, act3, bossHits, cameraStory, cameraTour, everyAttack, fresh, heartFrame, holdJelly, near, ok, pothosFight, pothosFloor, r3, record, shownWarnings, sim, spawn, step, stripLine, stub, tp, volumePairs } from './kit.js';

// --- act 3: the bedroom (stage3.js). These play in a page opened on act 3, carrying a level-10
act3('carries-the-run', {
  about: 'Act 3 starts in the bedroom with what act 2 left you: level, Treasures, evolutions and the score so far.',
  setup() { fresh(); },
  play() {
    const { run, player } = G();
    const inBedroom = run.stage.rooms.includes('Bedroom') && run.inStage(player.position.x, player.position.z);
    return ok(run.stage.id === 3 && run.level === 10 && run.owned.has('candle') && run.owned.has('battery') && run.evolved.length === 2 && run.score() >= 12000 && inBedroom,
      { act: run.stage.id, level: run.level, owned: [...run.owned], evolved: run.evolved, score: run.score(), at: r3(player.position) });
  },
});
act3('night-dragonflies-mantises-then-nests', {
  about: 'The act 3 night: dragonflies from the start, praying mantises from 0:45, and from 1:30 two wasp nests at two of the spots the act lists (none before). Only act 3\'s Bugs come.',
  setup() { fresh({ waves: true, elites: false }); },
  play() {
    const { run, enemies } = G();
    const pool = new Set(CONTENT.waves.bugs.filter((b) => b.act === 3).map((b) => b.id));
    // a stretch of the night held at time t: what comes (killed as it comes, so the cap never stops it)
    const during = (t, frames) => {
      const seen = new Set();
      step(frames, () => {
        run.t = t;
        for (const e of enemies.list) if (!e.dead && !e.proxy) { seen.add(e.type); if (e.type !== 'nest') enemies.kill(e, true); }
      });
      return seen;
    };
    const early = during(10, 900), later = during(70, 2400);
    const nestsBefore = enemies.list.filter((e) => !e.dead && e.type === 'nest').length;
    run.t = 89.5;
    step(60);
    const nests = enemies.list.filter((e) => !e.dead && e.type === 'nest');
    const listed = nests.every((n) => STAGE3.nests.spots.includes(n.spot)) && new Set(nests.map((n) => n.spot)).size === nests.length;
    const stray = [...early, ...later].filter((t) => !pool.has(t) && t !== 'nest');
    return ok([...early].join() === 'dragonfly' && later.has('mantis') && later.has('dragonfly') && !nestsBefore && !early.has('nest') && !later.has('nest') && nests.length === 2 && listed && !stray.length,
      { early: [...early], later: [...later], nestsBefore, nests: nests.map((n) => n.spot?.on), stray });
  },
});
act3('act-3-is-tougher', {
  about: 'Act 3 is scaled for a level-10 jelly: its Bugs have 3x the health, hits on you do 2x, and each kill drops 1.4x the XP.',
  setup() { fresh({ hurt: true, elites: false }); },
  play() {
    const { run, enemies, xpDrops } = G(), stage = run.stage;
    const fly = enemies.spawn('dragonfly', near(0.5, 0), stage.toughness);
    const bugX = fly.maxHp / fly.T.hp;
    run.iFrames = 0;
    const m0 = run.health;
    bus.emit('damage_taken', { targetId: PLAYER, amount: 2, source: 'test' });
    const took = m0 - run.health;
    let dropped = 0;
    stub(xpDrops, 'drop', (p, v, n) => { dropped += v * n; });
    run.onKill({ pos: near(0.1, 0), r: 0.01, xp: 5 });
    return ok(bugX === 3 && Math.abs(took - 4) < 0.01 && dropped === 7, { bugX, took: +took.toFixed(2), dropped });
  },
});
act3('treasure-spots', {
  about: 'Treasures can turn up all over the bedroom (the floor, the bed, the dresser), each on a real surface you can reach.',
  setup() { fresh(); },
  play() {
    const { run } = G();
    return ok(run.spots.length >= 8 && !run.spotRejects.length && run.spots.every((sp) => run.inStage(sp.at[0], sp.at[2])),
      { kept: run.spots.length, rejects: run.spotRejects });
  },
});
for (const v of STAGE3.vents) {
  act3(`vent-to-${v.to.replace('the ', '').replace(/ /g, '-')}`, {
    about: `Stepping on the ${v.name.toLowerCase()} flings you onto ${v.to}.`,
    setup() { fresh({ elites: false }); tp(v.at[0], 0.05, v.at[2], 0); },
    play() {
      const r = sim(3);
      const [x, y, z] = r.pos, [lx, ly, lz] = v.land;
      return ok(Math.hypot(x - lx, z - lz) < 0.08 && Math.abs(y - ly) < 0.06 && r.grounded, { end: r.pos, target: v.land });
    },
  });
}

act3('pothos-wakes-when-time-runs-out', {
  about: 'When the countdown runs out the jelly is carried onto the bed, walled in, and the Pothos rises in its pot on the pillows at the head of the bed; the plant on the shelf above and the plushies are gone, and the boss bar shows its name and Health.',
  setup() { fresh({ elites: false }); },
  play() {
    const { run, menus, player, APT } = G();
    run.t = run.duration - 0.05;
    step(60 * 6, () => { if (menus.open) document.querySelector('.jf-card')?.click(); return run.phase === 'boss' && run.boss?.rise >= 1; });
    const B = run.boss, A = run.stage.boss, P = player.position, pot = B?.position;
    const onBed = (p) => p.x > A.arenaMin[0] && p.x < A.arenaMax[0] && p.z > A.arenaMin[2] && p.z < A.arenaMax[2] && p.y > 0.55;
    let shelf = false;
    APT.scene.traverse((o) => { if (/^(Pothos|Plush_crocodile)/.test(o.name) && o.isMesh && o.visible) { let v = true; for (let q = o; q; q = q.parent) v &&= q.visible; shelf ||= v; } });
    // nothing of the apartment's own plant hangs under the shelf any more (its leaves are instances
    // of meshes shared with plants elsewhere, its trailing strands parts of the shelf)
    const under = new THREE.Box3(V(-0.95, 1.0, 10.9), V(0.2, 1.77, 11.2)), m4 = new THREE.Matrix4(), at = V(0, 0, 0), hanging = new Set();
    APT.scene.getObjectByName('Apartment').traverse((o) => {
      if (!o.isMesh) return;
      let v = true; for (let q = o; q; q = q.parent) v &&= q.visible;
      if (!v) return;
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); if (m4.determinant() !== 0 && under.containsPoint(at.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld))) hanging.add(o.name); }
      } else if (under.containsPoint(new THREE.Box3().setFromObject(o).getCenter(at))) hanging.add(o.name);
    });
    const walls = run.bossWalls.length === 4 && run.bossWalls.every((m) => m.visible);
    const bar = document.querySelector('#hud .boss');
    const named = bar && !bar.hidden && /THE POTHOS/.test(bar.textContent);
    return ok(B?.constructor.name === 'Pothos' && onBed(P) && pot && onBed(pot) && pot.z > 10.6 && !shelf && !hanging.size && walls && named && B.hp === B.maxHp,
      { boss: B?.constructor.name, player: r3(P), pot: pot && r3(pot), shelf, hanging: [...hanging], walls, bar: bar?.textContent, hp: B?.hp });
  },
});
act3('pothos-only-its-heart-takes-damage', {
  about: 'Only the Pothos\'s glowing heart can be hurt: a bubble at its pot does nothing, one into its heart lowers its Health.',
  setup() {},
  play() {
    const B = pothosFight(), { run } = G(), Bu = run.bubbles;
    stub(Bu, 'volley', () => false);                      // no bubbles of its own: just the two we blow
    stub(Bu, 'elementVolley', () => false);
    stub(Bu, 'update', function (dt, origin, stats, mods) { this.fly(dt, stats, mods); });
    tp(-0.105, 0.7, 10.3, Math.PI);
    const from = G().player.position.clone().setY(G().player.position.y + 0.06);
    const heart = B.center(), pot = B.position;
    const shoot = (at) => {
      const hp = B.hp, b = Bu.blow(from, null, { size: 1, dmg: 20, pierce: 1, range: 2, dir: at.clone().sub(from) });
      let closest = Infinity;
      step(90, () => { closest = Math.min(closest, Math.hypot(b.m.position.x - at.x, b.m.position.y - at.y, b.m.position.z - at.z)); return b.done; });
      return { lost: hp - B.hp, closest: +closest.toFixed(3), popped: b.done };
    };
    // at the side of the pot, below the rim: well clear of the heart (its vines, trailing over the
    // pot's lip, may stop it first: that does nothing either)
    const side = shoot(pot.clone().add(V(0.07, 0.1, 0)));
    pothosOpen(B);                                        // (its leaves part after a Vine Whip: the way in)
    const hit = shoot(heart);
    return ok((side.closest < 0.02 || side.popped) && side.lost === 0 && hit.lost > 0, { side, hit, heart: r3(heart), pot: r3(pot) });
  },
});
// the Pothos's look (#34): its trailing vines as drawn (the tube meshes' own rings, in the world)
const vineRings = (B) => B.model.vines.map((v) => {
  v.mesh.updateWorldMatrix(true, false);
  const p = v.mesh.geometry.attributes.position, rings = [];
  for (let i = 0; i < p.count / 8; i++) {
    const verts = [], c = V(0, 0, 0);
    for (let j = 0; j < 8; j++) verts.push(V(0, 0, 0).fromBufferAttribute(p, i * 8 + j).applyMatrix4(v.mesh.matrixWorld));
    for (let j = 0; j < 7; j++) c.add(verts[j]);              // (the 8th is the 1st again: the seam)
    c.multiplyScalar(1 / 7);
    rings.push({ c, r: c.distanceTo(verts[0]), verts });
  }
  return rings;
});
act3('pothos-pot-sits-on-the-bed', {
  about: 'The Pothos\'s pot stands on something: under its base the bed (a pillow, or the mattress between them) is right there, nowhere a gap of more than a centimetre under it.',
  setup() {},
  play() {
    const B = pothosFight(), { world } = G();
    B.holder.updateMatrixWorld(true);
    const pot = new THREE.Box3().setFromObject(B.model.root.children[0]), base = pot.min.y, c = pot.getCenter(V(0, 0, 0)), gaps = [];
    for (let k = -1; k < 8; k++) {   // its middle, and round it halfway to its edge
      const a = (k * Math.PI) / 4, r = k < 0 ? 0 : 0.045, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      world.focus(V(x, base, z), 1); world._focusAge = Infinity;
      const h = world.castAll(V(x, base + 0.3, z), V(0, -1, 0), 1), under = h ? base - h.point.y : 1;
      gaps.push(+Math.max(0, under).toFixed(3));
    }
    return ok(gaps.every((g) => g < 0.01), { base: +base.toFixed(3), at: r3(c), gaps });
  },
});
act3('pothos-vines-lie-on-the-bed', {
  about: 'Every trailing vine of the Pothos rises out of its soil, over the pot\'s lip and down its outside, then lies on the bed as it really is: up over the pillows and into the mattress\'s dips, resting on the surface under it within a few millimetres, never below it, never floating, and never through the pot.',
  setup() {},
  play() {
    const B = pothosFight(), { world } = G(), at = B.position, o = V(0, 0, 0), down = V(0, -1, 0);
    const surf = (x, z) => world.castAll(o.set(x, at.y + 0.5, z), down, 1.2)?.point.y ?? -1;
    // the pot as drawn: how far out its wall is at each height above its base, and the soil's height
    const pot = B.model.root.children.find((m) => m.geometry?.type === 'LatheGeometry'), dirt = B.model.root.children.find((m) => m.geometry?.type === 'CircleGeometry');
    pot.updateWorldMatrix(true, false); dirt.updateWorldMatrix(true, false);
    const wall = [], pp = pot.geometry.attributes.position, w = V(0, 0, 0);
    for (let i = 0; i < pp.count; i++) { w.fromBufferAttribute(pp, i).applyMatrix4(pot.matrixWorld); wall.push([w.y - at.y, Math.hypot(w.x - at.x, w.z - at.z)]); }
    const wallAt = (y) => Math.max(0, ...wall.filter(([h]) => Math.abs(h - y) < 0.006).map(([, r]) => r));
    const potR = Math.max(...wall.map(([, r]) => r)), soil = new THREE.Vector3().setFromMatrixPosition(dirt.matrixWorld).y - at.y;
    const vines = vineRings(B), out = { vines: vines.length, through: 0, onBed: [], below: 0, float: 0, edges: 0, rings: 0 };
    for (const rings of vines) {
      let bed = 0;
      for (const { c, r, verts } of rings) {
        // through the pot: any of it inside the pot's wall, under the soil
        for (const v of verts) { const y = v.y - at.y; if (y > 0.005 && y < soil - 0.012 && Math.hypot(v.x - at.x, v.z - at.z) < wallAt(y) - 0.002) out.through++; }
        if (Math.hypot(c.x - at.x, c.z - at.z) < potR + r + 0.005) continue;   // still on the pot
        // out on the bed: its underside on the surface under it (a pillow's edge or the dip's step
        // is a ledge it runs down: there it only mustn't sink in)
        bed++; out.rings++;
        const h = surf(c.x, c.z), d = 0.015;
        // (a ledge: the surface bends or drops sharply here, a pillow's rounded front. Running down a ledge's face, it
        // mustn't sink below the foot of the ledge, and must touch the ledge within a ring or two)
        const ax = surf(c.x + d, c.z), bx = surf(c.x - d, c.z), az = surf(c.x, c.z + d), bz = surf(c.x, c.z - d);
        const edge = Math.abs(ax + bx - 2 * h) > 0.008 || Math.abs(az + bz - 2 * h) > 0.008 || Math.max(h, ax, bx, az, bz) - Math.min(h, ax, bx, az, bz) > 0.02;
        // elsewhere its lowest point touches the surface under that point (on a slope, that's to
        // one side of its middle)
        const touch = edge ? 0 : Math.min(...verts.slice(0, 7).map((v) => v.y - surf(v.x, v.z)));
        const sunk = edge ? c.y - r < Math.min(h, ax, bx, az, bz) - 0.003 : touch < -0.003;
        const floats = edge ? Math.max(h, ax, bx, az, bz) < c.y - r - 0.004 : touch > 0.004;
        const where = [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3), +h.toFixed(3), edge];
        if (sunk) { out.below++; (out.sunk ||= []).push(where); }
        if (floats) { out.float++; (out.floating ||= []).push(where); }
        if (edge) out.edges++;
        if (!edge) { out.worst = Math.min(out.worst ?? 1, +touch.toFixed(4)); out.most = Math.max(out.most ?? -1, +touch.toFixed(4)); }
      }
      out.onBed.push(bed);
    }
    return ok(out.vines === 9 && out.onBed.every((n) => n >= 20) && out.through === 0 && out.below === 0 && out.float === 0, out);
  },
});
act3('pothos-vines-and-leaves-block-bubbles', {
  about: 'The Pothos\'s vines and leaves stop bubbles: one that hits a trailing vine on the bed or a leaf of its mound pops there and does it no harm; one that finds the hollow in its leaves and reaches the heart hurts it.',
  setup() {},
  play() {
    const B = pothosFight(), { run } = G(), Bu = run.bubbles, at = B.position;
    stub(Bu, 'volley', () => false);                      // no bubbles of its own: just the ones we blow
    stub(Bu, 'elementVolley', () => false);
    stub(Bu, 'update', function (dt, origin, stats, mods) { this.fly(dt, stats, mods); });
    const shoot = (from, to) => {
      const hp = B.hp, b = Bu.blow(from, null, { size: 1, dmg: 20, pierce: 1, range: 2, dir: to.clone().sub(from) });
      step(90, () => b.done);
      return { lost: hp - B.hp, popped: b.done, travel: +b.travel.toFixed(3), off: +b.m.position.distanceTo(to).toFixed(3) };
    };
    // a vine on the bed, half way along the middle one, shot at from the side, level with it
    const rings = vineRings(B)[4], onBed = rings.filter(({ c }) => Math.hypot(c.x - at.x, c.z - at.z) > 0.3), vine = onBed[Math.floor(onBed.length / 2)];
    const along = onBed[Math.floor(onBed.length / 2) + 1].c.clone().sub(vine.c).setY(0).normalize(), side = V(along.z, 0, -along.x);
    const atVine = shoot(vine.c.clone().addScaledVector(side, 0.25), vine.c);
    // the mound, from the east, above the heart: into its leaves
    const top = at.y + 0.3, leaf = shoot(V(at.x + 0.5, top, at.z), V(at.x, top, at.z));
    // the heart, from in front, through the hollow (opened after a Vine Whip)
    tp(-0.105, 0.7, 10.3, Math.PI);
    const from = G().player.position.clone().setY(G().player.position.y + 0.06);
    pothosOpen(B);
    const heart = shoot(from, B.center());
    // (its leaves stick out either side of it: the bubble may pop on one just before the vine)
    return ok(atVine.popped && atVine.lost === 0 && atVine.off < 0.08 && atVine.travel < 0.24 && leaf.popped && leaf.lost === 0 && leaf.travel < 0.45 && heart.lost > 0,
      { atVine, leaf, heart });
  },
});
act3('pothos-fight-camera-keeps-the-heart-in-frame', {
  about: 'In the Pothos fight the camera eases back and up (look.css: about 0.95 m away and 45 degrees down, not 0.68 m and 60, aiming ahead of the jelly; a phone has its own view) so the heart, up in its leaves on the pillows, is on screen with the jelly from where the fight starts, below the boss bar and the toast that it wakes; when the fight ends it eases back to the usual view.',
  setup() {},
  play() {
    fresh({ elites: false }); step(10);
    const { tpc, APT, player } = G(), own = { d: tpc.distance, p: tpc.pitch };
    const before = { d: +tpc.currentDistance.toFixed(3), p: +tpc.viewPitch.toFixed(3) };
    const B = pothosFight();
    step(150);                                            // eased in
    const A = G().run.stage.boss, P = player.position, atStart = Math.hypot(P.x - A.playerStart[0], P.z - A.playerStart[2]) < 0.05;
    const fight = { d: +tpc.currentDistance.toFixed(3), p: +tpc.viewPitch.toFixed(3) };
    const view = heartFrame(B);
    B.damage(B.hp + 1);
    step(240);                                            // the fight's over: eased back
    const after = { d: +tpc.currentDistance.toFixed(3), p: +tpc.viewPitch.toFixed(3) };
    return ok(before.d === +own.d.toFixed(3) && before.p === +own.p.toFixed(3) && atStart && Math.abs(fight.d - LOOK.num('pothos-camera-distance', 0.95)) < 0.02 && Math.abs(fight.p - LOOK.num('pothos-camera-tilt', 0.785)) < 0.03 && view.good
      && Math.abs(after.d - own.d) < 0.005 && Math.abs(after.p - own.p) < 0.005,
    { before, fight, after, atStart, ...view });
  },
});
act3('pothos-fight-view-is-clear-of-the-force-fields', {
  about: 'As the Pothos fight starts the camera sits back beyond the foot of the bed, behind the arena\'s force field there: that field fades out (like furniture between the camera and the jelly) so the view is clear, the others stay up, and it comes back once the camera is inside it again.',
  setup() {},
  play() {
    const B = pothosFight(), { run, APT, player } = G();
    step(150);                                            // the fight view eased in
    const fields = run.bossWalls.map((m) => m.userData.field), cam = APT.camera.position, P = player.position;
    const behind = (f) => { const a = f.userData.across; return (cam[a] - f.position[a]) * (P[a] - f.position[a]) < 0; };
    const foot = fields.find((f) => f.userData.across === 'z' && f.position.z < 9.2);
    const startHidden = !!foot && behind(foot) && !foot.visible, othersUp = fields.filter((f) => f !== foot).every((f) => f.visible);
    tp(-0.1, 0.7, 10.0, 0); step(60);                     // further in: the camera comes inside the walls
    const back = !!foot && !behind(foot) && foot.visible;
    return ok(!!B && startHidden && othersUp && back, { cameraZ: +cam.z.toFixed(3), footZ: foot && +foot.position.z.toFixed(3), startHidden, othersUp, back });
  },
});
act3('pothos-fight-builds-no-new-shader', {
  about: 'Starting the Pothos fight builds no new shader: its pot, leaves, vines and heart were built behind Play with the other bosses\'.',
  setup() { fresh({ elites: false }); },
  play() {
    const { APT, batcher, run } = G(), compile = () => { batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); };
    compile();
    const programs = APT.renderer.info.programs.length;
    const B = pothosFight();
    compile();
    return ok(!!B && run.phase === 'boss' && APT.renderer.info.programs.length === programs, { programs, now: APT.renderer.info.programs.length });
  },
});
act3('pothos-drops-cuttings-near-you', {
  about: 'The Pothos drops a glowing Cutting on the bed near the jelly; angry, it drops them in pairs.',
  setup() {},
  play() {
    const B = pothosFight(), { enemies, run } = G(), A = run.stage.boss, out = {};
    for (const angry of [false, true]) {
      if (angry) B.hp = B.maxHp * 0.4;
      enemies.list.filter((e) => e.type === 'cutting').forEach((e) => enemies.kill(e, true));
      tp(-0.3, 0.7, 9.6, 0);
      holdJelly();
      B.begin('cutting');
      const P = G().player.position;
      step(60 * 3, () => B.state !== 'cutting');
      step(30);
      const cs = enemies.list.filter((e) => e.type === 'cutting' && !e.dead);
      const onBed = cs.every((e) => e.pos.x > A.arenaMin[0] && e.pos.x < A.arenaMax[0] && e.pos.z > A.arenaMin[2] && e.pos.z < A.arenaMax[2] && e.pos.y > 0.55 && e.grounded);
      const near = cs.every((e) => Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 0.3);
      out[angry ? 'angry' : 'calm'] = { n: cs.length, onBed, near, at: cs.map((e) => r3(e.pos)) };
    }
    return ok(out.calm.n === 1 && out.angry.n === 2 && out.calm.onBed && out.angry.onBed && out.calm.near && out.angry.near, out);
  },
});
act3('cutting-and-sap-build-no-new-shader', {
  about: 'A Cutting\'s countdown, its Sap sprout, the sap\'s Warning (circle and dome) and its puddle build no new shader: all were built behind Play.',
  setup() { fresh({ elites: false, bubbles: false, lash: false }); },
  play() {
    const { APT, batcher, enemies, player } = G(), programs = APT.renderer.info.programs.length;
    holdJelly();
    const c = spawn('cutting', player.position.clone().add(V(0.2, 0, 0)));
    c.becomeT = 0.5;                                       // sprouting soon
    step(60 * 6, () => enemies.lobs.length > 0);
    const shown = { countdown: false, lob: enemies.lobs.length > 0 };
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    step(60 * 2, () => enemies.puddles.length > 0);
    shown.puddle = enemies.puddles.length > 0;
    const c2 = spawn('cutting', player.position.clone().add(V(-0.2, 0, 0)));
    step(30);
    shown.countdown = pothosFloor().length > 0 && !c2.dead;
    batcher.sync(); APT.renderer.compile(APT.scene, APT.camera);
    const newShaders = APT.renderer.info.programs.length - programs;
    return ok(shown.lob && shown.puddle && shown.countdown && newShaders === 0, { ...shown, newShaders });
  },
});
act3('pothos-health-as-the-clogs', {
  about: 'The Pothos has the same Health as the Clog in act 2 (each boss\'s Health in content/bosses.kdl times its act\'s bossHp): 1500 x 1.6 = 2400.',
  setup() {},
  play() {
    const B = pothosFight(), clog = CONTENT.bosses.clog.hp * STAGES[1].bossHp;
    return ok(B.maxHp === clog && B.hp === clog, { pothos: B.maxHp, clog });
  },
});
act3('pothos-whip-warning-runs-a-boss-length', {
  about: 'Only a Vine Whip\'s lead (about half a second ahead of the jelly) is the exception to the Boss rules: its Warning shows as long as the Clog\'s lash\'s does before the vine strikes.',
  setup() {},
  play() {
    const B = pothosFight();
    B.stateT = 1e9; holdJelly();
    B.begin('whip');
    let shown = 0;
    step(120, () => { if (whipStrip()?.visible) shown += 1 / 60; return B.struck; });
    const clog = CONTENT.bosses.clog.skills.lash.windup;
    return ok(B.struck && Math.abs(shown - clog) < 0.05, { shown: +shown.toFixed(2), clog });
  },
});
act3('beating-the-pothos-wins-the-run', {
  about: 'Beating the Pothos grows the jelly into a Medusa (its pick doesn\'t promise a rest of the run: this is the end), then the run ends as a win straight away, with no Legendary pick after the last boss: "the apartment is yours", the score with its parts, and the score posts to the Leaderboard.',
  setup() {},
  async play() {
    const B = pothosFight(), { run, menus } = G();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const modal = () => document.querySelector('.jf-modal');
    let posted = null;
    stub(run, 'board', { status: 'online', keepBest: () => false, post: (e) => { posted = e; return Promise.resolve({ posted: true }); } });
    B.damage(B.hp + 1);
    step(5);
    await wait(2400);                                     // the metamorphosis comes a moment after
    const grow = modal()?.innerText || '';
    modal()?.querySelector('.jf-card')?.click();          // the evolution
    const end = modal()?.innerText || '';
    const next = [...(modal()?.querySelectorAll('button') || [])].some((b) => /On to act/.test(b.textContent));
    [...modal().querySelectorAll('button')].find((b) => /Submit score/.test(b.textContent))?.click();
    await wait(50);
    menus.close();
    return ok(/Medusa/.test(grow) && !/rest of the run/.test(grow) && !/Legendary/.test(end) && /apartment is yours/.test(end) && /Earlier acts/.test(end) && /The Pothos beaten/.test(end) && !next && posted?.won && posted.score === run.score() && run.evolved.length === 3,
      { grow: grow.slice(0, 200), end: end.slice(0, 160), next, posted });
  },
});
act3('dying-starts-over-in-act-1', {
  about: 'Dying in act 3 shows the usual death screen, and trying again starts a new run in act 1, with nothing carried.',
  setup() { fresh({ elites: false }); },
  async play() {
    const { run, menus } = G();
    const was = sessionStorage.getItem('jellyfight.act');
    let reloaded = false;
    stub(nav, 'reload', () => { reloaded = true; });
    run.die();
    await new Promise((r) => setTimeout(r, 800));
    const modal = document.querySelector('.jf-modal'), text = modal?.innerText || '';
    [...(modal?.querySelectorAll('button') || [])].find((b) => /Try again/.test(b.textContent))?.click();
    const went = JSON.parse(sessionStorage.getItem('jellyfight.act') || 'null');
    sessionStorage.setItem('jellyfight.act', was);           // this page stays on act 3
    menus.close();
    return ok(/You dried out/.test(text) && reloaded && went?.act === 1 && !went.carry, { text: text.slice(0, 60), reloaded, went });
  },
});
// the Aerial roots the Pothos has sent, alive
const rootsOut = () => G().enemies.list.filter((e) => e.type === 'root' && !e.dead);
act3('aerial-roots-land-near-and-creep', {
  about: 'The Pothos drops Aerial roots from above onto floor circles near the jelly (one right where it is): each lands on its circle, then creeps along the bed after the jelly.',
  setup() {},
  play() {
    const B = pothosFight(), P = holdJelly().position;
    B.begin('roots');
    step(2);
    const R = rootsOut(), spots = R.map((e) => e.dropAt.clone());
    const near = spots.map((s) => +Math.hypot(s.x - P.x, s.z - P.z).toFixed(3));
    const marked = spots.every((s) => volumePairs().some(([v, f]) => f && Math.hypot(v.position.x - s.x, v.position.z - s.z) < 0.01));
    step(60 * 2, () => R.every((e) => e.state !== 'drop'));
    const landed = R.every((e, i) => Math.hypot(e.pos.x - spots[i].x, e.pos.z - spots[i].z) < 0.01);
    const far = R.filter((e) => e.state !== 'hold'), d0 = far.map((e) => Math.hypot(e.pos.x - P.x, e.pos.z - P.z));
    step(30);
    const crept = far.length > 0 && far.every((e, i) => e.state === 'hold' || Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < d0[i] - 0.05);
    return ok(R.length >= 2 && Math.min(...near) < 0.01 && Math.max(...near) < 0.25 && marked && landed && crept, { roots: R.length, near, marked, landed, crept });
  },
});
act3('aerial-root-killed-in-time-does-nothing', {
  about: 'Aerial roots shot down before they reach the jelly do nothing: no Health lost, no slowing.',
  setup() {},
  play() {
    const B = pothosFight(), { run } = G();
    holdJelly();
    const hurt = record('damage_taken'), slows = record('status_applied');
    B.begin('roots');
    step(2);
    const R = rootsOut();
    for (const e of R) bus.emit('damage_taken', { targetId: e.id, amount: 9999 });
    B.stateT = 1e9;                                       // no next attack
    step(60 * 4);
    const rooted = hurt.filter((d) => d.source === 'root').length, slowed = slows.filter((s) => s.targetId === PLAYER).length;
    return ok(R.length >= 2 && R.every((e) => e.dead) && !rooted && !slowed && run.slowT === 0, { roots: R.length, rooted, slowed });
  },
});
// how far (flat) a point is from a line through points
const offLine = (line, q) => Math.min(...line.map((c) => Math.hypot(c.x - q.x, c.z - q.z)));
// the Vine Whip's floor strip showing in the scene
const whipStrip = () => shownWarnings().floor.find((f) => f.material.shape === 'strip');
// only the bubbles a story blows (none of the jelly's own volleys)
function onlyOurBubbles() {
  const Bu = G().run.bubbles;
  stub(Bu, 'volley', () => false);
  stub(Bu, 'elementVolley', () => false);
  stub(Bu, 'update', function (dt, origin, stats, mods) { this.fly(dt, stats, mods); });
}
// blow one bubble from `from` at `to` and see what it does to the Pothos
function blowAt(B, from, to) {
  const Bu = G().run.bubbles, hp = B.hp, b = Bu.blow(from, null, { size: 1, dmg: 20, pierce: 1, range: 2, dir: to.clone().sub(from) });
  step(90, () => b.done);
  return { lost: hp - B.hp, popped: b.done };
}
// the Pothos opened up after a Vine Whip (for the stories that shoot its heart from in front)
function pothosOpen(B) { B.begin('whip'); step(120, () => B.open >= 1); }
act3('pothos-whip-leads-a-swimming-jelly', {
  about: 'A Vine Whip aims where the jelly is heading: its lane passes about half a second ahead of a jelly swimming steadily across the bed, not where it was when the Warning showed.',
  setup() {},
  play() {
    const B = pothosFight(), { player } = G(), P = player.position;
    stub(player, 'update', function (dt) { this.position.addScaledVector(this.velocity, dt); });   // swimming steadily
    P.x = -0.45; P.z = 9.7; player.velocity.set(0.3, 0, 0);
    const from = P.clone();
    B.begin('whip');
    step(2);
    const strip = whipStrip(), line = strip ? stripLine(strip) : [];
    const ahead = from.clone().addScaledVector(V(0.3, 0, 0), 0.5);
    const out = { strip: !!strip, ahead: line.length ? +offLine(line, ahead).toFixed(3) : null, was: line.length ? +offLine(line, from).toFixed(3) : null };
    return ok(strip && out.ahead < 0.03 && out.was > 0.1, out);
  },
});
act3('pothos-whip-warning-is-a-low-curved-lane', {
  about: "A Vine Whip's Warning is a curved strip on the bed with a lane volume about 4 cm high along it, filling together to the lash; both are gone after it. Starting one builds no new shader.",
  setup() {},
  play() {
    const B = pothosFight(), { APT, batcher } = G(), compile = () => { batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); };
    holdJelly();
    compile();
    const programs = APT.renderer.info.programs.length;
    B.begin('whip');
    step(6);
    const p1 = volumePairs(), was = p1.map(([v]) => v.material.progress);
    step(6);
    const strip = whipStrip(), line = strip ? stripLine(strip) : [];
    // curved: its middle stands off the straight line from its start to its end
    const a = line[0], b = line[line.length - 1], m = line[Math.floor(line.length / 2)];
    const bow = line.length ? Math.abs((m.x - a.x) * (b.z - a.z) - (m.z - a.z) * (b.x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z) : 0;
    const tall = p1.map(([v]) => { const box = new THREE.Box3().setFromObject(v); return +(box.max.y - box.min.y).toFixed(3); });
    const out = {
      volumes: p1.length, paired: p1.every(([, f]) => f && f.material.shape === 'strip'), bow: +bow.toFixed(3), tall: [...new Set(tall)],
      filling: p1.length > 1 && p1.every(([v, f], i) => f && Math.abs(f.material.progress - v.material.progress) < 1e-6 && v.material.progress > was[i]),
    };
    compile();
    out.newShaders = APT.renderer.info.programs.length - programs;
    step(60, () => B.struck);
    step(3);
    const w = shownWarnings();
    out.gone = !w.floor.length && !w.volume.length;
    return ok(strip && out.volumes >= 4 && out.paired && out.bow > 0.02 && tall.every((h) => Math.abs(h - 0.04) < 0.004) && out.filling && out.newShaders === 0 && out.gone, out);
  },
});
act3('pothos-whip-jumped-clear', {
  about: "A jelly standing in a Vine Whip's lane is hit and knocked aside (a knockback across the lane); one in the air over it (feet 6 cm up, over the 4 cm lane) isn't touched.",
  setup() {},
  play() {
    const B = pothosFight(), player = holdJelly(), hits = bossHits(), knocks = record('knockback'), out = {};
    const floor = player.position.y;
    for (const up of [0, 0.06]) {
      player.position.set(-0.3, floor + up, 9.8);
      const h0 = hits.length, k0 = knocks.length;
      B.begin('whip');
      step(1);
      const line = stripLine(whipStrip()), P = player.position;
      step(60, () => B.struck);
      step(3);
      const k = knocks.slice(k0).find((e) => e.targetId === 'player');
      // the lane's way where it passes the jelly
      let i = 1;
      for (let j = 1; j < line.length; j++) if (Math.hypot(line[j].x - P.x, line[j].z - P.z) < Math.hypot(line[i].x - P.x, line[i].z - P.z)) i = j;
      const along = line[i].clone().sub(line[i - 1]).setY(0).normalize();
      out[up ? 'jumping' : 'standing'] = { hits: hits.slice(h0).map((h) => h.amount), knocked: !!k, across: k ? +Math.abs(k.dir.dot(along)).toFixed(2) : null };
      step(90, () => B.state !== 'whip');
      B.state = 'idle'; B.stateT = 1e9;
    }
    const s = out.standing, j = out.jumping;
    return ok(s.hits.length === 1 && s.hits[0] > 0 && s.knocked && s.across < 0.5 && !j.hits.length && !j.knocked, out);
  },
});
// how bright the screen is round where `at` shows from the play camera (mean of r, g, b, 0..255), in
// a square `half` of the screen's height across, drawn without the post effects
function brightnessRound(at, half = 0.08) {
  const { APT, batcher } = G(), W = 440, H = 260, rt = new THREE.WebGLRenderTarget(W, H);
  batcher.sync(); APT.camera.updateMatrixWorld();
  const p = at.clone().project(APT.camera), cx = Math.round((p.x + 1) / 2 * W), cy = Math.round((p.y + 1) / 2 * H), n = Math.round(half * H);
  APT.renderer.setRenderTarget(rt); APT.renderer.render(APT.scene, APT.camera); APT.renderer.setRenderTarget(null);
  const px = new Uint8Array(4 * (2 * n) * (2 * n));
  APT.renderer.readRenderTargetPixels(rt, cx - n, cy - n, 2 * n, 2 * n, px);
  rt.dispose();
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
  return +(sum / (px.length / 4)).toFixed(1);
}
act3('pothos-opening-reads-from-the-fight-camera', {
  about: "The opening after a Vine Whip reads from where you fight, even on a phone: from the fight camera, at the start, the plant round its heart lights up, twice as bright as it is calm, and the heart is clear of the boss bar (a phone's too).",
  setup() {},
  play() {
    const B = pothosFight(), { APT } = G();
    holdJelly();
    B.stateT = 1e9;
    step(150);                                            // the fight view, eased in
    const calm = brightnessRound(B.center(), 0.15);
    B.begin('whip');
    step(60, () => B.struck);
    step(12);                                             // the leaves parted, the heart flaring
    const open = brightnessRound(B.center(), 0.15);
    APT.camera.updateMatrixWorld();
    // (the boss bar on a phone held sideways, 390 px tall, ends 0.47 down from the top of the screen
    // in its -1..1 units: lower than here, as the HUD sits lower there)
    const bar = document.querySelector('#hud .boss').getBoundingClientRect(), barBottom = Math.min(0.47, 1 - (bar.bottom / innerHeight) * 2);
    const heart = B.center().project(APT.camera).y;
    return ok(open >= calm * 2 && heart < barBottom - 0.04, { calm, open, ratio: +(open / calm).toFixed(2), heart: +heart.toFixed(2), barBottom: +barBottom.toFixed(2) });
  },
});
act3('pothos-opens-after-each-whip', {
  about: "For about 1.5 s after each Vine Whip the leaves round the heart's hollow push aside and the heart flares: a bubble from in front reaches it. Before, and once they close again, the leaves stop that same shot.",
  setup() {},
  play() {
    const B = pothosFight(), player = holdJelly(), out = {};
    onlyOurBubbles();
    player.position.set(0.3, player.position.y, 9.6);     // out of the bubbles' way
    const from = V(-0.105, 0.76, 10.3), shot = () => blowAt(B, from, B.center());
    out.before = shot();
    B.begin('whip');
    B.stateT = 1e9;                                       // (no other attack after it: no other opening)
    step(60, () => B.struck);
    step(9);                                              // just after the lash
    out.open = shot();
    const t0 = B.t;
    step(60 * 3, () => B.t - t0 > 2.0);                   // well after the window
    out.after = shot();
    return ok(out.before.popped && out.before.lost === 0 && out.open.lost > 0 && out.after.popped && out.after.lost === 0, out);
  },
});
// --- the angry phase: below 45% Health the Pothos whips two vines at once, drops Cuttings in pairs
// (act3/pothos-drops-cuttings-near-you), rests less between attacks, and its heart burns hot
// the whip's Warnings showing: each floor strip with the lane volumes standing on it
function whipLanes() {
  const strips = shownWarnings().floor.filter((f) => f.material.shape === 'strip'), pairs = volumePairs();
  return strips.map((f) => ({ strip: f, line: stripLine(f), volumes: pairs.filter(([, s]) => s === f).length, progress: f.material.progress }));
}
const pothosAngry = (B) => { B.swarmed = true; B.hp = B.maxHp * 0.4; };   // (past its dragonflies)
// the least room between two lanes' centre lines along their outer halves (past `from` m from the pot)
function laneGap(a, b, pot, from = 0.25) {
  let gap = Infinity;
  for (const p of a) if (Math.hypot(p.x - pot.x, p.z - pot.z) > from) gap = Math.min(gap, offLine(b, p));
  return gap;
}
act3('pothos-whips-several-vines-at-once', {
  about: 'A Vine Whip lashes several vines at once: two calm, three below 45% Health, each on its own lane with its own floor strip and lane volumes filling to the lash, and between neighbouring lanes there is always room for the jelly to slip through (more than a lane and a jelly across). The leaves still part after it.',
  setup() {},
  play() {
    const B = pothosFight(), out = {}, body = G().player.cfg, SK = CONTENT.bosses.pothos.skills.whip;
    holdJelly().position.set(-0.3, G().player.position.y, 9.7);
    for (const angry of [false, true]) {
      if (angry) pothosAngry(B);
      B.begin('whip');
      B.stateT = 1e9;
      step(15);
      const lanes = whipLanes(), pot = B.position;
      // each lane's nearest neighbour, and the room between them
      const gaps = lanes.map((l, i) => Math.min(...lanes.filter((_, j) => j !== i).map((m) => laneGap(l.line, m.line, pot))));
      step(60, () => B.struck);
      step(6);
      const w = shownWarnings();
      out[angry ? 'angry' : 'calm'] = { lanes: lanes.length, volumes: lanes.map((l) => l.volumes), filling: lanes.map((l) => +l.progress.toFixed(2)), gap: +Math.min(...gaps).toFixed(3), opens: B.openT > 0, gone: !w.floor.length && !w.volume.length };
      step(240, () => B.open === 0 && B.whipT < 0);
      B.state = 'idle'; B.stateT = 1e9;
    }
    const room = SK.width + body.radius * 2, good = (o, n) => o.lanes === n && o.volumes.every((v) => v >= 4) && o.filling.every((p) => p > 0.1) && o.gap > room && o.opens && o.gone;
    return ok(good(out.calm, 2) && good(out.angry, 3), { room: +room.toFixed(3), ...out });
  },
});
// --- the guarding vines: close to the heart, vines snap at the jelly
// hold the jelly on the bed `away` m (flat) in front of the Pothos's heart
function nearHeart(B, away) {
  const { world } = G(), player = holdJelly(), c = B.center(), at = V(c.x, c.y + 0.3, c.z - away);
  const hit = world.castAll(at, V(0, -1, 0), 1);
  player.position.set(at.x, hit ? hit.point.y : player.position.y, at.z); player.grounded = true;
  return player;
}
const snapping = (B) => B.snaps.filter((L) => L.on);
act3('pothos-vines-snap-when-close', {
  about: "Within about 28 cm of the Pothos's heart its vines guard it: one snaps at where the jelly is on a short straight lane with its own quick Warning (a floor strip with lane volumes, about 0.45 s), hits and knocks it away from the heart, and another follows while it stays. Farther out, none do.",
  setup() {},
  play() {
    const B = pothosFight(), hits = bossHits(), knocks = record('knockback'), GU = CONTENT.bosses.pothos.skills.guard, out = {};
    B.stateT = 1e9;                                       // (none of its turns: only the guard)
    const P = nearHeart(B, 0.2).position, c = B.center();
    let first = null, shown = 0, starts = 0;
    const was = B.snaps.map(() => Infinity);
    step(60 * 3, () => {
      B.snaps.forEach((L, i) => { if (L.on && L.t < was[i]) starts++; was[i] = L.on ? L.t : Infinity; });
      const strip = pothosFloor().find((f) => f.material.shape === 'strip');
      if (strip && !first) { const line = stripLine(strip); first = { off: +offLine(line, P).toFixed(3), volumes: volumePairs().filter(([, f]) => f === strip).length }; }
      if (strip && starts === 1) shown += 1 / 60;
      return false;
    });
    const k = knocks.find((e) => e.targetId === 'player'), away = k ? +(k.dir.x * (P.x - c.x) + k.dir.z * (P.z - c.z)).toFixed(3) : null;
    out.close = { first, shown: +shown.toFixed(2), starts, hits: hits.length, away };
    hits.length = 0;
    nearHeart(B, 0.45);
    step(60 * 2, () => snapping(B).length === 0);
    const h0 = hits.length;
    let any = 0;
    step(60 * 3, () => { any += snapping(B).length; return false; });
    out.far = { snaps: any, hits: hits.length - h0 };
    const C = out.close;
    return ok(C.first && C.first.off < 0.03 && C.first.volumes >= 1 && Math.abs(C.shown - GU.windup) < 0.1 && C.starts >= 3 && C.hits >= 2 && C.away > 0 && !out.far.snaps && !out.far.hits, out);
  },
});
act3('pothos-guards-hold-still-in-the-opening', {
  about: "The opening after a Vine Whip is the way in: a jelly right by the heart, where its vines snap at it, gets no new snap while the leaves are parted, and a bubble it blows at the heart then hurts it; before the whip the leaves stop that same bubble.",
  setup() {},
  play() {
    const B = pothosFight({ hurt: false }), out = {};
    onlyOurBubbles();
    B.stateT = 1e9;
    const P = nearHeart(B, 0.2).position, from = P.clone().setY(P.y + 0.05), shot = () => blowAt(B, from, B.center());
    out.before = shot();
    step(60, () => snapping(B).length > 0);
    out.snapsBefore = snapping(B).length > 0;
    // every snap that starts while the leaves are parted
    let started = 0;
    const start = B.startLane;
    stub(B, 'startLane', function (L, kind, ...rest) { if (kind === 'snap' && this.openT > 0) started++; return start.call(this, L, kind, ...rest); });
    B.begin('whip');
    B.stateT = 1e9;
    step(60, () => B.struck);
    step(20);
    out.open = shot();
    step(120, () => B.openT <= 0);
    out.startedInOpening = started;
    step(60);
    out.snapsAfter = snapping(B).length > 0;               // and they're back once the leaves close
    return ok(out.before.popped && out.before.lost === 0 && out.snapsBefore && !started && out.open.lost > 0 && out.snapsAfter, out);
  },
});
// --- the sweeping vine
act3('pothos-sweep-warning-and-hit', {
  about: "The Pothos's sweep: its Warning is a wedge on the bed in front of the plant with low arc volumes over it, filling together for about 0.8 s; then a vine sweeps across it: a jelly standing in it is hit once and knocked, one near the top of its jump (feet 12 cm up) isn't. The Warning is gone after, and starting one builds no new shader.",
  setup() {},
  play() {
    const B = pothosFight(), { APT, batcher, world } = G(), hits = bossHits(), knocks = record('knockback'), out = {};
    const compile = () => { batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); };
    const player = holdJelly(), h = B.position, SK = CONTENT.bosses.pothos.skills.sweep;
    const at = V(h.x + 0.05, h.y + 0.4, h.z - 0.5), ground = world.castAll(at, V(0, -1, 0), 1).point.y;
    B.stateT = 1e9;
    compile();
    const programs = APT.renderer.info.programs.length;
    for (const up of [0, JUMP_FEET]) {
      player.position.set(at.x, ground + up, at.z); player.grounded = !up;
      const h0 = hits.length, k0 = knocks.length;
      B.begin('sweep');
      B.stateT = 1e9;
      step(6);
      const wedge = () => pothosFloor().find((f) => f.material.shape === 'wedge');
      const pairs = volumePairs().filter(([, f]) => f === wedge()), p0 = pairs.map(([v]) => v.material.progress);
      step(6);
      let shown = 12 / 60, hitAt = null;
      const filling = pairs.length > 0 && pairs.every(([v, f], i) => Math.abs(v.material.progress - f.material.progress) < 1e-6 && v.material.progress > p0[i]);
      if (!up) { compile(); out.newShaders = APT.renderer.info.programs.length - programs; }
      step(60 * 2, () => { if (wedge() && wedge().material.progress < 1) shown += 1 / 60; if (hitAt == null && hits.length > h0) hitAt = B.sweepT; return B.sweepT < 0; });
      step(3);
      const w = shownWarnings();
      out[up ? 'jumping' : 'standing'] = { volumes: pairs.length, filling, shown: +shown.toFixed(2), hits: hits.slice(h0).map((d) => d.amount), knocked: knocks.slice(k0).some((e) => e.targetId === 'player'), hitAt: hitAt && +hitAt.toFixed(2), gone: !w.floor.length && !w.volume.length };
      B.state = 'idle'; B.stateT = 1e9;
    }
    const s = out.standing, j = out.jumping;
    return ok(s.volumes >= 4 && s.filling && Math.abs(s.shown - SK.windup) < 0.1 && s.hits.length === 1 && s.hits[0] === SK.dmg && s.knocked && s.hitAt > SK.windup && s.gone
      && !j.hits.length && !j.knocked && j.gone && out.newShaders === 0, out);
  },
});
act3('pothos-angry-rests-less', {
  about: 'Below 45% Health the Pothos pauses less between its attacks than above it.',
  setup() {},
  play() {
    const B = pothosFight(), out = {};
    holdJelly();
    for (const angry of [false, true]) {
      if (angry) pothosAngry(B);
      B.begin('cutting');
      step(60 * 3, () => B.state === 'idle');
      const t0 = B.t;
      step(60 * 6, () => B.state !== 'idle');
      out[angry ? 'angry' : 'calm'] = +(B.t - t0).toFixed(2);
      B.state = 'idle'; B.stateT = 1e9;
    }
    return ok(out.angry < out.calm - 0.5, out);
  },
});
act3('pothos-angry-heart-burns-hot', {
  about: "Turning angry shows: the Pothos's heart beats faster, its glow turns from green to a hot orange and its leaves smoulder, with no new light and no new shader.",
  setup() {},
  play() {
    const B = pothosFight(), { APT, batcher } = G(), compile = () => { batcher.sync(); APT.renderer.compile(APT.scene, APT.camera); };
    holdJelly();
    B.stateT = 1e9;
    compile();
    const programs = APT.renderer.info.programs.length, lights = [];
    APT.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const look = () => { const c = B.model.heart.material.emissive, l = B.model.leaves.material.emissive; return { r: +c.r.toFixed(2), g: +c.g.toFixed(2), leaves: l.r > l.g ? 'hot' : 'green' }; };
    // how many beats in 3 s (the heart's scale peaks)
    const beats = () => { let n = 0, prev = 0, rising = false; for (let i = 0; i < 180; i++) { step(1); const s = B.model.heart.scale.x; if (s < prev && rising) n++; rising = s > prev; prev = s; } return n; };
    const calm = { ...look(), beats: beats() };
    pothosAngry(B);
    step(60);
    const angry = { ...look(), beats: beats() };
    compile();
    let nLights = 0; APT.scene.traverse((o) => { if (o.isLight) nLights++; });
    const out = { calm, angry, newShaders: APT.renderer.info.programs.length - programs, newLights: nLights - lights.length };
    return ok(calm.g > calm.r && angry.r > angry.g && calm.leaves === 'green' && angry.leaves === 'hot' && angry.beats > calm.beats && out.newShaders === 0 && out.newLights === 0, out);
  },
});
// --- the dragonfly phase: below 70% the Pothos lets 4 dragonflies out and closes its leaves over its heart
const pothosGuards = () => G().enemies.list.filter((e) => e.type === 'dragonfly' && !e.dead);
// does a leaf stand between a spot in front of the heart (where the jelly looks from) and the heart?
function heartCovered(B) {
  const c = B.center(), from = c.clone().add(V(0, 0.03, -0.3)), dir = c.clone().sub(from), far = dir.length();
  B.holder.updateMatrixWorld(true);
  return new THREE.Raycaster(from, dir.normalize(), 0, far - B.r).intersectObject(B.model.leaves).length > 0;
}
const toSwarm = (B) => { B.hp = B.maxHp * 0.69; step(60 * 3, () => B.state === 'swarm' && pothosGuards().length === 4); step(60); };
act3('pothos-dragonflies-shield-its-heart', {
  about: 'The first time the Pothos drops below 70% Health, 4 dragonflies come out of the plant and its leaves close over its heart: hits on the heart do nothing, and the boss bar says SHIELDED.',
  setup() {},
  play() {
    const B = pothosFight({ hurt: false });
    pothosOpen(B);                                        // (the moment after a Vine Whip: the heart in view)
    const openBefore = !heartCovered(B);
    toSwarm(B);
    const flies = pothosGuards().length, hp = B.hp;
    B.damage(100);
    const immune = B.hp === hp && B.shielded;
    const bar = document.querySelector('#hud .boss')?.textContent || '', says = /SHIELDED/.test(bar);
    const covered = heartCovered(B);
    return ok(flies === 4 && immune && says && openBefore && covered, { flies, immune, bar, openBefore, covered });
  },
});
act3('pothos-dragonflies-killed-lift-the-shield', {
  about: 'Kill all 4 of the Pothos\'s dragonflies and its leaves open again: its heart can be hurt, and the boss bar no longer says SHIELDED.',
  setup() {},
  play() {
    const B = pothosFight({ hurt: false }), { enemies } = G();
    toSwarm(B);
    const flies = pothosGuards();
    for (const e of flies.slice(0, 3)) enemies.applyDamage(e, 1e5);
    step(30);
    const stillShielded = B.shielded;
    enemies.applyDamage(flies[3], 1e5);
    step(60 * 1.5);
    const hp = B.hp;
    B.damage(50);
    const hurt = B.hp === hp - 50, bar = document.querySelector('#hud .boss')?.textContent || '';
    pothosOpen(B);                                        // (its next Vine Whip opens it as before)
    const covered = heartCovered(B);
    return ok(flies.length === 4 && stillShielded && !B.shielded && hurt && !/SHIELDED/.test(bar) && !covered, { flies: flies.length, stillShielded, hurt, bar, covered });
  },
});
act3('pothos-shield-lifts-after-30-s', {
  about: 'The Pothos\'s shield lifts after 30 s even with its dragonflies still flying: the leaves open and its heart can be hurt again.',
  setup() {},
  play() {
    const B = pothosFight({ hurt: false });
    toSwarm(B);
    step(60 * 27);
    const at28 = B.shielded;
    step(60 * 3.5);
    const alive = pothosGuards().length, hp = B.hp;
    B.damage(50);
    return ok(at28 && !B.shielded && alive > 0 && B.hp === hp - 50, { at28, shielded: B.shielded, alive });
  },
});
act3('pothos-dragonflies-come-once', {
  about: 'The dragonflies come once a fight: after the shield lifts, dropping further below 70% summons no more.',
  setup() {},
  play() {
    const B = pothosFight({ hurt: false }), { enemies } = G();
    toSwarm(B);
    for (const e of pothosGuards()) enemies.applyDamage(e, 1e5);
    step(60 * 1.5);
    B.hp = B.maxHp * 0.5;
    step(60 * 6);
    const again = pothosGuards().length;
    return ok(again === 0 && !B.shielded && B.state !== 'swarm', { again, shielded: B.shielded, state: B.state });
  },
});
act3('camera-fixed-view-fades-what-blocks', cameraStory([], 'Bed_5'));
act3('camera-fight-view-on-the-bed', {
  about: 'In the Pothos fight the camera holds its fight view (farther and higher, look.css) all over the bed: same tilt and distance at every spot and heading, no snaps while turning, nothing solid left between it and the jelly (the arena walls and the headboard fade), and no shader built on the spot.',
  setup() {},
  play() {
    const B = pothosFight(), { run, tpc } = G();
    B.stateT = 1e9;                                       // no attacks while it looks round
    step(150);                                            // the fight view, eased in
    const A = run.stage.boss, [x0, , z0] = A.arenaMin, [x1, , z1] = A.arenaMax, y = A.playerStart[1] + 0.05;
    const spots = [[A.playerStart[0], y, A.playerStart[2]], [x0 + 0.1, y, z0 + 0.1], [x1 - 0.1, y, z0 + 0.1], [x0 + 0.1, y, (z0 + z1) / 2], [x1 - 0.1, y, (z0 + z1) / 2], [(x0 + x1) / 2, y, (z0 + z1) / 2]];
    const view = { d: +tpc.currentDistance.toFixed(3), p: +tpc.viewPitch.toFixed(3) };
    const now = cameraTour(spots);
    return ok(Math.abs(view.d - LOOK.num('pothos-camera-distance', 0.95)) < 0.02 && Math.abs(view.p - LOOK.num('pothos-camera-tilt', 0.785)) < 0.03 && now.moved === 0 && now.blocked === 0 && now.jumps === 0 && now.newShaders === 0 && run.phase === 'boss', { view, ...now });
  },
});
act3('attacks-every-warning-has-volume', {
  about: 'Every Pothos attack in turn (Vine Whips, the sweep, Aerial roots, its guarding vines\' snaps; its Cuttings are their own), then each of its Bugs that warns (a Cutting\'s countdown, a Sap sprout\'s sap lob, an Aerial root\'s drop): each Warning shows its floor shape with its volume over it (a Cutting\'s countdown is a floor circle only), filling together; both go after the hit; none builds a new shader.',
  setup() { fresh({ bubbles: false, lash: false }); },
  play() { return everyAttack(3); },
});
