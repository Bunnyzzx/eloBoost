/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import pkg from './package.json' with { type: 'json' };

// A porta é fixa porque o Tauri aponta para ela em `tauri.conf.json` (devUrl).
const DEV_PORT = 5173;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    // Identidade do build do frontend — usada quando a UI roda fora do Tauri.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Evita que o Vite tente limpar a tela e engula os erros do `tauri dev`.
  clearScreen: false,

  server: {
    port: DEV_PORT,
    strictPort: true,
    host: process.env['TAURI_DEV_HOST'] ?? false,
    watch: {
      // O backend Rust tem o próprio watcher (cargo). Ignorar evita recarga dupla.
      ignored: ['**/src-tauri/**', '**/crates/**', '**/target/**'],
    },
  },

  build: {
    // Alvo alinhado ao WebView2 (Edge/Chromium) no Windows 10/11.
    target: 'chrome110',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env['TAURI_ENV_DEBUG'] === 'true',
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
});
