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
 * - On mobile: Collapsible with clean divider-style trigger
 * - On desktop (sm+): Always expanded with subtle divider
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
    <div className={cn('', className)}>
      {/* Mobile: Collapsible */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 py-3',
                'border-b border-border/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'transition-colors duration-200',
                'text-left'
              )}
              aria-expanded={isOpen}
            >
              {/* Icon */}
              {Icon && (
                <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" strokeWidth={1.5} />
              )}

              {/* Title */}
              <span className="flex-1 text-sm uppercase tracking-widest text-muted-foreground font-medium">
                {title}
              </span>

              {/* Chevron indicator */}
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-muted-foreground/40 flex-shrink-0',
                  'transition-transform duration-200',
                  isOpen && 'rotate-90'
                )}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="pt-4 pb-2">
              {content}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Always expanded with subtle divider */}
      <div className="hidden sm:block">
        {/* Section divider with title */}
        <div className="flex items-center gap-3 mb-6">
          {Icon && (
            <Icon className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
          )}
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {title}
          </h2>
          <div className="flex-1 h-px bg-border/30" />
        </div>

        {/* Content */}
        {content}
      </div>
    </div>
  )
}
