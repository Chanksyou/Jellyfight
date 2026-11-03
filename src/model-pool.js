// Models become reusable only after their death effects leave the scene.
export class ModelPool {
  constructor() { this.entries = []; }
  take(key, make) {
    let p = this.entries.find(p => p.key === key && p.free && !p.root.parent && p.pose.every(s => !s.o.parent || s.o.parent === s.parent));
    if (!p) {
      const value = make(), root = value.root, pose = [];
      root.traverse(o => pose.push({ o, parent: o.parent, children: [...o.children], position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone(), visible: o.visible, material: o.material }));
      p = { key, value, root, pose, free: false }; if (this.entries.filter(e => e.key === key).length < 128) this.entries.push(p);
    } else {
      for (const s of p.pose) {
        for (const child of [...s.o.children]) if (!s.children.includes(child)) s.o.remove(child);
        if (s.parent && s.o.parent !== s.parent) s.parent.add(s.o);
        s.o.position.copy(s.position); s.o.quaternion.copy(s.quaternion); s.o.scale.copy(s.scale); s.o.visible = s.visible;
        if (s.material) { s.o.material = s.material; delete s.o.userData.mat; }
      }
    }
    p.free = false;
    return p;
  }
  release(p) { if (p) p.free = true; }
}
