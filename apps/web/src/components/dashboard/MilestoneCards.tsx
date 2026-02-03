import { Moon, Globe, Clock } from 'lucide-react'
import { DashboardCard } from './DashboardCard'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'

export function MilestoneCards() {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()

    if (!stats) return null

    const { milestones } = stats

    return (
        <>
            {/* Distance to Moon */}
            <DashboardCard
                icon={Moon}
                iconClassName="bg-purple-500/10 text-purple-500"
                value={`${milestones.moonProgress.toFixed(1)}%`}
                label={t('stats.milestones.moon', 'Distance to Moon')}
                description={`${stats.totalDistance.toLocaleString()} / 384,400 km`}
            />

            {/* Trips Around Earth */}
            <DashboardCard
                icon={Globe}
                iconClassName="bg-blue-500/10 text-blue-500"
                value={milestones.earthTrips.toFixed(2)}
                label={t('stats.milestones.earth', 'Trips Around Earth')}
                description="40,075 km per trip"
            />

            {/* Time in Air */}
            <DashboardCard
                icon={Clock}
                iconClassName="bg-amber-500/10 text-amber-500"
                value={`${milestones.timeInAir.days}d ${milestones.timeInAir.hours}h`}
                label={t('stats.milestones.timeInAir', 'Time in Air')}
                description={`${stats.totalDuration.toLocaleString()} minutes total`}
            />
        </>
    )
}
