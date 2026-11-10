// Shared fixture and call helpers for the Flighty history import tests (ADR 0008). Every call goes through the real
// route handlers against local D1; the CSV is parsed, chunked and digested with the same shared code the browser uses.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiDatabase, csrfRequest, testOrigin } from './harness'
import { OTHER, USER } from './import-fixture'
import { onRequestGet as listGet, onRequestPost as createPost } from '../api/import/history/index'
import { onRequestDelete as runDelete, onRequestGet as runGet } from '../api/import/history/[id]'
import { onRequestPut as chunkPut } from '../api/import/history/[id]/chunks/[index]'
import { onRequestPost as confirmPost } from '../api/import/history/[id]/confirm'
import { onRequestPost as groupsPost } from '../api/import/history/[id]/groups'
import { onRequestDelete as sourceDelete } from '../api/import/history/[id]/source'
import { onRequestPatch as rowPatch } from '../api/import/history/[id]/rows/[rowId]'
import {
  onRequestGet as flightGet,
  onRequestDelete as flightDelete,
  onRequestPatch as flightPatch,
} from '../api/flights/[id]'
import { onRequestPost as bulkDeletePost } from '../api/flights/bulk-delete'
import { onRequestPost as flightPost } from '../api/flights/index'
import {
  chunkFlightyRecords,
  flightyChunkDigest,
  flightyChunkPayload,
  FLIGHTY_PROFILE,
  parseFlightyCsv,
  type FlightyDocument,
} from '../../packages/shared/src/flighty'
import type {
  HistoryChunkBody,
  HistoryConfirmItem,
  HistoryConfirmResult,
  HistoryCreateBody,
  HistoryPage,
  HistoryRowView,
  HistoryRunSummary,
} from '../../packages/shared/src/flightyHistory'

export { OTHER, USER }
export { clock, daysAfter, NOW } from './import-fixture'

export type Who = { id: string; email: string } | null
export type Reply = { status: number; body: Record<string, any> }

export const fixtureCsv = () =>
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../packages/shared/src/fixtures/flighty/observed-33.csv',
    ),
    'utf8',
  )

const HEADERS = parseFlightyCsv(fixtureCsv()).headers
/** A CSV in the observed header order from partial records (cells not named stay empty, none may contain a comma). */
export const csvOf = (records: Array<Record<string, string>>) =>
  [
    HEADERS.join(','),
    ...records.map((record) => HEADERS.map((h) => record[h] ?? '').join(',')),
  ].join('\n')
/** One clean completed JFK-LHR record with PNR SYN777; override any column. */
export const bawRecord = (over: Record<string, string> = {}): Record<string, string> => ({
  Date: '2026-05-01',
  Airline: 'BAW',
  Flight: '178',
  From: 'JFK',
  To: 'LHR',
  Canceled: 'false',
  'Gate Departure (Actual)': '2026-05-01T19:00',
  'Gate Arrival (Actual)': '2026-05-02T07:00',
  'Aircraft Type Name': 'Boeing 777-300ER',
  PNR: 'SYN777',
  'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000aa',
  ...over,
})

/** [iata, country code, latitude, longitude] for every airport a confirmed fixture flight touches. */
const AIRPORTS: Array<[string, string, number, number]> = [
  ['JFK', 'US', 40.64, -73.78],
  ['LHR', 'GB', 51.47, -0.45],
  ['HND', 'JP', 35.55, 139.78],
  ['HNL', 'US', 21.32, -157.92],
  ['CDG', 'FR', 49.01, 2.55],
  ['NCE', 'FR', 43.66, 7.22],
  ['FRA', 'DE', 50.03, 8.57],
  ['BOS', 'US', 42.36, -71.01],
  ['SVO', 'RU', 55.97, 37.41],
  ['LED', 'RU', 59.8, 30.26],
  ['BKK', 'TH', 13.69, 100.75],
  ['CNX', 'TH', 18.77, 98.96],
  ['AMS', 'NL', 52.31, 4.76],
  ['OSL', 'NO', 60.19, 11.1],
]
const AIRCRAFT = ['B77W', 'B789', 'B748', 'A320', 'E190']

