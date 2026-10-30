// README.md keeps one sentence per line. Markdown renders a single line break as a space, so the
// page looks the same, but two pull requests that edit different sentences of one paragraph or
// bullet no longer touch the same line, and git merges them without a conflict.
//
//   node tools/one-sentence.mjs      rewrap README.md (node tests/check.mjs fails until you do)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const README = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../README.md');

// a sentence ends at . ? or ! (and any closing marks after it), then a space, then a capital
const END = /[.?!][)"'*_]*$/;
const NOT_AN_END = /(?:^|[\s(])(?:e\.g|i\.e|vs|etc|cf|approx|[A-Z])\.$/;
// a line must not start with what Markdown would read as a list, heading, quote, table or HTML
const RISKY = /^(?:[-+*>#|<=]|\d+[.)])/;

function splitLine(line) {
  const item = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
  const indent = item ? ' '.repeat(item[0].length) : /^\s*/.exec(line)[0];
  const out = [];
  let start = 0, code = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '`') { code = !code; continue; }
    if (code || line[i] !== ' ' || !END.test(line.slice(start, i)) || NOT_AN_END.test(line.slice(start, i))) continue;
    let j = i; while (line[j] === ' ') j++;
    const next = line.slice(j);
    if (!/^(?:\*\*|["(_])?[A-Z]/.test(next) || RISKY.test(next)) continue;
    out.push(line.slice(start, i));
    start = j; i = j - 1;
  }
  out.push(line.slice(start));
  return out.map((s, k) => (k ? indent + s : s).trimEnd() + (k === out.length - 1 ? line.match(/ {2,}$/)?.[0] || '' : ''));
}

export function oneSentencePerLine(text) {
  let fence = false;
  return text.split('\n').flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return [line]; }
    if (fence || /^\s*(#|\||<)/.test(line) || /^( {4}|\t)/.test(line) && !/^\s*([-*+]|\d+[.)])\s/.test(line)) return [line];
    return splitLine(line);
  }).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = fs.readFileSync(README, 'utf8');
  fs.writeFileSync(README, oneSentencePerLine(text));
}
