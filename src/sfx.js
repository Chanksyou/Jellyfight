// Sound effects use Web Audio synthesis plus a few recordings: the approved fire launch/flight
// and lightning's takes (SAMPLES).
// Most sounds are a few oscillators
// or a burst of filtered noise with a quick envelope, with a little random pitch so repeats
// don't sound robotic. Browsers only allow audio after a tap or click: main.js calls unlock()
// from the Play button.
let ctx = null, master = null, noiseBuf = null, deep = null;   // deep: a lowpass in the master chain (deepen)
const last = {};                 // throttle: the last time each sound played
let muted = false;
let at = null;                   // previews (tools/music.mjs): a fixed time to play sounds at, on an offline context
let fireFlight = null;
let fireFlightOffset = 0;
const fireVoices = new Set();
// Both gameplay and the audition share the same decoded fire recording.
export function setFireFlight(buffer) {
  fireFlight = buffer;
  // Skip the recording's quiet lead-in, measured once when it is decoded.
  const size = Math.max(1, Math.round(buffer.sampleRate * 0.01)), levels = [];
  let peak = 0;
  for (let i = 0; i < buffer.length; i += size) {
    const count = Math.min(size, buffer.length - i);
    let energy = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const samples = buffer.getChannelData(c);
      for (let k = 0; k < count; k++) energy += samples[i + k] ** 2;
    }
    const rms = Math.sqrt(energy / (count * buffer.numberOfChannels));
    levels.push(rms); peak = Math.max(peak, rms);
  }
  const first = levels.findIndex(rms => rms >= peak * 0.2);
  fireFlightOffset = Math.max(0, first * size / buffer.sampleRate - 0.005);
}
let flightLoading = null;
export function loadFireFlight() {
  if (fireFlight) return Promise.resolve(true);
  if (!ctx) return Promise.resolve(false);
  return flightLoading ||= fetch('/assets/audio/fireball-flight.mp3')
    .then(response => {
      if (!response.ok) throw new Error(`Fire audio: ${response.status}`);
      return response.arrayBuffer();
    })
    .then(bytes => ctx.decodeAudioData(bytes))
    .then(buffer => { setFireFlight(buffer); return true; })
    .catch(error => {
      flightLoading = null;
      console.warn('Recorded fire unavailable; using synthesized launch.', error);
      return false;
    });
}

