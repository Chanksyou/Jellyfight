// Test-only adapter. Uses the real combat/progression methods; nothing imports this in the shipped game.
import * as THREE from 'three';
import { CONTENT } from '../src/content.js';
import { applyCard } from '../src/stats.js';
import { bus, PLAYER } from '../src/events.js';
import { seededRandom, seedFor } from '../src/story-random.mjs';
import { nav, STAGES } from '../src/stages.js';
import { sfx } from '../src/sfx.js';
import { fresh, setupFight } from '../src/stories/kit.js';
import { choose, movement } from './balance-core.mjs';

const G = () => window;
const patch = (undo, obj, key, fn) => { const old = obj[key]; obj[key] = fn(old.bind(obj)); undo.push(() => { obj[key] = old; }); };

function resetTrial(seed, undo) {
  const { run, player, enemies, input, fx } = G();
  // These clocks/counters survive Run.start(), but affect movement, firing positions or random draw order.
  Object.assign(player, { time: 0, swim: 0, speed: 0, facing: 0, coyote: 0, jumpBuffered: 0, airJumps: 0, held: false, cut: false, climbing: false });
  Object.assign(input, { jumpQueued: false, resetQueued: false, interactQueued: false, mouseDX: 0, mouseDY: 0, wheel: 0 });
  run.bubbles.clock = 0; enemies.frame = 0;
  const cosmetic = seededRandom(seedFor('cosmetics', seed));
  // Blinks, pooled visuals and wall-clock sound throttles must not advance combat randomness.
  for (const obj of [sfx, player.avatar, fx, fx.glow, fx.ice, fx.glitter, fx.acid, fx.wind, fx.deaths, run.bubbles.looks, run.gadgets.looks]) {
    if (!obj) continue;
    const keys = new Set([...Object.keys(obj), ...Object.getOwnPropertyNames(Object.getPrototypeOf(obj))]);
    for (const key of keys) if (key !== 'constructor' && typeof obj[key] === 'function') patch(undo, obj, key, old => (...args) => {
      const was = Math.random; Math.random = cosmetic;
      try { return old(...args); } finally { Math.random = was; }
    });
  }
}

export function observe() {
  const { run, enemies } = G(), undo = [];
  const data = { damage: 0, healthLost: 0, shieldAbsorbed: 0, healed: 0, revivalHealing: 0,
    revivals: 0, deathSaves: 0, hits: 0, lastDamageSource: null, healthBySource: {}, damageBySource: {} };
  let source = 'direct';
  patch(undo, bus, 'emit', old => (type, payload) => {
    const prev = source;
    if (type === 'damage_taken') source = payload.source || 'direct';
    try { return old(type, payload); } finally { source = prev; }
  });
  patch(undo, enemies, 'applyDamage', old => (e, ...args) => {
    const target = e?.proxy || e, before = target?.hp;
    const result = old(e, ...args);
    if (Number.isFinite(before) && Number.isFinite(target.hp)) {
      const dealt = Math.max(0, before - Math.max(0, target.hp));
      data.damage += dealt;
      data.damageBySource[source] = (data.damageBySource[source] || 0) + dealt;
      if (dealt > 0) data.hits++;
    }
    return result;
  });
  patch(undo, run.energyShield, 'absorb', old => (amount, ...args) => {
    const left = old(amount, ...args), blocked = amount - left;
    data.shieldAbsorbed += Math.max(0, blocked);
    // absorb is reached only after dodge/i-frames/polyp checks. Count damage before a revival restores Health.
    const lost = Math.min(Math.max(0, run.health - (run.devGod ? 1 : 0)), Math.max(0, left));
    data.healthLost += lost;
    if (lost > 0) data.lastDamageSource = source;
    data.healthBySource[source] = (data.healthBySource[source] || 0) + lost;
    return left;
  });
  patch(undo, run, 'heal', old => (...args) => {
    const before = run.health, result = old(...args);
    data.healed += Math.max(0, run.health - before);
    return result;
  });
  patch(undo, run, 'hurt', old => (...args) => {
    const reborn = run.rebornThisAct, saved = run.saved, before = run.health, lost = data.healthLost;
    const result = old(...args);
    if (!reborn && run.rebornThisAct) data.revivals++;
    if (!saved && run.saved) data.deathSaves++;
    if ((!reborn && run.rebornThisAct) || (!saved && run.saved)) data.revivalHealing += Math.max(0, run.health - before + data.healthLost - lost);
    return result;
  });
  // Immortal's delayed bloom restores Health directly rather than through heal().
  let polyp = run.polypT > 0, hp = run.health;
  return { data, sample() {
    if (polyp && !(run.polypT > 0)) data.revivalHealing += Math.max(0, run.health - hp);
    polyp = run.polypT > 0; hp = run.health;
  }, stop() { while (undo.length) undo.pop()(); } };
}

