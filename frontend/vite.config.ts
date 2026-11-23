import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // `neon deploy` writes branch credentials to the repository root `.env.local`.
  envDir: '..',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Talk to Spring Boot without CORS headaches during development.
      '/api': 'http://localhost:8080',
    },
  },
})
