import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'
import { usePassportCountries } from '@/hooks/usePassport'
import { getAllCountries } from '@/lib/passport'

// Total countries/territories per UN recognition
const TOTAL_TERRITORIES = 249

// GLaDOS-style fun facts for Country Geek tier
const GLADOS_FACTS_KEYS = [
  'stats.countryGeek.fact.1',
  'stats.countryGeek.fact.2',
  'stats.countryGeek.fact.3',
  'stats.countryGeek.fact.4',
  'stats.countryGeek.fact.5',
]

// Continent colors for visual consistency
const CONTINENT_COLORS: Record<string, string> = {
  europe: 'bg-blue-500',
  asia: 'bg-amber-500',
  americas: 'bg-emerald-500',
  africa: 'bg-orange-500',
  oceania: 'bg-purple-500',
}

const CONTINENT_BG_COLORS: Record<string, string> = {
  europe: 'bg-blue-500/10 border-blue-500/20',
  asia: 'bg-amber-500/10 border-amber-500/20',
  americas: 'bg-emerald-500/10 border-emerald-500/20',
  africa: 'bg-orange-500/10 border-orange-500/20',
  oceania: 'bg-purple-500/10 border-purple-500/20',
}

interface ContinentStats {
  name: string
  key: string
  visited: number
  total: number
}

