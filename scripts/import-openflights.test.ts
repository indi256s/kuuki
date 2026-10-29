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
  mkdirSync(join(dir, 'db'))
  writeFileSync(join(dir, 'db/reference-supplements.json'), '{"airports":[]}')
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
  it('admits regional airports beyond major hubs and retains existing manual airports', () => {
    const { data, run } = fixture()
    // Real OpenFlights rows, kept inline because downloaded *.dat inputs are ignored.
    const raw = [
      '1132,"Luxor International Airport","Luxor","Egypt","LXR","HELX",25.671,32.7066,294,2,"U","Africa/Cairo","airport","OurAirports"',
      '1458,"Kos Airport","Kos","Greece","KGS","LGKO",36.79330062866211,27.091699600219727,412,2,"E","Europe/Athens","airport","OurAirports"',
      '1473,"Araxos Airport","Patras","Greece","GPA","LGRX",38.1511,21.4256,46,2,"E","Europe/Athens","airport","OurAirports"',
      '1502,"Foggia ""Gino Lisa"" Airport","Foggia","Italy","FOG","LIBF",41.432899,15.535,265,1,"E","Europe/Rome","airport","OurAirports"',
      '7856,"El Alamein International Airport","Dabaa City","Egypt","DBB","HEAL",30.92449951171875,28.46139907836914,143,2,"N","Africa/Cairo","airport","OurAirports"',
    ]
    writeFileSync(join(data, '../../../scripts/airports-raw.dat'), raw.join('\n'))
    const manual = { ...airport, iata: 'ARK', name: 'Manual Arusha' }
    writeFileSync(join(data, 'airports.json'), JSON.stringify([airport, manual]))

    const result = run()
    expect(result.status, result.stderr).toBe(0)
    const airports = JSON.parse(readFileSync(join(data, 'airports.json'), 'utf8'))
    expect(airports.map((row: { iata: string }) => row.iata)).toEqual([
      'ARK',
      'DBB',
      'FOG',
      'GPA',
      'KGS',
      'LXR',
      'SVO',
    ])
    expect(airports.find((row: { iata: string }) => row.iata === 'ARK')).toEqual(manual)
    expect(airports.find((row: { iata: string }) => row.iata === 'GPA')).toMatchObject({
      icao: 'LGRX',
      city: 'Patras',
      countryCode: 'GR',
      timezone: 'Europe/Athens',
    })
    expect(airports.find((row: { iata: string }) => row.iata === 'DBB')).toMatchObject({
      icao: 'HEAL',
      countryCode: 'EG',
      timezone: 'Africa/Cairo',
    })
    expect(airports.find((row: { iata: string }) => row.iata === 'FOG').name).toBe(
      'Foggia "Gino Lisa" Airport',
    )
  })

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
