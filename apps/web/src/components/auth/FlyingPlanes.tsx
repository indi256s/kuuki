import { Plane } from 'lucide-react'

/**
 * Orbital planes animation for auth page.
 * Creates curved arcs orbiting around the katakana "クウキ" center.
 * Physics-inspired: close orbits are faster, far orbits are slower.
 */

type OrbitType = 'close' | 'medium' | 'wide' | 'far'

interface PlaneConfig {
  orbit: OrbitType
  left: string
  duration: number
  delay: number
  opacity: number
  size: number
}

// Generate 20 planes distributed across orbital layers
// Physics-accurate: close orbits faster (10-14s), far orbits slower (24-30s)
const planes: PlaneConfig[] = [
  // Close orbits (5 planes) — fast, visible
  ...Array.from({ length: 5 }, (_, i) => ({
    orbit: 'close' as OrbitType,
    left: `${15 + i * 15}%`,
    duration: 10 + Math.random() * 4,
    delay: i * 2 + Math.random() * 2,
    opacity: 0.08 + Math.random() * 0.04,
    size: 14 + Math.random() * 4,
  })),
  // Medium orbits (5 planes)
  ...Array.from({ length: 5 }, (_, i) => ({
    orbit: 'medium' as OrbitType,
    left: `${10 + i * 18}%`,
    duration: 14 + Math.random() * 4,
    delay: i * 3 + Math.random() * 3,
    opacity: 0.06 + Math.random() * 0.04,
    size: 12 + Math.random() * 4,
  })),
  // Wide orbits (5 planes)
  ...Array.from({ length: 5 }, (_, i) => ({
    orbit: 'wide' as OrbitType,
    left: `${5 + i * 20}%`,
    duration: 18 + Math.random() * 4,
    delay: i * 4 + Math.random() * 4,
    opacity: 0.04 + Math.random() * 0.04,
    size: 10 + Math.random() * 4,
  })),
  // Far orbits (5 planes) — slow, subtle
  ...Array.from({ length: 5 }, (_, i) => ({
    orbit: 'far' as OrbitType,
    left: `${0 + i * 22}%`,
    duration: 24 + Math.random() * 6,
    delay: i * 5 + Math.random() * 5,
    opacity: 0.03 + Math.random() * 0.03,
    size: 8 + Math.random() * 4,
  })),
]

export function FlyingPlanes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {planes.map((plane, i) => (
        <Plane
          key={i}
          className={`absolute text-primary animate-orbit-${plane.orbit}`}
          style={{
            left: plane.left,
            width: plane.size,
            height: plane.size,
            ['--orbit-duration' as string]: `${plane.duration}s`,
            ['--orbit-delay' as string]: `${plane.delay}s`,
            ['--plane-opacity' as string]: plane.opacity,
          }}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}
