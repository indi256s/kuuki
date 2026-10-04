import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n' // Initialize i18n
import { initializeTheme } from './hooks/useTheme'
import { initializeAccentColor } from './hooks/useAccentColor'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { CrashScreen } from './components/error/CrashScreen'

let bootError: Error | null = null
try {
  // Initialize before render to avoid a theme flash and restore the account.
  initializeTheme()
  initializeAccentColor()
  useAuthStore.getState().initialize()
} catch (error) {
  bootError = error instanceof Error ? error : new Error(String(error))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {bootError ? <CrashScreen error={bootError} /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
