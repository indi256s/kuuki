import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Map, Expand } from 'lucide-react'
import { useRecentFlights } from '@/hooks/useFlights'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Lazy load the map components for better initial load performance
const RouteMapWithCountries = lazy(() =>
  import('@/components/map/RouteMapWithCountries').then(m => ({ default: m.RouteMapWithCountries }))
)
const MapFullscreenModal = lazy(() =>
  import('@/components/map/MapFullscreenModal').then(m => ({ default: m.MapFullscreenModal }))
)

interface MapCardProps {
  className?: string
}

export function MapCard({ className }: MapCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: flights = [] } = useRecentFlights(50)
  const { data: stats } = useDashboardStats()

  // Get visited countries from flights
  const visitedCountries = stats?.visitedCountries || []

  const hasData = flights.length > 0 || visitedCountries.length > 0

  return (
    <>
      <div
        className={cn(
          // Base card styles
          'rounded-2xl border border-border/50 bg-card overflow-hidden',
          'transition-all duration-300',
          // Hero sizing - 2-column span
          'lg:col-span-2',
          // Hover effect
          hasData && 'hover:border-primary/30 hover:shadow-glow-sm cursor-pointer',
          className
        )}
        onClick={hasData ? () => setIsExpanded(true) : undefined}
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasData && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setIsExpanded(true)
          }
        }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">{t('dashboard.routeMap', 'Route Map')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.routeMapSubtitle', 'Your flight routes and visited countries')}
              </p>
            </div>
          </div>

          {hasData && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Expand className="w-3.5 h-3.5" />
              <span>{t('map.clickToExpand', 'Click to expand')}</span>
            </div>
          )}
        </div>

        {/* Map content */}
        <div
          className="relative"
          style={{
            // Taller aspect ratio on mobile (4:3), wider on desktop (16:9)
            aspectRatio: 'var(--map-aspect-ratio, 16/9)',
          }}
        >
          <style>{`
            @media (max-width: 768px) {
              :root { --map-aspect-ratio: 4/3; }
            }
          `}</style>

          <Suspense fallback={<MapSkeleton />}>
            <RouteMapWithCountries
              flights={flights}
              visitedCountries={visitedCountries}
              height="100%"
              className="rounded-none border-0"
              onExpand={() => setIsExpanded(true)}
            />
          </Suspense>
        </div>
      </div>

      {/* Fullscreen modal */}
      <Suspense fallback={null}>
        <MapFullscreenModal
          isOpen={isExpanded}
          onClose={() => setIsExpanded(false)}
          flights={flights}
          visitedCountries={visitedCountries}
        />
      </Suspense>
    </>
  )
}

// Loading skeleton for the map
function MapSkeleton() {
  return (
    <div className="absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center">
      <div className="text-center">
        <Map className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </div>
  )
}
