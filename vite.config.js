import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchIntegrationCatalogue, fetchLogosFor, CATALOGUE_URL } from './api/_integrationCatalogue.js'
import { fetchCustomerLogos } from './api/_customerLogos.js'
import { fetchBrandLogos } from './api/_brandLogos.js'
import { fetchSiteLogos } from './api/_siteLogos.js'
import express from 'express'
import { createAccountsRouter } from './api/accounts.js'
import { createAbmRouter } from './api/abm.js'
import { createMemoryStore } from './api/_abmStore.js'

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
        //
        // This is a SECOND COPY of api/integrations.js, not a use of it. Any new query
        // parameter has to be added in both, or it works in dev and 404s in production,
        // or the reverse: adding ?site= here only had it fall through to the catalogue
        // until this copy was updated too.
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
              const site = params.get('site')
              if (site) {
                const map = await fetchSiteLogos(site.split(',').map(s => s.trim()))
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
      {
        // Mounts the same router as server.js. Dev only ever talks to the Firestore
        // emulator: without FIRESTORE_EMULATOR_HOST the client would use your gcloud
        // credentials against the production database.
        name: 'dev-api-accounts',
        configureServer(server) {
          const app = express()
          if (process.env.FIRESTORE_EMULATOR_HOST) {
            process.env.GOOGLE_CLOUD_PROJECT ||= 'demo-mission-control'
            app.use(express.json({ limit: '2mb' }))
            app.use(createAccountsRouter({ fallbackUser: 'dev@localhost' }))
          } else {
            app.use((_req, res) => {
              res.status(503).json({ error: 'Start the Firestore emulator (npm run emulator) and run dev with FIRESTORE_EMULATOR_HOST=127.0.0.1:8181' })
            })
          }
          server.middlewares.use('/api/accounts', app)
        },
      },
      {
        // ABM landing pages. Backed by the in-memory store in dev so the whole flow can
        // be driven without the Cloud SDK; production swaps in Firestore and the bucket.
        // Remember this file is a SECOND COPY of the api routes, not a use of them.
        name: 'dev-api-abm',
        configureServer(server) {
          const app = express()
          app.use(createAbmRouter({
            store: createMemoryStore({ file: '.abm-dev-store.json' }),
            fallbackUser: process.env.ABM_DEV_USER || 'brooke@logrocket.com',
            rogToken: env.VITE_ROG_TOKEN,
            anthropicKey: env.VITE_ANTHROPIC_API_KEY,
          }))
          server.middlewares.use('/api/abm', app)
          // The public address, served locally the way explore will serve it.
          server.middlewares.use('/abm', (req, res, next) => {
            const slug = req.url.replace(/^\//, '').split(/[?#]/)[0]
            if (!/^[a-z0-9]{16,}$/.test(slug)) return next()
            req.url = `/live/${slug}`
            app(req, res, next)
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
