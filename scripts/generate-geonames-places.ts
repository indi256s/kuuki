// Builds the Kuuki ground-travel city catalog (ground_places + ground_place_names) as deterministic SQL
// chunks from the public GeoNames dumps. See scripts/geonames/README.md and
// .scratch/ground-travel/places-contract.md.
//
//   tsx scripts/generate-geonames-places.ts                 download (cached) + generate
//   tsx scripts/generate-geonames-places.ts --load-local    ...and apply the chunks to the LOCAL D1 only
//                                                           (--persist-to <dir> keeps that local D1 in a separate state dir)
//   tsx scripts/generate-geonames-places.ts --ids 611717,616052 --no-manifest   subset (fixture)
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { once } from 'node:events'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { ROOT } from './_cli'
import { placeNameKey, placePrefix } from '../functions/api/_services/groundPlaces'

const BASE_URL = 'https://download.geonames.org/export/dump/'

interface SourceSpec {
  file: string
  /** Member of the ZIP that holds the data, or null for a plain text file. */
  member: string | null
}
const CITIES: SourceSpec = { file: 'cities500.zip', member: 'cities500.txt' }
const ALTERNATE_NAMES: SourceSpec = { file: 'alternateNamesV2.zip', member: 'alternateNamesV2.txt' }
const ADMIN1: SourceSpec = { file: 'admin1CodesASCII.txt', member: null }

/** Filter rules, recorded verbatim in the manifest. */
const RULES = [
  'cities500 rows with feature class P, ISO-2 country, valid WGS84 coordinates and a non-empty name',
  'display names nameRu/nameEn: alternateNamesV2 isolanguage ru/en, not isHistoric, not isColloquial; isPreferredName first, then non-short names, then lowest alternateNameId; absent stays NULL (asciiname is not a translation)',
  'region: admin1CodesASCII name for country.admin1; region_ru: its ru alias from alternateNamesV2 by the admin1 geonameid, same selection rule',
  'search keys: placeNameKey of name, asciiname and every ru/en alias of the place including historic/colloquial/short ones; prefix = first 3 key characters',
  'population and timezone are copied from the cities500 row',
] as const

const MAX_STATEMENT_BYTES = 64 * 1024
const MAX_ROWS_PER_STATEMENT = 100
const SQL_VALUES_PLACES =
  'INSERT INTO ground_places (geoname_id, name, name_ru, name_en, country_code, region, region_ru, latitude, longitude, timezone, population, catalog_version) VALUES '
const SQL_VALUES_NAMES =
  'INSERT INTO ground_place_names (prefix, name_key, geoname_id, population) VALUES '

interface Options {
  cacheDir: string
  outDir: string
  manifestPath: string | null
  ids: Set<number> | null
  catalogDate: string | null
  chunkBytes: number
  loadLocal: boolean
  persistTo: string | null
  updatePins: boolean
}

function parseArgs(argv: string[]): Options {
  const value = (name: string) => {
    const at = argv.indexOf(name)
    if (at < 0) return null
    const next = argv[at + 1]
    if (!next || next.startsWith('--')) throw new Error(`${name} needs a value`)
    return next
  }
  const known = new Set([
    '--cache-dir',
    '--out-dir',
    '--manifest',
    '--ids',
    '--catalog-date',
    '--chunk-bytes',
    '--load-local',
    '--persist-to',
    '--update-pins',
    '--no-manifest',
  ])
  for (const arg of argv) {
    if (arg.startsWith('--') && !known.has(arg)) throw new Error(`Unknown option ${arg}`)
  }
  const ids = value('--ids')
  const catalogDate = value('--catalog-date')
  if (catalogDate && !/^\d{8}$/.test(catalogDate)) throw new Error('--catalog-date is YYYYMMDD')
  return {
    cacheDir: resolve(ROOT, value('--cache-dir') ?? '.wrangler/geonames/cache'),
    outDir: resolve(ROOT, value('--out-dir') ?? '.wrangler/geonames/out'),
    manifestPath: argv.includes('--no-manifest')
      ? null
      : resolve(ROOT, value('--manifest') ?? 'scripts/geonames/manifest.json'),
    ids: ids ? new Set(ids.split(',').map(Number)) : null,
    catalogDate,
    chunkBytes: Number(value('--chunk-bytes') ?? 10 * 1024 * 1024),
    loadLocal: argv.includes('--load-local'),
    persistTo: value('--persist-to') ? resolve(ROOT, value('--persist-to')!) : null,
    updatePins: argv.includes('--update-pins'),
  }
}

