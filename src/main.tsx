import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_CONFIG } from '@/config/app.config'

// Applica titolo e favicon da configurazione cliente
document.title = APP_CONFIG.appName
const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (faviconEl) faviconEl.href = APP_CONFIG.faviconUrl

// StrictMode rimosso: causa infinite setState loop con Radix UI + React 19
// (useComposedRefs double-mount trigger). In produzione StrictMode non gira,
// quindi non c'è impatto. Si può ripristinare quando Radix supporterà React 19.
createRoot(document.getElementById('root')!).render(<App />)
