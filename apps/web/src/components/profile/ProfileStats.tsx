import { EARTH_CIRCUMFERENCE_KM } from '@kuuki/shared/constants'
import { useTranslation } from 'react-i18next'
import { Plane, TrendingUp, Globe2, Building2, MapPin, Layers } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistance } from '@kuuki/client/geo'
import type { UserStats } from '@/lib/profiles'

interface ProfileStatsProps {
  stats: UserStats | null
  isLoading?: boolean
  /** Whether to hide the section title (useful when wrapped in ProfileSection) */
  hideTitle?: boolean
}

export function ProfileStats({ stats, isLoading, hideTitle = false }: ProfileStatsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const totalFlights = stats.total_flights ?? 0
  const totalDistance = stats.total_distance_km ?? 0
  const earthTrips = Math.floor(totalDistance / EARTH_CIRCUMFERENCE_KM)
  const showExtended = totalFlights >= 10

  const gridStats = [
    {
      label: t('dashboard.totalDistance', 'Distance'),
      value: formatDistance(totalDistance),
      icon: TrendingUp,
      context: earthTrips >= 1
        ? t('stats.funFacts.earthTrips', "You've flown {{count}} trips around Earth", { count: earthTrips })
        : undefined,
    },
    {
      label: t('stats.countries', 'Countries'),
      value: (stats.countries_count ?? 0).toString(),
      icon: Globe2,
    },
    {
      label: t('stats.airlines', 'Airlines'),
      value: (stats.airlines_count ?? 0).toString(),
      icon: Building2,
    },
    ...(showExtended ? [
      {
        label: t('stats.cities', 'Cities'),
        value: (stats.cities_count ?? 0).toString(),
        icon: MapPin,
      },
      {
        label: t('stats.aircraftTypesLabel', 'Aircraft'),
        value: (stats.aircraft_count ?? 0).toString(),
        icon: Layers,
      },
    ] : []),
  ]

  return (
    <div className="space-y-10">
      {!hideTitle && (
        <h2 className="text-lg font-semibold">
          {t('stats.title', 'Stats')}
        </h2>
      )}

      {/* Hero stat — total flights as centerpiece */}
      <div className="space-y-1">
        <Plane className="w-5 h-5 text-muted-foreground/60 mb-2" strokeWidth={1.5} />
        <p className="text-5xl md:text-6xl font-data font-medium tracking-tight">
          {totalFlights.toLocaleString()}
        </p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t('dashboard.totalFlights', 'Flights')}
        </p>
      </div>

      {/* Grid stats — borderless, typography-driven */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
        {gridStats.map((stat) => (
          <div
            key={stat.label}
            className="group space-y-1.5 rounded-xl p-3 -m-3 transition-colors duration-300 hover:bg-primary/[0.03]"
          >
            <stat.icon className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="text-2xl font-data font-medium tracking-tight">
              {stat.value}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
            {stat.context && (
              <p className="text-xs text-muted-foreground/70 normal-case tracking-normal">
                {stat.context}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Fun facts aside */}
      {(stats.continents_count ?? 0) >= 3 && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
          <p className="text-sm text-muted-foreground">
            {t('stats.funFacts.continents', 'Visited {{count}} continents', { count: stats.continents_count ?? 0 })}
          </p>
        </div>
      )}
    </div>
  )
}
