import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  base: "/", // ✅ ADD THIS (CRITICAL FIX)

  server: {
    port: 5173,
    strictPort: true
  },

  build: {
    minify: 'esbuild',
    sourcemap: false,
    target: 'esnext'
  },

  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})