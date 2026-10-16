/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rpps: {
          sidebar: '#7cd1f0',
          dark: '#8ed9f0',
          header: '#2e454e',
          paper: '#eaf0ed',
          card: '#f7f9f8',
          border: '#bdcac6',
          ink: '#88d5ef',
          muted: '#6d7d82',
          primary: '#90f4e6',
          accent: '#8fcdf0',
          brown: '#f1860b',
          red: '#a96a65',
        },
      },
    },
  },
  plugins: [],
};