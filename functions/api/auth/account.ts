// DELETE /api/auth/account — permanently delete the authenticated user's account.
//
// The client is expected to gate this behind POST /api/auth/verify-password (re-auth).
// All owned rows are deleted explicitly (D1 FK cascade is not guaranteed) in a single
// batch, then the user's in-flight KV import jobs are purged best-effort, then cookies
// are cleared. Deleting the sessions rows (inside the cascade) revokes every session.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { deleteUserCascade } from '../_lib/users'
import { clearSessionCookies } from '../_lib/authCookies'
import type { ImportJob } from '../import/_shared'

/** Best-effort purge of the user's KV import jobs. Never throws (jobs self-expire via TTL). */
async function purgeImportJobs(kv: KVNamespace, userId: string): Promise<void> {
  try {
    const { keys } = await kv.list({ prefix: 'job:' })
    await Promise.all(
      keys.map(async ({ name }) => {
        const raw = await kv.get(name)
        if (!raw) return
        const job = JSON.parse(raw) as ImportJob
        if (job.ownerId === userId) await kv.delete(name)
      }),
    )
  } catch (err) {
    console.error(JSON.stringify({ event: 'purge_import_jobs_failed', error: String(err) }))
  }
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    await deleteUserCascade(env.DB, user.id)
    await purgeImportJobs(env.IMPORT_JOBS, user.id)

    const res = json({ ok: true })
    clearSessionCookies(res.headers)
    return res
  })
