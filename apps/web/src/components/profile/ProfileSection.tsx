import { useState } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface ProfileSectionProps {
  /** Section title */
  title: string
  /** Optional icon displayed before the title */
  icon?: LucideIcon
  /** Content of the section */
  children: React.ReactNode
  /** Whether the section starts expanded (default: false) */
  defaultOpen?: boolean
  /** Content to show when children is empty/null */
  emptyState?: React.ReactNode
  /** Additional CSS classes for the wrapper */
  className?: string
}

/**
 * ProfileSection - Responsive collapsible section for profile pages.
 *
 * Behavior:
 * - On mobile: Collapsible card with tap to expand/collapse
 * - On desktop (sm+): Always expanded, no collapse trigger visible
 * - Empty state support: Shows emptyState content when children is empty
 */
export function ProfileSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  emptyState,
  className,
}: ProfileSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Check if children is empty
  const isEmpty = !children || (Array.isArray(children) && children.length === 0)

  // Content to render (either children or empty state)
  const content = isEmpty && emptyState ? emptyState : children

  return (
    <div className={cn('mt-6', className)}>
      {/* Mobile: Collapsible */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl',
                'bg-card border border-border/50',
                'hover:bg-secondary/50 hover:border-border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'transition-all duration-200',
                'text-left'
              )}
              aria-expanded={isOpen}
            >
              {/* Icon */}
              {Icon && (
                <div className="flex-shrink-0 p-2 rounded-lg bg-secondary/50">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              {/* Title */}
              <span className="flex-1 font-medium text-foreground">
                {title}
              </span>

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
              {content}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Always expanded with header */}
      <div className="hidden sm:block">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <Icon className="w-5 h-5 text-muted-foreground" />
          )}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {/* Content */}
        {content}
      </div>
    </div>
  )
}
