// POST /api/import/jobs — start a persisted import batch (ADR 0001 §6, C5).
// Same gates as /api/import/parse (CSRF, auth, the shared `import-parse:` rate limit) and the same extraction, but the
// result is a server-owned batch of review drafts the member can reload, edit and convert. Idempotent on
// `submissionOperationId`: a replay returns the stored batch and never calls the provider again.
// `type: 'boarding_pass'` admits legs the browser decoded itself: validated here, persisted as unverified review drafts
// through the same batch writer, with no provider call and no import job.
import { type ParseRequest } from './_shared'
import { MAX_IMPORT_BODY_BYTES, validateImportSource } from './_extract'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, json, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'
import { isIdempotencyKey } from '../_services/flightCreate'
import { sanitizeSourceLabel, type DraftRowInput } from '../_services/importDrafts'
import { submitImport, type LocalLegs } from '../_services/importJob'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  importJobRequest(context.request, context.env, context.data)

interface JobRequest extends Omit<Partial<ParseRequest>, 'type'> {
  type?: ParseRequest['type'] | 'boarding_pass'
  submissionOperationId?: unknown
  sourceLabel?: unknown
  requireFlownConfirmation?: unknown
  source?: unknown
  legs?: unknown
  incomplete?: unknown
}

const MAX_BOARDING_PASS_LEGS = 8
const invalidPass = (message: string) => new HttpError(400, message, 'INVALID_BOARDING_PASS')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function onlyKeys(value: Record<string, unknown>, allowed: string[], what: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw invalidPass(`Unknown field in ${what}`)
}

function text(value: unknown, pattern: RegExp, name: string, optional = false) {
  if (optional && value === undefined) return undefined
  if (typeof value !== 'string' || !pattern.test(value)) throw invalidPass(`${name} is invalid`)
  return value
}

/** One decoded leg as an unverified draft: no date yet (the member picks the year), no confidence, never preselected. */
function legRow(leg: unknown): DraftRowInput {
  if (!isRecord(leg)) throw invalidPass('Each leg must be an object')
  onlyKeys(leg, ['origin', 'destination', 'airline', 'flightNumber', 'dayOfYear'], 'a leg')
  const origin = text(leg.origin, /^[A-Z]{3}$/, 'origin')!
  const destination = text(leg.destination, /^[A-Z]{3}$/, 'destination')!
  const airline = text(leg.airline, /^[A-Z0-9]{2}$/, 'airline', true)
  const flightNumber = text(leg.flightNumber, /^[0-9]{1,4}[A-Z]?$/, 'flightNumber', true)
  const day = leg.dayOfYear
  if (
    day !== undefined &&
    !(Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 366)
  )
    throw invalidPass('dayOfYear must be an integer from 1 to 366')
  return {
    fields: {
      date: '',
      origin,
      destination,
      airline_iata: airline ?? 'ZZ',
      ...(flightNumber ? { flight_number: flightNumber } : {}),
      ...(airline ? {} : { airline_was_placeholder: true }),
      ...(day === undefined ? {} : { date_ordinal_day: day as number }),
      flown_required: true,
    },
    confidence: null,
    fieldConfidence: null,
    yearExplicit: false,
    selected: false,
  }
}

function boardingPassLegs(body: JobRequest): LocalLegs {
  onlyKeys(
    body as Record<string, unknown>,
    ['type', 'source', 'sourceLabel', 'submissionOperationId', 'legs', 'incomplete'],
    'the boarding pass request',
  )
  if (body.source !== 'image' && body.source !== 'pdf')
    throw invalidPass('source must be image or pdf')
  if (body.incomplete !== undefined && typeof body.incomplete !== 'boolean')
    throw invalidPass('incomplete must be a boolean')
  if (
    !Array.isArray(body.legs) ||
    body.legs.length < 1 ||
    body.legs.length > MAX_BOARDING_PASS_LEGS
  )
    throw invalidPass(`legs must hold 1 to ${MAX_BOARDING_PASS_LEGS} legs`)
  return {
    sourceType: body.source,
    rows: body.legs.map(legRow),
    incomplete: body.incomplete === true,
  }
}

const requireOperationId = (value: unknown) => {
  if (!isIdempotencyKey(value))
    throw new HttpError(
      400,
      'submissionOperationId must be 8-128 characters',
      'INVALID_OPERATION_ID',
    )
  return value
}

/** Real Request/Response transport entry. */
export async function importJobRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  const cors = corsHeaders(request, env, 'POST, OPTIONS')
  if (request.method === 'OPTIONS') return corsPreflight(request, env, 'POST, OPTIONS')

  return runHandler(
    async () => {
      requireCsrf(request)
      const user = requireUser(data)
      await rateLimit(env.DB, `import-parse:${user.id}`, 20, 3600)

      const body = await readJson<JobRequest>(request, { maxBytes: MAX_IMPORT_BODY_BYTES })
      if (body?.type === 'boarding_pass') {
        const operationId = requireOperationId(body.submissionOperationId)
        const legs = boardingPassLegs(body)
        const { created, snapshot } = await submitImport(
          env,
          legs,
          {
            userId: user.id,
            operationId,
            sourceLabel: sanitizeSourceLabel(legs.sourceType, body.sourceLabel),
          },
          new Date(),
        )
        return json(snapshot, { status: created ? 201 : 200, headers: cors })
      }
      let source: ParseRequest
      try {
        source = validateImportSource(body as Partial<ParseRequest> | null)
      } catch (error) {
        if (
          env.IMPORT_JOBS &&
          (body?.type === 'pdf' || body?.type === 'image') &&
          error instanceof HttpError
        )
          throw new HttpError(
            error.status,
            error.message,
            error.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_FILE',
          )
        throw error
      }
      const flown = body?.requireFlownConfirmation
      if (flown !== undefined && (typeof flown !== 'boolean' || (flown && source.type === 'text')))
        throw new HttpError(
          400,
          'requireFlownConfirmation must be a boolean on a pdf or image import',
          'INVALID_BODY',
        )
      const operationId = requireOperationId(body?.submissionOperationId)

      const { created, snapshot } = await submitImport(
        env,
        source,
        {
          userId: user.id,
          operationId,
          sourceLabel: sanitizeSourceLabel(source.type, body?.sourceLabel),
          requireFlownConfirmation: flown === true,
        },
        new Date(),
      )
      if (env.IMPORT_JOBS)
        return json({ batchId: snapshot.batch.id }, { status: 202, headers: cors })
      const status = created ? 201 : snapshot.batch.status === 'processing' ? 202 : 200
      return json(snapshot, { status, headers: cors })
    },
    { headers: cors },
  )
}
