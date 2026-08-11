import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchIntegrationCatalogue, fetchLogosFor, CATALOGUE_URL } from './api/_integrationCatalogue.js'
import { fetchCustomerLogos } from './api/_customerLogos.js'
import { fetchBrandLogos } from './api/_brandLogos.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [
      react(),
      {
        // In production the Express server serves /api/me from the IAP header.
        // Locally there is no IAP, so return no email (anonymous identify).
        name: 'dev-api-me',
        configureServer(server) {
          server.middlewares.use('/api/me', (_req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ email: null }))
          })
        },
      },
      {
        // Mirrors the Express /api/integrations route in dev: fetches and parses
        // LogRocket's live integration catalogue server-side (avoids CORS).
        name: 'dev-api-integrations',
        configureServer(server) {
          server.middlewares.use('/api/integrations', async (req, res) => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const params = new URL(req.url, 'http://localhost').searchParams
              const brand = params.get('brand')
              if (brand) {
                const map = await fetchBrandLogos(brand.split(',').map(s => s.trim()))
                res.end(JSON.stringify({ logos: map }))
                return
              }
              const customers = params.get('customers')
              if (customers) {
                const map = await fetchCustomerLogos(customers.split(',').map(s => s.trim()))
                res.end(JSON.stringify({ logos: map }))
                return
              }
              const logos = params.get('logos')
              if (logos) {
                const map = await fetchLogosFor(logos.split(',').map(s => s.trim()))
                res.end(JSON.stringify({ logos: map }))
                return
              }
              const integrations = await fetchIntegrationCatalogue()
              res.end(JSON.stringify({ source: CATALOGUE_URL, count: integrations.length, integrations }))
            } catch (e) {
              res.statusCode = 502
              res.end(JSON.stringify({ error: e.message }))
            }
          })
        },
      },
    ],
    server: {
      allowedHosts: ['reporter-electable-shape.ngrok-free.dev'],
      proxy: {
        '/api/rog': {
          target: 'https://rog.logrocket.com',
          changeOrigin: true,
          rewrite: () => '/api/v1/ask',
          headers: {
            'Authorization': `Bearer ${env.VITE_ROG_TOKEN}`,
          },
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: () => '/v1/messages',
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
