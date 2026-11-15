/** @type {import('tailwindcss').Config} */
// Design tokens from the CareerOS UI design canvas (ink + one blue accent, warm orange for gaps).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#111318', 2: '#23262E', soft: '#3D4250', muted: '#5B6170', faint: '#8A909C' },
        line: { DEFAULT: '#E3E5EA', strong: '#D5D8DF', dashed: '#C3C7D0' },
        canvas: '#F5F6F8',
        subtle: '#FAFBFC',
        accent: {
          DEFAULT: '#2346D8',
          hover: '#1A34A8',
          ink: '#1E3BB8',
          chip: '#E8EDFD',
          soft: '#EEF1FB',
          wash: '#F4F6FE',
          light: '#8EA6FF',
        },
        warn: {
          DEFAULT: '#9A3412',
          ink: '#7C2D12',
          chip: '#FDEEE6',
          wash: '#FFF8F4',
          alert: '#FFF4EC',
          line: '#F6D9C7',
          border: '#F3C6A8',
          dashed: '#E9A27A',
          strong: '#C2410C',
          light: '#FDBA8C',
        },
        night: { DEFAULT: '#111318', card: '#1D2029', line: '#2E323D', text: '#C9CDD6', muted: '#A7ADBA' },
        good: { DEFAULT: '#047857', wash: '#ECFDF5', line: '#A7F3D0' },
      },
      boxShadow: {
        float: '0 24px 48px -24px rgba(17,19,24,0.18)',
      },
    },
  },
  plugins: [],
};
