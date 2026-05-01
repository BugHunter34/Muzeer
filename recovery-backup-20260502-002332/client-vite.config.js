import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome >= 49', 'safari >= 10'],
      renderLegacyChunks: true,
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true, // Ensures it doesn't jump to 5174 if 5173 is "busy"
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/media-api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media-api/, '/api')
      }
    },
    
    // In Vite 7, if 'all' isn't working, we must be explicit
    allowedHosts: [
      //'evocative-fransisca-bootlessly.ngrok-free.dev',
      //'.ngrok-free.dev', // This allows any subdomain of ngrok-free.dev
      'localhost'
    ],
    
    /** 
    hmr: {
      host: 'evocative-fransisca-bootlessly.ngrok-free.dev',
      protocol: 'wss',
      clientPort: 443 // Important: ngrok's external port is 443 (HTTPS)
    },*/
  },
})