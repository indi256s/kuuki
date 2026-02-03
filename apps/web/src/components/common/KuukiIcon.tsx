import { cn } from '@/lib/utils'

interface KuukiIconProps {
  className?: string
}

/**
 * Kuuki brand icon - the hiragana く character.
 * Uses currentColor so it inherits text color from parent.
 * Apply text-primary, text-muted-foreground, etc. via className.
 */
export function KuukiIcon({ className }: KuukiIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-4 h-4', className)}
      aria-hidden="true"
    >
      <text
        x="12"
        y="18"
        fontSize="20"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="'Hiragino Kaku Gothic Pro', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif"
      >
        く
      </text>
    </svg>
  )
}
