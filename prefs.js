// Settings: every HQ preference lives here. Saved to your account (works on
// every device) and cached on this device so the look applies instantly.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  let ctx = null;

  const DEFAULTS = {
    name: 'William', place: 'Whistler, BC',
    theme: 'light', accent: '#2563EB', textSize: 'm', compact: false, boot: true, motion: true,
    startTab: 'last', hiddenTabs: [],
    todayPanels: {learn: true, quote: true, status: true, week: true, inbox: true, calendar: true, follow: true, needs: true, outreach: true},
    goalFocusHours: 10, goalGym: 5, goalSchool: 10,
    mailRefresh: 3, mailView: 'important', mailMarkRead: true, mailSignature: '', mailNotify: false,
    weekStart: 1, eventLength: 60, calScrollHour: 7,
    focusBreak: 10, focusSound: true, focusVibrate: true,
    autoLock: 0
  };
  const ACCENTS = [['#2563EB', 'Blue'], ['#7C3AED', 'Violet'], ['#059669', 'Green'], ['#EA580C', 'Orange'], ['#DB2777', 'Pink'], ['#0891B2', 'Teal'], ['#18181B', 'Graphite']];
  const TABS = [['today', 'Today'], ['goals', 'Goals'], ['learn', 'Learn'], ['mail', 'Mail'], ['calendar', 'Calendar'], ['sales', 'People'], ['docs', 'Docs'], ['school', 'School'], ['money', 'Money'], ['subs', 'Subscriptions'], ['automations', 'Automations']];

  let P = Object.assign({}, DEFAULTS, cached());
  function cached() { try { return JSON.parse(localStorage.getItem('hq_prefs')) || {}; } catch (e) { return {}; } }
  const get = (k) => (P[k] === undefined ? DEFAULTS[k] : P[k]);

  // ---------- Apply to the page ----------
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '); };
  let mq = null;
  function apply() {
    const root = document.documentElement, b = document.body;
    const dark = get('theme') === 'dark' || (get('theme') === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    b.classList.toggle('dark', dark);
    const acc = get('accent'), useAcc = dark && acc === '#18181B' ? '#E4E4E7' : acc;
    root.style.setProperty('--cyan', useAcc); root.style.setProperty('--acc-rgb', hexRgb(useAcc));
    b.dataset.size = get('textSize');
    b.classList.toggle('compact', !!get('compact'));
    b.classList.toggle('no-motion', !get('motion'));
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = dark ? '#0B0B0D' : '#111113';
    // Sidebar tabs
    const hid = get('hiddenTabs') || [];
    document.querySelectorAll('.tab[data-tab]').forEach((t) => { t.hidden = hid.includes(t.dataset.tab) && t.dataset.tab !== 'settings'; });
    const on = document.querySelector('.tab.on'); if (on && on.hidden) { const t = document.querySelector('.tab[data-tab="today"]'); if (t) t.click(); }
    // Today panels
    const tp = Object.assign({}, DEFAULTS.todayPanels, get('todayPanels'));
    const show = (id, v) => { const n = $(id); if (n) n.classList.toggle('pref-off', !v); };
    show('hype', tp.quote); show('status', tp.status); show('week-strip', tp.week); show('today-inbox', tp.inbox); show('today-cal', tp.calendar); show('today-follow', tp.follow); show('needs', tp.needs); show('outreach', tp.outreach); show('today-learn', tp.learn);
    // Name
    const brand = document.querySelector('.brand b'); if (brand) brand.textContent = get('name') + '’s HQ';
    const sub = document.querySelector('.brand div span'); if (sub) sub.textContent = get('place');
    document.title = get('name') + '’s HQ';
    if (!mq) { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', () => { if (get('theme') === 'auto') apply(); }); }
  }
  // Boot screen and theme before anything else draws
  try { if (!get('boot') || !get('motion')) { const bt = $('boot'); if (bt) bt.hidden = true; } } catch (e) { /* ignore */ }
  if (document.body) apply(); else document.addEventListener('DOMContentLoaded', apply);

  async function set(k, v) {
    P[k] = v;
    try { localStorage.setItem('hq_prefs', JSON.stringify(P)); } catch (e) { /* ignore */ }
    apply();
    if (ctx) {
      const D = ctx.D; D.settings = D.settings || [];
      const row = {user_id: ctx.user.id, key: 'prefs', value: P};
      const i = D.settings.findIndex((x) => x.key === 'prefs'); if (i >= 0) D.settings[i] = row; else D.settings.push(row);
      clearTimeout(set.t);
      set.t = setTimeout(async () => { const {error} = await ctx.sb.from('settings').upsert(row, {onConflict: 'user_id,key'}); if (error) ctx.toast('Setting not saved: ' + error.message); }, 400);
      if (!set.quiet) ctx.rerender();
    }
  }

  // ---------- Auto-lock ----------
  let lastAct = Date.now();
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.addEventListener(e, () => { lastAct = Date.now(); }, {passive: true}));
  setInterval(() => { const m = +get('autoLock'); if (m && ctx && !$('app').hidden && Date.now() - lastAct > m * 60000) { lastAct = Date.now(); const s = $('signout'); if (s) s.click(); } }, 30000);

  // ---------- Controls ----------
  function toggle(label, hint, key, sub) {
    const row = el('div', 'srow');
    const t = el('div', 'srow-t'); t.append(el('b', '', label)); if (hint) t.append(el('span', '', hint));
    const cur = sub ? Object.assign({}, DEFAULTS[key], get(key))[sub] : get(key);
    const sw = el('button', 'switch' + (cur ? ' on' : '')); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(!!cur)); sw.setAttribute('aria-label', label);
    sw.addEventListener('click', () => {
      const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); sw.setAttribute('aria-checked', String(v));
      if (sub) { const o = Object.assign({}, DEFAULTS[key], get(key)); o[sub] = v; set(key, o); } else set(key, v);
    });
    row.append(t, sw); return row;
  }
  function seg(label, hint, key, options, onPick) {
    const row = el('div', 'srow');
    const t = el('div', 'srow-t'); t.append(el('b', '', label)); if (hint) t.append(el('span', '', hint));
    const g = el('div', 'seg');
    options.forEach(([v, l]) => { const b = el('button', String(get(key)) === String(v) ? 'on' : '', l); b.type = 'button'; b.addEventListener('click', () => { g.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); set(key, v); if (onPick) onPick(v); }); g.append(b); });
    row.append(t, g); return row;
  }
  function select(label, hint, key, options) {
    const row = el('div', 'srow');
    const t = el('div', 'srow-t'); t.append(el('b', '', label)); if (hint) t.append(el('span', '', hint));
    const s = el('select', 'sel'); options.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; s.append(o); }); s.value = String(get(key)); s.setAttribute('aria-label', label);
    s.addEventListener('change', () => { const v = options.find((o) => String(o[0]) === s.value)[0]; set(key, v); });
    row.append(t, s); return row;
  }
  function text(label, hint, key, opts) {
    const row = el('div', 'srow' + (opts && opts.area ? ' col' : ''));
    const t = el('div', 'srow-t'); t.append(el('b', '', label)); if (hint) t.append(el('span', '', hint));
    const i = el(opts && opts.area ? 'textarea' : 'input', 'sin'); if (!(opts && opts.area)) i.type = (opts && opts.type) || 'text'; else i.rows = 3;
    i.value = get(key); i.setAttribute('aria-label', label); if (opts && opts.placeholder) i.placeholder = opts.placeholder;
    i.addEventListener('change', () => { let v = i.value; if (opts && opts.type === 'number') { v = Math.max(opts.min || 0, Math.min(opts.max || 999, +v || 0)); i.value = v; } set.quiet = true; set(key, v); set.quiet = false; ctx.toast('Saved.'); ctx.rerender(); });
    row.append(t, i); return row;
  }
  function action(label, hint, b) { const row = el('div', 'srow'); const t = el('div', 'srow-t'); t.append(el('b', '', label)); if (hint) t.append(el('span', '', hint)); row.append(t, b); return row; }
  const section = (id, title, desc, rows) => { const s = el('section', 'sset'); s.id = 'set-' + id; s.append(el('h3', '', title)); if (desc) s.append(el('p', 'muted small', desc)); const box = el('div', 'sbox'); box.append(...rows.filter(Boolean)); s.append(box); return s; };
  const setting = (k) => { const r = (ctx.D.settings || []).find((x) => x.key === k); return r ? r.value : null; };
  async function saveSetting(key, value) {
    const D = ctx.D; const row = {user_id: ctx.user.id, key, value};
    const i = D.settings.findIndex((x) => x.key === key); if (i >= 0) D.settings[i] = row; else D.settings.push(row);
    await ctx.sb.from('settings').upsert(row, {onConflict: 'user_id,key'});
  }

  // ---------- The page ----------
  let current = 'profile';
  function render() {
    const root = $('settings-root'); if (!root || !ctx) return;
    if (root.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; // don't wipe what you're typing
    const g = window.HQ_MAIL && window.HQ_MAIL.google;
    const sections = [
      ['profile', 'Profile', section('profile', 'Profile', 'How HQ greets you.', [
        text('Your name', 'Used in the greeting and the sidebar', 'name'),
        text('Location', 'Shown under your name', 'place')
      ])],
      ['appearance', 'Appearance', section('appearance', 'Appearance', 'How HQ looks on this account, on every device.', [
        seg('Theme', 'Auto follows your Mac or phone', 'theme', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]),
        (() => {
          const row = el('div', 'srow'); const t = el('div', 'srow-t'); t.append(el('b', '', 'Accent colour'), el('span', '', 'Buttons, highlights and progress bars'));
          const sw = el('div', 'swatches');
          ACCENTS.forEach(([c, n]) => { const b = el('button', 'swatch' + (get('accent') === c ? ' on' : '')); b.type = 'button'; b.style.background = c; b.title = n; b.setAttribute('aria-label', n); b.addEventListener('click', () => { sw.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); b.classList.add('on'); set('accent', c); }); sw.append(b); });
          row.append(t, sw); return row;
        })(),
        seg('Text size', null, 'textSize', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]),
        toggle('Compact layout', 'Tighter spacing so more fits on screen', 'compact'),
        toggle('Start-up animation', 'The loading screen when HQ opens', 'boot'),
        toggle('Animations', 'Turn off for a calmer, faster feel', 'motion')
      ])],
      ['today', 'Today page', section('today', 'Today page', 'Pick what shows on Today.', [
        toggle('Daily quote', null, 'todayPanels', 'quote'),
        toggle('Countdowns bar', 'Next shift, payday and trips', 'todayPanels', 'status'),
        toggle('This week', 'Focus, gym, outreach and school', 'todayPanels', 'week'),
        toggle('Inbox', 'Important unread email', 'todayPanels', 'inbox'),
        toggle('Calendar', 'Your next events', 'todayPanels', 'calendar'),
        toggle('Follow-ups due', 'Leads to contact today', 'todayPanels', 'follow'),
        toggle('Today’s lesson', 'Your next Founder School lesson', 'todayPanels', 'learn'),
        toggle('Needs you', 'Things Claude flagged', 'todayPanels', 'needs'),
        toggle('Outreach counter', null, 'todayPanels', 'outreach'),
        text('Focus goal', 'Hours of focus a week', 'goalFocusHours', {type: 'number', min: 1, max: 80}),
        text('Gym goal', 'Sessions a week', 'goalGym', {type: 'number', min: 1, max: 14}),
        text('School goal', 'Tasks a week', 'goalSchool', {type: 'number', min: 1, max: 100})
      ])],
      ['sidebar', 'Sidebar', section('sidebar', 'Sidebar', 'Hide pages you don’t use. Settings always stays.', [
        select('Open HQ on', 'The page you see first', 'startTab', [['last', 'Where I left off']].concat(TABS)),
        ...TABS.filter(([k]) => k !== 'today').map(([k, l]) => {
          const row = el('div', 'srow'); const t = el('div', 'srow-t'); t.append(el('b', '', l));
          const on = !(get('hiddenTabs') || []).includes(k);
          const sw = el('button', 'switch' + (on ? ' on' : '')); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(on)); sw.setAttribute('aria-label', 'Show ' + l);
          sw.addEventListener('click', () => { const v = !sw.classList.contains('on'); sw.classList.toggle('on', v); sw.setAttribute('aria-checked', String(v)); const h = (get('hiddenTabs') || []).filter((x) => x !== k); if (!v) h.push(k); set('hiddenTabs', h); });
          row.append(t, sw); return row;
        })
      ])],
      ['mail', 'Mail', section('mail', 'Mail', null, [
        select('Check for new mail', null, 'mailRefresh', [[1, 'Every minute'], [3, 'Every 3 minutes'], [10, 'Every 10 minutes'], [0, 'Only when I refresh']]),
        seg('Open Mail on', null, 'mailView', [['important', 'Important'], ['all', 'All'], ['unread', 'Unread']]),
        toggle('Mark as read when opened', null, 'mailMarkRead'),
        text('Signature', 'Added to new emails you write', 'mailSignature', {area: true, placeholder: 'William\nClearform Studio · 604-…'}),
        (() => {
          const rows = el('div');
          [['mail_vip', 'Always important'], ['mail_mute', 'Muted senders']].forEach(([k, label]) => {
            const list = setting(k) || [];
            const row = el('div', 'srow col'); const t = el('div', 'srow-t'); t.append(el('b', '', label), el('span', '', list.length ? 'Tap one to remove it' : 'None yet. Open an email to add a sender.'));
            const chips = el('div', 'chips left');
            list.forEach((e) => { const c = el('button', 'chip on', e + '  ✕'); c.type = 'button'; c.setAttribute('aria-label', 'Remove ' + e); c.addEventListener('click', async () => { await saveSetting(k, list.filter((x) => x !== e)); render(); }); chips.append(c); });
            row.append(t, chips); rows.append(row);
          });
          return rows;
        })()
      ])],
      ['calendar', 'Calendar', section('calendar', 'Calendar', null, [
        seg('Week starts on', null, 'weekStart', [[1, 'Monday'], [0, 'Sunday']]),
        select('New events last', null, 'eventLength', [[30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours']]),
        select('Scroll the day to', 'Where the calendar opens', 'calScrollHour', [[5, '5 am'], [6, '6 am'], [7, '7 am'], [8, '8 am'], [9, '9 am'], [12, 'Noon']])
      ])],
      ['school', 'School', section('school', 'School', null, [
        action('Course links', 'One-tap links to eBus, BCIT and your teacher', btn('Edit links', 'mini', () => { const b = document.querySelector('.tab[data-tab="school"]'); if (b) b.click(); setTimeout(() => { const e = document.querySelector('.qlink.edit'); if (e) e.click(); }, 60); }))
      ])],
      ['focus', 'Focus', section('focus', 'Focus mode', null, [
        select('Break after a block', null, 'focusBreak', [[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes']]),
        toggle('Sound when time’s up', null, 'focusSound'),
        toggle('Vibrate (phone)', null, 'focusVibrate')
      ])],
      ['notifications', 'Notifications', section('notifications', 'Notifications', 'Alerts on this device while HQ is open.', [
        (() => {
          const supported = 'Notification' in window;
          const row = el('div', 'srow'); const t = el('div', 'srow-t'); t.append(el('b', '', 'Important new email'), el('span', '', supported ? (Notification.permission === 'denied' ? 'Blocked in your browser settings' : 'A pop-up when a client, lead, school or money email arrives') : 'Not supported in this browser'));
          const on = !!get('mailNotify') && supported && Notification.permission === 'granted';
          const sw = el('button', 'switch' + (on ? ' on' : '')); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(on)); sw.setAttribute('aria-label', 'Important new email');
          sw.disabled = !supported || Notification.permission === 'denied';
          sw.addEventListener('click', async () => {
            let v = !sw.classList.contains('on');
            if (v && Notification.permission !== 'granted') { const r = await Notification.requestPermission(); v = r === 'granted'; if (!v) ctx.toast('Notifications weren’t allowed.'); }
            sw.classList.toggle('on', v); sw.setAttribute('aria-checked', String(v)); set('mailNotify', v);
            if (v) try { new Notification('HQ', {body: 'You’ll get a pop-up for important new email.', icon: 'icons/icon-192.png'}); } catch (e) { /* ignore */ }
          });
          row.append(t, sw); return row;
        })()
      ])],
      ['connections', 'Connections', section('connections', 'Connections', null, [
        (() => {
          const ok = g && g.connected();
          const b = ok ? btn('Disconnect', 'mini', () => { const d = document.querySelector('#mail-root .link'); const s = Array.from(document.querySelectorAll('#mail-root button')).find((x) => /Disconnect/.test(x.textContent)); if (s) s.click(); else ctx.toast('Open Mail to disconnect.'); setTimeout(render, 300); }) : btn(g && g.ready() ? 'Connect' : 'Set up', 'mini primary', () => { const t = document.querySelector('.tab[data-tab="mail"]'); if (t) t.click(); });
          return action('Google (Gmail + Calendar)', ok ? '● Connected' : g && g.ready() ? 'Not connected right now' : 'Not set up', b);
        })(),
        (() => {
          const cid = setting('google_client_id') || '';
          const row = el('div', 'srow col'); const t = el('div', 'srow-t'); t.append(el('b', '', 'Google Client ID'), el('span', '', 'Only change this if you make a new one in Google Cloud'));
          const i = el('input', 'sin'); i.value = cid; i.setAttribute('aria-label', 'Google Client ID');
          i.addEventListener('change', async () => { await saveSetting('google_client_id', i.value.trim() || null); ctx.toast('Saved.'); });
          row.append(t, i); return row;
        })(),
        action('Morning refresh', (() => { const l = (ctx.D.log || [])[0]; return l ? 'Claude last updated HQ on ' + new Date(l.date + 'T12:00').toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'}) : 'No runs yet'; })(), btn('See activity', 'mini', () => { const t = document.querySelector('.tab[data-tab="automations"]'); if (t) t.click(); }))
      ])],
      ['security', 'Security', section('security', 'Security', null, [
        select('Lock automatically', 'After this long with no taps or typing', 'autoLock', [[0, 'Never'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes'], [60, 'After 1 hour']]),
        (() => {
          const row = el('div', 'srow col'); const t = el('div', 'srow-t'); t.append(el('b', '', 'Change HQ password'), el('span', '', 'At least 8 characters'));
          const f = el('form', 'pwrow');
          const a = el('input', 'sin'); a.type = 'password'; a.placeholder = 'New password'; a.autocomplete = 'new-password'; a.setAttribute('aria-label', 'New password');
          const c = el('input', 'sin'); c.type = 'password'; c.placeholder = 'Type it again'; c.autocomplete = 'new-password'; c.setAttribute('aria-label', 'Confirm new password');
          const s = btn('Change', 'mini primary'); s.type = 'submit';
          f.append(a, c, s);
          f.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (a.value.length < 8) { ctx.toast('Use at least 8 characters.'); return; }
            if (a.value !== c.value) { ctx.toast('The two passwords don’t match.'); return; }
            s.disabled = true;
            const {error} = await ctx.sb.auth.updateUser({password: a.value});
            s.disabled = false; a.value = ''; c.value = '';
            ctx.toast(error ? 'Not changed: ' + error.message : 'Password changed. Use it next time you unlock.');
          });
          row.append(t, f); return row;
        })(),
        action('Lock HQ now', null, btn('Lock', 'mini', () => $('signout').click()))
      ])],
      ['data', 'Data', section('data', 'Your data', null, [
        action('Download everything', 'All your HQ data as one file (JSON)', btn('Download', 'mini', () => {
          const D = ctx.D, out = {exported: new Date().toISOString()};
          Object.keys(D).forEach((k) => { if (k !== 'settings' || true) out[k] = D[k]; });
          (out.settings || []).forEach((s) => { if (s.key === 'google_client_id') s.value = '(hidden)'; });
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], {type: 'application/json'})); a.download = 'hq-data-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 500);
        })),
        action('Reload HQ', 'Fetch the newest version and data', btn('Reload', 'mini', async () => { try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (e) { /* ignore */ } location.reload(); })),
        action('Reset settings', 'Put every option on this page back to how it started', (() => { const b = btn('Reset', 'mini'); b.addEventListener('click', () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Tap again to reset'; return; } const before = Object.assign({}, P); P = Object.assign({}, DEFAULTS); set('name', DEFAULTS.name); render(); window.HQ_UI.undoable('Settings reset.', () => { P = before; set('name', before.name); render(); }); }); return b; })())
      ])],
      ['about', 'About', section('about', 'About HQ', null, [
        action('How HQ works', 'A quick tour of every page', btn('Open guide', 'mini', () => window.HQ_EXTRAS && window.HQ_EXTRAS.guide())),
        (() => {
          const row = el('div', 'srow col'); const t = el('div', 'srow-t'); t.append(el('b', '', 'Keyboard shortcuts'));
          const k = el('div', 'keys');
          [['⌘K', 'Search anything'], ['⌘J', 'Ask Claude'], ['N', 'Quick add'], ['?', 'Guide'], ['⌘B / ⌘I / ⌘U', 'Bold, italic, underline in Docs'], ['/', 'Insert menu in Docs'], ['⌘K in a doc', 'Add a link'], ['Esc', 'Close a pop-up']].forEach(([a, b]) => { const r = el('div'); r.append(el('kbd', '', a), el('span', '', b)); k.append(r); });
          row.append(t, k); return row;
        })(),
        action('Install HQ', 'iPhone: Safari → Share → Add to Home Screen. Mac: Chrome → Install page as app.', el('span'))
      ])]
    ];
    const head = el('div', 'page-h'); const ht = el('div'); ht.append(el('h2', 'big', 'Settings'), el('p', 'muted small', 'Changes save straight away and sync to all your devices.')); head.append(ht);
    const nav = el('nav', 'snav'); nav.setAttribute('aria-label', 'Settings sections');
    sections.forEach(([k, label]) => { const b = el('button', current === k ? 'on' : '', label); b.type = 'button'; b.addEventListener('click', () => { current = k; nav.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); const s = $('set-' + k); if (s) s.scrollIntoView({behavior: get('motion') ? 'smooth' : 'auto', block: 'start'}); }); nav.append(b); });
    const body = el('div', 'sbody'); sections.forEach((s) => body.append(s[2]));
    const wrap = el('div', 'slayout'); wrap.append(nav, body);
    root.replaceChildren(head, wrap);
  }

  window.HQ_PREFS = {
    get, set, apply, DEFAULTS,
    render(c) {
      const first = !ctx; ctx = c;
      const r = (c.D.settings || []).find((x) => x.key === 'prefs');
      if (r && r.value && first) { P = Object.assign({}, DEFAULTS, r.value); try { localStorage.setItem('hq_prefs', JSON.stringify(P)); } catch (e) { /* ignore */ } }
      apply();
      if (first) { const st = get('startTab'); if (st && st !== 'last') { const t = document.querySelector('.tab[data-tab="' + st + '"]'); if (t && !t.hidden && !t.classList.contains('on')) setTimeout(() => t.click(), 0); } }
      render();
    }
  };
})();
