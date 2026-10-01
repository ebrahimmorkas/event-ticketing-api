import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // In development the API is proxied, so the browser talks to a single origin.
    proxy: { '/api': API_TARGET, '/health': API_TARGET },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely, so it gets its own long-lived cache entries.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            {
              name: 'data',
              test: /node_modules[\\/](@tanstack|zod|react-hook-form|@hookform)[\\/]/,
            },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory|es-toolkit)/ },
          ],
        },
      },
    },
  },
  preview: {
    port: 4173,
    proxy: { '/api': API_TARGET, '/health': API_TARGET },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
