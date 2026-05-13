/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Marca Minerva preservada — usada como acento pontual.
        minerva: {
          navy: '#1D2E40',
          'navy-light': '#2a4158',
          'navy-dark': '#152231',
          'navy-deeper': '#0E1822',
          red: '#F84454',
          'red-light': '#ff6b78',
          'red-dark': '#d63644',
        },
        // Cinzas neutros calibrados (Apple-style). Substituem a maioria
        // dos `slate-*` em uso. São mais quentes que slate puro, dando
        // um ar mais sofisticado.
        ink: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e8e8eb',
          300: '#d3d3d8',
          400: '#a0a0a8',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#26262a',
          900: '#18181b',
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        // Escala Apple-style: títulos com tracking negativo,
        // labels com tracking positivo (uppercase pequeno).
        'tightest': '-0.05em',
        'tighter-2': '-0.04em',
        'wider-2': '0.14em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
        '5xl': '2.25rem',
      },
      boxShadow: {
        // Apenas 3 níveis de sombra, todos muito sutis. Apple usa
        // sombras quase imperceptíveis — a profundidade vem da cor.
        'subtle': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px 0 rgb(0 0 0 / 0.02)',
        'soft': '0 4px 16px -4px rgb(15 23 42 / 0.06), 0 2px 6px -2px rgb(15 23 42 / 0.04)',
        'lifted': '0 16px 40px -12px rgb(15 23 42 / 0.10), 0 6px 16px -4px rgb(15 23 42 / 0.06)',
        // Inset sutil pro topo de glass cards
        'top-highlight': 'inset 0 1px 0 0 rgb(255 255 255 / 0.6)',
        'top-highlight-dark': 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      backdropBlur: {
        xs: '4px',
        '2xl': '32px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'progress-linear': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slide-in-right 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-out-right': 'slide-out-right 0.24s cubic-bezier(0.4, 0, 0.6, 1) forwards',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
