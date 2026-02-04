import { useState, lazy, Suspense } from 'react'
import { useRecentFlights } from '@/hooks/useFlights'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { cn } from '@/lib/utils'

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
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: flights = [] } = useRecentFlights(50)
  const { data: stats } = useDashboardStats()

  const visitedCountries = stats?.visitedCountries || []
  const hasData = flights.length > 0

  return (
    <>
      <div
        className={cn(
          // Base card styles
          'rounded-2xl border border-border/50 bg-card overflow-hidden h-full w-full flex flex-col',
          'transition-all duration-300',
          // Hover effect
          hasData && 'hover:border-primary/30 hover:shadow-glow-sm cursor-pointer',
          className
        )}
      >
        <Suspense fallback={<MapSkeleton />}>
          <RouteMapWithCountries
            flights={flights}
            visitedCountries={visitedCountries}
            height="100%" // Use 100% height for the map to fill the container
            className="h-full w-full" // Ensure the map component itself takes full height/width
            onExpand={() => setIsExpanded(true)}
          />
        </Suspense>
      </div>

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

function MapSkeleton() {
  return (
    <div className="h-[200px] bg-[#0a0f18] rounded-2xl border border-border/50 animate-pulse flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-slate-500 animate-spin" />
    </div>
  )
}
