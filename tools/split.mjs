// Splits the baked apartment into one file per act, so the game only downloads the rooms the
// current act is played in: node tools/split.mjs (export.mjs runs it after a re-bake).
//
//   assets/apartment-act1.glb   the living room (and kitchen strip), plus the whole shell (walls,
//                               floors, ceilings of every room) and the doors, so every view out of
//                               the living room is solid
//   assets/apartment-act2.glb   what's in the hallway, the bathroom and the hall closets
//   assets/apartment-act3.glb   what's in the bedroom
//
// Each also gets a -q twin (no meshopt compression) for browsers without WebAssembly, like
// apartment.glb / apartment-q.glb. An object goes to the earliest act whose rooms it overlaps
// (floor plan: assets/apartment.json). The furniture keeps its node names, which is what the
// layout editor and stages look things up by.
import { NodeIO, Logger, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, meshopt, cloneDocument } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ACTS = { 'Living room': 1, Hallway: 2, Bathroom: 2, 'Laundry closet': 2, 'Coat closet': 2, Bedroom: 3 };
const ALWAYS_ACT1 = /^(Shell|door-)/;   // the rooms' walls and floors, and the doors between them

const inPoly = (x, z, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

export async function split(assets) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
  const plan = JSON.parse(fs.readFileSync(path.join(assets, 'apartment.json'), 'utf8')).plan;
  const source = await io.read(path.join(assets, 'apartment-q.glb'));   // quantized, not meshopt-packed
  const app = source.getRoot().listNodes().find((n) => n.getName() === 'Apartment');

  // which act each of the Apartment's children belongs to (by index: names are what the game keeps)
  const actOf = app.listChildren().map((n) => {
    if (ALWAYS_ACT1.test(n.getName())) return 1;
    const { min, max } = getBounds(n);
    if (!Number.isFinite(min[0])) return 1;
    let best = Infinity;
    for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
      const x = min[0] + ((max[0] - min[0]) * i) / 4, z = min[2] + ((max[2] - min[2]) * k) / 4;
      for (const [room, poly] of plan) if (ACTS[room] && inPoly(x, z, poly)) best = Math.min(best, ACTS[room]);
    }
    return Number.isFinite(best) ? best : 1;
  });

  // the floor plan gets the acts, and each light the act it shines in, so the game only loads
  // (and lights) what the current act needs
  const metaFile = path.join(assets, 'apartment.json'), meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const actAt = (x, z) => { let best = Infinity; for (const [room, poly] of plan) if (ACTS[room] && inPoly(x, z, poly)) best = Math.min(best, ACTS[room]); return Number.isFinite(best) ? best : 1; };
  meta.acts = { act1: [], act2: [], act3: [] };
  for (const [room, act] of Object.entries(ACTS)) meta.acts['act' + act].push(room);
  for (const L of meta.lights) L.act = L.position && (L.type === 'PointLight' || L.type === 'SpotLight') ? 'act' + actAt(L.position[0], L.position[2]) : 'act1';
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));

  const report = {};
  for (const act of [1, 2, 3]) {
    const doc = cloneDocument(source);
    const a = doc.getRoot().listNodes().find((n) => n.getName() === 'Apartment');
    const drop = (n) => { n.listChildren().forEach(drop); n.dispose(); };   // the node, its meshes go with prune
    a.listChildren().forEach((n, i) => { if (actOf[i] !== act) drop(n); });
    await doc.transform(prune());
    const kept = a.listChildren().map((n) => n.getName());
    const q = path.join(assets, `apartment-act${act}-q.glb`), small = path.join(assets, `apartment-act${act}.glb`);
    await io.write(q, doc);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(small, doc);
    report[`act${act}`] = { objects: kept.length, mb: +(fs.statSync(small).size / 1e6).toFixed(2), fallbackMb: +(fs.statSync(q).size / 1e6).toFixed(2), sample: kept.filter((k) => !ALWAYS_ACT1.test(k)).slice(0, 8) };
  }
  report.lights = Object.fromEntries(['act1', 'act2', 'act3'].map((a) => [a, meta.lights.filter((L) => L.act === a).length]));
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
  console.log(JSON.stringify(await split(assets), null, 1));
}
