// A player's first run introduces the game's systems one at a time instead of all at once
// (spec: GitHub issue #1). The run asks a FirstRun a few yes/no questions at the moments that
// change; nothing else knows the first-run rules. Every other run behaves as before.
//
//   - the Element pick waits until right after the first Level-up's card (not the first frame)
//   - the first hit shows one plain line about the Health bar, once
//   - no Treasure turns up in the room before the Element pick is done (scheduled times before it
//     are skipped; an Elite's Treasure still drops)
//   - the minimap stays hidden until the first Treasure appears in the room, then stays
//
// Who's new: no finished run on record and no saved best score (a run that posted a score). The
// record is written when a run ends (dried out, or the act's boss beaten), not when it starts, so
// reloading mid-run keeps a new player new. The leaderboard's player id can't tell: it's made on
// the first load. Act 2 and later are never a first run: getting there means a run was played.
// The dev modes (1 on 1, fight the boss) never are either, and never count as a played run.
import { BEST_KEY } from './leaderboard.js';

export const PLAYED_KEY = 'jellyfight.played';

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
  }

  // a Treasure just appeared in the room (scheduled, or left by an Elite): the minimap comes with it
  treasureAppeared() { this.mapShown = true; }

  // Run.start: a player's first run is act 1, for a new player
  static forStage(stage) { return new FirstRun(stage.id === 1 && isNewPlayer()); }

  // the starting Element pick opens on the first frame?
  get startElementPick() { return !this.active; }

  // the jelly was just hurt: the hint to show (once, on the first hit), or null
  hintOnHit() {
    if (this.hitHintShown) return null;
    this.hitHintShown = true;
    return "That's your Health, top left. Run out and the run ends.";
  }

  // a scheduled Treasure's time has come: place it, or (before the Element pick) skip it?
  get treasuresDue() { return !this.active || this.elementChosen; }

  // a Level-up's card was just picked: open the Element pick now? (once, after the first card)
  elementPickAfterCard() {
    if (this.elementPicked) return false;
    this.elementPicked = true;
    return true;
  }
}
