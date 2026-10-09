import { HttpError } from './http'

export interface MailSender {
  send(to: string, link: string): Promise<void>
}

/** Dedicated static activation host; keep it separate from the main application's origin. */
export function configuredActivationOrigin(env: Env): string {
  const raw = env.ACTIVATION_ORIGIN
  let origin: URL
  let main: URL
  try {
    origin = new URL(raw ?? '')
    main = new URL(env.PAGES_ORIGIN)
  } catch {
    throw new HttpError(
      503,
      'Account activation is temporarily unavailable',
      'ACTIVATION_UNAVAILABLE',
    )
  }
  if (
    origin.protocol !== 'https:' ||
    raw !== origin.origin ||
    main.protocol !== 'https:' ||
    origin.origin === main.origin
  ) {
    throw new HttpError(
      503,
      'Account activation is temporarily unavailable',
      'ACTIVATION_UNAVAILABLE',
    )
  }
  return origin.origin
}

const SENDER_FAILURE = 'Activation sender failed'
const MAX_RESPONSE_BYTES = 16 * 1024

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  )
}

async function readBoundedResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error(SENDER_FAILURE)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      void reader.cancel().catch(() => {})
      throw new Error(SENDER_FAILURE)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

function acknowledged(response: unknown, to: string): boolean {
  if (!response || typeof response !== 'object') return false
  const envelope = response as Record<string, unknown>
  if (envelope.success !== true || !Array.isArray(envelope.errors) || envelope.errors.length !== 0)
    return false
  const result = envelope.result
  if (!result || typeof result !== 'object') return false
  const statuses = result as Record<string, unknown>
  if (
    !Array.isArray(statuses.delivered) ||
    !Array.isArray(statuses.queued) ||
    !Array.isArray(statuses.permanent_bounces) ||
    statuses.permanent_bounces.length !== 0
  )
    return false
  const recipients = [...statuses.delivered, ...statuses.queued]
  return (
    recipients.length > 0 &&
    recipients.every(
      (recipient) => typeof recipient === 'string' && recipient.toLowerCase() === to.toLowerCase(),
    )
  )
}

const MAIL = {
  activation: {
    unavailable: 'Account activation is temporarily unavailable',
    code: 'ACTIVATION_UNAVAILABLE',
    subject: 'Activate your Kuuki account',
    action: 'Activate account',
  },
  recovery: {
    unavailable: 'Password recovery is temporarily unavailable',
    code: 'RECOVERY_UNAVAILABLE',
    subject: 'Reset your Kuuki password',
    action: 'Reset password',
  },
}

/** Use Cloudflare Email Sending only when its account and verified sender are configured. */
function configuredMailSender(env: Env, purpose: keyof typeof MAIL): MailSender {
  const mail = MAIL[purpose]
  const accountId = env.ACTIVATION_MAIL_ACCOUNT_ID
  const bearer = env.ACTIVATION_MAIL_AUTH_TOKEN
  const from = env.ACTIVATION_MAIL_FROM
  const binding = env.ACTIVATION_MAIL
  if (
    !from ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from) ||
    (!binding && (!accountId || !/^[0-9a-f]{32}$/i.test(accountId) || !bearer || /\s/.test(bearer)))
  ) {
    throw new HttpError(503, mail.unavailable, mail.code)
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`
  return {
    async send(to, link) {
      const controller = new AbortController()
      const timer = binding ? undefined : setTimeout(() => controller.abort(), 10_000)
      let status: number | undefined
      let errorCodes: number[] = []
      try {
        const message = {
          from,
          to: [to],
          subject: mail.subject,
          text: `${mail.subject} using this link:\n\n${link}\n`,
          html: `<p>${mail.subject} using this link:</p><p><a href="${escapeHtml(link)}">${mail.action}</a></p>`,
        }
        if (binding) {
          // Native sends cannot be cancelled: wait for acknowledgement before invalidating an issued link.
          const receipt = await binding.send(message)
          if (typeof receipt?.messageId !== 'string' || receipt.messageId.length === 0)
            throw new Error(SENDER_FAILURE)
          return
        }
        const response = await fetch(url, {
          method: 'POST',
          // workerd supports manual/follow only; !response.ok rejects redirects.
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
          body: JSON.stringify(message),
        })
        status = response.status
        const receipt = await readBoundedResponse(response)
        const errors =
          receipt && typeof receipt === 'object'
            ? (receipt as Record<string, unknown>).errors
            : undefined
        if (Array.isArray(errors)) {
          errorCodes = errors.flatMap((error) =>
            error && typeof error.code === 'number' && Number.isFinite(error.code)
              ? [error.code]
              : [],
          )
        }
        if (!response.ok || !acknowledged(receipt, to)) throw new Error(SENDER_FAILURE)
      } catch {
        // Provider bodies and transport errors can contain addresses, links, or credentials.
        console.error(
          JSON.stringify({
            event: 'mail_send_failed',
            purpose,
            status,
            errorCodes,
            reason: controller.signal.aborted
              ? 'timeout'
              : binding
                ? 'binding'
                : status === undefined
                  ? 'transport'
                  : 'response',
          }),
        )
        throw new Error(SENDER_FAILURE)
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export function configuredActivationSender(env: Env): MailSender {
  return configuredMailSender(env, 'activation')
}

export function configuredRecoverySender(env: Env): MailSender {
  return configuredMailSender(env, 'recovery')
}
