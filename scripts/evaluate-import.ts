// Live, opt-in import evaluator. Source files and predictions stay in ignored .scratch/import-eval.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { GoogleGenAI } from '@google/genai'
import {
  extractFlights,
  extractionContents,
  FLIGHT_RESPONSE_SCHEMA,
  normalizeFlights,
} from '../functions/api/import/_extract'
import {
  DEFAULT_MODEL,
  PROVIDER_TIMEOUT_MS,
  providerFailure,
} from '../functions/api/import/_provider'
import { rowOf } from '../functions/api/_services/importJob'
import { FlightScanner } from '../workers/import/scanner'
import type { ExtractedFlight, ParseRequest } from '../functions/api/import/_shared'
import { parseStructuredText } from '../functions/api/import/_text'

const root = resolve(import.meta.dirname, '..')
const privateDir = resolve(root, '.scratch/import-eval')
const files = ['travel-log.txt', 'air-serbia.png', 'china-eastern.png', 'red-wings.png'] as const
const fields = [
  'date',
  'origin',
  'destination',
  'airline_iata',
  'flight_number',
  'departure_time',
  'arrival_time',
] as const
type Expected = {
  line: number
  category: 'eligible' | 'excluded' | 'review' | 'unavailable'
  expected: Record<(typeof fields)[number], string>
}

