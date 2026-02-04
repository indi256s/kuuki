import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  const { t } = useTranslation()

  return (
    <section className="text-center py-16 px-4">
      {/* Main headline */}
      <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-4 tracking-tight">
        {t('landing.hero.title')}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
        {t('landing.hero.subtitle')}
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild size="lg" className="text-lg">
          <Link to="/">
            {t('landing.hero.signIn')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="text-lg">
          <a href="mailto:invite@kuuki.app?subject=Kuuki%20Invite%20Request">
            {t('landing.hero.requestInvite')}
          </a>
        </Button>
      </div>
    </section>
  )
}
