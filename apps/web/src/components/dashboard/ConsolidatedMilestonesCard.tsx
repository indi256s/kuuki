import { Moon, Globe, Clock, Sparkles } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface MilestoneRowProps {
  icon: React.ElementType
  iconColor: string
  label: string
  value: string
  detail: string
  progress?: number
}

function MilestoneRow({ icon: Icon, iconColor, label, value, detail, progress }: MilestoneRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          iconColor
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="font-mono text-lg font-semibold">{value}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>

        {/* Progress bar (optional) */}
        {progress !== undefined && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/60 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function ConsolidatedMilestonesCard() {
  const { t } = useTranslation()
  const { data: stats } = useDashboardStats()

  if (!stats) return null

  const { milestones, totalDistance } = stats

  // Format time in air
  const timeDisplay = milestones.timeInAir.days > 0
    ? `${milestones.timeInAir.days}d ${milestones.timeInAir.hours}h`
    : `${milestones.timeInAir.hours}h`

  return (
    <div
      className={cn(
        // Base card styles
        'rounded-2xl border border-border/50 bg-card p-6',
        'transition-all duration-300',
        // Hover effect
        'hover:border-primary/30 hover:shadow-glow-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold">
          {t('dashboard.milestones', 'Milestones')}
        </h3>
      </div>

      {/* Milestone rows */}
      <div className="space-y-3">
        {/* Distance to Moon */}
        <MilestoneRow
          icon={Moon}
          iconColor="bg-purple-500/10 text-purple-500"
          label={t('stats.milestones.moon', 'Distance to Moon')}
          value={`${milestones.moonProgress.toFixed(1)}%`}
          detail={`${totalDistance.toLocaleString()} / 384,400 km`}
          progress={milestones.moonProgress}
        />

        {/* Trips Around Earth */}
        <MilestoneRow
          icon={Globe}
          iconColor="bg-blue-500/10 text-blue-500"
          label={t('stats.milestones.earth', 'Trips Around Earth')}
          value={milestones.earthTrips.toFixed(2)}
          detail={t('stats.milestones.earthDetail', '40,075 km per trip')}
        />

        {/* Time in Air */}
        <MilestoneRow
          icon={Clock}
          iconColor="bg-amber-500/10 text-amber-500"
          label={t('stats.milestones.timeInAir', 'Time in Air')}
          value={timeDisplay}
          detail={`${stats.totalDuration.toLocaleString()} ${t('common.minutes', 'minutes')} ${t('common.total', 'total')}`}
        />
      </div>
    </div>
  )
}
