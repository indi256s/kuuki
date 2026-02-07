import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import type { PassportEntry } from '@kuuki/shared'
import { CountryStamp } from './CountryStamp'
import { StampPopup } from './StampPopup'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Hook: reveal element when it enters the viewport (lazy rendering)
 */
function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect() // Once visible, stay rendered
        }
      },
      { rootMargin: '200px', ...options } // Start loading 200px before visible
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isInView }
}

/** Lazy continent section — renders skeleton until scrolled into view */
const LazyContinentSection = memo(function LazyContinentSection({
  continent,
  stamps,
  groupIndex,
  continentNames,
  selectedEntry,
  onStampClick,
  themeColor,
}: {
  continent: string
  stamps: PassportEntry[]
  groupIndex: number
  continentNames: Record<string, string>
  selectedEntry: PassportEntry | null
  onStampClick: (entry: PassportEntry, event: React.MouseEvent) => void
  themeColor?: string
}) {
  const { ref, isInView } = useInView()

  return (
    <section
      ref={ref}
      key={continent}
      className="animate-fade-up"
      style={{ animationDelay: `${groupIndex * 50}ms` }}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        {continentNames[continent] || continent}
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full font-mono">
          {stamps.length}
        </span>
      </h2>

      {isInView ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {stamps.map((entry) => (
            <div
              key={entry.countryCode}
              onClick={(e) => onStampClick(entry, e)}
            >
              <CountryStamp
                entry={entry}
                themeColor={themeColor}
                isSelected={selectedEntry?.countryCode === entry.countryCode}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {stamps.slice(0, 6).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      )}
    </section>
  )
})

interface PassportStampsProps {
  entries: PassportEntry[]
  isLoading?: boolean
  themeColor?: string
}

export function PassportStamps({ entries, isLoading, themeColor }: PassportStampsProps) {
  const [selectedEntry, setSelectedEntry] = useState<PassportEntry | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Handle stamp click - show popup
  const handleStampClick = useCallback((entry: PassportEntry, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()

    if (containerRect) {
      // Calculate position relative to container
      const left = rect.left - containerRect.left + rect.width / 2
      const top = rect.bottom - containerRect.top + 8

      // Ensure popup doesn't go off screen (basic check)
      // We'll refine this if needed
      setPopupPosition({ top, left })
    }

    setSelectedEntry(entry)
  }, [])

  // Close popup when clicking outside
  useEffect(() => {
    if (!selectedEntry) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setSelectedEntry(null)
        setPopupPosition(null)
      }
    }

    // Delay to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [selectedEntry])

  // Close popup on escape
  useEffect(() => {
    if (!selectedEntry) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedEntry(null)
        setPopupPosition(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [selectedEntry])

  // Group entries by continent, sorted by count (most stamps first)
  const groupedByContinent = useMemo(() => {
    // Group by continent
    const groups: Record<string, PassportEntry[]> = {}
    for (const entry of entries) {
      const continent = entry.continent || 'Other'
      if (!groups[continent]) groups[continent] = []
      groups[continent].push(entry)
    }

    // Sort entries within each continent chronologically (oldest first)
    for (const continent of Object.keys(groups)) {
      groups[continent].sort(
        (a, b) => new Date(a.firstVisit).getTime() - new Date(b.firstVisit).getTime()
      )
    }

    // Sort continents by count (most stamps first)
    const sortedContinents = Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([continent, stamps]) => ({ continent, stamps }))

    return sortedContinents
  }, [entries])

  // Continent display names
  const continentNames: Record<string, string> = {
    europe: 'Europe',
    asia: 'Asia',
    africa: 'Africa',
    'north-america': 'North America',
    'south-america': 'South America',
    oceania: 'Oceania',
    antarctica: 'Antarctica',
    Other: 'Other',
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative space-y-6">
      {groupedByContinent.map(({ continent, stamps }, groupIndex) => (
        <LazyContinentSection
          key={continent}
          continent={continent}
          stamps={stamps}
          groupIndex={groupIndex}
          continentNames={continentNames}
          selectedEntry={selectedEntry}
          onStampClick={handleStampClick}
          themeColor={themeColor}
        />
      ))}

      {/* Popup overlay */}
      {selectedEntry && popupPosition && (
        <div
          ref={popupRef}
          className="absolute z-50"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            transform: 'translateX(-50%)',
          }}
        >
          <StampPopup
            entry={selectedEntry}
            onClose={() => {
              setSelectedEntry(null)
              setPopupPosition(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

// Simple virtualized version for large lists (can be enhanced with react-window later)
export function PassportStampsVirtualized({
  entries,
  themeColor,
}: {
  entries: PassportEntry[]
  themeColor?: string
}) {
  // For now, just use the regular grid
  // When react-window is added, this can be replaced with proper virtualization
  return <PassportStamps entries={entries} themeColor={themeColor} />
}
