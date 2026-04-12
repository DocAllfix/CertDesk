import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_CONFIG } from '@/config/app.config'

// ── Sentry init (solo se DSN configurato) ───────────────────────
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    beforeSend(event) {
      // Rimuovi dati sensibili dal payload
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['Authorization']
          delete event.request.headers['authorization']
          delete event.request.headers['Cookie']
          delete event.request.headers['cookie']
        }
        if (
          event.request.data &&
          typeof event.request.data === 'string' &&
          event.request.data.toLowerCase().includes('password')
        ) {
          event.request.data = '[REDACTED]'
        }
      }
      return event
    },
  })
}

// Applica titolo e favicon da configurazione cliente
document.title = APP_CONFIG.appName
const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (faviconEl) faviconEl.href = APP_CONFIG.faviconUrl

// StrictMode rimosso: causa infinite setState loop con Radix UI + React 19
// (useComposedRefs double-mount trigger). In produzione StrictMode non gira,
// quindi non c'è impatto. Si può ripristinare quando Radix supporterà React 19.
createRoot(document.getElementById('root')!).render(<App />)
