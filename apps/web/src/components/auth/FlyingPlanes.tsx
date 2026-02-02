import { Plane } from 'lucide-react'

/**
 * Matrix-style ascending planes animation for auth page.
 * Creates a "departures board" ambience with small plane icons
 * drifting upward at varying speeds and opacities.
 */

const planes = [
  { left: '10%', duration: 18, delay: 0, opacity: 0.12, size: 16 },
  { left: '30%', duration: 22, delay: 3, opacity: 0.08, size: 14 },
  { left: '50%', duration: 16, delay: 7, opacity: 0.15, size: 18 },
  { left: '70%', duration: 20, delay: 1, opacity: 0.10, size: 15 },
  { left: '20%', duration: 24, delay: 11, opacity: 0.09, size: 14 },
  { left: '60%', duration: 17, delay: 5, opacity: 0.11, size: 16 },
  { left: '40%', duration: 21, delay: 9, opacity: 0.13, size: 17 },
  { left: '80%', duration: 19, delay: 13, opacity: 0.08, size: 13 },
  { left: '15%', duration: 25, delay: 6, opacity: 0.07, size: 12 },
  { left: '75%', duration: 15, delay: 2, opacity: 0.14, size: 16 },
]

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
            opacity: plane.opacity,
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
