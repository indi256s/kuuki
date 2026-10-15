import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

let fixtureDir: string | undefined

afterEach(() => {
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true })
  fixtureDir = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function reviewFile() {
  fixtureDir = mkdtempSync(join(tmpdir(), 'stamp-review-'))
  const parent = join(fixtureDir, 'src/lib/stamp-art')
  mkdirSync(parent, { recursive: true })
  const file = join(parent, 'review.json')
  writeFileSync(file, '{}\n')
  vi.spyOn(process, 'cwd').mockReturnValue(fixtureDir)
  return file
}

const post = (body: unknown) =>
  POST(
    new Request('http://localhost:3000/dev/stamps/review', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3000',
        origin: 'http://127.0.0.1:3000',
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    }),
  )

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

  it('rejects unsafe request origins and media types before reading the body or file', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const file = reviewFile()
    const cwd = vi.mocked(process.cwd)
    cwd.mockClear()
    for (const [origin, host, contentType, status] of [
      ['http://attacker.example', '127.0.0.1:3000', 'text/plain', 403],
      ['http://attacker.example', '127.0.0.1:3000', 'application/json', 403],
      ['http://attacker.example:3000', 'attacker.example:3000', 'application/json', 403],
      ['http://127.0.0.1:3001', '127.0.0.1:3001', 'application/json', 403],
      ['https://127.0.0.1:3000', '127.0.0.1:3000', 'application/json', 403],
      ['null', '127.0.0.1:3000', 'application/json', 403],
      [null, '127.0.0.1:3000', 'application/json', 403],
      ['http://127.0.0.1:3000', '127.0.0.1:3000', 'text/plain', 415],
      ['http://127.0.0.1:3000', '127.0.0.1:3000', null, 415],
    ] as const) {
      const headers = new Headers({ host })
      if (origin !== null) headers.set('origin', origin)
      if (contentType !== null) headers.set('content-type', contentType)
      const request = new Request('http://localhost:3000/dev/stamps/review', {
        method: 'POST',
        headers,
        body: JSON.stringify({ iso2: 'JP', status: 'redo', note: 'foreign write' }),
      })
      const json = vi.spyOn(request, 'json')
      expect((await POST(request)).status).toBe(status)
      expect(json).not.toHaveBeenCalled()
      expect(cwd).not.toHaveBeenCalled()
      expect(readFileSync(file, 'utf8')).toBe('{}\n')
    }
  })

  it('preserves concurrent marks and exposes only complete JSON during publication', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const file = reviewFile()
    const writes = ['JP', 'TH', 'GE', 'FR', 'DE', 'GB'].map((iso2) =>
      post({ iso2, status: 'accepted' }),
    )
    const reads = Array.from({ length: 20 }, async () => {
      expect(await (await GET()).json()).toBeTypeOf('object')
    })
    const [responses] = await Promise.all([Promise.all(writes), Promise.all(reads)])
    for (const response of responses) expect(response.status).toBe(200)
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8'))).sort()).toEqual([
      'DE',
      'FR',
      'GB',
      'GE',
      'JP',
      'TH',
    ])
  })

  it('writes only review.json, sorted, two-space JSON with a trailing newline', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
    const file = reviewFile()
    expect((await post({ iso2: 'TH', status: 'redo', note: ' thinner roof ' })).status).toBe(200)
    expect((await post({ iso2: 'JP', status: 'accepted' })).status).toBe(200)
    expect(readFileSync(file, 'utf8')).toBe(
      '{\n  "JP": {\n    "status": "accepted",\n    "at": "2026-10-14"\n  },\n  "TH": {\n    "status": "redo",\n    "note": "thinner roof",\n    "at": "2026-10-14"\n  }\n}\n',
    )
    expect((await post({ iso2: 'JP', status: null })).status).toBe(200)
    expect(JSON.parse(readFileSync(file, 'utf8'))).not.toHaveProperty('JP')
    expect((await post({ iso2: 'JP', status: null, note: 'later' })).status).toBe(200)
    const noteOnly = JSON.parse(readFileSync(file, 'utf8'))
    expect(noteOnly.JP).toEqual({ note: 'later', at: '2026-10-14' })
    expect(readdirSync(join(fixtureDir!, 'src/lib/stamp-art'))).toEqual(['review.json'])
  })
})