export function resolveBuild(tokens) {
  const out = new Map(), visiting = new Set();
  function add(token) {
    const [id, copies = '1', extra] = token.split('@'), count = Number(copies);
    const evolution = id.startsWith('evo:'), key = evolution ? id.slice(4) : id;
    const item = (evolution ? CONTENT.evolutions : CONTENT.treasures).find(t => t.id === key);
    if (!item || extra || !Number.isInteger(count) || count < 1 || count > (evolution ? 1 : item.stack)) throw Error(`Invalid build entry: ${token}`);
    if (visiting.has(id)) throw Error(`Cyclic prerequisite: ${id}`);
    visiting.add(id);
    if (item.needs) add(item.needs);
    visiting.delete(id);
    out.set(id, Math.max(out.get(id) || 0, count));
  }
  tokens.forEach(add);
  return [...out].map(([id, n]) => n === 1 ? id : `${id}@${n}`);
}

export function installBuild(tokens) {
  const { run } = G();
  for (const token of resolveBuild(tokens)) {
    const [id, n = '1'] = token.split('@');
    if (id.startsWith('evo:')) { if (!run.evolved.includes(id.slice(4))) run.evolved.push(id.slice(4)); }
    else while (run.owned.count(id) < +n) run.owned.add(id);
  }
  run.health = run.S.health;
  run.energyShield.update(0);
}

export function comparisons(base, add = [], synergy = []) {
  const extras = synergy.length ? synergy : add;
  const needs = extras.flatMap(token => {
    const id = token.split('@')[0];
    return id.startsWith('evo:') ? [] : [CONTENT.treasures.find(t => t.id === id)?.needs].filter(Boolean);
  });
  const baseline = resolveBuild([...base, ...needs]);
  const arms = synergy.length ? [['base', []], ['A', [synergy[0]]], ['B', [synergy[1]]], ['AB', synergy]]
    : add.length ? [['base', []], ['added', add]] : [['base', []]];
  const resolved = arms.map(([arm, extra]) => ({ arm, build: resolveBuild([...baseline, ...extra]) }));
  if (new Set(resolved.map(a => JSON.stringify([...a.build].sort()))).size !== resolved.length) throw Error('Comparison arms must have different builds; remove overlapping build/prerequisite entries');
  return resolved;
}

export function items() {
  const out = [];
  for (const t of CONTENT.treasures) {
    out.push({ kind: 'treasure', id: t.id, name: t.name, copies: 1, needs: t.needs });
    if (t.stack > 1) out.push({ kind: 'treasure', id: `${t.id}@${t.stack}`, name: `${t.name} ×${t.stack}`, copies: t.stack, needs: t.needs });
  }
  for (const [stat, c] of Object.entries(CONTENT.levelups.cards)) {
    if (c.weight > 0) out.push({ kind: 'card', id: `card:${stat}`, stat, amount: c.amounts[2], name: `Epic ${stat}` });
  }
  for (const e of CONTENT.evolutions) out.push({ kind: 'evolution', id: `evo:${e.id}`, name: e.name });
  return out;
}

