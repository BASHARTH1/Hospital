/**
 * Build-time configuration.
 *
 * The Gemini API key can be supplied here, or at runtime from the browser via
 * `localStorage.setItem('GEMINI_API_KEY', '<your key>')` — the runtime value wins.
 * Do not commit a real key to source control.
 */
export const environment = {
  production: false,
  geminiApiKey: '',
};
