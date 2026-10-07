// A player's first run introduces the game's systems one at a time instead of all at once
// (spec: GitHub issue #1). The run asks a FirstRun a few yes/no questions at the moments that
// change; nothing else knows the first-run rules. Every other run behaves as before.
//
//   - the Element pick waits until right after the first Level-up's card (not the first frame)
//
// Who's new: no finished run on record and no saved best score (a run that posted a score). The
// record is written when a run ends (dried out, or the act's boss beaten), not when it starts, so
// reloading mid-run keeps a new player new. The leaderboard's player id can't tell: it's made on
// the first load. Act 2 and later are never a first run: getting there means a run was played.

const PLAYED = 'jellyfight.played';
const BEST = 'jellyfight.best';   // leaderboard.js: written when a finished run posts its score

export function isNewPlayer() {
  try { return !localStorage.getItem(PLAYED) && !localStorage.getItem(BEST); } catch { return false; }
}

export function markPlayed() {
  try { localStorage.setItem(PLAYED, '1'); } catch {}
}

export class FirstRun {
  constructor(on) {
    this.on = !!on;
    this.elementPicked = !this.on;   // a normal run's Element pick is the start pick, as before
  }

  // Run.start: a player's first run is act 1, for a new player
  static forStage(stage) { return new FirstRun(stage.id === 1 && isNewPlayer()); }

  // the starting Element pick opens on the first frame?
  get startElementPick() { return !this.on; }

  // a Level-up's card was just picked: open the Element pick now? (once, after the first card)
  elementPickAfterCard() {
    if (this.elementPicked) return false;
    this.elementPicked = true;
    return true;
  }
}
