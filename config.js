// Public connection settings for the HQ database.
// The publishable key is meant to be public: row-level security in the database
// means it can only read or change rows that belong to the signed-in user.
window.HQ_CONFIG = {
  url: 'https://gwjpyqimqnubyjyrgonx.supabase.co',
  key: 'sb_publishable_yNAfPff-XzoXReO2Qjjo4Q_fX9Zk-lb',
  // The one account that can unlock HQ (the password is what protects it)
  ownerEmail: 'wrlanteigne@gmail.com',
  // Meadow Park pays every second Thursday; this is one known payday.
  paydayAnchor: '2026-12-03'
};
