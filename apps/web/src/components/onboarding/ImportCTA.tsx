import { useTranslation } from 'react-i18next'

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
        <h1 className="text-2xl font-semibold text-ink mb-2">
          {t('onboarding.import.title')}
        </h1>
        <p className="text-ink-muted">
          {t('onboarding.import.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Import option */}
        <button
          onClick={onImport}
          className="w-full text-left bg-sky-raised border border-edge rounded-xl p-4 hover:border-edge-strong transition-colors focus-ring"
        >
          <div className="flex items-start gap-4">
            <div className="text-2xl" role="img" aria-hidden="true">
              📷
            </div>
            <div>
              <h3 className="font-medium text-ink">
                {t('onboarding.import.importOption')}
              </h3>
              <p className="text-sm text-ink-muted mt-0.5">
                {t('onboarding.import.importDescription')}
              </p>
            </div>
          </div>
        </button>

        {/* Manual option */}
        <button
          onClick={onManual}
          className="w-full text-left bg-sky-raised border border-edge rounded-xl p-4 hover:border-edge-strong transition-colors focus-ring"
        >
          <div className="flex items-start gap-4">
            <div className="text-2xl" role="img" aria-hidden="true">
              ✏️
            </div>
            <div>
              <h3 className="font-medium text-ink">
                {t('onboarding.import.manualOption')}
              </h3>
              <p className="text-sm text-ink-muted mt-0.5">
                {t('onboarding.import.manualDescription')}
              </p>
            </div>
          </div>
        </button>

        {/* Skip option */}
        <div className="pt-4 border-t border-edge">
          <button
            onClick={onSkip}
            className="w-full text-center py-3 text-ink-muted hover:text-ink transition-colors focus-ring rounded-lg"
          >
            <span className="text-sm">
              {t('onboarding.import.skipOption')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
