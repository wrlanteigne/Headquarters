// Mail tab: live Gmail inside HQ. Sorts mail by priority, reads threads,
// replies, writes new mail, and shows the drafts Claude writes each morning.
// Gmail is reached straight from this page with a Google sign-in; nothing
// about your mail is stored in HQ's database.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  const C = window.HQ_CONFIG;
  const API = 'https://gmail.googleapis.com/gmail/v1/users/me/';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';

  let ctx = null, client = null, gisLoading = null;
  const M = {status: 'idle', list: [], drafts: [], err: '', q: '', view: (window.HQ_PREFS && window.HQ_PREFS.get('mailView')) || 'important', folder: 'inbox', me: null, loadedAt: 0, sel: new Set(), openId: null};
  const FOLDERS = {inbox: ['Inbox', 'in:inbox newer_than:30d'], starred: ['Starred', 'is:starred'], sent: ['Sent', 'in:sent newer_than:30d']};
  const wide = () => window.matchMedia('(min-width: 900px)').matches;

  // ---------- Token (lasts about an hour, kept on this device only) ----------
  const tok = {
    get() { try { const t = JSON.parse(localStorage.getItem('hq_gtoken')); return t && t.exp > Date.now() ? t.t : null; } catch (e) { return null; } },
    set(t, secs) { try { localStorage.setItem('hq_gtoken', JSON.stringify({t, exp: Date.now() + (secs - 60) * 1000})); } catch (e) { /* storage unavailable */ } },
    clear() { try { localStorage.removeItem('hq_gtoken'); } catch (e) { /* storage unavailable */ } }
  };
  const setting = (k) => { const r = ctx && (ctx.D.settings || []).find((s) => s.key === k); return r ? r.value : null; };
  const clientId = () => setting('google_client_id') || C.googleClientId || '';

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => { gisLoading = null; rej(new Error('Could not load Google sign-in.')); };
      document.head.append(s);
    });
    return gisLoading;
  }
  async function connect(silent) {
    await loadGis();
    return new Promise((res, rej) => {
      client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: SCOPE, login_hint: C.ownerEmail, prompt: silent ? 'none' : '',
        callback: (r) => { if (r.error) return rej(new Error(r.error_description || r.error)); tok.set(r.access_token, +r.expires_in || 3600); res(); },
        error_callback: (e) => rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in window was closed.' : (e && e.message) || 'Sign-in failed.'))
      });
      client.requestAccessToken();
    });
  }

  const api = (path, opts) => gfetch(API + path, opts);
  async function gfetch(url, opts) {
    const t = tok.get();
    if (!t) { M.status = 'signin'; throw new Error('signin'); }
    const r = await fetch(url, Object.assign({}, opts, {headers: Object.assign({Authorization: 'Bearer ' + t}, opts && opts.body ? {'Content-Type': 'application/json'} : {})}));
    if (r.status === 401) { tok.clear(); M.status = 'signin'; throw new Error('signin'); }
    if (!r.ok) { let m = r.status + ''; try { const j = await r.json(); m = (j.error && j.error.message) || m; } catch (e) { /* not json */ } throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({length: Math.min(n, items.length)}, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { if (e.message === 'signin') throw e; out[k] = null; } } }));
    return out;
  }

  // ---------- Decoding ----------
  const b64d = (s) => { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(u); };
  const b64e = (s) => { const u = new TextEncoder().encode(s); let bin = ''; u.forEach((c) => { bin += String.fromCharCode(c); }); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const hdr = (p, name) => { const h = ((p && p.headers) || []).find((x) => x.name.toLowerCase() === name.toLowerCase()); return h ? h.value : ''; };
  function who(from) {
    const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
    const email = (m ? m[2] : from).trim().toLowerCase();
    const name = (m && m[1].trim()) || email.split('@')[0];
    return {name, email, domain: email.split('@')[1] || ''};
  }
  function bodyOf(payload) {
    let html = '', text = '';
    (function walk(p) {
      if (!p) return;
      if (p.mimeType === 'text/html' && p.body && p.body.data && !html) html = b64d(p.body.data);
      else if (p.mimeType === 'text/plain' && p.body && p.body.data && !text) text = b64d(p.body.data);
      (p.parts || []).forEach(walk);
    })(payload);
    return {html, text};
  }
  const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + btoa(String.fromCharCode(...new TextEncoder().encode(s))) + '?=');

  // ---------- Priority ----------
  // High: clients, leads, the auto shops, school, work, money and account problems.
  // Low: promotions, social, newsletters and no-reply senders.
  const MONEY = /\b(invoice|payment|paid|payout|e-?transfer|interac|deposit|refund|receipt|you made a sale|new order|order #|charge)\b/i;
  const URGENT = /\b(urgent|asap|today|deadline|overdue|failed|declined|suspend|security alert|sign-?in attempt|verify|action required|interview|contract|sign|quote|estimate|question)\b/i;
  const SCHOOL = ['bcit.ca', 'sd48.bc.ca', 'learn.bcit.ca'];
  const WORK = ['whistler.ca'];
  const MONEY_SENDERS = ['etsy.com', 'stripe.com', 'interac.ca', 'payments.interac.ca', 'questrade.com', 'paypal.com'];
  function score(m) {
    const D = ctx.D, f = m.who, s = m.subject + ' ' + m.snippet;
    const vip = setting('mail_vip') || [], mute = setting('mail_mute') || [];
    const hit = (list) => list.some((x) => x && (f.email === x || f.domain === x || f.domain.endsWith('.' + x)));
    const tags = [];
    const leadMail = (D.leads || []).map((l) => (l.email || '').toLowerCase()).filter(Boolean);
    const leadDom = leadMail.map((e) => e.split('@')[1]).filter((d) => d && !/gmail|outlook|hotmail|yahoo|icloud|shaw|telus/.test(d));
    if (leadMail.includes(f.email) || leadDom.includes(f.domain)) tags.push('Lead');
    if (hit(C.shopDomains || [])) tags.push('Shop');
    if (hit(SCHOOL)) tags.push('School');
    if (hit(WORK)) tags.push('Work');
    if (hit(MONEY_SENDERS) || MONEY.test(s)) tags.push('Money');
    const noreply = /no-?reply|do-?not-?reply|notifications?@|mailer|news(letter)?@|info@|marketing/.test(f.email);
    const promo = m.labels.some((l) => /CATEGORY_(PROMOTIONS|SOCIAL|FORUMS)/.test(l));
    let p = 'normal';
    if (hit(mute)) p = 'low';
    else if (hit(vip) || tags.some((t) => t !== 'Money')) p = 'high';
    else if (tags.includes('Money') && !promo) p = 'high';
    else if (URGENT.test(m.subject) && !promo && !(m.unsub && noreply)) p = 'high';
    else if (promo || (m.unsub && !m.labels.includes('IMPORTANT')) || (noreply && !m.labels.includes('IMPORTANT'))) p = 'low';
    else if (m.labels.includes('IMPORTANT') && !noreply) p = 'high';
    if (hit(vip)) tags.unshift('VIP');
    return {p, tags};
  }

  // ---------- Loading ----------
  async function load() {
    if (M.busy) return; M.busy = true; M.err = '';
    draw();
    try {
      if (!M.me) M.me = (await api('profile')).emailAddress.toLowerCase();
      const q = M.q ? M.q : FOLDERS[M.folder][1];
      const list = await api('messages?maxResults=60&q=' + encodeURIComponent(q));
      const ids = (list.messages || []).map((x) => x.id);
      const meta = await pool(ids, 8, (id) => api('messages/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe'));
      M.list = meta.filter(Boolean).map((r) => {
        const m = {id: r.id, threadId: r.threadId, labels: r.labelIds || [], snippet: (r.snippet || '').replace(/&#39;/g, '’').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
          subject: hdr(r.payload, 'Subject') || '(no subject)', from: hdr(r.payload, 'From'), date: +r.internalDate, unsub: !!hdr(r.payload, 'List-Unsubscribe')};
        m.who = who(m.from); m.unread = m.labels.includes('UNREAD'); m.starred = m.labels.includes('STARRED');
        if (M.folder === 'sent') { m.to = who(hdr(r.payload, 'To') || ''); }
        Object.assign(m, score(m));
        return m;
      });
      const dr = await api('drafts?maxResults=15');
      const dm = await pool((dr.drafts || []).map((d) => d.id), 6, (id) => api('drafts/' + id + '?format=metadata'));
      M.drafts = dm.filter(Boolean).map((d) => ({id: d.id, threadId: d.message.threadId, to: hdr(d.message.payload, 'To'), subject: hdr(d.message.payload, 'Subject') || '(no subject)', snippet: d.message.snippet || '', date: +d.message.internalDate}));
      M.status = 'ok';
      // Pop-up for new important mail (if turned on in Settings)
      const imp = M.list.filter((x) => x.p === 'high' && x.unread);
      if (M.loadedAt && window.HQ_PREFS && window.HQ_PREFS.get('mailNotify') && 'Notification' in window && Notification.permission === 'granted') {
        imp.filter((x) => !(M.seen || new Set()).has(x.id)).slice(0, 3).forEach((x) => { try { const n = new Notification(x.who.name, {body: x.subject, icon: 'icons/icon-192.png', tag: x.id}); n.onclick = () => { window.focus(); openMsg(x); }; } catch (e) { /* ignore */ } });
      }
      M.seen = new Set(imp.map((x) => x.id));
      M.loadedAt = Date.now();
    } catch (e) {
      if (e.message !== 'signin') { M.err = e.message; M.status = M.status === 'ok' ? 'ok' : 'error'; }
    } finally { M.busy = false; draw(); if (ctx) refreshBadges(); }
  }
  async function modify(id, add, remove) {
    await api('messages/' + id + '/modify', {method: 'POST', body: JSON.stringify({addLabelIds: add || [], removeLabelIds: remove || []})});
  }

  // ---------- Reader ----------
  async function openMsg(m) {
    const wrap = el('div', 'reader');
    wrap.append(el('p', 'muted', 'Opening…'));
    const pane = wide() && $('mail-pane');
    M.openId = m.id;
    let sh;
    if (pane) {
      const t = el('h3', 'pane-t', m.subject);
      pane.replaceChildren(t, wrap); M.paneNodes = {id: m.id, nodes: [t, wrap]};
      sh = {close: () => { M.openId = null; M.paneNodes = null; draw(); }};
      document.querySelectorAll('.mrow.open').forEach((x) => x.classList.remove('open'));
      const r = document.querySelector('.mrow[data-id="' + m.id + '"]'); if (r) r.classList.add('open');
    } else sh = U.sheet(m.subject, wrap, {wide: true, noFocus: true, onClose: () => { M.openId = null; }});
    try {
      const th = await api('threads/' + m.threadId + '?format=full');
      const msgs = th.messages || [];
      if (m.unread && (!window.HQ_PREFS || window.HQ_PREFS.get('mailMarkRead'))) { modify(m.id, [], ['UNREAD']).catch(() => {}); m.unread = false; draw(); refreshBadges(); }
      wrap.replaceChildren();
      msgs.forEach((x, i) => {
        const w = who(hdr(x.payload, 'From'));
        const last = i === msgs.length - 1;
        const d = el('details', 'msg'); d.open = last;
        const s = el('summary');
        s.append(el('b', '', w.email === M.me ? 'You' : w.name), el('span', 'muted small', ' · ' + new Date(+x.internalDate).toLocaleString('en-CA', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})));
        if (!last) s.append(el('div', 'muted small snip', x.snippet || ''));
        d.append(s);
        const b = bodyOf(x.payload);
        if (b.html) {
          const f = el('iframe', 'mail-frame'); f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox'); f.setAttribute('title', 'Email from ' + w.name);
          f.srcdoc = '<!DOCTYPE html><meta charset="utf-8"><base target="_blank"><style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;margin:12px;color:#111;word-wrap:break-word}img{max-width:100%;height:auto}</style>' + b.html;
          f.addEventListener('load', () => { try { f.style.height = Math.min(2400, f.contentDocument.documentElement.scrollHeight + 20) + 'px'; } catch (e) { f.style.height = '520px'; } });
          d.append(f);
        } else d.append(el('pre', 'mail-text', b.text || x.snippet || ''));
        wrap.append(d);
      });
      const lastMsg = msgs[msgs.length - 1] || {};
      const lw = who(hdr(lastMsg.payload, 'From'));
      const replyTo = hdr(lastMsg.payload, 'Reply-To') || (lw.email === M.me ? hdr(lastMsg.payload, 'To') : hdr(lastMsg.payload, 'From'));
      const acts = el('div', 'reader-acts');
      acts.append(
        btn('Reply', 'primary', () => { sh.close(); compose({to: replyTo, subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, threadId: m.threadId, inReplyTo: hdr(lastMsg.payload, 'Message-ID'), refs: (hdr(lastMsg.payload, 'References') + ' ' + hdr(lastMsg.payload, 'Message-ID')).trim(), quote: {who: lw.name, when: new Date(+lastMsg.internalDate), text: bodyOf(lastMsg.payload).text || lastMsg.snippet || ''}}); }),
        btn('Archive', '', async () => { try { await modify(m.id, [], ['INBOX']); const idx = M.list.indexOf(m); M.list = M.list.filter((x) => x.threadId !== m.threadId); sh.close(); draw(); refreshBadges(); window.HQ_UI.undoable('Archived “' + m.subject.slice(0, 40) + '”.', async () => { await modify(m.id, ['INBOX'], []); M.list.splice(Math.max(0, idx), 0, m); draw(); refreshBadges(); }); } catch (e) { ctx.toast('Couldn’t archive: ' + e.message); } }),
        btn(m.starred ? '★ Starred' : '☆ Star', 'ghost', async () => { try { await modify(m.id, m.starred ? [] : ['STARRED'], m.starred ? ['STARRED'] : []); m.starred = !m.starred; openMsg(m); } catch (e) { ctx.toast(e.message); } }),
        btn('Mark unread', 'ghost', async () => { try { await modify(m.id, ['UNREAD'], []); m.unread = true; sh.close(); draw(); refreshBadges(); window.HQ_UI.undoable('Marked unread.', async () => { await modify(m.id, [], ['UNREAD']); m.unread = false; draw(); refreshBadges(); }); } catch (e) { ctx.toast(e.message); } }),
        btn(m.tags.includes('VIP') ? 'Always important ✓' : 'Always important', 'ghost', () => { senderRule('mail_vip', m.who.email); sh.close(); }),
        btn('Mute sender', 'ghost', () => { senderRule('mail_mute', m.who.email); sh.close(); }),
        btn('Add as lead', 'ghost', () => { sh.close(); if (window.HQ_EXTRAS) window.HQ_EXTRAS.leadForm({business: m.who.name, contact: m.who.name, email: m.who.email, stage: 'replied', next_step: 'Reply to their email'}); })
      );
      wrap.append(acts);
    } catch (e) { wrap.replaceChildren(el('p', 'msg', e.message === 'signin' ? 'Gmail sign-in expired. Close this and tap Connect Gmail.' : 'Couldn’t open: ' + e.message)); }
  }
  async function senderRule(key, email, silent) {
    const before = {mail_vip: (setting('mail_vip') || []).slice(), mail_mute: (setting('mail_mute') || []).slice()};
    const other = key === 'mail_vip' ? 'mail_mute' : 'mail_vip';
    const cur = (setting(key) || []).filter((x) => x !== email); cur.push(email);
    const oth = (setting(other) || []).filter((x) => x !== email);
    await saveSetting(key, cur); await saveSetting(other, oth);
    M.list.forEach((m) => Object.assign(m, score(m)));
    draw(); refreshBadges();
    if (!silent) window.HQ_UI.undoable(key === 'mail_vip' ? email + ' is always Important now.' : email + ' is muted.', async () => { await saveSetting('mail_vip', before.mail_vip); await saveSetting('mail_mute', before.mail_mute); M.list.forEach((x) => Object.assign(x, score(x))); draw(); refreshBadges(); });
  }
  async function saveSetting(key, value) {
    const D = ctx.D; D.settings = D.settings || [];
    const i = D.settings.findIndex((s) => s.key === key); const row = {user_id: ctx.user.id, key, value};
    if (i >= 0) D.settings[i] = row; else D.settings.push(row);
    const {error} = await ctx.sb.from('settings').upsert(row, {onConflict: 'user_id,key'});
    if (error) ctx.toast('Setting wasn’t saved: ' + error.message);
  }

  // ---------- Compose ----------
  const TEMPLATES = [
    ['Thanks', 'Hi NAME,\n\nThanks for getting back to me. \n\nBest,\nWilliam'],
    ['Follow up', 'Hi NAME,\n\nJust following up on my last message. Would you have 10 minutes this week for a quick call?\n\nBest,\nWilliam'],
    ['Preview ready', 'Hi NAME,\n\nI put together a free preview of a new website for your business. You can see it here: LINK\n\nIf you like it, I can have it live within a week. Happy to make any changes.\n\nBest,\nWilliam\nClearform Studio'],
    ['Book a call', 'Hi NAME,\n\nWould any of these times work for a quick call?\n\n- \n- \n\nBest,\nWilliam']
  ];
  function compose(o) {
    o = o || {};
    const f = el('div', 'compose');
    const to = U.field('To', 'to', 'email', o.to || ''); to.querySelector('input').type = 'text'; to.querySelector('input').setAttribute('autocomplete', 'email');
    const sub = U.field('Subject', 'subject', 'text', o.subject || '');
    let start = o.body || '';
    const sig = window.HQ_PREFS ? String(window.HQ_PREFS.get('mailSignature') || '').trim() : '';
    if (sig && !o.draftId && !o.body) start = '\n\n' + sig + start;
    if (!start && o.quote) start = '\n\n\nOn ' + o.quote.when.toLocaleString('en-CA', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) + ', ' + o.quote.who + ' wrote:\n' + String(o.quote.text).split('\n').slice(0, 40).map((l) => '> ' + l).join('\n');
    const body = U.field('Message', 'body', 'textarea', start, {rows: 12});
    const chips = el('div', 'chips left');
    TEMPLATES.forEach(([label, text]) => {
      const c = el('button', 'chip', label); c.type = 'button';
      c.addEventListener('click', () => {
        const name = (to.querySelector('input').value.match(/^\s*"?([^"<@,]+?)"?\s*</) || [])[1] || '';
        const ta = body.querySelector('textarea');
        ta.value = text.replace('NAME', name.split(' ')[0] || 'there') + (ta.value.trim() ? '\n' + ta.value : '');
        ta.focus(); ta.setSelectionRange(0, 0);
      });
      chips.append(c);
    });
    const note = el('p', 'muted small', o.draftId ? 'This is a draft Claude wrote. Edit anything, then send.' : 'Nothing is sent until you tap Send.');
    f.append(to, sub, chips, body, note);
    const send = btn('Send', 'primary');
    const save = btn('Save draft', '');
    const del = o.draftId ? btn('Delete draft', 'ghost') : null;
    const sh = U.sheet(o.draftId ? 'Draft' : o.threadId ? 'Reply' : 'New email', f, {wide: true, actions: [send, save].concat(del ? [del] : [])});
    const raw = () => {
      const v = U.values(f);
      if (!v.to) throw new Error('Add who it’s to.');
      const lines = ['To: ' + v.to, 'Subject: ' + encWord(v.subject || ''), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit'];
      if (o.inReplyTo) lines.push('In-Reply-To: ' + o.inReplyTo, 'References: ' + (o.refs || o.inReplyTo));
      return {raw: b64e(lines.join('\r\n') + '\r\n\r\n' + v.body.replace(/\r?\n/g, '\r\n')), threadId: o.threadId || undefined};
    };
    const busy = (on) => { [send, save].concat(del ? [del] : []).forEach((b) => { b.disabled = on; }); };
    send.addEventListener('click', () => {
      let msg; try { msg = raw(); } catch (e) { ctx.toast(e.message); return; }
      const v = U.values(f);
      sh.close();
      // Undo send: wait 5 seconds before it actually goes
      let cancelled = false;
      const timer = setTimeout(async () => {
        if (cancelled) return;
        try {
          if (o.draftId) { await api('drafts/' + o.draftId, {method: 'PUT', body: JSON.stringify({id: o.draftId, message: msg})}); await api('drafts/send', {method: 'POST', body: JSON.stringify({id: o.draftId})}); }
          else await api('messages/send', {method: 'POST', body: JSON.stringify(msg)});
          U.notice('Sent to ' + v.to.replace(/<.*?>/, '').trim() + '.'); load();
        } catch (e) { ctx.toast(e.message === 'signin' ? 'Not sent: Google sign-in expired. Reconnect, then send again.' : 'Not sent: ' + e.message); compose(Object.assign({}, o, {to: v.to, subject: v.subject, body: v.body, quote: null})); }
      }, 5000);
      U.undoable('Sending in 5 seconds…', () => { cancelled = true; clearTimeout(timer); compose(Object.assign({}, o, {to: v.to, subject: v.subject, body: v.body, quote: null})); }, {ms: 5000});
    });
    save.addEventListener('click', async () => {
      let msg; try { msg = raw(); } catch (e) { ctx.toast(e.message); return; }
      busy(true);
      try {
        if (o.draftId) await api('drafts/' + o.draftId, {method: 'PUT', body: JSON.stringify({id: o.draftId, message: msg})});
        else await api('drafts', {method: 'POST', body: JSON.stringify({message: msg})});
        sh.close(); ctx.toast('Draft saved in Gmail.'); load();
      } catch (e) { busy(false); ctx.toast('Not saved: ' + e.message); }
    });
    if (del) del.addEventListener('click', async () => {
      busy(true);
      let msg = null; try { msg = raw(); } catch (e) { /* no recipient */ }
      try { await api('drafts/' + o.draftId, {method: 'DELETE'}); sh.close(); M.drafts = M.drafts.filter((d) => d.id !== o.draftId); draw();
        if (msg) window.HQ_UI.undoable('Draft deleted.', async () => { await api('drafts', {method: 'POST', body: JSON.stringify({message: msg})}); load(); }); else ctx.toast('Draft deleted.'); }
      catch (e) { busy(false); ctx.toast(e.message); }
    });
  }
  async function openDraft(d) {
    try {
      const full = await api('drafts/' + d.id + '?format=full');
      const p = full.message.payload;
      compose({draftId: d.id, threadId: full.message.threadId, to: hdr(p, 'To'), subject: hdr(p, 'Subject'), body: bodyOf(p).text || full.message.snippet || '', inReplyTo: hdr(p, 'In-Reply-To'), refs: hdr(p, 'References')});
    } catch (e) { ctx.toast(e.message === 'signin' ? 'Connect Gmail first.' : e.message); }
  }

  // ---------- Drawing ----------
  function row(m) {
    const li = el('li', 'mrow' + (m.unread ? ' unread' : '') + (M.openId === m.id ? ' open' : ''));
    li.dataset.id = m.id;
    const cb = el('input'); cb.type = 'checkbox'; cb.className = 'msel'; cb.checked = M.sel.has(m.id); cb.setAttribute('aria-label', 'Select: ' + m.subject);
    cb.addEventListener('change', () => { if (cb.checked) M.sel.add(m.id); else M.sel.delete(m.id); draw(); });
    const b = el('button', 'mrow-b'); b.type = 'button';
    const top = el('div', 'mrow-top');
    const name = M.folder === 'sent' && m.to ? 'To ' + m.to.name : m.who.name;
    top.append(el('span', 'dot', ''), el('span', 'mfrom', name), el('span', 'mtime', (m.starred ? '★ ' : '') + U.ago(m.date)));
    const sub = el('div', 'msub'); if (m.p === 'high' && M.view !== 'important') sub.append(el('span', 'tag hi', 'Important')); m.tags.forEach((t) => sub.append(el('span', 'tag t-' + t.toLowerCase(), t))); sub.append(document.createTextNode(m.subject));
    b.append(top, sub, el('div', 'msnip', m.snippet));
    b.addEventListener('click', () => openMsg(m));
    li.append(cb, b);
    return li;
  }
  async function bulk(kind) {
    const ids = [...M.sel]; if (!ids.length) return;
    M.all_before = M.list.slice();
    const ops = {archive: [[], ['INBOX']], read: [[], ['UNREAD']], unread: [['UNREAD'], []], star: [['STARRED'], []]}[kind];
    try {
      await api('messages/batchModify', {method: 'POST', body: JSON.stringify({ids, addLabelIds: ops[0], removeLabelIds: ops[1]})});
      if (kind === 'archive') M.list = M.list.filter((m) => !M.sel.has(m.id));
      else M.list.forEach((m) => { if (M.sel.has(m.id)) { if (kind === 'read') m.unread = false; if (kind === 'unread') m.unread = true; if (kind === 'star') m.starred = true; } });
      const gone = kind === 'archive' ? M.all_before.filter((x) => ids.includes(x.id)) : [];
      const prev = {}; M.all_before.forEach((x) => { if (ids.includes(x.id)) prev[x.id] = {unread: x.unread, starred: x.starred}; });
      M.sel.clear(); draw(); refreshBadges();
      window.HQ_UI.undoable({archive: 'Archived ', read: 'Marked read: ', unread: 'Marked unread: ', star: 'Starred '}[kind] + ids.length + ' email' + (ids.length === 1 ? '' : 's') + '.', async () => {
        await api('messages/batchModify', {method: 'POST', body: JSON.stringify({ids, addLabelIds: ops[1].filter((l) => kind !== 'read' || l === 'UNREAD'), removeLabelIds: ops[0]})});
        if (kind === 'archive') M.list = M.list.concat(gone).sort((a, b) => b.date - a.date);
        M.list.forEach((x) => { if (prev[x.id]) { x.unread = prev[x.id].unread; x.starred = prev[x.id].starred; } });
        draw(); refreshBadges();
      });
    } catch (e) { ctx.toast(e.message === 'signin' ? 'Reconnect Google first.' : e.message); }
  }
  function draw() {
    const root = $('mail-root'); if (!root || !ctx) return;
    if (!clientId()) { root.replaceChildren(setupPanel()); return; }
    if (!tok.get() || M.status === 'signin') { root.replaceChildren(connectPanel()); return; }
    const out = [];
    // Header: title, unread, refresh, compose
    const head = el('div', 'mail-head');
    const ht = el('div'); ht.append(el('h2', 'big', 'Mail'), el('p', 'muted small', M.me ? M.me + ' · ' + M.list.filter((m) => m.unread).length + ' unread' : 'Loading…'));
    const hb = el('div', 'mail-head-b'); hb.append(btn(M.busy ? 'Refreshing…' : '↻ Refresh', '', () => load()), btn('✎ Compose', 'primary', () => compose()));
    head.append(ht, hb); out.push(head);
    // Priority chips
    const hi = M.list.filter((m) => m.p === 'high'), lo = M.list.filter((m) => m.p === 'low');
    const pick = {important: hi, all: M.list, unread: M.list.filter((m) => m.unread), money: M.list.filter((m) => m.tags.includes('Money')), people: M.list.filter((m) => m.tags.some((t) => /Lead|Shop|VIP/.test(t))), low: lo};
    const views = [['important', '● Important'], ['all', 'All'], ['unread', 'Unread'], ['people', 'Leads & shops'], ['money', 'Money'], ['low', 'Low']];
    const chips = el('div', 'chips left mail-chips');
    views.forEach(([k, label]) => { const c = el('button', 'chip' + (M.view === k ? ' on' : '') + (k === 'important' ? ' hot' : ''), label); c.type = 'button'; c.append(el('span', 'cnt', String(pick[k].length))); c.addEventListener('click', () => { M.view = k; M.sel.clear(); draw(); }); chips.append(c); });
    out.push(chips);
    // Folders + search
    const bar = el('div', 'mail-bar');
    const folds = el('div', 'seg');
    Object.entries(FOLDERS).forEach(([k, [label]]) => { const f = el('button', M.folder === k && !M.q ? 'on' : '', label); f.type = 'button'; f.addEventListener('click', () => { M.folder = k; M.q = ''; M.sel.clear(); M.view = k === 'inbox' ? 'important' : 'all'; load(); }); folds.append(f); });
    const search = el('input', 'mail-search'); search.type = 'search'; search.placeholder = 'Search: Gmail terms work (from:, has:attachment, newer_than:7d)'; search.value = M.q; search.setAttribute('aria-label', 'Search mail');
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { M.q = search.value.trim(); M.view = 'all'; load(); } });
    bar.append(folds, search); out.push(bar);
    if (M.err) out.push(el('p', 'msg', 'Gmail: ' + M.err));

    // List column
    const listCol = el('div', 'mail-list');
    const shown = pick[M.view] || M.list;
    const sb = el('div', 'selbar');
    const all = el('input'); all.type = 'checkbox'; all.checked = shown.length > 0 && shown.every((m) => M.sel.has(m.id)); all.setAttribute('aria-label', 'Select all');
    all.addEventListener('change', () => { shown.forEach((m) => (all.checked ? M.sel.add(m.id) : M.sel.delete(m.id))); draw(); });
    const sl = el('label', 'selall'); sl.append(all, document.createTextNode(M.sel.size ? M.sel.size + ' selected' : 'Select all'));
    sb.append(sl);
    if (M.sel.size) sb.append(btn('Archive', 'mini', () => bulk('archive')), btn('Read', 'mini', () => bulk('read')), btn('Unread', 'mini', () => bulk('unread')), btn('★', 'mini', () => bulk('star')));
    listCol.append(sb);
    if (M.drafts.length && M.folder === 'inbox' && !M.q && M.view === 'important') {
      listCol.append(el('p', 'mgroup', 'Drafts ready to send · Claude writes these each morning'));
      const ul = el('ul', 'mlist');
      M.drafts.forEach((d) => {
        const li = el('li', 'mrow'); const b = el('button', 'mrow-b'); b.type = 'button';
        const top = el('div', 'mrow-top'); top.append(el('span', 'tag draft', 'Draft'), el('span', 'mfrom', 'To ' + (who(d.to).name || '—')), el('span', 'mtime', U.ago(d.date)));
        b.append(top, el('div', 'msub', d.subject), el('div', 'msnip', d.snippet));
        b.addEventListener('click', () => openDraft(d)); li.append(b); ul.append(li);
      });
      listCol.append(ul);
      listCol.append(el('p', 'mgroup', 'Important'));
    }
    const ul = el('ul', 'mlist');
    if (!shown.length) ul.append(el('li', 'muted empty', M.status === 'ok' && !M.busy ? (M.view === 'important' ? 'Nothing important right now. Nice.' : 'Nothing here.') : 'Loading your mail…'));
    shown.forEach((m) => ul.append(row(m)));
    listCol.append(ul);
    if (M.view === 'important' && M.list.length > hi.length) { const more = btn('See the other ' + (M.list.length - hi.length) + ' emails', 'ghost', () => { M.view = 'all'; draw(); }); more.classList.add('wide-btn'); listCol.append(more); }

    const split = el('div', 'mail-split');
    const pane = el('div', 'mail-pane'); pane.id = 'mail-pane';
    pane.append(el('p', 'pane-empty', 'Pick a conversation.'));
    split.append(listCol, pane);
    out.push(split);

    const foot = el('p', 'muted small'); foot.textContent = 'Important = clients, leads, the auto shops, school, work, money and anything urgent. Open an email to mark the sender “Always important” or mute them.' + (M.loadedAt ? ' Updated ' + (U.ago(M.loadedAt) === 'now' ? 'just now.' : U.ago(M.loadedAt) + ' ago.') : '');
    const dis = el('button', 'link', 'Disconnect Google'); dis.type = 'button'; dis.addEventListener('click', disconnect);
    foot.append(' ', dis);
    out.push(foot);
    root.replaceChildren(...out);
    if (M.openId && wide() && M.paneNodes && M.paneNodes.id === M.openId) pane.replaceChildren(...M.paneNodes.nodes);
  }
  function disconnect() {
    const t = tok.get(); tok.clear(); M.status = 'signin'; M.list = []; M.drafts = []; M.me = null;
    try { if (t) window.google.accounts.oauth2.revoke(t); } catch (e) { /* ignore */ }
    draw(); refreshBadges(); if (window.HQ_CAL) window.HQ_CAL.redraw();
  }
  function connectPanel() {
    const p = el('div', 'panel connect');
    p.append(el('h2', '', 'Google'), el('p', '', 'Connect Google to use your Gmail and Calendar right here. It stays connected for about an hour at a time. After that, one tap reconnects.'));
    const b = btn('Connect Google', 'primary', async () => {
      b.disabled = true; b.textContent = 'Connecting…';
      try { await connect(false); M.status = 'ok'; M.err = ''; load(); if (window.HQ_CAL) window.HQ_CAL.reload(); } catch (e) { M.err = e.message; b.disabled = false; b.textContent = 'Connect Google'; draw(); }
    });
    p.append(b);
    if (M.err) p.append(el('p', 'msg', M.err));
    return p;
  }

  function setupPanel() {
    const p = el('div', 'panel setup');
    p.append(el('h2', '', 'Set up Google (one time, about 10 minutes)'));
    p.append(el('p', '', 'Google needs a free “Client ID” so HQ is allowed to ask for your Gmail and Calendar. You make it once, paste it below, and it works on your Mac and phone.'));
    const ol = el('ol', 'setup-steps');
    [
      ['Open Google Cloud', 'Go to console.cloud.google.com and sign in as ' + C.ownerEmail + '. Create a project called “HQ”.'],
      ['Turn on Gmail and Calendar', 'Search “Gmail API” in the top bar, open it and press Enable. Do the same for “Google Calendar API”.'],
      ['Consent screen', 'Go to “Google Auth Platform” (or APIs & Services → OAuth consent screen). App name: HQ. User type: External. Under Audience, add yourself (' + C.ownerEmail + ') as a test user.'],
      ['Make the Client ID', 'Clients → Create client → Web application. Under “Authorized JavaScript origins” add https://wrlanteigne.github.io and press Create.'],
      ['Paste it here', 'Copy the Client ID (it ends in .apps.googleusercontent.com) and paste it below.']
    ].forEach(([k, v]) => { const li = el('li'); li.append(el('b', '', k + '. '), document.createTextNode(v)); ol.append(li); });
    p.append(ol);
    const f = U.field('Client ID', 'cid', 'text', '', {placeholder: '1234-abc.apps.googleusercontent.com'});
    const save = btn('Save', 'primary', async () => {
      const v = f.querySelector('input').value.trim();
      if (!/\.apps\.googleusercontent\.com$/.test(v)) { ctx.toast('That doesn’t look like a Client ID. It ends in .apps.googleusercontent.com'); return; }
      await saveSetting('google_client_id', v); draw();
    });
    p.append(f, save, el('p', 'muted small', 'Google will warn that the app “isn’t verified” the first time. That’s normal for your own app: tap Continue.'));
    return p;
  }

  function refreshBadges() {
    const n = M.list.filter((m) => m.p === 'high' && m.unread).length;
    const b = document.querySelector('.tab[data-tab="mail"]');
    if (b) b.dataset.badge = n ? String(n) : '';
    if (window.HQ_EXTRAS && ctx) window.HQ_EXTRAS.inboxPanel(ctx);
  }

  window.HQ_MAIL = {
    render(c) {
      const first = !ctx; ctx = c;
      if (first && clientId() && !tok.get()) connect(true).then(() => { M.status = 'ok'; load(); }).catch(() => { M.status = 'signin'; draw(); });
      else if (first && tok.get()) load();
      draw();
    },
    compose: (o) => compose(o),
    open: (m) => openMsg(m),
    summary: () => ({ready: !!clientId(), connected: !!tok.get() && M.status === 'ok', important: M.list.filter((m) => m.p === 'high' && m.unread), drafts: M.drafts.length, loaded: M.loadedAt}),
    refresh: () => { if (tok.get()) load(); },
    google: {fetch: gfetch, ready: () => !!clientId(), connected: () => !!tok.get() && M.status !== 'signin', connectPanel: () => (clientId() ? connectPanel() : setupPanel())}
  };
  setInterval(() => { const r = window.HQ_PREFS ? +window.HQ_PREFS.get('mailRefresh') : 3; if (r && ctx && tok.get() && M.status === 'ok' && (!document.hidden || (window.HQ_PREFS && window.HQ_PREFS.get('mailNotify'))) && Date.now() - M.loadedAt > r * 60000) load(); }, 30000);
})();
