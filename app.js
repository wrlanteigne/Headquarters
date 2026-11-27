// William's HQ: login, status bar, day plan, school list and focus mode.
(function () {
  'use strict';
  const C = window.HQ_CONFIG, PLANS = window.HQ_PLANS;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------- Dates (local time) ----------
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const dayName = (s) => parse(s).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'});

  // ---------- Small storage helpers (per device) ----------
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };

  // ---------- Start-up screen ----------
  const boot = $('boot');
  boot.addEventListener('click', () => { boot.hidden = true; });
  setTimeout(() => { boot.hidden = true; }, 6400);

  // ---------- Supabase ----------
  const sb = window.supabase.createClient(C.url, C.key, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
  let user = null;
  const data = {shifts: [], tasks: [], ticks: [], countdowns: [], accounts: [], paycheques: [], income: [], costs: [], expenses: [], attention: [], outreach: [], clients: [], log: [], invest: null, leads: [], docs: [], notes: [], settings: [], gym: [], focus: []};

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- Login: one password ----------
  $('pemail').value = C.ownerEmail;
  $('login-pass').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-msg').textContent = 'Unlocking…';
    const {error} = await sb.auth.signInWithPassword({email: C.ownerEmail, password: $('ppass').value});
    $('login-msg').textContent = error ? (error.message === 'Invalid login credentials' ? 'Wrong password.' : error.message) : '';
    if (!error) $('ppass').value = '';
  });
  $('signout').addEventListener('click', () => sb.auth.signOut());

  sb.auth.onAuthStateChange((_evt, session) => {
    const u = session ? session.user : null;
    const same = (u && u.id) === (user && user.id);
    user = u;
    if (same && !$('login').hidden === !user) return;
    $('login').hidden = !!user;
    $('app').hidden = !user;
    if (user) load();
  });

  // ---------- Data ----------
  async function load() {
    const q = (t, f) => (f ? f(sb.from(t).select('*')) : sb.from(t).select('*'));
    const res = await Promise.all([
      q('shifts', (x) => x.order('date')),
      q('school_tasks', (x) => x.order('date').order('seq', {nullsFirst: false})),
      q('day_ticks', (x) => x.eq('date', today())),
      q('countdowns', (x) => x.order('at')),
      q('accounts'), q('paycheques'), q('income'), q('costs'), q('expenses'),
      q('attention'), q('outreach'), q('clients'),
      q('activity_log', (x) => x.order('date', {ascending: false}).limit(30)),
      q('invest_snapshot'),
      q('leads', (x) => x.order('updated_at', {ascending: false})),
      q('docs', (x) => x.order('updated_at', {ascending: false})),
      q('notes', (x) => x.order('created_at', {ascending: false})),
      q('settings'),
      q('gym', (x) => x.gte('date', addDays(today(), -60)).order('date')),
      q('focus_sessions', (x) => x.gte('date', addDays(today(), -14)))
    ]);
    const err = res.find((r) => r.error);
    if (err) toast('Could not load: ' + err.error.message);
    const v = res.map((r) => r.data || []);
    Object.assign(data, {shifts: v[0], tasks: v[1], ticks: v[2], countdowns: v[3], accounts: v[4], paycheques: v[5], income: v[6], costs: v[7], expenses: v[8],
      attention: v[9], outreach: v[10], clients: v[11], log: v[12], invest: v[13][0] || null,
      leads: v[14], docs: v[15], notes: v[16], settings: v[17], gym: v[18], focus: v[19]});
    render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user) load(); });

  // ---------- Day plan ----------
  const lateEnd = (e) => !!e && (e < '06:00' || e >= '22:00');
  function dayKind(t) {
    const real = data.shifts.filter((s) => !s.extra);
    const sh = real.find((s) => s.date === t);
    if (sh) return {kind: 'shift', shift: sh};
    const y = real.find((s) => s.date === addDays(t, -1));
    return {kind: y && lateEnd(y.end_time) ? 'late' : 'off', shift: null};
  }
  function openTasks(t) {
    // Today's tasks plus anything missed earlier (shown as late)
    return data.tasks.filter((r) => !r.done && r.date <= t).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  function buildPlan() {
    const t = today();
    const {kind, shift} = dayKind(t);
    const tasks = openTasks(t).map((r) => (r.date < t ? 'Late: ' : '') + r.task);
    const done = new Set(data.ticks.filter((r) => r.done).map((r) => r.key));
    let items = PLANS[kind].items;
    if (kind === 'shift' && !tasks.length) items = items.filter((i) => i.type !== 'study');
    // Spread today's school tasks evenly over the school blocks, in order
    const studyKeys = items.filter((i) => i.type === 'study').map((i) => i.key);
    const per = Math.ceil(tasks.length / Math.max(1, studyKeys.length));
    const rows = items.map((i) => {
      let note = i.note, time = i.time;
      if (i.type === 'study') {
        const n = studyKeys.indexOf(i.key);
        const mine = tasks.slice(n * per, (n + 1) * per);
        const list = mine.length ? mine.join(' · ') : (tasks.length ? 'Finish what the earlier blocks didn’t, then start tomorrow’s Economics.' : 'No school tasks today: get ahead on the next Economics lesson.');
        note = (note ? note + ' ' : '') + list;
      }
      if (i.key === 'work' && shift && shift.start_time && shift.end_time) time = shift.start_time + '–' + shift.end_time;
      return {...i, note, time, done: done.has(i.key)};
    });
    return {kind, plan: PLANS[kind], rows, t};
  }

  async function setTick(date, key, on, silent) {
    const row = {user_id: user.id, date, key, done: on, at: new Date().toISOString()};
    const i = data.ticks.findIndex((r) => r.key === key && r.date === date);
    if (i >= 0) data.ticks[i] = row; else data.ticks.push(row);
    render();
    const {error} = await sb.from('day_ticks').upsert(row, {onConflict: 'user_id,date,key'});
    if (error) { toast('That tick wasn’t saved. Try again.'); load(); return; }
    if (!silent) {
      const it = (PLANS[dayKind(date).kind].items || []).find((i) => i.key === key);
      window.HQ_UI.undoable((on ? 'Ticked off ' : 'Unticked ') + (it ? it.what : 'item') + '.', () => setTick(date, key, !on, true));
    }
  }

  function renderPlan() {
    const {plan, rows, t} = buildPlan();
    const next = rows.find((r) => !r.done);
    const doneN = rows.filter((r) => r.done).length;
    $('day-kind').textContent = plan.label;
    $('day-done').textContent = doneN;
    $('day-total').textContent = rows.length;
    $('day-bed').textContent = plan.bed;
    $('day-bar').style.width = (rows.length ? doneN / rows.length * 100 : 0) + '%';
    // Hero: the one thing to do now
    $('hero-time').textContent = next ? next.time : 'Done';
    $('hero-what').textContent = next ? next.what : 'Everything’s done today.';
    $('hero-note').textContent = next ? next.note : 'Wind down, screens off, and get to bed on time.';
    $('focus-next').hidden = !(next && next.mins);
    $('focus-next').onclick = () => next && openFocus(next, t);
    $('hero-done').hidden = !next;
    let ob = $('hero-open');
    if (!ob) { ob = document.createElement('button'); ob.id = 'hero-open'; ob.type = 'button'; ob.className = 'btn'; $('hero-done').before(ob); }
    const sl = window.HQ_SCHOOL && window.HQ_SCHOOL.links().filter((l) => l.course);
    ob.hidden = !(next && next.type === 'study' && sl && sl.length);
    if (!ob.hidden) {
      const rsa = /RSA/i.test(next.note || ''), l = sl.find((x) => x.course === (rsa ? 'rsa' : 'econ')) || sl[0];
      ob.textContent = 'Open ' + (l.course === 'rsa' ? 'RSA' : 'eBus') + ' ↗';
      ob.onclick = () => window.HQ_SCHOOL.go(l);
    }
    $('hero-done').onclick = () => next && setTick(t, next.key, true);
    // Compact checklist: time and name only
    $('plan').replaceChildren(...rows.map((r) => {
      const li = el('li', (r.done ? 'done' : '') + (r === next ? ' next' : '') + (r.type === 'food' ? ' food' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = r.done; cb.setAttribute('aria-label', 'Done: ' + r.what);
      cb.addEventListener('change', () => setTick(t, r.key, cb.checked));
      const lab = el('label', 't-main');
      lab.append(el('span', 't-time', r.time), el('span', 't-name', r.what));
      lab.addEventListener('click', (e) => { e.preventDefault(); cb.checked = !cb.checked; setTick(t, r.key, cb.checked); });
      li.append(cb, lab);
      return li;
    }));
  }

  // ---------- School ----------
  async function setTask(id, on) {
    const r = data.tasks.find((x) => x.id === id); if (!r) return;
    r.done = on; r.done_at = on ? new Date().toISOString() : null;
    const patch = {done: on, done_at: r.done_at};
    // Done ahead of plan: it counts for today, so later days keep their order
    if (on && r.date > today()) { r.date = today(); patch.date = r.date; }
    render();
    const {error} = await sb.from('school_tasks').update(patch).eq('id', id);
    if (error) { toast('That tick wasn’t saved. Try again.'); load(); }
  }
  function renderSchool() { /* drawn by school.js */ }

  // ---------- Status bar ----------
  function span(ms) {
    if (ms <= 0) return 'now';
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + mm + 'm' : mm + 'm';
  }
  function nextPayday() {
    let d = parse(C.paydayAnchor); const now = parse(today());
    while (d < now) d.setDate(d.getDate() + 14);
    while (new Date(d.getTime() - 14 * 864e5) >= now) d.setDate(d.getDate() - 14);
    return d;
  }
  function renderStatus() {
    const now = new Date();
    const items = [];
    data.countdowns.forEach((c) => { const ms = new Date(c.at) - now; if (ms > -864e5) items.push({k: c.title, ms, hot: ms < 10 * 864e5}); });
    const ns = data.shifts.filter((s) => !s.extra && s.date > today()).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    const st = data.shifts.find((s) => !s.extra && s.date === today());
    if (st) items.push({k: 'Shift', v: 'Today', hot: true});
    else if (ns) items.push({k: 'Next shift', v: dayName(ns.date)});
    const pd = nextPayday();
    items.push({k: 'Payday', v: ymd(pd) === today() ? 'Today' : dayName(ymd(pd))});
    const cds = items.filter((i) => i.ms != null).sort((a, b) => a.ms - b.ms).slice(0, 1);
    const shown = cds.concat(items.filter((i) => i.ms == null));
    $('status').replaceChildren(...shown.map((i) => {
      const d = el('div', 'stat' + (i.hot ? ' hot' : ''));
      d.append(el('span', 'k', i.k), el('span', 'v', i.v || span(i.ms)));
      return d;
    }));
  }
  function tickClock() {
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString('en-CA', {hour12: false});
    $('today-label').textContent = now.toLocaleDateString('en-CA', {weekday: 'long', month: 'long', day: 'numeric'});
    const h = now.getHours();
    $('greeting').textContent = (h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', William';
    if (now.getSeconds() === 0 || !tickClock.done) { tickClock.done = true; if (user) renderStatus(); }
    if (tickClock.day && tickClock.day !== ymd(now) && user) load();
    tickClock.day = ymd(now);
  }
  setInterval(tickClock, 1000); tickClock();

  // ---------- Tabs ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== b.dataset.tab; });
    store.set('hq_tab', b.dataset.tab);
    document.body.dataset.view = b.dataset.tab;
    if (user) render();
    window.scrollTo(0, 0);
  }));
  { const last = store.get('hq_tab'); const b = last && document.querySelector('.tab[data-tab="' + last + '"]'); if (b) b.click(); }

  function render() {
    renderPlan(); renderSchool(); renderStatus();
    if (window.HQ_TABS && user) {
      let C = null;
      try { C = window.HQ_CALC.compute(data); } catch (e) { console.error(e); }
      const ctx = {D: data, C, sb, user, toast, rerender: render};
      if (C) window.HQ_TABS.render(ctx);
      [window.HQ_PREFS, window.HQ_LEARN, window.HQ_SCHOOL, window.HQ_DOCS, window.HQ_EXTRAS, window.HQ_MAIL, window.HQ_CAL].forEach((m) => { try { if (m) m.render(ctx); } catch (e) { console.error(e); } });
    }
  }

  // ---------- Focus mode ----------
  // State lives in localStorage so a running timer survives closing the app.
  const RING = 603.19;
  let F = store.get('hq_focus');
  let wake = null, audio = null;
  const defaultMins = (r) => r.mins || 25;

  function openFocus(r, date) {
    if (!F || F.key !== r.key || F.date !== date) F = {key: r.key, label: r.what, date, mins: defaultMins(r), endsAt: null, left: null, phase: 'focus'};
    store.set('hq_focus', F);
    $('focus').hidden = false;
    drawFocus();
  }
  function closeFocus() { $('focus').hidden = true; releaseWake(); }
  async function holdWake() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; } }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
  function beep() {
    if (!(window.HQ_PREFS ? window.HQ_PREFS.get('focusSound') : true)) { try { if ((window.HQ_PREFS ? window.HQ_PREFS.get('focusVibrate') : true) && navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* none */ } return; }
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, .25, .5].forEach((t) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.3, audio.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t + .2);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .22);
      });
    } catch (e) { /* no sound */ }
    try { if ((window.HQ_PREFS ? window.HQ_PREFS.get('focusVibrate') : true)) navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
  }
  const remaining = () => (F.endsAt ? Math.max(0, F.endsAt - Date.now()) : (F.left != null ? F.left : F.mins * 60000));
  function drawFocus() {
    if (!F) return;
    const ms = remaining(), total = F.mins * 60000;
    const s = Math.ceil(ms / 1000);
    $('focus-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    $('ring-fg').style.strokeDashoffset = RING * (1 - ms / total);
    $('focus-label').textContent = F.phase === 'break' ? 'Break' : F.label;
    $('focus-phase').textContent = F.phase === 'break' ? 'Recharge · away from screens' : 'Focus · ' + F.mins + ' min';
    $('focus').classList.toggle('break', F.phase === 'break');
    $('focus-go').textContent = F.endsAt ? 'Pause' : (F.left != null && F.left < total ? 'Resume' : 'Start');
    $('focus-done').hidden = F.phase === 'break';
    $('focus-mins').hidden = !!F.endsAt || (F.left != null && F.left < total) || F.phase === 'break';
    document.querySelectorAll('#focus-mins .chip').forEach((c) => c.classList.toggle('on', +c.dataset.min === F.mins));
    $('focus-note').textContent = F.phase === 'break' ? 'Water, stand up, look out a window.' : 'Phone face down. One thing only.';
  }
  document.querySelectorAll('#focus-mins .chip').forEach((c) => c.addEventListener('click', () => {
    F.mins = +c.dataset.min; F.left = null; store.set('hq_focus', F); drawFocus();
  }));
  $('focus-go').addEventListener('click', () => {
    if (F.endsAt) { F.left = remaining(); F.endsAt = null; releaseWake(); }
    else { if (!F.startedAt) F.startedAt = new Date().toISOString(); F.endsAt = Date.now() + remaining(); F.left = null; holdWake(); beep.prime = true; }
    store.set('hq_focus', F); drawFocus();
  });
  $('focus-done').addEventListener('click', () => finish(true));
  $('focus-close').addEventListener('click', closeFocus);

  async function finish(early) {
    const f = F;
    if (f.phase === 'break') { F = null; store.del('hq_focus'); closeFocus(); toast('Break over. Next block.'); return; }
    beep();
    const mins = Math.round((f.mins * 60000 - remaining()) / 60000);
    const bm = +(window.HQ_PREFS ? window.HQ_PREFS.get('focusBreak') : 10) || 10;
    F = {key: 'break', label: 'Break', date: f.date, mins: bm, endsAt: early ? null : Date.now() + bm * 60000, left: null, phase: 'break'};
    store.set('hq_focus', F);
    drawFocus();
    if (user) {
      if (f.key !== 'break') await setTick(f.date, f.key, true);
      const {error} = await sb.from('focus_sessions').insert({user_id: user.id, date: f.date, key: f.key, label: f.label, minutes: mins, started_at: f.startedAt || new Date().toISOString(), ended_at: new Date().toISOString()});
      if (error) toast('Focus time wasn’t saved.');
    }
    toast(f.label + ': done. Take ' + (+(window.HQ_PREFS ? window.HQ_PREFS.get('focusBreak') : 10) || 10) + '.');
  }
  setInterval(() => {
    if (!F) return;
    if (F.endsAt && remaining() <= 0) { if (F.phase === 'break') { beep(); } finish(false); return; }
    if (!$('focus').hidden) drawFocus();
  }, 500);
  if (F && F.endsAt) { $('focus').hidden = false; drawFocus(); holdWake(); }

  // ---------- Offline shell ----------
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