// ---------------------------------------------------------------------------
// Sources: download once, hash, pin
// ---------------------------------------------------------------------------

interface SourceRecord {
  url: string
  bytes: number
  sha256: string
  lastModified: string | null
}

async function sha256Of(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

async function lastModified(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const header = res.headers.get('last-modified')
    return header ? new Date(header).toISOString() : null
  } catch {
    return null
  }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed: ${url} → ${res.status}`)
  const partial = `${dest}.partial`
  const out = createWriteStream(partial)
  for await (const chunk of Readable.fromWeb(res.body as never)) {
    if (!out.write(chunk)) await once(out, 'drain')
  }
  out.end()
  await once(out, 'finish')
  renameSync(partial, dest)
}

async function ensureSource(
  spec: SourceSpec,
  options: Options,
  pinned: SourceRecord | undefined,
): Promise<{ path: string; record: SourceRecord }> {
  const url = BASE_URL + spec.file
  mkdirSync(options.cacheDir, { recursive: true })
  const path = join(options.cacheDir, spec.file)
  let fetched = false
  if (!existsSync(path)) {
    console.log(`downloading ${url}`)
    await download(url, path)
    fetched = true
  }
  const sha256 = await sha256Of(path)
  if (pinned && pinned.sha256 !== sha256 && !options.updatePins) {
    throw new Error(
      `${spec.file} differs from the pinned SHA-256 in the manifest (upstream republishes daily). ` +
        'Rerun with --update-pins to accept this snapshot.',
    )
  }
  const modified =
    pinned && pinned.sha256 === sha256 && !fetched ? pinned.lastModified : await lastModified(url)
  return { path, record: { url, bytes: statSync(path).size, sha256, lastModified: modified } }
}

/** Lines of a dump file: streamed from `unzip -p` for archives, so the 785 MB alias file is never in memory. */
async function* dumpLines(path: string, member: string | null): AsyncGenerator<string> {
  if (!member) {
    const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
    for await (const line of rl) yield line
    return
  }
  const child = spawn('unzip', ['-p', path, member], { stdio: ['ignore', 'pipe', 'inherit'] })
  const closed = new Promise<number | null>((done) => child.on('close', done))
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
  for await (const line of rl) yield line
  const code = await closed
  if (code !== 0) throw new Error(`unzip ${member} failed with exit code ${code}`)
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface City {
  id: number
  name: string
  ascii: string
  country: string
  admin1: string
  lat: number
  lon: number
  population: number
  timezone: string | null
}

interface Alias {
  alternateNameId: number
  lang: 'ru' | 'en'
  name: string
  preferred: boolean
  short: boolean
  colloquial: boolean
  historic: boolean
}

const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()

async function readAdmin1(path: string): Promise<Map<string, { name: string; id: number }>> {
  const map = new Map<string, { name: string; id: number }>()
  for await (const line of dumpLines(path, null)) {
    const [code, name, , id] = line.split('\t')
    if (code && name && /^\d+$/.test(id ?? '')) map.set(code, { name: clean(name), id: Number(id) })
  }
  return map
}

async function readCities(
  path: string,
  member: string | null,
  ids: Set<number> | null,
): Promise<{ cities: City[]; skipped: Record<string, number> }> {
  const cities: City[] = []
  const skipped: Record<string, number> = {}
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1)
  for await (const line of dumpLines(path, member)) {
    if (!line) continue
    const f = line.split('\t')
    if (f.length < 19) {
      skip('short row')
      continue
    }
    const id = Number(f[0])
    if (!Number.isInteger(id) || id <= 0) {
      skip('bad id')
      continue
    }
    if (ids && !ids.has(id)) continue
    if (f[6] !== 'P') {
      skip('not feature class P')
      continue
    }
    if (!/^[A-Z]{2}$/.test(f[8])) {
      skip('bad country')
      continue
    }
    const lat = Number(f[4])
    const lon = Number(f[5])
    if (
      f[4] === '' ||
      f[5] === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      skip('bad coordinates')
      continue
    }
    const name = clean(f[1])
    if (!name) {
      skip('empty name')
      continue
    }
    const population = f[14] === '' ? 0 : Number(f[14])
    if (!Number.isInteger(population) || population < 0) {
      skip('bad population')
      continue
    }
    cities.push({
      id,
      name,
      ascii: clean(f[2]),
      country: f[8],
      admin1: f[10],
      lat,
      lon,
      population,
      timezone: clean(f[17]) || null,
    })
  }
  cities.sort((a, b) => a.id - b.id)
  return { cities, skipped }
}

async function readAliases(
  path: string,
  member: string | null,
  wanted: Set<number>,
): Promise<{ aliases: Map<number, Alias[]>; scanned: number }> {
  const aliases = new Map<number, Alias[]>()
  let scanned = 0
  for await (const line of dumpLines(path, member)) {
    scanned++
    // alternateNameId, geonameid, isolanguage, name, isPreferred, isShort, isColloquial, isHistoric, from, to
    const f = line.split('\t')
    const lang = f[2]
    if (lang !== 'ru' && lang !== 'en') continue
    const geonameId = Number(f[1])
    if (!wanted.has(geonameId)) continue
    const name = clean(f[3] ?? '')
    if (!name) continue
    const list = aliases.get(geonameId) ?? []
    list.push({
      alternateNameId: Number(f[0]),
      lang,
      name,
      preferred: f[4] === '1',
      short: f[5] === '1',
      colloquial: f[6] === '1',
      historic: f[7] === '1',
    })
    aliases.set(geonameId, list)
  }
  return { aliases, scanned }
}

/** Display name: current (not historic/colloquial), preferred first, then non-short, then lowest id. */
function pickDisplay(list: Alias[] | undefined, lang: 'ru' | 'en'): string | null {
  const candidates = (list ?? []).filter((a) => a.lang === lang && !a.historic && !a.colloquial)
  candidates.sort(
    (a, b) =>
      Number(b.preferred) - Number(a.preferred) ||
      Number(a.short) - Number(b.short) ||
      a.alternateNameId - b.alternateNameId,
  )
  return candidates[0]?.name ?? null
}

// ---------------------------------------------------------------------------
// SQL output
// ---------------------------------------------------------------------------

const sqlText = (value: string | null) =>
  value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`
const sqlNumber = (value: number | null) => (value === null ? 'NULL' : String(value))

/** Writes multi-row INSERT statements, rotating to a new file after `chunkBytes`. */
class ChunkWriter {
  files: { name: string; bytes: number; sha256: string; statements: number }[] = []
  private index = 0
  private current: {
    name: string
    bytes: number
    hash: ReturnType<typeof createHash>
    statements: number
  } | null = null
  private buffer: string[] = []
  private out: ReturnType<typeof createWriteStream> | null = null
  totalBytes = 0

  constructor(
    private readonly dir: string,
    private readonly chunkBytes: number,
  ) {}

  private async open() {
    this.index++
    const name = `${String(this.index).padStart(3, '0')}-catalog.sql`
    this.out = createWriteStream(join(this.dir, name))
    this.current = { name, bytes: 0, hash: createHash('sha256'), statements: 0 }
  }

  async statement(sql: string) {
    if (!this.current || this.current.bytes >= this.chunkBytes) {
      await this.close()
      await this.open()
    }
    const cur = this.current!
    const line = sql + '\n'
    cur.hash.update(line)
    cur.bytes += Buffer.byteLength(line)
    cur.statements++
    this.totalBytes += Buffer.byteLength(line)
    if (!this.out!.write(line)) await once(this.out!, 'drain')
  }

  async close() {
    if (!this.current || !this.out) return
    this.out.end()
    await once(this.out, 'finish')
    this.files.push({
      name: this.current.name,
      bytes: this.current.bytes,
      sha256: this.current.hash.digest('hex'),
      statements: this.current.statements,
    })
    this.current = null
    this.out = null
  }
}

/** Accumulates rows into multi-row INSERTs bounded by row count and statement size. */
class RowBatcher {
  private rows: string[] = []
  private bytes = 0
  constructor(
    private readonly head: string,
    private readonly writer: ChunkWriter,
  ) {}

  async add(row: string) {
    const size = Buffer.byteLength(row) + 1
    if (
      this.rows.length >= MAX_ROWS_PER_STATEMENT ||
      this.bytes + size + this.head.length > MAX_STATEMENT_BYTES
    )
      await this.flush()
    this.rows.push(row)
    this.bytes += size
  }

  async flush() {
    if (this.rows.length === 0) return
    await this.writer.statement(`${this.head}${this.rows.join(',')};`)
    this.rows = []
    this.bytes = 0
  }
}

interface Totals {
  places: number
  names: number
}

async function writeCatalog(
  cities: City[],
  aliases: Map<number, Alias[]>,
  admin1: Map<string, { name: string; id: number }>,
  catalogVersion: string,
  options: Options,
): Promise<{ writer: ChunkWriter; totals: Totals; resetFile: string }> {
  rmSync(options.outDir, { recursive: true, force: true })
  mkdirSync(options.outDir, { recursive: true })
  const resetFile = '000-reset.sql'
  writeFileSync(
    join(options.outDir, resetFile),
    'DELETE FROM ground_place_names;\nDELETE FROM ground_places;\n',
  )
  const writer = new ChunkWriter(options.outDir, options.chunkBytes)
  const totals: Totals = { places: 0, names: 0 }

  // Places first, then names, so a partial load never has names without their place.
  const places = new RowBatcher(SQL_VALUES_PLACES, writer)
  for (const city of cities) {
    const region = admin1.get(`${city.country}.${city.admin1}`)
    const list = aliases.get(city.id)
    await places.add(
      `(${[
        city.id,
        sqlText(city.name),
        sqlText(pickDisplay(list, 'ru')),
        sqlText(pickDisplay(list, 'en')),
        sqlText(city.country),
        sqlText(region?.name ?? null),
        sqlText(region ? pickDisplay(aliases.get(region.id), 'ru') : null),
        sqlNumber(city.lat),
        sqlNumber(city.lon),
        sqlText(city.timezone),
        city.population,
        sqlText(catalogVersion),
      ].join(',')})`,
    )
    totals.places++
  }
  await places.flush()

  const names = new RowBatcher(SQL_VALUES_NAMES, writer)
  for (const city of cities) {
    const keys = new Set<string>()
    for (const text of [
      city.name,
      city.ascii,
      ...(aliases.get(city.id) ?? []).map((a) => a.name),
    ]) {
      const key = placeNameKey(text)
      if (key) keys.add(key)
    }
    for (const key of [...keys].sort()) {
      await names.add(
        `(${sqlText(placePrefix(key))},${sqlText(key)},${city.id},${city.population})`,
      )
      totals.names++
    }
  }
  await names.flush()
  await writer.close()
  return { writer, totals, resetFile }
}

// ---------------------------------------------------------------------------
// Local load
// ---------------------------------------------------------------------------

function runWrangler(args: string[]): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', ['exec', 'wrangler', ...args], { cwd: ROOT, stdio: 'inherit' })
    child.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`wrangler ${args.slice(0, 3).join(' ')} → ${code}`)),
    )
  })
}

