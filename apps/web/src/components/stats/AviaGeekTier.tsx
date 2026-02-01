import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'

// GLaDOS-style fun facts for Avia Geek tier
const GLADOS_FACTS_KEYS = [
  'stats.aviaGeek.fact.1',
  'stats.aviaGeek.fact.2',
  'stats.aviaGeek.fact.3',
  'stats.aviaGeek.fact.4',
  'stats.aviaGeek.fact.5',
]

// Manufacturer brand colors for visual flair
const MANUFACTURER_COLORS: Record<string, string> = {
  Airbus: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  Boeing: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  Embraer: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Bombardier: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  ATR: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  Cessna: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Sukhoi: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  Tupolev: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  de_Havilland: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  COMAC: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  Antonov: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
}

const DEFAULT_MANUFACTURER_COLOR = 'bg-muted text-foreground border-border'

interface ManufacturerData {
  name: string
  count: number
}

export function AviaGeekTier() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const [showAllManufacturers, setShowAllManufacturers] = useState(false)

  // Process manufacturer breakdown data
  const manufacturers = useMemo<ManufacturerData[]>(() => {
    if (!advancedStats?.manufacturerBreakdown) return []

    return Object.entries(advancedStats.manufacturerBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [advancedStats?.manufacturerBreakdown])

  // Get aircraft type breakdown
  const typeBreakdown = advancedStats?.aircraftTypeBreakdown
  const mostFlown = typeBreakdown?.most_flown

  // Calculate widebody percentage
  const widebodyRatio = useMemo(() => {
    if (!typeBreakdown?.types) return 0
    const types = typeBreakdown.types
    const total = Object.values(types).reduce((sum, count) => sum + count, 0)
    if (total === 0) return 0
    return Math.round(((types.widebody || 0) / total) * 100)
  }, [typeBreakdown])

  // Calculate most flown percentage
  const mostFlownPercentage = useMemo(() => {
    if (!mostFlown?.count || !mostFlown?.total_flights) return 0
    return Math.round((mostFlown.count / mostFlown.total_flights) * 100)
  }, [mostFlown])

  // Pick a GLaDOS fact based on the data
  const gladosFact = useMemo(() => {
    if (!advancedStats) return null

    // Use the stored fact index if available, otherwise calculate
    const factIndex = advancedStats.featuredFactIndex % GLADOS_FACTS_KEYS.length
    const factKey = GLADOS_FACTS_KEYS[factIndex]

    // Generate dynamic fact based on user data
    const topManufacturer = manufacturers[0]?.name || 'Unknown'
    const topManufacturerCount = manufacturers[0]?.count || 0
    const aircraftModel = mostFlown?.name || 'Unknown'

    // Fallback messages with data interpolation
    const fallbacks: Record<string, string> = {
      'stats.aviaGeek.fact.1': `Your ${topManufacturer} loyalty is noted. ${topManufacturerCount > 10 ? 'Toulouse appreciates the business.' : 'They will notice you eventually.'}`,
      'stats.aviaGeek.fact.2': `The ${aircraftModel} appears ${mostFlown?.count || 0} times in your logs. It is either reliable or you lack imagination.`,
      'stats.aviaGeek.fact.3': `${widebodyRatio}% widebody ratio. ${widebodyRatio > 50 ? 'Your comfort preferences are showing.' : 'Efficiency over luxury, I see.'}`,
      'stats.aviaGeek.fact.4': `${manufacturers.length} manufacturer${manufacturers.length !== 1 ? 's' : ''} in your collection. ${manufacturers.length > 5 ? 'An eclectic taste.' : 'Brand loyalty. Admirable. Or limiting.'}`,
      'stats.aviaGeek.fact.5': `I have analyzed your fleet preferences. The data is... revealing.`,
    }

    return t(factKey, fallbacks[factKey])
  }, [advancedStats, manufacturers, mostFlown, widebodyRatio, t])

  // Determine how many manufacturers to show initially
  const INITIAL_DISPLAY_COUNT = 4
  const visibleManufacturers = showAllManufacturers
    ? manufacturers
    : manufacturers.slice(0, INITIAL_DISPLAY_COUNT)
  const hiddenCount = manufacturers.length - INITIAL_DISPLAY_COUNT

  if (!advancedStats) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-muted rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 bg-muted rounded-full" />
          ))}
        </div>
        <div className="h-4 bg-muted rounded-full w-3/4" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Most Flown Aircraft */}
      {mostFlown && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {t('stats.aviaGeek.mostFlown', 'Most Flown')}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold font-mono tracking-tight">
              {mostFlown.icao}
            </span>
            <span className="text-sm text-muted-foreground">
              {mostFlown.name}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {t('stats.aviaGeek.flightCount', '{{count}} flights ({{percentage}}% of total)', {
              count: mostFlown.count,
              percentage: mostFlownPercentage,
            })}
          </div>
        </div>
      )}

      {/* Manufacturers */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {t('stats.aviaGeek.manufacturers', 'Manufacturers')}
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleManufacturers.map(({ name, count }) => (
            <Badge
              key={name}
              variant="outline"
              className={cn(
                'px-3 py-1.5 text-xs font-medium border transition-colors',
                MANUFACTURER_COLORS[name] || DEFAULT_MANUFACTURER_COLOR
              )}
            >
              {name.replace(/_/g, ' ')} {count}
            </Badge>
          ))}
          {!showAllManufacturers && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllManufacturers(true)}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full',
                'text-xs font-medium text-muted-foreground',
                'bg-muted/50 hover:bg-muted transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              +{hiddenCount} {t('common.more', 'more')}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Widebody Ratio */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('stats.aviaGeek.widebodyRatio', 'Widebody Ratio')}
          </span>
          <span className="text-sm font-mono font-medium">
            {widebodyRatio}%
          </span>
        </div>
        <Progress value={widebodyRatio} className="h-2" />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{t('stats.aviaGeek.narrowbody', 'Narrowbody')}</span>
          <span>{t('stats.aviaGeek.widebody', 'Widebody')}</span>
        </div>
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
    </div>
  )
}
