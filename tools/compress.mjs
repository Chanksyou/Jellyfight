// Shrinks assets/apartment.glb: welds duplicate vertices, then meshopt-compresses the
// geometry (EXT_meshopt_compression, decoded in the game by three's MeshoptDecoder).
// Node names are kept, since stages look objects up by name and doors by "door-<id>".
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

export async function compress(file) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
  const doc = await io.read(file);
  await doc.transform(dedup(), weld(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(file, doc);
}
