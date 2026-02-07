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
        return b - a
    })

    return (
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-1">
            {years.map((year) => {
                const isSelected = selectedYear === year
                const label = year === 'all' ? 'All' : year.toString()

                return (
                    <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        aria-pressed={isSelected}
                        className={cn(
                            'px-3 py-1 rounded-md text-xs transition-all duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                            isSelected
                                ? 'bg-background text-foreground font-medium shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
