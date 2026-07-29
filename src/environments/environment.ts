/**
 * Build-time configuration.
 *
 * The Supabase URL and publishable key are designed to be public and ship in the
 * browser bundle; access control is enforced by row-level security in the database.
 * The service role key is NOT here — it lives only in the deployment environment,
 * used by the /api/admin-users function.
 *
 * The Gemini API key can be supplied here, or at runtime from the browser via
 * `localStorage.setItem('GEMINI_API_KEY', '<your key>')` — the runtime value wins.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://hvybromvtvosokqqqhdp.supabase.co',
  supabaseAnonKey: 'sb_publishable_pZX6DDVMU2cW2niwXw0Opg_F4lAy-3R',
  geminiApiKey: '',
};
