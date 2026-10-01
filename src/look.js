// Reads content/look.css: the game's colours and render numbers as CSS custom properties
// (--name: value;). boot.js loads it before the game starts, so any module can read a token
// when it builds things. Every read has a fallback, so a missing token never breaks the game.
//
//   LOOK.num('night-fill', 0.12)       a number
//   LOOK.color('jelly-color', '#fff')  a colour string ('#rrggbb')
//   LOOK.list('guts-roach', [...])     space-separated values
export const LOOK = {
  vars: {},
  has(name) { return name in this.vars; },
  num(name, fallback) {
    const v = parseFloat(this.vars[name]);
    return Number.isFinite(v) ? v : fallback;
  },
  color(name, fallback) {
    const v = this.vars[name];
    return /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;
  },
  list(name, fallback) {
    const v = this.vars[name];
    return v ? v.split(/\s+/).filter(Boolean) : fallback;
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
