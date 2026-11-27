// Shared bits: pop-up sheets and small helpers used by Mail and the extras.
(function () {
  'use strict';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, cls, onClick) => { const b = el('button', 'btn ' + (cls || ''), label); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; };

  // A sheet slides up from the bottom on phones and sits centered on the Mac.
  function sheet(title, body, opts) {
    opts = opts || {};
    const back = el('div', 'sheet-back');
    const box = el('div', 'sheet' + (opts.wide ? ' wide' : ''));
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const head = el('div', 'sheet-h');
    head.append(el('h3', '', title));
    const x = el('button', 'link', 'Close'); x.type = 'button';
    head.append(x);
    const main = el('div', 'sheet-b');
    main.append(body);
    box.append(head, main);
    if (opts.actions && opts.actions.length) { const f = el('div', 'sheet-f'); f.append(...opts.actions); box.append(f); }
    back.append(box);
    document.body.append(back);
    document.body.classList.add('locked');
    const close = () => { back.remove(); if (!document.querySelector('.sheet-back')) document.body.classList.remove('locked'); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape' && back === [...document.querySelectorAll('.sheet-back')].pop()) close(); };
    x.addEventListener('click', close);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => { const f = box.querySelector('input, textarea, select'); if (f && !opts.noFocus) f.focus(); }, 50);
    return {close, box};
  }

  // Labeled form field. kind: text | email | date | number | textarea | select
  function field(label, name, kind, value, extra) {
    const w = el('label', 'fld');
    w.append(el('span', '', label));
    let input;
    if (kind === 'textarea') { input = el('textarea'); input.rows = (extra && extra.rows) || 4; }
    else if (kind === 'select') { input = el('select'); (extra.options || []).forEach(([v, l]) => { const o = el('option', '', l); o.value = v; input.append(o); }); }
    else { input = el('input'); input.type = kind || 'text'; if (kind === 'number') input.step = 'any'; }
    input.name = name;
    if (value != null) input.value = value;
    if (extra && extra.placeholder) input.placeholder = extra.placeholder;
    w.append(input);
    return w;
  }
  const values = (root) => { const o = {}; root.querySelectorAll('[name]').forEach((i) => { o[i.name] = i.value.trim(); }); return o; };

  const ago = (d) => {
    const ms = Date.now() - new Date(d).getTime(), m = Math.round(ms / 60000);
    if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.round(m / 60); if (h < 24) return h + 'h';
    const days = Math.round(h / 24); if (days < 7) return days + 'd';
    return new Date(d).toLocaleDateString('en-CA', {month: 'short', day: 'numeric'});
  };

  // ---------- Undo ----------
  // Anything that changes data calls undoable(message, undoFn). A bar pops up with an
  // Undo button for a few seconds, and ⌘Z / Ctrl+Z (outside text boxes) undoes the last one.
  const stack = [];
  let bar = null, hideT = null;
  function showBar(msg, opts) {
    if (!bar) {
      bar = el('div', 'undo-bar'); bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
      document.body.append(bar);
    }
    bar.replaceChildren(el('span', 'ub-msg', msg));
    if (!(opts && opts.noUndo)) { const u = el('button', 'ub-undo', 'Undo'); u.type = 'button'; u.addEventListener('click', () => undo()); bar.append(u); }
    const x = el('button', 'ub-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.addEventListener('click', hide); bar.append(x);
    bar.classList.add('show');
    clearTimeout(hideT); hideT = setTimeout(hide, (opts && opts.ms) || 7000);
  }
  function hide() { if (bar) bar.classList.remove('show'); }
  function undoable(msg, fn, opts) {
    stack.push({msg, fn}); if (stack.length > 30) stack.shift();
    showBar(msg, opts);
  }
  let busy = false;
  async function undo() {
    if (busy) return;
    const it = stack.pop();
    if (!it) { showBar('Nothing to undo', {noUndo: true, ms: 2000}); return; }
    busy = true; hide();
    try { await it.fn(); showBar('Undone: ' + it.msg.replace(/\.$/, ''), {noUndo: true, ms: 2500}); }
    catch (e) { showBar('Couldn’t undo: ' + (e && e.message || e), {noUndo: true, ms: 4000}); }
    busy = false;
  }
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
    const a = document.activeElement;
    if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return; // let text boxes undo typing
    const app = document.getElementById('app'); if (!app || app.hidden) return;
    e.preventDefault(); undo();
  });

  window.HQ_UI = {el, btn, sheet, field, values, ago, undoable, undo, notice: (m) => showBar(m, {noUndo: true, ms: 3000}), canUndo: () => stack.length > 0};
})();
