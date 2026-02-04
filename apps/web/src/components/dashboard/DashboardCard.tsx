import { ReactNode } from 'react'
import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
    // Content
    icon?: LucideIcon
    iconClassName?: string
    value: string | number
    label: string
    description?: string

    // State
    isLocked?: boolean

    // Layout
    span?: 1 | 2 // Column span (1 or 2 columns)
    className?: string

    // Interaction
    onClick?: () => void

    // Custom content (overrides standard layout)
    children?: ReactNode
    customLayout?: boolean
}

export function DashboardCard({
    icon: Icon,
    iconClassName,
    value,
    label,
    description,
    isLocked = false,
    span = 1,
    className,
    onClick,
    children,
    customLayout = false,
}: DashboardCardProps) {
    const isInteractive = !!onClick && !isLocked

    return (
        <div
            className={cn(
                // Base styles
                'group relative rounded-2xl border border-border/50 bg-card p-6',
                'transition-all duration-300',

                // Grid span
                span === 2 && 'lg:col-span-2',

                // Hover effects (only if interactive and not locked)
                isInteractive && [
                    'cursor-pointer',
                    'hover:border-primary/30',
                    'hover:shadow-glow-sm',
                ],

                // Locked state
                isLocked && [
                    'grayscale opacity-50',
                    'cursor-not-allowed',
                ],

                className
            )}
            onClick={isInteractive ? onClick : undefined}
            onKeyDown={isInteractive ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
        >
            {/* Lock overlay */}
            {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="rounded-full bg-muted/80 p-4 backdrop-blur-sm">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                    </div>
                </div>
            )}

            {/* Custom layout */}
            {customLayout ? (
                children
            ) : (
                <div className="flex items-start gap-4">
                    {/* Left side: Icon with animation */}
                    {Icon && (
                        <div className="flex-shrink-0">
                            <div className={cn(
                                'relative w-12 h-12 rounded-xl flex items-center justify-center',
                                'bg-primary/10 text-primary',
                                'transition-all duration-300',
                                !isLocked && [
                                    'group-hover:animate-glow-pulse',
                                    'group-hover:scale-110',
                                ],
                                iconClassName
                            )}>
                                <Icon className="w-6 h-6" />
                            </div>
                        </div>
                    )}

                    {/* Right side: Content */}
                    <div className="flex-1 min-w-0">
                        <div className="font-mono text-3xl font-semibold tracking-tight">
                            {value}
                        </div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                            {label}
                        </div>
                        {description && (
                            <div className="mt-1 text-xs text-muted-foreground">
                                {description}
                            </div>
                        )}
                        {children && !customLayout && (
                            <div className="mt-3">
                                {children}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
