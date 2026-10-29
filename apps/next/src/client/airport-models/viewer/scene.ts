import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  EdgesGeometry,
  Mesh,
  MeshLambertMaterial,
  Path,
  Shape,
  ShapeGeometry,
  ExtrudeGeometry,
  Vector2,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type {
  AirportFeature,
  AirportModelV1,
  FeatureKind,
  PolygonM,
} from '../../../lib/airport-models/model'
import type { AirportLayers } from './types'
import { buildingVolumes } from '../../../lib/airport-models/geometry'

export type ScenePalette = {
  background: string
  base: string
  pavement: string
  runway: string
  building: string
  line: string
  selected: string
}
type FeatureMesh = Mesh<BufferGeometry, Material>
export type FeatureObject = { feature: AirportFeature; group: Group; meshes: FeatureMesh[] }

function shape(polygon: PolygonM) {
  const result = new Shape(polygon.outer.map(([east, north]) => new Vector2(east, north)))
  result.holes = polygon.holes.map(
    (ring) => new Path(ring.map(([east, north]) => new Vector2(east, north))),
  )
  return result
}

/** Shapes are east/north in XY; -π/2 maps their extrusion into east/height/-north. */
export function polygonGeometry(polygon: PolygonM, height = 0, minHeight = 0) {
  const geometry =
    height > minHeight
      ? new ExtrudeGeometry(shape(polygon), {
          depth: height - minHeight,
          bevelEnabled: false,
          steps: 1,
        })
      : new ShapeGeometry(shape(polygon))
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, minHeight, 0)
  return geometry
}

