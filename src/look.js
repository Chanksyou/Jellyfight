// Reads content/look.css: the game's colours and render numbers as CSS custom properties
// (--name: value;). boot.js loads it before the game starts, so any module can read a token
// when it builds things. Every read has a fallback, so a missing token never breaks the game.
//
//   LOOK.num('night-fill', 0.12)       a number
//   LOOK.color('jelly-color', '#fff')  a colour string ('#rrggbb')
//   LOOK.list('guts-roach', [...])     space-separated values, as strings
//   LOOK.nums('sun-dir', [0, 1, 0])    space-separated numbers (the fallback if any isn't one)
// Hand three.js numbers only (LOOK.nums, never LOOK.list): one string in a Vector3 or a fromArray puts
// every vector and matrix on the page in V8's slow form, and each write then allocates (tests/check.mjs).
export const LOOK = {
  vars: {},
  _ref: null, _num: null, _col: null,
  _sync() { if (this._ref !== this.vars) { this._ref = this.vars; this._num = Object.create(null); this._col = Object.create(null); } },
  has(name) { return name in this.vars; },
  num(name, fallback) {
    this._sync();
    let v = this._num[name];
    if (v === undefined) {
      const p = parseFloat(this.vars[name]);
      v = this._num[name] = Number.isFinite(p) ? p : NaN;
    }
    return Number.isNaN(v) ? fallback : v;
  },
  color(name, fallback) {
    this._sync();
    let v = this._col[name];
    if (v === undefined) {
      const raw = this.vars[name];
      v = this._col[name] = /^#[0-9a-f]{6}$/i.test(raw || '') ? raw : '';
    }
    return v || fallback;
  },
  list(name, fallback) {
    const v = this.vars[name];
    return v ? v.split(/\s+/).filter(Boolean) : fallback;
  },
  nums(name, fallback) {
    const v = this.list(name, null)?.map(Number);
    return v && v.every(Number.isFinite) ? v : fallback;
  },
};

export function parseLook(css) {
  const vars = {};
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

export async function loadLook(url = './content/look.css') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    LOOK.vars = parseLook(await res.text());
  } catch (e) {
    console.warn('look: using built-in values (' + e.message + ')');
  }
  return LOOK;
}
