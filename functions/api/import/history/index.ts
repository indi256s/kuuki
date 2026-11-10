// GET /api/import/history — the owner's Flighty imports (latest 20, summaries only).
// POST /api/import/history — open a run for one parsed CSV, idempotent on `operationId` (ADR 0008).
import { json, readJson, runHandler } from '../../_lib/http'
import { rateLimit } from '../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { createRun, listRuns, parseCreateRun } from '../../_services/historyImport'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json({ runs: await listRuns(context.env.DB, user.id) })
  })

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import-run:${user.id}`, 10, 3600)
    const request = parseCreateRun(
      await readJson<unknown>(context.request, { maxBytes: 32 * 1024 }),
    )
    const { run, replayed } = await createRun(context.env.DB, user.id, request)
    return json({ run }, { status: replayed ? 200 : 201 })
  })
