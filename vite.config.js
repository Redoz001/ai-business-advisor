import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * PROJECT: REUBEN MURIMI SINGULARITY
 * Role: Build Orchestrator
 * Target: Ubuntu Lab Environment
 */
export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      // Allows for clean "Sovereign Imports" across the architecture
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Optimized for Ubuntu local development
    port: 3000,
    strictPort: true,
    host: true, // Exposed for testing Reuben HUD on mobile/external devices
    watch: {
      usePolling: true, // Necessary for stability on some Ubuntu filesystems
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false, // Security Audit Mode: Disable source maps for production
    minify: 'terser', // High-density code compression
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for Murimi Engine debugging
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Chunking Strategy: Separates logic core from the UI framework
        manualChunks: {
          vendor: ['react', 'react-dom'],
          logic: ['./src/lib/ghostProtocol.js', './src/services/aiService.js'],
        },
      },
    },
  },
});
