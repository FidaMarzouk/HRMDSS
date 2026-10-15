import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads HRMS_app/.env so the dev proxy follows the backend's port.
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_BACKEND_URL || 'http://localhost:8081'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': backend,
        '/uploads': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
  }
})
