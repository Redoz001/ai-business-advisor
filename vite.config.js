import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  base: "/",

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    minify: "esbuild",
    sourcemap: false,
    target: "esnext",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) return "three";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("react-markdown") || id.includes("remark-gfm") || id.includes("marked")) return "markdown";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "react";
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
});