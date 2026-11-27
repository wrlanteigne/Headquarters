// Learn: Founder School. Short lessons in order, progress, notes, a lesson of the
// day on Today, and a reading list.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  const DATA = window.HQ_LEARN_DATA;
  const ALL = DATA.levels.flatMap((lv, li) => lv.lessons.map((l, i) => Object.assign({}, l, {level: lv, li, i})));
  let ctx = null, openId = null;

  const prog = () => { const r = (ctx.D.settings || []).find((x) => x.key === 'learn'); return Object.assign({done: {}, notes: {}, books: {}}, r ? r.value : {}); };
  async function saveProg(p) {
    const D = ctx.D; const row = {user_id: ctx.user.id, key: 'learn', value: p};
    const i = D.settings.findIndex((x) => x.key === 'learn'); if (i >= 0) D.settings[i] = row; else D.settings.push(row);
    const {error} = await ctx.sb.from('settings').upsert(row, {onConflict: 'user_id,key'});
    if (error) ctx.toast('Progress not saved: ' + error.message);
  }
  const next = (p) => ALL.find((l) => !p.done[l.id]);
  const ymd = (d) => d.toISOString().slice(0, 10);
  function streak(p) {
    const days = new Set(Object.values(p.done).map((x) => String(x).slice(0, 10)));
    let n = 0; const d = new Date();
    if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);
    while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const askUrl = (l) => 'https://claude.ai/new?q=' + encodeURIComponent('I’m learning about “' + l.title + '” (Founder School, ' + l.level.title + '). I’m 19 and run Clearform Studio (websites for trades near Whistler, BC) and ClearformSheets (Google Sheets templates on Etsy). Teach me this in more depth with examples from businesses like mine, then quiz me with 3 questions.');

  async function complete(l, on) {
    const p = prog();
    if (on) p.done[l.id] = new Date().toISOString(); else delete p.done[l.id];
    await saveProg(p); ctx.rerender();
    if (on) U.undoable('Lesson done: ' + l.title + '.', async () => { const q = prog(); delete q.done[l.id]; await saveProg(q); ctx.rerender(); });
  }

  // ---------- Lesson page ----------
  function lesson(l) {
    const p = prog();
    const w = el('div', 'lesson');
    const top = el('div', 'ed-top');
    top.append(btn('← Founder School', 'ghost', () => { openId = null; draw(); }), el('span', 'grow'), el('span', 'muted small', 'Level ' + (l.li + 1) + ' · Lesson ' + (l.i + 1) + ' of ' + l.level.lessons.length));
    const paper = el('article', 'paper lesson-paper');
    paper.append(el('p', 'lv-k', l.level.title), el('h1', 'ls-t', l.title), el('p', 'muted small', l.min + ' min read' + (p.done[l.id] ? ' · ✓ Done' : '')));
    l.body.forEach((t) => paper.append(el('p', 'ls-p', t)));
    const kp = el('div', 'ls-box'); kp.append(el('b', '', 'Remember'));
    const ul = el('ul'); l.points.forEach((x) => ul.append(el('li', '', x))); kp.append(ul); paper.append(kp);
    const mv = el('div', 'ls-box move'); mv.append(el('b', '', 'Your move'), el('p', '', l.move));
    const mvb = el('div', 'hrow');
    mvb.append(btn('Add to Needs you', 'mini', async () => {
      const row = {id: 'learn-' + l.id + '-' + Date.now().toString(36), priority: 'med', area: 'Me', title: ('Learn: ' + l.title).slice(0, 60), item: l.move, action: l.move, status: 'open'};
      const {error} = await ctx.sb.from('attention').insert(Object.assign({user_id: ctx.user.id}, row));
      if (error) { ctx.toast(error.message); return; }
      ctx.D.attention.push(Object.assign({created_at: new Date().toISOString()}, row)); ctx.rerender();
      U.undoable('Added to Needs you.', async () => { await ctx.sb.from('attention').delete().eq('id', row.id); ctx.D.attention = ctx.D.attention.filter((x) => x.id !== row.id); ctx.rerender(); });
    }));
    mv.append(mvb); paper.append(mv);
    const q = el('div', 'ls-box ask'); q.append(el('b', '', 'Think about it'), el('p', '', l.ask));
    const ta = el('textarea', 'sin ls-notes'); ta.rows = 4; ta.placeholder = 'Your answer or notes (saved automatically)'; ta.value = p.notes[l.id] || ''; ta.setAttribute('aria-label', 'Your notes');
    let t = null; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => { const pp = prog(); pp.notes[l.id] = ta.value; await saveProg(pp); }, 700); });
    q.append(ta); paper.append(q);
    const foot = el('div', 'ls-foot');
    const idx = ALL.findIndex((x) => x.id === l.id), nx = ALL[idx + 1], pv = ALL[idx - 1];
    if (pv) foot.append(btn('‹ ' + pv.title, 'ghost', () => { openId = pv.id; draw(); }));
    foot.append(el('span', 'grow'));
    const deeper = el('a', 'btn', 'Go deeper with Claude ↗'); deeper.href = askUrl(l); deeper.target = '_blank'; deeper.rel = 'noopener';
    foot.append(deeper);
    if (!p.done[l.id]) foot.append(btn(nx ? 'Done · next lesson →' : 'Finish Founder School 🎓', 'primary', async () => { await complete(l, true); openId = nx ? nx.id : null; draw(); window.scrollTo(0, 0); }));
    else { foot.append(btn('Mark not done', 'ghost', () => complete(l, false))); if (nx) foot.append(btn('Next lesson →', 'primary', () => { openId = nx.id; draw(); window.scrollTo(0, 0); })); }
    paper.append(foot);
    w.append(top, paper);
    return w;
  }

  // ---------- Course page ----------
  function course() {
    const p = prog(), doneN = Object.keys(p.done).filter((k) => ALL.some((l) => l.id === k)).length, nx = next(p);
    const out = [];
    const head = el('div', 'page-h'); const ht = el('div');
    ht.append(el('h2', 'big', 'Founder School'), el('p', 'muted small', 'Everything it takes to build a company and be its CEO, in 5-minute lessons made for your businesses.'));
    head.append(ht); out.push(head);
    const stats = el('div', 'week-strip');
    const cell = (k, v, n, pct) => { const c = el('div', 'wk'); c.append(el('span', 'k', k), el('b', '', v)); if (n) c.append(el('span', 'n', n)); if (pct != null) { const b = el('div', 'bar'); const i = el('i'); i.style.width = pct + '%'; b.append(i); c.append(b); } return c; };
    const lvDone = DATA.levels.filter((lv) => lv.lessons.every((l) => p.done[l.id])).length;
    stats.append(cell('Progress', doneN + ' / ' + ALL.length, 'lessons', doneN / ALL.length * 100), cell('Levels', lvDone + ' / ' + DATA.levels.length, 'finished', lvDone / DATA.levels.length * 100), cell('Streak', streak(p) + ' day' + (streak(p) === 1 ? '' : 's'), 'in a row'), cell('Time left', ALL.filter((l) => !p.done[l.id]).reduce((s, l) => s + l.min, 0) + ' min', 'about'));
    out.push(stats);
    if (nx) {
      const c = el('div', 'panel continue');
      c.append(el('p', 'lv-k', doneN ? 'Continue · Level ' + (nx.li + 1) + ': ' + nx.level.title : 'Start here'), el('h3', '', nx.title), el('p', 'muted', nx.body[0].slice(0, 150) + '…'));
      c.append(btn((doneN ? 'Continue' : 'Start lesson 1') + ' · ' + nx.min + ' min', 'primary', () => { openId = nx.id; draw(); window.scrollTo(0, 0); }));
      out.push(c);
    } else out.push(el('div', 'panel continue', '🎓 You finished Founder School. Re-read any lesson as you hit that stage. It will mean more each time.'));
    DATA.levels.forEach((lv, li) => {
      const n = lv.lessons.filter((l) => p.done[l.id]).length;
      const d = el('details', 'panel fold lvl'); d.open = nx ? nx.level.id === lv.id : false;
      const s = el('summary'); const st = el('div', 'lv-h');
      st.append(el('span', 'lv-n' + (n === lv.lessons.length ? ' done' : ''), n === lv.lessons.length ? '✓' : String(li + 1)), (() => { const x = el('div'); x.append(el('h2', '', lv.title), el('span', 'muted small', lv.blurb)); return x; })());
      s.append(st, el('span', 'muted small', n + ' / ' + lv.lessons.length));
      d.append(s);
      const ul = el('ul', 'lslist');
      lv.lessons.forEach((l) => {
        const li2 = el('li'); const b = el('button', 'lsrow' + (p.done[l.id] ? ' done' : '') + (nx && nx.id === l.id ? ' next' : '')); b.type = 'button';
        b.append(el('span', 'ls-c', p.done[l.id] ? '✓' : ''), el('span', 'ls-n', l.title), el('span', 'muted small', (p.notes[l.id] ? '📝 ' : '') + l.min + ' min'));
        b.addEventListener('click', () => { openId = l.id; draw(); window.scrollTo(0, 0); });
        li2.append(b); ul.append(li2);
      });
      d.append(ul); out.push(d);
    });
    // Library
    const lib = el('div', 'panel');
    const lh = el('div', 'panel-h'); lh.append(el('h2', '', 'Library'), el('span', 'muted small', 'Tap to mark: want → reading → read')); lib.append(lh);
    const grid = el('div', 'books');
    DATA.library.forEach(([t, a, why]) => {
      const st = p.books[t] || '';
      const b = el('button', 'book ' + st); b.type = 'button';
      b.append(el('b', '', t), el('span', 'muted small', a), el('span', 'small', why), el('span', 'book-s', {'': 'Not started', want: 'Want to read', reading: '📖 Reading', read: '✓ Read'}[st]));
      b.addEventListener('click', async () => { const q = prog(); const order = ['', 'want', 'reading', 'read']; q.books[t] = order[(order.indexOf(st) + 1) % 4]; if (!q.books[t]) delete q.books[t]; await saveProg(q); draw(); });
      grid.append(b);
    });
    lib.append(grid); out.push(lib);
    return out;
  }

  function draw() {
    const root = $('learn-root'); if (!root || !ctx) return;
    if (root.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
    const l = openId && ALL.find((x) => x.id === openId);
    root.replaceChildren(...(l ? [lesson(l)] : course()));
  }
  function todayCard() {
    const box = $('today-learn'); if (!box || !ctx) return;
    const p = prog(), nx = next(p);
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Today’s lesson'), el('span', 'muted small', Object.keys(p.done).length + ' / ' + ALL.length + ' · ' + streak(p) + '-day streak'));
    if (!nx) { box.replaceChildren(head, el('p', 'muted', 'Founder School finished. 🎓')); return; }
    const doneToday = Object.values(p.done).some((x) => String(x).slice(0, 10) === ymd(new Date()));
    const b = el('button', 'linkrow'); b.type = 'button';
    b.append(el('span', 'ls-c', doneToday ? '✓' : '▶'), (() => { const x = el('div'); x.append(el('b', '', nx.title), el('div', 'muted small', nx.level.title + ' · ' + nx.min + ' min')); return x; })());
    b.addEventListener('click', () => { const t = document.querySelector('.tab[data-tab="learn"]'); if (t) t.click(); openId = nx.id; draw(); window.scrollTo(0, 0); });
    box.replaceChildren(head, b, el('p', 'muted small', doneToday ? 'Nice, you did today’s lesson. Read another if you like.' : 'Five minutes, one idea, one move for your business.'));
  }

  window.HQ_LEARN = {
    render(c) { ctx = c; draw(); todayCard(); },
    open(id) { openId = id; draw(); },
    lessons: ALL
  };
})();
