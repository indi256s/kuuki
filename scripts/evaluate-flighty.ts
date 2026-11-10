// Read-only reconciliation of a Flighty CSV against independently written labels (ADR 0008).
//
//   pnpm exec tsx scripts/evaluate-flighty.ts --input <csv> --expected <labels.json> --output <report.json>
//   pnpm exec tsx scripts/evaluate-flighty.ts --synthetic 10000 --output <report.json>
//
// Local files only: no model, no network, no D1. The report and the console carry counts, categories, ordinals and
// header names, never cell values, so it is safe to run on a private export. The labels are the ground truth; the
// mapper under test never writes them. `--synthetic N` generates N records together with the labels implied by how
// they were generated, to check scale and how many owner decisions a large clean history needs.
import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import {
  FLIGHTY_COLUMN_ROLES,
  FLIGHTY_OBSERVED_HEADERS,
  FLIGHTY_PROFILE,
  FlightyParseError,
  groupFlightyIssues,
  mapFlightyRecord,
  parseFlightyCsv,
  type FlightyCandidate,
  type FlightyObservedHeader,
} from '../packages/shared/src/flighty'
import { catalogFlightyRefs } from '../functions/api/_services/flightyRefs'

type Outcome = 'create' | 'preserve_only' | 'review' | 'error'
interface Label {
  ordinal: number
  line?: number
  outcome: Outcome
  /** `CODE` or `CODE@group`, in mapper order. */
  issues: string[]
  projection: Record<string, unknown>
}
interface Labels {
  columns?: number
  blankLines?: number
  records: Label[]
}

const outcomeOf = (candidate: FlightyCandidate): Outcome =>
  candidate.issues.some((issue) => issue.code === 'EMPTY_RECORD') ? 'error' : candidate.action

