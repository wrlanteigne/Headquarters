// Ask Claude: a chat bubble in HQ. You type like a text message; HQ adds a short
// summary of what's going on (today, school, money, leads, what needs you) and opens
// Claude with it ready to send. Free: it uses your Claude app, not an API key.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  let ctx = null, box = null;
  const KEY = 'hq_chat';
  const hist = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const saveHist = (h) => { try { localStorage.setItem(KEY, JSON.stringify(h.slice(-60))); } catch (e) { /* ignore */ } };
  const withCtx = () => localStorage.getItem('hq_chat_ctx') !== '0';

  const QUICK = [
    ['Plan my day', 'Look at my day below and give me a simple plan for the rest of today: what to do first, and what to skip if I run out of time.'],
    ['What needs me?', 'From my HQ summary, what are the 3 most important things I should deal with right now, and why?'],
    ['Money check', 'How am I doing against my income goals this month? What would get me closer fastest?'],
    ['Follow-up email', 'Write a short, friendly follow-up email for my most overdue lead. Keep it under 80 words and signed William.'],
    ['Study help', 'Help me with my next school task. Explain it simply, then quiz me with 3 questions.'],
    ['Motivate me', 'I’m not feeling it today. Give me a short, honest push and one small thing to start with in the next 10 minutes.']
  ];

  // ---------- A short summary of HQ for Claude ----------
  function summary() {
    if (!ctx) return '';
    const D = ctx.D, C = ctx.C || {};
    const t = new Date(), ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const today = ymd(t), day = (s) => new Date(s + 'T12:00').toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'});
    const lines = [];
    lines.push('About me: William, 19, Whistler BC. I run Clearform Studio (websites for trades, $100–200/month plans) and ClearformSheets (Google Sheets templates on Etsy), work part-time at Meadow Park, and study Economics 12 (eBus) and RSA (BCIT).');
    lines.push('Now: ' + t.toLocaleString('en-CA', {weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'}).replace(/\.$/, '') + '.');
    const sh = (D.shifts || []).filter((s) => !s.extra && s.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 3);
    if (sh.length) lines.push('Next shifts: ' + sh.map((s) => day(s.date) + (s.start_time ? ' ' + s.start_time + '–' + (s.end_time || '') : '')).join('; ') + '.');
    const school = (D.tasks || []).filter((r) => !r.done && r.date <= today);
    if (school.length) lines.push('School due today or late: ' + school.slice(0, 6).map((r) => (r.date < today ? '[late] ' : '') + r.task).join('; ') + '.');
    const tests = (D.countdowns || []).filter((c) => new Date(c.at) > t).sort((a, b) => new Date(a.at) - new Date(b.at)).slice(0, 3);
    if (tests.length) lines.push('Coming up: ' + tests.map((c) => c.title + ' ' + new Date(c.at).toLocaleDateString('en-CA', {month: 'short', day: 'numeric'})).join('; ') + '.');
    const att = (D.attention || []).filter((a) => a.status === 'open').sort((a, b) => ['high', 'med', 'low'].indexOf(a.priority) - ['high', 'med', 'low'].indexOf(b.priority)).slice(0, 6);
    if (att.length) lines.push('Needs me: ' + att.map((a) => '(' + a.priority + ') ' + (a.title || a.item)).join('; ') + '.');
    const leads = (D.leads || []).filter((l) => l.next_date && l.next_date <= today && !/signed|lost/.test(l.stage));
    if (leads.length) lines.push('Lead follow-ups due: ' + leads.slice(0, 5).map((l) => l.business + (l.next_step ? ' (' + l.next_step + ')' : '') + (l.email ? ' <' + l.email + '>' : '')).join('; ') + '.');
    const pipe = {}; (D.leads || []).forEach((l) => { pipe[l.stage] = (pipe[l.stage] || 0) + 1; });
    if (Object.keys(pipe).length) lines.push('Pipeline: ' + Object.entries(pipe).map(([k, v]) => v + ' ' + k).join(', ') + '.');
    const m = (v) => (+v < 0 ? '−$' : '$') + Math.abs(Math.round(+v || 0)).toLocaleString('en-CA');
    if (C.thisMonthIncome != null) lines.push('Money this month: ' + m(C.thisMonthIncome) + ' income so far (projected ' + m(C.projectedMonth) + '), business profit ' + m(C.businessNet) + ', recurring ' + m(C.mrr) + '/month from ' + (C.active ? C.active.length : 0) + ' website clients. Goals: $5,000/month by Jan 1 2027, $10,000/month by Jul 1 2027, $20,000/month passive by end of 2027; $5,000/month business profit to move to Switzerland.');
    if (C.week) lines.push('Outreach this week: ' + C.week.contacted + ' contacted, ' + C.week.replies + ' replies, ' + C.week.previews + ' previews, ' + C.week.signed + ' signed.');
    const cal = window.HQ_CAL ? window.HQ_CAL.upcoming() : [];
    if (cal.length) lines.push('Calendar next: ' + cal.map((c) => c.when + ' ' + c.title).join('; ') + '.');
    return lines.join('\n');
  }
  function buildPrompt(text) {
    return withCtx() ? text + '\n\n---\nMy HQ right now (from my life app, for context):\n' + summary() + '\n---\nKeep your answer short and practical.' : text;
  }

  async function send(text) {
    text = String(text || '').trim(); if (!text) return;
    const prompt = buildPrompt(text);
    const h = hist(); h.push({me: true, text, at: Date.now()}); h.push({me: false, text: 'Opened in Claude with ' + (withCtx() ? 'your HQ info attached' : 'just your message') + '. Answer’s waiting there ↗', at: Date.now(), link: true, prompt});
    saveHist(h); draw();
    try { await navigator.clipboard.writeText(prompt); } catch (e) { /* clipboard not allowed */ }
    const w = window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt.slice(0, 7000)), '_blank', 'noopener');
    if (!w) U.notice('Pop-up blocked. Your message is copied: open Claude and paste it.');
  }

  function draw() {
    if (!box) return;
    const list = box.querySelector('.cb-list');
    const h = hist();
    list.replaceChildren();
    if (!h.length) {
      const hi = el('div', 'cb-msg them'); hi.append(el('p', '', 'Hey William 👋 Text me anything: a question, a plan, an email to write. I’ll open Claude with your HQ info so I already know your day, school, money and leads.'));
      list.append(hi);
    }
    h.forEach((m) => {
      const b = el('div', 'cb-msg ' + (m.me ? 'me' : 'them'));
      b.append(el('p', '', m.text));
      if (m.link) { const a = el('button', 'cb-link', 'Open again ↗'); a.type = 'button'; a.addEventListener('click', () => { window.open('https://claude.ai/new?q=' + encodeURIComponent(m.prompt.slice(0, 7000)), '_blank', 'noopener'); }); b.append(a); }
      b.append(el('span', 'cb-time', new Date(m.at).toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'})));
      list.append(b);
    });
    list.scrollTop = list.scrollHeight;
  }

  function open() {
    if (box) { box.classList.add('show'); setTimeout(() => box.querySelector('textarea').focus(), 50); return; }
    box = el('div', 'chatbox show'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Ask Claude');
    const head = el('div', 'cb-head');
    const who = el('div', 'cb-who'); who.append(el('span', 'cb-av', '✦'), (() => { const x = el('div'); x.append(el('b', '', 'Claude'), el('span', '', 'Opens in your Claude app · free')); return x; })());
    const menuB = el('button', 'cb-x', '⋯'); menuB.type = 'button'; menuB.setAttribute('aria-label', 'Chat options');
    menuB.addEventListener('click', () => {
      const pop = el('div', 'pop cb-pop');
      const opt = (label, fn) => { const b = el('button', '', label); b.type = 'button'; b.addEventListener('click', () => { pop.remove(); fn(); }); pop.append(b); };
      opt((withCtx() ? '✓ ' : '') + 'Include my HQ info', () => { localStorage.setItem('hq_chat_ctx', withCtx() ? '0' : '1'); U.notice(withCtx() ? 'HQ info will be included.' : 'Only your message will be sent.'); });
      opt('Preview what Claude sees', () => { const pre = el('pre', 'cb-pre', buildPrompt('(your message)')); U.sheet('What gets sent to Claude', pre, {wide: true, noFocus: true}); });
      opt('Clear this chat', () => { const old = hist(); saveHist([]); draw(); U.undoable('Chat cleared.', () => { saveHist(old); draw(); }); });
      document.body.append(pop); const r = menuB.getBoundingClientRect(); pop.style.top = (r.bottom + 4) + 'px'; pop.style.left = Math.max(8, r.right - 230) + 'px';
      setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } }), 0);
    });
    const x = el('button', 'cb-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close chat'); x.addEventListener('click', close);
    head.append(who, menuB, x);
    const list = el('div', 'cb-list');
    const chips = el('div', 'cb-chips');
    QUICK.forEach(([label, text]) => { const c = el('button', 'chip', label); c.type = 'button'; c.addEventListener('click', () => send(text)); chips.append(c); });
    const form = el('form', 'cb-form');
    const ta = el('textarea'); ta.rows = 1; ta.placeholder = 'Text Claude…'; ta.setAttribute('aria-label', 'Message to Claude');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } if (e.key === 'Escape') close(); });
    const go = el('button', 'cb-send', '↑'); go.type = 'submit'; go.setAttribute('aria-label', 'Send');
    form.append(ta, go);
    form.addEventListener('submit', (e) => { e.preventDefault(); const v = ta.value; ta.value = ''; ta.style.height = 'auto'; send(v); });
    box.append(head, list, chips, form);
    document.body.append(box);
    draw();
    setTimeout(() => ta.focus(), 50);
  }
  function close() { if (box) box.classList.remove('show'); }
  function toggle() { if (box && box.classList.contains('show')) close(); else open(); }

  // The bubble button
  const bub = el('button', 'chat-bubble'); bub.type = 'button'; bub.setAttribute('aria-label', 'Ask Claude'); bub.title = 'Ask Claude (⌘J)';
  bub.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  bub.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); if (ctx && !$('app').hidden) toggle(); } });

  window.HQ_CHAT = {
    render(c) { ctx = c; if (!bub.isConnected && $('app')) $('app').append(bub); },
    open, send, summary
  };
})();