function lineGeometry(feature: Extract<AirportFeature, { type: 'line' }>, elevation: number) {
  const positions: number[] = []
  const half = feature.width.metres / 2
  for (let i = 1; i < feature.points.length; i++) {
    const a = feature.points[i - 1]!,
      b = feature.points[i]!
    const east = b[0] - a[0],
      north = b[1] - a[1],
      length = Math.hypot(east, north)
    if (!length) continue
    const dx = (-north / length) * half,
      dy = (east / length) * half
    const corners = [
      [a[0] + dx, a[1] + dy],
      [a[0] - dx, a[1] - dy],
      [b[0] + dx, b[1] + dy],
      [b[0] - dx, b[1] - dy],
    ]
    for (const index of [0, 1, 2, 2, 1, 3]) {
      const point = corners[index]!
      positions.push(point[0]!, elevation, -point[1]!)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function buildAirportScene(model: AirportModelV1, palette: ScenePalette) {
  const root = new Group(),
    objects = new Map<string, FeatureObject>()
  const batches: { kind: FeatureKind; mesh: FeatureMesh }[] = []
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>()
  const material = (color: string) => {
    const result = new MeshLambertMaterial({
      color,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    materials.add(result)
    return result
  }
  const base = material(palette.base),
    pavement = material(palette.pavement)
  const runway = material(palette.runway),
    building = material(palette.building)
  const line = material(palette.line)
  const contour = new LineBasicMaterial({ color: palette.selected, depthTest: true })
  materials.add(contour)
  const selection = new Group()
  selection.visible = false
  root.add(selection)
  const addMesh = (group: Group, geometry: BufferGeometry, surface: Material) => {
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    geometries.add(geometry)
    const mesh = new Mesh(geometry, surface)
    group.add(mesh)
    return mesh
  }
  for (const polygon of model.boundary) addMesh(root, polygonGeometry(polygon), base)
  for (const feature of model.features) {
    const group = new Group(),
      meshes: FeatureMesh[] = []
    group.name = feature.id
    const surface =
      feature.kind === 'runway'
        ? runway
        : feature.type === 'building'
          ? building
          : feature.type === 'point' || feature.type === 'line'
            ? line
            : pavement
    if (feature.type === 'surface') {
      // Physical offsets avoid coplanar z-fighting without changing building height units.
      const elevation = feature.kind === 'runway' ? 0.12 : feature.kind === 'apron' ? 0.04 : 0.08
      for (const polygon of feature.polygons)
        meshes.push(addMesh(group, polygonGeometry(polygon, elevation, elevation), surface))
    } else if (feature.type === 'building' && feature.renderFootprint) {
      for (const volume of buildingVolumes(feature))
        for (const polygon of volume.polygons) {
          meshes.push(
            addMesh(group, polygonGeometry(polygon, volume.heightM, volume.minHeightM), surface),
          )
        }
    } else if (feature.type === 'line' && !feature.areaCovered) {
      meshes.push(
        addMesh(group, lineGeometry(feature, feature.kind === 'runway' ? 0.14 : 0.1), surface),
      )
    } else if (feature.type === 'point') {
      const geometry = new CylinderGeometry(2, 2, 1, 6)
      geometry.translate(feature.point[0], 0.5, -feature.point[1])
      meshes.push(addMesh(group, geometry, surface))
    }
    for (const mesh of meshes) mesh.userData.featureId = feature.id
    objects.set(feature.id, { feature, group, meshes })
  }
  // Keep exact, absolute-coordinate feature meshes for picking/outlines on the CPU.
  // Only merged layer/material batches enter the display scene and acquire GPU buffers.
  const buckets = new Map<FeatureKind, Map<Material, BufferGeometry[]>>()
  for (const { feature, meshes } of objects.values()) {
    let surfaces = buckets.get(feature.kind)
    if (!surfaces) buckets.set(feature.kind, (surfaces = new Map()))
    for (const mesh of meshes) {
      let parts = surfaces.get(mesh.material)
      if (!parts) surfaces.set(mesh.material, (parts = []))
      parts.push(mesh.geometry)
    }
  }
  for (const [kind, surfaces] of buckets)
    for (const [surface, parts] of surfaces) {
      const normalized = parts.map((part) => {
        const geometry = part.index ? part.toNonIndexed() : part.clone()
        geometry.deleteAttribute('uv') // No textures; lines and polygons share position/normal.
        return geometry
      })
      const geometry = mergeGeometries(normalized)
      for (const part of normalized) part.dispose()
      if (!geometry) throw new Error('Incompatible airport geometry')
      batches.push({ kind, mesh: addMesh(root, geometry, surface) })
    }
  let pickMeshes = [...objects.values()].flatMap(({ meshes }) => meshes)
  const kinds = [...buckets.keys()]
  let previousLayers: AirportLayers | null = null
  const clearSelection = () => {
    for (const child of [...selection.children]) {
      if (child instanceof LineSegments) child.geometry.dispose()
      selection.remove(child)
    }
  }
  let previousSelection: string | null = null
  return {
    root,
    objects,
    get pickMeshes() {
      return pickMeshes
    },
    update(layers: AirportLayers, selectedId: string | null) {
      if (kinds.some((kind) => previousLayers?.[kind] !== layers[kind])) {
        previousLayers = { ...layers }
        for (const { kind, mesh } of batches) mesh.visible = layers[kind]
        for (const { feature, group } of objects.values()) group.visible = layers[feature.kind]
        pickMeshes = [...objects.values()]
          .filter(({ group }) => group.visible)
          .flatMap(({ meshes }) => meshes)
      }
      const selected = selectedId ? objects.get(selectedId) : undefined
      selection.visible = !!selected && selected.group.visible
      if (selectedId === previousSelection) return
      previousSelection = selectedId
      clearSelection()
      if (selected)
        for (const mesh of selected.meshes) {
          const edge = new EdgesGeometry(mesh.geometry, 20)
          selection.add(new LineSegments(edge, contour))
        }
      // Suppressed duplicate volumes/centre-lines retain their original stable identity in the list.
      if (selected && !selected.meshes.length) {
        const feature = selected.feature
        const outlines =
          feature.type === 'building'
            ? feature.polygons.map((polygon) =>
                polygonGeometry(polygon, feature.height.metres, feature.height.metres),
              )
            : feature.type === 'line'
              ? [lineGeometry(feature, 0.18)]
              : []
        for (const geometry of outlines) {
          selection.add(new LineSegments(new EdgesGeometry(geometry, 20), contour))
          geometry.dispose()
        }
      }
    },
    setPalette(next: ScenePalette) {
      base.color.set(next.base)
      pavement.color.set(next.pavement)
      runway.color.set(next.runway)
      building.color.set(next.building)
      line.color.set(next.line)
      contour.color.set(next.selected)
    },
    dispose() {
      clearSelection()
      for (const geometry of geometries) geometry.dispose()
      for (const item of materials) item.dispose()
      root.clear()
    },
  }
}
