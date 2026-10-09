import { runHandler, readJson, json, HttpError } from '../../_lib/http'
import { requireStrictSameOrigin } from '../../_lib/auth'
import { rateLimit, clientIp } from '../../_lib/ratelimit'
import { activationEmailKey, requestActivation } from '../../_lib/activation'
import {
  configuredActivationOrigin,
  configuredActivationSender,
  configuredRecoverySender,
} from '../../_lib/activationSender'
import { configuredRecoveryOrigin, requestPasswordRecovery } from '../../_lib/passwordRecovery'
import { EMAIL_RE, getUserByEmail } from '../../_lib/users'

/**
 * The single "get back in" link. The caller never learns the account state: the
 * response is always the generic `{ ok: true }`, and the lookup that picks the
 * activation or reset email runs in the background.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const response = await runHandler(async () => {
    requireStrictSameOrigin(request)
    // Every configuration check runs before any lookup so the 503 never depends on account state.
    const activationOrigin = configuredActivationOrigin(env)
    if (activationOrigin === new URL(request.url).origin) {
      throw new HttpError(
        503,
        'Account activation is temporarily unavailable',
        'ACTIVATION_UNAVAILABLE',
      )
    }
    const activationSender = configuredActivationSender(env)
    const recoveryOrigin = configuredRecoveryOrigin(env)
    const recoverySender = configuredRecoverySender(env)
    await rateLimit(env.DB, `link-ip:${clientIp(request)}`, 10, 3600)
    const body = await readJson<{ email?: unknown }>(request)
    const email = body?.email
    if (typeof email !== 'string' || email.length > 320 || !EMAIL_RE.test(email.trim())) {
      throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    }
    const key = await activationEmailKey(email, env.AUTH_SECRET)
    await rateLimit(env.DB, `link-email:${key}`, 3, 3600)
    waitUntil(
      sendLink(
        env.DB,
        email,
        activationOrigin,
        activationSender,
        recoveryOrigin,
        recoverySender,
      ).catch(() => {
        console.error(JSON.stringify({ event: 'link_request_failed' }))
      }),
    )
    return json({ ok: true })
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

async function sendLink(
  db: D1Database,
  email: string,
  activationOrigin: string,
  activationSender: Parameters<typeof requestActivation>[3],
  recoveryOrigin: string,
  recoverySender: Parameters<typeof requestPasswordRecovery>[3],
): Promise<void> {
  const user = await getUserByEmail(db, email)
  if (!user) return
  // Each helper re-checks the account state, so a stale choice here cannot send the wrong link.
  if (user.password_hash === 'RESET_REQUIRED')
    await requestActivation(db, email, activationOrigin, activationSender)
  else await requestPasswordRecovery(db, email, recoveryOrigin, recoverySender)
}
