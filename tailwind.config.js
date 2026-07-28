/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: ['./src/**/*.{html,ts}'],
    transform: {
      // Angular writes conditional utilities as `[class.bg-rose-950/30]="expr"`, and the
      // default extractor reads that as the single token `class.bg-rose-950/30`, so the
      // utility never gets generated. Unwrap those bindings before extraction.
      //
      // Theme utilities that live in .ts files (THEME_SHIFT_STYLES, the per-view
      // THEME_CONFIGS maps, the class helpers on each component) are all plain string
      // literals, so the standard extractor already finds them.
      DEFAULT: (content) => content.replace(/\[class\.([^\]"'=]+)\]/g, ' $1 '),
    },
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
