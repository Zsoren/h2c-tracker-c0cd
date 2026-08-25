import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { store } from './state/store'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (navigator.serviceWorker.controller) store.setFlags({ offlineReady: true })
  registerSW({
    immediate: true,
    onOfflineReady() { store.setFlags({ offlineReady: true }) },
    onRegisteredSW() { if (navigator.serviceWorker.controller) store.setFlags({ offlineReady: true }) },
  })
} else {
  store.setFlags({ offlineReady: false, noSW: true })
}
