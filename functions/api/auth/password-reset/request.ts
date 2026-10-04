import { runHandler, readJson, json, HttpError } from '../../_lib/http'
import { requireStrictSameOrigin } from '../../_lib/auth'
import { rateLimit, clientIp } from '../../_lib/ratelimit'
import { recoveryEmailKey, configuredRecoveryOrigin, requestPasswordRecovery } from '../../_lib/passwordRecovery'
import { configuredRecoverySender } from '../../_lib/activationSender'
import { EMAIL_RE } from '../../_lib/users'

export async function requestPasswordReset(request: Request, env: Env, waitUntil: (task: Promise<unknown>) => void): Promise<Response> {
  const response = await runHandler(async () => {
    requireStrictSameOrigin(request)
    const origin = configuredRecoveryOrigin(env)
    // Check sender configuration before account lookup to keep the public result generic.
    const sender = configuredRecoverySender(env)
    await rateLimit(env.DB, `recovery-ip:${clientIp(request)}`, 10, 3600)
    const body = await readJson<{ email?: unknown }>(request)
    const email = body?.email
    if (typeof email !== 'string' || email.length > 320 || !EMAIL_RE.test(email.trim())) {
      throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    }
    const key = await recoveryEmailKey(email, env.AUTH_SECRET)
    await rateLimit(env.DB, `recovery-email:${key}`, 3, 3600)
    waitUntil(requestPasswordRecovery(env.DB, email, origin, sender).catch(() => {
      console.error(JSON.stringify({ event: 'recovery_request_failed' }))
    }))
    return json({ ok: true })
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  requestPasswordReset(request, env, waitUntil)
