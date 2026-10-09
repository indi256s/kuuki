export type GlobeLand = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>

function countryCode(feature: GlobeLand['features'][number]): string {
  return String(feature.id ?? feature.properties?.id ?? '')
}

export function isLand(value: unknown): value is GlobeLand {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value) ||
    value.type !== 'FeatureCollection' ||
    !('features' in value) ||
    !Array.isArray(value.features) ||
    value.features.length !== 174
  )
    return false
  const codes = new Set<string>()
  const ring = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number' &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 180 &&
        Math.abs(point[1]) <= 90,
    ) &&
    value[0][0] === value.at(-1)[0] &&
    value[0][1] === value.at(-1)[1]
  const polygon = (value: unknown): boolean =>
    Array.isArray(value) && value.length > 0 && value.every(ring)
  return value.features.every((feature) => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return false
    const code = countryCode(feature)
    if (!/^[A-Z]{2}$/.test(code) || codes.has(code)) return false
    codes.add(code)
    const geometry = feature.geometry
    return geometry.type === 'Polygon'
      ? polygon(geometry.coordinates)
      : geometry.type === 'MultiPolygon' &&
          Array.isArray(geometry.coordinates) &&
          geometry.coordinates.length > 0 &&
          geometry.coordinates.every(polygon)
  })
}
