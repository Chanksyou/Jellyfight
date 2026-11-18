// The prop library: things the layout editor can add to a room (content/props.kdl), baked into one
// small file, assets/props.glb (tools/props.mjs). The file is only downloaded when something asks
// for a prop: an act whose layout uses one, or the editor's Add drawer.
//
// loadProps(['monstera', …]) → { monstera: Object3D template }. Each template is one group named
// by the prop's id, standing on y=0 at the origin, with at most two meshes (pot/stems and leaves,
// coloured per vertex). Clone it for each copy placed; clones share geometry and materials.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fetchModel, floatPositions, meshoptDecoder } from './apartment.js';

let file = null;   // the one download, shared by every caller

function loadFile() {
  return file ||= (async () => {
    const decoder = await meshoptDecoder();
    const buffer = await fetchModel(`assets/props${decoder ? '' : '-q'}.glb`, null, !!decoder);
    const loader = new GLTFLoader();
    if (decoder) loader.setMeshoptDecoder(decoder);
    const { scene } = await loader.parseAsync(buffer, '');
    const light = window.APT?.meta?.envMapIntensity ?? 1;   // lit like the apartment's own surfaces
    scene.traverse((o) => {
      if (!o.isMesh) return;
      floatPositions(o.geometry);   // the collision BVH and the static batches need plain floats
      for (const m of [].concat(o.material)) m.envMapIntensity = light;
    });
    return scene;
  })().catch((e) => { file = null; throw e; });   // a failed download can be tried again
}

export async function loadProps(ids) {
  const scene = await loadFile(), out = {};
  for (const id of ids) {
    const t = scene.getObjectByName(id);
    if (!t) throw new Error(`props: no prop called "${id}" in assets/props.glb (content/props.kdl lists them; node tools/props.mjs bakes the file)`);
    out[id] = t;
  }
  return out;
}
