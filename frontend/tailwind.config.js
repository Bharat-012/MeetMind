/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        lavender: {
          50: '#FAF8FF',
          100: '#F3F0FF',
          200: '#EAE5FF',
          300: '#DDD5FF',
          400: '#C2B3FC',
        },
        primary: {
          purple: '#8B45D6',
          deep: '#7135C5',
          magenta: '#C23DB4',
        },
        ink: {
          primary: '#252238',
          secondary: '#77738A',
          muted: '#9D99AF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F8F6FF',
          muted: '#F9F7FD',
        },
        line: {
          DEFAULT: '#E9E4F2',
          subtle: '#F0ECF8',
        },
        pastel: {
          blue: '#B9D9F8',
          cyan: '#C8EFF0',
          green: '#D8F3E2',
          purple: '#E0CFFC',
          pink: '#FBCDD9',
        }
      }
    },
  },
  plugins: [],
}
