import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle sql.js agar esbuild menambahkan interop CJS→ESM (default export
    // tersedia di mode dev). Tanpa ini, Vite menyajikan file mentah sql-wasm-browser.js
    // yang tak mengekspor `default`. WASM tetap dimuat via `?url` + locateFile.
    include: ['sql.js'],
  },
  server: {
    port: 5173,
    host: true,
  },
})
