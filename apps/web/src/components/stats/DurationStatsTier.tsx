import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Plane, Moon, Sun, Briefcase, Sunset } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdvancedStats, type DeparturePatterns } from '@/hooks/useAdvancedStats'
import { FlightPopover } from './FlightPopover'
import { formatDuration, getDominantPattern, type DepartureBucket } from '@/lib/formatDuration'

// GLaDOS-style fun facts for Time Geek tier
const GLADOS_FACTS_KEYS = [
  'stats.timeGeek.fact.1',
  'stats.timeGeek.fact.2',
  'stats.timeGeek.fact.3',
  'stats.timeGeek.fact.4',
  'stats.timeGeek.fact.5',
]

// Departure pattern colors
const PATTERN_COLORS: Record<DepartureBucket, string> = {
  red_eye: 'bg-indigo-500',
  early: 'bg-amber-500',
  business: 'bg-blue-500',
  evening: 'bg-orange-500',
}

const PATTERN_BG_COLORS: Record<DepartureBucket, string> = {
  red_eye: 'bg-indigo-500/10 border-indigo-500/20',
  early: 'bg-amber-500/10 border-amber-500/20',
  business: 'bg-blue-500/10 border-blue-500/20',
  evening: 'bg-orange-500/10 border-orange-500/20',
}

const PATTERN_ICONS: Record<DepartureBucket, typeof Moon> = {
  red_eye: Moon,
  early: Sun,
  business: Briefcase,
  evening: Sunset,
}

const PATTERN_LABEL_KEYS: Record<DepartureBucket, string> = {
  red_eye: 'stats.timeGeek.pattern.redEye',
  early: 'stats.timeGeek.pattern.early',
  business: 'stats.timeGeek.pattern.business',
  evening: 'stats.timeGeek.pattern.evening',
}

export function DurationStatsTier() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()

  const durationStats = advancedStats?.durationStats
  const departurePatterns = advancedStats?.departurePatterns

  // Compute hero stat: flight count + avg duration
  const heroStat = useMemo(() => {
    if (!durationStats) return null

    const flightCount = durationStats.flight_count || 0
    const avgMinutes = durationStats.avg_minutes || 0

    return {
      count: flightCount,
      avgFormatted: formatDuration(avgMinutes),
    }
  }, [durationStats])

  // Total flight time in days/hours
  const totalTimeFormatted = useMemo(() => {
    if (!durationStats?.total_minutes) return '0m'
    return formatDuration(durationStats.total_minutes)
  }, [durationStats])

  // Dominant departure pattern
  const dominantPattern = useMemo(() => {
    if (!departurePatterns) return null

    const patterns: Record<DepartureBucket, number> = {
      red_eye: departurePatterns.red_eye || 0,
      early: departurePatterns.early || 0,
      business: departurePatterns.business || 0,
      evening: departurePatterns.evening || 0,
    }

    return getDominantPattern(patterns)
  }, [departurePatterns])

  // GLaDOS fact
  const gladosFact = useMemo(() => {
    if (!advancedStats || !durationStats) return null

    // Use a different rotation than AviaGeek (offset by 2)
    const factIndex = (advancedStats.featuredFactIndex + 2) % GLADOS_FACTS_KEYS.length
    const factKey = GLADOS_FACTS_KEYS[factIndex]

    // Compute values for interpolation
    const totalMinutes = durationStats.total_minutes || 0
    const days = Math.floor(totalMinutes / (24 * 60))
    const avgFormatted = formatDuration(durationStats.avg_minutes || 0)
    const totalFormatted = formatDuration(totalMinutes)
    const longestFormatted = formatDuration(durationStats.longest_minutes || 0)

    // Get dominant pattern name for fact
    const patternBucket = dominantPattern?.bucket || 'business'
    const patternPercent = dominantPattern?.percentage || 0
    const patternLabelKey = PATTERN_LABEL_KEYS[patternBucket]
    const patternName = t(patternLabelKey, patternBucket)

    // Fallback messages with data interpolation
    const fallbacks: Record<string, string> = {
      'stats.timeGeek.fact.1': `${days} days airborne. That's ${days} days you weren't doing anything productive on the ground either.`,
      'stats.timeGeek.fact.2': `${patternPercent}% ${patternName} departures. Your circadian rhythm has been noted. And judged.`,
      'stats.timeGeek.fact.3': `${totalFormatted} total, ${avgFormatted} average. The math checks out. Your life choices remain unexamined.`,
      'stats.timeGeek.fact.4': `Your longest flight: ${longestFormatted}. I hope the in-flight entertainment was adequate. I have my doubts.`,
      'stats.timeGeek.fact.5': `You have spent 100% of your recorded flights sitting. The rest was also sitting. But faster.`,
    }

    return t(factKey, {
      days,
      percent: patternPercent,
      bucket: patternName,
      total: totalFormatted,
      avg: avgFormatted,
      duration: longestFormatted,
      defaultValue: fallbacks[factKey],
    })
  }, [advancedStats, durationStats, dominantPattern, t])

  if (!advancedStats) {
    return <DurationStatsSkeleton />
  }

  return (
    <div className="space-y-5">
      {/* Hero stat: Flight count + average */}
      {heroStat && (
        <div className="p-4 rounded-xl bg-chart-4/5 border border-chart-4/10">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-chart-4" />
            <span className="text-lg font-semibold">
              {t('stats.timeGeek.hero', '{{count}} flights, averaging {{avg}}', {
                count: heroStat.count,
                avg: heroStat.avgFormatted,
              })}
            </span>
          </div>
        </div>
      )}

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Flight Time */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t('stats.timeGeek.totalTime', 'Total Flight Time')}
          </div>
          <div className="text-2xl font-semibold font-mono">
            {totalTimeFormatted}
          </div>
        </div>

        {/* Departure Pattern */}
        {dominantPattern && (
          <DeparturePatternCard
            patterns={departurePatterns!}
            dominant={dominantPattern}
          />
        )}

        {/* Longest Flight */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t('stats.timeGeek.longestFlight', 'Longest Flight')}
          </div>
          <FlightPopover flightId={durationStats?.longest_flight_id ?? null}>
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-semibold font-mono">
                {durationStats?.longest_minutes
                  ? formatDuration(durationStats.longest_minutes)
                  : '—'}
              </span>
            </div>
          </FlightPopover>
        </div>

        {/* Shortest Flight */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t('stats.timeGeek.shortestFlight', 'Shortest Flight')}
          </div>
          <FlightPopover flightId={durationStats?.shortest_flight_id ?? null}>
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-semibold font-mono">
                {durationStats?.shortest_minutes
                  ? formatDuration(durationStats.shortest_minutes)
                  : '—'}
              </span>
            </div>
          </FlightPopover>
        </div>
      </div>

      {/* GLaDOS Fun Fact */}
      {gladosFact && (
        <div className="pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            "{gladosFact}"
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            — {t('stats.locked.signature', 'Your Flight Stats AI')}
          </p>
        </div>
      )}
    </div>
  )
}

