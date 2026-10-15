'use client'
import { CalendarDays, ChevronLeft, ChevronRight } from '@keyline-icons/react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Variants,
} from 'motion/react'
import { addDays } from '@kuuki/shared/calendar'
import { DAY_MS, dayToEpoch, epochToDay } from '@kuuki/shared/overview/range'
import { formatDateOnly, formatMonthYear, type Locale } from '../../lib/format'
import './flight-controls.css'

function normalize(text: string, locale: Locale) {
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text)
  return match
    ? `${match[3]}-${locale === 'ru' ? match[2] : match[1]}-${locale === 'ru' ? match[1] : match[2]}`
    : text
}
function todayLabel() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
/** Same day number in another month, clamped to the last day of a shorter month (Jan 31 + 1 month = Feb 28). */
function addMonths(day: string, delta: number) {
  const [year, month, date] = day.split('-').map(Number)
  const target = new Date(0)
  target.setUTCFullYear(year, month - 1 + delta, 1)
  if (target.getUTCFullYear() < 0 || target.getUTCFullYear() > 9999) return day
  const end = new Date(target)
  end.setUTCMonth(target.getUTCMonth() + 1, 0)
  const last = end.getUTCDate()
  return `${String(target.getUTCFullYear()).padStart(4, '0')}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(date, last)).padStart(2, '0')}`
}
/** Months sit side by side on one strip (after free Arc's calendar). Rapid clicks retarget the same spring, so panes never queue. */
const STRIP_SPRING = { type: 'spring', visualDuration: 0.3, bounce: 0, restDelta: 0.002 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const
/** The title crosses in place: the old month leaves toward the side the strip travels to (read at exit through `custom`). */
const TITLE_SLIDE: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -12,
    transition: { duration: 0.14, ease: EASE_OUT },
  }),
}
const TITLE_SWAP: Variants = {
  enter: { opacity: 1, x: 0 },
  center: { opacity: 1, x: 0, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
const fromIndex = (index: number) =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`

/** One month on the strip. Only the month being navigated to is exposed and focusable; the one sliding past is inert. */
function MonthPane({
  index,
  position,
  present,
  children,
}: {
  index: number
  position: MotionValue<number>
  present: boolean
  children: ReactNode
}) {
  const x = useTransform(
    position,
    (value) => `calc(${(index - value) * 100}% + ${(index - value) * 16}px)`,
  )
  const opacity = useTransform(position, (value) => 1 - Math.min(1, Math.abs(index - value)) * 0.6)
  return (
    <motion.div
      className="flight-calendar-pane"
      style={{ x, opacity }}
      data-present={present || undefined}
      aria-hidden={present ? undefined : true}
      inert={!present}
    >
      {children}
    </motion.div>
  )
}

function valid(value: string) {
  return dayToEpoch(value) !== null
}
function readableDate(locale: Locale, value: string) {
  const parts = new Intl.DateTimeFormat(locale === 'ru' ? 'ru' : 'en-GB', {
    day: 'numeric',
    month: locale === 'ru' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(dayToEpoch(value)!))
  return ['day', 'month', 'year']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join(' ')
}
export function Calendar({
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  locale,
  error,
  disabled,
  defaultOpen = false,
  inline = false,
  weekStartsOn = locale === 'ru' ? 1 : 0,
  displayFormat = 'short',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  locale: Locale
  error?: string
  disabled?: boolean
  /** Shows the month grid on mount (the member just chose to pick a day). */
  defaultOpen?: boolean
  /** The grid flows in the page instead of floating over it. */
  inline?: boolean
  /** Explicit week start; otherwise follows the locale. */
  weekStartsOn?: 0 | 1
  /** Readable dates remain replaceable with numeric or ISO input. */
  displayFormat?: 'short' | 'readable'
}) {
  const id = useId()
  const [draft, setDraft] = useState<{ value: string; text: string } | null>(null)
  const displayValue = valid(value)
    ? displayFormat === 'readable'
      ? readableDate(locale, value)
      : formatDateOnly(locale, value, 'short')
    : value
  const [open, setOpen] = useState(defaultOpen)
  const [month, setMonth] = useState(() =>
    valid(value)
      ? value.slice(0, 7)
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  )
  const popover = useRef<HTMLDivElement>(null)
  const weeksOf = (paneMonth: string) => {
    const first = dayToEpoch(`${paneMonth}-01`)!
    const start = first - ((new Date(first).getUTCDay() - weekStartsOn + 7) % 7) * DAY_MS
    const days = Array.from({ length: 42 }, (_, index) => epochToDay(start + index * DAY_MS))
    return Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7))
  }
  // The strip position is measured in months: the panes either side of it render, plus the month being navigated to.
  const reduced = useReducedMotion() ?? false
  const target = monthIndex(month)
  const position = useMotionValue(target)
  const [span, setSpan] = useState<[number, number]>([target, target])
  useMotionValueEvent(position, 'change', (value) => {
    const next: [number, number] = [Math.floor(value + 1e-3), Math.ceil(value - 1e-3)]
    setSpan((current) => (current[0] === next[0] && current[1] === next[1] ? current : next))
  })
  // Direction is read from the month itself, so arrows, keys and a typed date all travel the same way.
  const [shown, setShown] = useState({ target, direction: 0 })
  if (shown.target !== target) setShown({ target, direction: target > shown.target ? 1 : -1 })
  useLayoutEffect(() => {
    const from = position.get()
    if (from === target) return
    // Opening the grid and reduced motion land in place; month changes slide. Long jumps start one month away.
    if (!open || reduced) {
      position.jump(target)
      return
    }
    if (Math.abs(target - from) > 2) position.jump(target - Math.sign(target - from))
    const controls = animate(position, target, STRIP_SPRING)
    return () => controls.stop()
  }, [open, target, reduced, position])
  const panes = [...new Set([span[0], span[1], target])].sort((a, b) => a - b)
  const shiftMonth = (delta: number) => {
    setMonth(addMonths(`${month}-01`, delta).slice(0, 7))
  }
  const [focusTarget, setFocusTarget] = useState<{ day: string } | null>(null)
  // Focus after the target month has rendered, so a move across a month edge lands on a mounted button.
  useEffect(() => {
    if (focusTarget)
      popover.current
        ?.querySelector<HTMLButtonElement>(`[data-present] [data-day="${focusTarget.day}"]`)
        ?.focus({ preventScroll: true })
  }, [focusTarget])
  // An inline grid opens inside a scrolling host; bring it into view instead of leaving it below the fold.
  useEffect(() => {
    if (open && inline) popover.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open, inline])
  const focusDay = (day: string) => {
    if (valid(day)) {
      setMonth(day.slice(0, 7))
      setFocusTarget({ day })
    }
  }
  const today = todayLabel()
  const headingId = `${id}-heading`
  // Use the same week start for the headers, grid and Home/End navigation.
  const weekOffset = (day: string) =>
    (new Date(dayToEpoch(day)!).getUTCDay() - weekStartsOn + 7) % 7
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const target = (
      {
        ArrowLeft: addDays(day, -1),
        ArrowRight: addDays(day, 1),
        ArrowUp: addDays(day, -7),
        ArrowDown: addDays(day, 7),
        Home: addDays(day, -weekOffset(day)),
        End: addDays(day, 6 - weekOffset(day)),
        PageUp: addMonths(day, event.shiftKey ? -12 : -1),
        PageDown: addMonths(day, event.shiftKey ? 12 : 1),
      } as Record<string, string>
    )[event.key]
    if (target) {
      event.preventDefault()
      focusDay(target)
    }
  }
  return (
    <div
      className="flight-calendar"
      data-inline={inline ? 'true' : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="flight-date-input">
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY'}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          disabled={disabled}
          value={draft?.value === value ? draft.text : displayValue}
          onFocus={(event) => {
            if (displayFormat === 'readable') event.currentTarget.select()
          }}
          onChange={(event) => {
            const text = event.target.value
            const normalized = normalize(text, locale)
            if (displayFormat === 'readable') setDraft({ value: normalized, text })
            onChange(normalized)
          }}
          onBlur={() => {
            setDraft(null)
            onBlur?.()
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          aria-label={locale === 'ru' ? 'Календарь' : 'Calendar'}
          onClick={() => {
            if (valid(value)) setMonth(value.slice(0, 7))
            setOpen(!open)
          }}
        >
          <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <small id={`${id}-hint`}>
        {locale === 'ru' ? 'ДД.ММ.ГГГГ или ГГГГ-ММ-ДД' : 'MM/DD/YYYY or YYYY-MM-DD'}
      </small>
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      {open && (
        <div
          id={`${id}-calendar`}
          ref={popover}
          className="flight-calendar-popover"
          role="group"
          aria-label={locale === 'ru' ? 'Выберите дату' : 'Choose date'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              document.getElementById(id)?.focus()
            }
          }}
        >
          <div className="flight-calendar-heading">
            <strong id={headingId} className="flight-calendar-title">
              <span className="sr-only" aria-live="polite">
                {formatMonthYear(locale, `${month}-01`)}
              </span>
              {/* Old and new titles share one cell while they cross, so the heading never jumps. */}
              <span aria-hidden="true">
                <AnimatePresence initial={false} custom={shown.direction}>
                  <motion.span
                    key={month}
                    custom={shown.direction}
                    variants={reduced ? TITLE_SWAP : TITLE_SLIDE}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {formatMonthYear(locale, `${month}-01`)}
                  </motion.span>
                </AnimatePresence>
              </span>
            </strong>
            <button
              type="button"
              aria-label={locale === 'ru' ? 'Предыдущий месяц' : 'Previous month'}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={locale === 'ru' ? 'Следующий месяц' : 'Next month'}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div role="grid" aria-labelledby={headingId} className="flight-calendar-grid">
            <div role="row" className="flight-calendar-week">
              {(locale === 'ru'
                ? ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
                : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              ).map((_, index, weekdays) => (
                <small role="columnheader" key={index}>
                  {weekdays[(index + weekStartsOn) % 7]}
                </small>
              ))}
            </div>
            <div className="flight-calendar-viewport">
              {panes.map((pane) => {
                const paneMonth = fromIndex(pane)
                const present = pane === target
                return (
                  <MonthPane key={pane} index={pane} position={position} present={present}>
                    {weeksOf(paneMonth).map((week, index) => (
                      <div role="row" className="flight-calendar-week" key={index}>
                        {week.map((day, index) =>
                          day === null ? (
                            <div role="gridcell" key={index} />
                          ) : (
                            <div role="gridcell" key={day} aria-selected={day === value}>
                              <button
                                data-day={day}
                                data-outside={!day.startsWith(paneMonth)}
                                type="button"
                                aria-label={formatDateOnly(locale, day, 'long')}
                                aria-current={day === today ? 'date' : undefined}
                                tabIndex={
                                  present &&
                                  day ===
                                    (valid(value) && value.startsWith(month)
                                      ? value
                                      : `${month}-01`)
                                    ? 0
                                    : -1
                                }
                                onClick={() => {
                                  onChange(day)
                                  setOpen(false)
                                  document.getElementById(id)?.focus()
                                }}
                                onKeyDown={(event) => moveFocus(event, day)}
                              >
                                <span>{Number(day.slice(-2))}</span>
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    ))}
                  </MonthPane>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
