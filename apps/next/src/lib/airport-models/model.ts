export type PointM = [number, number]
export type BoundsM = [number, number, number, number]
export type Measure = {
  metres: number
  source: 'osm' | 'levels' | 'default' | 'geometry'
  raw?: string
}
export type PolygonM = { outer: PointM[]; holes: PointM[][] }
export type BuildingVolume = { polygons: PolygonM[]; minHeightM: number; heightM: number }
export type CameraPose = {
  targetM: PointM
  azimuth: number
  elevation: number
  verticalSpanM: number
}
export type FeatureKind =
  | 'runway'
  | 'taxiway'
  | 'apron'
  | 'stand'
  | 'terminal'
  | 'hangar'
  | 'building'
  | 'tower'
  | 'gate'
type FeatureBase = { id: string; kind: FeatureKind; label?: string; ref?: string; surface?: string }
export type AirportFeature = FeatureBase &
  (
    | { type: 'surface'; polygons: PolygonM[]; physicalRunwayId?: string; directions?: string[] }
    | {
        type: 'line'
        points: PointM[]
        width: Measure
        length?: Measure
        geometryLength?: Measure
        physicalRunwayId?: string
        directions?: string[]
        areaCovered?: boolean
      }
    | {
        type: 'building'
        polygons: PolygonM[]
        volumeSlices?: BuildingVolume[]
        height: Measure
        minHeight: Measure
        parentId?: string
        isPart: boolean
        renderFootprint: boolean
      }
    | { type: 'point'; point: PointM }
  )
export type SourceProvenance = {
  attribution: string
  licence: string
  licenceUrl: string
  sourceUrl: string
  sourceSha256: string
  extractSha256: string
  fetchedAt: string | null
  osmTimestamp: string | null
  extractedAt: string
  generatorVersion: string
  identity: string
  sourceUrls?: string[]
  sourceBboxes?: number[][]
  acquisition?: string
}
export type AirportModelV1 = {
  schemaVersion: 1
  iata: string
  icao: string
  revision: string
  projection: { crs: string; origin: PointM }
  boundsM: BoundsM
  boundary: PolygonM[]
  features: AirportFeature[]
  cameras: { desktop: CameraPose; mobile: CameraPose }
  provenance: SourceProvenance
}
export type AirportPlanV1 = Pick<
  AirportModelV1,
  'schemaVersion' | 'iata' | 'revision' | 'boundsM' | 'boundary'
> & {
  features: AirportFeature[]
}
export type AirportCatalogEntry = {
  iata: string
  icao: string
  name: string
  revision: string
  boundsM: BoundsM
  model: string
  plan: string
  provenance: string
  source: string
  licence: string
  previews: { desktop: { light: string; dark: string }; mobile: { light: string; dark: string } }
}
