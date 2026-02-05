import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n' // Initialize i18n
import { initializeTheme } from './hooks/useTheme'
import { initializeAccentColor } from './hooks/useAccentColor'

// Initialize theme before render to prevent flash (must run before accent color)
initializeTheme()
// Initialize accent color before render to prevent flash
initializeAccentColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
