// Opt-in read-only source audit. Private inputs/results stay in ignored .scratch/import-eval.
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyUsage } from '../functions/api/enrich/_anthropic'
import { lookupFlightAircraft, resolveEnrichmentProvider } from '../functions/api/enrich/_provider'
import { MAX_BATCH_SIZE, type FlightToEnrich } from '../functions/api/enrich/_shared'
import { providerFailure } from '../functions/api/import/_provider'
import { isCalendarDate } from '../packages/shared/src/flightValidation'
import { devVar } from './_cli'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRIVATE = resolve(ROOT, '.scratch/import-eval')

/** Reject symlinks in every existing component, including the private directory itself. */
export async function privateAircraftPath(value: string): Promise<string> {
  const path = resolve(ROOT, value)
  if (!path.startsWith(PRIVATE + sep)) throw new Error('Expected private aircraft path')
  const parts = path.slice(ROOT.length + 1).split(sep)
  let current = ROOT
  for (const part of parts) {
    current = resolve(current, part)
    const stat = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
      return null
    })
    if (stat?.isSymbolicLink()) throw new Error('Symlink refused')
  }
  return path
}

/** Keep the exclusive descriptor open for incremental writes; never replace an existing artifact. */
export async function createPrivateAircraftArtifact(value: string) {
  const path = await privateAircraftPath(value)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await privateAircraftPath(value)
  if ((await realpath(dirname(path))) !== dirname(path)) throw new Error('Path escape refused')
  const handle = await open(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  )
  return {
    path,
    async write(data: unknown) {
      const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n')
      // Positional writes keep the same protected file, rather than opening its path again.
      let offset = 0
      while (offset < bytes.length) {
        const written = await handle.write(bytes, offset, bytes.length - offset, offset)
        offset += written.bytesWritten
      }
      await handle.truncate(bytes.length)
      await handle.sync()
    },
    close: () => handle.close(),
  }
}

export function aircraftOccurrence(flight: FlightToEnrich): FlightToEnrich | null {
  const code = flight.airline_iata?.trim().toUpperCase() || null
  const raw = flight.flight_number?.toUpperCase().replace(/\s/g, '') || ''
  let carrier = code
  let number = raw
  if (carrier && number.startsWith(carrier)) number = number.slice(carrier.length)
  if (!carrier) {
    const full = /^([A-Z0-9]{2})(\d{1,5}[A-Z]?)$/.exec(raw)
    if (!full) return null
    carrier = full[1]
    number = full[2]
  }
  if (!/^(?=.*[A-Z])[A-Z0-9]{2}$/.test(carrier) || !/^\d{1,5}[A-Z]?$/.test(number)) return null
  number = number.replace(/^0+(?=\d)/, '')
  if (
    !isCalendarDate(flight.date) ||
    !/^[A-Z]{3}$/.test(flight.origin) ||
    !/^[A-Z]{3}$/.test(flight.destination)
  )
    return null
  return { ...flight, airline_iata: carrier, flight_number: carrier + number }
}

export function groupAircraftOccurrences(flights: FlightToEnrich[]) {
  const groups = new Map<string, { flight: FlightToEnrich; ids: string[] }>()
  for (const input of flights) {
    const flight = aircraftOccurrence(input)
    if (!flight) throw new Error('Malformed flight occurrence')
    const key = JSON.stringify([
      flight.date,
      flight.flight_number,
      flight.origin,
      flight.destination,
    ])
    const existing = groups.get(key)
    if (existing) existing.ids.push(input.id)
    else groups.set(key, { flight, ids: [input.id] })
  }
  return [...groups.values()]
}

