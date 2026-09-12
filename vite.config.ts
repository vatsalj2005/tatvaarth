import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/tatvaarth/",

  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ['**/Database/**', '**/.git/**'],
    },
  },

  plugins: [
    react()
  ],

  optimizeDeps: {
    entries: ['index.html'],
  },

  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf')) {
              return 'vendor-jspdf';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer-motion';
            }
            return 'vendor';
          }
          if (id.includes('content/granth/') || id.includes('content\\granth\\')) {
            const match = id.match(/content[\\/]granth[\\/]([^\\/]+)[\\/]([^\\/]+)/);
            if (match) {
              const anuyog = match[1].slice(0, 2);
              const shastra = match[2].slice(0, 2);
              return `granth-${anuyog}-${shastra}`;
            }
            return 'granth-common';
          }
        }
      }
    }
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
