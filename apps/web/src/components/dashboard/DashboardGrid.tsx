import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashboardGridProps {
    children: ReactNode
    className?: string
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
    return (
        <div
            className={cn(
                // Base grid layout
                'grid grid-cols-1 gap-4',
                // Desktop: 2-column flexible grid
                'lg:grid-cols-2 lg:auto-rows-auto',
                className
            )}
        >
            {children}
        </div>
    )
}
