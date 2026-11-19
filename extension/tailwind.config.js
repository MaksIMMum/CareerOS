import base from '../frontend/tailwind.config.js';

/** The website's design tokens; also scans the website components the side panel reuses. */
/** @type {import('tailwindcss').Config} */
export default {
  ...base,
  content: ['./sidepanel.html', './src/**/*.{ts,tsx}', '../frontend/src/components/**/*.{ts,tsx}'],
};
