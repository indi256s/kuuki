import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Pencil } from 'lucide-react'

interface ImportCTAProps {
  onImport: () => void
  onManual: () => void
  onSkip: () => void
}

export function ImportCTA({ onImport, onManual, onSkip }: ImportCTAProps) {
  const { t } = useTranslation()

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          {t('onboarding.import.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('onboarding.import.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Import option */}
        <Card
          className="border-border/50 hover:border-border hover:shadow-md transition-all cursor-pointer group"
          onClick={onImport}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">
                  {t('onboarding.import.importOption')}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('onboarding.import.importDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual option */}
        <Card
          className="border-border/50 hover:border-border hover:shadow-md transition-all cursor-pointer group"
          onClick={onManual}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-secondary group-hover:scale-110 transition-all">
                <Pencil className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">
                  {t('onboarding.import.manualOption')}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('onboarding.import.manualDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skip option */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={onSkip}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            {t('onboarding.import.skipOption')}
          </Button>
        </div>
      </div>
    </div>
  )
}
