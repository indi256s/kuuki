import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import polygonClipping from 'polygon-clipping'
import proj4 from 'proj4'
import { adapter, measure, normalize, type Config, type Element } from './normalize'
import {
  buildingVolumes,
  projectPoint,
  worldPoint,
  signedArea,
} from '../../apps/next/src/lib/airport-models/geometry'
import type { PointM } from '../../apps/next/src/lib/airport-models/model'

// Primary owner of import topology/units/projection contracts; existing app tests
// cannot exercise raw OSM data or offline preparation failures.
const geometry = (p: number[][]) => p.map(([lon, lat]) => ({ lon: lon!, lat: lat! }))
const way = (id: number, p: number[][], tags: Record<string, string> = {}): Element => ({
  type: 'way',
  id,
  geometry: geometry(p),
  tags,
})
const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
]
test('raw member chains preserve courtyard holes and reject broken or intersecting rings', () => {
  const elements: Element[] = [
    way(1, [
      [0, 0],
      [10, 0],
      [10, 10],
    ]),
    way(2, [
      [0, 0],
      [0, 10],
      [10, 10],
    ]),
    way(3, [
      [2, 2],
      [2, 4],
      [4, 4],
      [4, 2],
      [2, 2],
    ]),
    {
      type: 'relation',
      id: 4,
      members: [
        { type: 'way', ref: 2, role: 'outer' },
        { type: 'way', ref: 1, role: 'outer' },
        { type: 'way', ref: 3, role: 'inner' },
      ],
    },
  ]
  const a = adapter(elements, (p) => p),
    p = a.polygons(a.get('relation/4'))
  assert.equal(p.length, 1)
  assert.equal(p[0]!.holes.length, 1)
  const building: Element = {
    type: 'relation',
    id: 8,
    tags: { type: 'building' },
    members: [{ type: 'way', ref: 3, role: 'outline' }],
  }
  assert.equal(a.polygons(building)[0]!.outer.length, 5)
  const partOnly: Element = { ...building, members: [{ type: 'way', ref: 3, role: 'part' }] }
  assert.equal(a.polygons(partOnly)[0]!.outer.length, 5)
  assert.throws(
    () => adapter([way(1, square.slice(0, -1))], (p) => p).polygons(way(1, square.slice(0, -1))),
    /Unclosed/,
  )
  assert.throws(
    () =>
      a.polygons(
        way(7, [
          [0, 0],
          [10, 10],
          [0, 10],
          [10, 0],
          [0, 0],
        ]),
      ),
    /Self-intersecting/,
  )
  assert.throws(
    () =>
      a.polygons(
        way(7, [
          [0, 0],
          [10, 0],
          [5, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ]),
      ),
    /Self-intersecting/,
  )
  assert.throws(
    () =>
      adapter([{ type: 'way', id: 1, nodes: [9] }], (p) => p).points({
        type: 'way',
        id: 1,
        nodes: [9],
      }),
    /Missing dependency/,
  )
})
test('raw node dependencies and Overpass out geom normalize to equivalent polygons', () => {
  const nodes: Element[] = square
    .slice(0, -1)
    .map(([lon, lat], i) => ({ type: 'node', id: i + 1, lon, lat }))
  const w: Element = { type: 'way', id: 20, nodes: [1, 2, 3, 4, 1] }
  assert.deepEqual(
    adapter([...nodes, w], (p) => p).polygons(w),
    adapter([], (p) => p).polygons(way(20, square)),
  )
})
test('distance units are explicit and ele cannot become building height', () => {
  assert.deepEqual(measure('60 ft', 0), { metres: 18.288, source: 'osm', raw: '60 ft' })
  assert.equal(measure('12 m', 0).metres, 12)
  assert.throws(() => measure('60 yards', 0), /Unsupported/)
})
const config: Config = {
  iata: 'FIX',
  icao: 'FIXT',
  name: 'Fixture',
  identity: 'way/1',
  zone: 33,
  centre: [15, 0],
  expectedRunways: 1,
  estimates: {
    building: 8,
    terminal: 16,
    hangar: 12,
    tower: 30,
    level: 3.5,
    taxiway: 18,
    runway: 45,
  },
  sourceSha256: 'fixture',
  sourceUrl: 'fixture',
  fetchedAt: null,
  osmTimestamp: null,
  extractedAt: '2026-10-29T00:00:00Z',
}
const coords = (p: number[][]) => p.map(([x, y]) => [15 + x! / 10000, y! / 10000])
const fixture = () => [
  way(
    1,
    coords([
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
      [-20, -20],
    ]),
    { iata: 'FIX', icao: 'FIXT' },
  ),
  way(
    2,
    coords([
      [-15, 0],
      [0, 0],
    ]),
    { aeroway: 'runway', ref: '09/27' },
  ),
  way(
    3,
    coords([
      [0, 0],
      [15, 0],
    ]),
    { aeroway: 'runway', ref: '09/27' },
  ),
]
test('metric UTM independent central-meridian control and camera axis convention', () => {
  const { model } = normalize(fixture(), config, 'extract')
  assert.ok(Math.abs(model.projection.origin[0] - 500000) < 0.001)
  assert.ok(Math.abs(model.projection.origin[1]) < 0.001)
  const runway = model.features.find((f) => f.id === 'osm:way/2')!
  assert.equal(runway.type, 'line')
  if (runway.type === 'line') assert.ok(Math.abs(runway.points[0]![0] + 166.912) < 0.05)
  assert.deepEqual(worldPoint([20, 30], 5), [20, 5, -30])
  const camera = {
    targetM: [0, 0] as [number, number],
    azimuth: 0,
    elevation: Math.PI / 6,
    verticalSpanM: 100,
  }
  assert.deepEqual(projectPoint([10, 0], 0, camera), [10, 0])
  assert.ok(Math.abs(projectPoint([0, 10], 0, camera)[1] - 5) < 1e-10)
  assert.ok(Math.abs(projectPoint([0, 0], 10, camera)[1] - Math.sqrt(75)) < 1e-10)
})
test('building parts replace parent volume, preserve min height, and qualify estimates', () => {
  const elements = [
    ...fixture(),
    way(
      4,
      coords([
        [-10, 2],
        [10, 2],
        [10, 15],
        [-10, 15],
        [-10, 2],
      ]),
      { building: 'yes', ele: '1000' },
    ),
    way(
      5,
      coords([
        [-5, 3],
        [5, 3],
        [5, 10],
        [-5, 10],
        [-5, 3],
      ]),
      { 'building:part': 'yes', height: '60 ft', min_height: '3 m' },
    ),
  ]
  const { model } = normalize(elements, config, 'extract'),
    parent = model.features.find((f) => f.id === 'osm:way/4')!,
    part = model.features.find((f) => f.id === 'osm:way/5')!
  assert.equal(parent.type, 'building')
  assert.equal(part.type, 'building')
  if (parent.type === 'building' && part.type === 'building') {
    assert.equal(parent.renderFootprint, true)
    assert.deepEqual(
      parent.volumeSlices?.map((slice) => [
        slice.minHeightM,
        slice.heightM,
        slice.polygons[0]?.holes.length,
      ]),
      [
        [0, 3, 0],
        [3, 8, 1],
      ],
    )
    assert.equal(parent.height.metres, 8)
    assert.equal(parent.height.source, 'default')
    assert.equal(part.parentId, parent.id)
    assert.equal(part.minHeight.metres, 3)
    assert.equal(part.height.metres, 18.288)
  }
})
// Regression owner: relation assembly must retain observed outline classifications.
test('building relations inherit unambiguous outline tags, preserving canonical relation fields', () => {
  const source = JSON.parse(readFileSync('scripts/airport-models/sources/BER.osm.json', 'utf8'))
  const realConfig = JSON.parse(
    readFileSync('scripts/airport-models/sources/BER.config.json', 'utf8'),
  ) as Config
  const actual = normalize(source.elements, realConfig, 'fixture').model.features.find(
    (f) => f.id === 'osm:relation/14410943',
  )!
  assert.equal(actual.kind, 'terminal')
  assert.equal(actual.label, 'Pier South')
  const outline = way(
    4,
    coords([
      [-10, 2],
      [10, 2],
      [10, 15],
      [-10, 15],
      [-10, 2],
    ]),
    { building: 'yes', aeroway: 'terminal', name: 'Outline name' },
  )
  const relation: Element = {
    type: 'relation',
    id: 5,
    tags: { type: 'building', building: 'yes', name: 'Relation name' },
    members: [{ type: 'way', ref: 4, role: 'outline' }],
  }
  const inherited = normalize(
    [...fixture(), outline, relation],
    config,
    'fixture',
  ).model.features.find((f) => f.id === 'osm:relation/5')!
  assert.equal(inherited.kind, 'terminal')
  assert.equal(inherited.label, 'Relation name')
  const conflicting = way(
    6,
    coords([
      [-15, 2],
      [-12, 2],
      [-12, 5],
      [-15, 5],
      [-15, 2],
    ]),
    { building: 'yes', aeroway: 'hangar' },
  )
  assert.throws(
    () =>
      normalize(
        [
          ...fixture(),
          outline,
          conflicting,
          {
            ...relation,
            members: [...relation.members!, { type: 'way', ref: 6, role: 'outline' }],
          },
        ],
        config,
        'fixture',
      ),
    /Conflicting building outline tag aeroway/,
  )
})
test('split runway identity and area coverage differ from two parallel physical runways', () => {
  const elements = [
    ...fixture(),
    way(
      4,
      coords([
        [-16, -1],
        [16, -1],
        [16, 1],
        [-16, 1],
        [-16, -1],
      ]),
      { 'area:aeroway': 'runway' },
    ),
  ]
  const one = normalize(elements, config, 'extract')
  assert.equal(one.physicalRunways, 1)
  assert.equal(one.model.features.filter((f) => f.type === 'line' && f.areaCovered).length, 2)
  const two = normalize(
    [
      ...elements,
      way(
        5,
        coords([
          [-15, 10],
          [15, 10],
        ]),
        { aeroway: 'runway', ref: '09L/27R' },
      ),
    ],
    { ...config, expectedRunways: 2 },
    'extract',
  )
  assert.equal(two.physicalRunways, 2)
  const bridge = [
    fixture()[0]!,
    way(
      2,
      coords([
        [-15, 0],
        [-5, 0],
      ]),
      { aeroway: 'runway', ref: '09/27' },
    ),
    way(
      3,
      coords([
        [5, 0],
        [15, 0],
      ]),
      { aeroway: 'runway', ref: '09/27' },
    ),
    way(
      4,
      coords([
        [-5, 0],
        [5, 0],
      ]),
      { aeroway: 'runway', ref: '09/27' },
    ),
  ]
  assert.equal(normalize(bridge, config, 'extract').physicalRunways, 1)
  const partial = normalize(
    [
      ...fixture(),
      way(
        6,
        coords([
          [-10, -1],
          [10, -1],
          [10, 1],
          [-10, 1],
          [-10, -1],
        ]),
        { 'area:aeroway': 'runway' },
      ),
    ],
    config,
    'extract',
  )
  assert.equal(
    partial.model.features.some((f) => f.type === 'line' && f.areaCovered),
    false,
  )
  assert.throws(
    () =>
      normalize(
        [
          ...fixture(),
          way(
            5,
            coords([
              [-15, 10],
              [15, 10],
            ]),
            { aeroway: 'runway' },
          ),
        ],
        config,
        'extract',
      ),
    /Unresolved runway/,
  )
})

const realModel = (iata: string) => {
  const source = JSON.parse(readFileSync(`scripts/airport-models/sources/${iata}.osm.json`, 'utf8'))
  const configuration: Config = JSON.parse(
    readFileSync(`scripts/airport-models/sources/${iata}.config.json`, 'utf8'),
  )
  return normalize(source.elements, configuration, 'fixture').model
}
test('real terminal envelopes leave separately mapped buildings and parts physically exposed', () => {
  const tbs = realModel('TBS')
  const envelope = tbs.features.find((f) => f.id === 'osm:relation/20405381')!
  assert.equal(envelope.type, 'building')
  if (envelope.type !== 'building') throw new Error('Expected terminal envelope')
  assert.equal(envelope.renderFootprint, false)
  for (const id of ['osm:relation/20405380', 'osm:relation/20405382']) {
    const component = tbs.features.find((f) => f.id === id)!
    assert.equal(component.type, 'building')
    if (component.type !== 'building') throw new Error('Expected terminal building')
    assert.equal(component.height.metres, 10.5)
    assert.equal(component.renderFootprint, true)
  }
  const ber = realModel('BER')
  const terminal = ber.features.find((f) => f.id === 'osm:way/1132137322')!
  const part = ber.features.find((f) => f.id === 'osm:way/158249936')!
  if (terminal.type !== 'building' || part.type !== 'building')
    throw new Error('Expected BER volumes')
  assert.equal(part.parentId, 'osm:relation/14410944')
  const overlap = polygonClipping.intersection(
    buildingVolumes(terminal)
      .filter(
        (volume) =>
          volume.minHeightM < part.height.metres && volume.heightM > part.minHeight.metres,
      )
      .flatMap((volume) => volume.polygons)
      .map((p) => [p.outer, ...p.holes]),
    part.polygons.map((p) => [p.outer, ...p.holes]),
  )
  const overlapArea = overlap.reduce(
    (sum, rings) =>
      sum +
      Math.abs(signedArea(rings[0]! as PointM[])) -
      rings.slice(1).reduce((holes, ring) => holes + Math.abs(signedArea(ring as PointM[])), 0),
    0,
  )
  assert.ok(
    overlapArea < 0.01,
    `Duplicate terminal extrusion covers ${overlapArea} square metres of a canonical part`,
  )
})
test('observed TBS control tower tags belong to the tower layer, preserving height provenance', () => {
  const tower = realModel('TBS').features.find((f) => f.id === 'osm:way/1059294082')!
  assert.equal(tower.kind, 'tower')
  assert.equal(tower.type, 'building')
  if (tower.type !== 'building') throw new Error('Expected physical tower')
  assert.deepEqual(tower.height, { metres: 14, source: 'levels', raw: '4' })
})

// Regression owner: 2D clipping cannot erase ground-floor mass below a floating roof.
test('BER elevated roof parts preserve canonical building volume below their minimum height', () => {
  const model = realModel('BER')
  const parent = model.features.find((f) => f.id === 'osm:relation/14410944')!
  const roof = model.features.find((f) => f.id === 'osm:way/1082978657')!
  if (parent.type !== 'building' || roof.type !== 'building')
    throw new Error('Expected BER volumes')
  assert.equal(roof.minHeight.metres, 34)
  assert.equal(parent.height.metres, 32)
  const terminal = model.features.find((f) => f.id === 'osm:way/1132137322')!
  if (terminal.type !== 'building') throw new Error('Expected terminal envelope')
  for (const height of [1, 10, 20, 31]) {
    const footprints = [parent, terminal].flatMap((feature) =>
      buildingVolumes(feature)
        .filter((volume) => volume.minHeightM <= height && volume.heightM > height)
        .flatMap((volume) => volume.polygons)
        .map((p) => [p.outer, ...p.holes]),
    )
    const overlap = polygonClipping.intersection(
      footprints,
      roof.polygons.map((p) => [p.outer, ...p.holes]),
    )
    const area = overlap.reduce(
      (sum, rings) =>
        sum +
        Math.abs(signedArea(rings[0]! as PointM[])) -
        rings.slice(1).reduce((total, ring) => total + Math.abs(signedArea(ring as PointM[])), 0),
      0,
    )
    assert.ok(
      area > 5500,
      `Elevated roof erased lower building volume at ${height}m (${area} square metres remain)`,
    )
  }
})
test('near-equal nested building footprints retain their union without subtraction cycles', () => {
  const rings: PointM[][] = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [9.9, 10.06],
      [9.8, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [9.9, 10.06],
      [9.8, 10],
      [0.2, 10],
      [0.1, 10.06],
      [0, 10],
      [0, 0],
    ],
  ]
  const buildings = rings.map((ring, index) =>
    way(
      13 - index,
      ring.map(([x, y]) =>
        proj4('+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs', 'EPSG:4326', [500000 + x, y]),
      ),
      { building: 'yes', height: '4' },
    ),
  )
  const model = normalize([...fixture(), ...buildings], config, 'fixture').model
  const area = model.features
    .filter((f) => f.type === 'building')
    .flatMap(buildingVolumes)
    .filter((v) => v.minHeightM <= 1 && v.heightM > 1)
    .flatMap((v) => v.polygons)
    .reduce(
      (sum, p) =>
        sum +
        Math.abs(signedArea(p.outer)) -
        p.holes.reduce((total, ring) => total + Math.abs(signedArea(ring)), 0),
      0,
    )
  assert.ok(Math.abs(area - 100.012) < 0.0001, `Expected intact nested union, got ${area}`)
})
