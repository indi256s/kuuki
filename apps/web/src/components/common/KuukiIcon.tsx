import { cn } from '@/lib/utils'

interface KuukiIconProps {
  className?: string
  /** Whether to animate the crossfade effect. Default: true */
  animate?: boolean
}

const HIRAGANA = ['く', 'う', 'き'] as const
const FONT_FAMILY = "'Hiragino Kaku Gothic Pro', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif"

/**
 * Kuuki brand icon - smoothly crossfades through くうき (air/atmosphere).
 *
 * Each character fades in and out with generous overlap, creating
 * an ethereal, breath-like presence. Pure opacity — no movement.
 *
 * Uses currentColor so it inherits text color from parent.
 */
export function KuukiIcon({ className, animate = true }: KuukiIconProps) {
  return (
    <div
      className={cn(
        'relative w-4 h-4 flex items-center justify-center',
        className
      )}
      aria-hidden="true"
      aria-label="Kuuki"
    >
      {HIRAGANA.map((char, i) => (
        <span
          key={char}
          className={cn(
            'absolute text-[1.1rem] font-bold leading-none select-none',
            animate && 'kuuki-crossfade'
          )}
          style={{
            fontFamily: FONT_FAMILY,
            animationDelay: animate ? `${i * 2.5}s` : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}
