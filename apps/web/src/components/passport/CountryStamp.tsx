import { memo } from 'react'
import type { PassportEntry } from '@kuuki/shared'
import { cn } from '@/lib/utils'

interface CountryStampProps {
  entry: PassportEntry
  themeColor?: string
  onClick?: () => void
  isSelected?: boolean
}

// Format relative date (e.g., "2y ago")
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) return diffDays === 0 ? 'Today' : `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function CircleStamp({ entry, onClick, isSelected }: CountryStampProps) {
  const relativeDate = formatRelativeDate(entry.lastVisit)
  const borderColor = entry.dominantColor

  return (
    <button
      onClick={onClick}
      aria-label={`${entry.countryName} - ${entry.nativeName}, visited ${relativeDate}`}
      className={cn(
        'group relative w-full aspect-square',
        'rounded-full transition-all duration-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isSelected && 'ring-2 ring-primary ring-offset-2 scale-105'
      )}
    >
      {/* Outer glow "Lantern" effect - subtle by default, stronger on hover */}
      <div
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `0 0 20px ${borderColor}40`, // 40 = 25% opacity
          background: `radial-gradient(circle, ${borderColor}10 0%, transparent 70%)`
        }}
      />

      <svg
        viewBox="0 0 120 120"
        className="w-full h-full drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]"
        aria-hidden="true"
      >
        {/* Background - Washi paper feel */}
        <circle
          cx="60"
          cy="60"
          r="58"
          fill="var(--card)"
          className="transition-colors duration-300"
        />

        {/* Outer Ring - Precision machined look */}
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={borderColor}
          strokeWidth="1.5"
          opacity="0.8"
          strokeDasharray="1 3" // Micro-dashing for technical feel
          strokeLinecap="round"
        />

        {/* Inner Ring - Solid anchor */}
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={borderColor}
          strokeWidth="0.5"
          opacity="0.4"
        />

        {/* Native name - The Hero */}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="13"
          fontWeight="500"
          style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
        >
          {entry.nativeName.length > 10 ? entry.nativeName.slice(0, 9) + '…' : entry.nativeName}
        </text>

        {/* English name - Metadata */}
        <text
          x="60"
          y="70"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="8"
          fontWeight="500"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
        >
          {entry.countryName.toUpperCase().slice(0, 16)}
        </text>

        {/* Visit count - Instrumentation style */}
        {entry.visitCount > 1 && (
          <g transform="translate(60, 92)">
            <rect
              x="-10"
              y="-6"
              width="20"
              height="12"
              rx="2"
              fill={borderColor}
              fillOpacity="0.1"
            />
            <text
              x="0"
              y="2.5"
              textAnchor="middle"
              fill={borderColor}
              fontSize="7"
              fontWeight="600"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              ×{entry.visitCount}
            </text>
          </g>
        )}

        {/* Date - Top arc metadata */}
        <path
          id="topCurve"
          d="M 30,60 A 30,30 0 0,1 90,60"
          fill="none"
        />
        <text
          fill="var(--muted-foreground)"
          fontSize="6"
          style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}
        >
          <textPath href="#topCurve" startOffset="50%" textAnchor="middle">
            {relativeDate.toUpperCase()}
          </textPath>
        </text>
      </svg>
    </button>
  )
}

function RectangleStamp({ entry, onClick, isSelected }: CountryStampProps) {
  const relativeDate = formatRelativeDate(entry.lastVisit)
  const borderColor = entry.dominantColor

  return (
    <button
      onClick={onClick}
      aria-label={`${entry.countryName} - ${entry.nativeName}, visited ${relativeDate}`}
      className={cn(
        'group relative w-full aspect-[4/3] rounded-lg',
        'transition-all duration-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isSelected && 'ring-2 ring-primary ring-offset-2 scale-105'
      )}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `0 0 20px ${borderColor}40`,
          background: `linear-gradient(135deg, ${borderColor}10 0%, transparent 70%)`
        }}
      />

      <svg
        viewBox="0 0 160 120"
        className="w-full h-full drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]"
        aria-hidden="true"
      >
        {/* Background */}
        <rect
          x="4"
          y="4"
          width="152"
          height="112"
          rx="6"
          fill="var(--card)"
          className="transition-colors duration-300"
        />

        {/* Technical Border */}
        <rect
          x="8"
          y="8"
          width="144"
          height="104"
          rx="4"
          fill="none"
          stroke={borderColor}
          strokeWidth="1.5"
          opacity="0.8"
          strokeDasharray="1 4"
          strokeLinecap="round"
        />

        {/* Accent Bar */}
        <rect
          x="14"
          y="14"
          width="4"
          height="92"
          rx="2"
          fill={borderColor}
          fillOpacity="0.2"
        />

        {/* Native name */}
        <text
          x="88"
          y="58"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="16"
          fontWeight="500"
          style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
        >
          {entry.nativeName.length > 14 ? entry.nativeName.slice(0, 13) + '…' : entry.nativeName}
        </text>

        {/* English name */}
        <text
          x="88"
          y="76"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="10"
          fontWeight="500"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
        >
          {entry.countryName.toUpperCase()}
        </text>

        {/* Metadata Row */}
        <g transform="translate(88, 96)">
          <text
            x="-2"
            y="0"
            textAnchor="end"
            fill="var(--muted-foreground)"
            fontSize="8"
            style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}
          >
            {relativeDate}
          </text>

          {entry.visitCount > 1 && (
            <>
              <circle cx="0" cy="-2" r="1.5" fill={borderColor} opacity="0.5" />
              <text
                x="4"
                y="0"
                textAnchor="start"
                fill={borderColor}
                fontSize="8"
                fontWeight="600"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                ×{entry.visitCount}
              </text>
            </>
          )}
        </g>
      </svg>
    </button>
  )
}

export const CountryStamp = memo(function CountryStamp(props: CountryStampProps) {
  const { entry } = props

  if (entry.stampShape === 'circle') {
    return <CircleStamp {...props} />
  }

  return <RectangleStamp {...props} />
})

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
        'border border-border/50 bg-card shadow-sm'
      )}
      style={{
        boxShadow: `0 0 0 1px ${entry.dominantColor}20`
      }}
      title={entry.countryName}
    >
      <span className="font-mono" style={{ color: entry.dominantColor }}>
        {entry.countryCode}
      </span>
    </div>
  )
})
