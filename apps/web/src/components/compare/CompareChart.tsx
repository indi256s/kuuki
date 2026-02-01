import { useTranslation } from 'react-i18next'
import { formatDistance } from '@/lib/geo'
import type { UserStats } from '@/lib/profiles'

interface CompareChartProps {
  yourStats: UserStats
  theirStats: UserStats
  yourName: string
  theirName: string
  themeColor?: string
}

interface StatBarProps {
  label: string
  yourValue: number
  theirValue: number
  yourName: string
  theirName: string
  formatFn?: (value: number) => string
}

function StatBar({ label, yourValue, theirValue, yourName, theirName, formatFn }: StatBarProps) {
  const format = formatFn || ((v: number) => v.toLocaleString())
  const maxValue = Math.max(yourValue, theirValue, 1) // Avoid division by zero
  const yourPercent = (yourValue / maxValue) * 100
  const theirPercent = (theirValue / maxValue) * 100

  const yourWins = yourValue > theirValue
  const theirWins = theirValue > yourValue

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
      </div>

      {/* Your bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={yourWins ? 'font-medium text-primary' : 'text-muted-foreground'}>
            {yourName}
          </span>
          <span className={`font-data ${yourWins ? 'text-primary font-medium' : ''}`}>
            {format(yourValue)}
          </span>
        </div>
        <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              yourWins ? 'bg-primary' : 'bg-primary/50'
            }`}
            style={{ width: `${yourPercent}%` }}
          />
        </div>
      </div>

      {/* Their bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={theirWins ? 'font-medium text-chart-2' : 'text-muted-foreground'}>
            {theirName}
          </span>
          <span className={`font-data ${theirWins ? 'text-chart-2 font-medium' : ''}`}>
            {format(theirValue)}
          </span>
        </div>
        <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              theirWins ? 'bg-chart-2' : 'bg-chart-2/50'
            }`}
            style={{ width: `${theirPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function CompareChart({ yourStats, theirStats, yourName, theirName }: CompareChartProps) {
  const { t } = useTranslation()

  const comparisons = [
    {
      label: t('dashboard.totalFlights', 'Flights'),
      yourValue: yourStats.total_flights,
      theirValue: theirStats.total_flights,
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      yourValue: yourStats.total_distance_km,
      theirValue: theirStats.total_distance_km,
      formatFn: formatDistance,
    },
    {
      label: t('stats.countries', 'Countries'),
      yourValue: yourStats.countries_count,
      theirValue: theirStats.countries_count,
    },
    {
      label: t('stats.cities', 'Cities'),
      yourValue: yourStats.cities_count,
      theirValue: theirStats.cities_count,
    },
    {
      label: t('stats.airlines', 'Airlines'),
      yourValue: yourStats.airlines_count,
      theirValue: theirStats.airlines_count,
    },
  ]

  // Count wins
  const yourWins = comparisons.filter(c => c.yourValue > c.theirValue).length
  const theirWins = comparisons.filter(c => c.theirValue > c.yourValue).length

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-secondary/30">
        <div className="text-center">
          <p className="text-2xl font-semibold font-data text-primary">{yourWins}</p>
          <p className="text-xs text-muted-foreground">{yourName}</p>
        </div>
        <div className="text-xl text-muted-foreground">vs</div>
        <div className="text-center">
          <p className="text-2xl font-semibold font-data text-chart-2">{theirWins}</p>
          <p className="text-xs text-muted-foreground">{theirName}</p>
        </div>
      </div>

      {/* Stat comparisons */}
      <div className="space-y-6">
        {comparisons.map((comparison) => (
          <StatBar
            key={comparison.label}
            label={comparison.label}
            yourValue={comparison.yourValue}
            theirValue={comparison.theirValue}
            yourName={yourName}
            theirName={theirName}
            formatFn={comparison.formatFn}
          />
        ))}
      </div>
    </div>
  )
}
