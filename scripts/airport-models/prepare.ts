import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { normalize, GENERATOR_VERSION, type Config } from './normalize'
import { buildingVolumes, projectPoint } from '../../apps/next/src/lib/airport-models/geometry'
import type {
  AirportCatalogEntry,
  AirportModelV1,
  AirportPlanV1,
  PointM,
} from '../../apps/next/src/lib/airport-models/model'

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
function preview(model: AirportModelV1, layout: 'desktop' | 'mobile', theme: 'light' | 'dark') {
  const width = layout === 'desktop' ? 1440 : 390,
    height = layout === 'desktop' ? 900 : 844,
    camera = model.cameras[layout],
    ppm = height / camera.verticalSpanM
  const palette =
    theme === 'light'
      ? {
          base: '#f2f2f2',
          surface: '#8d8c89',
          runway: '#66605b',
          roof: '#8a8076',
          wall: '#665e56',
          line: '#66605b',
        }
      : {
          base: '#232323',
          surface: '#8d8c89',
          runway: '#c4beb7',
          roof: '#958b82',
          wall: '#70685f',
          line: '#c4beb7',
        }
  const point = (p: PointM, z = 0) => {
    const q = projectPoint(p, z, camera)
    return `${(width / 2 + q[0] * ppm).toFixed(2)},${(height / 2 - q[1] * ppm).toFixed(2)}`
  }
  const path = (rings: PointM[][], z = 0) =>
    rings.map((r) => `M${r.map((p) => point(p, z)).join('L')}Z`).join('')
  let shapes = model.boundary
    .map(
      (p) =>
        `<path d="${path([p.outer, ...p.holes])}" fill="${palette.base}" fill-rule="evenodd"/>`,
    )
    .join('')
  for (const f of model.features) {
    if (f.type === 'surface')
      for (const p of f.polygons)
        shapes += `<path d="${path([p.outer, ...p.holes])}" fill="${f.kind === 'runway' ? palette.runway : palette.surface}" fill-rule="evenodd"/>`
    if (f.type === 'line' && !f.areaCovered)
      shapes += `<polyline points="${f.points.map((p) => point(p)).join(' ')}" fill="none" stroke="${f.kind === 'runway' ? palette.runway : palette.line}" stroke-width="${(f.width.metres * ppm).toFixed(2)}" stroke-linejoin="round"/>`
  }
  const buildings = model.features
    .filter((f) => f.type === 'building' && f.renderFootprint)
    .sort((a, b) => {
      if (a.type !== 'building' || b.type !== 'building') return 0
      return (
        projectPoint(b.polygons[0]!.outer[0]!, 0, camera)[1] -
        projectPoint(a.polygons[0]!.outer[0]!, 0, camera)[1]
      )
    })
  for (const f of buildings) {
    if (f.type !== 'building') continue
    for (const volume of buildingVolumes(f))
      for (const p of volume.polygons) {
        for (const r of [p.outer, ...p.holes])
          for (let i = 0; i < r.length - 1; i++)
            shapes += `<polygon points="${point(r[i]!, volume.minHeightM)} ${point(r[i + 1]!, volume.minHeightM)} ${point(r[i + 1]!, volume.heightM)} ${point(r[i]!, volume.heightM)}" fill="${palette.wall}"/>`
        shapes += `<path d="${path([p.outer, ...p.holes], volume.heightM)}" fill="${palette.roof}" fill-rule="evenodd" stroke="${palette.wall}" stroke-width="0.5"/>`
      }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${model.iata} airport model">${shapes}</svg>\n`
}
const generatorCodeSha256 = hash(
  [
    'scripts/airport-models/prepare.ts',
    'scripts/airport-models/normalize.ts',
    'apps/next/src/lib/airport-models/model.ts',
    'apps/next/src/lib/airport-models/geometry.ts',
  ]
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n'),
)
const check = process.argv.includes('--check'),
  outputs = new Map<string, string>(),
  catalog: AirportCatalogEntry[] = [],
  reports = []
for (const code of ['TBS', 'BER']) {
  const configText = readFileSync(`scripts/airport-models/sources/${code}.config.json`, 'utf8'),
    config = JSON.parse(configText) as Config
  const source = readFileSync(`scripts/airport-models/sources/${code}.osm.json`, 'utf8'),
    doc = JSON.parse(source)
  const { model, diagnostics, physicalRunways } = normalize(doc.elements, config, hash(source))
  // No revision or hash-bearing path occurs in this preimage. Estimates, poses and projection are included.
  const revision = hash(
    canonical({
      generatorVersion: GENERATOR_VERSION,
      generatorCodeSha256,
      schemaVersion: 1,
      config,
      sourceSha256: hash(source),
      simplification: { precisionM: 0.01, toleranceM: 0.01, algorithm: 'none' },
      model: { ...model, revision: undefined },
    }),
  )
  model.revision = revision
  const root = `apps/next/public/airport-models/${revision}`,
    url = `/airport-models/${revision}`
  const plan: AirportPlanV1 = {
    schemaVersion: 1,
    iata: code,
    revision,
    boundsM: model.boundsM,
    boundary: model.boundary,
    features: model.features
      .filter(
        (f) => f.type !== 'point' && !(f.type === 'line' && f.areaCovered && f.kind !== 'runway'),
      )
      .map((f) =>
        f.type === 'building'
          ? {
              ...f,
              height: { metres: 0, source: 'geometry' },
              minHeight: { metres: 0, source: 'geometry' },
              volumeSlices: undefined,
            }
          : f,
      ),
  }
  const files: Record<string, string> = {
    'model.json': canonical(model) + '\n',
    'plan.json': canonical(plan) + '\n',
    'provenance.json': canonical(model.provenance) + '\n',
    'source.json': source,
    'licence.txt':
      '© OpenStreetMap contributors\nDerived geographic database under ODbL 1.0.\nhttps://www.openstreetmap.org/copyright\nhttps://opendatacommons.org/licenses/odbl/1-0/\nSource extract: source.json; normalized derivative: model.json.\nRenderer and application code are not part of this database.\n',
  }
  for (const layout of ['desktop', 'mobile'] as const)
    for (const theme of ['light', 'dark'] as const)
      files[`preview-${layout}-${theme}.svg`] = preview(model, layout, theme)
  for (const [file, content] of Object.entries(files)) outputs.set(`${root}/${file}`, content)
  catalog.push({
    iata: code,
    icao: config.icao,
    name: config.name,
    revision,
    boundsM: model.boundsM,
    model: `${url}/model.json`,
    plan: `${url}/plan.json`,
    provenance: `${url}/provenance.json`,
    source: `${url}/source.json`,
    licence: `${url}/licence.txt`,
    previews: {
      desktop: {
        light: `${url}/preview-desktop-light.svg`,
        dark: `${url}/preview-desktop-dark.svg`,
      },
      mobile: { light: `${url}/preview-mobile-light.svg`, dark: `${url}/preview-mobile-dark.svg` },
    },
  })
  const bytes = Object.fromEntries(
    Object.entries(files).map(([file, content]) => [
      file,
      {
        raw: Buffer.byteLength(content),
        gzip: gzipSync(content).length,
        brotli: brotliCompressSync(content).length,
      },
    ]),
  )
  reports.push({
    iata: code,
    revision,
    projection: model.projection,
    boundsM: model.boundsM,
    physicalRunways,
    features: model.features.length,
    parts: model.features.filter((f) => f.type === 'building' && f.isPart).length,
    vertices: model.features.reduce(
      (sum, f) =>
        sum +
        (f.type === 'line'
          ? f.points.length
          : f.type === 'point'
            ? 1
            : f.polygons.reduce(
                (s, p) => s + p.outer.length + p.holes.reduce((s, h) => s + h.length, 0),
                0,
              )),
      0,
    ),
    bytes,
    diagnostics,
    budgets: {
      model: bytes['model.json']!.gzip <= 512 * 1024,
      plan: bytes['plan.json']!.gzip <= 192 * 1024,
      previews: Object.entries(bytes)
        .filter(([k]) => k.endsWith('.svg'))
        .every(([, v]) => v.gzip <= 160 * 1024),
    },
  })
}
const paths = [...outputs.keys()].map((p) => p.replace('apps/next/public', '')).sort()
outputs.set(
  'apps/next/src/lib/airport-models/catalog.generated.ts',
  `// Generated by scripts/airport-models/prepare.ts.\nimport type { AirportCatalogEntry } from './model'\nexport const airportCatalog: readonly AirportCatalogEntry[] = ${JSON.stringify(catalog, null, 2)}\nexport const airportAssetPaths: readonly string[] = ${JSON.stringify(paths, null, 2)}\n`,
)
outputs.set(
  'scripts/airport-models/report.generated.json',
  JSON.stringify({ generatorVersion: GENERATOR_VERSION, airports: reports }, null, 2) + '\n',
)
let drift = false
for (const [path, content] of outputs) {
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      console.error(`Generated drift: ${path}`)
      drift = true
    }
  } else {
    if (
      path.startsWith('apps/next/public/') &&
      existsSync(path) &&
      readFileSync(path, 'utf8') !== content
    )
      throw new Error(`Refusing immutable overwrite: ${path}`)
    mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true })
    writeFileSync(path, content)
  }
}
if (drift) process.exitCode = 1
console.log(
  JSON.stringify({
    mode: check ? 'check' : 'prepare',
    outputs: outputs.size,
    catalogBytes: Buffer.byteLength(
      outputs.get('apps/next/src/lib/airport-models/catalog.generated.ts')!,
    ),
    airports: reports.map(({ iata, revision, features, physicalRunways, budgets }) => ({
      iata,
      revision,
      features,
      physicalRunways,
      budgets,
    })),
  }),
)
