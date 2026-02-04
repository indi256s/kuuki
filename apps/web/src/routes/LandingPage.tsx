import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useShowcase } from '@/hooks/useShowcase'
import { ShowcaseModal } from '@/components/onboarding/ShowcaseModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plane, Globe2, BarChart3, Users, Languages, ArrowRight } from 'lucide-react'

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
      <main className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-balance animate-fade-up">
            {t('landing.hero.title')}
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

        {/* Features grid */}
        <div className="max-w-5xl mx-auto mt-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50 hover:border-primary/30 transition-[border-color] duration-200 group">
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-[background-color,transform] duration-300">
                  <feature.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
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
