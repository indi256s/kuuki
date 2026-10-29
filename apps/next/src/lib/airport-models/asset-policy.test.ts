import { expect, it } from 'vitest'
import { airportCatalog } from './catalog.generated'
import { immutableAirportAsset } from './asset-policy'

it('admits only exact generated assets with safe delivery headers and methods', () => {
  const path = airportCatalog[0]!.model
  const request = (suffix = path, method = 'GET') =>
    new Request(`https://kuuki.test${suffix}`, { method })
  const response = (status = 200, mime: string | null = 'application/json', cookie = false) =>
    new Response(null, {
      status,
      headers: {
        ...(mime ? { 'Content-Type': mime } : {}),
        ...(cookie ? { 'Set-Cookie': 'session=private' } : {}),
      },
    })
  expect(immutableAirportAsset(request(), response())).toBe(true)
  expect(immutableAirportAsset(request(path, 'HEAD'), response())).toBe(true)
  expect(immutableAirportAsset(request(), response(304, null))).toBe(true)
  for (const [req, res] of [
    [request('/airport-models/model.json'), response()],
    [request(path.replace('model.json', 'missing.json')), response()],
    [request(path, 'POST'), response()],
    [request(), response(404)],
    [request(), response(200, 'text/html')],
    [request(), response(304, 'text/html')],
    [request(), response(200, null)],
    [request(), response(200, 'application/json', true)],
  ] as const)
    expect(immutableAirportAsset(req, res)).toBe(false)
})
