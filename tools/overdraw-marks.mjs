// Which see-through marks stack the most layers at a moment (src/bench-moments.js), one mark at a time: the
// phone page, Medium, four views, each transparent piece outside the apartment drawn alone (src/overdraw.js).
// The listing the G2 trims of phone performance round 2 were picked from.
//
//   node tools/overdraw-marks.mjs act2 "Clog acid" [--top=15]
import { start, openGame } from '../tests/lib.mjs';
import { PAGES } from '../src/bench-moments.js';

const [pageKey, moment] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const top = +(process.argv.find((a) => a.startsWith('--top='))?.slice(6) || 15);
const env = await start();
try {
  const { page } = await openGame(env, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ...PAGES[pageKey], seed: 1 });
  await page.evaluate(async () => { window.K = await import('/src/stories/kit.js'); window.NAV = (await import('/src/stages.js')).nav; window.BM = await import('/src/bench-moments.js'); });
  const rows = await page.evaluate(async ([p, n]) => {
    const THREE = (await import('three')).default || await import('three');
    const { measureOverdraw } = await import('/src/overdraw.js');
    window.BM.MOMENTS[p][n]({ K, G: window, nav: NAV }); K.step(30); GAME.render();
    const R = APT.renderer, yaw0 = tpc.yaw, meshes = [];
    APT.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      for (let a = o; a; a = a.parent) if (a === APT.root) return;
      const ms = [].concat(o.material);
      if (ms.some((m) => m.transparent)) meshes.push(o);
    });
    const label = (o) => { const names = []; for (let a = o; a && names.length < 3; a = a.parent) if (a.name) names.push(a.name); const m = [].concat(o.material)[0], g = o.geometry, bb = g?.boundingBox || (g?.computeBoundingBox(), g?.boundingBox), sz = bb ? bb.getSize(new bb.min.constructor()) : null; const c = m.color ? '#' + m.color.getHexString() : ''; return `${names.join(' < ') || o.type} ${m.name || ''} ${c} v${g?.attributes?.position?.count} ${sz ? [sz.x, sz.y, sz.z].map((x) => x.toFixed(2)).join('x') : ''} y${o.getWorldPosition(new bb.min.constructor()).y.toFixed(2)} [${m.type} op ${m.opacity} ${m.side === 2 ? 'double' : 'front'}${o.isInstancedMesh ? ' x' + o.count : ''}]`; };
    const sums = meshes.map(() => 0);
    let total = 0;
    for (let i = 0; i < 4; i++) {
      tpc.yaw = yaw0 + i * Math.PI / 2; K.step(6); GAME.render();
      total += measureOverdraw(R, APT.scene, APT.camera, { seeThrough: true, room: APT.root }).avg;
      for (let k = 0; k < meshes.length; k++) {
        const keep = meshes.map((m) => m.visible);
        meshes.forEach((m, j) => { m.visible = j === k; });
        sums[k] += measureOverdraw(R, APT.scene, APT.camera, { seeThrough: true, room: APT.root }).avg;
        meshes.forEach((m, j) => { m.visible = keep[j]; });
      }
    }
    tpc.yaw = yaw0;
    return { total: total / 4, rows: meshes.map((m, k) => [label(m), +(sums[k] / 4).toFixed(3)]) };
  }, [pageKey, moment]);
  console.log(`${pageKey} | ${moment}: see-through ${rows.total.toFixed(2)} layers on average, by mark (alone):`);
  for (const [l, v] of rows.rows.sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${v.toFixed(3)}  ${l}`);
} finally { await env.close(); }
