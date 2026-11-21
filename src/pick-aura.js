// The pick screen's side cards (pick-screen.js): the cards show the player's own jelly as it is, and
// its type's element moves round it (flames licking up, snow drifting, arcs crackling…), so every card
// reads as its type at a glance and nothing is drawn inside the jelly. aura= in content/jellies.kdl
// names the kind; the colour is the type's own (--type-<id> in look.css).
//
// Each kind is a shader (src/pick-auras/<kind>.js) drawn by AuraPainter (pick-auras/painter.js): the
// whole card picture (water, the jelly relit, the element behind and in front of it) in one full-card
// shader by the game's renderer, then copied onto the card's canvas.
//
// How to add a kind:
//   1. src/pick-auras/<kind>.js exports PAINT (GLSL with `vec3 paint(vec2 uv)`: the card's colour at
//      uv, linear, before tone mapping; kit.js lists what it can call), RAMP (its look.css colour ramp,
//      four colours hot to deep) and RAMP_FALLBACK.
//   2. Import it into SHADERS here.
//   3. Its numbers and colours go in content/look.css (--aura-<kind>-*); shoot it with
//      node tools/pick-shots.mjs --only=<type> and compare it with the other seven.

import * as bubbles from './pick-auras/bubbles.js';
import * as flames from './pick-auras/flames.js';
import * as frost from './pick-auras/frost.js';
import * as sparks from './pick-auras/sparks.js';
import * as glitter from './pick-auras/glitter.js';
import * as gust from './pick-auras/gust.js';
import * as sting from './pick-auras/sting.js';
import * as toxic from './pick-auras/toxic.js';

export const SHADERS = { flames, sparks, frost, glitter, gust, bubbles, toxic, sting };

// every kind aura= can name (content/jellies.kdl)
export const KINDS = () => Object.keys(SHADERS);
