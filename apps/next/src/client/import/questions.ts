// Review questions: what holds review rows back, grouped so one answer settles every row with the same cause.
// Questions are derived from the drafts on every render and never stored. An answer is an ordinary draft change, so
// a reload, another tab or an expired batch behaves exactly as it does for row edits, and an answered question is
// simply gone. Kuuki never answers for the member: suggestions are buttons, never defaults.
import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import {
  isDuplicate,
  localToday,
  lowFields,
  needsFlown,
  toValues,
  validateValues,
  withUnsent,
  type FieldName,
} from './review-model'

export { localToday }

export type Endpoint = 'origin' | 'destination'
export interface YearQuestion {
  kind: 'year'
  key: string
  /** What the document printed: a day and month, or the barcode's day of the year. */
  evidence: 'monthDay' | 'ordinal'
  drafts: Draft[]
  years: [number, number]
}
export interface AirlineQuestion {
  kind: 'airline'
  key: 'airline'
  drafts: Draft[]
}
export interface AirportQuestion {
  kind: 'airport'
  key: string
  options: string[]
  items: { draft: Draft; endpoint: Endpoint }[]
}
export interface StatusQuestion {
  kind: 'status'
  key: 'status'
  drafts: Draft[]
}
export interface FlownQuestion {
  kind: 'flown'
  key: 'flown'
  drafts: Draft[]
}
export type Question =
  | YearQuestion
  | FlownQuestion
  | AirlineQuestion
  | AirportQuestion
  | StatusQuestion

