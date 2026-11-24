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
  const data = {shifts: [], tasks: [], ticks: [], countdowns: []};

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- Login (emailed code works inside the home-screen app) ----------
  let pendingEmail = store.get('hq_email') || '';
  $('email').value = pendingEmail;
  $('login-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    $('login-msg').textContent = 'Sending…';
    const {error} = await sb.auth.signInWithOtp({email, options: {emailRedirectTo: location.origin + location.pathname}});
    if (error) { $('login-msg').textContent = error.message; return; }
    pendingEmail = email; store.set('hq_email', email);
    $('login-email').hidden = true; $('login-code').hidden = false;
    $('login-msg').textContent = 'Email sent. It can take a minute.';
    $('code').focus();
  });
  $('login-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-msg').textContent = 'Checking…';
    const v = $('code').value.trim();
    let res;
    if (/^https?:\/\//.test(v)) {
      // A pasted sign-in link: use its token, so signing in works inside the home-screen app too
      let u; try { u = new URL(v); } catch (err) { $('login-msg').textContent = 'That link looks broken. Copy it again.'; return; }
      const token = u.searchParams.get('token') || u.searchParams.get('token_hash');
      const type = u.searchParams.get('type') === 'signup' ? 'signup' : 'email';
      if (!token) { $('login-msg').textContent = 'That link has no sign-in token. Copy the link from the button in the email.'; return; }
      res = await sb.auth.verifyOtp({token_hash: token, type});
    } else {
      res = await sb.auth.verifyOtp({email: pendingEmail, token: v, type: 'email'});
    }
    if (res.error) $('login-msg').textContent = res.error.message;
  });
  $('login-back').addEventListener('click', () => { $('login-code').hidden = true; $('login-email').hidden = false; $('login-msg').textContent = ''; });
  $('signout').addEventListener('click', () => sb.auth.signOut());

  sb.auth.onAuthStateChange((_evt, session) => {
    const u = session ? session.user : null;
    if ((u && u.id) === (user && user.id)) return;
    user = u;
    $('login').hidden = !!user;
    $('app').hidden = !user;
    if (user) load();
  });

  // ---------- Data ----------
  async function load() {
    const from = addDays(today(), -21);
    const [s, t, k, c] = await Promise.all([
      sb.from('shifts').select('*').gte('date', from).order('date'),
      sb.from('school_tasks').select('*').gte('date', from).order('date'),
      sb.from('day_ticks').select('*').eq('date', today()),
      sb.from('countdowns').select('*').order('at')
    ]);
    const err = [s, t, k, c].find((r) => r.error);
    if (err) toast('Could not load: ' + err.error.message);
    data.shifts = s.data || []; data.tasks = t.data || []; data.ticks = k.data || []; data.countdowns = c.data || [];
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
    const blocks = items.filter((i) => i.type === 'study').length;
    const cut = blocks > 1 ? Math.ceil(tasks.length / 2) : tasks.length;
    const rows = items.map((i) => {
      let note = i.note, time = i.time;
      if (i.type === 'study') {
        const mine = i.key === 'study1' ? tasks.slice(0, cut) : tasks.slice(cut);
        const list = mine.length ? mine.join(' · ') : (tasks.length ? 'Finish what block 1 didn’t.' : 'No school tasks today: review Economics.');
        note = (note ? note + ' ' : '') + list;
      }
      if (i.key === 'work' && shift && shift.start_time && shift.end_time) time = shift.start_time + '–' + shift.end_time;
      return {...i, note, time, done: done.has(i.key)};
    });
    return {kind, plan: PLANS[kind], rows, t};
  }

  async function setTick(date, key, on) {
    const row = {user_id: user.id, date, key, done: on, at: new Date().toISOString()};
    const i = data.ticks.findIndex((r) => r.key === key && r.date === date);
    if (i >= 0) data.ticks[i] = row; else data.ticks.push(row);
    render();
    const {error} = await sb.from('day_ticks').upsert(row, {onConflict: 'user_id,date,key'});
    if (error) { toast('That tick wasn’t saved. Try again.'); load(); }
  }

  function renderPlan() {
    const {plan, rows, t} = buildPlan();
    const next = rows.find((r) => !r.done);
    const nextFocus = rows.find((r) => !r.done && r.mins);
    $('day-kind').textContent = plan.label;
    $('day-done').textContent = rows.filter((r) => r.done).length;
    $('day-total').textContent = rows.length;
    $('day-bed').textContent = plan.bed;
    $('day-bar').style.width = (rows.length ? rows.filter((r) => r.done).length / rows.length * 100 : 0) + '%';
    const cta = $('focus-next');
    cta.hidden = !nextFocus;
    if (nextFocus) { $('focus-next-label').textContent = nextFocus.what; cta.onclick = () => openFocus(nextFocus, t); }
    $('plan').replaceChildren(...rows.map((r) => {
      const li = el('li', (r.done ? 'done' : '') + (r === next ? ' next' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = r.done; cb.setAttribute('aria-label', 'Done: ' + r.what);
      cb.addEventListener('change', () => setTick(t, r.key, cb.checked));
      const main = el('div', 't-main');
      const nm = el('div', 't-name');
      if (r.type === 'food') nm.append(el('span', 'tag', 'Eat'));
      if (r.type === 'study') nm.append(el('span', 'tag study', 'School'));
      nm.append(document.createTextNode(r.what));
      if (r === next) nm.append(el('span', 'now', 'Next up'));
      main.append(nm);
      if (r.note) main.append(el('div', 't-meta', r.note));
      li.append(cb, el('div', 't-time', r.time), main);
      if (!r.done && r.mins) {
        const fb = el('button', 'btn mini', 'Focus'); fb.type = 'button';
        fb.addEventListener('click', () => openFocus(r, t));
        li.append(fb);
      }
      return li;
    }));
  }

  // ---------- School ----------
  async function setTask(id, on) {
    const r = data.tasks.find((x) => x.id === id); if (!r) return;
    r.done = on; r.done_at = on ? new Date().toISOString() : null;
    render();
    const {error} = await sb.from('school_tasks').update({done: on, done_at: r.done_at}).eq('id', id);
    if (error) { toast('That tick wasn’t saved. Try again.'); load(); }
  }
  function renderSchool() {
    const t = today();
    const list = data.tasks.filter((r) => r.date >= t || !r.done);
    $('school-left').textContent = list.filter((r) => !r.done).length + ' to do';
    const days = [...new Set(list.map((r) => (r.date < t ? t : r.date)))].sort();
    const out = [];
    days.forEach((d) => {
      out.push(el('p', 'day-h' + (d === t ? ' today' : ''), dayName(d)));
      const ul = el('ul', 'tasks');
      list.filter((r) => (r.date < t ? t : r.date) === d).forEach((r) => {
        const li = el('li', r.done ? 'done' : '');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = r.done; cb.setAttribute('aria-label', 'Done: ' + r.task);
        cb.addEventListener('change', () => setTask(r.id, cb.checked));
        const main = el('div', 't-main');
        const nm = el('div', 't-name');
        if (r.date < t) nm.append(el('span', 'tag late', 'Late'));
        if (r.kind) nm.append(el('span', 'tag ' + r.kind, r.kind));
        nm.append(document.createTextNode(r.task));
        main.append(nm);
        const meta = [r.unit, r.note].filter(Boolean).join(' · ');
        if (meta) main.append(el('div', 't-meta', meta));
        li.append(cb, main);
        ul.append(li);
      });
      out.push(ul);
    });
    if (!out.length) out.push(el('p', 'muted', 'Nothing left. Nice.'));
    $('school-list').replaceChildren(...out);
  }

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
    items.sort((a, b) => (a.ms ?? 9e15) - (b.ms ?? 9e15));
    $('status').replaceChildren(...items.map((i) => {
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
  }));

  function render() { renderPlan(); renderSchool(); renderStatus(); }

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
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ }
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
    F = {key: 'break', label: 'Break', date: f.date, mins: 10, endsAt: early ? null : Date.now() + 10 * 60000, left: null, phase: 'break'};
    store.set('hq_focus', F);
    drawFocus();
    if (user) {
      if (f.key !== 'break') await setTick(f.date, f.key, true);
      const {error} = await sb.from('focus_sessions').insert({user_id: user.id, date: f.date, key: f.key, label: f.label, minutes: mins, started_at: f.startedAt || new Date().toISOString(), ended_at: new Date().toISOString()});
      if (error) toast('Focus time wasn’t saved.');
    }
    toast(f.label + ': done. Take 10.');
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
