// Shrinks the baked apartment. Writes two versions of the same model:
//  - apartment.glb:   meshopt-compressed (~5 MB), decoded in the game by three's WebAssembly MeshoptDecoder
//  - apartment-q.glb: quantized only (~9 MB), no decoder needed; used if WebAssembly is blocked
// Both weld duplicate vertices first. Node names are kept, since stages look objects up by
// name and doors by "door-<id>".
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

export async function compress(file, fallbackFile) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
  const base = [dedup(), weld(), prune({ keepLeaves: true })];
  const plain = await io.read(file);
  await plain.transform(...base, quantize());
  await io.write(fallbackFile, plain);
  const small = await io.read(file);
  await small.transform(...base, meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(file, small);
}