let active;
export function dispose() { active?.stop(); active = null; }

function controller(config, meter) {
  const { run, player, enemies, input, tpc } = G();
  const state = { retreat: false, previous: player.position.clone(), moved: 0, rootedSeconds: 0 };
  return { state, tick(frame) {
    const P = player.position, stats = run.S;
    const candidates = enemies.list.filter(e => !e.dead && !e.proxy?.shielded)
      .map(e => { const p = enemies.center(e); return { x: p.x, z: p.z, r: e.r, distance: Math.hypot(P.x - p.x, P.z - p.z) - e.r }; })
      .sort((a, b) => a.distance - b.distance);
    const chests = run.roomTreasures.filter(t => t.active).sort((a, b) => a.pos.distanceToSquared(P) - b.pos.distanceToSquared(P));
    const target = chests[0]?.pos || { x: run.stage.start[0], z: run.stage.start[2] };
    const move = movement(config.style, { x: P.x, z: P.z, nearest: candidates[0], target,
      range: stats.range, reach: stats.reach, retreat: state.retreat,
      shots: enemies.shots.filter(s => !s.done).map(s => ({ x: s.m.position.x, z: s.m.position.z })) });
    state.retreat = move.retreat;
    input.keys = new Set();
    if (move.x || move.z) { tpc.yaw = Math.atan2(-move.x, -move.z); input.keys.add('KeyW'); }
    if (frame % 30 === 0) {
      if (input.keys.size && P.distanceTo(state.previous) < 0.01) input.jumpQueued = true;
      state.previous.copy(P);
    }
    const before = P.clone();
    G().GAME.step(1 / 60);
    meter.sample();
    state.moved += P.distanceTo(before);
    if (run.stillT >= 1) state.rootedSeconds += 1 / 60;
  } };
}

export function encounter({ seed, style, build, item, type = 'roach', mode = 'clump', probe = false }) {
  dispose();
  const random = Math.random;
  Math.random = seededRandom(seed);
  let meter; const undo = [];
  try {
    setupFight({ hurt: true, levels: false });
    const { run, player, enemies } = G();
    resetTrial(seed, undo);
    run.devRun();
    installBuild(build);
    if (item?.kind === 'card') { applyCard(run.stats, { stat: item.stat, amount: item.amount }); run.health = run.S.health; }
    const count = mode === 'big' ? 1 : 10;
    const targets = Array.from({ length: count }, (_, k) => {
      const angle = k * 2.4, d = k === 0 ? 0 : 0.012 + (k % 3) * 0.011;
      const e = enemies.spawn(type, player.position.clone().add(new THREE.Vector3(Math.cos(angle) * d, 0,
        (mode === 'range' ? -0.18 : -0.3) + Math.sin(angle) * d)), mode === 'big' ? 10 : 1);
      e.spawnT = 1; e.hold = mode === 'range';
      if (probe) e.hp = e.maxHp = 1e7;
      return e;
    });
    meter = observe(); const bot = controller({ style }, meter), limit = (probe ? 10 : 30) * 60;
    let frames = 0;
    for (; frames < limit && run.phase !== 'dead' && targets.some(e => !e.dead); frames++) bot.tick(frames);
    const elapsed = frames / 60;
    return { outcome: run.phase === 'dead' ? 'died' : targets.every(e => e.dead) ? 'cleared' : 'timeout',
      killedBy: run.phase === 'dead' ? meter.data.lastDamageSource : null,
      elapsed, dps: elapsed ? meter.data.damage / elapsed : 0, ...meter.data, ...bot.state, previous: undefined };
  } finally { meter?.stop(); while (undo.length) undo.pop()(); Math.random = random; G().input.keys = new Set(); }
}

