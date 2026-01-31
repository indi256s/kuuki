import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { enTranslations, ruTranslations } from '@kuuki/shared'

export const supportedLanguages = ['en', 'ru'] as const
export type SupportedLanguage = typeof supportedLanguages[number]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      ru: { translation: ruTranslations },
    },
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,

    // Language detection options
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language in localStorage
      caches: ['localStorage'],
      // localStorage key
      lookupLocalStorage: 'kuuki-language',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // Don't load missing keys from backend
    saveMissing: false,
  })

export default i18n

// Helper to change language and persist
export function changeLanguage(lang: SupportedLanguage) {
  i18n.changeLanguage(lang)
  localStorage.setItem('kuuki-language', lang)
}

// Get current language
export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language?.split('-')[0] as SupportedLanguage) || 'en'
}
