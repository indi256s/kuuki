import { useState } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  /** Card title displayed in the trigger */
  title: string
  /** Optional subtitle shown below the title */
  subtitle?: string
  /** Optional icon displayed before the title */
  icon?: LucideIcon
  /** Content to show when expanded */
  children: React.ReactNode
  /** Whether the card starts expanded (default: false) */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Additional CSS classes for the wrapper */
  className?: string
  /** Whether to hide on desktop (show always-expanded content instead) */
  mobileOnly?: boolean
}

/**
 * CollapsibleCard - A full-width card with tap-to-expand behavior.
 *
 * Designed for mobile-first interfaces where content needs to be
 * progressively disclosed. Features smooth chevron rotation and
 * consistent styling with the Kuuki design system.
 */
export function CollapsibleCard({
  title,
  subtitle,
  icon: Icon,
  children,
  defaultOpen = false,
  onOpenChange,
  className,
  mobileOnly = false,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
  }

  // If mobileOnly, hide this on sm+ breakpoints
  const wrapperClass = mobileOnly ? 'sm:hidden' : ''

  return (
    <div className={wrapperClass}>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl',
              'bg-card border border-border/50',
              'hover:bg-secondary/50 hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'transition-all duration-200',
              'text-left',
              className
            )}
            aria-expanded={isOpen}
          >
            {/* Icon */}
            {Icon && (
              <div className="flex-shrink-0 p-2 rounded-lg bg-secondary/50">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
            )}

            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{title}</p>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>

            {/* Chevron indicator */}
            <ChevronRight
              className={cn(
                'w-5 h-5 text-muted-foreground flex-shrink-0',
                'transition-transform duration-200',
                isOpen && 'rotate-90'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="pt-3">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
