# William's HQ

A personal life app: day plan, school, focus timer, money, a sales pipeline, docs, and live Gmail and Google Calendar. Runs on GitHub Pages; data lives in Supabase behind a login with row-level security, so this repo holds code only. Gmail and Calendar are reached straight from the browser with a Google sign-in; no mail is stored in Supabase.

- `index.html`, `styles.css`, `app.js`: the app shell, login, day plan, focus mode
- `tabs.js`, `calc.js`, `plans.js`: Today, School, Money, Sales and Goals
- `ui.js`: shared pop-ups and form fields
- `mail.js`: Mail tab (Gmail: priority inbox, reader, reply, compose, drafts, bulk actions)
- `calendar.js`: Calendar tab (Google Calendar week view plus HQ's shifts, school and follow-ups)
- `extras.js`: People pipeline, Docs, Ideas, Automations, Subscriptions, Settings, quick add, ⌘K search, guide
- `config.js`: Supabase URL and publishable key (safe to be public)
- `sw.js`, `manifest.webmanifest`, `icons/`: home-screen install and offline shell
