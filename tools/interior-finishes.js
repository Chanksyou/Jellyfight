// Offline paint for the apartment's existing texture slots. Keep the UV layouts and dimensions.
export function paintInteriorFinish(canvas, finish) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const tau = Math.PI * 2;
  let seed = 934;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const sin = Math.sin;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, u = x / width, v = y / height;
    const fiber = random() - 0.5;
    const wash = sin(tau * u) * sin(tau * v) + 0.55 * sin(tau * (2 * u + 3 * v));
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    let texture = 0, mix = 0, base = [0, 0, 0];
    switch (finish) {
      case 'floor': {
        // Keep the staggered joints and board colors. Break the streaks with wandering grain.
        const row = Math.floor(v * 11), drift = 0.45 * sin(tau * (u + row * 0.37));
        texture = 2.1 * sin(tau * (v * 139 + drift)) + 1.8 * sin(tau * (v * 46 + drift * 2))
          + 2.2 * sin(tau * (u + row * 0.23)) + 3.8 * fiber;
        mix = 0.18; base = [171, 157, 138];
        break;
      }
      case 'veneer': {
        const drift = 1.6 * sin(tau * u) * sin(tau * v) + 0.8 * sin(tau * (2 * u + v));
        texture = 3.2 * sin(tau * (v * 44 + drift)) + 1.8 * sin(tau * (v * 87 + drift))
          + 3.0 * sin(tau * (v * 5 + drift * 0.22)) + 3 * fiber;
        mix = 0.54; base = [luma + 16, luma + 2, luma - 13];
        break;
      }
      case 'cord': {
        texture = 2.1 * wash + 1.2 * sin(tau * (v * 11 + u * 3 + 0.15 * sin(tau * u))) + 2.8 * fiber;
        mix = 0.34; base = [151, 74, 43];
        break;
      }
      case 'knit': {
        const ombre = 29 * sin(tau * (u - 0.16)) + 12 * sin(tau * (2 * u + v));
        texture = ombre + 6.5 * wash + 3 * fiber;
        mix = 0.84; base = [196, 185, 170];
        break;
      }
      case 'backsplash':
        // Pull back the bright grid and give the dark clay a quiet glazed finish.
        texture = 3.5 * wash + 2.9 * fiber;
        mix = 0.40; base = [51, 52, 51];
        break;
      case 'slate':
        texture = 4.5 * wash + 4.8 * fiber + 2.5 * sin(tau * (9 * u + v));
        mix = 0.12; base = [55, 55, 53];
        break;
      case 'glaze':
        texture = 2.5 * wash + 2.6 * fiber;
        mix = 0.08; base = [224, 222, 215];
        break;
      case 'counter':
        texture = 3.2 * wash + 4 * fiber;
        mix = 0.09; base = [54, 52, 49];
        break;
      case 'enamel':
        texture = 1.6 * wash + 1.9 * fiber;
        mix = 0.05; base = [235, 232, 224];
        break;
      default:
        throw new Error(`Unknown interior finish: ${finish}`);
    }
    for (let k = 0; k < 3; k++) data[i + k] = data[i + k] * (1 - mix) + base[k] * mix + texture;
  }
  ctx.putImageData(image, 0, 0);

  if (finish !== 'floor' && finish !== 'knit') return;
  ctx.save();
  ctx.scale(width / 128, height / 128);
  if (finish === 'floor') {
    // A few small knots in the existing plank rows; leave most boards clean.
    for (const [x, y] of [[19, 18], [88, 30], [37, 53], [103, 76], [62, 101], [21, 111]]) {
      ctx.strokeStyle = 'rgba(90, 64, 46, 0.22)';
      ctx.lineWidth = 0.19;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(x, y, ring * 1.05, ring * 0.28, -0.1, 0, tau);
        ctx.stroke();
      }
    }
  } else {
    ctx.lineWidth = 0.62;
    for (let y = -2; y < 128; y += 4) for (let x = -2; x < 128; x += 4) {
      const yy = y + random() * 0.55;
      ctx.strokeStyle = 'rgba(70,57,48,0.19)';
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 2.3, yy + 6.3, x + 4, yy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,252,240,0.26)';
      ctx.beginPath(); ctx.moveTo(x, yy - 0.55); ctx.quadraticCurveTo(x + 2.3, yy + 4.8, x + 4, yy - 0.55); ctx.stroke();
    }
  }
  ctx.restore();
}
