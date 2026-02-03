import { useState, useCallback, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Stamp,
  Globe2,
  Map,
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

  // Calculate continent distribution for display
  const continentDistribution = useMemo(() => {
    if (!countries) return []

    const continentCounts: Record<string, number> = {}
    for (const country of countries) {
      continentCounts[country.continent] = (continentCounts[country.continent] || 0) + 1
    }

    const continentNames: Record<string, string> = {
      europe: 'Europe',
      asia: 'Asia',
      americas: 'Americas',
      africa: 'Africa',
      oceania: 'Oceania',
      antarctica: 'Antarctica',
    }

    return Object.entries(continentCounts)
      .map(([continent, count]) => ({
        continent,
        name: continentNames[continent] || continent,
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [countries])

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

      {/* Main content - pb-safe adds bottom padding for mobile tab bar */}
      <main className="max-w-6xl mx-auto px-6 py-8 pb-safe sm:pb-8">
        {/* Page header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Stamp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  {t('passport.title', 'Passport')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('passport.subtitle', 'Your collection of visited countries')}
                </p>
              </div>
            </div>
          </div>

          {/* Stats summary */}
          {hasCountries && stats && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{stats.countriesCount}</span>
                  <span className="text-muted-foreground"> {t('passport.countriesLabel', 'countries')}</span>
                </span>
              </div>
              <span className="text-muted-foreground">·</span>
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{stats.continentsCount}</span>
                  <span className="text-muted-foreground"> {t('passport.continentsLabel', 'continents')}</span>
                </span>
              </div>
              <span className="text-muted-foreground">·</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="font-semibold">{stats.worldCompletion.toFixed(1)}%</span>
                  <span className="text-muted-foreground"> {t('passport.worldCompletion', 'of the world')}</span>
                </span>
              </div>

              {/* Continent badges */}
              <div className="hidden md:flex items-center gap-1.5 ml-auto">
                {continentDistribution.map(({ continent, name, count }) => (
                  <Badge
                    key={continent}
                    variant="secondary"
                    className="text-xs"
                  >
                    {name}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Passport content */}
        {countriesLoading ? (
          <PassportStamps entries={[]} isLoading themeColor={themeColor} />
        ) : hasCountries ? (
          <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
            <PassportStamps
              entries={countries ?? []}
              themeColor={themeColor}
            />
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