export function startAct(config) {
  dispose();
  const { run, player, APT, menus } = G(), undo = [], random = Math.random;
  APT.renderer.setAnimationLoop(null);
  Math.random = seededRandom(seedFor(`balance/act${run.stage.id}`, config.seed));
  fresh({ waves: true, treasures: true, hurt: true, levels: true });
  resetTrial(config.seed, undo);
  run.devRun();
  if (config.initial) installBuild(config.build);
  run.startPicked = !!run.carry || [...run.mods.elements].length > 0;
  const meter = observe(), bot = controller(config, meter), choiceRandom = seededRandom(seedFor(`choices/act${run.stage.id}`, config.seed));
  const state = { elapsed: 0, frames: 0, choices: [], pending: null, transition: null, scheduled: [] };
  patch(undo, run.ui, 'choose', () => (title, sub, choices, pick) => {
    menus.close(); state.pending = { title, choices, pick }; menus.modal.hidden = false;
  });
  patch(undo, run.ui, 'levelUp', () => (level, choices, stats, rerolls, pick) => {
    menus.close(); state.pending = { title: `Level ${level}`, choices, pick }; menus.modal.hidden = false;
  });
  patch(undo, run.evolutionReveal, 'begin', () => (evo, before, done) => done());
  // Replace wall-clock delays only in this test adapter. Progression still uses the real callbacks.
  patch(undo, run, 'later', () => (fn, ms) => state.scheduled.push({ at: state.elapsed + ms / 1000, fn, runId: run.runId }));
  patch(undo, nav, 'reload', () => () => { state.transition = JSON.parse(sessionStorage.getItem('jellyrun.act')); });
  const stop = () => { meter.stop(); while (undo.length) undo.pop()(); Math.random = random; G().input.keys = new Set(); };
  active = { stop, state };
  const snapshot = outcome => ({ outcome, act: run.stage.id, elapsed: state.elapsed, time: run.t, level: run.level, xp: run.xp,
    kills: run.kills, health: run.health, maxHealth: run.S.health, owned: [...run.owned].map(id => [id, run.owned.count(id)]),
    evolved: [...run.evolved], bossBeaten: run.bossWon, killedBy: run.phase === 'dead' ? meter.data.lastDamageSource : null, choices: state.choices, ...meter.data,
    moved: bot.state.moved, rootedSeconds: bot.state.rootedSeconds, transition: state.transition });
  active.chunk = (frames = 600) => {
    for (let i = 0; i < frames; i++) {
      if (state.transition) return snapshot('next-act');
      if (run.phase === 'dead') return snapshot('died');
      if (run.bossWon && config.actOnly) return snapshot('beat-boss');
      if (run.phase === 'won' && !STAGES[run.stage.id]) return snapshot('won');
      if (state.elapsed >= config.seconds) return snapshot('timeout');
      if (state.pending) {
        const { title, choices, pick } = state.pending;
        const chosen = choices[choose(choices, config.style, config.prefer, choiceRandom)];
        state.pending = null; menus.close();
        state.choices.push({ title, offered: choices.map(c => c.id || c.stat), picked: chosen.id || chosen.stat });
        pick(chosen);
      } else if (menus.open) {
        // Act-complete button runs goToAct with the game's actual carryOver().
        menus.modal.querySelector('button.go, button')?.click();
      }
      document.getElementById('g-over').hidden = true;
      const due = state.scheduled.filter(s => s.at <= state.elapsed);
      state.scheduled = state.scheduled.filter(s => s.at > state.elapsed);
      for (const s of due) if (s.runId === run.runId) s.fn();
      bot.tick(state.frames++); state.elapsed = state.frames / 60;
    }
    return snapshot('running');
  };
  return { act: run.stage.id, build: resolveBuild(config.build), startHealth: run.health, startLevel: run.level };
}

export const chunk = frames => { if (!active?.chunk) throw Error('No active bot'); return active.chunk(frames); };
