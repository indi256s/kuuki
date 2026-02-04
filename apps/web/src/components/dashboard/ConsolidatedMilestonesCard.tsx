import { Globe, Clock, Sparkles } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function ConsolidatedMilestonesCard() {
  const { t } = useTranslation()
  const { data: stats } = useDashboardStats()

  if (!stats) return null

  const { milestones } = stats

  // Format time in air
  const timeDisplay = milestones.timeInAir.days > 0
    ? `${milestones.timeInAir.days}d ${milestones.timeInAir.hours}h`
    : `${milestones.timeInAir.hours}h`

  return (
    <div
      className={cn(
        // Base card styles
        'rounded-2xl border border-border/50 bg-card p-5 h-full',
        'transition-all duration-300',
        // Hover effect
        'hover:border-primary/30 hover:shadow-glow-sm',
        'flex flex-col'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {t('dashboard.milestones', 'Achievements')}
        </h3>
        <Sparkles className="w-4 h-4 text-purple-500" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {/* Moon Progress - Primary Stat */}
        <div>
          <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-medium text-purple-500">{t('stats.milestones.moon', 'Lunar Trajectory')}</span>
            <span className="text-xs font-mono text-muted-foreground">{milestones.moonProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500/80 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, milestones.moonProgress)}%` }}
            />
          </div>
        </div>

        {/* Earth Loops & Time - Secondary Stats (Grid) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <Globe className="w-3 h-3 text-blue-500 mx-auto mb-1 opacity-70" />
            <div className="font-mono font-bold text-sm">{milestones.earthTrips.toFixed(1)}x</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <Clock className="w-3 h-3 text-amber-500 mx-auto mb-1 opacity-70" />
            <div className="font-mono font-bold text-sm">{timeDisplay}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
