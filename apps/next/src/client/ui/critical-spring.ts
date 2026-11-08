/**
 * A critically damped physical spring that settles in about `response` seconds and keeps a handed-over `velocity`.
 * Motion's time-defined springs (`duration` / `bounce`) drop the velocity they are given (motion-dom 14.1
 * `generators/spring.mjs`), so a release would restart from rest; stiffness and damping keep the finger's speed.
 */
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
