/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode is a single `dark` class on <html>, toggled by RosterStore. That keeps
  // theming in the stylesheet as `dark:` variants instead of per-component ternaries.
  darkMode: 'class',
  content: {
    files: ['./src/**/*.{html,ts}'],
    transform: {
      // Angular writes conditional utilities as `[class.bg-rose-950/30]="expr"`, and the
      // default extractor reads that as the single token `class.bg-rose-950/30`, so the
      // utility never gets generated. Unwrap those bindings before extraction.
      DEFAULT: (content) => content.replace(/\[class\.([^\]"'=]+)\]/g, ' $1 '),
    },
  },
  theme: {
    extend: {
      colors: {
        // Single accent for interactive elements. Every other colour in the UI is
        // either neutral or carries a fixed meaning (leave, holiday, shortfall).
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};
