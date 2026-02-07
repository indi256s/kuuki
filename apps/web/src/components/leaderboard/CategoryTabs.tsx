import { useTranslation } from 'react-i18next'
import { Plane, TrendingUp, Globe2, MapPin, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardCategory } from '@/hooks/useLeaderboard'

interface CategoryTabsProps {
  activeCategory: LeaderboardCategory
  onCategoryChange: (category: LeaderboardCategory) => void
}

const CATEGORIES: Array<{
  id: LeaderboardCategory
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
}> = [
  { id: 'flights', icon: Plane, labelKey: 'leaderboard.categories.flights' },
  { id: 'distance', icon: TrendingUp, labelKey: 'leaderboard.categories.distance' },
  { id: 'countries', icon: Globe2, labelKey: 'leaderboard.categories.countries' },
  { id: 'cities', icon: MapPin, labelKey: 'leaderboard.categories.cities' },
  { id: 'airlines', icon: Building2, labelKey: 'leaderboard.categories.airlines' },
]

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-secondary/50 overflow-x-auto">
      {CATEGORIES.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          onClick={() => onCategoryChange(id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
            activeCategory === id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{t(labelKey, id)}</span>
        </button>
      ))}
    </div>
  )
}
