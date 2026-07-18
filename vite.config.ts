import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // sql.js ships a wasm file that Vite should not try to pre-bundle
    exclude: ['sql.js'],
  },
  server: {
    port: 5173,
    host: true,
  },
})
