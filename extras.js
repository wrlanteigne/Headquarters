// Everything added in v12: Today panels (inbox, calendar, follow-ups, week),
// People pipeline, Docs, Ideas, Automations, Subscriptions, Settings,
// the + quick-add button, ⌘K search and the guide.
(function () {
  'use strict';
  const U = window.HQ_UI, el = U.el, btn = U.btn;
  const $ = (id) => document.getElementById(id);
  const money = (v, dp) => (v < 0 ? '−$' : '$') + Math.abs(+v || 0).toLocaleString('en-CA', {minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0});
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const dayName = (s) => parse(s).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'});
  const fill = (id, ...kids) => { const n = $(id); if (n) n.replaceChildren(...kids); };
  const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let ctx = null;

  async function save(table, row, match) {
    const q = match ? ctx.sb.from(table).update(row).match(match) : ctx.sb.from(table).insert(Object.assign({user_id: ctx.user.id}, row));
    const {error} = await q;
    if (error) { ctx.toast('Not saved: ' + error.message); return false; }
    return true;
  }
  const go = (tab) => { const b = document.querySelector('.tab[data-tab="' + tab + '"]'); if (b) b.click(); };

  // =========================================================
  // TODAY: inbox, calendar, follow-ups, this week
  // =========================================================
  function inboxPanel(c) {
    ctx = c || ctx; if (!ctx) return;
    const box = $('today-inbox'); if (!box) return;
    const S = window.HQ_MAIL ? window.HQ_MAIL.summary() : null;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Inbox'));
    const out = [head];
    if (!S || !S.ready || !S.connected) {
      head.append(el('span', 'muted small', S && S.ready ? 'Not connected' : 'Not set up'));
      const p = el('p', 'muted small', S && S.ready ? 'Connect Google to see the emails that matter.' : 'Set up Gmail once and important mail shows up here.');
      out.push(p, btn(S && S.ready ? 'Connect Google' : 'Set up', 'mini', () => go('mail')));
    } else {
      head.append(el('span', 'muted small', S.important.length + ' important unread' + (S.drafts ? ' · ' + S.drafts + ' drafts ready' : '')));
      const ul = el('ul', 'mlist compact');
      if (!S.important.length) ul.append(el('li', 'muted', 'Nothing important waiting. Nice.'));
      S.important.slice(0, 3).forEach((m) => {
        const li = el('li', 'mrow unread'); const b = el('button', 'mrow-b'); b.type = 'button';
        const top = el('div', 'mrow-top'); top.append(el('span', 'dot', ''), el('span', 'mfrom', m.who.name), el('span', 'mtime', U.ago(m.date)));
        const sub = el('div', 'msub'); m.tags.forEach((t) => sub.append(el('span', 'tag t-' + t.toLowerCase(), t))); sub.append(document.createTextNode(m.subject));
        b.append(top, sub); b.addEventListener('click', () => window.HQ_MAIL.open(m)); li.append(b); ul.append(li);
      });
      out.push(ul);
      if (S.important.length > 3 || S.drafts) out.push(btn('Open Mail', 'mini', () => go('mail')));
    }
    box.replaceChildren(...out);
    calPanel();
  }
  function calPanel() {
    const box = $('today-cal'); if (!box || !ctx) return;
    const items = window.HQ_CAL ? window.HQ_CAL.upcoming() : [];
    const g = window.HQ_MAIL && window.HQ_MAIL.google;
    box.hidden = !(g && g.connected()) && !items.length;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Calendar'), el('span', 'muted small', items.length ? 'Next up' : ''));
    const ul = el('ul', 'items');
    if (!items.length) ul.append(el('li', 'muted', 'Nothing else on your calendar today or tomorrow.'));
    items.forEach((i) => { const li = el('li', 'item'); const b = el('button', 'linkrow'); b.type = 'button'; b.append(el('span', 't-time', i.when), el('span', 'item-t', i.title)); b.addEventListener('click', () => window.HQ_CAL.edit(i.e)); li.append(b); ul.append(li); });
    box.replaceChildren(head, ul, btn('Open calendar', 'mini', () => go('calendar')));
  }
  function followPanel() {
    const box = $('today-follow'); if (!box) return;
    const t = today();
    const due = (ctx.D.leads || []).filter((l) => l.next_date && l.next_date <= t && !/signed|lost/.test(l.stage)).sort((a, b) => (a.next_date < b.next_date ? -1 : 1));
    box.hidden = !due.length;
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Follow-ups due'), el('span', 'muted small', due.length + ''));
    const ul = el('ul', 'items');
    due.slice(0, 5).forEach((l) => {
      const li = el('li', 'item');
      const b = el('button', 'linkrow'); b.type = 'button';
      b.append(el('span', 'pill ' + (l.next_date < t ? 'high' : 'med'), l.next_date < t ? 'late' : 'today'), el('span', 'item-t', l.business + (l.next_step ? ' · ' + l.next_step : '')));
      b.addEventListener('click', () => leadForm(l));
      li.append(b);
      if (l.email && window.HQ_MAIL) li.append(btn('Email', 'mini', () => window.HQ_MAIL.compose({to: l.email, subject: ''})));
      ul.append(li);
    });
    box.replaceChildren(head, ul);
  }
  function weekStrip() {
    const D = ctx.D, t = parse(today());
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const m0 = ymd(mon);
    const focus = (D.focus || []).filter((f) => f.date >= m0).reduce((s, f) => s + (+f.minutes || 0), 0);
    const gym = (D.gym || []).filter((g) => g.date >= m0).length;
    const outr = (D.outreach || []).filter((o) => o.date >= m0).reduce((s, o) => s + (+o.contacted || 0), 0);
    const school = (D.tasks || []).filter((r) => r.done && r.done_at && ymd(new Date(r.done_at)) >= m0).length;
    const cell = (k, v, n, pct) => { const c = el('div', 'wk'); c.append(el('span', 'k', k), el('b', '', v)); if (n) c.append(el('span', 'n', n)); const bar = el('div', 'bar'); const i = el('i'); i.style.width = Math.min(100, pct) + '%'; bar.append(i); c.append(bar); return c; };
    const P = window.HQ_PREFS, gF = +(P ? P.get('goalFocusHours') : 10) || 10, gG = +(P ? P.get('goalGym') : 5) || 5, gS = +(P ? P.get('goalSchool') : 10) || 10;
    fill('week-strip',
      cell('Focus', Math.floor(focus / 60) + 'h ' + (focus % 60) + 'm', 'goal ' + gF + 'h', focus / (gF * 60) * 100),
      cell('Gym', gym + ' / ' + gG, 'sessions', gym / gG * 100),
      cell('Outreach', outr + ' / ' + ctx.C.G.SALES_TARGETS.contacted, 'contacted', outr / ctx.C.G.SALES_TARGETS.contacted * 100),
      cell('School', school + ' / ' + gS, 'tasks done', Math.min(100, school / gS * 100)));
  }

  // =========================================================
  // PEOPLE: pipeline
  // =========================================================
  const STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['replied', 'Replied'], ['preview', 'Preview sent'], ['signed', 'Signed'], ['lost', 'Lost']];
  const STAGE_COUNTER = {contacted: 'contacted', replied: 'replies', preview: 'previews', signed: 'signed'};
  async function bumpOutreach(stage) {
    const key = STAGE_COUNTER[stage]; if (!key) return;
    const t = today(), D = ctx.D;
    let row = D.outreach.find((r) => r.date === t);
    if (!row) { row = {user_id: ctx.user.id, date: t, contacted: 0, replies: 0, previews: 0, signed: 0}; D.outreach.push(row); }
    row[key] = (+row[key] || 0) + 1;
    await ctx.sb.from('outreach').upsert({user_id: ctx.user.id, date: t, contacted: row.contacted, replies: row.replies, previews: row.previews, signed: row.signed}, {onConflict: 'user_id,date'});
    return {key, date: t};
  }
  async function unbump(b) {
    if (!b) return;
    const row = ctx.D.outreach.find((r) => r.date === b.date); if (!row) return;
    row[b.key] = Math.max(0, (+row[b.key] || 0) - 1);
    await ctx.sb.from('outreach').upsert({user_id: ctx.user.id, date: b.date, contacted: row.contacted, replies: row.replies, previews: row.previews, signed: row.signed}, {onConflict: 'user_id,date'});
  }
  async function moveLead(l, stage, silent) {
    const was = l.stage; if (was === stage) return;
    l.stage = stage; l.updated_at = new Date().toISOString();
    ctx.rerender();
    if (await save('leads', {stage, updated_at: l.updated_at}, {id: l.id})) {
      const order = STAGES.map((s) => s[0]);
      let bumped = null;
      if (!silent && order.indexOf(stage) > order.indexOf(was) && stage !== 'lost') { bumped = await bumpOutreach(stage); ctx.rerender(); }
      if (!silent) window.HQ_UI.undoable(l.business + ' → ' + stepOf(stage).tab + (bumped ? ' (counted in outreach)' : '') + '.', async () => { await moveLead(l, was, true); await unbump(bumped); ctx.rerender(); });
    }
  }
  const PRI = {A: 'Hot', B: '', C: 'Check first'};
  // Plain-word steps. Each has one obvious "what happened" button.
  const STEPS = [
    {k: 'new', tab: 'To call', empty: 'Nobody left to call. Nice work.', acts: [['Called', 'contacted', 'primary'], ['Not interested', 'lost', 'ghost']]},
    {k: 'contacted', tab: 'Called', empty: 'Companies you’ve called show up here.', acts: [['Interested', 'replied', 'primary'], ['Not interested', 'lost', 'ghost']]},
    {k: 'replied', tab: 'Interested', empty: 'When someone says yes to a preview, tap “Interested”.', acts: [['Preview sent', 'preview', 'primary'], ['Not now', 'lost', 'ghost']]},
    {k: 'preview', tab: 'Preview sent', empty: 'Previews you’ve sent are waiting here.', acts: [['Signed 🎉', 'signed', 'primary'], ['Not now', 'lost', 'ghost']]},
    {k: 'signed', tab: 'Clients', empty: 'Your first client lands here.', acts: []},
    {k: 'lost', tab: 'Not now', empty: 'No one here.', acts: [['Back to call list', 'new', '']]}
  ];
  const stepOf = (k) => STEPS.find((x) => x.k === k) || STEPS[0];

  // ---------- Cheat sheet (study before you call) ----------
  const TRADE_TIPS = [
    [/plumb|mechanical|hvac|heat|gas|sheet metal|refrigerat/i, {who: 'Homeowners with a leak or no heat, often at night or on weekends, plus property managers.', care: 'Speed and trust. People pick whoever answers first and looks legit.', site: 'A big tap-to-call button, an emergency line, service area (Whistler, Squamish, Pemberton…), heat pumps if they do them.', ask: 'Do you take emergency calls, or mostly booked work?', hook: 'Most people find a plumber by searching on their phone in a panic. If you’re not on Google, they call the next guy.'}],
    [/electric/i, {who: 'Homeowners doing renos, EV chargers, panel upgrades, heat pumps; builders.', care: 'Licensed, insured, shows up on time.', site: 'Services list (EV chargers, panel upgrades, renos), licence and insurance, photos, quote form.', ask: 'Are you doing many EV chargers or panel upgrades these days?', hook: 'People search “EV charger install Squamish” and book whoever has a page for it.'}],
    [/roof/i, {who: 'Homeowners and stratas with big, pricey jobs, often after snow or storm damage.', care: 'Proof of quality. They compare 2–3 quotes before spending $10k+.', site: 'Job photos, reviews, materials they use, a free-quote form, the warranty.', ask: 'How do people usually find you for a re-roof, referrals or Google?', hook: 'On a $15k job, people check you out online before they ever call. Photos win the quote.'}],
    [/landscap|garden|tree|irrigat|hedge/i, {who: 'Homeowners, second-home owners and stratas.', care: 'Seeing past work, and booking spring early.', site: 'Before/after photo gallery, services, service area, a “book spring work” form.', ask: 'Is your spring already booking up, or is that still open?', hook: 'Winter is when people plan spring jobs. A site up by February catches all of that.'}],
    [/paint/i, {who: 'Homeowners, property managers, short-term-rental owners refreshing units.', care: 'Clean, tidy work and a fair quote.', site: 'Before/after photos, interior vs exterior, a free-quote form, reviews.', ask: 'Do you do much interior work in the winter?', hook: 'Painting sells on photos. A gallery does the convincing before you even quote.'}],
    [/contract|construct|build|carpent|renov|cabinet|millwork|woodwork|custom home|drywall|tile|tiling|floor|mason|stone|concrete|insulat|glass|door/i, {who: 'Homeowners planning renos, second-home owners, architects and designers.', care: 'Quality and that you’ve done jobs like theirs.', site: 'A portfolio of finished projects, services, the area you cover, a contact form.', ask: 'What kind of project do you want more of?', hook: 'Big jobs get vetted online. A portfolio site shows the work your name is on.'}],
    [/excavat|backhoe|earthwork|lot clearing|site prep/i, {who: 'Builders, lot owners, farms, the municipality.', care: 'Right equipment, available when needed.', site: 'Equipment list, services (driveways, septic, lot clearing), service area, call button.', ask: 'Are you mostly working for builders, or homeowners too?', hook: 'A simple page with your equipment and services gets you found by out-of-town builders.'}],
    [/clean|maid|housekeep|window|pressure|gutter|junk/i, {who: 'Short-term-rental hosts, second-home owners, property managers, busy families.', care: 'Reliability, trust in their home, easy booking.', site: 'Services and prices or ranges, areas served, a booking or quote form, reviews.', ask: 'Do you do turnovers for Airbnb or rental owners?', hook: 'The corridor is full of rental owners who live elsewhere. They book cleaners online, not by word of mouth.'}],
    [/chimney|wett/i, {who: 'Homeowners with wood stoves, people buying or selling homes, insurers asking for inspections.', care: 'Certified (WETT), available before winter.', site: 'WETT certification, services, booking form, service area.', ask: 'Do you get many WETT inspection requests from home sales?', hook: 'People need a WETT inspection fast for insurance or a sale, and they search for it.'}],
    [/handyman|property|maintenance|home services/i, {who: 'Second-home owners who aren’t around, seniors, landlords.', care: 'Trust and reliability. They’re letting you in when they’re not home.', site: 'Services list, area, reviews, a simple “send a job request” form.', ask: 'Do you look after many homes for owners who don’t live here full-time?', hook: 'Out-of-town owners can only find you online. A site makes you the obvious call.'}],
    [/auto|motorcycle|appliance|equipment repair|small-engine|chainsaw|marine/i, {who: 'Locals with something broken right now.', care: 'Hours, location, what you fix, can they come in today.', site: 'Hours, address and map, services and brands, call button.', ask: 'What do people usually call you for most?', hook: 'People search “mechanic near me” and pick from the map. A site plus Google listing moves you up.'}],
    [/mov/i, {who: 'People moving in and out of the corridor, seasonal workers.', care: 'Price and availability.', site: 'Services, areas, a quote form, reviews.', ask: 'Is summer your busy season?', hook: 'Movers get booked from a quote form. No site, no quote request.'}],
    [/weld|metal|fabricat/i, {who: 'Builders, homeowners wanting railings or gates, local businesses.', care: 'Seeing what you can make.', site: 'A gallery of custom work, services, contact form.', ask: 'What’s your favourite kind of custom job to do?', hook: 'Custom metalwork sells on photos. A gallery brings the fun jobs to you.'}],
    [/fenc|deck/i, {who: 'Homeowners planning summer projects.', care: 'Seeing past work, materials, timeline.', site: 'Photo gallery, materials, a quote form.', ask: 'When do you start booking for spring?', hook: 'Deck and fence jobs get planned in winter, online.'}],
    [/lock/i, {who: 'Locked-out people and businesses changing locks.', care: 'Speed.', site: 'Big call button, 24/7 info, service area.', ask: 'Do you do 24-hour lockouts?', hook: 'Lockouts are 100% Google searches. Whoever shows up first gets the call.'}],
    [/pest/i, {who: 'Homeowners and restaurants with a problem now.', care: 'Fast, discreet, it works.', site: 'Pests you handle, call button, area.', ask: 'What do you get called for most around here?', hook: 'Nobody asks friends for a pest guy. They search.'}],
    [/hot tub/i, {who: 'Homeowners and rental owners.', care: 'Reliable service visits.', site: 'Services, maintenance plans, booking form.', ask: 'Do you service many rental properties?', hook: 'Rental owners book hot tub service online from wherever they live.'}]
  ];
  const tipsFor = (trade) => (TRADE_TIPS.find(([re]) => re.test(trade || '')) || [0, {who: 'Local homeowners and businesses.', care: 'Trust and fast answers.', site: 'Services, area, photos, call button.', ask: 'Where does most of your work come from right now?', hook: 'People check a business online before they call. No site means they call someone else.'}])[1];
  function webState(w, note) {
    const x = (w || '') + ' ' + (note || '');
    if (/broken|didn.t load|redirect|errors|retired|failed to load|empty page/i.test(x)) return ['broken', 'Their website is broken', 'Heads up in case nobody’s told you: when I clicked the website on your listing, it ' + (/redirect|unrelated|elsewhere/i.test(x) ? 'went to a totally different site' : /empty/i.test(x) ? 'came up as a blank page' : 'didn’t load') + '. Anyone checking you out right now hits a dead end.'];
    if (/facebook|social only|instagram|houzz|homestars|yelp|linkedin|bbb/i.test(w || '')) return ['social', 'Only social media, no real site', 'I found your [Facebook/Houzz] page and your work looks great, but there’s no actual website, so you don’t show up when people Google [trade] in [town].'];
    if (/weak|outdated|portfolio|google sites|wix/i.test(w || '')) return ['weak', 'Has a weak or outdated site', 'I had a look at your current page. It’s pretty bare, and it isn’t doing much for you on Google.'];
    if (/maybe|unconfirmed|unsure|unchecked|domain exists/i.test(w || '')) return ['check', 'Might have a site, check first', 'Google them before calling. If there’s a real site, skip or pitch a refresh.'];
    return ['none', 'No website found', 'I was looking for [trade] in [town] on Google and found your listing, but couldn’t find a website for you.'];
  }
  function cheatSheet(l) {
    const T = tipsFor(l.trade), [ws, wLabel, wLine] = webState(l.website, l.note);
    const fill = (txt) => txt.replace('[trade]', (l.trade || 'trades').split(/\s*[\/(]/)[0].toLowerCase()).replace('[town]', (l.town || 'town').replace(/\s*\(.*$/, ''));
    const box = el('div', 'cs');
    const sec = (title, ...nodes) => { const d = el('div', 'cs-sec'); d.append(el('h4', '', title), ...nodes.filter(Boolean)); box.append(d); };
    const row = (k, v) => { if (!v) return null; const r = el('div', 'cs-kv'); r.append(el('span', 'muted', k), typeof v === 'string' ? el('span', '', v) : v); return r; };
    const contact = (l.contact || '').trim();
    const name = contact.replace(/\s*\(.*\)$/, '').replace(/ & .*/, '').split(' ')[0];
    const shaky = /\(.*(unconfirmed|inferred|per |from |verify|role)/i.test(contact);
    const phoneEl = (() => { if (!l.phone) return null; const a = el('a', '', l.phone); a.href = 'tel:' + l.phone.split('/')[0].replace(/[^\d+]/g, ''); a.addEventListener('click', (e) => e.stopPropagation()); return a; })();
    sec('Quick facts',
      row('Trade', l.trade), row('Town', l.town),
      row('Ask for', contact ? contact + (shaky ? '  (not 100% sure, ask “is this the owner?”)' : '') : 'No name. Ask “is this the owner?”'),
      row('Phone', phoneEl), row('Email', l.email),
      row('Priority', l.priority === 'A' ? 'Hot: strong reason to need a site' : l.priority === 'C' ? 'Check first: may be closed or not local' : 'Good lead'),
      row('Found in', l.source));
    const facts = String(l.note || '').split(/\s*[·;]\s*|\.\s+(?=[A-Z])/).map((x) => x.trim().replace(/\.$/, '')).filter((x) => x.length > 2);
    const ul = el('ul', 'cs-list');
    ul.append(el('li', 'cs-web cs-' + ws, wLabel + (l.website && !/^none/i.test(l.website) ? ': ' + l.website.replace(/^(broken|weak site|social only|site listed[^:]*|domain[^:]*)\s*:\s*/i, '') : '')));
    facts.forEach((f) => ul.append(el('li', /NOT name-searched|confirm|verify|check|may be|might|unconfirmed|different company|not be local|inactive|closed|moved/i.test(f) ? 'cs-warn' : '', f)));
    sec('What we found online', ul);
    const say = el('blockquote', 'cs-say', fill(wLine));
    sec('Your opener', el('p', 'small', 'Hi' + (name && !shaky ? ' ' + name : '') + ', it’s William from Clearform Studio in Whistler. Got 30 seconds?'), say, el('p', 'small muted', 'Then ask: “' + T.ask + '”'));
    const tu = el('ul', 'cs-list');
    [['Their customers', T.who], ['What their customers care about', T.care], ['What their site needs', T.site], ['Why it matters', T.hook]].forEach(([k, v]) => { const li = el('li', ''); li.append(el('b', '', k + ': '), document.createTextNode(v)); tu.append(li); });
    sec('Know the trade: ' + ((l.trade || 'general').split(/\s*[\/(]/)[0]), tu);
    const warns = facts.filter((f) => /NOT name-searched|confirm|verify|check|may be|might|different company|not be local|inactive|closed|moved/i.test(f));
    if (warns.length || ws === 'check') sec('Check before you dial', el('p', 'small', 'Google “' + l.business + '” for 30 seconds. ' + (warns[0] ? warns[0] + '.' : 'Make sure they don’t already have a real website.')));
    const acts = el('div', 'cs-acts');
    acts.append(btn('Edit details & notes', '', (e) => { e.stopPropagation(); leadForm(l); }));
    if (window.HQ_CAL) acts.append(btn('Plan a call-back', 'ghost', (e) => { e.stopPropagation(); leadForm(l); setTimeout(() => { const n = document.querySelector('.form [name=next_step]'); if (n) { n.value = n.value || 'Call back'; n.focus(); } }, 80); }));
    box.append(acts);
    box.addEventListener('click', (e) => e.stopPropagation());
    return box;
  }
  function pipeline() {
    const box = $('pipeline'); if (!box) return;
    const leads = ctx.D.leads || [], t = today();
    const q = (box.dataset.q || '').trim().toLowerCase();
    const cur = box.dataset.step || 'new';
    const hay = (l) => [l.business, l.contact, l.town, l.trade, l.phone, l.email, l.website].join(' ').toLowerCase();
    // Header: big search + add
    const head = el('div', 'pl-head');
    const s = el('input', 'pl-search'); s.type = 'search'; s.placeholder = 'Search ' + leads.length + ' companies by name, trade, town or phone'; s.value = box.dataset.q || ''; s.setAttribute('aria-label', 'Search companies');
    s.addEventListener('input', () => { box.dataset.q = s.value; delete box.dataset.show; pipeline(); const n = box.querySelector('.pl-search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    head.append(s);
    const script = (ctx.D.docs || []).find((d) => /call script/i.test(d.title || '') && !d.archived);
    if (script && window.HQ_DOCS) head.append(btn('📞 Script', 'pl-script', () => window.HQ_DOCS.open(script)));
    head.append(btn('＋ Add', 'primary', () => leadForm()));
    // Tabs
    const tabs = el('div', 'pl-tabs');
    STEPS.forEach((st) => {
      const n = leads.filter((l) => l.stage === st.k).length;
      const b = btn('', 'pl-tab' + (!q && cur === st.k ? ' on' : ''), () => { box.dataset.step = st.k; delete box.dataset.q; delete box.dataset.show; pipeline(); });
      b.append(el('span', '', st.tab), el('b', '', String(n)));
      tabs.append(b);
    });
    // List
    let list = q ? leads.filter((l) => q.split(/\s+/).every((w) => hay(l).includes(w))) : leads.filter((l) => l.stage === cur);
    const rank = {A: 0, B: 1, C: 2};
    list = list.slice().sort((a, b) => {
      const ad = a.next_date && a.next_date <= t ? 0 : 1, bd = b.next_date && b.next_date <= t ? 0 : 1;
      return ad - bd || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || a.business.localeCompare(b.business);
    });
    const cap = +(box.dataset.show || 30);
    const ul = el('ul', 'pl-list');
    list.slice(0, cap).forEach((l) => {
      const st = stepOf(l.stage);
      const li = el('li', 'pl-row'); li.tabIndex = 0;
      const info = el('div', 'pl-info');
      const name = el('div', 'pl-name'); name.append(el('b', '', l.business));
      if (l.priority === 'A') name.append(el('span', 'pl-hot', 'Hot'));
      if (l.priority === 'C') name.append(el('span', 'pl-check', 'Check first'));
      if (q) name.append(el('span', 'pl-stage', st.tab));
      info.append(name);
      info.append(el('span', 'muted small', [l.trade, l.town, l.website && !/^none/i.test(l.website) ? l.website : 'No website'].filter(Boolean).join(' · ')));
      const due = l.next_date && l.next_date <= t && !/signed|lost/.test(l.stage);
      if (l.next_step || l.next_date) info.append(el('span', 'small' + (due ? ' due' : ' muted'), '→ ' + (l.next_date ? dayName(l.next_date) + ': ' : '') + (l.next_step || 'follow up')));
      const acts = el('div', 'pl-acts');
      const ph = (l.phone || '').split('/')[0].replace(/[^\d+]/g, '');
      if (ph) { const a = el('a', 'btn pl-call', '☎ Call'); a.href = 'tel:' + ph; a.title = l.phone; a.addEventListener('click', (e) => e.stopPropagation()); acts.append(a); }
      else if (l.email && window.HQ_MAIL) acts.append(btn('✉ Email', 'pl-call', (e) => { e.stopPropagation(); window.HQ_MAIL.compose({to: l.email}); }));
      st.acts.forEach(([label, to, cls]) => acts.append(btn(label, cls, (e) => { e.stopPropagation(); moveLead(l, to); })));
      const top = el('div', 'pl-top'); top.append(info, acts);
      const openNow = box.dataset.open === String(l.id);
      const more = el('span', 'pl-study', openNow ? '▾ Hide cheat sheet' : '▸ Cheat sheet'); info.append(more);
      li.append(top);
      if (openNow) { li.classList.add('open'); li.append(cheatSheet(l)); }
      const toggle = () => { box.dataset.open = openNow ? '' : String(l.id); pipeline(); };
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === li) toggle(); });
      ul.append(li);
    });
    const parts = [head, tabs];
    if (q) parts.push(el('p', 'muted small pl-note', list.length + ' match' + (list.length === 1 ? '' : 'es') + ' for “' + box.dataset.q.trim() + '”'));
    if (!list.length) parts.push(el('p', 'pl-empty', q ? 'No company matches that. Try part of the name, the trade or the town.' : stepOf(cur).empty));
    else parts.push(ul);
    if (list.length > cap) parts.push(btn('Show more (' + (list.length - cap) + ' left)', 'ghost pl-more', () => { box.dataset.show = cap + 30; pipeline(); }));
    parts.push(el('p', 'muted small', 'Hot ones are at the top. Tap a company to open its cheat sheet and study it before you call. After the call, tap what happened and it moves to the next tab by itself.'));
    box.replaceChildren(...parts);
  }
  function leadForm(l) {
    const isNew = !l || !l.id; l = l || {};
    const f = el('div', 'form');
    f.append(U.field('Business', 'business', 'text', l.business || ''),
      (() => { const r = el('div', 'two'); r.append(U.field('Contact name', 'contact', 'text', l.contact || ''), U.field('Town', 'town', 'text', l.town || '')); return r; })(),
      (() => { const r = el('div', 'two'); r.append(U.field('Email', 'email', 'email', l.email || ''), U.field('Phone', 'phone', 'text', l.phone || '')); return r; })(),
      (() => { const r = el('div', 'two'); r.append(U.field('Trade', 'trade', 'text', l.trade || ''), U.field('Priority', 'priority', 'select', null, {options: [['A', 'A · Hot'], ['B', 'B · Good'], ['C', 'C · Check first']]})); return r; })(),
      U.field('Where they are', 'stage', 'select', null, {options: STEPS.map((x) => [x.k, x.tab])}),
      U.field('Website now', 'website', 'text', l.website || '', {placeholder: 'None, Facebook only, broken…'}),
      (() => { const r = el('div', 'two'); r.append(U.field('Next step', 'next_step', 'text', l.next_step || '', {placeholder: 'Call back, send preview…'}), U.field('When', 'next_date', 'date', l.next_date || '')); return r; })(),
      U.field('Notes', 'note', 'textarea', l.note || '', {rows: 3}));
    f.querySelector('[name=stage]').value = l.stage || 'new';
    f.querySelector('[name=priority]').value = l.priority || 'B';
    if (!isNew && l.source) f.append(el('p', 'muted small', 'From: ' + l.source));
    const ok = btn('Save', 'primary'), acts = [ok];
    if (!isNew && l.email && window.HQ_MAIL) acts.push(btn('Email', '', () => { sh.close(); window.HQ_MAIL.compose({to: l.email}); }));
    if (!isNew && l.phone) { const a = el('a', 'btn', 'Call'); a.href = 'tel:' + l.phone.split('/')[0].replace(/[^\d+]/g, ''); acts.push(a); }
    if (!isNew && window.HQ_CAL) acts.push(btn('Book a call', '', () => { sh.close(); const s = new Date(); s.setDate(s.getDate() + 1); s.setHours(10, 0, 0, 0); window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 1800000), attendees: l.email || '', notes: 'Call with ' + (l.contact || l.business)}); setTimeout(() => { const t = document.querySelector('.evform [name=title]'); if (t) t.value = 'Call: ' + l.business; }, 60); }));
    const del = isNew ? null : btn('Delete', 'ghost');
    if (del) acts.push(del);
    const sh = U.sheet(isNew ? 'New lead' : l.business, f, {actions: acts});
    ok.addEventListener('click', async () => {
      const v = U.values(f);
      if (!v.business) { ctx.toast('Add the business name.'); return; }
      const row = {business: v.business, contact: v.contact || null, town: v.town || null, email: v.email || null, phone: v.phone || null, stage: v.stage, trade: v.trade || null, priority: v.priority || null, website: v.website || null, next_step: v.next_step || null, next_date: v.next_date || null, note: v.note || null, updated_at: new Date().toISOString()};
      ok.disabled = true;
      if (isNew) {
        const {data, error} = await ctx.sb.from('leads').insert(Object.assign({user_id: ctx.user.id}, row)).select().single();
        if (error) { ok.disabled = false; ctx.toast('Not saved: ' + error.message); return; }
        ctx.D.leads.push(data); const bmp = STAGE_COUNTER[v.stage] ? await bumpOutreach(v.stage) : null;
        window.HQ_UI.undoable('Added ' + data.business + '.', async () => { const {error: e2} = await ctx.sb.from('leads').delete().eq('id', data.id); if (e2) throw e2; ctx.D.leads = ctx.D.leads.filter((q) => q.id !== data.id); await unbump(bmp); ctx.rerender(); });
      } else {
        const prev = l.stage, old = {}; Object.keys(row).forEach((k) => { old[k] = l[k] === undefined ? null : l[k]; });
        if (!(await save('leads', row, {id: l.id}))) { ok.disabled = false; return; }
        Object.assign(l, row);
        window.HQ_UI.undoable('Saved ' + l.business + '.', async () => { if (!(await save('leads', old, {id: l.id}))) throw new Error('not saved'); Object.assign(l, old); ctx.rerender(); });
        const order = STAGES.map((s) => s[0]);
        if (order.indexOf(v.stage) > order.indexOf(prev) && v.stage !== 'lost') await bumpOutreach(v.stage);
      }
      sh.close(); ctx.toast('Saved.'); ctx.rerender();
    });
    if (del) del.addEventListener('click', async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Tap again to delete'; return; }
      const {error} = await ctx.sb.from('leads').delete().eq('id', l.id);
      if (error) { ctx.toast(error.message); return; }
      ctx.D.leads = ctx.D.leads.filter((x) => x.id !== l.id); sh.close(); ctx.rerender();
      const copy = Object.assign({}, l);
      window.HQ_UI.undoable('Deleted ' + l.business + '.', async () => { const {data, error: e2} = await ctx.sb.from('leads').insert(copy).select().single(); if (e2) throw e2; ctx.D.leads.push(data); ctx.rerender(); });
    });
  }

  // =========================================================
  // GOALS: ideas
  // =========================================================
  function ideas() {
    const box = $('ideas'); if (!box) return;
    const list = (ctx.D.notes || []).filter((n) => !n.done).sort((a, b) => (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1));
    const head = el('div', 'panel-h'); head.append(el('h2', '', 'Ideas'), el('span', 'muted small', list.length + ' saved'));
    const add = el('form', 'hrow');
    const inp = el('input', 'mini-search'); inp.placeholder = 'Got an idea? Type it and press Enter'; inp.setAttribute('aria-label', 'New idea');
    add.append(inp, btn('Save', 'mini primary'));
    add.addEventListener('submit', async (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ''; await addIdea(v); });
    const ul = el('ul', 'items');
    if (!list.length) ul.append(el('li', 'muted', 'Business ideas, things to try, stuff to remember. Tap + anywhere to add one fast.'));
    list.forEach((n) => {
      const li = el('li', 'item');
      li.append(el('span', 'idea-t' + (n.pinned ? ' pinned' : ''), n.text));
      const pin = btn(n.pinned ? '★' : '☆', 'mini', async () => { n.pinned = !n.pinned; await save('notes', {pinned: n.pinned}, {id: n.id}); ideas(); }); pin.setAttribute('aria-label', n.pinned ? 'Unpin' : 'Pin');
      const done = btn('Done', 'mini', async () => { n.done = true; await save('notes', {done: true}, {id: n.id}); ideas(); window.HQ_UI.undoable('Idea marked done.', async () => { n.done = false; await save('notes', {done: false}, {id: n.id}); ideas(); }); });
      li.append(pin, done); ul.append(li);
    });
    box.replaceChildren(head, add, ul);
  }
  async function addIdea(text) {
    const {data, error} = await ctx.sb.from('notes').insert({user_id: ctx.user.id, kind: 'idea', text}).select().single();
    if (error) { ctx.toast('Not saved: ' + error.message); return; }
    ctx.D.notes.push(data); ideas();
    window.HQ_UI.undoable('Idea saved to Goals.', async () => { await ctx.sb.from('notes').delete().eq('id', data.id); ctx.D.notes = ctx.D.notes.filter((q) => q.id !== data.id); ideas(); });
  }

  // =========================================================
  // SYSTEM: automations, subscriptions, settings
  // =========================================================
  const AUTOMATIONS = [
    ['Morning HQ refresh', 'Every day · 5:37 am', 'Pulls Etsy, Stripe, Gmail and your TFSA into HQ, adds what needs you, writes draft replies in Gmail, and sends you a short update.', ['Etsy', 'Stripe', 'Gmail', 'Investments', 'HQ']],
    ['Etsy shop check', 'Every day', 'Reads your Etsy stats into the “Etsy shop stats” doc. Needs your Mac awake with the Claude app open.', ['Etsy']],
    ['Auto-shop reply watch', 'Each morning until Dec 24', 'Looks for replies from the 8 auto shops about parts invoices and pins them as high priority.', ['Invoice research']]
  ];
  function lastRun() {
    const log = ctx.D.log || [];
    return log.length ? log[0].date : null;
  }
  function automations() {
    const box = $('auto-root'); if (!box) return;
    const log = ctx.D.log || [];
    const out = [el('div', 'page-h')];
    out[0].append(el('h2', 'big', 'Automations'));
    out.push(el('p', 'muted', 'These run on their own in Claude. To add or change one, just ask Claude in chat, e.g. “every Friday, email me my week in numbers”.'));
    AUTOMATIONS.forEach(([name, when, what, areas]) => {
      const p = el('div', 'panel auto');
      const last = log.find((r) => areas.some((a) => (r.area || '').toLowerCase().includes(a.toLowerCase())));
      const h = el('div', 'panel-h'); const t = el('div'); t.append(el('b', '', name), el('div', 'muted small', when));
      const ok = last && (Date.now() - parse(last.date)) < 2.5 * 864e5;
      h.append(t, el('span', 'state ' + (ok ? 'on' : 'warn'), ok ? '● Running' : last ? '● Last seen ' + dayName(last.date) : '● No runs logged yet'));
      p.append(h, el('p', 'muted small', what));
      if (last) p.append(el('p', 'small', 'Latest: ' + last.did));
      out.push(p);
    });
    const p = el('div', 'panel'); p.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Everything Claude did lately')); return h; })());
    const ul = el('ul', 'log');
    log.slice(0, 30).forEach((r) => { const li = el('li'); li.append(el('span', 'k', dayName(r.date) + ' · ' + (r.area || '')), el('div', '', r.did)); ul.append(li); });
    if (!log.length) ul.append(el('li', 'muted', 'Nothing logged yet.'));
    p.append(ul); out.push(p);
    box.replaceChildren(...out);
  }
  function subscriptions() {
    const box = $('subs-root'); if (!box) return;
    const D = ctx.D, m = today().slice(0, 7);
    const biz = (D.costs || []).filter((c) => c.kind === 'business' && !c.once_month);
    const once = (D.costs || []).filter((c) => c.kind === 'business' && c.once_month && c.once_month >= m);
    const pers = (D.expenses || []).filter((e) => e.type === 'recurring');
    const bt = biz.reduce((s, c) => s + (+c.monthly || 0), 0), pt = pers.reduce((s, e) => s + (+e.amount_cad || 0), 0);
    const card = (k, v, n) => { const c = el('div', 'card'); c.append(el('div', 'k', k), el('div', 'v', v)); if (n) c.append(el('div', 'n', n)); return c; };
    const cards = el('div', 'cards'); cards.append(card('Every month', money(bt + pt, 2), 'Business + personal'), card('Every year', money((bt + pt) * 12), 'If nothing changes'), card('Business', money(bt, 2) + '/mo', biz.length + ' tools'), card('Personal', money(pt, 2) + '/mo', pers.length + ' bills'));
    const list = (title, rows, name, amt, note) => {
      const p = el('div', 'panel'); const h = el('div', 'panel-h'); h.append(el('h2', '', title)); p.append(h);
      const ul = el('ul', 'subs');
      if (!rows.length) ul.append(el('li', 'muted', 'None.'));
      rows.sort((a, b) => amt(b) - amt(a)).forEach((r) => { const li = el('li'); const l = el('div', 'grow'); l.append(el('b', '', name(r))); if (note(r)) l.append(el('span', 'muted small', note(r))); li.append(l, el('span', 'num', money(amt(r), 2))); ul.append(li); });
      p.append(ul); return p;
    };
    box.replaceChildren((() => { const h = el('div', 'page-h'); h.append(el('h2', 'big', 'Subscriptions')); return h; })(), cards,
      list('Business tools', biz, (r) => r.item, (r) => +r.monthly || 0, (r) => r.note),
      list('Personal bills', pers, (r) => r.item, (r) => +r.amount_cad || 0, (r) => r.category || r.note),
      once.length ? list('One-time business costs coming up', once, (r) => r.item, (r) => +r.monthly || 0, (r) => r.once_month) : el('span'),
      el('p', 'muted small', 'The morning refresh adds new business charges it finds in Gmail or Stripe. Tell Claude to cancel or change one and it updates here.'));
  }
  function settings() {
    const box = $('settings-root'); if (!box) return;
    const D = ctx.D, S = (k) => { const r = (D.settings || []).find((x) => x.key === k); return r ? r.value : null; };
    const out = [(() => { const h = el('div', 'page-h'); h.append(el('h2', 'big', 'Settings')); return h; })()];
    // Google
    const g = window.HQ_MAIL && window.HQ_MAIL.google;
    const p1 = el('div', 'panel'); p1.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Google (Gmail + Calendar)'), el('span', 'state ' + (g && g.connected() ? 'on' : 'warn'), g && g.connected() ? '● Connected' : g && g.ready() ? '● Not connected' : '● Not set up')); return h; })());
    const cid = U.field('Client ID', 'cid', 'text', S('google_client_id') || '');
    p1.append(cid, (() => { const r = el('div', 'hrow'); r.append(btn('Save', 'mini primary', async () => { const v = cid.querySelector('input').value.trim(); await ctx.sb.from('settings').upsert({user_id: ctx.user.id, key: 'google_client_id', value: v || null}, {onConflict: 'user_id,key'}); const i = D.settings.findIndex((x) => x.key === 'google_client_id'); if (i >= 0) D.settings[i].value = v || null; else D.settings.push({key: 'google_client_id', value: v}); ctx.toast('Saved.'); ctx.rerender(); }), btn('Open setup steps', 'mini', () => go('mail'))); return r; })());
    out.push(p1);
    // Mail rules
    const p2 = el('div', 'panel'); p2.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'Mail rules')); return h; })());
    [['mail_vip', 'Always important'], ['mail_mute', 'Muted (go to Low)']].forEach(([k, label]) => {
      const list = S(k) || [];
      p2.append(el('p', 'mgroup', label));
      const ul = el('div', 'chips left');
      if (!list.length) ul.append(el('span', 'muted small', 'None yet. Open an email to add a sender.'));
      list.forEach((e) => { const c = el('button', 'chip on', e + ' ✕'); c.type = 'button'; c.setAttribute('aria-label', 'Remove ' + e); c.addEventListener('click', async () => { const v = list.filter((x) => x !== e); await ctx.sb.from('settings').upsert({user_id: ctx.user.id, key: k, value: v}, {onConflict: 'user_id,key'}); D.settings.find((x) => x.key === k).value = v; settings(); }); ul.append(c); });
      p2.append(ul);
    });
    out.push(p2);
    // App
    const p3 = el('div', 'panel'); p3.append((() => { const h = el('div', 'panel-h'); h.append(el('h2', '', 'App')); return h; })());
    p3.append(el('p', 'small', 'Install HQ: on iPhone, open it in Safari → Share → Add to Home Screen. On your Mac, Chrome → ⋮ → Cast, save and share → Install page as app.'));
    p3.append((() => { const r = el('div', 'hrow'); r.append(btn('How HQ works', 'mini', guide), btn('Reload data', 'mini', () => location.reload()), btn('Lock HQ', 'mini', () => $('signout').click())); return r; })());
    out.push(p3);
    box.replaceChildren(...out);
  }

  // =========================================================
  // QUICK ADD (+), SEARCH (⌘K), GUIDE
  // =========================================================
  function quickAdd() {
    const grid = el('div', 'qa');
    const opts = [
      ['✉', 'Email', () => window.HQ_MAIL && window.HQ_MAIL.compose()],
      ['◷', 'Event', () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); window.HQ_CAL && window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 3600000)}); }],
      ['◎', 'Lead', () => leadForm()],
      ['▤', 'Doc', () => window.HQ_DOCS.create()],
      ['✦', 'Idea', () => simple('New idea', [U.field('Idea', 'text', 'textarea', '', {rows: 3})], (v) => v.text && addIdea(v.text))],
      ['⚑', 'Reminder', () => simple('Remind me', [U.field('What', 'title', 'text', ''), U.field('Priority', 'priority', 'select', null, {options: [['med', 'Medium'], ['high', 'High'], ['low', 'Low']]})], async (v) => {
        if (!v.title) return; const row = {id: nid('w'), priority: v.priority, area: 'Me', title: v.title.slice(0, 60), item: v.title, status: 'open'};
        if (await save('attention', row)) { ctx.D.attention.push(Object.assign({user_id: ctx.user.id, created_at: new Date().toISOString()}, row)); ctx.rerender(); window.HQ_UI.undoable('Added to Needs you.', async () => { await ctx.sb.from('attention').delete().eq('id', row.id); ctx.D.attention = ctx.D.attention.filter((q) => q.id !== row.id); ctx.rerender(); }); }
      })],
      ['🏋', 'Gym', () => simple('Log gym', [U.field('Date', 'date', 'date', today()), U.field('Session', 'session', 'select', null, {options: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Cardio'].map((x) => [x, x])}), U.field('Bodyweight (lbs, optional)', 'bw', 'number', '')], async (v) => {
        const row = {user_id: ctx.user.id, date: v.date || today(), session: v.session, bodyweight_lbs: v.bw ? +v.bw : null};
        const {data, error} = await ctx.sb.from('gym').insert(row).select().single();
        if (error) { ctx.toast('Not saved: ' + error.message); return; }
        ctx.D.gym.push(data); ctx.rerender();
        window.HQ_UI.undoable('Gym logged. ' + ctx.D.gym.filter((g) => g.date >= ymd(new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5))).length + ' this week.', async () => { await ctx.sb.from('gym').delete().eq('id', data.id); ctx.D.gym = ctx.D.gym.filter((q) => q.id !== data.id); ctx.rerender(); });
      })],
      ['$', 'Spent', () => simple('Log spending', [U.field('What', 'item', 'text', ''), U.field('Amount (CAD)', 'amt', 'number', ''), U.field('Kind', 'cat', 'select', null, {options: [['Food', 'Food'], ['Fun', 'Fun'], ['Transport', 'Transport'], ['Shopping', 'Shopping'], ['Other', 'Other']]})], async (v) => {
        if (!v.item || !v.amt) return; const row = {id: nid('x'), month: today().slice(0, 7), item: v.item, category: v.cat, type: 'spent', amount_cad: +v.amt, note: 'Logged in HQ ' + today()};
        if (await save('expenses', row)) { ctx.D.expenses.push(row); ctx.rerender(); window.HQ_UI.undoable('Logged ' + money(+v.amt, 2) + ' for ' + v.item + '.', async () => { await ctx.sb.from('expenses').delete().eq('id', row.id); ctx.D.expenses = ctx.D.expenses.filter((q) => q.id !== row.id); ctx.rerender(); }); }
      })]
    ];
    let sh;
    opts.forEach(([ic, label, fn]) => { const b = el('button', 'qa-b'); b.type = 'button'; b.append(el('span', 'qa-i', ic), el('span', '', label)); b.addEventListener('click', () => { sh.close(); fn(); }); grid.append(b); });
    sh = U.sheet('Add', grid, {noFocus: true});
  }
  function simple(title, fields, onSave) {
    const f = el('div', 'form'); f.append(...fields);
    const ok = btn('Save', 'primary');
    const sh = U.sheet(title, f, {actions: [ok]});
    ok.addEventListener('click', async () => { ok.disabled = true; await onSave(U.values(f)); sh.close(); });
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') ok.click(); });
  }

  function palette() {
    if (document.querySelector('.pal')) return;
    const w = el('div', 'pal');
    const inp = el('input', 'pal-in'); inp.type = 'search'; inp.placeholder = 'Search HQ or type a command…'; inp.setAttribute('aria-label', 'Search HQ');
    const ul = el('ul', 'pal-list');
    w.append(inp, ul);
    const sh = U.sheet('Search', w, {});
    sh.box.classList.add('pal-sheet');
    const D = ctx.D;
    const base = [
      ...[['today', 'Today'], ['learn', 'Learn · Founder School'], ['calendar', 'Calendar'], ['mail', 'Mail'], ['sales', 'People & pipeline'], ['docs', 'Docs'], ['school', 'School'], ['money', 'Money'], ['goals', 'Goals'], ['automations', 'Automations'], ['subs', 'Subscriptions'], ['settings', 'Settings']].map(([k, l]) => ({k: 'Go to', t: l, run: () => go(k)})),
      {k: 'Do', t: 'Write an email', run: () => window.HQ_MAIL && window.HQ_MAIL.compose()},
      {k: 'Do', t: 'New calendar event', run: () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); window.HQ_CAL.newEvent({start: s, end: new Date(s.getTime() + 3600000)}); }},
      {k: 'Do', t: 'New lead', run: () => leadForm()},
      {k: 'Do', t: 'New doc', run: () => window.HQ_DOCS.create()},
      {k: 'Do', t: 'Start a focus block', run: () => { go('today'); setTimeout(() => $('focus-next').click(), 50); }},
      {k: 'Do', t: 'Quick add (gym, spending, idea…)', run: quickAdd},
      {k: 'Help', t: 'How HQ works', run: guide},
      {k: 'Do', t: 'Undo the last change (⌘Z)', run: () => window.HQ_UI.undo()},
      {k: 'Go to', t: 'Settings · dark mode, colours, mail, password…', run: () => go('settings')},
      ...(window.HQ_SCHOOL ? window.HQ_SCHOOL.links().map((l) => ({k: 'Open', t: l.name + (l.sub ? ' · ' + l.sub : ''), run: () => window.HQ_SCHOOL.go(l)})) : [])
    ];
    const items = () => base.concat(
      (D.leads || []).map((l) => ({k: 'Lead · ' + l.stage, t: l.business + (l.contact ? ' · ' + l.contact : ''), run: () => leadForm(l)})),
      (D.docs || []).filter((d) => !d.archived).map((d) => ({k: 'Doc · ' + d.workspace, t: d.title, extra: String(d.body).replace(/<[^>]+>/g, ' '), run: () => window.HQ_DOCS.open(d)})),
      (D.attention || []).filter((a) => a.status === 'open').map((a) => ({k: 'Needs you', t: a.title || a.item, extra: a.item, run: () => go('today')})),
      (D.tasks || []).filter((r) => !r.done).map((r) => ({k: 'School · ' + dayName(r.date), t: r.task, run: () => go('school')})),
      (D.clients || []).map((c) => ({k: 'Client', t: c.business, run: () => go('sales')})),
      (window.HQ_LEARN ? window.HQ_LEARN.lessons : []).map((l) => ({k: 'Lesson', t: l.title, extra: l.level.title + ' ' + l.body.join(' '), run: () => { go('learn'); window.HQ_LEARN.open(l.id); }})),
      (D.notes || []).filter((n) => !n.done).map((n) => ({k: 'Idea', t: n.text, run: () => go('goals')}))
    );
    let sel = 0, shown = [];
    const drawList = () => {
      const q = inp.value.trim().toLowerCase();
      shown = items().filter((i) => !q || (i.t + ' ' + i.k + ' ' + (i.extra || '')).toLowerCase().includes(q)).slice(0, 12);
      if (!q) shown = shown.slice(0, 8);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.replaceChildren(...shown.map((i, n) => { const li = el('li', n === sel ? 'on' : ''); const b = el('button'); b.type = 'button'; b.append(el('span', 'pal-k', i.k), el('span', '', i.t)); b.addEventListener('click', () => { sh.close(); i.run(); }); li.append(b); return li; }));
      if (!shown.length) ul.append(el('li', 'muted empty', 'Nothing found.'));
    };
    inp.addEventListener('input', () => { sel = 0; drawList(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); drawList(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); drawList(); e.preventDefault(); }
      if (e.key === 'Enter' && shown[sel]) { sh.close(); shown[sel].run(); }
    });
    drawList();
  }

  function guide() {
    const w = el('div', 'guide');
    [
      ['Today', 'Your plan for the day, the one thing to do next, what needs you, important email, your calendar and follow-ups. Tick things off as you go.'],
      ['Learn', 'Founder School: 40 five-minute lessons on building a company and being a CEO, from finding problems to sales, money, systems, leading people and growing big. Each ends with one move for your own business. Your next lesson shows on Today.'],
      ['Calendar', 'Your Google Calendar with Meadow Park shifts, school and follow-ups on top. Click an empty time to add an event.'],
      ['Mail', 'Your Gmail, sorted: Important first (clients, leads, school, work, money), everything else below. Read, reply, write, archive. Claude’s morning drafts wait at the top for you to check and send.'],
      ['People', 'Every company you could sell a website to. Search at the top, call from the To call tab, then tap what happened (Called, Interested, Preview sent, Signed) and it moves along. Moving forward counts in today’s outreach.'],
      ['Docs', 'Write notes, briefs and scripts, sorted by business. Pick a template, then type / to add headings, lists or to-dos. Saves as you type, and exports to Word, PDF or email.'],
      ['School', 'A card per course with progress and the next test, today’s tasks to tick off, and the week ahead.'],
      ['Money · Goals', 'Income, paycheque split, savings, investments and your goals, plus an Ideas list on Goals.'],
      ['Automations', 'What Claude runs for you each day and everything it did lately.'],
      ['Subscriptions', 'Everything you pay for every month, business and personal.'],
      ['Undo', 'Clicked something by accident? Tap Undo on the bar at the bottom, or press ⌘Z (Ctrl+Z). Works for ticks, leads, docs, email, calendar and more. Sent emails wait 5 seconds so you can stop them.'],
      ['Shortcuts', '＋ button (bottom right): add an email, event, lead, doc, idea, reminder, gym session or spending. ⌘K (or the search box): find anything in HQ. Press ? for this guide.'],
      ['Ask Claude', 'Anything HQ can’t do yet, ask Claude in chat. It can read and change HQ’s data for you.']
    ].forEach(([k, v]) => { const d = el('div', 'g-row'); d.append(el('b', '', k), el('p', '', v)); w.append(d); });
    U.sheet('How HQ works', w, {noFocus: true});
  }

  // Sidebar footer status + badges
  function status() {
    const e = $('engine'); if (!e) return;
    const d = lastRun();
    const fresh = d && (Date.now() - parse(d)) < 1.5 * 864e5;
    e.className = 'engine ' + (fresh ? 'on' : 'warn');
    e.textContent = d ? (fresh ? 'Claude refreshed ' + (d === today() ? 'today' : 'yesterday') : 'Last refresh ' + dayName(d)) : 'Waiting for first refresh';
    const due = (ctx.D.leads || []).filter((l) => l.next_date && l.next_date <= today() && !/signed|lost/.test(l.stage)).length;
    const b = document.querySelector('.tab[data-tab="sales"]'); if (b) b.dataset.badge = due ? String(due) : '';
    const n = document.querySelector('.tab[data-tab="today"]'); if (n) n.dataset.badge = (ctx.D.attention || []).filter((a) => a.status === 'open' && a.priority === 'high').length || '';
  }

  // Keyboard: ⌘K / Ctrl+K search, ? guide, N quick add
  document.addEventListener('keydown', (e) => {
    if (!ctx || $('app').hidden) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
    else if (!typing && !document.querySelector('.sheet-back') && e.key === '?') guide();
    else if (!typing && !document.querySelector('.sheet-back') && e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) quickAdd();
  });

  window.HQ_EXTRAS = {
    render(c) {
      ctx = c;
      [inboxPanel, followPanel, weekStrip, pipeline, ideas, automations, subscriptions, status].forEach((f) => { try { f(c); } catch (e) { console.error(f.name, e); } });
    },
    inboxPanel, leadForm, quickAdd, palette, guide
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t || !ctx) return;
    ({add: quickAdd, search: palette, guide})[t.dataset.act]();
  });
})();
