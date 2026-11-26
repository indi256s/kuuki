'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Locale } from '../../lib/format'
import { airportChoices } from '../capture/reference-choices'
import { ChoiceOptions, searchChoices, useListClaimsEscape, type Choice } from '../ui/combobox'
import { Sheet } from '../ui/sheet'
import type { Endpoint } from './questions'
import { R } from './route-copy'

export function AirportPicker({
  locale,
  endpoint,
  query: initialQuery,
  mobile,
  onPick,
  onClose,
  onCloseAutoFocus,
}: {
  locale: Locale
  endpoint: Endpoint | null
  query: string
  mobile: boolean
  onPick: (endpoint: Endpoint, code: string) => void
  onClose: (restoreFocus: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const id = useId()
  const [query, setQuery] = useState(initialQuery)
  const [seen, setSeen] = useState<Endpoint | null>(null)
  const [active, setActive] = useState(0)
  const [last, setLast] = useState<Endpoint | null>(null)
  if (endpoint !== seen) {
    setSeen(endpoint)
    if (endpoint) {
      setLast(endpoint)
      setQuery(initialQuery)
      setActive(0)
    }
  }
  const shown = endpoint ?? (mobile ? last : null)
  const searchRef = useRef<HTMLInputElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const choices = airportChoices(locale)
  const { needle, all, matches } = useMemo(
    () => (shown ? searchChoices(choices, query) : { needle: '', all: choices, matches: [] }),
    [shown, choices, query],
  )
  useEffect(() => {
    if (!endpoint || mobile) return
    searchRef.current?.focus()
    searchRef.current?.select()
    popover.current?.scrollIntoView?.({ block: 'nearest' })
  }, [endpoint, mobile])
  useListClaimsEscape(Boolean(endpoint) && !mobile, () => onClose(true))
  const label = shown === 'destination' ? R.to[locale] : R.from[locale]
  const choose = (choice: Choice) => {
    if (endpoint) onPick(endpoint, choice.code)
  }
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) =>
        Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (matches[active]) choose(matches[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose(true)
    }
  }
  const body = shown ? (
    <>
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
          placeholder={R.search[locale]}
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
  ) : null

  if (mobile)
    return (
      <Sheet
        initialDetent={1}
        open={Boolean(endpoint)}
        onOpenChange={(next) => {
          if (!next) onClose(false)
        }}
        title={label}
        initialFocusRef={searchRef}
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel={R.closeSearch[locale]}
        className="flight-search-sheet flight-full-sheet route-picker"
      >
        {body}
      </Sheet>
    )
  return endpoint ? (
    <div
      ref={popover}
      className="flight-search-popover flight-search-sheet route-picker leg-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose(false)
      }}
    >
      {body}
    </div>
  ) : null
}
