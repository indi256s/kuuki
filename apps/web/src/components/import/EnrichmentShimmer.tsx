import { cn } from '@/lib/utils'

interface EnrichmentShimmerProps {
  className?: string
  width?: 'sm' | 'md' | 'lg'
}

/**
 * Shimmer placeholder shown for aircraft and time fields during enrichment.
 * Uses the existing shimmer animation from index.css.
 */
export function EnrichmentShimmer({ className, width = 'md' }: EnrichmentShimmerProps) {
  const widthClass = {
    sm: 'w-12',
    md: 'w-16',
    lg: 'w-24',
  }[width]

  return (
    <div
      className={cn(
        'relative h-4 rounded-md bg-muted overflow-hidden',
        widthClass,
        className
      )}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  )
}

/**
 * Shimmer for a full input field (used in expanded row)
 */
export function EnrichmentFieldShimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative h-9 w-full rounded-md bg-muted overflow-hidden',
        className
      )}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  )
}
