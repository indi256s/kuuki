import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingActionButtonProps {
  /** Icon to display in the FAB */
  icon: LucideIcon
  /** Click handler */
  onClick: () => void
  /** Accessible label for screen readers */
  label: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Floating Action Button for primary actions on mobile.
 *
 * - Positioned bottom-right, above the mobile tab bar
 * - 56x56px touch target (iOS/Android standard)
 * - Only visible on mobile (< 640px)
 * - Uses safe area inset for proper positioning on notched devices
 * - Subtle scale animation on press
 */
export function FloatingActionButton({
  icon: Icon,
  onClick,
  label,
  className,
}: FloatingActionButtonProps) {
  return (
    <button
      data-testid="fab"
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Positioning - fixed above tab bar, right side
        'fixed right-4 bottom-safe-fab z-40',
        // Only show on mobile
        'sm:hidden',
        // Size - 56x56 touch target
        'w-14 h-14',
        // Appearance
        'rounded-full bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/25',
        // Flexbox centering
        'flex items-center justify-center',
        // Interactions
        'active:scale-95 transition-transform duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      <Icon className="w-6 h-6" strokeWidth={2} />
    </button>
  )
}
