import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { PassportEntry } from '@kuuki/shared'
import { CountryStamp } from './CountryStamp'
import { StampPopup } from './StampPopup'
import { Skeleton } from '@/components/ui/skeleton'

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

  // Group entries by year for potential section headers (future enhancement)
  // For now, just display chronologically (oldest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(a.firstVisit).getTime() - new Date(b.firstVisit).getTime()
    )
  }, [entries])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Stamp grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedEntries.map((entry) => (
          <div
            key={entry.countryCode}
            className="animate-fade-up"
            onClick={(e) => handleStampClick(entry, e)}
          >
            <CountryStamp
              entry={entry}
              themeColor={themeColor}
              isSelected={selectedEntry?.countryCode === entry.countryCode}
            />
          </div>
        ))}
      </div>

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
