import { lazy, Suspense, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, Minimize2, Route, Flag, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FlightRoute } from '@/lib/flights'
import type { PassportEntry } from '@kuuki/shared'

const RouteMapWithCountries = lazy(() =>
  import('@/components/map/RouteMapWithCountries').then(m => ({ default: m.RouteMapWithCountries }))
)

interface MapCardProps {
  flights: FlightRoute[]
  passportEntries?: PassportEntry[]
  className?: string
  isExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  onCountryClick?: (countryCode: string) => void
}

export function MapCard({
  flights,
  passportEntries,
  className,
  isExpanded = false,
  onExpandChange,
  onCountryClick,
}: MapCardProps) {
  const { t } = useTranslation()

  // Toggle state
  const [showRoutes, setShowRoutes] = useState(true)
  const [showClaimed, setShowClaimed] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState(false)

  const hasPassport = !!passportEntries

  // Derive visited countries from passport entries
  const visitedCountries = useMemo(() => {
    if (!passportEntries) return undefined
    if (!showClaimed) {
      return passportEntries.filter(e => e.source !== 'claim').map(e => e.countryCode)
    }
    return passportEntries.map(e => e.countryCode)
  }, [passportEntries, showClaimed])

  // Visit count map for heatmap
  const visitCountMap = useMemo(() => {
    if (!passportEntries) return undefined
    const map: Record<string, number> = {}
    for (const entry of passportEntries) {
      map[entry.countryCode] = entry.visitCount
    }
    return map
  }, [passportEntries])

  // Country source map for styling
  const countrySourceMap = useMemo(() => {
    if (!passportEntries) return undefined
    const map: Record<string, 'flight' | 'claim' | 'both'> = {}
    for (const entry of passportEntries) {
      map[entry.countryCode] = entry.source
    }
    return map
  }, [passportEntries])

  // Max visit count for legend
  const maxVisitCount = useMemo(() => {
    if (!passportEntries) return 1
    return Math.max(1, ...passportEntries.map(e => e.visitCount))
  }, [passportEntries])

  const handleToggleRoutes = useCallback(() => setShowRoutes(v => !v), [])
  const handleToggleClaimed = useCallback(() => setShowClaimed(v => !v), [])
  const handleToggleHeatmap = useCallback(() => setHeatmapMode(v => !v), [])

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border bg-card overflow-hidden h-full w-full flex flex-col',
        'transition-all duration-300',
        'shadow-glow-sm',
        className
      )}
    >
      <Suspense fallback={<MapSkeleton />}>
        <RouteMapWithCountries
          flights={flights}
          visitedCountries={visitedCountries}
          height="100%"
          className="h-full w-full"
          onCountryClick={onCountryClick}
          showRoutes={showRoutes}
          heatmapMode={hasPassport ? heatmapMode : undefined}
          visitCountMap={visitCountMap}
          countrySourceMap={countrySourceMap}
        />
      </Suspense>

      {/* Toggle overlay */}
      <div className="absolute top-2 right-12 z-10 flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border/30 rounded-lg p-1">
        <button
          onClick={handleToggleRoutes}
          className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center transition-colors p-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            showRoutes ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={t('passport.toggleRoutes', 'Show flight routes')}
          aria-pressed={showRoutes}
        >
          <Route className="w-4 h-4" />
        </button>
        {hasPassport && (
          <>
            <button
              onClick={handleToggleClaimed}
              className={cn(
                'w-8 h-8 rounded-md flex items-center justify-center transition-colors p-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                showClaimed ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={t('passport.toggleClaimed', 'Show claimed countries')}
              aria-pressed={showClaimed}
            >
              <Flag className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleHeatmap}
              className={cn(
                'w-8 h-8 rounded-md flex items-center justify-center transition-colors p-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                heatmapMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={t('passport.toggleHeatmap', 'Toggle heatmap')}
              aria-pressed={heatmapMode}
            >
              <Layers className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Expand/Collapse toggle */}
      {onExpandChange && (
        <button
          onClick={() => onExpandChange(!isExpanded)}
          className={cn(
            'absolute top-2 right-2 z-10',
            'w-8 h-8 rounded-lg',
            'bg-white/10 hover:bg-white/20 backdrop-blur',
            'flex items-center justify-center',
            'text-white/70 hover:text-white',
            'transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
          )}
          aria-label={isExpanded ? 'Collapse map' : 'Expand map'}
        >
          {isExpanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Heatmap legend (only with passport data) */}
      {hasPassport && (
        <div
          className={cn(
            'absolute bottom-2 right-2 z-10 bg-card/70 backdrop-blur-sm rounded-md px-2 py-1.5 flex items-center gap-1.5 transition-opacity duration-150',
            'motion-reduce:transition-none',
            heatmapMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          role="img"
          aria-label={`Visit frequency scale from 1 to ${maxVisitCount}`}
        >
          <span className="text-[9px] font-mono text-muted-foreground">1</span>
          <div
            className="w-20 h-2 rounded-full"
            style={{
              background: 'linear-gradient(to right, hsl(var(--primary) / 0.2), hsl(var(--primary)))',
            }}
          />
          <span className="text-[9px] font-mono text-muted-foreground">{maxVisitCount}</span>
        </div>
      )}
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="h-[200px] bg-card rounded-2xl border border-border animate-pulse flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
    </div>
  )
}
