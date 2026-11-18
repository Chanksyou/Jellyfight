// The prop library: things the layout editor can add to a room that the apartment doesn't have
// (layout.js `prop:<id>#n` entries). loadProps(ids) gives { id: Object3D template } for the ids it
// has; layout.js clones a template per entry. Called only when a layout uses a prop.
// shortcut: no props yet, so every id is missing; the plant library (content/props.kdl) fills this in.
export async function loadProps(ids) { return {}; }
