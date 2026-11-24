import type { RefObject } from 'react'
import type { Locale } from '../../lib/format'

export const WELCOME_STEPS = ['name', 'flights', 'review', 'ready'] as const
export type WelcomeStep = (typeof WELCOME_STEPS)[number]

export type FactFlight = {
  date: string
  origin: string
  destination: string
  upcoming: boolean
}

export type WelcomeInit = {
  ownerId: string
  step: WelcomeStep
  displayName: string
  username: string | null
  batch: string | null
  manual: boolean
  saved: FactFlight[] | null
  jobs: boolean
}

export type Found = {
  flights: number
  countries: string[]
  km?: number
  since?: number
}

export type PassportPreview = {
  step: WelcomeStep
  name: string
  found: Found
  open: boolean
  reading: boolean
}

export type StepProps = {
  locale: Locale
  ownerId: string
  headingRef: RefObject<HTMLHeadingElement | null>
}

export type SavedSummary = { flights: FactFlight[]; leftOut: number }
