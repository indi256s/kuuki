import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePassportCountries, usePassportStats } from '@/hooks/usePassport'
import { PassportStamps } from '@/components/passport/PassportStamps'
import { EmptyPassport } from '@/components/passport/EmptyPassport'
import { ClaimDialog } from '@/components/passport/ClaimDialog'
import { CountryClaimMap } from '@/components/passport/CountryClaimMap'
import { CountryListSheet } from '@/components/passport/CountryListSheet'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { MapCard } from '@/components/dashboard/MapCard'
import {
  Stamp,
  Plus,
} from 'lucide-react'

export function PassportPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const isMobile = useIsMobile()
  const { data: countries, isLoading: countriesLoading } = usePassportCountries()
  const { data: stats } = usePassportStats()
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [preselectedCountry, setPreselectedCountry] = useState<string | null>(null)

  const themeColor = profile?.theme_color || 'teal'
  const hasCountries = (countries?.length ?? 0) > 0

  const handleAddCountry = useCallback(() => {
    setIsMapOpen(true)
  }, [])

  const handleSelectCountryFromMap = useCallback((countryCode: string) => {
    setPreselectedCountry(countryCode)
    setIsMapOpen(false)
    setIsClaimDialogOpen(true)
  }, [])

  const handleClaimDialogClose = useCallback(() => {
    setIsClaimDialogOpen(false)
    setPreselectedCountry(null)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-soft">

      {/* Mobile header */}
      <MobileHeader
        action={
          hasCountries ? (
            <Button onClick={handleAddCountry} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{t('passport.addCountry', 'Add')}</span>
            </Button>
          ) : undefined
        }
      />

      {/* Desktop header */}
      <AppHeader />

      {/* Main content */}
      <main className="max-w-7xl 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6">

        {/* Hero Section: Map & Stats */}
        {hasCountries && (
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up">
            {/* Map Card - Spans 2 columns */}
            <MapCard className="lg:col-span-2 min-h-[300px]" />

            {/* Stats Summary - Spans 1 column */}
            <div className="space-y-4">
              <div className="h-full rounded-2xl border border-border/50 bg-card p-6 flex flex-col justify-between hover:border-primary/30 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Stamp className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight">
                      {t('passport.title', 'Passport')}
                    </h1>
                  </div>

                  <div className="space-y-6">
                    {/* Metric 1: Countries */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.countriesLabel', 'Countries')}</div>
                      <div className="font-mono text-3xl font-semibold">
                        {stats?.countriesCount ?? 0}
                      </div>
                    </div>

                    {/* Metric 2: Continents */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.continentsLabel', 'Continents')}</div>
                      <div className="font-mono text-3xl font-semibold">
                        {stats?.continentsCount ?? 0}
                        <span className="text-lg text-muted-foreground/50 ml-1 font-normal">/ 7</span>
                      </div>
                    </div>

                    {/* Metric 3: World % */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.worldCompletion', 'World Explored')}</div>
                      <div className="flex items-baseline gap-2">
                        <div className="font-mono text-3xl font-semibold">
                          {stats?.worldCompletion.toFixed(1)}%
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${Math.min(100, stats?.worldCompletion ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full mt-8" onClick={handleAddCountry} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('passport.addCountry', 'Add Country')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Passport Grid */}
        {countriesLoading ? (
          <PassportStamps entries={[]} isLoading themeColor={themeColor} />
        ) : hasCountries ? (
          <div className="space-y-4">
            {!hasCountries && (
              // Fallback title if map hidden (empty state handled below)
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Stamp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {t('passport.title', 'Passport')}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t('passport.subtitle', 'Your collection of visited countries')}
                  </p>
                </div>
              </div>
            )}

            <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
              <PassportStamps
                entries={countries ?? []}
                themeColor={themeColor}
              />
            </div>
          </div>
        ) : (
          <EmptyPassport onAddCountry={handleAddCountry} />
        )}
      </main>

      {/* Country selection: Sheet on mobile, Dialog on desktop */}
      {isMobile ? (
        <CountryListSheet
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onSelectCountry={handleSelectCountryFromMap}
        />
      ) : (
        <CountryClaimMap
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onSelectCountry={handleSelectCountryFromMap}
        />
      )}

      {/* Claim dialog */}
      <ClaimDialog
        isOpen={isClaimDialogOpen}
        onClose={handleClaimDialogClose}
        preselectedCountry={preselectedCountry}
      />

      {/* Mobile tab bar */}
      <MobileTabBar />
    </div>
  )
}
