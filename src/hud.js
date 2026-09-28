// On-screen HUD: hearts, stamina bar, name, minimap of the real floor plan, room name, toasts.
const HEART = 'M12 21s-7.5-4.6-10-9.3C.4 8.6 2 4.5 5.8 4.1c2.3-.2 4.2 1 6.2 3.3 2-2.3 3.9-3.5 6.2-3.3 3.8.4 5.4 4.5 3.8 7.6C19.5 16.4 12 21 12 21z';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
#hud .tl { position: absolute; left: 18px; top: 16px; }
#hud .name { font-weight: 700; font-size: 15px; letter-spacing: .02em; text-shadow: 0 1px 3px #000a; margin: 0 0 4px 2px; }
#hud .hearts { display: flex; gap: 3px; filter: drop-shadow(0 1px 2px #0008); }
#hud .hearts svg { width: 26px; height: 26px; }
#hud .stam { margin-top: 8px; width: 170px; height: 12px; border: 2px solid #f4f1e8; border-radius: 8px; background: #0006; overflow: hidden; box-shadow: 0 1px 3px #0008; transition: opacity .4s; }
#hud .stam i { display: block; height: 100%; width: 100%; background: linear-gradient(#7dff6a, #2fb83a); transform-origin: left; }
#hud .stam.tired i { background: linear-gradient(#ffb36a, #d9642f); }
#hud .stam.full { opacity: .35; }
#hud .map { position: absolute; right: 18px; bottom: 18px; width: 190px; height: 190px; }
#hud .room { position: absolute; right: 18px; bottom: 214px; width: 190px; text-align: center; font-weight: 600; font-size: 14px; text-shadow: 0 1px 3px #000a; transition: opacity .5s; }
#hud .toast { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); font-size: 22px; font-weight: 700; text-shadow: 0 2px 6px #000c; opacity: 0; transition: opacity .3s; white-space: nowrap; }
#hud .toast.on { opacity: 1; }
#hud .hurt { position: absolute; inset: 0; box-shadow: inset 0 0 120px 30px #ff2020; opacity: 0; transition: opacity .5s; }
#hud .hurt.on { opacity: .55; transition: none; }
#hud .debug { position: absolute; left: 18px; bottom: 14px; font: 11px/1.4 ui-monospace, monospace; text-shadow: 0 1px 2px #000; opacity: .8; }
`;

export class Hud {
  constructor(plan) {
    this.plan = plan; // [[name, [[x, z], ...]], ...]
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `<style>${CSS}</style>
      <div class="tl"><div class="name"></div><div class="hearts"></div><div class="stam full"><i></i></div></div>
      <div class="room"></div><canvas class="map"></canvas>
      <div class="toast"></div><div class="hurt"></div><div class="debug" hidden></div>`;
    this.$ = (s) => this.el.querySelector(s);
    this.map = this.$('.map');
    this.ctx = this.map.getContext('2d');
    this.hp = -1;
    this.room = null;

    // Fit the floor plan into the minimap
    const pts = plan.flatMap(([, poly]) => poly);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }

  mount(parent) { parent.appendChild(this.el); }

  setName(name) { this.$('.name').textContent = name; }

  setHealth(hp, max) {
    if (hp === this.hp && max === this.max) return;
    if (hp < this.hp) {
      const h = this.$('.hurt');
      h.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
    }
    this.hp = hp;
    this.max = max;
    // 2 hp per heart
    let html = '';
    for (let i = 0; i < max / 2; i++) {
      const fill = Math.max(0, Math.min(2, hp - i * 2));
      html += `<svg viewBox="0 0 24 24"><defs><clipPath id="hc${i}"><rect x="0" y="0" width="${fill * 12}" height="24"/></clipPath></defs>
        <path d="${HEART}" fill="#3a0d12" stroke="#fff4" stroke-width="1.2"/>
        <path d="${HEART}" fill="#ff3b4e" clip-path="url(#hc${i})"/>
        <path d="M7 7.5c1-.9 2.2-1 3 0" stroke="#fff9" stroke-width="1.6" fill="none" stroke-linecap="round" clip-path="url(#hc${i})"/></svg>`;
    }
    this.$('.hearts').innerHTML = html;
  }

  setStamina(frac, tired) {
    const s = this.$('.stam');
    s.firstChild.style.transform = `scaleX(${frac})`;
    s.classList.toggle('tired', tired);
    s.classList.toggle('full', frac >= 0.999);
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

  // position, facing (radians, 0 = +z), cameraYaw
  update(pos, facing, cameraYaw) {
    const room = this.roomAt(pos.x, pos.z);
    if (room !== this.room) {
      this.room = room;
      const r = this.$('.room');
      r.textContent = room || '';
    }

    const c = this.map, g = this.ctx;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = 190 * dpr;
    if (c.width !== W) { c.width = c.height = W; }
    const b = this.bounds, pad = 14 * dpr;
    const s = Math.min((W - 2 * pad) / (b.x1 - b.x0), (W - 2 * pad) / (b.z1 - b.z0));
    const ox = (W - (b.x1 - b.x0) * s) / 2, oz = (W - (b.z1 - b.z0) * s) / 2;
    const X = (x) => ox + (x - b.x0) * s, Z = (z) => oz + (z - b.z0) * s;

    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(8, 20, 30, 0.45)';
    g.strokeStyle = 'rgba(8, 20, 30, 0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(1, 1, W - 2, W - 2, 12 * dpr);
    g.fill();
    for (const [name, poly] of this.plan) {
      g.beginPath();
      poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.closePath();
      const here = name === room;
      g.fillStyle = here ? 'rgba(90, 240, 230, 0.28)' : 'rgba(90, 240, 230, 0.1)';
      g.fill();
      g.lineWidth = 2 * dpr;
      g.strokeStyle = here ? '#7ff6ee' : 'rgba(127, 246, 238, 0.55)';
      g.shadowColor = '#3ff';
      g.shadowBlur = here ? 8 * dpr : 0;
      g.stroke();
      g.shadowBlur = 0;
    }

    // camera view cone
    const px = X(pos.x), pz = Z(pos.z);
    const ca = Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw));
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.beginPath();
    g.moveTo(px, pz);
    g.arc(px, pz, 34 * dpr, ca - 0.5, ca + 0.5);
    g.closePath();
    g.fill();

    // player arrow
    g.save();
    g.translate(px, pz);
    g.rotate(Math.atan2(Math.cos(facing), Math.sin(facing)));
    g.beginPath();
    g.moveTo(9 * dpr, 0);
    g.lineTo(-6 * dpr, -6 * dpr);
    g.lineTo(-3 * dpr, 0);
    g.lineTo(-6 * dpr, 6 * dpr);
    g.closePath();
    g.fillStyle = '#ffd23a';
    g.strokeStyle = '#c21d1d';
    g.lineWidth = 2 * dpr;
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
