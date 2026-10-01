// A small KDL reader for the content files (content/*.kdl). KDL is a plain-text node
// language: each line is a node name, then arguments, then key=value properties, then an
// optional { block } of child nodes.
//
//   enemy "ants" name="Ant squad" hp=66 {
//       chase 0.225
//       curl-dash windup=0.6 time=0.7
//   }
//
// parse(text) returns [{ name, args: [...], props: {...}, children: [...], line }].
// Covers what our content uses: strings, numbers, true/false/null (bare or #-prefixed),
// bare words as values, // and /* */ comments, ; between nodes, \ to continue a line.
export function parse(text, file = 'content') {
  let i = 0, line = 1;
  const fail = (msg) => { throw new Error(`${file}:${line}: ${msg}`); };
  const peek = () => text[i];
  const ws = () => {
    for (;;) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\r') i++;
      else if (c === '\\' && /^\\[ \t]*(\/\/[^\n]*)?\n/.test(text.slice(i))) { i = text.indexOf('\n', i) + 1; line++; }   // line continuation
      else if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i); if (end < 0) fail('unclosed /* comment'); line += (text.slice(i, end).match(/\n/g) || []).length; i = end + 2; }
      else if (text.startsWith('//', i)) { while (i < text.length && text[i] !== '\n') i++; }
      else return;
    }
  };
  const isWordChar = (c) => c !== undefined && !/[\s{}()\[\]=;"\\/]/.test(c);
  const word = () => { const s = i; while (isWordChar(text[i])) i++; return text.slice(s, i); };
  const string = () => {
    i++;
    let out = '';
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') { const n = text[++i]; out += n === 'n' ? '\n' : n === 't' ? '\t' : n; i++; }
      else { if (text[i] === '\n') line++; out += text[i++]; }
    }
    if (text[i] !== '"') fail('unclosed string');
    i++;
    return out;
  };
  const value = (raw) => {
    if (/^[+-]?(\d[\d_]*)(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(raw)) return Number(raw.replace(/_/g, ''));
    const k = raw.replace(/^#/, '');
    if (k === 'true') return true;
    if (k === 'false') return false;
    if (k === 'null') return null;
    return raw;                       // a bare word, e.g. a palette token name
  };
  const nodes = (closing) => {
    const out = [];
    for (;;) {
      ws();
      const c = peek();
      if (c === undefined) { if (closing) fail('missing }'); return out; }
      if (c === '\n') { i++; line++; continue; }
      if (c === ';') { i++; continue; }
      if (c === '}') { if (!closing) fail('unexpected }'); i++; return out; }
      const node = { name: c === '"' ? string() : word(), args: [], props: {}, children: [], line };
      if (!node.name) fail(`unexpected "${c}"`);
      for (;;) {
        ws();
        const d = peek();
        if (d === undefined || d === '\n' || d === ';' || d === '}') break;
        if (d === '{') { i++; node.children = nodes(true); break; }
        const tok = d === '"' ? string() : word();
        if (!tok && d !== '"') fail(`unexpected "${d}"`);
        if (peek() === '=') {
          i++;
          node.props[tok] = peek() === '"' ? string() : value(word());
        } else node.args.push(d === '"' ? tok : value(tok));
      }
      out.push(node);
    }
  };
  return nodes(false);
}
