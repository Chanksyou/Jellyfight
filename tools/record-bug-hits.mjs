// Records src/stories/bug-attack-hits.json: when each basic bug's attack tests its hit and from where
// (src/stories/bug-attack-motion.js). Run it on a main with no attack animation changes, never to make
// a story pass.
//
//   node tools/record-bug-hits.mjs
import fs from 'node:fs';
import path from 'node:path';
import { start, openGame, ROOT } from '../tests/lib.mjs';

const env = await start();
try {
  const { page, errors } = await openGame(env);
  const hits = await page.evaluate(async () => (await import('/src/stories/bug-attack-motion.js')).measureAll());
  const bad = Object.entries(hits).filter(([, h]) => h.frames < 0).map(([id]) => id);
  if (bad.length) throw new Error(`no hit test seen for ${bad.join(', ')}`);
  fs.writeFileSync(path.join(ROOT, 'src/stories/bug-attack-hits.json'), JSON.stringify(hits, null, 1) + '\n');
  console.log(Object.entries(hits).map(([id, h]) => `${id.padEnd(20)} ${String(h.frames).padStart(4)} frames`).join('\n'));
  if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 5).join('\n  '));
} finally { await env.close(); }
