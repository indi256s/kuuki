import { useTranslation } from 'react-i18next'
import { formatDistance } from '@/lib/geo'
import type { UserStats } from '@/lib/profiles'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface CompareChartProps {
  yourStats: UserStats
  theirStats: UserStats
  yourName: string
  theirName: string
  themeColor?: string
}

export function CompareChart({ yourStats, theirStats, yourName, theirName }: CompareChartProps) {
  const { t } = useTranslation()

  const comparisons = [
    {
      label: t('dashboard.totalFlights', 'Flights'),
      yourValue: yourStats.total_flights ?? 0,
      theirValue: theirStats.total_flights ?? 0,
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      yourValue: yourStats.total_distance_km ?? 0,
      theirValue: theirStats.total_distance_km ?? 0,
      formatFn: formatDistance,
    },
    {
      label: t('stats.countries', 'Countries'),
      yourValue: yourStats.countries_count ?? 0,
      theirValue: theirStats.countries_count ?? 0,
    },
    {
      label: t('stats.cities', 'Cities'),
      yourValue: yourStats.cities_count ?? 0,
      theirValue: theirStats.cities_count ?? 0,
    },
    {
      label: t('stats.airlines', 'Airlines'),
      yourValue: yourStats.airlines_count ?? 0,
      theirValue: theirStats.airlines_count ?? 0,
    },
  ]

  // Count wins
  const yourWins = comparisons.filter(c => c.yourValue > c.theirValue).length
  const theirWins = comparisons.filter(c => c.theirValue > c.yourValue).length

  // Build recharts data with a formatFn reference for the tooltip
  const chartData = comparisons.map(c => ({
    name: c.label,
    you: c.yourValue,
    them: c.theirValue,
    formatFn: c.formatFn,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatValue = (value: any, _name: any, props: any) => {
    const fn = props?.payload?.formatFn as ((v: number) => string) | undefined
    return fn ? fn(Number(value)) : Number(value).toLocaleString()
  }

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

      {/* Recharts bar chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 13, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={formatValue}
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--foreground)' }}
            cursor={{ fill: 'color-mix(in srgb, var(--secondary) 30%, transparent)' }}
          />
          <Legend />
          <Bar dataKey="you" name={yourName} fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={14} />
          <Bar dataKey="them" name={theirName} fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
