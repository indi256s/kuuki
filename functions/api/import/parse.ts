import { type ParseRequest, type ParseResponse } from './_shared'
import { MAX_IMPORT_BODY_BYTES, extractFlights, validateImportSource } from './_extract'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  parseImportRequest(context.request, context.env, context.data)

/** Real Request/Response transport entry; provider execution remains single-call. */
export async function parseImportRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  const cors = corsHeaders(request, env, 'POST, OPTIONS')

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'POST, OPTIONS')
  }

  return runHandler(
    async () => {
      // CSRF: state-changing, paid-quota endpoint — require same-origin + double-submit token.
      requireCsrf(request)
      // Auth gate — burns paid Gemini quota, so reject anonymous callers
      const user = requireUser(data)
      // Keep the shared per-user import limit, including requests that require paid recognition.
      await rateLimit(env.DB, `import-parse:${user.id}`, 20, 3600)

      const body = await readJson<Partial<ParseRequest>>(request, {
        maxBytes: MAX_IMPORT_BODY_BYTES,
      })
      const result: ParseResponse = await extractFlights(env, validateImportSource(body))

      return Response.json(result, { headers: cors })
    },
    { headers: cors, fields: { flights: [] } },
  )
}
