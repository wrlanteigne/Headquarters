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
  // Keep only safe tags, attributes and styles (stored docs and anything pasted)
  const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUP', 'SUB', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'A', 'DIV', 'SPAN', 'MARK', 'FONT', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH']);
  const STYLES = ['color', 'background-color', 'text-align', 'font-size', 'font-family', 'line-height', 'margin-left', 'padding-left', 'font-weight', 'font-style', 'text-decoration-line'];
  function clean(html) {
    const d = document.createElement('div'); d.innerHTML = html || '';
    (function walk(n) {
      [...n.childNodes].forEach((c) => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1 || !OK.has(c.tagName)) { if (c.nodeType === 1 && !/SCRIPT|STYLE|IFRAME|OBJECT|EMBED|META|LINK/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
        const keep = {};
        if (c.getAttribute('style')) STYLES.forEach((p) => { const v = c.style.getPropertyValue(p); if (v && !/url\(|expression/i.test(v)) keep[p] = v; });
        if (c.tagName === 'FONT') { if (c.getAttribute('color')) keep.color = c.getAttribute('color'); if (c.getAttribute('face')) keep['font-family'] = c.getAttribute('face'); }
        [...c.attributes].forEach((a) => { const ok = (c.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:|tel:)/i.test(a.value)) || (a.name === 'class' && /^(todo|done)$/.test(a.value)) || (/^(colspan|rowspan)$/.test(a.name)); if (!ok) c.removeAttribute(a.name); });
        const css = Object.entries(keep).map(([k, v]) => k + ':' + v).join(';'); if (css) c.setAttribute('style', css);
        if (c.tagName === 'FONT') { const s = document.createElement('span'); if (css) s.setAttribute('style', css); s.append(...c.childNodes); c.replaceWith(s); walk(s); return; }
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
    window.HQ_UI.undoable('Created “' + data.title + '”.', async () => { await ctx.sb.from('docs').delete().eq('id', data.id); ctx.D.docs = ctx.D.docs.filter((x) => x.id !== data.id); if (S.open && S.open.id === data.id) S.open = null; draw(); });
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
    ctx.D.docs.unshift(data); draw();
    window.HQ_UI.undoable('Made a copy.', async () => { await ctx.sb.from('docs').delete().eq('id', data.id); ctx.D.docs = ctx.D.docs.filter((x) => x.id !== data.id); draw(); });
  }
  async function remove(d) {
    const copy = Object.assign({}, d);
    const {error} = await ctx.sb.from('docs').delete().eq('id', d.id);
    if (error) { ctx.toast(error.message); return; }
    ctx.D.docs = ctx.D.docs.filter((x) => x.id !== d.id);
    if (S.open && S.open.id === d.id) S.open = null;
    draw();
    window.HQ_UI.undoable('Deleted “' + (d.title || 'Untitled') + '”.', async () => { const {data, error: e2} = await ctx.sb.from('docs').insert(copy).select().single(); if (e2) throw e2; ctx.D.docs.unshift(data); draw(); });
  }

  // ---------- Menus ----------
  function menu(anchor, items, opts) {
    document.querySelectorAll('.pop').forEach((p) => p.remove());
    const m = el('div', 'pop'); m.setAttribute('role', 'menu');
    items.filter(Boolean).forEach((it) => {
      if (it === '-') { m.append(el('hr')); return; }
      const b = el('button', (it.danger ? 'danger' : '') + (it.on ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.append(el('span', 'pm-l', it.label)); if (it.key) b.append(el('span', 'pm-k', it.key));
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.stopPropagation(); if (it.confirm && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.firstChild.textContent = it.confirm; return; } m.remove(); it.run(); });
      m.append(b);
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.max(8, Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 4)) + 'px';
    const left = opts && opts.left ? r.left : r.right - m.offsetWidth;
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, left)) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
    return m;
  }
  function docMenu(anchor, d) {
    return menu(anchor, [
      {label: d.pinned ? 'Unpin' : 'Pin to top', run: async () => { const was = !!d.pinned; await patch(d, {pinned: !was}); draw(); window.HQ_UI.undoable(was ? 'Unpinned.' : 'Pinned to top.', async () => { await patch(d, {pinned: was}); draw(); }); }},
      {label: 'Duplicate', run: () => duplicate(d)},
      {label: 'Move to…', run: () => moveTo(anchor, d)},
      '-',
      {label: 'Download as Word', run: () => exportDoc(d, 'word')},
      {label: 'Download as Markdown', run: () => exportDoc(d, 'md')},
      {label: 'Print / save as PDF', run: () => exportDoc(d, 'pdf')},
      window.HQ_MAIL ? {label: 'Email it', run: () => exportDoc(d, 'email')} : null,
      '-',
      {label: d.archived ? 'Unarchive' : 'Archive', run: async () => { const was = !!d.archived; await patch(d, {archived: !was}); if (S.open && S.open.id === d.id && d.archived) S.open = null; draw(); window.HQ_UI.undoable(was ? 'Back in your docs.' : 'Archived “' + d.title + '”.', async () => { await patch(d, {archived: was}); draw(); }); }},
      {label: 'Delete', danger: true, confirm: 'Tap again to delete', run: () => remove(d)}
    ]);
  }
  function moveTo(anchor, d) { menu(anchor, SPACES.map((s) => ({label: (d.workspace === s ? '✓ ' : '') + s, run: async () => { const was = d.workspace; await patch(d, {workspace: s}); draw(); window.HQ_UI.undoable('Moved to ' + s + '.', async () => { await patch(d, {workspace: was}); draw(); }); }}))); }
  function exportDoc(d, kind) {
    const html = clean(toHtml(d.body)), name = fileName(d);
    if (kind === 'md') download(name + '.md', 'text/markdown', '# ' + d.title + '\n\n' + toMarkdown(html));
    else if (kind === 'word') download(name + '.doc', 'application/msword', '<html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:12.5pt}ul.todo{list-style:none}ul.todo li:before{content:"☐ "}ul.todo li.done:before{content:"☑ "}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:12px;color:#555}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}</style></head><body><h1>' + esc(d.title) + '</h1>' + html + '</body></html>');
    else if (kind === 'pdf') {
      const w = window.open('', '_blank');
      if (!w) { ctx.toast('Allow pop-ups to print.'); return; }
      w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font:11pt/1.5 Arial,sans-serif;max-width:680px;margin:40px auto;color:#111;padding:0 24px}h1{font-size:26pt;margin:0 0 18px}h2{font-size:15pt;margin:22px 0 6px}h3{font-size:12.5pt}ul.todo{list-style:none;padding-left:4px}ul.todo li:before{content:"☐  "}ul.todo li.done:before{content:"☑  "}ul.todo li.done{color:#888;text-decoration:line-through}blockquote{border-left:3px solid #ddd;margin:0;padding-left:14px;color:#555}a{color:#2563EB}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}</style></head><body><h1>' + esc(d.title) + '</h1>' + html + '<script>onload=()=>{print()}<\/script></body></html>');
      w.document.close();
    } else if (kind === 'email') window.HQ_MAIL.compose({subject: d.title, body: plain(html)});
  }

  // ---------- Home (like the Google Docs start page) ----------
  function thumb(html) {
    const t = el('div', 'thumb'); const pg = el('div', 'thumb-page');
    pg.innerHTML = clean(toHtml(html)); t.append(pg); return t;
  }
  function list() {
    const all = ctx.D.docs || [];
    const out = [];
    // Template gallery band
    const band = el('div', 'gd-band');
    const bh = el('div', 'gd-band-h'); bh.append(el('span', '', 'Start a new document'));
    band.append(bh);
    const tp = el('div', 'gd-tpls');
    T.forEach((t) => {
      const b = el('button', 'gd-tpl'); b.type = 'button'; b.setAttribute('aria-label', 'New ' + t.name);
      const th = t.name === 'Blank' ? (() => { const x = el('div', 'thumb blank'); x.append(el('span', 'plus', '+')); return x; })() : thumb('<h1>' + esc(t.title.replace('{today}', todayStr())) + '</h1>' + t.html.replace(/\{today\}/g, todayStr()));
      b.append(th, el('span', 'gd-tpl-n', t.name));
      b.addEventListener('click', () => create(t)); tp.append(b);
    });
    band.append(tp); out.push(band);

    const wrap = el('div', 'gd-wrap');
    const bar = el('div', 'gd-bar');
    const sIn = el('input', 'gd-search'); sIn.type = 'search'; sIn.placeholder = 'Search docs'; sIn.value = S.q; sIn.setAttribute('aria-label', 'Search docs');
    sIn.addEventListener('input', () => { S.q = sIn.value; drawResults(); });
    bar.append(sIn);
    wrap.append(bar);
    const tabs = el('div', 'utabs');
    ['All'].concat(SPACES).forEach((s) => { const n = all.filter((d) => !d.archived && (s === 'All' || d.workspace === s)).length; const b = el('button', S.space === s ? 'on' : ''); b.type = 'button'; b.append(document.createTextNode(s), el('span', 'cnt', String(n))); b.addEventListener('click', () => { S.space = s; draw(); }); tabs.append(b); });
    wrap.append(tabs);
    const rh = el('div', 'gd-rh');
    rh.append(el('b', '', S.archived ? 'Archived' : 'Recent documents'));
    const right = el('div', 'hrow');
    const sort = el('select', 'sel'); [['edited', 'Last modified'], ['created', 'Newest first'], ['title', 'Title A–Z']].forEach(([v, l]) => { const o = el('option', '', l); o.value = v; sort.append(o); }); sort.value = S.sort; sort.setAttribute('aria-label', 'Sort');
    sort.addEventListener('change', () => { S.sort = sort.value; drawResults(); });
    const viewB = el('div', 'seg'); [['grid', '▦'], ['list', '☰']].forEach(([v, l]) => { const b = el('button', S.view === v ? 'on' : '', l); b.type = 'button'; b.title = v === 'grid' ? 'Grid view' : 'List view'; b.setAttribute('aria-label', b.title); b.addEventListener('click', () => { S.view = v; draw(); }); viewB.append(b); });
    const ar = el('button', 'chip' + (S.archived ? ' on' : ''), 'Archived'); ar.type = 'button'; ar.addEventListener('click', () => { S.archived = !S.archived; draw(); });
    right.append(ar, sort, viewB); rh.append(right);
    wrap.append(rh);
    const results = el('div'); results.id = 'doc-results'; wrap.append(results);
    out.push(wrap);
    $('docs-root').replaceChildren(...out);
    drawResults();
  }
  function drawResults() {
    const box = $('doc-results'); if (!box) return;
    const all = ctx.D.docs || [], q = S.q.toLowerCase().trim();
    let docs = all.filter((d) => d.archived === S.archived && (S.space === 'All' || d.workspace === S.space) && (!q || (d.title + ' ' + plain(d.body)).toLowerCase().includes(q)));
    const key = {edited: (d) => d.updated_at, created: (d) => d.created_at, title: (d) => (d.title || '').toLowerCase()}[S.sort];
    docs.sort((a, b) => ((!!b.pinned) - (!!a.pinned)) || (S.sort === 'title' ? (key(a) < key(b) ? -1 : 1) : (key(a) < key(b) ? 1 : -1)));
    const out = [];
    if (!docs.length) out.push(el('p', 'muted empty', q ? 'No docs match “' + S.q + '”.' : S.archived ? 'Nothing archived.' : 'No documents yet. Pick a template above to start one.'));
    const when = (d) => { const t = new Date(d.updated_at); const today = new Date().toDateString() === t.toDateString(); return today ? t.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'}) : t.toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: t.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'}); };
    if (S.view === 'grid') {
      const g = el('div', 'gd-grid');
      docs.forEach((d) => {
        const c = el('div', 'gd-card'); c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-label', 'Open ' + d.title);
        c.append(thumb(d.body));
        const meta = el('div', 'gd-meta');
        meta.append(el('b', 'gd-t', d.title || 'Untitled'));
        const row = el('div', 'gd-sub'); row.append(el('span', 'gd-ic', d.icon || '📄'), el('span', '', (d.pinned ? '★ ' : '') + 'Opened ' + when(d)));
        const more = el('button', 'dc-more', '⋮'); more.type = 'button'; more.setAttribute('aria-label', 'More for ' + d.title);
        more.addEventListener('click', (e) => { e.stopPropagation(); docMenu(more, d); });
        row.append(more); meta.append(row); c.append(meta);
        c.addEventListener('click', () => open(d)); c.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(d); });
        g.append(c);
      });
      out.push(g);
    } else {
      const t = el('div', 'gd-list');
      const h = el('div', 'gd-lrow head'); h.append(el('span', '', 'Name'), el('span', '', 'Folder'), el('span', '', 'Last modified'), el('span')); t.append(h);
      docs.forEach((d) => {
        const r = el('div', 'gd-lrow'); r.tabIndex = 0; r.setAttribute('role', 'button');
        const n = el('span', 'gd-ln'); n.append(el('span', 'gd-ic', d.icon || '📄'), el('b', '', (d.pinned ? '★ ' : '') + (d.title || 'Untitled')));
        const more = el('button', 'dc-more', '⋮'); more.type = 'button'; more.setAttribute('aria-label', 'More for ' + d.title);
        more.addEventListener('click', (e) => { e.stopPropagation(); docMenu(more, d); });
        r.append(n, el('span', 'muted', d.workspace), el('span', 'muted', when(d)), more);
        r.addEventListener('click', () => open(d)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(d); });
        t.append(r);
      });
      if (docs.length) out.push(t);
    }
    const cl = CLAUDE_DOCS.filter((x) => (S.space === 'All' || x[2] === S.space) && (!q || x[0].toLowerCase().includes(q)));
    if (cl.length && !S.archived) {
      out.push(el('p', 'mgroup', 'Made with Claude · opens in Claude'));
      const u2 = el('div', 'gd-list');
      cl.forEach(([t, url, sp]) => { const a = el('a', 'gd-lrow'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; const n = el('span', 'gd-ln'); n.append(el('span', 'gd-ic', '✦'), el('b', '', t)); a.append(n, el('span', 'muted', sp), el('span', 'muted', 'Claude'), el('span', 'muted', '↗')); u2.append(a); });
      out.push(u2);
    }
    box.replaceChildren(...out);
  }

  // ---------- Editor ----------
  const BLOCKS = [
    ['Normal text', 'p', 'Plain writing'], ['Title', 'h1', 'Big document title'], ['Heading 1', 'h2', 'Section heading'], ['Heading 2', 'h3', 'Sub-heading'], ['Heading 3', 'h4', 'Small heading'],
    ['Checklist', 'todo', '☐ Things to tick off'], ['Bulleted list', 'ul', '• Simple list'], ['Numbered list', 'ol', '1. Steps in order'],
    ['Table', 'table', '3 × 3 grid'], ['Quote', 'blockquote', 'Call out a line'], ['Code', 'pre', 'Monospace block'], ['Divider', 'hr', 'A line across'], ['Date', 'date', 'Today’s date'], ['Link', 'link', 'Add a web link']
  ];
  let ed = null, timer = null, statusEl = null, countEl = null;

  function open(d, fresh) { S.open = d; draw(); window.scrollTo(0, 0); if (fresh) setTimeout(() => { const t = document.querySelector('.ed-title'); if (t) { t.focus(); t.select(); } }, 50); }
  function close() { flush(); S.open = null; draw(); }
  function flush() { if (timer) { clearTimeout(timer); timer = null; save(); } }
  function queue() { if (statusEl) statusEl.textContent = '✎ Editing…'; clearTimeout(timer); timer = setTimeout(() => { timer = null; save(); }, 600); updateCount(); }
  async function save() {
    const d = S.open; if (!d || !ed) return;
    const title = (document.querySelector('.ed-title') || {}).value;
    const row = {title: (title || '').trim() || 'Untitled', body: clean(ed.innerHTML), updated_at: new Date().toISOString()};
    if (statusEl) statusEl.textContent = '↻ Saving…';
    const ok = await patch(d, row, true);
    if (statusEl) statusEl.textContent = ok ? '☁ Saved to HQ' : '⚠ Not saved, check your connection';
  }
  function updateCount() { if (countEl && ed) { const n = words(ed.innerText); countEl.textContent = n + ' word' + (n === 1 ? '' : 's'); } }

  function exec(cmd, val) { restoreSel(); document.execCommand('styleWithCSS', false, /^justify/.test(cmd) ? false : true); document.execCommand(cmd, false, val); queue(); refreshBar(); }
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
    restoreSel();
    if (kind === 'hr') { document.execCommand('insertHTML', false, '<hr><p><br></p>'); }
    else if (kind === 'date') document.execCommand('insertText', false, todayStr());
    else if (kind === 'link') return link();
    else if (kind === 'table') return insertTable(3, 3);
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
  // ---------- Google Docs-style toolbar ----------
  let bar = null;
  const FONTS = [['Arial', 'Arial, sans-serif'], ['Georgia', 'Georgia, serif'], ['Times New Roman', '"Times New Roman", serif'], ['Verdana', 'Verdana, sans-serif'], ['Trebuchet MS', '"Trebuchet MS", sans-serif'], ['Courier New', '"Courier New", monospace'], ['System', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif']];
  const STYLES_ = [['p', 'Normal text'], ['h1', 'Title'], ['h2', 'Heading 1'], ['h3', 'Heading 2'], ['h4', 'Heading 3']];
  const COLORS = ['#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#FFFFFF', '#E60000', '#FF9900', '#FFD700', '#00A933', '#1A73E8', '#9900FF', '#FF00FF', '#B45F06', '#0B5394', '#38761D'];
  const HILITES = ['transparent', '#FFF475', '#FBBC04', '#CCFF90', '#A7FFEB', '#CBF0F8', '#AECBFA', '#D7AEFB', '#FDCFE8', '#F28B82'];
  function blocksInSel() {
    const s = window.getSelection(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0); const out = [];
    [...ed.children].forEach((b) => { if (r.intersectsNode(b)) out.push(b); });
    return out;
  }
  function setSize(pt) {
    restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7');
    ed.querySelectorAll('span[style*="xxx-large"], font[size="7"]').forEach((n) => { if (n.tagName === 'FONT') { const sp = document.createElement('span'); sp.style.fontSize = pt + 'pt'; sp.append(...n.childNodes); n.replaceWith(sp); } else n.style.fontSize = pt + 'pt'; });
    queue(); refreshBar();
  }
  function curSize() { const s = window.getSelection(); let n = s.anchorNode; if (!n || !ed.contains(n)) return 11; if (n.nodeType === 3) n = n.parentNode; return Math.round(parseFloat(getComputedStyle(n).fontSize) * 0.75); }
  function curFont() { const s = window.getSelection(); let n = s.anchorNode; if (!n || !ed.contains(n)) return 'Arial'; if (n.nodeType === 3) n = n.parentNode; const f = getComputedStyle(n).fontFamily.split(',')[0].replace(/["']/g, '').trim(); const m = FONTS.find(([l]) => l === f); return m ? m[0] : (/apple|blink|segoe|system/i.test(f) ? 'System' : f); }
  function palette(anchor, colors, onPick, label) {
    document.querySelectorAll('.pop').forEach((p) => p.remove());
    const m = el('div', 'pop palette'); m.append(el('p', 'mgroup', label));
    const g = el('div', 'pal-g');
    colors.forEach((c) => { const b = el('button', 'pal-c' + (c === 'transparent' ? ' none' : '')); b.type = 'button'; b.style.background = c === 'transparent' ? '#fff' : c; b.title = c === 'transparent' ? 'None' : c; b.setAttribute('aria-label', b.title); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { m.remove(); onPick(c); }); g.append(b); });
    m.append(g); document.body.append(m);
    const r = anchor.getBoundingClientRect(); m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.min(window.innerWidth - m.offsetWidth - 8, r.left) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
  }
  // Always remember where the cursor was in the page, so toolbar boxes and menus act there
  let savedRange = null;
  const keepSel = () => { const s = window.getSelection(); if (ed && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
  document.addEventListener('selectionchange', keepSel);
  const restoreSel = () => { if (!ed) return; if (document.activeElement === ed) { keepSel(); return; } ed.focus({preventScroll: true}); if (savedRange && ed.contains(savedRange.startContainer)) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
  function setLineHeight(v) { const bs = blocksInSel(); (bs.length ? bs : [curBlock()]).filter(Boolean).forEach((b) => { b.style.lineHeight = v; }); queue(); }
  function clearFormat() { restoreSel(); document.execCommand('removeFormat'); blocksInSel().forEach((b) => { b.style.removeProperty('line-height'); b.style.removeProperty('text-align'); b.style.removeProperty('margin-left'); }); queue(); refreshBar(); }
  function insertTable(rows, cols) {
    restoreSel();
    const t = document.createElement('table'); t.innerHTML = '<tbody>' + ('<tr>' + '<td><br></td>'.repeat(cols) + '</tr>').repeat(rows) + '</tbody>';
    const p = document.createElement('p'); p.innerHTML = '<br>';
    const b = curBlock();
    if (b && b.parentNode === ed) { if (b.tagName === 'P' && !b.textContent.trim()) b.replaceWith(t); else b.after(t); } else ed.append(t);
    t.after(p); caret(t.querySelector('td'), true); queue();
  }
  function zoomSet(z) { localStorage.setItem('hq_doc_zoom', z); const p = document.querySelector('.gd-page'); if (p) p.style.zoom = z / 100; const zs = bar && bar.querySelector('.tb-zoom'); if (zs) zs.value = z; }

  function refreshBar() {
    if (!bar || !ed) return;
    const b = curBlock(); const tag = b ? b.tagName : 'P';
    bar.querySelectorAll('[data-k]').forEach((x) => {
      const k = x.dataset.k; let on = false;
      try { if (/^(bold|italic|underline|strikeThrough|justifyLeft|justifyCenter|justifyRight|justifyFull)$/.test(k)) on = document.queryCommandState(k); } catch (e) { /* ignore */ }
      if (k === 'ul') on = tag === 'UL' && !b.classList.contains('todo'); if (k === 'ol') on = tag === 'OL'; if (k === 'todo') on = tag === 'UL' && b.classList.contains('todo');
      x.classList.toggle('on', on);
    });
    const st = bar.querySelector('.tb-style'); if (st) { const m = STYLES_.find(([t]) => t.toUpperCase() === tag); st.value = m ? m[0] : 'p'; }
    const fs = bar.querySelector('.tb-size'); if (fs && document.activeElement !== fs) fs.value = curSize();
    const ff = bar.querySelector('.tb-font'); if (ff) { const f = curFont(); if (![...ff.options].some((o) => o.value === f)) { const o = el('option', '', f); o.value = f; ff.append(o); } ff.value = f; }
  }
  function toolbar(d) {
    bar = el('div', 'gd-tools'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Formatting');
    const B = (k, html, title, fn) => { const b = el('button', 'tb'); b.innerHTML = html; b.type = 'button'; b.dataset.k = k; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); return b; };
    const sep = () => el('span', 'tb-sep');
    const SEL = (cls, opts, title, onChange) => { const s = el('select', 'tb-sel ' + cls); s.title = title; s.setAttribute('aria-label', title); opts.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; s.append(o); }); s.addEventListener('mousedown', keepSel); s.addEventListener('change', () => { restoreSel(); onChange(s.value); }); return s; };
    const ic = (p) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
    const zoom = SEL('tb-zoom', [[50, '50%'], [75, '75%'], [90, '90%'], [100, '100%'], [125, '125%'], [150, '150%'], [200, '200%']], 'Zoom', (v) => zoomSet(+v));
    zoom.value = localStorage.getItem('hq_doc_zoom') || 100;
    const size = el('input', 'tb-size'); size.type = 'number'; size.min = 6; size.max = 96; size.value = 11; size.title = 'Font size'; size.setAttribute('aria-label', 'Font size');
    size.addEventListener('mousedown', keepSel);
    size.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); restoreSel(); setSize(Math.max(6, Math.min(96, +size.value || 11))); } });
    size.addEventListener('change', () => { restoreSel(); setSize(Math.max(6, Math.min(96, +size.value || 11))); });
    const color = B('color', '<span class="tb-a">A</span>', 'Text colour', () => { keepSel(); palette(color, COLORS, (c) => { restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, c); queue(); }, 'Text colour'); });
    const hil = B('hilite', ic('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'), 'Highlight colour', () => { keepSel(); palette(hil, HILITES, (c) => { restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, c); queue(); }, 'Highlight'); });
    const align = (k, title, path) => B(k, ic(path), title, () => exec(k));
    const spacing = B('spacing', ic('<path d="M11 6h10M11 12h10M11 18h10M4 8l2-3 2 3M4 16l2 3 2-3M6 5v14"/>'), 'Line spacing', () => { keepSel(); menu(spacing, [['1', 'Single'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', 'Double']].map(([v, l]) => ({label: l, run: () => { restoreSel(); setLineHeight(v); }})), {left: true}); });
    bar.append(
      B('undo', ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), 'Undo (⌘Z)', () => exec('undo')),
      B('redo', ic('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'), 'Redo (⇧⌘Z)', () => exec('redo')),
      B('print', ic('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'), 'Print (⌘P)', () => { flush(); exportDoc(d, 'pdf'); }),
      zoom, sep(),
      SEL('tb-style', STYLES_, 'Styles', (v) => setBlock(v)), sep(),
      SEL('tb-font', FONTS.map(([l]) => [l, l]), 'Font', (v) => { const f = FONTS.find(([l]) => l === v); document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, f ? f[1] : v); queue(); }), sep(),
      B('smaller', '−', 'Decrease font size', () => setSize(Math.max(6, curSize() - 1))), size, B('bigger', '+', 'Increase font size', () => setSize(Math.min(96, curSize() + 1))), sep(),
      B('bold', '<b>B</b>', 'Bold (⌘B)', () => exec('bold')), B('italic', '<i>I</i>', 'Italic (⌘I)', () => exec('italic')), B('underline', '<u>U</u>', 'Underline (⌘U)', () => exec('underline')), color, hil, sep(),
      B('link', ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'), 'Insert link (⌘K)', () => link()), sep(),
      align('justifyLeft', 'Left align', '<path d="M3 6h18M3 12h12M3 18h16"/>'), align('justifyCenter', 'Centre align', '<path d="M3 6h18M6 12h12M4 18h16"/>'), align('justifyRight', 'Right align', '<path d="M3 6h18M9 12h12M5 18h16"/>'), align('justifyFull', 'Justify', '<path d="M3 6h18M3 12h18M3 18h18"/>'),
      spacing, sep(),
      B('todo', ic('<path d="m3 6 2 2 3-3M3 13l2 2 3-3"/><path d="M12 7h9M12 14h9M12 20h9"/>'), 'Checklist (⌘⇧9)', () => setBlock('todo')),
      B('ul', ic('<circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/><path d="M9 6h12M9 12h12M9 18h12"/>'), 'Bulleted list (⌘⇧8)', () => setBlock('ul')),
      B('ol', ic('<path d="M10 6h11M10 12h11M10 18h11M4 4v4M3 18h3l-3 3h3M3 12h2"/>'), 'Numbered list (⌘⇧7)', () => setBlock('ol')),
      B('outdent', ic('<path d="M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4"/>'), 'Decrease indent', () => exec('outdent')),
      B('indent', ic('<path d="M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4"/>'), 'Increase indent', () => exec('indent')), sep(),
      B('clear', ic('<path d="M4 7V4h16v3M9 20h6M12 4v16"/><path d="m3 3 18 18"/>'), 'Clear formatting (⌘\\)', clearFormat)
    );
    return bar;
  }
  function menubar(d) {
    const mb = el('div', 'gd-menus');
    const M = (label, items) => { const b = el('button', 'gd-m', label); b.type = 'button'; b.addEventListener('mousedown', (e) => { e.preventDefault(); keepSel(); }); b.addEventListener('click', () => menu(b, items().map((it) => (it === '-' ? it : Object.assign({}, it, {run: () => { restoreSel(); it.run(); }}))), {left: true})); return b; };
    mb.append(
      M('File', () => [
        {label: 'New document', run: () => { flush(); create(T[0], d.workspace); }},
        {label: 'Make a copy', run: () => { flush(); duplicate(d); }},
        '-',
        {label: 'Download as Word (.doc)', run: () => { flush(); exportDoc(d, 'word'); }},
        {label: 'Download as PDF', run: () => { flush(); exportDoc(d, 'pdf'); }},
        {label: 'Download as Markdown', run: () => { flush(); exportDoc(d, 'md'); }},
        window.HQ_MAIL ? {label: 'Email as text', run: () => { flush(); exportDoc(d, 'email'); }} : null,
        '-',
        {label: 'Move to folder…', run: () => moveTo(mb, d)},
        {label: d.pinned ? 'Remove star' : 'Star', run: async () => { await patch(d, {pinned: !d.pinned}, true); const st = document.querySelector('.gd-star'); if (st) { st.textContent = d.pinned ? '★' : '☆'; st.classList.toggle('on', !!d.pinned); } }},
        {label: d.archived ? 'Unarchive' : 'Archive', run: async () => { flush(); const was = !!d.archived; await patch(d, {archived: !was}); S.open = null; draw(); window.HQ_UI.undoable(was ? 'Unarchived.' : 'Archived “' + d.title + '”.', async () => { await patch(d, {archived: was}); draw(); }); }},
        {label: 'Move to trash', danger: true, confirm: 'Click again to delete', run: () => { flush(); remove(d); }},
        '-',
        {label: 'Print', key: '⌘P', run: () => { flush(); exportDoc(d, 'pdf'); }}
      ]),
      M('Edit', () => [
        {label: 'Undo', key: '⌘Z', run: () => exec('undo')}, {label: 'Redo', key: '⇧⌘Z', run: () => exec('redo')}, '-',
        {label: 'Select all', key: '⌘A', run: () => { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }},
        {label: 'Copy all text', run: async () => { try { await navigator.clipboard.writeText(plain(ed.innerHTML)); ctx.toast('Copied.'); } catch (e) { ctx.toast('Couldn’t copy.'); } }}
      ]),
      M('View', () => [
        {label: (outlineOn() ? '✓ ' : '') + 'Show outline', key: '⌘⌥A', run: () => toggleOutline()},
        '-'].concat([75, 90, 100, 125, 150].map((z) => ({label: (+(localStorage.getItem('hq_doc_zoom') || 100) === z ? '✓ ' : '') + 'Zoom ' + z + '%', run: () => zoomSet(z)})))),
      M('Insert', () => [
        {label: 'Link', key: '⌘K', run: () => link()},
        {label: 'Table (3 × 3)', run: () => insertTable(3, 3)}, {label: 'Table (2 × 4)', run: () => insertTable(4, 2)},
        {label: 'Horizontal line', run: () => setBlock('hr')}, {label: 'Date', run: () => setBlock('date')},
        {label: 'Checklist', run: () => setBlock('todo')}, {label: 'Quote', run: () => setBlock('blockquote')}, {label: 'Code block', run: () => setBlock('pre')}
      ]),
      M('Format', () => [
        {label: 'Bold', key: '⌘B', run: () => exec('bold')}, {label: 'Italic', key: '⌘I', run: () => exec('italic')}, {label: 'Underline', key: '⌘U', run: () => exec('underline')},
        {label: 'Strikethrough', key: '⌘⇧X', run: () => exec('strikeThrough')}, {label: 'Superscript', key: '⌘.', run: () => exec('superscript')}, {label: 'Subscript', key: '⌘,', run: () => exec('subscript')}, '-',
        ...STYLES_.map(([v, l], i) => ({label: l, key: '⌘⌥' + i, run: () => setBlock(v)})), '-',
        {label: 'Align left', key: '⌘⇧L', run: () => exec('justifyLeft')}, {label: 'Align centre', key: '⌘⇧E', run: () => exec('justifyCenter')}, {label: 'Align right', key: '⌘⇧R', run: () => exec('justifyRight')}, '-',
        {label: 'Clear formatting', key: '⌘\\', run: clearFormat}
      ]),
      M('Tools', () => [
        {label: 'Word count', key: '⌘⇧C', run: wordCount},
        {label: 'Ask Claude about this doc ↗', run: () => { flush(); window.open('https://claude.ai/new?q=' + encodeURIComponent('Help me improve this document. Title: ' + d.title + '\n\n' + plain(ed.innerHTML).slice(0, 6000)), '_blank', 'noopener'); }}
      ])
    );
    return mb;
  }
  function wordCount() {
    const t = ed.innerText, w = words(t), ch = t.replace(/\n/g, '').length, chn = t.replace(/\s/g, '').length, paras = [...ed.children].filter((b) => b.textContent.trim()).length;
    const box = el('div', 'wc');
    [['Pages', Math.max(1, Math.ceil(w / 500))], ['Words', w], ['Characters', ch], ['Characters excluding spaces', chn], ['Paragraphs', paras], ['Reading time', Math.max(1, Math.round(w / 230)) + ' min']].forEach(([k, v]) => { const r = el('div'); r.append(el('span', '', k), el('b', '', String(v))); box.append(r); });
    U.sheet('Word count', box, {noFocus: true});
  }
  const outlineOn = () => localStorage.getItem('hq_doc_outline') !== '0';
  function toggleOutline() { localStorage.setItem('hq_doc_outline', outlineOn() ? '0' : '1'); const o = document.querySelector('.gd-outline'); if (o) o.hidden = !outlineOn(); }
  function drawOutline() {
    const o = document.querySelector('.gd-outline'); if (!o || !ed) return;
    const hs = [...ed.querySelectorAll('h1,h2,h3,h4')].filter((h) => h.textContent.trim());
    const list = el('div', 'go-list');
    if (!hs.length) list.append(el('p', 'muted small', 'Headings you add appear here.'));
    hs.forEach((h) => { const b = el('button', 'go-' + h.tagName.toLowerCase(), h.textContent.trim().slice(0, 60)); b.type = 'button'; b.addEventListener('click', () => h.scrollIntoView({behavior: 'smooth', block: 'center'})); list.append(b); });
    o.replaceChildren(el('p', 'mgroup', 'Outline'), list);
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
    const wrap = el('div', 'gd-editor');
    // Header: icon, title, star, folder, saved status, export
    const head = el('div', 'gd-head');
    const back = el('button', 'gd-back'); back.type = 'button'; back.title = 'All docs'; back.setAttribute('aria-label', 'Back to all docs'); back.innerHTML = '<span class="gd-logo">' + esc(d.icon || '📄') + '</span>';
    back.addEventListener('click', close);
    const mid = el('div', 'gd-mid');
    const tl = el('div', 'gd-titlerow');
    const title = el('input', 'ed-title gd-title'); title.value = d.title; title.placeholder = 'Untitled document'; title.setAttribute('aria-label', 'Document title');
    title.addEventListener('input', () => { title.style.width = Math.max(8, title.value.length + 2) + 'ch'; queue(); });
    title.style.width = Math.max(8, (d.title || '').length + 2) + 'ch';
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ed.focus(); } });
    const star = el('button', 'gd-star' + (d.pinned ? ' on' : ''), d.pinned ? '★' : '☆'); star.type = 'button'; star.title = 'Star'; star.setAttribute('aria-label', 'Star');
    star.addEventListener('click', async () => { await patch(d, {pinned: !d.pinned}, true); star.textContent = d.pinned ? '★' : '☆'; star.classList.toggle('on', !!d.pinned); });
    const folder = el('button', 'gd-folder', '📁 ' + d.workspace); folder.type = 'button'; folder.title = 'Move to folder';
    folder.addEventListener('click', () => menu(folder, SPACES.map((s) => ({label: (d.workspace === s ? '✓ ' : '') + s, run: async () => { await patch(d, {workspace: s}, true); folder.textContent = '📁 ' + s; }})), {left: true}));
    const icon = el('button', 'gd-folder', 'Icon'); icon.type = 'button';
    icon.addEventListener('click', () => { const m = menu(icon, [], {left: true}); m.classList.add('emoji'); m.replaceChildren(...ICONS.map((i) => { const b = el('button', '', i); b.type = 'button'; b.addEventListener('click', async () => { m.remove(); await patch(d, {icon: i}, true); back.querySelector('.gd-logo').textContent = i; }); return b; })); });
    statusEl = el('span', 'gd-status', '☁ Saved to HQ');
    tl.append(title, star, folder, icon, statusEl);
    mid.append(tl, menubar(d));
    const right = el('div', 'gd-right');
    countEl = el('span', 'gd-count');
    const share = btn('Export', 'primary', () => menu(share, [{label: 'Download as Word (.doc)', run: () => { flush(); exportDoc(d, 'word'); }}, {label: 'Download as PDF', run: () => { flush(); exportDoc(d, 'pdf'); }}, {label: 'Download as Markdown', run: () => { flush(); exportDoc(d, 'md'); }}, window.HQ_MAIL ? {label: 'Email it', run: () => { flush(); exportDoc(d, 'email'); }} : null, {label: 'Copy text', run: async () => { flush(); try { await navigator.clipboard.writeText(plain(d.body)); ctx.toast('Copied.'); } catch (e) { ctx.toast('Couldn’t copy.'); } }}]));
    right.append(countEl, share);
    head.append(back, mid, right);

    // Canvas: outline + page
    const canvas = el('div', 'gd-canvas');
    const outline = el('aside', 'gd-outline'); outline.hidden = !outlineOn();
    const page = el('div', 'gd-page'); page.style.zoom = (+(localStorage.getItem('hq_doc_zoom') || 100)) / 100;
    ed = el('div', 'ed-body gd-body'); ed.contentEditable = 'true'; ed.setAttribute('role', 'textbox'); ed.setAttribute('aria-multiline', 'true'); ed.setAttribute('aria-label', 'Document'); ed.spellcheck = true;
    ed.innerHTML = clean(toHtml(d.body)) || '<p><br></p>';
    ed.dataset.ph = 'Type @ for nothing yet, or / to insert headings, lists, tables and more';
    ed.dataset.ph = 'Start typing, or type / to insert headings, lists and more';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ignore */ }
    const empty = () => ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,li,table'));
    empty();
    let ot = null;
    ed.addEventListener('input', (ev) => {
      empty(); queue(); clearTimeout(ot); ot = setTimeout(drawOutline, 400);
      if (!slash && ev.inputType === 'insertText' && ev.data === '/') { slashOpen(); return; }
      if (slash) { const s = window.getSelection(); const t = (s.anchorNode && s.anchorNode.textContent) || ''; const typed = t.slice(slash.start, s.anchorOffset); if (!typed.startsWith('/') || s.anchorNode !== slash.node) slashClose(); else { slash.q = typed.slice(1); slash.i = 0; slashDraw(); } }
    });
    ed.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (slash) {
        const n = slashItems().length;
        if (e.key === 'ArrowDown') { slash.i = (slash.i + 1) % Math.max(1, n); slashDraw(); e.preventDefault(); return; }
        if (e.key === 'ArrowUp') { slash.i = (slash.i - 1 + n) % Math.max(1, n); slashDraw(); e.preventDefault(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); slashPick(); return; }
        if (e.key === 'Escape') { slashClose(); e.preventDefault(); return; }
      }
      // Google Docs shortcuts
      if (mod && !e.shiftKey && !e.altKey && k === 'k') { e.preventDefault(); e.stopPropagation(); link(); return; }
      if (mod && !e.shiftKey && k === 's') { e.preventDefault(); flush(); ctx.toast('Saved.'); return; }
      if (mod && !e.shiftKey && k === 'p') { e.preventDefault(); flush(); exportDoc(d, 'pdf'); return; }
      if (mod && k === '\\') { e.preventDefault(); clearFormat(); return; }
      if (mod && e.shiftKey && (e.code === 'Digit7' || e.code === 'Digit8' || e.code === 'Digit9')) { e.preventDefault(); setBlock({Digit7: 'ol', Digit8: 'ul', Digit9: 'todo'}[e.code]); return; }
      if (mod && e.shiftKey && k === 'x') { e.preventDefault(); exec('strikeThrough'); return; }
      if (mod && e.shiftKey && k === 'c') { e.preventDefault(); wordCount(); return; }
      if (mod && e.shiftKey && /^[ler]$/.test(k)) { e.preventDefault(); exec({l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight'}[k]); return; }
      if (mod && e.shiftKey && (e.key === '>' || e.key === '.')) { e.preventDefault(); setSize(curSize() + 1); return; }
      if (mod && e.shiftKey && (e.key === '<' || e.key === ',')) { e.preventDefault(); setSize(Math.max(6, curSize() - 1)); return; }
      if (mod && !e.shiftKey && e.key === '.') { e.preventDefault(); exec('superscript'); return; }
      if (mod && !e.shiftKey && e.key === ',') { e.preventDefault(); exec('subscript'); return; }
      if (mod && e.altKey && /^Digit[0-4]$/.test(e.code)) { e.preventDefault(); setBlock(STYLES_[+e.code.slice(5)][0]); return; }
      if (mod && e.altKey && k === 'a') { e.preventDefault(); toggleOutline(); return; }
      if (e.key === 'Tab') { // move between table cells
        let n = window.getSelection().anchorNode; while (n && n !== ed && n.tagName !== 'TD' && n.tagName !== 'TH') n = n.parentNode;
        if (n && n !== ed && n.tagName) { e.preventDefault(); const cells = [...n.closest('table').querySelectorAll('td,th')]; const nx = cells[cells.indexOf(n) + (e.shiftKey ? -1 : 1)]; if (nx) caret(nx, true); else if (!e.shiftKey) { const tr = n.parentNode.cloneNode(true); tr.querySelectorAll('td,th').forEach((c) => { c.innerHTML = '<br>'; }); n.closest('tbody, table').append(tr); caret(tr.firstChild, true); queue(); } return; }
        if (curLi()) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); return; }
      }
      if (e.key === ' ') {
        const b = curBlock(); if (!b || !/^(P|DIV)$/.test(b.tagName)) return;
        const s = window.getSelection(); const before = (s.anchorNode.textContent || '').slice(0, s.anchorOffset);
        const map = {'#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '1.': 'ol', '[]': 'todo', '[ ]': 'todo', '>': 'blockquote', '```': 'pre'};
        if (map[before] && b.textContent === before) { e.preventDefault(); b.innerHTML = '<br>'; const r = document.createRange(); r.setStart(b, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); setBlock(map[before]); }
      }
      if (e.key === 'Enter') { const b = curBlock(); if (b && b.textContent === '---' && /^(P|DIV)$/.test(b.tagName)) { e.preventDefault(); b.remove(); setBlock('hr'); } }
    });
    ed.addEventListener('mousedown', (e) => {
      const li = e.target.closest && e.target.closest('ul.todo > li');
      if (li && e.clientX - li.getBoundingClientRect().left < 26 * ((+(localStorage.getItem('hq_doc_zoom') || 100)) / 100)) { e.preventDefault(); li.classList.toggle('done'); queue(); }
    });
    ed.addEventListener('paste', (e) => {
      const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain');
      e.preventDefault();
      if (h) document.execCommand('insertHTML', false, clean(h)); else document.execCommand('insertText', false, t);
    });
    ed.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a'); if (a && (e.metaKey || e.ctrlKey)) window.open(a.href, '_blank', 'noopener'); });
    ed.addEventListener('blur', () => { setTimeout(slashClose, 150); flush(); });
    ed.addEventListener('keyup', refreshBar); ed.addEventListener('mouseup', refreshBar);
    page.append(ed);
    const pageWrap = el('div', 'gd-pagewrap'); pageWrap.append(page);
    canvas.append(outline, pageWrap);
    wrap.append(head, toolbar(d), canvas);
    setTimeout(() => { updateCount(); drawOutline(); refreshBar(); }, 0);
    return wrap;
  }

  function draw() {
    if (!ctx || !$('docs-root')) return;
    document.body.classList.toggle('doc-open', !!S.open);
    if (S.open && !(ctx.D.docs || []).includes(S.open)) { const f = (ctx.D.docs || []).find((x) => x.id === S.open.id); S.open = f || null; }
    if (S.open) {
      // Don't rebuild the editor while it is open (keeps the cursor where it is)
      if ($('docs-root').querySelector('.gd-editor') && ed && $('docs-root').contains(ed) && ed._doc === S.open.id) return;
      $('docs-root').replaceChildren(editor(S.open)); ed._doc = S.open.id;
    } else list();
  }
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  window.HQ_DOCS = {
    render(c) { ctx = c; draw(); },
    create: (tpl, space) => create(tpl, space),
    open: (d) => { const b = document.querySelector('.tab[data-tab="docs"]'); if (b) b.click(); open(d); },
    templates: T,
    isOpen: () => !!S.open
  };
})();
