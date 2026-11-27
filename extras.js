// Everything added in v12: Today panels (inbox, calendar, follow-ups, week),
// People pipeline, Docs, Ideas, Automations, Subscriptions, Settings,
// the + quick-add button, ⌘K search and the guide.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  const money = (v, dp) => (v < 0 ? '−$' : '$') + Math.abs(+v || 0).toLocaleString('en-CA', {minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0});
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const dayName = (s) => parse(s).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'});
  const fill = (id, ...kids) => { const n = $(id); if (n) n.replaceChildren(...kids); };
  const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let ctx = null;

  async function save(table, row, match) {
    const q = match ? ctx.sb.from(table).update(row).match(match) : ctx.sb.from(table).insert(Object.assign({user_id: ctx.user.id}, row));
    const {error} = await q;
    if (error) { ctx.toast('Not saved: ' + error.message); return false; }
    return true;
  }
  const go = (tab) => { const b = document.querySelector('.tab[data-tab="' + tab + '"]'); if (b) b.click(); };

  // =========================================================
  // TODAY: inbox, calendar, follow-ups, this week
  // =========================================================
  function inboxPanel(c) {
    ctx = c || ctx; if (!ctx) return;
    const box = $('today-inbox'); if (!box) return;
    const S = window.HQ_MAIL ? window.HQ_MAIL.summary() : null;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Inbox'));
    const out = [head];
    if (!S || !S.ready || !S.connected) {
      head.append(el('span', 'muted small', S && S.ready ? 'Not connected' : 'Not set up'));
      const p = el('p', 'muted small', S && S.ready ? 'Connect Google to see the emails that matter.' : 'Set up Gmail once and important mail shows up here.');
      out.push(p, btn(S && S.ready ? 'Connect Google' : 'Set up', 'mini', () => go('mail')));
    } else {
      head.append(el('span', 'muted small', S.important.length + ' important unread' + (S.drafts ? ' · ' + S.drafts + ' drafts ready' : '')));
      const ul = el('ul', 'mlist compact');
      if (!S.important.length) ul.append(el('li', 'muted', 'Nothing important waiting. Nice.'));
      S.important.slice(0, 3).forEach((m) => {
        const li = el('li', 'mrow unread'); const b = el('button', 'mrow-b'); b.type = 'button';
        const top = el('div', 'mrow-top'); top.append(el('span', 'dot', ''), el('span', 'mfrom', m.who.name), el('span', 'mtime', U.ago(m.date)));
        const sub = el('div', 'msub'); m.tags.forEach((t) => sub.append(el('span', 'tag t-' + t.toLowerCase(), t))); sub.append(document.createTextNode(m.subject));
        b.append(top, sub); b.addEventListener('click', () => window.HQ_MAIL.open(m)); li.append(b); ul.append(li);
      });
      out.push(ul);
      if (S.important.length > 3 || S.drafts) out.push(btn('Open Mail', 'mini', () => go('mail')));
    }
    box.replaceChildren(...out);
    calPanel();
  }
  function calPanel() {
    const box = $('today-cal'); if (!box || !ctx) return;
    const items = window.HQ_CAL ? window.HQ_CAL.upcoming() : [];
    const g = window.HQ_MAIL && window.HQ_MAIL.google;
    box.hidden = !(g && g.connected()) && !items.length;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Calendar'), el('span', 'muted small', items.length ? 'Next up' : ''));
    const ul = el('ul', 'items');
    if (!items.length) ul.append(el('li', 'muted', 'Nothing else on your calendar today or tomorrow.'));
    items.forEach((i) => { const li = el('li', 'item'); const b = el('button', 'linkrow'); b.type = 'button'; b.append(el('span', 't-time', i.when), el('span', 'item-t', i.title)); b.addEventListener('click', () => window.HQ_CAL.edit(i.e)); li.append(b); ul.append(li); });
    box.replaceChildren(head, ul, btn('Open calendar', 'mini', () => go('calendar')));
  }
  function followPanel() {
    const box = $('today-follow'); if (!box) return;
    const t = today();
    const due = (ctx.D.leads || []).filter((l) => l.next_date && l.next_date <= t && !/signed|lost/.test(l.stage)).sort((a, b) => (a.next_date < b.next_date ? -1 : 1));
    box.hidden = !due.length;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Follow-ups due'), el('span', 'muted small', due.length + ''));
    const ul = el('ul', 'items');
    due.slice(0, 5).forEach((l) => {
      const li = el('li', 'item');
      const b = el('button', 'linkrow'); b.type = 'button';
      b.append(el('span', 'pill ' + (l.next_date < t ? 'high' : 'med'), l.next_date < t ? 'late' : 'today'), el('span', 'item-t', l.business + (l.next_step ? ' · ' + l.next_step : '')));
      b.addEventListener('click', () => leadForm(l));
      li.append(b);
      if (l.email && window.HQ_MAIL) li.append(btn('Email', 'mini', () => window.HQ_MAIL.compose({to: l.email, subject: ''})));
      ul.append(li);
    });
    box.replaceChildren(head, ul);
  }
  function weekStrip() {
    const D = ctx.D, t = parse(today());
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const m0 = ymd(mon);
    const focus = (D.focus || []).filter((f) => f.date >= m0).reduce((s, f) => s + (+f.minutes || 0), 0);
    const gym = (D.gym || []).filter((g) => g.date >= m0).length;
    const outr = (D.outreach || []).filter((o) => o.date >= m0).reduce((s, o) => s + (+o.contacted || 0), 0);
    const school = (D.tasks || []).filter((r) => r.done && r.done_at && ymd(new Date(r.done_at)) >= m0).length;
    const cell = (k, v, n, pct) => { const c = el('div', 'wk'); c.append(el('span', 'k', k), el('b', '', v)); if (n) c.append(el('span', 'n', n)); const bar = el('div', 'bar'); const i = el('i'); i.style.width = Math.min(100, pct) + '%'; bar.append(i); c.append(bar); return c; };
    const P = window.HQ_PREFS, gF = +(P ? P.get('goalFocusHours') : 10) || 10, gG = +(P ? P.get('goalGym') : 5) || 5, gS = +(P ? P.get('goalSchool') : 10) || 10;
    fill('week-strip',
      cell('Focus', Math.floor(focus / 60) + 'h ' + (focus % 60) + 'm', 'goal ' + gF + 'h', focus / (gF * 60) * 100),
      cell('Gym', gym + ' / ' + gG, 'sessions', gym / gG * 100),
      cell('Outreach', outr + ' / ' + ctx.C.G.SALES_TARGETS.contacted, 'contacted', outr / ctx.C.G.SALES_TARGETS.contacted * 100),
      cell('School', school + ' / ' + gS, 'tasks done', Math.min(100, school / gS * 100)));
  }

  // =========================================================
  // PEOPLE: pipeline
  // =========================================================
  const STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['replied', 'Replied'], ['preview', 'Preview sent'], ['signed', 'Signed'], ['lost', 'Lost']];
  const STAGE_COUNTER = {contacted: 'contacted', replied: 'replies', preview: 'previews', signed: 'signed'};
  async function bumpOutreach(stage) {
    const key = STAGE_COUNTER[stage]; if (!key) return;
    const t = today(), D = ctx.D;
    let row = D.outreach.find((r) => r.date === t);
    if (!row) { row = {user_id: ctx.user.id, date: t, contacted: 0, replies: 0, previews: 0, signed: 0}; D.outreach.push(row); }
    row[key] = (+row[key] || 0) + 1;
    await ctx.sb.from('outreach').upsert({user_id: ctx.user.id, date: t, contacted: row.contacted, replies: row.replies, previews: row.previews, signed: row.signed}, {onConflict: 'user_id,date'});
  }
  async function moveLead(l, stage) {
    const was = l.stage; if (was === stage) return;
    l.stage = stage; l.updated_at = new Date().toISOString();
    ctx.rerender();
    if (await save('leads', {stage, updated_at: l.updated_at}, {id: l.id})) {
      const order = STAGES.map((s) => s[0]);
      if (order.indexOf(stage) > order.indexOf(was) && stage !== 'lost') { await bumpOutreach(stage); ctx.toast(l.business + ' → ' + STAGES.find((s) => s[0] === stage)[1] + '. Logged in today’s outreach.'); ctx.rerender(); }
    }
  }
  function pipeline() {
    const box = $('pipeline'); if (!box) return;
    const leads = ctx.D.leads || [], t = today();
    const q = (box.dataset.q || '').toLowerCase();
    const head = el('div', 'panel-h');
    head.append(el('h2', '', 'Pipeline'));
    const hb = el('div', 'hrow');
    const s = el('input', 'mini-search'); s.type = 'search'; s.placeholder = 'Find a lead'; s.value = box.dataset.q || ''; s.setAttribute('aria-label', 'Find a lead');
    s.addEventListener('input', () => { box.dataset.q = s.value; pipeline(); const n = box.querySelector('.mini-search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    hb.append(s, btn('＋ Lead', 'mini primary', () => leadForm()));
    head.append(hb);
    const board = el('div', 'board');
    STAGES.forEach(([k, label]) => {
      const col = el('div', 'col');
      const list = leads.filter((l) => l.stage === k && (!q || (l.business + ' ' + (l.contact || '') + ' ' + (l.town || '')).toLowerCase().includes(q)));
      col.append((() => { const h = el('div', 'col-h'); h.append(el('span', '', label), el('b', '', String(list.length))); return h; })());
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); const l = leads.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (l) moveLead(l, k); });
      list.sort((a, b) => (a.next_date || '9') < (b.next_date || '9') ? -1 : 1).forEach((l) => {
        const c = el('div', 'lead'); c.draggable = true; c.tabIndex = 0;
        c.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', l.id));
        const due = l.next_date && l.next_date <= t && !/signed|lost/.test(k);
        c.append(el('b', '', l.business));
        if (l.contact || l.town) c.append(el('span', 'muted small', [l.contact, l.town].filter(Boolean).join(' · ')));
        if (l.next_step || l.next_date) c.append(el('span', 'small' + (due ? ' due' : ''), (l.next_date ? dayName(l.next_date) + ': ' : '') + (l.next_step || '')));
        const acts = el('div', 'lead-a');
        const i = STAGES.findIndex((x) => x[0] === k);
        if (i > 0) acts.append(btn('‹', 'mini', (e) => { e.stopPropagation(); moveLead(l, STAGES[i - 1][0]); }));
        if (l.email && window.HQ_MAIL) acts.append(btn('✉', 'mini', (e) => { e.stopPropagation(); window.HQ_MAIL.compose({to: l.email}); }));
        if (i < 4) acts.append(btn('›', 'mini', (e) => { e.stopPropagation(); moveLead(l, STAGES[i + 1][0]); }));
        acts.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-label', b.textContent === '‹' ? 'Move back' : b.textContent === '›' ? 'Move forward' : 'Email'));
        c.append(acts);
        c.addEventListener('click', () => leadForm(l));
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') leadForm(l); });
        col.append(c);
      });
      board.append(col);
    });
    const tip = el('p', 'muted small', leads.length ? 'Drag a card or use ‹ › to move it. Moving a lead forward also counts it in today’s outreach.' : 'No leads yet. Tap ＋ Lead, or open an email and tap “Add as lead”.');
    box.replaceChildren(head, board, tip);
  }
  function leadForm(l) {
    const isNew = !l || !l.id; l = l || {};
    const f = el('div', 'form');
    f.append(U.field('Business', 'business', 'text', l.business || ''),
      (() => { const r = el('div', 'two'); r.append(U.field('Contact name', 'contact', 'text', l.contact || ''), U.field('Town', 'town', 'text', l.town || '')); return r; })(),
      (() => { const r = el('div', 'two'); r.append(U.field('Email', 'email', 'email', l.email || ''), U.field('Phone', 'phone', 'text', l.phone || '')); return r; })(),
      U.field('Stage', 'stage', 'select', null, {options: STAGES}),
      (() => { const r = el('div', 'two'); r.append(U.field('Next step', 'next_step', 'text', l.next_step || '', {placeholder: 'Call back, send preview…'}), U.field('When', 'next_date', 'date', l.next_date || '')); return r; })(),
      U.field('Notes', 'note', 'textarea', l.note || '', {rows: 3}));
    f.querySelector('[name=stage]').value = l.stage || 'new';
    const ok = btn('Save', 'primary'), acts = [ok];
    if (!isNew && l.email && window.HQ_MAIL) acts.push(btn('Email', '', () => { sh.close(); window.HQ_MAIL.compose({to: l.email}); }));
    if (!isNew && l.phone) { const a = el('a', 'btn', 'Call'); a.href = 'tel:' + l.phone.replace(/[^\d+]/g, ''); acts.push(a); }
    if (!isNew && window.HQ_CAL) acts.push(btn('Book a call', '', () => { sh.close(); const s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 0, 0, 0); window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 1800000), attendees: l.email || '', notes: 'Call with ' + (l.contact || l.business)}); setTimeout(() => { const t = document.querySelector('.evform [name=title]'); if (t) t.value = 'Call: ' + l.business; }, 60); }));
    const del = isNew ? null : btn('Delete', 'ghost');
    if (del) acts.push(del);
    const sh = U.sheet(isNew ? 'New lead' : l.business, f, {actions: acts});
    ok.addEventListener('click', async () => {
      const v = U.values(f);
      if (!v.business) { ctx.toast('Add the business name.'); return; }
      const row = {business: v.business, contact: v.contact || null, town: v.town || null, email: v.email || null, phone: v.phone || null, stage: v.stage, next_step: v.next_step || null, next_date: v.next_date || null, note: v.note || null, updated_at: new Date().toISOString()};
      ok.disabled = true;
      if (isNew) {
        const {data, error} = await ctx.sb.from('leads').insert(Object.assign({user_id: ctx.user.id}, row)).select().single();
        if (error) { ok.disabled = false; ctx.toast('Not saved: ' + error.message); return; }
        ctx.D.leads.push(data); if (STAGE_COUNTER[v.stage]) await bumpOutreach(v.stage);
      } else {
        const prev = l.stage;
        if (!(await save('leads', row, {id: l.id}))) { ok.disabled = false; return; }
        Object.assign(l, row);
        const order = STAGES.map((s) => s[0]);
        if (order.indexOf(v.stage) > order.indexOf(prev) && v.stage !== 'lost') await bumpOutreach(v.stage);
      }
      sh.close(); ctx.toast('Saved.'); ctx.rerender();
    });
    if (del) del.addEventListener('click', async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Tap again to delete'; return; }
      const {error} = await ctx.sb.from('leads').delete().eq('id', l.id);
      if (error) { ctx.toast(error.message); return; }
      ctx.D.leads = ctx.D.leads.filter((x) => x.id !== l.id); sh.close(); ctx.rerender();
    });
  }

  // =========================================================
  // GOALS: ideas
  // =========================================================
  function ideas() {
    const box = $('ideas'); if (!box) return;
    const list = (ctx.D.notes || []).filter((n) => !n.done).sort((a, b) => (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1));
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Ideas'), el('span', 'muted small', list.length + ' saved'));
    const add = el('form', 'hrow');
    const inp = el('input', 'mini-search'); inp.placeholder = 'Got an idea? Type it and press Enter'; inp.setAttribute('aria-label', 'New idea');
    add.append(inp, btn('Save', 'mini primary'));
    add.addEventListener('submit', async (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ''; await addIdea(v); });
    const ul = el('ul', 'items');
    if (!list.length) ul.append(el('li', 'muted', 'Business ideas, things to try, stuff to remember. Tap + anywhere to add one fast.'));
    list.forEach((n) => {
      const li = el('li', 'item');
      li.append(el('span', 'idea-t' + (n.pinned ? ' pinned' : ''), n.text));
      const pin = btn(n.pinned ? '★' : '☆', 'mini', async () => { n.pinned = !n.pinned; await save('notes', {pinned: n.pinned}, {id: n.id}); ideas(); }); pin.setAttribute('aria-label', n.pinned ? 'Unpin' : 'Pin');
      const done = btn('Done', 'mini', async () => { n.done = true; await save('notes', {done: true}, {id: n.id}); ideas(); });
      li.append(pin, done); ul.append(li);
    });
    box.replaceChildren(head, add, ul);
  }
  async function addIdea(text) {
    const {data, error} = await ctx.sb.from('notes').insert({user_id: ctx.user.id, kind: 'idea', text}).select().single();
    if (error) { ctx.toast('Not saved: ' + error.message); return; }
    ctx.D.notes.push(data); ideas(); ctx.toast('Idea saved (Goals tab).');
  }

  // =========================================================
  // SYSTEM: automations, subscriptions, settings
  // =========================================================
  const AUTOMATIONS = [
    ['Morning HQ refresh', 'Every day · 5:37 am', 'Pulls Etsy, Stripe, Gmail and your TFSA into HQ, adds what needs you, writes draft replies in Gmail, and sends you a short update.', ['Etsy', 'Stripe', 'Gmail', 'Investments', 'HQ']],
    ['Etsy shop check', 'Every day', 'Reads your Etsy stats into the “Etsy shop stats” doc. Needs your Mac awake with the Claude app open.', ['Etsy']],
    ['Auto-shop reply watch', 'Each morning until Dec 24', 'Looks for replies from the 8 auto shops about parts invoices and pins them as high priority.', ['Invoice research']]
  ];
  function lastRun() {
    const log = ctx.D.log || [];
    return log.length ? log[0].date : null;
  }
  function automations() {
    const box = $('auto-root'); if (!box) return;
    const log = ctx.D.log || [];
    const out = [el('div', 'page-h')];
    out[0].append(el('h2', 'big', 'Automations'));
    out.push(el('p', 'muted', 'These run on their own in Claude. To add or change one, just ask Claude in chat, e.g. “every Friday, email me my week in numbers”.'));
    AUTOMATIONS.forEach(([name, when, what, areas]) => {
      const p = el('div', 'panel auto');
      const last = log.find((r) => areas.some((a) => (r.area || '').toLowerCase().includes(a.toLowerCase())));
      const h = el('div', 'panel-h'); const t = el('div'); t.append(el('b', '', name), el('div', 'muted small', when));
      const ok = last && (Date.now() - parse(last.date)) < 2.5 * 864e5;
      h.append(t, el('span', 'state ' + (ok ? 'on' : 'warn'), ok ? '● Running' : last ? '● Last seen ' + dayName(last.date) : '● No runs logged yet'));
      p.append(h, el('p', 'muted small', what));
      if (last) p.append(el('p', 'small', 'Latest: ' + last.did));
      out.push(p);
    });
    const p = el('div', 'panel'); p.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Everything Claude did lately')); return h; })());
    const ul = el('ul', 'log');
    log.slice(0, 30).forEach((r) => { const li = el('li'); li.append(el('span', 'k', dayName(r.date) + ' · ' + (r.area || '')), el('div', '', r.did)); ul.append(li); });
    if (!log.length) ul.append(el('li', 'muted', 'Nothing logged yet.'));
    p.append(ul); out.push(p);
    box.replaceChildren(...out);
  }
  function subscriptions() {
    const box = $('subs-root'); if (!box) return;
    const D = ctx.D, m = today().slice(0, 7);
    const biz = (D.costs || []).filter((c) => c.kind === 'business' && !c.once_month);
    const once = (D.costs || []).filter((c) => c.kind === 'business' && c.once_month && c.once_month >= m);
    const pers = (D.expenses || []).filter((e) => e.type === 'recurring');
    const bt = biz.reduce((s, c) => s + (+c.monthly || 0), 0), pt = pers.reduce((s, e) => s + (+e.amount_cad || 0), 0);
    const card = (k, v, n) => { const c = el('div', 'card'); c.append(el('div', 'k', k), el('div', 'v', v)); if (n) c.append(el('div', 'n', n)); return c; };
    const cards = el('div', 'cards'); cards.append(card('Every month', money(bt + pt, 2), 'Business + personal'), card('Every year', money((bt + pt) * 12), 'If nothing changes'), card('Business', money(bt, 2) + '/mo', biz.length + ' tools'), card('Personal', money(pt, 2) + '/mo', pers.length + ' bills'));
    const list = (title, rows, name, amt, note) => {
      const p = el('div', 'panel'); const h = el('div', 'panel-h'); h.append(el('h2', '', title)); p.append(h);
      const ul = el('ul', 'subs');
      if (!rows.length) ul.append(el('li', 'muted', 'None.'));
      rows.sort((a, b) => amt(b) - amt(a)).forEach((r) => { const li = el('li'); const l = el('div', 'grow'); l.append(el('b', '', name(r))); if (note(r)) l.append(el('span', 'muted small', note(r))); li.append(l, el('span', 'num', money(amt(r), 2))); ul.append(li); });
      p.append(ul); return p;
    };
    box.replaceChildren((() => { const h = el('div', 'page-h'); h.append(el('h2', 'big', 'Subscriptions')); return h; })(), cards,
      list('Business tools', biz, (r) => r.item, (r) => +r.monthly || 0, (r) => r.note),
      list('Personal bills', pers, (r) => r.item, (r) => +r.amount_cad || 0, (r) => r.category || r.note),
      once.length ? list('One-time business costs coming up', once, (r) => r.item, (r) => +r.monthly || 0, (r) => r.once_month) : el('span'),
      el('p', 'muted small', 'The morning refresh adds new business charges it finds in Gmail or Stripe. Tell Claude to cancel or change one and it updates here.'));
  }
  function settings() {
    const box = $('settings-root'); if (!box) return;
    const D = ctx.D, S = (k) => { const r = (D.settings || []).find((x) => x.key === k); return r ? r.value : null; };
    const out = [(() => { const h = el('div', 'page-h'); h.append(el('h2', 'big', 'Settings')); return h; })()];
    // Google
    const g = window.HQ_MAIL && window.HQ_MAIL.google;
    const p1 = el('div', 'panel'); p1.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Google (Gmail + Calendar)'), el('span', 'state ' + (g && g.connected() ? 'on' : 'warn'), g && g.connected() ? '● Connected' : g && g.ready() ? '● Not connected' : '● Not set up')); return h; })());
    const cid = U.field('Client ID', 'cid', 'text', S('google_client_id') || '');
    p1.append(cid, (() => { const r = el('div', 'hrow'); r.append(btn('Save', 'mini primary', async () => { const v = cid.querySelector('input').value.trim(); await ctx.sb.from('settings').upsert({user_id: ctx.user.id, key: 'google_client_id', value: v || null}, {onConflict: 'user_id,key'}); const i = D.settings.findIndex((x) => x.key === 'google_client_id'); if (i >= 0) D.settings[i].value = v || null; else D.settings.push({key: 'google_client_id', value: v}); ctx.toast('Saved.'); ctx.rerender(); }), btn('Open setup steps', 'mini', () => go('mail'))); return r; })());
    out.push(p1);
    // Mail rules
    const p2 = el('div', 'panel'); p2.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Mail rules')); return h; })());
    [['mail_vip', 'Always important'], ['mail_mute', 'Muted (go to Low)']].forEach(([k, label]) => {
      const list = S(k) || [];
      p2.append(el('p', 'mgroup', label));
      const ul = el('div', 'chips left');
      if (!list.length) ul.append(el('span', 'muted small', 'None yet. Open an email to add a sender.'));
      list.forEach((e) => { const c = el('button', 'chip on', e + ' ✕'); c.type = 'button'; c.setAttribute('aria-label', 'Remove ' + e); c.addEventListener('click', async () => { const v = list.filter((x) => x !== e); await ctx.sb.from('settings').upsert({user_id: ctx.user.id, key: k, value: v}, {onConflict: 'user_id,key'}); D.settings.find((x) => x.key === k).value = v; settings(); }); ul.append(c); });
      p2.append(ul);
    });
    out.push(p2);
    // App
    const p3 = el('div', 'panel'); p3.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'App')); return h; })());
    p3.append(el('p', 'small', 'Install HQ: on iPhone, open it in Safari → Share → Add to Home Screen. On your Mac, Chrome → ⋮ → Cast, save and share → Install page as app.'));
    p3.append((() => { const r = el('div', 'hrow'); r.append(btn('How HQ works', 'mini', guide), btn('Reload data', 'mini', () => location.reload()), btn('Lock HQ', 'mini', () => $('signout').click())); return r; })());
    out.push(p3);
    box.replaceChildren(...out);
  }

  // =========================================================
  // QUICK ADD (+), SEARCH (⌘K), GUIDE
  // =========================================================
  function quickAdd() {
    const grid = el('div', 'qa');
    const opts = [
      ['✉', 'Email', () => window.HQ_MAIL && window.HQ_MAIL.compose()],
      ['◷', 'Event', () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); window.HQ_CAL && window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 3600000)}); }],
      ['◎', 'Lead', () => leadForm()],
      ['▤', 'Doc', () => window.HQ_DOCS.create()],
      ['✦', 'Idea', () => simple('New idea', [U.field('Idea', 'text', 'textarea', '', {rows: 3})], (v) => v.text && addIdea(v.text))],
      ['⚑', 'Reminder', () => simple('Remind me', [U.field('What', 'title', 'text', ''), U.field('Priority', 'priority', 'select', null, {options: [['med', 'Medium'], ['high', 'High'], ['low', 'Low']]})], async (v) => {
        if (!v.title) return; const row = {id: nid('w'), priority: v.priority, area: 'Me', title: v.title.slice(0, 60), item: v.title, status: 'open'};
        if (await save('attention', row)) { ctx.D.attention.push(Object.assign({user_id: ctx.user.id, created_at: new Date().toISOString()}, row)); ctx.rerender(); ctx.toast('Added to Needs you.'); }
      })],
      ['🏋', 'Gym', () => simple('Log gym', [U.field('Date', 'date', 'date', today()), U.field('Session', 'session', 'select', null, {options: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Cardio'].map((x) => [x, x])}), U.field('Bodyweight (lbs, optional)', 'bw', 'number', '')], async (v) => {
        const row = {date: v.date || today(), session: v.session, bodyweight_lbs: v.bw ? +v.bw : null};
        if (await save('gym', row)) { ctx.D.gym.push(row); ctx.rerender(); ctx.toast('Gym logged. ' + (ctx.D.gym.filter((g) => g.date >= ymd(new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5))).length) + ' this week.'); }
      })],
      ['$', 'Spent', () => simple('Log spending', [U.field('What', 'item', 'text', ''), U.field('Amount (CAD)', 'amt', 'number', ''), U.field('Kind', 'cat', 'select', null, {options: [['Food', 'Food'], ['Fun', 'Fun'], ['Transport', 'Transport'], ['Shopping', 'Shopping'], ['Other', 'Other']]})], async (v) => {
        if (!v.item || !v.amt) return; const row = {id: nid('x'), month: today().slice(0, 7), item: v.item, category: v.cat, type: 'spent', amount_cad: +v.amt, note: 'Logged in HQ ' + today()};
        if (await save('expenses', row)) { ctx.D.expenses.push(row); ctx.rerender(); ctx.toast('Logged ' + money(+v.amt, 2) + '.'); }
      })]
    ];
    let sh;
    opts.forEach(([ic, label, fn]) => { const b = el('button', 'qa-b'); b.type = 'button'; b.append(el('span', 'qa-i', ic), el('span', '', label)); b.addEventListener('click', () => { sh.close(); fn(); }); grid.append(b); });
    sh = U.sheet('Add', grid, {noFocus: true});
  }
  function simple(title, fields, onSave) {
    const f = el('div', 'form'); f.append(...fields);
    const ok = btn('Save', 'primary');
    const sh = U.sheet(title, f, {actions: [ok]});
    ok.addEventListener('click', async () => { ok.disabled = true; await onSave(U.values(f)); sh.close(); });
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') ok.click(); });
  }

  function palette() {
    if (document.querySelector('.pal')) return;
    const w = el('div', 'pal');
    const inp = el('input', 'pal-in'); inp.type = 'search'; inp.placeholder = 'Search HQ or type a command…'; inp.setAttribute('aria-label', 'Search HQ');
    const ul = el('ul', 'pal-list');
    w.append(inp, ul);
    const sh = U.sheet('Search', w, {});
    sh.box.classList.add('pal-sheet');
    const D = ctx.D;
    const base = [
      ...[['today', 'Today'], ['calendar', 'Calendar'], ['mail', 'Mail'], ['sales', 'People & pipeline'], ['docs', 'Docs'], ['school', 'School'], ['money', 'Money'], ['goals', 'Goals'], ['automations', 'Automations'], ['subs', 'Subscriptions'], ['settings', 'Settings']].map(([k, l]) => ({k: 'Go to', t: l, run: () => go(k)})),
      {k: 'Do', t: 'Write an email', run: () => window.HQ_MAIL && window.HQ_MAIL.compose()},
      {k: 'Do', t: 'New calendar event', run: () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 3600000)}); }},
      {k: 'Do', t: 'New lead', run: () => leadForm()},
      {k: 'Do', t: 'New doc', run: () => window.HQ_DOCS.create()},
      {k: 'Do', t: 'Start a focus block', run: () => { go('today'); setTimeout(() => $('focus-next').click(), 50); }},
      {k: 'Do', t: 'Quick add (gym, spending, idea…)', run: quickAdd},
      {k: 'Help', t: 'How HQ works', run: guide},
      {k: 'Go to', t: 'Settings · dark mode, colours, mail, password…', run: () => go('settings')},
      ...(window.HQ_SCHOOL ? window.HQ_SCHOOL.links().map((l) => ({k: 'Open', t: l.name + (l.sub ? ' · ' + l.sub : ''), run: () => window.HQ_SCHOOL.go(l)})) : [])
    ];
    const items = () => base.concat(
      (D.leads || []).map((l) => ({k: 'Lead · ' + l.stage, t: l.business + (l.contact ? ' · ' + l.contact : ''), run: () => leadForm(l)})),
      (D.docs || []).filter((d) => !d.archived).map((d) => ({k: 'Doc · ' + d.workspace, t: d.title, extra: String(d.body).replace(/<[^>]+>/g, ' '), run: () => window.HQ_DOCS.open(d)})),
      (D.attention || []).filter((a) => a.status === 'open').map((a) => ({k: 'Needs you', t: a.title || a.item, extra: a.item, run: () => go('today')})),
      (D.tasks || []).filter((r) => !r.done).map((r) => ({k: 'School · ' + dayName(r.date), t: r.task, run: () => go('school')})),
      (D.clients || []).map((c) => ({k: 'Client', t: c.business, run: () => go('sales')})),
      (D.notes || []).filter((n) => !n.done).map((n) => ({k: 'Idea', t: n.text, run: () => go('goals')}))
    );
    let sel = 0, shown = [];
    const drawList = () => {
      const q = inp.value.trim().toLowerCase();
      shown = items().filter((i) => !q || (i.t + ' ' + i.k + ' ' + (i.extra || '')).toLowerCase().includes(q)).slice(0, 12);
      if (!q) shown = shown.slice(0, 8);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.replaceChildren(...shown.map((i, n) => { const li = el('li', n === sel ? 'on' : ''); const b = el('button'); b.type = 'button'; b.append(el('span', 'pal-k', i.k), el('span', '', i.t)); b.addEventListener('click', () => { sh.close(); i.run(); }); li.append(b); return li; }));
      if (!shown.length) ul.append(el('li', 'muted empty', 'Nothing found.'));
    };
    inp.addEventListener('input', () => { sel = 0; drawList(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); drawList(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); drawList(); e.preventDefault(); }
      if (e.key === 'Enter' && shown[sel]) { sh.close(); shown[sel].run(); }
    });
    drawList();
  }

  function guide() {
    const w = el('div', 'guide');
    [
      ['Today', 'Your plan for the day, the one thing to do next, what needs you, important email, your calendar and follow-ups. Tick things off as you go.'],
      ['Calendar', 'Your Google Calendar with Meadow Park shifts, school and follow-ups on top. Click an empty time to add an event.'],
      ['Mail', 'Your Gmail, sorted: Important first (clients, leads, school, work, money), everything else below. Read, reply, write, archive. Claude’s morning drafts wait at the top for you to check and send.'],
      ['People', 'Your sales pipeline. Every lead is a card: drag it from New → Contacted → Replied → Preview → Signed. Moving it forward counts it in your outreach.'],
      ['Docs', 'Write notes, briefs and scripts, sorted by business. Pick a template, then type / to add headings, lists or to-dos. Saves as you type, and exports to Word, PDF or email.'],
      ['School', 'A card per course with progress and the next test, today’s tasks to tick off, and the week ahead.'],
      ['Money · Goals', 'Income, paycheque split, savings, investments and your goals, plus an Ideas list on Goals.'],
      ['Automations', 'What Claude runs for you each day and everything it did lately.'],
      ['Subscriptions', 'Everything you pay for every month, business and personal.'],
      ['Shortcuts', '＋ button (bottom right): add an email, event, lead, doc, idea, reminder, gym session or spending. ⌘K (or the search box): find anything in HQ. Press ? for this guide.'],
      ['Ask Claude', 'Anything HQ can’t do yet, ask Claude in chat. It can read and change HQ’s data for you.']
    ].forEach(([k, v]) => { const d = el('div', 'g-row'); d.append(el('b', '', k), el('p', '', v)); w.append(d); });
    U.sheet('How HQ works', w, {noFocus: true});
  }

  // Sidebar footer status + badges
  function status() {
    const e = $('engine'); if (!e) return;
    const d = lastRun();
    const fresh = d && (Date.now() - parse(d)) < 1.5 * 864e5;
    e.className = 'engine ' + (fresh ? 'on' : 'warn');
    e.textContent = d ? (fresh ? 'Claude refreshed ' + (d === today() ? 'today' : 'yesterday') : 'Last refresh ' + dayName(d)) : 'Waiting for first refresh';
    const due = (ctx.D.leads || []).filter((l) => l.next_date && l.next_date <= today() && !/signed|lost/.test(l.stage)).length;
    const b = document.querySelector('.tab[data-tab="sales"]'); if (b) b.dataset.badge = due ? String(due) : '';
    const n = document.querySelector('.tab[data-tab="today"]'); if (n) n.dataset.badge = (ctx.D.attention || []).filter((a) => a.status === 'open' && a.priority === 'high').length || '';
  }

  // Keyboard: ⌘K / Ctrl+K search, ? guide, N quick add
  document.addEventListener('keydown', (e) => {
    if (!ctx || $('app').hidden) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
    else if (!typing && !document.querySelector('.sheet-back') && e.key === '?') guide();
    else if (!typing && !document.querySelector('.sheet-back') && e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) quickAdd();
  });

  window.HQ_EXTRAS = {
    render(c) {
      ctx = c;
      [inboxPanel, followPanel, weekStrip, pipeline, ideas, automations, subscriptions, status].forEach((f) => { try { f(c); } catch (e) { console.error(f.name, e); } });
    },
    inboxPanel, leadForm, quickAdd, palette, guide
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t || !ctx) return;
    ({add: quickAdd, search: palette, guide})[t.dataset.act]();
  });
})();
