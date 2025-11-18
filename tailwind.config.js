/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00E2C7',
        accent: '#FF2401',
        dark: {
          DEFAULT: '#111111',
          card: '#151515',
          border: '#2B2B2B',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#BBBBBB',
          tertiary: '#777777',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'sans-serif'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px',
      },
      maxWidth: {
        'content': '1200px',
      },
    },
  },
  plugins: [],
}

