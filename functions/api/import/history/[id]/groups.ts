// POST /api/import/history/:id/groups — `{group, answer, revision}`: one answer for every open record of a shared
// question, at the run revision the owner saw (ADR 0008).
import { json, readJson, runHandler } from '../../../_lib/http'
import { rateLimit } from '../../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { answerGroup, parseGroupAnswer } from '../../../_services/historyImportDecisions'
import { loadRun, runSummary } from '../../../_services/historyImport'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    const request = parseGroupAnswer(
      await readJson<unknown>(context.request, { maxBytes: 4 * 1024 }),
    )
    const runId = String(context.params.id)
    const { updated } = await answerGroup(context.env.DB, user.id, runId, request)
    return json({
      updated,
      run: await runSummary(context.env.DB, await loadRun(context.env.DB, user.id, runId)),
    })
  })
