import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // pdf.js (~520 kB) is a lazy chunk loaded only when a user uploads a PDF.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Emit the pdf.js worker as .js: S3/CloudFront may serve .mjs with a non-JS content
        // type, and browsers refuse to start module workers from such files.
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
