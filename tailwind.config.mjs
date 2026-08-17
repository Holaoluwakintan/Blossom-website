/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          980: '#02050B',
          950: '#040813',
          900: '#081021',
          850: '#0D1831',
          800: '#132142',
          700: '#1C2F5D'
        },
        gold: {
          200: '#FAF0D1',
          300: '#F5E3A9',
          400: '#E8C868',
          500: '#D4AF37',
          600: '#B69224',
          700: '#8E6E16'
        },
        parchment: '#F6F3EC'
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        editorial: ['"Cormorant Garamond"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}