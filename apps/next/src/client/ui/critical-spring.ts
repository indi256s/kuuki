export function criticalSpring(response: number, velocity = 0) {
  const stiffness = ((2 * Math.PI) / response) ** 2
  return {
    type: 'spring' as const,
    stiffness,
    damping: 2 * Math.sqrt(stiffness),
    mass: 1,
    velocity,
  }
}
