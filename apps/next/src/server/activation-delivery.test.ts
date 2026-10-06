// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileActivationAsset } from '../../../../scripts/activation-asset.mjs'

import { activationAsset } from '../../activation-asset'
import { gateRequest } from '../../../../functions/api/_lib/workerBoundary'

// A generic HTMLRewriter adapter: execute the real Worker route/link policy against parsed asset HTML.
class Rewriter {
  selector = ''
  handler!: { element: (element: { getAttribute: (name: string) => string | null; setAttribute: (name: string, value: string) => void }) => void }
  on(selector: string, handler: Rewriter['handler']) { this.selector = selector; this.handler = handler; return this }
  async transform(response: Response) {
    const document = new DOMParser().parseFromString(await response.text(), 'text/html')
    document.querySelectorAll(this.selector).forEach(element => this.handler.element(element))
    return new Response(document.documentElement.outerHTML, response)
  }
}
afterEach(() => vi.unstubAllGlobals())

it('serves activation aliases with configured main-origin links and unchanged isolation headers', async () => {
  vi.stubGlobal('HTMLRewriter', Rewriter)
  const html = compileActivationAsset(readFileSync(resolve(process.cwd(), 'activation/activate.html'), 'utf8'), readFileSync(resolve(process.cwd(), 'src/app/styles.css'), 'utf8')).replace('</body>', '<a id="unknown" data-primary-path="//untrusted.example" href="#">Untrusted path</a></body>')
  const assets = vi.fn(async () => new Response(html))
  const env = { PAGES_ORIGIN: 'https://primary.example.test', ACTIVATION_ORIGIN: 'https://activation.example.test', ASSETS: { fetch: assets } } as unknown as Env & { ASSETS: Fetcher }
  for (const path of ['/activate', '/activate.html']) {
    const response = await activationAsset(new Request(`https://activation.example.test${path}`), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
    const document = new DOMParser().parseFromString(await response.text(), 'text/html')
    expect(document.getElementById('signin')!.getAttribute('href')).toBe('https://primary.example.test/signin')
    expect(document.getElementById('resend')!.getAttribute('href')).toBe('https://primary.example.test/activation-request')
    expect(document.getElementById('saved')!.getAttribute('href')).toBe('https://primary.example.test/?notice=password-saved')
    expect(document.getElementById('unknown')!.getAttribute('href')).toBe('#')
  }
  const denied = await gateRequest(new Request('https://activation.example.test/activation-request?_rsc=x', { headers: { RSC: '1' } }), env)!
  expect(denied.status).toBe(302)
  expect(new URL(denied.headers.get('Location')!).origin).toBe('https://primary.example.test')
  expect(assets).toHaveBeenCalledTimes(2)
  const invalid = await activationAsset(new Request('https://activation.example.test/activate'), { ...env, PAGES_ORIGIN: 'https://primary.example.test/path' })
  expect(invalid.status).toBe(503)
  expect(invalid.headers.get('Cache-Control')).toBe('no-store')
})
