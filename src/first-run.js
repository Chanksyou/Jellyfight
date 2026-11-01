// A player's first run introduces the game's systems one at a time instead of all at once
// (spec: GitHub issue #1). The run asks a FirstRun a few yes/no questions at the moments that
// change; nothing else knows the first-run rules. Every other run behaves as before.
//
//   - the Element pick waits until right after the first Level-up's card (not the first frame);
//     XP counts double until then, so that first Level-up comes about twice as soon
//   - the run opens with one tip about how it's played: attacks are automatic, XP, the boss
//   - the first hit shows one plain line about the Health bar, once
//   - the Element pick closes with one tip: hold jump to jump higher
//   - no Treasure turns up in the room before the Element pick is done (scheduled times before it
//     are skipped; an Elite's Treasure still drops); a skipped one turns up a few seconds after the
//     pick instead of waiting for the next scheduled time
//   - the minimap stays hidden until the first Treasure appears in the room, then stays
//
// Who's new: no finished run on record and no saved best score (a run that posted a score). The
// record is written when a run ends (dried out, or the act's boss beaten), not when it starts, so
// reloading mid-run keeps a new player new. The leaderboard's player id can't tell: it's made on
// the first load. Act 2 and later are never a first run: getting there means a run was played.
// The dev modes (1 on 1, fight the boss) never are either, and never count as a played run.
import { BEST_KEY } from './leaderboard.js';

export const PLAYED_KEY = 'jellyrun.played';
const TREASURE_AFTER_PICK = 4;   // seconds from the Element pick to a skipped Treasure

// Hints on the death screen of acts 1 and 2 (run.js endRun): one, picked at random, per death
export const DEATH_HINTS = [
  'You attack on your own. Keep swimming and let bugs come into range instead of standing still.',
  'Grab XP droplets as you go. An early Level makes the rest of the act easier.',
  'Your first Element is your second attack for the whole run. Pick treasures that fit it.',
  'Every 3rd treasure pick offers an Element upgrade. It is usually worth taking.',
  'Every beaten Elite drops a treasure, and those are rarer than the ones in the room.',
  'You get one reroll per act. Save it for a Level-up where no card helps.',
  'Watch the Warnings. Step out of the shape before it fills, or jump over a low Blast.',
  'Shield refills after 5 s without damage, Health does not. Back off for a moment instead of trading hits.',
  'Each Dodge card gives less the more Dodge you have, up to 60%. After a few, take Health or Shield.',
  'Mosquito bites Bleed 1 Health a second for 3 s, and each bite stacks. Kill them first.',
];
export const deathHint = () => DEATH_HINTS[Math.floor(Math.random() * DEATH_HINTS.length)];

export function isNewPlayer() {
  try { return !localStorage.getItem(PLAYED_KEY) && !localStorage.getItem(BEST_KEY); } catch { return false; }
}

export function markPlayed() {
  try { localStorage.setItem(PLAYED_KEY, '1'); } catch {}
}

export class FirstRun {
  constructor(active) {
    this.active = !!active;
    this.elementPicked = !this.active;   // a normal run's Element pick is the start pick, as before
    this.hitHintShown = !this.active;
    this.elementChosen = false;          // the run sets it when the start Element pick is made
    this.mapShown = !this.active;
    this.skipped = false;                // a scheduled Treasure was skipped before the Element pick
  }

  // how much each XP drop counts: double on a first run until its Element pick
  get xpMul() { return this.elementPicked ? 1 : 2; }

  // a Treasure just appeared in the room (scheduled, or left by an Elite): the minimap comes with it
  treasureAppeared() { this.mapShown = true; }

  // Run.start: a player's first run is act 1, for a new player
  static forStage(stage) { return new FirstRun(stage.id === 1 && isNewPlayer()); }

  // the starting Element pick opens on the first frame?
  get startElementPick() { return !this.active; }

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

  // a scheduled Treasure's time has come: place it, or (before the Element pick) skip it?
  get treasuresDue() {
    if (!this.active || this.elementChosen) return true;
    this.skipped = true;
    return false;
  }

  // the start Element was just picked at time t: the hint to show, and when a skipped Treasure comes (or null)
  elementChose(t) {
    this.elementChosen = true;
    if (!this.active) return { hint: null, treasureAt: null };
    return { hint: 'Hold jump to jump higher.', treasureAt: this.skipped ? t + TREASURE_AFTER_PICK : null };
  }

  // a Level-up's card was just picked: open the Element pick now? (once, after the first card)
  elementPickAfterCard() {
    if (this.elementPicked) return false;
    this.elementPicked = true;
    return true;
  }
}
