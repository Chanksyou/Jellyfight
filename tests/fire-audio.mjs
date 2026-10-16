// Render the real recording with point-blank hits and rapid casts; no audio device needed.
import assert from 'node:assert/strict';
import { start } from './lib.mjs';

const env = await start();
try {
  const page = await env.browser.newPage();
  await page.route('**/src/fire-sample.js', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto(env.url.replace('index.html', 'fire-sample.html'));
  const results = await page.evaluate(async () => {
    const S = await import('/src/sfx.js'), rate = 48000;
    const decoder = new OfflineAudioContext(2, rate, rate);
    const response = await fetch('/assets/audio/fireball-flight.mp3');
    if (!response.ok) throw new Error('Fire recording missing');
    const recording = await decoder.decodeAudioData(await response.arrayBuffer());
    const results = [];
    for (const [name, interval, count, life, immediate] of [
      ['point-blank', 0, 1, 0.016, false], ['short-range', 0, 1, 0.05, false],
      ['normal-range', 0, 1, 0.4, false], ['20-casts-per-second', 0.05, 20, 0.016, false],
      ['rapid-overlap', 0.035, 25, 0.4, false], ['reset', 0, 1, 0.016, true],
      ['reset-after-contact', 0, 1, 0.016, false],
    ]) {
      const ctx = new OfflineAudioContext(1, rate * 2, rate), preview = S.preview(ctx, ctx.destination);
      S.setFireFlight(recording); S.setMuted(false);
      const stops = [];
      // Schedule chronologically, including contact/reset, as the real game does.
      const events = [];
      for (let i = 0; i < count; i++) {
        const t = 0.05 + i * interval;
        events.push([t, () => { stops[i] = S.sfx.fireLaunch(); }]);
        events.push([t + life, () => stops[i]?.(immediate)]);
      }
      if (name === 'reset-after-contact') events.push([0.08, () => S.sfx.stopFire()]);
      for (const [t, event] of events.sort((a, b) => a[0] - b[0])) { preview.when(t); event(); }
      const samples = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      const windows = [];
      for (let i = 0; i < count; i++) {
        const start = Math.round((0.05 + i * interval) * rate);
        let energy = 0;
        for (let k = 0; k < rate * 0.03; k++) energy += samples[start + k] ** 2;
        windows.push(Math.sqrt(energy / (rate * 0.03)));
      }
      const end = Math.round((0.05 + (count - 1) * interval + life + 0.06) * rate);
      let tail = 0;
      for (let i = end; i < samples.length; i++) tail = Math.max(tail, Math.abs(samples[i]));
      results.push({ name, peak, first30msRms: windows[0], minimumCastRms: Math.min(...windows), tail });
    }
    return results;
  });
  for (const r of results) {
    assert(r.peak > 0 && r.peak < 1, `${r.name}: silent or clipped`);
    assert(r.first30msRms > 0.004, `${r.name}: late/inaudible onset`);
    assert(r.minimumCastRms > 0.004, `${r.name}: inaudible rapid cast`);
    if (r.name === 'point-blank' || r.name === 'short-range') assert(r.peak > 0.035, `${r.name}: recording cut before ignition`);
    if (r.name.startsWith('reset')) assert(r.tail < 0.00001, 'Reset did not cut flight sound');
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await env.close(); }
