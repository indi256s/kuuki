import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plane,
  Building2,
  Globe2,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  RadarChart,
  Radar as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'
import { formatDuration } from '@/lib/formatDuration'
import { findAircraft } from '@kuuki/data'

// ============================================================================
// Shared
// ============================================================================

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/** Build a stable manufacturer → color map from sorted manufacturer breakdown */
function useManufacturerColorMap(
  manufacturerBreakdown: Record<string, number> | null | undefined
) {
  return useMemo(() => {
    const map = new Map<string, string>()
    if (!manufacturerBreakdown) return map
    Object.entries(manufacturerBreakdown)
      .sort(([, a], [, b]) => b - a)
      .forEach(([name], i) => {
        map.set(name, CHART_COLORS[i % CHART_COLORS.length])
      })
    return map
  }, [manufacturerBreakdown])
}

interface StatCardProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}

function StatCard({ title, icon: Icon, children, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-5',
        'transition-shadow duration-300 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/30">
          <Icon className="w-[18px] h-[18px] text-muted-foreground" />
        </div>
        <h4 className="font-medium text-sm">{title}</h4>
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// Fleet Composition Type Colors
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  widebody: 'var(--chart-1)',
  narrowbody: 'var(--chart-2)',
  regional: 'var(--chart-3)',
  turboprop: 'var(--chart-4)',
  bizjet: 'var(--chart-5)',
  piston: 'var(--muted-foreground)',
}

// ============================================================================
// Aircraft Types Card — "Your Fleet" (Hero + Composition + Bar Chart)
// ============================================================================

export function AircraftTypesCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const mfrColors = useManufacturerColorMap(advancedStats?.manufacturerBreakdown)

  const hero = advancedStats?.fleetInsights?.hero
  const typeBreakdown = advancedStats?.aircraftTypeBreakdown?.types

  // Bar chart data: top 8 with "Model · Manufacturer" labels
  const chartData = useMemo(() => {
    if (!advancedStats?.aircraftBreakdown) return []
    return Object.entries(advancedStats.aircraftBreakdown)
      .map(([icao, count]) => {
        const aircraft = findAircraft(icao)
        const label = aircraft
          ? `${aircraft.model} · ${aircraft.manufacturer}`
          : icao
        return {
          icao,
          label,
          count,
          manufacturer: aircraft?.manufacturer ?? 'Unknown',
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [advancedStats?.aircraftBreakdown])

  const top8 = chartData.slice(0, 8)
  const overflowCount = chartData.length - 8
  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.count, 0),
    [chartData]
  )

  // Fleet composition segments
  const compositionSegments = useMemo(() => {
    if (!typeBreakdown) return []
    const entries = Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a)
    const totalTypes = entries.reduce((s, [, c]) => s + c, 0)
    return entries.map(([type, count]) => ({
      type,
      count,
      pct: totalTypes > 0 ? (count / totalTypes) * 100 : 0,
    }))
  }, [typeBreakdown])

  const barHeight = Math.max(top8.length * 28, 60)

  return (
    <StatCard title={t('stats.aircraftTypesTitle', 'Your Fleet')} icon={Plane}>
      {chartData.length > 0 ? (
        <div className="space-y-4">
          {/* 3a. Hero Section */}
          {hero && (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-semibold text-lg">
                  {hero.model} <span className="text-muted-foreground font-normal">·</span> {hero.manufacturer}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {hero.count} {t('stats.flights', 'flights')}
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {t(`stats.aircraftTypes.${hero.type}`, hero.type)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {hero.fun_fact}
              </p>
            </div>
          )}

          {/* 3b. Fleet Composition Blocks */}
          {compositionSegments.length > 1 && (
            <div className="space-y-1.5">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {compositionSegments.map(({ type, pct }) => (
                  <div
                    key={type}
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      background: TYPE_COLORS[type] ?? 'var(--muted)',
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {compositionSegments.map(({ type, count }) => (
                  <div key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: TYPE_COLORS[type] ?? 'var(--muted)' }}
                    />
                    {t(`stats.aircraftTypes.${type}`, type)} {count}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3c. Improved Bar Chart (top 8) */}
          <div className="border-t border-border/30" />
          <ResponsiveContainer width="100%" height={Math.min(barHeight, 220)}>
            <BarChart
              data={top8}
              layout="vertical"
              margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={100}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number) => {
                  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0'
                  return [`${value} flights (${pct}%)`, '']
                }) as any}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                cursor={{ fill: 'color-mix(in srgb, var(--muted) 30%, transparent)' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                {top8.map((entry) => (
                  <Cell
                    key={entry.icao}
                    fill={mfrColors.get(entry.manufacturer) ?? 'var(--primary)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {overflowCount > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {t('stats.nMore', { count: overflowCount })}
            </p>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Manufacturer Card — Hero Loyalty + Ranked List (no donut)
// ============================================================================

export function ManufacturerCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const mfrColors = useManufacturerColorMap(advancedStats?.manufacturerBreakdown)

  const insights = advancedStats?.manufacturerInsights?.dominant

  const manufacturers = useMemo(() => {
    if (!advancedStats?.manufacturerBreakdown) return []
    return Object.entries(advancedStats.manufacturerBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [advancedStats?.manufacturerBreakdown])

  const total = useMemo(
    () => manufacturers.reduce((sum, m) => sum + m.count, 0),
    [manufacturers]
  )

  return (
    <StatCard title={t('stats.manufacturers', 'Manufacturers')} icon={Building2}>
      {manufacturers.length > 0 ? (
        <div className="space-y-4">
          {/* 4a. Hero Loyalty Statement */}
          {insights && (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-2xl text-primary">{Math.round(insights.pct)}%</span>
                <span className="font-semibold text-base">{insights.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {insights.loyalty_label}
                </span>
                {insights.types_count > 1 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {t('stats.typesCount', { count: insights.types_count })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {insights.loyalty_quip}
              </p>
            </div>
          )}

          {/* 4b. Ranked Manufacturer List */}
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {manufacturers.map(({ name, count }) => {
              const color = mfrColors.get(name) ?? 'var(--primary)'
              return (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-muted-foreground flex-1 truncate">{name}</span>
                  <span className="font-mono font-medium">{count}</span>
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${total > 0 ? (count / total) * 100 : 0}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Continent Progress Card (Radar)
// ============================================================================

const CONTINENT_TOTALS: Record<string, number> = {
  europe: 44,
  asia: 48,
  americas: 35,
  africa: 54,
  oceania: 14,
}

export function ContinentProgressCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()

  const continentBreakdown = advancedStats?.continentBreakdown

  const radarData = useMemo(() => {
    const continents = [
      { key: 'europe', label: t('continent.europe', 'Europe') },
      { key: 'asia', label: t('continent.asia', 'Asia') },
      { key: 'americas', label: t('continent.americas', 'Americas') },
      { key: 'africa', label: t('continent.africa', 'Africa') },
      { key: 'oceania', label: t('continent.oceania', 'Oceania') },
    ]
    return continents.map(({ key, label }) => {
      const visited = continentBreakdown?.[key] || 0
      const total = CONTINENT_TOTALS[key]
      return {
        continent: label,
        coverage: Math.round((visited / total) * 100),
        visited,
        total,
      }
    })
  }, [continentBreakdown, t])

  return (
    <StatCard title={t('stats.continentsTitle', 'World Coverage')} icon={Globe2}>
      {continentBreakdown ? (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="continent"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
              <RechartsRadar
                dataKey="coverage"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--primary)' }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, _name: string, props: any) => {
                  const p = props?.payload
                  return [`${p?.visited ?? 0}/${p?.total ?? 0} (${value}%)`, '']
                }) as any}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          {advancedStats?.cardInsights?.continent && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {advancedStats.cardInsights.continent}
            </p>
          )}
        </>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Duration Stats Card (Enhanced)
// ============================================================================

export function DurationStatsCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()

  const durationStats = advancedStats?.durationStats
  const yearComparison = advancedStats?.durationYearComparison

  const stats = useMemo(() => {
    if (!durationStats) return null
    return {
      longest: formatDuration(durationStats.longest_minutes || 0),
      shortest: formatDuration(durationStats.shortest_minutes || 0),
      average: formatDuration(durationStats.avg_minutes || 0),
      total: formatDuration(durationStats.total_minutes || 0),
    }
  }, [durationStats])

  const deltaLabel = useMemo(() => {
    if (!yearComparison) return null
    if (yearComparison.previous_total_minutes === 0) {
      return { text: t('stats.firstYear', 'First year tracking'), positive: true }
    }
    const delta = yearComparison.delta_percent
    const sign = delta >= 0 ? '+' : ''
    return {
      text: `${sign}${Math.round(delta)}% ${t('stats.vsLastYear', 'vs last year')}`,
      positive: delta >= 0,
    }
  }, [yearComparison, t])

  return (
    <StatCard title={t('stats.durationStats', 'Flight Duration')} icon={Clock}>
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.longestFlight', 'Longest')}
              </div>
              <div className="font-mono font-semibold">{stats.longest}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.shortestFlight', 'Shortest')}
              </div>
              <div className="font-mono font-semibold">{stats.shortest}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.averageFlight', 'Average')}
              </div>
              <div className="font-mono font-semibold">{stats.average}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.totalTime', 'Total')}
              </div>
              <div className="font-mono font-semibold">{stats.total}</div>
              {deltaLabel && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                    deltaLabel.positive
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {deltaLabel.positive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {deltaLabel.text}
                </div>
              )}
            </div>
          </div>

          {advancedStats?.cardInsights?.duration && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              {advancedStats.cardInsights.duration}
            </p>
          )}
        </>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}
