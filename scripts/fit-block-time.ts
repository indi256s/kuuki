/** Read-only local calibration; --write replaces only the coefficient module. */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findAirport } from '../packages/data/src/airport-lookup'
import { fitBlockTimeModel, type BlockTimeModel, type BlockTimeSample } from '../packages/shared/src/blockTime'
import { PRIOR_BLOCK_TIME_MODEL } from '../packages/shared/src/blockTimeModel.generated'
import { eastwardShare, greatCircleKm } from '../packages/shared/src/geo'
import { validateFlightInput } from '../packages/shared/src/flightValidation'
import { computeFlightDuration } from '../functions/api/_services/flightDuration'
import type { MigrationReader } from './migration-remote-reader'
import { ROOT, requiredArg } from './_cli'
import { openLocalTarget, parseLocalTarget } from './migration-target'

function renderModel(model: BlockTimeModel): string {
  return `// GENERATED calibration. Samples: ${model.samples}. Fit date: ${model.fittedAt ?? 'none (prior)'}.\n` +
    `import type { BlockTimeModel } from './blockTime'\n\n` +
    `export const PRIOR_BLOCK_TIME_MODEL: BlockTimeModel = ${JSON.stringify(PRIOR_BLOCK_TIME_MODEL, null, 2)}\n\n` +
    `export const BLOCK_TIME_MODEL: BlockTimeModel = ${model.samples === 0 ? 'PRIOR_BLOCK_TIME_MODEL' : JSON.stringify(model, null, 2)}\n`
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(argv.includes('--target') ? argv : ['--target', 'local', ...argv])
  const admission = argv.includes('--schema-admission') ? resolve(requiredArg(argv, '--schema-admission')) : undefined
  const target = await openLocalTarget(options, admission)
  try {
    const reader: MigrationReader = { async read(sql) { return (await target.db.prepare(sql).all()).results } }
    const flights = await reader.read(`SELECT date, origin, destination, departure_time, arrival_time, origin_tz, dest_tz FROM flights
      WHERE lifecycle_state IN ('awaiting', 'logged') AND departure_time IS NOT NULL AND arrival_time IS NOT NULL
        AND times_from_schedule = 0 AND (duration_source IS NULL OR duration_source != 'schedule')`)
    const samples: BlockTimeSample[] = []
    let skipped = 0
    for (const flight of flights) {
      try {
        const origin = findAirport(String(flight.origin)), destination = findAirport(String(flight.destination))
        if (!origin || !destination) throw new Error('Missing package coordinates')
        const input = validateFlightInput({ date: flight.date, origin: flight.origin, destination: flight.destination,
          departure_time: flight.departure_time, arrival_time: flight.arrival_time,
          origin_tz: flight.origin_tz || origin.timezone, dest_tz: flight.dest_tz || destination.timezone }, 'create')
        const { durationMinutes } = computeFlightDuration({ date: input.date!, departureTime: input.departure_time!, arrivalTime: input.arrival_time!,
          originTz: input.origin_tz!, destTz: input.dest_tz!, existingDurationMinutes: null })
        if (durationMinutes === null || durationMinutes <= 0 || durationMinutes > 1200) throw new Error('Invalid measured duration')
        const a = { lat: origin.latitude, lon: origin.longitude }, b = { lat: destination.latitude, lon: destination.longitude }
        const distanceKm = Math.min(20000, greatCircleKm(a, b)), east = eastwardShare(a, b)
        if (!Number.isFinite(distanceKm) || !Number.isFinite(east)) throw new Error('Invalid package coordinates')
        samples.push({ distanceKm, east, minutes: durationMinutes })
      } catch { skipped++ }
    }
    const model = fitBlockTimeModel(samples)
    if (argv.includes('--write')) writeFileSync(join(ROOT, 'packages/shared/src/blockTimeModel.generated.ts'), renderModel(model))
    console.log(JSON.stringify({ samples: samples.length, skipped, rmse: model.rmse, model }))
  } finally { await target.dispose() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Block-time calibration failed; check local target and schema admission'); process.exitCode = 1 })
}
