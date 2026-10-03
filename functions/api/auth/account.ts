// DELETE /api/auth/account — permanently delete the authenticated user's account.
//
// Re-authentication is enforced HERE on the server: the request body must carry the current
// password, which is verified before anything is deleted (the client dialog is not trusted).
// All owned rows are deleted explicitly (D1 FK cascade is not guaranteed) in a single
// batch, then cookies are cleared. Deleting the sessions rows (inside the cascade) revokes every session.

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { deleteUserCascade, getPasswordHashById, parsePassword } from '../_lib/users'
import { verifyPassword } from '../_lib/crypto'
import { clearSessionCookies } from '../_lib/authCookies'
import { clearBetterAuthCookie } from '../_lib/betterAuth'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    // Re-auth enforced server-side: prove knowledge of the current password before this
    // irreversible deletion (security finding: delete re-auth was client-side only).
    const body = await readJson<{ password?: string }>(request)
    const password = parsePassword(body?.password, 'current')
    const hash = await getPasswordHashById(env.DB, user.id)
    if (!hash || !(await verifyPassword(password, hash, env.AUTH_SECRET))) {
      throw new HttpError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
    }

    await deleteUserCascade(env.DB, user.id)

    const res = json({ ok: true })
    clearSessionCookies(res.headers)
    clearBetterAuthCookie(res.headers, request)
    return res
  })
