import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, parseUpdate, serializeReview } from '../review-store'
import { POST } from './route'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const post = (body: unknown) =>
  POST(new Request('http://x/dev/stamps/review', { method: 'POST', body: JSON.stringify(body) }))

describe('stamp review route', () => {
  it('is a 404 in production before it reads or writes anything', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const cwd = vi.spyOn(process, 'cwd')
    expect((await post({ iso2: 'JP', status: 'accepted' })).status).toBe(404)
    expect(cwd).not.toHaveBeenCalled()
  })

  it('rejects bodies that would write anything but a valid mark', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (const body of [
      { iso2: '../etc', status: 'accepted' },
      { iso2: 'jp', status: 'accepted' },
      { iso2: 'JP', status: 'maybe' },
      { iso2: 'JP', status: 'redo', note: 'x'.repeat(2001) },
      null,
    ])
      expect((await post(body)).status).toBe(400)
  })

  it('writes only review.json, sorted, two-space JSON with a trailing newline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'review-'))
    const file = join(dir, 'review.json')
    writeFileSync(file, '{}\n')
    const update = parseUpdate({ iso2: 'TH', status: 'redo', note: ' thinner roof ' })!
    const a = applyUpdate({}, update, '2026-10-14')
    const b = applyUpdate(a, parseUpdate({ iso2: 'JP', status: 'accepted' })!, '2026-10-14')
    writeFileSync(file, serializeReview(b))
    expect(readFileSync(file, 'utf8')).toBe(
      '{\n  "JP": {\n    "status": "accepted",\n    "at": "2026-10-14"\n  },\n  "TH": {\n    "status": "redo",\n    "note": "thinner roof",\n    "at": "2026-10-14"\n  }\n}\n',
    )
    expect(applyUpdate(b, { iso2: 'JP', status: null }, '2026-10-14')).not.toHaveProperty('JP')
    const noteOnly = applyUpdate(b, { iso2: 'JP', status: null, note: 'later' }, '2026-10-14')
    expect(noteOnly.JP).toEqual({ note: 'later', at: '2026-10-14' })
  })
})
