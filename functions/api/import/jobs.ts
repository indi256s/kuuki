// POST /api/import/jobs — start a persisted import batch (ADR 0001 §6, C5).
// Same gates as /api/import/parse (CSRF, auth, the shared `import-parse:` rate limit) and the same extraction, but the
// result is a server-owned batch of review drafts the member can reload, edit and convert. Idempotent on
// `submissionOperationId`: a replay returns the stored batch and never calls the provider again.
import { type ParseRequest } from './_shared'
import { MAX_IMPORT_BODY_BYTES, validateImportSource } from './_extract'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, json, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'
import { isIdempotencyKey } from '../_services/flightCreate'
import { sanitizeSourceLabel } from '../_services/importDrafts'
import { submitImport } from '../_services/importJob'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  importJobRequest(context.request, context.env, context.data)

interface JobRequest extends Partial<ParseRequest> {
  submissionOperationId?: unknown
  sourceLabel?: unknown
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
      let source: ParseRequest
      try {
        source = validateImportSource(body)
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
      const operationId = body?.submissionOperationId
      if (!isIdempotencyKey(operationId))
        throw new HttpError(
          400,
          'submissionOperationId must be 8-128 characters',
          'INVALID_OPERATION_ID',
        )

      const { created, snapshot } = await submitImport(
        env,
        source,
        {
          userId: user.id,
          operationId,
          sourceLabel: sanitizeSourceLabel(source.type, body?.sourceLabel),
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
