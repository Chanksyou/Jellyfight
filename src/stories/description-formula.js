// Stories: the description formula (docs/agents/descriptions.md). Shared helpers are in ./kit.js; src/stories.js imports this file in order.
// To check another kind of text (Attack upgrades, jelly cards...), push one more function onto DESCRIPTION_SOURCES.

import { TREASURES, EVOLUTIONS } from '../stats.js';
import { ok, story } from './kit.js';

// [paraphrase, what the doc says instead]: one line for each wording the rules name
export const BANNED = [
  [/\d+% of (hits|kills|attacks)/, 'a chance reads "1 in N hits:"'],
  [/\bnearby\b|\bnear\b|\baround you\b/, '"within N cm"'],
  [/\b(enemy|enemies)\b/i, '"bug"'],
  [/\bBosses\b|\b[Tt]he boss\b/, '"Elites and the Boss"'],
  [/\b(double|twice|half)\b|\b(two|three|four) times\b|\bseconds\b/i, '"2x", "50%", "s"'],
  [/\bXP (gems?|drips?)\b|\bgems?\b/i, '"XP droplets"'],
  [/\b(deals?|dealt|stings?|stung|stinging|hurts|hurting|cuts|cutting|slams?|strikes?|burns)\b/, '"hits"'],
  [/\b(pushes|pushing|knocks?|throws? back|shoves? back|pins?|pinned|held|stuck)\b/, '"shoves", "Stuns"'],
  [/\(.*cooldown\)|\(up to \d+\)|\bup to \d+ times\b/, '"4 s cooldown." as its own sentence; a cap reads ", up to 5 at once."'],
  [/\bfor \d+(\.\d+)?x damage\b/, '"Nx Attack damage"'],
  [/\b(lasts?|lasting)\b/i, '"for N s" straight after the thing it times'],
  [/\b(finish(es|ed)? off|clear(s|ed)?|falls)\b/i, '"kill", "dies"'],
  [/\bStand still\b|\b(After each|Each|Every) level-up\b/i, '"After 1 s standing still:", "On a level-up:"'],
  [/\b(this run|nonstop|continuously)\b/i, 'cut the filler'],
];

// each source lists its live texts as [where, text]
export const DESCRIPTION_SOURCES = [
  () => TREASURES.filter((t) => !t.retired).flatMap((t) => (t.levelText || [t.text]).map((x, i) => [`treasure ${t.id}${i ? ` level ${i + 1}` : ''}`, x])),
  () => EVOLUTIONS.filter((e) => !e.retired).flatMap((e) => (e.levelText || [e.text]).map((x, i) => [`evolution ${e.id}${i ? ` level ${i + 1}` : ''}`, x])),
];

export function formulaOffenders(texts = DESCRIPTION_SOURCES.flatMap((s) => s())) {
  const hits = [];
  for (const [where, text] of texts) for (const [re, say] of BANNED) { const m = text.match(re); if (m) hits.push(`${where}: "${m[0]}" (say ${say})`); }
  return hits;
}

story('vocabulary/descriptions-follow-the-formula', {
  about: 'No live Treasure, level or evolution text uses a paraphrase docs/agents/descriptions.md rules out.',
  setup() {},
  play() {
    const texts = DESCRIPTION_SOURCES.flatMap((s) => s()), hits = formulaOffenders(texts);
    const caught = formulaOffenders([['sample', 'Every 6 s: a bath bomb stings nearby enemies for 2x damage (4 s cooldown).']]).length;   // the check itself bites
    return ok(texts.length > 100 && caught >= 4 && !hits.length, { texts: texts.length, caught, hits: hits.slice(0, 12) });
  },
});