const MONTH_DAY = /^(\d{2})-(\d{2})$/
/** A day and month printed without a year, as MM-DD; null when absent or not a real day (29 February is allowed). */
export function monthDayOf(draft: Draft): { month: number; day: number } | null {
  const match = MONTH_DAY.exec(draft.fields.date_month_day ?? '')
  if (!match) return null
  const [month, day] = [Number(match[1]), Number(match[2])]
  const probe = new Date(Date.UTC(2000, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day ? { month, day } : null
}

/** The barcode's day of the year (1–366), kept while the date is empty; null when absent or out of range. */
export function ordinalOf(draft: Draft): number | null {
  const day = draft.fields.date_ordinal_day
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 366 ? day : null
}

/** What a document said about the day without saying the year: a printed day and month, or a day of the year. */
export type DayEvidence = { month: number; day: number } | { ordinal: number }
const evidenceOf = (draft: Draft): DayEvidence | null => {
  const monthDay = monthDayOf(draft)
  if (monthDay) return monthDay
  const ordinal = ordinalOf(draft)
  return ordinal === null ? null : { ordinal }
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateIn = (year: number, { month, day }: { month: number; day: number }) =>
  `${year}-${pad(month)}-${pad(day)}`
const realDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * The calendar date (YYYY-MM-DD) the evidence names in `year`; null when that year has no such day (29 February, or
 * day 366, in a non-leap year). An ordinal day is turned into a month and day only here, with the member's year.
 */
export function dateFor(evidence: DayEvidence, year: number): string | null {
  if ('ordinal' in evidence) {
    const date = new Date(Date.UTC(year, 0, evidence.ordinal))
    return date.getUTCFullYear() === year
      ? `${year}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
      : null
  }
  const value = dateIn(year, evidence)
  return realDate(value) ? value : null
}

const needsYear = (draft: Draft) =>
  !draft.fields.date && !draft.yearExplicit && !draft.yearConfirmed && evidenceOf(draft) !== null
const needsAirline = (draft: Draft) =>
  draft.fields.airline_was_placeholder === true && draft.fields.airline_iata === 'ZZ'
const optionsFor = (draft: Draft, endpoint: Endpoint) => draft.fields[`${endpoint}_options`] ?? []
const needsAirport = (draft: Draft, endpoint: Endpoint) =>
  !draft.fields[endpoint] && optionsFor(draft, endpoint).length > 0
const needsStatus = (draft: Draft) => draft.fields.review_required === true && !draft.selected

/** Causes a question can settle, for one review row. */
export function openCauses(draft: Draft, today: string = localToday()): Question['kind'][] {
  const causes: Question['kind'][] = []
  if (needsYear(draft)) causes.push('year')
  if (needsFlown(draft, today)) causes.push('flown')
  if (needsAirline(draft)) causes.push('airline')
  if (needsAirport(draft, 'origin') || needsAirport(draft, 'destination')) causes.push('airport')
  if (needsStatus(draft)) causes.push('status')
  return causes
}

/**
 * The latest year in which every given day has happened by `today` (plus two days, for a boarding pass issued the
 * day before), and the year before it. These are offered as buttons; neither is preselected.
 */
export function suggestedYears(days: DayEvidence[], today: string): [number, number] {
  const limit = Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000
  let year = Number(today.slice(0, 4)) + 1
  while (
    days.some((day) => {
      const value = dateFor(day, year)
      return value === null || Date.parse(`${value}T00:00:00Z`) > limit
    })
  )
    year--
  return [year, year - 1]
}

/** Where in the calendar year a day falls, as a month (1–12) for printed days and a day of the year for barcodes. */
const lateYear = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal >= 305 : evidence.month >= 11
const earlyYear = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal <= 60 : evidence.month <= 2
const secondHalf = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal >= 183 : evidence.month >= 7

/**
 * Days that straddle New Year (Nov–Dec with Jan–Feb; day 305 onwards with day 60 and before) split into two questions:
 * one year cannot be right for both.
 */
function splitAcrossNewYear(drafts: Draft[]): Draft[][] {
  const days = drafts.map((draft) => evidenceOf(draft)!)
  if (!(days.some(lateYear) && days.some(earlyYear))) return [drafts]
  return [
    drafts.filter((draft) => secondHalf(evidenceOf(draft)!)),
    drafts.filter((draft) => !secondHalf(evidenceOf(draft)!)),
  ]
}

/**
 * Questions for the review rows, largest first. A single row still gets its question: one boarding pass is the common
 * case, and two year buttons beat typing a full date the document already half-printed.
 */
export function buildQuestions(drafts: Draft[], today: string): Question[] {
  const review = [...drafts]
    .filter((draft) => draft.status === 'review')
    .sort((a, b) => a.ordinal - b.ordinal)
  const open = review.filter((draft) => !isDuplicate(draft))
  const questions: Question[] = []

  // Printed days and barcode days of the year are different evidence, so they are asked separately.
  for (const evidence of ['monthDay', 'ordinal'] as const) {
    const withEvidence = open.filter(
      (draft) => needsYear(draft) && 'ordinal' in evidenceOf(draft)! === (evidence === 'ordinal'),
    )
    for (const group of splitAcrossNewYear(withEvidence)) {
      if (group.length === 0) continue
      const first = evidenceOf(group[0])!
      questions.push({
        kind: 'year',
        key: 'ordinal' in first ? `year:day:${first.ordinal}` : `year:${pad(first.month)}`,
        evidence,
        drafts: group,
        years: suggestedYears(
          group.map((draft) => evidenceOf(draft)!),
          today,
        ),
      })
    }
  }

  // The date is known by now (a row without one is still on its year question), so this asks only what is left.
  // A duplicate is asked too: its "Save anyway" stays blocked until the flight is confirmed, and only the member can
  // acknowledge the duplicate itself.
  const flown = review.filter((draft) => needsFlown(draft, today))
  if (flown.length > 0) questions.push({ kind: 'flown', key: 'flown', drafts: flown })

  const airline = open.filter(needsAirline)
  if (airline.length > 0) questions.push({ kind: 'airline', key: 'airline', drafts: airline })

  const airports = new Map<string, AirportQuestion>()
  for (const draft of open)
    for (const endpoint of ['origin', 'destination'] as const) {
      if (!needsAirport(draft, endpoint)) continue
      const options = optionsFor(draft, endpoint)
      const key = `airport:${[...options].sort().join(',')}`
      const question = airports.get(key) ?? { kind: 'airport' as const, key, options, items: [] }
      question.items.push({ draft, endpoint })
      airports.set(key, question)
    }
  questions.push(...airports.values())

  const status = open.filter(needsStatus)
  if (status.length > 0) questions.push({ kind: 'status', key: 'status', drafts: status })

  const size = (question: Question) =>
    question.kind === 'airport' ? question.items.length : question.drafts.length
  return questions.sort((a, b) => size(b) - size(a))
}

/** Every review row a question touches. */
export const questionDrafts = (question: Question): Draft[] =>
  question.kind === 'airport'
    ? [...new Map(question.items.map((item) => [item.draft.id, item.draft])).values()]
    : question.drafts

/** Review rows still waiting on a question; skipped and answered ones have no open cause left. */
export const needCount = (drafts: Draft[], today: string) =>
  new Set(
    buildQuestions(drafts, today).flatMap((question) =>
      questionDrafts(question).map((draft) => draft.id),
    ),
  ).size

const REQUIRED: FieldName[] = ['date', 'origin', 'destination', 'airline_iata']

/**
 * The row is ready to import once this change lands: nothing left to ask, the shared validator accepts it, and every
 * required field the source was unsure about has now been stated by the member.
 */
function readyAfter(
  draft: Draft,
  change: DraftChange,
  stated: FieldName[],
  today: string,
): boolean {
  const after = withUnsent(draft, change)
  if (openCauses(after, today).length > 0) return false
  if (!after.fields.date || (!after.yearExplicit && !after.yearConfirmed)) return false
  if (Object.keys(validateValues(toValues(after.fields))).length > 0) return false
  return !lowFields(draft).some((name) => REQUIRED.includes(name) && !stated.includes(name))
}

/** Select a row only when the answer made it ready; never unselect one the member chose, or choose a duplicate. */
const withSelection = (
  draft: Draft,
  change: DraftChange,
  stated: FieldName[],
  today: string,
): DraftChange =>
  !draft.selected && !isDuplicate(draft) && readyAfter(draft, change, stated, today)
    ? { ...change, selected: true }
    : change

/** The chosen year's date and the year decision, or null when the year does not have the document's day. */
export const answerYear = (
  draft: Draft,
  year: number,
  today: string = localToday(),
): DraftChange | null => {
  const evidence = evidenceOf(draft)
  const date = evidence ? dateFor(evidence, year) : null
  if (!date) return null
  return withSelection(draft, { fields: { date }, yearConfirmed: true }, ['date'], today)
}

/** The flight is saved without an airline; the member can add one later in the journal. */
export const answerNoAirline = (draft: Draft, today: string = localToday()): DraftChange =>
  withSelection(draft, { fields: { airline_iata: null } }, ['airline_iata'], today)

export const answerAirport = (
  draft: Draft,
  endpoint: Endpoint,
  code: string,
  today: string = localToday(),
): DraftChange => withSelection(draft, { fields: { [endpoint]: code } }, [endpoint], today)

/** «Да, летел(а)»: the member says they took this flight, which a barcode or a date cannot say for them. */
export const answerTookFlight = (draft: Draft, today: string = localToday()): DraftChange =>
  withSelection(draft, { flownConfirmed: true }, [], today)

/** «Летал»: the member vouches for the flight, which is what the source could not. */
export const answerFlown = (): DraftChange => ({ selected: true })
/** «Не летал»: the row is skipped, and can be brought back. */
export const answerNotFlown = (): DraftChange => ({ dismissed: true })
export const answerRestore = (): DraftChange => ({ dismissed: false })
