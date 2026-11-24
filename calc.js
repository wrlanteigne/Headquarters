// Money, sales and goal maths (same rules as the old dashboard).
(function () {
  'use strict';
  const G = {
    GOALS: [
      {id: 'g1', label: 'By Jan 1, 2027', amount: 5000, by: '2027-01-01', passive: false},
      {id: 'g2', label: 'By Jul 1, 2027', amount: 10000, by: '2027-07-01', passive: false},
      {id: 'g3', label: 'Passive, by Dec 31, 2027', amount: 20000, by: '2027-12-31', passive: true}
    ],
    SWISS_TARGET_CAD: 5000, SWISS_MONTHLY_CHF: 1400, CHF_CAD: 1.72,
    SHIFT_GROSS: 33.40 * 9, DEFAULT_SHIFTS_PER_WEEK: 3,
    DAILY_CONTACT: 5, SALES_TARGETS: {contacted: 35, replies: 4, previews: 2, signed: 1}, MRR_TARGET: 5000,
    CHECKING_CAP: 750,
    SPLIT: {save: 60, tfsa: 15, claudeMonthly: 155},
    SAVE_GOALS: [{id: 'future', name: 'Switzerland or school fund', target: 15500, by: '2027-09-01'}],
    PAY: {end0: '2026-11-15', days: 14, lag: 4}
  };
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => ymd(new Date());
  const thisMonth = () => today().slice(0, 7);
  const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const weekOf = (s) => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };

  const worked = (shifts) => shifts.filter((s) => s.date <= today());
  function pace(shifts) {
    const w = worked(shifts).filter((s) => !s.extra);
    if (!w.length) return G.DEFAULT_SHIFTS_PER_WEEK;
    const first = w.map((s) => s.date).sort()[0];
    return w.length / Math.max(1, (Date.now() - parse(first)) / (7 * 864e5));
  }
  function netRate(shifts) {
    const A = G.SHIFT_GROSS * pace(shifts) * 52;
    if (A <= 0) return 1;
    const prog = (x, br) => { let t = 0, lo = 0; for (const [hi, r] of br) { if (x > lo) t += (Math.min(x, hi) - lo) * r; lo = hi; } return t; };
    const cpp = Math.max(0, Math.min(A, 74600) - 3500) * 0.0595, ei = Math.min(A, 68900) * 0.0163;
    const fed = Math.max(0, prog(A, [[58523, .14], [117045, .205], [Infinity, .26]]) - .14 * (16452 + cpp + ei));
    const bc = Math.max(0, prog(A, [[50363, .056], [100728, .077], [Infinity, .105]]) - .056 * (13216 + cpp + ei));
    return 1 - (cpp + ei + fed + bc) / A;
  }
  const paidThrough = (pay) => pay.map((p) => p.covers_through).sort().pop() || '';
  const unpaid = (shifts, pay) => { const t = paidThrough(pay); return shifts.filter((s) => s.date > t); };
  const netPerHour = (pay) => { const p = pay.filter((x) => +x.hours > 0); const h = sum(p, (x) => x.hours); return h ? sum(p, (x) => x.net_cad) / h : null; };
  function payPeriod(s) {
    const k = Math.ceil(Math.round((parse(s) - parse(G.PAY.end0)) / 864e5) / G.PAY.days);
    const end = parse(G.PAY.end0); end.setDate(end.getDate() + k * G.PAY.days);
    const start = new Date(end); start.setDate(end.getDate() - G.PAY.days + 1);
    const pay = new Date(end); pay.setDate(end.getDate() + G.PAY.lag);
    return {start: ymd(start), end: ymd(end), pay: ymd(pay)};
  }
  const paidIn = (list, month) => list.filter((s) => payPeriod(s.date).pay.slice(0, 7) === month);
  const estNet = (list, shifts, pay) => { const n = netPerHour(pay); return n ? sum(list, (s) => +s.pay_hours || +s.hours || 9) * n : sum(list, (s) => s.gross_cad) * netRate(shifts); };
  function paydaysUntil(by) { let d = payPeriod(today()).pay, n = 0; while (d <= by) { n++; const t = parse(d); t.setDate(t.getDate() + 14); d = ymd(t); } return n; }

  // Everything the tabs show, worked out once per load
  function compute(D) {
    const t = today(), m = thisMonth();
    const shifts = D.shifts, pay = D.paycheques;
    const real = shifts.filter((s) => !s.extra);

    // Income
    const jobRows = pay.map((p) => ({month: String(p.paid).slice(0, 7), source: 'Meadow Park (after tax)', amount_cad: +p.net_cad, passive: false}));
    const unpaidWorked = unpaid(worked(shifts), pay);
    const byMonth = {};
    unpaidWorked.forEach((s) => { const k = payPeriod(s.date).pay.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(s); });
    Object.entries(byMonth).forEach(([k, v]) => jobRows.push({month: k, source: 'Meadow Park (after tax)', amount_cad: Math.round(estNet(v, shifts, pay) * 100) / 100, passive: false}));
    const allIncome = D.income.map((r) => ({...r, amount_cad: +r.amount_cad})).concat(jobRows);
    const inM = (rows, key) => rows.filter((r) => String(r[key]).slice(0, 7) === m);
    const thisMonthIncome = sum(inM(allIncome, 'month'), (r) => r.amount_cad);
    const passiveMonth = sum(inM(allIncome, 'month').filter((r) => r.passive), (r) => r.amount_cad);
    const sources = {};
    allIncome.forEach((r) => { const s = sources[r.source] = sources[r.source] || {source: r.source, this_month: 0, all_time: 0}; s.all_time += r.amount_cad; if (r.month === m) s.this_month += r.amount_cad; });
    const incomeBySource = Object.values(sources).sort((a, b) => b.this_month - a.this_month || b.all_time - a.all_time);
    const monthly = {};
    allIncome.forEach((r) => { const o = monthly[r.month] = monthly[r.month] || {month: r.month, total: 0, passive: 0}; o.total += r.amount_cad; if (r.passive) o.passive += r.amount_cad; });

    // Business
    const businessMonth = sum(inM(D.income, 'month'), (r) => r.amount_cad);
    const bizCosts = D.costs.filter((c) => c.kind === 'business');
    const monthlySpend = sum(bizCosts.filter((c) => !c.once_month || c.once_month === m), (c) => c.monthly);
    const businessNet = businessMonth - monthlySpend;

    // Meadow Park
    const wm = inM(worked(shifts), 'date');
    const jobMonth = sum(inM(pay, 'paid'), (p) => p.net_cad) + estNet(paidIn(unpaidWorked, m), shifts, pay);
    const jobProjected = sum(inM(pay, 'paid'), (p) => p.net_cad) + estNet(paidIn(unpaid(shifts, pay), m), shifts, pay);
    const lastPay = pay.slice().sort((a, b) => (a.paid < b.paid ? 1 : -1))[0] || null;
    const pt = paidThrough(pay) || G.PAY.end0; const ptd = parse(pt); ptd.setDate(ptd.getDate() + 1);
    const per = payPeriod(ymd(ptd));
    const nextList = shifts.filter((s) => s.date >= per.start && s.date <= per.end);
    const nextPay = {date: per.pay, est: Math.round(estNet(nextList, shifts, pay) * 100) / 100, shifts: nextList.filter((s) => !s.extra).length};
    const nph = netPerHour(pay);
    const job = {
      hours: sum(wm.filter((s) => !s.extra), (s) => s.hours), shifts: wm.filter((s) => !s.extra).length,
      gross: sum(wm, (s) => s.gross_cad), net: jobMonth, projected: jobProjected,
      upcoming: inM(real, 'date').filter((s) => s.date > t).length, lastPay, nextPay, nph, pace: pace(shifts)
    };
    const projectedMonth = businessMonth + jobProjected;

    // Personal
    const exp = D.expenses;
    const personalRecurring = sum(exp.filter((e) => e.type === 'recurring'), (e) => e.amount_cad);
    const personalMonth = sum(exp.filter((e) => e.type === 'recurring' || e.month === m), (e) => e.amount_cad);
    const plannedUpcoming = exp.filter((e) => e.type !== 'recurring' && String(e.month) >= m).sort((a, b) => (a.month < b.month ? -1 : 1));
    const leftOver = thisMonthIncome - personalMonth - monthlySpend;

    // Savings + sweep
    const acc = D.accounts;
    const typical = nph ? pace(shifts) * 2 * 9 * nph : G.SHIFT_GROSS * netRate(shifts) * pace(shifts) * 2;
    const goals = G.SAVE_GOALS.map((g) => {
      const saved = sum(acc.filter((a) => a.goal === g.id), (a) => a.balance_cad);
      const left = Math.max(0, g.target - saved);
      const planned = typical * G.SPLIT.save / 100;
      const need = planned > 0 ? Math.ceil(left / planned) : null;
      let eta = null; if (need != null) { const e = parse(per.pay); e.setDate(e.getDate() + 14 * Math.max(0, need - 1)); eta = ymd(e); }
      return {...g, saved, left, pct: Math.round(saved / g.target * 100), eta, perPay: Math.round(planned), nextSave: Math.round(nextPay.est * G.SPLIT.save / 100), paydays: paydaysUntil(g.by)};
    });
    const checking = sum(acc.filter((a) => a.type === 'checking'), (a) => a.balance_cad);
    const funded = {}; acc.filter((a) => a.type === 'trip').forEach((a) => { funded[a.expense] = (funded[a.expense] || 0) + (+a.balance_cad || 0); });
    const reserved = sum(exp.filter((e) => e.type !== 'recurring' && String(e.month) >= m), (e) => Math.max(0, (+e.amount_cad || 0) - (funded[e.id] || 0)));
    const sweep = {checking, reserved, move: Math.max(0, Math.floor(checking - G.CHECKING_CAP - reserved))};
    const inv = D.invest || null;
    const savingsTotal = sum(acc.filter((a) => a.type === 'savings'), (a) => a.balance_cad) + (inv ? +inv.total_equity_cad || 0 : 0);
    const balancesAsOf = acc.map((a) => a.as_of).filter(Boolean).sort().pop() || null;

    // Paycheque split
    const claude = Math.ceil(G.SPLIT.claudeMonthly * 12 / 26);
    const split = (c) => { const save = Math.round(c * G.SPLIT.save / 100), tfsa = Math.round(c * G.SPLIT.tfsa / 100); return {save, tfsa, claude, spend: Math.round(c - save - tfsa - claude)}; };
    const sNext = split(nextPay.est), sLast = split(lastPay ? +lastPay.net_cad : 0);
    const paySplit = [
      {bucket: 'Switzerland or school fund', share: G.SPLIT.save + '%', next: sNext.save, last: sLast.save},
      {bucket: 'TFSA investing', share: G.SPLIT.tfsa + '%', next: sNext.tfsa, last: sLast.tfsa},
      {bucket: 'Claude Max', share: '$' + claude + ' flat', next: claude, last: claude},
      {bucket: 'Spending (buffer included)', share: 'The rest', next: sNext.spend, last: sLast.spend}
    ];

    // Sales
    const salesDays = D.outreach.map((r) => ({date: r.date, contacted: +r.contacted, replies: +r.replies, previews: +r.previews, signed: +r.signed}));
    const wk = weekOf(t);
    const K = ['contacted', 'replies', 'previews', 'signed'];
    const week = {}; K.forEach((k) => { week[k] = sum(salesDays.filter((r) => weekOf(r.date) === wk), (r) => r[k]); });
    const weeks = {};
    salesDays.forEach((r) => { const w = weeks[weekOf(r.date)] = weeks[weekOf(r.date)] || {week: weekOf(r.date), contacted: 0, replies: 0, previews: 0, signed: 0}; K.forEach((k) => { w[k] += r[k]; }); });
    const todayOut = salesDays.find((r) => r.date === t) || {date: t, contacted: 0, replies: 0, previews: 0, signed: 0};
    const active = D.clients.filter((c) => c.status !== 'cancelled');
    const mrr = sum(active, (c) => c.monthly);
    const days = new Set(salesDays.filter((r) => K.some((k) => r[k] > 0)).map((r) => r.date));
    const dd = parse(t); if (!days.has(ymd(dd))) dd.setDate(dd.getDate() - 1);
    let streak = 0; while (days.has(ymd(dd))) { streak++; dd.setDate(dd.getDate() - 1); }
    const last14 = []; for (let i = 13; i >= 0; i--) { const x = parse(t); x.setDate(x.getDate() - i); last14.push(days.has(ymd(x))); }

    // Mission + goals
    const janJob = Math.round((nph ? 9 * nph : G.SHIFT_GROSS * netRate(shifts)) * pace(shifts) * 31 / 7);
    const janBiz = Math.max(0, G.GOALS[0].amount - janJob);
    const mission = {janClients: Math.ceil(janBiz / 1199), janBiz, streak, last14, moveClients: Math.ceil(Math.max(0, G.SWISS_TARGET_CAD + monthlySpend - mrr) / 200)};
    const goalProgress = G.GOALS.map((g) => { const cur = g.passive ? passiveMonth : thisMonthIncome; return {...g, current: cur, pct: Math.round(cur / g.amount * 100), daysLeft: Math.ceil((parse(g.by) - parse(t)) / 864e5)}; });

    // School
    const tasks = D.tasks;
    const nextTest = tasks.filter((r) => r.kind === 'test' && !r.done).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;
    const school = {done: tasks.filter((r) => r.done).length, total: tasks.length, behind: tasks.filter((r) => !r.done && r.date < t).length, nextTest,
      lastDay: tasks.map((r) => r.date).sort().pop() || null};

    // Needs you
    const open = D.attention.filter((r) => r.status !== 'done');
    const rank = {high: 0, med: 1, medium: 1, low: 2};
    open.sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));

    return {
      G, t, m, allIncome, thisMonthIncome, projectedMonth, incomeBySource, incomeMonthly: Object.values(monthly).sort((a, b) => (a.month < b.month ? -1 : 1)),
      businessMonth, monthlySpend, businessNet, bizCosts, job, personalRecurring, personalMonth, plannedUpcoming, leftOver,
      goals, sweep, savingsTotal, balancesAsOf, inv, paySplit, week, weeks: Object.values(weeks).sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, 8),
      todayOut, mrr, active, mission, goalProgress, school, open, pinned: open.filter((r) => r.priority === 'high').slice(0, 2),
      swissPct: Math.round(businessNet / G.SWISS_TARGET_CAD * 100), funded
    };
  }
  window.HQ_CALC = {compute, ymd, parse, weekOf};
})();
