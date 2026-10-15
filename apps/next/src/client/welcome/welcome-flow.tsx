'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '../../lib/format'
import { FlightsStep } from './flights/flights-step'
import { foundOf } from './found'
import { morph, type MorphDirection } from './morph'
import { NameStep } from './name-step'
import { ReadyStep } from './ready/ready-step'
import { ReviewStep } from './review/review-step'
import {
  WELCOME_STEPS,
  type FactFlight,
  type Found,
  type PassportPreview,
  type SavedSummary,
  type WelcomeInit,
  type WelcomeStep,
} from './types'

/** The reveal's passport counts only flights already flown; a booked one has no stamp yet. */
const flownOf = (flights: FactFlight[]) => foundOf(flights.filter((flight) => !flight.upcoming))

/** A step change, or opening and closing the one-flight form, is a move worth morphing. */
const moves = (from: Place, to: Place) => from.step !== to.step || from.manual !== to.manual

const directionOf = (from: Place, to: Place): MorphDirection =>
  WELCOME_STEPS.indexOf(to.step) < WELCOME_STEPS.indexOf(from.step) ||
  (to.step === from.step && from.manual && !to.manual)
    ? 'back'
    : 'forward'

type Place = { step: WelcomeStep; batch: string | null; manual: boolean }

export const welcomeUrl = ({ step, batch, manual }: Place) => {
  const query = new URLSearchParams()
  if (batch && (step === 'flights' || step === 'review')) query.set('batch', batch)
  if (manual && step === 'flights') query.set('manual', '1')
  const search = query.toString()
  return `/welcome/${step}${search ? `?${search}` : ''}`
}

/** The step a `/welcome/*` URL names, or null outside onboarding. */
export function placeOf(location: Pick<Location, 'pathname' | 'search'>): Place | null {
  const match = /^\/welcome\/([a-z]+)\/?$/.exec(location.pathname)
  const step = match?.[1] as WelcomeStep | undefined
  if (!step || !WELCOME_STEPS.includes(step)) return null
  const query = new URLSearchParams(location.search)
  return { step, batch: query.get('batch'), manual: query.get('manual') === '1' }
}

/**
 * Onboarding inside the auth card: name → flights → review → ready. Each step has its own URL, pushed with
 * `history.pushState` so the card (and this component) stay mounted; Back replays the step from `popstate`.
 * The brand side follows through `onPassport`. `onFinish` records onboarding as done and dissolves the card.
 */
export function WelcomeFlow({
  init,
  locale,
  onPassport,
  onFinish,
}: {
  init: WelcomeInit
  locale: Locale
  onPassport: (preview: PassportPreview) => void
  onFinish: () => Promise<void>
}) {
  const [place, setPlace] = useState<Place>({
    step: init.step,
    batch: init.batch,
    manual: init.manual,
  })
  // No direction on the first render: a reload or resume shows its step in place, without sliding it in.
  const [direction, setDirection] = useState<MorphDirection | null>(null)
  const [name, setName] = useState(init.displayName)
  const [address, setAddress] = useState(init.username)
  const [found, setFound] = useState<Found>(() =>
    init.saved ? flownOf(init.saved) : { flights: 0, countries: [] },
  )
  const [summary, setSummary] = useState<SavedSummary | null>(() =>
    init.saved ? { flights: init.saved, leftOut: 0 } : null,
  )
  const [reading, setReading] = useState(false)
  // Review was entered straight from a finished read in this session. Not in the URL: a reload or Back is not fresh.
  const [fresh, setFresh] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const entered = useRef(false)

  useEffect(() => {
    onPassport({
      step: place.step,
      name,
      found,
      open: place.step !== 'name',
      reading: place.step === 'flights' && reading,
    })
  }, [name, found, place.step, reading, onPassport])

  // Focus the step's heading whenever a step is entered, but not on the first render of a reload.
  useEffect(() => {
    if (entered.current) heading.current?.focus()
    entered.current = true
  }, [place.step])

  useEffect(() => {
    const onPop = () => {
      const next = placeOf(window.location)
      // Back past the name step lands on the entry URL: the account exists, so never show the create step again.
      if (!next)
        return window.location.replace(welcomeUrl({ step: 'name', batch: null, manual: false }))
      const way = directionOf(place, next)
      const apply = () => {
        setFresh(false)
        setDirection(way)
        setPlace(next)
      }
      if (moves(place, next)) morph(way, apply)
      else apply()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [place])

  /** Moves to a place; a new step (or the one-flight form) morphs the card, a URL-only change applies in place. */
  const go = (next: Place, how: 'push' | 'replace' = 'push', alongside?: () => void) => {
    const url = welcomeUrl(next)
    const way = directionOf(place, next)
    const apply = () => {
      alongside?.()
      if (how === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(window.history.state, '', url)
      setDirection(way)
      setPlace(next)
    }
    if (moves(place, next)) morph(way, apply)
    else apply()
  }

  const toReview = (batch: string, auto?: boolean) => {
    setFresh(auto === true)
    go({ step: 'review', batch, manual: false })
  }

  const toReady = (saved: SavedSummary) =>
    go({ step: 'ready', batch: null, manual: false }, 'replace', () => {
      setSummary(saved)
      setFound(flownOf(saved.flights))
    })

  const common = { locale, ownerId: init.ownerId, headingRef: heading }
  return (
    <div
      className="welcome-step"
      data-step={place.step}
      data-direction={direction ?? undefined}
      key={place.step}
    >
      {place.step === 'name' ? (
        <NameStep
          {...common}
          initialName={name}
          initialAddress={address}
          onName={setName}
          onSaved={(saved) => {
            setName(saved.displayName)
            setAddress(saved.username)
            go({ step: 'flights', batch: null, manual: false })
          }}
        />
      ) : place.step === 'flights' ? (
        <FlightsStep
          {...common}
          name={name}
          jobs={init.jobs}
          batch={place.batch}
          manual={place.manual}
          onBatch={(batch) => go({ ...place, batch }, 'replace')}
          onManual={(manual) =>
            go({ step: 'flights', batch: null, manual }, manual ? 'push' : 'replace')
          }
          onReview={toReview}
          onManualSaved={toReady}
          onFound={setFound}
          onReading={setReading}
          onSkip={onFinish}
        />
      ) : place.step === 'review' && place.batch ? (
        <ReviewStep
          {...common}
          batch={place.batch}
          fresh={fresh}
          onSaved={toReady}
          onStartEmpty={onFinish}
          onFound={setFound}
        />
      ) : place.step === 'ready' && summary ? (
        <ReadyStep {...common} summary={summary} onOpen={onFinish} />
      ) : (
        <FlightsStep
          {...common}
          name={name}
          jobs={init.jobs}
          batch={null}
          manual={false}
          onBatch={(batch) => go({ step: 'flights', batch, manual: false }, 'replace')}
          onManual={(manual) => go({ step: 'flights', batch: null, manual }, 'push')}
          onReview={toReview}
          onManualSaved={toReady}
          onFound={setFound}
          onReading={setReading}
          onSkip={onFinish}
        />
      )}
    </div>
  )
}
