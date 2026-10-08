export function ridgeProfile(minutes: number[], samples = 128): { x: number; height: number }[] {
  const values = minutes.filter(value => Number.isFinite(value) && value > 0).map(Math.log)
  const count = Math.max(2, Math.floor(Number.isFinite(samples) ? samples : 128))
  const dense = values.length >= 8, bandwidth = dense ? 0.18 : 0.035
  const low = Math.log(30), high = Math.log(1020)
  const profile = Array.from({ length: count }, (_, i) => {
    const log = low + i / (count - 1) * (high - low)
    const density = values.reduce((sum, value) => sum + Math.exp(-0.5 * ((log - value) / bandwidth) ** 2), 0)
    return { x: Math.exp(log), height: density }
  })
  const peak = Math.max(0, ...profile.map(point => point.height))
  return profile.map(point => ({ ...point, height: dense ? (peak ? point.height / peak : 0) : Math.min(1, point.height * 0.4) }))
}
