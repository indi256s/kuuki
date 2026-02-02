import { Plane } from 'lucide-react'

/**
 * Flying planes animation for auth page.
 * Simple straight-line ascent at 45 degrees from bottom-left to top-right.
 */

interface PlaneConfig {
  left: string
  duration: number
  delay: number
  opacity: number
  size: number
}

// Generate 20 planes with varied positions, speeds, and sizes
const planes: PlaneConfig[] = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 5) % 100}%`,
  duration: 12 + Math.random() * 10,
  delay: Math.random() * 15,
  opacity: 0.04 + Math.random() * 0.08,
  size: 10 + Math.random() * 8,
}))

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
