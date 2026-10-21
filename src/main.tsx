import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { Capacitor } from '@capacitor/core'
import App from './App'

const renderApp = () => {
  createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

if (Capacitor.getPlatform() === 'android') {
  void import('./lib/nativePdfDownload')
    .catch((error: unknown) => {
      console.error('Could not load the Android PDF download bridge:', error)
    })
    .finally(renderApp)
} else {
  renderApp()
}