// Recorded sounds by role (assets/audio/, sources in its README): several takes each, played in
// turn so a repeat never sounds the same twice running. They load after audio unlocks; until a
// role's takes are in (or if they fail), its synthesized sound plays instead.
const SAMPLES = {
  'lightning-launch': 2, 'lightning-hit': 3, 'lightning-big': 3, 'lightning-chain': 3,
};
const takes = {}, turn = {};
let voices = 0;
let samplesLoading = null;
export function loadSamples() {
  if (!ctx) return Promise.resolve(false);
  return samplesLoading ||= Promise.all(Object.entries(SAMPLES).flatMap(([role, n]) => Array.from({ length: n }, (_, i) => {
    const [kind, ...rest] = role.split('-');
    return fetch(`/assets/audio/${kind}/${rest.join('-')}-${i + 1}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(`${role}: ${r.status}`); return r.arrayBuffer(); })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buf) => { (takes[role] ||= [])[i] = buf; });
  }))).then(() => true).catch((error) => { console.warn('A recorded sound is unavailable; using synthesized ones.', error); return false; });
}
// play the next take of `role` (rate: its speed and pitch, vol: its loudness); false when it
// isn't loaded, so the caller plays its synthesized sound. At most 8 recorded voices at once.
function sample(role, { rate = 1, vol = 1 } = {}) {
  const list = takes[role]?.filter(Boolean);
  if (!list?.length) return false;
  if (voices >= 8) return true;
  const buf = list[(turn[role] = ((turn[role] ?? Math.floor(Math.random() * list.length)) + 1) % list.length)];
  const src = ctx.createBufferSource(), g = ctx.createGain(), t = now();
  src.buffer = buf; src.playbackRate.value = rate * jitter(0.04);
  g.gain.value = vol;
  src.connect(g).connect(master);
  voices++;
  src.onended = () => { voices--; src.disconnect(); g.disconnect(); };
  src.start(t);
  return true;
}

function recordedFireFlight(weight) {
  const t = now(), source = ctx.createBufferSource(), gain = ctx.createGain();
  // Offline captures schedule several casts before onended callbacks can run.
  for (const voice of fireVoices) if (voice.until <= t) fireVoices.delete(voice);
  if (fireVoices.size >= 3) {
    const oldest = fireVoices.values().next().value;
    oldest.stop(true, 0.008); fireVoices.delete(oldest);
  }
  source.buffer = fireFlight;
  source.playbackRate.value = (0.98 + Math.random() * 0.04) / Math.pow(weight, 0.15);
  const duration = (fireFlight.duration - fireFlightOffset) / source.playbackRate.value;
  const volume = 0.38 + (weight - 1) * 0.1;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.012);
  gain.gain.linearRampToValueAtTime(volume * 0.45, t + Math.min(0.18, duration * 0.5));
  gain.gain.setValueAtTime(volume * 0.45, t + Math.max(0.18, duration - 0.15));
  gain.gain.linearRampToValueAtTime(0, t + duration);
  source.connect(gain).connect(master);
  const voice = { until: t + duration, stop: null };
  fireVoices.add(voice);
  source.onended = () => { fireVoices.delete(voice); source.disconnect(); gain.disconnect(); };
  source.start(t, fireFlightOffset); source.stop(t + duration);
  let stopped = false;
  voice.stop = (immediate = false, fade = 0.045) => {
    if (stopped && !immediate) return;
    stopped = true;
    // A point-blank hit still gets a short ignition; pause/reset can cut it immediately.
    const end = Math.max(t + (immediate ? 0 : Math.min(0.1, duration)), now());
    const until = Math.min(voice.until, end + fade + 0.005);
    gain.gain.cancelAndHoldAtTime(Math.max(t, until - fade - 0.005));
    gain.gain.linearRampToValueAtTime(0, until - 0.005);
    source.stop(until); voice.until = until;
  };
  return voice.stop;
}

// Previews: play the sounds into another (offline) context, each at the time given by when(t)
export function preview(c, dest) {
  ctx = c;
  master = c.createGain();
  master.gain.value = 0.55;
  master.connect(dest);
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return { when: (t) => { at = t; for (const k in last) delete last[k]; } };
}
const now = () => (at ?? ctx.currentTime);

export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();     // keeps a big fight from clipping
      deep = ctx.createBiquadFilter();                  // wide open until something deepens the sound
      deep.type = 'lowpass'; deep.frequency.value = 20000; deep.Q.value = 0.9;
      master.connect(deep).connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    loadFireFlight();
    loadSamples();
  } catch { /* no audio: the game still works */ }
}

// the audio context and master volume, for the music (music.js); null until unlocked
export const audio = () => (ctx ? { ctx, master } : null);

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; }
export const isMuted = () => muted;

const ready = () => ctx && (at !== null || ctx.state === 'running') && !muted;

// Deepened sound (the Cream Whipper's balloon): for `hold` s everything (music and sound effects)
// plays low and muffled, then eases back to normal over `ease` s. pitch() is the factor every
// new note is played at right now (music.js and the sounds here use it).
const daze = { from: 0, until: 0, back: 0 };
const LOW = 0.6;
export function pitch() {
  const n = performance.now();
  if (n < daze.from || n >= daze.back) return 1;
  if (n < daze.from + 300) return 1 - (1 - LOW) * (n - daze.from) / 300;     // a quick dive down
  if (n < daze.until) return LOW;
  return LOW + (1 - LOW) * (n - daze.until) / (daze.back - daze.until);
}
export function deepen(hold = 5, ease = 3) {
  const n = performance.now();
  daze.from = pitch() < 1 ? n - 300 : n;                                   // already deep: stay down, start the clock again
  daze.until = n + hold * 1000;
  daze.back = daze.until + ease * 1000;
  if (!deep) return;
  const t = ctx.currentTime, f = deep.frequency;
  f.cancelScheduledValues(t);
  f.setValueAtTime(f.value, t);
  f.exponentialRampToValueAtTime(650, t + 0.3);
  f.setValueAtTime(650, t + hold);
  f.exponentialRampToValueAtTime(20000, t + hold + ease);
}
export const isDeep = () => { const n = performance.now(); return n >= daze.from && n < daze.back; };
// back to normal at once (a new run)
export function calm() {
  daze.from = daze.until = daze.back = 0;
  if (deep) { deep.frequency.cancelScheduledValues(ctx.currentTime); deep.frequency.value = 20000; }
}
const jitter = (k = 0.08) => 1 + (Math.random() - 0.5) * 2 * k;
function gap(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

// one tone: type, start/end frequency, duration, volume
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = now() + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  const k = pitch();
  o.frequency.setValueAtTime(f0 * k, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * k), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// a burst of noise through a filter
function noise(freq, q, dur, vol, type = 'bandpass', delay = 0, sweepTo = null) {
  const t = now() + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  const k = pitch();
  f.frequency.setValueAtTime(freq * k, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo * k, t + dur);
  s.playbackRate.value = k;                          // slowed noise sounds lower too
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.3);
  s.stop(t + dur + 0.02);
}

// debris: `n` tiny ticks scattered from `from` s to `from + spread` s (bits and drops pattering down)
function patter(n, from, spread, vol = 0.04) {
  for (let k = 0; k < n; k++) noise(3000 + Math.random() * 3500, 3, 0.015, vol * (1 - k * 0.15), 'bandpass', from + Math.random() * spread);
}

export const sfx = {
  gadgetBubble(kind){
    if(!ready()||!gap('gadgetBubble-'+kind,100))return;const j=jitter(.08);
    if(kind==='giant'){tone('sine',100*j,180*j,.18,.05);noise(700,1,.18,.025,'lowpass');}
    else if(kind==='gold'){tone('sine',1400*j,2100*j,.16,.035);tone('triangle',2100*j,2800*j,.1,.018,.025);}
    else{noise(4200*j,3,.025,.025,'highpass');tone('sine',1800*j,900*j,.04,.02);}
  },
  gadgetSpring(){if(!ready()||!gap('gadgetSpring',150))return;const j=jitter();tone('triangle',260*j,900*j,.14,.045);tone('sine',900*j,500*j,.12,.025,.06);},
  gadgetFizz(){if(!ready()||!gap('gadgetFizz',150))return;const j=jitter();noise(4500*j,1,.3,.04,'highpass');tone('sine',180*j,80*j,.13,.045);},
  gadgetRemote(){if(!ready()||!gap('gadgetRemote',90))return;const j=jitter();tone('square',1100*j,700*j,.035,.025);noise(3000*j,2,.07,.03,'bandpass');},
  gadgetStatic(){if(!ready()||!gap('gadgetStatic',90))return;noise(6200*jitter(),4,.035,.04,'highpass');tone('triangle',1900,700,.06,.02);},
  gadgetFairy(){if(!ready()||!gap('gadgetFairy',160))return;const j=jitter();tone('sine',1700*j,1500*j,.08,.018);tone('sine',2500*j,2300*j,.1,.008,.015);},
  gadgetPaper(){if(!ready()||!gap('gadgetPaper',180))return;noise(3500*jitter(),2,.045,.018,'highpass');},
  gadgetAura(){if(!ready()||!gap('gadgetAura',300))return;tone('sine',330*jitter(.04),300,.12,.012);},
  gadgetPin(){if(!ready()||!gap('gadgetPin',120))return;const j=jitter();tone('triangle',1800*j,700*j,.045,.03);noise(2200*j,2,.025,.025);},
  gadgetSnooze(){if(!ready()||!gap('gadgetSnooze',500))return;const j=jitter(.03);for(const [i,f]of [659,523,784].entries())tone('sine',f*j,f*j,.28,.055,i*.08);noise(1400,1,.15,.025,'bandpass');},
  gadgetBath(){
    if(!ready()||!gap('gadgetBath',140))return;const j=jitter(.08);
    tone('sine',170*j,480*j,.16,.06);noise(2200*j,1,.14,.025,'bandpass',0,4400);
  },
  gadgetEcho(hit=false){
    if(!ready()||!gap('gadgetEcho-'+hit,70))return;const j=jitter(.05),f=(hit?1800:1200)*j;
    tone('sine',f,f*1.4,.08,.025);tone('triangle',f*1.5,f*.8,.05,.012,.015);
  },
  gadgetCotton(){
    if(!ready()||!gap('gadgetCotton',120))return;const j=jitter(.1);
    tone('sine',100*j,55*j,.18,.075);noise(700*j,1,.23,.05,'lowpass',0,140);
  },
  gadgetSalt(){
    if(!ready()||!gap('gadgetSalt',65))return;const j=jitter(.14);
    noise(4200*j,3,.035,.055,'highpass');tone('triangle',2600*j,900*j,.07,.025);noise(6500*j,2,.1,.02,'highpass',.025);
  },
  gadgetSqueak(){
    if(!ready()||!gap('gadgetSqueak',150))return;const j=jitter(.12);
    tone('triangle',480*j,1300*j,.07,.055);tone('sine',1300*j,360*j,.12,.045,.065);noise(1800*j,2,.08,.025,'bandpass',.03);
  },
  gadgetMirror(){
    if(!ready()||!gap('gadgetMirror',150))return;const j=jitter(.04);
    tone('sine',2400*j,1800*j,.18,.04);tone('sine',3600*j,2700*j,.13,.02,.015);noise(5000*j,3,.035,.025,'highpass');
  },
  gadgetChord(){
    if(!ready()||!gap('gadgetChord',120))return;const j=jitter(.03);
    for(const [i,f]of [220,277.18,329.63].entries())tone('triangle',f*j,f*j*.98,.35,.035,i*.008);
    noise(1900*j,2,.035,.045,'bandpass');tone('sine',110*j,90*j,.16,.04);
  },
  gadgetNeedles(){
    if(!ready()||!gap('gadgetNeedles',120))return;const j=jitter(.12);
    noise(4300*j,2,.09,.05,'highpass',0,1800);tone('triangle',1600*j,700*j,.04,.025,.025);
  },
  gadgetMouse(phase){
    if(!ready()||!gap('gadgetMouse-'+phase,phase==='run'?170:100))return;const j=jitter(.09);
    if(phase==='hit'){noise(650*j,1,.045,.07,'lowpass');tone('triangle',380*j,120*j,.09,.045);tone('sine',1100*j,500*j,.14,.025,.025);}
    else if(phase==='wind'){tone('triangle',700*j,1200*j,.1,.03);noise(2500*j,3,.04,.025,'bandpass',.025);}
    else{noise(2200*j,3,.025,.018);tone('triangle',480*j,350*j,.035,.012,.03);}
  },
  gadgetBrick(hit=false){
    if(!ready()||!gap('gadgetBrick-'+hit,70))return;const j=jitter(.12);
    noise(1800*j,2,.035,hit?.07:.035);tone('triangle',hit?240*j:640*j,hit?90*j:440*j,.06,hit?.055:.025);
    if(hit)for(let i=0;i<3;i++)tone('triangle',(1200+i*200)*j,800*j,.035,.018,.025+i*.025);
  },
  gadgetMarble(phase){
    if(!ready()||!gap('gadgetMarble-'+phase,phase==='roll'?210:65))return;const j=jitter(.06);
    if(phase==='roll')noise(650*j,2,.13,.012,'bandpass',0,450);
    else{tone('sine',(phase==='wall'?2100:1300)*j,900*j,.12,.035);noise(500*j,1,.035,.03,'lowpass');}
  },
  gadgetFocus(acquire=false){
    if(!ready()||!gap('gadgetFocus',150))return;const j=jitter(.05);
    tone('sine',acquire?800*j:1400*j,acquire?1400*j:1100*j,.09,.014);
    noise(3200*j,3,.08,.012,'bandpass',0,4200*j);
  },
  windCharge(duration) {
    if (!ready() || !gap('windCharge', 35)) return;
    const t = now(), source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noiseBuf; source.loop = true;
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.12, t + duration * 0.8);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t); source.stop(t + duration + 0.02);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    return () => {
      const end = Math.min(t + duration, now());
      gain.gain.cancelAndHoldAtTime(end); gain.gain.linearRampToValueAtTime(0, end + 0.015);
      source.stop(end + 0.02);
    };
  },
  windLaunch() {
    if (!ready() || !gap('windLaunch', 35)) return;
    noise(2300 * jitter(0.1), 0.6, 0.22, 0.26, 'bandpass', 0, 550);
    noise(6000, 0.8, 0.05, 0.1, 'highpass');
  },
  windSlam() {
    if (!ready() || !gap('windSlam', 65)) return;
    noise(1300 * jitter(0.12), 0.8, 0.11, 0.23, 'lowpass', 0, 240);
    tone('sine', 160, 65, 0.1, 0.15);
    for (let k = 0; k < 3; k++) noise(3500 + Math.random() * 2200, 2, 0.018, 0.06, 'bandpass', 0.025 + k * 0.02);
  },
  // Includes short ignition tails whose projectiles have already hit or expired.
  stopFire() {
    for (const voice of fireVoices) voice.stop(true, 0.008);
  },
  // blowing a bubble: a soft rising bloop
  rebound() {
    if (!ready() || !gap('rebound', 120)) return;
    const j = jitter(0.15);
    tone('sine', 760 * j, 310 * j, 0.12, 0.055);
    noise(2400 * j, 1.3, 0.16, 0.025, 'bandpass', 0, 700 * j);
  },
  mirage() {
    if (!ready() || !gap('mirage', 150)) return;
    const j = jitter(0.12);
    tone('sine', 420 * j, 850 * j, 0.22, 0.07);
    tone('sine', 630 * j, 1275 * j, 0.25, 0.04, 0.04);
    noise(3000 * j, 1.5, 0.2, 0.035, 'bandpass');
  },
  blow() { if (!ready() || !gap('blow', 60)) return; const j = jitter(0.12); tone('sine', 260 * j, 520 * j, 0.09, 0.07); },
  // a bubble flying off: a soft airy whoosh that falls away behind it (at most ~6 a second)
  whiz() { if (!ready() || !gap('whiz', 160)) return; const j = jitter(0.15); noise(2600 * j, 1.4, 0.24, 0.03, 'bandpass', 0.03, 900 * j); },
  // a bubble bursting on an enemy: a water-drop plink that rises (the music's drums and plucks all
  // fall in pitch, so this one never blends in), then a carbonated fizz of tiny crackles
  pop(big = false) {
    if (!ready() || !gap('pop', 25)) return;
    const j = jitter(0.12);
    tone('sine', (big ? 380 : 900) * j, (big ? 1300 : 2600) * j, big ? 0.07 : 0.035, big ? 0.2 : 0.13);
    if (big) tone('sine', 120 * j, 260 * j, 0.12, 0.18);            // a deep glorp under the big ones
    for (let k = 0; k < (big ? 6 : 3); k++) noise(7000 + Math.random() * 4000, 4, 0.012, (big ? 0.06 : 0.045) * (1 - k * 0.15), 'bandpass', 0.02 + k * 0.016 + Math.random() * 0.01);
  },
  // a tentacle sting: a quick zip
  lashDraw() { if (!ready() || !gap('lashDraw', 75)) return; const j = jitter(0.14); tone('sine', 210*j, 330*j, 0.045, 0.025); },
  evolutionGather() {
    if (!ready()) return;
    const j = jitter(0.05);
    tone('sine', 160*j, 510*j, 0.65, 0.08);
    noise(1200, 1, 0.55, 0.045, 'bandpass', 0, 3600);
  },
  evolutionBloom() {
    if (!ready()) return;
    const j = jitter(0.04);
    tone('sine', 240*j, 80*j, 0.16, 0.07);
    [0, 4, 7, 12].forEach((s, i) => tone('triangle', 523*j*2**(s/12), 523*j*2**(s/12), 0.28, 0.07, i*0.055));
    noise(4200, 1.5, 0.18, 0.04, 'bandpass', 0.02);
  },
  lashRelease() { if (!ready() || !gap('lashRelease', 55)) return; noise(1700*jitter(0.16), 2, 0.045, 0.045, 'bandpass', 0, 5800); },
  sting() {
    if (!ready() || !gap('sting', 40)) return;
    const j = jitter(0.15);
    noise(4200*j, 2, 0.018, 0.09, 'highpass');
    tone('sine', 210*j, 80*j, 0.065, 0.07);
    noise(1500*j, 1.2, 0.065, 0.06, 'bandpass', 0.008);
    for (let i = 0; i < 2; i++) tone('sine', (1100+i*320)*j, (1700+i*350)*j, 0.025, 0.025, 0.035+i*0.018);
  },
  catStep() {
    if (!ready()) return;
    const j = jitter(.12); noise(260*j, 1, .07, .035, 'lowpass'); tone('sine',100*j,65*j,.07,.025);
  },
  catWind() {
    if (!ready()) return;
    noise(1200*jitter(.1),1,.3,.055,'bandpass',0,4200);
  },
  catImpact() {
    if (!ready()) return;
    const j = jitter(.1);
    noise(2600*j,1,.035,.22,'highpass');
    tone('sine',140*j,38*j,.3,.24);
    noise(450*j,1,.28,.13,'lowpass');
    for (let i=0;i<4;i++) noise((1700+i*500)*j,2,.07,.035,'bandpass',.08+i*.055);
  },
  // the Encore's club laser firing (act 4): a bright falling zap with a buzz and a hiss under it
  encoreLaser() { if (!ready() || !gap('encoreLaser', 80)) return; const j = jitter(0.08); tone('sawtooth', 2600 * j, 320 * j, 0.32, 0.045); tone('square', 1300 * j, 1250 * j, 0.36, 0.018); noise(5200 * j, 1.2, 0.28, 0.03, 'bandpass', 0, 1400); },
  // an enemy hit: a short thud
  hit() { if (!ready() || !gap('hit', 30)) return; tone('triangle', 200 * jitter(), 90, 0.06, 0.12); },
  // an enemy dies: a crunchy squish; bigger for bigger things
  kill(size = 1) {
    if (!ready() || !gap('kill', 35)) return;
    const j = jitter(0.1);
    noise(900 * j, 1.2, 0.12 + size * 0.05, 0.28, 'lowpass', 0, 200);
    tone('square', 180 * j / size, 50, 0.1 + size * 0.04, 0.08);
    tone('sine', 520 * j, 1040 * j, 0.08, 0.06, 0.03);
  },
  controllerCharge(rumble = false, duration = 0.6) {
    if (!ready() || !gap('controllerCharge', 100)) return;
    const j = jitter(0.08);
    tone(rumble ? 'sawtooth' : 'triangle', (rumble ? 55 : 220)*j, (rumble ? 150 : 750)*j, duration, rumble ? 0.035 : 0.045);
    noise(rumble ? 180 : 1600, 2, duration, 0.025, 'bandpass', 0, rumble ? 600 : 3200);
  },
  controllerLock() { if (!ready()) return; const j = jitter(); tone('square', 900*j, 900*j, 0.025, 0.035); tone('sine', 1350*j, 1350*j, 0.04, 0.025, 0.035); },
  controllerFire() {
    if (!ready()) return; const j = jitter(0.1);
    noise(4200*j, 2, 0.025, 0.12, 'highpass'); tone('triangle', 340*j, 100*j, 0.08, 0.08);
    noise(1400*j, 2, 0.14, 0.05, 'bandpass', 0.02, 4200);
  },
  controllerContact(hit) {
    if (!ready() || !gap('controllerContact', 45)) return; const j = jitter(0.12);
    noise(2700*j, 3, 0.035, 0.07, 'bandpass');
    if (hit) tone('sine', 180*j, 70*j, 0.08, 0.09);
    [0, 1].forEach(i => tone('triangle', (1200+i*430)*j, (700+i*260)*j, 0.045, 0.022, 0.025+i*0.025));
  },
  controllerRumble() {
    if (!ready()) return; const j = jitter(0.1);
    noise(1700*j, 1, 0.035, 0.18, 'highpass'); tone('sine', 135*j, 35*j, 0.24, 0.18);
    noise(170*j, 1.4, 0.24, 0.09, 'lowpass', 0.015, 60);
    for (let i = 0; i < 4; i++) noise((700+i*350)*j, 3, 0.035, 0.025, 'bandpass', 0.06+i*0.035);
  },
  // the Mug flinging coffee: a slosh off the rim, then the whoosh of it flying
  mugLob() {
    if (!ready() || !gap('mugLob', 90)) return; const j = jitter(0.12);
    noise(2400*j, 2, 0.03, 0.08, 'bandpass'); tone('sine', 360*j, 210*j, 0.07, 0.05);
    noise(900*j, 1.2, 0.3, 0.035, 'bandpass', 0.03, 2600*j);
  },
  // coffee landing: a wet slap, a thud, drops pattering round it (louder on the jelly)
  mugSplash(hit = false) {
    if (!ready() || !gap('mugSplash', 70)) return; const j = jitter(0.14), k = hit ? 1 : 0.6;
    noise(3800*j, 1, 0.04, 0.16*k, 'highpass'); tone('sine', 170*j, 60, 0.12, 0.12*k);
    noise(800*j, 0.9, 0.14, 0.08*k, 'lowpass', 0.01, 220);
    for (let i = 0; i < 3; i++) noise((2200 + Math.random()*1800)*j, 4, 0.015, 0.04*k, 'bandpass', 0.05 + i*0.04 + Math.random()*0.02);
  },
  // the Mug tipping out its wave: a heavy glug, then the pour running out
  mugPour() {
    if (!ready() || !gap('mugPour', 200)) return; const j = jitter(0.1);
    tone('sine', 240*j, 120*j, 0.12, 0.1); noise(1200*j, 1, 0.05, 0.1, 'bandpass');
    noise(1800*j, 0.8, 0.8, 0.07, 'bandpass', 0.04, 700*j);
    for (let i = 0; i < 4; i++) tone('sine', (300 + i*40)*j, 180*j, 0.06, 0.04, 0.12 + i*0.13);
  },
  // standing in something scalding: a short sizzle
  scald() { if (!ready() || !gap('scald', 220)) return; const j = jitter(0.15); noise(6000*j, 1, 0.12, 0.05, 'highpass'); noise(2400*j, 3, 0.05, 0.03, 'bandpass', 0.03); },
  // the Kettle's steam blast: a crack as it vents, a roaring hiss that falls away, spits of water
  kettleBlast() {
    if (!ready() || !gap('kettleBlast', 300)) return; const j = jitter(0.1);
    noise(5200*j, 0.8, 0.04, 0.2, 'highpass'); tone('sine', 140*j, 55, 0.18, 0.14);
    noise(3600*j, 0.7, 0.95, 0.12, 'bandpass', 0.02, 1400*j);
    for (let i = 0; i < 5; i++) noise((3000 + Math.random()*3000)*j, 4, 0.012, 0.05, 'bandpass', 0.1 + i*0.16 + Math.random()*0.05);
  },
  // the Kettle's lid popping: a clank, a boiling burble, the drops whooshing up
  kettlePop() {
    if (!ready() || !gap('kettlePop', 200)) return; const j = jitter(0.1);
    tone('triangle', 1500*j, 1100*j, 0.09, 0.06); noise(4200*j, 2, 0.03, 0.12, 'bandpass');
    for (let i = 0; i < 4; i++) tone('sine', (220 + Math.random()*160)*j, 400*j, 0.05, 0.05, 0.03 + i*0.05);
    noise(800*j, 1, 0.35, 0.06, 'bandpass', 0.05, 2800*j);
  },
  // a boiling drop landing: a plop, a thud, a sizzle and spatter
  kettleDrop(hit = false) {
    if (!ready() || !gap('kettleDrop', 60)) return; const j = jitter(0.15), k = hit ? 1 : 0.6;
    noise(2600*j, 3, 0.03, 0.12*k, 'bandpass'); tone('sine', 200*j, 80, 0.1, 0.1*k);
    noise(6500*j, 1, 0.25, 0.05*k, 'highpass', 0.02);
    for (let i = 0; i < 2; i++) noise((3000 + Math.random()*2000)*j, 4, 0.012, 0.04*k, 'bandpass', 0.06 + i*0.05);
  },
  // XP collected: a chime that climbs with continuous collection
  xp(chain = 0, big = false) {
    if (!ready() || !gap('xp', 45)) return;
    const step = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][Math.min(10, Math.max(0, Math.floor(chain)))];
    const f = 880 * Math.pow(2, step / 12);
    tone('sine', f, f, 0.12, 0.08);
    tone('triangle', f * 2, f * 2, 0.06, 0.03, 0.01);
    if (big) tone('sine', f / 2, f / 2, 0.16, 0.045);
  },
  // you get hurt: a low wobbly bonk
  hurt() { if (!ready() || !gap('hurt', 150)) return; tone('sawtooth', 220, 70, 0.22, 0.14); noise(400, 1, 0.15, 0.15, 'lowpass'); },
  // level up / treasure: a bright arpeggio
  levelUp() { if (!ready()) return; [0, 4, 7, 12].forEach((s, i) => tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.18, 0.12, i * 0.07)); },
  treasure() { if (!ready()) return; [0, 7, 12, 16, 19].forEach((s, i) => tone('sine', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.25, 0.1, i * 0.06)); },
  // a treasure chest, in two beats (pickups.js): it strains with a wooden creak while it
  // shakes, then the lid pops with a thump and a little jingle. kind 1 (an Elite's chest)
  // creaks for longer and rings higher; every jingle note is jittered so repeats differ
  chestCreak(kind = 0) { if (!ready()) return; const d = kind ? 0.4 : 0.12; noise(320, 7, d, 0.045, 'bandpass', 0, 150); tone('sawtooth', 130, 65, d, 0.028); },
  chestPop(kind = 0) { if (!ready()) return; tone('sine', 150, 45, 0.16, 0.3); noise(1000, 1, 0.07, 0.09); const base = kind ? 1560 : 1240; [0, 4, 7, 12].forEach((s, i) => { const f = base * Math.pow(2, s / 12) * jitter(0.03); tone('sine', f, f, 0.14, 0.055, 0.03 + i * 0.05); }); },
  // elements
  fireLaunch(weight = 1) {
    if (!ready() || !gap('fireLaunch', 35)) return;
    const w = Math.max(0.7, Math.min(1.6, weight)), j = jitter(0.12) / Math.sqrt(w), g = 0.85 + w * 0.3;
    if (fireFlight) return recordedFireFlight(w);
    // A pressure pulse under an opening flame, with enough midrange for phone speakers.
    tone('sine', 105 * j, 52 * j, 0.17, 0.24 * g);
    tone('triangle', 220 * j, 440 * j, 0.095, 0.11 * g);
    noise(460 * j, 0.65, 0.21, 0.4 * g, 'lowpass', 0, 3400 * j);
    noise(2200 * j, 1.2, 0.09, 0.2 * g, 'bandpass', 0.018, 550 * j);
    noise(4200 * j, 1, 0.045, 0.1 * g, 'highpass', 0.035);
  },
  fireDeath() {
    if (!ready() || !gap('fireDeath', 150)) return;
    noise(900, 0.7, 0.26, 0.14, 'lowpass', 0, 180);
    noise(3400, 1, 0.18, 0.08, 'bandpass', 0.07, 1800);
    for (let k = 0; k < 5; k++) noise(3500 + Math.random() * 3000, 2, 0.018, 0.09, 'bandpass', 0.04 + k * 0.055);
  },
  fireBurn() {
    if (!ready() || !gap('fireBurn', 240)) return;
    noise(2900 * jitter(0.15), 1.6, 0.045, 0.045, 'bandpass');
    noise(6500, 2, 0.012, 0.035, 'highpass', 0.025);
  },
  cinderStep() {
    if (!ready() || !gap('cinderStep', 220)) return;
    const j = jitter(0.16);
    noise(2400 * j, 1.3, 0.09, 0.03, 'bandpass', 0, 3800 * j);
    tone('sine', 190 * j, 280 * j, 0.04, 0.02);
    noise(6500 * j, 2, 0.015, 0.02, 'highpass', 0.035);
  },
  cinderHit() {
    if (!ready() || !gap('cinderHit', 100)) return;
    const j = jitter(0.15);
    noise(4800 * j, 1.5, 0.025, 0.06, 'highpass');
    tone('sine', 150 * j, 65 * j, 0.07, 0.04);
    noise(2300 * j, 1.3, 0.1, 0.04, 'bandpass', 0.015);
    noise(7000 * j, 2, 0.016, 0.025, 'highpass', 0.06);
  },
  fire(weight = 1) {
    if (!ready() || !gap('fire', 95)) return;
    const w = Math.max(0.7, Math.min(1.6, weight)), j = jitter(0.14) / Math.sqrt(w), g = 0.85 + w * 0.3;
    // Crack first, then chest and midrange punch, then a ragged, falling flame tail.
    noise(4300 * j, 0.8, 0.045, 0.4 * g, 'highpass', 0, 1100);
    noise(700 * j, 0.8, 0.065, 0.18 * g, 'bandpass', 0.004, 180);
    tone('sine', 125 * j, 48, 0.13, 0.22 * g);
    noise(1600 * j, 0.7, 0.13, 0.27 * g, 'lowpass', 0.008, 260);
    noise(750 * j, 1.1, 0.11, 0.1 * g, 'bandpass', 0.04, 180);
    for (let k = 0; k < 5; k++) {
      noise((3600 + Math.random() * 4000) * j, 2.5, 0.008 + Math.random() * 0.012,
        (0.08 - k * 0.01) * g, 'bandpass', 0.035 + k * 0.027 + Math.random() * 0.018);
    }
  },
  // the other Elements leaving the bell (fire's launch is fireLaunch): each a transient, then the
  // sound of it flying off
  elementLaunch(el) {
    if (!ready() || !gap('elLaunch' + el, 80)) return;
    const j = jitter(0.12);
    if (el === 'lightning' && sample('lightning-launch', { vol: 0.12 })) return;
    if (el === 'lightning') {   // a snap, a buzzing zip rising away, crackles trailing it
      noise(6500 * j, 1, 0.03, 0.16, 'highpass');
      tone('sawtooth', 110 * j, 180 * j, 0.12, 0.05); tone('square', 113 * j, 184 * j, 0.12, 0.025);
      tone('sine', 500 * j, 2600 * j, 0.09, 0.035, 0.01);
      for (let k = 0; k < 4; k++) noise(3500 + Math.random() * 3500, 4, 0.012, 0.05, 'bandpass', 0.03 + k * 0.035 + Math.random() * 0.02);
    }
    else if (el === 'ice') { tone('sine', 2600 * j, 2400 * j, 0.06, 0.04); tone('sine', 3900 * j, 3700 * j, 0.05, 0.025, 0.012); noise(3000 * j, 1.2, 0.18, 0.05, 'bandpass', 0.02, 1100); }
    else if (el === 'acid') { tone('sine', 180 * j, 430 * j, 0.08, 0.08); noise(700 * j, 1, 0.12, 0.06, 'lowpass', 0.01, 300); }
    else if (el === 'glitter') { for (let k = 0; k < 3; k++) tone('sine', (2200 + k * 700) * j, (2400 + k * 700) * j, 0.04, 0.035, k * 0.025); noise(2600 * j, 1.4, 0.18, 0.04, 'bandpass', 0.03, 900); }
  },
  // the other Elements landing on a bug (fire's is fire): the contact, a body under it, and its debris
  elementHit(el) {
    if (!ready() || !gap('elHit' + el, 50)) return;
    const j = jitter(0.12);
    if (el === 'lightning' && sample('lightning-hit', { vol: 0.22 })) return;
    if (el === 'lightning') {   // the crack, a falling zap, a low thump with a rumble of thunder under it, sizzling crackles
      noise(7000 * j, 0.7, 0.025, 0.34, 'highpass');
      noise(2600 * j, 1.2, 0.06, 0.2, 'bandpass', 0.005);
      tone('sawtooth', 2400 * j, 220, 0.12, 0.07);
      tone('sine', 95 * j, 34, 0.32, 0.22);
      noise(320 * j, 0.8, 0.55, 0.13, 'lowpass', 0.02, 70);
      for (let k = 0; k < 7; k++) noise(3000 + Math.random() * 4500, 4, 0.012 + Math.random() * 0.01, 0.06 * (1 - k * 0.1), 'bandpass', 0.05 + Math.random() * 0.35);
    }
    else if (el === 'ice') { noise(3200 * j, 1.5, 0.06, 0.16, 'bandpass', 0, 1800); tone('sine', 130 * j, 60, 0.08, 0.12); for (let k = 0; k < 4; k++) tone('triangle', (3000 + Math.random() * 2500) * j, 2600, 0.04, 0.03, 0.04 + k * 0.05); }
    else if (el === 'acid') { noise(800 * j, 0.9, 0.1, 0.16, 'lowpass', 0, 250); tone('sine', 300 * j, 180, 0.1, 0.07); tone('sine', 420 * j, 250, 0.08, 0.05, 0.05); noise(6000, 1, 0.3, 0.025, 'highpass', 0.08); }
    else if (el === 'glitter') { tone('sine', 900 * j, 2200 * j, 0.04, 0.1); tone('sine', 140 * j, 70, 0.08, 0.1); for (let k = 0; k < 6; k++) tone('sine', (2400 + Math.random() * 3000) * j, 2600, 0.05, 0.025, 0.03 + k * 0.04); }
  },
  // a chain bolt jumping to the k-th bug: a tzzt that climbs with each jump
  chainZap(k = 0) {
    if (!ready() || !gap('chainZap' + k, 40)) return;
    if (sample('lightning-chain', { rate: Math.pow(1.12, k), vol: 0.12 })) return;
    const j = jitter(0.08) * Math.pow(1.19, k);
    noise(6000 * j, 1, 0.025, 0.14, 'highpass');
    tone('sawtooth', 900 * j, 2600 * j, 0.06, 0.06); tone('square', 450 * j, 1300 * j, 0.06, 0.025);
    noise(3800 * j, 3, 0.04, 0.05, 'bandpass', 0.03);
  },
  // a lightning chain that really jumped (2+ bugs): a heavier strike with thunder in it (recorded only)
  lightningBig() { if (!ready() || !gap('lightningBig', 350)) return; sample('lightning-big', { vol: 0.2 }); },
  // the acid puddle eating at a bug: a quiet hiss with a pop or two
  acidSizzle() {
    if (!ready() || !gap('acidSizzle', 160)) return;
    const j = jitter(0.15);
    noise(5500 * j, 0.9, 0.22, 0.035, 'highpass', 0, 3000);
    tone('sine', 520 * j, 900 * j, 0.03, 0.025, 0.04 + Math.random() * 0.08);
  },
  zap() { if (!ready() || !gap('zap', 60)) return; tone('sawtooth', 1800 * jitter(), 300, 0.12, 0.07); noise(5000, 3, 0.08, 0.08, 'highpass'); },
  freeze() { if (!ready() || !gap('freeze', 80)) return; [0, 5, 9].forEach((s, i) => tone('sine', 1760 * Math.pow(2, s / 12), 1760 * Math.pow(2, s / 12), 0.2, 0.05, i * 0.03)); },
  // the Alligator's frost volley: a catapult thump and a rising icy whoosh as the balls leave its
  // mouth, and a crunchy ice crash with a low thud as each one lands
  // the Alligator's frost balls: a cough of cold air leaving its mouth (crack, thump, the whoosh away, a
  // shimmer), and each landing: an icy crack, a thud, the hiss of frost and a few tinkling bits
  frostLaunch() { if (!ready() || !gap('frostLaunch', 120)) return; const j = jitter(0.1); noise(5200 * j, 1, 0.03, 0.12, 'highpass'); tone('sine', 140 * j, 55, 0.18, 0.22); noise(900 * j, 0.8, 0.35, 0.12, 'bandpass', 0, 3600 * j); tone('triangle', 1200 * j, 2400 * j, 0.25, 0.03, 0.05); },
  frostLand() {
    if (!ready() || !gap('frostLand', 40)) return; const j = jitter(0.12);
    noise(6000 * j, 1, 0.05, 0.22, 'highpass'); tone('sine', 110 * j, 45, 0.16, 0.2);
    noise(3200 * j, 0.7, 0.18, 0.16, 'bandpass', 0, 1400); noise(7000, 1, 0.12, 0.07, 'highpass', 0.02);
    for (let k = 0; k < 3; k++) { const f = (2200 + Math.random() * 1600) * j; tone('triangle', f, f * 0.7, 0.06, 0.025, 0.04 + k * 0.035 + Math.random() * 0.02); }
  },
  shatter() { if (!ready() || !gap('shatter', 60)) return; noise(6000, 1, 0.3, 0.25, 'highpass'); tone('triangle', 2400, 800, 0.2, 0.08); },
  acid() { if (!ready() || !gap('acid', 90)) return; tone('sine', 300 * jitter(), 180, 0.1, 0.07); tone('sine', 420 * jitter(), 250, 0.08, 0.05, 0.05); },
  wind() {
    if (!ready() || !gap('wind', 80)) return;
    const j = jitter(0.12);
    noise(4500 * j, 0.8, 0.035, 0.18, 'highpass');
    noise(1200 * j, 0.7, 0.14, 0.16, 'bandpass', 0.01, 400);
    for (let k = 0; k < 2; k++) noise(2800 * j, 2, 0.02, 0.045, 'bandpass', 0.06 + k * 0.03);
  },
  // a big moment: boss or elite down
  shieldHit() { if (!ready() || !gap('shieldHit', 80)) return; const j = jitter(0.08); tone('sine', 1200 * j, 600 * j, 0.12, 0.08); noise(3200 * j, 2, 0.05, 0.04); },
  shieldBreak() { if (!ready() || !gap('shieldBreak', 80)) return; const j = jitter(0.08); tone('sine', 170 * j, 45 * j, 0.3, 0.18); noise(2400 * j, 0.8, 0.25, 0.14, 'lowpass', 0, 300); [1400, 2100, 3200].forEach((f, i) => tone('triangle', f * j, f * j * 0.3, 0.2, 0.04, i * 0.025)); },
  shieldReady() { if (!ready() || !gap('shieldReady', 150)) return; const j = jitter(0.04); tone('sine', 700 * j, 1400 * j, 0.2, 0.06); tone('sine', 1400 * j, 2100 * j, 0.2, 0.04, 0.08); },
  boom() { if (!ready()) return; noise(300, 0.7, 0.6, 0.4, 'lowpass', 0, 60); tone('sine', 120, 40, 0.5, 0.3); },
  // ---------------------------------------------------------- the Vacuum (vacuum.js)
  // booting up: a rising motor and a three-note startup chime
  vacPowerOn() {
    if (!ready()) return;
    tone('sawtooth', 50, 220, 1.3, 0.12); tone('sine', 80, 330, 1.3, 0.14);
    [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.16, 0.1, 0.9 + i * 0.13));
  },
  // the charge wind-up: a two-tone alarm over a motor revving up
  vacChargeWind(dur) {
    if (!ready()) return;
    for (let k = 0; k * 0.12 < dur; k++) tone('square', k % 2 ? 900 : 1250, k % 2 ? 900 : 1250, 0.09, 0.05, k * 0.12);
    tone('sawtooth', 90, 520, dur, 0.1);
  },
  // the ram itself: a roaring whoosh
  vacRam() {
    if (!ready()) return;
    const j = jitter(0.08);
    tone('triangle', 260 * j, 90, 0.07, 0.14); noise(2200 * j, 1.5, 0.04, 0.12, 'bandpass');   // the clunk as its wheels bite
    noise(300 * j, 0.8, 0.8, 0.3, 'lowpass', 0, 3500 * j);
    tone('sawtooth', 70 * j, 190 * j, 0.8, 0.14); tone('square', 140 * j, 300 * j, 0.6, 0.05);
  },
  // the ram landing on the jelly: a hard plastic thwack, a thud, a rattle of its insides
  vacSmack() {
    if (!ready() || !gap('vacSmack', 150)) return;
    const j = jitter(0.1);
    noise(3400 * j, 1.2, 0.035, 0.3, 'bandpass'); tone('sine', 150 * j, 45, 0.25, 0.32);
    noise(700 * j, 0.8, 0.2, 0.18, 'lowpass', 0.01, 160);
    for (let k = 0; k < 4; k++) noise((1800 + Math.random() * 2400) * j, 4, 0.015, 0.06, 'bandpass', 0.06 + k * 0.04 + Math.random() * 0.02);
  },
  // slamming into a wall (or stopping hard): a boom, a crunch and a metal clang
  vacImpact(hard = true) {
    if (!ready() || !gap('vacImpact', 200)) return;
    const j = jitter(0.08);
    tone('sine', 130 * j, 32, 0.5, hard ? 0.5 : 0.3);
    noise(900 * j, 0.7, 0.35, hard ? 0.35 : 0.2, 'lowpass', 0, 120);
    if (hard) { tone('triangle', 1830 * j, 1790 * j, 0.5, 0.07); tone('triangle', 2470 * j, 2400 * j, 0.4, 0.05); tone('triangle', 3610 * j, 3500 * j, 0.3, 0.03); }
  },
  // suction: a dub-wobbling roar that swells in, a sub that breathes in, and a rising whistle
  vacSuction(dur) {
    if (!ready()) return;
    const t = now(), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), j = jitter(0.08);
    tone('triangle', 220 * j, 70, 0.1, 0.14); noise(1600 * j, 1.5, 0.05, 0.1, 'bandpass');   // the motor kicking in
    src.buffer = noiseBuf; src.loop = true;
    f.type = 'lowpass'; f.Q.value = 9;
    f.frequency.setValueAtTime(700 * j, t);
    lfo.frequency.setValueAtTime(7, t); lfo.frequency.linearRampToValueAtTime(2.5, t + dur);   // the wobble slows as it pulls harder
    lg.gain.value = 600;
    lfo.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.5);
    g.gain.setValueAtTime(0.3, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.25); lfo.start(t); lfo.stop(t + dur + 0.25);
    const sub = ctx.createOscillator(), sg = ctx.createGain(), sl = ctx.createOscillator(), slg = ctx.createGain();
    sub.frequency.setValueAtTime(55, t); sub.frequency.exponentialRampToValueAtTime(38, t + dur);
    sl.frequency.value = 3.5; slg.gain.value = 0.12; sl.connect(slg).connect(sg.gain);
    sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.22, t + 0.6); sg.gain.setValueAtTime(0.22, t + dur - 0.3); sg.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    sub.connect(sg).connect(master);
    sub.start(t); sub.stop(t + dur + 0.25); sl.start(t); sl.stop(t + dur + 0.25);
    tone('sawtooth', 180 * j, 720 * j, dur, 0.035);
  },
  // something caught in its mouth: a grinding crunch and grit rattling round the intake
  vacGrind() {
    if (!ready() || !gap('vacGrind', 160)) return;
    const j = jitter(0.15);
    noise(1300 * j, 2, 0.06, 0.12, 'bandpass'); tone('square', 110 * j, 70, 0.08, 0.05);
    for (let k = 0; k < 3; k++) noise((2500 + Math.random() * 2500) * j, 5, 0.012, 0.04, 'bandpass', 0.03 + k * 0.03);
  },
  // the side brushes whirring up (a rising, fluttering whine), and each sweep (a swish and a thump)
  vacBrushes(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.6);
    trem.frequency.value = 32; tg.gain.value = 0.05; trem.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0.06, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05); trem.start(t); trem.stop(t + dur + 0.05);
  },
  vacSweep() {
    if (!ready() || !gap('vacSweep', 120)) return;
    const j = jitter(0.1);
    noise(5000 * j, 1.2, 0.28, 0.3, 'bandpass', 0, 700 * j);
    tone('sine', 160 * j, 60, 0.18, 0.25);
    for (let k = 0; k < 4; k++) noise((2000 + Math.random() * 3000) * j, 5, 0.012, 0.05, 'bandpass', 0.1 + k * 0.05 + Math.random() * 0.03);   // grit flicked off
  },
  // the bin dropping roaches: a clunk, the hatch hissing, a scatter of tiny legs
  // before it: the bin rattling as the hatch unlatches
  vacDumpWind() {
    if (!ready()) return;
    const j = jitter(0.1);
    for (let k = 0; k < 6; k++) noise(1400 * j, 4, 0.025, 0.06, 'bandpass', k * 0.08);
    tone('triangle', 500 * j, 700 * j, 0.4, 0.025);
  },
  vacDump() {
    if (!ready()) return;
    const j = jitter(0.1);
    tone('triangle', 320 * j, 110, 0.16, 0.22);
    noise(2500 * j, 1, 0.3, 0.12, 'highpass', 0.05);
    for (let k = 0; k < 8; k++) noise(4000 + Math.random() * 3000, 6, 0.01, 0.07, 'bandpass', 0.15 + k * 0.035 + Math.random() * 0.02);
  },
  // spinning: a whirling siren with a whoosh going round, and a pft for every dust clump
  vacSpin(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 600 * jitter(0.06);
    lfo.frequency.value = 4.5; lg.gain.value = 260; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.2); g.gain.setValueAtTime(0.06, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (let k = 0; k * 0.22 < dur; k++) noise(800, 0.7, 0.2, 0.12, 'bandpass', k * 0.22, 2400);
  },
  vacSpray() { if (!ready() || !gap('vacSpray', 90)) return; noise(1400 * jitter(0.2), 1, 0.08, 0.12, 'bandpass', 0, 500); },
  // a dust clump bursting: a dull pff and grit (on the jelly: a thump under it)
  vacClump(hit = false) {
    if (!ready() || !gap('vacClump', hit ? 60 : 110)) return;
    const j = jitter(0.18);
    noise(1100 * j, 1, 0.07, hit ? 0.16 : 0.06, 'lowpass', 0, 300);
    if (hit) tone('sine', 160 * j, 60, 0.1, 0.12);
    noise((3000 + Math.random() * 2000) * j, 5, 0.012, hit ? 0.05 : 0.025, 'bandpass', 0.04);
  },
  // launching the lanternflies: a rising alarm wail, then four pops out of the bin
  vacFliesWind() {
    if (!ready()) return;
    tone('square', 420, 980, 0.32, 0.06); tone('square', 420, 980, 0.32, 0.06, 0.36);
  },
  vacFliesLaunch() {
    if (!ready()) return;
    const j = jitter(0.08);
    for (let k = 0; k < 4; k++) { const q = j * jitter(0.05); tone('sine', 260 * q, 900 * q, 0.09, 0.2, k * 0.07); noise(1800 * q, 1, 0.06, 0.15, 'bandpass', k * 0.07); }
    noise(900 * j, 1, 0.45, 0.06, 'bandpass', 0.05, 3000 * j);   // them whooshing up out of the bin
  },
  // the shield: up (a shimmering chord swelling in), hit (a ringing deflect), broken (shattering glass)
  shieldUp() {
    if (!ready()) return;
    [880, 1108.7, 1318.5, 1760].forEach((f, i) => tone('sine', f * 0.98, f, 0.9, 0.06, i * 0.05));
    noise(3000, 0.7, 0.6, 0.12, 'bandpass', 0, 9000);
  },
  shieldHit() {
    if (!ready() || !gap('shieldHit', 90)) return;
    const j = jitter(0.05);
    tone('sine', 2640 * j, 2600 * j, 0.22, 0.07); tone('sine', 3960 * j, 3900 * j, 0.14, 0.04);
  },
  shieldBreak() {
    if (!ready()) return;
    noise(6000, 0.8, 0.6, 0.35, 'highpass');
    [2400, 1800, 1300, 900].forEach((f, i) => tone('triangle', f, f * 0.7, 0.3, 0.07, i * 0.05));
    tone('sine', 140, 40, 0.5, 0.3);
  },
  // below 45%: an angry two-tone siren
  vacAngry() {
    if (!ready()) return;
    for (let k = 0; k < 6; k++) tone('sawtooth', k % 2 ? 620 : 830, k % 2 ? 620 : 830, 0.22, 0.07, k * 0.24);
  },
  // down: the motor winding down to nothing, crackles, a boom
  vacDeath() {
    if (!ready()) return;
    tone('sawtooth', 420, 28, 1.8, 0.16); tone('square', 210, 20, 1.8, 0.06);
    for (let k = 0; k < 10; k++) noise(3000 + Math.random() * 4000, 3, 0.02, 0.12, 'bandpass', 0.2 + Math.random() * 1.4);
    noise(300, 0.7, 0.9, 0.4, 'lowpass', 1.6, 60); tone('sine', 110, 30, 0.8, 0.4, 1.6);
  },
  // the combo ticking up at milestones
  // a house fly's poke: a buzzy chirp up as the straw shoots out, and a wet little tick at the end
  flyPoke() {
    if (!ready() || !gap('flyPoke', 90)) return;
    const j = jitter(0.1);
    tone('sawtooth', 240 * j, 520 * j, 0.09, 0.05); tone('sawtooth', 248 * j, 540 * j, 0.09, 0.035);
    noise(3200 * j, 4, 0.04, 0.08, 'bandpass', 0.07);
  },
  // a bug's hit landing on the jelly (enemies.js landed): a wet slap with a low body and droplets
  // pattering after; a touch (contact) adds a dry crunch of a bite or a ram. Many bugs: one per 90 ms
  bugHit(contact = false) {
    if (!ready() || !gap('bugHit', 90)) return;
    const j = jitter(0.12);
    if (contact) noise(3600 * j, 2, 0.03, 0.12, 'bandpass');
    noise(1100 * j, 1, 0.09, 0.18, 'lowpass', 0, 300); tone('sine', 190 * j, 70, 0.1, 0.1);
    patter(3, 0.04, 0.12);
  },
  // an ant squad setting off rolling: a skittering whoosh, little feet ticking under it
  antDash() {
    if (!ready() || !gap('antDash', 80)) return;
    const j = jitter(0.12);
    noise(2200 * j, 1.2, 0.22, 0.07, 'bandpass', 0, 900 * j);
    for (let k = 0; k < 4; k++) noise(5000 + Math.random() * 2000, 5, 0.01, 0.05, 'bandpass', k * 0.05);
  },
  // the lanternfly springing off (a flick and a whirr of wings) and slamming down (a thud with bits pattering)
  leapJump() { if (!ready() || !gap('leapJump', 80)) return; const j = jitter(0.12); tone('triangle', 500 * j, 1200 * j, 0.06, 0.05); noise(2600 * j, 1.5, 0.25, 0.05, 'bandpass', 0.02, 1400 * j); },
  leapSlam() {
    if (!ready() || !gap('leapSlam', 70)) return;
    const j = jitter(0.12);
    noise(5000 * j, 1, 0.03, 0.1, 'highpass'); tone('sine', 140 * j, 45, 0.18, 0.2); noise(500 * j, 0.8, 0.18, 0.18, 'lowpass', 0, 120);
    patter(3, 0.06, 0.25);
  },
  // spit leaving the mouth: a laser's zap with a thin whine as it flies, or a web ball's wet thwip
  spit(kind = 'laser') {
    if (!ready() || !gap('spit', 80)) return;
    const j = jitter(0.1);
    if (kind === 'web') { noise(1600 * j, 1.5, 0.1, 0.1, 'bandpass', 0, 600); tone('sine', 300 * j, 140, 0.08, 0.06); return; }
    tone('sawtooth', 1800 * j, 500 * j, 0.08, 0.04); noise(6000 * j, 1, 0.03, 0.06, 'highpass'); tone('sine', 2400 * j, 1600 * j, 0.18, 0.015, 0.02);
  },
  // a glob of sap landing: a splat, a low plop and drops pattering
  lobSplat() { if (!ready() || !gap('lobSplat', 70)) return; const j = jitter(0.12); noise(900 * j, 1, 0.14, 0.2, 'lowpass', 0, 220); tone('sine', 160 * j, 60, 0.12, 0.12); patter(3, 0.05, 0.2); },
  // a Cutting sprouting: a leafy rustle, a creak of a stem shooting up and a pop
  sprout() { if (!ready() || !gap('sprout', 120)) return; const j = jitter(0.1); noise(3000 * j, 2, 0.15, 0.08, 'bandpass'); tone('sawtooth', 120 * j, 200 * j, 0.25, 0.03); tone('sine', 300 * j, 700 * j, 0.08, 0.06, 0.05); patter(3, 0.1, 0.2); },
  // an Aerial root: a woody thunk as it lands, a creak each time its hold tightens, a dry rustle as it withers
  rootLand() { if (!ready() || !gap('rootLand', 70)) return; const j = jitter(0.12); noise(5000 * j, 2, 0.02, 0.08, 'bandpass'); tone('triangle', 180 * j, 80, 0.1, 0.1); noise(600 * j, 1, 0.12, 0.12, 'lowpass'); patter(3, 0.05, 0.2); },
  rootSqueeze() { if (!ready() || !gap('rootSqueeze', 300)) return; const j = jitter(0.1); tone('sawtooth', 90 * j, 70 * j, 0.18, 0.03); noise(800 * j, 5, 0.18, 0.04, 'bandpass', 0, 500); },
  rootWither() { if (!ready() || !gap('rootWither', 120)) return; for (let k = 0; k < 4; k++) noise(2500 + Math.random() * 2000, 3, 0.05, 0.04, 'bandpass', k * 0.06); },
  // the millipede: a clicking rattle as it coils (all those plates), a whirr that revs up, a rolling rumble
  milliCurl() {
    if (!ready()) return;
    for (let k = 0; k < 10; k++) noise(3500 + Math.random() * 2500, 5, 0.012, 0.07, 'bandpass', k * 0.035 + Math.random() * 0.01);
  },
  milliRev(dur) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
    trem.frequency.setValueAtTime(8, t); trem.frequency.exponentialRampToValueAtTime(40, t + dur); tg.gain.value = 0.03; trem.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.1); trem.start(t); trem.stop(t + dur + 0.1);
  },
  milliRoll(dur) {
    if (!ready()) return;
    const j = jitter(0.1);
    noise(260 * j, 0.8, dur, 0.22, 'lowpass', 0, 520 * j); tone('sine', 90 * j, 60, dur, 0.12);
  },
  // the dragonfly: a dry papery whirr as it darts, a sharper one as it dodges a hit, the beam's
  // charge (a whine climbing for the whole charge, thickening as it goes: the only warning) and
  // the crack of the beam itself. beamCharge returns a function that cuts it off.
  zip() { if (!ready() || !gap('zip', 120)) return; const j = jitter(0.15); noise(1800 * j, 2, 0.08, 0.05, 'bandpass', 0, 3400 * j); },
  evade() { if (!ready()) return; noise(1400, 1.5, 0.14, 0.12, 'bandpass', 0, 5200); tone('triangle', 900, 1600, 0.08, 0.03); },
  beamCharge(dur) {
    if (!ready()) return null;
    const t = now(), k = pitch(), g = ctx.createGain(), oscs = [];
    for (const [type, f0, f1, d] of [['sine', 220, 1900, 0], ['sawtooth', 110, 950, 4], ['square', 330, 2850, -6]]) {
      const o = ctx.createOscillator();
      o.type = type; o.detune.value = d;
      o.frequency.setValueAtTime(f0 * k, t); o.frequency.exponentialRampToValueAtTime(f1 * k, t + dur);
      const og = ctx.createGain(); og.gain.value = type === 'sine' ? 1 : 0.25;
      o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05); oscs.push(o);
    }
    const trem = ctx.createOscillator(), tg = ctx.createGain();            // a flutter that speeds up
    trem.frequency.setValueAtTime(6, t); trem.frequency.exponentialRampToValueAtTime(38, t + dur);
    tg.gain.value = 0.012; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(t + dur + 0.05); oscs.push(trem);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.07, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    g.connect(master);
    return () => { const n = now(); g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.05); for (const o of oscs) { try { o.stop(n + 0.06); } catch {} } };
  },
  beamFire() {
    if (!ready() || !gap('beamFire', 60)) return;
    const j = jitter(0.1);
    noise(6000 * j, 0.7, 0.06, 0.25, 'highpass');
    tone('sawtooth', 2400 * j, 300, 0.18, 0.08); tone('square', 1200 * j, 150, 0.14, 0.04);
    noise(3800 * j, 2, 0.25, 0.04, 'bandpass', 0.08, 1500);              // a sizzle dying away where it struck
  },
  // the stag beetle: an electric whine rising through its charge with crackles thickening in it
  // (returns a function that cuts it off), the zap of the release with a whoosh as the ball flies,
  // the crack of a hit; the explosion where it lands is sparkBoom
  sparkCharge(dur = 1) {
    if (!ready()) return null;
    const t = now(), k = pitch() * jitter(0.06), g = ctx.createGain(), oscs = [];
    for (const [type, f0, f1, v] of [['sawtooth', 160, 1300, 0.5], ['square', 240, 1950, 0.2], ['sine', 80, 320, 1]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; og.gain.value = v;
      o.frequency.setValueAtTime(f0 * k, t); o.frequency.exponentialRampToValueAtTime(f1 * k, t + dur);
      o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05); oscs.push(o);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.075, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    g.connect(master);
    for (let i = 0; i < 9; i++) { const d = dur * Math.sqrt(Math.random()); noise(3500 + Math.random() * 4000, 4, 0.025, 0.04 + 0.08 * d / dur, 'bandpass', d); }   // crackles, more as it nears
    return () => { const n = now(); g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.05); for (const o of oscs) { try { o.stop(n + 0.06); } catch {} } };
  },
  sparkFire() {
    if (!ready()) return;
    const j = jitter(0.1);
    noise(7000 * j, 0.8, 0.05, 0.28, 'highpass');                       // the snap
    tone('sawtooth', 2600 * j, 220, 0.16, 0.08); tone('square', 1300 * j, 180, 0.12, 0.04);
    noise(1800 * j, 1.2, 0.35, 0.1, 'bandpass', 0.02, 600);              // the whoosh as it flies
  },
  sparkHit() {
    if (!ready() || !gap('sparkHit', 80)) return;
    const j = jitter(0.12);
    noise(5200 * j, 0.7, 0.07, 0.3, 'highpass'); tone('sawtooth', 1500 * j, 120, 0.18, 0.08); tone('sine', 140 * j, 50, 0.22, 0.12);
    for (let i = 0; i < 4; i++) noise(3000 + Math.random() * 3500, 3, 0.02, 0.05, 'bandpass', 0.08 + Math.random() * 0.3);
  },
  // the ball exploding: a sharp crack, a low boom with a rumble under it, then crackles and bits pattering down
  sparkBoom() {
    if (!ready() || !gap('sparkBoom', 70)) return;
    const j = jitter(0.12);
    noise(6000 * j, 0.7, 0.05, 0.3, 'highpass');
    tone('sine', 150 * j, 38, 0.4, 0.3); tone('square', 700 * j, 90, 0.12, 0.06);
    noise(380 * j, 0.9, 0.45, 0.28, 'lowpass', 0.01, 120);
    for (let i = 0; i < 6; i++) noise(2600 + Math.random() * 4000, 3, 0.02, 0.05, 'bandpass', 0.06 + Math.random() * 0.45);
    for (let i = 0; i < 3; i++) tone('triangle', (1800 + Math.random() * 1600) * j, 900, 0.04, 0.03, 0.2 + Math.random() * 0.3);
  },
  // the mantis: a dry rustle of a swat and the snap of its forelegs; the worm in it: a wet burst
  // out of the body and the crack of its whip
  mantisSwat() { if (!ready() || !gap('mantisSwat', 70)) return; const j = jitter(0.1); noise(2400 * j, 1.2, 0.12, 0.16, 'bandpass', 0, 900 * j); tone('square', 900 * j, 300, 0.05, 0.04, 0.09); noise(5000 * j, 3, 0.03, 0.12, 'bandpass', 0.1); },
  wormBurst() { if (!ready() || !gap('wormBurst', 70)) return; const j = jitter(0.1); noise(500 * j, 0.8, 0.35, 0.3, 'lowpass', 0, 160); tone('sine', 160 * j, 50, 0.3, 0.14); noise(2600 * j, 2, 0.15, 0.1, 'bandpass', 0.05); patter(4, 0.12, 0.3); },
  wormCrack() { if (!ready() || !gap('wormCrack', 70)) return; const j = jitter(0.1); noise(1600 * j, 1.5, 0.1, 0.12, 'bandpass', 0, 4800 * j); noise(7000 * j, 0.7, 0.04, 0.3, 'highpass', 0.09); noise(400 * j, 0.8, 0.12, 0.12, 'lowpass', 0.1, 120); patter(3, 0.14, 0.25); },
  // the worm's lash leaving: a whoosh as it cracks down (wormCrack is where it lands)
  whipLash() { if (!ready() || !gap('whipLash', 70)) return; const j = jitter(0.12); noise(1100 * j, 1.2, 0.12, 0.08, 'bandpass', 0, 4200 * j); },
  // wasps: a buzz climbing as one rears to dive (the only warning), the sting, one crawling out of its nest
  waspWind(dur = 0.5) {
    if (!ready()) return;
    const t = now(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), k = pitch();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(190 * k, t); o.frequency.exponentialRampToValueAtTime(420 * k, t + dur);
    o2.frequency.setValueAtTime(196 * k, t); o2.frequency.exponentialRampToValueAtTime(430 * k, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  },
  waspSting() { if (!ready() || !gap('waspSting', 60)) return; const j = jitter(0.1); noise(4200 * j, 2, 0.05, 0.25, 'bandpass'); tone('sawtooth', 900 * j, 120, 0.2, 0.08); noise(700 * j, 0.8, 0.2, 0.2, 'lowpass', 0.03, 200); patter(3, 0.1, 0.25); },
  // a wasp setting off on its dive: a buzzing rip that climbs away
  diveGo() { if (!ready() || !gap('diveGo', 80)) return; const j = jitter(0.12); noise(2000 * j, 1.5, 0.2, 0.07, 'bandpass', 0, 5000 * j); tone('sawtooth', 420 * j, 620 * j, 0.15, 0.03); },
  waspHatch() { if (!ready() || !gap('waspHatch', 300)) return; noise(3000, 3, 0.08, 0.05, 'bandpass'); tone('sawtooth', 220, 260, 0.25, 0.02, 0.05); },
  // the Clog: a deep gurgle rising out of the drain, a wet growl of a roar, hair ropes creaking
  // taut then cracking down, a squelching roll, rustling hair, the drain glugging, a splat, death
  clogRise() {
    if (!ready()) return;
    for (let k = 0; k < 10; k++) { const f = 90 + Math.random() * 160; tone('sine', f, f * 1.8, 0.09, 0.12, k * 0.12 + Math.random() * 0.05); }
    noise(300, 0.8, 1.4, 0.18, 'lowpass', 0, 900);
  },
  clogRoar() {
    if (!ready()) return;
    tone('sawtooth', 75, 52, 1.0, 0.16); tone('square', 112, 70, 0.9, 0.06);
    noise(500, 0.7, 1.0, 0.2, 'lowpass', 0, 200);
    for (let k = 0; k < 6; k++) { const f = 120 + Math.random() * 120; tone('sine', f, f * 1.6, 0.06, 0.07, 0.1 + k * 0.14); }   // gurgling in it
  },
  clogLashWind() { if (!ready()) return; tone('sawtooth', 160, 420, 0.8, 0.04); noise(2200, 3, 0.8, 0.05, 'bandpass', 0, 4000); },
  // the crack (transient), the wet slap down (body), hair and gunk pattering after (debris)
  clogLash() {
    if (!ready()) return; const j = jitter(0.1);
    noise(6000 * j, 0.6, 0.06, 0.4, 'highpass'); noise(700 * j, 0.9, 0.25, 0.3, 'lowpass', 0.03, 150); tone('sine', 160 * j, 50, 0.25, 0.25, 0.03);
    for (let k = 0; k < 4; k++) noise(1400 + Math.random() * 2400, 3, 0.02, 0.05, 'bandpass', 0.09 + Math.random() * 0.25);
  },
  clogRollWind() { if (!ready()) return; tone('sawtooth', 80, 300, 1.0, 0.06); noise(900, 1, 1.0, 0.08, 'bandpass', 0, 2500); },
  clogRoll() { if (!ready()) return; const j = jitter(0.1); noise(2200 * j, 1.2, 0.05, 0.12, 'bandpass'); noise(250 * j, 0.7, 1.1, 0.28, 'lowpass', 0, 600); for (let k = 0; k < 8; k++) noise(500 * jitter(0.15), 2, 0.06, 0.1, 'lowpass', k * 0.13); },
  clogRustle() { if (!ready()) return; for (let k = 0; k < 8; k++) noise(3000 + Math.random() * 2000, 2, 0.08, 0.05, 'bandpass', k * 0.1); },
  // the snap of hair springing up (transient), a wet thump (body), strands settling (debris)
  clogSnare() {
    if (!ready()) return; const j = jitter(0.1);
    noise(4500 * j, 0.8, 0.15, 0.3, 'highpass'); noise(1200 * j, 1.5, 0.3, 0.15, 'bandpass', 0.03, 400);
    tone('sine', 130 * j, 50, 0.18, 0.18, 0.02);
    for (let k = 0; k < 4; k++) noise(3000 + Math.random() * 2500, 3, 0.03, 0.04, 'bandpass', 0.12 + Math.random() * 0.25);
  },
  // a glob of gunk spat out as it spins: a wet click (transient) and a short whiz away (travel)
  clogSpit() { if (!ready() || !gap('clogSpit', 60)) return; const j = jitter(0.15); noise(1800 * j, 2, 0.03, 0.12, 'bandpass'); tone('sine', 260 * j, 120 * j, 0.05, 0.06); noise(2400 * j, 1.4, 0.16, 0.05, 'bandpass', 0.02, 900); },
  // the plug pulled: a deep hollow thoonk (transient and body), then the first glugs (debris)
  clogPlug() {
    if (!ready()) return; const j = jitter(0.08);
    noise(1600 * j, 2, 0.04, 0.2, 'bandpass'); tone('sine', 95 * j, 38, 0.35, 0.3); noise(300 * j, 0.8, 0.3, 0.2, 'lowpass', 0.02, 80);
    for (let k = 0; k < 4; k++) { const f = 80 + Math.random() * 120; tone('sine', f, f * 2, 0.07, 0.08, 0.12 + k * 0.08 + Math.random() * 0.03); }
  },
  // it shakes the tangles loose: a wet rip (transient), a squelch (body), hair landing (debris)
  clogShed() {
    if (!ready()) return; const j = jitter(0.1);
    noise(3800 * j, 1, 0.08, 0.22, 'bandpass', 0, 1200); noise(600 * j, 0.9, 0.2, 0.22, 'lowpass', 0.02, 180); tone('sine', 150 * j, 60, 0.16, 0.15, 0.02);
    for (let k = 0; k < 5; k++) noise(1200 + Math.random() * 2000, 3, 0.03, 0.05, 'bandpass', 0.15 + Math.random() * 0.25);
  },
  clogGurgle(dur = 3) {
    if (!ready()) return;
    noise(200, 0.8, dur, 0.22, 'lowpass', 0, 120);
    for (let k = 0; k * 0.14 < dur; k++) { const f = 70 + Math.random() * 130; tone('sine', f, f * 2, 0.08, 0.1, k * 0.14 + Math.random() * 0.06); }
  },
  // the tap running into the tub, then the plug pulled: a glugging rush and a deep sucking whirl
  clogPour(dur = 2) { if (!ready()) return; noise(2600, 0.6, dur, 0.22, 'bandpass', 0, 1200); noise(600, 0.8, dur, 0.12, 'lowpass', 0, 300); },
  clogDrain(dur = 2.4) {
    if (!ready()) return;
    noise(400, 1.2, dur, 0.3, 'lowpass', 0, 90);
    tone('sine', 140, 45, dur, 0.18);
    for (let k = 0; k * 0.11 < dur; k++) { const f = 60 + Math.random() * 120; tone('sine', f, f * 2.2, 0.07, 0.12, k * 0.11 + Math.random() * 0.04); }
  },
  // the Clog bounding about: a soft hop off (small) and a squelchy thud as it lands (`land`)
  clogHop(land = false) {
    if (!ready() || !gap('clogHop' + land, 120)) return;
    const j = jitter(0.12);
    if (land) { tone('sine', 150 * j, 55, 0.13, 0.13); noise(500 * j, 0.8, 0.1, 0.08, 'lowpass', 0, 180); noise(1500 * j, 2, 0.04, 0.03, 'bandpass', 0.02); }
    else noise(900 * j, 1.2, 0.12, 0.04, 'bandpass', 0, 1800);
  },
  // a big leap: a wet heave and a rising whoosh as it flies
  clogLeap() {
    if (!ready()) return;
    const j = jitter(0.1);
    tone('sine', 110 * j, 210 * j, 0.14, 0.12); noise(700 * j, 1, 0.1, 0.12, 'lowpass', 0, 300);
    noise(900 * j, 1.1, 0.5, 0.1, 'bandpass', 0.05, 2600);
  },
  // the Clog slamming into you or the tub: a heavy wet thud, a splat, and bits pattering down
  clogSlam() {
    if (!ready() || !gap('clogSlam', 90)) return;
    const j = jitter(0.1);
    tone('sine', 115 * j, 36, 0.32, 0.34); noise(800 * j, 0.8, 0.28, 0.3, 'lowpass', 0, 140);
    noise(1900 * j, 1.4, 0.08, 0.18, 'bandpass', 0.01, 700);
    for (let k = 0; k < 5; k++) noise(1200 + Math.random() * 2600, 3, 0.02, 0.05, 'bandpass', 0.08 + Math.random() * 0.3);
  },
  // the Pothos: a rustle gathering in its leaves (dur), the snap and whoosh of something flung from
  // it, a Cutting planting in the quilt (a soft thud and soil pattering), an Aerial root landing
  pothosGather(dur = 0.4) { if (!ready()) return; const j = jitter(0.1); noise(2400 * j, 2, dur, 0.04, 'bandpass', 0, 4200 * j); tone('sine', 180 * j, 320 * j, dur, 0.02); },
  pothosFling() {
    if (!ready() || !gap('pothosFling', 80)) return; const j = jitter(0.12);
    noise(5000 * j, 1, 0.03, 0.14, 'highpass'); noise(1400 * j, 1.4, 0.22, 0.09, 'bandpass', 0.01, 3600 * j);
    for (let k = 0; k < 4; k++) noise((2600 + Math.random() * 1800) * j, 2, 0.05, 0.035, 'bandpass', 0.03 + k * 0.05);
  },
  pothosPlant() {
    if (!ready() || !gap('pothosPlant', 40)) return; const j = jitter(0.15);
    noise(1800 * j, 1.5, 0.03, 0.1, 'bandpass'); noise(400 * j, 0.8, 0.12, 0.18, 'lowpass', 0, 120); tone('sine', 150 * j, 60, 0.1, 0.1);
    for (let k = 0; k < 3; k++) noise((700 + Math.random() * 500) * j, 2, 0.03, 0.035, 'lowpass', 0.05 + k * 0.035);
  },
  rootLand() {
    if (!ready() || !gap('rootLand', 50)) return; const j = jitter(0.12);
    noise(3600 * j, 1.5, 0.03, 0.14, 'bandpass'); noise(900 * j, 1, 0.12, 0.22, 'lowpass', 0, 250); tone('sine', 140 * j, 55, 0.12, 0.12);
    for (let k = 0; k < 3; k++) noise((600 + Math.random() * 500) * j, 2, 0.03, 0.04, 'lowpass', 0.06 + k * 0.04);
  },
  clogSplat() { if (!ready() || !gap('clogSplat', 70)) return; noise(900 * jitter(), 1, 0.12, 0.22, 'lowpass', 0, 250); tone('sine', 140, 60, 0.1, 0.12); },
  clogDeath() {
    if (!ready()) return;
    tone('sawtooth', 120, 30, 2.2, 0.15); noise(300, 0.7, 2.2, 0.25, 'lowpass', 0, 60);
    for (let k = 0; k < 16; k++) { const f = 60 + Math.random() * 150; tone('sine', f, f * 1.5, 0.1, 0.1, k * 0.13 + Math.random() * 0.06); }
  },
  // the ladybug and its missile: a buzz on take-off, a tap as it lands, the lock-on beeps (higher
  // as it closes in), the ignition roar, the rocket's hiss, the engine coughing out, the clink of
  // a spent one landing, the explosion
  ladyBuzz() { if (!ready()) return; tone('sawtooth', 170, 230, 0.35, 0.035); tone('sawtooth', 176, 238, 0.35, 0.025); },
  ladyLand() { if (!ready() || !gap('ladyLand', 80)) return; tone('triangle', 600, 300, 0.05, 0.05); },
  lockBeep(k = 0) { if (!ready()) return; const f = 1500 + k * 900; tone('square', f, f, 0.045, 0.035); },
  missileLaunch() {
    if (!ready()) return;
    const j = jitter(0.1);
    noise(5000 * j, 0.7, 0.08, 0.25, 'highpass');                     // the crack of ignition
    noise(400 * j, 0.7, 0.6, 0.3, 'lowpass', 0.02, 2600 * j);         // the roar, rising
    tone('sawtooth', 110 * j, 380 * j, 0.5, 0.07, 0.02);
  },
  missileHiss() { if (!ready() || !gap('missileHiss', 150)) return; noise(3800 * jitter(), 1.4, 0.24, 0.035, 'bandpass'); },
  missileSputter() { if (!ready()) return; tone('sawtooth', 300, 70, 0.7, 0.06); for (let k = 0; k < 5; k++) noise(700, 1, 0.05, 0.12, 'lowpass', 0.05 + k * 0.11 + Math.random() * 0.05); },
  missileCough() { if (!ready() || !gap('missileCough', 90)) return; noise(500 * jitter(0.2), 1, 0.06, 0.1, 'lowpass'); },
  missileClink() { if (!ready()) return; tone('triangle', 2300, 2200, 0.09, 0.05); tone('triangle', 3400, 3300, 0.06, 0.03, 0.05); noise(1500, 1, 0.3, 0.06, 'bandpass', 0.05, 600); },
  missileBoom() {
    if (!ready() || !gap('missileBoom', 70)) return;
    const j = jitter(0.1);
    noise(3000 * j, 0.6, 0.15, 0.35, 'highpass');
    noise(500 * j, 0.7, 0.7, 0.45, 'lowpass', 0, 60);
    tone('sine', 120 * j, 35, 0.6, 0.4);
    for (let k = 0; k < 6; k++) noise(2500 + Math.random() * 3000, 3, 0.02, 0.08, 'bandpass', 0.08 + Math.random() * 0.35);   // crackle
  },
  // the Cream Whipper: the regulator hissing as a balloon fills (rubber creaking as it stretches),
  // the squeak as it lets go, the bang when it bursts, the cream spraying
  balloonFill(dur = 1) {
    if (!ready()) return;
    noise(3500, 1.5, dur, 0.08, 'bandpass', 0, 5500);
    for (let k = 0; k < 4; k++) tone('triangle', 300 + k * 90, 380 + k * 120, 0.08, 0.035, k * dur / 4 + 0.05);
  },
  balloonLoose() { if (!ready()) return; const j = jitter(0.08); tone('square', 900 * j, 1400 * j, 0.12, 0.03); tone('sine', 600 * j, 1100 * j, 0.15, 0.04); noise(3000 * j, 1.5, 0.25, 0.04, 'bandpass', 0.05, 1500); },
  balloonTick() { if (!ready() || !gap('balloonTick', 80)) return; tone('sine', 1800, 1700, 0.03, 0.03); },
  balloonPop() {
    if (!ready()) return;
    const j = jitter(0.1);
    noise(2500 * j, 0.6, 0.18, 0.5, 'highpass'); noise(400 * j, 0.8, 0.35, 0.35, 'lowpass', 0, 90);
    tone('sine', 140 * j, 40, 0.4, 0.35);
    for (let k = 0; k < 5; k++) noise(5000 + Math.random() * 3000, 4, 0.015, 0.06, 'bandpass', 0.05 + k * 0.04);   // scraps of rubber
  },
  // your ears going funny: a long slide down
  daze() { if (!ready()) return; tone('sine', 520, 180, 0.9, 0.08); tone('triangle', 260, 90, 1.1, 0.06); },
  // the nozzle opening (a pssht), the cream rushing out, and it sputtering as it runs dry
  creamSpray(dur = 0.8) {
    if (!ready()) return; const j = jitter(0.1);
    noise(5200 * j, 1, 0.05, 0.16, 'highpass'); noise(2600 * j, 0.9, dur, 0.18, 'bandpass', 0, 1600); noise(700 * j, 1, dur * 0.6, 0.1, 'lowpass');
    for (let k = 0; k < 3; k++) noise(1100 * jitter(0.2), 2, 0.04, 0.06, 'lowpass', dur - 0.1 + k * 0.06);
  },
  // cream splatting onto the jelly: a soft wet slap and a few drops
  creamSplat() { if (!ready() || !gap('creamSplat', 80)) return; const j = jitter(0.12); noise(1500 * j, 1, 0.1, 0.2, 'lowpass', 0, 400); tone('sine', 240 * j, 110, 0.09, 0.08); for (let k = 0; k < 3; k++) noise(3500 * jitter(0.3), 3, 0.02, 0.04, 'bandpass', 0.06 + k * 0.05); },
  // the Wall Clock: a tick, a whoosh as its hand sweeps, a bronze bell for each chime (k: which, a
  // little lower each time), the wreath whirring through the air
  // the Alligator (elites.js): a soft plush thump on the bed, its tail or its whole body landing
  // (k: how heavy) a fabric slap, the plush body's thump, then a soft patter as the quilt settles
  crocThump(k = 1) {
    if (!ready() || !gap('crocThump', 60)) return; const j = jitter(0.1);
    noise(1500 * j, 1.2, 0.035, 0.12 * Math.min(1, k), 'bandpass', 0, 600);
    noise(260 * j, 0.8, 0.18 * k, 0.3, 'lowpass', 0, 90); tone('sine', 110 * j, 45, 0.22 * k, 0.22);
    for (let i = 0; i < 3; i++) noise((500 + Math.random() * 400) * j, 1.5, 0.04, 0.05 * Math.min(1, k), 'lowpass', 0.07 + i * 0.05 + Math.random() * 0.02);
  },
  // the Bull: its rush landing (a snap, a deep boom through the table, stuffing pattering down), a
  // puff for each spiral beat, a spiral Shot striking, the snort sending its little bulls off and
  // a little bull bursting (hit: on the jelly, heavier)
  bullRush() {
    if (!ready()) return; const j = jitter(0.1);
    noise(2600 * j, 1, 0.04, 0.2, 'bandpass'); noise(300 * j, 0.7, 0.6, 0.38, 'lowpass', 0, 60); tone('sine', 120 * j, 38, 0.5, 0.3);
    for (let i = 0; i < 5; i++) noise((700 + Math.random() * 600) * j, 2, 0.04, 0.05, 'lowpass', 0.1 + i * 0.06 + Math.random() * 0.03);
  },
  bullShot() { if (!ready() || !gap('bullShot', 70)) return; const j = jitter(0.15); noise(1800 * j, 2, 0.05, 0.05, 'bandpass', 0, 3200 * j); tone('sine', 260 * j, 140 * j, 0.05, 0.035); },
  bullHit() { if (!ready() || !gap('bullHit', 60)) return; const j = jitter(0.12); noise(3000 * j, 2, 0.03, 0.1, 'bandpass'); tone('sine', 180 * j, 70 * j, 0.09, 0.1); noise(900 * j, 1.5, 0.05, 0.04, 'lowpass', 0.05); },
  bullSnort() { if (!ready()) return; const j = jitter(0.1); for (let i = 0; i < 2; i++) noise(900 * j, 1.2, 0.12, 0.12, 'bandpass', i * 0.14, 400); tone('sawtooth', 90 * j, 70 * j, 0.25, 0.03, 0.04); },
  bullMini(hit = false) {
    if (!ready() || !gap('bullMini', 30)) return; const j = jitter(0.12);
    noise(2400 * j, 1.5, 0.03, 0.12, 'bandpass'); tone('sine', (hit ? 130 : 200) * j, 50, hit ? 0.2 : 0.1, hit ? 0.2 : 0.12);
    for (let i = 0; i < (hit ? 4 : 2); i++) noise((800 + Math.random() * 500) * j, 2, 0.03, 0.04, 'lowpass', 0.05 + i * 0.04);
  },
  // the Latticework Coffer (elites.js): its bellows wheezing out as the lid shoots off (dur: how
  // long it unfolds) and the lid slamming down; its lid creaking open (dur), the tongue lashing
  // out (and snapping back), latching on wet, and the chomp; its jewels pinging off its lid (k:
  // which one, each a little higher), whistling down (dur: how long they fall) and cracking apart
  cofferWheeze(dur = 0.5) {
    if (!ready()) return;
    noise(700, 1.2, dur, 0.14, 'bandpass', 0, 2200);
    for (const f of [196, 247, 294]) tone('sawtooth', f * jitter(0.02), f * 1.06, dur, 0.018);   // a reedy accordion chord
  },
  cofferSlam() {
    if (!ready() || !gap('cofferSlam', 60)) return; const j = jitter(0.1);
    noise(3200 * j, 2, 0.03, 0.12, 'bandpass'); noise(320 * j, 0.8, 0.16, 0.32, 'lowpass', 0, 90); tone('square', 140 * j, 55, 0.12, 0.08);
    for (let i = 0; i < 3; i++) { const f = (900 + Math.random() * 700) * j; tone('triangle', f, f * 0.8, 0.03, 0.025, 0.05 + i * 0.04 + Math.random() * 0.02); }   // the lattice rattling
  },
  cofferCreak(dur = 0.4) { if (!ready()) return; tone('sawtooth', 70, 110, dur, 0.05); noise(1100, 6, dur, 0.06, 'bandpass', 0, 600); },
  tongueLash() { if (!ready() || !gap('tongueLash', 80)) return; noise(5000, 0.7, 0.07, 0.25, 'highpass'); noise(1400, 1.5, 0.12, 0.14, 'bandpass', 0, 3600); },
  tongueLatch() { if (!ready()) return; noise(600, 1.4, 0.18, 0.25, 'lowpass', 0, 200); tone('sine', 300, 120, 0.15, 0.12); tone('sine', 520, 260, 0.08, 0.05, 0.05); },
  cofferChomp() { if (!ready()) return; const j = jitter(0.1); noise(900 * j, 0.9, 0.12, 0.35, 'lowpass', 0, 160); tone('square', 220 * j, 60, 0.1, 0.1); noise(4000 * j, 1.5, 0.04, 0.2, 'bandpass', 0.02); tone('sine', 90 * j, 40, 0.22, 0.25); noise(1600, 1, 0.16, 0.12, 'lowpass', 0.05, 500); },
  // chewing on the jelly: a short wet crunch each bite, its pitch a little different every time;
  // the spit: a wet splat and a puff of air
  cofferCrunch() { if (!ready() || !gap('cofferCrunch', 60)) return; const j = jitter(0.15); noise(2600 * j, 1.2, 0.07, 0.22, 'bandpass', 0, 900); tone('square', 160 * j, 70, 0.06, 0.07); noise(700 * j, 0.8, 0.1, 0.12, 'lowpass', 0.02, 250); },
  cofferSpit() { if (!ready()) return; const j = jitter(0.1); noise(1200 * j, 0.7, 0.18, 0.22, 'lowpass', 0, 3200); tone('sine', 420 * j, 160, 0.12, 0.08); noise(5000, 1, 0.06, 0.08, 'highpass', 0.08); },
  jewelLaunch(k = 0) { if (!ready() || !gap('jewelLaunch', 25)) return; const f = 1600 * Math.pow(2, (k % 12) / 24) * jitter(0.03); tone('triangle', f, f * 1.5, 0.08, 0.05); },
  jewelWhistle(dur = 0.25) { if (!ready()) return; const j = jitter(0.06); tone('sine', 2600 * j, 700 * j, dur, 0.06); tone('sine', 2750 * j, 760 * j, dur, 0.03); },
  jewelCrack() { if (!ready()) return; const j = jitter(0.08); noise(6500 * j, 0.8, 0.06, 0.3, 'highpass'); for (let k = 0; k < 5; k++) { const f = (2200 + k * 450) * j * jitter(0.05); tone('triangle', f, f * 0.9, 0.09, 0.04, k * 0.02 + Math.random() * 0.015); } noise(500 * j, 0.8, 0.2, 0.2, 'lowpass', 0, 150); },
  clockTick() { if (!ready() || !gap('clockTick', 70)) return; tone('square', 2400, 2200, 0.012, 0.03); noise(5000, 6, 0.01, 0.04, 'bandpass'); },
  clockSweep() { if (!ready()) return; const j = jitter(0.08); tone('square', 1800 * j, 1600 * j, 0.03, 0.05); noise(900 * j, 0.8, 0.5, 0.2, 'bandpass', 0, 3000); tone('sawtooth', 160 * j, 420 * j, 0.45, 0.05); },
  // gilt striking: a bright clang (transient), a thud if it caught the jelly (body), and the
  // ringing tinkle after (debris). hit false: the hand clacking into its stop
  clockStrike(hit = true) {
    if (!ready() || !gap('clockStrike', 60)) return; const j = jitter(0.06);
    noise(5000 * j, 2, 0.03, 0.14, 'highpass'); tone('triangle', 1250 * j, 1150 * j, 0.18, 0.06);
    if (hit) tone('sine', 170 * j, 60, 0.18, 0.2);
    for (let k = 0; k < 3; k++) tone('sine', (2600 + k * 700) * jitter(0.05), (2500 + k * 650), 0.12, 0.02, 0.04 + k * 0.05);
  },
  // the wreath back in Victory's hand: a soft metal catch
  wreathCatch() { if (!ready()) return; const j = jitter(0.06); tone('triangle', 1700 * j, 1600 * j, 0.08, 0.05); noise(900 * j, 1.5, 0.06, 0.08, 'lowpass'); },
  clockChime(k = 0) {
    if (!ready()) return;
    const f = 392 * Math.pow(2, -k * 2 / 12) * jitter(0.006);
    for (const [m, v, d] of [[1, 0.16, 1.6], [2.01, 0.07, 1.1], [2.76, 0.05, 0.8], [5.4, 0.025, 0.4]]) tone('sine', f * m, f * m * 0.998, d, v);
    noise(3000, 2, 0.03, 0.08, 'bandpass');                              // the strike
  },
  wreathWhirr() { if (!ready()) return; const j = jitter(0.08); noise(4200 * j, 1.5, 0.05, 0.12, 'highpass'); tone('triangle', 900 * j, 1500 * j, 0.08, 0.04); for (let k = 0; k < 6; k++) noise((1600 + k * 100) * j, 3, 0.09, 0.07, 'bandpass', k * 0.09, 800); },
  // the Soap Dispenser: a wet pump squelch, a squirt landing, a burst of bubbles let go, one popping
  soapPump() {
    if (!ready()) return;
    const j = jitter(0.08);
    noise(700 * j, 1.5, 0.14, 0.18, 'lowpass', 0, 180); tone('sine', 320 * j, 140 * j, 0.12, 0.12);
    noise(3200 * j, 2, 0.04, 0.07, 'highpass', 0.03); noise(1800 * j, 1.2, 0.3, 0.04, 'bandpass', 0.04, 700);   // the squirt, and the glob whooshing off
  },
  soapSplat() { if (!ready() || !gap('soapSplat', 60)) return; const j = jitter(); noise(1400 * j, 1.2, 0.1, 0.16, 'bandpass', 0, 500); tone('sine', 220 * j, 110, 0.08, 0.08); for (let k = 0; k < 3; k++) tone('sine', 1800 * jitter(0.3), 2600, 0.03, 0.025, 0.05 + k * 0.04); },
  soapBubbles() {
    if (!ready()) return;
    noise(900 * jitter(), 1, 0.08, 0.1, 'lowpass');                      // the foam letting go
    for (let k = 0; k < 9; k++) { const f = 500 + Math.random() * 700; tone('sine', f, f * 1.8, 0.05, 0.05, k * 0.025 + Math.random() * 0.02); }
    noise(1500 * jitter(), 1, 0.5, 0.03, 'bandpass', 0.05, 600);         // the ring drifting off
  },
  bubblePop() { if (!ready() || !gap('bubblePop', 40)) return; const f = 900 * jitter(0.2); tone('sine', f, f * 2.2, 0.04, 0.05); noise(6000, 3, 0.02, 0.04, 'highpass'); tone('sine', f * 2.6, f * 3, 0.02, 0.015, 0.03); },
  // a hit glancing off armour: a short metallic tink
  clink() { if (!ready() || !gap('clink', 80)) return; const j = jitter(0.06); tone('triangle', 2600 * j, 2400 * j, 0.08, 0.05); tone('sine', 3900 * j, 3700 * j, 0.05, 0.03); },
  combo(n) { if (!ready()) return; const f = 440 * Math.pow(2, Math.min(24, n / 5) / 12); tone('square', f, f * 1.5, 0.12, 0.05); },
};
