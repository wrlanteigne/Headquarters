// Docs: a full-page writing space with folders, templates, a formatting bar,
// "/" commands, Markdown shortcuts (# , - , [] , > ), to-do boxes, pinning,
// search, archive, and export (Word, PDF, Markdown, email).
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  let ctx = null;
  const SPACES = ['Clearform Studio', 'ClearformSheets', 'School', 'Personal'];
  const ICONS = ['📄', '📝', '💡', '📞', '🧱', '🛠️', '💰', '📈', '🎯', '📚', '✅', '🗓️', '🏔️', '🇨🇭', '🔥', '⭐'];
  const S = {space: 'All', q: '', archived: false, sort: 'edited', view: 'grid', open: null};

  // ---------- Templates ----------
  const T = [
    {name: 'Blank', icon: '📄', title: 'Untitled', html: '<p><br></p>'},
    {name: 'Meeting notes', icon: '📝', title: 'Meeting notes', html: '<p><b>Date:</b> {today}<br><b>With:</b> </p><h2>What we talked about</h2><ul><li><br></li></ul><h2>Decisions</h2><ul><li><br></li></ul><h2>Next steps</h2><ul class="todo"><li><br></li></ul>'},
    {name: 'Website brief', icon: '🧱', title: 'Website brief: ', space: 'Clearform Studio', html: '<h2>The business</h2><p><b>Name:</b> <br><b>Contact:</b> <br><b>Phone / email:</b> <br><b>Current site:</b> </p><h2>What they do</h2><p><br></p><h2>Pages</h2><ul class="todo"><li>Home</li><li>Services</li><li>About</li><li>Contact</li></ul><h2>Look and feel</h2><p><b>Logo / photos:</b> <br><b>Colours they like:</b> <br><b>Sites they like:</b> </p><h2>Deal</h2><p><b>Plan:</b> Launch $100/mo · Grow $200/mo<br><b>Go-live date:</b> </p>'},
    {name: 'Call script', icon: '📞', title: 'Call script', space: 'Clearform Studio', html: '<h2>Opener</h2><blockquote>Hi, is this the owner? My name is William, I build websites for trades around Whistler and Squamish. Got 30 seconds?</blockquote><h2>Question</h2><p><br></p><h2>If they say yes</h2><ul><li><br></li></ul><h2>If they say “not interested”</h2><ul><li><br></li></ul><h2>Close</h2><p>Can I send you a free preview this week?</p>'},
    {name: 'Weekly review', icon: '📈', title: 'Week of {today}', html: '<h2>Wins</h2><ul><li><br></li></ul><h2>What didn’t work</h2><ul><li><br></li></ul><h2>Numbers</h2><p><b>Money this week:</b> <br><b>Outreach:</b> contacted __ · replies __ · previews __ · signed __</p><h2>Next week’s top 3</h2><ol><li><br></li><li><br></li><li><br></li></ol>'},
    {name: 'Study notes', icon: '📚', title: 'Notes: ', space: 'School', html: '<p><b>Unit:</b> <br><b>Test date:</b> </p><h2>Key ideas</h2><ul><li><br></li></ul><h2>Terms</h2><ul><li><b>Term</b>: meaning</li></ul><h2>Questions to ask</h2><ul class="todo"><li><br></li></ul>'},
    {name: 'Idea', icon: '💡', title: 'Idea: ', space: 'Personal', html: '<h2>The problem</h2><p>Who has it, and how much does it cost them?</p><h2>The fix</h2><p><br></p><h2>Who would pay</h2><p><br></p><h2>Cheapest way to test it</h2><ul class="todo"><li><br></li></ul>'}
  ];
  const CLAUDE_DOCS = [
    ['Clearform Studio – Sales Playbook', 'https://claude.ai/artifact/PTgUm4FpZTiEcWeKxtdVnw', 'Clearform Studio'],
    ['Clearform Studio: How a Sale Works', 'https://claude.ai/artifact/DQnj8chiM4jjCWu3Qmgp9T', 'Clearform Studio'],
    ['Selling Websites to Whistler Businesses', 'https://claude.ai/artifact/T2mUWLH6yKQBkd2VMJkynx', 'Clearform Studio'],
    ['Trades Lead Tracker', 'https://claude.ai/artifact/NCCZ9qKpdg69prrsFpgHRZ', 'Clearform Studio'],
    ['50 Call List', 'https://claude.ai/artifact/Y6zU6yMrwD8WCDEYUvzRqg', 'Clearform Studio'],
    ['Etsy shop stats', 'https://claude.ai/artifact/WpC2MAUbV6Fwqp9wLsgccp', 'ClearformSheets'],
    ['Startup research: Money Leaks', 'https://claude.ai/artifact/GBxoLsi6ZrnaMHt9FBryGd', 'Personal'],
    ['Automated Invoice Intelligence', 'https://claude.ai/artifact/Ra5seyt2aEr83DtBT3s4sG', 'Personal'],
    ['Size & Strength Plan', 'https://claude.ai/artifact/L2JCw1kFR2NZjievLyxU4c', 'Personal']
  ];
  const todayStr = () => new Date().toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: 'numeric'});

  // ---------- Text helpers ----------
  const isHtml = (s) => /^\s*</.test(s || '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const toHtml = (body) => (isHtml(body) ? body : (body || '').split('\n').map((l) => '<p>' + (esc(l) || '<br>') + '</p>').join(''));
  function plain(html) { const d = document.createElement('div'); d.innerHTML = toHtml(html); d.querySelectorAll('p,h1,h2,h3,li,blockquote,pre,div').forEach((n) => n.append('\n')); return d.textContent.replace(/\n{3,}/g, '\n\n').trim(); }
  const words = (t) => (t.match(/\S+/g) || []).length;
  // Keep only safe tags and attributes (stored docs and anything pasted)
  const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'A', 'DIV', 'SPAN', 'MARK']);
  function clean(html) {
    const d = document.createElement('div'); d.innerHTML = html || '';
    (function walk(n) {
      [...n.childNodes].forEach((c) => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1 || !OK.has(c.tagName)) { if (c.nodeType === 1 && !/SCRIPT|STYLE|IFRAME|OBJECT|EMBED/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
        [...c.attributes].forEach((a) => { const keep = (c.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:|tel:)/i.test(a.value)) || (a.name === 'class' && /^(todo|done)$/.test(a.value)); if (!keep) c.removeAttribute(a.name); });
        if (c.tagName === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
        walk(c);
      });
    })(d);
    return d.innerHTML;
  }
  function toMarkdown(html) {
    const d = document.createElement('div'); d.innerHTML = toHtml(html);
    const inl = (n) => [...n.childNodes].map((c) => {
      if (c.nodeType === 3) return c.textContent;
      const t = inl(c);
      return {B: '**' + t + '**', STRONG: '**' + t + '**', I: '*' + t + '*', EM: '*' + t + '*', S: '~~' + t + '~~', CODE: '`' + t + '`', A: '[' + t + '](' + c.getAttribute('href') + ')', BR: '\n'}[c.tagName] || t;
    }).join('');
    return [...d.children].map((n) => {
      const t = n.tagName;
      if (t === 'H1') return '# ' + inl(n); if (t === 'H2') return '## ' + inl(n); if (t === 'H3') return '### ' + inl(n);
      if (t === 'BLOCKQUOTE') return '> ' + inl(n); if (t === 'HR') return '---'; if (t === 'PRE') return '```\n' + n.textContent + '\n```';
      if (t === 'UL' || t === 'OL') return [...n.children].map((li, i) => (n.classList.contains('todo') ? '- [' + (li.classList.contains('done') ? 'x' : ' ') + '] ' : t === 'OL' ? (i + 1) + '. ' : '- ') + inl(li)).join('\n');
      return inl(n);
    }).join('\n\n');
  }
  function download(name, type, data) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type})); a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const fileName = (d) => (d.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled';

  // ---------- Data ----------
  async function create(tpl, space) {
    tpl = tpl || T[0];
    const row = {title: tpl.title.replace('{today}', todayStr()), body: tpl.html.replace('{today}', todayStr()), icon: tpl.icon, workspace: space || tpl.space || (S.space === 'All' ? 'Clearform Studio' : S.space)};
    const {data, error} = await ctx.sb.from('docs').insert(Object.assign({user_id: ctx.user.id}, row)).select().single();
    if (error) { ctx.toast('Couldn’t create: ' + error.message); return null; }
    ctx.D.docs.unshift(data);
    open(data, true);
    return data;
  }
  async function patch(d, row, quiet) {
    Object.assign(d, row);
    const {error} = await ctx.sb.from('docs').update(row).eq('id', d.id);
    if (error && !quiet) ctx.toast('Not saved: ' + error.message);
    return !error;
  }
  async function duplicate(d) {
    const row = {title: d.title + ' (copy)', body: d.body, icon: d.icon, workspace: d.workspace};
    const {data, error} = await ctx.sb.from('docs').insert(Object.assign({user_id: ctx.user.id}, row)).select().single();
    if (error) { ctx.toast(error.message); return; }
    ctx.D.docs.unshift(data); ctx.toast('Copied.'); draw();
  }
  async function remove(d) {
    const {error} = await ctx.sb.from('docs').delete().eq('id', d.id);
    if (error) { ctx.toast(error.message); return; }
    ctx.D.docs = ctx.D.docs.filter((x) => x.id !== d.id);
    if (S.open && S.open.id === d.id) S.open = null;
    ctx.toast('Deleted.'); draw();
  }

  // ---------- Menus ----------
  function menu(anchor, items) {
    document.querySelectorAll('.pop').forEach((p) => p.remove());
    const m = el('div', 'pop'); m.setAttribute('role', 'menu');
    items.filter(Boolean).forEach((it) => {
      if (it === '-') { m.append(el('hr')); return; }
      const b = el('button', it.danger ? 'danger' : '', it.label); b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.addEventListener('click', (e) => { e.stopPropagation(); if (it.confirm && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = it.confirm; return; } m.remove(); it.run(); });
      m.append(b);
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 4) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
    setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
    return m;
  }
  function docMenu(anchor, d) {
    return menu(anchor, [
      {label: d.pinned ? 'Unpin' : 'Pin to top', run: async () => { await patch(d, {pinned: !d.pinned}); draw(); }},
      {label: 'Duplicate', run: () => duplicate(d)},
      {label: 'Move to…', run: () => moveTo(anchor, d)},
      '-',
      {label: 'Download as Word', run: () => exportDoc(d, 'word')},
      {label: 'Download as Markdown', run: () => exportDoc(d, 'md')},
      {label: 'Print / save as PDF', run: () => exportDoc(d, 'pdf')},
      window.HQ_MAIL ? {label: 'Email it', run: () => exportDoc(d, 'email')} : null,
      '-',
      {label: d.archived ? 'Unarchive' : 'Archive', run: async () => { await patch(d, {archived: !d.archived}); if (S.open && S.open.id === d.id && d.archived) S.open = null; ctx.toast(d.archived ? 'Archived.' : 'Back in your docs.'); draw(); }},
      {label: 'Delete', danger: true, confirm: 'Tap again to delete', run: () => remove(d)}
    ]);
  }
  function moveTo(anchor, d) { menu(anchor, SPACES.map((s) => ({label: (d.workspace === s ? '✓ ' : '') + s, run: async () => { await patch(d, {workspace: s}); ctx.toast('Moved to ' + s + '.'); draw(); }}))); }
  function exportDoc(d, kind) {
    const html = clean(toHtml(d.body)), name = fileName(d);
    if (kind === 'md') download(name + '.md', 'text/markdown', '# ' + d.title + '\n\n' + toMarkdown(html));
    else if (kind === 'word') download(name + '.doc', 'application/msword', '<html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:12.5pt}ul.todo{list-style:none}ul.todo li:before{content:"☐ "}ul.todo li.done:before{content:"☑ "}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:12px;color:#555}</style></head><body><h1>' + esc(d.title) + '</h1>' + html + '</body></html>');
    else if (kind === 'pdf') {
      const w = window.open('', '_blank');
      if (!w) { ctx.toast('Allow pop-ups to print.'); return; }
      w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font:11.5pt/1.6 -apple-system,Segoe UI,Inter,sans-serif;max-width:680px;margin:40px auto;color:#111;padding:0 24px}h1{font-size:26pt;margin:0 0 18px}h2{font-size:15pt;margin:22px 0 6px}h3{font-size:12.5pt}ul.todo{list-style:none;padding-left:4px}ul.todo li:before{content:"☐  "}ul.todo li.done:before{content:"☑  "}ul.todo li.done{color:#888;text-decoration:line-through}blockquote{border-left:3px solid #ddd;margin:0;padding-left:14px;color:#555}a{color:#2563EB}</style></head><body><h1>' + esc(d.title) + '</h1>' + html + '<script>onload=()=>{print()}<\/script></body></html>');
      w.document.close();
    } else if (kind === 'email') window.HQ_MAIL.compose({subject: d.title, body: plain(html)});
  }

  // ---------- List view ----------
  function list() {
    const all = ctx.D.docs || [];
    const out = [];
    const head = el('div', 'page-h');
    const ht = el('div'); ht.append(el('h2', 'big', 'Docs'), el('p', 'muted small', all.filter((d) => !d.archived).length + ' docs · saves as you type'));
    head.append(ht, btn('＋ New doc', 'primary', () => create(T[0])));
    out.push(head);
    const tabs = el('div', 'utabs');
    ['All'].concat(SPACES).forEach((s) => { const n = all.filter((d) => !d.archived && (s === 'All' || d.workspace === s)).length; const b = el('button', S.space === s ? 'on' : ''); b.type = 'button'; b.append(document.createTextNode(s), el('span', 'cnt', String(n))); b.addEventListener('click', () => { S.space = s; draw(); }); tabs.append(b); });
    out.push(tabs);
    const bar = el('div', 'hrow docbar');
    const sIn = el('input', 'mail-search'); sIn.type = 'search'; sIn.placeholder = 'Search titles and text'; sIn.value = S.q; sIn.setAttribute('aria-label', 'Search docs');
    sIn.addEventListener('input', () => { S.q = sIn.value; drawResults(); });
    const sort = el('select', 'sel'); [['edited', 'Last edited'], ['created', 'Newest'], ['title', 'A–Z']].forEach(([v, l]) => { const o = el('option', '', l); o.value = v; sort.append(o); }); sort.value = S.sort; sort.setAttribute('aria-label', 'Sort');
    sort.addEventListener('change', () => { S.sort = sort.value; drawResults(); });
    const viewB = el('div', 'seg'); [['grid', '▦'], ['list', '☰']].forEach(([v, l]) => { const b = el('button', S.view === v ? 'on' : '', l); b.type = 'button'; b.setAttribute('aria-label', v === 'grid' ? 'Grid view' : 'List view'); b.addEventListener('click', () => { S.view = v; draw(); }); viewB.append(b); });
    const ar = el('button', 'chip' + (S.archived ? ' on' : ''), 'Archived'); ar.type = 'button'; ar.addEventListener('click', () => { S.archived = !S.archived; draw(); });
    bar.append(sIn, sort, viewB, ar); out.push(bar);
    const results = el('div'); results.id = 'doc-results'; out.push(results);
    $('docs-root').replaceChildren(...out);
    drawResults();
  }
  function drawResults() {
    const box = $('doc-results'); if (!box) return;
    const all = ctx.D.docs || [], q = S.q.toLowerCase().trim();
    const out = [];
    if (!S.archived && !q) {
      out.push(el('p', 'mgroup', 'Start from a template'));
      const tp = el('div', 'tpls');
      T.forEach((t) => { const b = el('button', 'tpl'); b.type = 'button'; b.append(el('span', 'tpl-i', t.icon), el('b', '', t.name)); const pv = el('div', 'tpl-pv'); pv.textContent = plain(t.html.replace('{today}', todayStr())).slice(0, 90); b.append(pv); b.addEventListener('click', () => create(t)); tp.append(b); });
      out.push(tp);
    }
    let docs = all.filter((d) => d.archived === S.archived && (S.space === 'All' || d.workspace === S.space) && (!q || (d.title + ' ' + plain(d.body)).toLowerCase().includes(q)));
    const key = {edited: (d) => d.updated_at, created: (d) => d.created_at, title: (d) => (d.title || '').toLowerCase()}[S.sort];
    docs.sort((a, b) => ((!!b.pinned) - (!!a.pinned)) || (S.sort === 'title' ? (key(a) < key(b) ? -1 : 1) : (key(a) < key(b) ? 1 : -1)));
    const lh = el('div', 'panel-h'); lh.append(el('p', 'mgroup', q ? 'Results' : S.archived ? 'Archived' : (S.space === 'All' ? 'Your docs' : S.space)), el('span', 'muted small', docs.length + ' doc' + (docs.length === 1 ? '' : 's')));
    out.push(lh);
    if (!docs.length) out.push(el('p', 'muted empty', q ? 'No docs match “' + S.q + '”.' : S.archived ? 'Nothing archived.' : 'No docs here yet. Pick a template above to start.'));
    const wrap = el('div', S.view === 'grid' ? 'docgrid' : 'doclist');
    docs.forEach((d) => {
      const txt = plain(d.body);
      const card = el('div', S.view === 'grid' ? 'dcard' : 'drow'); card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', 'Open ' + d.title);
      const top = el('div', 'dc-top'); top.append(el('span', 'dc-i', d.icon || '📄'), el('b', 'dc-t', d.title || 'Untitled'));
      if (d.pinned) top.append(el('span', 'pinmark', '📌'));
      const more = el('button', 'dc-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More for ' + d.title);
      more.addEventListener('click', (e) => { e.stopPropagation(); docMenu(more, d); });
      top.append(more);
      card.append(top);
      if (S.view === 'grid') card.append(el('p', 'dc-pv', txt.slice(0, 160) || 'Empty'));
      const meta = el('div', 'dc-m'); meta.append(el('span', 'chip-s', d.workspace), el('span', '', 'Edited ' + (U.ago(d.updated_at) === 'now' ? 'just now' : U.ago(d.updated_at) + ' ago')), el('span', '', words(txt) + ' words'));
      card.append(meta);
      card.addEventListener('click', () => open(d));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(d); });
      wrap.append(card);
    });
    out.push(wrap);
    const cl = CLAUDE_DOCS.filter((x) => (S.space === 'All' || x[2] === S.space) && (!q || x[0].toLowerCase().includes(q)));
    if (cl.length && !S.archived) {
      out.push(el('p', 'mgroup', 'Made with Claude · opens in Claude'));
      const u2 = el('div', 'doclist');
      cl.forEach(([t, url, sp]) => { const a = el('a', 'drow'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; const top = el('div', 'dc-top'); top.append(el('span', 'dc-i', '✦'), el('b', 'dc-t', t), el('span', 'muted small', '↗')); const m = el('div', 'dc-m'); m.append(el('span', 'chip-s', sp)); a.append(top, m); u2.append(a); });
      out.push(u2);
    }
    box.replaceChildren(...out);
  }

  // ---------- Editor ----------
  const BLOCKS = [
    ['Text', 'p', 'Plain writing'], ['Heading 1', 'h1', 'Big section title'], ['Heading 2', 'h2', 'Medium title'], ['Heading 3', 'h3', 'Small title'],
    ['Bullet list', 'ul', '• Simple list'], ['Numbered list', 'ol', '1. Steps in order'], ['To-do list', 'todo', '☐ Things to tick off'],
    ['Quote', 'blockquote', 'Call out a line'], ['Code', 'pre', 'Monospace block'], ['Divider', 'hr', 'A line across'], ['Date', 'date', 'Today’s date'], ['Link', 'link', 'Add a web link']
  ];
  let ed = null, timer = null, statusEl = null, countEl = null;

  function open(d, fresh) { S.open = d; draw(); window.scrollTo(0, 0); if (fresh) setTimeout(() => { const t = document.querySelector('.ed-title'); if (t) { t.focus(); t.select(); } }, 50); }
  function close() { flush(); S.open = null; draw(); }
  function flush() { if (timer) { clearTimeout(timer); timer = null; save(); } }
  function queue() { if (statusEl) statusEl.textContent = 'Editing…'; clearTimeout(timer); timer = setTimeout(() => { timer = null; save(); }, 600); updateCount(); }
  async function save() {
    const d = S.open; if (!d || !ed) return;
    const title = (document.querySelector('.ed-title') || {}).value;
    const row = {title: (title || '').trim() || 'Untitled', body: clean(ed.innerHTML), updated_at: new Date().toISOString()};
    if (statusEl) statusEl.textContent = 'Saving…';
    const ok = await patch(d, row, true);
    if (statusEl) statusEl.textContent = ok ? 'Saved' : 'Not saved — check your connection';
  }
  function updateCount() { if (countEl && ed) { const n = words(ed.innerText); countEl.textContent = n + ' word' + (n === 1 ? '' : 's') + ' · ' + Math.max(1, Math.round(n / 230)) + ' min read'; } }

  function exec(cmd, val) { ed.focus(); document.execCommand(cmd, false, val); queue(); refreshBar(); }
  function curBlock() {
    const s = window.getSelection(); if (!s.rangeCount) return null;
    let n = s.anchorNode; if (!ed.contains(n)) return null;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n;
  }
  function curLi() { const s = window.getSelection(); let n = s.anchorNode; while (n && n !== ed) { if (n.tagName === 'LI') return n; n = n.parentNode; } return null; }
  function caret(node, atEnd) { const r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  // Pull one list item out into its own block, splitting the list around it
  function liToBlock(li, tag) {
    const list = li.parentNode, after = [];
    for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
    const blk = document.createElement(tag); blk.innerHTML = li.innerHTML || '<br>';
    list.after(blk);
    if (after.length) { const l2 = list.cloneNode(false); after.forEach((x) => l2.append(x)); blk.after(l2); }
    li.remove(); if (!list.children.length) list.remove();
    caret(blk, true); return blk;
  }
  // Turn the current block into a list (or back into paragraphs) without the browser's odd nesting
  function listify(b, kind) {
    const tag = kind === 'ol' ? 'OL' : 'UL';
    if (b && /^(UL|OL)$/.test(b.tagName)) {
      const same = kind === 'todo' ? b.classList.contains('todo') : (b.tagName === tag && !b.classList.contains('todo'));
      if (same) { const li = curLi(); if (li) liToBlock(li, 'p'); return; }
      const n = document.createElement(tag); if (kind === 'todo') n.className = 'todo'; n.innerHTML = b.innerHTML; b.replaceWith(n); caret(n.lastElementChild || n, true); return;
    }
    const n = document.createElement(tag); if (kind === 'todo') n.className = 'todo';
    const li = document.createElement('li'); li.innerHTML = (b && b.innerHTML) || '<br>'; n.append(li);
    if (b && b.parentNode === ed) b.replaceWith(n); else ed.append(n);
    caret(li, true);
  }
  function setBlock(kind) {
    ed.focus();
    if (kind === 'hr') { document.execCommand('insertHTML', false, '<hr><p><br></p>'); }
    else if (kind === 'date') document.execCommand('insertText', false, todayStr());
    else if (kind === 'link') return link();
    else if (kind === 'ul' || kind === 'ol' || kind === 'todo') listify(curBlock(), kind);
    else {
      const li = curLi();
      if (li) { liToBlock(li, kind); queue(); refreshBar(); return; }
      const b = curBlock();
      const want = (b && b.tagName === kind.toUpperCase() && kind !== 'p') ? 'p' : kind;
      if (b && b.parentNode === ed) { const n = document.createElement(want); n.innerHTML = b.innerHTML || '<br>'; b.replaceWith(n); caret(n, true); }
      else document.execCommand('formatBlock', false, want);
    }
    queue(); refreshBar();
  }
  function link() {
    const s = window.getSelection(); const r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    const f = el('div', 'form'); const u = U.field('Web address', 'url', 'text', 'https://'); const tx = U.field('Text to show (optional)', 'text', 'text', r ? r.toString() : '');
    f.append(u, tx);
    const ok = btn('Add link', 'primary');
    const sh = U.sheet('Add a link', f, {actions: [ok]});
    ok.addEventListener('click', () => {
      let v = u.querySelector('input').value.trim(); if (!v || v === 'https://') return; if (!/^(https?:|mailto:|tel:)/i.test(v)) v = 'https://' + v;
      const label = tx.querySelector('input').value.trim() || v;
      sh.close(); ed.focus();
      if (r) { s.removeAllRanges(); s.addRange(r); }
      document.execCommand('insertHTML', false, '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(label) + '</a>&nbsp;');
      queue();
    });
  }
  let bar = null;
  function refreshBar() {
    if (!bar) return;
    const b = curBlock(); const tag = b ? b.tagName : 'P';
    bar.querySelectorAll('[data-k]').forEach((x) => {
      const k = x.dataset.k; let on = false;
      try { if (/^(bold|italic|underline|strikeThrough)$/.test(k)) on = document.queryCommandState(k); } catch (e) { /* ignore */ }
      if (k === 'h1' || k === 'h2' || k === 'h3' || k === 'blockquote') on = tag === k.toUpperCase();
      if (k === 'ul') on = tag === 'UL' && !b.classList.contains('todo'); if (k === 'ol') on = tag === 'OL'; if (k === 'todo') on = tag === 'UL' && b.classList.contains('todo');
      x.classList.toggle('on', on);
    });
  }
  function toolbar() {
    bar = el('div', 'ed-bar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Formatting');
    const B = (k, label, title, fn) => { const b = el('button', 'tb', label); b.type = 'button'; b.dataset.k = k; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); return b; };
    const sep = () => el('span', 'tb-sep');
    bar.append(
      B('h1', 'H1', 'Heading 1', () => setBlock('h1')), B('h2', 'H2', 'Heading 2', () => setBlock('h2')), B('h3', 'H3', 'Heading 3', () => setBlock('h3')), sep(),
      B('bold', 'B', 'Bold (⌘B)', () => exec('bold')), B('italic', 'I', 'Italic (⌘I)', () => exec('italic')), B('underline', 'U', 'Underline (⌘U)', () => exec('underline')), B('strikeThrough', 'S', 'Strikethrough', () => exec('strikeThrough')), B('hl', '▮', 'Highlight', () => { const s = window.getSelection(); if (!s.isCollapsed) { document.execCommand('insertHTML', false, '<mark>' + esc(s.toString()) + '</mark>'); queue(); } }), sep(),
      B('ul', '•', 'Bullet list', () => setBlock('ul')), B('ol', '1.', 'Numbered list', () => setBlock('ol')), B('todo', '☑', 'To-do list', () => setBlock('todo')), sep(),
      B('blockquote', '❝', 'Quote', () => setBlock('blockquote')), B('link', '🔗', 'Link', () => link()), B('hr', '—', 'Divider', () => setBlock('hr')), sep(),
      B('undo', '↶', 'Undo (⌘Z)', () => exec('undo')), B('redo', '↷', 'Redo (⇧⌘Z)', () => exec('redo'))
    );
    bar.querySelector('[data-k=bold]').style.fontWeight = '800'; bar.querySelector('[data-k=italic]').style.fontStyle = 'italic'; bar.querySelector('[data-k=underline]').style.textDecoration = 'underline'; bar.querySelector('[data-k=strikeThrough]').style.textDecoration = 'line-through';
    return bar;
  }

  // "/" menu
  let slash = null;
  function slashOpen() {
    slashClose();
    const s = window.getSelection(); if (!s.rangeCount) return;
    const r = s.getRangeAt(0).getBoundingClientRect();
    slash = {box: el('div', 'pop slash'), q: '', i: 0, node: s.anchorNode, start: s.anchorOffset - 1};
    document.body.append(slash.box);
    slash.box.style.top = Math.min(window.innerHeight - 320, (r.bottom || r.top) + 6) + 'px';
    slash.box.style.left = Math.min(window.innerWidth - 270, Math.max(8, r.left)) + 'px';
    slashDraw();
  }
  function slashItems() { const q = slash.q.toLowerCase(); return BLOCKS.filter((b) => !q || b[0].toLowerCase().includes(q)); }
  function slashDraw() {
    const items = slashItems(); slash.i = Math.min(slash.i, Math.max(0, items.length - 1));
    slash.box.replaceChildren(el('p', 'mgroup', 'Insert'), ...items.map((b, n) => { const x = el('button', n === slash.i ? 'on' : ''); x.type = 'button'; x.append(el('b', '', b[0]), el('span', '', b[2])); x.addEventListener('mousedown', (e) => { e.preventDefault(); slash.i = n; slashPick(); }); return x; }));
    if (!items.length) slash.box.append(el('p', 'muted small', 'No match'));
  }
  function slashPick() {
    const it = slashItems()[slash.i]; const sl = slash; slashClose();
    if (!it) return;
    // remove the "/query" text that was typed
    try { const r = document.createRange(); r.setStart(sl.node, Math.max(0, sl.start)); r.setEnd(sl.node, Math.min(sl.node.length, sl.start + 1 + sl.q.length)); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('delete'); } catch (e) { /* ignore */ }
    setBlock(it[1]);
  }
  function slashClose() { if (slash) { slash.box.remove(); slash = null; } }

  function editor(d) {
    const wrap = el('div', 'editor');
    const top = el('div', 'ed-top');
    const back = btn('← All docs', 'ghost', close);
    statusEl = el('span', 'muted small ed-status', 'Saved');
    const more = btn('⋯', 'icon'); more.setAttribute('aria-label', 'More'); more.addEventListener('click', () => docMenu(more, d));
    const share = btn('Export', '', () => menu(share, [{label: 'Download as Word', run: () => { flush(); exportDoc(d, 'word'); }}, {label: 'Print / save as PDF', run: () => { flush(); exportDoc(d, 'pdf'); }}, {label: 'Download as Markdown', run: () => { flush(); exportDoc(d, 'md'); }}, window.HQ_MAIL ? {label: 'Email it', run: () => { flush(); exportDoc(d, 'email'); }} : null, {label: 'Copy text', run: async () => { flush(); try { await navigator.clipboard.writeText(plain(d.body)); ctx.toast('Copied.'); } catch (e) { ctx.toast('Couldn’t copy.'); } }}]));
    top.append(back, statusEl, el('span', 'grow'), share, more);
    const paper = el('div', 'paper');
    const meta = el('div', 'ed-meta');
    const icon = el('button', 'ed-icon', d.icon || '📄'); icon.type = 'button'; icon.setAttribute('aria-label', 'Change icon');
    icon.addEventListener('click', () => { const m = menu(icon, []); m.classList.add('emoji'); m.replaceChildren(...ICONS.map((i) => { const b = el('button', '', i); b.type = 'button'; b.addEventListener('click', async () => { m.remove(); icon.textContent = i; await patch(d, {icon: i}, true); }); return b; })); });
    const folder = el('button', 'chip-s btnlike', d.workspace + ' ▾'); folder.type = 'button';
    folder.addEventListener('click', () => menu(folder, SPACES.map((s) => ({label: (d.workspace === s ? '✓ ' : '') + s, run: async () => { await patch(d, {workspace: s}, true); folder.textContent = s + ' ▾'; }}))));
    countEl = el('span', 'muted small');
    meta.append(icon, folder, countEl);
    const title = el('input', 'ed-title'); title.value = d.title; title.placeholder = 'Untitled'; title.setAttribute('aria-label', 'Title');
    title.addEventListener('input', queue);
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); ed.focus(); } });
    ed = el('div', 'ed-body'); ed.contentEditable = 'true'; ed.setAttribute('role', 'textbox'); ed.setAttribute('aria-multiline', 'true'); ed.setAttribute('aria-label', 'Document'); ed.spellcheck = true;
    ed.innerHTML = clean(toHtml(d.body)) || '<p><br></p>';
    ed.dataset.ph = 'Start writing, or type / for headings, lists and more';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ignore */ }
    const empty = () => ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,li'));
    empty();
    ed.addEventListener('input', (ev) => {
      empty(); queue();
      if (!slash && ev.inputType === 'insertText' && ev.data === '/') { slashOpen(); return; }
      if (slash) { const s = window.getSelection(); const t = (s.anchorNode && s.anchorNode.textContent) || ''; const typed = t.slice(slash.start, s.anchorOffset); if (!typed.startsWith('/') || s.anchorNode !== slash.node) slashClose(); else { slash.q = typed.slice(1); slash.i = 0; slashDraw(); } }
    });
    ed.addEventListener('keydown', (e) => {
      if (slash) {
        const n = slashItems().length;
        if (e.key === 'ArrowDown') { slash.i = (slash.i + 1) % Math.max(1, n); slashDraw(); e.preventDefault(); return; }
        if (e.key === 'ArrowUp') { slash.i = (slash.i - 1 + n) % Math.max(1, n); slashDraw(); e.preventDefault(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); slashPick(); return; }
        if (e.key === 'Escape') { slashClose(); e.preventDefault(); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); link(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); ctx.toast('Saved.'); }
      if (e.key === 'Tab' && curLi()) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
      // Markdown shortcuts at the start of a line
      if (e.key === ' ') {
        const b = curBlock(); if (!b || !/^(P|DIV)$/.test(b.tagName)) return;
        const s = window.getSelection(); const before = (s.anchorNode.textContent || '').slice(0, s.anchorOffset);
        const map = {'#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '1.': 'ol', '[]': 'todo', '[ ]': 'todo', '>': 'blockquote', '```': 'pre'};
        if (map[before] && b.textContent === before) { e.preventDefault(); b.innerHTML = '<br>'; const r = document.createRange(); r.setStart(b, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); setBlock(map[before]); }
      }
      if (e.key === 'Enter') { const b = curBlock(); if (b && b.textContent === '---' && /^(P|DIV)$/.test(b.tagName)) { e.preventDefault(); b.remove(); setBlock('hr'); } }
    });
    // Tick a to-do by tapping its box
    ed.addEventListener('mousedown', (e) => {
      const li = e.target.closest && e.target.closest('ul.todo > li');
      if (li && e.clientX - li.getBoundingClientRect().left < 26) { e.preventDefault(); li.classList.toggle('done'); queue(); }
    });
    ed.addEventListener('paste', (e) => {
      const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain');
      e.preventDefault();
      if (h) document.execCommand('insertHTML', false, clean(h));
      else document.execCommand('insertText', false, t);
    });
    ed.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a'); if (a && (e.metaKey || e.ctrlKey)) window.open(a.href, '_blank', 'noopener'); });
    ed.addEventListener('blur', () => { setTimeout(slashClose, 150); flush(); });
    document.addEventListener('selectionchange', () => { if (document.activeElement === ed) refreshBar(); });
    paper.append(meta, title, ed, el('p', 'muted small ed-tip', 'Tips: type / to insert anything. Start a line with # for a heading, - for a list, [] for a to-do, > for a quote. Tap a to-do’s box to tick it. ⌘K adds a link.'));
    wrap.append(top, toolbar(), paper);
    setTimeout(updateCount, 0);
    return wrap;
  }

  function draw() {
    if (!ctx || !$('docs-root')) return;
    if (S.open && !(ctx.D.docs || []).includes(S.open)) { const f = (ctx.D.docs || []).find((x) => x.id === S.open.id); S.open = f || null; }
    if (S.open) {
      // Don't rebuild the editor while it is open (keeps the cursor where it is)
      if ($('docs-root').querySelector('.editor') && ed && $('docs-root').contains(ed) && ed._doc === S.open.id) return;
      $('docs-root').replaceChildren(editor(S.open)); ed._doc = S.open.id;
    } else list();
  }
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  window.HQ_DOCS = {
    render(c) { ctx = c; draw(); },
    create: (tpl, space) => create(tpl, space),
    open: (d) => { const b = document.querySelector('.tab[data-tab="docs"]'); if (b) b.click(); open(d); },
    templates: T
  };
})();
