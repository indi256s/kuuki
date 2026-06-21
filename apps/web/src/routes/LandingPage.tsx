import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useShowcase } from '@/hooks/useShowcase'
import { ShowcaseModal } from '@/components/onboarding/ShowcaseModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plane, Globe2, BarChart3, Users, Languages, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LandingPage() {
  const { t } = useTranslation()
  const { currentLanguage, toggleLanguage } = useLanguage()
  const { shouldShow, markAsSeen, hasSeen } = useShowcase()

  // Don't render until localStorage check completes
  if (hasSeen === null) {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center">
        <div
          className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"
          role="status"
          aria-label={t('common.loading', 'Loading')}
        />
      </div>
    )
  }

  const features = [
    {
      icon: Plane,
      title: t('landing.features.tracking.title', 'Flight Tracking'),
      description: t('landing.features.tracking.description', 'Log your flights with AI-powered import from boarding passes and itineraries'),
    },
    {
      icon: Globe2,
      title: t('landing.features.places.title', 'Visited Places'),
      description: t('landing.features.places.description', 'Automatically track countries and cities from your flight history'),
    },
    {
      icon: BarChart3,
      title: t('landing.features.stats.title', 'Travel Stats'),
      description: t('landing.features.stats.description', 'Discover insights about your travel patterns and achievements'),
    },
    {
      icon: Users,
      title: t('landing.features.social.title', 'Social'),
      description: t('landing.features.social.description', 'Share profiles and compete on leaderboards with friends'),
    },
  ]

  const [featured, ...secondary] = features
  const heroTitle = t('landing.hero.title')

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      {/* Showcase Modal */}
      {shouldShow && <ShowcaseModal onComplete={markAsSeen} />}

      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {t('common.appName')}
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={toggleLanguage}
          aria-label={t('settings.toggleLanguage', 'Toggle language')}
          className="gap-2"
        >
          <Languages className="w-4 h-4" />
          {currentLanguage === 'en' ? 'RU' : 'EN'}
        </Button>
      </header>

      {/* Hero */}
      <main id="main-content" className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-balance animate-fade-up">
            {heroTitle}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance animate-fade-up" style={{ animationDelay: '50ms' }}>
            {t('landing.hero.subtitle')}
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: '100ms' }}>
            <Button asChild size="lg" className="text-base px-8 gap-2">
              <Link to="/">
                {t('landing.hero.signIn')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8">
              <a href="mailto:invite@kuuki.app?subject=Kuuki%20Invite%20Request">
                {t('landing.hero.requestInvite')}
              </a>
            </Button>
          </div>
        </div>

        {/* Features: featured row + compact trio */}
        <section className="max-w-5xl mx-auto mt-24 space-y-4 stagger-children" aria-label={t('landing.features.ariaLabel', 'Features')}>
          <Card className="border-border/50 hover:border-primary/30 transition-[border-color] duration-200 group">
            <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                <featured.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold mb-2">{featured.title}</h2>
                <p className="text-muted-foreground max-w-2xl">{featured.description}</p>
              </div>
            </CardContent>
          </Card>

          <ul className="grid sm:grid-cols-3 gap-4 list-none p-0 m-0">
            {secondary.map((feature) => (
              <li key={feature.title}>
                <Card className={cn(
                  'h-full border-border/50 hover:border-primary/30 transition-[border-color] duration-200 group'
                )}>
                  <CardContent className="p-5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors duration-300">
                      <feature.icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-medium mb-1 text-sm">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-snug">{feature.description}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('common.tagline')}
        </p>
      </footer>
    </div>
  )
}
