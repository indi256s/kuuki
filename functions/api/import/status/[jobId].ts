import { getJob, type ParseResponse } from '../_shared'
import { corsHeaders, corsPreflight } from '../../_lib/cors'
import type { RequestData } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(request, env, 'GET, OPTIONS')

  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'GET, OPTIONS')
  }

  // Auth gate — keep job polling private to signed-in users
  const user = (context.data && context.data.user) || null
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required', code: 'UNAUTHENTICATED', flights: [] }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const jobId = context.params.jobId as string

  if (!jobId) {
    return Response.json(
      { error: 'Job ID required', flights: [] } as ParseResponse,
      { status: 400, headers: cors }
    )
  }

  const kv = context.env.IMPORT_JOBS
  const job = await getJob(kv, jobId)

  if (!job) {
    return Response.json(
      { error: 'Job not found or expired', flights: [] } as ParseResponse,
      { status: 404, headers: cors }
    )
  }

  // Ownership: jobs are per-user. Return 404 (not 403) for someone else's job so existence
  // isn't disclosed — indistinguishable from the not-found branch above.
  if (job.ownerId !== user.id) {
    return Response.json(
      { error: 'Job not found or expired', flights: [] } as ParseResponse,
      { status: 404, headers: cors }
    )
  }

  // Return job status and results
  const response: ParseResponse = {
    flights: job.flights || [],
    status: job.status,
    jobId: job.id,
    ...(job.error && { error: job.error }),
    ...(job.rejected && { rejected: job.rejected }),
    ...(job.gemini_count && { gemini_count: job.gemini_count }),
    ...(job.cleaned_text && { cleaned_text: job.cleaned_text }),
  }

  return Response.json(response, { headers: cors })
}
