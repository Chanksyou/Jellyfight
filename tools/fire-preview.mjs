// Capture the actual fire sample, compare the previous fire code, and render its exact sounds.
// node tools/fire-preview.mjs <output-directory> [baseline-commit]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { start, THREE_DIR } from '../tests/lib.mjs';

const out = path.resolve(process.argv[2] || '.wrangler/fire-preview');
const baseline = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const env = await start();
try {
  const report = {};
  for (const version of baseline ? ['before', 'after'] : ['after']) {
    const page = await env.browser.newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (THREE_DIR) await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.186\.1\/(.*)$/, r => r.fulfill({ path: path.join(THREE_DIR, r.request().url().match(/three@0\.186\.1\/(.*)$/)[1]), contentType: 'text/javascript' }));
    if (version === 'before') {
      for (const file of ['bubbles.js', 'bubble-looks.js', 'sfx.js']) {
        const body = execFileSync('git', ['show', `${baseline}:src/${file}`], { encoding: 'utf8' });
        await page.route(`**/src/${file}`, route => route.fulfill({ body, contentType: 'text/javascript' }));
      }
    }
    await page.goto(env.url.replace('index.html', 'fire-sample.html'));
    await page.waitForFunction(() => window.fireSample, null, { timeout: 60000 });
    await page.locator('[data-mode="volley"]').click();
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(out, `fire-${version}.png`), fullPage: true });
    await page.waitForTimeout(1400);
    await page.locator('#sound').click();
    const take = await page.evaluate(async () => {
      const S = await import('/src/sfx.js');
      const destination = S.audio().ctx.createMediaStreamDestination();
      S.audio().master.connect(destination);
      const stream = window.fireSample.renderer.domElement.captureStream(30);
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 3000000 });
      const chunks = [], times = [];
      let previous = performance.now(), recording = true, maxParticles = 0, maxCalls = 0;
      const collect = now => {
        times.push(now - previous); previous = now;
        const s = window.fireSample.state;
        maxParticles = Math.max(maxParticles, s.particles); maxCalls = Math.max(maxCalls, s.drawCalls);
        if (recording) requestAnimationFrame(collect);
      };
      requestAnimationFrame(collect);
      recorder.ondataavailable = e => chunks.push(e.data);
      const complete = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let k = 1; k <= 3; k++) setTimeout(() => window.fireSample.cast(), k * 2000);
      await new Promise(resolve => setTimeout(resolve, 8000));
      recording = false; recorder.stop(); await complete;
      S.audio().master.disconnect(destination);
      for (const track of stream.getTracks()) track.stop();
      const bytes = new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      times.sort((a, b) => a - b);
      return { video: btoa(binary), p95: times[Math.floor(times.length * 0.95)], maxParticles, maxCalls, samples: times.length, muted: window.fireSample.state.audioMuted };
    });
    fs.writeFileSync(path.join(out, `fire-${version}.webm`), Buffer.from(take.video, 'base64'));
    const { video, ...metrics } = take;
    report[version] = { ...metrics, errors };
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  const page = await env.browser.newPage();
  // Only the audio module is needed for the offline export.
  await page.route('**/src/fire-sample.js', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto(env.url.replace('index.html', 'fire-sample.html'));
  const audio = await page.evaluate(async () => {
    const S = await import('/src/sfx.js'), rate = 32000, seconds = 5;
    const ctx = new OfflineAudioContext(1, rate * seconds, rate);
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    const preview = S.preview(ctx, comp);
    const recording = await fetch('/assets/audio/fireball-flight.mp3');
    if (!recording.ok) throw new Error('Fire flight asset unavailable');
    S.setFireFlight(await ctx.decodeAudioData(await recording.arrayBuffer()));
    const at = (t, fn) => { preview.when(t); fn(); };
    at(0.3, () => S.sfx.fireLaunch()); at(0.8, () => { S.sfx.hit(); S.sfx.fire(); });
    at(2.7, () => S.sfx.fireLaunch(1.22)); at(3.2, () => { S.sfx.hit(); S.sfx.fire(1.22); });
    const rendered = await ctx.startRendering(), samples = rendered.getChannelData(0);
    const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
    const text = (at, str) => [...str].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    let peak = 0, binary = '';
    samples.forEach((sample, i) => { peak = Math.max(peak, Math.abs(sample)); view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true); });
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { wav: btoa(binary), peak };
  });
  fs.writeFileSync(path.join(out, 'fire-sound.wav'), Buffer.from(audio.wav, 'base64'));
  report.audioPeak = audio.peak;
  if (!(audio.peak > 0 && audio.peak < 1)) throw new Error(`Audio is silent or clips: ${audio.peak}`);
  fs.writeFileSync(path.join(out, 'fire-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await env.close(); }
