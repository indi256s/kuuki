import { lazy, Suspense } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useRecentFlights } from '@/hooks/useFlights'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { cn } from '@/lib/utils'

const RouteMapWithCountries = lazy(() =>
  import('@/components/map/RouteMapWithCountries').then(m => ({ default: m.RouteMapWithCountries }))
)

interface MapCardProps {
  className?: string
  isExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
}

export function MapCard({ className, isExpanded = false, onExpandChange }: MapCardProps) {
  const { data: flights = [] } = useRecentFlights(50)
  const { data: stats } = useDashboardStats()

  const visitedCountries = stats?.visitedCountries || []

  return (
    <div
      className={cn(
        // Base card styles
        'relative rounded-2xl border border-border/50 bg-card overflow-hidden h-full w-full flex flex-col',
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
        />
      </Suspense>

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
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="h-[200px] bg-card rounded-2xl border border-border/50 animate-pulse flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-slate-500 animate-spin" />
    </div>
  )
}
