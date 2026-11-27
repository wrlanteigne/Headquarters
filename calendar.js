// Calendar tab: your Google Calendar plus HQ's own dates (Meadow Park shifts,
// school tasks, lead follow-ups, countdowns) on one week grid.
// Click an empty slot to make an event; click an event to change or delete it.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  const CAL = 'https://www.googleapis.com/calendar/v3/';
  const H0 = 0, H1 = 24, ROW = 44; // hours shown, pixels per hour
  let ctx = null;
  const S = {start: null, cals: [], events: [], busy: false, err: '', loadedFor: '', on: null};

  const g = () => window.HQ_MAIL && window.HQ_MAIL.google;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const days = () => (window.matchMedia('(min-width: 900px)').matches ? 7 : 3);
  const monday = (d) => { const ws = window.HQ_PREFS ? +window.HQ_PREFS.get('weekStart') : 1; const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w = (x.getDay() - ws + 7) % 7; return addDays(x, -w); };
  const hm = (d) => d.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'}).replace(':00', '').replace(/\s?([ap])\.?m\.?/i, '$1m');
  const setting = (k) => { const r = ctx && (ctx.D.settings || []).find((s) => s.key === k); return r ? r.value : null; };

  // Layers that come from HQ itself (always available, even without Google)
  const LAYERS = [['shifts', 'Meadow Park', '#D97706'], ['school', 'School', '#7C3AED'], ['follow', 'Follow-ups', '#059669'], ['dates', 'Countdowns', '#DC2626']];
  function layerOn(k) { const v = setting('cal_layers_off') || []; return !v.includes(k); }

  async function saveSetting(key, value) {
    const D = ctx.D; D.settings = D.settings || [];
    const i = D.settings.findIndex((s) => s.key === key); const row = {user_id: ctx.user.id, key, value};
    if (i >= 0) D.settings[i] = row; else D.settings.push(row);
    await ctx.sb.from('settings').upsert(row, {onConflict: 'user_id,key'});
  }

  // ---------- Google ----------
  async function load(force) {
    if (!g() || !g().connected()) { draw(); return; }
    const n = days(); const from = S.start, to = addDays(S.start, n);
    const key = ymd(from) + n;
    if (S.busy || (!force && S.loadedFor === key)) { draw(); return; }
    S.busy = true; S.err = ''; draw();
    try {
      if (!S.cals.length) {
        const r = await g().fetch(CAL + 'users/me/calendarList?maxResults=50');
        S.cals = (r.items || []).filter((c) => !c.hidden).map((c) => ({id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor || '#2563EB', write: /owner|writer/.test(c.accessRole), primary: !!c.primary}));
      }
      const off = setting('cal_off') || [];
      const lists = await Promise.all(S.cals.filter((c) => !off.includes(c.id)).map(async (c) => {
        const r = await g().fetch(CAL + 'calendars/' + encodeURIComponent(c.id) + '/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=' + encodeURIComponent(from.toISOString()) + '&timeMax=' + encodeURIComponent(to.toISOString()));
        return (r.items || []).filter((e) => e.status !== 'cancelled').map((e) => ({
          id: e.id, cal: c, title: e.summary || '(no title)', allDay: !!(e.start && e.start.date),
          start: e.start.date ? parse(e.start.date) : new Date(e.start.dateTime), end: e.end.date ? parse(e.end.date) : new Date(e.end.dateTime),
          location: e.location || '', notes: e.description || '', attendees: (e.attendees || []).filter((a) => !a.self).map((a) => a.email), meet: e.hangoutLink || '', link: e.htmlLink, raw: e
        }));
      }));
      S.events = lists.flat(); S.loadedFor = key;
    } catch (e) { if (e.message !== 'signin') S.err = e.message; }
    S.busy = false; draw();
  }

  // ---------- HQ's own items ----------
  function hqItems() {
    const D = ctx.D, out = [];
    const t0 = S.start, t1 = addDays(S.start, days());
    const inRange = (d) => d >= t0 && d < t1;
    if (layerOn('shifts')) (D.shifts || []).filter((s) => !s.extra).forEach((s) => {
      const d = parse(s.date); if (!inRange(d)) return;
      if (s.start_time && s.end_time) {
        const [a, b] = [s.start_time, s.end_time].map((x) => x.split(':').map(Number));
        const st = new Date(d); st.setHours(a[0], a[1] || 0);
        const en = new Date(d); en.setHours(b[0], b[1] || 0); if (en <= st) en.setDate(en.getDate() + 1);
        out.push({hq: 'shifts', title: 'Meadow Park shift', start: st, end: en, notes: s.note || ''});
      } else out.push({hq: 'shifts', title: 'Meadow Park shift', allDay: true, start: d, end: addDays(d, 1)});
    });
    if (layerOn('school')) (D.tasks || []).filter((r) => !r.done).forEach((r) => { const d = parse(r.date); if (inRange(d)) out.push({hq: 'school', title: (r.kind ? r.kind + ': ' : '') + r.task, allDay: true, start: d, end: addDays(d, 1), notes: [r.unit, r.note].filter(Boolean).join(' · ')}); });
    if (layerOn('follow')) (D.leads || []).filter((l) => l.next_date && !/signed|lost/.test(l.stage)).forEach((l) => { const d = parse(l.next_date); if (inRange(d)) out.push({hq: 'follow', title: 'Follow up: ' + l.business, allDay: true, start: d, end: addDays(d, 1), notes: l.next_step || '', lead: l}); });
    if (layerOn('dates')) (D.countdowns || []).forEach((c) => { const d = new Date(c.at); if (inRange(d)) out.push({hq: 'dates', title: c.title, allDay: true, start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1)}); });
    return out;
  }
  const colorOf = (e) => (e.hq ? LAYERS.find((l) => l[0] === e.hq)[2] : e.cal.color);

  // ---------- Event form (new or edit) ----------
  function form(e, preset) {
    if (!g() || !g().connected()) { ctx.toast('Connect Google first (Mail or Calendar tab).'); return; }
    const writable = S.cals.filter((c) => c.write);
    if (!writable.length) { ctx.toast('No calendar you can write to was found.'); return; }
    const isNew = !e;
    const st = isNew ? preset.start : e.start, en = isNew ? preset.end : e.end;
    const allDay = isNew ? !!preset.allDay : e.allDay;
    const endShown = allDay ? addDays(en, -1) : en;
    const f = el('div', 'evform');
    f.append(U.field('Title', 'title', 'text', isNew ? '' : e.title, {placeholder: 'Add title'}));
    const calSel = U.field('Calendar', 'cal', 'select', null, {options: writable.map((c) => [c.id, c.name + (c.primary ? ' (main)' : '')])});
    calSel.querySelector('select').value = isNew ? (setting('cal_default') || (writable.find((c) => c.primary) || writable[0]).id) : e.cal.id;
    if (!isNew) calSel.querySelector('select').disabled = true;
    f.append(calSel);
    const ad = el('label', 'check'); const adc = el('input'); adc.type = 'checkbox'; adc.name = 'allday_cb'; adc.checked = allDay; ad.append(adc, document.createTextNode(' All day'));
    f.append(ad);
    const row = (label, d, t, nm) => { const r = el('div', 'two'); r.append(U.field(label, nm + 'd', 'date', ymd(d)), U.field('Time', nm + 't', 'time', pad(d.getHours()) + ':' + pad(d.getMinutes()))); return r; };
    const r1 = row('Starts', st, true, 's'), r2 = row('Ends', endShown, true, 'e');
    f.append(r1, r2);
    const times = () => f.querySelectorAll('input[type=time]').forEach((i) => { i.closest('.fld').hidden = adc.checked; });
    adc.addEventListener('change', times); times();
    // Keep the end an hour after the start when the start moves
    const sd = f.querySelector('[name=sd]'), stt = f.querySelector('[name=st]'), edd = f.querySelector('[name=ed]'), ett = f.querySelector('[name=et]');
    const shift = () => { const a = new Date(sd.value + 'T' + (stt.value || '09:00')); const b = new Date(a.getTime() + (window.HQ_PREFS ? +window.HQ_PREFS.get('eventLength') : 60) * 60000); edd.value = ymd(b); ett.value = pad(b.getHours()) + ':' + pad(b.getMinutes()); };
    sd.addEventListener('change', () => { if (edd.value < sd.value) edd.value = sd.value; }); stt.addEventListener('change', shift);
    f.append(U.field('Location', 'location', 'text', isNew ? '' : e.location));
    const att = U.field('People to invite', 'attendees', 'text', isNew ? (preset.attendees || '') : e.attendees.join(', '), {placeholder: 'comma, separated, emails'});
    att.append(el('span', 'muted small', 'Google emails everyone you invite when you press Save.'));
    f.append(att);
    f.append(U.field('Notes', 'notes', 'textarea', isNew ? (preset.notes || '') : e.notes, {rows: 3}));
    const mt = el('label', 'check'); const mtc = el('input'); mtc.type = 'checkbox'; mtc.name = 'meet_cb'; mtc.checked = !isNew && !!e.meet; mtc.disabled = !isNew && !!e.meet; mt.append(mtc, document.createTextNode(e && e.meet ? ' Has a Google Meet link' : ' Add a Google Meet link'));
    f.append(mt);
    if (e && e.meet) { const a = el('a', 'link', 'Open Meet'); a.href = e.meet; a.target = '_blank'; a.rel = 'noopener'; f.append(a); }
    const save = btn('Save', 'primary'), del = isNew ? null : btn('Delete', 'ghost');
    const sh = U.sheet(isNew ? 'New event' : 'Edit event', f, {actions: [save].concat(del ? [del] : [])});
    save.addEventListener('click', async () => {
      const v = U.values(f);
      if (!v.title) { ctx.toast('Add a title.'); return; }
      const body = {summary: v.title, location: v.location || undefined, description: v.notes || undefined};
      if (adc.checked) { body.start = {date: v.sd}; body.end = {date: ymd(addDays(parse(v.ed || v.sd), 1))}; }
      else {
        const a = new Date(v.sd + 'T' + (v.st || '09:00')), b = new Date((v.ed || v.sd) + 'T' + (v.et || '10:00'));
        if (b <= a) { ctx.toast('The end has to be after the start.'); return; }
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        body.start = {dateTime: a.toISOString(), timeZone: tz}; body.end = {dateTime: b.toISOString(), timeZone: tz};
      }
      const people = v.attendees.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /@/.test(x));
      body.attendees = people.map((email) => ({email}));
      if (mtc.checked && !(e && e.meet)) body.conferenceData = {createRequest: {requestId: 'hq-' + Date.now(), conferenceSolutionKey: {type: 'hangoutsMeet'}}};
      const cal = isNew ? v.cal : e.cal.id;
      const q = '?conferenceDataVersion=1&sendUpdates=' + (people.length ? 'all' : 'none');
      save.disabled = true; save.textContent = 'Saving…';
      try {
        if (isNew) { await g().fetch(CAL + 'calendars/' + encodeURIComponent(cal) + '/events' + q, {method: 'POST', body: JSON.stringify(body)}); saveSetting('cal_default', cal); }
        else await g().fetch(CAL + 'calendars/' + encodeURIComponent(cal) + '/events/' + encodeURIComponent(e.id) + q, {method: 'PATCH', body: JSON.stringify(body)});
        sh.close(); ctx.toast(isNew ? 'Added to your calendar.' : 'Saved.'); load(true);
      } catch (err) { save.disabled = false; save.textContent = 'Save'; ctx.toast(err.message === 'signin' ? 'Reconnect Google, then save again.' : 'Not saved: ' + err.message); }
    });
    if (del) del.addEventListener('click', async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Tap again to delete'; return; }
      try { await g().fetch(CAL + 'calendars/' + encodeURIComponent(e.cal.id) + '/events/' + encodeURIComponent(e.id) + '?sendUpdates=' + (e.attendees.length ? 'all' : 'none'), {method: 'DELETE'}); sh.close(); ctx.toast('Deleted.'); load(true); }
      catch (err) { ctx.toast(err.message); }
    });
  }
  function hqInfo(e) {
    const b = el('div');
    b.append(el('p', '', e.allDay ? e.start.toLocaleDateString('en-CA', {weekday: 'long', month: 'long', day: 'numeric'}) : e.start.toLocaleDateString('en-CA', {weekday: 'long', month: 'short', day: 'numeric'}) + ', ' + hm(e.start) + '–' + hm(e.end)));
    if (e.notes) b.append(el('p', 'muted', e.notes));
    b.append(el('p', 'muted small', 'This comes from HQ (' + LAYERS.find((l) => l[0] === e.hq)[1] + '), not Google Calendar. ' + (e.hq === 'shifts' ? 'Tell Claude about shift changes.' : e.hq === 'school' ? 'Tick it off on the School tab.' : e.hq === 'follow' ? 'Change it on the lead in Sales.' : '')));
    const acts = [];
    if (e.lead && window.HQ_EXTRAS) acts.push(btn('Open lead', 'primary', () => { sh.close(); window.HQ_EXTRAS.leadForm(e.lead); }));
    if (e.hq === 'shifts' && g() && g().connected()) acts.push(btn('Copy to Google Calendar', '', () => { sh.close(); form(null, {start: e.start, end: e.end, allDay: e.allDay}); setTimeout(() => { const t = document.querySelector('.evform [name=title]'); if (t) t.value = e.title; }, 60); }));
    const sh = U.sheet(e.title, b, {actions: acts, noFocus: true});
  }

  // ---------- Drawing ----------
  function lanes(list) {
    // Side-by-side columns for events that overlap
    list.sort((a, b) => a.start - b.start || b.end - a.end);
    let group = [], groupEnd = 0;
    const flush = () => { const cols = []; group.forEach((e) => { let i = cols.findIndex((end) => end <= e.start); if (i < 0) { i = cols.length; cols.push(0); } cols[i] = e.end; e._lane = i; }); group.forEach((e) => { e._lanes = cols.length; }); group = []; };
    list.forEach((e) => { if (group.length && e.start >= groupEnd) flush(); group.push(e); groupEnd = Math.max(groupEnd, +e.end); });
    flush();
    return list;
  }
  function draw() {
    const root = $('cal-root'); if (!root || !ctx || (S.drag && S.drag.started)) return;
    const n = days(), today = ymd(new Date());
    const out = [];
    // Header
    const head = el('div', 'cal-head');
    const nav = el('div', 'cal-nav');
    const last = addDays(S.start, n - 1);
    const label = S.start.toLocaleDateString('en-CA', {month: 'short', day: 'numeric'}) + ' – ' + last.toLocaleDateString('en-CA', S.start.getMonth() === last.getMonth() ? {day: 'numeric'} : {month: 'short', day: 'numeric'});
    nav.append(btn('‹', 'icon', () => { S.start = addDays(S.start, -n); load(); }), el('b', 'cal-label', label), btn('›', 'icon', () => { S.start = addDays(S.start, n); load(); }), btn('Today', 'mini', () => { S.start = n === 7 ? monday(new Date()) : new Date(new Date().setHours(0, 0, 0, 0)); load(); }));
    head.append(nav, btn('＋ New event', 'primary', () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); form(null, {start: s, end: new Date(s.getTime() + (window.HQ_PREFS ? +window.HQ_PREFS.get('eventLength') : 60) * 60000)}); }));
    out.push(head);
    // Layer chips
    const chips = el('div', 'chips left cal-chips');
    const off = setting('cal_off') || [], loff = setting('cal_layers_off') || [];
    S.cals.forEach((c) => { const ch = el('button', 'chip' + (off.includes(c.id) ? '' : ' on')); ch.type = 'button'; ch.append(el('i', 'sw', ''), document.createTextNode(c.name)); ch.firstChild.style.background = c.color; ch.addEventListener('click', async () => { const v = off.includes(c.id) ? off.filter((x) => x !== c.id) : off.concat(c.id); await saveSetting('cal_off', v); load(true); }); chips.append(ch); });
    LAYERS.forEach(([k, name, color]) => { const ch = el('button', 'chip' + (loff.includes(k) ? '' : ' on')); ch.type = 'button'; ch.append(el('i', 'sw', ''), document.createTextNode(name)); ch.firstChild.style.background = color; ch.addEventListener('click', async () => { const v = loff.includes(k) ? loff.filter((x) => x !== k) : loff.concat(k); await saveSetting('cal_layers_off', v); draw(); }); chips.append(ch); });
    out.push(chips);
    if (g() && !g().connected()) { const p = g().connectPanel(); p.classList.add('slim'); out.push(p); }
    if (S.err) out.push(el('p', 'msg', 'Calendar: ' + S.err));

    const all = S.events.concat(hqItems());
    const grid = el('div', 'cal'); grid.style.setProperty('--n', n);
    // Day headers
    const hdr = el('div', 'cal-row cal-days'); hdr.append(el('div', 'cal-gut', ''));
    for (let i = 0; i < n; i++) { const d = addDays(S.start, i); const c = el('div', 'cal-dh' + (ymd(d) === today ? ' today' : '')); c.append(el('span', '', ymd(d) === today ? 'Today' : d.toLocaleDateString('en-CA', {weekday: 'short'})), el('b', '', String(d.getDate()))); hdr.append(c); }
    grid.append(hdr);
    // All-day row
    const adr = el('div', 'cal-row cal-allday'); adr.append(el('div', 'cal-gut', 'all day'));
    for (let i = 0; i < n; i++) {
      const d = addDays(S.start, i), c = el('div', 'cal-adc');
      all.filter((e) => e.allDay && e.start <= d && e.end > d).forEach((e) => { const b = el('button', 'ev ad', e.title); b.type = 'button'; b.style.setProperty('--c', colorOf(e)); b.addEventListener('click', () => (e.hq ? hqInfo(e) : form(e))); c.append(b); });
      c.addEventListener('dblclick', (ev) => { if (ev.target === c) form(null, {start: d, end: addDays(d, 1), allDay: true}); });
      adr.append(c);
    }
    grid.append(adr);
    // Hour grid
    const body = el('div', 'cal-body');
    const inner = el('div', 'cal-row cal-hours'); inner.style.height = (H1 - H0) * ROW + 'px';
    const gut = el('div', 'cal-gut');
    for (let h = H0; h < H1; h++) { const l = el('span', 'hl', h === 0 ? '' : (h % 12 || 12) + (h < 12 ? 'am' : 'pm')); l.style.top = (h - H0) * ROW + 'px'; gut.append(l); }
    inner.append(gut);
    for (let i = 0; i < n; i++) {
      const d = addDays(S.start, i), col = el('div', 'cal-col' + (ymd(d) === today ? ' today' : ''));
      col.dataset.i = i;
      slotDrag(col, d);
      col.addEventListener('click', (ev) => {
        if (ev.target !== col) return;
        if (col._dragged) { col._dragged = false; return; }
        const y = ev.offsetY; const mins = Math.floor((y / ROW) * 2) * 30 + H0 * 60;
        const s = new Date(d); s.setHours(0, mins, 0, 0);
        form(null, {start: s, end: new Date(s.getTime() + (window.HQ_PREFS ? +window.HQ_PREFS.get('eventLength') : 60) * 60000)});
      });
      const evs = lanes(all.filter((e) => !e.allDay && e.start < addDays(d, 1) && e.end > d).map((e) => Object.assign({}, e, {start: e.start < d ? d : e.start, end: e.end > addDays(d, 1) ? addDays(d, 1) : e.end, orig: e})));
      evs.forEach((e) => {
        const top = ((e.start - d) / 3600000 - H0) * ROW, h = Math.max(20, (e.end - e.start) / 3600000 * ROW - 2);
        const b = el('button', 'ev' + (h < 34 ? ' short' : '')); b.type = 'button';
        b.style.top = top + 'px'; b.style.height = h + 'px'; b.style.left = (e._lane / e._lanes * 100) + '%'; b.style.width = (100 / e._lanes) + '%';
        b.style.setProperty('--c', colorOf(e));
        b.append(el('b', '', e.title), el('span', '', hm(e.orig.start) + (h >= 34 ? ' – ' + hm(e.orig.end) : '')));
        b.addEventListener('click', () => { if (b._dragged) { b._dragged = false; return; } if (e.hq) hqInfo(e.orig); else form(e.orig); });
        if (!e.hq && e.orig.cal && e.orig.cal.write) eventDrag(b, e.orig, i);
        col.append(b);
      });
      if (ymd(d) === today) { const now = new Date(); const ln = el('div', 'now-line'); ln.style.top = ((now.getHours() + now.getMinutes() / 60) - H0) * ROW + 'px'; col.append(ln); }
      inner.append(col);
    }
    body.append(inner); grid.append(body);
    out.push(grid);
    out.push(el('p', 'muted small', (window.matchMedia('(pointer: coarse)').matches ? 'Tap an empty slot to add an event. Hold an event, then drag to move it, or drag its bottom edge to change the end. ' : 'Click or drag across an empty slot to add an event. Drag an event to move it, or drag its bottom edge to change the end. ') + 'Tap an event to edit it. Shifts, school, follow-ups and countdowns come from HQ.' + (S.busy ? ' Loading…' : '')));
    const keepScroll = root.querySelector('.cal-body'); const st = keepScroll ? keepScroll.scrollTop : null;
    root.replaceChildren(...out);
    body.scrollTop = st != null ? st : (window.HQ_PREFS ? +window.HQ_PREFS.get('calScrollHour') : 7) * ROW;
  }

  // ---------- Dragging ----------
  // Drag an event to move it (any day, 15-minute steps); drag its bottom edge to change the end.
  // Drag across an empty slot to make an event that long. On a phone, hold an event for a moment first.
  const SNAP = 15;
  const snap = (mins) => Math.round(mins / SNAP) * SNAP;
  const colAt = (x, y) => document.elementsFromPoint(x, y).find((n) => n.classList && n.classList.contains('cal-col'));
  function holdScroll(on) { const b = document.querySelector('.cal-body'); if (b) b.style.touchAction = on ? 'none' : ''; }
  document.addEventListener('touchmove', (e) => { if (S.drag && S.drag.started) e.preventDefault(); }, {passive: false});

  function eventDrag(b, ev, i0) {
    const rs = el('span', 'ev-rs'); rs.setAttribute('aria-hidden', 'true'); b.append(rs);
    b.addEventListener('pointerdown', (pe) => {
      if (pe.button !== 0) return;
      const st = {mode: pe.target === rs ? 'resize' : 'move', x: pe.clientX, y: pe.clientY, started: false, days: 0, mins: 0, touch: pe.pointerType !== 'mouse'};
      const label = b.querySelector('span:not(.ev-rs)');
      const begin = () => { st.started = true; S.drag = st; b.classList.add('dragging'); holdScroll(true); try { b.setPointerCapture(pe.pointerId); } catch (x) { /* ignore */ } if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) { /* ignore */ } };
      if (st.touch) st.timer = setTimeout(begin, 300);
      const times = () => {
        const s0 = new Date(ev.start.getTime() + st.days * 864e5 + (st.mode === 'move' ? st.mins * 60000 : 0));
        let e0 = new Date(ev.end.getTime() + st.days * 864e5 + st.mins * 60000);
        if (e0 - s0 < SNAP * 60000) e0 = new Date(s0.getTime() + SNAP * 60000);
        return [s0, e0];
      };
      const move = (m) => {
        const dx = m.clientX - st.x, dy = m.clientY - st.y;
        if (!st.started) {
          if (st.touch) { if (Math.abs(dx) + Math.abs(dy) > 10) end(); return; }
          if (Math.abs(dx) + Math.abs(dy) < 5) return;
          begin();
        }
        m.preventDefault();
        st.mins = snap(dy / ROW * 60);
        if (st.mode === 'move') { const c = colAt(m.clientX, m.clientY); if (c) { st.days = +c.dataset.i - i0; if (b.parentNode !== c) c.append(b); } }
        const [s0, e0] = times();
        const day0 = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate());
        b.style.left = '0'; b.style.width = '100%';
        b.style.top = ((s0 - day0) / 3600000 - H0) * ROW + 'px';
        b.style.height = Math.max(20, (e0 - s0) / 3600000 * ROW - 2) + 'px';
        if (label) label.textContent = hm(s0) + ' – ' + hm(e0);
      };
      const up = async () => {
        const was = st.started; end();
        if (!was) return;
        b._dragged = true; setTimeout(() => { b._dragged = false; }, 400);
        if (!st.mins && !st.days) { draw(); return; }
        const [s0, e0] = times();
        const old = [ev.start, ev.end];
        ev.start = s0; ev.end = e0; draw();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
          await g().fetch(CAL + 'calendars/' + encodeURIComponent(ev.cal.id) + '/events/' + encodeURIComponent(ev.id) + '?sendUpdates=' + (ev.attendees.length ? 'all' : 'none'), {method: 'PATCH', body: JSON.stringify({start: {dateTime: s0.toISOString(), timeZone: tz}, end: {dateTime: e0.toISOString(), timeZone: tz}})});
          const n = ev.start.toLocaleDateString('en-CA', {weekday: 'short'}) + ' ' + hm(ev.start) + '–' + hm(ev.end);
          ctx.toast(ev.title + ' → ' + n + (ev.attendees.length ? '. Guests were told.' : ''));
        } catch (err) { ev.start = old[0]; ev.end = old[1]; draw(); ctx.toast(err.message === 'signin' ? 'Reconnect Google, then try again.' : 'Couldn’t move it: ' + err.message); }
      };
      function end() { clearTimeout(st.timer); S.drag = null; holdScroll(false); b.classList.remove('dragging'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); }
      const cancel = () => { const was = st.started; end(); if (was) draw(); };
      window.addEventListener('pointermove', move, {passive: false});
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    });
    b.addEventListener('contextmenu', (e) => { if (S.drag) e.preventDefault(); });
  }

  function slotDrag(col, d) {
    col.addEventListener('pointerdown', (pe) => {
      if (pe.target !== col || pe.button !== 0 || pe.pointerType !== 'mouse') return;
      if (!g() || !g().connected()) return;
      const rect = col.getBoundingClientRect();
      const at = (y) => Math.max(0, Math.min(24 * 60, snap((y - rect.top) / ROW * 60) + H0 * 60));
      const a = Math.floor(((pe.clientY - rect.top) / ROW * 60) / SNAP) * SNAP + H0 * 60;
      let b = a, ghost = null;
      const move = (m) => {
        b = at(m.clientY);
        if (Math.abs(b - a) < SNAP) return;
        if (!ghost) { ghost = el('div', 'ev ghost'); col.append(ghost); }
        const lo = Math.min(a, b), hi = Math.max(a, b);
        ghost.style.top = (lo / 60 - H0) * ROW + 'px'; ghost.style.height = (hi - lo) / 60 * ROW + 'px';
        ghost.textContent = hm(new Date(d.getTime() + lo * 60000)) + ' – ' + hm(new Date(d.getTime() + hi * 60000));
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        if (!ghost) return;
        ghost.remove(); col._dragged = true; setTimeout(() => { col._dragged = false; }, 400);
        const lo = Math.min(a, b), hi = Math.max(a, b);
        form(null, {start: new Date(d.getTime() + lo * 60000), end: new Date(d.getTime() + hi * 60000)});
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  }

  window.HQ_CAL = {
    render(c) { ctx = c; if (!S.start) S.start = days() === 7 ? monday(new Date()) : new Date(new Date().setHours(0, 0, 0, 0)); if (!$('calendar').hidden) load(); else draw(); },
    reload: () => { S.cals = []; S.loadedFor = ''; if (ctx) load(true); },
    redraw: () => { S.events = []; S.cals = []; S.loadedFor = ''; if (ctx) draw(); },
    newEvent: (preset) => form(null, preset),
    upcoming() {
      // Next few Google events today and tomorrow (for the Today tab)
      const now = new Date(), end = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 2);
      return S.events.filter((e) => !e.allDay && e.end > now && e.start < end).sort((a, b) => a.start - b.start).slice(0, 3).map((e) => ({title: e.title, when: (ymd(e.start) === ymd(now) ? '' : 'Tomorrow ') + hm(e.start), e}));
    },
    edit: (e) => form(e)
  };
  window.addEventListener('resize', () => { if (!ctx) return; const n = days(); if (n === 7 && S.start.getDay() !== 1) S.start = monday(S.start); clearTimeout(window.HQ_CAL._t); window.HQ_CAL._t = setTimeout(() => load(), 200); });
})();