export function CountryGeekTier() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: visitedCountries } = usePassportCountries()
  const [showExpandedView, setShowExpandedView] = useState(false)

  const countries = getAllCountries()

  // Calculate countries per continent
  const countriesPerContinent = useMemo(() => {
    const counts: Record<string, number> = {
      europe: 0,
      asia: 0,
      americas: 0,
      africa: 0,
      oceania: 0,
    }

    Object.values(countries).forEach((country) => {
      if (country.continent in counts) {
        counts[country.continent]++
      }
    })

    return counts
  }, [countries])

  // Process continent breakdown data
  const continentStats = useMemo<ContinentStats[]>(() => {
    const breakdown = advancedStats?.continentBreakdown || {}

    const continentNames: Record<string, string> = {
      europe: 'Europe',
      asia: 'Asia',
      americas: 'Americas',
      africa: 'Africa',
      oceania: 'Oceania',
    }

    return Object.entries(continentNames).map(([key, name]) => ({
      key,
      name,
      visited: breakdown[key] || 0,
      total: countriesPerContinent[key] || 0,
    }))
  }, [advancedStats?.continentBreakdown, countriesPerContinent])

  // Total visited countries
  const totalVisited = useMemo(() => {
    return continentStats.reduce((sum, c) => sum + c.visited, 0)
  }, [continentStats])

  // Completion percentage
  const completionPercentage = useMemo(() => {
    return Math.round((totalVisited / TOTAL_TERRITORIES) * 100)
  }, [totalVisited])

  // Set of visited country codes for the expanded view
  const visitedCountryCodes = useMemo(
    () => new Set(visitedCountries?.map((c) => c.countryCode) ?? []),
    [visitedCountries]
  )

  // GLaDOS fact
  const gladosFact = useMemo(() => {
    if (!advancedStats) return null

    const factIndex = (advancedStats.featuredFactIndex + 1) % GLADOS_FACTS_KEYS.length
    const factKey = GLADOS_FACTS_KEYS[factIndex]

    // Find most visited continent
    const topContinent = continentStats.reduce((max, c) =>
      c.visited > max.visited ? c : max
    , continentStats[0])

    // Find least visited continent with any countries
    const leastContinent = continentStats
      .filter(c => c.total > 0)
      .reduce((min, c) => c.visited < min.visited ? c : min, continentStats[0])

    const remainingCountries = TOTAL_TERRITORIES - totalVisited
    const remainingPercentage = 100 - completionPercentage

    const fallbacks: Record<string, string> = {
      'stats.countryGeek.fact.1': `${totalVisited} countries. That's ${completionPercentage}% of Earth. The other ${remainingPercentage}% awaits your arrival.`,
      'stats.countryGeek.fact.2': `${topContinent.name} appears to be your preferred hemisphere. ${topContinent.visited} countries there alone.`,
      'stats.countryGeek.fact.3': `${leastContinent.name} seems... neglected. Only ${leastContinent.visited} of ${leastContinent.total} explored.`,
      'stats.countryGeek.fact.4': `${remainingCountries} territories remain unconquered. I admire your ambition. Or pity your schedule.`,
      'stats.countryGeek.fact.5': `Your geographical distribution is... ${continentStats.filter(c => c.visited > 0).length === 5 ? 'impressively balanced.' : 'somewhat lopsided.'}`,
    }

    return t(factKey, fallbacks[factKey])
  }, [advancedStats, continentStats, totalVisited, completionPercentage, t])

  if (!advancedStats) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Mobile: Vertical stack of all continents */}
      <div className="flex flex-col gap-2 sm:hidden">
        {continentStats.map((continent) => (
          <ContinentCard key={continent.key} continent={continent} compact />
        ))}
        {/* Expand button - full width on mobile */}
        <button
          onClick={() => setShowExpandedView(true)}
          className={cn(
            'flex items-center justify-center gap-2 p-3 rounded-xl border',
            'bg-muted/30 border-border/50 transition-all',
            'hover:bg-muted/50 hover:border-border',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <Globe2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {t('stats.countryGeek.viewAll', 'View All')}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Desktop: 3+2 grid layout */}
      <div className="hidden sm:block space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {continentStats.slice(0, 3).map((continent) => (
            <ContinentCard key={continent.key} continent={continent} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {continentStats.slice(3, 5).map((continent) => (
            <ContinentCard key={continent.key} continent={continent} />
          ))}
          {/* Expand button */}
          <button
            onClick={() => setShowExpandedView(true)}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-xl border',
              'bg-muted/30 border-border/50 transition-all',
              'hover:bg-muted/50 hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <Globe2 className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="text-xs font-medium text-muted-foreground">
              {t('stats.countryGeek.viewAll', 'View All')}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
          </button>
        </div>
      </div>

      {/* Global progress */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('stats.countryGeek.globalProgress', 'Global Progress')}
          </span>
          <span className="text-sm font-mono font-medium">
            {totalVisited}/{TOTAL_TERRITORIES}
          </span>
        </div>
        <Progress value={completionPercentage} className="h-2" />
        <p className="mt-2 text-xs text-muted-foreground text-center">
          {t('stats.countryGeek.completion', '{{percentage}}% of all territories', {
            percentage: completionPercentage,
          })}
        </p>
      </div>

      {/* GLaDOS Fun Fact */}
      {gladosFact && (
        <div className="pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            "{gladosFact}"
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            — {t('stats.locked.signature', 'Your Flight Stats AI')}
          </p>
        </div>
      )}

      {/* Expanded view dialog */}
      <Dialog open={showExpandedView} onOpenChange={setShowExpandedView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-muted-foreground" />
              {t('stats.countryGeek.allCountries', 'All Countries')}
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {totalVisited} / {TOTAL_TERRITORIES}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {['europe', 'asia', 'americas', 'africa', 'oceania'].map((continent) => {
              const continentCountries = Object.entries(countries)
                .filter(([_, data]) => data.continent === continent)
                .sort(([, a], [, b]) => a.name.localeCompare(b.name))

              const stats = continentStats.find(c => c.key === continent)
              const continentNames: Record<string, string> = {
                europe: 'Europe',
                asia: 'Asia',
                americas: 'Americas',
                africa: 'Africa',
                oceania: 'Oceania',
              }

              return (
                <div key={continent}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <span
                        className={cn('w-3 h-3 rounded-full', CONTINENT_COLORS[continent])}
                      />
                      {continentNames[continent]}
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {stats?.visited || 0}/{stats?.total || 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {continentCountries.map(([code, data]) => {
                      const isVisited = visitedCountryCodes.has(code)
                      return (
                        <span
                          key={code}
                          className={cn(
                            'px-2 py-1 text-xs rounded-full border transition-all',
                            isVisited
                              ? 'text-white border-transparent'
                              : 'text-muted-foreground/60 border-border/50 bg-muted/20'
                          )}
                          style={
                            isVisited
                              ? { backgroundColor: data.dominantColor }
                              : undefined
                          }
                          title={data.name}
                        >
                          {code}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button variant="outline" onClick={() => setShowExpandedView(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ContinentCardProps {
  continent: ContinentStats
  /** Whether to hide the fraction text (e.g., "12/50") - mobile density optimization */
  compact?: boolean
}

function ContinentCard({ continent, compact = false }: ContinentCardProps) {
  const percentage = continent.total > 0
    ? Math.round((continent.visited / continent.total) * 100)
    : 0

  return (
    <div
      className={cn(
        'flex flex-col p-3 rounded-xl border transition-all',
        CONTINENT_BG_COLORS[continent.key]
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium truncate">{continent.name}</span>
        {/* Show fraction only when not in compact mode */}
        {!compact && (
          <span className="text-sm font-semibold font-mono">
            {continent.visited}/{continent.total}
          </span>
        )}
        {/* Show percentage in compact mode */}
        {compact && (
          <span className="text-xs font-mono text-muted-foreground">
            {percentage}%
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', CONTINENT_COLORS[continent.key])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
