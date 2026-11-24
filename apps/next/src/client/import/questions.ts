import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import {
  isDuplicate,
  localToday,
  LOW_CONFIDENCE,
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
export function monthDayOf(draft: Draft): { month: number; day: number } | null {
  const match = MONTH_DAY.exec(
    draft.fields.date_month_day ??
      (!draft.yearExplicit && !draft.yearConfirmed ? draft.fields.date?.slice(5) : '') ??
      '',
  )
  if (!match) return null
  const [month, day] = [Number(match[1]), Number(match[2])]
  const probe = new Date(Date.UTC(2000, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day ? { month, day } : null
}

export function ordinalOf(draft: Draft): number | null {
  const day = draft.fields.date_ordinal_day
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 366 ? day : null
}

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
  !draft.yearExplicit && !draft.yearConfirmed && evidenceOf(draft) !== null
const needsAirline = (draft: Draft) =>
  draft.fields.airline_was_placeholder === true && draft.fields.airline_iata === 'ZZ'
const optionsFor = (draft: Draft, endpoint: Endpoint) => draft.fields[`${endpoint}_options`] ?? []
const needsAirport = (draft: Draft, endpoint: Endpoint) =>
  !draft.fields[endpoint] && optionsFor(draft, endpoint).length > 0
const needsStatus = (draft: Draft) => draft.fields.review_required === true && !draft.selected

export function openCauses(draft: Draft, today: string = localToday()): Question['kind'][] {
  const causes: Question['kind'][] = []
  if (needsYear(draft)) causes.push('year')
  if (needsFlown(draft, today)) causes.push('flown')
  if (needsAirline(draft)) causes.push('airline')
  if (needsAirport(draft, 'origin') || needsAirport(draft, 'destination')) causes.push('airport')
  if (needsStatus(draft)) causes.push('status')
  return causes
}

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

const lateYear = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal >= 305 : evidence.month >= 11
const earlyYear = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal <= 60 : evidence.month <= 2
const secondHalf = (evidence: DayEvidence) =>
  'ordinal' in evidence ? evidence.ordinal >= 183 : evidence.month >= 7

function splitAcrossNewYear(drafts: Draft[]): Draft[][] {
  const days = drafts.map((draft) => evidenceOf(draft)!)
  if (!(days.some(lateYear) && days.some(earlyYear))) return [drafts]
  return [
    drafts.filter((draft) => secondHalf(evidenceOf(draft)!)),
    drafts.filter((draft) => !secondHalf(evidenceOf(draft)!)),
  ]
}

export function buildQuestions(drafts: Draft[], today: string): Question[] {
  const review = [...drafts]
    .filter((draft) => draft.status === 'review')
    .sort((a, b) => a.ordinal - b.ordinal)
  const open = review.filter((draft) => !isDuplicate(draft))
  const questions: Question[] = []

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

export const questionDrafts = (question: Question): Draft[] =>
  question.kind === 'airport'
    ? [...new Map(question.items.map((item) => [item.draft.id, item.draft])).values()]
    : question.drafts

export const needCount = (drafts: Draft[], today: string) =>
  new Set(
    buildQuestions(drafts, today).flatMap((question) =>
      questionDrafts(question).map((draft) => draft.id),
    ),
  ).size

const REQUIRED: FieldName[] = ['date', 'origin', 'destination', 'airline_iata']

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
  if (after.confidence !== null && after.confidence < LOW_CONFIDENCE) return false
  return !lowFields(draft).some((name) => REQUIRED.includes(name) && !stated.includes(name))
}

const withSelection = (
  draft: Draft,
  change: DraftChange,
  stated: FieldName[],
  today: string,
): DraftChange =>
  !draft.selected && !isDuplicate(draft) && readyAfter(draft, change, stated, today)
    ? { ...change, selected: true }
    : change

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

export const answerNoAirline = (draft: Draft, today: string = localToday()): DraftChange =>
  withSelection(draft, { fields: { airline_iata: null } }, ['airline_iata'], today)

export const answerAirport = (
  draft: Draft,
  endpoint: Endpoint,
  code: string,
  today: string = localToday(),
): DraftChange => withSelection(draft, { fields: { [endpoint]: code } }, [endpoint], today)

export const answerTookFlight = (draft: Draft, today: string = localToday()): DraftChange =>
  withSelection(draft, { flownConfirmed: true }, [], today)

export const answerFlown = (): DraftChange => ({ selected: true })
export const answerNotFlown = (): DraftChange => ({ dismissed: true })
export const answerRestore = (): DraftChange => ({ dismissed: false })
