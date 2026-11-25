// Easy mode: a choice in Settings, kept in this browser. A run reads it as it begins and keeps it
// through its acts (run.easy, carried with the run). The jelly deals `dealt` times the damage,
// takes `taken` times, and earns `pearls` times the Pearls; an Easy score is never posted.
export const EASY_KEY = 'jellyrun.easy';
export const EASY = { dealt: 2, taken: 0.5, pearls: 0.5 };
export const easyChosen = () => { try { return localStorage.getItem(EASY_KEY) === 'on'; } catch { return false; } };
export const chooseEasy = (on) => { try { localStorage.setItem(EASY_KEY, on ? 'on' : 'off'); } catch {} };

// The death screen's offer: a player who has died twice in act 1 and never cleared it (the act's boss
// is not in the Treasure book) is shown "Try Easy mode". Deaths are counted in this browser, like the
// first-run flag; a dev run counts nothing and is never offered it.
export const DEATHS_KEY = 'jellyrun.act1deaths';
export const OFFER_AFTER = 2;
export const act1Deaths = () => { try { return parseInt(localStorage.getItem(DEATHS_KEY), 10) || 0; } catch { return 0; } };
export const noteAct1Death = () => { try { localStorage.setItem(DEATHS_KEY, String(act1Deaths() + 1)); } catch {} };
export const easyOffered = (cleared) => !cleared && act1Deaths() >= OFFER_AFTER && !easyChosen();
