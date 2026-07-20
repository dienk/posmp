/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Nunito Sans Variable"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['"Rubik Variable"', '"Nunito Sans Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palet visual POSMerahPutih — nilai dari CSS variables (bisa berganti tema).
        // Format channel "R G B" agar modifier opacity Tailwind tetap berfungsi.
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
          strong: 'rgb(var(--c-brand-strong) / <alpha-value>)',
        },
        background: 'rgb(var(--c-background) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
        },
        status: {
          empty: 'rgb(var(--c-empty) / <alpha-value>)', // hijau (semantik)
          occupied: 'rgb(var(--c-occupied) / <alpha-value>)', // merah (semantik)
          waiting: 'rgb(var(--c-waiting) / <alpha-value>)', // kuning (semantik)
        },
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        panel: '-4px 0 16px -6px rgba(113, 120, 136, 0.25)',
        card: '0 2px 8px -2px rgba(113, 120, 136, 0.2)',
      },
    },
  },
  plugins: [],
}
