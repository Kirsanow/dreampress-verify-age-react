import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: '/dreampress-verify-age-react/',
  assetsInlineLimit: 0,
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'face-api': ['face-api.js']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.json', '**/*.bin'],
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    exclude: ['face-api.js']
  }
})