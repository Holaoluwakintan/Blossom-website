/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        vellum: v('paper-2'),
        surface: v('surface'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        muted: v('muted'),
        line: v('line'),
        accent: v('accent'),
        'accent-bright': v('accent-bright'),
        wine: v('wine'),
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: { measure: '38rem' },
    },
  },
  plugins: [],
}
