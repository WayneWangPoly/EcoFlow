/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eco: {
          ink: '#101815',
          panel: '#16211D',
          leaf: '#2F6B4F',
          success: '#15803D',
          acid: '#B7E06B',
          fog: '#F6F7F4',
          line: '#DFE5DD',
          muted: '#6E7A72',
          amber: '#D89B2B',
          red: '#C94C4C'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(16,24,21,0.08)'
      }
    }
  },
  plugins: []
};
