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
// Increased opacity for better visibility
const sizeConfig: Record<PlaneSize, { size: number; opacity: number }> = {
  S: { size: 12, opacity: 0.12 },
  M: { size: 16, opacity: 0.18 },
  L: { size: 22, opacity: 0.25 },
}

// Distribute 20 planes across size groups: 8 small, 7 medium, 5 large
const sizeDistribution: PlaneSize[] = [
  ...Array(8).fill('S' as PlaneSize),
  ...Array(7).fill('M' as PlaneSize),
  ...Array(5).fill('L' as PlaneSize),
]

// Generate 20 planes with grouped sizes and increased visibility
const planes: PlaneConfig[] = sizeDistribution.map((sizeGroup, i) => {
  const { size, opacity } = sizeConfig[sizeGroup]
  return {
    left: `${(i * 5) % 100}%`,
    duration: 12 + Math.random() * 10,
    delay: Math.random() * 15,
    opacity: opacity + Math.random() * 0.04, // slight variation within group
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
