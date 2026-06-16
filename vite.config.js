import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react()],
    server: {
      allowedHosts: ['reporter-electable-shape.ngrok-free.dev'],
      proxy: {
        '/api/rog': {
          target: 'https://rog.logrocket.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rog/, ''),
          headers: {
            'Authorization': `Bearer ${env.VITE_ROG_TOKEN}`,
          },
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: {
            'x-api-key': env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        },
      },
    },
  }
})
