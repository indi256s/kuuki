// DELETE /api/auth/account — permanently delete the authenticated user's account.
//
// Re-authentication is enforced HERE on the server: the request body must carry the current
// password, which is verified before anything is deleted (the client dialog is not trusted).
// All owned rows are deleted explicitly (D1 FK cascade is not guaranteed) in a single
// batch, then the user's in-flight KV import jobs are purged best-effort, then cookies
// are cleared. Deleting the sessions rows (inside the cascade) revokes every session.

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { deleteUserCascade, getPasswordHashById } from '../_lib/users'
import { verifyPassword } from '../_lib/crypto'
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

    // Re-auth enforced server-side: prove knowledge of the current password before this
    // irreversible deletion (security finding: delete re-auth was client-side only).
    const body = await readJson<{ password?: string }>(request)
    if (typeof body?.password !== 'string' || !body.password || body.password.length > 1024) throw new HttpError(400, 'Password is required', 'MISSING_PASSWORD')
    const hash = await getPasswordHashById(env.DB, user.id)
    if (!hash || !(await verifyPassword(body.password, hash, env.AUTH_SECRET))) {
      throw new HttpError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
    }

    await deleteUserCascade(env.DB, user.id)
    await purgeImportJobs(env.IMPORT_JOBS, user.id)

    const res = json({ ok: true })
    clearSessionCookies(res.headers)
    return res
  })
