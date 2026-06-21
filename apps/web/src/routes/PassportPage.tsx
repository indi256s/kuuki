import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useFlightRoutes } from '@/hooks/useFlights'
import { usePassportCountries, usePassportStats } from '@/hooks/usePassport'
import { PassportStamps } from '@/components/passport/PassportStamps'
import { EmptyPassport } from '@/components/passport/EmptyPassport'
import { ClaimDialog } from '@/components/passport/ClaimDialog'
import { CountryClaimMap } from '@/components/passport/CountryClaimMap'
import { CountryListSheet } from '@/components/passport/CountryListSheet'
import { AppHeader } from '@/components/common/AppHeader'
import { AppPageShell } from '@/components/layout/AppPageShell'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Button } from '@/components/ui/button'
import { MapCard } from '@/components/map/MapCard'
import { cn } from '@/lib/utils'
import {
  Stamp,
  Plus,
} from 'lucide-react'

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

export function PassportPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const isMobile = useIsMobile()
  const { data: countries, isLoading: countriesLoading } = usePassportCountries()
  const { data: stats } = usePassportStats()
  const { data: flights = [] } = useFlightRoutes()
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [preselectedCountry, setPreselectedCountry] = useState<string | null>(null)
  const [isAlreadyClaimed, setIsAlreadyClaimed] = useState(false)

  const themeColor = profile?.theme_color || 'teal'
  const hasCountries = (countries?.length ?? 0) > 0

  const handleAddCountry = useCallback(() => {
    setIsMapOpen(true)
  }, [])

  const handleSelectCountryFromMap = useCallback((countryCode: string) => {
    const existingEntry = countries?.find(c => c.countryCode === countryCode)
    const alreadyClaimed = existingEntry?.source === 'claim' || existingEntry?.source === 'both'
    setPreselectedCountry(countryCode)
    setIsAlreadyClaimed(alreadyClaimed)
    setIsMapOpen(false)
    setIsClaimDialogOpen(true)
  }, [countries])

  const handleClaimDialogClose = useCallback(() => {
    setIsClaimDialogOpen(false)
    setPreselectedCountry(null)
    setIsAlreadyClaimed(false)
  }, [])

  return (
    <AppPageShell
      shellClassName="min-h-screen bg-gradient-soft"
      maxWidth="wide"
      className="mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6"
      mobileHeader={
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
      }
      appHeader={<AppHeader />}
      afterMain={
        <>
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

          <ClaimDialog
            isOpen={isClaimDialogOpen}
            onClose={handleClaimDialogClose}
            preselectedCountry={preselectedCountry}
            isAlreadyClaimed={isAlreadyClaimed}
          />
        </>
      }
      mobileTabBar={<MobileTabBar />}
    >

        {/* Hero Section: Map & Stats */}
        {hasCountries && (
          <div className={cn(
            'mb-8 grid grid-cols-1 gap-6 animate-fade-up transition-all duration-300',
            mapExpanded ? 'lg:grid-cols-1' : 'lg:grid-cols-3'
          )}>
            {/* Map Card - Spans 2 columns normally, full width when expanded */}
            <div className={cn(
              'transition-all duration-300',
              mapExpanded ? 'lg:col-span-1 min-h-[500px]' : 'lg:col-span-2 min-h-[300px]'
            )}>
              <MapCard
                flights={flights}
                passportEntries={countries ?? []}
                className="h-full"
                isExpanded={mapExpanded}
                onExpandChange={setMapExpanded}
                onCountryClick={handleSelectCountryFromMap}
              />
            </div>

            {/* Stats Summary - Spans 1 column (hidden when map expanded) */}
            <div className={cn(
              'space-y-4 transition-all duration-300',
              mapExpanded && 'hidden'
            )}>
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

                  <div className="space-y-5">
                    {/* Metric 1: Countries */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.countriesLabel', 'Countries')}</div>
                      <div className="font-mono text-3xl font-semibold">
                        {stats?.countriesCount ?? 0}
                      </div>
                      {(stats?.countriesCount ?? 0) > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {stats!.flightCountries > 0 && (
                            <span>{stats!.flightCountries} {t('passport.byAir', 'by air')}</span>
                          )}
                          {stats!.flightCountries > 0 && stats!.groundCountries > 0 && (
                            <span>, </span>
                          )}
                          {stats!.groundCountries > 0 && (
                            <span>{stats!.groundCountries} {t('passport.byLandSea', 'by land/sea')}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metric 2: Continents */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.continentsLabel', 'Continents')}</div>
                      <div className="font-mono text-3xl font-semibold">
                        {stats?.continentsCount ?? 0}
                        <span className="text-lg text-muted-foreground/50 ml-1 font-normal">/ 7</span>
                      </div>
                    </div>

                    {/* Metric 3: New This Year */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.newThisYear', 'New This Year')}</div>
                      <div className="font-mono text-3xl font-semibold">
                        {(stats?.newThisYear ?? 0) > 0 ? stats!.newThisYear : '—'}
                      </div>
                    </div>

                    {/* Metric 4: Last Stamp */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('passport.lastStamp', 'Last Stamp')}</div>
                      {stats?.lastStamp ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span>{countryCodeToFlag(stats.lastStamp.countryCode)}</span>
                          <span className="font-medium">{stats.lastStamp.countryName}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(stats.lastStamp.date), { addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                </div>

                <Button className="w-full mt-6" onClick={handleAddCountry} variant="outline">
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
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
            <PassportStamps
              entries={countries ?? []}
              themeColor={themeColor}
            />
          </div>
        ) : (
          <EmptyPassport onAddCountry={handleAddCountry} />
        )}
    </AppPageShell>
  )
}