export async function historyAccount() {
  const { db, dispose } = await createApiDatabase()
  await db.batch([
    ...[USER, OTHER].flatMap((user) => [
      db
        .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
        .bind(user.id, user.email, 'hash'),
      db
        .prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')")
        .bind(user.id),
    ]),
    ...AIRPORTS.map(([iata, cc, lat, lon]) =>
      db
        .prepare(
          'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(iata, iata, `${iata} city`, cc, cc, lat, lon),
    ),
    ...AIRCRAFT.map((icao) =>
      db
        .prepare(
          "INSERT INTO aircraft_reference (icao, iata, name, manufacturer, model, type, engine_type, engine_count) VALUES (?,?,?,'Maker','Model','jet','jet',2)",
        )
        .bind(icao, icao.slice(0, 3), icao),
    ),
  ])
  return { db, dispose }
}

const context = (
  db: D1Database,
  request: Request,
  user: Who,
  params: Record<string, string> = {},
) =>
  ({
    request,
    env: { PAGES_ORIGIN: testOrigin, DB: db },
    data: { user },
    params,
    waitUntil() {},
  }) as never

async function reply(response: Response): Promise<Reply> {
  const text = await response.text()
  let body: Record<string, any> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  return { status: response.status, body }
}

let sequence = 0
const unique = (label: string) => `${label}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`
export const historyKey = () => unique('hist-key')
export const historyOperationId = () => unique('hist-op')

export interface PreparedCsv {
  doc: FlightyDocument
  chunks: ReturnType<typeof chunkFlightyRecords>
  digests: string[]
  create: (operationId?: string) => HistoryCreateBody
  chunkBody: (index: number) => HistoryChunkBody
}

/** Parse, chunk and digest a CSV exactly as the browser does before opening a run. */
export async function prepareCsv(csvText: string): Promise<PreparedCsv> {
  const doc = parseFlightyCsv(csvText)
  const chunks = chunkFlightyRecords(doc.records)
  const digests = await Promise.all(chunks.map((chunk) => flightyChunkDigest(chunk)))
  return {
    doc,
    chunks,
    digests,
    create: (operationId = historyOperationId()) => ({
      operationId,
      profile: FLIGHTY_PROFILE,
      headers: doc.headers,
      totalRecords: doc.records.length,
      blankLines: doc.blankLines,
      chunks: chunks.map((chunk, index) => ({ count: chunk.length, digest: digests[index] })),
    }),
    chunkBody: (index) => ({
      records: JSON.parse(flightyChunkPayload(chunks[index])) as HistoryChunkBody['records'],
    }),
  }
}

export async function createRun(db: D1Database, body: unknown, user: Who = USER) {
  return reply(
    await createPost(context(db, csrfRequest('/api/import/history', 'POST', body), user)),
  )
}

export async function listRuns(db: D1Database, user: Who = USER) {
  return reply(await listGet(context(db, new Request(`${testOrigin}/api/import/history`), user)))
}

export async function putChunk(
  db: D1Database,
  runId: string,
  index: number | string,
  body: unknown,
  user: Who = USER,
) {
  return reply(
    await chunkPut(
      context(db, csrfRequest(`/api/import/history/${runId}/chunks/${index}`, 'PUT', body), user, {
        id: runId,
        index: String(index),
      }),
    ),
  )
}

/** Open a run for `csvText` and PUT every chunk. Returns the run id, its last summary and every chunk reply. */
export async function uploadCsv(
  db: D1Database,
  csvText: string,
  user: Who = USER,
  operationId: string = historyOperationId(),
) {
  const prepared = await prepareCsv(csvText)
  const created = await createRun(db, prepared.create(operationId), user)
  if (created.status !== 201) throw new Error(`run not created: ${JSON.stringify(created)}`)
  const runId = created.body.run.id as string
  const chunkReplies: Reply[] = []
  for (let index = 0; index < prepared.chunks.length; index++) {
    const put = await putChunk(db, runId, index, prepared.chunkBody(index), user)
    if (put.status !== 201) throw new Error(`chunk ${index} refused: ${JSON.stringify(put)}`)
    chunkReplies.push(put)
  }
  const run = chunkReplies[chunkReplies.length - 1].body.run as HistoryRunSummary
  return { runId, run, prepared, chunkReplies }
}

export async function getPage(
  db: D1Database,
  runId: string,
  query: Record<string, string | number> = {},
  user: Who = USER,
) {
  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  )
  const { status, body } = await reply(
    await runGet(
      context(db, new Request(`${testOrigin}/api/import/history/${runId}?${search}`), user, {
        id: runId,
      }),
    ),
  )
  return { status, body: body as unknown as HistoryPage & Record<string, any> }
}

export async function getArchive(db: D1Database, runId: string, user: Who = USER) {
  return reply(
    await runGet(
      context(
        db,
        new Request(`${testOrigin}/api/import/history/${runId}?representation=archive`),
        user,
        { id: runId },
      ),
    ),
  )
}

export async function discardRun(db: D1Database, runId: string, user: Who = USER) {
  return reply(
    await runDelete(
      context(db, csrfRequest(`/api/import/history/${runId}`, 'DELETE'), user, { id: runId }),
    ),
  )
}

export async function eraseSource(db: D1Database, runId: string, user: Who = USER) {
  return reply(
    await sourceDelete(
      context(db, csrfRequest(`/api/import/history/${runId}/source`, 'DELETE'), user, {
        id: runId,
      }),
    ),
  )
}

