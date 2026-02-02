import { useTranslation } from 'react-i18next'

const FEATURES = [
  { key: 'log', icon: '✈️' },
  { key: 'stats', icon: '📊' },
  { key: 'compete', icon: '🏆' },
] as const

export function FeatureGrid() {
  const { t } = useTranslation()

  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.key}
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            {/* Icon */}
            <div
              className="text-4xl mb-4"
              role="img"
              aria-hidden="true"
            >
              {feature.icon}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t(`landing.features.${feature.key}.title`)}
            </h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`landing.features.${feature.key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
