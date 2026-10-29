import { expect, it } from 'vitest'
import { airportCatalog } from './catalog.generated'
import { immutableAirportAsset } from './asset-policy'

it('rejects unsafe delivery of allowlisted airport assets', () => {
  const path = airportCatalog[0]!.model
  const request = (method = 'GET') => new Request(`https://kuuki.test${path}`, { method })
  const response = (status = 200, mime: string | null = 'application/json', cookie = false) =>
    new Response(null, {
      status,
      headers: {
        ...(mime ? { 'Content-Type': mime } : {}),
        ...(cookie ? { 'Set-Cookie': 'session=private' } : {}),
      },
    })
  for (const [req, res] of [
    [request('POST'), response()],
    [request(), response(404)],
    [request(), response(200, 'text/html')],
    [request(), response(304, 'text/html')],
    [request(), response(200, null)],
    [request(), response(200, 'application/json', true)],
  ] as const)
    expect(immutableAirportAsset(req, res)).toBe(false)
})
