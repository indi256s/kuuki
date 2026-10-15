import type { RefObject } from 'react'
import type { Locale } from '../../lib/format'

export const WELCOME_STEPS = ['name', 'flights', 'review', 'ready'] as const
export type WelcomeStep = (typeof WELCOME_STEPS)[number]

/** A flight as the reveal counts it: a saved draft's fields, or a saved flight on reload. */
export type FactFlight = {
  date: string
  origin: string
  destination: string
  upcoming: boolean
}

/** What the server knows when it renders a `/welcome/*` URL (reload, resume, or the in-place push after create). */
export type WelcomeInit = {
  ownerId: string
  step: WelcomeStep
  displayName: string
  username: string | null
  /** `?batch=`: the batch being read (flights) or reviewed (review). */
  batch: string | null
  /** `?manual=1` on the flights step: the one-flight form. */
  manual: boolean
  /** On a reload of `ready`: the member's saved flights, so the reveal can be recomputed. */
  saved: FactFlight[] | null
  /** The job worker is bound here: an accepted batch keeps reading after the tab closes. */
  jobs: boolean
}

/** What the flights and review steps have found so far; the passport prints it. */
export type Found = {
  flights: number
  /** ISO 3166-1 alpha-2 codes, pending (decorative) until publication. */
  countries: string[]
  /** Great-circle total, when known. */
  km?: number
  /** Year of the earliest flight, when known. */
  since?: number
}

/** The passport on the brand side follows the step: the cover while naming, the open spread with stamps after. */
export type PassportPreview = {
  step: WelcomeStep
  name: string
  found: Found
  /** The review card is tall; the desktop passport stretches with it. */
  open: boolean
  /** The flights step is reading a batch; on a phone that is when the bench shows. */
  reading: boolean
}

/** Every step gets these; the heading takes focus when the step is entered. */
export type StepProps = {
  locale: Locale
  ownerId: string
  headingRef: RefObject<HTMLHeadingElement | null>
}

/** What a finished save hands to the reveal. */
export type SavedSummary = { flights: FactFlight[]; leftOut: number }
