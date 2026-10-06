import { afterEach, expect, it, vi } from 'vitest'
import { configuredActivationSender } from '../api/_lib/activationSender'

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
const TOKEN = 'synthetic-cloudflare-token'
const RECIPIENT = 'member@example.test'
const LINK = 'https://activate.example.test/activate.html#token=a&b"<c>'
const env = {
  ACTIVATION_MAIL_ACCOUNT_ID: ACCOUNT_ID,
  ACTIVATION_MAIL_AUTH_TOKEN: TOKEN,
  ACTIVATION_MAIL_FROM: 'accounts@mail.example.test',
} as Env

function receipt(result: Record<string, unknown>, errors: unknown[] = []): Response {
  return new Response(JSON.stringify({ success: true, errors, result }))
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('sends Cloudflare Email Sending content and accepts an explicit queued receipt', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(receipt({
    delivered: [], queued: [RECIPIENT], permanent_bounces: [],
  }))

  await configuredActivationSender(env).send(RECIPIENT, LINK)

  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`)
  expect(init?.method).toBe('POST')
  expect(init?.redirect).toBe('manual')
  expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` })
  const body = JSON.parse(String(init?.body)) as {
    from: string; to: string[]; subject: string; text: string; html: string
  }
  expect(body.from).toBe('accounts@mail.example.test')
  expect(body.to).toEqual([RECIPIENT])
  expect(body.subject).toBe('Activate your Kuuki account')
  expect(body.text).toContain(LINK)
  expect(body.html).toContain('href="https://activate.example.test/activate.html#token=a&amp;b&quot;&lt;c&gt;"')
  expect(body.html).not.toContain(LINK)
})

it.each([
  ['provider error', receipt({ delivered: [RECIPIENT], queued: [], permanent_bounces: [] }, [{ message: 'secret link' }])],
  ['provider rejection on HTTP 200', new Response(JSON.stringify({ success: false, errors: [], result: { delivered: [RECIPIENT], queued: [], permanent_bounces: [] } }))],
  ['permanent bounce', receipt({ delivered: [], queued: [], permanent_bounces: [RECIPIENT] })],
  ['missing recipient', receipt({ delivered: ['other@example.test'], queued: [], permanent_bounces: [] })],
  ['empty receipt', receipt({ delivered: [], queued: [], permanent_bounces: [] })],
  ['malformed receipt', new Response('{invalid')],
  ['oversized receipt', new Response(' '.repeat(16 * 1024 + 1))],
  ['HTTP failure', new Response('secret link', { status: 403 })],
  ['redirect', new Response(null, { status: 302, headers: { Location: 'https://other.example.test' } })],
])('rejects %s without exposing provider content', async (_case, response) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
  await expect(configuredActivationSender(env).send(RECIPIENT, LINK)).rejects.toThrow(/^Activation sender failed$/)
})

it('aborts a stalled provider request at the deadline without exposing its error', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error(`transport failure: ${TOKEN}`)), { once: true })
  }))
  const send = configuredActivationSender(env).send(RECIPIENT, LINK)
  const rejection = expect(send).rejects.toThrow(/^Activation sender failed$/)

  await vi.advanceTimersByTimeAsync(10_000)

  await rejection
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
})

it('logs only the provider status and numeric error codes when sending fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    success: false,
    errors: [{ code: 9109, message: `${TOKEN} ${RECIPIENT} ${LINK}` }, { code: TOKEN }, null],
  }), { status: 403 }))

  await expect(configuredActivationSender(env).send(RECIPIENT, LINK)).rejects.toThrow(/^Activation sender failed$/)

  expect(log).toHaveBeenCalledOnce()
  expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
    event: 'mail_send_failed', purpose: 'activation', status: 403, errorCodes: [9109], reason: 'response',
  })
})

it('rejects incomplete or invalid Cloudflare sender configuration before sending', () => {
  for (const override of [
    { ACTIVATION_MAIL_ACCOUNT_ID: undefined },
    { ACTIVATION_MAIL_ACCOUNT_ID: 'https://sender.example.test/send' },
    { ACTIVATION_MAIL_AUTH_TOKEN: undefined },
    { ACTIVATION_MAIL_FROM: undefined },
  ]) {
    expect(() => configuredActivationSender({ ...env, ...override })).toThrow('Account activation is temporarily unavailable')
  }
})
