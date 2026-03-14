import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Force ES format for workers to support code-splitting and modern features
  worker: {
    format: 'es',
  },
  // Allow Vite to optimize ONNX & Transformers dependencies for better bundling
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react'],
          utils: ['xlsx', 'papaparse']
        }
      }
    }
  }
})
