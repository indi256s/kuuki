import { Plane, Globe2, Ruler } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/geo'

interface TravelSummaryCardProps {
  className?: string
}

export function TravelSummaryCard({ className }: TravelSummaryCardProps) {
  const { t } = useTranslation()
  const { data: stats } = useDashboardStats()

  if (!stats) return null

  if (!stats) return null

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-6',
        'transition-all duration-200',
        'hover:border-primary/30',
        'flex flex-col justify-center h-full',
        className
      )}
    >
      <div className="grid grid-cols-3 gap-4 divide-x divide-border/30">

        {/* Metric 1: Flights */}
        <div className="flex flex-col items-center justify-center text-center px-2">
          <div className="mb-2 p-2 rounded-lg bg-primary/10 text-primary">
            <Plane className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
            {stats.totalFlights}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            {t('dashboard.flights', 'Experiments')}
          </div>
        </div>

        {/* Metric 2: Countries */}
        <div className="flex flex-col items-center justify-center text-center px-2">
          <div className="mb-2 p-2 rounded-lg bg-primary/10 text-primary">
            <Globe2 className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
            {stats.uniqueCountries}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            {t('dashboard.countries', 'Territories')}
          </div>
        </div>

        {/* Metric 3: Distance */}
        <div className="flex flex-col items-center justify-center text-center px-2">
          <div className="mb-2 p-2 rounded-lg bg-primary/10 text-primary">
            <Ruler className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
            {formatDistance(stats.totalDistance)}
            <span className="text-sm text-muted-foreground ml-1 font-normal">km</span>
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            {t('dashboard.distance', 'Displacement')}
          </div>
        </div>
      </div>
    </div >
  )
}
