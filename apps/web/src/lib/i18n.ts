import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { enTranslations } from '@kuuki/shared'

export const supportedLanguages = ['en', 'ru'] as const
export type SupportedLanguage = typeof supportedLanguages[number]

// Detect language early to decide which bundle to load synchronously
const detectedLang = localStorage.getItem('kuuki-language')
  || (navigator.language?.startsWith('ru') ? 'ru' : 'en')
const initialLang: SupportedLanguage = detectedLang === 'ru' ? 'ru' : 'en'

// Load only the initial language synchronously; lazy-load the other on demand
const initialResources: Record<string, { translation: Record<string, unknown> }> = {}

if (initialLang === 'en') {
  initialResources.en = { translation: enTranslations }
} else {
  // For Russian initial load, we still need something — load en sync (it's the fallback)
  // and load ru async immediately
  initialResources.en = { translation: enTranslations }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: initialResources,
    lng: initialLang,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'kuuki-language',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    saveMissing: false,
  })

// Lazy-load Russian translations
async function loadRuTranslations(): Promise<void> {
  if (i18n.hasResourceBundle('ru', 'translation')) return
  const { ruTranslations } = await import('@kuuki/shared')
  i18n.addResourceBundle('ru', 'translation', ruTranslations, true, true)
}

// If initial language is Russian, load it immediately
if (initialLang === 'ru') {
  loadRuTranslations()
}

export default i18n

// Helper to change language and persist
export async function changeLanguage(lang: SupportedLanguage) {
  if (lang === 'ru') {
    await loadRuTranslations()
  }
  i18n.changeLanguage(lang)
  localStorage.setItem('kuuki-language', lang)
}

// Get current language - strictly return 'ru' only if detected, otherwise 'en'
export function getCurrentLanguage(): SupportedLanguage {
  const detected = i18n.language?.split('-')[0]
  return detected === 'ru' ? 'ru' : 'en'
}
