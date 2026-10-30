// Focused integration proof for the tools, not a statistical balance study.
import assert from 'node:assert/strict';
import { start, openGame } from './lib.mjs';

const env = await start(); let page;
try {
  const opened = await openGame(env, { viewport: { width: 800, height: 500 }, seed: 17 }); page = opened.page;
  let errors = opened.errors;
  await page.evaluate(() => APT.renderer.setAnimationLoop(null));
  const result = await page.evaluate(async () => {
    const B = await import('/tests/balance-browser.mjs'), K = await import('/src/stories/kit.js');
    const { bus, PLAYER } = await import('/src/events.js'), { CONTENT } = await import('/src/content.js');
    K.setupFight({ hurt: true, bubbles: false, lash: false }); run.devRun();
    B.installBuild(['evo:aegis']); const m = B.observe();
    bus.emit('damage_taken', { targetId: PLAYER, amount: 13, drain: true, source: 'probe' });
    const afterShield = run.health; run.heal(100);
    const e = K.roachAt(0, -0.15, { still: true, hp: 20 }); e.armor = 0.5;
    bus.emit('status_applied', { targetId: e.id, status: 'mark', duration: 2, more: 0.3 });
    bus.emit('damage_taken', { targetId: e.id, amount: 10, source: 'probe' });
    const first = m.data.damage;
    bus.emit('damage_taken', { targetId: e.id, amount: 100, source: 'probe' });
    const measured = structuredClone(m.data); m.stop();
    K.setupFight({ hurt: true, bubbles: false, lash: false }); run.devRun();
    B.installBuild(['evo:immortal']); const h = run.health, immortal = B.observe();
    run.hurt(10000, true);
    for (let i = 0; i < 305; i++) { GAME.step(1 / 60); immortal.sample(); }
    const revive = { ...immortal.data, health: run.health, max: run.S.health, initial: h }; immortal.stop();
    const card = B.items().find(i => i.id === 'card:regen');
    const args = { seed: 17, style: 'ranged', build: ['candle'], type: 'roach', mode: 'clump', probe: true };
    const replay = [B.encounter(args), B.encounter(args)];
    const config = { seed: 17, style: 'rooting', build: ['candle', 'evo:upsideDown'], initial: true, prefer: [], seconds: 3, actOnly: false };
    const campaigns = [];
    for (let i = 0; i < 2; i++) { B.startAct(config); campaigns.push(B.chunk(180)); B.dispose(); }
    const baselines = B.comparisons([], ['lighterFluid']);
    const rooted = B.encounter({ ...args, style: 'rooting', mode: 'range', build: ['candle', 'evo:upsideDown'] });
    let invalid = false; try { B.resolveBuild(['not-a-treasure']); } catch { invalid = true; }
    return { measured, afterShield, first, revive, card, regen: CONTENT.levelups.cards.regen.amounts[2], replay, campaigns, baselines, rooted, invalid };
  });
  assert.equal(result.measured.shieldAbsorbed, 10); assert.equal(result.measured.healthLost, 3);
  assert.equal(result.measured.healthBySource.probe, 3); assert.equal(result.measured.healed, 3);
  assert.equal(result.first, 6.5); assert.equal(result.measured.damage, 20);
  assert.equal(result.revive.revivals, 1); assert.equal(result.revive.healthLost, result.revive.initial);
  assert.equal(result.revive.health, result.revive.max);
  assert.equal(result.revive.revivalHealing, result.revive.max);
  assert.equal(result.card.amount, result.regen);
  assert.deepEqual(result.replay[0], result.replay[1]);
  assert.deepEqual(result.campaigns[0], result.campaigns[1]);
  assert.ok(result.rooted.rootedSeconds > 0);
  assert.deepEqual(result.baselines[0].build, ['candle']); assert.ok(result.invalid);
  console.log('PASS: shield/Health/healing, armor/vulnerability/overkill, mortal revival, live card values, prerequisite control, deterministic encounter/campaign replay, rooting');
  if (opened.errors.length) throw Error(opened.errors.join('\n'));
  let carry = null;
  for (let act = 1; act <= 4; act++) {
    if (act > 1) {
      await page.close();
      const next = await openGame(env, { viewport: { width: 800, height: 500 }, seed: 17, act: { act, carry } });
      page = next.page; errors = next.errors;
    }
    const progress = await page.evaluate(async ({ act, carry }) => {
      const B = await import('/tests/balance-browser.mjs');
      const start = B.startAct({ seed: 17, style: 'rooting', build: ['candle'], initial: act === 1, prefer: [], seconds: 30, actOnly: false });
      const received = { level: run.level, evolved: [...run.evolved], owned: [...run.owned] };
      // Force a victory only in this integration test; the production bot never kills a boss for itself.
      run.startBossIntro(); run.updateBossIntro(1.5); run.boss.dead = true; run.onBossDead({ impact: false });
      let end;
      do { end = B.chunk(600); } while (end.outcome === 'running');
      B.dispose();
      return { start, received, end };
    }, { act, carry });
    assert.equal(progress.start.act, act);
    if (carry) {
      assert.equal(progress.received.level, carry.level);
      assert.deepEqual(progress.received.evolved, carry.evolved);
      assert.deepEqual(progress.received.owned, carry.owned.map(([id]) => id));
    }
    assert.equal(progress.end.outcome, act === 4 ? 'won' : 'next-act');
    if (errors.length) throw Error(errors.join('\n'));
    assert.ok(progress.end.bossBeaten);
    if (act < 4) {
      carry = progress.end.transition.carry;
      assert.equal(progress.end.transition.act, act + 1);
      assert.equal(carry.evolved.length, act);
      assert.ok(carry.owned.some(([id]) => id === 'candle'));
    }
    console.log(`PASS: act ${act} victory/reward/carry progression${act === 4 ? '/ending' : ''}`);
  }
} finally { await page?.close(); await env.close(); }
