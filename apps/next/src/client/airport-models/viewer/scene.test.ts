import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  Box3,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Raycaster,
  Vector3,
} from 'three'
import { airportCatalog } from '../../../lib/airport-models/catalog.generated'
import { projectPoint, worldPoint } from '../../../lib/airport-models/geometry'
import type {
  AirportFeature,
  AirportModelV1,
  CameraPose,
  PolygonM,
} from '../../../lib/airport-models/model'
import { applyCamera, focusPose } from './camera'
import { buildAirportScene, polygonGeometry } from './scene'
import { defaultAirportLayers } from './types'

const square = (west: number, south: number, east: number, north: number): PolygonM => ({
  outer: [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ],
  holes: [],
})
const pose: CameraPose = { targetM: [0, 0], azimuth: 0, elevation: Math.PI / 4, verticalSpanM: 100 }
const palette = {
  background: 'white',
  base: 'white',
  pavement: 'gray',
  runway: 'gray',
  building: 'gray',
  line: 'gray',
  selected: 'red',
}

describe('real Three metric geometry', () => {
  it('preserves courtyard holes, measured roof/min-height and the parent remainder in raycasts', () => {
    const polygon = { ...square(0, 0, 20, 20), holes: [square(5, 5, 15, 15).outer] }
    const geometry = polygonGeometry(polygon, 12, 3)
    const material = new MeshBasicMaterial(),
      mesh = new Mesh(geometry, material)
    mesh.updateMatrixWorld()
    const ray = new Raycaster(new Vector3(10, 100, -10), new Vector3(0, -1, 0))
    expect(ray.intersectObject(mesh)).toHaveLength(0)
    ray.ray.origin.set(2, 100, -10)
    expect(ray.intersectObject(mesh)[0]?.point.y).toBeCloseTo(12)
    ray.ray.origin.set(2, 0, -10)
    ray.ray.direction.set(0, 1, 0)
    expect(ray.intersectObject(mesh)[0]?.point.y).toBeCloseTo(3)
    const box = new Box3().setFromObject(mesh)
    expect(box.min.toArray()).toEqual([0, 3, -20])
    expect(box.max.y).toBeCloseTo(12)
    geometry.dispose()
    material.dispose()

    const parent: AirportFeature = {
      id: 'osm:way/1',
      kind: 'terminal',
      type: 'building',
      polygons: [square(0, 0, 20, 20)],
      volumeSlices: [{ polygons: [polygon], minHeightM: 3, heightM: 12 }],
      height: { metres: 12, source: 'osm' },
      minHeight: { metres: 3, source: 'osm' },
      isPart: false,
      renderFootprint: true,
    }
    const lowerFloor: AirportFeature = {
      ...parent,
      id: 'osm:way/3',
      minHeight: { metres: 0, source: 'osm' },
      volumeSlices: [
        { polygons: parent.polygons, minHeightM: 0, heightM: 3 },
        { polygons: [polygon], minHeightM: 3, heightM: 12 },
      ],
    }
    const suppressed: AirportFeature = {
      ...parent,
      id: 'osm:way/2',
      kind: 'tower',
      renderFootprint: false,
    }
    const model = {
      features: [parent, suppressed, lowerFloor],
      boundary: [],
    } as unknown as AirportModelV1
    const airport = buildAirportScene(model, palette)
    airport.root.updateMatrixWorld(true)
    ray.ray.origin.set(10, 100, -10)
    ray.ray.direction.set(0, -1, 0)
    expect(ray.intersectObjects(airport.objects.get(parent.id)!.meshes)).toHaveLength(0)
    expect(
      ray.intersectObjects(airport.objects.get(lowerFloor.id)!.meshes)[0]?.point.y,
    ).toBeCloseTo(3)
    airport.update(defaultAirportLayers, suppressed.id)
    const selection = airport.root.children[0]!
    expect(selection.visible).toBe(true)
    expect(selection.children.some((child) => child instanceof LineSegments)).toBe(true)
    const displayHits = () => {
      const meshes: Mesh[] = []
      airport.root.traverseVisible((child) => {
        if (child instanceof Mesh) meshes.push(child)
      })
      return ray.intersectObjects(meshes)
    }
    expect(displayHits()[0]?.point.y).toBeCloseTo(3)
    airport.update({ ...defaultAirportLayers, tower: false }, suppressed.id)
    expect(selection.visible).toBe(false)
    airport.update({ ...defaultAirportLayers, terminal: false }, null)
    expect(displayHits()).toHaveLength(0)
    expect(ray.intersectObjects(airport.pickMeshes)).toHaveLength(0)
    airport.dispose()
  })

  it('matches the sealed preview projection through a physical above-ground camera', () => {
    const camera = new OrthographicCamera()
    for (const azimuth of [0, -0.6, 1.2]) {
      const current = { ...pose, azimuth, targetM: [25, -17] as [number, number] }
      applyCamera(camera, current, 800, 600, 10000)
      expect(camera.position.y).toBeGreaterThan(0)
      for (const [point, height] of [
        [[125, 83], 0],
        [[-30, -20], 40],
      ] as const) {
        const location: [number, number] = [point[0], point[1]]
        const rendered = new Vector3(...worldPoint(location, height)).project(camera)
        const projected = projectPoint(location, height, current)
        expect((rendered.x * 800) / 2).toBeCloseTo(projected[0] * 6, 5)
        expect((rendered.y * 600) / 2).toBeCloseTo(projected[1] * 6, 5)
      }
    }
    applyCamera(camera, pose, 800, 600, 10000)
    expect(camera.position.z).toBeGreaterThan(0)
    expect(new Vector3(10, 0, 0).project(camera).x).toBeGreaterThan(0)
    expect(new Vector3(0, 0, -10).project(camera).y).toBeGreaterThan(0)
  })

  it('fits the actual 3D bounds inside the unobscured rectangle on explicit focus', () => {
    const feature: AirportFeature = {
      id: 'osm:way/3',
      kind: 'terminal',
      type: 'building',
      polygons: [square(-300, -100, 500, 200)],
      height: { metres: 80, source: 'osm' },
      minHeight: { metres: 10, source: 'osm' },
      isPart: false,
      renderFootprint: true,
    }
    for (const [width, height, insets] of [
      [1440, 900, { top: 80, right: 400, bottom: 60, left: 24 }],
      [390, 844, { top: 80, right: 12, bottom: 360, left: 12 }],
    ] as const) {
      const focused = focusPose(feature, { ...pose, azimuth: -0.6 }, width, height, insets)
      for (const [east, north] of [
        [-300, -100],
        [500, -100],
        [500, 200],
        [-300, 200],
      ])
        for (const elevation of [10, 80]) {
          const point = projectPoint([east!, north!], elevation, focused)
          const x = width / 2 + (point[0] * height) / focused.verticalSpanM
          const y = height / 2 - (point[1] * height) / focused.verticalSpanM
          expect(x).toBeGreaterThanOrEqual(insets.left)
          expect(x).toBeLessThanOrEqual(width - insets.right)
          expect(y).toBeGreaterThanOrEqual(insets.top)
          expect(y).toBeLessThanOrEqual(height - insets.bottom)
        }
    }
  })

  it.each(airportCatalog)(
    'constructs and raycasts prepared $iata buildings without airport-specific branches',
    (entry) => {
      const model = JSON.parse(
        readFileSync(new URL(`../../../../public${entry.model}`, import.meta.url), 'utf8'),
      ) as AirportModelV1
      const airport = buildAirportScene(model, palette)
      airport.root.updateMatrixWorld(true)
      const building = [...airport.objects.values()].find(
        (item) => item.feature.type === 'building' && item.meshes.length > 0,
      )!
      const bounds = new Box3().setFromObject(building.group),
        centre = bounds.getCenter(new Vector3())
      // A vertical ray at an actual mesh vertex inset toward its triangle centre must meet that building.
      const mesh = building.meshes[0]!,
        vertices = mesh.geometry.getAttribute('position')
      let picked = false
      for (let i = 0; i + 2 < vertices.count && !picked; i += 3) {
        const triangle = [0, 1, 2].map((offset) =>
          new Vector3().fromBufferAttribute(vertices, i + offset),
        )
        const sample = triangle[0]!.clone().add(triangle[1]!).add(triangle[2]!).divideScalar(3)
        const ray = new Raycaster(
          new Vector3(sample.x, bounds.max.y + 100, sample.z),
          new Vector3(0, -1, 0),
        )
        picked = ray
          .intersectObjects(building.meshes)
          .some((hit) => hit.object.userData.featureId === building.feature.id)
      }
      expect(centre.toArray().every(Number.isFinite)).toBe(true)
      expect(picked).toBe(true)
      airport.dispose()
    },
  )
})
