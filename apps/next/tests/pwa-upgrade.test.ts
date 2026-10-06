import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
// Reproduce the old root navigation fallback and its cache ownership without building a retired app.
const oldHTML = `<!doctype html><html><body>Old shell<script src="/assets/old.js"></script>
<script src="/registerSW.js"></script></body></html>`
const oldWorker = `
self.addEventListener('install', event => event.waitUntil((async () => {
  await (await caches.open('workbox-precache-v2-' + self.registration.scope)).add('/')
  for (const name of ['workbox-runtime-' + self.registration.scope, 'assets-cache', 'google-fonts-cache', 'gstatic-fonts-cache']) await caches.open(name)
  await self.skipWaiting()
})()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(caches.match('/'))
})
`

test('installed root PWA reaches Next and retires its worker, preserving unrelated storage', async ({ page, baseURL }) => {
  let stage: 'old' | 'next' = 'old'
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://127.0.0.1').pathname
      if (stage === 'next') {
        const upstream = await fetch(new URL(req.url!, baseURL), { headers: req.headers as Record<string, string>, redirect: 'manual' })
        const headers = new Headers(upstream.headers)
        headers.delete('content-encoding')
        headers.delete('content-length')
        headers.delete('transfer-encoding')
        res.writeHead(upstream.status, Object.fromEntries(headers))
        res.end(Buffer.from(await upstream.arrayBuffer()))
        return
      }
      if (stage === 'old' && path === '/overview') { res.writeHead(404); res.end('No Next route yet'); return }
      if (path.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"user":null}'); return }
      if (path === '/sw.js' || path === '/registerSW.js') {
        const body = path === '/sw.js' ? oldWorker : "navigator.serviceWorker.register('/sw.js')"
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
        res.end(body)
        return
      }
      res.writeHead(200, { 'Content-Type': path === '/assets/old.js' ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' })
      res.end(path === '/assets/old.js' ? '' : oldHTML)
    } catch { if (!res.headersSent) res.writeHead(404); res.end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Legacy PWA fixture has no TCP address')
  const origin = `http://127.0.0.1:${address.port}`
  try {
    await page.goto(`${origin}/`)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      await caches.open('unrelated-user-cache')
      localStorage.setItem('unrelated-user-preference', 'preserve')
    })
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    const oldFallback = await page.goto(`${origin}/overview`, { waitUntil: 'domcontentloaded' })
    expect(oldFallback!.fromServiceWorker()).toBe(true)
    expect(await oldFallback!.text()).toContain('/assets/')
    stage = 'next'
    // The cached old shell now fetches the deployed registration script, which updates and reloads it.
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toBeVisible()
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
    // Unregistering leaves the current document controlled until its next navigation.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(async () => caches.keys())).toEqual(['unrelated-user-cache'])
    expect(await page.evaluate(() => localStorage.getItem('unrelated-user-preference'))).toBe('preserve')
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
    const document = await page.request.get(`${origin}/overview`)
    expect(await document.text()).not.toContain('src="/assets/')
    expect(document.headers()['cache-control']).toContain('no-store')
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
