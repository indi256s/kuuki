// Opt-in source audit. Private inputs/results stay in ignored .scratch/import-eval; no journal writes.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { lookupAircraft } from '../functions/api/enrich/_lookup'
import { MAX_BATCH_SIZE, type FlightToEnrich } from '../functions/api/enrich/_shared'
import { DEFAULT_MODEL, providerFailure } from '../functions/api/import/_provider'
import { isCalendarDate } from '../packages/shared/src/flightValidation'

async function main() {
  const args = process.argv.slice(2)
  if (!args.includes('--real-provider')) throw new Error('Explicit --real-provider is required')
  const root = resolve(import.meta.dirname, '..')
  const privateDir = resolve(root, '.scratch/import-eval')
  const option = (flag: string, fallback?: string) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback
  const privatePath = (value: string | undefined) => {
    if (!value || !resolve(root, value).startsWith(privateDir + '/'))
      throw new Error('Input/output must be inside .scratch/import-eval')
    return resolve(root, value)
  }
  const input = privatePath(option('--input'))
  const output = privatePath(option('--output', '.scratch/import-eval/aircraft-evaluation.json'))
  if (input === output) throw new Error('Output must not overwrite input')
  const batchSize = Number(option('--batch-size', '3'))
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE)
    throw new Error(`Batch size must be 1–${MAX_BATCH_SIZE}`)
  const manifest = JSON.parse(await readFile(input, 'utf8')) as { flights: FlightToEnrich[] }
  if (
    !Array.isArray(manifest.flights) ||
    manifest.flights.length === 0 ||
    manifest.flights.length > 50 ||
    manifest.flights.some(
      (f) =>
        !f ||
        typeof f.id !== 'string' ||
        !f.id ||
        typeof f.date !== 'string' ||
        !isCalendarDate(f.date) ||
        !/^[A-Z]{3}$/.test(f.origin) ||
        !/^[A-Z]{3}$/.test(f.destination) ||
        [f.flight_number, f.airline_iata, f.airline_name].some(
          (value) => value != null && typeof value !== 'string',
        ),
    ) ||
    new Set(manifest.flights.map((f) => f.id)).size !== manifest.flights.length
  )
    throw new Error('Expected 1–50 valid flights with unique IDs')
  const vars = await readFile(resolve(root, '.dev.vars'), 'utf8').catch(() => '')
  const devVar = (name: string) =>
    vars
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
  const key = process.env.GEMINI_API_KEY?.trim() || devVar('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY is required')
  const model =
    process.env.GEMINI_ENRICH_MODEL?.trim() || devVar('GEMINI_ENRICH_MODEL') || DEFAULT_MODEL
  const batches: Array<{
    flight_ids: string[]
    duration_ms: number
    answer?: Awaited<ReturnType<typeof lookupAircraft>>
    error?: string
  }> = []
  const summary = {
    model,
    requested: manifest.flights.length,
    answered: 0,
    failed: 0,
    actual: 0,
    scheduled: 0,
    unknown: 0,
    with_sources: 0,
    search_sources: 0,
    observed_tokens: 0,
    usage_unknown_batches: 0,
    accuracy: null,
  }
  await mkdir(dirname(output), { recursive: true })
  for (let start = 0; start < manifest.flights.length; start += batchSize) {
    const flights = manifest.flights.slice(start, start + batchSize)
    const started = Date.now()
    try {
      const answer = await lookupAircraft(key, model, flights)
      summary.answered += answer.results.length
      summary.search_sources += answer.searchSourceCount
      if (answer.tokenCount == null) summary.usage_unknown_batches++
      else summary.observed_tokens += answer.tokenCount
      for (const result of answer.results) {
        if (result.aircraft_icao && result.equipment_basis === 'actual') summary.actual++
        else if (result.aircraft_icao && result.equipment_basis === 'scheduled') summary.scheduled++
        else summary.unknown++
        if (result.sources?.length) summary.with_sources++
      }
      batches.push({
        flight_ids: flights.map((f) => f.id),
        duration_ms: Date.now() - started,
        answer,
      })
    } catch (error) {
      const failure = providerFailure(error)
      summary.failed += flights.length
      summary.usage_unknown_batches++
      batches.push({
        flight_ids: flights.map((f) => f.id),
        duration_ms: Date.now() - started,
        error:
          error && typeof error === 'object' && 'code' in error ? String(error.code) : failure.code,
      })
    }
    await writeFile(
      output,
      JSON.stringify(
        { evaluated_at: new Date().toISOString(), summary, flights: manifest.flights, batches },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    )
    const batch = batches.at(-1)!
    console.log(
      JSON.stringify({
        batch: batches.length,
        size: flights.length,
        duration_ms: batch.duration_ms,
        error: batch.error,
        offered: batch.answer?.results.filter((r) => r.aircraft_icao).length,
        search_sources: batch.answer?.searchSourceCount,
      }),
    )
  }
  console.log(JSON.stringify({ summary, output: output.slice(root.length + 1) }))
}

main().catch(() => {
  console.error(
    'Aircraft source audit failed; check arguments, private input and credential presence.',
  )
  process.exitCode = 1
})