async function main() {
  const args = process.argv.slice(2)
  const option = (flag: string, fallback?: string) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback
  if (!args.includes('--real-provider')) throw new Error('Explicit --real-provider is required')
  const provider = option('--provider', 'gemini')
  if (provider !== 'gemini' && provider !== 'anthropic') throw new Error('Unknown provider')
  const batchSize = Number(option('--batch-size', provider === 'anthropic' ? '1' : '3'))
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE)
    throw new Error('Invalid batch size')
  const requestLimit = Number(option('--max-requests', provider === 'gemini' ? '50' : undefined))
  if (!Number.isSafeInteger(requestLimit) || requestLimit < 1)
    throw new Error('Explicit positive --max-requests is required')
  const input = await privateAircraftPath(option('--input') || '')
  const inputHandle = await open(input, constants.O_RDONLY | constants.O_NOFOLLOW)
  let manifest: { flights: FlightToEnrich[] }
  try {
    if (!(await inputHandle.stat()).isFile()) throw new Error('Input must be a file')
    manifest = JSON.parse(await inputHandle.readFile('utf8'))
  } finally {
    await inputHandle.close()
  }
  if (
    !Array.isArray(manifest.flights) ||
    manifest.flights.length < 1 ||
    manifest.flights.length > 1000 ||
    manifest.flights.some(
      (f) =>
        !f ||
        typeof f.id !== 'string' ||
        !f.id ||
        [f.flight_number, f.airline_iata, f.airline_name].some(
          (v) => v != null && typeof v !== 'string',
        ),
    ) ||
    new Set(manifest.flights.map((f) => f.id)).size !== manifest.flights.length
  )
    throw new Error('Expected valid flights with unique IDs')
  const groups = groupAircraftOccurrences(manifest.flights)
  if (groups.length > 50) throw new Error('Expected at most 50 unique occurrences')
  const env = async (name: string) => process.env[name]?.trim() || (await devVar(name))
  const config = {
    ENRICH_PROVIDER: provider,
    GEMINI_API_KEY: await env('GEMINI_API_KEY'),
    GEMINI_ENRICH_MODEL: await env('GEMINI_ENRICH_MODEL'),
    ANTHROPIC_API_KEY: await env('ANTHROPIC_API_KEY'),
    ANTHROPIC_WORKSPACE_ID: await env('ANTHROPIC_WORKSPACE_ID'),
    ANTHROPIC_ENRICH_MODEL: await env('ANTHROPIC_ENRICH_MODEL'),
  }
  if (!(provider === 'anthropic' ? config.ANTHROPIC_API_KEY : config.GEMINI_API_KEY))
    throw new Error('Provider credential required')
  const selected = resolveEnrichmentProvider(config)
  const batches: Array<Record<string, unknown>> = []
  const summary = {
    ...selected,
    requested: manifest.flights.length,
    unique_occurrences: groups.length,
    answered: 0,
    failed: 0,
    actual: 0,
    scheduled: 0,
    unknown: 0,
    with_sources: 0,
    search_sources: 0,
    observed_tokens: 0,
    usage_unknown_batches: 0,
    requests_reserved: 0,
    request_limit: requestLimit,
    stopped_by_request_limit: false,
    accuracy: null,
    admission_status: 'candidate_only',
    conservative_usage_estimate_usd: null as number | null,
    usage: emptyUsage(),
  }
  const artifact = await createPrivateAircraftArtifact(
    option('--output', '.scratch/import-eval/aircraft-evaluation.json') || '',
  )
  const save = () =>
    artifact.write({
      evaluated_at: new Date().toISOString(),
      summary,
      flights: manifest.flights,
      batches,
    })
  try {
    await save()
    for (let start = 0; start < groups.length; start += batchSize) {
      const batchGroups = groups.slice(start, start + batchSize)
      const flights = batchGroups.map((g) => g.flight)
      const reservation = provider === 'anthropic' ? 2 : 1
      if (summary.requests_reserved + reservation > requestLimit) {
        summary.stopped_by_request_limit = true
        await save()
        break
      }
      summary.requests_reserved += reservation
      // Persist the reservation and unknown usage before a paid request can leave the process.
      summary.usage_unknown_batches++
      summary.conservative_usage_estimate_usd = null
      const batch: Record<string, unknown> = {
        flight_ids: flights.map((f) => f.id),
        occurrence_ids: batchGroups.map((g) => g.ids),
        requests_reserved: reservation,
        state: 'in_progress',
      }
      batches.push(batch)
      await save()
      const started = Date.now()
      try {
        const answer = await lookupFlightAircraft(config, flights)
        summary.answered += answer.results.length
        summary.search_sources += answer.searchSourceCount
        if (answer.tokenCount != null) summary.observed_tokens += answer.tokenCount
        if (
          answer.usage &&
          Object.values(answer.usage).every((value) => Number.isSafeInteger(value) && value >= 0)
        ) {
          summary.usage_unknown_batches--
          for (const key of Object.keys(summary.usage) as Array<keyof typeof summary.usage>)
            summary.usage[key] += answer.usage[key]
        } else if (provider === 'gemini' && answer.tokenCount != null)
          summary.usage_unknown_batches--
        for (const result of answer.results) {
          if (result.aircraft_icao && result.equipment_basis === 'actual') summary.actual++
          else if (result.aircraft_icao && result.equipment_basis === 'scheduled')
            summary.scheduled++
          else summary.unknown++
          if (result.sources?.length) summary.with_sources++
        }
        const results = answer.results.flatMap((result) =>
          (batchGroups.find((g) => g.flight.id === result.flight_id)?.ids || []).map((id) => ({
            ...result,
            flight_id: id,
          })),
        )
        Object.assign(batch, { state: 'complete', answer, results })
      } catch (error) {
        summary.failed += flights.length
        Object.assign(batch, {
          state: 'failed',
          error:
            error && typeof error === 'object' && 'code' in error
              ? String(error.code)
              : providerFailure(error).code,
        })
      }
      // High prompt tier and longest cache-write tier; an estimate, never a billing cap.
      // See docs/research/2026-10-13-haiku-enrichment-api.md for current provider pricing.
      summary.conservative_usage_estimate_usd =
        provider === 'anthropic' && summary.usage_unknown_batches === 0
          ? (summary.usage.inputTokens * 0.5 +
              summary.usage.outputTokens * 2.5 +
              summary.usage.cacheReadTokens * 0.05 +
              summary.usage.cacheWriteTokens * 1.0) /
              1_000_000 +
            summary.usage.searchRequests * 0.01
          : null
      batch.duration_ms = Date.now() - started
      await save()
      console.log(
        JSON.stringify({
          batch: batches.length,
          size: flights.length,
          duration_ms: batch.duration_ms,
          state: batch.state,
        }),
      )
    }
    console.log(JSON.stringify({ summary, output: artifact.path.slice(ROOT.length + 1) }))
  } finally {
    await artifact.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      'Aircraft source audit failed; check arguments, private input and credential presence.',
    )
    process.exitCode = 1
  })
