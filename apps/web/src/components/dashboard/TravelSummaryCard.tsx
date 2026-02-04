import { Plane, Globe2, Ruler } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface TravelSummaryCardProps {
  className?: string
}

export function TravelSummaryCard({ className }: TravelSummaryCardProps) {
  const { t } = useTranslation()
  const { data: stats } = useDashboardStats()

  if (!stats) return null

  const metrics = [
    {
      icon: Plane,
      value: stats.totalFlights,
      label: t('stats.flights', 'Flights'),
      percentile: stats.percentiles.flights,
    },
    {
      icon: Globe2,
      value: stats.uniqueCountries,
      label: t('stats.countries', 'Countries'),
      percentile: stats.percentiles.countries,
    },
    {
      icon: Ruler,
      value: `${(stats.totalDistance / 1000).toFixed(0)}k`,
      sublabel: 'km',
      label: t('stats.distance', 'Distance'),
      percentile: stats.percentiles.distance,
    },
  ]

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-4 h-[200px]',
        'transition-all duration-200',
        'hover:border-primary/30',
        'flex flex-col justify-between',
        className
      )}
    >
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <div key={index} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-lg font-semibold tracking-tight">
                  {metric.value}
                </span>
                {metric.sublabel && (
                  <span className="text-[10px] text-muted-foreground">{metric.sublabel}</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {metric.label}
                {metric.percentile !== null && (
                  <span className="ml-1.5 text-primary/70">Top {metric.percentile}%</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
