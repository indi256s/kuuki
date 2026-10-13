import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GroundPlaceOption, GroundPlaceSnapshot } from '../../packages/shared/src/groundTravel'
import { parsePlaceSnapshot } from '../../packages/shared/src/groundTravel'
import { onRequestGet as search } from '../api/ground-places/search'
import {
  onRequestGet as listManual,
  onRequestPost as createManual,
} from '../api/ground-places/manual'
import { catalogSql, placeNameKey } from '../api/_services/groundPlaces'
import { ROOT } from '../../scripts/_cli'
import { apiContext, count, createApiDatabase, csrfRequest, testOrigin } from './harness'

const owner = { id: 'places-owner', email: 'owner@example.test' }
const other = { id: 'places-other', email: 'other@example.test' }
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// Statements in the fixture are one per line; comment lines are documentation.
const fixture = readFileSync(join(ROOT, 'db/seed/ground_places_fixture.sql'), 'utf8')
  .split('\n')
  .filter((line) => line && !line.startsWith('--'))

async function setup({ catalog = true } = {}) {
  const { db, dispose } = await createApiDatabase()
  await db.batch([
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(owner.id, owner.email, 'hash'),
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(other.id, other.email, 'hash'),
  ])
  if (catalog) await db.batch(fixture.map((sql) => db.prepare(sql)))
  return { db, dispose }
}

async function find(
  db: D1Database,
  query: string,
  user: { id: string } | null = owner,
  locale = 'en',
) {
  const url = `${testOrigin}/api/ground-places/search?q=${encodeURIComponent(query)}&locale=${locale}`
  const response = await search({ ...apiContext(db, new Request(url)), data: { user } } as never)
  return response
}

async function results(db: D1Database, query: string, user = owner, locale = 'en') {
  const response = await find(db, query, user, locale)
  expect(response.status).toBe(200)
  return (await response.json()) as GroundPlaceOption[]
}

function post(db: D1Database, body: unknown, user = owner) {
  const request = csrfRequest('/api/ground-places/manual', 'POST', body)
  return createManual({ ...apiContext(db, request), data: { user } } as never)
}

async function manualList(db: D1Database, user = owner) {
  const request = new Request(`${testOrigin}/api/ground-places/manual`)
  const response = await listManual({ ...apiContext(db, request), data: { user } } as never)
  return (await response.json()) as GroundPlaceSnapshot[]
}

const batumi = {
  id: uuid(1),
  name: 'Batumi old port',
  countryCode: 'GE',
  lat: 41.65,
  lon: 41.64,
  timezone: 'Asia/Tbilisi',
}

