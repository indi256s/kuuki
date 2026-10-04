import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, resolve } from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

test('installed root PWA retires before Next routing, preserving unrelated storage', async ({ page, baseURL }) => {
  let stage: 'old' | 'retire' | 'next' = 'old'
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
      const transition = stage === 'retire' && (path === '/sw.js' || path === '/registerSW.js')
      const directory = transition ? 'apps/web/transition' : 'apps/web/dist'
      const relative = path === '/' || !extname(path) ? '/index.html' : path
      const file = resolve(root, directory, `.${relative}`)
      if (!file.startsWith(resolve(root, directory) + '/')) throw new Error('Invalid asset')
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
      res.end(body)
    } catch { if (!res.headersSent) res.writeHead(404); res.end() }
  })
  await new Promise<void>(resolve => server.listen(8811, '127.0.0.1', resolve))
  try {
    await page.goto('http://127.0.0.1:8811/')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      await caches.open('unrelated-user-cache')
      localStorage.setItem('unrelated-user-preference', 'preserve')
    })
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    const oldFallback = await page.goto('http://127.0.0.1:8811/overview', { waitUntil: 'domcontentloaded' })
    expect(oldFallback!.fromServiceWorker()).toBe(true)
    expect(await oldFallback!.text()).toContain('/assets/')
    stage = 'retire'
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update() })
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
    expect(await page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith('workbox-precache') || key.startsWith('workbox-runtime')))).toEqual([])
    expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-user-cache'))).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('unrelated-user-preference'))).toBe('preserve')
    stage = 'next'
    await page.goto('http://127.0.0.1:8811/')
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
    const document = await page.request.get('http://127.0.0.1:8811/overview')
    expect(await document.text()).not.toContain('src="/assets/')
    expect(document.headers()['cache-control']).toContain('no-store')
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
