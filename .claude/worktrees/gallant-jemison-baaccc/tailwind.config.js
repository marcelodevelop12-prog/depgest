/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        card: 'var(--card)',
        sidebar: 'var(--sidebar)',
        primary: '#F5A623',
        border: 'var(--border)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        status: {
          novo: '#F5A623',
          separando: '#A855F7',
          a_caminho: '#3B82F6',
          entregue: '#22C55E',
          cancelado: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
