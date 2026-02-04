import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Maximize2, Map, Plane, Globe2 } from 'lucide-react'
import { RouteMapWithCountries } from './RouteMapWithCountries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Flight } from '@/hooks/useFlights'

interface MapFullscreenModalProps {
  isOpen: boolean
  onClose: () => void
  flights?: Flight[]
  visitedCountries?: string[]
}

export function MapFullscreenModal({
  isOpen,
  onClose,
  flights = [],
  visitedCountries = [],
}: MapFullscreenModalProps) {
  const { t } = useTranslation()

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Calculate stats
  const routeCount = new Set(flights.map(f => `${f.origin}-${f.destination}`)).size
  const airportCount = new Set(flights.flatMap(f => [f.origin, f.destination])).size
  const countryCount = visitedCountries.length

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        'bg-background/95 backdrop-blur-sm',
        'flex flex-col',
        'animate-in fade-in duration-200'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t('map.fullscreenTitle', 'Route Map')}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">{t('map.fullscreenTitle', 'Route Map')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('map.fullscreenSubtitle', 'Pan and zoom to explore your travels')}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* Map container */}
      <div className="flex-1 relative">
        <RouteMapWithCountries
          flights={flights}
          visitedCountries={visitedCountries}
          height="100%"
          interactive
          className="rounded-none border-0"
        />

        {/* Stats overlay - bottom left */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <StatBadge
            icon={Plane}
            value={routeCount}
            label={t('map.routes', 'routes')}
          />
          <StatBadge
            icon={Maximize2}
            value={airportCount}
            label={t('map.airports', 'airports')}
          />
          <StatBadge
            icon={Globe2}
            value={countryCount}
            label={t('map.countries', 'countries')}
          />
        </div>

        {/* Legend - bottom right */}
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur rounded-xl p-3 border border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {t('map.legend', 'Legend')}
          </h4>
          <div className="space-y-1.5">
            <LegendItem color="white" label={t('map.legendAirport', 'Airport')} />
            <LegendItem color="oklch(0.7 0.15 280)" label={t('map.legendRoute', 'Flight route')} />
            <LegendItem color="oklch(0.6 0.15 200)" opacity={0.5} label={t('map.legendCountry', 'Visited country')} />
          </div>
        </div>

        {/* Instructions overlay - top center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur rounded-lg px-4 py-2 text-xs text-muted-foreground">
          {t('map.instructions', 'Drag to pan • Scroll to zoom • ESC to close')}
        </div>
      </div>
    </div>
  )
}

// Stat badge component
function StatBadge({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-2 bg-background/90 backdrop-blur rounded-lg px-3 py-2 border border-border/50">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="font-mono font-medium">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// Legend item component
function LegendItem({
  color,
  label,
  opacity = 1,
}: {
  color: string
  label: string
  opacity?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color, opacity }}
      />
      <span className="text-xs">{label}</span>
    </div>
  )
}
