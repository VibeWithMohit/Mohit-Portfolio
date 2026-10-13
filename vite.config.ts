import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The build runs twice: once for the browser, once (--ssr) to prerender the
// page into static HTML so text and navigation arrive before any JavaScript.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  define: {
    // Day granularity keeps the client and SSR builds in agreement.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2022',
    copyPublicDir: !isSsrBuild,
    // three.js is isolated in its own lazily loaded chunk, so a warning above
    // this size means something heavy leaked into the critical path.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
