import { useDashboardStore } from '@/stores/dashboardStore'
import { cn } from '@/lib/utils'

export function YearFilter() {
    const { selectedYear, setSelectedYear, availableYears } = useDashboardStore()

    if (availableYears.length === 0) {
        return null
    }

    const years = [...availableYears, 'all' as const].sort((a, b) => {
        if (a === 'all') return 1
        if (b === 'all') return -1
        return b - a // Descending order (newest first)
    })

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Filter:
            </span>
            <div className="flex gap-2">
                {years.map((year) => {
                    const isSelected = selectedYear === year
                    const label = year === 'all' ? 'All Time' : year.toString()

                    return (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            aria-pressed={isSelected}
                            className={cn(
                                // Base styles
                                'px-4 py-2 rounded-lg text-sm font-medium',
                                'transition-all duration-200',
                                'whitespace-nowrap',
                                // Focus state
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',

                                // Selected state
                                isSelected ? [
                                    'bg-primary text-primary-foreground',
                                    'shadow-sm',
                                ] : [
                                    'bg-muted/50 text-muted-foreground',
                                    'hover:bg-muted hover:text-foreground',
                                ]
                            )}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
