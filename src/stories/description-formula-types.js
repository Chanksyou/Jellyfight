// Stories: jelly type blurbs and Attack upgrade texts follow docs/agents/descriptions.md. Shared helpers are in ./kit.js; src/stories.js imports this file in order.

import { CONTENT } from '../content.js';
import { ok, story } from './kit.js';

// The paraphrases docs/agents/descriptions.md names, each with the form to use instead.
const BANNED = [
  [/\d+% of (hits|kills|bursts)/, '1 in N hits / kills (a chance), or N% of the hit (a share)'],
  [/\bnearby\b|\bnear\b/, 'within N cm'],
  [/\b(enemy|enemies)\b/, 'bug'],
  [/\bBosses\b|\bthe boss\b|\bboss\b/, 'Elites and the Boss'],
  [/\b(double|twice|half|seconds|three)\b/i, '2x, 50%, s, 3'],
  [/\bXP gems?\b/, 'XP droplet'],
  [/\bdeals?\b|\bstrikes?\b|\bslams?\b|\bhurts\b/i, 'hits / do'],
  [/\bheld\b|\bpinned\b|\bstuck\b/, 'Stunned, Frozen or Trapped'],
  [/for \d+(\.\d+)?x damage/, 'for Nx Attack damage, or N% of the hit'],
  [/\bEach (kill|hit)\b|\bstacks? of\b/, 'On a kill: / per <thing>'],
  [/\blasts?\b|\blasting\b/, 'for N s / stay'],
  [/\b(pushes|pushed|push|knock\w*|throws? back)\b/, 'shoves / pulls / throws up'],
  [/\bup to \d+ stacks\b.*\+\d|\bfor each\b/, 'a total (up to +N%), or per <thing>'],
];

story('vocabulary/type-descriptions-follow-the-formula', {
  about: 'No jelly type blurb or Attack upgrade text uses a paraphrase docs/agents/descriptions.md rules out; the story names each offender and the form to use.',
  setup() {},
  play() {
    const texts = [
      ...CONTENT.upgrades.map((u) => [`upgrade ${u.id}`, u.text]),
      ...Object.values(CONTENT.jellies).map((j) => [`jelly ${j.id}`, j.about]),
    ];
    const hits = [];
    for (const [where, text] of texts) for (const [re, use] of BANNED) { const m = text.match(re); if (m) hits.push(`${where}: "${m[0]}" (use ${use})`); }
    return ok(texts.length > 100 && !hits.length, { checked: texts.length, hits: hits.slice(0, 12) });
  },
});
