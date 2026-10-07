// On-screen HUD: moisture, level and XP, the boss countdown and night clock, treasures,
// minimap of the real floor plan, boss bar, hints, toasts.
import { bus } from './events.js';

const CSS = `
#hud .combo { position: absolute; right: 18px; top: 38%; text-align: right; color: hsl(var(--hue, 50) 100% 62%); text-shadow: 0 2px 6px #000a; pointer-events: none; }
#hud .combo[hidden] { display: none; }
#hud .combo b { display: block; font: 900 44px/1 system-ui, sans-serif; transform-origin: right center; }
#hud .combo span { font: 700 13px system-ui, sans-serif; opacity: .9; }
#hud .combo i { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: currentColor; transform-origin: right; }
#hud .combo.punch b { animation: jf-punch .22s ease-out; }
@keyframes jf-punch { 0% { transform: scale(1.6) rotate(-6deg); } 100% { transform: scale(1) rotate(0); } }
body.touch #hud .combo { top: 30%; right: 12px; } body.touch #hud .combo b { font-size: 34px; }

#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
/* vitals: a level badge, the moisture bar with just its number, a thin gold line of XP under it */
#hud .tl { position: absolute; left: 18px; top: 16px; display: grid; grid-template-columns: auto 1fr; gap: 0 12px; align-items: center; width: 340px; }
#hud .lvl { grid-row: span 2; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font: 800 19px system-ui, sans-serif;
  background: #0d1220cc; box-shadow: inset 0 0 0 3px #ffd25a, 0 0 10px #ffd25a55; color: #ffe7a0; }
#hud .bar { position: relative; height: 20px; border-radius: 10px; background: #0d1220c0; overflow: hidden; box-shadow: 0 0 0 2px #ffffff40, 0 2px 8px #0008; }
#hud .bar i { position: absolute; inset: 0; transform-origin: left; transition: transform .15s; border-radius: inherit; }
#hud .moist i { background: linear-gradient(90deg, #3aa8ff, #7fe8ff); box-shadow: inset 0 -4px 0 #0002; }
#hud .moist.low i { background: linear-gradient(90deg, #ff5a5a, #ff9a7a); }
#hud .hpn { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font: 800 13px system-ui, sans-serif; color: #fff; text-shadow: 0 1px 2px #000; }
#hud .xp { height: 10px; margin-top: 6px; background: #0d1220b3; box-shadow: 0 0 0 1.5px #ffd25a55, 0 2px 6px #0008; }
#hud .xp i { background: linear-gradient(90deg, #f0b12a, #ffe27a); }
#hud .items { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
#hud .items span { width: 22px; height: 22px; display: grid; place-items: center; font-size: 14px; background: #0d122080; border-radius: 6px; }
#hud .items sub { font-size: 8px; font-weight: 800; }
/* top centre: how long until the boss */
#hud .tc { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); text-align: center; text-shadow: 0 1px 4px #000c; }
#hud .clock { font: 800 24px/1 system-ui, sans-serif; letter-spacing: .02em; font-variant-numeric: tabular-nums; }
#hud .clock.dry { color: #ff7a6a; }   /* the boss is almost here */
#hud .stage { font-size: 11px; opacity: .7; margin-top: 3px; letter-spacing: .04em; }
#hud .boss { position: absolute; left: 50%; top: 116px; transform: translateX(-50%); width: min(460px, 70vw); text-align: center; }
#hud .boss .bar { height: 14px; border-color: #ffd9c9; }
#hud .boss i { background: linear-gradient(#ff8a6a, #c2312a); }
#hud .boss.shield i { background: linear-gradient(#d6a8ff, #7a2ad0); }
#hud .boss.shield .bar { border-color: #d6a8ff; }
#hud .boss .nm { font-weight: 800; letter-spacing: .12em; font-size: 13px; margin-bottom: 4px; text-shadow: 0 1px 3px #000; }
/* an elite you're fighting: its name and health, under the clock */
#hud .elite { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); width: min(320px, 56vw); text-align: center; }
#hud .elite .bar { height: 12px; border-color: #ffe6a0; }
#hud .elite i { background: linear-gradient(#ffd86a, #e08a1a); }
#hud .elite .nm { font-weight: 800; letter-spacing: .1em; font-size: 12px; margin-bottom: 3px; text-shadow: 0 1px 3px #000; color: #ffe6a0; }
#hud .map { position: absolute; right: 18px; bottom: 18px; width: 285px; height: 285px; opacity: .88; }
#hud .hint { position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%); font-size: 14px; font-weight: 600; background: #0009; padding: 6px 14px; border-radius: 999px; opacity: 0; transition: opacity .2s; }
#hud .hint.on { opacity: 1; }
#hud kbd { background: #fff3; border: 1px solid #fff6; border-radius: 4px; padding: 0 5px; font: inherit; }
#hud .toast { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); font-size: 24px; font-weight: 800; text-shadow: 0 2px 6px #000c; opacity: 0; transition: opacity .3s; white-space: nowrap; }
#hud .toast.on { opacity: 1; }
#hud .hurt { position: absolute; inset: 0; box-shadow: inset 0 0 120px 30px #ff6a20; opacity: 0; transition: opacity .5s; }
#hud .hurt.on { opacity: .5; transition: none; }
#hud .debug { position: absolute; left: 18px; bottom: 14px; font: 11px/1.4 ui-monospace, monospace; white-space: pre; text-shadow: 0 1px 2px #000; opacity: .8; }
/* phones: smaller, and keep the bottom corners free for the thumbs */
@media (max-height: 520px), (max-width: 700px) {
  #hud .tl { left: calc(env(safe-area-inset-left, 0px) + 10px); top: calc(env(safe-area-inset-top, 0px) + 8px); width: 235px; gap: 0 8px; }
  #hud .lvl { width: 36px; height: 36px; font-size: 15px; }
  #hud .bar { height: 15px; }
  #hud .hpn { font-size: 11px; right: 7px; }
  #hud .xp { height: 7px; margin-top: 5px; }
  #hud .items { margin-top: 6px; gap: 3px; }
  #hud .items span { width: 18px; height: 18px; font-size: 11px; border-radius: 5px; }
  #hud .tc { top: calc(env(safe-area-inset-top, 0px) + 6px); }
  #hud .clock { font-size: 18px; }
  #hud .stage { font-size: 9.5px; margin-top: 2px; }
  #hud .boss { top: 70px; }
  #hud .toast { font-size: 17px; top: 30%; }
  #hud .hint { font-size: 12.5px; bottom: 16px; }
}
body.touch #hud .map { top: calc(env(safe-area-inset-top, 0px) + 60px); bottom: auto; right: calc(env(safe-area-inset-right, 0px) + 10px); width: 195px; height: 195px; }
body.touch #hud .hint { bottom: calc(env(safe-area-inset-bottom, 0px) + 124px); }
`;

