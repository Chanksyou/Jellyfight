// The layout editor's screen (layout.js has the editing): act chips, the object list and help on
// top; a slim bar below (Add, Undo, Export, Done); a selection bar only while something is
// selected; sheets for Add, Export and help. Built from the UI kit (ui-kit.css, --ui-* tokens).
import { icon } from './icons.js';
import { CONTENT } from './content.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `
  .jf-lt-top, .jf-lt-bottom { position: fixed; left: 0; right: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-2); pointer-events: none;
    padding: var(--ui-space-2) max(var(--ui-space-2), env(safe-area-inset-right)) var(--ui-space-2) max(var(--ui-space-2), env(safe-area-inset-left)); }
  .jf-lt-top { top: 0; } .jf-lt-bottom { bottom: 0; padding-bottom: max(var(--ui-space-2), env(safe-area-inset-bottom)); }
  .jf-lt-top > *, .jf-lt-bottom > * { pointer-events: auto; max-width: 100%; }
  .jf-lt-row.ui-panel { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2); border-radius: var(--ui-radius-m); }
  .jf-lt-name { flex: 0 1 auto; max-width: 16ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jf-lt [hidden] { display: none !important; }
  .jf-lt select { flex: 1 1 140px; min-width: 0; max-width: 260px; min-height: var(--ui-target); padding: 0 var(--ui-space-3); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-pill);
    background: var(--ui-deep); color: var(--ui-ink); font: 600 var(--ui-size-body)/1.1 var(--ui-font-text); }
  .jf-lt-size { display: inline-flex; align-items: center; gap: var(--ui-space-1); }
  .jf-lt-size b { min-width: 3.2em; text-align: center; }
  .jf-lt-grid { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: var(--ui-space-3); }
  .jf-lt-sheet .ui-text { margin-top: var(--ui-space-2); }
  .jf-lt-sheet textarea { box-sizing: border-box; width: 100%; height: 40vh; margin: var(--ui-space-3) 0; padding: var(--ui-space-2); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-s);
    background: var(--ui-deep); color: var(--ui-mint); font: 12px/1.35 ui-monospace, monospace; }
  .jf-lt-sheet .jf-lt-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); }
  .jf-lt-keys { display: grid; grid-template-columns: auto 1fr; gap: var(--ui-space-1) var(--ui-space-3); margin: var(--ui-space-2) 0 0; }
  .jf-lt-keys dt { font-weight: 700; color: var(--ui-mint); } .jf-lt-keys dd { margin: 0; }`;

const HELP = [
  ['Select', 'Tap an object, or a vent handle (orange grille, blue landing). The list at the top finds hidden and deleted ones.'],
  ['Move', 'Drag the selected object. Plants and copies stick to the top of whatever is under your finger; Stick turns that on for furniture too.'],
  ['View', 'Drag empty space to pan, pinch to zoom, ◀ ▶ to turn.'],
  ['Add', 'Pick a plant: it lands in the middle of the view. Then each tap on a surface drops another one, until you tap the Stamping chip, press Esc or press Done.'],
];
const KEYS = [['WASD', 'pan'], ['wheel', 'zoom'], ['right-drag', 'turn the view'], ['Q / E', 'rotate 15° (Shift: 90°)'], ['R / F', 'up / down 1 cm (Shift: 5 cm)'], ['H', 'hide'], ['Del', 'delete'], ['Ctrl+D', 'duplicate'], ['Ctrl+Z', 'undo'], ['Esc', 'close a sheet, stop stamping, then done']];

export class LayoutUi {
  constructor(L) {
    this.L = L;
    const el = this.el = document.createElement('div');
    el.className = 'jf-keep jf-lt';
    el.hidden = true;
    const ib = (a, ic, label) => `<button class="ui-btn ui-btn--icon" data-a="${a}" title="${label}" aria-label="${label}">${/^[a-z-]+$/.test(ic) ? icon(ic) : ic}</button>`;
    const acts = (L.acts || [L.act]).map((n) => n === L.act ? `<span class="ui-chip" aria-pressed="true">Act ${n}</span>` : `<button class="ui-chip" data-a="act${n}" title="Edit Act ${n}'s layout instead">Act ${n}</button>`).join('');
    el.innerHTML = `<style>${CSS}</style>
      <div class="jf-lt-top"><div class="ui-panel jf-lt-row"><span class="ui-label">Layout</span>${acts}
        <select class="list" aria-label="Choose an object (hidden and deleted ones too)"></select>
        ${ib('viewL', '◀', 'Turn the view left')}${ib('viewR', '▶', 'Turn the view right')}${ib('help', 'info', 'Keys and gestures')}</div></div>
      <div class="jf-lt-bottom">
        <button class="ui-chip" data-a="stamp-off" hidden></button>
        <div class="ui-panel jf-lt-row jf-lt-sel" hidden>
          <span class="ui-text jf-lt-name"></span>
          ${ib('rotL', 'turn-left', 'Rotate left 15° (Q)')}${ib('rotR', 'turn-right', 'Rotate right 15° (E)')}${ib('up', 'up', 'Raise 1 cm (R)')}${ib('down', 'down', 'Lower 1 cm (F)')}
          <span class="jf-lt-size" data-for="prop">${ib('smaller', '−', 'Smaller')}<b class="ui-num" data-size></b>${ib('bigger', '+', 'Bigger')}</span>
          <button class="ui-chip" data-a="stick" data-for="thing" title="Drop it on top of whatever is under your finger">Stick</button>
          <button class="ui-btn" data-a="dup" data-for="thing" title="A copy 10 cm aside (Ctrl+D)">${icon('copy')}Duplicate</button>
          ${ib('hide', 'eye', 'Hide (H)')}${ib('del', 'trash', 'Delete (Del)')}${ib('home', 'home', 'Put this one back')}
        </div>
        <div class="ui-panel jf-lt-row">
          <button class="ui-btn" data-a="add">${icon('plus')}Add</button>${ib('undo', 'undo', 'Undo (Ctrl+Z)')}
          <button class="ui-btn" data-a="io">${icon('share')}Export<b class="ui-num" data-edited></b></button>
          <button class="ui-btn ui-btn--primary" data-a="done">Done</button></div>
      </div>`;
    document.body.appendChild(el);
    this.listEl = el.querySelector('.list');
    this.listEl.addEventListener('change', () => {
      const it = L.items.find((x) => x.key === this.listEl.value);
      if (it) { L.sel = it; L.refresh(); }
    });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      if (a.startsWith('act')) { const n = +a.slice(3); if (n !== L.act) L.onAct?.(n); return; }
      ({
        rotL: () => L.rotate(Math.PI / 12), rotR: () => L.rotate(-Math.PI / 12), up: () => L.raise(0.01), down: () => L.raise(-0.01),
        smaller: () => L.resize(-0.1), bigger: () => L.resize(0.1), stick: () => L.toggleStick(),
        hide: () => L.toggleHide(), del: () => L.deleteSelected(), home: () => L.putBack(), dup: () => L.duplicate(), undo: () => L.undo(),
        viewL: () => { L.yaw += Math.PI / 8; }, viewR: () => { L.yaw -= Math.PI / 8; },
        add: () => this.showAdd(), io: () => this.showIo(), help: () => this.showHelp(), 'stamp-off': () => L.endStamp(), done: () => L.onDone?.(),
      })[a]?.();
      L.refresh();
    });
  }

  label(x) { return (CONTENT.props.find((p) => p.id === x.node.userData.prop)?.label || x.node.name.replace(/_/g, ' ')) + (!x.added ? '' : x.node.userData.from ? ' (copy)' : ' (added)'); }
  $(s) { return this.el.querySelector(s); }

  refresh() {
    const L = this.L, it = L.sel, vent = it?.vi != null, u = it?.node.userData || {}, off = !!it && (it.deleted || !it.node.visible);
    this.$('.jf-lt-sel').hidden = !it;
    for (const e of this.el.querySelectorAll('[data-for]')) e.hidden = !it || vent || (e.dataset.for === 'prop' && !u.prop);
    for (const b of this.el.querySelectorAll('[data-a=rotL],[data-a=rotR],[data-a=hide],[data-a=del]')) b.hidden = !it || vent;
    if (it) {
      // the list at the top shows what is selected; this says what it can't (a vent handle, hidden, deleted)
      const name = this.$('.jf-lt-name'), note = vent ? it.node.name : it.deleted ? 'Deleted' : it.node.visible ? '' : 'Hidden';
      name.hidden = !note; name.title = name.textContent = note;
      this.$('[data-a=del]').disabled = !!it.deleted;
      this.$('[data-a=dup]').disabled = !L.canCopy(it);
      this.$('[data-a=dup]').title = L.canCopy(it) || it.deleted ? 'A copy 10 cm aside (Ctrl+D)' : 'The room draws this one itself: it can\'t be copied';
      const hide = this.$('[data-a=hide]');
      hide.title = off ? 'Show (H)' : 'Hide (H)'; hide.setAttribute('aria-label', hide.title);
      this.$('[data-a=stick]').setAttribute('aria-pressed', String(L.sticks(it)));
      this.$('[data-size]').textContent = u.prop ? `${Math.round(u.s * 100)}%` : '';
      this.$('[data-a=smaller]').disabled = !!it.deleted || u.s <= 0.5;
      this.$('[data-a=bigger]').disabled = !!it.deleted || u.s >= 2;
    }
    this.$('[data-a=undo]').disabled = !L.undoStack.length;
    const edited = Object.keys(L.data).length;
    this.$('[data-edited]').textContent = edited ? ` ${edited}` : '';
    const stamp = this.$('[data-a=stamp-off]');
    stamp.hidden = !L.stamp;
    if (L.stamp) stamp.textContent = `Stamping ${CONTENT.props.find((p) => p.id === L.stamp.id)?.label || L.stamp.id}: tap to stop ✕`;
    // the object list: rebuilt only when membership or states change; hidden and deleted stay listed
    const sig = L.items.map((x) => `${x.key}:${x.deleted ? 'd' : x.node.visible ? '' : 'h'}${L.data[x.key] ? 'e' : ''}`).join('|');
    if (sig !== this._listSig) {
      this._listSig = sig;
      this.listEl.innerHTML = '<option value="">— choose an object —</option>' + L.items.map((x) =>
        `<option value="${esc(x.key)}">${esc(this.label(x))}${x.deleted ? ' · deleted' : x.node.visible ? '' : ' · hidden'}${L.data[x.key] && !x.deleted ? ' · edited' : ''}</option>`).join('');
    }
    this.listEl.value = it && !vent ? it.key : '';
  }

  // ---------------------------------------------------------------- sheets
  // one sheet at a time, over a scrim (tapping it closes); returns the sheet
  sheet(title, body) {
    this.dismiss();
    const scrim = document.createElement('div'), sheet = document.createElement('section');
    scrim.className = 'ui-scrim ui-enter jf-keep';
    sheet.className = 'ui-sheet ui-enter jf-keep jf-lt-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', title);
    sheet.innerHTML = `<div class="ui-header"><h2>${esc(title)}</h2><button class="ui-btn ui-btn--icon" data-s="close" aria-label="Close">${icon('close')}</button></div>${body}`;
    scrim.onclick = () => this.dismiss();
    sheet.querySelector('[data-s=close]').onclick = () => this.dismiss();
    document.body.append(scrim, sheet);
    this.open = [scrim, sheet];
    return sheet;
  }
  // closes the open sheet; says whether there was one
  dismiss() { const was = !!this.open; this.open?.forEach((e) => e.remove()); this.open = null; return was; }

  showHelp() {
    this.sheet('Layout editor', `${HELP.map(([k, t]) => `<p class="ui-text"><b>${k}</b> ${esc(t)}</p>`).join('')}
      <p class="ui-label" style="margin-top:var(--ui-space-4)">Keyboard</p><dl class="ui-text jf-lt-keys">${KEYS.map(([k, t]) => `<dt>${esc(k)}</dt><dd>${esc(t)}</dd>`).join('')}</dl>`);
  }

  // the prop library (content/props.kdl): tap one to place it, then stamp more
  showAdd() {
    const sheet = this.sheet('Add', `<p class="ui-text">It lands in the middle of the view. Then tap surfaces to drop more.</p>
      <div class="jf-lt-grid">${CONTENT.props.map((p) => `<button class="ui-tile" data-prop="${esc(p.id)}"><span style="font-size:24px" aria-hidden="true">🪴</span>${esc(p.label)}</button>`).join('')}</div><p class="ui-text" data-err></p>`);
    sheet.addEventListener('click', async (e) => {
      const tile = e.target.closest('[data-prop]');
      if (!tile) return;
      tile.disabled = true;
      try { await this.L.addProp(tile.dataset.prop); this.dismiss(); this.L.refresh(); }
      catch (err) { tile.disabled = false; sheet.querySelector('[data-err]').textContent = `Couldn't load it: ${err.message}`; }
    });
  }

  showIo() {
    const L = this.L;
    const sheet = this.sheet(`Layout code: Act ${L.act}`, `<p class="ui-text">Copy this and paste it to Claude to bake the layout in. Or paste a code here and press Load.</p>
      <textarea spellcheck="false"></textarea><div class="jf-lt-row"><button class="ui-btn" data-a="copy">Copy</button><button class="ui-btn" data-a="load">Load</button>
      <button class="ui-btn ui-btn--ghost" data-a="reset">Reset all</button><span class="ui-text" data-status></span></div>`);
    sheet.id = 'jf-layout-io';
    const ta = sheet.querySelector('textarea'), status = sheet.querySelector('[data-status]');
    ta.value = L.exportCode();
    sheet.addEventListener('click', async (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'copy') { ta.select(); try { await navigator.clipboard.writeText(ta.value); status.textContent = 'Copied!'; } catch { document.execCommand?.('copy'); status.textContent = 'Selected: copy it'; } }
      if (a === 'load') {
        try { const msg = await L.loadCode(ta.value); if (msg) status.textContent = msg; else this.dismiss(); }
        catch (err) { status.textContent = err instanceof SyntaxError ? 'Not valid JSON' : `Couldn't load it: ${err.message}`; }
      }
      if (a === 'reset' && confirm('Put every object back where it started?')) { this.dismiss(); L.resetAll(); }
      L.refresh();
    });
  }
}
