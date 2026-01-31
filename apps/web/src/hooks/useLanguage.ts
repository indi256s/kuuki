import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { changeLanguage, getCurrentLanguage, supportedLanguages, type SupportedLanguage } from '@/lib/i18n'

export function useLanguage() {
  // useTranslation hook ensures component re-renders on language change
  useTranslation()

  const currentLanguage = getCurrentLanguage()

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    changeLanguage(lang)
  }, [])

  const toggleLanguage = useCallback(() => {
    const current = getCurrentLanguage()
    const next = current === 'en' ? 'ru' : 'en'
    changeLanguage(next)
  }, [])

  return {
    currentLanguage,
    setLanguage,
    toggleLanguage,
    supportedLanguages,
    isRussian: currentLanguage === 'ru',
    isEnglish: currentLanguage === 'en',
  }
}
