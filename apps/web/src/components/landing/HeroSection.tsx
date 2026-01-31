import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function HeroSection() {
  const { t } = useTranslation()

  return (
    <section className="text-center py-16 px-4">
      {/* Main headline */}
      <h1 className="text-4xl md:text-5xl font-semibold text-ink mb-4 tracking-tight">
        {t('landing.hero.title')}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-ink-muted max-w-xl mx-auto mb-10 leading-relaxed">
        {t('landing.hero.subtitle')}
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/auth"
          className="px-6 py-3 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors focus-ring font-medium text-lg"
        >
          {t('landing.hero.signIn')}
        </Link>
        <a
          href="mailto:invite@kuuki.app?subject=Kuuki%20Invite%20Request"
          className="px-6 py-3 border border-edge-strong text-ink rounded-lg hover:bg-sky-sunken transition-colors focus-ring font-medium text-lg"
        >
          {t('landing.hero.requestInvite')}
        </a>
      </div>
    </section>
  )
}
