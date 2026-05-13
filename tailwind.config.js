/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8eef8',
          100: '#c5d4ed',
          200: '#9fb8e1',
          300: '#7a9cd5',
          400: '#5e87cb',
          500: '#1E4FA3',
          600: '#1a4693',
          700: '#153c7e',
          800: '#113269',
          900: '#0c2450',
        },
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.8)',
          solid: '#ffffff',
        },
        background: '#f2f2f2',
        muted: '#6b7280',
      },
      borderRadius: {
        glass: '12px',
        'glass-lg': '16px',
        'glass-sm': '10px',
      },
      boxShadow: {
        glass: '0 4px 24px rgba(0, 0, 0, 0.06)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.1)',
        subtle: '0 1px 8px rgba(0, 0, 0, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