interface DeparturePatternCardProps {
  patterns: DeparturePatterns
  dominant: { bucket: DepartureBucket; count: number; percentage: number }
}

function DeparturePatternCard({ patterns, dominant }: DeparturePatternCardProps) {
  const { t } = useTranslation()

  const total = patterns.total_with_time || 0
  const Icon = PATTERN_ICONS[dominant.bucket]
  const labelKey = PATTERN_LABEL_KEYS[dominant.bucket]

  // Calculate bar widths for visual distribution
  const barData = useMemo(() => {
    if (total === 0) return []

    const buckets: DepartureBucket[] = ['red_eye', 'early', 'business', 'evening']
    return buckets.map((bucket) => ({
      bucket,
      count: patterns[bucket] || 0,
      percentage: Math.round(((patterns[bucket] || 0) / total) * 100),
    }))
  }, [patterns, total])

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      PATTERN_BG_COLORS[dominant.bucket]
    )}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {t('stats.timeGeek.departurePattern', 'Departure Pattern')}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5" />
        <span className="text-lg font-semibold">
          {t(labelKey, dominant.bucket)}
        </span>
        <span className="text-sm text-muted-foreground ml-auto">
          {dominant.percentage}%
        </span>
      </div>

      {/* Pattern distribution bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
        {barData.map(({ bucket, percentage }) => (
          <div
            key={bucket}
            className={cn('h-full transition-all', PATTERN_COLORS[bucket])}
            style={{ width: `${percentage}%` }}
            title={`${bucket}: ${percentage}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {barData.map(({ bucket, count }) => {
          const BucketIcon = PATTERN_ICONS[bucket]
          return (
            <span key={bucket} className="flex items-center gap-1">
              <BucketIcon className="w-3 h-3" />
              {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function DurationStatsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-16 bg-muted rounded-xl" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>

      {/* Fact skeleton */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <div className="h-4 bg-muted rounded-full w-3/4" />
        <div className="h-3 bg-muted rounded-full w-1/4" />
      </div>
    </div>
  )
}
