// Experiment switches for measuring on a phone: index.html?lights=4, ?rt=packed, ?msaa=4, ?lite=1.
// Read once at boot like a dev option: never saved, never in a run, and absent means the game as shipped.
// The bench (src/bench.js) shows them in its results. Each is a load-time choice, so none builds a shader in play.
// lights: lamp slots on a phone (overrides --phone-lights); rt, msaa, lite: the switch exists, the task
// that owns it (picture buffers, edge smoothing, plain Low materials) reads it from here.
export function readExperiments(search) {
  const q = new URLSearchParams(search);
  const pick = (k, ok) => (ok.includes(q.get(k)) ? q.get(k) : null);
  return {
    lights: pick('lights', ['3', '4', '6']) && +q.get('lights'),   // number or null
    rt: pick('rt', ['packed']),
    msaa: pick('msaa', ['0', '2', '4']) && +q.get('msaa'),
    lite: q.get('lite') === '1' ? 1 : null,
  };
}
export const EXPERIMENTS = readExperiments(location.search);

// the options that are on, as a query string to carry across a bench link ("&lights=4")
export const experimentQuery = (x = EXPERIMENTS) => Object.entries(x).filter(([, v]) => v !== null).map(([k, v]) => `&${k}=${v}`).join('');
// the options that are on, as words for a results card ("lights=4 msaa=2"), or "" when none
export const experimentWords = () => experimentQuery().slice(1).replaceAll('&', ' ');
