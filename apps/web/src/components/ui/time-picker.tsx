"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimePickerProps {
  /** Value in HH:MM format (24-hour) */
  value?: string
  /** Called with value in HH:MM format */
  onChange?: (value: string) => void
  /** Called when the user clears the value */
  onClear?: () => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional class names for the wrapper */
  className?: string
}

// Generate hours 00-23 and minutes 00-59
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

const ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 5
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS // 220px

/**
 * Internal scroll column component for the drum-roller effect.
 * Uses scroll-snap for smooth snapping to the nearest item.
 */
function ScrollColumn({
  items,
  selected,
  onSelect,
  label,
}: {
  items: string[]
  selected: string | null
  onSelect: (value: string) => void
  label: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isUserScrolling = React.useRef(false)
  const scrollTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = React.useRef(false)

  // Scroll to the selected item on mount or when selected changes externally
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const targetIndex = selected ? items.indexOf(selected) : -1
    if (targetIndex === -1) return

    const targetScroll = targetIndex * ITEM_HEIGHT

    if (!hasMounted.current) {
      // On first mount, scroll instantly (no animation)
      container.scrollTop = targetScroll
      hasMounted.current = true
    } else if (!isUserScrolling.current) {
      container.scrollTo({ top: targetScroll, behavior: "smooth" })
    }
  }, [selected, items])

  // Detect which item is centered after scroll ends
  const handleScroll = React.useCallback(() => {
    isUserScrolling.current = true

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }

    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false
      const container = containerRef.current
      if (!container) return

      const scrollTop = container.scrollTop
      const index = Math.round(scrollTop / ITEM_HEIGHT)
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1))

      if (items[clampedIndex] !== selected) {
        onSelect(items[clampedIndex])
      }
    }, 80)
  }, [items, selected, onSelect])

  React.useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    }
  }, [])

  // Calculate opacity for each item based on distance from center
  const getItemOpacity = (index: number) => {
    if (!containerRef.current) return 1
    const scrollTop = containerRef.current.scrollTop
    const centerOffset = scrollTop / ITEM_HEIGHT
    const distance = Math.abs(index - centerOffset)
    if (distance < 0.5) return 1
    if (distance < 1.5) return 0.6
    return 0.3
  }

  // Use a state to trigger re-render for opacity updates during scroll
  const [, setScrollTick] = React.useState(0)
  const handleScrollWithOpacity = React.useCallback(() => {
    handleScroll()
    setScrollTick((t) => t + 1)
  }, [handleScroll])

  // Padding items: half the visible height minus one item
  const padCount = Math.floor(VISIBLE_ITEMS / 2)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {label}
      </div>
      <div className="relative" style={{ height: COLUMN_HEIGHT }}>
        {/* Highlight band behind the center item */}
        <div
          className="pointer-events-none absolute left-0 right-0 z-0 rounded-lg bg-accent/30"
          style={{
            top: padCount * ITEM_HEIGHT,
            height: ITEM_HEIGHT,
          }}
        />
        <div
          ref={containerRef}
          className="relative z-10 h-full w-[60px] overflow-y-auto scrollbar-none"
          style={{
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
          onScroll={handleScrollWithOpacity}
        >
          {/* Top padding */}
          {Array.from({ length: padCount }).map((_, i) => (
            <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}

          {items.map((item, index) => {
            const isSelected = item === selected
            return (
              <button
                key={item}
                type="button"
                className={cn(
                  "flex w-full items-center justify-center font-mono text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground rounded-lg font-semibold"
                    : "text-foreground"
                )}
                style={{
                  height: ITEM_HEIGHT,
                  scrollSnapAlign: "center",
                  opacity: getItemOpacity(index),
                }}
                onClick={() => {
                  onSelect(item)
                  // Scroll to center the clicked item
                  containerRef.current?.scrollTo({
                    top: index * ITEM_HEIGHT,
                    behavior: "smooth",
                  })
                }}
              >
                {item}
              </button>
            )
          })}

          {/* Bottom padding */}
          {Array.from({ length: padCount }).map((_, i) => (
            <div key={`pad-bot-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Scroll-wheel time picker with two drum-roller columns (hours + minutes).
 * Full minute resolution (00-59). "Done" button to close.
 */
function TimePicker({
  value,
  onChange,
  onClear,
  disabled,
  className,
}: TimePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  // Parse current value - null means no selection
  const [selectedHour, selectedMinute] = React.useMemo<[string | null, string | null]>(() => {
    if (!value) return [null, null]
    const [h, m] = value.split(":")
    return [h || null, m || null]
  }, [value])

  // Internal state for scroll position (may differ from committed value before "Done")
  const [pendingHour, setPendingHour] = React.useState<string | null>(selectedHour)
  const [pendingMinute, setPendingMinute] = React.useState<string | null>(selectedMinute)

  // Sync internal state when popover opens
  React.useEffect(() => {
    if (open) {
      setPendingHour(selectedHour ?? "12")
      setPendingMinute(selectedMinute ?? "00")
    }
  }, [open, selectedHour, selectedMinute])

  const handleDone = () => {
    if (pendingHour != null && pendingMinute != null) {
      onChange?.(`${pendingHour}:${pendingMinute}`)
    }
    setOpen(false)
  }

  const displayValue = value || null

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={t("common.pickDate", "Pick a time")}
            aria-disabled={disabled}
            className={cn(
              "border-input flex h-10 w-full cursor-pointer items-center rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-colors md:text-sm",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "outline-none",
              disabled && "pointer-events-none cursor-not-allowed opacity-50",
              !displayValue && "text-muted-foreground",
              className
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setOpen(true)
              }
            }}
          >
            <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-mono">
              {displayValue || "HH:MM"}
            </span>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <div className="flex flex-col items-center p-4 space-y-3">
            {/* Header: current selection */}
            <div className="text-2xl font-mono tracking-tight">
              <span className="text-foreground">{pendingHour ?? "--"}</span>
              <span className="text-muted-foreground/40">:</span>
              <span className="text-foreground">{pendingMinute ?? "--"}</span>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Scroll columns */}
            <div className="flex gap-6">
              <ScrollColumn
                items={HOURS}
                selected={pendingHour}
                onSelect={setPendingHour}
                label={t("common.hours", "Hr")}
              />
              <ScrollColumn
                items={MINUTES}
                selected={pendingMinute}
                onSelect={setPendingMinute}
                label={t("common.minutes", "Min")}
              />
            </div>

            {/* Done button */}
            <Button
              type="button"
              className="w-full"
              onClick={handleDone}
            >
              {t("common.done", "Done")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear button */}
      {value && onClear && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Clear time"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
TimePicker.displayName = "TimePicker"

export { TimePicker }
