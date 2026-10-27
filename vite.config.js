import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = process.env.API_PORT || env.API_PORT || '4179'
  const apiTarget = `http://127.0.0.1:${apiPort}`
  return {
    plugins: [react()],
    server: { proxy: { '/api': apiTarget } },
    preview: { proxy: { '/api': apiTarget } },
  }
})