describe('catalog search', () => {
  it('finds Tbilisi by a Russian and an English prefix with display names and region', async () => {
    const { db, dispose } = await setup()
    try {
      for (const q of ['тбил', 'Tbil', 'ТБИЛИСИ']) {
        expect(await results(db, q)).toEqual([
          {
            source: 'geonames',
            id: '611717',
            name: 'Tbilisi',
            nameRu: 'Тбилиси',
            nameEn: 'Tbilisi',
            countryCode: 'GE',
            region: 'Tbilisi',
            regionRu: 'Тбилиси',
            lat: 41.69143,
            lon: 44.83412,
            timezone: 'Asia/Tbilisi',
            catalogVersion: 'geonames-cities500-20261013',
          },
        ])
      }
    } finally {
      await dispose()
    }
  })

  it('finds a place by a colloquial alias that is not its display name', async () => {
    const { db, dispose } = await setup()
    try {
      const [place] = await results(db, 'kazbe')
      expect(place).toMatchObject({ id: '614087', name: 'Stepantsminda', nameRu: 'Степанцминда' })
      expect((await results(db, 'Казбеги'))[0]?.id).toBe('614087')
    } finally {
      await dispose()
    }
  })

  it('keeps same-name places apart with their country and region, most populous first', async () => {
    const { db, dispose } = await setup()
    try {
      const found = await results(db, 'paris')
      expect(found.map((p) => [p.id, p.countryCode, p.region])).toEqual([
        ['2988507', 'FR', 'Île-de-France'],
        ['4717560', 'US', 'Texas'],
        ['4647963', 'US', 'Tennessee'],
      ])
    } finally {
      await dispose()
    }
  })

  it('returns a place once when several of its aliases match', async () => {
    const { db, dispose } = await setup()
    try {
      await db.exec(
        "INSERT INTO ground_place_names (prefix,name_key,geoname_id,population) VALUES ('par','paris la ville',2988507,2138551)",
      )
      const ids = (await results(db, 'par')).map((p) => p.id)
      expect(ids.filter((id) => id === '2988507')).toHaveLength(1)
    } finally {
      await dispose()
    }
  })

  it('puts exact name matches before more populous prefix matches', async () => {
    const { db, dispose } = await setup()
    try {
      await db.batch([
        db.prepare(
          "INSERT INTO ground_places (geoname_id,name,country_code,latitude,longitude,population,catalog_version) VALUES (999001,'Parisville','CA',45,-70,90000000,'v')",
        ),
        db.prepare(
          "INSERT INTO ground_place_names (prefix,name_key,geoname_id,population) VALUES ('par','parisville',999001,90000000)",
        ),
      ])
      const ids = (await results(db, 'paris')).map((p) => p.id)
      expect(ids).toEqual(['2988507', '4717560', '4647963', '999001'])
    } finally {
      await dispose()
    }
  })

  it('narrows a longer key through the key range as well as the bucket', async () => {
    const { db, dispose } = await setup()
    try {
      expect((await results(db, 'paris texas')).length).toBe(0)
      expect((await results(db, 'londo')).map((p) => p.id)).toEqual(['2643743', '6058560'])
    } finally {
      await dispose()
    }
  })

  it('returns nothing, not an error, for a query shorter than the minimum', async () => {
    const { db, dispose } = await setup()
    try {
      expect(await results(db, 'p')).toEqual([])
      expect(await results(db, "'-%")).toEqual([])
    } finally {
      await dispose()
    }
  })

  it('treats LIKE wildcards as ordinary characters', async () => {
    const { db, dispose } = await setup()
    try {
      expect(await results(db, 'pa%is')).toEqual([])
    } finally {
      await dispose()
    }
  })

  it('rejects a missing q, an unknown locale and an anonymous caller', async () => {
    const { db, dispose } = await setup()
    try {
      const bare = await search({
        ...apiContext(db, new Request(`${testOrigin}/api/ground-places/search`)),
        data: { user: owner },
      } as never)
      expect(bare.status).toBe(400)
      expect((await find(db, 'paris', owner, 'de')).status).toBe(400)
      expect((await find(db, 'paris', null)).status).toBe(401)
    } finally {
      await dispose()
    }
  })

  it('returns only manual places while the catalog is empty', async () => {
    const { db, dispose } = await setup({ catalog: false })
    try {
      expect(await results(db, 'tbil')).toEqual([])
      expect((await post(db, batumi)).status).toBe(201)
      expect((await results(db, 'batu')).map((p) => [p.source, p.id])).toEqual([
        ['manual', batumi.id],
      ])
    } finally {
      await dispose()
    }
  })

  it('ranks the owner’s manual places beside catalog matches and never shows another owner’s', async () => {
    const { db, dispose } = await setup()
    try {
      await post(db, {
        ...batumi,
        id: uuid(2),
        name: 'Paris, my cousin’s place',
        countryCode: 'FR',
        lat: null,
        lon: null,
        timezone: null,
      })
      await post(db, {
        ...batumi,
        id: uuid(3),
        name: 'Paris',
        countryCode: 'US',
        lat: null,
        lon: null,
        timezone: null,
      })
      await post(db, { ...batumi, id: uuid(4), name: 'Paris private', countryCode: 'FR' }, other)
      const found = await results(db, 'paris')
      expect(found.map((p) => `${p.source}:${p.id}`)).toEqual([
        `manual:${uuid(3)}`, // exact name, manual first
        'geonames:2988507',
        'geonames:4717560',
        'geonames:4647963',
        `manual:${uuid(2)}`,
      ])
      expect(found.some((p) => p.id === uuid(4))).toBe(false)
      expect((await results(db, 'paris', other)).map((p) => p.id)).toEqual([
        '2988507',
        '4717560',
        '4647963',
        uuid(4),
      ])
    } finally {
      await dispose()
    }
  })
})

describe('query plans', () => {
  it('reads one bucket or key range through an index, never scanning the catalog', async () => {
    const { db, dispose } = await setup()
    try {
      const bind: Record<string, unknown[]> = {
        exact: ['paris', 10],
        bucket: ['par', 'pari', `pari${'\u{10FFFF}'}`, 50],
        range: ['pari', `pari${'\u{10FFFF}'}`, 50],
        manual: [owner.id, 'pa', `pa${'\u{10FFFF}'}`, 10],
      }
      for (const name of ['exact', 'bucket', 'range', 'manual'] as const) {
        const plan = await db
          .prepare(`EXPLAIN QUERY PLAN ${catalogSql[name]}`)
          .bind(...bind[name])
          .all<{ detail: string }>()
        const details = plan.results.map((row) => row.detail)
        expect(
          details.filter((d) => d.startsWith('SCAN')),
          `${name}: ${details.join(' | ')}`,
        ).toEqual([])
        expect(details.some((d) => d.startsWith('SEARCH') && /INDEX|PRIMARY KEY/.test(d))).toBe(
          true,
        )
      }
      const bucket = await db
        .prepare(`EXPLAIN QUERY PLAN ${catalogSql.bucket}`)
        .bind('par', 'pari', 'pari~', 50)
        .all<{ detail: string }>()
      expect(bucket.results.map((r) => r.detail).join(' ')).toContain(
        'idx_ground_place_names_bucket (prefix=?)',
      )
    } finally {
      await dispose()
    }
  })
})

