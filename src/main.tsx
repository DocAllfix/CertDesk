import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_CONFIG } from '@/config/app.config'

// Applica titolo e favicon da configurazione cliente
document.title = APP_CONFIG.appName
const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (faviconEl) faviconEl.href = APP_CONFIG.faviconUrl

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
