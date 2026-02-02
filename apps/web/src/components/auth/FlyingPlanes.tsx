import { Plane } from 'lucide-react'

/**
 * Flying planes animation for auth page.
 * Simple straight-line ascent at 45 degrees from bottom-left to top-right.
 */

type PlaneSize = 'S' | 'M' | 'L'

interface PlaneConfig {
  left: string
  duration: number
  delay: number
  opacity: number
  size: number
}

// Size groups: S (small/distant), M (medium), L (large/close)
// More saturated for better visibility
const sizeConfig: Record<PlaneSize, { size: number; opacity: number }> = {
  S: { size: 12, opacity: 0.25 },
  M: { size: 16, opacity: 0.35 },
  L: { size: 22, opacity: 0.45 },
}

// Distribute 30 planes across size groups: 12 small, 10 medium, 8 large
const sizeDistribution: PlaneSize[] = [
  ...Array(12).fill('S' as PlaneSize),
  ...Array(10).fill('M' as PlaneSize),
  ...Array(8).fill('L' as PlaneSize),
]

// Generate 30 planes with grouped sizes and saturated visibility
const planes: PlaneConfig[] = sizeDistribution.map((sizeGroup, i) => {
  const { size, opacity } = sizeConfig[sizeGroup]
  return {
    left: `${(i * 3.3) % 100}%`,
    duration: 10 + Math.random() * 12,
    delay: Math.random() * 18,
    opacity: opacity + Math.random() * 0.08, // slight variation within group
    size,
  }
})

export function FlyingPlanes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {planes.map((plane, i) => (
        <Plane
          key={i}
          className="absolute text-primary animate-plane-ascend"
          style={{
            left: plane.left,
            width: plane.size,
            height: plane.size,
            ['--plane-duration' as string]: `${plane.duration}s`,
            ['--plane-delay' as string]: `${plane.delay}s`,
            ['--plane-opacity' as string]: plane.opacity,
          }}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}