export class Hud {
  constructor(plan) {
    this.plan = plan; // [[name, [[x, z], ...]], ...] for the rooms in this stage
    bus.on('boss_health', ({ name, hp, maxHp, shielded, shieldText }) => this.setBoss(name, hp / maxHp, shielded, shieldText));
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `<style>${CSS}</style>
      <div class="tl">
        <div class="lvl"></div>
        <div class="bar moist"><i></i><span class="hpn"></span></div>
        <div class="bar xp"><i></i></div>
        <div class="items"></div>
      </div>
      <div class="tc"><div class="clock"></div><div class="stage"></div></div>
      <div class="boss" hidden><div class="nm"></div><div class="bar"><i></i></div></div>
      <div class="elite" hidden><div class="nm"></div><div class="bar"><i></i></div></div>
      <canvas class="map"></canvas>
      <div class="hint"></div><div class="toast"></div><div class="hurt"></div><div class="debug" hidden></div>
      <div class="combo" hidden><b></b><span>combo</span><i></i></div>`;
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

  // kill combo: a big number that punches up on every kill, with a draining timer bar
  setCombo(n, frac, bonus) {
    const c = this.$('.combo');
    c.hidden = n < 3;
    if (n < 3) { this.cache.combo = 0; return; }
    if (this.cache.combo !== n) {
      this.cache.combo = n;
      c.querySelector('b').textContent = `x${n}`;
      c.querySelector('span').textContent = bonus > 1.01 ? `combo · +${Math.round((bonus - 1) * 100)}% dew` : 'combo';
      c.classList.remove('punch'); void c.offsetWidth; c.classList.add('punch');
      c.style.setProperty('--hue', String(Math.max(0, 50 - n * 2)));
    }
    c.querySelector('i').style.transform = `scaleX(${frac})`;
  }

  setMoisture(v, max) {
    if (this.cache.hp !== undefined && v < this.cache.hp - 0.01) {
      const h = this.$('.hurt');
      h.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
    }
    this.cache.hp = v;
    this.$('.moist i').style.transform = `scaleX(${Math.max(0, v / max)})`;
    this.$('.moist').classList.toggle('low', v / max < 0.3);
    this.set('hpText', '.hpn', () => `${Math.ceil(v)}`);
  }

  setXp(level, xp, need, purse) {
    this.$('.xp i').style.transform = `scaleX(${Math.min(1, xp / need)})`;
    this.set('lvl', '.lvl', () => `${level}`);
    this.$('.lvl').title = `Level ${level} · ${xp} / ${need} dew`;
  }

  setItems(items) {
    this.set('items', '.items', () => items.map((t) => `<span title="${t.name}: ${t.text}">${t.icon}</span>`).join(''));
  }

  setClock(text, dry) {
    this.set('clock', '.clock', () => text);
    this.$('.clock').classList.toggle('dry', dry);
  }
  setStage(text) { this.set('stage', '.stage', () => text); }

  // shielded: the bar turns purple and says so (the Vacuum's lanternflies)
  setBoss(name, frac, shielded = false, shieldText = 'SHIELDED') {
    const b = this.$('.boss');
    b.hidden = name == null;
    if (name == null) return;
    b.classList.toggle('shield', shielded);
    this.set('bossName', '.boss .nm', () => (shielded ? `${name.toUpperCase()} · ${shieldText}` : name.toUpperCase()));
    this.$('.boss i').style.transform = `scaleX(${Math.max(0, frac)})`;
  }

  // the elite you're fighting (null: none)
  setElite(name, frac) {
    const b = this.$('.elite');
    b.hidden = name == null;
    if (name == null) return;
    this.set('eliteName', '.elite .nm', () => `✨ ${name.toUpperCase()}`);
    this.$('.elite i').style.transform = `scaleX(${Math.max(0, frac)})`;
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

  // Furniture footprints for the map: [{ x0, z0, x1, z1, top }], drawn once into a cached layer
  // (only the big pieces: small clutter just makes noise at this size)
  setFurniture(list) { this.furniture = list.filter((f) => (f.x1 - f.x0) * (f.z1 - f.z0) > 0.06 && f.top > 0.12); this.mapBase = null; }

  // The minimap, kept quiet: the room in one tone with faint furniture, small coloured dots for
  // what matters (gold gift, orange elites, red bugs, the boss), a tiny ▲ / ▼ when
  // something is well above or below you, and you as a cyan arrow. Round, centred on you, and
  // turned so up is where the camera looks (the way "forward" moves you); a gift or an elite past
  // its edge sits on the rim, pointing the way.
  // markers: [{ x, y, z, color, big?, kind? }]
  update(pos, facing, cameraYaw, markers = []) {
    const c = this.map, g = this.ctx;
    const dpr = Math.min(3, devicePixelRatio || 1);
    const css = c.clientWidth || 285;
    const W = Math.round(css * dpr);
    if (c.width !== W) { c.width = c.height = W; this.mapBase = null; }
    const b = this.bounds, R = W / 2;
    // the whole room fits across the map; centred on you, the far side of it can run off the edge
    const s = W / Math.max(b.x1 - b.x0, b.z1 - b.z0);
    const X = (x) => (x - b.x0) * s, Z = (z) => (z - b.z0) * s;
    const u = W / 190;                                    // scale for sizes, so small maps stay readable

    // the static layer: the room and faint furniture, in world orientation
    if (!this.mapBase) {
      const base = this.mapBase = document.createElement('canvas');
      base.width = Math.ceil(X(b.x1)); base.height = Math.ceil(Z(b.z1));
      const q = base.getContext('2d');
      const room = () => { q.beginPath(); for (const [, poly] of this.plan) { poly.forEach(([x, z], k) => (k ? q.lineTo(X(x), Z(z)) : q.moveTo(X(x), Z(z)))); q.closePath(); } };
      room();
      q.fillStyle = 'rgba(120, 140, 170, 0.18)';
      q.fill();
      q.save();
      room();
      q.clip();
      for (const f of this.furniture || []) {
        q.fillStyle = `rgba(200, 215, 235, ${0.07 + Math.min(1, f.top / 1.0) * 0.1})`;   // taller = a little lighter
        q.beginPath();
        q.roundRect(X(f.x0), Z(f.z0), Math.max(2, (f.x1 - f.x0) * s), Math.max(2, (f.z1 - f.z0) * s), 3 * u);
        q.fill();
      }
      q.restore();
      room();
      q.lineWidth = 1.5 * u;
      q.strokeStyle = 'rgba(220, 235, 255, 0.5)';
      q.stroke();
    }
    // turn so the camera's forward, (-sin yaw, -cos yaw) on the floor, points up
    const turn = -Math.PI / 2 - Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw));
    const cs = Math.cos(turn), sn = Math.sin(turn), px = X(pos.x), pz = Z(pos.z);
    const out = this._pt || (this._pt = { x: 0, y: 0, d: 0 });
    const toMap = (x, z) => { const dx = X(x) - px, dz = Z(z) - pz; out.x = R + dx * cs - dz * sn; out.y = R + dx * sn + dz * cs; out.d = Math.hypot(dx, dz); return out; };

    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(13, 18, 32, 0.4)';
    g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(turn); g.translate(-px, -pz);
    g.drawImage(this.mapBase, 0, 0);
    g.restore();
    g.lineWidth = 1.5 * u; g.strokeStyle = 'rgba(220, 235, 255, 0.35)';
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.stroke();

    const t = performance.now() / 1000, rim = R - 6 * u;
    const dot = (x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    // bugs: small red dots (only those on the map)
    for (const m of markers) if (m.kind === 'enemy') { const p = toMap(m.x, m.z); if (p.d < rim) dot(p.x, p.y, 2 * u, 'rgba(255, 80, 80, 0.9)'); }
    // what's worth going to: a dot in its colour with a soft glow (a slow pulse for the big ones),
    // held on the rim when it's further away than the map shows
    for (const m of markers) {
      if (m.kind === 'vent' || m.kind === 'enemy') continue;
      const p = toMap(m.x, m.z);
      if (p.d > rim) { p.x = R + (p.x - R) * rim / p.d; p.y = R + (p.y - R) * rim / p.d; }
      const mx = p.x, mz = p.y, r = (m.big ? 4.5 : 3.5) * u;
      if (m.big) { g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 4); dot(mx, mz, r * 2.4, m.color); g.globalAlpha = 1; }
      dot(mx, mz, r, m.color);
      const dy = m.y - pos.y;
      if (Math.abs(dy) > 0.15) {
        g.fillStyle = '#fff';
        g.font = `700 ${8 * u}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(dy > 0 ? '▲' : '▼', mx, mz - r - 2.5 * u);
      }
    }

    // you: a soft view cone (always up: it's where the camera looks) and a cyan arrow for the
    // way the jelly faces
    const grad = g.createRadialGradient(R, R, 0, R, R, 34 * u);
    grad.addColorStop(0, 'rgba(95,240,255,0.25)'); grad.addColorStop(1, 'rgba(95,240,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, 34 * u, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
    g.save();
    g.translate(R, R);
    g.rotate(turn + Math.atan2(Math.cos(facing), Math.sin(facing)));
    g.beginPath();
    g.moveTo(8 * u, 0); g.lineTo(-5 * u, -5 * u); g.lineTo(-2 * u, 0); g.lineTo(-5 * u, 5 * u); g.closePath();
    g.fillStyle = '#5ff0ff';
    g.fill();
    g.lineWidth = 1.2 * u;
    g.strokeStyle = 'rgba(0, 20, 30, 0.8)';
    g.stroke();
    g.restore();
    this.mapTurn = turn;
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