/** Reads the primary D1 database name from the root wrangler.toml (the first [[d1_databases]] entry). */
function localDatabaseName(): string {
  const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8')
  const block = toml.split('[[d1_databases]]')[1]?.split(/\n\[/)[0] ?? ''
  const match = /database_name\s*=\s*"([^"]+)"/.exec(block)
  if (!match) throw new Error('database_name not found in wrangler.toml')
  return match[1]
}

async function loadLocal(
  outDir: string,
  resetFile: string,
  chunks: string[],
  persistTo: string | null,
): Promise<number> {
  const db = localDatabaseName()
  const started = Date.now()
  const persist = persistTo ? ['--persist-to', persistTo] : []
  // Local only: never pass --remote. Pending migrations are applied to the local database first.
  await runWrangler(['d1', 'migrations', 'apply', db, '--local', ...persist])
  for (const file of [resetFile, ...chunks]) {
    console.log(`loading ${file} (local)`)
    await runWrangler(['d1', 'execute', db, '--local', ...persist, '--file', join(outDir, file)])
  }
  return Date.now() - started
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Manifest {
  generator: string
  catalogVersion: string
  sources: Record<string, SourceRecord>
  rules: readonly string[]
  output?: {
    places: number
    names: number
    aliasRowsScanned: number
    skipped: Record<string, number>
    sqlBytes: number
    chunkBytes: number
    files: { name: string; bytes: number; sha256: string; statements: number }[]
  }
  lastRun?: { seconds: number; localLoadSeconds: number | null; node: string }
  attribution: string
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const started = Date.now()
  const previous: Manifest | null =
    options.manifestPath && existsSync(options.manifestPath)
      ? JSON.parse(readFileSync(options.manifestPath, 'utf8'))
      : null

  const citiesSource = await ensureSource(CITIES, options, previous?.sources[CITIES.file])
  const aliasSource = await ensureSource(
    ALTERNATE_NAMES,
    options,
    previous?.sources[ALTERNATE_NAMES.file],
  )
  const adminSource = await ensureSource(ADMIN1, options, previous?.sources[ADMIN1.file])

  const stamp = (citiesSource.record.lastModified ?? new Date().toISOString())
    .slice(0, 10)
    .replaceAll('-', '')
  const catalogVersion = `geonames-cities500-${options.catalogDate ?? stamp}`

  const admin1 = await readAdmin1(adminSource.path)
  const { cities, skipped } = await readCities(citiesSource.path, CITIES.member, options.ids)
  console.log(`cities500: kept ${cities.length}, skipped`, skipped)

  const wanted = new Set<number>(cities.map((c) => c.id))
  for (const city of cities) {
    const region = admin1.get(`${city.country}.${city.admin1}`)
    if (region) wanted.add(region.id)
  }
  const { aliases, scanned } = await readAliases(aliasSource.path, ALTERNATE_NAMES.member, wanted)
  console.log(
    `alternateNamesV2: scanned ${scanned} rows, ${aliases.size} places with ru/en aliases`,
  )

  const { writer, totals, resetFile } = await writeCatalog(
    cities,
    aliases,
    admin1,
    catalogVersion,
    options,
  )
  console.log(
    `wrote ${writer.files.length} chunk(s): ${totals.places} places, ${totals.names} name keys, ${writer.totalBytes} bytes → ${options.outDir}`,
  )

  let localLoadSeconds: number | null = null
  if (options.loadLocal) {
    localLoadSeconds =
      (await loadLocal(
        options.outDir,
        resetFile,
        writer.files.map((f) => f.name),
        options.persistTo,
      )) / 1000
    console.log(`local load took ${localLoadSeconds.toFixed(1)} s`)
  }

  if (options.manifestPath) {
    const manifest: Manifest = {
      generator: 'scripts/generate-geonames-places.ts',
      catalogVersion,
      sources: {
        [CITIES.file]: citiesSource.record,
        [ALTERNATE_NAMES.file]: aliasSource.record,
        [ADMIN1.file]: adminSource.record,
      },
      rules: RULES,
      output: {
        places: totals.places,
        names: totals.names,
        aliasRowsScanned: scanned,
        skipped,
        sqlBytes: writer.totalBytes,
        chunkBytes: options.chunkBytes,
        files: writer.files,
      },
      lastRun: {
        seconds: Math.round((Date.now() - started) / 100) / 10,
        localLoadSeconds,
        node: process.version,
      },
      attribution:
        'Contains data from GeoNames (https://www.geonames.org), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).',
    }
    mkdirSync(dirname(options.manifestPath), { recursive: true })
    writeFileSync(options.manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    console.log(`manifest → ${options.manifestPath}`)
  }
  if (readdirSync(options.outDir).length === 0) throw new Error('nothing generated')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
