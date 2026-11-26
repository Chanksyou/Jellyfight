// A player's first run introduces the game's systems one at a time instead of all at once
// (spec: GitHub issue #1). The run asks a FirstRun a few yes/no questions at the moments that
// change; nothing else knows the first-run rules. Every other run behaves as before.
//
//   - the run opens with one tip about how it's played: attacks are automatic, XP, the boss
//   - the first hit shows one plain line about the Health bar, once
//   - a few seconds in, one tip: hold jump to jump higher
//   - the first reward spin says how to stop the reels, once
//   - the minimap stays hidden until the first Treasure appears in the room, then stays
//   - a first run is always the Normal jelly: the type pick screen is skipped (picksType)
//
// Who's new: no finished run on record and no saved best score (a run that posted a score). The
// record is written when a run ends (dried out, or the act's boss beaten), not when it starts, so
// reloading mid-run keeps a new player new. The leaderboard's player id can't tell: it's made on
// the first load. Act 2 and later are never a first run: getting there means a run was played.
// The dev modes (1 on 1, fight the boss) never are either, and never count as a played run.
import { BEST_KEY } from './leaderboard.js';

export const PLAYED_KEY = 'jellyrun.played';
const JUMP_TIP_AT = 12;         // seconds into a first run

// Hints on the death screen of acts 1 and 2 (run.js endRun): one, picked at random, per death
// (with jelly types on, TYPE_HINTS join them)
export const TYPE_HINTS = [
  'Each jelly type has its own attack. Pick treasures that fit the way yours hits.',
  'Finish acts and defeat Elites to unlock new jelly types. Each one plays differently.',
];
export const DEATH_HINTS = [
  'You attack on your own. Keep swimming and let bugs come into range instead of standing still.',
  'Grab XP droplets as you go. An early Level makes the rest of the act easier.',
  'Every beaten Elite drops a treasure, and those are rarer than the ones in the room.',
  'You get one reroll per act. Save it for a Level-up where no card helps.',
  'Watch the Warnings. Step out of the shape before it fills, or jump over a low Blast.',
  'Shield refills after 5 s without damage, Health does not. Back off for a moment instead of trading hits.',
  'Each Dodge card gives less the more Dodge you have, up to 60%. After a few, take Health or Shield.',
  'Mosquito bites Bleed 1 Health a second for 2 s, and each bite stacks. Kill them first.',
];
export const deathHint = (types = false) => {
  const list = types ? [...DEATH_HINTS, ...TYPE_HINTS] : DEATH_HINTS;
  return list[Math.floor(Math.random() * list.length)];
};

export function isNewPlayer() {
  try { return !localStorage.getItem(PLAYED_KEY) && !localStorage.getItem(BEST_KEY); } catch { return false; }
}

// A first-time player never sees the jelly type pick screen (pick-screen.js): their run is Normal
export const picksType = () => !isNewPlayer();

export function markPlayed() {
  try { localStorage.setItem(PLAYED_KEY, '1'); } catch {}
}

export class FirstRun {
  constructor(active) {
    this.active = !!active;
    this.hitHintShown = !this.active;
    this.mapShown = !this.active;
    this.jumpTipShown = false;
    this.spinHintShown = !this.active;
  }

  // the first reward spin: the line on how to stop it, once, or null
  spinHint() {
    if (this.spinHintShown) return null;
    this.spinHintShown = true;
    return 'Tap to stop the reels.';
  }

  // a Treasure just appeared in the room (scheduled, or left by an Elite): the minimap comes with it
  treasureAppeared() { this.mapShown = true; }

  // Run.start: a player's first run is act 1, for a new player
  static forStage(stage) { return new FirstRun(stage.id === 1 && isNewPlayer()); }

  // the run just began: the tip to show (a first run's opening line), or null
  get startHint() {
    return this.active ? 'Attack automatically when bugs are nearby. Collect XP to grow stronger and survive until the boss arrives.' : null;
  }

  // the jelly was just hurt: the hint to show (once, on the first hit), or null
  hintOnHit() {
    if (this.hitHintShown) return null;
    this.hitHintShown = true;
    return "That's your Health, top left. Run out and the run ends.";
  }

  // the run is at time t: the jump tip, once, a few seconds after the opening tip is gone (and not over another line)
  jumpTip(t) {
    if (!this.active || this.jumpTipShown || t < JUMP_TIP_AT) return null;
    this.jumpTipShown = true;
    return 'Hold jump to jump higher.';
  }
}

// The Encore's first-time lines (encore.js), once each for good, whatever the run: the first bow, and the
// first duet record standing before its wall, the first DJ landing on the floor. `take(id)` gives the line the first time, then null.
export const ENCORE_HINTS_KEY = 'jellyrun.encoreHints';
export const ENCORE_HINTS = {
  bow: 'A DJ bowing leaves the Encore EXPOSED: hits do full damage again.',
  cover: 'Get behind a record: its white strip is safe from the wall.',
  floor: "A DJ on the floor is the one to hit. The booth can't be hurt until he is back.",
};
export class EncoreHints {
  constructor() {
    try { this.seen = new Set((localStorage.getItem(ENCORE_HINTS_KEY) || '').split(',')); } catch { this.seen = new Set(); }
  }
  take(id) {
    if (this.seen.has(id)) return null;
    this.seen.add(id);
    try { localStorage.setItem(ENCORE_HINTS_KEY, [...this.seen].join(',')); } catch {}
    return ENCORE_HINTS[id];
  }
}
