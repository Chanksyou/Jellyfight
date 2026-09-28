// On-screen HUD: moisture, level and dew, night clock, Moon Drops, treasures,
// minimap of the real floor plan (with the Moon Drop marker), boss bar, hints, toasts.
const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
#hud .tl { position: absolute; left: 18px; top: 16px; width: 240px; }
#hud .bar { position: relative; height: 18px; border: 2px solid #f4f1e8; border-radius: 10px; background: #0007; overflow: hidden; box-shadow: 0 1px 4px #0009; }
#hud .bar i { position: absolute; inset: 0; transform-origin: left; transition: transform .15s; }
#hud .bar b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 700; text-shadow: 0 1px 2px #000; }
#hud .moist i { background: linear-gradient(#8fe0ff, #2a8fe0); }
#hud .xp { margin-top: 6px; height: 10px; }
#hud .xp i { background: linear-gradient(#b8ff9a, #3fbf4a); }
#hud .row { display: flex; gap: 12px; align-items: center; margin-top: 7px; font-weight: 700; font-size: 14px; text-shadow: 0 1px 3px #000b; }
#hud .items { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 8px; }
#hud .items span { width: 28px; height: 28px; display: grid; place-items: center; font-size: 17px; background: #0008; border: 1px solid #ffffff40; border-radius: 8px; }
#hud .tc { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); text-align: center; text-shadow: 0 1px 4px #000c; }
#hud .clock { font-size: 22px; font-weight: 800; letter-spacing: .02em; }
#hud .clock.dry { color: #ffb36a; }
#hud .stage { font-size: 12px; opacity: .85; letter-spacing: .08em; text-transform: uppercase; }
#hud .drops { margin-top: 4px; font-size: 15px; font-weight: 700; }
#hud .boss { position: absolute; left: 50%; top: 116px; transform: translateX(-50%); width: min(460px, 70vw); text-align: center; }
#hud .boss .bar { height: 14px; border-color: #ffd9c9; }
#hud .boss i { background: linear-gradient(#ff8a6a, #c2312a); }
#hud .boss .nm { font-weight: 800; letter-spacing: .12em; font-size: 13px; margin-bottom: 4px; text-shadow: 0 1px 3px #000; }
#hud .map { position: absolute; right: 18px; bottom: 18px; width: 200px; height: 200px; }
#hud .room { position: absolute; right: 18px; bottom: 222px; width: 200px; text-align: center; font-weight: 600; font-size: 13px; text-shadow: 0 1px 3px #000a; }
#hud .hint { position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%); font-size: 14px; font-weight: 600; background: #0009; padding: 6px 14px; border-radius: 999px; opacity: 0; transition: opacity .2s; }
#hud .hint.on { opacity: 1; }
#hud kbd { background: #fff3; border: 1px solid #fff6; border-radius: 4px; padding: 0 5px; font: inherit; }
#hud .toast { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); font-size: 24px; font-weight: 800; text-shadow: 0 2px 6px #000c; opacity: 0; transition: opacity .3s; white-space: nowrap; }
#hud .toast.on { opacity: 1; }
#hud .hurt { position: absolute; inset: 0; box-shadow: inset 0 0 120px 30px #ff6a20; opacity: 0; transition: opacity .5s; }
#hud .hurt.on { opacity: .5; transition: none; }
#hud .debug { position: absolute; left: 18px; bottom: 14px; font: 11px/1.4 ui-monospace, monospace; text-shadow: 0 1px 2px #000; opacity: .8; }
/* phones: smaller, and keep the bottom corners free for the thumbs */
@media (max-height: 520px), (max-width: 700px) {
  #hud .tl { left: calc(env(safe-area-inset-left, 0px) + 10px); top: calc(env(safe-area-inset-top, 0px) + 8px); width: 160px; }
  #hud .bar { height: 14px; border-width: 1.5px; }
  #hud .bar b { font-size: 10px; }
  #hud .xp { height: 7px; margin-top: 4px; }
  #hud .row { font-size: 12px; margin-top: 4px; gap: 8px; }
  #hud .items span { width: 22px; height: 22px; font-size: 13px; border-radius: 6px; }
  #hud .tc { top: calc(env(safe-area-inset-top, 0px) + 6px); }
  #hud .clock { font-size: 16px; }
  #hud .stage { font-size: 9.5px; }
  #hud .drops { font-size: 12px; margin-top: 1px; }
  #hud .boss { top: 70px; }
  #hud .toast { font-size: 17px; top: 30%; }
  #hud .hint { font-size: 12.5px; bottom: 16px; }
}
body.touch #hud .map { top: calc(env(safe-area-inset-top, 0px) + 60px); bottom: auto; right: calc(env(safe-area-inset-right, 0px) + 10px); width: 118px; height: 118px; }
body.touch #hud .room { top: calc(env(safe-area-inset-top, 0px) + 180px); bottom: auto; right: calc(env(safe-area-inset-right, 0px) + 10px); width: 118px; font-size: 11px; }
body.touch #hud .hint { bottom: calc(env(safe-area-inset-bottom, 0px) + 124px); }
`;

export class Hud {
  constructor(plan) {
    this.plan = plan; // [[name, [[x, z], ...]], ...] for the rooms in this stage
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `<style>${CSS}</style>
      <div class="tl">
        <div class="bar moist"><i></i><b></b></div>
        <div class="bar xp"><i></i></div>
        <div class="row"><span class="lvl"></span><span class="dew"></span></div>
        <div class="items"></div>
      </div>
      <div class="tc"><div class="stage"></div><div class="clock"></div><div class="drops"></div></div>
      <div class="boss" hidden><div class="nm"></div><div class="bar"><i></i></div></div>
      <div class="room"></div><canvas class="map"></canvas>
      <div class="hint"></div><div class="toast"></div><div class="hurt"></div><div class="debug" hidden></div>`;
    this.$ = (s) => this.el.querySelector(s);
    this.map = this.$('.map');
    this.ctx = this.map.getContext('2d');
    this.room = undefined;
    this.cache = {};
    const pts = plan.flatMap(([, poly]) => poly);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }

  mount(parent) { parent.appendChild(this.el); }

  set(key, sel, fn) { // only touch the DOM when a value changes
    const v = fn();
    if (this.cache[key] === v) return;
    this.cache[key] = v;
    this.$(sel).innerHTML = v;
  }

  setMoisture(v, max) {
    if (this.cache.hp !== undefined && v < this.cache.hp - 0.01) {
      const h = this.$('.hurt');
      h.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
    }
    this.cache.hp = v;
    this.$('.moist i').style.transform = `scaleX(${Math.max(0, v / max)})`;
    this.set('hpText', '.moist b', () => `💧 ${Math.ceil(v)} / ${Math.round(max)}`);
  }

  setXp(level, xp, need, purse) {
    this.$('.xp i').style.transform = `scaleX(${Math.min(1, xp / need)})`;
    this.set('lvl', '.lvl', () => `Lv ${level}`);
    this.set('dew', '.dew', () => `💧 ${purse} dew`);
  }

  setItems(items) {
    this.set('items', '.items', () => items.map((t) => `<span title="${t.name}: ${t.text}">${t.icon}</span>`).join(''));
  }

  setClock(text, dry) {
    this.set('clock', '.clock', () => text);
    this.$('.clock').classList.toggle('dry', dry);
  }
  setStage(text) { this.set('stage', '.stage', () => text); }
  setDrops(n, total, boss) { this.set('drops', '.drops', () => (boss ? '' : n >= total ? '🌙 The moon is calling…' : `🌙 Moon Drops ${n} / ${total}`)); }

  setBoss(name, frac) {
    const b = this.$('.boss');
    b.hidden = name == null;
    if (name == null) return;
    this.set('bossName', '.boss .nm', () => name.toUpperCase());
    this.$('.boss i').style.transform = `scaleX(${Math.max(0, frac)})`;
  }

  hint(html) {
    const h = this.$('.hint');
    if (html) this.set('hint', '.hint', () => html);
    h.classList.toggle('on', !!html);
  }

  toast(text, ms = 1800) {
    const t = this.$('.toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  setDebug(text) {
    const d = this.$('.debug');
    d.hidden = !text;
    if (text) d.textContent = text;
  }

  roomAt(x, z) {
    for (const [name, poly] of this.plan) if (inPoly(x, z, poly)) return name;
    return null;
  }

  // markers: [{ x, y, z, color, big }]; player y is used to show "above / below"
  update(pos, facing, cameraYaw, markers = []) {
    const room = this.roomAt(pos.x, pos.z);
    if (room !== this.room) { this.room = room; this.$('.room').textContent = room || ''; }

    const c = this.map, g = this.ctx;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = 200 * dpr;
    if (c.width !== W) { c.width = c.height = W; }
    const b = this.bounds, pad = 14 * dpr;
    const s = Math.min((W - 2 * pad) / (b.x1 - b.x0), (W - 2 * pad) / (b.z1 - b.z0));
    const ox = (W - (b.x1 - b.x0) * s) / 2, oz = (W - (b.z1 - b.z0) * s) / 2;
    const X = (x) => ox + (x - b.x0) * s, Z = (z) => oz + (z - b.z0) * s;

    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(8, 20, 30, 0.5)';
    g.beginPath();
    g.roundRect(1, 1, W - 2, W - 2, 12 * dpr);
    g.fill();
    for (const [name, poly] of this.plan) {
      g.beginPath();
      poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.closePath();
      const here = name === room;
      g.fillStyle = here ? 'rgba(90, 240, 230, 0.26)' : 'rgba(90, 240, 230, 0.09)';
      g.fill();
      g.lineWidth = 2 * dpr;
      g.strokeStyle = here ? '#7ff6ee' : 'rgba(127, 246, 238, 0.5)';
      g.stroke();
    }

    // markers (Moon Drop, treasures)
    const t = performance.now() / 1000;
    for (const m of markers) {
      const mx = X(m.x), mz = Z(m.z);
      g.fillStyle = m.color;
      g.beginPath();
      g.arc(mx, mz, (m.big ? 5 + Math.sin(t * 4) * 1.2 : 3) * dpr, 0, Math.PI * 2);
      g.fill();
      if (m.big) {
        g.strokeStyle = m.color;
        g.lineWidth = 1.5 * dpr;
        g.beginPath();
        g.arc(mx, mz, (9 + (t * 8) % 8) * dpr, 0, Math.PI * 2);
        g.globalAlpha = 1 - ((t * 8) % 8) / 8;
        g.stroke();
        g.globalAlpha = 1;
        // height difference: ▲ above you, ▼ below you
        const dy = m.y - pos.y;
        if (Math.abs(dy) > 0.1) {
          g.font = `700 ${11 * dpr}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillStyle = '#fff';
          g.strokeStyle = '#000a';
          g.lineWidth = 3 * dpr;
          const label = `${dy > 0 ? '▲' : '▼'} ${Math.abs(dy) < 1 ? Math.round(Math.abs(dy) * 100) + ' cm' : Math.abs(dy).toFixed(1) + ' m'}`;
          const ly = mz - 12 * dpr;
          g.strokeText(label, mx, ly);
          g.fillText(label, mx, ly);
        }
      }
    }

    // camera view cone
    const px = X(pos.x), pz = Z(pos.z);
    const ca = Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw));
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.beginPath();
    g.moveTo(px, pz);
    g.arc(px, pz, 30 * dpr, ca - 0.5, ca + 0.5);
    g.closePath();
    g.fill();

    // player arrow
    g.save();
    g.translate(px, pz);
    g.rotate(Math.atan2(Math.cos(facing), Math.sin(facing)));
    g.beginPath();
    g.moveTo(8 * dpr, 0);
    g.lineTo(-5 * dpr, -5 * dpr);
    g.lineTo(-2.5 * dpr, 0);
    g.lineTo(-5 * dpr, 5 * dpr);
    g.closePath();
    g.fillStyle = '#ff8ad0';
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5 * dpr;
    g.stroke();
    g.fill();
    g.restore();
  }
}

function inPoly(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export { inPoly };