function score(
  expected: Expected[],
  predicted: ExtractedFlight[],
  drafts: ReturnType<typeof rowOf>[],
  raw?: ExtractedFlight[],
) {
  const equal = (key: (typeof fields)[number], actual: string | undefined, wanted: string) =>
    (actual ?? '') === wanted || (key === 'airline_iata' && !wanted && actual === 'ZZ')
  const used = new Set<number>()
  const pending: Expected[] = []
  const metrics = {
    expected: { eligible: 0, excluded: 0, review: 0, unavailable: 0 },
    exactKeys: 0,
    matched: 0,
    keyMatched: 0,
    nearMatched: 0,
    excludedReturned: 0,
    missing: 0,
    extra: 0,
    fieldCorrect: 0,
    fieldCompared: 0,
    fieldErrors: {} as Record<string, number>,
    inventedYear: 0,
    inventedAirport: 0,
    inventedDeparture: 0,
    inventedArrival: 0,
    rawInventedYear: 0,
    selectedCount: drafts.filter((d) => d.selected).length,
    selectedUnmatched: 0,
    unsafeSelectedFields: 0,
    unsafeSelectedUnavailable: 0,
    unsafePreselectedReview: 0,
    unsafePreselectedExcluded: 0,
    unavailableRetained: 0,
    unmatchedLines: [] as number[],
  }
  const align = (item: Expected, index: number, near: boolean) => {
    used.add(index)
    const e = item.expected
    const p = predicted[index]
    if (item.category === 'excluded') {
      metrics.excludedReturned++
      if (drafts[index]?.selected) metrics.unsafePreselectedExcluded++
      return
    }
    metrics.matched++
    if (near) metrics.nearMatched++
    else metrics.keyMatched++
    if (item.category === 'review' && drafts[index]?.selected) metrics.unsafePreselectedReview++
    if (
      fields.every(
        (key) => key === 'departure_time' || key === 'arrival_time' || equal(key, p[key], e[key]),
      )
    )
      metrics.exactKeys++
    for (const key of fields) {
      metrics.fieldCompared++
      if (equal(key, p[key], e[key])) metrics.fieldCorrect++
      else {
        metrics.fieldErrors[key] = (metrics.fieldErrors[key] ?? 0) + 1
        if (drafts[index]?.selected) metrics.unsafeSelectedFields++
      }
    }
    if (!e.date && p.date) metrics.inventedYear++
    for (const key of ['origin', 'destination'] as const)
      if (!e[key] && p[key]) metrics.inventedAirport++
    if (!e.departure_time && p.departure_time) metrics.inventedDeparture++
    if (!e.arrival_time && p.arrival_time) metrics.inventedArrival++
    if (
      !e.date &&
      raw?.some(
        (r) =>
          !!r.date &&
          r.origin === p.origin &&
          r.destination === p.destination &&
          (e.flight_number ? r.flight_number === e.flight_number : !r.flight_number),
      )
    )
      metrics.rawInventedYear++
  }
  for (const item of expected) {
    metrics.expected[item.category]++
    const e = item.expected
    if (
      item.category === 'unavailable' ||
      (item.category === 'excluded' && !e.flight_number && !e.origin && !e.destination)
    ) {
      const candidates = predicted.flatMap((p, i) =>
        !used.has(i) &&
        p.date === e.date &&
        !p.origin &&
        !p.destination &&
        (!e.airline_iata || p.airline_iata === e.airline_iata) &&
        !p.flight_number
          ? [i]
          : [],
      )
      if (candidates.length === 1) {
        const index = candidates[0]
        if (item.category === 'unavailable') {
          used.add(index)
          metrics.unavailableRetained++
          if (drafts[index]?.selected) metrics.unsafeSelectedUnavailable++
        } else align(item, index, false)
      }
      continue
    }
    const candidates = predicted.flatMap((p, i) =>
      !used.has(i) &&
      (e.flight_number
        ? p.flight_number === e.flight_number &&
          p.airline_iata === e.airline_iata &&
          (!e.date || !p.date || p.date === e.date)
        : (!e.date || !p.date || p.date === e.date) &&
          (!e.origin || p.origin === e.origin) &&
          (!e.destination || p.destination === e.destination) &&
          !p.flight_number)
        ? [i]
        : [],
    )
    const routeMatch = candidates.find(
      (i) => predicted[i].origin === e.origin && predicted[i].destination === e.destination,
    )
    const index = routeMatch ?? (candidates.length === 1 ? candidates[0] : -1)
    if (index >= 0) align(item, index, false)
    else pending.push(item)
  }
  for (const item of pending) {
    const e = item.expected
    const keys = ['date', 'origin', 'destination', 'airline_iata', 'flight_number'] as const
    const known = keys.filter((key) => e[key])
    let best = -1
    let bestScore = 2
    let ties = 0
    for (const [index, p] of predicted.entries()) {
      if (used.has(index)) continue
      if (e.date && p.date && e.date !== p.date) continue
      const candidateScore = known.filter((key) => p[key] === e[key]).length
      if (candidateScore > bestScore) {
        best = index
        bestScore = candidateScore
        ties = 1
      } else if (candidateScore === bestScore) ties++
    }
    if (best >= 0 && ties === 1) align(item, best, true)
    else if (item.category !== 'excluded') {
      metrics.missing++
      metrics.unmatchedLines.push(item.line)
    }
  }
  metrics.extra = predicted.length - used.size
  metrics.selectedUnmatched = drafts.filter(
    (draft, index) => draft.selected && !used.has(index),
  ).length
  return metrics
}

