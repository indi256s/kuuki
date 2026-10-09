import { runHandler, readJson, json, HttpError } from '../../_lib/http'
import { requireStrictSameOrigin } from '../../_lib/auth'
import { rateLimit, clientIp } from '../../_lib/ratelimit'
import { activationEmailKey, requestActivation } from '../../_lib/activation'
import { configuredActivationSender, configuredActivationOrigin } from '../../_lib/activationSender'
import { EMAIL_RE } from '../../_lib/users'

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const response = await runHandler(async () => {
    const { request, env } = context
    requireStrictSameOrigin(request)
    // Configuration is checked before lookup so all account states fail identically.
    const activationOrigin = configuredActivationOrigin(env)
    if (activationOrigin === new URL(request.url).origin) {
      throw new HttpError(
        503,
        'Account activation is temporarily unavailable',
        'ACTIVATION_UNAVAILABLE',
      )
    }
    const sender = configuredActivationSender(env)
    await rateLimit(env.DB, `activation-ip:${clientIp(request)}`, 10, 3600)
    const body = await readJson<{ email?: unknown }>(request)
    const email = body?.email
    if (typeof email !== 'string' || email.length > 320 || !EMAIL_RE.test(email.trim())) {
      throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    }
    const emailKey = await activationEmailKey(email, env.AUTH_SECRET)
    await rateLimit(env.DB, `activation-email:${emailKey}`, 3, 3600)
    // Keep lookup and delivery out of the account-dependent response path. Pages
    // keeps this task alive after the generic response has been returned.
    context.waitUntil(
      requestActivation(env.DB, email, activationOrigin, sender).catch(() => {
        console.error(JSON.stringify({ event: 'activation_request_failed' }))
      }),
    )
    return json({ ok: true })
  })
  response.headers.set('Cache-Control', RESPONSE_HEADERS['Cache-Control'])
  response.headers.set('Referrer-Policy', RESPONSE_HEADERS['Referrer-Policy'])
  return response
}
