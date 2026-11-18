// Easy mode: a choice in Settings, kept in this browser. A run reads it as it begins and keeps it
// through its acts (run.easy, carried with the run). The jelly deals `dealt` times the damage,
// takes `taken` times, and earns `pearls` times the Pearls; an Easy score is never posted.
export const EASY_KEY = 'jellyrun.easy';
export const EASY = { dealt: 2, taken: 0.5, pearls: 0.5 };
export const easyChosen = () => { try { return localStorage.getItem(EASY_KEY) === 'on'; } catch { return false; } };
export const chooseEasy = (on) => { try { localStorage.setItem(EASY_KEY, on ? 'on' : 'off'); } catch {} };
