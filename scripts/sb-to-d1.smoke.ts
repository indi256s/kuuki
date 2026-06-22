// Import-smoke for scripts/sb-to-d1.ts. Imports the module + the two REAL dependencies
// it relies on, asserts they wire up, and runs the password-placeholder structural check.
// Does NOT touch D1 / does NOT run the import (main() is never called here).
//
// Run:  npx tsx scripts/sb-to-d1.smoke.ts

import { normalizeIso } from '../functions/api/_lib/time'
import { verifyPassword } from '../functions/api/_lib/crypto'
import {
  FLIGHTS_COLUMNS,
  USERS_COLUMNS,
  PASSWORD_PLACEHOLDER,
  rowsPerInsert,
} from './sb-to-d1'

async function smoke(): Promise<void> {
  // 1. The real normalizeIso turns a Postgres timestamptz into canonical ISO.
  const iso = normalizeIso('2026-02-07T09:22:58.495964+00:00')
  if (iso !== '2026-02-07T09:22:58.495Z') {
    throw new Error(`normalizeIso wired wrong: got ${iso}`)
  }

  // 2. The real verifyPassword rejects the RESET_REQUIRED placeholder (structurally invalid).
  const verified = await verifyPassword('x', PASSWORD_PLACEHOLDER, 'secret')
  if (verified !== false) throw new Error(`verifyPassword('${PASSWORD_PLACEHOLDER}') !== false`)

  // 3. flights insert is 20 columns and OMITS aircraft_lookup_attempts.
  if (FLIGHTS_COLUMNS.length !== 20) throw new Error(`flights cols ${FLIGHTS_COLUMNS.length} != 20`)
  if (FLIGHTS_COLUMNS.includes('aircraft_lookup_attempts')) {
    throw new Error('flights cols must OMIT aircraft_lookup_attempts')
  }

  // 4. Chunk sizes follow floor(100/numCols).
  const checks: Array<[number, number]> = [
    [USERS_COLUMNS.length, 25],
    [FLIGHTS_COLUMNS.length, 5],
    [4, 25], // country_claims
    [7, 14], // ground_visits
  ]
  for (const [cols, expected] of checks) {
    if (rowsPerInsert(cols) !== expected) {
      throw new Error(`rowsPerInsert(${cols}) = ${rowsPerInsert(cols)} != ${expected}`)
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `SMOKE OK: normalizeIso=${iso} verifyPassword(RESET_REQUIRED)=${verified} ` +
      `flightsCols=${FLIGHTS_COLUMNS.length} omitsLookupAttempts=${!FLIGHTS_COLUMNS.includes('aircraft_lookup_attempts')} ` +
      `chunk[users=${rowsPerInsert(USERS_COLUMNS.length)},flights=${rowsPerInsert(FLIGHTS_COLUMNS.length)},country_claims=${rowsPerInsert(4)},ground_visits=${rowsPerInsert(7)}]`,
  )
}

smoke().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
