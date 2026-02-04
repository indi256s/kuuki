import { getJob, type ParseResponse } from '../_shared'

interface Env {
  IMPORT_JOBS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const jobId = context.params.jobId as string

  if (!jobId) {
    return Response.json(
      { error: 'Job ID required', flights: [] } as ParseResponse,
      { status: 400, headers: corsHeaders }
    )
  }

  const kv = context.env.IMPORT_JOBS
  const job = await getJob(kv, jobId)

  if (!job) {
    return Response.json(
      { error: 'Job not found or expired', flights: [] } as ParseResponse,
      { status: 404, headers: corsHeaders }
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

  return Response.json(response, { headers: corsHeaders })
}