function synthetic(count: number): { csv: string; labels: Labels } {
  const routes = [
    ['JFK', 'LHR', 'BAW', 'BA'],
    ['HND', 'HNL', 'JAL', 'JL'],
    ['CDG', 'NCE', 'AFR', 'AF'],
    ['FRA', 'BOS', 'DLH', 'LH'],
    ['AMS', 'OSL', 'KLM', 'KL'],
    ['SVO', 'LED', 'AFL', 'SU'],
  ]
  const header = FLIGHTY_OBSERVED_HEADERS.join(',')
  const lines = [header]
  const records: Label[] = []
  for (let i = 0; i < count; i++) {
    const [from, to, icao, iata] = routes[i % routes.length]
    const day = new Date(Date.UTC(2005, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
    const canceled = i % 50 === 7
    // One recurring code the catalog does not know: a single shared question however many rows carry it.
    const unknownAirline = i % 20 === 3 && !canceled
    const cells = Object.fromEntries(FLIGHTY_OBSERVED_HEADERS.map((name) => [name, ''])) as Record<
      FlightyObservedHeader,
      string
    >
    Object.assign(cells, {
      Date: day,
      Airline: unknownAirline ? 'XQZ' : icao,
      Flight: String(100 + (i % 900)),
      From: from,
      To: to,
      Canceled: canceled ? 'true' : 'false',
      Notes: i % 3 ? '' : `"note ${i}, with comma"`,
      PNR: i % 4 ? '' : `SYN${String(i).padStart(4, '0')}`,
      'Flight Flighty ID': `f-${i}`,
    })
    lines.push(FLIGHTY_OBSERVED_HEADERS.map((name) => cells[name]).join(','))
    records.push({
      ordinal: i,
      outcome: canceled ? 'preserve_only' : unknownAirline ? 'review' : 'create',
      issues: unknownAirline ? ['UNKNOWN_AIRLINE@airline:XQZ'] : [],
      projection: {
        date: day,
        origin: from,
        destination: to,
        airline: canceled || !unknownAirline ? iata : null,
      },
    })
  }
  return { csv: `${lines.join('\n')}\n`, labels: { columns: 33, blankLines: 0, records } }
}

function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      expected: { type: 'string' },
      output: { type: 'string' },
      synthetic: { type: 'string' },
    },
  })
  if (!values.output || (!values.synthetic && (!values.input || !values.expected))) {
    console.error(
      'Usage: evaluate-flighty.ts --input <csv> --expected <labels.json> --output <report.json> | --synthetic <n> --output <report.json>',
    )
    process.exit(2)
  }
  const generated = values.synthetic ? synthetic(Number(values.synthetic)) : null
  const csv = generated?.csv ?? readFileSync(values.input!, 'utf8')
  const labels: Labels =
    generated?.labels ?? (JSON.parse(readFileSync(values.expected!, 'utf8')) as Labels)

  const started = performance.now()
  let doc
  try {
    doc = parseFlightyCsv(csv)
  } catch (error) {
    if (!(error instanceof FlightyParseError)) throw error
    const report = {
      profile: FLIGHTY_PROFILE,
      structuralError: {
        code: error.code,
        line: error.line,
        record: error.record,
        header: error.header,
      },
    }
    writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`structural error ${error.code}; report ${values.output}`)
    process.exit(1)
  }
  const parsedAt = performance.now()
  const candidates = doc.records.map((record) =>
    mapFlightyRecord(record, doc.headers, catalogFlightyRefs),
  )
  const mappedAt = performance.now()

  const outcomes: Record<Outcome, number> = { create: 0, preserve_only: 0, review: 0, error: 0 }
  for (const candidate of candidates) outcomes[outcomeOf(candidate)] += 1

  const labelByOrdinal = new Map(labels.records.map((label) => [label.ordinal, label]))
  const missing = labels.records
    .filter((label) => !candidates[label.ordinal])
    .map((label) => label.ordinal)
  const extra = candidates
    .filter((candidate) => !labelByOrdinal.has(candidate.ordinal))
    .map((c) => c.ordinal)
  const mismatches: Array<{ ordinal: number; category: string; field?: string }> = []
  for (const candidate of candidates) {
    const label = labelByOrdinal.get(candidate.ordinal)
    if (!label) continue
    if (label.line !== undefined && doc.records[candidate.ordinal].line !== label.line)
      mismatches.push({ ordinal: candidate.ordinal, category: 'line' })
    if (outcomeOf(candidate) !== label.outcome)
      mismatches.push({ ordinal: candidate.ordinal, category: 'outcome' })
    const issues = candidate.issues.map((issue) =>
      issue.group ? `${issue.code}@${issue.group}` : issue.code,
    )
    if (JSON.stringify(issues) !== JSON.stringify(label.issues))
      mismatches.push({ ordinal: candidate.ordinal, category: 'issues' })
    for (const [field, expected] of Object.entries(label.projection))
      if (
        JSON.stringify(candidate.projection[field as keyof typeof candidate.projection]) !==
        JSON.stringify(expected)
      )
        mismatches.push({ ordinal: candidate.ordinal, category: 'projection', field })
  }

  // Every cell of an accepted record is kept; this says what else happens to each column.
  const coverage = doc.headers.map((header) => ({
    header,
    role: FLIGHTY_COLUMN_ROLES[header as FlightyObservedHeader] ?? 'unknown_preserved',
    filled: doc.records.filter((record) => record.cells[doc.headers.indexOf(header)].trim() !== '')
      .length,
  }))
  const groups = groupFlightyIssues(candidates)
  const rowQuestions = candidates.filter(
    (candidate) =>
      outcomeOf(candidate) !== 'error' && candidate.issues.some((issue) => !issue.group),
  ).length
  const errors = outcomes.error
  const bytes = new TextEncoder().encode(csv).length
  const recordBytes = doc.records.map(
    (record) => new TextEncoder().encode(JSON.stringify(record.cells)).length,
  )

  const report = {
    profile: FLIGHTY_PROFILE,
    source: generated ? `synthetic:${values.synthetic}` : 'file',
    records: {
      in: doc.records.length,
      labelled: labels.records.length,
      blankLines: doc.blankLines,
    },
    outcomes,
    reconciliation: {
      missing,
      extra,
      mismatches,
      columnsMatchLabels: labels.columns === undefined || labels.columns === doc.headers.length,
      blankLinesMatchLabels:
        labels.blankLines === undefined || labels.blankLines === doc.blankLines,
    },
    columns: {
      total: doc.headers.length,
      unknown: doc.unknownHeaders,
      missingObserved: doc.missingHeaders,
      coverage,
      dropped: [] as string[],
    },
    questions: {
      groups: groups.map(({ group, code, rows, candidates: options }) => ({
        group: group.split(':')[0],
        code,
        rows,
        candidates: options.length,
      })),
      rowQuestions,
      unreadableRecords: errors,
      /** One confirmation of the summary, one answer per group, one per row-level question, one dismissal of unreadable records. */
      ownerDecisions: 1 + groups.length + rowQuestions + (errors ? 1 : 0),
    },
    size: {
      fileBytes: bytes,
      maxRecordBytes: Math.max(0, ...recordBytes),
      totalCellBytes: recordBytes.reduce((sum, value) => sum + value, 0),
    },
    timingMs: { parse: Math.round(parsedAt - started), map: Math.round(mappedAt - parsedAt) },
  }
  writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`)
  const ok = missing.length === 0 && extra.length === 0 && mismatches.length === 0
  console.log(
    `${report.records.in} records, ${Object.entries(outcomes)
      .map(([key, n]) => `${key} ${n}`)
      .join(', ')}; ` +
      `${groups.length} shared questions, ${rowQuestions} row questions, ${report.questions.ownerDecisions} owner decisions; ` +
      `missing ${missing.length}, extra ${extra.length}, mismatches ${mismatches.length}; report ${values.output}`,
  )
  process.exit(ok ? 0 : 1)
}

main()
