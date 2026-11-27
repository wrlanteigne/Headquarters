// HQ v23: morning brief, tonight card, client payments, Etsy panel, Today folding
(function () {
  'use strict';
  let ctx = null;
  const $ = (id) => document.getElementById(id);
  const el = (...a) => window.HQ_UI.el(...a);
  const btn = (...a) => window.HQ_UI.btn(...a);
  const money = (n) => '$' + Math.round(+n || 0).toLocaleString('en-CA');
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const nice = (s) => new Date(s + 'T12:00').toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'});
  const clock = (d) => d.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'}).replace('a.m.', 'am').replace('p.m.', 'pm');
  const clock12 = (hm) => { const [h, m] = String(hm).split(':').map(Number); return (h % 12 || 12) + ':' + String(m || 0).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };

  const on = (k) => { try { const tp = window.HQ_PREFS ? window.HQ_PREFS.get('todayPanels') || {} : {}; return tp[k] !== false; } catch (e) { return true; } };
  // ---------- Morning brief ----------
  function brief() {
    const box = $('today-brief'); if (!box) return;
    const b = (ctx.D.briefs || [])[0];
    if (!b || !on('brief')) { box.hidden = true; return; }
    box.hidden = false;
    const fresh = b.date === today();
    const head = el('div', 'panel-h');
    head.append(el('h2', '', fresh ? 'This morning' : 'Last brief'), el('span', 'muted small', fresh ? 'from Claude · ' + clock(new Date(b.created_at || Date.now())) : nice(b.date)));
    const body = el('div', 'brief-body');
    String(b.body || '').split('\n').map((x) => x.trim()).filter(Boolean).forEach((line) => {
      if (/^[-•*]\s+/.test(line)) { let ul = body.lastElementChild; if (!ul || ul.tagName !== 'UL') { ul = el('ul', 'brief-list'); body.append(ul); } ul.append(el('li', '', line.replace(/^[-•*]\s+/, ''))); }
      else body.append(el('p', '', line));
    });
    box.classList.toggle('stale', !fresh);
    box.replaceChildren(head, body);
  }

  // ---------- Tonight ----------
  const TIPS = [
    [/rsa/i, 'Leave Whistler by 8:45 am for BCIT Burnaby. Bring photo ID and a pen.'],
    [/econ|test|exam/i, 'Quick review tonight, then sleep. Have EBUS open and logged in.'],
    [/flight|trip|vallarta|switzerland/i, 'Passport, charger, boarding pass. Check in online.']
  ];
  function tonightItems() {
    const D = ctx.D, now = new Date(), tm = addDays(today(), 1), out = [];
    const sh = (D.shifts || []).find((s) => !s.extra && s.date === tm);
    if (sh) {
      const am = sh.start_time && sh.start_time < '12:00';
      out.push({k: 'shift', t: (am ? 'Morning' : 'Night') + ' shift tomorrow' + (sh.start_time ? ' · ' + clock12(sh.start_time) + (sh.end_time ? '–' + clock12(sh.end_time) : '') : ''),
        n: am ? 'Bed by 8:45 pm, alarm 4:45 am. Pack lunch and work clothes tonight.' : 'Sleep in. Eat a real meal before 2:30 pm; you’re home around 1 am.'});
    }
    (D.countdowns || []).forEach((c) => {
      const at = new Date(c.at), ms = at - now;
      if (ms > 0 && ms < 40 * 3600e3 && ymd(at) === tm) {
        const tip = (TIPS.find(([re]) => re.test(c.title)) || [0, ''])[1];
        out.push({k: c.kind || 'date', t: c.title + ' tomorrow · ' + clock(at), n: tip});
      }
    });
    (D.tasks || []).forEach((t) => { const nm = t.task || t.title || ''; if (t.date === tm && !t.done && /test|exam|quiz/i.test((t.kind || '') + ' ' + nm) && !out.some((o) => /rsa/i.test(o.t) && /rsa/i.test(nm))) out.push({k: 'school', t: (t.unit ? t.unit + ': ' : '') + nm + ' tomorrow', n: 'Review tonight, sleep early.'}); });
    return out;
  }
  function tonight() {
    const box = $('today-tonight'); if (!box) return;
    const items = tonightItems(), h = new Date().getHours();
    if (!items.length || h < 12 || !on('tonight')) { box.hidden = true; return; }
    box.hidden = false;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Tonight'), el('span', 'muted small', 'getting ready for tomorrow'));
    const ul = el('ul', 'items');
    items.forEach((i) => { const li = el('li', 'tn-' + i.k); li.append(el('b', '', i.t)); if (i.n) li.append(el('span', 'muted small', i.n)); ul.append(li); });
    box.replaceChildren(head, ul);
  }

  // ---------- Client payments ----------
  const PAY = {paid: ['Paid', 'ok'], due: ['Due', 'warn'], late: ['Late', 'bad'], failed: ['Card failed', 'bad']};
  function payState(c) {
    let s = (c.pay_status || '').toLowerCase();
    if (!s && c.next_due) s = c.next_due < today() ? 'late' : c.next_due <= addDays(today(), 5) ? 'due' : 'paid';
    return s || 'unknown';
  }
  function remind(c) {
    if (!window.HQ_MAIL || !c.email) { ctx.toast('Add the client’s email first.'); return; }
    const late = payState(c) === 'late';
    const first = (c.contact || '').split(' ')[0] || 'there';
    window.HQ_MAIL.compose({to: c.email,
      subject: (late ? 'Quick reminder: ' : 'Heads up: ') + 'your ' + (c.plan || 'website') + ' plan payment',
      body: 'Hi ' + first + ',\n\n' + (late
        ? 'Just a friendly note that the ' + money(c.monthly) + ' payment for ' + c.business + '’s website' + (c.next_due ? ' (due ' + nice(c.next_due) + ')' : '') + ' hasn’t come through yet. If your card changed, the payment link in your last invoice will let you update it.'
        : 'Your ' + money(c.monthly) + ' payment for ' + c.business + '’s website is coming up' + (c.next_due ? ' on ' + nice(c.next_due) : '') + '. Nothing to do if your card is the same.')
        + '\n\nThanks,\nWilliam\nClearform Studio'});
  }
  function payments() {
    const box = $('payments'); if (!box) return;
    const cl = (ctx.D.clients || []).filter((c) => !/cancel|lost|ended/i.test(c.status || ''));
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Payments'), el('span', 'muted small', 'from Stripe, updated each morning'));
    if (!cl.length) { box.replaceChildren(head, el('p', 'muted small', 'No paying clients yet. When someone signs, add them under Website clients and their payments show up here: paid, due soon or late, with a one-tap reminder email.')); return; }
    const order = {late: 0, failed: 0, due: 1, unknown: 2, paid: 3};
    const ul = el('ul', 'items pay-list');
    cl.slice().sort((a, b) => (order[payState(a)] ?? 2) - (order[payState(b)] ?? 2)).forEach((c) => {
      const s = payState(c), [lab, tone] = PAY[s] || ['No data', ''];
      const li = el('li', 'pay');
      const l = el('div', 'pay-l'); l.append(el('b', '', c.business), el('span', 'muted small', [money(c.monthly) + '/mo', c.last_paid ? 'paid ' + nice(c.last_paid) : '', c.next_due ? 'next ' + nice(c.next_due) : ''].filter(Boolean).join(' · ')));
      const r = el('div', 'pay-r'); r.append(el('span', 'tag pay-' + tone, lab));
      if (s !== 'paid' && c.email) r.append(btn(s === 'late' || s === 'failed' ? 'Send reminder' : 'Heads up', 'mini', () => remind(c)));
      li.append(l, r); ul.append(li);
    });
    const late = cl.filter((c) => /late|failed/.test(payState(c)));
    const owed = late.reduce((a, c) => a + (+c.monthly || 0), 0);
    box.replaceChildren(head, el('p', 'small' + (late.length ? ' due' : ' muted'), late.length ? late.length + ' late · ' + money(owed) + ' waiting' : 'Everyone’s paid up.'), ul);
  }

  // ---------- Etsy ----------
  function etsy() {
    const box = $('etsy'); if (!box) return;
    const rows = ctx.D.etsy || [], e = rows[0], prev = rows[1];
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Etsy · ClearformSheets'), el('span', 'muted small', e ? 'as of ' + nice(e.date) : 'updated each morning'));
    if (!e) { box.replaceChildren(head, el('p', 'muted small', 'No shop numbers yet. The morning refresh copies them in from your “Etsy shop stats” doc: revenue, orders, views and best sellers this month.')); return; }
    const delta = (k) => (prev && prev[k] != null && e[k] != null ? (+e[k] - +prev[k]) : null);
    const card = (k, v, n) => { const c = el('div', 'card'); c.append(el('div', 'k', k), el('div', 'v', v), el('div', 'n', n || '')); return c; };
    const conv = e.visits_month ? Math.round((e.orders_month || 0) / e.visits_month * 1000) / 10 : null;
    const d = delta('orders_month');
    const cards = el('div', 'cards');
    cards.append(card('Revenue this month', money(e.revenue_month), e.orders_month ? 'avg ' + money((+e.revenue_month || 0) / e.orders_month) + ' an order' : ''),
      card('Orders', String(e.orders_month ?? '—'), d ? (d > 0 ? '+' : '') + d + ' since last update' : ''),
      card('Views', (e.views_month ?? '—').toLocaleString('en-CA'), e.visits_month ? e.visits_month.toLocaleString('en-CA') + ' visits' : ''),
      card('Conversion', conv == null ? '—' : conv + '%', e.favorites_month ? e.favorites_month + ' favourites' : 'orders ÷ visits'));
    const parts = [head, cards];
    const L = Array.isArray(e.listings) ? e.listings.slice().sort((a, b) => (+b.sales || 0) - (+a.sales || 0) || (+b.views || 0) - (+a.views || 0)).slice(0, 5) : [];
    if (L.length) {
      parts.push(el('h3', 'sub', 'Best sellers'));
      const ul = el('ul', 'items');
      L.forEach((x) => { const li = el('li', ''); li.append(el('b', '', x.title || x.name || 'Listing'), el('span', 'muted small', [x.sales != null ? x.sales + ' sold' : '', x.views != null ? x.views + ' views' : '', x.price ? money(x.price) : ''].filter(Boolean).join(' · '))); ul.append(li); });
      parts.push(ul);
    }
    if (e.note) parts.push(el('p', 'muted small', e.note));
    box.replaceChildren(...parts);
  }

  // ---------- Shorter Today ----------
  function fold() {
    const f = $('today-more'); if (!f) return;
    const kids = [...f.querySelectorAll(':scope > .fold-body > .panel')];
    const shown = kids.filter((k) => !k.hidden).length;
    f.hidden = !shown;
    const sum = f.querySelector('summary');
    if (sum) sum.textContent = 'More for today · ' + kids.filter((k) => !k.hidden).map((k) => k.dataset.label).join(', ');
    try { if (!f.dataset.init) { f.dataset.init = 1; f.open = localStorage.getItem('hq_today_more') === '1'; f.addEventListener('toggle', () => localStorage.setItem('hq_today_more', f.open ? '1' : '0')); } } catch (e) { /* storage off */ }
  }

  function render(c) {
    ctx = c;
    [brief, tonight, payments, etsy].forEach((f) => { try { f(); } catch (e) { console.error(f.name, e); } });
    setTimeout(fold, 0);
  }
  window.HQ_MORE = {render, tonightItems};
})();
