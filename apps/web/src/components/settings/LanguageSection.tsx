import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'

export function LanguageSection() {
  const { t } = useTranslation()
  const { currentLanguage, setLanguage, supportedLanguages } = useLanguage()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          {t('settings.language.title')}
        </CardTitle>
        <CardDescription>{t('settings.language.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {supportedLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${currentLanguage === lang
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }
              `}
            >
              {t(`settings.languages.${lang}`)}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
