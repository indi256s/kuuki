'use client'
import { ArrowUpDown } from '@keyline-icons/react'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { ChoiceOptions, searchChoices, type Choice } from '../ui/combobox'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import type { Locale } from '../../lib/format'

const ENDS = ['origin', 'destination'] as const
export type RouteEnd = (typeof ENDS)[number]
/** Opens the search on one end, e.g. To after the Onward shortcut fills From. */
export type RouteControl = { open: (end: RouteEnd) => void }

const words = {
  en: {
    route: 'Route',
    origin: 'From',
    destination: 'To',
    empty: 'city or airport',
    pickOrigin: 'From airport',
    pickDestination: 'To airport',
    choose: 'Choose airport',
    swap: 'Swap airports',
    close: 'Close search',
  },
  ru: {
    route: 'Маршрут',
    origin: 'Откуда',
    destination: 'Куда',
    empty: 'город или аэропорт',
    pickOrigin: 'Аэропорт вылета',
    pickDestination: 'Аэропорт прилёта',
    choose: 'Выберите аэропорт',
    swap: 'Поменять аэропорты местами',
    close: 'Закрыть поиск',
  },
}

/**
 * The route as one card: two airport rows that open a single From→To search. Choosing From moves on to To while To is
 * empty; choosing To returns to the form. Only an explicit choice sets an airport: typing or leaving the search never does.
 */
export function RouteCard({
  origin,
  destination,
  onPick,
  onSwap,
  choices,
  recents,
  locale,
  errors,
  disabled,
  endRefs,
  controlRef,
}: {
  origin: string
  destination: string
  onPick: (end: RouteEnd, code: string) => void
  onSwap: () => void
  choices: Choice[]
  recents: string[]
  locale: Locale
  errors: Partial<Record<RouteEnd, string>>
  disabled?: boolean
  endRefs: Record<RouteEnd, Ref<HTMLButtonElement>>
  controlRef?: Ref<RouteControl>
}) {
  const id = useId()
  const t = words[locale === 'ru' ? 'ru' : 'en']
  const mobile = useMobile() === true
  const [picking, setPicking] = useState<RouteEnd | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const buttons = useRef<Partial<Record<RouteEnd, HTMLButtonElement | null>>>({})
  // The row focus returns to when the search closes.
  const last = useRef<RouteEnd>('origin')
  const values = { origin, destination }
  const place = (code: string) => {
    const choice = choices.find((row) => row.code === code)
    return {
      city: choice?.detail ?? choice?.label ?? code,
      airport: choice?.detail ? choice.label : '',
    }
  }
  const { needle, all, matches } = useMemo(
    () =>
      picking ? searchChoices(choices, query, recents) : { needle: '', all: choices, matches: [] },
    [picking, choices, query, recents],
  )

  const pickEnd = (end: RouteEnd) => {
    last.current = end
    setPicking(end)
    setQuery('')
    setActive(0)
  }
  const open = (end: RouteEnd) => {
    if (!disabled) pickEnd(end)
  }
  // Desktop focuses the search once it renders; the mobile sheet focuses it through initialFocusRef.
  useEffect(() => {
    if (picking && !mobile) searchRef.current?.focus()
  }, [picking, mobile])
  useImperativeHandle(controlRef, () => ({ open }))
  const close = (focusEnd: RouteEnd | null) => {
    setPicking(null)
    setQuery('')
    if (focusEnd) requestAnimationFrame(() => buttons.current[focusEnd]?.focus())
  }
  const choose = (choice: Choice) => {
    if (!picking) return
    onPick(picking, choice.code)
    last.current = picking
    if (picking === 'origin' && !destination) {
      pickEnd('destination')
      searchRef.current?.focus()
    } else close(picking)
  }
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) =>
        Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      )
    } else if (event.key === 'Enter') {
      // Never submits the form; Enter takes the highlighted result only.
      event.preventDefault()
      if (matches[active]) choose(matches[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(picking)
    }
  }
  const label = picking === 'destination' ? t.pickDestination : t.pickOrigin

  const picker = picking && (
    <>
      <div className="route-picker-ends">
        {ENDS.map((end) => (
          <button
            type="button"
            key={end}
            aria-pressed={picking === end}
            onClick={() => {
              pickEnd(end)
              searchRef.current?.focus()
            }}
          >
            <small>{t[end]}</small>
            <span>{values[end] ? `${place(values[end]).city} · ${values[end]}` : t.choose}</span>
          </button>
        ))}
      </div>
      <div className="flight-search-input">
        <input
          ref={searchRef}
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={matches[active] ? `${id}-option-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={keydown}
        />
      </div>
      <ChoiceOptions
        id={id}
        label={label}
        locale={locale}
        count={all.length}
        matches={matches}
        needle={needle}
        active={active}
        onChoose={choose}
      />
    </>
  )

  const describedBy = (end: RouteEnd) => (errors[end] ? `${id}-${end}-error` : undefined)
  return (
    <div
      className="route-group"
      onBlur={(event) => {
        if (!mobile && picking && !event.currentTarget.contains(event.relatedTarget)) close(null)
      }}
    >
      <fieldset className="route-fieldset" disabled={disabled}>
        <legend>{t.route}</legend>
        <div className="route-card">
          <span className="route-spine" aria-hidden="true" />
          {ENDS.map((end) => {
            const code = values[end]
            const where = code ? place(code) : null
            return (
              <button
                type="button"
                key={end}
                className="route-end"
                data-end={end}
                data-empty={code ? undefined : 'true'}
                data-swap={origin && destination ? 'true' : undefined}
                ref={(node) => {
                  buttons.current[end] = node
                  const ref = endRefs[end]
                  if (typeof ref === 'function') ref(node)
                  else if (ref) ref.current = node
                }}
                aria-label={`${t[end]}: ${where ? `${where.city}, ${code}` : t.empty}`}
                aria-expanded={picking === end}
                data-invalid={errors[end] ? 'true' : undefined}
                aria-describedby={describedBy(end)}
                onClick={() => (picking === end ? close(null) : open(end))}
              >
                <span className="route-marker" aria-hidden="true" />
                {where ? (
                  <>
                    <span className="route-place">
                      <span className="route-city">{where.city}</span>
                      {where.airport && <span className="route-airport">{where.airport}</span>}
                    </span>
                    <span className="route-code">{code}</span>
                  </>
                ) : (
                  <span className="route-empty">
                    {t[end]}: {t.empty}
                  </span>
                )}
              </button>
            )
          })}
          {origin && destination && (
            <button
              type="button"
              className="route-swap capture-swap"
              aria-label={t.swap}
              onClick={onSwap}
            >
              <span>
                <ArrowUpDown size={18} strokeWidth={2} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </fieldset>
      {ENDS.map(
        (end) =>
          errors[end] && (
            <p key={end} id={`${id}-${end}-error`} role="alert" className="route-error">
              {errors[end]}
            </p>
          ),
      )}
      {!mobile && picking && (
        <div className="flight-search-popover flight-search-sheet route-picker">{picker}</div>
      )}
      {mobile && (
        <Sheet
          initialDetent={1}
          open={!!picking}
          onOpenChange={(next) => {
            if (!next) close(null)
          }}
          title={label}
          initialFocusRef={searchRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            buttons.current[last.current]?.focus()
          }}
          closeLabel={t.close}
          className="flight-search-sheet flight-full-sheet route-picker"
        >
          {picker}
        </Sheet>
      )}
    </div>
  )
}