async function devVar(name: string) {
  const vars = await readFile(resolve(root, '.dev.vars'), 'utf8').catch(() => '')
  const line = vars.split(/\r?\n/).find((line) => line.startsWith(`${name}=`))
  return line
    ?.slice(name.length + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
}

async function apiKey() {
  const value = process.env.GEMINI_API_KEY?.trim() || (await devVar('GEMINI_API_KEY'))
  if (!value) throw new Error('GEMINI_API_KEY is required')
  return value
}

async function source(file: string): Promise<ParseRequest> {
  const path = resolve(privateDir, file)
  return file.endsWith('.txt')
    ? { type: 'text', content: await readFile(path, 'utf8') }
    : { type: 'image', content: Buffer.from(await readFile(path)).toString('base64') }
}

async function main() {
  const args = process.argv.slice(2)
  const offline = args.includes('--text-only')
  const providerOnly = args.includes('--provider-only')
  const rescoreAt = args.indexOf('--rescore')
  const rescore = rescoreAt >= 0
  if (offline && (providerOnly || args.includes('--real-provider'))) {
    throw new Error('--text-only is offline and cannot be combined with live provider flags')
  }
  if (rescore && (offline || providerOnly || args.includes('--real-provider')))
    throw new Error('--rescore only reads a saved result')
  if (!offline && !rescore && !args.includes('--real-provider'))
    throw new Error('Explicit --real-provider is required')
  const outputAt = args.indexOf('--output')
  const output = outputAt >= 0 ? args[outputAt + 1] : '.scratch/import-eval/evaluation.json'
  if (!output || !resolve(root, output).startsWith(privateDir + '/'))
    throw new Error('Output must be inside .scratch/import-eval')
  const manifest = JSON.parse(
    await readFile(resolve(privateDir, 'expected.json'), 'utf8'),
  ) as Record<string, Expected[]>
  if (rescore) {
    const input = args[rescoreAt + 1]
    if (!input || !resolve(root, input).startsWith(privateDir + '/'))
      throw new Error('Rescore input must be private')
    const saved = JSON.parse(await readFile(resolve(root, input), 'utf8')) as {
      results: Array<{
        file: string
        normalized?: ExtractedFlight[]
        drafts?: ReturnType<typeof rowOf>[]
        raw?: ExtractedFlight[]
        metrics?: unknown
      }>
    }
    for (const result of saved.results) {
      if (!manifest[result.file]) continue
      result.metrics = score(
        manifest[result.file],
        result.normalized ?? [],
        result.drafts ?? [],
        result.raw,
      )
      console.log(JSON.stringify({ file: result.file, metrics: result.metrics }))
    }
    await writeFile(resolve(root, output), JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 })
    return
  }
  const fileAt = args.indexOf('--file')
  const file = fileAt >= 0 ? args[fileAt + 1] : undefined
  if (
    file &&
    (!/^[\w.-]+\.(txt|png)$/.test(file) || !resolve(privateDir, file).startsWith(privateDir + '/'))
  )
    throw new Error('Invalid fixture file')
  if (offline && file && !file.endsWith('.txt'))
    throw new Error('--text-only requires a text fixture')
  const repeatAt = args.indexOf('--repeat')
  const repeats = repeatAt >= 0 ? Number(args[repeatAt + 1]) : 1
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5)
    throw new Error('--repeat must be 1 to 5')
  const model = process.env.GEMINI_IMPORT_MODEL?.trim() || DEFAULT_MODEL
  const key = offline ? undefined : await apiKey()
  const provider = key && providerOnly ? new GoogleGenAI({ apiKey: key }) : undefined
  const results = []
  const selected = file ? [file] : offline ? ['travel-log.txt'] : files
  for (const fixture of selected)
    for (let run = 1; run <= repeats; run++) {
      const started = Date.now()
      const controller = new AbortController()
      let expired = false
      const timer = offline
        ? undefined
        : setTimeout(() => {
            expired = true
            controller.abort()
          }, PROVIDER_TIMEOUT_MS)
      const raw: ExtractedFlight[] = []
      let firstChunkMs: number | undefined
      let firstRowMs: number | undefined
      let finishReason: string | undefined
      let totalTokens: number | undefined
      let streamedRows = 0
      try {
        const input = await source(fixture)
        let normalized: ExtractedFlight[]
        let rejected: unknown[] = []
        if (!providerOnly) {
          const local = offline ? parseStructuredText(input.content) : null
          if (offline && !local)
            throw new Error('Text fixture is not recognized by the offline parser')
          const result = local
            ? normalizeFlights(local)
            : await extractFlights(
                { GEMINI_API_KEY: key!, GEMINI_IMPORT_MODEL: model } as Env,
                input,
              )
          normalized = result.flights
          rejected = [...(result.rejected ?? []), ...(local?.rejected ?? [])]
        } else {
          const stream = await provider!.models.generateContentStream({
            model,
            contents: extractionContents(input),
            config: {
              responseMimeType: 'application/json',
              responseSchema: FLIGHT_RESPONSE_SCHEMA,
              httpOptions: { timeout: PROVIDER_TIMEOUT_MS },
              abortSignal: controller.signal,
            },
          })
          const scanner = new FlightScanner()
          for await (const chunk of stream) {
            firstChunkMs ??= Date.now() - started
            finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason
            totalTokens = chunk.usageMetadata?.totalTokenCount ?? totalTokens
            for (const row of scanner.push(chunk.text ?? '')) {
              raw.push(row.value as ExtractedFlight)
              streamedRows++
              firstRowMs ??= Date.now() - started
            }
          }
          scanner.finish()
          const parsed = normalizeFlights({ flights: structuredClone(raw) })
          normalized = parsed.flights
          rejected = parsed.rejected ?? []
        }
        const drafts = normalized.map((flight) => rowOf(flight))
        const metrics = manifest[fixture]
          ? score(manifest[fixture], normalized, drafts, providerOnly ? raw : undefined)
          : undefined
        const result = {
          file: fixture,
          run,
          model,
          duration_ms: Date.now() - started,
          firstChunkMs,
          firstRowMs,
          finishReason,
          totalTokens,
          streamedRows,
          raw: providerOnly ? raw : undefined,
          normalized,
          drafts,
          rejected,
          metrics,
        }
        results.push(result)
        console.log(
          JSON.stringify({
            file: fixture,
            run,
            model,
            duration_ms: result.duration_ms,
            firstChunkMs,
            firstRowMs,
            finishReason,
            totalTokens,
            streamedRows,
            normalizedRows: normalized.length,
            rejectedRows: rejected.length,
            metrics,
          }),
        )
      } catch (error) {
        const failure = expired ? 'PROVIDER_TIMEOUT' : providerFailure(error).code
        const message = error instanceof Error ? error.message.toLowerCase() : ''
        const diagnostic =
          error instanceof Error
            ? {
                name: error.name,
                status: 'status' in error ? error.status : undefined,
                billing: /bill|payment|paid/.test(message),
                permission: /permission|forbidden|denied/.test(message),
                model: /model.*(unavailable|unsupported|not found|not allowed)/.test(message),
              }
            : {}
        let normalized: ExtractedFlight[] = []
        let rejected: unknown[] = []
        if (raw.length) {
          try {
            const partial = normalizeFlights({ flights: structuredClone(raw) })
            normalized = partial.flights
            rejected = partial.rejected ?? []
          } catch {
            /* Retain complete raw rows even if none normalize. */
          }
        }
        const drafts = normalized.map((flight) => rowOf(flight))
        const metrics = manifest[fixture]
          ? score(manifest[fixture], normalized, drafts, raw)
          : undefined
        results.push({
          file: fixture,
          run,
          model,
          duration_ms: Date.now() - started,
          firstChunkMs,
          firstRowMs,
          finishReason,
          totalTokens,
          streamedRows,
          raw,
          normalized,
          drafts,
          rejected,
          error: failure,
          diagnostic,
          metrics,
        })
        console.log(
          JSON.stringify({
            file: fixture,
            run,
            model,
            duration_ms: Date.now() - started,
            firstChunkMs,
            firstRowMs,
            finishReason,
            totalTokens,
            streamedRows,
            partialRows: normalized.length,
            error: failure,
            diagnostic,
            metrics,
          }),
        )
      } finally {
        if (timer) clearTimeout(timer)
        controller.abort()
      }
    }
  const path = resolve(root, output)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({ model, providerOnly, results }, null, 2) + '\n', {
    mode: 0o600,
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Evaluation failed')
  process.exitCode = 1
})
