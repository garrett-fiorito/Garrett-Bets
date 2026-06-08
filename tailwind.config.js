/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070914',
        panel: '#111827',
        line: '#263244',
        glow: '#00e5ff',
        limefire: '#c8ff2e',
        hot: '#ff3d81',
      },
      boxShadow: {
        neon: '0 0 32px rgba(0, 229, 255, 0.16)',
      },
    },
  },
  plugins: [],
};
