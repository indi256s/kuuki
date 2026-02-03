import { Trophy, LucideIcon } from 'lucide-react'
import { DashboardCard } from './DashboardCard'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'

interface LeaderboardCardProps {
    category: 'countries' | 'cities' | 'flights' | 'distance' | 'airlines'
    icon?: LucideIcon
}

export function LeaderboardCard({ category, icon }: LeaderboardCardProps) {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()

    if (!stats) return null

    const percentile = stats.percentiles[category]
    const value = (() => {
        switch (category) {
            case 'countries':
                return stats.uniqueCountries
            case 'cities':
                return stats.uniqueCities
            case 'flights':
                return stats.totalFlights
            case 'distance':
                return `${stats.totalDistance.toLocaleString()} km`
            case 'airlines':
                return stats.uniqueAirlines
        }
    })()

    const label = t(`stats.leaderboard.${category}`, category)
    const description = percentile !== null
        ? `Top ${percentile}% · ${value}`
        : t('stats.leaderboard.optIn', 'Join leaderboard to see ranking')

    return (
        <DashboardCard
            icon={icon || Trophy}
            value={percentile !== null ? `Top ${percentile}%` : '—'}
            label={label}
            description={description}
        />
    )
}