describe('manual places', () => {
  it('creates a place and returns the manual snapshot', async () => {
    const { db, dispose } = await setup()
    try {
      const response = await post(db, batumi)
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body).toEqual({
        source: 'manual',
        id: batumi.id,
        name: 'Batumi old port',
        nameRu: null,
        nameEn: null,
        countryCode: 'GE',
        region: null,
        lat: 41.65,
        lon: 41.64,
        timezone: 'Asia/Tbilisi',
        catalogVersion: null,
      })
      expect(parsePlaceSnapshot(body)).toEqual(body)
      expect(await manualList(db)).toEqual([body])
    } finally {
      await dispose()
    }
  })

  it('replays the same payload from the same owner without a second row', async () => {
    const { db, dispose } = await setup()
    try {
      const first = await (await post(db, batumi)).json()
      const again = await post(db, { ...batumi, name: `  ${batumi.name}  ` })
      expect(again.status).toBe(200)
      expect(await again.json()).toEqual(first)
      expect(await count(db, 'ground_manual_places')).toBe(1)
    } finally {
      await dispose()
    }
  })

  it('rejects the same id with a different payload and leaves the stored place unchanged', async () => {
    const { db, dispose } = await setup()
    try {
      const first = await (await post(db, batumi)).json()
      const clash = await post(db, { ...batumi, name: 'Elsewhere' })
      expect(clash.status).toBe(409)
      expect(await manualList(db)).toEqual([first])
    } finally {
      await dispose()
    }
  })

  it('answers 409 for another owner’s id without disclosing it', async () => {
    const { db, dispose } = await setup()
    try {
      await post(db, batumi, other)
      const clash = await post(db, batumi)
      expect(clash.status).toBe(409)
      expect(JSON.stringify(await clash.json())).not.toContain('Batumi')
      expect(await manualList(db)).toEqual([])
      expect(await manualList(db, other)).toHaveLength(1)
    } finally {
      await dispose()
    }
  })

  it('does not merge places that only share a name', async () => {
    const { db, dispose } = await setup()
    try {
      await post(db, { ...batumi, id: uuid(5) })
      await post(db, { ...batumi, id: uuid(6) })
      expect(await manualList(db)).toHaveLength(2)
    } finally {
      await dispose()
    }
  })

  it.each([
    ['a country that is not ISO-2 uppercase', { countryCode: 'ge' }],
    ['a name that is blank', { name: '   ' }],
    ['a name over 200 characters', { name: 'x'.repeat(201) }],
    ['a latitude without a longitude', { lon: null }],
    ['a latitude out of range', { lat: 91 }],
    ['a longitude out of range', { lon: -181 }],
    ['an unknown timezone', { timezone: 'Mars/Olympus' }],
    ['a fixed UTC offset instead of an IANA zone', { timezone: '+03:00' }],
    ['a client id that is not a UUID', { id: 'my-place' }],
  ])('rejects %s', async (_label, patch) => {
    const { db, dispose } = await setup()
    try {
      const response = await post(db, { ...batumi, ...patch })
      expect(response.status).toBe(400)
      expect(await count(db, 'ground_manual_places')).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('accepts a place with no coordinates and no timezone', async () => {
    const { db, dispose } = await setup()
    try {
      const response = await post(db, { id: uuid(7), name: 'Somewhere', countryCode: 'TR' })
      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({ lat: null, lon: null, timezone: null })
    } finally {
      await dispose()
    }
  })

  it('requires the CSRF pair and a session to create', async () => {
    const { db, dispose } = await setup()
    try {
      const bare = new Request(`${testOrigin}/api/ground-places/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batumi),
      })
      expect(
        (await createManual({ ...apiContext(db, bare), data: { user: owner } } as never)).status,
      ).toBe(403)
      expect((await post(db, batumi, null as never)).status).toBe(401)
    } finally {
      await dispose()
    }
  })
})

describe('place keys', () => {
  it('folds case, diacritics, ё and punctuation the same way for catalog and query', () => {
    expect(placeNameKey("Coeur d'Alene")).toBe('coeur d alene')
    expect(placeNameKey('Île-de-France')).toBe('ile de france')
    expect(placeNameKey('  ЁЛКИ—Палки ')).toBe('елки палки')
    expect(placeNameKey('')).toBe('')
  })
})
