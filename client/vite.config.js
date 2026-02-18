import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true, // Ensures it doesn't jump to 5174 if 5173 is "busy"
    
    // In Vite 7, if 'all' isn't working, we must be explicit
    allowedHosts: [
      'evocative-fransisca-bootlessly.ngrok-free.dev',
      '.ngrok-free.dev' // This allows any subdomain of ngrok-free.dev
    ],
    
    
    hmr: {
      host: 'evocative-fransisca-bootlessly.ngrok-free.dev',
      protocol: 'wss',
      clientPort: 443 // Important: ngrok's external port is 443 (HTTPS)
    },
  },
})