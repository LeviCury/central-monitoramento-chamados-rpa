/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        minerva: {
          navy: '#1D2E40',
          'navy-light': '#2a4158',
          'navy-dark': '#152231',
          red: '#F84454',
          'red-light': '#ff6b78',
          'red-dark': '#d63644',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'minerva': '0 4px 20px -2px rgba(29, 46, 64, 0.15)',
        'minerva-lg': '0 10px 40px -10px rgba(29, 46, 64, 0.2)',
      },
    },
  },
  plugins: [],
};
