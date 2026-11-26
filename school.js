// School tab, simplified: one card per course, today's list, this week, and the
// full plan folded away.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el;
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayName = (s, long) => parse(s).toLocaleDateString('en-CA', long ? {weekday: 'long', month: 'short', day: 'numeric'} : {weekday: 'short', month: 'short', day: 'numeric'});
  const daysTo = (s, t) => Math.round((parse(s) - parse(t)) / 864e5);
  let ctx = null;
  const open = {week: true, later: false};

  const COURSES = [
    {k: 'econ', name: 'Economics 12', short: 'Econ', test: (u) => /^econ/i.test(u || ''), color: 'var(--blue)'},
    {k: 'rsa', name: 'RSA certificate', short: 'RSA', test: (u) => /^rsa/i.test(u || ''), color: 'var(--violet)'}
  ];
  const courseOf = (r) => COURSES.find((c) => c.test(r.unit)) || {k: 'other', name: 'Other', short: '', color: 'var(--muted)'};
  const isTest = (r) => /^(test|exam)$/i.test(r.kind || '') || /\bexam\b/i.test(r.task);

  async function tick(r, on) {
    const t = ymd(new Date());
    r.done = on; r.done_at = on ? new Date().toISOString() : null;
    const row = {done: on, done_at: r.done_at};
    if (on && r.date > t) { r.date = t; row.date = t; } // done early: counts for today, later days keep their order
    ctx.rerender();
    const {error} = await ctx.sb.from('school_tasks').update(row).eq('id', r.id);
    if (error) { ctx.toast('That tick wasn’t saved. Try again.'); }
    else if (on) {
      const left = ctx.D.tasks.filter((x) => !x.done && x.date <= t).length;
      ctx.toast(left ? 'Nice. ' + left + ' left for today.' : 'Today’s school is done. 🎉');
    }
  }

  function taskRow(r, t, opts) {
    const c = courseOf(r);
    const li = el('li', 'st' + (r.done ? ' done' : ''));
    li.style.setProperty('--cc', c.color);
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = r.done; cb.setAttribute('aria-label', 'Done: ' + r.task);
    cb.addEventListener('change', () => tick(r, cb.checked));
    const main = el('label', 'st-main');
    const line = el('div', 'st-line');
    if (!r.done && r.date < t) line.append(el('span', 'badge late', 'Late'));
    if (isTest(r)) line.append(el('span', 'badge test', /exam/i.test(r.task) ? 'Exam' : 'Test'));
    else if (/quiz/i.test(r.kind || '')) line.append(el('span', 'badge quiz', 'Quiz'));
    else if (/book|admin/i.test(r.kind || '')) line.append(el('span', 'badge todo', 'To do'));
    line.append(el('span', 'st-t', r.task));
    main.append(line);
    const meta = [c.short && (r.unit && r.unit !== c.short ? r.unit : c.name), opts && opts.showDay ? dayName(r.date) : '', r.note].filter(Boolean).join(' · ');
    if (meta) main.append(el('div', 'st-m', meta));
    main.addEventListener('click', (e) => { if (e.target !== cb) { e.preventDefault(); cb.checked = !cb.checked; tick(r, cb.checked); } });
    li.append(cb, main);
    return li;
  }

  function courseCard(c, tasks, t) {
    const mine = tasks.filter((r) => courseOf(r).k === c.k);
    const done = mine.filter((r) => r.done).length, total = mine.length;
    const late = mine.filter((r) => !r.done && r.date < t).length;
    const next = mine.filter((r) => !r.done && isTest(r)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    const last = mine.reduce((m, r) => (r.date > m ? r.date : m), '');
    const pct = total ? Math.round(done / total * 100) : 0;
    const card = el('div', 'course');
    card.style.setProperty('--cc', c.color);
    const h = el('div', 'course-h'); h.append(el('b', '', c.name), el('span', 'course-p', pct + '%'));
    const bar = el('div', 'pbar'); const i = el('i'); i.style.width = pct + '%'; bar.append(i);
    const stats = el('div', 'course-s');
    stats.append(el('span', '', done + ' of ' + total + ' done'));
    if (late) stats.append(el('span', 'late-t', late + ' late'));
    if (last) stats.append(el('span', '', 'Finish ' + dayName(last)));
    card.append(h, bar, stats);
    if (next) {
      const n = daysTo(next.date, t);
      const tb = el('div', 'course-next' + (n <= 7 ? ' soon' : ''));
      tb.append(el('span', 'cn-d', n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : n + ' days'), el('span', 'cn-t', next.task.replace(/\s*\(.*?\)\s*$/, '')));
      tb.title = dayName(next.date, true);
      card.append(tb);
    }
    return card;
  }

  function render(c) {
    ctx = c;
    const root = $('school-root'); if (!root) return;
    const t = ymd(new Date());
    const tasks = c.D.tasks || [];
    const todays = tasks.filter((r) => (r.date === t) || (!r.done && r.date < t)).sort((a, b) => (a.done - b.done) || (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0)));
    const weekEnd = addDays(t, 7);
    const week = tasks.filter((r) => !r.done && r.date > t && r.date <= weekEnd);
    const later = tasks.filter((r) => !r.done && r.date > weekEnd);
    const out = [];

    const head = el('div', 'page-h');
    const ht = el('div'); ht.append(el('h2', 'big', 'School'));
    const leftToday = todays.filter((r) => !r.done).length;
    ht.append(el('p', 'muted small', leftToday ? leftToday + ' to do today' : todays.length ? 'All done for today' : 'Nothing due today'));
    head.append(ht);
    out.push(head);

    const cards = el('div', 'courses'); COURSES.forEach((co) => { if (tasks.some((r) => courseOf(r).k === co.k)) cards.append(courseCard(co, tasks, t)); });
    out.push(cards);

    // Today
    const p = el('div', 'panel');
    const ph = el('div', 'panel-h'); ph.append(el('h2', '', 'Today'), el('span', 'muted small', todays.filter((r) => r.done).length + ' / ' + todays.length));
    p.append(ph);
    const ul = el('ul', 'stlist');
    if (!todays.length) ul.append(el('li', 'muted empty', 'Nothing due today. Get ahead on tomorrow’s first task if you have energy.'));
    todays.forEach((r) => ul.append(taskRow(r, t)));
    p.append(ul);
    out.push(p);

    // This week + later, folded
    const fold = (key, title, list, empty) => {
      const d = el('details', 'panel fold'); d.open = open[key];
      d.addEventListener('toggle', () => { open[key] = d.open; });
      const s = el('summary'); s.append(el('h2', '', title), el('span', 'muted small', list.length + ' task' + (list.length === 1 ? '' : 's')));
      d.append(s);
      if (!list.length) { d.append(el('p', 'muted small', empty)); return d; }
      const days = [...new Set(list.map((r) => r.date))].sort();
      days.forEach((day) => {
        d.append(el('p', 'st-day', (daysTo(day, t) === 1 ? 'Tomorrow · ' : '') + dayName(day, true)));
        const u = el('ul', 'stlist small'); list.filter((r) => r.date === day).forEach((r) => u.append(taskRow(r, t))); d.append(u);
      });
      return d;
    };
    out.push(fold('week', 'Next 7 days', week, 'Nothing planned this week.'));
    if (later.length) out.push(fold('later', 'Later', later, ''));
    out.push(el('p', 'muted small', 'Ticking a task early moves it to today. Econ tests need 5 school days’ notice to book. No school Dec 19 – Jan 3. Ask Claude to change the plan.'));
    root.replaceChildren(...out);
  }

  window.HQ_SCHOOL = {render};
})();
