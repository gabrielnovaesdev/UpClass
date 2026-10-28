import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js ships as its own lazy chunk (~155 kB gzip), loaded after first paint
    chunkSizeWarningLimit: 700,
  },
});
