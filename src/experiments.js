// Experiment switches for measuring on a phone: index.html?lights=4, ?rt=packed|half, ?msaa=0|2|4, ?lite=1, ?ambient=0, ?mist=0, ?shimmer=1, ?shine=all|none, ?tone=agx|aces.
// Read once at boot like a dev option: never saved, never in a run, and absent means the game as shipped.
// The bench (src/bench.js) shows them in its results. Each is a load-time choice, so none builds a shader in play.
// lights: lamp slots on a phone (overrides --phone-lights); lite: Low's plain materials on any tier (lite-materials.js);
// ambient: 0 = nothing in the room moves by itself (ambient.js);
// mist: 0 = no ground mist (mist.js);
// shine: all = every baked surface keeps its lamps' shine, none = none does (baked-ao.js; else --baked-shine-roughness);
// shimmer: heat shimmer over the vents on Medium and High (heat-shimmer.js);
// rt: packed (R11G11B10F) or half (RGBA16F) picture buffers (graphics.js); msaa: smooth edges on Medium, at --msaa-pixel-ratio on a phone (graphics.js, main.js);
// tone: agx or aces tone mapping A/B switch.
export function readExperiments(search) {
  const q = new URLSearchParams(search);
  const pick = (k, ok) => (ok.includes(q.get(k)) ? q.get(k) : null);
  return {
    lights: pick('lights', ['3', '4', '6']) && +q.get('lights'),   // number or null
    rt: pick('rt', ['packed', 'half']),
    msaa: q.has('msaa') && ['0', '2', '4'].includes(q.get('msaa')) ? +q.get('msaa') : null,
    lite: q.get('lite') === '1' ? 1 : null,
    ambient: q.get('ambient') === '0' ? 0 : null,
    mist: q.get('mist') === '0' ? 0 : null,
    shimmer: q.get('shimmer') === '1' ? 1 : null,
    shine: pick('shine', ['all', 'none']),
    tone: pick('tone', ['agx', 'aces']),
  };
}
export const EXPERIMENTS = readExperiments(location.search);

// the options that are on, as a query string to carry across a bench link ("&lights=4")
export const experimentQuery = (x = EXPERIMENTS) => Object.entries(x).filter(([, v]) => v !== null).map(([k, v]) => `&${k}=${v}`).join('');
// the options that are on, as words for a results card ("lights=4 msaa=2"), or "" when none
export const experimentWords = () => experimentQuery().slice(1).replaceAll('&', ' ');
