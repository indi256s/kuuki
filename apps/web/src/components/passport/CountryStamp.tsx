import { memo } from 'react'
import type { PassportEntry } from '@kuuki/shared'
import { cn } from '@/lib/utils'

interface CountryStampProps {
  entry: PassportEntry
  themeColor?: string
  onClick?: () => void
  isSelected?: boolean
}

// Format relative date (e.g., "2 years ago")
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) {
    return diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  const years = Math.floor(diffDays / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

// Get color with opacity for SVG
function colorWithOpacity(color: string, opacity: number): string {
  // If hex color, convert to rgba
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  return color
}

function CircleStamp({ entry, themeColor, onClick, isSelected }: CountryStampProps) {
  const relativeDate = formatRelativeDate(entry.firstVisit)
  const bgTint = themeColor ? colorWithOpacity(themeColor, 0.05) : 'rgba(0,0,0,0.02)'
  const borderColor = entry.flagColors[0] || entry.dominantColor

  return (
    <button
      onClick={onClick}
      aria-label={`${entry.countryName} - ${entry.nativeName}, visited ${relativeDate}`}
      className={cn(
        'group relative w-full aspect-square transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full drop-shadow-sm group-hover:drop-shadow-md transition-[filter,transform] duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        {/* Background circle with theme tint */}
        <circle
          cx="60"
          cy="60"
          r="56"
          fill={bgTint}
          stroke={borderColor}
          strokeWidth="3"
          strokeDasharray="8 4"
          className="transition-colors"
        />

        {/* Inner decorative border */}
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke={colorWithOpacity(borderColor, 0.3)}
          strokeWidth="1"
        />

        {/* Native name */}
        <text
          x="60"
          y="40"
          textAnchor="middle"
          className="fill-foreground font-medium"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
        >
          {entry.nativeName.length > 12 ? entry.nativeName.slice(0, 10) + '…' : entry.nativeName}
        </text>

        {/* English name */}
        <text
          x="60"
          y="55"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {entry.countryName.toUpperCase()}
        </text>

        {/* Relative date */}
        <text
          x="60"
          y="72"
          textAnchor="middle"
          className="fill-muted-foreground/70"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
        >
          {relativeDate}
        </text>

        {/* Visit count badge */}
        {entry.visitCount > 1 && (
          <g transform="translate(85, 95)">
            <rect
              x="-12"
              y="-8"
              width="24"
              height="16"
              rx="3"
              fill={entry.dominantColor}
              className="opacity-90"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fill="white"
              fontSize="9"
              fontWeight="600"
              fontFamily="monospace"
            >
              ×{entry.visitCount}
            </text>
          </g>
        )}
      </svg>
    </button>
  )
}

function RectangleStamp({ entry, themeColor, onClick, isSelected }: CountryStampProps) {
  const relativeDate = formatRelativeDate(entry.firstVisit)
  const bgTint = themeColor ? colorWithOpacity(themeColor, 0.05) : 'rgba(0,0,0,0.02)'
  const borderColor = entry.flagColors[0] || entry.dominantColor

  return (
    <button
      onClick={onClick}
      aria-label={`${entry.countryName} - ${entry.nativeName}, visited ${relativeDate}`}
      className={cn(
        'group relative w-full aspect-[4/3] transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <svg
        viewBox="0 0 160 120"
        className="w-full h-full drop-shadow-sm group-hover:drop-shadow-md transition-[filter,transform] duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        {/* Background rectangle with theme tint */}
        <rect
          x="4"
          y="4"
          width="152"
          height="112"
          rx="8"
          fill={bgTint}
          stroke={borderColor}
          strokeWidth="3"
          strokeDasharray="10 5"
          className="transition-colors"
        />

        {/* Inner decorative border */}
        <rect
          x="12"
          y="12"
          width="136"
          height="96"
          rx="4"
          fill="none"
          stroke={colorWithOpacity(borderColor, 0.3)}
          strokeWidth="1"
        />

        {/* Flag color accent bar */}
        <rect
          x="12"
          y="12"
          width="136"
          height="8"
          rx="4"
          fill={entry.dominantColor}
          className="opacity-60"
        />

        {/* Native name */}
        <text
          x="80"
          y="48"
          textAnchor="middle"
          className="fill-foreground font-medium"
          fontSize="14"
          fontFamily="system-ui, sans-serif"
        >
          {entry.nativeName.length > 16 ? entry.nativeName.slice(0, 14) + '…' : entry.nativeName}
        </text>

        {/* English name */}
        <text
          x="80"
          y="66"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
        >
          {entry.countryName.toUpperCase()}
        </text>

        {/* Relative date */}
        <text
          x="80"
          y="86"
          textAnchor="middle"
          className="fill-muted-foreground/70"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {relativeDate}
        </text>

        {/* Visit count badge */}
        {entry.visitCount > 1 && (
          <g transform="translate(130, 95)">
            <rect
              x="-14"
              y="-9"
              width="28"
              height="18"
              rx="4"
              fill={entry.dominantColor}
              className="opacity-90"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fill="white"
              fontSize="10"
              fontWeight="600"
              fontFamily="monospace"
            >
              ×{entry.visitCount}
            </text>
          </g>
        )}
      </svg>
    </button>
  )
}

export const CountryStamp = memo(function CountryStamp(props: CountryStampProps) {
  const { entry } = props

  // Use regional stamp shape
  if (entry.stampShape === 'circle') {
    return <CircleStamp {...props} />
  }

  return <RectangleStamp {...props} />
})

// Also export a simple version for use in lists
export const CountryStampMini = memo(function CountryStampMini({
  entry,
  size = 'sm',
}: {
  entry: PassportEntry
  size?: 'sm' | 'md'
}) {
  const dimension = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12'

  return (
    <div
      className={cn(
        dimension,
        'rounded-full flex items-center justify-center text-xs font-medium',
        'border-2'
      )}
      style={{
        backgroundColor: colorWithOpacity(entry.dominantColor, 0.1),
        borderColor: entry.dominantColor,
      }}
      title={entry.countryName}
    >
      {entry.countryCode}
    </div>
  )
})
