import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const airport = {
  iata: 'SVO',
  icao: 'UUEE',
  name: 'Manual airport',
  city: 'Moscow',
  country: 'Russia',
  countryCode: 'RU',
  latitude: 55,
  longitude: 37,
  timezone: 'Europe/Moscow',
  manual: 'keep airport',
}
const airline = {
  iata: 'SU',
  icao: 'AFL',
  name: 'Manual airline',
  country: 'Russia',
  logoUrl: '/manual.png',
  primaryColor: '#123456',
  manual: 'keep airline',
}
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'kuuki-openflights-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'scripts'))
  const data = join(dir, 'packages/data/src')
  mkdirSync(data, { recursive: true })
  const script = join(dir, 'scripts/import-openflights.ts')
  copyFileSync(resolve('scripts/import-openflights.ts'), script)
  writeFileSync(join(dir, 'scripts/airports-raw.dat'), '')
  writeFileSync(
    join(dir, 'scripts/airlines-raw.dat'),
    '1,"Raw airline",\\N,"SU","AFL","AEROFLOT","Russia","Y"\n',
  )
  writeFileSync(join(data, 'airports.json'), JSON.stringify([airport]))
  writeFileSync(join(data, 'airlines.json'), JSON.stringify([airline, { ...airline, iata: 'AZA' }]))
  return {
    data,
    run: () =>
      spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), script], {
        cwd: dir,
        encoding: 'utf8',
      }),
  }
}

describe('OpenFlights catalog preservation', () => {
  const invalid = [
    ['invalid JSON', '{'],
    ['non-array', '{}'],
    ['null row', '[null]'],
    ['missing fields', '[{"iata":"SU"}]'],
    ['invalid field type', JSON.stringify([{ ...airport, ...airline, iata: 123 }])],
    ['read error', null],
  ] as const
  it.each(
    ['airports', 'airlines'].flatMap((catalog) =>
      invalid.map(([reason, content]) => [catalog, reason, content] as const),
    ),
  )('rejects %s with %s before either catalog changes', (catalog, reason, content) => {
    const { data, run } = fixture()
    const target = join(data, `${catalog}.json`)
    if (content === null) {
      rmSync(target)
      mkdirSync(target)
    } else writeFileSync(target, content)
    const other = join(data, `${catalog === 'airports' ? 'airlines' : 'airports'}.json`)
    const before = readFileSync(other, 'utf8')
    const result = run()
    expect(result.status, `${catalog}: ${reason}: ${result.stderr}`).not.toBe(0)
    expect(readFileSync(other, 'utf8'), reason).toBe(before)
    if (content !== null) expect(readFileSync(target, 'utf8'), reason).toBe(content)
  })

  it('preserves manual fields and fills legacy airline fields; only missing files start empty', () => {
    const { data, run } = fixture()
    const result = run()
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(readFileSync(join(data, 'airports.json'), 'utf8'))).toEqual([airport])
    expect(JSON.parse(readFileSync(join(data, 'airlines.json'), 'utf8'))).toEqual([
      { ...airline, alliance: 'skyteam', callsign: 'AEROFLOT' },
    ])
    rmSync(join(data, 'airports.json'))
    rmSync(join(data, 'airlines.json'))
    const missing = run()
    expect(missing.status, missing.stderr).toBe(0)
    expect(JSON.parse(readFileSync(join(data, 'airports.json'), 'utf8'))).toEqual([])
    expect(JSON.parse(readFileSync(join(data, 'airlines.json'), 'utf8'))[0].name).toBe(
      'Raw airline',
    )
  })
})
