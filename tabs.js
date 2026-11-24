// Draws the Today extras, School, Money, Sales and Goals tabs.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const money = (v, dp) => (v < 0 ? '−$' : '$') + Math.abs(+v || 0).toLocaleString('en-CA', {minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0});
  const day = (s) => s ? window.HQ_CALC.parse(s).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'}) : '—';
  const pct = (n) => (isFinite(n) ? n : 0) + '%';

  function card(k, v, n, opt) {
    const c = el('div', 'card' + (opt && opt.hot ? ' hot' : ''));
    c.append(el('div', 'k', k), el('div', 'v', v));
    if (opt && opt.bar != null) { const b = el('div', 'bar'); const i = el('i'); i.style.width = Math.max(0, Math.min(100, opt.bar)) + '%'; b.append(i); c.append(b); }
    (Array.isArray(n) ? n : [n]).filter(Boolean).forEach((x) => c.append(el('div', 'n', x)));
    return c;
  }
  function table(cols, rows) {
    const w = el('div', 'tw'); const t = el('table', 'tbl');
    const hr = el('tr'); cols.forEach(([label, , num]) => hr.append(el('th', num ? 'num' : '', label)));
    const th = el('thead'); th.append(hr); t.append(th);
    const tb = el('tbody');
    rows.forEach((r) => { const tr = el('tr'); cols.forEach(([, f, num]) => tr.append(el('td', num ? 'num' : '', f(r)))); tb.append(tr); });
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'muted', 'Nothing yet.'); td.colSpan = cols.length; tr.append(td); tb.append(tr); }
    t.append(tb); w.append(t); return w;
  }
  const fill = (id, ...kids) => { const n = $(id); if (n) n.replaceChildren(...kids); };

  // Short daily lines, one per day
  const HYPE = [
    'Start before you feel ready. The feeling shows up after you begin.',
    'Five contacts today beats fifty someday.',
    'Boring reps, every day. That is the whole secret.',
    'You don’t need more time. You need the next block, started on time.',
    'Small business, big habits.',
    'Every quiz you finish is one less thing following you around.',
    'Do the hard thing first. The rest of the day gets easy.',
    'Switzerland is paid for one client at a time.',
    'Discipline is just remembering what you want.',
    'One focused hour beats a distracted day.'
  ];

  function needsItem(r, ctx) {
    const li = el('li', 'item');
    const d = el('details');
    const s = el('summary');
    s.append(el('span', 'pill ' + (r.priority || 'low'), r.priority === 'med' ? 'medium' : r.priority || 'low'), el('span', 'item-t', r.title || r.item));
    d.append(s);
    {
      const body = el('div', 'item-b');
      if (r.area) body.append(el('div', 'k', r.area));
      if (r.item) body.append(el('p', '', r.item));
      if (r.action) { const p = el('p', 'act'); p.append(el('b', '', 'Next step: '), document.createTextNode(r.action)); body.append(p); }
      d.append(body);
    }
    const b = el('button', 'btn mini', 'Done'); b.type = 'button';
    b.addEventListener('click', async () => {
      li.hidden = true;
      const {error} = await ctx.sb.from('attention').update({status: 'done'}).eq('id', r.id);
      if (error) { li.hidden = false; ctx.toast('That wasn’t cleared. Try again.'); } else { r.status = 'done'; ctx.rerender(); }
    });
    li.append(d, b);
    return li;
  }

  async function tapOut(ctx, key, delta) {
    const t = ctx.C.t;
    let row = ctx.D.outreach.find((r) => r.date === t);
    if (!row) { row = {user_id: ctx.user.id, date: t, contacted: 0, replies: 0, previews: 0, signed: 0}; ctx.D.outreach.push(row); }
    row[key] = Math.max(0, (+row[key] || 0) + delta);
    ctx.rerender();
    const {error} = await ctx.sb.from('outreach').upsert({user_id: ctx.user.id, date: t, contacted: row.contacted, replies: row.replies, previews: row.previews, signed: row.signed}, {onConflict: 'user_id,date'});
    if (error) ctx.toast('That wasn’t saved. Try again.');
  }

  function renderToday(ctx) {
    const C = ctx.C, D = ctx.D;
    $('hype').textContent = HYPE[Math.floor(Date.now() / 864e5) % HYPE.length];
    $('pinned').hidden = !C.pinned.length;
    fill('pinned-list', ...C.pinned.map((r) => needsItem(r, ctx)));

    const M = C.mission;
    const dots = el('div', 'dots'); M.last14.forEach((on) => dots.append(el('i', on ? 'on' : '')));
    const m1 = el('div', 'm'); m1.append(el('div', 'k', 'January needs'), el('div', 'mv', M.janClients + ' Grow client' + (M.janClients === 1 ? '' : 's')), el('div', 'n', money(M.janBiz) + ' from websites on top of shifts'));
    const m2 = el('div', 'm'); m2.append(el('div', 'k', 'Outreach streak'), el('div', 'mv', M.streak + ' day' + (M.streak === 1 ? '' : 's')), dots);
    const m3 = el('div', 'm'); m3.append(el('div', 'k', 'Move to Switzerland'), el('div', 'mv', M.moveClients + ' Grow clients'), el('div', 'n', 'to reach $5,000/mo profit'));
    fill('mission', m1, m2, m3);

    const g1 = C.goalProgress[0];
    fill('today-cards',
      card('Income this month', money(C.thisMonthIncome), 'On track for ' + money(C.projectedMonth)),
      card('Goal: $5,000/mo', pct(g1.pct), null, {bar: g1.pct}),
      card('School tasks done', C.school.done + ' / ' + C.school.total, C.school.behind ? C.school.behind + ' late' : 'None late', {bar: C.school.total ? C.school.done / C.school.total * 100 : 0, hot: C.school.behind > 0}),
      card('Next test', C.school.nextTest ? day(C.school.nextTest.date) : '—', C.school.nextTest ? C.school.nextTest.task : ''));

    const o = C.todayOut;
    $('out-done').textContent = o.contacted;
    $('out-bar').style.width = Math.min(100, o.contacted / C.G.DAILY_CONTACT * 100) + '%';
    $('out-week').textContent = C.week.contacted + ' of ' + C.G.SALES_TARGETS.contacted + ' contacted this week';
    fill('out-steps', ...[['contacted', 'Contacted'], ['replies', 'Replies'], ['previews', 'Previews'], ['signed', 'Signed']].map(([k, label]) => {
      const s = el('div', 'step');
      const minus = el('button', 'btn mini', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'One less ' + label.toLowerCase());
      const plus = el('button', 'btn mini', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'One more ' + label.toLowerCase());
      minus.addEventListener('click', () => tapOut(ctx, k, -1)); plus.addEventListener('click', () => tapOut(ctx, k, 1));
      s.append(el('span', 'k', label), minus, el('b', '', String(o[k] || 0)), plus);
      return s;
    }));

    $('needs-count').textContent = C.open.length + ' open · tap for details';
    fill('needs-list', ...(C.open.length ? C.open.map((r) => needsItem(r, ctx)) : [el('li', 'muted', 'Nothing needs you. Nice.')]));
    fill('log-list', ...D.log.slice(0, 12).map((r) => { const li = el('li'); li.append(el('span', 'k', day(r.date) + ' · ' + (r.area || '')), el('div', '', r.did)); return li; }));
  }

  function renderSchoolCards(ctx) {
    const S = ctx.C.school;
    const daysLeft = S.lastDay ? Math.max(0, Math.ceil((window.HQ_CALC.parse(S.lastDay) - window.HQ_CALC.parse(ctx.C.t)) / 864e5)) : 0;
    fill('school-cards',
      card('Tasks done', S.done + ' / ' + S.total, null, {bar: S.total ? S.done / S.total * 100 : 0}),
      card('Late', String(S.behind), 'Missed tasks still to do', {hot: S.behind > 0}),
      card('Next test', S.nextTest ? day(S.nextTest.date) : '—', S.nextTest ? S.nextTest.task : ''),
      card('Days to finish', String(daysLeft), 'All done by ' + day(S.lastDay)));
  }

  function renderMoney(ctx) {
    const C = ctx.C, J = C.job, inv = C.inv;
    fill('money-cards',
      card('Income this month', money(C.thisMonthIncome), 'Work after tax + business'),
      card('By month end', money(C.projectedMonth), Math.round(C.projectedMonth / C.G.GOALS[0].amount * 100) + '% of the $5,000 goal'),
      card('Left over', money(C.leftOver), 'After bills and business costs'),
      card('TFSA value', inv ? money(inv.total_equity_cad, 2) : '—', inv ? 'Questrade · ' + day(String(inv.as_of).slice(0, 10)) : 'Updated each morning'));
    fill('money-sources', table([['Source', (r) => r.source], ['This month', (r) => money(r.this_month), 1], ['All time', (r) => money(r.all_time), 1]], C.incomeBySource));
    fill('job-cards',
      card('Hours this month', String(J.hours), J.shifts + ' shifts'),
      card('Take-home', money(J.net), 'Before tax ' + money(J.gross)),
      card('Projected take-home', money(J.projected), J.upcoming + ' shifts still to go'),
      card('Last paycheque', J.lastPay ? money(J.lastPay.net_cad, 2) : '—', [J.lastPay ? 'Landed ' + day(J.lastPay.paid) + ' · ' + J.lastPay.hours + ' hours' : '', 'Next: ~' + money(J.nextPay.est) + ' on ' + day(J.nextPay.date)]));
    $('job-note').textContent = J.nph ? 'Your paycheques work out to ' + money(J.nph, 2) + ' take-home per hour. Shifts not paid yet are estimated at that rate.' : '';
    $('split-when').textContent = 'Next payday ' + day(J.nextPay.date);
    fill('split', table([['Where', (r) => r.bucket], ['Share', (r) => r.share, 1], ['Next cheque', (r) => money(r.next), 1], ['Last cheque', (r) => money(r.last), 1]], C.paySplit));
    $('bal-asof').textContent = C.balancesAsOf ? 'Balances as of ' + day(C.balancesAsOf) + ' · tell Claude new ones' : 'Tell Claude new balances';
    const g = C.goals[0];
    fill('save-cards',
      card('Saved long-term', money(C.savingsTotal), 'Savings accounts + TFSA'),
      card(g.name, money(g.saved) + ' / ' + money(g.target), ['At ' + C.G.SPLIT.save + '% a paycheque you hit it around ' + day(g.eta), '~' + money(g.nextSave) + ' from your ' + day(C.job.nextPay.date) + ' cheque'], {bar: g.pct}),
      card('Checking', money(C.sweep.checking), ['Cap $750 + ' + money(C.sweep.reserved) + ' kept for trips', 'Move to savings: ' + money(C.sweep.move)]));
    fill('biz-cards', card('Made', money(C.businessMonth)), card('Costs', money(C.monthlySpend, 2)), card('Profit', money(C.businessNet, 2), null, {hot: C.businessNet < 0}));
    fill('biz-costs', table([['Cost', (r) => r.item], ['Per month', (r) => money(r.monthly, 2), 1], ['Note', (r) => (r.once_month ? 'One-time, ' + r.once_month + '. ' : '') + (r.note || '')]], C.bizCosts));
    fill('pers-cards', card('Spent this month', money(C.personalMonth)), card('Monthly bills', money(C.personalRecurring)));
    fill('pers-planned', table([['Month', (r) => r.month], ['What', (r) => r.item], ['Cost', (r) => money(r.amount_cad), 1], ['Set aside', (r) => money(C.funded[r.id] || 0), 1]], C.plannedUpcoming));
    $('inv-asof').textContent = inv ? 'Questrade TFSA · ' + new Date(inv.as_of).toLocaleString('en-CA', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : 'Updated each morning';
    fill('inv-cards', card('Invested', inv ? money(inv.market_value_cad, 2) : '—'), card('Cash', inv ? money(inv.cash_cad, 2) : '—'), card('Gain / loss', inv ? money(inv.open_pnl_cad, 2) : '—', null, {hot: inv && inv.open_pnl_cad < 0}));
    fill('inv-holdings', table([['Symbol', (r) => r.symbol], ['Shares', (r) => String(r.qty), 1], ['Avg price', (r) => money(r.avg_price, 2), 1]], (inv && inv.positions) || []));
  }

  function renderSales(ctx) {
    const C = ctx.C, T = C.G.SALES_TARGETS;
    fill('week-cards', ...[['contacted', 'Contacted'], ['replies', 'Replies'], ['previews', 'Previews sent'], ['signed', 'Signed']].map(([k, label]) =>
      card(label, C.week[k] + ' / ' + T[k], null, {bar: T[k] ? C.week[k] / T[k] * 100 : 0})));
    fill('past-weeks', table([['Week of', (r) => day(r.week)], ['Contacted', (r) => String(r.contacted), 1], ['Replies', (r) => String(r.replies), 1], ['Previews', (r) => String(r.previews), 1], ['Signed', (r) => String(r.signed), 1]], C.weeks));
    const launch = C.active.filter((c) => c.plan === 'Launch').length, grow = C.active.filter((c) => c.plan === 'Grow').length;
    fill('mrr-cards',
      card('Recurring a month', money(C.mrr), Math.round(C.mrr / C.G.MRR_TARGET * 100) + '% of ' + money(C.G.MRR_TARGET), {bar: C.mrr / C.G.MRR_TARGET * 100}),
      card('Active clients', String(C.active.length), launch + ' Launch · ' + grow + ' Grow'));
    fill('clients', table([['Business', (r) => r.business], ['Plan', (r) => r.plan || ''], ['Monthly', (r) => money(r.monthly), 1], ['Status', (r) => r.status]], ctx.D.clients));
  }

  function renderGoals(ctx) {
    const C = ctx.C;
    fill('goal-cards', ...C.goalProgress.map((g) => card(g.label, money(g.amount) + '/mo', g.pct + '% there · ' + g.daysLeft + ' days left', {bar: g.pct})));
    // Simple bar chart: income per month against the first goal line
    const rows = C.incomeMonthly.slice(-6);
    const box = $('goal-chart');
    if (box) {
      const W = Math.max(280, box.clientWidth || 600), H = 200, P = {l: 44, r: 8, t: 10, b: 24};
      const max = Math.max(C.G.GOALS[0].amount, ...rows.map((r) => r.total)) * 1.1;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'gchart');
      const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
      const bw = rows.length ? (W - P.l - P.r) / rows.length : 0;
      [0, max / 2, C.G.GOALS[0].amount].forEach((v) => {
        const tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', P.l - 6); tx.setAttribute('y', y(v) + 4); tx.setAttribute('text-anchor', 'end'); tx.textContent = '$' + Math.round(v / 1000 * 10) / 10 + 'k'; svg.append(tx);
      });
      rows.forEach((r, i) => {
        const x = P.l + i * bw + bw * 0.2, w = bw * 0.6;
        const b = document.createElementNS(ns, 'rect'); b.setAttribute('x', x); b.setAttribute('y', y(r.total)); b.setAttribute('width', w); b.setAttribute('height', Math.max(0, y(0) - y(r.total))); b.setAttribute('class', 'bar-total');
        const ti = document.createElementNS(ns, 'title'); ti.textContent = r.month + ': ' + money(r.total) + (r.passive ? ' (' + money(r.passive) + ' passive)' : ''); b.append(ti); svg.append(b);
        if (r.passive) { const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', x); p.setAttribute('y', y(r.passive)); p.setAttribute('width', w); p.setAttribute('height', y(0) - y(r.passive)); p.setAttribute('class', 'bar-passive'); svg.append(p); }
        const lb = document.createElementNS(ns, 'text'); lb.setAttribute('x', x + w / 2); lb.setAttribute('y', H - 6); lb.setAttribute('text-anchor', 'middle'); lb.textContent = window.HQ_CALC.parse(r.month + '-01').toLocaleDateString('en-CA', {month: 'short'}); svg.append(lb);
      });
      const gl = document.createElementNS(ns, 'line'); gl.setAttribute('x1', P.l); gl.setAttribute('x2', W - P.r); gl.setAttribute('y1', y(C.G.GOALS[0].amount)); gl.setAttribute('y2', y(C.G.GOALS[0].amount)); gl.setAttribute('class', 'goal-line'); svg.append(gl);
      box.replaceChildren(svg, (() => { const l = el('div', 'legend'); l.append(el('span', 'sw total'), document.createTextNode('Income '), el('span', 'sw passive'), document.createTextNode('Passive '), el('span', 'sw goal'), document.createTextNode('$5,000 goal')); return l; })());
    }
    fill('swiss-cards',
      card('Target', money(C.G.SWISS_TARGET_CAD) + '/mo', 'Business profit'),
      card('Profit this month', money(C.businessNet, 2)),
      card('There', pct(Math.max(0, C.swissPct)), null, {bar: C.swissPct}),
      card('Living costs there', money(C.G.SWISS_MONTHLY_CHF * C.G.CHF_CAD) + '/mo', '1,400 CHF a month'));
    const trips = [
      {k: 'Switzerland · Lea + ski', date: '2027-02-04', n: 'Feb 4 – 21, 2027', exp: 'e1'},
      {k: 'Puerto Vallarta', date: '2027-03-22', n: 'From YVR, Mar 22, 2027', exp: 'e2'}
    ];
    fill('trip-cards', ...trips.map((tr) => {
      const days = Math.ceil((window.HQ_CALC.parse(tr.date) - window.HQ_CALC.parse(C.t)) / 864e5);
      const e = ctx.D.expenses.find((x) => x.id === tr.exp); const have = C.funded[tr.exp] || 0;
      return card(tr.k, days + ' days', [tr.n, e ? money(have) + ' of ' + money(e.amount_cad) + ' budget set aside' : ''], {bar: e && +e.amount_cad ? have / e.amount_cad * 100 : null});
    }));
  }

  window.HQ_TABS = {
    render(ctx) {
      try { renderToday(ctx); } catch (e) { console.error(e); }
      try { renderSchoolCards(ctx); } catch (e) { console.error(e); }
      try { renderMoney(ctx); } catch (e) { console.error(e); }
      try { renderSales(ctx); } catch (e) { console.error(e); }
      try { renderGoals(ctx); } catch (e) { console.error(e); }
    }
  };
})();
