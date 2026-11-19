import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (p: string) => resolve(__dirname, p);

/**
 * Builds the Chrome extension into dist/ (load it with chrome://extensions → "Load unpacked").
 * The side panel reuses the website's code from ../frontend/src (API client, auth, i18n, UI,
 * PDF), and reads the same VITE_* settings from frontend/.env.production written by deploy.
 */
export default defineConfig({
  plugins: [react()],
  envDir: here('../frontend'),
  base: './',
  server: { fs: { allow: [here('..')] } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The PDF chunk (pdf-lib + fontkit) is lazy, loaded only on the first PDF download.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      input: {
        sidepanel: here('sidepanel.html'),
        background: here('src/background.ts'),
      },
      output: {
        // The manifest points at a fixed service-worker file name.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