export async function patchRow(
  db: D1Database,
  runId: string,
  rowId: string,
  body: unknown,
  user: Who = USER,
) {
  return reply(
    await rowPatch(
      context(db, csrfRequest(`/api/import/history/${runId}/rows/${rowId}`, 'PATCH', body), user, {
        id: runId,
        rowId,
      }),
    ),
  )
}

export async function postGroup(
  db: D1Database,
  runId: string,
  body: { group: string; answer: unknown; revision: number },
  user: Who = USER,
) {
  return reply(
    await groupsPost(
      context(db, csrfRequest(`/api/import/history/${runId}/groups`, 'POST', body), user, {
        id: runId,
      }),
    ),
  )
}

export async function postConfirm(
  db: D1Database,
  runId: string,
  items: HistoryConfirmItem[],
  user: Who = USER,
) {
  const { status, body } = await reply(
    await confirmPost(
      context(db, csrfRequest(`/api/import/history/${runId}/confirm`, 'POST', { items }), user, {
        id: runId,
      }),
    ),
  )
  return { status, body: body as { results: HistoryConfirmResult[]; run: HistoryRunSummary } }
}

/** Every row of a state filter, following the keyset cursor. */
export async function allRows(
  db: D1Database,
  runId: string,
  state: string,
  user: Who = USER,
): Promise<HistoryRowView[]> {
  const rows: HistoryRowView[] = []
  let cursor: number | null = null
  do {
    const { body } = await getPage(
      db,
      runId,
      { state, ...(cursor === null ? {} : { cursor }) },
      user,
    )
    rows.push(...body.rows)
    cursor = body.nextCursor
  } while (cursor !== null)
  return rows
}

/** Confirm every `ready` row, 50 at a time, until none remain. Throws on any per-item failure. */
export async function confirmAllReady(db: D1Database, runId: string, user: Who = USER) {
  const done: HistoryConfirmResult[] = []
  for (let round = 0; round < 250; round++) {
    const { body } = await getPage(db, runId, { state: 'ready' }, user)
    if (body.rows.length === 0) return done
    const { status, body: confirmed } = await postConfirm(
      db,
      runId,
      body.rows.map((row) => ({ rowId: row.id, version: row.version, key: historyKey() })),
      user,
    )
    if (status !== 200) throw new Error(`confirm failed: ${status} ${JSON.stringify(confirmed)}`)
    const failed = confirmed.results.filter((result) => result.status === 'error')
    if (failed.length) throw new Error(`confirm item failed: ${JSON.stringify(failed)}`)
    done.push(...confirmed.results)
  }
  throw new Error('confirmAllReady did not converge')
}

/** Every row of the run in ordinal order, whatever its state. */
export async function snapshot(db: D1Database, runId: string, user: Who = USER) {
  const rows = [
    ...(await allRows(db, runId, 'open', user)),
    ...(await allRows(db, runId, 'done', user)),
  ]
  return rows.sort((a, b) => a.ordinal - b.ordinal)
}

export async function flightIdsOf(db: D1Database, userId: string = USER.id) {
  const { results } = await db
    .prepare('SELECT id FROM flights WHERE user_id = ? ORDER BY id')
    .bind(userId)
    .all<{ id: number }>()
  return results.map((row) => row.id)
}

export async function getFlight(db: D1Database, id: number, user: Who = USER) {
  return reply(
    await flightGet(
      context(db, new Request(`${testOrigin}/api/flights/${id}`), user, { id: String(id) }),
    ),
  )
}

export async function patchFlight(db: D1Database, id: number, body: unknown, user: Who = USER) {
  return reply(
    await flightPatch(
      context(db, csrfRequest(`/api/flights/${id}`, 'PATCH', body), user, { id: String(id) }),
    ),
  )
}

export async function deleteFlight(db: D1Database, id: number, user: Who = USER) {
  return reply(
    await flightDelete(
      context(db, csrfRequest(`/api/flights/${id}`, 'DELETE'), user, { id: String(id) }),
    ),
  )
}

export async function bulkDelete(db: D1Database, ids: number[], user: Who = USER) {
  return reply(
    await bulkDeletePost(
      context(db, csrfRequest('/api/flights/bulk-delete', 'POST', { ids }), user),
    ),
  )
}

/** A manual flight through the ordinary create route. */
export async function createFlight(
  db: D1Database,
  body: Record<string, unknown>,
  user: Who = USER,
) {
  return reply(
    await flightPost(
      context(
        db,
        csrfRequest('/api/flights', 'POST', body, { 'Idempotency-Key': historyKey() }),
        user,
      ),
    ),
  )
}
