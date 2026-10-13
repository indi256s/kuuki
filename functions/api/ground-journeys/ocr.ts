import { MAX_IMPORT_BODY_BYTES } from '../import/_extract'
import { admitRailFile, extractRailTickets } from '../_services/railTicketOcr'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  recognizeRailTickets(context.request, context.env, context.data)

/**
 * POST /api/ground-journeys/ocr: one base64 file per request, `{ content }`. The declared type, if any, is
 * ignored: the file signature decides. Nothing is stored; each accepted file spends one shared provider call.
 */
export async function recognizeRailTickets(
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
      const body = await readJson<{ content?: unknown }>(request, {
        maxBytes: MAX_IMPORT_BODY_BYTES,
      })
      if (!body || typeof body !== 'object')
        throw new HttpError(400, 'Invalid request body', 'INVALID_BODY')
      const file = admitRailFile(body.content)
      // Counted only after admission, so files refused for type or size spend no provider call. This is the
      // import quota itself, not a parallel one: rail OCR cannot be used to bypass it.
      await rateLimit(env.DB, `import-parse:${user.id}`, 20, 3600)
      return Response.json(await extractRailTickets(env, file), { headers: cors })
    },
    { headers: cors, fields: { candidates: [], warnings: [] } },
  )
}
